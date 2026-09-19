# bug-mon-MA-0510 — Colossus Legendary Smite: header-swallowed row, zero affordance, delegate gap

**Verdict:** FAIL (DATA) — MA-0510, `colossus`, legendary_actions[0], "Smite", uses:1.

## Row
`public/data/monsters.json` colossus.legendary_actions[0]:
`{"name":"Smite","description":"The colossus makes one Radiant Ray attack.","uses":1}` — **no `delegates_to`**, no numeric fields.

## Defects
1. **Header swallow:** canonical shape (Aboleth, MA-0021/0022) authors `legendary_actions[0]` as header `{name:"Legendary Action Uses: N…", uses:N}`; children carry `delegates_to:"<Weapon>"`. `legendaryHeaderAction()` (monsterLegendaryUses.js:153) returns rows[0] when `uses!=null` → **Smite becomes the header**; `MonsterCardBody.jsx:55` renders `slice(1)` → **Smite chip never renders**. Live card shows "Smite (0/1 left)" header text; only Stomp has `.mc-dice-link-legendary`.
2. **Missing delegate:** no `delegates_to:"Radiant Ray"` → even as a child, `resolveLegendaryRow` (MonsterCardModal.jsx:439) skips delegate branch; `resolveLegendaryRowMechanic` hits the console.error else-branch. Consumer exists (`legendaryDelegateAction`, monsterLegendaryUses.js:6) — DATA gap, not code.
3. **Silent burn confirmed live** on the rendered sibling Stomp (same missing-`delegates_to:"Slam"` defect): gate passed with cs active=Bandit 1 → spent `{max:1, used:1}` + latch `{round:1, Bandit 1}` + `ability_use` spend log ("expends a legendary use for Stomp… 0 of 1 left") + console.error `legendary action "Stomp" delegates_to "undefined" — no resolvable mechanic on "Colossus 1"` — **zero attack roll, zero Radiant Ray, zero damage vs armed Bandit 1 AC12**. +18 vs AC12 never adjudicated.

## Economy spine (works)
- Header numeric uses honored: counter 1→0 left visible; 2nd chip fire → refusal popup + `legendary_use_refused (exhausted)` zero-spend (used held 1); own-turn refusals correct x2; regain seam intact (`regainLegendaryUses` monsterLegendaryUses.js:353 + turnStartEffects consumer; turn-start regain not exercised — MA-0021 seam cited).
- RAW 2-legendary colossus collapses to max=1 single shared counter (Smite+Stomp ride one `uses:1` header).

## Fix (DATA, single pass — header+children same edit §46)
```json
"legendary_actions": [
  {"name":"Legendary Action Uses: 2","uses":2,"description":"Immediately after another creature's turn, the colossus can expend a use to take one of the following actions. It regains all expended uses at the start of each of its turns."},
  {"name":"Smite","delegates_to":"Radiant Ray","description":"The colossus makes one Radiant Ray attack."},
  {"name":"Stomp","delegates_to":"Slam","description":"The colossus moves up to half its Speed without provoking <strong>Opportunity Attacks</strong>, and it can make one Slam attack at any point during that move."}
]
```
(uses:2 per RAW two legendary actions; GM may prefer per-row uses — decide once, header numeric is mandatory else chips silently burn.)

## Live probe ledger (test-campaign, :5173, 2026-09-18)
- EB re-join Colossus (auto idx 0, avatar alt "Colossus 1"); Bandit mis-join→Bandit Captain removed via `.npc-remove-btn`+confirm; exact-Bandit join → Bandit 1 AC11? hp11 ac12 cs ✓.
- Init chip click while active=Colossus 1 → refusal (own-turn) x2, zero spend ✓.
- cs mirror froze at Colossus 1 after Next (top-level change-data truth=DivinationWizard) → staged full-store POST `/combatSummary {value:cs}` activeCreatureName:Bandit 1 → 200, gate read live ✓.
- Armed Bandit 1 on Colossus own initiative-card `[data-testid="target-select"]` ✓.
- Chip fire → burn+console.error (above). 2nd fire → exhausted refusal. Header "Smite (1 left)"→"(0 left)".
- Cleanup: card closed, `/admin/clear-change-data` + `/admin/clear-log` 200, log 0, monsterLegendaryUses wiped. Registry Colossus merge-append, JSON.parse disk-checked. No manifest/git writes.

## New pitfalls
- Colossus-shape legendary list (`uses` on CHILD rows[0]) masquerades the child as header; card header prints the child's NAME ("Smite (1 left)") — instantly diagnostic.
- `legendaryExpendGate` reads combatSummary `activeCreatureName`; after initiative Next the cs mirror can FREEZE (>15s) while change-data top-level is fresh — stage `/combatSummary` POST `{value}` to move the gate's active off the monster.
- Refused clicks log `legendary_use_refused` with reason tokens (own-turn/exhausted) — grep reason to distinguish gate-blocked from mechanic-dead rows.
- Fixed `.mc-overlay` returns `offsetParent===null` — audit via computedStyle display (re-confirmed §29).
