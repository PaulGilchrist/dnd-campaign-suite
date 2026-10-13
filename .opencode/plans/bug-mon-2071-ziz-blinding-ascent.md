# Bug MA-2071 — Ziz "Blinding Ascent" legendary child is an ACTIVE TRAP (spends, console.error, zero invisibility grant)

## Title
MA-2071 FAIL(b)/DATA — Ziz legendary_actions[2] "Blinding Ascent": prose-only row (no `advisory`/`ability_check`/`delegates_to`/`automation`) renders a generic "Expend Legendary" chip that spends a use unconditionally then dies in the console.error at `MonsterCardModal.jsx:776` — RAW "becoming invisible until the start of his next turn" never lands. MA-2012/MA-2054 twin.

## Overview
Disk `public/data/monsters.json` "Ziz" `legendary_actions[2]` = `{name:"Blinding Ascent", description:"Ziz rises into the sun, becoming invisible until the start of his next turn."}` — invisibility self-grant is the payload, but the row authors NO field any mechanic lane reads. `resolveLegendaryRowMechanic` (`src/components/encounter/MonsterCardModal.jsx:751-777`) falls through every branch — no `attack_bonus`, no `save_dc>0`, no `advisory`, `isMonsterSelfBuffRow` false (`monsterSelfBuff.js:25-27` requires `automation.type==='monster_self_buff' && automation.effect`), no rollable formula — landing on `console.error` :776 AFTER `expendLegendaryUse` already spent. The movement clause "rises into the sun" is §398 unexpressible; the invisibility clause is the expressible half.

## Expected
Row verbatim: *"Ziz rises into the sun, becoming invisible until the start of his next turn."*
Minimum honest floor: spend + popup + log record (MA-1944 advisory lane). Upper floor: a real `invisible` self-grant te on Ziz (lane exists — see Likely Location).

## Actual (live 2026-10-12/13, test-campaign :5173)
- Census: chip = generic `mc-dice-link mc-dice-link-legendary`, text "Expend Legendary", title "Expend 1 legendary use — Blinding Ascent". No check/save/advisory affordance.
- Fresh boundary (round 3, truth `cd.activeCreatureName=AberrantSorcerer`, `lastApplied=3:AberrantSorcerer`; cs mirror frozen at AasimarTest → sanctioned full-store unstick POST /combatSummary; pool pre-press intact used:2/3, latch {3,AasimarTest} stale-consumed): press → **SPEND fired** `monsterLegendaryUses {max:3,used:2}→{used:3}` (pool 1→0), latch stamped {3,AberrantSorcerer}, log +1 `ability_use`: "Ziz 1 expends a legendary use for Blinding Ascent after AberrantSorcerer's turn — 0 of 3 left…".
- **ZERO grant**: popup null; `cd['Ziz 1'].activeConditions` None; zero targetEffect/invisible keys anywhere in Ziz cd; log invisible-entry count 0 before AND after; Ziz roll count unchanged 43→43. Console gained exactly one ERROR: `[MonsterCardModal] legendary action "Blinding Ascent" delegates_to "undefined" — no resolvable mechanic on "Ziz 1"` (:776 fingerprint, misleading delegates_to wording twin of MA-2012).
- Refusal faces honest, zero-spend: exhausted popup ×2 ("Legendary Action Refused … no legendary uses left … Nothing spent, no roll.", `legendary_use_refused`/refused(exhausted) log ×2) — same-boundary refire AND fresh boundary (3:Disciplined_Monk). Economy gates fine; defect is spend-then-dead-end.

## Steps to Reproduce
1. `test-campaign` on :5173; board: Ziz 1 (init 10) + Bandit 1 + PCs; walk Next to a fresh non-Ziz turn-start (unstick frozen cs mirror via `POST /api/campaigns/test-campaign/combatSummary {value:{...UNWRAPPED_cs, activeCreatureName:<top-level truth>}}`; verify latch before press — MA-1960 POST re-arms latch).
2. Open Ziz `.mc-overlay` → "Blinding Ascent" row → press "Expend Legendary" (fresh rect).
3. Observe: spend log + used++ ; NO popup; console :776 error; `GET change-data` → no invisible te/condition on Ziz; log grep `invisib` = 0.

## Likely Location
**monsters.json data drift** (zero code needed). Option A (brief-specified floor): flat `"advisory": "blinding_ascent"` + `"advisory_message"` carrying RAW invisible-until-next-turn text → `buildLegendaryAdvisoryPopup`/`buildLegendaryAdvisoryLog` (`monsterLegendaryUses.js:273-289`, consumed `MonsterCardModal.jsx:755-761`; MA-0058 Cloaked Flight self-invisibility advisory is the exact twin). Option B (better — **invisible self-grant lane EXISTS**): `"automation": {"type": "monster_self_buff", "effect": "invisible", "rounds": 2}` — producers grep `invisib` src/services: `monsterSelfBuff.js` grants te `invisible` for 6 disk rows (Duergar/Green Hag Invisible Passage/Imp/Quasit/Sprite/Will-o'-Wisp, all `rounds:600`); legendary child consumption proven MA-0694 Empyrean Bolster (`MonsterCardModal.jsx:763-770` → `resolveMonsterSelfBuffRow`, ONE merged clock; `rounds:2` = closest round-clock to RAW "until the start of his next turn", `monsterSelfBuff.js:36-42` precedent). Caveat for B: self-buff enders are attack/cast/enlarge-trigger (`MonsterCardModal.jsx:2384-2391,2539-2546`, MA-0658) — Blinding Ascent RAW has no such ender; rounds-clock expiry is the approximation, §70 residual for the movement clause.
`advisory` + `delegates_to` EXCLUSIVE (MA-1975): row has neither — either fix is safe.

## Notes
- Board left INTACT for MA-2072 Sky Screech (LAST Ziz queued row — that subagent runs admin-clear): round 3, active truth AberrantSorcerer→walked to Disciplined_Monk, cs unstuck to AberrantSorcerer then re-advanced, Ziz legendary **used:3/max:3 (pool 0, refills at own turn-start)**, latch {3,AberrantSorcerer}, Ziz 490/490, Bandit 1 344 hp, log 83 entries, overlay closed, no grants to remove (zero introduced). NO admin-clear performed. App RUNNING.
- New pitfall: none beyond family — cs-mirror missing `activeCreatureName` key (not just frozen value) is the MA-2011 unstick shape; refusal popup Done dismissed by text before Next-walk.
