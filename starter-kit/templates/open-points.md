# Points to validate with <other party>

<N> assumptions about <other party>'s work that <client> needs to confirm. Status: `Open` · `Confirmed` · `Corrected` (write the answer in the last column). Last update: <YYYY-MM-DD>.

## <Topic 1>

| # | Topic | What we assume | What they must confirm | Session / question | Status | Answer |
| --- | --- | --- | --- | --- | --- | --- |
| O1 | <topic> | <assumption> | <what to confirm> | S1 · 3 | Open | |
| O2 | <topic> | <assumption> | <what to confirm> | S1 · 4 | Open | |

## <Topic 2>

| # | Topic | What we assume | What they must confirm | Session / question | Status | Answer |
| --- | --- | --- | --- | --- | --- | --- |
| O3 | <topic> | <assumption> | <what to confirm> | S2 · 1 | Open | |

## When a point closes

- If it confirms an assumption: status `Confirmed`. If it closes a variant, update `instance.json` (`variants`, and remove the entry from `open_variants`).
- If it corrects an assumption: status `Corrected`, the answer in the last column, and a new decision in `instance.json` with date and owner.
- Rebuild: `python3 generator/build.py --no-png`, and update the tables in the client README.
