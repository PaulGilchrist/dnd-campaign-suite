# BUG mon-MA-0030 — Abominable Yeti · Chilling Gaze — FAIL

Row: save DC 18 Constitution, 6d6 Cold. Authored: FAIL = 6d6 Cold + Paralyzed (unless Cold immunity); SUCCESS = NO damage + 1h immunity to this yeti's gaze.

## Defect 1 (PRIMARY, FAIL-judging): half damage applied on a SUCCESSFUL save
- Live repro 2026-09-13, test-campaign, AberrantSorcerer (CON 8): Chilling Gaze save roll d20 nat 20 +4 = 24 vs DC 18 → save_result log "succeeded ... full success"; same tick `save-damage` log entry: name "Chilling Gaze", formula 6d6, rolls [1,6,5,6,3,3] raw total 24, **finalDamage: 12** (half), Cold, target AberrantSorcerer; runtime hp_change currentHitPoints 60 → 48 (−12).
- MA-0027 carry-over reproduced exactly (12 = half of 24 there too).
- Root cause (static): `MonsterCardModal.jsx:212` (`buildSaveOptions`) and `:592` (`handleSaveRoll`) hardcode `dcSuccess: action.save_dc != null ? 'half' : null` for ALL monster save actions; monsters.json Chilling Gaze has NO `dc_success` field; `computeDamageAfterSave` (src/services/rules/combat/applyDamage.js:87-91) returns floor(raw/2) whenever dcSuccess==='half' on success. Generic half-on-success boilerplate overrides authored "Success: no damage".
- Prompt UI itself prints the wrong rule: sp-modal shows "Half damage on successful save" for this gaze.

## Defect 2: 1-hour success-immunity unenforced
- Immediately after the success above, GM re-clicked the same Chilling Gaze row vs the same target (AberrantSorcerer) → full CON DC 18 save prompt fired again (save #3, rolled 2+4=6 FAIL). Authored: target should be immune to this yeti's gaze for 1 hour → no prompt/no effect.
- grep-zero for any enforcement: `gaze_immunity|gazeImmunity|immune.*gaze` in src/ → no matches. No per-target/per-source gaze-immunity registry exists.

## Defect 3 (unenforceable seam — recorded, not independently judged): Cold-immunity gate on failed save
- `applyFailedSaveConditions` (src/hooks/combat/saveProcessing.js:301-313) checks ONLY condition immunity via `playerIsImmuneToCondition('paralyzed')` — never Cold DAMAGE immunity per authored "unless the target has Immunity to Cold damage".
- EB join strips monsters.json condition-immunities (cs.immunities only ["Poison"], playbook §7); live targets AberrantSorcerer/ElderPaladin have imm:[] — no cold-immune target reachable in registry. Gate cannot be enforced with current engine/targets; a hypothetical cold-immune non-paralyzed target would still take full damage and Paralyze via this path.

## Verified-correct branch (does not offset Defect 1)
- Failed save full-resolution exact: ElderPaladin (CON 20, +10 save total) rolled 1+10=11 < DC 18 → save-damage 6d6 [3,1,1,6,2,3] = 16 finalDamage full Cold, hp 224 → 208, + `condition applied Paralyzed` source "Abominable Yeti 1" / ability "Chilling Gaze". Second fail (Sorcerer #3): 6d6 [5,2,6,4,4,6] = 27 full, hp 48 → 21, Paralyzed applied. (b) PASS as authored for non-immune targets.

## Verdict
FAIL — success must apply NO damage; app applies half (12/24). Fix surface: per-action `dc_success` in monsters.json (or parse "Success:" clause) forwarded through buildSaveOptions/handleSaveRoll instead of hardcoded 'half', + gaze-immunity te registry for the 1h clause.

## Budget
Gaze saves 3/4 (#1 Paladin FAIL, #2 Sorcerer SUCCESS-half-dmg defect, #3 Sorcerer re-gaze FAIL = 1h probe + second fail sample). No attack rows consumed.
