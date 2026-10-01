# Bug — MA-1749 Young Black Dragon "Unnamed lair actions 3": nameless insect-cloud save-dict renders text-only, zero affordance; cloud AoE + duration clauses additionally unmodeled even post-name-fix (nameless-dict inert family)

- ID: MA-1749 · Young Black Dragon · category other · actionType lair_actions
- Disk key: `young-black-dragon.lair_actions[2]` = **NAMELESS STRUCTURED DICT** — `save_dc: 15` + `save_type: "Constitution"`, NO `name`, NO `zone`, NO `duration`, NO `damage_dice_primary`
- Verified: 2026-09-30 · campaign test-campaign (locked) · dev :5173/:80
- Verdict: **FAIL(b)/DATA** — same kill as MA-1748 (name gate), but cloud-AoE/lightly-obscured/cloud-duration clauses are ADDITIONAL unmodeled residuals per §70/§85; a full fix should mirror the VERIFIED Adult/Ancient Black Dragon insect-cloud template, not just add `name`.

## Disk quote (public/data/monsters.json → young-black-dragon.lair_actions[2])
```json
{
  "description": "A cloud of swarming insects fills a 20-foot-radius sphere centered on a point the dragon chooses within 120 feet of it. The cloud spreads around corners and remains until the dragon dismisses it as an action, uses this lair action again, or dies. The cloud is lightly obscured. Any creature in the cloudwhen it appears must make on a DC 15 Constitution saving throw, taking 10 (3d6) piercing damage, or half as much damage on a successful one. A creature that ends its turn in the cloud takes 10 (3d6) piercing damage.",
  "save_dc": 15,
  "save_type": "Constitution"
}
```
(Prose carries the canonical "cloudwhen" typo — same typo MA-0166 fixed on the Ancient Black Dragon sibling.) Manifest row carries conditions label only (no engine keys). Manifest untouched.

## Kill chain (identical to MA-1748)
- `monsterLairActions.js:26` — `!row.name` → `isLairRowClickable` false BEFORE the `save_dc != null` check at :27. save_dc does NOT rescue (legendary-only §115 lane; lair lane hard-gates on name).
- `monsterLairActions.js:38-39` — `lairRowAffordance` returns null (not clickable); had a name, :42 would return `'save'`.
- `MonsterCardBody.jsx:358` — static branch; `:365` name header conditional → null header, plain `<span>` prose, zero chips.

## Distinction from MA-1747/MA-1748 (the "cloud + duration additionally unmodeled" delta)
- MA-1747 [0] bare string / MA-1748 [1] nameless save-dict (damageless save → prone): one-field `name` fix fully arms the row's only mechanic (save seam).
- MA-1749 [2] nameless save-dict whose RAW text carries THREE further clauses the name-fix does NOT arm (§70):
  1. **Sphere AoE / persisting zone** — row authors NO `zone` key → `zoneTeForAction` (MonsterCardModal.jsx:203) requires `action.zone.radius_ft` AND `action.name` → null → no area picker, no per-creature zone te, save leg is single-target-selected only (shape degradation: 20-ft sphere collapses to whoever the GM clicks).
  2. **Cloud duration** ("remains until dismissed / reused / dies") — no duration consumer for a zone-less row; advisory prose only.
  3. **Turn-end repeat 3d6 + lightly-obscured** — no turn-END zone-damage consumer exists (MonsterCardModal.jsx:171-175); lightly obscured is registry description text only, no vision-level consumer.
- VERIFIED template exists: Adult Black Dragon `lair_actions[1]` (MA-0042) and Ancient Black Dragon fix MA-0166 both use `name:"Insect Cloud"` + `dc_success:"half"` + `save_effect` + `zone:{radius_ft:20, repeat_turn_end:true}` + `duration:"… (advisory)"`. Recommended fix mirrors that template (bytes available in monsters.json siblings), not the MA-1748 minimal one-field shape.
- `lair_insect_cloud` te IS registered (targetEffectDefinitions.js:1200-1207) but has ZERO non-test spawn sites outside the Adult template lane — unreachable for this row while zone-less and nameless.

## Live evidence (test-campaign, header verified; board IN initiative round 1: YBD 1 (init 8) + Bandit 1 (720) + Bandit 2 (922))
- INNER `img.avatar-image` "Young Black Dragon 1" → `.mc-overlay` open.
- Lair section rows (in-card `.mc-action` idx 4/5/6 = the three lair rows). Target row idx 6 (insect cloud): `div.mc-action` > plain `<span>` prose only.
- Affordance inventory: `.mc-dice-link-lair`=0, `.mc-dice-link`=0, `button`=0, `[role=button]`=0, `<strong>`=null, `.fa-hurricane`=false, tabbable=0, inline onclick=0, cursor:auto — despite visible "DC 15 Constitution saving throw" prose text. Whole-card lair chips = 0.
- Click probe (span dispatch, bubbles): zero popup, zero modal, zero `.mc-prerequisite-refusal`, zero save prompt. Zero POSTs (network). Log GET before/after **65 → 65**, zero delta. Zero console errors.
- Step-3 chip exercise N/A: no chip → no DC 15 CON save leg vs Bandit(s) → 3d6/half math, single-vs-sphere shape all unreachable (recorded as degradation, judged honestly: nothing rolls).

## Grep citations (§85 grep-zero, run on src+server excl. tests)
- `lair_insect_cloud`: non-test hits = targetEffectDefinitions.js:1200 (registration/label) + MonsterCardModal.jsx:170 (comment only) → zero live consumers for YBD.
- `repeat_turn_end`: single consumer MonsterCardModal.jsx:210, gated by `zoneTeForAction` :203 (`zone.radius_ft` + `name` required) — both absent on this row.
- lightly-obscured: non-test hits are registry description strings only (targetEffectDefinitions.js:1155/1202/1220/1247/1265) + one Web spell popup prose (CreatureTargetPopups.jsx:66) — no vision/obscuration state consumer anywhere.
- turn-end zone-damage: none — documented as nonexistent at MonsterCardModal.jsx:171-175 ("expireStaleEffects zone phases are turn-START … turn-end seams are condition_removal/sleep/stink-cleanup only").
- Unit guard family: monsterLairActions.test.js:1915-1922 pins young-black-dragon nameless rows (`isLairRowClickable(young.lair_actions[1])` toBe(false)); scope guard text at :1864 "young-black-dragon's identical [rows] untouched". No test yet touches `lair_actions[2]` — inertness untested but engine-guaranteed by the same name gate.

## Fix template (recommended = Adult/Ancient mirror, §70-compliant)
```json
{"name": "Insect Cloud", "description": "<prose, cloudwhen→cloud when>", "save_dc": 15, "save_type": "Constitution",
 "damage_dice_primary": "3d6", "damage_type_primary": "Piercing", "dc_success": "half",
 "save_effect": "Failure: 10 (3d6) piercing damage. Success: Half damage.",
 "zone": {"radius_ft": 20, "repeat_turn_end": true},
 "duration": "until dismissed or used again (advisory)"}
```
→ 'save' chip + area picker + `lair_insect_cloud` te per covered creature (MonsterCardModal MA-0042 lane). Residuals stay advisory/GM-enforced: turn-end repeat damage, lightly obscured, dismiss-on-action lifecycle (§85 accepted). Minimal alternative (name only) arms save leg but leaves all three cloud clauses dead — NOT recommended given verified sibling bytes. DO NOT edit `docs/monster-actions-manifest.json`.

## Evidence
- .opencode/plans/checkpoint-mon-MA-1749.md (probe record)
- .opencode/plans/ma1749-lair-row-nameless-insect-cloud-inert.png (overlay, text-only row idx 6, zero chips)
- Sibling bugs: bug-mon-MA-1747-…bare-string-inert.md, bug-mon-MA-1748-…nameless-dict-inert.md
