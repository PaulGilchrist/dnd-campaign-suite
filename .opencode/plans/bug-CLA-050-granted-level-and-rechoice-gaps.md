# CLA-050 — Circle of the Land Spells (Druid 2024, lv3, passive) — VERDICT: PASS-subset

## Canonical app data (`public/data/2024/classes.json`, Druid → Circle of the Land → "Circle of the Land Spells")
> "Choose one land type (arid, polar, temperate, tropical) after each Long Rest.
> ARID LAND: Level 3: Blur, Burning Hands, Fire Bolt. Level 5: Fireball. Level 7: Blight. Level 9: Wall of Stone.
> POLAR LAND: Level 3: Fog Cloud, Hold Person, Ray of Frost. Level 5: Sleet Storm. Level 7: Ice Storm. Level 9: Cone of Cold.
> TEMPERATE LAND: Level 3: Misty Step, Shocking Grasp, Sleep. Level 5: Lightning Bolt. Level 7: Freedom of Movement. Level 9: Tree Stride.
> TROPICAL LAND: Level 3: Acid Splash, Ray of Sickness, Web. Level 5: Stinking Cloud. Level 7: Polymorph. Level 9: Insect Plague."
Automation: `type: "circle_of_the_land_spells"`, `casting_time: "passive"`. Data spells carry `landType` keys (verified: all 24 entries, lowercase arid/polar/temperate/tropical at levels 3/3/3/5/7/9 per land).

## What works (verified live, test-campaign, Wild_Sage_Druid swapped Sea→Land)
- **Land chooser UI:** feature row is clickable → `CircleOfTheLandSpellsModal` with all 4 lands; hover preview shows exact per-land spells+levels; selecting Arid writes runtime `_circleOfTheLandType="Arid"`, logs `ability_use … "Chose land type: Arid"`, closes modal. (Modal source: `src/components/char-sheet/modals/CircleOfTheLandSpellsModal.jsx`; trigger: `circleOfTheLandSpellsHandler.js` → `CharSpecialActions.jsx` MODAL_DISPATCH.)
- **Spell grant exact:** post-choice actionable rows gained exactly Blur, Burning Hands, Fire Bolt, Fireball, Blight, Wall of Stone (added vs pre-choice baseline: Sleet Storm/Polymorph pre-existed). No other land's spells granted (`spellCalc2024.addMajorSubclassSpells` filters `subclassSpell.landType !== chosenLandType`, and grants nothing before a choice — baseline confirmed empty of CotL spells). `prepared:'Always'` marker modeled.
- **Display:** sheet header stamps "Druid (circle of the land-arid)"; badge "Circle of the Land: Arid"; Land's Aid text reflects land choice (Arid=Fire resistance, per `automationPassives.js:321` landMappings).
- **Consumers exist everywhere:** handler registry, automationRouter `routePassiveSpecial`, infoBuilder `resource.js`, spellCalc2024, longRest, CharSheet/CharClassFeatures, tests. Not half-implemented.

## Gaps (why subset, not full PASS)
1. **Fixed granted levels not honored.** Sheet/actions show and cast at spell-DB canonical levels, not classes.json fixed levels: Burning Hands shown/cast as **level 1** (canonical L3), Fire Bolt as **Cantrip** (canonical L3), Fireball **3** (L5), Blight **4** (L7), Wall of Stone **5** (L9), Blur **2** (L3). Chooser offers free upcast lv1→9. Modal preview shows the classes.json levels ("level 3"…), so the two displays contradict each other. If 2024 land spells are meant fixed-level per this app's own data, casting lane ignores it.
2. **Long-rest rechoice cadence coded but not enforced live.** `restRules-longRest.js:447` nulls `_circleOfTheLandType`, and a live Long Rest did reset Natural Recovery counters (`naturalRecoverySlots: null`), BUT runtime GET afterwards shows `_circleOfTheLandType: 'Arid'` survived; badge/spells/header stayed Arid, chooser never auto-popups. Rechoice is manual-modal-only.
3. **Cast execution blocked by generic pre-existing bug (out of CLA-050 scope).** Every sheet-initiated cast throws `[useSpellCastExecutor] executeSpellCast error: activeConditions must be an array for caster` — reproduced on Burning Hands (CotL-granted), Cure Wounds (pre-known), and Mind Sliver on a never-swapped character (AasimarTest). Cast chooser still consumed a lv1 slot (chooser "4 slots"→"3") and logged a `spell` entry before the executor threw. Rolls never complete. Blocks cast-roll demo for ALL automations, not CotL-specific.

## Registry/cleanup
- Wild_Sage_Druid: Circle of the Sea → Circle of the Land (test) → **restored Circle of the Sea, disk-verified**.
- Goblin joined for combat then removed (confirm-dialog accepted); encounters.json untouched (all entries pre-existing, mtime predates session).
- Admin: Clear Change Data + Clear Campaign Log executed; log API `[]`, runtime `{"value":null}`, change-data file removed — quiet.
