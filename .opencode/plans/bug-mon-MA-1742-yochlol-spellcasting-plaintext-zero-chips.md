# Bug — MA-1742 Yochlol Spellcasting: plain-text spell names = zero cast chips (row inert, MA-0421 markup-gap family)

- ID: MA-1742 · stableKey yochlol|actions|2 · category actions · actionType spellcasting
- Verified: 2026-09-30 · campaign test-campaign (locked) · dev :5173/:80
- Verdict: **FAIL(b)/DATA** — one-field fix (description markup), disk save_dc/save_type pair already present.

## Expected (row verbatim, manifest MA-1742; disk bytes match)
"The yochlol casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15): At Will: Detect Thoughts, Gaseous Form (self only), Web; 1/Day: Dominate Person"
A row named "Spellcasting" should render per-spell `.mc-dice-link-spell` cast chips (SpellCastLinks) for Detect Thoughts / Gaseous Form / Web / Dominate Person, with 1/Day uses-gating on Dominate Person (§57).

## Actual
- Disk `yochlol.actions[2]` fields = `name, description, save_dc:15, save_type:"Charisma"` — numeric pair PRESENT, but description contains **zero `<strong>`/`<em>` tags** (byte-check: `'<strong>' in desc == False`, `'<em>' in desc == False`).
- Live `.mc-overlay` (INNER `img.avatar-image` alt "Yochlol 1") renders the row as
  `<strong>Spellcasting.</strong> <span>The yochlol casts … At Will: Detect Thoughts, Gaseous Form (self only), Web; 1/Day: Dominate Person</span>` —
  **0 `.mc-dice-link-spell`, 0 `.mc-dice-link`, 0 role=button in the row**. Sibling rows DO arm chips (Caustic Lash "+8", Toxic Escape "DC 15 Constitution"), so the card itself is live — the Spellcasting row alone is markup-dead.
- Zero-affordance probe: row.click() → zero popup, zero modal, zero new overlay, **zero log delta** (log 12→12 entries, zero `ability_use`), zero console errors. `mc-dice-link-spell-spent` count 0 (uses-gate untestable — no chip exists to press).
- Row-level numeric `save_dc: 15` never renders here: Spellcasting-name rows fork to SpellCastLinks XOR ActionSaveRoll (MonsterAction.jsx:349-350, :397) — §1294/§89 structural, not counted as the failure.

## Grep citations (parser requirement)
- `src/components/encounter/MonsterCardHelpers.js:392` `extractSpellNamesFromSpellcasting`: `const re = /<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g;` — harvests spell names **ONLY** from `<strong>`/`<em>` markup; plain text yields `[]`.
- `src/components/encounter/MonsterAction.jsx:83-84` `SpellCastLinks`: `names.length === 0 → return null` → zero chips.
- `src/components/encounter/MonsterAction.jsx:397` `/^spellcasting$/i` row-name gate + `:349-350` SpellOrSaveLinks XOR fork — chip path arms on row NAME + tier markup only (§230); numeric pair passes its gate yet row stays dead (MA-1230 exact fingerprint: "numeric save_dc pair present ≠ chips").
- `src/components/encounter/MonsterCardHelpers.js:431` `extractSpellcastingSpellUses`: same markup-only regex; `N/Day` limits bind ONLY to marked names → unmarked 1/Day "Dominate Person" is invisible AND ungated (§144) — uses-gate refusal-on-second-press (§57) untestable live.
- Playbook: §118 / §57 / §89 (MA-0421), §1230, §1088-1089 (MA-1543 Storm Giant FAIL(b)/DATA twin), §1180 adjudication map ("plain-text=FAIL(b) §1088").

## Fix (one-field, archmage/lich/MA-1543 byte-shape)
All four spells resolve in BOTH `public/data/spells.json` and `public/data/2024/spells.json` (checked) — markup-only fix will arm live chips immediately. Rewrite `yochlol.actions[2].description` to the dao/archmage house shape:

"The yochlol casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15):&lt;br&gt;&lt;strong&gt;At Will:&lt;/strong&gt; &lt;em&gt;Detect Thoughts&lt;/em&gt;, &lt;em&gt;Gaseous Form&lt;/em&gt; (self only), &lt;em&gt;Web&lt;/em&gt;; &lt;strong&gt;1/Day:&lt;/strong&gt; &lt;em&gt;Dominate Person&lt;/em&gt;"

- Headers ending ":" stay safe (§161 fake-chip guard: `endsWith(':')` skipped for names; `1/Day:` parsed as uses-header at Helpers:441 → binds Dominate Person max 1).
- Row-level `save_dc:15` + `save_type:"Charisma"` already byte-present — no numeric fix needed (§89 pair satisfied).

## Evidence
- .opencode/plans/ma1742-board-before.png (board, round 1)
- .opencode/plans/ma1742-overlay-before.png (card open; spell names plain black vs "+8"/"DC 15 Constitution" chips)
- .opencode/plans/ma1742-spellcasting-row-zero-affordance.png (post-click, zero popup)
- .opencode/plans/ma1742-board-after.png (state preserved for MA-1743)
- .opencode/plans/checkpoint-mon-MA-1742.md (full probe record)
Manifest `docs/monster-actions-manifest.json` and `public/data/monsters.json` untouched by this run; no git writes.
