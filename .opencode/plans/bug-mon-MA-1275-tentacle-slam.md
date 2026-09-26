# MA-1275 — Otyugh / Tentacle Slam — FAIL(a)/DATA

**Date:** 2026-09-26 · **Campaign:** test-campaign · **Playbook:** §128/§129 (inline save-shell), §209 (target-prerequisite codification), §212/§236 (nested-abbrev ±N rig), §491 (cs POST clobbers targetName), §490 (+0 junk), §38/§70 (duration advisory), MA-1245/0866 inline both-legs twins

## Row (disk `monsters.json` → otyugh.actions[3])
`attack_bonus 0` · `save_dc 14` · `save_type "Constitution"` · `damage_dice_primary "3d8 + 3"` · `damage_type_primary "Bludgeoning"` · save_effect byte-carries canonical **Stunned** + "Half damage only" · range/reach/recharge "" · **`target_prerequisite` ABSENT · `dc_success` ABSENT** (half-default = RAW-correct here). Manifest `attackBonus:0` disk-true → bogus "+0" attack chip renders alongside (§490) — never pressed.

## Static census (step 1)
- Row chips live: `+0` (junk §490, unpressed), `3d8 + 3` damage, **`DC 14 Constitution`** `mc-dice-link mc-dice-link-save mc-dice-link-save-clickable` — generic save-shell renders §128 pattern ✓.
- Shapeless range "" → `breathAoeShape` null → inline single-target seam, no picker (§129) — confirmed live: both legs auto-resolved inline click-to-dismiss, no `.sp-modal` queue.
- Gate code REACHES this seam: `handleSaveRoll` → `evaluateTargetPrerequisiteGate` (MonsterCardModal.jsx:2031 → MonsterCardHelpers.js:713) — but `parseTargetPrerequisite` (Helpers:693) requires structured `action.target_prerequisite`; row lacks it → gate byte-inert (§209).
- `dc_success` absent → getSaveDcSuccess default `half` (MV-20) — RAW "Success: Half damage only" → default is CORRECT here, no fix needed.

## Live rig
- EB native cb.click() exact-td: Bandit + Otyugh (pre-Join audit `['Bandit','Otyugh']` both checked) → Join → cs `Bandit 1` + `Otyugh 1` (PCs 1/1 placeholders).
- Full-store `/combatSummary` POST `{value:cs}` ONE BODY (§491): Bandit 1 hp/maxHp 999 + nested `saving_throws:{con:{modifier:-19}}` + Otyugh 1 `targetName:"Bandit 1"` — GET-confirmed all three.
- Own-card arm: avatar-alt anchor → closest card select, prototype setter + change → `cs.creatures[Otyugh 1].targetName:"Bandit 1"` server-confirmed.
- **Bandit 1 was NEVER Grappled** (grapple never granted all session; activeConditions stayed `[]` pre-leg, `["stunned"]` post-leg only) — so every save-fire below is itself the prerequisite-gate probe.

## FAIL leg (con −19) — inline auto-roll
- Popup stage-1 direct click-to-dismiss, no Done needed: `✗ SAVE FAILURE (-16 vs DC 14) (d20 3 + 0)` — popup prints cosmetic "+0" base-mod while verdict total folds −19 (§209/§212 twin).
- Victim `roll save`: Bandit 1 total **-16**, rolls [3], `saveResult:"failure"`, saveDc 14, saveType "Constitution" ✓ (nat3−19=−16 < 14).
- Damage entry: formula `"3d8 + 3"` Bludgeoning, rolls [1,7,7], total **18 = FULL** ✓.
- `hp_change`: delta **-18**, 999→981, |Δ|==fd full ✓.
- **Grant-state VERBATIM:**
  - `{"type":"condition","action":"applied","characterName":"Bandit 1","condition":"Stunned","sourceName":"Otyugh 1","sourceAbility":"Tentacle Slam"}`
  - change-data `Bandit 1.activeConditions:["stunned"]`, `activeConditionMeta.stunned:{source:"Otyugh 1",durationNote:"until the start of the otyugh's next turn (GM-enforced)"}`
  - `condition_clauses_advisory` log names the Stunned duration GM-enforced — no addExpiration clock (§38; MA-0918 durationNote family; §236 te-twin rounds:2 N/A — stunned rides canonical condition channel, not te).

## SUCCESS leg (con +19, same-body re-stamp) — inline re-fire
- Popup: `✓ SAVE SUCCESS (31 vs DC 14) (d20 12 + 0)`, `8 damage applied — HP: 981 → 973`.
- Victim roll total **31** (nat12+19), `saveResult:"success"` ✓.
- Damage entry rolls [6,5,2] → raw 16, `fd:8` = **floor(16/2) half exact** ✓; `hp_change` delta −8, 981→973 ✓.
- **No NEW condition entries** (whole-log `type:'condition'` count stays 1 = fail-leg entry only) — Stunned fail-only ✓; stale fail-leg `stunned` persists in activeConditions (§96 expected).

## Prerequisite probe → FAIL(a) evidence
- RAW gate: "each creature **Grappled** by the otyugh" (prose only, description + target text).
- Disk: `target_prerequisite` KEY ABSENT → `parseTargetPrerequisite` null → gate inert passthrough; save fired twice live against an **ungrappled** Bandit 1 with zero refusal, zero `<tentacle_slam>_refused` log, zero `.mc-prerequisite-refusal` popup.
- Consumer is LIVE and reached (MA-0019 shape; MA-0687/0689 §209 conversion precedent — prose target-prerequisite without structured field = FAIL(a) DATA, not §70 advisory).

## What worked (all exact)
DC 14 ✓ · Constitution ✓ · fail = full 3d8+3 Bludgeoning ✓ · success = half floored exact ✓ · Stunned granted fail-only with correct source meta ✓ · inline single-stage both-legs seam ✓ · ungated refire honest (no uses authored, At-Will RAW ✓).

## One-field DATA fix
`monsters.json` otyugh.actions[3] (Tentacle Slam), after `save_effect` (MA-0019 aboleth byte-shape):

```json
"target_prerequisite": { "conditions": ["grappled"], "by_attacker": true }
```

- `by_attacker:true` matches RAW "Grappled **by the otyugh**" (targetPrerequisiteSatisfied source-checks `activeConditionMeta[cond].source === monsterName`; Mind Flayer Extract Brain twin ships bare `["grappled"]`).
- §70 residual to name: until MA-1274's Tentacle grapple producers are fixed (`hit_conditions:["grappled"]+escape_dc:13`, MA-0010 seam — see bug-mon-MA-1274-tentacle.md), no grapple state exists to satisfy the gate → the gate would refuse everything post-fix; authoring still closes the DATA gap and both fixes land the RAW loop.

## Console
0 errors whole session.

## Cleanup
Overlays flushed, Admin clear-change-data + clear-log (200/200), final: log count 0, change-data `{}`.
