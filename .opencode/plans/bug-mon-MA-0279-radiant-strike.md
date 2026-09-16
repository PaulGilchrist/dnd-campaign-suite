# BUG MA-0279 — Animal Lord legendary_actions[2] "Radiant Strike" — FAIL (inert prose)

## Verdict: FAIL

## Row
- monster: Animal Lord (animal-lord), legendary_actions[2], actionType other
- text: "The animal lord makes one Radiant Ray attack."

## Evidence (Playwright + curl, read-only, test-campaign header verified)
1. **Static DATA bare**: `public/data/monsters.json:5033` legendary_actions[2] = `{name, description}` only — NO `delegates_to`, no attack/members fields. Same inert shape as MA-0278 Feral Strike / MA-0277 header.
2. **Zero affordances**: live card (Animal Lord 1, cs idx0, init 20) legendary section — row innerHTML = `<strong>Radiant Strike.</strong> <span>The animal lord makes one Radiant Ray attack.</span>`; 0 buttons / 0 dice-links / no role=button.
3. **2 clicks → zero delta**: clicked row text twice; log lastId unchanged `4cbcb700-574a-3a17-bbd9-1dfd1f93922b` (GET /api/campaigns/test-campaign/log, 500 entries), "Radiant Strike" log entries = 0. No modal, no spend, no roll.
4. **Control alive**: Radiant Ray chip (+12, actions) one roll → popup `d20 15 +12 → HIT (27 vs AC 13)`, Done → log new entries: attack roll, damage roll, `hp_change HeroesFeastBard -27 (141→114)`; victim topped back to 163 via GM HP input (verified character-change-data.json currentHitPoints=163).
5. **Grep producers = zero**: `grep -rn "Radiant Strike"` in src/ + server/ → no hits (only monsters.json data rows + unrelated classes.json "Radiant Strikes" class feature / CLA-280 test).

## Root cause
DATA: bare legendary prose entry with no `delegates_to` key; delegation in `server/utils`/`monsterLegendaryUses.js:9` is KEY-ONLY (`r.name === action.delegates_to`), zero name-proximity → row renders inert, ungated, zero-spend (MA-0277 header also has no uses counter).

## Fix
- `legendary_actions[2]`: add `delegates_to: "Radiant Ray"` (delegation to live MA-0274 chip recipe).
- Header row[0]: add `uses: 3` field so legendary counter/gating goes live (MA-0136 pattern).
