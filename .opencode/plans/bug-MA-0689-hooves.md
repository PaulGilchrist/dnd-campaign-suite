# Bug MA-0689 — Elk "Hooves": prone-target prerequisite unenforced (FAIL(a)/DATA; MA-0687 Stomp twin)

## Overview
Elk actions[1] "Hooves" restricts its target to "one prone creature" but the row authors no structured prerequisite field and the app evaluates no prerequisite gate on attack chips — the Elk stomps non-prone targets for full damage. Subagent initially framed this advisory; orchestrator converted to FAIL(a) for consistency with MA-0687 (Elephant Stomp, verified 2026-09-20, identical prone-prerequisite clause → FAIL(a)/DATA + attack-seam wiring gap), because the prerequisite transport EXISTS (MA-0019 aboleth `target_prerequisite` authored, §68) and unauthored-prerequisite attacks have been ticketed as DATA bugs (MA-0019 fixed that way), not advisories.

## Expected (canonical disk prose, byte)
"Melee Attack Roll: +5, reach 5 ft., one prone creature. Hit: 7 (2d4 + 3) bludgeoning damage." — Stomp-class RAW: only prone creatures can be targeted; non-prone attack should be refused/gated.

## Actual (live 2026-09-20, test-campaign)
- Disk: `elk.actions[1]` attack_bonus 5, "2d4 + 3" bludgeoning, NO `target_prerequisite` field; manifest ranged guess rejected (disk melee byte-exact).
- NON-PRONE victim Bandit 1 (AC12, armed own-card): nat10+5=15 HIT → ONE `roll damage` "2d4 + 3" [1,1]=5, hp 999→994 — full damage on a STANDING target, zero refusal/gate.
- nat4+5=9 honest MISS zero-damage ✓ (core dice/bonus honest).
- Third roll nat8+5=13 hit → 2d4+3 [2,2]=7, 994→987. finalDamage==|hpΔ| exact unclamped; totals honest.

## Steps to reproduce
1. test-campaign, join Elk + Bandit (Bandit NOT prone), arm Bandit on Elk card, click "+5" Hooves chip → hits for full 2d4+3.

## Likely Location
1. DATA one-field: `target_prerequisite:{"conditions":["prone"]}` (MA-0019 aboleth byte-shape minus by_attacker).
2. CODE seam: `evaluateTargetPrerequisiteGate` (MonsterCardHelpers.js:599) sole call-site handleSaveRoll (MonsterCardModal.jsx:1708) — attack-chip path evaluates ZERO prerequisites (MA-0687 finding); fix needs attack-roll seam wiring, else field alone is inert.

## Notes
- Adjudication codified: prose target-prerequisite attack rows lacking structured fields = FAIL(a) DATA (+attack-seam wiring ticket), twins MA-0687 (Stomp), MA-0689 (Hooves); do not classify as §70 advisory.
- Core chip numerics (+5, 2d4+3 byte-exact, Done flow, honest miss) are sound — recorded PASS-subset numerics above remain valid evidence.
- Fix-verify post-fix needs the attack seam consumer first (§68/§150 consumer-template note).
