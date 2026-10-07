# BUG CLA-212 — LightBearer (2024 Aasimar) — Light cantrip row never rendered

**Verdict: FAIL** (unimplemented end-to-end for a class-with-no-spellcasting host)

## Canonical wording (public/data/2024/races.json:37-44)
> "You know the Light cantrip. Charisma is your spellcasting ability for it."

Automation metadata on disk (verified):
```json
{ "name": "LightBearer",
  "automation": { "type": "cantrip_spellcasting_ability",
                  "cantripName": "Light",
                  "spellcastingAbility": "Charisma" } }
```

## Host
- **AasimarTest** — lv20 Rogue (Assassin), rules 2024, race Aasimar, CHA 17 (+3), PB +6.
- Expected observable: Spells section with a **Light** cantrip row ("Always"), castable,
  with CHA-based math (container/row ability Charisma; spell attack +9, DC 17, or at minimum
  a Light row with `spellCastingAbility: "Charisma"` surfaced in SpellDetailPopup "Casting Ability:").

## Observed (live, localhost:5173, campaign header verified `test-campaign`)
- AasimarTest sheet: trait text **is** displayed in Character Advancement
  ("LightBearer: You know the Light cantrip. Charisma is your spellcasting ability for it.") — display-only, non-clickable, no cast affordance.
- **No "Spells" section, no "Cantrips Known" summary, no Light row anywhere on the sheet.**
- Positive control: ElderPaladin (caster) sheet renders the section normally
  ("Cantrips Known:", "Modifier: +5", "Save DC: 19") — so the section is present iff
  `playerStats.spellAbilities` is non-null (CharSpells.jsx:217 `{(playerStats.spellAbilities) && ...}`).
- Live module probe (read-only, live app modules via page context):
  `getSpellAbilities(allSpellsWithLight, AasimarTest-shapedStats)` → **NULL**.
  `lightRow: null`.

## Root cause
`src/services/rules/core/spellCalc2024.js`
- `getSpellAbilities` :580-581: `if (!spellAbilities) return null` runs **before**
  `applyAutomationSpellGrants` (:822) ever gets a chance to stamp the Light row.
- `ensureSpellAbilitiesContainer` :569-599 creates fallback containers for lineage cantrips,
  `shadow_arts`, Ritual Master, or non-empty `playerStats.spells` — it has **no case for
  `cantrip_spellcasting_ability` passives**. A Rogue Assassin with `spells: []` on disk
  (verified `public/campaigns/test-campaign/AasimarTest.json` → `spells: []`) gets `null`.
- The unit test `spellCalc2024-automation.test.js:261` ("adds cantrip_spellcasting_ability
  cantrip even when not in spell list") seeds `stats.spells = ['Fire Bolt']`, which creates the
  half-caster fallback container and masks exactly this gap — no zero-caster/empty-spells coverage.

## Fix direction (not applied)
Add to `ensureSpellAbilitiesContainer`: if `(playerStats.automation?.passives || []).some(f => f.type === 'cantrip_spellcasting_ability')` → `return SLOTLESS_CONTAINER()` (mirror the CLA-308 Shadow Arts pattern at :582-586). Then `applyCantripAbilityOverride` (:141-153) introduces the row, `remapSpellRow` (:477-491 lead) already carries `spellCastingAbility` across the detail remap, and `spellResolution.js` honours `spell.spellCastingAbility || spellAbilities.spellCastingAbility`. Consider also re-stamping container `spellCastingAbility` from the override when container-level ability is absent so header math (toHit/DC) reflects CHA for slotless-only casters.

## Evidence trail
- races.json trait block read (canonical quote above).
- Live sheet: no "Spells"/"Cantrips" text (`browser_find` zero matches) on AasimarTest.
- Positive control caster section rendered on ElderPaladin.
- Live `getSpellAbilities` probe → NULL.
- No state mutated; no cleanup required; dev server left running.
