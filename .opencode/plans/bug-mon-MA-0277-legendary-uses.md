# BUG MA-0277 — Animal Lord legendary header "Legendary Action Uses: 3" — FAIL (ungated economy)

**Row:** `animal-lord|legendary_actions|0` · **Verdict:** FAIL · **Date:** 2026-09-16
**Fingerprint family:** MA-0217 / MA-0250 / MA-0259 (prose-only legendary header → legendaryHeaderAction null → ungated)

## Symptom
Legendary section renders prose-only. No numeric uses counter, no spend, no refusal gate, no regain. Children (MA-0278 Feral Strike, MA-0279 Radiant Strike) are inert bare-prose rows (0 affordances each).

## Live evidence (test-campaign, header verified; card modal open, cs idx0 init 20, round 15, HP 323/323)
- DOM: `.mc-legendary-counter` = **0** doc-wide; header row = `<strong>"Legendary Action Uses: 3."</strong>` + prose only.
- Child affordances: Feral Strike row buttons/links/dice-chips = **0**; Radiant Strike = **0**; entire legendary `.mc-section` actionable elements = **0**.
- Fire probe: 2× clicks each child same window (`feral#1 radiant#1 feral#2 radiant#2` = clicked): **0 new log entries**, **no refusal**, **`monsterLegendaryUses` never created** (change-data top-level null, no legendary-ish key, AL keys unchanged: lastAttackRoll/_lastRollContext/pendingCombatSuperiorityPrompt/lastSaveRoll/monsterSpellUses).
- Round-wrap regain: no regain producer reachable — regainLegendaryUses seam runs but is documented no-op without a monsterLegendaryUses map (never created).

## Root cause — DATA
`public/data/monsters.json` animal-lord `legendary_actions[0]` = `{name:"Legendary Action Uses: 3", description:...}` — numeric 3 lives ONLY in the name string, **no `uses` field**. Consumer chain confirmed:
- `legendaryHeaderAction` (src/services/encounters/monsterLegendaryUses.js:153) requires `rows[0].uses != null` → returns null.
- `MonsterCardBody.jsx:38-54`: null header → ungated `MonsterActionSection` branch, no `MonsterLegendaryHeaderRow`/counter, children rendered without `legendaryGate` (bare rows also lack attack_bonus/save_dc/delegates_to so they render 0-affordance).
- `turnStartEffects.js:176` `regainLegendaryUses` no-ops without the map → no economy, no regain.

## Fix template (adult MA-0136 / adult-silver pattern, on disk)
Header row: add `"uses": 3`. Children: `delegates_to:"Rend"` / `delegates_to:"Radiant Ray"` (per MA-0145/MA-0269 precedent) to make them clickable gated legendary attacks. No engine change needed — gated machinery (counter, expend gate, once-per-turn latch, refusal log, turn-start regain) all exist and are healthy (MA-0021/0136 family).

## Children status
MA-0278 Feral Strike / MA-0279 Radiant Strike: inert bare prose, zero affordances, zero-delta clicks — companion FAILs pending (delegates_to absent).
