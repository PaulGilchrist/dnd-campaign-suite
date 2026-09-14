# Bug MA-0095 — Adult Copper Dragon · Pounce (legendary_actions / other)

**Verdict: FAIL — inert row, no automation.** (MV-30: inert = FAIL flavor(b); exact MA-0040/MA-0083 fingerprint; contradicts MA-0072's PASS label.)

## Row
- MA-0095 · Adult Copper Dragon (`adult-copper-dragon`) · legendary Pounce · category: legendary_actions · actionType: other.
- Row text (quoted): "The dragon moves up to half its Speed, and it makes one Rend attack."
- monsters.json (`adult-copper-dragon.legendary_actions[3]`): `{name:"Pounce", description:"…"}` — **no attack_bonus, no save_dc, no dice, no automation metadata** on the row.

## Expected
Clicking Pounce resolves the referenced Rend melee attack: d20+11 vs target AC, 17 (2d10+6) Slashing + 4 (1d8) Acid on hit, nothing on miss, with attack/damage log entries; legendary-use spend per MA-0092 budget prose; movement clause advisory (§7 — no grid-move consumer; token movement is display-only).

## Rend reference data (confirmed, monsters.json `actions[1]`)
`Rend`: `attack_bonus: 11`, reach 10 ft, `2d10 + 6` Slashing + `1d8` Acid — the numbers Pounce is supposed to reuse.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: EB Join → cs idx 0 `Adult Copper Dragon 1` (npc, HP 184, AC 18); armed target **ElderPaladin** via dragon-card `[data-testid="target-select"]` (cs `target:"ElderPaladin"` confirmed server-side).
- Pounce row DOM in `.mc-overlay`: `DIV.mc-action`, `cursor:auto`, 136 B (`<strong>Pounce.</strong> <span>…</span>`), interactive children (`button/a/[role=button]/.mc-dice-link/input/select`) = **0** — no click affordance (MV-23 shape: no numeric fields, so no affordance possible).
- Trigger: trusted Playwright click on row, then forced pointerdown/mousedown/pointerup/mouseup/click/dblclick on row + inner span: **zero popups** (`.popup/.sp-overlay/.popup-overlay/.dice-roll-panel` = []), **log delta 2 → 2** (join + baseline roll only), `lastAttack: null`, ElderPaladin HP unchanged, zero new change-data keys.
- Legendary economy: no `.mc-legendary-counter`; `monsterLegendaryUses` key **never created** (absent pre/during/post) — spend question moot: the row never fires, so neither consumes nor refires anything (MA-0092 fingerprint: header has no `uses`, whole dragon un-gated).
- Control probe (proves arming + attack machinery alive, isolating the defect to this row): same overlay, **Rend** action row carries live `span.mc-dice-link "+11"`; clicking it → popup "✓ HIT (20 vs AC 19)"; logs: `roll/attack` Rend `rolls:[9,2] total:9 bonus:+11` (9+11=20 ≥ AC 19, hit), `roll/damage` `2d10 + 6 → 18` Slashing (+ acid leg), `hp_change ElderPaladin delta:-24`, `lastAttack` stamped (attacker Adult Copper Dragon 1, target ElderPaladin, hit:true). Done applied damage cleanly.

## Grep evidence
- `grep -rni pounce src server` (non-test, excluding PC "Instinctive Pounce" in `combatStanceHandler.js`): **zero hits** — no consumer, handler, or key keyed to any monster legendary Pounce row.
- Render gate: `MonsterAction.jsx` emits `mc-dice-link` affordances only for rows carrying `attack_bonus`/`save_dc`/dice; Pounce carries none → inert by construction (playbook 42z / MV-23).
- Legendary economy gate: `monsterLegendaryUses.js` `legendaryHeaderAction` requires header `uses != null`; Copper header lacks it (MA-0092 root cause #1) — even a wired Pounce would face ungated/absent budget.

## Fingerprint match
- MA-0040 (Adult Black) / MA-0083 (Adult Bronze): identical authored shape (name+description only) + identical inert behaviour (0 affordances, zero log/CD delta on force-click).
- MA-0072 (Adult Brass Pounce) labelled PASS — label discrepancy noted in MA-0083; FAIL re-confirmed for this family.
- MA-0092 (this dragon, legendary header): no `uses` budget app-side; Pounce is one of the inert legendary rows named in its render-branch analysis.
- §7: "moves up to half its Speed" has no grid-move consumer — advisory clause, not counted against; the **missing Rend attack-roll producer** is the actionable defect.
- MV-28: Rend referenced by name only; no producer wires the reference (control proves Rend itself resolves fine when its own row carries metadata).

## Steps to Reproduce
1. test-campaign → Encounters → check Adult Copper Dragon → Join Encounter.
2. Initiative → arm target (e.g. ElderPaladin) on dragon card → click avatar → `.mc-overlay`.
3. Legendary Actions → Pounce row: no dice link; trusted or forced clicks produce no roll, no popup, no log, no HP change, no `monsterLegendaryUses`.
4. Control: Actions → Rend "+11" link rolls + hits + logs + applies damage — engine is fine, row is inert.

## Fix sketch (data-shaped)
Give Pounce an automation link on the row (e.g. `attack_bonus: 11` + `2d10 + 6` slashing + `1d8` acid mirrors, or a dedicated `{type:'pounce_rend', trigger:...}` referencing the Rend numbers) and author header `uses: 3` (MA-0092 fix) so the existing legendary economy + attack-roll machinery activate unchanged. Movement clause stays advisory (§7).

## Cleanup
- `.mc-overlay` closed; Admin clear change-data (200) + log clear (200) verified: log 0 entries, change-data emptied (only `combat-ui-viewingMonsterCreatureName` mirror remains). test-campaign only; manifest `verified` untouched.
