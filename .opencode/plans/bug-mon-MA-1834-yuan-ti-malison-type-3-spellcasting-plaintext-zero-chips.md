# Bug — MA-1834 Yuan-ti Malison (Type 3) Spellcasting: plain-text spell names = zero cast chips (row inert, MA-1742/MA-1814/MA-1818/MA-1827/MA-1830 exact SEXTUPLET, MA-0421 markup-gap family)

- ID: MA-1834 · stableKey `yuan-ti-malison-type-3|actions|3` · category actions · actionType spellcasting
- Verified: 2026-10-01 · campaign test-campaign (locked, header checked every nav) · dev :5173/:80
- Verdict: **FAIL(b)/DATA** — one-field fix (description markup); disk save_dc/save_type pair already present.

## Expected (row verbatim, manifest MA-1834; disk bytes match — DISK WINS)
"The yuan-ti casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 13): At Will: Animal Friendship (snakes only); 2/Day: Suggestion"
A row named "Spellcasting" should render per-spell `.mc-dice-link-spell` cast chips (SpellCastLinks) for Animal Friendship / Suggestion, with 2/Day uses-gating on Suggestion (§57).

## Actual
- Disk `yuan-ti-malison-type-3.actions[3]` fields = `name, description, save_dc:13, save_type:"Wisdom"` — numeric pair PRESENT, description contains **zero `<strong>`/`<em>` tags**.
- Live `.mc-overlay` (INNER `img.avatar-image` alt "Yuan-ti Malison (Type 3) 1", ini 9, target Bandit 1 AC 12) renders the row as plain `<span>` prose — **full affordance inventory `{mcDiceLinkSpell:0, mcDiceLink:0, buttons:0, roleButtons:0, spans:1, saveChip:0}`**. "Animal Friendship"/"Suggestion"/"DC 13" occur as PLAIN TEXT only. Sibling rows DO arm chips (Poison Burst "+5", Constrict "DC 13 Strength" clickable), so the card itself is live — the Spellcasting row alone is markup-dead.
- Zero-affordance probe (row.click() + inner-span click): overlays 1→1, popups 0, modals 0, **zero log delta** (log GET 29→29, zero `ability_use` campaign-wide), zero console errors, no spell/uses runtime keys on `Yuan-ti Malison (Type 3) 1` (change-data carries only `lastAttackRoll` etc.). 2/Day uses-gate untestable live — no chip exists to press (§144 invisible-and-ungated).
- Row-level `save_dc:13`/`save_type:"Wisdom"` never renders its own chip: Spellcasting-name rows fork to SpellCastLinks XOR ActionSaveRoll (MonsterAction.jsx:397 row-name gate) — §115/§89 header-swallow; not the counted failure.

## Sextuplet — MA-1742 + MA-1814 + MA-1818 + MA-1827 + MA-1830
- Same defect, same adjudication line: plain-text spellcasting description → 0 chips, numeric save pair present but header-swallowed, siblings live.
- `.opencode/plans/bug-mon-MA-1827-yuan-ti-malison-type-1-spellcasting-plaintext-zero-chips.md` / `bug-mon-MA-1830-...-type-2-...md` — **near-byte twins**: identical DC 13 + identical description; Type 3 shares the same "At Will: Animal Friendship (snakes only); 2/Day: Suggestion" plain-text shape (its own rows differ only in Poison Burst "+5 / 120 ft. / 2d8+3" and Constrict). MA-1834 completes the sextuplet (yochlol / yuan-ti abomination / yuan-ti infiltrator / YT malison 1 / YT malison 2 / YT malison 3).
- Joins §1088-1089 (MA-1543 Storm Giant) adjudication line "plain-text=FAIL(b) §1088".

## Grep citations (parser requirement)
- `src/components/encounter/MonsterCardHelpers.js:392` `extractSpellNamesFromSpellcasting` — `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g` harvests spell names **only** from markup; plain text yields `[]`.
- `src/components/encounter/MonsterAction.jsx:82-83` `SpellCastLinks`: `names.length === 0 → return null` → zero chips.
- `src/components/encounter/MonsterAction.jsx:397` `/^spellcasting$/i` row-name gate XOR fork (§230).
- `src/components/encounter/MonsterCardHelpers.js:431` `extractSpellcastingSpellUses` markup-only: `2/Day:` binds Suggestion only once names are marked (§57 gate currently dead).

## Fix (one-field, storm-giant/couatl byte-shape — MA-1543 precedent)
Both spells resolve in BOTH `public/data/spells.json` and `public/data/2024/spells.json` (checked this run) — markup-only fix arms live chips immediately. Rewrite `yuan-ti-malison-type-3.actions[3].description` to:

"The yuan-ti casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 13):\n<strong>At Will:</strong> <em>Animal Friendship</em> (snakes only)\n<strong>2/Day:</strong> <em>Suggestion</em>"

- Headers ending ":" safe (§161); "(snakes only)" stays outside markup (§158); numeric `save_dc:13` + `save_type:"Wisdom"` byte-present (§89 pair satisfied).
- Suggestion's own save is Wisdom DC 13 per row — chip-level DCs come from row pair; nothing else to author.

## Evidence
- `.opencode/plans/ma1834-spellcasting-row-zero-affordance.png` (live overlay: live "+5"/DC-chip siblings vs plain-text Spellcasting row)
- Zero-affordance probe: overlays 1→1, log 29→29, zero ability_use, zero console errors, zero spell keys.
- Manifest `docs/monster-actions-manifest.json` and `public/data/monsters.json` untouched this run; no git writes.
