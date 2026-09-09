# Bug — CLA-379 War Bond (Eldritch Knight lv3, 2024) — FAIL

**Date:** 2026-09-09 | **Host:** EvasiveFighter lv18 Fighter Eldritch Knight 2024 (subclass swapped from Battle Master via wizard step 7, disk-confirmed)

## Feature (public/data/2024/classes.json:5453, Eldritch Knight major lv3)
Automation ARRAY (manifest "type undefined" = array shape):
1. `passive_buff / war_bond_disarm_protection`
2. `war_bond_summon / bonus_action / bondedWeaponCount:2`

## Verified working (live, own probes)
- "War Bond:" row renders **clickable** in sheet Bonus Actions with onClick; click dispatches the real handler (`automation/index.js:386 → warBondHandler.js`).
- Empty-state guard popup live: "No bonded weapons. Bond a weapon first (up to 2)."
- With `warBondWeapons:['Scimitar']` seeded into change-data (GET→merge→POST + reload), click → popup "War Bond: Scimitar is summoned to your hand." and handler-persisted `warBondSummoned:'Scimitar'` (change-data curl-confirmed).

## Defects (each grep + live-probed)
1. **No bond flow — feature cannot bond in-app.** `warBondWeapons` has ZERO production writers anywhere in src/ (handler is read-only). No ritual/bond UI in wizard, sheet, or modals (grep "bond" in components = Warding Bond spell + flavor text only). The guard popup says "Bond a weapon first" but no such flow exists; a real player can never populate the pool — summoning is reachable ONLY via external API seeding.
2. **Two-weapon chooser dead.** `warBondHandler.js:42` returns `modalName:'warBondSummon'` — modal NOT registered anywhere (grep src/components: zero; no SecondaryModals/CharActionModals entry). Live: 2 bonded weapons seeded → row click yields ZERO overlays, ZERO console errors — modal result silently discarded ("collect ≠ consume" §8-20 trap). Core clause "up to two bonded weapons" unusable.
3. **Disarm protection fully inert.** `war_bond_disarm_protection` has ZERO consumers in src/ (non-test). No disarm mechanic exists ANYWHERE in the app (grep "disarm" src/services/combat|rules|components = zero hits). The "Can't be disarmed unless Incapacitated" clause has nothing to protect against and nothing to enforce.
4. **Logging gap (AGENTS.md).** Every interaction (guard popup, summon popup) logged ZERO campaign log entries; log count stayed 0 across all probes. Popup-only automation.

## Verdict: FAIL
Row is attemptable (clickable, handler fires, popup appears, keys persist once seeded) — inert-but-attemptable + dead consumers = FAIL per verdict policy, not INCOMPLETE. Summon-as-bonus-action works only as a half-feature (single pre-seeded weapon); bonding, two-weapon chooser, disarm protection, and logging are all absent.

## Fix pointers
- Add a bond flow (wizard step, item-long-rest ritual UI, or sheet action writing `warBondWeapons`, cap 2).
- Register `warBondSummon` modal (chooser → `handleSummon`), or auto-pick with popup listing both.
- Either model disarm at all (then gate on `warBondWeapons` + Incapacitated), or mark the passive display-only with note.
- Log summon + bond events (`ability_use`).

## Post-run state
- Subclass LEFT Eldritch Knight lv18 (retest host). change-data + log admin-cleared (warBond* keys removed). Servers running.
