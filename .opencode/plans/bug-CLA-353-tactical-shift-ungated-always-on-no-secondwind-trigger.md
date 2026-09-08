# BUG CLA-353 — Tactical Shift (Fighter 2024, lv5 in app data)

**Verdict: FAIL** (2026-09-08, test-campaign, EvasiveFighter lv18 Battle Master 2024 host)

## Manifest row
- CLA-353 | classFeature | Fighter | trigger "Passive — on Second Wind bonus-action use"
- Expected: "Whenever you activate your Second Wind with a Bonus Action, you can move up to half your Speed without provoking Opportunity Attacks."

## App data ground truth
- `public/data/2024/classes.json` Fighter class_levels[4] (LEVEL 5, not lv13; universal Fighter, not Battle Master): `automation: { type: "passive_rule", effect: "tactical_shift_no_oa", casting_time: "1 bonus action" }`.

## Live E2E evidence (http://localhost:5173, test-campaign)
1. **Second Wind activation writes nothing for this feature.** HP forced 50 via initiative card, clicked Second Wind bonus row → popup "Second Wind: 1d10 + 18=28 (10) — Regained 28 HP (3 uses remaining)", server `currentHitPoints 50→78` + `hp_change` log ONLY. Post-use change-data scan for `oa|move|shift|buff|targeteffect|tactical` keys on EvasiveFighter: `[]`. No `no_opportunity_attacks` te, no half-speed flag, no movement-mode buff, no ability_use/Tactical Shift log. Popup/log wording never mentions half Speed or OAs.
2. **Ungated control inverted:** the initiative card shows an "Insp. Move" badge (tooltip "Inspiring Movement: the creature does not provoke opportunity attacks when moving.") on EvasiveFighter BEFORE any Second Wind use — the passive (initiative.jsx:553 → ConditionEffectBadges.jsx:91 `hasTacticalShift`) is ALWAYS-ON for any lv5+ Fighter, with no Second Wind gate, mislabeled as Inspiring Movement. Fails the "NOT written without Second Wind" control.
3. **The one live OA-refusal consumer is dead for PC targets.** CharReactions.jsx:220-226 refuses OAs via `hasTacticalShift(target)` but `target` comes from combatSummary, and cs combatant entries carry NO `automation` field (initiativeService.js:15-23 builds `{name,type,initiative,targetName,concentration}` only). Live probe: armed FeyRanger→target EvasiveFighter (cs `targetName:"EvasiveFighter"` confirmed), clicked FeyRanger "Opportunity Attack:" → NO refusal popup; OA rolled normally (Longbow MISS 9 vs AC 12, logged as plain `roll/attack FeyRanger`). The claimed suppression fails even inside the app's own click model — not just gridless residue.
4. `tactical_shift_no_oa` is absent from PASSIVE_RULE_EFFECTS (automation/index.js:287-294) → no passive-rule handler; feature categorization/`second_wind` trigger grep: zero writers stamp any no-OA state at Second Wind time (healing handlers: no tactical/no_OA references).

## Grep consumers (not zero, but toothless)
- LIVE render consumer: initiative.jsx:553 + ConditionEffectBadges.jsx:89-94 ("Insp. Move" badge, always-on).
- CODE gate consumer that cannot fire for PCs: CharReactions.jsx:222 (cs entries lack automation.passives).
- Unit-test-only: automationPassives.test.js:111.
- `no_opportunity_attacks` te EXISTS (targetEffectDefinitions.js:132, consumer conditionEffects.js:410 + ConditionEffectBadges.jsx:214 "No OA" badge) but is written only by stepOfTheWindHandler.js (Monk) — never by the Second Wind path.

## Fix recipe
At the Second Wind use seam (handleHealing self_healing branch or a Second Wind post-apply hook), on successful activation write a self-target te `{effect:'no_opportunity_attacks', source:'Tactical Shift', duration:'until_start_of_next_turn'}` + `addExpiration remove_target_effect` (mirror stepOfTheWindHandler.js:29-39, the verified CLA-333 disengage pattern) + an `ability_use` log naming "Tactical Shift — free move up to half Speed, no Opportunity Attacks". Popup must echo half-Speed wording. Either drop the always-on `tactical_shift_no_oa` passive badge or gate `pushNoOAMoveBadges`/CharReactions:222 on that te instead of the permanent passive. For the CharReactions gate to bite, resolve targets through `characters` computedStats (or have cs carry a minimal automation digest) since cs combatants have no passives.

## Accepted residue (documented, not the FAIL basis)
Grid token half-speed movement and real OA-of-opponent suppression without a map remain unmodellable; the FAIL is the missing te/flag/log delta at the Second Wind trigger plus the ungated always-on badge and the dead consumer that let a logged OA roll against the protected target.

## Host registry note
EvasiveFighter secondWindUses sheet showed 4/4 after spend (popup said 3 remaining) — CLA-352 auto-refill/full-store race family; not counted against CLA-353.

## Cleanup
Admin Clear Change Data + Clear Campaign Log performed; server left running.
