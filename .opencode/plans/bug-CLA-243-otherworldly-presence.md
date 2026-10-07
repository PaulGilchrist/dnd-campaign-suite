# Bug CLA-243 — Otherworldly Presence (misclassified as Rogue class feature)

**VERDICT: FAIL — automation does not exist for any Rogue; canonical trait is Tiefling race.**
Verified 2026-10-07 via Playwright (reads only, localhost:5173, header `test-campaign`).

## Canonical grep evidence

- `public/data/2024/classes.json` — Rogue majors enumerated: Arcane Trickster, Assassin, Soulknife, Thief. **No major grants Thaumaturgy; no major feature named "Otherworldly Presence" at any level.** Rogue `spell_casting_ability: "Intelligence"`.
- Trait lives in `public/data/2024/races.json:911` under **Tiefling**:
  > "You know the Thaumaturgy cantrip. When you cast it with this trait, the spell uses the same spellcasting ability you use for your Fiendish Legacy trait."
  Automation: `{ "type": "cantrip_spellcasting_ability", "cantripName": "Thaumaturgy", "spellcastingAbility": "Charisma" }`
  (Note: canonical sentence is "same spellcasting ability you use for your Fiendish Legacy trait" — NOT "same ability modifier as your class spellcasting".)
- `docs/automations-manifest.json:4594` CLA-243: `"class": "Rogue"`, `"type": "classFeature"`, `"verified": "not verified"` — but its own `expectedBehavior` quotes the Tiefling Fiendish Legacy text verbatim. Manifest mislabeled.

## Handler lane (exists, race-sourced only)

- `src/services/rules/core/spellCalc2024.js:140-152` `applyCantripAbilityOverride` — stamps/overrides Thaumaturgy row with `spellCastingAbility: Charisma`; dispatched at `spellCalc2024.js:309` for `feature.type === 'cantrip_spellcasting_ability'` (fed from race trait automation, not class majors).
- Playbook lanes: §CLA-222 (major cantrip grant, `spellCalc2024.js` addMajorSubclassSpells ~:98 — gates `playerStats.level >= spellLevel`; Thaumaturgy never enters via Rogue majors), §CLA-234 (ritual-stamp lane, not applicable), §CLA-199 (Inspiring Movement, unrelated Bard).
- `src/services/character/featureCategories.js:231` lists "Otherworldly Presence" in categories2024 passive-name list (renders only when the granted feature is present — Tiefling).

## UI evidence (Playwright, localhost:5173, header `test-campaign`)

- **Host AasimarTest** (disk: race Aasimar, Rogue (arcane trickster) lv20, rules 2024 — `public/campaigns/test-campaign/AasimarTest.json`): Spells table rows = Light, Minor Illusion, Color Spray, Command, Invisibility, Charm Monster. **No Thaumaturgy row** (leg 1 holder FAIL — host is Aasimar, trait is Tiefling). Features/Special Actions rows render LightBearer ("You know the Light cantrip. Charisma is your spellcasting ability for it."), Cunning Strike, Magical Ambush, Versatile Trickster, Spell Thief, etc. **No "Otherworldly Presence" row** (leg 4 FAIL).
- No cast affordance exists → legs 2–3 unexecuted (no row/modal to click). Ability per data lane would be **Charisma** (races.json + LightBearer analogue), not INT despite AT's Intelligence spellcasting.
- **Control HexWarlock**: page snapshot find — zero matches for "Thaumaturgy" and "Otherworldly Presence" (correctly absent).
- Cleanup GET-verified: `GET /api/campaigns/test-campaign/log` → `[]` (0 rows, 0 thaum/otherworldly); `GET /api/campaigns/test-campaign/change-data` → 200. **No writes performed.**

## Required fixes

1. Manifest CLA-243: `class` → Tiefling (race trait), type → raceTrait/lineage lane; or re-scope automation ID.
2. Test host: needs a lv20+ Tiefling (Fiendish) Rogue to exercise legs 1–4 (write — GM action, not agent).
3. Verify cast face on Thaumaturgy row: SpellDetailPopup effect chooser (voice/eyes/ground) + `ability_use` log with Charisma DC, gridless advisory acceptable.
