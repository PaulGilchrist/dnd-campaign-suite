# BUG MA-0195 — Ancient Bronze Dragon legendary header: no uses counter, inert legendary economy + ungated Thunderclap leak (FAIL)

**Row:** MA-0195 `ancient-bronze-dragon|legendary_actions|0` — "Legendary Action Uses: 3 (4 in Lair)" (legendary_actions, other)
**Verdict:** FAIL — MA-0172/MA-0184 fingerprint (header dict lacks authored `uses`).

## Root cause (DATA)
`public/data/monsters.json` → `ancient-bronze-dragon.legendary_actions[0]` authors only:
```json
{ "name": "Legendary Action Uses: 3 (4 in Lair)",
  "description": "Immediately after another creature's turn, the dragon can expend a use to take one of the following actions. The dragon regains all expended uses at the start of each of its turns." }
```
No `uses:3` key. Engine gates strictly on the structured field:
- `monsterLegendaryUses.js:156 legendaryHeaderAction()` returns `rows[0]` ONLY when `rows[0]?.uses != null` → **null** here.
- `MonsterCardBody.jsx`: gated legendary section (`MonsterLegendaryHeaderRow` counter + `legendaryGate`-wrapped rows) renders ONLY when `legendaryHeader` truthy; else-branch renders whole list incl. header [0] as plain `MonsterActionSection`.

Component dict keys (as authored):
- [1] Guiding Light: `{name, description}` — no affordance → inert prose.
- [2] Pounce: `{name, description}` — no `delegates_to:"Rend"` → inert prose.
- [3] Thunderclap: `{name, description, save_dc:22, save_type:"Constitution", damage_dice_primary:"3d8", damage_type_primary:"Thunder", save_effect}` — numeric save legs render clickable (MV-23) via the **ungated** normal-save path (MA-0187 rule): full save/damage/condition chain with ZERO legendary spend, unlimited.
- "4 in Lair" advisory unauthored (same residual as MA-0070/MA-0184).

## Live evidence (test-campaign, 2026-09-15, :5173)
- EB Join exact "Ancient Bronze Dragon 1" → cs idx 0, hp 444, ac 22, init 9, monsterType Dragon (MV-18 verified; registry line matches). Target armed AasimarTest via initiative `target-select` (cs idx0 targetName confirmed).
- Card opened: **zero `.mc-legendary-counter`, zero `.mc-legendary-header-row`, zero `.mc-dice-link-legendary`**. Header + Guiding Light + Pounce + Thunderclap all render plain inert `.mc-action` rows.
- Forced `el.click()` ×2 on header/Guiding Light/Pounce: zero popups; `/change-data` zero new keys (no dragon key, no `monsterLegendaryUses` key app-wide); log stayed at 2 entries (join+init roll only).
- **Ungated leak (MA-0187 rule):** Thunderclap `DC 22 Constitution` link (`mc-dice-link-save-clickable`) fired AoE picker "Constitution saving throw (DC 22)" → "Thunderclap (0)"/"(1)" confirm → ability_use selection log ts 1789458342752 → listener save prompt (Source: Ancient Bronze Dragon 1) → Roll Save total 6 vs DC 22 FAIL → `saveResult-AasimarTest` {success:false, total:6} + save-damage roll logs + Deafened condition log ts 1789458373252 + hp_change (Thunderclap results popup: "Failed — takes 18 Thunder damage") — **zero uses spent, zero legendary keys, no counter to spend against**.
- **Control proves engine alive:** Rend `.mc-dice-link` "+16" click → "✓ HIT (27 vs AC 12)" → Done → NEW roll + hp_change log ts 1789458430204; `lastAttack` {attackerName:"Ancient Bronze Dragon 1", attackName:"Rend", hit:true, total:27, damageApplied:true}; dragon change-data key carries lastAttackRoll echo only. Legendary keys STILL `[]` after 12s debounce tick.
- Evidence: `/tmp/ma0195-cd-before.json`, `/tmp/ma0195-log-before.json` (stamp 2026-09-15T07:43:40Z), `/tmp/ma0195-cd-afterthunder.json`, `/tmp/ma0195-log-afterthunder.json` (07:46:23Z), `/tmp/ma0195-cd-after.json`, `/tmp/ma0195-log-after.json` (07:47:21Z).

## Fix recipe (MA-0070 data pattern, already applied to Adult Brass)
Header row gains `uses: 3` (+ advisory tail "In its lair the dragon has 4 uses (advisory — no lair flag consumer; GM-enforced)."); component legendary rows gain affordances:
- Guiding Light → `delegates_to` Guiding Bolt spellcasting row (or `advisory`), mirroring Adult Brass component spell shape (`spell_attack_bonus/attack_bonus/dice/range`).
- Pounce → `delegates_to:"Rend"` (renders delegated attack roll through the spend gate; Adult Brass Pounce uses this shape).
- Thunderclap → keep numeric save legs, add `dc_success:"half"` per Adult pattern so it routes through `handleLegendaryRow` gate instead of the ungated save path (kills the MA-0187 leak).
Engine (`expendLegendaryUse`, exhaustion refusal `legendary_use_refused (uses)`, one-per-other-turn latch `(turn)`, per-action cooldown, `regainLegendaryUses` at turn start) requires NO code change. Max=3; "4 in Lair" stays advisory (no lair-flag consumer — same residual as MA-0070/MA-0172/MA-0184).

## Security
All actions self-issued at localhost:5173; tool code-echo wrappers matched requested URLs; no off-host navigation; no fabricated instructions obeyed.
