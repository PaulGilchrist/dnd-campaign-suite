# Bug: Stored tracked-resource pool never clamps to derived max — level-down yields inverted pool (95/65) and over-cap spending

## Summary

A character's stored `layOnHandsPool` (and, by the same read path, every tracked resource and even `currentHitPoints`) is returned verbatim whenever the bucket key exists — it is never clamped against the level-derived max. A level change that lowers the max (realistic today: a DM editing a character's level down, a class re-sync, or any future level-drain effect) leaves the bucket riding ABOVE the new max: the sheet badge and healing modal render an inverted fraction (`95/65`), the amount input's `max` is the stored (too-high) value, and a level-13 paladin can legally spend 70 pool HP — more than the class's entire 65-point capacity at that level. The overshoot silently persists across reloads; nothing re-clamps it.

## Steps to reproduce

1. In `test-campaign` on localhost, with a clean change-data baseline, seed a victim: full-store `POST /api/campaigns/test-campaign/EvasiveFighter` `{"value":{"currentHitPoints":40,"activeConditions":[]}}` and a hand-rolled 3-row `type:player` `combatSummary` board (ElderPaladin / EvasiveFighter 40/112 / AasimarTest) via full-store `POST /api/campaigns/test-campaign/combatSummary` `{"value":{...}}`.
2. Open ElderPaladin's sheet once (seeds the owned `layOnHandsPool` bucket key at 100 for L20), then `PATCH /api/campaigns/test-campaign/ElderPaladin` `{"value":{"layOnHandsPool":95}}` (GET-verify: bucket shows 95; the `applied:0` counter is a known lie).
3. Edit `public/campaigns/test-campaign/ElderPaladin.json` on disk: `"level": 20` → `"level": 13` (single unique string; the fixture has no `class_levels` key).
4. Reload the tab, re-select `test-campaign`, open ElderPaladin's sheet.
5. Observe the summary badge: `Lay On Hands Pool: 95/65 (cur/max)` — current above the derived max (5×13=65).
6. Click the `Lay On Hands:` Bonus-Actions row → choose EvasiveFighter (`Select EvasiveFighter, 40 of 112 HP` radio, then the picker's `Heal` button).
7. Observe the modal header `Pool: 95 / 65 HP` and the amount input `max="95"`.
8. Type `70` into Amount → `Apply Heal`.
9. Observe: the heal commits (EF 40→110), the ledger row reads `Heal | EvasiveFighter | 70 | 25`, and the bucket now stores 25 — a level-13 paladin spent 70 pool HP, more than the 65 a L13 paladin has in a lifetime, and the invalid 95/65 state persisted untouched through a full reload until spent.

## Expected behavior

When the derived max drops below a stored current, the resource should clamp on read (`min(stored, derivedMax)`), or the load path should rewrite the bucket to the capped value with honest feedback — the UI should never display `95/65` and should never allow spending above the class-derived capacity (`max` should have been 65).

## Actual behavior

- Sheet badge: `Lay On Hands Pool: 95/65 (cur/max)` (inverted fraction rendered verbatim).
- Modal: `Pool: 95 / 65 HP`, amount `max=95`, commit of 70 fully succeeds (`Pool: 25 / 65`, ledger `Heal|EvasiveFighter|70|25`, bucket `layOnHandsPool:25` persisted).
- Side face on the same rig: the chooser row for ElderPaladin itself read `Select ElderPaladin, 224 of 147 HP` — the bucket's `currentHitPoints` (224, L20-era) likewise persists above the level-13-derived max (147); the same no-clamp law applies to HP.
- No console errors, no failed requests — the app is confidently, silently wrong.

## Likely location

Confident on the read path: `src/hooks/runtime/useTrackedResource.js` `resolveCurrent()` returns `getRuntimeValue(...)` verbatim when the key exists (`if (hasKey && storedValue != null) return storedValue;`) with no `min(stored, maxGetter())` clamp, and `src/components/char-sheet/modals/divine/HealingPoolModal.jsx` computes `safePool = Number(poolRemaining) || 0` / `safeMax = Number(poolMaxFromHook) || 0` independently, so display and spend both ride the unclamped stored value. `addPaladinDivineResources` in `src/services/rules/trackedResources.js` derives `maxLoH = 5 * level` but only seeds `{current, max}` where the key is ABSENT (owned-only idiom `ee3c3e7a7`) — it never re-caps an existing stored current. The `CharSummary.jsx` badge shares the hook, hence `95/65`. The `currentHitPoints` side face lives in whatever sheet-open re-bake path re-seeds the bucket (`CharSheet.jsx` sheet-open rebake, cf. `bug-sheet-open-rebake-evicts-prior-session-conditions`).

## Suggested fix

Clamp at the single resolve point: in `resolveCurrent`, when `hasKey && storedValue != null`, return `Math.min(Number(storedValue), maxGetter())` for numeric resources (or add an opt-in `clamp: true` for the pool-family keys so non-numeric/record-bucket consumers are untouched). Optionally also persist the clamp once (write-back) so the ledger and bucket converge. Check `currentHitPoints` separately — clamping that one needs care (temp HP, sorcery-consumed HP semantics), so decide whether the HP leg rides this fix or an owner ruling. Add a unit pin: stored 95 + derived max 65 → resolved current 65.

## Severity

Data integrity risk — a persisted, self-perpetuating invalid state that lets a resource spend exceed its class-derived capacity and renders inverted numbers across badge/modal/chooser; triggered by any event that lowers a derived max (level edit downward, respec tooling). Not currently reachable via normal leveling-UP play, which is why it survived every prior healing-lane descent.
