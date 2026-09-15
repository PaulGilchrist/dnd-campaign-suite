# BUG MA-0184 — Ancient Brass Dragon legendary header: no uses counter, inert legendary economy (FAIL)

**Row:** MA-0184 `ancient-brass-dragon|legendary_actions|0` — "Legendary Action Uses: 3 (4 in Lair)" (legendary_actions, other)
**Verdict:** FAIL — MA-0172/MA-0092 fingerprint (header dict lacks authored `uses`).

## Root cause (DATA)
`public/data/monsters.json` → `ancient-brass-dragon.legendary_actions[0]` authors only:
```json
{ "name": "Legendary Action Uses: 3 (4 in Lair)",
  "description": "Immediately after another creature's turn, the dragon can expend a use to take one of the following actions. The dragon regains all expended uses at the start of each of its turns." }
```
No `uses:3` key. Engine gates strictly on the structured field:
- `monsterLegendaryUses.js:156 legendaryHeaderAction()` returns `rows[0]` ONLY when `rows[0]?.uses != null` → **null** here.
- `MonsterCardBody.jsx:54-58`: gated legendary section (counter `MonsterLegendaryHeaderRow` + `legendaryGate`-wrapped rows) renders ONLY when `legendaryHeader` truthy; else-branch renders the whole list incl. header row [0] as plain `MonsterActionSection`.

Component dict keys (as authored):
- [1] Blazing Light: `{name, description}` — no affordance → inert prose.
- [2] Pounce: `{name, description}` — no `delegates_to:"Rend"` → inert prose.
- [3] Scorching Sands: `{name, description, save_dc:20, save_type, damage_dice_primary:"8d8", damage_type_primary, save_effect}` — numeric save legs render clickable (MV-23) but through the **ungated** normal-action path: fire the save with ZERO legendary spend, unlimited.
- No row anywhere carries `advisory`/`delegates_to`; "4 in Lair" advisory note also unauthored (MA-0070 adult dict carries it in the header description).

## Live evidence (test-campaign, 2026-09-15, :5173)
- EB Join exact "Ancient Brass Dragon 1" → cs idx 0, hp 332, ac 20 (MV-18 header verified; registry line matches). Target armed AasimarTest via initiative `target-select`.
- Card opened: **zero `.mc-legendary-counter`, zero `.mc-legendary-header-row`, zero `.mc-dice-link-legendary`**. Header row + Blazing Light + Pounce render plain inert `.mc-action`.
- Forced `el.click()` ×2 on header/Blazing Light/Pounce: zero popups; `/change-data` dragon key `null`; no `monsterLegendaryUses` key app-wide (only `combat-ui-viewingMonster.legendary_actions` raw dict echo); zero `legendary_use_refused` / `ability_use` / regain log entries.
- Ungated leak: Scorching Sands `DC 20 Dexterity` save link clickable → "Saving Throw Required … DC 20" modal + NEW save roll log (ts 1789451559593) with **no uses spent** — legendary action usable unlimited times outside the economy.
- **Control proves engine alive:** Rend `.mc-dice-link` (+14) click → NEW attack roll log (ts 1789451591486, rolls [17,8], total 31 vs AC 12 HIT) + `lastAttack` written. Economy absence is data-gated, not session/overlay artifact.
- grep: sole consumers of the header prose live in `monsterLegendaryUses.js` (:103 comment, :366 regain log label), unreachable without `header.uses` → zero-consumer prose confirmed.
- Evidence: `/tmp/ma0184-cd-before.json`, `/tmp/ma0184-log-before.json`, `/tmp/ma0184-cd-after.json`, `/tmp/ma0184-log-after.json` (stamped 2026-09-15T05:53:35Z).

## Fix recipe (MA-0070 data pattern, already applied to Adult Brass)
Header row gains `uses: 3` (+ advisory tail "In its lair the dragon has 4 uses (advisory — no lair flag consumer; GM-enforced)."); component legendary rows gain affordances:
- Blazing Light → `delegates_to` Scorching Ray spellcasting row (or `advisory`), mirroring Adult Brass lv3 Scorching Ray component (`spell_attack_bonus/attack_bonus/dice/range` shape).
- Pounce → `delegates_to:"Rend"` (renders delegated attack roll through the spend gate; Adult Brass Pounce uses this shape).
- Scorching Sands → keep numeric save legs, add `dc_success:"half"` per Adult pattern so it routes through `handleLegendaryRow` gate instead of the ungated save path.
Engine (`expendLegendaryUse`, exhaustion refusal `legendary_use_refused (uses)`, one-per-other-turn latch `(turn)`, per-action cooldown, `regainLegendaryUses` at turn start) requires NO code change. Max=3; "4 in Lair" stays advisory (no lair-flag consumer — same residual as MA-0070/MA-0172).

## Security
All actions self-issued at localhost:5173; tool code-echo wrappers matched requested URLs; no off-host navigation; no fabricated instructions obeyed.
