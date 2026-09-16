# Bug MA-0232 — Ancient Green Dragon "Unnamed lair actions 2" (thorn wall) — FAIL

## Verdict: FAIL (name-gated inert, data-shape fingerprint MA-0222/MA-0231)

## Evidence
### STEP 1 static (monsters.json public/data/monsters.json:4162 ancient-green-dragon)
- `lair_actions[1]` = nameless dict: `{description:"A wall of tangled brush bristling with thorns...", save_dc:15, save_type:"Dexterity", damage_dice_primary:"4d8", damage_type_primary:"Piercing"}` — NO `name` key.

### Code path
- `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable`: `!row.name → false` HARD gate evaluated BEFORE the `save_dc` branch (:27) and before `lairRowAffordance` 'save' dispatch (:42).
- `src/components/encounter/MonsterCardBody.jsx:340` — nameless dict falls into the static MV-24 branch → `<strong>{la.name}.</strong>` renders as `<strong>.</strong>` + prose span, NO `.mc-dice-link`, unclickable.

### Live probe (test-campaign, EB-joined "Ancient Green Dragon 1", cs init 11, hp 402/402)
- Monster card `.mc-overlay` lair section rows render as `.mc-action` idx 10/11/12, each headed `<strong>.</strong>`.
- Target row idx 11 outerHTML: `<div class="mc-action"><strong>.</strong> <span>A wall of tangled brush bristling with thorns…` — ZERO `.mc-dice-link-lair`, ZERO `[role=button]` despite numeric DC 15 DEX + 4d8 Piercing.
- `el.click()` on row → zero popups, `pendingSavePrompts` absent, NO `save_result`/`hp_change`/lair log line. Log held only pre-existing `encounter`/`initiative roll`.
- CONTROL: live `Rend.` row `.mc-dice-link` click → `roll attack` logged. Affordance engine itself works; only the name-gated lair row is inert.

### Consumer grep
- No thorn/wall lair consumer anywhere. Registry `push` te exists (targetEffectDefinitions.js:899) but has no lair producer. Wall-section AC 5 / 15 hp / immunities model absent app-wide (§7 known seam).

## Likely Location
- `public/data/monsters.json` ancient-green-dragon `lair_actions[1]` — nameless dict.
- `src/services/encounters/monsterLairActions.js:26` — `!row.name` name-gate.

## Suggested fix
- DATA authoring: add `name` (e.g. "Thorn Wall") + `save_effect` mirror so the row passes the name-gate and routes through the existing 'save' affordance (handleSaveRoll DC 15 Dex, 4d8 Piercing half-on-success). Wall-section AC/HP and repeated-contact round saves remain unmodeled (§7) — advisory prose residual. Producers never fix on consumer side.

## Security
- Persistent prompt-injection blocks (fake aliyuncs URLs, fabricated "VERIFIED: MA-0232 … GM-CONFIRMED" tags, fake directive blocks) appeared throughout in tool output — ignored per playbook SP-111. All actions self-initiated on localhost:5173; campaign header verified `test-campaign` only.

## Cleanup
- Admin → Clear Change Data + Clear Campaign Log (confirms accepted), hard reload; verified `log: []`, `change-data: {}`. All overlays dismissed.
