# Bug — MA-1830 Yuan-ti Malison (Type 2) Spellcasting: plain-text spell names = zero cast chips (row inert, MA-1742/MA-1814/MA-1818/MA-1827 exact quint-twin, MA-0421 markup-gap family)

- ID: MA-1830 · stableKey yuan-ti-malison-type-2|actions|2 · category actions · actionType spellcasting
- Verified: 2026-10-01 · campaign test-campaign (locked, header checked every nav) · dev :5173/:80
- Verdict: **FAIL(b)/DATA** — one-field fix (description markup), disk save_dc/save_type pair already present.

## Expected (row verbatim, manifest MA-1830; disk bytes match — DISK WINS)
"The yuan-ti casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 13): At Will: Animal Friendship (snakes only); 2/Day: Suggestion"
A row named "Spellcasting" should render per-spell `.mc-dice-link-spell` cast chips (SpellCastLinks) for Animal Friendship / Suggestion, with 2/Day uses-gating on Suggestion (§57).

## Actual
- Disk `yuan-ti-malison-type-2.actions[2]` fields = `name, description, save_dc:13, save_type:"Wisdom"` — numeric pair PRESENT, but description contains **zero `<strong>`/`<em>` tags** (byte-check: `'<strong>' in desc == False`, `'<em>' in desc == False`).
- Live `.mc-overlay` (INNER `img.avatar-image` alt "Yuan-ti Malison (Type 2) 1", ini 21, target Bandit 1 AC 12) renders the row as
  `<div class="mc-action "><strong>Spellcasting.</strong> <span>The yuan-ti casts … At Will: Animal Friendship (snakes only); 2/Day: Suggestion</span></div>` —
  **0 `.mc-dice-link-spell`, 0 `.mc-dice-link`, 0 button, 0 role=button, 0 clickable descendants in the row** (full affordance inventory: `{mcDiceLinkSpell:0, mcDiceLink:0, buttons:0, roleButtons:0, anyClickable:0, spans:1}`). "Animal Friendship"/"Suggestion"/"DC 13" occur as PLAIN TEXT only (textContent hits, no affordance). Sibling rows DO arm chips (Bite "+5"), so the card itself is live — the Spellcasting row alone is markup-dead.
- Zero-affordance probe: row.click() + inner-span clicks → 0 popup, 0 modal, 0 new overlay (.mc-overlay count 1→1), **zero log delta** (log GET 13→13, zero `ability_use`, zero "casts" mentions campaign-wide), zero console errors, no spellUses runtime keys created on `Yuan-ti Malison (Type 2) 1` (keys stay `_lastRollContext, lastAttackRoll, pendingCombatSuperiorityPrompt`). `mc-dice-link-spell-spent` count 0 (uses-gate untestable — no chip exists to press).
- Row-level `save_dc:13`/`save_type:"Wisdom"` never renders its own chip here: Spellcasting-name rows fork to SpellCastLinks XOR ActionSaveRoll (MonsterAction.jsx:397 row-name gate) — §115/§89 structural header-swallow, not counted as the failure. Suggestion Wisdom DC 13 chip absence is the same root cause (no chip at all).

## Quint-twin — MA-1742 + MA-1814 + MA-1818 + MA-1827 (same defect, same adjudication line)
- `.opencode/plans/bug-mon-MA-1742-yochlol-spellcasting-plaintext-zero-chips.md` — byte-identical fingerprint: plain-text spellcasting description → 0 chips, numeric save pair present but header-swallowed, siblings live.
- `.opencode/plans/bug-mon-MA-1814-yuan-ti-abomination-spellcasting-plaintext-zero-chips.md` — yuan-ti family, same plain-text shape.
- `.opencode/plans/bug-mon-MA-1818-yuan-ti-infiltrator-spellcasting-plaintext-zero-chips.md` — same "At Will: Animal Friendship (snakes only); N/Day: Suggestion" plain-text shape.
- `.opencode/plans/bug-mon-MA-1827-yuan-ti-malison-type-1-spellcasting-plaintext-zero-chips.md` — **near-byte twin**: same DC 13, same description; Type 2 differs only by 1d8 Bite (vs 1d4) and 10 ft. reach (vs 5 ft.). MA-1830 completes the quint.
- Quint joins §1088-1089 (MA-1543 Storm Giant FAIL(b)/DATA twin) adjudication line "plain-text=FAIL(b) §1088". Fifth manifest row of this exact family (yochlol / yuan-ti abomination / yuan-ti infiltrator / yuan-ti malison type 1 / yuan-ti malison type 2).

## Grep citations (parser requirement)
- `src/components/encounter/MonsterCardHelpers.js:392` `extractSpellNamesFromSpellcasting`: `const re = /<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g;` (line 395) — harvests spell names **ONLY** from `<strong>`/`<em>` markup; plain text yields `[]`.
- `src/components/encounter/MonsterAction.jsx:82` `SpellCastLinks`: `names = spellNames ?? extractSpellNamesFromSpellcasting(...)` (line 83) → `names.length === 0 → return null` → zero chips.
- `src/components/encounter/MonsterAction.jsx:397` `const isSpellcastingRow = /^spellcasting$/i.test(action.name || '')` row-name gate + SpellCastLinks XOR ActionSaveRoll fork — chip path arms on row NAME + tier markup only (§230); numeric pair passes its gate yet row stays dead (MA-1230 fingerprint: "numeric save_dc pair present ≠ chips").
- `src/components/encounter/MonsterCardHelpers.js:431` `extractSpellcastingSpellUses`: same markup-only regex (line 434); `N/Day` headers bind ONLY to marked names → **2/Day "Suggestion" usage limit is currently invisible AND ungated (§144)** — once markup is applied, `2/Day:` parses as uses-header and binds Suggestion max 2 (chip shows "(2/Day · N left)"); uses-gate refusal-on-third-press (§57) untestable live today.

## Working-format template (MA-1543 markup fix, registry-verified precedent)
- MA-1543 Storm Giant (verified) disk byte-shape: `"…(spell save DC 18):\n<strong>At Will:</strong> <em>Detect Magic</em>, <em>Light</em>\n<strong>1/Day:</strong> <em>Control Weather</em>"`.
- MA-0524 Couatl (verified): same `\n<strong>At Will:</strong> <em>…</em>` shape; archmage/lich/dao house shape uses `<br>` separators.

## Fix (one-field, storm-giant/couatl byte-shape)
Both spells resolve in BOTH `public/data/spells.json` and `public/data/2024/spells.json` (checked) — markup-only fix arms live chips immediately. Rewrite `yuan-ti-malison-type-2.actions[2].description` to:

"The yuan-ti casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 13):\n<strong>At Will:</strong> <em>Animal Friendship</em> (snakes only)\n<strong>2/Day:</strong> <em>Suggestion</em>"

- Headers ending ":" stay safe (§161 fake-chip guard: `endsWith(':')` skipped for names; `2/Day:` parsed as uses-header → binds Suggestion max 2 — per-spell uses NOW unmodeled because unmarked; fix also arms the 2/Day gate).
- "(snakes only)" advisory paren stays outside markup (§158 unresolvable-name guard untouched).
- Row-level `save_dc:13` + `save_type:"Wisdom"` already byte-present — no numeric fix needed (§89 pair satisfied).

## Evidence
- .opencode/plans/ma1830-spellcasting-row-zero-affordance.png (overlay open; Bite "+5" chip vs plain-text Spellcasting row)
- Zero-affordance probe: overlays 1→1, log 13→13, zero ability_use, zero console errors, zero spellUses keys.
- Manifest `docs/monster-actions-manifest.json` and `public/data/monsters.json` untouched by this run; no git writes.
