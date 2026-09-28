# BUG MA-1499 — Sphinx of Secrets Spellcasting: zero spell chips (MA-0421/MA-1478/MA-1493 plain-text twin)

**Verdict: FAIL(b)/DATA** — row renders ZERO spell affordances; no cast path, no 1/Day gate, no DC surface. Exact twin of MA-1478 (Solar) and MA-1493 (Sphinx of Lore, same sphinx family, filed prior day).

## Row
- `sphinx-of-secrets | actions | 3` — "Spellcasting", save_dc 15 Intelligence (disk `public/data/monsters.json` sphinx-of-secrets actions[3]).
- Manifest MA-1499: actionType spellcasting, saveDc 15 Intelligence, `verified: "not verified"` at entry.
- Description prose (plain text, ZERO markup): "The sphinx casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 15): At Will: Detect Magic, Identify, Prestidigitation; 1/Day Each: Locate Object, Remove Curse"

## STATIC byte-shape (step 1, 2026-09-28)
- Disk RAW repr: single plain string — zero `<strong>`/`<em>` anywhere, not even tier headers marked (worse than MA-0478 Druid circle where headers were marked; same shape as MA-1478/MA-1493).
- MA-0421 FIXED archmage actions[2] comparison: `'…(spell save DC 17):<br><strong>At Will:</strong> <em>Detect Magic</em>, …'` — every spell name `<em>`-wrapped. Sphinx row is NOT that shape.
- Row keys `description, name, save_dc, save_type` — numeric `save_dc:15` + `save_type:"Intelligence"` pair PRESENT (§167 satisfied; NOT MA-0459 two-field gap class). Sole defect = unmarked names.

## Fingerprint (§57 / §89+§118 MA-0421/0532 / MA-1478 / MA-1493)
- `extractSpellNamesFromSpellcasting` (src/components/encounter/MonsterCardHelpers.js:355, regex `/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g`) extracts ONLY marked names → plain text returns [] → SpellCastLinks null → zero `.mc-dice-link-spell` chips.
- `extractSpellcastingSpellUses` binds "1/Day Each:" tier to MARKED names only (§144) → Locate Object/Remove Curse gate unbound; `monsterSpellUses` unreachable.
- §89 XOR (MonsterAction.jsx Spellcasting-row fork): row-level numeric `save_dc:15` never renders a DC chip on this row — even the DC surface unreachable (cosmetic non-defect, recorded honestly).
- No decoy mid-prose emphasis → no §161 fake chips (headers absent entirely).

## LIVE proof (test-campaign, :5173, 2026-09-28)
- Header verified `test-campaign`. Initiative LIVE at entry: round 1, Sphinx of Secrets 1 (hp136 init12) + Bandit 1 (AC12 hp999 armed init6); log baseline 4 (encounter/roll join noise).
- Card open (initiative avatar click): Spellcasting row innerHTML = `<strong>Spellcasting.</strong> <span>The sphinx casts … Remove Curse</span>` — all five spell names inside a plain `<span>`, zero markup.
- Chip enumeration: expected-if-marked 5 (Detect Magic, Identify, Prestidigitation, Locate Object, Remove Curse) — actual whole-card `.mc-dice-link-spell` = `[]` (0 chips); row `.mc-dice-link-spell` = 0. Row interactive scan (`a,button,.mc-dice-link,[role=button]`) = `[]`.
- Two forced `page.mouse.click` presses at row center (rect 490,836.9 640×53.5): log delta ZERO (4→4→4), zero `ability_use`, zero cast, zero `automation blocked`, popup=false, card open after clicks.
- change-data grep: `monsterSpellUses` ABSENT anywhere; no `Sphinx of Secrets 1` change-data key (viewing rides `combat-ui-viewingMonster*`); `ability_use` absent from log types (`[encounter,roll,encounter,roll]`).
- Sibling-row control, same card: Claw "+7" chip, Curse of the Riddle "6d6" + "DC 15 Intelligence" save chips, History/Perception/Religion +7 skill chips all render → renderer alive; defect isolated to Spellcasting row markup.
- Console: zero app errors (single 404 = wrong-probe-endpoint `/api/log/test-campaign` harness artifact, correct endpoint is `/api/campaigns/test-campaign/log`; MA-1493 precedent).

## Untestable-by-construction (recorded honestly — step 3 skipped)
- At-Will Prestidigitation ×2 fire + ungated re-fire (§57): no chip to click, presses zero-delta.
- 1/Day Locate Object first fire + second-fire `automation blocked` refusal + `mc-dice-link-spell-spent` spent class: no chip, no uses key, gate unreachable.
- DC 15 INT save stamp: row-level DC never renders on Spellcasting rows (§89) — N/A.

## Fix (DATA, MA-0421/0611/1478/1493 byte-shape template)
Wrap each of the 5 spell names in `<strong>` (or `<em>`), with `<br>` tier lines:
`… (spell save DC 15):<br><strong>At Will:</strong> <strong>Detect Magic</strong>, <strong>Identify</strong>, <strong>Prestidigitation</strong><br><strong>1/Day Each:</strong> <strong>Locate Object</strong>, <strong>Remove Curse</strong>`
- Row already carries numeric `save_dc:15` + `save_type:"Intelligence"` (§167 pair satisfied) — markup-only fix.
- Headers trailing-":" stay plain (colon-skip, §161 no fake chips). Tier parses once names are marked; 1/Day uses ride `monsterSpellUses` + `automation blocked` refusals (§57); At-Will ungated by design; re-arm GM-side (§70 residual).
- All 5 spells standard 5e — grep spells.json resolvable, no homebrew gap.

## Evidence
- Screenshot: `.playwright-mcp/ma1499-spellcasting-zero-chips.png`
- Checkpoint: `.opencode/plans/checkpoint-mon-MA-1499.md`
- Twins: `.opencode/plans/bug-mon-MA-1478-spellcasting.md` (Solar), `.opencode/plans/bug-mon-MA-1493-spellcasting.md` (Sphinx of Lore)

## Cleanup
- Card closed via close button. Initiative LIVE and UNTOUCHED: round 1, Sphinx of Secrets 1 hp136, Bandit 1 hp999 armed, log 4 (zero delta). No POSTs, no manifest/git writes, test-campaign only.
