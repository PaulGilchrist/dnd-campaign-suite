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

## Resolution

**FIXED 2026-11-14 (fix run).** Root cause confirmed exactly as diagnosed: `useTrackedResource.js` `resolveCurrent()` returned the stored bucket value verbatim whenever the key exists, with no clamp against the level-derived max, so a level-down left `layOnHandsPool: 95` riding above the L13 capacity of 65 — badge/modal rendered `95/65` and the spend lane billed past class capacity.

**Fix (clamp at the single resolve point, as suggested):** `resolveCurrent()`'s stored-bucket branch now runs `clampToMax(storageKey, storedValue, maxGetter)` → `Math.min(stored, maxGetter())` for finite numbers. Guards keep every sibling lane byte-identical:
- **Non-numeric pass-through** (typeof + `Number.isFinite` check both sides) — the `hasInspiration` boolean latch (`maxGetter: () => false`) and null-as-armed latches ride their stored value untouched.
- **HP family exempt** (`CLAMP_EXEMPT_KEYS = ['currentHitPoints','hitPoints']`) — the `224 of 147 HP` side face stays a separate owner ruling (temp-HP / heal-overflow semantics, per this file's own instruction); note the HP row (`CharHitPoints.jsx`) and the chooser's `resolveLiveTargetHp` read the store directly and never rode this hook, so the exemption costs nothing today and forbids an accidental future clamp.
- **Seed/default branches untouched** — `_trackedResources` seeds are `{current: max}`-consistent by construction.
No write-back added: the modal's existing `newPool = safePool - actualHeal` arithmetic rewrites the bucket to a valid value on the first spend (self-healing), so display and ledger converge without a read-path server write. Both rulesets share this hook — no 2024 twin needed.

**Files changed:**
- `src/hooks/runtime/useTrackedResource.js` — `clampToMax` + exemption list, applied to the stored-bucket branch.
- `src/hooks/runtime/useTrackedResource.max-clamp.test.js` — NEW: 7 pins (stored 95 + derived max 65 → resolved 65; re-clamp on storage-change re-read; ≤max pass-through incl. 0; boolean latch unclamped; HP exempt; non-finite max pass-through).
- `src/hooks/runtime/useTrackedResource.test.js` — two stale micro-pins updated: the `maxGetter` call-count pin (clamp legitimately reads max) and the campaignName re-read plumbing pin whose arbitrary stored 42 exceeded the test's own max 20 (→ 12; intent preserved).

**Live re-verification (test-campaign, :5173, exact repro re-run):** EF victim 40/112 + 3-row board; EP sheet-open → real L20 heal (pool 100→78 — pre-fix sanity control, honest); scoped PATCH pool→95; disk `"level": 20`→`13` (sanctioned one-field surgery); reload + re-select + open sheet.
- Pre-fix faces re-witnessed on the same rig shape (bug CONFIRMED before code change): badge `95/65`, modal `Pool: 95 / 65 HP`, amount `max="95"`, 70-typed commit succeeded (`Heal|EF|50|45` capacity-clamped, bucket rode >65 invalid); HP side face `Hit Points: 224/147`.
- Post-fix: badge **`Lay On Hands Pool: 65/65 (cur/max)`**, modal **`Pool: 65 / 65 HP`**, amount **`max="65"`**; typing 70 → display clamps to 65 with the shipped note `Amount clamped to the remaining pool of 65 HP.`; commit = **65 pool HP max** (`Heal|EvasiveFighter|65|0`, EF 40→105), log row `{type:'healing_pool', amount:65, poolAfter:0}` — the inverted state no longer renders and over-cap spending is impossible.
- Adjacent sanity: sub-max lane unaffected — bucket 30 (< max 65) renders `30/65` verbatim, a typed-10 heal commits the honest capacity amount (`amount: 7`, `poolAfter: 23` persisted). HP side face intentionally unchanged (`224/147`), as ruled.
- Cleanup: `ElderPaladin.json` restored byte-exact (md5 `6e4341e4…`, `git status --porcelain public/campaigns/ public/data/` EMPTY); closed-tab admin clears GET-verified `{}`/`[]`, disk change-data file absent.

**Tests/lint:** `useTrackedResource.max-clamp.test.js` + `useTrackedResource.test.js` 32/32; `src/hooks/runtime/` folder 171/171; consumer folders `modals/divine/` + `TrackedResourceInput.test.jsx` 273/273; `npm run lint` zero warnings; full `npm run test:run` green (see fix-run return).
