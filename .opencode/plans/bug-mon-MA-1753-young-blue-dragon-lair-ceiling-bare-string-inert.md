# Bug — MA-1753 Young Blue Dragon "Unnamed lair actions 1": ceiling-collapse lair action is a BARE STRING on disk → static text-only row, zero affordance; buried/restrained/can't-breathe clauses additionally unmodeled even post-name-fix (bare-string inert family, MA-1747 lane)

- ID: MA-1753 · Young Blue Dragon · category lair_actions · actionIndex 0
- Disk key: `young-blue-dragon.lair_actions[0]` = **BARE STRING** (no dict, no `name`, no `save_dc`, no `damage_dice_primary`)
- Verified: 2026-09-30 · campaign test-campaign (locked) · dev :5173/:80
- Verdict: **FAIL(b)/DATA** — two-layer kill: bare-string branch never reaches the name gate at all; even after a name-fix, the buried-state clauses are grep-zero advisory residuals (§70).
- Manifest untouched. Registry untouched.

## Disk quote (public/data/monsters.json → young-blue-dragon.lair_actions[0])
```
"Part of the ceiling collapses above one creature that the dragon can see within 120 feet of it. The creature must succeed on a DC 15 Dexterity saving throw or take 10 (3d6) bludgeoning damage and be knocked prone and buried. The buried target is restrained and unable to breathe or stand up. A creature can take an action to make a DC 10 Strength check, ending the buried state on a success."
```
`lair_actions[1]` (MA-1754, next in queue) is byte-identical prose. Manifest row extracts `conditions:["prone","restrained"]` labels only (§118) — no engine keys.

## Kill chain (code fingerprints, live-confirmed today)
- `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable`: `if (!row || typeof row !== 'object' || !row.name) return false;` — bare string fails `typeof row !== 'object'` BEFORE the name check; any nameless/structured row also dies on `!row.name` (established MA-1747/48/49 lane).
- `src/services/encounter/MonsterCardBody.jsx:358` — `typeof la === 'string' || !isLairRowClickable(la)` → static branch `:361` plain `<span dangerouslySetInnerHTML>`; zero `.mc-dice-link-lair` chips ever render for this row (`:381` unreachable).
- Header comment `MonsterCardBody.jsx:352-355`: legacy plain-string rows keep static render, "~600 monsters regression-protected" — by-design inert family, DATA fix required.

## Live evidence (test-campaign header verified; board IN initiative round 1: YBD 1 (init 22) + Bandit 1 (888) + Bandit 2 (947))
- INNER `img.avatar-image` "Young Blue Dragon 1" → `.mc-overlay` open; sibling chips confirm card is interactive (Rend `+9`, Lightning Breath `10d10` + `DC 16 Dexterity` are live buttons).
- Lair Actions section row #1: `div.mc-action` = plain prose span. **Affordance inventory: buttons=0, [role=button]=0, [tabindex=0]=0, .mc-dice-link=0, .mc-dice-link-lair=0, `<strong>`=0 (no name header), icons=0.**
- Click probe on row #1: zero popup, zero save prompt, zero `.mc-prerequisite-refusal`, overlays unchanged (`mc-overlay` only).
- Log GET before/after (own :80 GETs): **27 → 27, zero delta.** Zero console errors.
- Screenshot: `.opencode/plans/ma1753-lair-row-bare-string-inert.png`.

## Grep citations (§70 grep-zero advisory, src excl. tests)
- `buried`: non-consumer prose only — randomEventService.js:122/:182 (desert flavour text) + MonsterCardHelpers.js:3129 (comment). **Zero buried-state mechanic/consumer anywhere.**
- `restrained` as te: `targetEffectDefinitions.js` has NO `effect: 'restrained'` — matches are description text of other tes (petrification stages :523-:896, webs :1155, whirlwind :1173, imprisionment :1089). Restrained lives only as a CONDITION (conditionUtils.js / conditionEffects.js). No buried→restrained bridge, no suffocation/"can't breathe" consumer.
- `pull`: only `pulled_toward` te (:1401, Movement group — attack-hit pull 5 ft, e.g. Charged Tendril) — different mechanic, not this row's ceiling collapse; zero pull hits in MonsterCardBody/monsterLairActions.
- Conclusion: even post-name-fix the buried/restrained/can't-breathe + DC 10 STR escape clauses stay advisory/GM-enforced.

## Fix template (MA-0378 named-structured-row shape; single-target point, no zone)
```json
{"name": "Ceiling Collapse", "description": "<existing prose>", "save_dc": 15, "save_type": "Dexterity",
 "damage_dice_primary": "3d6", "damage_type_primary": "Bludgeoning",
 "save_effect": "Failure: 10 (3d6) bludgeoning damage, knocked prone and buried (restrained, can't breathe or stand up). Success: no damage."}
```
→ arms 'save' + damage chips through the gated affordance (MonsterCardBody.jsx:372-388 lane); prone rides the save seam per MA-1748 finding. Residuals advisory (§70 accepted): buried-state marker (no te), restrained bridge, suffocation, DC 10 STR escape action, initiative-20 cadence ("different lair action each round") — all GM-enforced. NO `zone` key: RAW is one creature, not an area. DO NOT edit `docs/monster-actions-manifest.json`.

## Evidence
- .opencode/plans/checkpoint-mon-MA-1753.md (probe record)
- .opencode/plans/ma1753-lair-row-bare-string-inert.png
- Sibling bugs: bug-mon-MA-1747-…pools-bare-string-inert.md (same bare-string kill), bug-mon-MA-1748/49 (name-gate family)
- Note: lair_actions[1] = MA-1754 byte-identical → same verdict expected; board left IN initiative for it.
