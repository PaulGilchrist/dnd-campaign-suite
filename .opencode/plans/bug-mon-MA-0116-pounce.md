# Bug MA-0116 — Adult Green Dragon · Pounce (legendary_actions / other)

**Verdict: FAIL — inert row, no automation.** Exact MA-0095 (Copper) / MA-0106 (Gold) fingerprint: authored dict carries name+description only, no `attack_bonus`/`save_dc`/dice/automation → 0 affordances, forced clicks zero-effect, zero src consumers.

## Row
- MA-0116 · Adult Green Dragon (`adult-green-dragon`) · legendary Pounce · category: legendary_actions · actionType: other.
- Row text (quoted): "The dragon moves up to half its Speed, and it makes one Rend attack."

## Static read (monsters.json `adult-green-dragon.legendary_actions`)
- `[0]` header "Legendary Action Uses: 3 (4 in Lair)" — name string only, **no `uses` field**.
- `[3]` Pounce: `{name:"Pounce", description:"The dragon moves up to half its Speed, and it makes one Rend attack."}` — **prose-only: no attack_bonus, no save_dc, no dice, no automation metadata** (Noxious Miasma `[2]` beside it carries `save_dc:17`/`2d6` and is therefore live per MV-23; Pounce is not).
- Referenced Rend (`actions[1]`, confirmed): `attack_bonus: 11`, reach 10 ft, `2d8 + 6` Slashing + `2d6` Poison — the numbers Pounce is supposed to reuse. Speed `{walk:40, fly:80, swim:40}` — "half Speed" movement clause has no grid-move consumer (§7, advisory).

## Expected
Clicking Pounce resolves the referenced Rend melee attack: d20+11 vs target AC, 15 (2d8+6) Slashing + 7 (2d6) Poison on hit, nothing on miss, attack/damage log entries, legendary-use spend. Movement clause advisory (§7).

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: EB Join (Adult Green Dragon) → cs idx 0 `Adult Green Dragon 1` (npc, HP 207/207, AC 19, init 15); armed target **ElderPaladin** via dragon-card `[data-testid="target-select"]` — server-side cs `targetName:"ElderPaladin"` confirmed.
- Pounce row in `.mc-overlay`: `DIV.mc-action`, `cursor:auto`, outerHTML `<div class="mc-action"><strong>Pounce.</strong> <span>The dragon moves up to half its Speed…</span></div>`; interactive children (`button/a/[role=button]/.mc-dice-link/input/select`) = **0** — no clickable Rend affordance.
- Trigger: trusted `.click()` + forced pointerdown/mousedown/pointerup/mouseup/click on row + inner strong/span: **zero popups** (`.popup/.sp-overlay/.popup-overlay/.dice-roll-panel` = []), log delta 2 → 2 (join + initiative only), `lastAttack: null`, zero new change-data keys (only the `combat-ui-viewingMonster*` card-open mirrors appeared), no HP change.
- Legendary economy: no `[class*=legendary]` counter in overlay (0); `monsterLegendaryUses` key **never created** (absent post-probe) — header dict lacks `uses`, `legendaryHeaderAction` gates on `rows[0]?.uses != null` (`monsterLegendaryUses.js:127`). Spend question moot: row never fires (MA-0092 fingerprint; header prose "3 (4 in Lair)" unparseable without numeric field).

## Control probe (engine alive, defect isolated to this row)
Same overlay, same armed target: **Rend** row carries live `span.mc-dice-link "+11"`; click → popup "✓ HIT (20 vs AC 19)"; log `roll/attack` Rend `rolls:[9,11] total:9 bonus:+11` (9+11=20 ≥ AC 19, hit); `roll/damage` `2d8 + 6 → 18` Slashing (+ `2d6` Poison leg); `hp_change ElderPaladin delta:-28`; `lastAttack` stamped (attacker Adult Green Dragon 1, target ElderPaladin, hit:true, attackName Rend). Done (`button.dice-roll-reroll-btn`) applied damage cleanly. Engine + attack-roll machinery fine; Pounce row is the unwired gap.

## Grep evidence
- `rg -rni pounce src server --glob '!*.test.*'` excluding PC "Instinctive Pounce" (`combatStanceHandler.js`): **zero hits** — no consumer/handler/key keyed to any monster legendary Pounce row.
- Render gate: `MonsterAction.jsx` `numericAffordance = attack_bonus != null || save_dc != null || canRollExpression(formula)` (MV-23) — Pounce carries none → inert by construction (MV-28: row referencing a live component with zero own affordance = FAIL).
- Legendary economy gate: header lacks `uses` → no counter, ungated-by-absence (MA-0092).

## Steps to Reproduce
1. test-campaign → Encounters → check Adult Green Dragon → Join Encounter.
2. Initiative → arm target (ElderPaladin) on dragon card → click avatar → `.mc-overlay`.
3. Legendary Actions → Pounce row: no dice link; trusted or forced clicks produce no roll, no popup, no log, no HP change, no `monsterLegendaryUses`.
4. Control: Actions → Rend "+11" link rolls + hits (20 vs AC 19) + logs + applies −28 — engine fine, row inert.

## Fix sketch (data-shaped)
Give Pounce an automation link on the row (`attack_bonus: 11` + `2d8 + 6` slashing + `2d6` poison mirrors, or `{type:'pounce_rend'}` referencing the Rend numbers) and author header `uses: 3` (MA-0092 fix) so existing legendary economy + attack-roll machinery activate unchanged. Movement clause stays advisory (§7).

## Cleanup (verified)
`.mc-overlay` closed; Admin clear-change-data 200, clear-log 200; final: log 0 entries, change-data keys []. test-campaign only; manifest `verified` untouched.
