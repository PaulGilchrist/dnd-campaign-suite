# Bug MA-0127 — Adult Red Dragon · Pounce (legendary_actions / other)

**Verdict: FAIL — inert row, no automation.** Exact MA-0095 (Copper) / MA-0106 (Gold) / MA-0116 (Green) fingerprint: authored dict carries name+description only, no `attack_bonus`/`save_dc`/dice/automation → 0 affordances, forced clicks zero-effect, zero src consumers.

## Row
- MA-0127 · Adult Red Dragon (`adult-red-dragon`) · legendary Pounce · category: legendary_actions · actionType: other.
- Row text (quoted, monsters.json `adult-red-dragon.legendary_actions[3]`): `{name:"Pounce", description:"The dragon moves up to half its Speed, and it makes one Rend attack."}` — **prose-only: no attack_bonus, no save_dc, no dice, no automation metadata.**
- Header `[0]` "Legendary Action Uses: 3 (4 in Lair)" — name string only, **no `uses` field** (MA-0092 gate absent).

## Expected
Clicking Pounce resolves the referenced Rend melee attack: d20+14 vs target AC, 13 (1d10+8) Slashing + 5 (2d4) Fire on hit, nothing on miss, attack/damage log entries, legendary-use spend. Movement clause advisory (§7 — no grid-move consumer).

## Referenced Rend (`actions[1]`, confirmed static)
`attack_bonus: 14`, reach 10 ft, `1d10 + 8` Slashing + `2d4` Fire — the numbers Pounce is supposed to reuse.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: EB Join (Adult Red Dragon) → cs idx 0 `Adult Red Dragon 1` (HP 256, AC 19, init 4); armed target **ElderPaladin** via dragon-card target-select — server-side cs `targetName:"ElderPaladin"` confirmed. Baseline log 0 entries.
- Pounce row in `.mc-overlay`: `DIV.mc-action`, `cursor:auto`, outerHTML `<div class="mc-action"><strong>Pounce.</strong> <span>The dragon moves up to half its Speed…</span></div>`; interactive children (`button/a/[role=button]/.mc-dice-link/input/select`) = **0** — no clickable Rend affordance.
- Trigger: trusted `.click()` + forced pointerdown/mousedown/pointerup/mouseup/click/dblclick on row + inner span: **zero popups** (`.popup/.sp-overlay/.popup-overlay/.dice-roll-panel` = []), log delta 2 → 2 (join + initiative only), `lastAttack: null`, zero new change-data keys (only `combat-ui-viewingMonster*` card-open mirrors), no HP change.
- Legendary economy: no `[class*=legendary]` counter in overlay (0); `monsterLegendaryUses` key **never created** (absent post-probe) — header dict lacks `uses`, `legendaryHeaderAction` gates on `rows[0]?.uses != null` (`monsterLegendaryUses.js:127`). Spend question moot: row never fires (MA-0092/95/116 fingerprint).

## Control probe (engine alive, defect isolated to this row)
Same overlay, same armed target: **Rend** row carries live `span.mc-dice-link "+14"`; click → popup-overlay "✓ HIT (19 vs AC 19)"; log `roll/attack` Rend `rolls:[5,7] total:5 bonus:+14` (5+14=19 ≥ AC 19, hit); `roll/damage` `1d10 + 8 → 14` Slashing (+ Fire leg); `hp_change ElderPaladin delta:-17`. Done applied cleanly. Engine + attack-roll machinery fine; Pounce row is the unwired gap.

## Grep evidence
- `rg -rni pounce src server --glob '!*.test.*'` excluding PC "Instinctive Pounce" (`combatStanceHandler.js`): **zero hits** — no consumer/handler/key keyed to any monster legendary Pounce row.
- Render gate: `MonsterAction.jsx` `numericAffordance = attack_bonus != null || save_dc != null || canRollExpression(formula)` (MV-23) — Pounce carries none → inert by construction (MV-28: row referencing a live component with zero own affordance = FAIL).
- Legendary economy gate: header lacks `uses` → no counter, ungated-by-absence (MA-0092).

## Steps to Reproduce
1. test-campaign → Encounters → search "Adult Red Dragon" → check → Join Encounter.
2. Initiative → arm target (ElderPaladin) on dragon card → click avatar → `.mc-overlay`.
3. Legendary Actions → Pounce row: no dice link; trusted or forced clicks produce no roll, no popup, no log, no HP change, no `monsterLegendaryUses`.
4. Control: Actions → Rend "+14" link rolls + hits (19 vs AC 19) + logs + applies damage — engine fine, row inert.

## Fix sketch (data-shaped)
Give Pounce an automation link on the row (`attack_bonus: 14` + `1d10 + 8` slashing + `2d4` fire mirrors, or `{type:'pounce_rend'}` referencing the Rend numbers) and author header `uses: 3` (MA-0092 fix) so existing legendary economy + attack-roll machinery activate unchanged. Movement clause stays advisory (§7).

## Cleanup (verified)
`.mc-overlay` closed; Admin clear-change-data 200, clear-log 200; final: log 0 entries, change-data keys []. test-campaign only; manifest `verified` untouched.
