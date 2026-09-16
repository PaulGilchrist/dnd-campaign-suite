# MA-0307 — Arch-hag Hag's Swipe (legendary_actions[1]) — FAIL (inert legendary child)

## Row
- stableKey: arch-hag|legendary_actions|1
- actionType: other
- description: "The hag makes one Spectral Claw attack."
- Raw dict: name+description only (no attack_bonus/damage/delegates_to/uses).

## Evidence (live run MA-0306 session 2026-09-16, cs idx2 "Arch-hag 1" init19, test-campaign header verified)
- Legendary child renders as plain text `.mc-action`; zero clickable affordances (`[role=button]/.mc-dice-link` query = `[]`).
- Hag's Swipe ×4 consecutive clicks: popups `[]`, zero new log rows (log head unchanged at pre-probe Fire Bolt), zero refusals, Druid HP untouched.
- Delegate consumer EXISTS (`MonsterCardModal.jsx:305` MA-0022 seam) but requires authored `delegates_to` — absent on this row → no Spectral Claw numbers ever resolved from here (+14/3d6+7 live only on actions[1], verified MA-0302).
- No legendary-uses economy upstream (header ungated, `monsterLegendaryUses` null — MA-0306 fingerprint).

## Root cause
Data authoring gap: legendary child lacks `delegates_to` (+ header lacks numeric `uses`). Consumers exist and would auto-activate (MA-0022 delegate seam, monsterLegendaryUses.js:153-157).

## Fix (data)
`legendary_actions[1]` add `"delegates_to": {"monster_index":"arch-hag","category":"actions","index":1}` + header `uses: 3` on arch-hag dict; no code change required.
