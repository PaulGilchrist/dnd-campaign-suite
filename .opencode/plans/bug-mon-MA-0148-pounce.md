# Bug MA-0148 — Adult White Dragon · Pounce (legendary_actions / other)

**Verdict: FAIL — inert row, no automation.** Exact MA-0095 (Copper) / MA-0106 (Gold) / MA-0116 (Green) / MA-0127 (Red) / MA-0139 (Silver) fingerprint: authored dict carries name+description only, no `attack_bonus`/`save_dc`/dice/automation → 0 affordances, forced clicks zero-effect, zero src consumers, no legendary economy.

## Row
- MA-0148 · Adult White Dragon (`adult-white-dragon`) · legendary Pounce · category: legendary_actions · actionType: other.
- Row text (quoted, monsters.json `adult-white-dragon.legendary_actions[3]`): `{name:"Pounce", description:"The dragon moves up to half its Speed, and it makes one Rend attack."}` — **prose-only: no attack_bonus, no save_dc, no dice, no automation metadata.**
- Header `[0]` "Legendary Action Uses: 3 (4 in Lair)" — name string only, **no `uses` field** (MA-0092 gate absent).

## Expected
Clicking Pounce resolves the referenced Rend melee attack: d20+11 vs target AC, 13 (2d6 + 6) Slashing + 4 (1d8) Cold on hit, nothing on miss, attack/damage log entries, legendary-use spend. Movement clause advisory (§7 — no grid-move consumer).

## Referenced Rend (`actions[1]`, confirmed static)
`attack_bonus: 11`, reach 10 ft, `2d6 + 6` Slashing + `1d8` Cold — the numbers Pounce is supposed to reuse.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: EB Join (Adult White Dragon) → cs idx 0 `Adult White Dragon 1` (npc, HP 200, AC 18, init 9); armed target **ElderPaladin** via dragon-card `[data-testid="target-select"]` — server-side cs `targetName:"ElderPaladin"` confirmed. Baseline log 0 → 2 entries after join+initiative.
- Pounce row in `.mc-overlay`: `DIV.mc-action`, `cursor:auto`, outerHTML `<div class="mc-action "><strong>Pounce.</strong> <span>The dragon moves up to half its Speed, and it makes one Rend attack.</span></div>`; interactive children (`button/a/[role=button]/.mc-dice-link/.mc-dice-link-spell/.mc-dice-link-lair/input/select`) = **0** — no clickable Rend affordance.
- Trigger: trusted `.click()` on row + inner span + forced pointerdown/mousedown/pointerup/mouseup/click/dblclick: **zero popups** (`.popup/.sp-overlay/.popup-overlay/.dice-roll-panel/[data-testid=popup-overlay]` = []), log delta 2 → 2, `lastAttack: null`, zero new change-data keys (only `combat-ui-viewingMonster*` card-open mirrors), no HP change.
- Legendary economy: `[class*=legendary]` counter in overlay = 0; `monsterLegendaryUses` key **never created** (absent post-probe) — header dict lacks `uses`, `monsterLegendaryUses.js` gates on `rows[0]?.uses != null`. Spend question moot: row never fires (MA-0092/95/116/127/139 fingerprint).

## Control probe (engine alive, defect isolated to this row)
Same overlay, same armed target: **Rend** row carries live `span.mc-dice-link "+11"`; click → popup-overlay "✓ HIT (31 vs AC 19)" (nat 20 crit, damage dice doubled); log `roll/attack` Rend `rolls:[20,1] bonus:+11` (20+11=31 ≥ AC 19, hit); `roll/damage` `2d6*2+6 → 16` Slashing (+ doubled `1d8` Cold leg; `hp_change ElderPaladin delta:-22` = 16+6 crit total); `lastAttack` stamped (attacker Adult White Dragon 1, target ElderPaladin, hit:true, isCrit:true). Done applied cleanly. Engine + attack-roll machinery fine; Pounce row is the unwired gap.

## Grep evidence
- `grep -rni pounce src server` excluding tests and PC "Instinctive Pounce" (`combatStanceHandler.js`): **zero hits** — no consumer/handler/key keyed to any monster legendary Pounce row.
- Render gate: `MonsterAction.jsx` affordances only for rows carrying `attack_bonus`/`save_dc`/dice (MV-23) — Pounce carries none → inert by construction (MV-28: row referencing a live component with zero own affordance = FAIL).
- Legendary economy gate: header lacks `uses` → no counter, ungated-by-absence (MA-0092).

## Steps to Reproduce
1. test-campaign → Encounters → search "Adult White Dragon" → check → Join Encounter.
2. Initiative → dragon card (idx 0, `img[alt="Adult White Dragon 1"]`) → arm target ElderPaladin → click avatar → `.mc-overlay`.
3. Legendary Actions → Pounce row: no dice link; trusted or forced clicks produce no roll, no popup, no log, no HP change, no `monsterLegendaryUses`.
4. Control: Actions → Rend "+11" link rolls + hits + logs + applies damage — engine fine, row inert.

## Fix sketch (data-shaped)
Give Pounce an automation link on the row (`attack_bonus: 11` + `2d6 + 6` slashing + `1d8` cold mirrors, or `{type:'pounce_rend'}` referencing the Rend numbers) and author header `uses: 3` ("4 in Lair" advisory) so existing legendary economy (MA-0021 `monsterLegendaryUses.js`) + attack-roll machinery activate unchanged. Movement clause stays advisory (§7).

## Cleanup (verified)
`.mc-overlay` closed; Admin clear-change-data + clear-log on test-campaign only; manifest `verified` untouched.
