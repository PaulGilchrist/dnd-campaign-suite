# MA-0262 FAIL — Ancient White Dragon Pounce (legendary_actions[3]) inert prose

## Verdict
FAIL — inert-prose family (MA-0253/MA-0164/MA-0209 fingerprint confirmed).

## Evidence (2026-09-16)
- Static: `public/data/monsters.json` ancient-white-dragon legendary_actions[3] = bare `{name:"Pounce", description:"The dragon moves up to half its Speed, and it makes one Rend attack."}` — no delegates_to/uses/attack_bonus/save_dc. Header legendary_actions[0] also bare (no `uses`; cf MA-0259).
- UI (test-campaign header verified, cs idx1 init 9): Pounce row renders `DIV.mc-action` with 0 affordances (`button,a,.mc-dice-link,[role=button]` = 0; innerHTML = `<strong>Pounce.</strong> <span>…</span>`). Forced clicks on row + label → 0 overlays, log count 212→212 zero delta, zero `pounce` log entries (curl GET).
- Control (engine alive): Rend chip live — trusted click rolled "d20 2 +14 (+16… 16 vs AC 19) MISS", logged roll id f2c85986 `characterName:"Ancient White Dragon 1", rollType:"attack", name:"Rend"`; log 212→213.
- Grep: zero src consumers/delegates handlers for dragon Pounce (only unrelated barbarian `_instinctivePounce`, combatStanceHandler.js:141/394).

## Fix template (verified on disk first)
adult-white-dragon on disk HAS the MA-0145 fix: Pounce `delegates_to:"Rend"` + header `uses:3` + advisory prose. Ancient-white needs the same: header `uses:3` + Pounce `delegates_to:"Rend"` (anchor monster-unique per MA-0209 pitfall).

## Secondary
Move-half clause unmodellable (§7, no movement-distance consumer) — advisory prose only, same as adult template.
