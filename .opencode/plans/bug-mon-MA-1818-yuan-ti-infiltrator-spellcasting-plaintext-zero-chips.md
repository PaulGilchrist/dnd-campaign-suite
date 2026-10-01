# Bug — MA-1818 Yuan-ti Infiltrator Spellcasting: plain-text spell names = zero cast chips (row inert, MA-1742/MA-1814 exact twin, MA-0421 markup-gap family)

- ID: MA-1818 · stableKey yuan-ti-infiltrator|actions|3 · category actions · actionType spellcasting
- Verified: 2026-10-01 · campaign test-campaign (locked) · dev :5173/:80
- Verdict: **FAIL(b)/DATA** — one-field fix (description markup), disk save_dc/save_type pair already present.

## Expected (row verbatim, manifest MA-1818; disk bytes match)
"The yuan-ti casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 12): At Will: Animal Friendship (snakes only); 2/Day: Suggestion"
A row named "Spellcasting" should render per-spell `.mc-dice-link-spell` cast chips (SpellCastLinks) for Animal Friendship / Suggestion, with 2/Day uses-gating on Suggestion (§57).

## Actual
- Disk `yuan-ti-infiltrator.actions[3]` fields = `name, description, save_dc:12, save_type:"Wisdom"` — numeric pair PRESENT, but description contains **zero `<strong>`/`<em>` tags** (byte-check: `'<strong>' in desc == False`, `'<em>' in desc == False`).
- Live `.mc-overlay` (INNER `img.avatar-image` alt "Yuan-ti Infiltrator 1", 40/40 ini 4, target Bandit 1) renders the row as
  `<div class="mc-action "><strong>Spellcasting.</strong> <span>The yuan-ti casts … At Will: Animal Friendship (snakes only); 2/Day: Suggestion</span></div>` —
  **0 `.mc-dice-link-spell`, 0 `.mc-dice-link`, 0 role=button in the row**. "Animal Friendship"/"Suggestion"/"DC 12" occur as PLAIN TEXT only (textContent hits, no affordance). Sibling rows DO arm chips (Scimitar "+3", Poison Ray "+4"), so the card itself is live — the Spellcasting row alone is markup-dead.
- Zero-affordance probe: row.click() + inner-span click → no clickable descendant found, zero popup, zero modal, zero new overlay (.mc-overlay count 1→1), **zero log delta** (log GET 16→16, zero `ability_use`), zero console errors, no spellUses runtime keys created on `Yuan-ti Infiltrator 1` (keys stay `lastAttackRoll, _lastRollContext, pendingCombatSuperiorityPrompt`). `mc-dice-link-spell-spent` count 0 (uses-gate untestable — no chip exists to press).
- Row-level `save_dc:12`/`save_type:"Wisdom"` never renders its own chip here: Spellcasting-name rows fork to SpellCastLinks XOR ActionSaveRoll (MonsterAction.jsx:397 row-name gate) — §115/§89 structural header-swallow, not counted as the failure. Suggestion Wisdom DC 12 chip absence is the same root cause (no chip at all).

## Triple-twin — MA-1742 + MA-1814 (same defect, same adjudication line)
- `.opencode/plans/bug-mon-MA-1742-yochlol-spellcasting-plaintext-zero-chips.md` — byte-identical fingerprint: plain-text spellcasting description → 0 chips, numeric save pair present but header-swallowed, siblings live.
- `.opencode/plans/bug-mon-MA-1814-yuan-ti-abomination-spellcasting-plaintext-zero-chips.md` — same yuan-ti family, same "At Will: Animal Friendship (snakes only); N/Day: Suggestion" plain-text shape.
- MA-1818 joins §1088-1089 (MA-1543 Storm Giant FAIL(b)/DATA twin) adjudication line "plain-text=FAIL(b) §1088". Third manifest row of this exact family (yochlol / yuan-ti abomination / yuan-ti infiltrator).

## Grep citations (parser requirement)
- `src/components/encounter/MonsterCardHelpers.js:395` `extractSpellNamesFromSpellcasting`: `const re = /<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g;` — harvests spell names **ONLY** from `<strong>`/`<em>` markup; plain text yields `[]`.
- `src/components/encounter/MonsterAction.jsx:84` `SpellCastLinks`: `names.length === 0 → return null` → zero chips.
- `src/components/encounter/MonsterAction.jsx:397` `/^spellcasting$/i` row-name gate + SpellOrSaveLinks XOR fork — chip path arms on row NAME + tier markup only (§230); numeric pair passes its gate yet row stays dead (MA-1230 fingerprint: "numeric save_dc pair present ≠ chips").
- `src/components/encounter/MonsterCardHelpers.js:434` `extractSpellcasting_spell_uses`: same markup-only regex; `N/Day` headers bind ONLY to marked names → **2/Day "Suggestion" usage limit is currently invisible AND ungated (§144)** — once markup is applied, `2/Day:` parses as uses-header and binds Suggestion max 2 (chip shows "(2/Day · N left)"); uses-gate refusal-on-third-press (§57) untestable live today.

## Working-format template (MA-1543 markup fix, registry-verified precedent)
- MA-1543 Storm Giant (verified) disk byte-shape: `"…(spell save DC 18):\n<strong>At Will:</strong> <em>Detect Magic</em>, <em>Light</em>\n<strong>1/Day:</strong> <em>Control Weather</em>"`.
- MA-0524 Couatl (verified): same `\n<strong>At Will:</strong> <em>…</em>` shape; archmage/lich dao house shape uses `<br>` separators.

## Fix (one-field, storm-giant/couatl byte-shape)
Both spells resolve in BOTH `public/data/spells.json` and `public/data/2024/spells.json` (checked) — markup-only fix arms live chips immediately. Rewrite `yuan-ti-infiltrator.actions[3].description` to:

"The yuan-ti casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 12):\n<strong>At Will:</strong> <em>Animal Friendship</em> (snakes only)\n<strong>2/Day:</strong> <em>Suggestion</em>"

- Headers ending ":" stay safe (§161 fake-chip guard: `endsWith(':')` skipped for names; `2/Day:` parsed as uses-header → binds Suggestion max 2 — per-spell uses NOW unmodeled because unmarked; fix also arms the 2/Day gate).
- "(snakes only)" advisory paren stays outside markup (§158 unresolvable-name guard untouched).
- Row-level `save_dc:12` + `save_type:"Wisdom"` already byte-present — no numeric fix needed (§89 pair satisfied).

## Evidence
- .opencode/plans/ma1818-spellcasting-row-zero-affordance.png (overlay open; Scimitar/Poison Ray chips vs plain-text Spellcasting row)
- Zero-affordance probe: overlays 1→1, log 16→16, zero ability_use, zero console errors, zero spellUses keys.
- Manifest `docs/monster-actions-manifest.json` and `public/data/monsters.json` untouched by this run; no git writes.
