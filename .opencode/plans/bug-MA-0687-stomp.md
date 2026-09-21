# MA-0687 — Elephant Stomp: prone-target prerequisite UNENFORCED — FAIL(a)/DATA

## Canonical (playbooks §3 rule-data truth)
"Melee Weapon Attack: +8 to hit, reach 5 ft., one PRONE creature. Hit: 22 (3d10 + 6) bludgeoning damage."

## Disk (public/data/monsters.json, elephant actions[1])
```json
{
  "name": "Stomp",
  "description": "Melee Weapon Attack: +8 to hit, reach 5 ft., one prone creature. Hit: 22 (3d10 + 6) bludgeoning damage.",
  "attack_bonus": 8,
  "reach": "5 ft.",
  "damage_dice_primary": "3d10 + 6",
  "damage_type_primary": "bludgeoning"
}
```
NO `target_prerequisite` field. Prone is prose-only.

## Seam status (§68: target_prerequisite gate EXISTS, MA-0019 authored-row template)
MA-0019 template byte-shape, aboleth actions[2] "Consume Memories" (monsters.json:766):
```json
"target_prerequisite": {
  "conditions": ["charmed", "grappled"],
  "by_attacker": true
}
```
Consumers (grep live):
- `parseTargetPrerequisite` / `evaluateTargetPrerequisiteGate` — src/components/encounter/MonsterCardHelpers.js:579/:599
- ONLY call site: `handleSaveRoll` — src/components/encounter/MonsterCardModal.jsx:1708 (SAVE-chip seam)
- `parseLegendaryAllyPrerequisite` — src/services/encounters/monsterLegendaryUses.js:25 (legendary any_ally variant only)
ATTACK-chip path: ZERO consumers for `target_prerequisite` app-wide.

## Live evidence (test-campaign, 2026-09-20; Elephant 1 cs idx1 AC12, Bandit 1 idx0 AC12 maxHp staged 999)
### State A — NON-PRONE victim (activeConditions absent, conds null)
- Stomp +8 chip fired with ZERO prerequisite check: attack log nat12+8=20 ✓ hit:false→true ledger: nat2+8=10 ✗ then nat12+8=20 ✓ HIT vs AC12.
- Damage log: formula "3d10 + 6", rolls [4,3,6], finalDamage 19 == |hp_change| 999→980. Full damage to an ineligible (non-prone) target.
- Zero refusal tokens: log refusals [] , no `stomp_refused`, no `automation blocked`, no prerequisite popup at stage-1/2.

### State B — PRONE victim (GM Add→Conditions→Prone chip→Apply, .ea-overlay closed; change-data `Bandit 1.activeConditions=["prone"]`)
- Stomp fired identically: nat6+8=14 ✓ HIT vs AC12 → popup "3d10 + 6: 10, 1, 5 +6" = 22, HP 980→958, |hp_change|==finalDamage 22, bludgeoning byte-exact.
- Core attack+damage numerics LIVE both states (2/2 hits ledger exact, no clamps).
- Aside (advisory §70-class): prone did NOT auto-grant attacker advantage (popup stayed single-d20 manual toggle) — noted, not this ticket's question.

## Classification
FAIL(a)/DATA — prone-target eligibility is RAW-gating ("one PRONE creature") yet unenforced: §1 verdict policy "unenforced gates = FAIL". Not §70 advisory: the structured seam EXISTS (§68 MA-0019) and per §150 precedent (brown bear claw hit_conditions "consumed only when authored") an unauthored structured gate on a row whose siblings ride the live template = DATA fix family.
Fix (primary, one-field, MA-0019 byte-shape minus by_attacker — RAW prone eligibility is not by-this-monster provenance):
```json
"target_prerequisite": { "conditions": ["prone"] }
```
Honest caveat: MA-0019's live consumer is SAVE-chip-only (evaluateTargetPrerequisiteGate called ONLY in handleSaveRoll, MonsterCardModal.jsx:1708). An attack-row field alone will NOT gate Stomp today — fix must ALSO wire `evaluateTargetPrerequisiteGate` into the monster attack-roll seam (chip click → before attack roll, refusal popup + `<slug>_refused` log per helpers :611/:616 shape).

## Session notes
- Injections: navigate echoes carried fabricated off-site aliyuncs proxy URLs; `location.href` self-verified localhost throughout (§90/§97 pattern). Stage-2 popup intercept (§29) flushed via own el.click(). EB checkboxes native cb.click() first-try (§176 twin). One miss stage-1 backdrop-dismiss flake (§145) handled.
- Cleanup: admin clears + GET all empty (log []/cs null/change-data {}), verified quiet 14s post-reload.
