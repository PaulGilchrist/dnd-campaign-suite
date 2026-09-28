# BUG MA-1493 — Sphinx of Lore Spellcasting: zero spell chips (MA-0421/MA-1478 plain-text fingerprint)

**Verdict: FAIL(b)/DATA** — row renders ZERO spell affordances; no cast path, no 1/Day gate, no DC surface. Exact twin of MA-1478 (Solar), filed same week.

## Row
- `sphinx-of-lore | actions | 3` — "Spellcasting", save_dc 16 Intelligence (disk `public/data/monsters.json` sphinx-of-lore actions[3]).
- Description prose (plain text, ZERO markup): "The sphinx casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 16): At Will: Detect Magic, Identify, Mage Hand, Minor Illusion, Prestidigitation; 1/Day Each: Dispel Magic, Legend Lore, Locate Object, Plane Shift, Remove Curse, Tongues"

## Fingerprint (§57 / §89+§118 MA-0421/0532 / MA-1478)
- `extractSpellNamesFromSpellcasting` (src/components/encounter/MonsterCardHelpers.js:356, regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`) extracts ONLY `<strong>`/`<em>`-wrapped names; all 11 spell names are plain text → returns [] → SpellCastLinks null → zero `.mc-dice-link-spell` chips.
- `extractSpellcastingSpellUses` (:395-397, binds tiers to MARKED names only, §144) → "1/Day Each:" tier unbound; `monsterSpellUses` gate unreachable. At-Will ungated by design (§57) — moot, nothing clickable.
- Row named "Spellcasting" renders SpellCastLinks XOR ActionSaveRoll (§89/MA-0532/MA-1294, MonsterAction.jsx:390 early-return): row-level numeric `save_dc:16` never renders a DC chip there — even the DC surface is unreachable.

## Static byte-shape comparison (2026-09-28)
- MA-0421 FIXED shape (archmage actions[2], lich actions[3], djinni actions[4]): `<br><strong>At Will:</strong> <em>Detect Magic</em>, …` — every spell name wrapped.
- MA-1478 UNMARKED FAIL shape (solar actions[3]) vs sphinx-of-lore actions[3]: IDENTICAL structure — single plain `<span>`, tier headers unmarked, zero `<strong>`/`<em>` anywhere. Sphinx disk = Solar twin byte-shape confirmed.

## Live proof (test-campaign, :5173, 2026-09-28)
- Header verified `test-campaign`. Initiative LIVE at entry: round 3, Sphinx of Lore 1 (AC17 hp170 init29) + Bandit 1 (AC12 hp926 init17); log baseline 36 entries.
- Card open (initiative avatar click): Spellcasting row innerHTML = `<strong>Spellcasting.</strong> <span>The sphinx casts … Tongues</span>` — spell names inside a plain `<span>`, zero markup.
- Chip enumeration: row `.mc-dice-link-spell` = `[]`; whole-card = `[]` (0 chips). Row interactive-element scan (`a,button,.mc-dice-link,[role=button]`) = `[]`.
- Two forced `page.mouse.click` presses at row center (fresh rect 810,574): log delta ZERO (36→36), zero `ability_use`, zero cast, zero `automation blocked`, zero popup.
- change-data: `Sphinx of Lore 1` keys `[lastAttackRoll,_lastRollContext,pendingCombatSuperiorityPrompt,monsterRecharge,pendingExpirations]` — `monsterSpellUses` ABSENT on Sphinx and anywhere in change-data; gate never engaged.
- Row-level "DC 16" chip: absent (§89 structural XOR — cosmetic non-defect, recorded honestly).
- Sibling-row control, same card: Claw "+8" chip, Mind-Rending Roar "10d6" + "DC 16 Wisdom" save chips, Weight of Years "Expend Legendary" chip all render → renderer alive; defect isolated to Spellcasting row markup.
- Console: zero app errors (single 404 was a wrong-probe-endpoint artifact by the harness, not app code).

## Untestable-by-construction (recorded honestly)
- At-Will Detect Magic/Tongues fire + ungated re-fire (§57): no chip to click.
- 1/Day each first fire + second-fire `automation blocked` refusal + `mc-dice-link-spell-spent` spent class: no chip, no uses key, gate unreachable.
- DC 16 INT save stamp: row-level DC never renders on Spellcasting rows (§89) — N/A.

## Fix (DATA, MA-0421/0611/1478 template)
Wrap each of the 11 spell names in `<strong>` (or `<em>`) inside the row description, with `<br>` tier lines:
`… (spell save DC 16):<br><strong>At Will:</strong> <strong>Detect Magic</strong>, <strong>Identify</strong>, <strong>Mage Hand</strong>, <strong>Minor Illusion</strong>, <strong>Prestidigitation</strong><br><strong>1/Day Each:</strong> <strong>Dispel Magic</strong>, <strong>Legend Lore</strong>, <strong>Locate Object</strong>, <strong>Plane Shift</strong>, <strong>Remove Curse</strong>, <strong>Tongues</strong>`
- Row already carries numeric `save_dc:16` + `save_type:"Intelligence"` (§167 pair satisfied).
- No decoy mid-prose emphasis to strip (§161) — row currently has none beyond the row-name `<strong>Spellcasting.</strong>`.
- Tier header "1/Day Each:" parses once names are marked (MA-0276 qualifier rule respected); 1/Day uses then ride `monsterSpellUses` + `automation blocked` refusals (§57); At-Will ungated by design; re-arm GM-side (§70 residual).

## Evidence
- Screenshot: `.playwright-mcp/ma1493-spellcasting-zero-chips.png`
- Checkpoint: `.opencode/plans/checkpoint-mon-MA-1493.md`
- Twin: `.opencode/plans/bug-mon-MA-1478-spellcasting.md` (Solar, same fingerprint)
- Cleanup: card closed; initiative LIVE and UNTOUCHED (round 3, Sphinx hp170, Bandit hp926); log 36 (zero delta); no POSTs, no manifest writes.
