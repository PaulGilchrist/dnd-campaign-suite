# BUG MA-1506 — Sphinx of Valor Spellcasting: zero spell chips (MA-0421/MA-1478/MA-1493 plain-text fingerprint)

**Verdict: FAIL(b)/DATA** — row renders ZERO spell affordances; no cast path, no 1/Day gate, no DC surface. Exact third twin of MA-1478 (Solar) / MA-1493 (Sphinx of Lore).

## Row
- `sphinx-of-valor | actions | 6` — "Spellcasting", save_dc 20 Wisdom (disk `public/data/monsters.json` sphinx-of-valor actions[6]).
- Description prose (plain text, ZERO markup): "The sphinx casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 20): At Will: Detect Evil and Good, Thaumaturgy; 1/Day Each: Detect Magic, Dispel Magic, Greater Restoration, Heroes' Feast, Zone of Truth"

## Fingerprint (§57 / §89+§118 MA-0421/0532 / twins MA-1478/1493)
- `extractSpellNamesFromSpellcasting` (src/components/encounter/MonsterCardHelpers.js:356, regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`) extracts ONLY `<strong>`/`<em>`-wrapped names; all 7 spell names are plain text → returns [] → SpellCastLinks null → zero `.mc-dice-link-spell` chips (expect 7 authored: Detect Evil and Good, Thaumaturgy, Detect Magic, Dispel Magic, Greater Restoration, Heroes' Feast, Zone of Truth).
- `extractSpellcastingSpellUses` binds "1/Day Each:" tier only to MARKED names (§144) → gate unbound; `monsterSpellUses` consumer unreachable. At-Will ungated by design (§57) — moot, nothing clickable.
- Row named "Spellcasting" renders SpellCastLinks XOR ActionSaveRoll (§89/MA-0532/MA-1294, MonsterAction.jsx:390 early-return): row-level numeric `save_dc:20` never renders a DC chip there — DC surface unreachable.

## Static byte-shape comparison (2026-09-28)
- MA-0421 FIXED shape (archmage actions[2], lich actions[3], djinni actions[4]): `<br><strong>At Will:</strong> <em>Detect Magic</em>, …` — every spell name wrapped.
- sphinx-of-valor actions[6] vs MA-1478 solar actions[3] vs MA-1493 sphinx-of-lore actions[3]: IDENTICAL structure — single plain `<span>`, tier headers unmarked, zero `<strong>`/`<em>` beyond the row-name bold. Triple-twin confirmed.

## Live proof (test-campaign, :5173, 2026-09-28)
- Header verified `test-campaign`. Initiative was admin-cleared post-MA-1505 (log baseline 0).
- EB re-join: Sphinx of Valor 1 cs idx0, hp 199/199, init 26, round 1 (PC party placeholders on board; Bandit witness skipped — all 7 spells self/zero-target, chips are the affordance under test).
- Card open (initiative avatar click): Spellcasting row innerHTML = `<strong>Spellcasting.</strong> <span>The sphinx casts … Zone of Truth</span>` — spell names inside a plain `<span>`, zero markup; row interactive-element scan (`a,button,.mc-dice-link,[role=button]`) = `[]`.
- Chip enumeration: row `.mc-dice-link-spell` = `[]`; whole-card = `[]` (0 chips vs 7 expected).
- Two forced `page.mouse.click` presses at row center (scrollIntoView + fresh rect 810,583, viewport 1440x900): log delta ZERO beyond join noise (encounter + roll only), zero `ability_use`, zero cast, zero `automation blocked`, zero popup/overlay.
- change-data: `Sphinx of Valor 1` keys `[]`; `monsterSpellUses` grep-zero across all keys.
- Sibling-row control, same card: Claw "+12" chip, staged Roar "DC 20 Wisdom" ×2 + "DC 20 Constitution" + "8d10" chips, "Expend Legendary" chip all render → renderer alive; defect isolated to Spellcasting row markup.
- Console: zero app errors.

## Untestable-by-construction (recorded honestly)
- At-Will Detect Evil and Good / Thaumaturgy fire ×2 (§57 ungated): no chip to click.
- 1/Day each first fire + second-fire `automation blocked` refusal + `mc-dice-link-spell-spent` class: no chip, no uses key, gate unreachable.
- DC 20 WIS save stamp: row-level DC never renders on Spellcasting rows (§89) — N/A.

## Fix (DATA, MA-0421/0611/1478/1493 template)
Wrap each of the 7 spell names in `<strong>` (or `<em>`) inside the row description, with `<br>` tier lines:
`… (spell save DC 20):<br><strong>At Will:</strong> <strong>Detect Evil and Good</strong>, <strong>Thaumaturgy</strong><br><strong>1/Day Each:</strong> <strong>Detect Magic</strong>, <strong>Dispel Magic</strong>, <strong>Greater Restoration</strong>, <strong>Heroes' Feast</strong>, <strong>Zone of Truth</strong>`
- Row already carries numeric `save_dc:20` + `save_type:"Wisdom"` (§167 pair satisfied).
- No decoy mid-prose emphasis to strip (§161) — row currently has none beyond the row-name `<strong>Spellcasting.</strong>`.
- Tier header "1/Day Each:" parses once names are marked (MA-0276 qualifier rule respected); 1/Day uses then ride `monsterSpellUses` + `automation blocked` refusals (§57); At-Will ungated by design; re-arm GM-side (§70 residual).

## Evidence
- Screenshot: `.opencode/plans/ma1506-spellcasting-zero-chips.png`
- Checkpoint: `.opencode/plans/checkpoint-mon-MA-1506.md`
- Twins: `.opencode/plans/bug-mon-MA-1478-spellcasting.md` (Solar), `.opencode/plans/bug-mon-MA-1493-spellcasting.md` (Sphinx of Lore)
- Cleanup: admin clear change-data + log at end (see report).
