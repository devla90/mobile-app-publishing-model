
// Page logic. Model data (A, C, F, V, LANES, PH, S, ...) and UI strings (T) are injected by build.py before this file.
// tf(key, vars) fills {placeholders} in a UI string.
// A string may have a "<key>_one" variant, used when n is 1 ("1 día" instead of "1 días").
const tf=(k,vars)=>Object.entries(vars||{}).reduce((s,[a,b])=>s.split("{"+a+"}").join(b),vars&&vars.n===1&&T[k+"_one"]!==undefined?T[k+"_one"]:T[k]);
const LC={L1:"--l1",L2:"--l2",L3:"--l3",L4:"--l4",L5:"--l5",L6:"--l6",L7:"--l7"};
const MSTAT=T.ms_status;
const PLAT_LABEL={ios:T.plat_ios,android:T.plat_android,both:T.plat_both};

// Local files can share one browser storage, so each client page keeps its data under its own keys.
const pageKey=k=>PRESET_CLIENT?`${k}:${PRESET_CLIENT.name}`:k;

// ---------- Page state
let st={rmFold:{},plat:"all",role:"",lane:"",act:"",actPlat:"",tlFilter:"all",tlEdit:"",rmSlack:false,tlStage:{},phases:[],q:"",onlyVar:false,onlyDoubt:false,sel:"S0.1",view:null,tab:"ov",client:"",version:"",track:"all"};
let rev={};try{rev=JSON.parse(localStorage.getItem(pageKey("mapm-rev"))||"{}")}catch(e){rev={}}
const save=()=>{try{localStorage.setItem(pageKey("mapm-rev"),JSON.stringify(rev))}catch(e){}};
try{const h=location.hash.slice(1);if(byId[h])st.sel=h}catch(e){}

// ---------- Storage: shared db with local fallback
// clients/{id} = {name, lanes:{L1..L7:text}, variants:{V1..V15:key}, ren:{R01:date}, start:date, plan:{<activity>:{min,max,after,done}}, extra:[activity], createdAt}
// clients/{id}/versions/{vid} = {name, checks:{c1:1}, status:{m1:"blk"}, notes:{m1:text}, createdAt}
let db=null,dbUser=null,canWrite=true;
let clients={},versions={};
const LS=k=>{try{return JSON.parse(localStorage.getItem(pageKey(k))||"null")}catch(e){return null}};
const LSW=(k,v)=>{try{localStorage.setItem(pageKey(k),JSON.stringify(v))}catch(e){}};
// The slack in the roadmap is a reader's preference: shown or hidden, remembered in this browser.
st.rmSlack=!!LS("mapm-rmslack");
// Bumped when stored plans change format. Plans are keyed by activity key, so a change in the flow does not need it.
const PLAN_V=5;
// Earlier builds kept every client page under the shared keys: move this page's data out, leave the rest there.
function moveShared(){let cs,vs;try{cs=JSON.parse(localStorage.getItem("mapm-clients")||"null");vs=JSON.parse(localStorage.getItem("mapm-versions")||"null")}catch(e){return}
  const p=cs&&cs.preset;if(!p||p.name!==PRESET_CLIENT.name)return;if(!LS("mapm-clients")){LSW("mapm-clients",{preset:p});if(vs&&vs.preset)LSW("mapm-versions",{preset:vs.preset})}
  delete cs.preset;if(vs)delete vs.preset;try{localStorage.setItem("mapm-clients",JSON.stringify(cs));if(vs)localStorage.setItem("mapm-versions",JSON.stringify(vs))}catch(e){}}
// instance.json wins over what a browser stored, except for activities edited on the page since the last build.
function syncPresetPlan(p){const next=PRESET_CLIENT.plan||{};if(!p.planBase||p.planV!==PLAN_V){p.plan=next;p.planBase=next;p.planV=PLAN_V;return}
  const base=p.planBase,plan={...p.plan};new Set([...Object.keys(base),...Object.keys(next)]).forEach(k=>{if(JSON.stringify(plan[k])===JSON.stringify(base[k])){if(next[k])plan[k]=next[k];else delete plan[k]}});p.plan=plan;p.planBase=next}
// The start date follows instance.json the same way: kept only if it was changed on the page since the last build.
function syncPresetStart(p){const next=PRESET_CLIENT.start||"";if(p.startBase===undefined){p.startBase=next;if(!p.start)p.start=next;return}
  if(!p.start||p.start===p.startBase)p.start=next;p.startBase=next}
// What this browser holds that instance.json does not: the start date and the activities whose entry differs.
function localDiff(){const c=cur();if(st.client!=="preset"||!c||!PRESET_CLIENT)return null;const a=c.plan||{},b=PRESET_CLIENT.plan||{};
  const acts=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));const start=(c.start||"")!==(PRESET_CLIENT.start||"");
  return acts.length||start?{acts,start}:null}
function localBanner(){const d=localDiff();if(!d)return"";const parts=[d.start?T.local_start:"",d.acts.length?(d.acts.length===1?T.local_act_one:tf("local_acts",{n:d.acts.length})):""].filter(Boolean).join(" · ");
  return`<div class="localbar"><span>${tf("local_changes",{what:esc(parts)})}</span><button class="btn" type="button" data-local="download">${T.local_download}</button><button class="btn" type="button" data-local="discard">${T.local_discard}</button></div>`}
async function onLocal(e){const b=e.target.closest("[data-local]");if(!b)return;
  if(b.dataset.local==="discard"){resetPlan();return}
  downloadInstance()}
// What changed in the plan against instance.json, one readable line per activity (and platform when they differ).
function planChanges(){const c=cur();if(!c||!PRESET_CLIENT)return[];const d=localDiff();if(!d)return[];const out=[];
  const fdt=iso=>iso===true||!iso?T.log_at_start:new Date(iso+"T00:00:00").toLocaleDateString(T.lang,{day:"numeric",month:"short",year:"numeric"});
  if(d.start)out.push(tf("log_start",{a:fdt(PRESET_CLIENT.start||""),b:fdt(c.start||"")}));
  const acts=planActs({start:c.start||"",plan:{},extra:c.extra||[]},true,true);const was=PRESET_CLIENT.plan||{},now=c.plan||{};
  // The values that apply to one platform: its own entry over the activity's.
  const eff=(o,p)=>{const q=p?((o.platforms||{})[p]||{}):{};return{done:q.done??o.done??null,end:q.end??o.end??null,reason:(q.end?q.reason:o.reason)||null,days:q.days??o.days??null,blocked:q.blocked||null}};
  const parts=(o,n,def)=>{const r=[];
    if(JSON.stringify(o.done)!==JSON.stringify(n.done))r.push(n.done?tf("log_done",{d:fdt(n.done)}):T.log_undone);
    if(o.end!==n.end)r.push(n.end?(o.end?tf("log_end",{a:fdt(o.end),b:fdt(n.end)}):tf("log_end_new",{b:fdt(n.end)})):T.log_end_off);
    if(n.end&&JSON.stringify(o.reason)!==JSON.stringify(n.reason)&&n.reason)r.push(tf("log_reason",{r:reasonTxt([n.reason])}));
    if(o.days!==n.days)r.push(tf("log_days",{a:o.days??def,b:n.days??def}));
    if(o.blocked!==n.blocked)r.push(n.blocked?tf("log_blocked",{b:n.blocked}):T.log_unblocked);return r};
  d.acts.forEach(k=>{const a=acts.find(x=>x.id===k);if(!a)return;const o=was[k]||{},n=now[k]||{};const head=a.num===a.id?a.id+" "+a.name:a.num+" "+a.name;const lines=[];
    if(JSON.stringify(o.after||null)!==JSON.stringify(n.after||null))lines.push(tf("log_after",{l:(n.after||a.after).join(", ")}));
    const plats=o.platforms||n.platforms?targets().filter(p=>a.plat==="both"||a.plat===p):[null];
    const per=plats.map(p=>({p,r:parts(eff(o,p),eff(n,p),a.days)})).filter(x=>x.r.length);
    if(per.length>1&&per.every(x=>JSON.stringify(x.r)===JSON.stringify(per[0].r)))lines.push(per[0].r.join("; "));
    else per.forEach(x=>lines.push((x.p?PLAT_LABEL[x.p]+": ":"")+x.r.join("; ")));
    lines.forEach(l=>out.push(head+" · "+l))});
  return out}
// The whole instance.json with this browser's plan and a new entry in plan_log: it replaces the file in the client folder.
function downloadInstance(){const c=cur();if(!c||!PRESET_RAW)return;const changes=planChanges();if(!changes.length){toast(T.local_nothing);return}
  const raw=JSON.parse(JSON.stringify(PRESET_RAW));if(c.start)raw.start_date=c.start;else delete raw.start_date;
  if(Object.keys(c.plan||{}).length)raw.plan=c.plan;else delete raw.plan;
  // Several downloads on one day add to that day's entry.
  const day=todayISO();const log=raw.plan_log||[];const last=log[log.length-1];
  if(last&&last.date===day)last.changes=[...last.changes,...changes.filter(x=>!last.changes.includes(x))];else log.push({date:day,changes});raw.plan_log=log;
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(raw,null,2)+"\n"],{type:"application/json"}));a.download="instance.json";
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast(T.local_downloaded)}
function loadLocal(){if(PRESET_CLIENT)moveShared();clients=LS("mapm-clients")||{};versions=LS("mapm-versions")||{};if(!PRESET_CLIENT){delete clients.preset;Object.values(clients).forEach(c=>{if(c.plan&&c.planV!==PLAN_V){delete c.plan;c.planV=PLAN_V}})}if(PRESET_CLIENT){if(!clients.preset)clients.preset={...PRESET_CLIENT,planBase:PRESET_CLIENT.plan||{},planV:PLAN_V,startBase:PRESET_CLIENT.start||""};else{const p=clients.preset;p.extra=PRESET_CLIENT.extra;p.open=PRESET_CLIENT.open;p.risks=PRESET_CLIENT.risks;p.baseline=PRESET_CLIENT.baseline;syncPresetPlan(p);p.variants={...(PRESET_CLIENT.variants||{}),...(p.variants||{})};syncPresetStart(p)}LSW("mapm-clients",clients)}if(PRESET_CLIENT&&!st.client)st.client="preset"}
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
// V15 narrows the project to one platform; without it the page keeps both.
const targets=()=>({b:["ios"],c:["android"]}[variantOf("V15")]||["ios","android"]);
const inScope=p=>!p||p==="both"||targets().includes(p);
const tracked=src=>targets().length===2&&(variantOf("V15")==="a"||Object.values(src.plan).some(o=>o.platforms));

// ---------- Helpers
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function linkify(t){return esc(t).replace(/\b([ACF]\d{2}|S\d{1,2}\.\d{1,2})\b/g,m=>{const k=m[0];let lab="";
  if(k==="A")lab=A[m];else if(k==="C")lab=C[m]&&C[m][0];else if(k==="F")lab=F[m]&&F[m][0];else lab=byId[m]&&byId[m].name;
  if(!lab)return m;return `<button class="chip" data-go="${k==="S"?"step":k}:${m}"><b>${m}</b>${k==="S"?"":esc(lab)}</button>`})}
function toast(t){const el=document.getElementById("toast");el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2400)}
function setTab(t){st.tab=t;[["ov",tabOv,ovView],["rm",tabRm,rmView],["vr",tabVr,vrView],["dt",tabDt,dtView],["in",tabIn,inView],["rn",tabRn,rnView]].forEach(([k,b,v])=>{b.setAttribute("aria-selected",k===t);v.hidden=k!==t})}
function go(id,scroll){if(st.act&&!actRail(st.act).includes(id)){st.act="";st.actPlat=""}st.sel=id;st.view=null;try{history.replaceState(null,"","#"+id)}catch(e){}setTab("dt");render();
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
  // Lane titles wrap inside their box: up to three lines, then an ellipsis; the full name stays in the tooltip.
  LANES.forEach((l,i)=>{const x=X0+i*CW,name=laneLabel(l[0]),sub=laneSub(l[0]);
    s+=`<foreignObject x="${x+9}" y="14" width="${CW-18}" height="56"><div xmlns="http://www.w3.org/1999/xhtml" class="lhd" style="color:var(${LC[l[0]]})" title="${esc(name+" · "+sub)}"><b>${esc(name)}</b><small>${esc(sub)}</small></div></foreignObject>`});
  STAGES.forEach(([n,phs],r)=>{const words=n.split(" ");const a=words.slice(0,Math.ceil(words.length/2)).join(" "),b=words.slice(Math.ceil(words.length/2)).join(" ");
    s+=`<text class="st" x="12" y="${rowY[r]+PADR+12}">${esc(a)}</text><text class="st" x="12" y="${rowY[r]+PADR+27}">${esc(b)}</text><text class="sp" x="12" y="${rowY[r]+PADR+43}">${phs.length>1?phs[0]+"–"+phs.at(-1):phs[0]}</text>`});
  // Same routes as arrow_path in build.py, described in model/diagram.json.
  ARROWS.forEach(([na,nb,k])=>{const a=pos[na],b=pos[nb],right=b.x>a.x,side=right?a.x+a.w:a.x,ax=a.x+a.w/2,ay=a.y+a.h/2,bx=b.x+b.w/2,by=b.y+b.h/2;let p;
    if(k==="h"){const ex=right?b.x:b.x+b.w,dx=(ex-side)/2;p=`M${side} ${ay}C${side+dx} ${ay} ${ex-dx} ${by} ${ex} ${by}`}
    else if(k==="s")p=`M${side} ${ay}H${bx-9*(right?1:-1)}Q${bx} ${ay} ${bx} ${ay+9}V${b.y}`;
    else if(k==="r")p=`M${side} ${ay}H${b.x+b.w/4}V${b.y+b.h}`;
    else if(k==="l")p=`M${ax} ${a.y+a.h}V${b.y+b.h*.75}H${b.x+b.w}`;
    else if(k==="g")p=`M${a.x+a.w*.75} ${a.y+a.h}V${b.y-6}H${bx}V${b.y}`;
    else{const sy=a.y+a.h,ey=b.y,dy=Math.max(18,(ey-sy)/2);p=`M${ax} ${sy}C${ax} ${sy+dy} ${bx} ${ey-dy} ${bx} ${ey}`}
    s+=`<path class="arr" d="${p}" marker-end="url(#sw-ah)"/>`});
  BOX.forEach(([n,lid,r,lines])=>{const p=pos[n];const c=`var(${LC[lid]})`;const off=!inScope(ACT[n-1][7]);
    s+=`<g class="bx"${off?' opacity=".3"':""} tabindex="0" role="button" data-box="${n}" aria-label="${n}. ${esc(lines.join(" "))}, ${esc(laneLabel(lid))}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="8" fill="var(${LC[lid]}s)" stroke="${c}"/><circle cx="${p.x+13}" cy="${p.y+14}" r="9" fill="${c}"/><text class="num" x="${p.x+13}" y="${p.y+17.5}" text-anchor="middle">${n}</text>${lines.map((t,k)=>`<text x="${p.x+28}" y="${p.y+18+k*15}">${esc(t)}</text>`).join("")}</g>`});
  swim.setAttribute("viewBox",`0 0 ${W} ${H}`);swim.style.width=W+"px";swim.innerHTML=s;
}
// Opening a box shows the steps of that activity, for the platforms in scope.
const actSteps=key=>{const a=ACT.find(x=>x[0]===key);return a?a[9].filter(id=>byId[id]&&inScope(byId[id].plat)):[]};
// The client's own activity with this id, if any: it has no steps of its own, but may list tasks and related steps (refs).
const extraAct=key=>{const c=cur();return(c&&c.extra||[]).find(x=>String(x.id)===key)||null};
const actRefs=key=>{const x=extraAct(key);return(x&&x.refs||[]).filter(id=>byId[id]&&inScope(byId[id].plat))};
// Steps the rail shows while an activity is open: its own, or the related ones of a client activity.
const actRail=key=>{const own=actSteps(key);return own.length?own:actRefs(key)};
function openBox(n){const a=ACT[n-1];if(a)openAct(a[0])}
function renderPairs(){
  const el=document.getElementById("pairAlerts");const c=cur();
  const norm=t=>(t||"").trim().toLowerCase();
  const same=(a,b)=>{const la=laneOfRole[a],lb=laneOfRole[b];if(la===lb)return true;if(!c||!c.lanes)return false;const na=norm(c.lanes[la]),nb=norm(c.lanes[lb]);return na&&na===nb};
  const hits=PAIRS.filter(([a,b])=>same(a,b));
  el.innerHTML=hits.map(([a,b,risk,sev])=>`<div class="alert"><b>${esc(tf("pair_alert",{a:A[a],b:A[b],lane:laneLabel(laneOfRole[a]),sev:T.severity[sev]||sev}))}</b>${esc(risk)}.${esc(T.pair_alert_tail)}</div>`).join("");
}
// ---------- Plan by activity
// ACT rows: [key, name, lane, days, after[], continuous, per_version, platform, joint]; the number shown is the position.
// A client may override days and after, mark an activity done (date or true), set the date it ends (end, when it is
// postponed) and add its own activities (extra). With two tracked platforms an activity runs once per platform, and a
// joint activity waits for both (see planNodes).
const planSrc=()=>{const c=cur();return c?{start:c.start||"",plan:c.plan||{},extra:c.extra||[]}:{start:LS("mapm-start")||"",plan:LS("mapm-plan2")||{},extra:[]}};
async function savePlan(start,plan){const c=cur();if(c){const n={...c,plan};if(start)n.start=start;else delete n.start;await putClient(st.client,n)}else{LSW("mapm-start",start||null);LSW("mapm-plan2",plan)}renderTimeline();renderRoadmap()}
function planActs(src,ignoreDone,ignoreEnd){
  const base=ACT.map((r,i)=>({id:r[0],num:String(i+1),name:r[1],lane:r[2],days:r[3],after:r[4],cont:r[5],ver:r[6],plat:r[7],joint:r[8],steps:r[9],ms:r[10],extra:false,i}));
  const ext=src.extra.map((x,j)=>({id:String(x.id),num:String(x.id),name:x.name,lane:x.lane,days:x.days,after:(x.after||[]).map(String),cont:false,ver:false,plat:x.platform||"both",joint:x.joint??true,steps:[],ms:x.milestone||null,extra:true,i:ACT.length+j}));
  return base.concat(ext).map(a=>{const o=src.plan[a.id]||{};return{...a,days:o.days??a.days,after:o.after?o.after.map(String):a.after,done:ignoreDone?null:(o.done??null),end:ignoreEnd?null:(o.end??null),reason:ignoreEnd?null:(o.reason??null),plats:o.platforms||{}}});
}
// Why an end date was moved: one category and an optional note, stored next to that end.
const REASONS=["external","dependency","decision","team","scope","other"];
const reasonTxt=rs=>rs.filter(Boolean).map(x=>T["reason_"+x.type]+(x.note?": "+x.note:"")).join(" · ");
// Committed start and end of a node in days, from the baseline: per platform (key@ios) or per activity.
const baseOf=(base,n,s0)=>{const b=(base||{})[n.id]??(base||{})[n.act];return b&&b.start&&b.end?{s:dayOf(s0,b.start),e:dayOf(s0,b.end)}:null};
// Dates in local time: toISOString() is UTC, so west of Greenwich it returns tomorrow in the evening.
const isoDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const todayISO=()=>isoDate(new Date());
const dayOf=(start,iso)=>start&&typeof iso==="string"?Math.round((new Date(iso+"T00:00:00")-new Date(start+"T00:00:00"))/DAY):0;
// Forecast from today: an open activity whose end has passed is taken to end today, so what follows moves with it
// and the end date of the plan stays real. It keeps late=true. Without a start date, or with noForecast, it plans
// as written: that is the reference the deviation is measured against. s0 is the earliest start its predecessors allow.
function planCalc(list,start,noForecast){
  const by=Object.fromEntries(list.map(a=>[a.id,a]));const r={};const today=start&&!noForecast?dayOf(start,todayISO()):null;
  const fin=(s,e,s0)=>{const late=today!==null&&e<today;return{s,e:late?today:e,late,s0}};
  const go=(id,seen)=>{if(r[id])return r[id];const a=by[id];if(!a||seen.has(id))return null;seen.add(id);
    const prev=a.after.map(x=>go(x,seen)).filter(Boolean);const s0=Math.max(0,...prev.map(p=>p.e));
    if(a.done){const d=dayOf(start,a.done);return r[id]={s:d,e:d,done:true}}
    if(a.cont)return r[id]={s:s0,e:s0};
    if(a.end&&start){const e=dayOf(start,a.end);return r[id]=fin(Math.min(s0,e),e,s0)}
    return r[id]=fin(s0,s0+a.days,s0)};
  list.forEach(a=>go(a.id,new Set()));
  // Critical path: no slack between an activity and the latest finish it can have.
  const work=list.filter(a=>!a.cont&&!a.done);const end=Math.max(0,...work.map(a=>r[a.id].e));const lf={};
  [...work].sort((x,y)=>r[y.id].e-r[x.id].e).forEach(a=>{const succ=work.filter(b=>b.after.includes(a.id));lf[a.id]=succ.length?Math.min(...succ.map(b=>lf[b.id]-(r[b.id].e-r[b.id].s))):end});
  // Slack: days an activity can slip before the end of the plan moves.
  work.forEach(a=>{const sl=lf[a.id]-r[a.id].e;r[a.id].crit=sl===0;r[a.id].slack=Math.max(0,sl)});
  return{r,end};
}
// One node per activity and platform; a joint activity is a single node that waits for every platform.
// An activity off a platform passes through to what it waits for, so that platform's chain does not break.
function planNodes(acts,ignoreEnd){
  const by=Object.fromEntries(acts.map(a=>[a.id,a]));const ts=targets();const on=(a,p)=>a.plat==="both"||a.plat===p;
  const depOn=(id,p)=>{const d=by[id];if(!d)return[];if(d.joint)return[id];return on(d,p)?[`${id}@${p}`]:d.after.flatMap(x=>depOn(x,p))};
  return acts.flatMap(a=>{
    if(a.joint)return[{...a,act:a.id,track:null,after:[...new Set(ts.flatMap(p=>a.after.flatMap(x=>depOn(x,p))))]}];
    return ts.filter(p=>on(a,p)).map(p=>{const q=a.plats[p]||{};return{...a,id:`${a.id}@${p}`,act:a.id,track:p,after:[...new Set(a.after.flatMap(x=>depOn(x,p)))],days:q.days??a.days,end:ignoreEnd?null:(q.end??a.end),reason:ignoreEnd?null:((q.end?q.reason:a.reason)??null),done:a.done??q.done??null}})})}
// The plan as one view: "all" or empty gives every activity, "ios" or "android" only that platform's.
// list and r are keyed by activity; nodes and raw keep the detail per platform. moved compares each activity
// with the plan before any date was changed, for the ones whose end date was set by hand.
function planView(src,start,view){
  const plain=targets().length===2&&!tracked(src);
  // Three readings of the plan: current (forecast and page edits), same (forecast, no edits: what moved by hand) and
  // before (as written: no forecast, no edits: the reference for the deviation when there is no baseline).
  const build=(noEnd,noForecast)=>{const acts=planActs(src,false,noEnd);const nodes=plain?acts.map(a=>({...a,act:a.id,track:null})):planNodes(acts,noEnd);return{acts,nodes,...planCalc(nodes,start,noForecast)}};
  const{acts,nodes,r:raw}=build(false,false);const same=build(true,false).r;const before=build(true,true).r;const r={};
  const list=acts.map(a=>{const ns=nodes.filter(n=>n.act===a.id&&(!view||view==="all"||!n.track||n.track===view));if(!ns.length)return null;
    const qs=ns.map(n=>raw[n.id]);const all=ns.every(n=>n.done);r[a.id]={s:Math.min(...qs.map(q=>q.s)),e:Math.max(...qs.map(q=>q.e)),done:all,crit:qs.some(q=>q.crit),late:qs.some(q=>q.late)};
    const sl=qs.map(q=>q.slack).filter(x=>x!==undefined);if(sl.length)r[a.id].slack=Math.min(...sl);
    const hn=ns.filter(n=>n.end&&!n.done);const hand=hn.map(n=>raw[n.id].e-same[n.id].e);
    return{...a,done:all?(ns.map(n=>n.done).filter(x=>typeof x==="string").sort().at(-1)||true):null,nodes:ns,moved:hand.length?hand.reduce((x,y)=>Math.abs(y)>Math.abs(x)?y:x):0,reasons:hn.map(n=>n.reason).filter(Boolean)}}).filter(Boolean);
  const work=list.filter(a=>!a.cont&&!a.done);
  return{list,r,raw,nodes,before,same,end:Math.max(0,...work.map(a=>r[a.id].e))}}
// First pending activity where the platforms meet, and when each one is ready for it.
function planGate(v){
  const g=v.nodes.filter(n=>!n.track&&!n.done&&!n.cont&&targets().every(p=>n.after.some(x=>x.endsWith("@"+p)))).sort((a,b)=>v.raw[a.id].s-v.raw[b.id].s||b.extra-a.extra)[0];if(!g)return null;
  return{id:g.act,ready:Object.fromEntries(targets().map(p=>[p,Math.max(...g.after.filter(x=>x.endsWith("@"+p)).map(x=>v.raw[x].e))]))}}
// Stage of each activity: its diagram stage; client activities take the latest stage among what they wait for.
function stagesOf(list){
  const stageOf={};ACT.forEach((a,i)=>{stageOf[a[0]]=BOX[i][2]});
  const st2=id=>{if(stageOf[id]!==undefined)return stageOf[id];const a=list.find(x=>x.id===id);stageOf[id]=-1;const v=Math.max(0,...(a?a.after:[]).map(st2));return stageOf[id]=v};
  list.forEach(a=>st2(a.id));return stageOf}
// Plan as a compact list: one line per activity, grouped by stage, with filters. Editing opens inside the row.
function renderTimeline(){
  const el=document.getElementById("timeline");const src=planSrc();const s0=src.start;const{list,r,raw,end}=planView(src,s0);
  const fd=n=>{if(!s0)return tf("tl_day_n",{n});const d=new Date(s0+"T00:00:00");d.setDate(d.getDate()+n);return d.toLocaleDateString(T.lang,{day:"numeric",month:"short"})};
  const iso=n=>{const d=new Date(s0+"T00:00:00");d.setDate(d.getDate()+n);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
  const today=s0?dayOf(s0,todayISO()):null;const stageOf=stagesOf(list);
  const stat=(x,q)=>x.done?"done":today===null?"todo":q.late?"late":q.s<=today?"now":"todo";
  const blocks=a=>a.done?[]:Object.entries(a.plats).filter(([p,q])=>q.blocked&&targets().includes(p)).map(([p,q])=>(PLAT_LABEL[p]+": "+q.blocked));
  const F={all:a=>true,open:a=>!a.done&&!a.cont,week:a=>!a.done&&!a.cont&&today!==null&&r[a.id].s<=today+7&&r[a.id].e>=today,late:a=>!a.cont&&stat(a,r[a.id])==="late",blocked:a=>blocks(a).length>0};
  const f=F[st.tlFilter]?st.tlFilter:"all";
  const partsOf=a=>!a.joint&&a.nodes&&a.nodes.length>1?a.nodes:null;
  const when=(a,x,q)=>a.cont?tf("tl_continuous",{d:fd(q.s)}):x.done?fd(q.e):q.s===q.e?fd(q.e):`${fd(q.s)} → ${fd(q.e)}`;
  const chip=(code,lab,tip)=>`<span class="tst ${code}"${tip?` title="${esc(tip)}"`:""}>${esc(lab)}</span>`;
  const row=a=>{const q=r[a.id];const parts=partsOf(a);const open=st.tlEdit===a.id;
    const one=(x,qq,lab)=>{const c=stat(x,qq);return chip(c,(lab?lab+": ":"")+T["tl_st_"+c])};
    const chips=a.cont?chip("todo",T.tl_st_cont):(parts?parts.map(n=>one(n,raw[n.id],PLAT_LABEL[n.track])).join(""):one(a,q,""))+(blocks(a).length?chip("blocked",T.tl_st_blocked):"")+(a.moved>0?chip("moved",tf("tl_moved",{n:a.moved}),reasonTxt(a.reasons)):"");
    const dates=parts?parts.map(n=>`<span><em>${PLAT_LABEL[n.track]}</em>${when(a,n,raw[n.id])}</span>`).join(""):`<span>${when(a,a,q)}</span>`;
    const meta=[laneLabel(a.lane),a.plat!=="both"?tf("tl_only",{p:PLAT_LABEL[a.plat]}):"",a.extra?T.tl_extra:"",a.joint&&a.nodes&&!a.cont&&tracked(src)?T.tl_shared:""].filter(Boolean).map(esc).join(" · ");
    // Each platform holds one done box and one date: the day it was done, or the day it ends while it is open.
    // A postponed end (one set by hand) asks why: a category and an optional note.
    const why=(x,pa,name)=>{if(!x.end||x.done)return"";const rs=x.reason||{};
      return`<label>${T.tl_reason} <select data-act="${esc(a.id)}" data-f="reason${name}"${pa}>${["",...REASONS].map(k=>`<option value="${k}"${(rs.type||"")===k?" selected":""}>${k?T["reason_"+k]:T.tl_reason_pick}</option>`).join("")}</select></label><label>${T.tl_reason_note} <input type="text" class="pnote" data-act="${esc(a.id)}" data-f="reasonNote${name}"${pa} value="${esc(rs.note||"")}"></label>`};
    const cell=(x,lab,qq,plat)=>{const pa=plat?` data-plat="${plat}"`:"";const name=plat?"Plat":"";
      return`<div class="pcell"><label class="pdone"><input type="checkbox" data-act="${esc(a.id)}" data-f="done${name}"${pa} ${x.done?"checked":""}> ${lab}</label>${!s0?"":x.done?`<label>${T.tl_done_on} <input type="date" data-act="${esc(a.id)}" data-f="done${name}Date"${pa} value="${typeof x.done==="string"?esc(x.done):esc(s0)}"></label>`:`<label>${T.tl_end_on} <input type="date" data-act="${esc(a.id)}" data-f="end${name}"${pa} value="${iso(qq.e)}"></label>${why(x,pa,name)}`}</div>`};
    const n=a.steps.filter(id=>byId[id]&&inScope(byId[id].plat)).length;
    const edit=open&&!a.cont?`<div class="pedit">${a.done?"":`<label class="pdays">${T.tl_h_days} <input type="number" min="0" step="1" value="${a.days}" data-act="${esc(a.id)}" data-f="days"></label>`}${parts?parts.map(x=>cell(x,PLAT_LABEL[x.track],raw[x.id],x.track)).join(""):cell(a,T.tl_h_done,q,"")}${blocks(a).map(b=>`<small class="pblk">${esc(b)}</small>`).join("")}</div>`:"";
    return`<div class="prow${q.crit?" crit":""}${a.done?" done":""}${open?" open":""}"><div class="pname"><b style="background:var(${LC[a.lane]||"--muted"})">${esc(a.num)}</b><span>${esc(a.name)}<small>${meta} · <button class="plink" type="button" data-openact="${esc(a.id)}">${n?tf("act_open",{n}):T.act_view}</button></small></span></div><div class="pst">${chips}</div><div class="pwhen">${dates}</div><div class="pact">${a.cont?"":`<button class="btn" type="button" data-tledit="${esc(a.id)}" aria-expanded="${open}">${open?T.tl_close:T.tl_edit}</button>`}</div>${edit}</div>`};
  const groups=STAGES.map((g,i)=>({i,name:g[0],acts:list.filter(a=>stageOf[a.id]===i).sort((x,y)=>r[x.id].s-r[y.id].s||x.i-y.i)})).filter(g=>g.acts.length);
  // On load only the first stage with open work is unfolded; the reader's own choice wins after that.
  const firstOpen=(groups.find(g=>g.acts.some(a=>!a.done&&!a.cont))||groups[0]||{}).i;
  const body=groups.map(g=>{const shown=g.acts.filter(F[f]);if(!shown.length)return"";const work=g.acts.filter(a=>!a.cont);const dn=work.filter(a=>a.done).length;
    const open=f!=="all"||(st.tlStage[g.i]??g.i===firstOpen);
    return`<details class="pstage" data-stage="${g.i}"${open?" open":""}><summary><b>${esc(g.name)}</b><small>${work.length?tf("tl_stage_done",{a:dn,b:work.length}):""}</small></summary>${shown.map(row).join("")}</details>`}).join("")||`<p class="plain">${T.tl_f_none}</p>`;
  const counts=Object.fromEntries(Object.entries(F).map(([k,fn])=>[k,list.filter(fn).length]));
  const filters=`<div class="seg ptfilter" role="group" aria-label="${T.tl_filter}">${["all","open","week","late","blocked"].map(k=>`<button type="button" data-tlf="${k}" aria-pressed="${f===k}">${T["tl_f_"+k]} <small>${counts[k]}</small></button>`).join("")}</div>`;
  const ver=planActs(src,true,true).filter(a=>a.ver&&!a.cont&&inScope(a.plat));const vids=new Set(ver.map(a=>a.id));const vc=planCalc(ver.map(a=>({...a,after:a.after.filter(x=>vids.has(x))})),"");
  const crit=[...list].filter(a=>r[a.id].crit).sort((x,y)=>r[x.id].s-r[y.id].s).map(a=>a.num).join(" → ");
  el.innerHTML=`<h3>${T.tl_title}</h3><div class="plain">${T.tl_intro}</div>${localBanner()}<div class="ptools"><label class="tlstart">${T.tl_start} <input type="date" id="tlStart" value="${esc(s0)}"></label><button class="btn" type="button" id="tlReset">${T.tl_reset}</button><button class="btn" type="button" data-csv="start">${T.csv_export}</button>${cur()?"":`<span class="plain">${T.tl_noclient}</span>`}</div>
  ${filters}${body}
  <div class="tlsum"><span><b>${T.tl_end}:</b> <b>${fd(end)}</b>${s0?"":` (${end} ${T.tl_days})`}</span><span><b>${vc.end} ${T.tl_days}</b> ${T.tl_each}</span><span class="plain">${T.tl_critical} ${esc(crit)}</span></div>`;
}
// ---------- Export the plan as CSV (opens in Excel; imports in project tools)
// One row per activity and platform. Real progress is what is done; expected progress is the share of the committed
// period already gone (baseline in instance.json, or the plan without page edits when there is none); the deviation
// is the current end minus that reference. The header says where the data came from. Slack is how many days a
// pending activity can slip before the end of the plan moves.
function exportCsv(official){
  const c=cur();const live=planSrc();const preset=st.client==="preset"&&PRESET_CLIENT;
  const src=official&&preset?{start:PRESET_CLIENT.start||"",plan:PRESET_CLIENT.plan||{},extra:PRESET_CLIENT.extra||[]}:live;
  const s0=src.start;if(!s0){toast(T.rm_need_start);return}
  const v=planView(src,s0);const todayIso=todayISO();const today=dayOf(s0,todayIso);const stageOf=stagesOf(v.list);
  const iso=n=>{const d=new Date(s0+"T00:00:00");d.setDate(d.getDate()+n);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
  const base=(c&&c.baseline)||{};const decs=(c&&c.open)||[];const local=!official&&!!localDiff();
  const rows=[];
  v.list.forEach(a=>(a.nodes||[a]).forEach(n=>{const q=v.raw[n.id]||v.r[a.id];const b=(v.before&&v.before[n.id])||q;const done=!!n.done;
    const bl=baseOf(base,n,s0);const refE=bl?bl.e:b.e;const refS=bl?bl.s:b.s;const rs=n.end&&!done?n.reason:null;
    const blk=n.track?((a.plats[n.track]||{}).blocked||""):Object.values(a.plats).map(x=>x.blocked).filter(Boolean).join(" | ");
    const code=done?"done":a.cont?"cont":blk?"blocked":q.late?"late":q.s<=today?"now":"todo";
    const exp=a.cont?"":refE<=refS?(today>=refE?100:0):Math.max(0,Math.min(100,Math.round((today-refS)/(refE-refS)*100)));
    const plat=n.track?PLAT_LABEL[n.track]:a.joint&&tracked(src)?T.csv_joint:PLAT_LABEL[a.plat];
    rows.push([a.num,a.name,(STAGES[stageOf[a.id]]||[""])[0],laneLabel(a.lane),plat,iso(q.s),a.cont?"":iso(q.e),T["tl_st_"+code],a.cont?"":done?100:0,exp,
      a.cont?"":iso(refE),a.cont?"":q.e-refE,bl?T.csv_ref_base:T.csv_ref_plan,a.ms?a.ms.name:"",blk,decs.filter(d=>((d.blocks||[]).includes(a.id)||d.id===a.id)&&(!d.platform||!n.track||d.platform===n.track)).map(d=>d.id).join(" "),
      n.end&&!done?q.e-((v.same&&v.same[n.id])||b).e:0,rs?T["reason_"+rs.type]:"",rs&&rs.note||"",q.crit?T.csv_yes:"",q.slack??"",a.steps.join(" ")])}));
  const head=["csv_h_num","csv_h_act","csv_h_stage","csv_h_owner","csv_h_plat","csv_h_start","csv_h_end","csv_h_status","csv_h_real","csv_h_expected","csv_h_ref_end","csv_h_dev","csv_h_ref","csv_h_ms","csv_h_block","csv_h_dec","csv_h_moved","csv_h_reason","csv_h_reason_note","csv_h_crit","csv_h_slack","csv_h_steps"].map(k=>T[k]);
  const meta=[[T.csv_client,c?c.name:T.client_base_option],[T.csv_generated,todayIso],[T.csv_start,s0],[T.csv_source,local?T.csv_src_local:T.csv_src_official],[T.csv_baseline,Object.keys(base).length?T.csv_ref_base:T.csv_ref_plan],[T.csv_updated,planUpdated()||""],[]];
  const cell=x=>{const s=String(x??"");return/[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
  // Semicolons and a BOM so Excel in Spanish opens it in columns with accents intact.
  const csv="\ufeff"+[...meta,head,...rows].map(r=>r.map(cell).join(";")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=`plan-${((c&&c.name)||"modelo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${todayIso}.csv`;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast(T.csv_done)}
// With local changes the reader chooses the official plan or their own; otherwise it exports directly.
function onCsv(e){const b=e.target.closest("[data-csv]");if(!b)return false;const m=b.dataset.csv;
  if(m==="start"){if(localDiff()){const box=b.parentNode.querySelector(".csvask");if(box){box.hidden=!box.hidden;return true}
      b.insertAdjacentHTML("afterend",`<span class="csvask">${T.csv_ask} <button class="btn" type="button" data-csv="official">${T.csv_official}</button><button class="btn" type="button" data-csv="local">${T.csv_local}</button></span>`);return true}
    exportCsv(true);return true}
  exportCsv(m==="official");const box=b.closest(".csvask");if(box)box.hidden=true;return true}
function onPlanChange(e){
  const t=e.target;const src=planSrc();
  if(t.id==="tlStart"){savePlan(t.value,src.plan);return}
  const id=t.dataset.act,f=t.dataset.f;if(!id)return;const plan={...src.plan};const o={...(plan[id]||{})};
  const base=ACT.find(x=>x[0]===id);const ext=src.extra.find(x=>String(x.id)===id);const def=base?base[3]:ext.days;
  if(f==="days"){const v=Math.max(0,parseInt(t.value,10)||0);if(v===def)delete o.days;else o.days=v;delete o.end}
  // An end date before the activity can start (after its predecessors) would shorten it silently: refuse it.
  if((f==="end"||f==="endPlat")&&t.value&&src.start){const v=planView(src,src.start);const q=v.raw[t.dataset.plat?`${id}@${t.dataset.plat}`:id]||v.r[id];
    const s0=q&&(q.s0??q.s);if(s0!==undefined&&dayOf(src.start,t.value)<s0){const d=new Date(src.start+"T00:00:00");d.setDate(d.getDate()+s0);
      toast(tf("tl_end_before",{d:d.toLocaleDateString(T.lang,{day:"numeric",month:"short",year:"numeric"})}));renderTimeline();return}
    // The date the plan already shows is not a postponement: nothing to store.
    const own=t.dataset.plat?((o.platforms||{})[t.dataset.plat]||{}).end:o.end;if(q&&!own&&dayOf(src.start,t.value)===q.e)return}
  // The reason belongs to the end it explains: it goes when the end goes. A note alone counts as "other".
  const setWhy=(x,k,v)=>{const w={...(x.reason||{})};if(k==="type"){if(v)w.type=v;else delete w.type}else{if(v.trim())w.note=v.trim();else delete w.note}
    if(w.note&&!w.type)w.type="other";if(w.type)x.reason=w;else delete x.reason};
  if(f==="end"){if(t.value)o.end=t.value;else{delete o.end;delete o.reason}}
  if(f==="reason")setWhy(o,"type",t.value);
  if(f==="reasonNote")setWhy(o,"note",t.value);
  if(f==="done"){if(t.checked){o.done=src.start||todayISO();delete o.end;delete o.reason}else delete o.done}
  if(f==="doneDate"&&t.value)o.done=t.value;
  if(["donePlat","donePlatDate","endPlat","reasonPlat","reasonNotePlat"].includes(f)){const p=t.dataset.plat,pl={...(o.platforms||{})};
    if(o.done){targets().forEach(x=>{pl[x]={...(pl[x]||{}),done:o.done}});delete o.done}
    const q={...(pl[p]||{})};
    if(f==="donePlatDate"){if(t.value)q.done=t.value}
    else if(f==="endPlat"){if(t.value)q.end=t.value;else{delete q.end;delete q.reason}}
    // An end written for the whole activity keeps its reason there too.
    else if(f==="reasonPlat")setWhy(q.end?q:o,"type",t.value);
    else if(f==="reasonNotePlat")setWhy(q.end?q:o,"note",t.value);
    else if(t.checked){q.done=src.start||todayISO();delete q.end;delete q.reason}else delete q.done;
    if(Object.keys(q).length)pl[p]=q;else delete pl[p];if(Object.keys(pl).length)o.platforms=pl;else delete o.platforms}
  if(Object.keys(o).length)plan[id]=o;else delete plan[id];savePlan(src.start,plan);
}
async function resetPlan(){const c=cur();const p=st.client==="preset"&&PRESET_CLIENT?PRESET_CLIENT:null;
  if(c){const n={...c,plan:p&&p.plan?p.plan:{}};if(p&&p.start)n.start=p.start;await putClient(st.client,n)}else{LSW("mapm-plan2",{});}renderTimeline();renderRoadmap();toast(T.tl_reset_done)}

// ---------- Roadmap (executive view of the same plan)
// A section of the detail that folds; whether it is open survives re-renders.
const fold=(id,sum,body)=>`<details class="rmsec rmfold" id="${id}"${st.rmFold[id]?" open":""}><summary>${sum}</summary>${body}</details>`;
// Date of the last update recorded in plan_log, for the preset client.
const planUpdated=()=>{const l=st.client==="preset"&&PRESET_CLIENT&&PRESET_CLIENT.log||[];return l.length?l[l.length-1].date:null};
// History of the plan, newest first: the last ten in view, the rest folded.
function logBox(fd,s0){const l=st.client==="preset"&&PRESET_CLIENT&&PRESET_CLIENT.log||[];if(!PRESET_RAW||st.client!=="preset")return"";
  const item=e=>`<li><b>${fd(dayOf(s0,e.date))}</b><ul>${e.changes.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></li>`;const all=[...l].reverse();
  return fold("rmLog",tf("rm_fold_log",{n:all.length}),`<div class="rmlog">${all.length?`<ul>${all.slice(0,10).map(item).join("")}</ul>${all.length>10?`<details><summary>${tf("rm_log_more",{n:all.length-10})}</summary><ul>${all.slice(10).map(item).join("")}</ul></details>`:""}`:`<p class="plain">${T.rm_updated_none}</p>`}</div>`)}
// Status is computed against today.
function renderRoadmap(){
  const el=document.getElementById("roadmap");const src=planSrc();const s0=src.start;const c=cur();
  if(!s0){el.innerHTML=`<div class="rmhead"><div><h2>${T.rm_title}${c?" · "+esc(c.name):""}</h2></div></div><p class="plain">${T.rm_need_start}</p>`;return}
  const multi=tracked(src);const view=multi?st.track:"";const pv=planView(src,s0,view);const{list,r,raw,end}=pv;const today=dayOf(s0,todayISO());
  const fd=n=>{const d=new Date(s0+"T00:00:00");d.setDate(d.getDate()+n);return d.toLocaleDateString(T.lang,{day:"numeric",month:"short",year:"numeric"})};
  const statOf=(a,q)=>{if(a.done)return"done";if(a.cont)return q.s<=today?"now":"todo";if(q.late)return"late";if(q.s<=today)return"now";return"todo"};const status=a=>statOf(a,r[a.id]);
  const work=list.filter(a=>!a.cont);const cnt={done:0,now:0,todo:0,late:0};work.forEach(a=>cnt[status(a)]++);
  const stageOf=stagesOf(list);
  // Finished activities do not stretch the axis: one done months ago sits at its left edge.
  const lo=Math.min(0,today,...pv.nodes.filter(n=>!n.done).map(n=>raw[n.id].s)),hi=Math.max(end,today)+14,span=hi-lo;const pct=n=>Math.max(0,Math.min(100,(n-lo)/span*100));
  // Month ticks
  let ticks="",labels="";const d=new Date(s0+"T00:00:00");d.setDate(d.getDate()+lo);d.setDate(1);d.setMonth(d.getMonth()+1);
  for(let k=0;k<24;k++){const n=dayOf(s0,isoDate(d));if(n>hi)break;ticks+=`<span class="gtick" style="left:${pct(n)}%"></span>`;labels+=`<span style="left:${pct(n)}%">${d.toLocaleDateString(T.lang,{month:"short",year:"2-digit"})}</span>`;d.setMonth(d.getMonth()+1)}
  const inRange=today>=lo&&today<=hi;const todayLine=inRange?`<span class="gtoday" style="left:${pct(today)}%"></span>`:"";const todayMark=inRange?`<span class="gtoday" style="left:${pct(today)}%"><i>${T.rm_today}</i></span>`:"";
  // Milestones: activities marked in the model or by the client, one diamond per platform at the date the activity ends.
  const mls=list.filter(a=>a.ms).map(a=>({a,pts:a.nodes.map(n=>({n,q:raw[n.id],done:!!n.done}))})).sort((x,y)=>Math.max(...x.pts.map(p=>p.q.e))-Math.max(...y.pts.map(p=>p.q.e)));
  const msLab=(a,p)=>a.ms.name+(p.n.track&&a.nodes.length>1?" · "+PLAT_LABEL[p.n.track]:"");
  // Committed dates come from the baseline of instance.json, per platform (key@ios) or per activity.
  const base=(c&&c.baseline)||{};const committed=p=>{const b=baseOf(base,p.n,s0);return b?b.e:null};
  let msRows="";
  // A milestone is the end of its activity: the row names the activity, opens it, and lists the dates.
  // With two platforms on different dates, iOS sits in the upper half of the row and Android in the lower one.
  const sameAll=pts=>pts.length>1&&pts.every(p=>p.q.e===pts[0].q.e&&p.done===pts[0].done);
  const dia=(a,p,pos,lab)=>`<span class="gms ${a.ms.type}${p.done?" done":p.q.late?" late":""}${pos}" style="left:${pct(p.q.e)}%" title="${esc(lab+" · "+T["rm_ms_"+a.ms.type])}: ${fd(p.q.e)}"></span>`;
  const diamonds=(a,pts)=>!pts.length?"":pts.length===1||sameAll(pts)?dia(a,pts[0],"",a.ms.name+(pts.length>1?" · "+T.rm_ms_both:"")):pts.map(p=>dia(a,p,p.n.track==="ios"?" up":" down",msLab(a,p))).join("");
  const short=n=>{const x=new Date(s0+"T00:00:00");x.setDate(x.getDate()+n);return x.toLocaleDateString(T.lang,{day:"numeric",month:"short"})};
  const devTxt=p=>{const cm=committed(p);return cm===null||p.q.e===cm?"":` <i class="${p.q.e>cm?"over":""}">${p.q.e>cm?"+":""}${tf("rm_ms_dev",{n:p.q.e-cm})}</i>`};
  const msDates=pts=>pts.length===1||sameAll(pts)?`<span>${short(pts[0].q.e)}${devTxt(pts[0])}</span>`:pts.map(p=>`<span><em>${PLAT_LABEL[p.n.track]}</em>${short(p.q.e)}${devTxt(p)}</span>`).join("");
  mls.forEach(({a,pts})=>{msRows+=`<div class="grow msrow"><div class="gl" data-gomsact="${esc(a.id)}" role="button" tabindex="0" title="${esc(a.ms.name+" · "+T["rm_ms_"+a.ms.type]+" · "+a.num+" "+a.name)}"><b>◆</b>${esc(a.ms.name)} <small>${esc(tf("rm_ms_from",{n:a.num})+" · "+a.name)}</small></div><div class="gt">${ticks}${pts.map(p=>{const cm=committed(p);return cm===null?"":`<span class="gbase${pts.length>1&&!sameAll(pts)?(p.n.track==="ios"?" up":" down"):""}" style="left:${pct(cm)}%" title="${esc(msLab(a,p)+" · "+T.rm_base_mark+": "+fd(cm))}"></span>`}).join("")}${diamonds(a,pts)}${todayLine}</div><div class="gd">${msDates(pts)}</div></div>`});
  let rows="";
  STAGES.forEach((g,i)=>{const acts=list.filter(a=>stageOf[a.id]===i).sort((x,y)=>r[x.id].s-r[y.id].s||x.i-y.i);if(!acts.length)return;
    rows+=`<div class="grow stg"><div class="gl">${esc(g[0])}</div><div class="gt">${ticks}${todayLine}</div></div>`;
    acts.forEach(a=>{const tipOf=(x,q)=>x.done?tf("rm_done_on",{d:fd(q.e)}):a.cont?tf("tl_continuous",{d:fd(q.s)}):tf("rm_until",{a:fd(q.s),b:fd(q.e)});
      const why=x=>{const t=reasonTxt(x.nodes?x.reasons:x.end&&!x.done?[x.reason]:[]);return t?` · ${T.tl_reason}: ${t}`:""};
      // Slack, when shown, runs from the end of the bar to the latest end that keeps the plan's end in place.
      const slack=(x,q,cls)=>!st.rmSlack||x.done||a.cont||!q.slack?"":`<span class="gslack${cls}" style="left:${pct(q.e)}%;width:${Math.max(pct(q.e+q.slack)-pct(q.e),.5)}%" title="${esc(tf("rm_slack_tip",{n:q.slack,d:fd(q.e+q.slack)}))}"></span>`;
      // A pending activity of 0 days has no width: it is drawn as a marker on its date.
      const bar=(x,q,cls,lab)=>{const left=pct(q.s),w=a.cont?100-left:Math.max(pct(q.e)-left,.5);const zero=!a.cont&&!x.done&&q.s===q.e;return`<span class="gbar ${a.cont?"cont":statOf(x,q)}${zero?" zero":""}${q.crit?" crit":""}${(x.nodes?x.moved>0:x.end&&!x.done)?" moved":""}${cls}" style="left:${left}%;width:${w}%" title="${esc(a.num+" · "+a.name+" · "+lab+tipOf(x,q)+why(x))}"></span>${slack(x,q,cls)}`};
      // The baseline sits as a thin bar under the current one, so the gap shows without reading dates.
      const bline=(n,cls)=>{const b=baseOf(base,n,s0);return b?`<span class="gbl${cls}" style="left:${pct(b.s)}%;width:${Math.max(pct(b.e)-pct(b.s),.5)}%" title="${esc(T.rm_base_bar+": "+short(b.s)+" → "+short(b.e))}"></span>`:""};
      const two=multi&&view==="all"&&!a.joint&&a.nodes.length>1;const marks=two?a.nodes.map((n,k)=>bline(n," t"+k)+bar(n,raw[n.id]," t"+k,PLAT_LABEL[n.track]+" · ")).join(""):(a.nodes.length===1?bline(a.nodes[0],""):"")+bar(a,r[a.id],"","");
      // The milestone of this activity, at the end of its bar.
      const msMark=!a.ms?"":two?a.nodes.map((n,k)=>dia(a,{n,q:raw[n.id],done:!!n.done},k?" down":" up",msLab(a,{n}))).join(""):dia(a,{n:a,q:r[a.id],done:!!a.done},"",a.ms.name);
      rows+=`<div class="grow" data-act="${esc(a.id)}"><div class="gl" data-openact="${esc(a.id)}" role="button" tabindex="0" title="${esc(a.name+(a.steps.length?" · "+a.steps.filter(id=>byId[id]&&inScope(byId[id].plat)&&(view!=="ios"&&view!=="android"||byId[id].plat==="both"||byId[id].plat===view)).join(", "):""))}"><b>${esc(a.num)}</b>${esc(a.name)}${a.ms?`<small class="msn">◆ ${esc(a.ms.name)}</small>`:""}</div><div class="gt">${ticks}${marks}${msMark}${todayLine}</div></div>`})});
  const li=(arr,fn)=>arr.length?`<ul>${arr.map(fn).join("")}</ul>`:`<p class="plain">${T.rm_none}</p>`;
  const done=work.filter(a=>a.done).sort((x,y)=>r[x.id].e-r[y.id].e);
  const soon=work.filter(a=>!a.done&&status(a)!=="late"&&r[a.id].s<=today+30).sort((x,y)=>r[x.id].s-r[y.id].s);
  const late=work.filter(a=>status(a)==="late");const moved=work.filter(a=>a.moved>0&&!a.done);
  // Executive summary: overall status, next milestone, publication and open blockers.
  const blocked=work.filter(a=>!a.done&&Object.entries(a.plats).some(([p,q])=>q.blocked&&(!view||view==="all"||p===view)&&targets().includes(p)));
  const nextPts=mls.flatMap(({a,pts})=>pts.filter(p=>!p.done).map(p=>({a,p}))).sort((x,y)=>x.p.q.e-y.p.q.e);const nx=nextPts[0];
  // Deviation: the largest gap between the current and the committed date among pending milestones.
  const devs=nextPts.map(x=>({...x,cm:committed(x.p)})).filter(x=>x.cm!==null).map(x=>({...x,dv:x.p.q.e-x.cm}));const dev=devs.sort((x,y)=>y.dv-x.dv)[0];
  const stCode=late.length?"late":moved.length||blocked.length||(dev&&dev.dv>0)?"risk":"ok";
  // The most frequent reason among postponed activities, so the summary says why they moved.
  const rc={};moved.forEach(a=>[...new Set(a.reasons.map(x=>x.type))].forEach(k=>{rc[k]=(rc[k]||0)+1}));const topWhy=Object.keys(rc).sort((x,y)=>rc[y]-rc[x])[0];
  const why=stCode==="late"?tf("rm_status_why_late",{n:late.length}):moved.length||blocked.length?tf("rm_status_why_risk",{m:moved.length,b:blocked.length})+(topWhy?" "+tf("rm_status_cause",{c:T["reason_"+topWhy]}):""):dev&&dev.dv>0?tf("rm_status_why_dev",{n:dev.dv}):T.rm_status_why_ok;
  const pub=list.find(a=>a.id==="release");
  const summary=`<div class="rmsum"><div class="st-${stCode}"><small>${T.rm_status}</small><b>${T["rm_status_"+stCode]}</b><span>${why}</span></div>
    <div><small>${T.rm_next_ms}</small><b>${nx?esc(msLab(nx.a,nx.p)):T.rm_next_ms_none}</b>${nx?`<span>${tf("rm_next_ms_in",{d:fd(nx.p.q.e),n:Math.max(0,nx.p.q.e-today)})}</span>`:""}</div>
    <div><small>${T.rm_publish}</small><b>${pub?fd(r[pub.id].e):fd(end)}</b><span>${tf("rm_left",{n:Math.max(0,(pub?r[pub.id].e:end)-today)})}</span></div>
    <div><small>${T.rm_dev}</small>${dev?`<b>${dev.dv>0?tf("rm_dev_late",{n:dev.dv}):dev.dv<0?tf("rm_dev_ahead",{n:-dev.dv}):T.rm_dev_ok}</b><span>${dev.dv?tf("rm_dev_of",{a:esc(msLab(dev.a,dev.p))}):""}</span>`:`<b>${T.rm_dev_none}</b><span>${T.rm_dev_none_hint}</span>`}</div>
    <div><small>${T.rm_blocks}</small><b>${blocked.length}</b><span>${[...new Set(blocked.flatMap(a=>Object.values(a.plats).map(q=>q.blocked).filter(Boolean)).map(x=>x.split(/[:(]/)[0].trim()))].slice(0,3).map(esc).join("<br>")}</span></div></div>`;
  const pctDone=work.length?Math.round(cnt.done/work.length*100):0;const left=Math.max(0,end-today);
  // Open decisions from instance.json, with what they hold back.
  const numOf=k=>{const a=list.find(x=>x.id===k);return a?a.num:k};
  const decs=((c&&c.open)||[]).filter(x=>!x.platform||!view||view==="all"||x.platform===view).sort((x,y)=>x.due.localeCompare(y.due));
  const overdue=decs.filter(x=>dayOf(s0,x.due)<today).length;
  const decBox=fold("rmDecs",tf("rm_fold_decs",{n:decs.length})+(overdue?" · "+tf("rm_fold_overdue",{n:overdue}):""),`${decs.length?`<div class="rmtabw"><table class="rmtab"><thead><tr><th>${T.rm_dec_h_id}</th><th>${T.rm_dec_h_owner}</th><th>${T.rm_dec_h_due}</th><th>${T.rm_dec_h_open}</th><th>${T.rm_dec_h_blocks}</th></tr></thead><tbody>${decs.map(x=>{const due=dayOf(s0,x.due);const op=today-dayOf(s0,x.opened);
    return`<tr><td><b>${esc(x.id)}</b> ${esc(x.name)}${x.status?`<small>${esc(x.status)}</small>`:""}</td><td>${esc(x.owner)}</td><td class="${due<today?"over":""}">${fd(due)}<small>${due<today?tf("rm_dec_overdue",{n:today-due}):tf("rm_dec_left",{n:due-today})}</small></td><td>${tf("rm_dec_days",{n:Math.max(0,op)})}</td><td>${(x.blocks||[]).map(numOf).map(esc).join(", ")}${x.platform?`<small>${PLAT_LABEL[x.platform]}</small>`:""}</td></tr>`}).join("")}</tbody></table></div>`:`<p class="plain">${T.rm_dec_none}</p>`}`);
  // Open risks from instance.json: high first, with what they affect and how they are mitigated.
  const risks=((c&&c.risks)||[]).filter(x=>(x.status||"open")==="open"&&(!x.platform||!view||view==="all"||x.platform===view)).sort((x,y)=>(x.severity!=="high")-(y.severity!=="high"));
  const nHigh=risks.filter(x=>x.severity==="high").length;
  const riskBox=risks.length?fold("rmRisks",tf("rm_fold_risks",{n:risks.length})+(nHigh?" · "+tf("rm_fold_high",{n:nHigh}):""),`<div class="rmtabw"><table class="rmtab"><thead><tr><th>${T.rm_risk_h_name}</th><th>${T.rm_risk_h_sev}</th><th>${T.rm_risk_h_affects}</th><th>${T.rm_risk_h_mit}</th><th>${T.rm_risk_h_owner}</th></tr></thead><tbody>${risks.map(x=>`<tr><td><b>${esc(x.id)}</b> ${esc(x.name)}</td><td><span class="tst risk-${x.severity}">${T["risk_"+x.severity]}</span></td><td>${(x.affects||[]).map(numOf).map(esc).join(", ")}${x.platform?`<small>${PLAT_LABEL[x.platform]}</small>`:""}</td><td>${esc(x.mitigation)}</td><td>${esc(x.owner)}</td></tr>`).join("")}</tbody></table></div>`):"";
  // For the committee: one line per open decision and per high risk; the full tables live in the detail section.
  const highs=risks.filter(x=>x.severity==="high");
  const fLine=(go,id,body)=>`<li><button class="plink" type="button" data-gofocus="${go}"><b>${esc(id)}</b></button> ${body}</li>`;
  const fDec=decs.map(x=>{const due=dayOf(s0,x.due);return fLine("rmDecs",x.id,`${esc(x.name)} <small>· ${esc(x.owner)} · <span class="${due<today?"over":""}">${due<today?tf("rm_dec_overdue",{n:today-due}):tf("rm_focus_due",{d:short(due)})}</span></small>`)}).join("");
  const fRisk=highs.map(x=>fLine("rmRisks",x.id,`${esc(x.name)} <small>· ${esc(x.owner)}</small>`)).join("");
  const focusBox=fDec||fRisk?`<div class="rmsec rmfocus"><h3>${T.rm_focus_h}</h3>${fDec?`<h4>${T.rm_focus_decide}</h4><ul>${fDec}</ul>`:""}${fRisk?`<h4>${T.rm_focus_watch}</h4><ul>${fRisk}</ul>`:""}</div>`:"";
  // By area: what each lane has open now, in the next two weeks, late and blocked.
  const areas=[...new Set(work.map(a=>a.lane))].map(l=>{const acts=work.filter(a=>a.lane===l&&!a.done);const ids=f=>acts.filter(f).map(a=>esc(a.num)).join(", ");
    return{l,now:ids(a=>r[a.id].s<=today&&r[a.id].e>=today),next:ids(a=>r[a.id].s>today&&r[a.id].s<=today+14),late:ids(a=>status(a)==="late"),blk:ids(a=>blocked.includes(a))}}).filter(x=>x.now||x.next||x.late||x.blk);
  const areaBox=`<div class="rmsec"><h3>${T.rm_area_h}</h3>${areas.length?`<div class="rmtabw"><table class="rmtab"><thead><tr><th></th><th>${T.rm_area_h_now}</th><th>${T.rm_area_h_next}</th><th>${T.rm_late}</th><th>${T.rm_blocked}</th></tr></thead><tbody>${areas.map(x=>`<tr><td><b>${esc(laneLabel(x.l))}</b></td><td>${x.now||"—"}</td><td>${x.next||"—"}</td><td class="${x.late?"over":""}">${x.late||"—"}</td><td>${x.blk||"—"}</td></tr>`).join("")}</tbody></table></div>`:`<p class="plain">${T.rm_area_none}</p>`}</div>`;
  const isoOf=n=>{const d=new Date(s0+"T00:00:00");d.setDate(d.getDate()+n);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
  // The baseline holds the committed start and end of every activity (per platform), so the export can measure each deviation.
  const baseJson=JSON.stringify({baseline:Object.fromEntries(pv.nodes.filter(n=>!n.cont).map(n=>[n.id,{start:isoOf(raw[n.id].s),end:isoOf(raw[n.id].e)}]))},null,2).replace(/^\{\n|\n\}$/g,"");
  let trackBox="",seg="";
  if(multi){const gate=planGate(pv);const gname=gate?list.find(a=>a.id===gate.id):null;
    seg=`<div class="seg" id="rmSeg" role="group" aria-label="${T.rm_view}">${[["all",T.rm_joint],["ios",T.plat_ios],["android",T.plat_android]].map(([k,l])=>`<button type="button" data-track="${k}" aria-pressed="${st.track===k}">${l}</button>`).join("")}</div>`;
    if(view==="all"){const trows=targets().map(p=>{const v=planView(src,s0,p);const w=v.list.filter(a=>!a.cont);const dn=w.filter(a=>a.done).length;const pc=w.length?Math.round(dn/w.length*100):0;
        const open=w.filter(a=>!a.done).sort((x,y)=>v.r[x.id].s-v.r[y.id].s);const blk=open.find(a=>a.plats[p]&&a.plats[p].blocked);
        return`<div class="trow"><b>${PLAT_LABEL[p]}</b><div class="rmprog"><span style="width:${pc}%"></span></div><span>${pc}% · ${tf("rm_of",{a:dn,b:w.length})}</span><span class="${blk?"tblk":""}">${blk?`${T.rm_blocked}: ${esc(blk.num)} · ${esc(blk.plats[p].blocked)}`:T.rm_no_block}</span><span>${open[0]?`${T.rm_next}: ${esc(open[0].num)} · ${esc(open[0].name)}`:""}</span>${gate?`<span>${tf("rm_ready",{a:esc(gname.num),d:fd(gate.ready[p])})}</span>`:""}</div>`}).join("");
      let gap="";if(gate){const[a,b]=targets().map(p=>gate.ready[p]);const n=Math.abs(a-b);const[p,q]=a<b?targets():[...targets()].reverse();gap=n?tf("rm_gap",{a:esc(gname.num+" · "+gname.name),p:PLAT_LABEL[p],q:PLAT_LABEL[q],n}):tf("rm_gap_none",{a:esc(gname.num+" · "+gname.name)})}
      trackBox=`<div class="rmtrack"><h3>${T.rm_track_h}</h3>${trows}${gap?`<p class="plain">${gap}</p>`:""}<p class="plain">${T.rm_joint_note}</p></div>`}}
  const msGantt=mls.length?`<div class="rmsec"><h3>${T.rm_milestones}</h3><div class="gantt msg"><div class="gin"><div class="gaxis"><div></div><div class="gt">${labels}${todayMark}</div><div></div></div>${msRows}</div></div><div class="rmleg"><span><i style="background:var(--warn);transform:rotate(45deg);width:9px;height:9px"></i>${T.rm_leg_ms}</span>${multi&&view==="all"?`<span>${T.rm_leg_ms_pl}</span>`:""}<span>${T.rm_leg_ms_open}</span><span><i style="border-left:2px dotted var(--muted);width:0;height:12px"></i>${T.rm_base_mark}</span></div></div>`:"";
  el.innerHTML=`<div class="rmhead"><div><h2>${T.rm_title}${c?" · "+esc(c.name):""}</h2><div class="plain">${tf("rm_sub",{s:fd(0),t:fd(today)})}${PRESET_RAW&&st.client==="preset"?" · "+(planUpdated()?tf("rm_updated",{d:fd(dayOf(s0,planUpdated()))}):T.rm_updated_none):""}</div></div><div><button class="btn" type="button" data-csv="start">${T.csv_export}</button> ${c?`<button class="btn" type="button" id="rmBase" data-json="${esc(baseJson)}">${T.rm_base_copy}</button> `:""}<button class="btn" type="button" id="rmPrint">${T.rm_print}</button></div></div><textarea id="rmBaseTxt" class="rmbase" readonly hidden></textarea>${localBanner()}${seg}${summary}${focusBox}${msGantt}
  <details class="rmdetail"${st.rmOpen?" open":""}><summary>${T.rm_detail}</summary>${trackBox}
  <div class="kpis"><div class="kpi done"><small>${T.rm_done}</small><b>${cnt.done}</b></div><div class="kpi now"><small>${T.rm_now}</small><b>${cnt.now}</b></div><div class="kpi"><small>${T.rm_todo}</small><b>${cnt.todo}</b></div><div class="kpi late"><small>${T.rm_late}</small><b>${cnt.late}</b></div><div class="kpi late"><small>${T.rm_moved}</small><b>${moved.length}</b></div><div class="kpi"><small>${T.rm_end}</small><b>${fd(end)}</b><span>${tf("rm_left",{n:left})}</span></div></div>
  <div class="plain" style="font-size:.82rem">${T.rm_progress}: ${pctDone}% · ${tf("rm_of",{a:cnt.done,b:work.length})}</div><div class="rmprog"><span style="width:${pctDone}%"></span></div>
  <div class="rmgtools"><button class="btn" type="button" id="rmSlack" aria-pressed="${!!st.rmSlack}">${st.rmSlack?T.rm_slack_hide:T.rm_slack_show}</button></div>
  <div class="gantt"><div class="gin"><div class="gaxis"><div></div><div class="gt">${labels}${todayMark}</div></div>${rows}</div></div>
  <div class="rmleg"><span><i style="background:var(--ok)"></i>${T.rm_leg_done}</span><span><i style="background:var(--accent)"></i>${T.rm_leg_now}</span><span><i style="background:var(--line2)"></i>${T.rm_leg_todo}</span><span><i style="background:var(--bad)"></i>${T.rm_leg_late}</span><span><i style="box-shadow:0 0 0 2px var(--warn);background:var(--line2)"></i>${T.rm_leg_crit}</span><span><i style="outline:2px dashed var(--bad);background:var(--line2)"></i>${T.rm_leg_moved}</span>${Object.keys(base).length?`<span><i class="gbl" style="position:static;display:inline-block;width:14px"></i>${T.rm_base_bar}</span>`:""}${st.rmSlack?`<span><i class="gslack" style="position:static;display:inline-block;width:14px;height:10px"></i>${T.rm_leg_slack}</span>`:""}${multi&&view==="all"?`<span>${T.rm_leg_two}</span>`:""}</div>
  ${decBox}${riskBox}${areaBox}
  <div class="rmcols"><div><h3>${T.rm_list_ms}</h3>${li(nextPts.slice(0,5),({a,p})=>`<li><b>◆</b> ${esc(msLab(a,p))} <small>${fd(p.q.e)} · ${T["rm_ms_"+a.ms.type]}</small></li>`)}</div><div><h3>${T.rm_list_done}</h3>${li(done,a=>`<li><b>${esc(a.num)}</b> ${esc(a.name)} <small>${tf("rm_done_on",{d:fd(r[a.id].e)})}</small></li>`)}</div>
  <div><h3>${T.rm_list_now}</h3>${li(soon,a=>`<li><b>${esc(a.num)}</b> ${esc(a.name)} <small>${tf("rm_until",{a:fd(r[a.id].s),b:fd(r[a.id].e)})}</small></li>`)}</div>
  <div><h3>${T.rm_list_late}</h3>${li(late,a=>`<li><b>${esc(a.num)}</b> ${esc(a.name)} <small>${tf("rm_until",{a:fd(r[a.id].s),b:fd(r[a.id].e)})}</small></li>`)}</div>
  <div><h3>${T.rm_list_moved}</h3>${li(moved,a=>`<li><b>${esc(a.num)}</b> ${esc(a.name)} <small>${tf("tl_moved",{n:a.moved})} · ${fd(r[a.id].e)}${a.reasons.length?" · "+esc(reasonTxt(a.reasons)):""}</small></li>`)}</div></div>${logBox(fd,s0)}</details>`;
}

// ---------- Track a version (milestones)
const msOf=()=>MS.map(m=>[m[0],m[1],m[2],m[3],m[4].filter(c=>inScope(byId[c[2]].plat))]).filter(m=>m[4].length);
const verData=()=>st.client&&st.version&&versions[st.client]&&versions[st.client][st.version]||null;
function msState(m,v){const checks=m[4];const done=checks.filter(c=>v&&v.checks&&v.checks[c[0]]).length;const manual=v&&v.status&&v.status[m[0]];
  if(manual==="blk")return["blocked",done];if(done===checks.length)return["done",done];if(done>0||manual==="in_progress")return["in_progress",done];return["pending",done]}
function renderVer(){
  const c=cur();const MSV=msOf();
  if(!c){verbar.innerHTML=`<span>${T.ver_need_client}</span><button class="btn primary" id="goInst" type="button">${T.ver_create_client}</button>`;ms.innerHTML="";return}
  const vs=versions[st.client]||{};const ids=Object.keys(vs).sort((a,b)=>(vs[b].createdAt||"").localeCompare(vs[a].createdAt||""));
  if(!st.version&&ids.length)st.version=ids[0];
  const v=verData();
  const total=MSV.reduce((a,m)=>a+m[4].length,0),done=MSV.reduce((a,m)=>a+msState(m,v)[1],0);
  const msDone=MSV.filter(m=>msState(m,v)[0]==="done").length,blk=MSV.filter(m=>msState(m,v)[0]==="blocked");
  verbar.innerHTML=`<b>${esc(c.name)}</b><select id="verSel" aria-label="${T.ver_aria}">${ids.map(i=>`<option value="${i}" ${i===st.version?"selected":""}>${esc(vs[i].name)}</option>`).join("")}${ids.length?"":`<option value="">${T.ver_none}</option>`}</select><button class="btn" id="newVer" type="button">${T.ver_new}</button><span id="newVerBox" hidden><input type="text" id="newVerName" placeholder="${T.ver_name_placeholder}" style="max-width:160px"> <button class="btn primary" id="createVer" type="button">${T.create}</button></span>${v?`<span>${tf("ver_progress",{md:msDone,mt:MSV.length,cd:done,ct:total})}</span><div class="bar"><span style="width:${done/total*100}%;background:var(--ok)"></span></div>${blk.length?`<span style="color:var(--warn);font-weight:600">${blk.length>1?tf("ver_blocked_many",{n:blk.length}):T.ver_blocked_one}</span>`:""}`:`<span class="plain">${T.ver_first}</span>`}`;
  if(!v){ms.innerHTML="";return}
  ms.innerHTML=MSV.map((m,i)=>{const[stt,dn]=msState(m,v);
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
    ${Object.entries(V).filter(([k,d])=>inScope(d[2])).map(([k,d])=>`<div class="frow"><div class="k">${esc(d[0])}<small>${k}</small></div><select data-var="${k}" ${canWrite?"":"disabled"}><option value="">${T.inst_unset}</option>${d[1].map(o=>`<option value="${o[0]}" ${vars[k]===o[0]?"selected":""}>${esc(o)}</option>`).join("")}</select></div>`).join("")}
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
  const c=cur();const ren=c?(c.ren||{}):(LS("mapm-ren")||{});const list=REN.filter(r=>!r[7]||inScope(byId[r[7]].plat));
  const today=new Date();today.setHours(0,0,0,0);const groups=[...new Set(list.map(r=>r[2]))];let h="",late=0,soon=0,ok=0;
  groups.forEach(g=>{h+=`<div class="rengrp"><h3>${esc(g)}</h3>`;
    list.filter(r=>r[2]===g).forEach(([id,nm,_,cyc,ant,eff,who,step])=>{const d=ren[id];let cls="na",txt=T.ren_nodate,due="";
      if(d){const base=new Date(d+"T00:00:00");let next=base;if(cyc){next=new Date(base);next.setMonth(next.getMonth()+cyc);while(next<today)next.setMonth(next.getMonth()+cyc)}
        const days=Math.round((next-today)/DAY);if(cyc){if(days<0){cls="late";txt=tf("ren_overdue",{n:-days});late++}else if(days<=ant){cls="soon";txt=tf("ren_due_in",{n:days});soon++}else{cls="ok";txt=tf("ren_due_in",{n:days});ok++}}else{cls="ok";txt=tf("ren_reviewed",{d});ok++}due=next.toISOString().slice(0,10)}
      h+=`<div class="ren"><div class="nm">${esc(nm)}<small>${eff?esc(eff)+". ":""}${who?esc(T.ren_renewed_by)+esc(who):""}${step?` · <button class="chip" data-go="step:${step}" style="padding:0 6px;font-size:.74rem">${step}</button>`:""}</small></div><div class="cyc">${cyc?`${tf("ren_every",{n:cyc})}${ant?tf("ren_warn",{n:ant}):""}`:T.ren_event}${due&&cyc?tf("ren_next",{d:due}):""}</div><label class="plain" style="font-size:.78rem">${cyc?T.ren_last_issue:T.ren_last_change} <input type="date" data-ren="${id}" value="${d||""}" ${c&&!canWrite?"disabled":""}></label><span class="due ${cls}">${txt}</span></div>`});
    h+=`</div>`});
  renlist.innerHTML=h;rensum.innerHTML=`<span><b style="color:var(--bad)">${late}</b>${T.ren_sum_overdue}</span><span><b style="color:var(--warn)">${soon}</b>${T.ren_sum_soon}</span><span><b style="color:var(--ok)">${ok}</b>${T.ren_sum_ok}</span><span><b>${list.length-late-soon-ok}</b>${T.ren_sum_nodate}</span>${c?"":`<span class="plain">${T.ren_noclient}</span>`}`;
}
async function setRen(id,val){const c=cur();if(c){const ren={...(c.ren||{})};if(val)ren[id]=val;else delete ren[id];await putClient(st.client,{...c,ren})}else{const r=LS("mapm-ren")||{};if(val)r[id]=val;else delete r[id];LSW("mapm-ren",r)}renderRen()}

// ---------- Explore the model
function visible(s){
  if(!inScope(s.plat))return false;
  if(st.act&&!actRail(st.act).includes(s.id))return false;
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
function stepChips(all,cls){const ids=all.filter(i=>inScope(byId[i].plat));return ids.length?ids.map(i=>`<button class="chip ${cls}" data-go="step:${i}">${esc(byId[i].name)}<small>${i}</small></button>`).join(""):`<span class="none">${T.step_none}</span>`}
function renderStep(){
  const s=byId[st.sel];if(!s)return;const r=rev[s.id]||{};const i=order.indexOf(s.id);const ph=PH.find(p=>p[0]===s.ph);const roles=roleIds(s);
  const inPh=S.filter(x=>x.ph===s.ph);const posIn=inPh.indexOf(s)+1;const stage=STAGES.find(g=>g[1].includes(s.ph));
  // Opened from an activity: the essentials first, the rest under "Más detalle", and prev/next within the activity.
  const inAct=st.act&&actSteps(st.act).includes(s.id);let seq=inAct?actStepsIn(st.act):null;if(seq&&!seq.includes(s.id))seq=actSteps(st.act);const k=seq?seq.indexOf(s.id):-1;
  const who=`<dt>${T.step_who}</dt><dd>${roles.map(a=>`<button class="rolechip" data-go="A:${a}"><b>${esc(A[a])}</b><span>${esc(laneLabel(laneOfRole[a]))} · ${a}</span></button>`).join("")}<div class="plain" style="margin-top:4px">${esc(s.resp)}</div></dd>`;
  const tech=`<dt>${T.step_with}</dt><dd>${linkify(s.inp)}</dd><dt>${T.step_produces}</dt><dd>${linkify(s.out)}</dd>
    ${s.vars.length?`<dt>${T.step_depends}</dt><dd>${s.vars.map(v=>{const ch=variantOf(v);const opt=ch?V[v][1].find(o=>o.startsWith(ch+")")):"";return `<button class="chip var" data-go="V:${v}"><b>${v}</b>${esc(V[v][0])}${opt?` <small>${esc(opt)}</small>`:""}</button>`}).join("")}<div class="plain" style="margin-top:2px">${cur()?T.step_variant_chosen:T.step_variant_each}</div></dd>`:""}`;
  const flow=`<div class="flow3"><div class="col"><h4>${T.step_before}</h4>${stepChips(s.deps,"need")}</div><div class="mid arrow">→</div><div class="col"><h4>${T.step_after}</h4>${stepChips(s.enables,"enab")}</div></div>
  ${s.note?`<div class="note">${linkify(s.note)}</div>`:""}`;
  const review=`<div class="box"><h3>${T.rev_title}</h3><p class="plain">${T.rev_hint}</p><div class="revbtns"><button class="btn clear" data-rev="clear" aria-pressed="${r.s==="clear"}">${T.rev_clear}</button><button class="btn doubt" data-rev="doubt" aria-pressed="${r.s==="doubt"}">${T.rev_doubt}</button>${r.s?`<button class="btn" data-rev="">${T.rev_remove}</button>`:""}</div>
    <label for="note-${s.id.replace(".","-")}" class="plain" style="display:block;margin-top:10px">${T.note_label}</label><textarea id="note-${s.id.replace(".","-")}" data-note>${esc(r.n||"")}</textarea></div>`;
  const title=`<h2><span class="mono">${s.id} · <span class="pl ${s.plat}">${PLAT_LABEL[s.plat]}</span></span>${esc(s.name)}</h2>`;
  if(seq){const n=ACT.findIndex(x=>x[0]===st.act)+1;const p=seq[k-1],q=seq[k+1];
    detail.innerHTML=`<div class="actbar"><button class="chip" type="button" data-actback>← ${T.act_back}</button><span>${esc(tf("act_filter",{n}))} · ${tf("step_pos",{i:k+1,n:seq.length})}</span></div>
  ${title}<dl class="kv">${who}</dl>${flow}<details class="more"><summary>${T.step_more}</summary><dl class="kv">${tech}</dl>${review}</details>
  <div class="nav"><button class="btn" data-actnav="${p||""}" ${p?"":"disabled"} title="${p?esc(byId[p].name):""}">${T.nav_prev}${p?` <span class="mono">${p}</span>`:""}</button><button class="btn" data-actnav="${q||""}" ${q?"":"disabled"} title="${q?esc(byId[q].name):""}">${T.nav_next}${q?` <span class="mono">${q}</span>`:""} →</button></div>`;return}
  detail.innerHTML=`<div class="crumbline"><span>${esc(FREQ[ph[2]])}</span><span class="sep">›</span><span>${stage?esc(stage[0]):""}</span><span class="sep">›</span><span>${esc(ph[1])}</span><span class="pos">${tf("step_pos",{i:posIn,n:inPh.length})}</span></div>
  ${title}<dl class="kv">${who}${tech}</dl>${flow}${review}
  <div class="nav"><button class="btn" data-nav="-1" ${i===0?"disabled":""} title="${i>0?esc(byId[order[i-1]].name):""}">${T.nav_prev}${i>0?` <span class="mono">${order[i-1]}</span>`:""}</button><button class="btn" data-nav="1" ${i===order.length-1?"disabled":""} title="${i<order.length-1?esc(byId[order[i+1]].name):""}">${T.nav_next}${i<order.length-1?` <span class="mono">${order[i+1]}</span>`:""} →</button></div>`;
}
// ---------- Activity sheet: the steps of one activity, as a short task list
const actPlats=key=>{const a=ACT.find(x=>x[0]===key);const p=a?a[7]:(extraAct(key)||{}).platform||"both";return p==="both"?targets():[p]};
const actStepsIn=key=>actSteps(key).filter(id=>!st.actPlat||byId[id].plat==="both"||byId[id].plat===st.actPlat);
function openAct(key){st.act=key;st.actPlat="";st.view=["ACT",key];st.lane="";st.phases=[];laneSel.value="";actRail(key).forEach(id=>openPh.add(byId[id].ph));setTab("dt");render();window.scrollTo({top:0})}
function renderActSheet(key){
  // Every activity opens here: model activities with their steps, client activities with their tasks and related steps.
  // Both show dates and status per platform, blockers and the open decisions that hold them back.
  const src=planSrc();const v=planView(src,src.start);const a=v.list.find(x=>x.id===key)||planActs(src).find(x=>x.id===key);if(!a)return;
  const ps=actPlats(key);const mine=new Set(actSteps(key));const ids=actStepsIn(key);const x=extraAct(key);
  const today=src.start?dayOf(src.start,todayISO()):null;
  const fd=n=>{if(!src.start)return tf("tl_day_n",{n});const d=new Date(src.start+"T00:00:00");d.setDate(d.getDate()+n);return d.toLocaleDateString(T.lang,{day:"numeric",month:"short",year:"numeric"})};
  const stat=(n,q)=>n.done?"done":today===null?"todo":q.late?"late":q.s<=today?"now":"todo";
  const nodes=(a.nodes||[a]).filter(n=>!st.actPlat||!n.track||n.track===st.actPlat);
  const when=nodes.map(n=>{const q=v.raw?v.raw[n.id]:v.r[a.id];if(!q)return"";const c=stat(n,q);
    return`<span class="tst ${c}">${n.track&&nodes.length>1?PLAT_LABEL[n.track]+": ":""}${T["tl_st_"+c]}</span> <span>${a.cont?tf("tl_continuous",{d:fd(q.s)}):n.done?fd(q.e):`${fd(q.s)} → ${fd(q.e)}`}</span>`}).filter(Boolean).join("<br>");
  const blk=Object.entries(a.plats||{}).filter(([p,q])=>q.blocked&&!a.done&&(!st.actPlat||p===st.actPlat)).map(([p,q])=>`<span>${PLAT_LABEL[p]}: ${esc(q.blocked)}</span>`).join("");
  const c=cur();const decs=((c&&c.open)||[]).filter(d=>(d.blocks||[]).includes(key)||d.id===key);
  const dec=decs.map(d=>`<span><b>${esc(d.id)}</b> ${esc(d.name)} · ${esc(d.owner)} · ${T.rm_dec_h_due.toLowerCase()} ${fd(dayOf(src.start,d.due))}${d.status?` <small>${esc(d.status)}</small>`:""}</span>`).join("");
  const rks=((c&&c.risks)||[]).filter(r=>(r.status||"open")==="open"&&(r.affects||[]).includes(key)&&(!st.actPlat||!r.platform||r.platform===st.actPlat));
  const rk=rks.map(r=>`<span><span class="tst risk-${r.severity}">${T["risk_"+r.severity]}</span> <b>${esc(r.id)}</b> ${esc(r.name)}${r.platform?` · ${PLAT_LABEL[r.platform]}`:""} · ${esc(r.owner)}<small class="amit">${esc(r.mitigation)}</small></span>`).join("");
  const tabs=ps.length>1?`<div class="seg" role="group" aria-label="${T.rm_view}">${[["",T.act_all],...ps.map(p=>[p,PLAT_LABEL[p]])].map(([k,l])=>`<button type="button" data-actplat="${k}" aria-pressed="${st.actPlat===k}">${l}</button>`).join("")}</div>`:"";
  // Previous steps link to their detail; those of another activity say which one.
  const actNum=sid=>{const k=ACT.findIndex(x=>x[9].includes(sid));return k<0?"":String(k+1)};
  const items=ids.map(id=>{const s=byId[id];const deps=s.deps.filter(d=>byId[d]&&inScope(byId[d].plat));
    const need=deps.length?deps.map(d=>`<span><button class="plink" type="button" data-go="step:${d}">${esc(byId[d].name)}</button>${mine.has(d)?"":` <small>${tf("act_from",{n:actNum(d)})}</small>`}</span>`).join(""):`<span>${T.step_none}</span>`;
    return`<li class="astep"><div class="ahead"><span class="pl ${s.plat}">${PLAT_LABEL[s.plat]}</span><b>${esc(s.name)}</b><span class="mono">${id}</span><button class="btn" type="button" data-go="step:${id}">${T.act_detail} →</button></div>
    <dl class="ameta"><dt>${T.step_who}</dt><dd>${esc(roleIds(s).map(r=>A[r]).join(", "))}</dd><dt>${T.act_needs}</dt><dd class="aneeds">${need}</dd></dl></li>`}).join("");
  const refs=actRefs(key).filter(id=>!st.actPlat||byId[id].plat==="both"||byId[id].plat===st.actPlat);
  const tasks=(x&&x.tasks)||[];
  const info=`<dl class="ameta asum">${when?`<dt>${T.act_when}</dt><dd>${when}</dd>`:""}${blk?`<dt>${T.rm_blocked}</dt><dd class="aneeds ablk">${blk}</dd>`:""}${dec?`<dt>${T.act_decisions}</dt><dd class="aneeds">${dec}</dd>`:""}${rk?`<dt>${T.act_risks}</dt><dd class="aneeds">${rk}</dd>`:""}</dl>`;
  detail.innerHTML=`<div class="crumbline"><span>${esc(tf("act_filter",{n:a.num}))}</span><span class="sep">·</span><span>${esc(laneLabel(a.lane))}</span>${a.extra?`<span class="sep">·</span><span>${T.tl_extra}</span>`:""}<span class="pos">${ids.length?tf("tl_steps",{n:ids.length}):""}</span></div><h2>${esc(a.name)}</h2>${tabs}${info}
  ${tasks.length?`<h3 class="ah3">${T.act_tasks}</h3><ul class="atasks">${tasks.map(k=>`<li>${esc(k)}</li>`).join("")}</ul>`:""}
  ${ids.length?`<h3 class="ah3">${T.act_steps}</h3><ol class="asteps">${items}</ol>`:""}
  ${refs.length?`<h3 class="ah3">${T.act_refs}</h3><ul class="arefs">${refs.map(id=>`<li><button class="plink" type="button" data-go="step:${id}">${esc(byId[id].name)}</button> <span class="mono">${id}</span>${actNum(id)?` <small>${tf("act_from",{n:actNum(id)})}</small>`:""}</li>`).join("")}</ul>`:""}
  ${!ids.length&&!tasks.length&&!refs.length?`<p class="plain">${T.act_empty}</p>`:""}`}
function stepsWith(pred){return S.filter(pred).map(s=>s.id)}
function renderEntity(kind,id){if(kind==="ACT"){renderActSheet(id);return}let title="",body="";
  if(kind==="A"){const resp=stepsWith(s=>roleIds(s).includes(id));title=A[id];body=`<p class="plain">${id} · ${T.ent_area}${esc(laneLabel(laneOfRole[id]))}. ${tf("ent_owner_in",{n:resp.length})}</p><div class="lookup">${stepChips(resp,"")}</div>`}
  else if(kind==="C"||kind==="F"){const d=(kind==="C"?C:F)[id];const prod=stepsWith(s=>new RegExp("\\b"+id+"\\b").test(s.out));const cons=stepsWith(s=>new RegExp("\\b"+id+"\\b").test(s.inp+" "+s.note));title=d[0];body=`<p class="plain">${id} · ${kind==="C"?T.ent_validity:T.ent_format}${esc(d[1])}</p><dl class="kv"><dt>${T.ent_produced_in}</dt><dd>${stepChips(prod,"need")}</dd><dt>${T.ent_consumed_in}</dt><dd>${stepChips(cons,"enab")}</dd></dl>`}
  else if(kind==="V"){const d=V[id];const used=stepsWith(s=>s.vars.includes(id));const ch=variantOf(id);title=d[0];body=`<p class="plain">${id} · ${T.ent_variation}</p><ul class="vopts">${d[1].map(o=>`<li ${ch&&o.startsWith(ch+")")?'style="font-weight:600;color:var(--accent-ink)"':""}>${esc(o)}${ch&&o.startsWith(ch+")")?T.ent_chosen:""}</li>`).join("")}</ul><div class="box"><h3>${T.ent_steps_change}</h3>${stepChips(used,"")}</div>`}
  detail.innerHTML=`<div class="crumb"><button class="chip" data-go="step:${st.sel}"><b>←</b>${T.back_to}${esc(byId[st.sel].name)}</button></div><h2>${esc(title)}</h2>${body}`}
function renderFilterChip(){if(st.act){const i=ACT.findIndex(x=>x[0]===st.act);const x=extraAct(st.act);fchip.innerHTML=`<span class="filterchip">${esc(tf("act_filter",{n:i<0?st.act:i+1}))} · ${esc(i<0?(x?x.name:""):ACT[i][1])}<button type="button" data-clear aria-label="${T.filter_remove}">✕</button></span>`;return}const ph=st.phases.length===1?`${st.phases[0]} ${PH.find(p=>p[0]===st.phases[0])[1]}`:st.phases.join(", ");fchip.innerHTML=st.phases.length?`<span class="filterchip">${st.lane?esc(laneLabel(st.lane))+" · ":""}${esc(ph)}<button type="button" data-clear aria-label="${T.filter_remove}">✕</button></span>`:""}
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
document.getElementById("roadmap").addEventListener("toggle",e=>{if(!e.target.matches)return;if(e.target.matches(".rmdetail"))st.rmOpen=e.target.open;if(e.target.matches(".rmfold"))st.rmFold[e.target.id]=e.target.open},true);
document.getElementById("roadmap").addEventListener("click",e=>{if(onCsv(e))return;onLocal(e);if(e.target.id==="rmSlack"){st.rmSlack=!st.rmSlack;LSW("mapm-rmslack",st.rmSlack);renderRoadmap();return}if(e.target.id==="rmPrint"){setTab("rm");const dt=document.querySelector(".rmdetail");if(dt)dt.open=true;window.print()}
  if(e.target.id==="rmBase"){const txt=e.target.dataset.json;const show=()=>{const ta=document.getElementById("rmBaseTxt");ta.hidden=false;ta.value=txt;ta.select()};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(()=>toast(T.rm_base_copied),show);else show()}const b=e.target.closest("[data-track]");if(b){st.track=b.dataset.track;renderRoadmap()}
  // A milestone leads to its activity in the schedule, on the same tab; the schedule row opens the steps.
  const gf=e.target.closest("[data-gofocus]");if(gf){st.rmOpen=true;st.rmFold[gf.dataset.gofocus]=true;renderRoadmap();const box=document.getElementById(gf.dataset.gofocus);if(box)box.scrollIntoView({behavior:"smooth",block:"start"});return}
  const gm=e.target.closest("[data-gomsact]");if(gm){st.rmOpen=true;renderRoadmap();const row=document.querySelector(`.rmdetail .grow[data-act="${CSS.escape(gm.dataset.gomsact)}"]`);
    if(row){row.scrollIntoView({block:"center",behavior:"smooth"});row.classList.add("flash");setTimeout(()=>row.classList.remove("flash"),2400)}return}
  const o=e.target.closest("[data-openact]");if(o)openAct(o.dataset.openact)});
document.getElementById("timeline").addEventListener("toggle",e=>{const d=e.target;if(d.matches&&d.matches(".pstage")&&st.tlFilter==="all")st.tlStage[d.dataset.stage]=d.open},true);
document.getElementById("timeline").addEventListener("click",e=>{if(onCsv(e))return;onLocal(e);if(e.target.id==="tlReset")resetPlan();
  const ed=e.target.closest("[data-tledit]");if(ed){st.tlEdit=st.tlEdit===ed.dataset.tledit?"":ed.dataset.tledit;renderTimeline();return}
  const fl=e.target.closest("[data-tlf]");if(fl){st.tlFilter=fl.dataset.tlf;renderTimeline();return}const o=e.target.closest("[data-openact]");if(o)openAct(o.dataset.openact)});
renlist.addEventListener("click",e=>{const g=e.target.closest("[data-go]");if(!g)return;const[k,id]=g.dataset.go.split(":");go(id,true)});
rail.addEventListener("click",e=>{const li=e.target.closest(".step");if(li)go(li.dataset.id,false)});
rail.addEventListener("keydown",e=>{const li=e.target.closest(".step");if(li&&(e.key==="Enter"||e.key===" ")){e.preventDefault();go(li.dataset.id,false)}});
rail.addEventListener("toggle",e=>{const d=e.target;if(d.matches&&d.matches("details.phase")){d.open?openPh.add(d.dataset.ph):openPh.delete(d.dataset.ph)}},true);
detail.addEventListener("click",e=>{
  const ap=e.target.closest("[data-actplat]");if(ap){st.actPlat=ap.dataset.actplat;render();return}
  if(e.target.closest("[data-actback]")){st.view=["ACT",st.act];render();window.scrollTo({top:0});return}
  const an=e.target.closest("[data-actnav]");if(an&&an.dataset.actnav){go(an.dataset.actnav,false);return}
  const g=e.target.closest("[data-go]");if(g){const[k,id]=g.dataset.go.split(":");if(k==="step")go(id,true);else{st.view=[k,id];render()}return}
  const r=e.target.closest("[data-rev]");if(r){const c=rev[st.sel]||{};const v=r.dataset.rev;rev[st.sel]={...c,s:v||undefined};if(!v&&!c.n)delete rev[st.sel];save();render();return}
  const n=e.target.closest("[data-nav]");if(n){let i=order.indexOf(st.sel);do{i+=Number(n.dataset.nav)}while(order[i]&&!inScope(byId[order[i]].plat));if(order[i])go(order[i],true)}});
detail.addEventListener("input",e=>{if(e.target.matches("[data-note]")){const c=rev[st.sel]||{};rev[st.sel]={...c,n:e.target.value};save()}});
platSeg.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;st.plat=b.dataset.p;platSeg.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));render()});
Object.entries(A).forEach(([k,v])=>{const o=document.createElement("option");o.value=k;o.textContent=`${k} · ${v}`;roleSel.appendChild(o)});
LANES.forEach(([k,v])=>{const o=document.createElement("option");o.value=k;o.textContent=`${k} · ${v}`;laneSel.appendChild(o)});
roleSel.addEventListener("change",()=>{st.role=roleSel.value;render()});
laneSel.addEventListener("change",()=>{st.lane=laneSel.value;render()});
fchip.addEventListener("click",e=>{if(e.target.closest("[data-clear]")){st.phases=[];st.lane="";st.act="";st.actPlat="";laneSel.value="";render()}});
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
