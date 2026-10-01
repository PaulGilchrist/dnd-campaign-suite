# Bug — MA-1814 Yuan-ti Abomination Spellcasting: plain-text spell names = zero cast chips (row inert, MA-1742 exact twin, MA-0421 markup-gap family)

- ID: MA-1814 · stableKey yuan-ti-abomination|actions|4 · category actions · actionType spellcasting
- Verified: 2026-10-01 · campaign test-campaign (locked) · dev :5173/:80
- Verdict: **FAIL(b)/DATA** — one-field fix (description markup), disk save_dc/save_type pair already present.

## Expected (row verbatim, manifest MA-1814; disk bytes match)
"The yuan-ti casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 15): At Will: Animal Friendship (snakes only); 3/Day: Suggestion"
A row named "Spellcasting" should render per-spell `.mc-dice-link-spell` cast chips (SpellCastLinks) for Animal Friendship / Suggestion, with 3/Day uses-gating on Suggestion (§57).

## Actual
- Disk `yuan-ti-abomination.actions[4]` fields = `name, description, save_dc:15, save_type:"Wisdom"` — numeric pair PRESENT, but description contains **zero `<strong>`/`<em>` tags** (byte-check: `'<strong>' in desc == False`, `'<em>' in desc == False`).
- Live `.mc-overlay` (INNER `img.avatar-image` alt "Yuan-ti Abomination 1") renders the row as
  `<strong>Spellcasting.</strong> <span>The yuan-ti casts … At Will: Animal Friendship (snakes only); 3/Day: Suggestion</span>` —
  **0 `.mc-dice-link-spell`, 0 `.mc-dice-link`, 0 role=button in the row**. "Animal Friendship"/"Suggestion"/"DC 15" occur as PLAIN TEXT only (textContent hits, no affordance). Sibling rows DO arm chips (Bite "+7", Constrict "7d6 + 4" + "DC 15 Strength", Poison Spray "6d6" + "DC 14 Constitution"), so the card itself is live — the Spellcasting row alone is markup-dead.
- Zero-affordance probe: row.click() + inner-span click → zero popup, zero modal, zero new overlay (.mc-overlay count 1→1), **zero log delta** (log 46→46, zero `ability_use`), zero console errors, no spellUses runtime keys created on `Yuan-ti Abomination 1`. `mc-dice-link-spell-spent` count 0 (uses-gate untestable — no chip exists to press).
- Row-level `save_dc:15`/`save_type:"Wisdom"` never renders its own chip here: Spellcasting-name rows fork to SpellCastLinks XOR ActionSaveRoll (MonsterAction.jsx:397 gate, :349-351 spellcasting arm vs :374 save-shell arm) — §115/§89 structural header-swallow, not counted as the failure. Suggestion Wisdom DC 15 chip absence is the same root cause (no chip at all).

## MA-1742 twin (same defect, same day)
`.opencode/plans/bug-mon-MA-1742-yochlol-spellcasting-plaintext-zero-chips.md` — byte-identical fingerprint: plain-text spellcasting description → 0 chips, numeric save pair present but header-swallowed, siblings live. MA-1814 joins §1088-1089 (MA-1543 Storm Giant FAIL(b)/DATA twin) adjudication line "plain-text=FAIL(b) §1088".

## Grep citations (parser requirement)
- `src/components/encounter/MonsterCardHelpers.js:392-403` `extractSpellNamesFromSpellcasting`: `const re = /<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g;` — harvests spell names **ONLY** from `<strong>`/`<em>` markup; plain text yields `[]`.
- `src/components/encounter/MonsterAction.jsx:83-84` `SpellCastLinks`: `names.length === 0 → return null` → zero chips.
- `src/components/encounter/MonsterAction.jsx:397` `/^spellcasting$/i` row-name gate + `:349-351/:374` SpellOrSaveLinks XOR fork — chip path arms on row NAME + tier markup only (§230); numeric pair passes its gate yet row stays dead (MA-1230 fingerprint: "numeric save_dc pair present ≠ chips").
- `src/components/encounter/MonsterCardHelpers.js:431-446` `extractSpellcastingSpellUses`: same markup-only regex; `N/Day` headers bind ONLY to marked names → **3/Day "Suggestion" usage limit is currently invisible AND ungated (§144)** — once markup is applied, `3/Day:` parses at :440 and binds Suggestion max 3 (chip shows "(3/Day · N left)", MonsterAction.jsx:102); uses-gate refusal-on-fourth-press (§57) untestable live today.

## Working-format template (registry-verified precedent, same Wisdom-DC family)
- MA-1543 Storm Giant (verified) disk byte-shape: `"…(spell save DC 18):\n<strong>At Will:</strong> <em>Detect Magic</em>, <em>Light</em>\n<strong>1/Day:</strong> <em>Control Weather</em>"`.
- MA-0524 Couatl (verified): same `\n<strong>At Will:</strong> <em>…</em>` shape; MA-0421 Bone Naga (verified): `<strong>Name</strong>` shape; archmage/lich dao house shape uses `<br>` separators.

## Fix (one-field, storm-giant/couatl byte-shape)
Both spells resolve in BOTH `public/data/spells.json` and `public/data/2024/spells.json` (checked) — markup-only fix arms live chips immediately. Rewrite `yuan-ti-abomination.actions[4].description` to:

"The yuan-ti casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 15):\n<strong>At Will:</strong> <em>Animal Friendship</em> (snakes only)\n<strong>3/Day:</strong> <em>Suggestion</em>"

- Headers ending ":" stay safe (§161 fake-chip guard: `endsWith(':')` skipped for names, Helpers:399; `3/Day:` parsed as uses-header at Helpers:440 → binds Suggestion max 3; per-spell uses NOW unmodeled because unmarked — fix also arms the 3/Day gate).
- "(snakes only)" advisory paren stays outside markup (§158 unresolvable-name guard untouched).
- Row-level `save_dc:15` + `save_type:"Wisdom"` already byte-present — no numeric fix needed (§89 pair satisfied).

## Evidence
- .opencode/plans/ma1814-spellcasting-row-zero-affordance.png (overlay open; Bite/Constrict/Poison Spray chips vs plain-text Spellcasting row)
- Zero-affordance probe: overlays 1→1, log 46→46, zero ability_use, zero console errors.
- Manifest `docs/monster-actions-manifest.json` and `public/data/monsters.json` untouched by this run; no git writes.
