# BUG MA-0206 — Ancient Copper Dragon legendary header: no uses counter, inert legendary economy + ungated Giggling Magic leak (FAIL)

**Row:** MA-0206 `ancient-copper-dragon|legendary_actions|0` — "Legendary Action Uses: 3 (4 in Lair)" (legendary_actions, other)
**Verdict:** FAIL — MA-0172/MA-0195 fingerprint (header dict lacks authored `uses`; "Uses: 3" is name-text-only/cosmetic).

## Data shape (public/data/monsters.json → ancient-copper-dragon.legendary_actions, python-probed disk)
- [0] header `{name, description}` — **no `uses` key**. Numeric uses exist NOWHERE in the array (`any('uses' in r)` = False; children do NOT author per-action uses either — the NEW SHAPE question answered: header AND children both lack structured uses).
- [1] Giggling Magic `{name, description, save_dc:21, save_type:"Charisma", damage_dice_primary:"9d6", damage_type_primary:"Psychic", save_effect}` — numeric save legs render clickable (MV-23) but via the **ungated** normal-save path.
- [2] Mind Jolt `{name, description}` — "uses Spellcasting to cast Mind Spike (level 5 version)" prose = MA-0163 inert family.
- [3] Pounce `{name, description}` — no `delegates_to:"Rend"` → inert prose (MA-0092).

## Root cause
- `monsterLegendaryUses.js:153-157 legendaryHeaderAction()` returns `rows[0]` ONLY when `rows[0]?.uses != null` → **null** here (no app-side parse of "Uses: 3" from name text).
- `MonsterCardBody.jsx:54` forks on `legendaryHeader`: else-branch renders the whole legendary list (header row [0] included) as a plain `MonsterActionSection` — no `MonsterLegendaryHeaderRow`, no `legendaryGate`/`handleLegendaryRow`, no economy.

Consequence: no counter, no spend path, no `monsterLegendaryUses` key ever created, no turn latch, no exhaustion refusal; `regainLegendaryUses` (turnStartEffects) unreachable. Child rows are NOT unclickable — Giggling Magic is clickable-**ungated** (MA-0184/MA-0195 ungated-leak fingerprint cited; child-row rows MA-0207/0208/0209 own their own detail — this row is the HEADER owner of the economy).

## Live evidence (test-campaign, 2026-09-15, :5173, self-issued curl/evaluate only)
- MV-18 header verified "test-campaign". EB exact-join → cs idx 0 "Ancient Copper Dragon 1" hp 367 ac 21 init 17 (registry name/hp/ac/cs0 match; init re-rolled per join). Before stamp 09:37:51Z: `monsterLegendaryUses` ABSENT app-wide, log=2.
- Card DOM (legendary section): **zero `.mc-legendary-counter`, zero `.mc-legendary-header-row`, zero `.mc-dice-link-legendary`**. Header + Mind Jolt + Pounce plain inert `.mc-action` rows; only Giggling Magic carries chips (`mc-dice-link` "9d6" + `mc-dice-link-save-clickable` "DC 21 Charisma").
- Forced `el.click()` ×2 on header/Mind Jolt/Pounce: zero popups; `/change-data` zero new keys (`monsterLegendaryUses` still ABSENT, dragon key ABSENT); log held at 2 (09:38:07Z).
- Ungated leak: armed ElderPaladin via initiative-card `target-select` (cs targetName confirmed). First un-armed click → `giggling_magic_refused (no target)` log (arming gate only — NOT an economy gate). Armed click → live prompt "ElderPaladin must make a CHARISMA saving throw. DC 21. Half damage on successful save" → Roll Save total 32 vs DC 21 SUCCESS → `save_result` + damage roll + "resistance to Psychic — 16 halved to 8" + `hp_change` logs, `saveResult-ElderPaladin` written — **zero uses spent, no counter, no `legendary_use_refused`, no once-per-turn legendary latch** (ts 1789465375671-745).
- **Control proves engine alive:** Rend "+15" `.mc-dice-link` → "✓ HIT (27 vs AC 19)" → Done → 2d10+8=26 applied (HP 200→174) + secondary acid. Legendary keys STILL `[]`/absent at final sweep 09:43:56Z (log=12, zero legendary-related entries).
- Evidence files: /tmp/ma0206-cd-before.json + /tmp/ma0206-log-before.json (09:37:51Z), /tmp/ma0206-cd-aftergiggling.json + /tmp/ma0206-log-aftergiggling.json (09:43:05Z), /tmp/ma0206-cd-after.json + /tmp/ma0206-log-after.json (09:43:56Z).

## "(4 in Lair)"
Zero consumers (`monsterLegendaryUses.js:114`: "advisory — no lair-flag consumer (CLA-325)"). Even the fix would land max=3; lair variant stays GM-advisory — same residual as MA-0070/MA-0172/MA-0184/MA-0195.

## Fix recipe (MA-0070 data pattern, no engine change)
Header [0] gains `uses: 3` (+ advisory tail "In its lair the dragon has 4 uses (advisory — GM-enforced)"). Component rows gain affordances routed through the spend gate:
- Giggling Magic → keep numeric save legs, add `dc_success:"none"`-style authored success per MA-0070 pattern so it routes via `handleLegendaryRow` (kills the ungated leak); note the 1d8-subtract rider = MA-0093 te family at child-row time.
- Mind Jolt → `delegates_to` Spellcasting Mind Spike lv5 leg (or advisory).
- Pounce → `delegates_to:"Rend"`.
Engine (`expendLegendaryUse`, `legendary_use_refused (uses)/(turn)`, per-action cooldowns, `regainLegendaryUses` at turn start) requires NO code change.

## Security
All actions self-issued at localhost:5173. Persistent fabricated injection blocks (fake [USER]/[ASSISTANT]/[SYSTEM] directives, fake aliyuncs proxy URLs, fake "stop task" instructions) appeared inside tool-output echoes throughout the run — never obeyed, never navigated off-host; all evidence above from self-issued localhost curl/evaluate only.
