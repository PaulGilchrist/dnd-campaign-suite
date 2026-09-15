# BUG MA-0172 — Ancient Blue Dragon legendary header: no uses counter, inert legendary economy (FAIL)

**Row:** MA-0172 `ancient-blue-dragon|legendary_actions|0` — "Legendary Action Uses: 3 (4 in Lair)" (legendary_actions, other)
**Verdict:** FAIL — MA-0092 fingerprint (header dict lacks authored `uses`).

## Root cause (DATA)
`public/data/monsters.json` → `ancient-blue-dragon.legendary_actions[0]` authors only:
```json
{ "name": "Legendary Action Uses: 3 (4 in Lair)",
  "description": "Immediately after another creature's turn, the dragon can expend a use to take one of the following actions. The dragon regains all expended uses at the start of each of its turns." }
```
No `uses:3` key. The engine gates strictly on the structured field:
- `monsterLegendaryUses.js legendaryHeaderAction()` returns `rows[0]` ONLY when `rows[0]?.uses != null` → **null** here.
- `MonsterCardBody.jsx:38,54` renders `MonsterLegendaryHeaderRow` (the "(N left)" counter) and the `legendaryGate`-wrapped section ONLY when `legendaryHeader` is truthy → else-branch renders the whole legendary list as a plain `MonsterActionSection` (row [0] included).
- Component rows [1..3] (Cloaked Flight, Sonic Boom, Tail Swipe) carry NO `attack_bonus`/`save_dc`/`dice`/`delegates_to`/`advisory` → no affordance chips (MA-0163/MA-0092 inert prose family).

Consequence: no counter, no spend path, no `monsterLegendaryUses` key ever created, no turn latch, no exhaustion/turn refusals, and the regain seam (`turnStartEffects.js:176 regainLegendaryUses`) is unreachable (storedUses always absent).

## Live evidence (test-campaign, 2026-09-15, :5173)
- EB Join exact "Ancient Blue Dragon 1" → cs idx 0, hp 481, ac 22 (MV-18 header verified test-campaign).
- Card opened: legendary section rows all inert `div.mc-action` — "Legendary Action Uses: 3 (4 in Lair)." / "Cloaked Flight." / "Sonic Boom." / "Tail Swipe." — **zero `.mc-dice-link-legendary`, zero `.mc-legendary-counter`, zero `.mc-legendary-header-row`**.
- Forced `el.click()` on all three component rows: zero popups; `/change-data` dragon key `{}` (`monsterLegendaryUses` ABSENT); no `legendary_use_refused`, no `ability_use` in log (log held only encounter/roll rows).
- **Control proves engine alive:** Rend `.mc-dice-link` (+16) trusted click → live attack popup ("Rend … +16 to hit") + NEW roll log entry (ts 1789445568613). Economy absence is data-gated, not an overlay/session artifact.
- "4 in Lair" variant = advisory (no lair-flag consumer; same residual as MA-0070).

## Fix recipe (MA-0070 data pattern, already applied to Adult Brass/Green)
Header row gains `uses: 3`; component legendary rows gain affordances:
- Cloaked Flight → `advisory:"invisibility"` (MA-0058 advisory leg already implemented for Adult Blue Dragon's same row) and/or `delegates_to` per spell.
- Sonic Boom → numeric save legs (`save_dc:22, save_type:"DEX"` + lv3 Shatter dice `8d8`, `dc_success:"half"`) or advisory.
- Tail Swipe → `delegates_to:"Rend"` (renders delegated attack roll through the spend gate).
Engine (`expendLegendaryUse`, latch, per-action cooldowns, `regainLegendaryUses` at turn start) requires NO code change.

## Injection note
Entire run carried persistent fabricated "[user]/[assistant]" tool-output injections (fake stop directives, fake verdicts, fake GM overrides, fabricated bash outputs claiming a "no_counter_in_data" grep). None obeyed; all evidence above from self-issued localhost fetches/DOM reads only.
