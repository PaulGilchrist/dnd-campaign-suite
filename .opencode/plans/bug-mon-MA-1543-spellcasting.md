# Bug Report — MA-1543 Storm Giant Spellcasting

**VERDICT: FAIL (a) — zero cast links; DATA drift (missing `<strong>`/`<em>` spell markup)**

Row: MA-1543 · Monster: Storm Giant (`storm-giant`) · Action: Spellcasting · save_dc 18 Wisdom (display/authored only)

## Summary

The Spellcasting row on the Storm Giant card renders as inert plain text. No per-spell
cast links (`mc-dice-link-spell`) appear for Detect Magic, Light, or Control Weather, so
the row offers **zero cast affordance**. The renderer feature (SpellCastLinks) is live and
mature — this is authoring DATA drift in `public/data/monsters.json`, not an unimplemented seam.

## Root Cause

`extractSpellNamesFromSpellcasting()` (src/components/encounter/MonsterCardHelpers.js:392)
extracts spell names **only** from `<strong>`/`<em>` markup inside the Spellcasting
description. The Storm Giant row carries no markup:

```
"The giant casts one of the following spells, requiring no Material components and using
Wisdom as the spellcasting ability (spell save DC 18): At Will: Detect Magic, Light;
1/Day: Control Weather"
```

- `extractSpellNamesFromSpellcasting(desc)` → `[]`
- `SpellCastLinks` (src/components/encounter/MonsterAction.jsx:82-84) early-returns `null`
  when `names.length === 0`
- No plain-text spell-name fallback exists anywhere in `src/` (grep "At Will" hits only monsters.json)

Working twin in the same file (dao, MA lineage verified by existing tests):

```
"<strong>At Will:</strong> <em>Detect Evil and Good</em>, <em>Detect Magic</em>, ..."
```

There is also no `spells:` sub-list on the Storm Giant row (free-text only), and per the
MA-1294 structural gate spellcasting rows render no DC chip (expected — not the failure).

## E2E Evidence (Playwright, localhost:5173, test-campaign)

1. EB exact "Storm Giant" → Join Encounter → card opened (first tile click absorbed §138;
   modal `mc-overlay` confirmed present).
2. Spellcasting row DOM: `<strong>Spellcasting.</strong>` + plain-text description span.
   `document.querySelectorAll('.mc-dice-link-spell')` → **0 spell chips**.
   Same card arms non-spell chips normally (Storm Sword/Thunderbolt `+14`, Lightning Storm
   `10d10` + `DC 18 Dexterity` clickable) — card is live; only the spell lane is dead.
3. Step 3 (cast Detect Magic ×2 at-will, Control Weather 1/Day spend + exhausted refusal)
   **could not be exercised** — affordance absent, nothing to press. No ability_use/spell
   logs, no monsterSpellUses tracking, no uses-exhausted refusal reachable from this row.

## Expected vs Actual

| Expected | Actual |
|---|---|
| Cast links: Detect Magic, Light (at-will repeatable), Control Weather (`1/Day · N left` counter) | plain text only, 0 links |
| Control Weather 2nd press → uses-exhausted refusal + log | unreachable |
| Wisdom / DC 18 display/authored only (no listed spell needs a save) | n/a — no lane armed |

## Fix Direction (data-only)

Re-markup the Storm Giant Spellcasting description in `public/data/monsters.json` to the
house style (cf. dao):

```
"The giant casts one of the following spells, requiring no Material components and using
Wisdom as the spellcasting ability (spell save DC 18):\n<strong>At Will:</strong>
<em>Detect Magic</em>, <em>Light</em>\n<strong>1/Day:</strong> <em>Control Weather</em>"
```

`extractSpellcastingSpellUses()` then yields `{ "Control Weather": 1 }` and the MA-0020
numeric gate provides the 1/Day counter + exhausted refusal. Note "At Will:" must remain a
`<strong>` header (extractor skips names ending in `:`), and Control Weather must fall
under the `1/Day:` header for the uses gate to arm. Verify twins: MA-1016 (ice mephit
Fog Cloud uses gate), MA-0674 (Control Weather advisory zero-target class).

## Cleanup Verified

Admin → Clear Change Data + Clear Campaign Log accepted; `/api/campaigns/test-campaign/log` →
`[]`; change-data shows no Storm Giant and blanked initiative; initiative tracker empty of
monster entries.
