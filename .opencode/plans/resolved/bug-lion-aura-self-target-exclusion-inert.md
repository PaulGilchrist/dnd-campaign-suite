# Lion aura (Path of the Wild Heart, Power of the Wilds) imposes Disadvantage even when the attack targets the bearer itself

## Summary
The Lion stance advertises (in two places of app-authored copy) that nearby enemies have Disadvantage "on attacks against targets **other than you**", but the live aura engine never consults the attack's target — an attacker hitting the Lion bearer itself still rolls with Disadvantage. The "other than you" exclusion (and the "…or another Barbarian who has this option active" exclusion) has zero producers and zero consumers.

## Steps to reproduce
Starting from test-campaign, GM tab on http://localhost:5173:
1. Maps → Battle Arena → Open. Tokens: AberrantSorcerer(15,9), FeyRanger(9,8), EvasiveFighter(1,8).
2. Items panel → drag `DraconicDragon` character chip onto cell (2,8) (adjacent to EvasiveFighter). It persists into `maps/battle-arena.json` players[].
3. Arm EvasiveFighter attacking DraconicDragon: `POST /api/campaigns/test-campaign/combatSummary` with the full-store `{value:{…}}` snapshot where `creatures[EvasiveFighter].targetName = "DraconicDragon"` (and DD hp raised to 200 to avoid death saves).
4. Give DD a Lion buff via the established runtime rig: `POST /api/campaigns/test-campaign/DraconicDragon` `{value:{activeBuffs:[{optionName:"Lion",range:"5 ft"}], activeConditions:[], …}}` (a Wild-Heart subclass swap via the Edit wizard would do it in-product, but the 2024 Wild Heart host is not in the fixture set — the aura utils read only the runtime buff, so the stamp rig is faithful to the consumer seam).
5. Ensure DD's ally list is legacy-unedited (no `selectedAllies` key; reload the tab after clearing to dodge the separate stale-key issue — see bug-changedata-key-removal-stale-on-mounted-tab.md).
6. On EvasiveFighter's sheet, click the Glaive "+9" attack cell.

## Expected behavior
The roll is a single d20 in `mode:"normal"`: the attack's target IS the Lion bearer, and both app-authored copies promise the exclusion —
- `src/components/char-sheet/modals/shared/CombatStanceModal.jsx:11` — "Enemies within 5 ft have Disadvantage on attacks against targets other than you"
- `src/services/automation/handlers/combat/combatStanceHandler.js:444` — "…Disadvantage on attack rolls against targets other than you or another Barbarian with this option active."
- `public/data/2024/classes.json` Barbarian → Path of the Wild Heart → Power of the Wilds (lv14) description.

## Actual behavior
The popup prints `d20 17, 17 → 17 +9 … Disadv (conditions)` and the campaign log roll entry is machine truth:
`{"rolls":[17,17],"total":17,"mode":"disadvantage","targetName":"DraconicDragon","name":"Glaive","characterName":"EvasiveFighter"}`
Verified twice — with the edited list `[DraconicDragon, EvasiveFighter]` (aura kept on a named ally, mode:disadvantage vs target=bearer) and with the legacy unedited bearer (mode:disadvantage vs target=bearer). The engine never exempts attacks on the bearer.

## Likely location
Confident on the seam, guessing on intent:
- `src/services/combat/auras/lionAuraUtils.js` — `getLionDisadvantageAgainst({attackerName, campaignName, mapData, skipRangeCheck})` doesn't receive `targetName` at all, so exclusion is impossible inside the util.
- `src/services/automation/contextBuilder-map.js:173-179` (`accumulateAuraCounts`) — `lionOpts` is built without `targetName` even though `base.targetName` is in scope one line above (used by the `protection` te check at :180 and corona at :183). The unit suite (lionAuraUtils.test.js) pins the no-target signature, so this is an unimplemented half of the authored rule, not a regression.
- Grep `other than you` app-wide: only prose (CombatStanceModal, combatStanceHandler, StepsOfTheFey, fighting-style reactions) — zero exclusion consumers.

## Suggested fix
Thread `targetName` into `lionOpts` in `accumulateAuraCounts` and skip the disadvantage when `targetName === bearerName` inside `getLionDisadvantageAgainst` (mirror the existing `player.name === attackerName` skip). The "another Barbarian who has this option active" clause additionally needs a scan for other Lion-buff holders matching the target — likely worth deferring with a note; the bearer-self exclusion is the one both UI copies promise. Unit tests in `lionAuraUtils.test.js` must be extended (current "betrayal ally-list flip" rows pin a signature with no target axis).

## Severity
Broken feature (rules engine close-but-not-exact: right trigger, wrong condition). Punishes the exact attack the feature text says is safe, silently biasing every Lion-vs-bearer melee exchange.

## Resolution
FIXED 2026-11-03 — diagnosis in the bug file confirmed against the real code: the engine had zero consumers of the "other than you" exclusion. The live roll fired on the **gridless sync lane** (`resolveLionAura` → `getLionDisadvantageAgainst` with `skipRangeCheck`, DD present in `combatSummary` as a type-player Lion holder), so both production call sites needed the target axis, not just `accumulateAuraCounts`.

**Changes:**
- `src/services/combat/auras/lionAuraUtils.js` — `getLionDisadvantageAgainst` now accepts `targetName`; per-bearer skip `if (player.name === targetName) continue;` mirrors the existing attacker skip and the `taunting_step` gate (`conditionEffects.js:869`). Kept as a bare `===` (no truthy `&&`) to stay under the complexity-15 ceiling; null targetName stays lenient (nameless players are refused at the drop seam, fix#39). Comment notes the deferred "another Barbarian who has this option active" clause per the suggested fix.
- `src/services/automation/contextBuilder-map.js` — `lionOpts` threads `targetName: base.targetName` (both targetPos branches).
- `src/services/automation/contextBuilder-sync.js` — `resolveLionAura(playerName, targetName, campaignName)` passes `targetName` through; the modeResolvers row supplies it from scope.
- `src/services/combat/auras/lionAuraUtils.test.js` — new `describe('… self-target exclusion (targets other than you)')`: 7 faces — measured-grid exempt, skipRangeCheck exempt, third-party target still disadvantaged, second in-range bearer still fires when target is the first bearer (per-bearer exclusion), null/undefined targetName lenient (legacy), gridless-context-lane exempt. Header comment documents the target axis.
- `src/services/automation/contextBuilder-sync.wolf-aura.test.js` — pinned lion call-args expectation extended with `targetName: 'Thug 1'` (intentional contract change).

5e/2024 twin check: lionAuraUtils is a single shared module (no 2024 fork); wolf/duplicity intentionally keep source semantics (wolf's prose divergence is the separate owner-ruling backlog item, untouched).

**Verification:**
- Live repro (pre-fix): test-campaign GM tab, DD token dragged to (2,8) via Items-panel char-chip drop, cs POST armed `creatures[EvasiveFighter].targetName='DraconicDragon'` (hp 200), DD stamped `activeBuffs:[{optionName:'Lion',range:'5 ft'}]` legacy-unedited. Glaive "+9" popup: `d20 6, 20 → 6 +9 … Disadv (conditions)`; log: `rolls:[6,20] mode:"disadvantage" targetName:"DraconicDragon"` — bug confirmed exactly.
- Live re-verify (post-fix, after hard reload + re-select): same rig, target = bearer → popup `d20 1 +9` single die, no Disadv chip; log `mode:"normal"` ✔. Adjacency faces (target re-armed to non-bearer FeyRanger): Glaive `mode:"disadvantage"` (range-band auto-miss) and Shortbow `mode:"disadvantage"` with popup chip **"Disadv (conditions)"** — the aura's own channel still fires on non-bearer targets, exclusion did not leak. 4 log roll entries total agree with popups.
- Tests: `npx vitest run lionAuraUtils.test.js contextBuilder-sync.wolf-aura.test.js` → 31 passed; area run `auras + contextBuilder*` → 12 files / 201 passed; full suite → 3035 files / 33,269 passed, exit 0. `npm run lint` → zero warnings.
- Cleanup: battle-arena.json restored to 3-token baseline (DD token removed via maps PUT from a map-unmounted tab), change-data `{}` + log `[]` via Admin panel, zero campaign-lock denials.
