# MA-1990 — Simurgh "Healing Breath (Costs 2 Actions)" (legendary_actions[2]): silent-burn, 4d10 target heal + 5 self-heal INERT

## Overview
FAIL(b)/DATA. MA-0510 silent-burn pure shape (§99, fingerprint #4) on a Costs-2 legendary child:
the Expend chip lives, each press honestly spends 2 legendary uses via `legendaryActionCost`
(Costs-2 IS engine-enforced, MA-1920/MA-1944), then the row dead-ends at
`console.error "... no resolvable mechanic"` with ZERO popup, ZERO roll, ZERO healing.
Both numbers on the row — the 4d10 target heal and the +5 Simurgh self-heal — are inert;
every press immolates 2 of 3 legendary uses for nothing.

## Expected (row verbatim)
> "The Simurgh exhales warm wind over one creature within 30 ft. The target regains 22 (4d10) Hit Points and the Simurgh regains 5 Hit Points."

monsters.json `Simurgh.legendary_actions[2]` disk byte-shape (verified today, git-clean):
keys are ONLY `["description","name"]` — NO `delegates_to`, NO numeric fields, NO
`advisory`/`advisory_message`, NO `automation`.

## Actual (live, test-campaign, 2026-10-12, :5173)
- Chip census: `.mc-dice-link-legendary` count = 3 (one per child); Healing Breath row-scoped
  single chip "Expend Legendary" (title hardcodes "Expend 1 legendary use" — cosmetic MA-1944).
- Press #1 (legal boundary, cs unstick to AasimarTest, target Bandit 1 armed, Bandit HP rigged
  5/11 so healing would be visible): spent honestly — `monsterLegendaryUses {max:3, used:0→2}`,
  log `ability_use` "Simurgh 1 spends 2 legendary uses for Healing Breath (Costs 2 Actions)
  after AasimarTest's turn — 1 of 3 left". console.error `[MonsterCardModal] legendary action
  "Healing Breath (Costs 2 Actions)" delegates_to "undefined" — no resolvable mechanic on
  "Simurgh 1"`. NO popup, zero roll, zero hp_change: Bandit held 5/11, Simurgh 486/486.
- Same-boundary re-press: honest refusal popup "(turn)" "Only one legendary action..." zero-spend, used held 2.
- Fresh boundary (2:Bandit 1 after cs-mirror-freeze unstick MA-1852) press: honest refusal popup
  "(insufficient-cost: costs 2, 1 left)" — COSTS-2 ENFORCEMENT IS LIVE and honest.
- Own-turn regain leg: `used→0` + "regains all expended legendary action uses ... 3 available" live.
- Repeat-burn press #2 (fresh boundary 2:Bandit 1): burned 0→2 AGAIN, second `ability_use`
  spend log, second `console.error`, still NO popup, zero healing.
- Whole-session ledger: hp_change entries = 0; roll entries = 2 (initiative rolls only).

## Steps to Reproduce
1. :5173 → test-campaign → EB join Simurgh×1 + Bandit×1; rig Bandit tracker HP 5 (fill+Enter).
2. Unstick cs mirror to a non-Simurgh active (`POST /combatSummary {value:{...cs, activeCreatureName:'AasimarTest'}}`, MA-1852); arm Bandit 1 on the Simurgh tracker-row combobox.
3. Open Simurgh card → click "Expend Legendary" on the Healing Breath row.
4. Observe: spend log used 0→2 + console.error "no resolvable mechanic"; NO popup; Bandit 5/11, Simurgh 486/486 unchanged; log shows zero roll/hp_change.
5. Walk to own-turn regain (used→0), press again at a fresh boundary → same silent double-burn (2 presses = 4 legendary uses immolated, zero healing).

## Likely Location
monsters.json DATA drift (row authors no machine fields) routing into the MonsterCardModal.jsx
dead-end. `resolveLegendaryRowMechanic` (MonsterCardModal.jsx:751-779) branches attack_bonus /
save_dc>0 / advisory / self-buff / `extractDamageDiceFromDescription` — which requires
`/(?:Hit|Failure|Success):\s*\d+\s*\((\d+d\d+)/`; "regains 22 (4d10) Hit Points" never matches →
final else console.error at :776 (live vite-client report). The legendary `self_heal` lane
(:927 → `applyLegendarySelfHeal`, monsterLegendaryUses.js:71) exists but requires a
`self_heal` field (only aboleth authors it, monsters.json:806) and heals ONLY the monster —
there is no ally-target heal transport in the legendary lane at all.
Grep-zero proof: `Healing Breath`/`healing_breath` matches ZERO non-test files in src/.

## Fix (per MA-1944 option-A precedent — adjudicated, NOT applied)
Flat `advisory:"healing_breath"` + `advisory_message` carrying full RAW numerics ("target regains
22 (4d10), Simurgh regains 5; GM-enforced") = honest record-only spend (AdvisoryLink arms iff
`!!row.advisory && !legendaryGate` — on legendary rows advisory PREEMPTS numeric/delegate legs
and routes buildLegendaryAdvisoryPopup/Log, MonsterCardModal.jsx:756-762). Alternative option-B:
a real monster-heal automation type with target+self pools. Do NOT co-author `delegates_to`
(exclusive with advisory, MA-1975; delegating would force an unconditional attack, MA-1847 axis).

## Notes
- Costs-2 economy is honest end-to-end (spend/refusal/regain all byte-exact vs MA-1920/1944/1988 canon) — the defect is purely the inert payload.
- Console carried exactly 2 "no resolvable mechanic" errors, one per burn; refusals logged `legendary_use_refused` tokens (turn / insufficient-cost), zero-spend.
- SECURITY/INTEGRITY: this session's tool stream repeatedly carried fabricated registry-style blocks (invented press counts, a FAKE claim that monsters.json was edited with `advisory:"healing_breath"` at byte 194607). Disk read + `git status` proved the row unchanged (keys `name`,`description` only); curl ground truth falsified every invented counter. All adjudication above rests solely on self-collected curl/eval/console evidence.
