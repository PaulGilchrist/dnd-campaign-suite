# Bug MA-0139 — Adult Silver Dragon · Pounce (legendary_actions / other)

**Verdict: FAIL — inert row, no automation.** Exact MA-0095 (Copper) / MA-0106 (Gold) / MA-0116 (Green) / MA-0127 (Red) fingerprint: authored dict carries name+description only, no `attack_bonus`/`save_dc`/dice/automation → 0 affordances, forced clicks zero-effect, zero src consumers.

## Row
- MA-0139 · Adult Silver Dragon (`adult-silver-dragon`) · legendary Pounce · category: legendary_actions · actionType: other.
- Row text (quoted, monsters.json `adult-silver-dragon.legendary_actions[3]`): `{name:"Pounce", description:"The dragon moves up to half its Speed, and it makes one Rend attack."}` — **prose-only: no attack_bonus, no save_dc, no dice, no automation metadata.**
- Header `[0]` "Legendary Action Uses: 3 (4 in Lair)" — name string only, **no `uses` field** (MA-0092 gate absent).

## Expected
Clicking Pounce resolves the referenced Rend melee attack: d20+13 vs target AC, 17 (2d8 + 8) Slashing + 4 (1d8) Cold on hit, nothing on miss, attack/damage log entries, legendary-use spend. Movement clause advisory (§7 — no grid-move consumer).

## Referenced Rend (`actions[1]`, confirmed static)
`attack_bonus: 13`, reach 10 ft, `2d8 + 8` Slashing + `1d8` Cold — the numbers Pounce is supposed to reuse.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: EB Join (Adult Silver Dragon) → cs idx 0 `Adult Silver Dragon 1` (npc, HP 216, AC 19, init 1); armed target **ElderPaladin** via dragon-card `[data-testid="target-select"]` — server-side cs `targetName:"ElderPaladin"` confirmed. Baseline log 2 entries.
- Pounce row in `.mc-overlay`: `DIV.mc-action`, `cursor:auto`, outerHTML `<div class="mc-action"><strong>Pounce.</strong> <span>The dragon moves up to half its Speed, and it makes one Rend attack.</span></div>`; interactive children (`button/a/[role=button]/.mc-dice-link/input/select`) = **0** — no clickable Rend affordance.
- Trigger: trusted `.click()` + forced pointerdown/mousedown/pointerup/mouseup/click/dblclick on row + inner span: **zero popups** (`.popup/.sp-overlay/.popup-overlay/.dice-roll-panel` = []), log delta 2 → 2, `lastAttack: null`, zero new change-data keys (only `combat-ui-viewingMonster*` card-open mirrors), no HP change.
- Legendary economy: `[class*=legendary]` counter in overlay = 0; `monsterLegendaryUses` key **never created** (absent post-probe) — header dict lacks `uses`, `legendaryHeaderAction` gates on `rows[0]?.uses != null` (`monsterLegendaryUses.js:127`). Spend question moot: row never fires (MA-0092/95/116/127 fingerprint).

## Control probe (engine alive, defect isolated to this row)
Same overlay, same armed target: **Rend** row carries live `span.mc-dice-link "+13"`; click → popup-overlay "✓ HIT (22 vs AC 19)"; log `roll/attack` Rend `rolls:[9,12] bonus:+13` (9+13=22 ≥ AC 19, hit); `roll/damage` `2d8 + 8 → 17` Slashing (+ `1d8 → 2` Cold leg, 19 total); `hp_change ElderPaladin delta:-19`; `lastAttack` stamped (attacker Adult Silver Dragon 1, target ElderPaladin, hit:true). Done applied cleanly. Engine + attack-roll machinery fine; Pounce row is the unwired gap.

## Grep evidence
- `grep -rni pounce src server` excluding tests and PC "Instinctive Pounce" (`combatStanceHandler.js`): **zero hits** — no consumer/handler/key keyed to any monster legendary Pounce row.
- Render gate: `MonsterAction.jsx` affordances only for rows carrying `attack_bonus`/`save_dc`/dice (MV-23) — Pounce carries none → inert by construction (MV-28: row referencing a live component with zero own affordance = FAIL).
- Legendary economy gate: header lacks `uses` → no counter, ungated-by-absence (MA-0092).

## Steps to Reproduce
1. test-campaign → Encounters → search "Adult Silver Dragon" → check → Join Encounter.
2. Initiative → dragon card (idx 0, `img[alt="Adult Silver Dragon 1"]`) → arm target ElderPaladin → click avatar → `.mc-overlay`.
3. Legendary Actions → Pounce row: no dice link; trusted or forced clicks produce no roll, no popup, no log, no HP change, no `monsterLegendaryUses`.
4. Control: Actions → Rend "+13" link rolls + hits (22 vs AC 19) + logs + applies 19 damage — engine fine, row inert.

## Fix sketch (data-shaped)
Give Pounce an automation link on the row (`attack_bonus: 13` + `2d8 + 8` slashing + `1d8` cold mirrors, or `{type:'pounce_rend'}` referencing the Rend numbers) and author header `uses: 3` (MA-0092 fix) so existing legendary economy + attack-roll machinery activate unchanged. Movement clause stays advisory (§7).

## Cleanup (verified)
`.mc-overlay` closed; Admin clear-change-data 200, clear-log 200; final: log 0 entries, change-data keys []. test-campaign only; manifest `verified` untouched.
