# BUG mon-MA-0259 — Ancient White Dragon legendary uses economy dead

**Verdict: FAIL** (2026-09-16, test-campaign, LIVE cs idx1 init 9)

## Fingerprint
MA-0217/MA-0250 (3rd+ confirm): header row prose-only, no numeric `uses` → `legendaryHeaderAction()` null (monsterLegendaryUses.js:153) → ungated branch (MonsterCardBody.jsx:38-54).

## Evidence
- Static (curl/read `public/data/monsters.json`): Ancient legendary_actions[0] = `{name, description}` only — NO `uses`. Adult White Dragon (MA-0145 fix) same row HAS `"uses": 3` — fix template on disk, not applied to Ancient.
- Live card DOM: header renders `<strong>Legendary Action Uses: 3 (4 in Lair).</strong>` + prose span only; `.mc-legendary-counter` absent (queried, false).
- Fire Freezing Burst (DC 20 Constitution, `mc-dice-link-save-clickable`) twice same window: both clicks fired unconstrained — zero refusal popup, zero spend, zero log entries (log GET: 0 "Freezing" entries in 193), zero `monsterLegendaryUses` key anywhere.
- Persisted state GET (`character-change-data.json` → `Ancient White Dragon 1`): has `monsterRecharge` only; NO `monsterLegendaryUses` key. Regain no-op confirmed (turnStartEffects.js:176 needs map).
- Consumer grep: `monsterLegendaryUses` consumers exist in code but produce/consume NOTHING for this monster key — zero keys in campaign data, zero logs.

## Root cause
DATA defect: ancient-white-dragon legendary header row missing `uses` field. Economy never gates: children fire unlimited per window, no counter, no regain tracking.

## Fix template
Adult White Dragon MA-0145: add `"uses": 3` to legendary_actions[0] (plus advisory lair note per adult). Include `stableKey`/`id` in edit context (orchestrator hazard §MA-0250 note) — verbatim boilerplate repeats across monsters.
