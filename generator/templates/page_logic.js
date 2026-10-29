
// Page logic. Model data (A, C, F, V, LANES, PH, S, ...) and UI strings (T) are injected by build.py before this file.
// tf(key, vars) fills {placeholders} in a UI string.
const tf=(k,vars)=>Object.entries(vars||{}).reduce((s,[a,b])=>s.split("{"+a+"}").join(b),T[k]);
const LC={L1:"--l1",L2:"--l2",L3:"--l3",L4:"--l4",L5:"--l5",L6:"--l6",L7:"--l7"};
const MSTAT=T.ms_status;
const PLAT_LABEL={ios:T.plat_ios,android:T.plat_android,both:T.plat_both};

// ---------- Page state
let st={plat:"all",role:"",lane:"",phases:[],q:"",onlyVar:false,onlyDoubt:false,sel:"S0.1",view:null,tab:"ov",client:"",version:""};
let rev={};try{rev=JSON.parse(localStorage.getItem("mapm-rev")||"{}")}catch(e){rev={}}
const save=()=>{try{localStorage.setItem("mapm-rev",JSON.stringify(rev))}catch(e){}};
try{const h=location.hash.slice(1);if(byId[h])st.sel=h}catch(e){}

// ---------- Storage: shared db with local fallback
// clients/{id} = {name, lanes:{L1..L7:text}, variants:{V1..V14:key}, ren:{R01:date}, start:date, plan:{<activity>:{min,max,after,done}}, extra:[activity], createdAt}
// clients/{id}/versions/{vid} = {name, checks:{c1:1}, status:{m1:"blk"}, notes:{m1:text}, createdAt}
let db=null,dbUser=null,canWrite=true;
let clients={},versions={};
const LS=k=>{try{return JSON.parse(localStorage.getItem(k)||"null")}catch(e){return null}};
const LSW=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
function loadLocal(){clients=LS("mapm-clients")||{};versions=LS("mapm-versions")||{};if(typeof PRESET_CLIENT!=="undefined"&&PRESET_CLIENT){if(!clients.preset)clients.preset=PRESET_CLIENT;else{const p=clients.preset;p.extra=PRESET_CLIENT.extra;if(!p.plan&&PRESET_CLIENT.plan)p.plan=PRESET_CLIENT.plan;if(!p.start&&PRESET_CLIENT.start)p.start=PRESET_CLIENT.start}LSW("mapm-clients",clients)}if(typeof PRESET_CLIENT!=="undefined"&&PRESET_CLIENT&&!st.client)st.client="preset"}
const uid=()=>Math.random().toString(36).slice(2,10);
async function putClient(id,data){clients[id]=data;if(db&&canWrite){try{await db.doc("clients/"+id).set(data);return}catch(e){if(e&&e.code==="invalid_argument"){canWrite=false;setStore()}}}LSW("mapm-clients",clients)}
async function putVersion(cid,vid,data){versions[cid]=versions[cid]||{};versions[cid][vid]=data;if(db&&canWrite){try{await db.doc("clients/"+cid+"/versions/"+vid).set(data);return}catch(e){if(e&&e.code==="invalid_argument"){canWrite=false;setStore()}}}LSW("mapm-versions",versions)}
function setStore(){storeTxt.textContent=db?(canWrite?T.store_shared:T.store_readonly):T.store_local}
let unsubV=null;
function subscribeVersions(cid){if(unsubV){unsubV();unsubV=null}if(!db||!cid)return;
  unsubV=db.collection("clients/"+cid+"/versions").onSnapshot(snap=>{versions[cid]={};snap.docs.forEach(d=>versions[cid][d.id]=d.data());if(st.version&&!versions[cid][st.version])st.version="";if(!st.version){const ids=Object.keys(versions[cid]);if(ids.length)st.version=ids.sort((a,b)=>(versions[cid][b].createdAt||"").localeCompare(versions[cid][a].createdAt||""))[0]}render()},e=>{});}

// ---------- Active instance
const cur=()=>clients[st.client]||null;
function laneLabel(id){const c=cur();if(c&&c.lanes&&c.lanes[id])return c.lanes[id];const l=LANES.find(x=>x[0]===id);return l?l[1]:""}
function laneSub(id){const c=cur();if(c&&c.lanes&&c.lanes[id])return LANES.find(x=>x[0]===id)[1];return T.lane_sub[id]}
const variantOf=v=>{const c=cur();return c&&c.variants&&c.variants[v]||""};

// ---------- Helpers
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function linkify(t){return esc(t).replace(/\b([ACF]\d{2}|S\d{1,2}\.\d{1,2})\b/g,m=>{const k=m[0];let lab="";
  if(k==="A")lab=A[m];else if(k==="C")lab=C[m]&&C[m][0];else if(k==="F")lab=F[m]&&F[m][0];else lab=byId[m]&&byId[m].name;
  if(!lab)return m;return `<button class="chip" data-go="${k==="S"?"step":k}:${m}"><b>${m}</b>${k==="S"?"":esc(lab)}</button>`})}
function toast(t){const el=document.getElementById("toast");el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2400)}
function setTab(t){st.tab=t;[["ov",tabOv,ovView],["rm",tabRm,rmView],["vr",tabVr,vrView],["dt",tabDt,dtView],["in",tabIn,inView],["rn",tabRn,rnView]].forEach(([k,b,v])=>{b.setAttribute("aria-selected",k===t);v.hidden=k!==t})}
function go(id,scroll){st.sel=id;st.view=null;try{history.replaceState(null,"","#"+id)}catch(e){}setTab("dt");render();
  if(scroll){const el=rail.querySelector(`[data-id="${CSS.escape(id)}"]`);el&&el.scrollIntoView({block:"nearest"})}
  if(matchMedia("(max-width:860px)").matches&&scroll!==false)detail.scrollIntoView({block:"start"})}

// ---------- Swimlane diagram (one color per lane)
function renderSwim(){
  const X0=110,CW=156,BW=146,BH1=40,BH2=52,GAP=10,HEAD=84,PADR=14;
  const col=Object.fromEntries(LANES.map((l,i)=>[l[0],i]));
  const rows=STAGES.map((_,r)=>{let mx=1;LANES.forEach(l=>{const n=BOX.filter(b=>b[2]===r&&b[1]===l[0]);let h=n.reduce((a,b)=>a+(b[3].length>1?BH2:BH1)+GAP,0)-GAP;mx=Math.max(mx,h)});return Math.max(mx,BH2)+2*PADR});
  const rowY=[];let y=HEAD;rows.forEach(h=>{rowY.push(y);y+=h});const H=y+12,W=X0+LANES.length*CW+12;
  const pos={};STAGES.forEach((_,r)=>LANES.forEach(l=>{let yy=rowY[r]+PADR;BOX.filter(b=>b[2]===r&&b[1]===l[0]).forEach(b=>{const h=b[3].length>1?BH2:BH1;pos[b[0]]={x:X0+col[l[0]]*CW+(CW-BW)/2,y:yy,w:BW,h};yy+=h+GAP})}));
  let s=`<defs><marker id="sw-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah" d="M0 0L10 5L0 10z"/></marker></defs>`;
  LANES.forEach((l,i)=>{const x=X0+i*CW;s+=`<rect x="${x+6}" y="10" width="${CW-12}" height="60" rx="8" fill="var(${LC[l[0]]}s)"/><rect x="${x+6}" y="10" width="${CW-12}" height="4" rx="2" fill="var(${LC[l[0]]})"/>`});
  rowY.forEach(ry=>{s+=`<line class="rule" x1="0" x2="${W}" y1="${ry}" y2="${ry}"/>`});
  LANES.forEach((l,i)=>{const cx=X0+i*CW+CW/2;const name=laneLabel(l[0]);const words=name.split(" ");const two=name.length>16&&words.length>1;const l1=two?words.slice(0,Math.ceil(words.length/2)).join(" "):name,l2=two?words.slice(Math.ceil(words.length/2)).join(" "):"";
    s+=`<text class="hd" x="${cx}" y="${l2?30:36}" text-anchor="middle" fill="var(${LC[l[0]]})">${esc(l1)}</text>${l2?`<text class="hd" x="${cx}" y="45" text-anchor="middle" fill="var(${LC[l[0]]})">${esc(l2)}</text>`:""}<text class="hs" x="${cx}" y="${l2?60:54}" text-anchor="middle">${esc(laneSub(l[0]).slice(0,26))}</text>`});
  STAGES.forEach(([n,phs],r)=>{const words=n.split(" ");const a=words.slice(0,Math.ceil(words.length/2)).join(" "),b=words.slice(Math.ceil(words.length/2)).join(" ");
    s+=`<text class="st" x="12" y="${rowY[r]+PADR+12}">${esc(a)}</text><text class="st" x="12" y="${rowY[r]+PADR+27}">${esc(b)}</text><text class="sp" x="12" y="${rowY[r]+PADR+43}">${phs.length>1?phs[0]+"–"+phs.at(-1):phs[0]}</text>`});
  for(let n=1;n<22;n++){const a=pos[n],b=pos[n+1];if(!a||!b)continue;const ba=BOX[n-1],bb=BOX[n];
    const ac={x:a.x+a.w/2,y:a.y+a.h/2},bc={x:b.x+b.w/2,y:b.y+b.h/2};let p;
    if(ba[2]===bb[2]&&a.x!==b.x){const lo=Math.min(a.x,b.x),hi=Math.max(a.x,b.x),y1=Math.min(ac.y,bc.y),y2=Math.max(ac.y,bc.y);
      if(BOX.some(o=>{const q=pos[o[0]];return o!==ba&&o!==bb&&q.x>lo&&q.x<hi&&q.y<=y2&&q.y+q.h>=y1}))continue;
      const sx=b.x>a.x?a.x+a.w:a.x,ex=b.x>a.x?b.x:b.x+b.w,dx=(ex-sx)/2;p=`M${sx} ${ac.y}C${sx+dx} ${ac.y} ${ex-dx} ${bc.y} ${ex} ${bc.y}`}
    else{const sy=a.y+a.h,ey=b.y,dy=Math.max(18,(ey-sy)/2);p=`M${ac.x} ${sy}C${ac.x} ${sy+dy} ${bc.x} ${ey-dy} ${bc.x} ${ey}`}
    s+=`<path class="arr" d="${p}" marker-end="url(#sw-ah)"/>`}
  BOX.forEach(([n,lid,r,lines])=>{const p=pos[n];const c=`var(${LC[lid]})`;
    s+=`<g class="bx" tabindex="0" role="button" data-box="${n}" aria-label="${n}. ${esc(lines.join(" "))}, ${esc(laneLabel(lid))}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="8" fill="var(${LC[lid]}s)" stroke="${c}"/><circle cx="${p.x+13}" cy="${p.y+14}" r="9" fill="${c}"/><text class="num" x="${p.x+13}" y="${p.y+17.5}" text-anchor="middle">${n}</text>${lines.map((t,k)=>`<text x="${p.x+28}" y="${p.y+18+k*15}">${esc(t)}</text>`).join("")}</g>`});
  swim.setAttribute("viewBox",`0 0 ${W} ${H}`);swim.style.width=W+"px";swim.innerHTML=s;
}
function openBox(n){const b=BOX.find(x=>x[0]===n);if(!b)return;st.lane=b[1];st.phases=b[4];laneSel.value=b[1];b[4].forEach(p=>openPh.add(p));
  const first=S.find(s=>b[4].includes(s.ph)&&lanesOf(s).includes(b[1]));if(first)go(first.id,false);else{setTab("dt");render()}window.scrollTo({top:0})}
function renderPairs(){
  const el=document.getElementById("pairAlerts");const c=cur();
  const norm=t=>(t||"").trim().toLowerCase();
  const same=(a,b)=>{const la=laneOfRole[a],lb=laneOfRole[b];if(la===lb)return true;if(!c||!c.lanes)return false;const na=norm(c.lanes[la]),nb=norm(c.lanes[lb]);return na&&na===nb};
  const hits=PAIRS.filter(([a,b])=>same(a,b));
  el.innerHTML=hits.map(([a,b,risk,sev])=>`<div class="alert"><b>${esc(tf("pair_alert",{a:A[a],b:A[b],lane:laneLabel(laneOfRole[a]),sev:T.severity[sev]||sev}))}</b>${esc(risk)}.${esc(T.pair_alert_tail)}</div>`).join("");
}
// ---------- Plan by activity
// ACT rows: [id, name, lane, min, max, after[], continuous, per_version]. A client may override min/max/after,
// mark an activity done (date or true) and add its own activities (extra). Two scenarios are computed apart:
// fast (every activity at its min) and slow (every activity at its max).
const planSrc=()=>{const c=cur();return c?{start:c.start||"",plan:c.plan||{},extra:c.extra||[]}:{start:LS("mapm-start")||"",plan:LS("mapm-plan")||{},extra:[]}};
async function savePlan(start,plan){const c=cur();if(c){const n={...c,plan};if(start)n.start=start;else delete n.start;await putClient(st.client,n)}else{LSW("mapm-start",start||null);LSW("mapm-plan",plan)}renderTimeline();renderRoadmap()}
function planActs(src,ignoreDone){
  const base=ACT.map((r,i)=>({id:r[0],name:r[1],lane:r[2],min:r[3],max:r[4],after:r[5],cont:r[6],ver:r[7],extra:false,i}));
  const ext=src.extra.map((x,j)=>({id:String(x.id),name:x.name,lane:x.lane,min:x.min,max:x.max,after:(x.after||[]).map(String),cont:false,ver:false,extra:true,i:ACT.length+j}));
  return base.concat(ext).map(a=>{const o=src.plan[a.id]||{};return{...a,min:o.min??a.min,max:o.max??a.max,after:o.after?o.after.map(String):a.after,done:ignoreDone?null:(o.done??null)}});
}
const dayOf=(start,iso)=>start&&typeof iso==="string"?Math.round((new Date(iso+"T00:00:00")-new Date(start+"T00:00:00"))/DAY):0;
function planCalc(list,start){
  const by=Object.fromEntries(list.map(a=>[a.id,a]));const r={};
  const go=(id,seen)=>{if(r[id])return r[id];const a=by[id];if(!a||seen.has(id))return null;seen.add(id);
    const prev=a.after.map(x=>go(x,seen)).filter(Boolean);const f0=Math.max(0,...prev.map(p=>p.fe)),s0=Math.max(0,...prev.map(p=>p.se));
    if(a.done){const d=dayOf(start,a.done);return r[id]={fs:d,fe:d,ss:d,se:d,done:true}}
    return r[id]=a.cont?{fs:f0,fe:f0,ss:s0,se:s0}:{fs:f0,fe:f0+a.min,ss:s0,se:s0+a.max}};
  list.forEach(a=>go(a.id,new Set()));
  // Critical path of the slow scenario: no slack between an activity and the latest finish it can have.
  const work=list.filter(a=>!a.cont&&!a.done);const endS=Math.max(0,...work.map(a=>r[a.id].se));const lf={};
  [...work].sort((x,y)=>r[y.id].se-r[x.id].se).forEach(a=>{const succ=work.filter(b=>b.after.includes(a.id));lf[a.id]=succ.length?Math.min(...succ.map(b=>lf[b.id]-b.max)):endS});
  work.forEach(a=>r[a.id].crit=lf[a.id]-r[a.id].se===0);
  return{r,endF:Math.max(0,...work.map(a=>r[a.id].fe)),endS};
}
function renderTimeline(){
  const el=document.getElementById("timeline");const src=planSrc();const s0=src.start;const list=planActs(src);const{r,endF,endS}=planCalc(list,s0);
  const fd=n=>{if(!s0)return tf("tl_day_n",{n});const d=new Date(s0+"T00:00:00");d.setDate(d.getDate()+n);return d.toLocaleDateString(T.lang,{day:"numeric",month:"short",year:"2-digit"})};
  const lo=Math.min(0,...list.map(a=>r[a.id].fs)),span=Math.max(1,endS-lo);const pct=n=>(n-lo)/span*100;
  const rows=[...list].sort((x,y)=>r[x.id].ss-r[y.id].ss||r[x.id].fs-r[y.id].fs||x.i-y.i).map(a=>{const q=r[a.id];
    const bar=(s,e,cls,lab)=>`<div class="pbar"><i>${lab}</i><span class="${cls}" style="left:${pct(s)}%;width:${a.cont?100-pct(s):Math.max(pct(e)-pct(s),.6)}%"></span></div>`;
    const when=(s,e)=>a.cont?tf("tl_continuous",{d:fd(s)}):a.done?fd(e):`${fd(s)} → ${fd(e)}`;
    const days=a.cont||a.done?"":`<input type="number" min="0" step="1" value="${a.min}" data-act="${esc(a.id)}" data-f="min" aria-label="${T.tl_min} ${esc(a.id)}"><span>/</span><input type="number" min="0" step="1" value="${a.max}" data-act="${esc(a.id)}" data-f="max" aria-label="${T.tl_max} ${esc(a.id)}">`;
    const done=a.cont?"":`<label class="pdone"><input type="checkbox" data-act="${esc(a.id)}" data-f="done" ${a.done?"checked":""}> ${T.tl_h_done}</label>${a.done?`<input type="date" data-act="${esc(a.id)}" data-f="doneDate" value="${typeof a.done==="string"?esc(a.done):esc(s0)}" aria-label="${T.tl_done_on}">`:""}`;
    return `<div class="prow${q.crit?" crit":""}${a.done?" done":""}"><div class="pname"><b style="background:var(${LC[a.lane]||"--muted"})">${esc(a.id)}</b><span>${esc(a.name)}${a.extra?`<small>${T.tl_extra}</small>`:""}<small>${esc(laneLabel(a.lane))}</small></span></div><div class="pdays">${days}</div><div class="pdone-c">${done}</div><div class="pwhen"><span><em>${T.tl_h_fast}</em>${when(q.fs,q.fe)}</span><span><em>${T.tl_h_slow}</em>${when(q.ss,q.se)}</span></div><div class="ptrack">${a.done?bar(q.fs,q.fe,"d","✓"):bar(q.fs,q.fe,"f",T.tl_fast_short)+bar(q.ss,q.se,"s",T.tl_slow_short)}</div></div>`}).join("");
  const ver=planActs(src,true).filter(a=>a.ver&&!a.cont);const vids=new Set(ver.map(a=>a.id));const vc=planCalc(ver.map(a=>({...a,after:a.after.filter(x=>vids.has(x))})),"");
  const crit=[...list].filter(a=>r[a.id].crit).sort((x,y)=>r[x.id].ss-r[y.id].ss).map(a=>a.id).join(" → ");
  el.innerHTML=`<h3>${T.tl_title}</h3><div class="plain">${T.tl_intro}</div><div class="ptools"><label class="tlstart">${T.tl_start} <input type="date" id="tlStart" value="${esc(s0)}"></label><button class="btn" type="button" id="tlReset">${T.tl_reset}</button>${cur()?"":`<span class="plain">${T.tl_noclient}</span>`}</div>
  <div class="phead"><span>${T.tl_h_act}</span><span>${T.tl_h_days}</span><span>${T.tl_h_done}</span><span>${T.tl_h_fast} · ${T.tl_h_slow}</span></div>${rows}
  <div class="tlsum"><span><b>${T.tl_end}:</b> ${T.tl_end_fast} <b>${fd(endF)}</b> · ${T.tl_end_slow} <b>${fd(endS)}</b>${s0?"":` (${endF}–${endS} ${T.tl_days})`}</span><span><b>${vc.endF}–${vc.endS} ${T.tl_days}</b> ${T.tl_each}</span><span class="plain">${T.tl_critical} ${esc(crit)}</span></div>`;
}
function onPlanChange(e){
  const t=e.target;const src=planSrc();
  if(t.id==="tlStart"){savePlan(t.value,src.plan);return}
  const id=t.dataset.act,f=t.dataset.f;if(!id)return;const plan={...src.plan};const o={...(plan[id]||{})};
  const a=planActs(src).find(x=>x.id===id);const base=ACT.find(x=>x[0]===id);const ext=src.extra.find(x=>String(x.id)===id);const def=base?{min:base[3],max:base[4]}:{min:ext.min,max:ext.max};
  if(f==="min"||f==="max"){const v=Math.max(0,parseInt(t.value,10)||0);o[f]=v;if(f==="min"&&v>(o.max??a.max))o.max=v;if(f==="max"&&v<(o.min??a.min))o.min=v;
    if(o.min===def.min)delete o.min;if(o.max===def.max)delete o.max}
  if(f==="done"){if(t.checked)o.done=src.start||new Date().toISOString().slice(0,10);else delete o.done}
  if(f==="doneDate"&&t.value)o.done=t.value;
  if(Object.keys(o).length)plan[id]=o;else delete plan[id];savePlan(src.start,plan);
}
async function resetPlan(){const c=cur();const p=st.client==="preset"&&PRESET_CLIENT?PRESET_CLIENT:null;
  if(c){const n={...c,plan:p&&p.plan?p.plan:{}};if(p&&p.start)n.start=p.start;await putClient(st.client,n)}else{LSW("mapm-plan",{});}renderTimeline();renderRoadmap();toast(T.tl_reset_done)}

// ---------- Roadmap (executive view of the same plan)
// Committed dates are the slow scenario; status is computed against today.
function renderRoadmap(){
  const el=document.getElementById("roadmap");const src=planSrc();const s0=src.start;const c=cur();
  if(!s0){el.innerHTML=`<div class="rmhead"><div><h2>${T.rm_title}${c?" · "+esc(c.name):""}</h2></div></div><p class="plain">${T.rm_need_start}</p>`;return}
  const list=planActs(src);const{r,endF,endS}=planCalc(list,s0);const today=dayOf(s0,new Date().toISOString().slice(0,10));
  const fd=n=>{const d=new Date(s0+"T00:00:00");d.setDate(d.getDate()+n);return d.toLocaleDateString(T.lang,{day:"numeric",month:"short",year:"numeric"})};
  const status=a=>{const q=r[a.id];if(a.done)return"done";if(a.cont)return q.ss<=today?"now":"todo";if(q.se<today)return"late";if(q.ss<=today)return"now";return"todo"};
  const work=list.filter(a=>!a.cont);const cnt={done:0,now:0,todo:0,late:0};work.forEach(a=>cnt[status(a)]++);
  // Stage of each activity: its diagram stage; client activities take the latest stage among what they wait for.
  const stageOf={};ACT.forEach(a=>{const b=BOX.find(x=>String(x[0])===a[0]);stageOf[a[0]]=b?b[2]:0});
  const st2=id=>{if(stageOf[id]!==undefined)return stageOf[id];const a=list.find(x=>x.id===id);stageOf[id]=-1;const v=Math.max(0,...(a?a.after:[]).map(st2));return stageOf[id]=v};
  list.forEach(a=>st2(a.id));
  const lo=Math.min(0,...list.map(a=>r[a.id].fs)),hi=Math.max(endS,today)+14,span=hi-lo;const pct=n=>Math.max(0,Math.min(100,(n-lo)/span*100));
  // Month ticks
  let ticks="",labels="";const d=new Date(s0+"T00:00:00");d.setDate(d.getDate()+lo);d.setDate(1);d.setMonth(d.getMonth()+1);
  for(let k=0;k<24;k++){const n=dayOf(s0,d.toISOString().slice(0,10));if(n>hi)break;ticks+=`<span class="gtick" style="left:${pct(n)}%"></span>`;labels+=`<span style="left:${pct(n)}%">${d.toLocaleDateString(T.lang,{month:"short",year:"2-digit"})}</span>`;d.setMonth(d.getMonth()+1)}
  const inRange=today>=lo&&today<=hi;const todayLine=inRange?`<span class="gtoday" style="left:${pct(today)}%"></span>`:"";const todayMark=inRange?`<span class="gtoday" style="left:${pct(today)}%"><i>${T.rm_today}</i></span>`:"";
  const stEnd=STAGES.map((g,i)=>{const acts=work.filter(a=>stageOf[a.id]===i);return acts.length?{i,name:g[0],end:Math.max(...acts.map(a=>r[a.id].se)),done:acts.every(a=>a.done)}:null}).filter(Boolean);
  const ms=stEnd.map(m=>`<span class="gms${m.done?" done":""}" style="left:${pct(m.end)}%" title="${esc(tf("rm_stage_end",{s:m.name}))}: ${fd(m.end)}"></span>`).join("");
  let rows=`<div class="grow"><div class="gl"><b>◆</b>${T.rm_milestones}</div><div class="gt">${ticks}${ms}${todayLine}</div></div>`;
  STAGES.forEach((g,i)=>{const acts=list.filter(a=>stageOf[a.id]===i).sort((x,y)=>r[x.id].ss-r[y.id].ss||x.i-y.i);if(!acts.length)return;
    rows+=`<div class="grow stg"><div class="gl">${esc(g[0])}</div><div class="gt">${ticks}${todayLine}</div></div>`;
    acts.forEach(a=>{const q=r[a.id];const s=status(a);const tip=a.done?tf("rm_done_on",{d:fd(q.se)}):a.cont?tf("tl_continuous",{d:fd(q.ss)}):`${tf("rm_until",{a:fd(q.ss),b:fd(q.se)})} (${T.tl_end_fast} ${fd(q.fe)})`;
      const left=pct(q.ss),w=a.cont?100-left:Math.max(pct(q.se)-left,.5);
      rows+=`<div class="grow"><div class="gl" title="${esc(a.name)}"><b>${esc(a.id)}</b>${esc(a.name)}</div><div class="gt">${ticks}<span class="gbar ${a.cont?"cont":s}${q.crit?" crit":""}" style="left:${left}%;width:${w}%" title="${esc(a.id+" · "+a.name+" · "+tip)}"></span>${todayLine}</div></div>`})});
  const li=(arr,fn)=>arr.length?`<ul>${arr.map(fn).join("")}</ul>`:`<p class="plain">${T.rm_none}</p>`;
  const done=work.filter(a=>a.done).sort((x,y)=>r[x.id].se-r[y.id].se);
  const soon=work.filter(a=>!a.done&&status(a)!=="late"&&r[a.id].ss<=today+30).sort((x,y)=>r[x.id].ss-r[y.id].ss);
  const late=work.filter(a=>status(a)==="late");
  const pctDone=work.length?Math.round(cnt.done/work.length*100):0;const left=Math.max(0,endS-today);
  el.innerHTML=`<div class="rmhead"><div><h2>${T.rm_title}${c?" · "+esc(c.name):""}</h2><div class="plain">${tf("rm_sub",{s:fd(0),t:fd(today)})}</div></div><button class="btn" type="button" id="rmPrint">${T.rm_print}</button></div>
  <div class="kpis"><div class="kpi done"><small>${T.rm_done}</small><b>${cnt.done}</b></div><div class="kpi now"><small>${T.rm_now}</small><b>${cnt.now}</b></div><div class="kpi"><small>${T.rm_todo}</small><b>${cnt.todo}</b></div><div class="kpi late"><small>${T.rm_late}</small><b>${cnt.late}</b></div><div class="kpi"><small>${T.rm_end}</small><b>${fd(endS)}</b><span>${tf("rm_best",{d:fd(endF)})} · ${tf("rm_left",{n:left})}</span></div></div>
  <div class="plain" style="font-size:.82rem">${T.rm_progress}: ${pctDone}% · ${tf("rm_of",{a:cnt.done,b:work.length})}</div><div class="rmprog"><span style="width:${pctDone}%"></span></div>
  <div class="gantt"><div class="gin"><div class="gaxis"><div></div><div class="gt">${labels}${todayMark}</div></div>${rows}</div></div>
  <div class="rmleg"><span><i style="background:var(--ok)"></i>${T.rm_leg_done}</span><span><i style="background:var(--accent)"></i>${T.rm_leg_now}</span><span><i style="background:var(--line2)"></i>${T.rm_leg_todo}</span><span><i style="background:var(--bad)"></i>${T.rm_leg_late}</span><span><i style="box-shadow:0 0 0 2px var(--warn);background:var(--line2)"></i>${T.rm_leg_crit}</span><span><i style="background:var(--warn);transform:rotate(45deg);width:9px;height:9px"></i>${T.rm_milestones}</span></div>
  <div class="rmcols"><div><h3>${T.rm_list_done}</h3>${li(done,a=>`<li><b>${esc(a.id)}</b> ${esc(a.name)} <small>${tf("rm_done_on",{d:fd(r[a.id].se)})}</small></li>`)}</div>
  <div><h3>${T.rm_list_now}</h3>${li(soon,a=>`<li><b>${esc(a.id)}</b> ${esc(a.name)} <small>${tf("rm_until",{a:fd(r[a.id].ss),b:fd(r[a.id].se)})}</small></li>`)}</div>
  <div><h3>${T.rm_list_late}</h3>${li(late,a=>`<li><b>${esc(a.id)}</b> ${esc(a.name)} <small>${tf("rm_until",{a:fd(r[a.id].ss),b:fd(r[a.id].se)})}</small></li>`)}</div></div>`;
}

// ---------- Track a version (milestones)
const verData=()=>st.client&&st.version&&versions[st.client]&&versions[st.client][st.version]||null;
function msState(m,v){const checks=m[4];const done=checks.filter(c=>v&&v.checks&&v.checks[c[0]]).length;const manual=v&&v.status&&v.status[m[0]];
  if(manual==="blk")return["blocked",done];if(done===checks.length)return["done",done];if(done>0||manual==="in_progress")return["in_progress",done];return["pending",done]}
function renderVer(){
  const c=cur();
  if(!c){verbar.innerHTML=`<span>${T.ver_need_client}</span><button class="btn primary" id="goInst" type="button">${T.ver_create_client}</button>`;ms.innerHTML="";return}
  const vs=versions[st.client]||{};const ids=Object.keys(vs).sort((a,b)=>(vs[b].createdAt||"").localeCompare(vs[a].createdAt||""));
  if(!st.version&&ids.length)st.version=ids[0];
  const v=verData();
  const total=MS.reduce((a,m)=>a+m[4].length,0),done=MS.reduce((a,m)=>a+msState(m,v)[1],0);
  const msDone=MS.filter(m=>msState(m,v)[0]==="done").length,blk=MS.filter(m=>msState(m,v)[0]==="blocked");
  verbar.innerHTML=`<b>${esc(c.name)}</b><select id="verSel" aria-label="${T.ver_aria}">${ids.map(i=>`<option value="${i}" ${i===st.version?"selected":""}>${esc(vs[i].name)}</option>`).join("")}${ids.length?"":`<option value="">${T.ver_none}</option>`}</select><button class="btn" id="newVer" type="button">${T.ver_new}</button><span id="newVerBox" hidden><input type="text" id="newVerName" placeholder="${T.ver_name_placeholder}" style="max-width:160px"> <button class="btn primary" id="createVer" type="button">${T.create}</button></span>${v?`<span>${tf("ver_progress",{md:msDone,mt:MS.length,cd:done,ct:total})}</span><div class="bar"><span style="width:${done/total*100}%;background:var(--ok)"></span></div>${blk.length?`<span style="color:var(--warn);font-weight:600">${blk.length>1?tf("ver_blocked_many",{n:blk.length}):T.ver_blocked_one}</span>`:""}`:`<span class="plain">${T.ver_first}</span>`}`;
  if(!v){ms.innerHTML="";return}
  ms.innerHTML=MS.map((m,i)=>{const[stt,dn]=msState(m,v);
    return `<div class="m ${stt}" data-ms="${m[0]}"><div class="head"><span class="num">${i+1}</span><span class="name">${esc(m[1])}</span><span class="cnt">${dn}/${m[4].length} · ${MSTAT[stt]}</span></div><div class="desc">${esc(m[2])}</div>
    ${m[4].map(([cid,txt,step])=>`<label class="chk ${v.checks&&v.checks[cid]?"done":""}"><input type="checkbox" data-ck="${cid}" ${v.checks&&v.checks[cid]?"checked":""} ${canWrite?"":"disabled"}><span>${esc(txt)}<small>${T.ms_step} <button class="chip" data-go="step:${step}" style="padding:0 5px;font-size:.7rem">${step}</button></small></span></label>`).join("")}
    <div class="foot"><button class="pl ${stt==="blocked"?"on":""}" data-blk="${m[0]}" type="button" ${canWrite?"":"disabled"}>${stt==="blocked"?T.ms_unblock:T.ms_block}</button><span class="steps">${T.ms_phases} ${m[3].map(p=>`<button data-go="phase:${p}">${p}</button>`).join("")}</span></div>
    ${stt==="blocked"?`<input class="blknote" type="text" data-note="${m[0]}" placeholder="${T.ms_blocknote}" value="${esc(v.notes&&v.notes[m[0]]||"")}" ${canWrite?"":"disabled"}>`:""}</div>`}).join("");
}
function newVersion(){const box=document.getElementById("newVerBox");if(box){box.hidden=false;document.getElementById("newVerName").focus()}}
async function createVersion(name){const c=cur();if(!c||!name)return;const vid=uid();await putVersion(st.client,vid,{name,checks:{},status:{},notes:{},createdAt:new Date().toISOString()});st.version=vid;render()}

// ---------- Instantiate
function renderInst(){
  const c=cur();
  if(!c){instBox.innerHTML=`<div class="card"><h3>${T.inst_title}</h3><p class="plain">${T.inst_intro}</p><button class="btn primary" id="goNew" type="button">${T.new_client}</button></div>`;return}
  const lanes=c.lanes||{},vars=c.variants||{};
  const diff=[];LANES.forEach(l=>{if(lanes[l[0]]&&lanes[l[0]]!==l[1])diff.push(`${l[1]} → ${lanes[l[0]]}`)});
  Object.entries(vars).forEach(([k,v])=>{if(v){const d=V[k];const opt=d[1].find(o=>o.startsWith(v+")"));diff.push(`${k} ${d[0]}: ${opt||v}`)}});
  instBox.innerHTML=`<div class="inst">
  <div class="card"><h3>${T.inst_client}</h3><div class="frow"><div class="k">${T.inst_name}</div><input type="text" id="instName" value="${esc(c.name)}" ${canWrite?"":"disabled"}></div>
    <h3 style="margin-top:14px">${T.inst_lanes_title}</h3><p class="plain">${T.inst_lanes_intro}</p>
    ${LANES.map(l=>`<div class="frow"><div class="k"><i style="background:var(${LC[l[0]]})"></i>${esc(l[1])}<small>${esc(laneSub(l[0]))}</small></div><input type="text" data-lane="${l[0]}" placeholder="${esc(l[1])}" value="${esc(lanes[l[0]]||"")}" ${canWrite?"":"disabled"}></div>`).join("")}</div>
  <div class="card"><h3>${T.inst_vars_title}</h3><p class="plain">${T.inst_vars_intro}</p>
    ${Object.entries(V).map(([k,d])=>`<div class="frow"><div class="k">${esc(d[0])}<small>${k}</small></div><select data-var="${k}" ${canWrite?"":"disabled"}><option value="">${T.inst_unset}</option>${d[1].map(o=>`<option value="${o[0]}" ${vars[k]===o[0]?"selected":""}>${esc(o)}</option>`).join("")}</select></div>`).join("")}
    <div class="savebar"><button class="btn primary" id="saveInst" type="button" ${canWrite?"":"disabled"}>${T.inst_save}</button><span class="plain">${T.inst_ren_hint}</span></div></div>
  <div class="card"><h3>${T.inst_diff_title}</h3>${diff.length?`<ul class="diff">${diff.map(d=>`<li>${esc(d)}</li>`).join("")}</ul>`:`<p class="plain">${T.inst_diff_none}</p>`}</div></div>`;
}
async function saveInst(){const c=cur();if(!c)return;const data={...c,name:instName.value.trim()||c.name,lanes:{},variants:{}};
  instBox.querySelectorAll("[data-lane]").forEach(i=>{if(i.value.trim())data.lanes[i.dataset.lane]=i.value.trim()});
  instBox.querySelectorAll("[data-var]").forEach(s=>{if(s.value)data.variants[s.dataset.var]=s.value});
  await putClient(st.client,data);render();toast(T.inst_saved)}
function newClient(){const box=document.getElementById("newClientBox");box.hidden=false;document.getElementById("newClientName").focus()}
async function createClient(name){if(!name)return;const id=uid();await putClient(id,{name,lanes:{},variants:{},ren:{},createdAt:new Date().toISOString()});st.client=id;st.version="";subscribeVersions(id);document.getElementById("newClientBox").hidden=true;document.getElementById("newClientName").value="";setTab("in");render()}

// ---------- Renewals
const DAY=864e5;
function renderRen(){
  const c=cur();const ren=c?(c.ren||{}):(LS("mapm-ren")||{});
  const today=new Date();today.setHours(0,0,0,0);const groups=[...new Set(REN.map(r=>r[2]))];let h="",late=0,soon=0,ok=0;
  groups.forEach(g=>{h+=`<div class="rengrp"><h3>${esc(g)}</h3>`;
    REN.filter(r=>r[2]===g).forEach(([id,nm,_,cyc,ant,eff,who,step])=>{const d=ren[id];let cls="na",txt=T.ren_nodate,due="";
      if(d){const base=new Date(d+"T00:00:00");let next=base;if(cyc){next=new Date(base);next.setMonth(next.getMonth()+cyc);while(next<today)next.setMonth(next.getMonth()+cyc)}
        const days=Math.round((next-today)/DAY);if(cyc){if(days<0){cls="late";txt=tf("ren_overdue",{n:-days});late++}else if(days<=ant){cls="soon";txt=tf("ren_due_in",{n:days});soon++}else{cls="ok";txt=tf("ren_due_in",{n:days});ok++}}else{cls="ok";txt=tf("ren_reviewed",{d});ok++}due=next.toISOString().slice(0,10)}
      h+=`<div class="ren"><div class="nm">${esc(nm)}<small>${eff?esc(eff)+". ":""}${who?esc(T.ren_renewed_by)+esc(who):""}${step?` · <button class="chip" data-go="step:${step}" style="padding:0 6px;font-size:.74rem">${step}</button>`:""}</small></div><div class="cyc">${cyc?`${tf("ren_every",{n:cyc})}${ant?tf("ren_warn",{n:ant}):""}`:T.ren_event}${due&&cyc?tf("ren_next",{d:due}):""}</div><label class="plain" style="font-size:.78rem">${cyc?T.ren_last_issue:T.ren_last_change} <input type="date" data-ren="${id}" value="${d||""}" ${c&&!canWrite?"disabled":""}></label><span class="due ${cls}">${txt}</span></div>`});
    h+=`</div>`});
  renlist.innerHTML=h;rensum.innerHTML=`<span><b style="color:var(--bad)">${late}</b>${T.ren_sum_overdue}</span><span><b style="color:var(--warn)">${soon}</b>${T.ren_sum_soon}</span><span><b style="color:var(--ok)">${ok}</b>${T.ren_sum_ok}</span><span><b>${REN.length-late-soon-ok}</b>${T.ren_sum_nodate}</span>${c?"":`<span class="plain">${T.ren_noclient}</span>`}`;
}
async function setRen(id,val){const c=cur();if(c){const ren={...(c.ren||{})};if(val)ren[id]=val;else delete ren[id];await putClient(st.client,{...c,ren})}else{const r=LS("mapm-ren")||{};if(val)r[id]=val;else delete r[id];LSW("mapm-ren",r)}renderRen()}

// ---------- Explore the model
function visible(s){
  if(st.plat!=="all"&&s.plat!==st.plat&&s.plat!=="both")return false;
  if(st.role&&!roleIds(s).includes(st.role))return false;
  if(st.lane&&!lanesOf(s).includes(st.lane))return false;
  if(st.phases.length&&!st.phases.includes(s.ph))return false;
  if(st.onlyVar&&!s.vars.length)return false;
  if(st.onlyDoubt&&(rev[s.id]||{}).s!=="doubt")return false;
  if(st.q){const q=st.q.toLowerCase();const hay=(s.id+" "+s.name+" "+s.resp+" "+s.inp+" "+s.out+" "+s.note+" "+roleIds(s).map(r=>A[r]).join(" ")).toLowerCase();if(!hay.includes(q))return false}
  return true}
const openPh=new Set(["S0"]);
function renderRail(){
  const sel=byId[st.sel];const need=new Set(sel?sel.deps:[]);const enab=new Set(sel?sel.enables:[]);if(sel)openPh.add(sel.ph);
  let html="",lastF="";
  PH.forEach(([pid,pname,fq])=>{const steps=S.filter(s=>s.ph===pid&&visible(s));if(!steps.length)return;
    if(fq!==lastF){html+=`<div class="freq">${FREQ[fq]}</div>`;lastF=fq}
    const done=steps.filter(s=>(rev[s.id]||{}).s==="clear").length;const filt=st.q||st.role||st.lane||st.phases.length||st.onlyVar||st.onlyDoubt;
    const open=filt||openPh.has(pid)||steps.some(s=>need.has(s.id)||enab.has(s.id));
    html+=`<details class="phase" data-ph="${pid}" ${open?"open":""}><summary><span class="pid">${pid}</span><span class="pname">${esc(pname)}</span><span class="pcount">${done}/${steps.length}</span></summary><ul class="steps">`;
    steps.forEach(s=>{const cls=s.id===st.sel?"sel":need.has(s.id)?"need":enab.has(s.id)?"enab":"";const r=(rev[s.id]||{}).s||"";
      html+=`<li class="step ${cls}" tabindex="0" data-id="${s.id}" aria-current="${s.id===st.sel}"><span class="sname">${esc(s.name)}<small>${s.id} · ${esc(roleIds(s).map(a=>A[a]).slice(0,2).join(", "))}${roleIds(s).length>2?T.rail_others:""}</small></span><span class="marks">${s.vars.length?`<span class="vtag">${s.vars.length>3?"V*":s.vars.join(" ")}</span>`:""}<span class="pl ${s.plat}">${PLAT_LABEL[s.plat]}</span><span class="rev ${r}" title="${r||T.rev_unreviewed}"></span></span></li>`});
    html+=`</ul></details>`});
  rail.innerHTML=html||`<p class="plain">${T.rail_none}</p>`;
}
function stepChips(ids,cls){return ids.length?ids.map(i=>`<button class="chip ${cls}" data-go="step:${i}">${esc(byId[i].name)}<small>${i}</small></button>`).join(""):`<span class="none">${T.step_none}</span>`}
function renderStep(){
  const s=byId[st.sel];if(!s)return;const r=rev[s.id]||{};const i=order.indexOf(s.id);const ph=PH.find(p=>p[0]===s.ph);const roles=roleIds(s);
  const inPh=S.filter(x=>x.ph===s.ph);const posIn=inPh.indexOf(s)+1;const stage=STAGES.find(g=>g[1].includes(s.ph));const tm=TIME[s.ph];
  detail.innerHTML=`<div class="crumbline"><span>${esc(FREQ[ph[2]])}</span><span class="sep">›</span><span>${stage?esc(stage[0]):""}</span><span class="sep">›</span><span>${esc(ph[1])}</span>${tm&&tm[1]?`<span class="sep">·</span><span class="tm">${T.step_phase} <b>${tm[0]}–${tm[1]}</b> ${T.step_days}</span>`:""}<span class="pos">${tf("step_pos",{i:posIn,n:inPh.length})}</span></div>
  <h2><span class="mono">${s.id} · <span class="pl ${s.plat}">${PLAT_LABEL[s.plat]}</span></span>${esc(s.name)}</h2>
  <dl class="kv"><dt>${T.step_who}</dt><dd>${roles.map(a=>`<button class="rolechip" data-go="A:${a}"><b>${esc(A[a])}</b><span>${esc(laneLabel(laneOfRole[a]))} · ${a}</span></button>`).join("")}<div class="plain" style="margin-top:4px">${esc(s.resp)}</div></dd>
    <dt>${T.step_with}</dt><dd>${linkify(s.inp)}</dd><dt>${T.step_produces}</dt><dd>${linkify(s.out)}</dd>
    ${s.vars.length?`<dt>${T.step_depends}</dt><dd>${s.vars.map(v=>{const ch=variantOf(v);const opt=ch?V[v][1].find(o=>o.startsWith(ch+")")):"";return `<button class="chip var" data-go="V:${v}"><b>${v}</b>${esc(V[v][0])}${opt?` <small>${esc(opt)}</small>`:""}</button>`}).join("")}<div class="plain" style="margin-top:2px">${cur()?T.step_variant_chosen:T.step_variant_each}</div></dd>`:""}</dl>
  <div class="flow3"><div class="col"><h4>${T.step_before}</h4>${stepChips(s.deps,"need")}</div><div class="mid arrow">→</div><div class="col"><h4>${T.step_after}</h4>${stepChips(s.enables,"enab")}</div></div>
  ${s.note?`<div class="note">${linkify(s.note)}</div>`:""}
  <div class="box"><h3>${T.rev_title}</h3><p class="plain">${T.rev_hint}</p><div class="revbtns"><button class="btn clear" data-rev="clear" aria-pressed="${r.s==="clear"}">${T.rev_clear}</button><button class="btn doubt" data-rev="doubt" aria-pressed="${r.s==="doubt"}">${T.rev_doubt}</button>${r.s?`<button class="btn" data-rev="">${T.rev_remove}</button>`:""}</div>
    <label for="note-${s.id.replace(".","-")}" class="plain" style="display:block;margin-top:10px">${T.note_label}</label><textarea id="note-${s.id.replace(".","-")}" data-note>${esc(r.n||"")}</textarea></div>
  <div class="nav"><button class="btn" data-nav="-1" ${i===0?"disabled":""} title="${i>0?esc(byId[order[i-1]].name):""}">${T.nav_prev}${i>0?` <span class="mono">${order[i-1]}</span>`:""}</button><button class="btn" data-nav="1" ${i===order.length-1?"disabled":""} title="${i<order.length-1?esc(byId[order[i+1]].name):""}">${T.nav_next}${i<order.length-1?` <span class="mono">${order[i+1]}</span>`:""} →</button></div>`;
}
function stepsWith(pred){return S.filter(pred).map(s=>s.id)}
function renderEntity(kind,id){let title="",body="";
  if(kind==="A"){const resp=stepsWith(s=>roleIds(s).includes(id));title=A[id];body=`<p class="plain">${id} · ${T.ent_area}${esc(laneLabel(laneOfRole[id]))}. ${tf("ent_owner_in",{n:resp.length})}</p><div class="lookup">${stepChips(resp,"")}</div>`}
  else if(kind==="C"||kind==="F"){const d=(kind==="C"?C:F)[id];const prod=stepsWith(s=>new RegExp("\\b"+id+"\\b").test(s.out));const cons=stepsWith(s=>new RegExp("\\b"+id+"\\b").test(s.inp+" "+s.note));title=d[0];body=`<p class="plain">${id} · ${kind==="C"?T.ent_validity:T.ent_format}${esc(d[1])}</p><dl class="kv"><dt>${T.ent_produced_in}</dt><dd>${stepChips(prod,"need")}</dd><dt>${T.ent_consumed_in}</dt><dd>${stepChips(cons,"enab")}</dd></dl>`}
  else if(kind==="V"){const d=V[id];const used=stepsWith(s=>s.vars.includes(id));const ch=variantOf(id);title=d[0];body=`<p class="plain">${id} · ${T.ent_variation}</p><ul class="vopts">${d[1].map(o=>`<li ${ch&&o.startsWith(ch+")")?'style="font-weight:600;color:var(--accent-ink)"':""}>${esc(o)}${ch&&o.startsWith(ch+")")?T.ent_chosen:""}</li>`).join("")}</ul><div class="box"><h3>${T.ent_steps_change}</h3>${stepChips(used,"")}</div>`}
  detail.innerHTML=`<div class="crumb"><button class="chip" data-go="step:${st.sel}"><b>←</b>${T.back_to}${esc(byId[st.sel].name)}</button></div><h2>${esc(title)}</h2>${body}`}
function renderFilterChip(){const ph=st.phases.length===1?`${st.phases[0]} ${PH.find(p=>p[0]===st.phases[0])[1]}`:st.phases.join(", ");fchip.innerHTML=st.phases.length?`<span class="filterchip">${st.lane?esc(laneLabel(st.lane))+" · ":""}${esc(ph)}<button type="button" data-clear aria-label="${T.filter_remove}">✕</button></span>`:""}
function renderClients(){const ids=Object.keys(clients).sort((a,b)=>(clients[a].name||"").localeCompare(clients[b].name||""));clientSel.innerHTML=`<option value="">${T.client_base_option}</option>`+ids.map(i=>`<option value="${i}" ${i===st.client?"selected":""}>${esc(clients[i].name)}</option>`).join("")}

// ---------- Global render
function render(){renderClients();renderSwim();renderPairs();renderTimeline();renderRoadmap();renderVer();renderInst();renderRen();renderFilterChip();renderRail();st.view?renderEntity(...st.view):renderStep()}

// ---------- Events
clientSel.addEventListener("change",()=>{st.client=clientSel.value;st.version="";subscribeVersions(st.client);render()});
newClientBtn.addEventListener("click",newClient);
document.getElementById("createClientBtn").addEventListener("click",()=>createClient(document.getElementById("newClientName").value.trim()));
document.getElementById("newClientName").addEventListener("keydown",e=>{if(e.key==="Enter")createClient(e.target.value.trim())});
home.addEventListener("click",e=>{const d=e.target.closest("[data-door]");if(!d)return;setTab(d.dataset.door);document.querySelector(".tabs").scrollIntoView({block:"start"})});
[["ov",tabOv],["rm",tabRm],["vr",tabVr],["dt",tabDt],["in",tabIn],["rn",tabRn]].forEach(([k,b])=>b.addEventListener("click",()=>setTab(k)));
swim.addEventListener("click",e=>{const g=e.target.closest("[data-box]");if(g)openBox(Number(g.dataset.box))});
swim.addEventListener("keydown",e=>{const g=e.target.closest("[data-box]");if(g&&(e.key==="Enter"||e.key===" ")){e.preventDefault();openBox(Number(g.dataset.box))}});
verbar.addEventListener("click",e=>{if(e.target.closest("#newVer"))newVersion();if(e.target.closest("#goInst"))newClient();if(e.target.closest("#createVer"))createVersion(document.getElementById("newVerName").value.trim())});
verbar.addEventListener("keydown",e=>{if(e.target.id==="newVerName"&&e.key==="Enter")createVersion(e.target.value.trim())});
verbar.addEventListener("change",e=>{if(e.target.id==="verSel"){st.version=e.target.value;render()}});
ms.addEventListener("change",async e=>{const i=e.target.closest("[data-ck]");if(!i)return;const v=verData();if(!v)return;const checks={...(v.checks||{})};if(i.checked)checks[i.dataset.ck]=1;else delete checks[i.dataset.ck];await putVersion(st.client,st.version,{...v,checks});render()});
ms.addEventListener("click",async e=>{
  const g=e.target.closest("[data-go]");if(g){e.preventDefault();const[k,id]=g.dataset.go.split(":");if(k==="phase"){st.phases=[id];openPh.add(id);const f=S.find(s=>s.ph===id);if(f)go(f.id,true)}else go(id,true);return}
  const b=e.target.closest("[data-blk]");if(b){const v=verData();if(!v)return;const status={...(v.status||{})};if(status[b.dataset.blk]==="blk")delete status[b.dataset.blk];else status[b.dataset.blk]="blk";await putVersion(st.client,st.version,{...v,status});render()}});
ms.addEventListener("change",async e=>{const n=e.target.closest("[data-note]");if(!n)return;const v=verData();if(!v)return;await putVersion(st.client,st.version,{...v,notes:{...(v.notes||{}),[n.dataset.note]:n.value}})});
instBox.addEventListener("click",e=>{if(e.target.closest("#saveInst"))saveInst();if(e.target.closest("#goNew"))newClient()});
renlist.addEventListener("change",e=>{const i=e.target.closest("[data-ren]");if(i)setRen(i.dataset.ren,i.value)});
document.getElementById("timeline").addEventListener("change",onPlanChange);
document.getElementById("roadmap").addEventListener("click",e=>{if(e.target.id==="rmPrint"){setTab("rm");window.print()}});
document.getElementById("timeline").addEventListener("click",e=>{if(e.target.id==="tlReset")resetPlan()});
renlist.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(!g)return;const[k,id]=g.dataset.go.split(":");go(id,true)});
rail.addEventListener("click",e=>{const li=e.target.closest(".step");if(li)go(li.dataset.id,false)});
rail.addEventListener("keydown",e=>{const li=e.target.closest(".step");if(li&&(e.key==="Enter"||e.key===" ")){e.preventDefault();go(li.dataset.id,false)}});
rail.addEventListener("toggle",e=>{const d=e.target;if(d.matches&&d.matches("details.phase")){d.open?openPh.add(d.dataset.ph):openPh.delete(d.dataset.ph)}},true);
detail.addEventListener("click",e=>{
  const g=e.target.closest("[data-go]");if(g){const[k,id]=g.dataset.go.split(":");if(k==="step")go(id,true);else{st.view=[k,id];render()}return}
  const r=e.target.closest("[data-rev]");if(r){const c=rev[st.sel]||{};const v=r.dataset.rev;rev[st.sel]={...c,s:v||undefined};if(!v&&!c.n)delete rev[st.sel];save();render();return}
  const n=e.target.closest("[data-nav]");if(n){const i=order.indexOf(st.sel)+Number(n.dataset.nav);if(order[i])go(order[i],true)}});
detail.addEventListener("input",e=>{if(e.target.matches("[data-note]")){const c=rev[st.sel]||{};rev[st.sel]={...c,n:e.target.value};save()}});
platSeg.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;st.plat=b.dataset.p;platSeg.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));render()});
Object.entries(A).forEach(([k,v])=>{const o=document.createElement("option");o.value=k;o.textContent=`${k} · ${v}`;roleSel.appendChild(o)});
LANES.forEach(([k,v])=>{const o=document.createElement("option");o.value=k;o.textContent=`${k} · ${v}`;laneSel.appendChild(o)});
roleSel.addEventListener("change",()=>{st.role=roleSel.value;render()});
laneSel.addEventListener("change",()=>{st.lane=laneSel.value;render()});
fchip.addEventListener("click",e=>{if(e.target.closest("[data-clear]")){st.phases=[];st.lane="";laneSel.value="";render()}});
q.addEventListener("input",()=>{st.q=q.value.trim();renderRail()});
onlyVar.addEventListener("change",()=>{st.onlyVar=onlyVar.checked;renderRail()});
onlyDoubt.addEventListener("change",()=>{st.onlyDoubt=onlyDoubt.checked;renderRail()});
copyBtn.addEventListener("click",()=>{const lines=S.filter(s=>(rev[s.id]||{}).s==="doubt"||((rev[s.id]||{}).n||"").trim()).map(s=>`${s.id} ${s.name} [${(rev[s.id]||{}).s||T.copy_note}]: ${((rev[s.id]||{}).n||"").trim()||T.copy_nonote}`);const txt=lines.length?lines.join("\n"):T.copy_none;
  const show=()=>{st.view=null;detail.innerHTML=`<h2>${T.copy_title}</h2><p class="plain">${T.copy_hint}</p><textarea readonly style="min-height:220px">${esc(txt)}</textarea>`};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(()=>toast(lines.length?tf("copy_done",{n:lines.length}):T.copy_empty),show);else show()});
(async()=>{
  loadLocal();render();
  try{db=await claude.use("db")}catch(e){db=null}
  if(db){
    try{const u=await claude.use("user");dbUser=u;if(u){const w=await u.can("data.write");if(w===false)canWrite=false}}catch(e){}
    db.collection("clients").onSnapshot(snap=>{clients={};snap.docs.forEach(d=>clients[d.id]=d.data());if(st.client&&!clients[st.client])st.client="";render()},e=>{});
  }
  setStore();render();
})();
</script>
