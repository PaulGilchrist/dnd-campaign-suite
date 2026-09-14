# Bug MA-0106 — Adult Gold Dragon · Pounce (legendary_actions / other)

**Verdict: FAIL — inert row, no automation.** Exact MA-0095 (Copper) / MA-0040 / MA-0083 fingerprint: authored dict carries name+description only, no `attack_bonus`/`save_dc`/dice/automation → 0 affordances, forced clicks zero-effect, zero src consumers.

## Row
- MA-0106 · Adult Gold Dragon (`adult-gold-dragon`) · legendary Pounce · category: legendary_actions · actionType: other.
- Row text (quoted): "The dragon moves up to half its Speed, and it makes one Rend attack."

## Static read (monsters.json `adult-gold-dragon.legendary_actions`)
- `[0]` header "Legendary Action Uses: 3 (4 in Lair)" — name string only, **no `uses` field**.
- `[3]` Pounce: `{name:"Pounce", description:"The dragon moves up to half its Speed, and it makes one Rend attack."}` — **no attack_bonus, no save_dc, no dice, no automation metadata, no once-per-turn clause** (unlike Banish which carries `save_dc:21` and prose "can't take this action again"; Pounce has no such gating even in prose beyond the inherent 1-use economy).
- Referenced Rend (`actions[1]`, confirmed): `attack_bonus: 14`, reach 10 ft, `2d8 + 8` Slashing + `1d8` Fire — the numbers Pounce is supposed to reuse.
- `lair_actions` present but separate scope (not this row).

## Expected
Clicking Pounce resolves the referenced Rend melee attack: d20+14 vs target AC, 17 (2d8+8) Slashing + 4 (1d8) Fire on hit, attack/damage log entries, legendary-use spend. Movement clause advisory (§7 — no grid-move consumer).

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: EB Join (only Adult Gold Dragon checked) → cs idx 0 `Adult Gold Dragon 1` (npc, HP 243/243, AC 19, init 9); armed target **ElderPaladin** via dragon-card `[data-testid="target-select"]` — server-side cs `targetName:"ElderPaladin"` confirmed.
- Pounce row in `.mc-overlay`: `DIV.mc-action`, `cursor:auto`, outerHTML `<div class="mc-action"><strong>Pounce.</strong> <span>The dragon moves up to half its Speed…</span></div>`; interactive children (`button/a/[role=button]/.mc-dice-link/input/select`) = **0** — no clickable Rend affordance.
- Trigger: trusted `.click()` + forced pointerdown/mousedown/pointerup/mouseup/click on row: **zero popups** (`.popup/.sp-overlay/.popup-overlay/.dice-roll-panel` = 0), log delta 2 → 2 (join + initiative only), `lastAttack` absent, zero new change-data keys, no HP change.
- Legendary economy: no `.mc-legendary-counter` in overlay (`[class*=legendary]` = 0); `monsterLegendaryUses` key never created — header dict lacks `uses`, `legendaryHeaderAction` gates `rows[0]?.uses != null` (`monsterLegendaryUses.js:127`). Spend question moot: row never fires (MA-0092 fingerprint; cosmetic note: Gold's header prose "3 (4 in Lair)" is unparseable without a numeric field, same as Copper MA-0092).

## Control probe (engine alive, defect isolated to this row)
Same overlay, same armed target: **Rend** row carries live `span.mc-dice-link "+14"`; click → popup "✓ HIT (29 vs AC 19)"; log `roll/attack` Rend `rolls:[15,7] total:15 bonus:+14` (15+14=29 ≥ AC 19, hit); `lastAttack` stamped (attacker Adult Gold Dragon 1, target ElderPaladin, hit:true, `2d8 + 8` Slashing + `1d8` Fire). Popup dismissed cleanly. Engine + attack-roll machinery fine; Pounce row is the unwired gap.

## Grep evidence
- `rg -rni pounce src server --glob '!*.test.*'` excluding PC "Instinctive Pounce" (`combatStanceHandler.js`): **zero hits** — no consumer/handler/key keyed to any monster legendary Pounce row.
- Render gate: `MonsterAction.jsx:151` `numericAffordance = attack_bonus != null || save_dc != null || canRollExpression(formula)` — Pounce carries none → inert by construction (MV-23 shape).
- MV-28: "one Rend attack" referenced by name only; no producer wires the reference (control proves Rend resolves when its own row carries metadata).

## Cleanup (verified)
`.mc-overlay` closed; Admin clear-change-data 200, clear-log 200; final: log 0 entries, change-data keys []. test-campaign only; manifest `verified` untouched.

## Steps to Reproduce
1. test-campaign → Encounters → check Adult Gold Dragon → Join Encounter.
2. Initiative → arm target (ElderPaladin) on dragon card → click avatar → `.mc-overlay`.
3. Legendary Actions → Pounce row: no dice link; trusted or forced clicks produce no roll, no popup, no log, no HP change, no `monsterLegendaryUses`.
4. Control: Actions → Rend "+14" link rolls + hits + logs + stamps lastAttack — engine fine, row inert.

## Fix sketch (data-shaped)
Give Pounce an automation link on the row (`attack_bonus: 14` + `2d8 + 8` slashing + `1d8` fire mirrors, or `{type:'pounce_rend'}` referencing the Rend numbers) and author header `uses: 3` (MA-0092 fix) so existing legendary economy + attack-roll machinery activate unchanged. Movement clause stays advisory (§7).
