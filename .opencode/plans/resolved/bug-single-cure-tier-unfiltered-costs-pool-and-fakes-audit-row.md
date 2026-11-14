# Lay On Hands SINGLE-cure tier renders alsoCures unfiltered — curing a condition the target never had costs pool HP and logs a fake `condition broken` row

## Summary
When the healing-pool modal falls to its SINGLE-cure tier (`!hasRestoringTouch && alsoCures` — the tier every real 2024 Paladin BELOW level 14 rides, since Restoring Touch is the L14 class feature), the `Cure Conditions (5 HP each)` section lists every `alsoCures` entry regardless of the target's actual conditions. Pressing a listed cure on a NOT-afflicted target still deducts the full `cureCost` from the pool and posts a `condition broken` audit row for a condition the target never had. The sibling BATCH tier (Restoring Touch, L14+) filters correctly (`buildCurableEntries` ∩ target conditions) — the single tier skips the filter entirely.

## Steps to reproduce
Proven live 2026-11-13 (run GZ) in test-campaign. The tier was synthesized on an L20 fixture via a sanctioned temporary rename of `Restoring Touch` → `Restoring Touch QZ` in `public/data/2024/classes.json` (single occurrence, `/6/class_levels/13/features/0`; restored byte-exact at exit) — that simply removes the L14 lookup hit (`healingPoolHandler.js buildHealingPoolPayload` finds the RT feature by NAME in `playerStats.specialActions`), which is EXACTLY the state a genuine level 1–13 2024 Paladin is in natively.

1. In test-campaign with a seeded combatSummary containing EvasiveFighter and AasimarTest, give the paladin a target: ensure **EvasiveFighter** has NO conditions (its bucket `activeConditions: []`).
2. Open the paladin sheet → click the `Lay On Hands:` action row → chooser → select **EvasiveFighter** → Heal.
3. Observe the modal: a `Cure Conditions (5 HP each)` section renders listing `poisoned` (raw lowercase) even though the target has zero conditions.
4. Press the `poisoned` button.
5. Observe: the header pool drops by exactly `cureCost` (observed 90 → 85), the modal log row `Cure Poisoned  EvasiveFighter  5  85` appears, and `POST /api/campaigns/test-campaign/log` writes
   `{"type":"condition","characterName":"EvasiveFighter","condition":"Poisoned","action":"broken","sourceName":"ElderPaladin","featureName":"Lay On Hands",…}`.
6. GET `/api/campaigns/test-campaign/change-data`: EvasiveFighter's `activeConditions` is still `[]` (nothing to remove) but `layOnHandsPool` shows the spent 5 HP; the log now contains the fake row.
7. Control (afflicted target): open LoH on **AasimarTest** (bucket `activeConditions: ["Poisoned","Prone"]`) → press `poisoned` → honest: pool −5, bucket loses only Poisoned, one genuine `condition broken` row.

## Expected behavior
Either the section filters `alsoCures` by the target's actual conditions (mirroring `buildCurableEntries` in the batch tier — nothing renders when the target has nothing curable), or at minimum the commit refuses with zero pool cost and zero audit row when `conditionMatches` finds no match — same honesty law the healing lanes just adopted (d595cff2c no-die-spent gate, e7fb36ef0 `(Already at full HP)`, f3950317c pre-spend refusal).

## Actual behavior
Unconditional cost + unconditional fake audit row. Only the HP write was spared, and purely by accident: `applyCure`'s `setRuntimeValue('activeConditions', filtered)` dedupes because `filtered` deep-equals the current bucket — the POOL write and the `addEntry` row land regardless. The button label is also the raw lowercase metadata key (`poisoned`) while the batch tier and the modal log row show the catalog label (`Poisoned`) — inconsistent display within the same section header.

## Likely location
Confident (code read matches live behavior 1:1):
- `src/components/char-sheet/modals/divine/HealingPoolModal.jsx` → `ConditionCureSections`, the `{!hasRestoringTouch && alsoCures && …}` block (~L92–103): maps `[...new Set(alsoCures)]` straight to buttons — no `targetConditions` filter, and renders `{condition}` raw.
- Same file → `applyCure` (~L572): `setPoolRemaining(newPool)` and `addEntry(… condition broken …)` run before/independent of whether `filtered.length < conditions.length`.
- Feed source: `src/services/automation/handlers/healing/healingPoolHandler.js` `buildHealingPoolPayload` (`alsoCures: auto.alsoCures || []`, RT looked up by name from `playerStats.specialActions`).

## Suggested fix
Pass `curableEntries` (already computed for the batch tier via `buildCurableEntries`) into the single tier too and render buttons only for entries the target actually has; additionally guard `applyCure`: compute `filtered` first, and if nothing was actually removed, show the inline refusal note (`.healing-restriction-note`, same seam as f3950317c) with zero pool spend and zero row. Button label should use `conditionLabel(key)` like the batch tier. `HealingPoolModal.curing.test.jsx` is the natural home for the three new faces (unafflicted hidden / unafflicted press inert / label cased).

## Severity
Data integrity risk — every sub-14 2024 Paladin can silently drain a limited long-rest pool for nothing and poison the campaign log with `condition broken` rows that claim conditions which never existed (downstream consumers of `condition`/`broken` rows — rest-seam bystanders, condition HUDs — read those rows as truth).

## Resolution
FIXED 2026-11-13 (fix run). Both defects in the "Likely location" were confirmed exactly as diagnosed, and BOTH layers now fixed in `src/components/char-sheet/modals/divine/HealingPoolModal.jsx`:

1. **Render filter** — the single tier (`!hasRestoringTouch && alsoCures`) now renders the SAME target-filtered `curableEntries` the batch tier already builds via `buildCurableEntries` (an alsoCures entry the target doesn't actually have never renders), with the catalog `entry.label` on the button instead of the raw lowercase key. `buildCurableEntries` itself gained key-based dedupe (the single tier's old `[...new Set(alsoCures)]` contract, previously absent on the shared builder — it also shields the batch tier from duplicate-key buttons if an entry ever appears in both lists).
2. **Commit guard** — `applyCure` now re-reads the live `activeConditions` bucket at commit time, computes `filtered` FIRST, and when `conditionMatches` removes nothing it refuses with zero pool spend, zero target write, zero audit row and an inline `.healing-restriction-note` (same seam/copy law as the f3950317c HoH pre-spend refusal): `<Target> is not affected by <Label>. No pool spent.` The note renders as a SIBLING of the section inside `ConditionCureSections` (after the refusal the re-render filters the whole section away — a note inside it would vanish with it). This covers the modal-dwells-while-another-writer-cures face (the render filter alone can go stale).

No handler change needed (`buildHealingPoolPayload` stays the honest feed); no 5e counterpart — `alsoCures` exists only in `public/data/2024/classes.json` (LoH L1 `alsoCures:["poisoned"]`, cureCost 5; RT is the L14 feature). The batch tier's own commit loop was left untouched (out of scope, selection already filtered at render, all its pins intact).

**Files changed:** `src/components/char-sheet/modals/divine/HealingPoolModal.jsx` (fix), `src/components/char-sheet/modals/divine/HealingPoolModal.curing.test.jsx` (regression pins).

**Tests:** the two stale pins were inverted in-place — the "individual (deduped)" render case now sets target conditions explicitly (and a new unafflicted-target case pins section-absence), and the raw-key casing test now asserts the CATALOG-CASED button (`cureBtn('Blinded')` from `alsoCures:['blinded']`). New `single-tier commit guard` describe adds the press-inert face (external bucket drift mid-dwell → note, zero writes/pool/row, no log table) and the stale-ENABLE face (re-applied condition + re-render → honest single commit). Order run: curing file 25/25 → `src/components/char-sheet/modals/divine` 16 files/245 → `src/components/char-sheet/modals` + `handlers/healing` 261 files/2377 ALL green → `npm run lint` zero warnings → `no-timers-guard` OK.

**Live re-verification (test-campaign on :5173, sanctioned classes.json `Restoring Touch`→`Restoring Touch FIXZ` synthesis re-ridden, restored BYTE-EXACT at exit — `git diff public/data/2024/classes.json` EMPTY, md5 `8d06a8c2`):**
- Pre-fix repro first CONFIRMED live: SINGLE tier on condition-less EvasiveFighter listed raw `poisoned`; pressing it → pool 100→95 on disk, `activeConditions` stayed `[]`, fake `condition broken/Poisoned/EvasiveFighter` row in the log.
- Face A (unafflicted): LoH→EvasiveFighter → NO `Cure Conditions` section at all; zero writes.
- Face B (afflicted): LoH→AasimarTest (`Poisoned,Prone`) → section renders CASED `Poisoned`.
- Face C (commit guard): external full-store POST cleared AS conditions mid-dwell → pressing the stale `Poisoned` button showed verbatim `AasimarTest is not affected by Poisoned. No pool spent.` on `.healing-restriction-note`; GET proved pool stayed 95, bucket `[]`, log row count unchanged.
- Face D (honest control): re-afflicted, pressed `Poisoned` → pool 95→90, bucket lost only Poisoned (`Prone` kept), ONE genuine cased `condition broken` row; section re-filtered to nothing after the cure.
- Adjacent batch tier (RT restored, native L20 face): section lists EXACTLY the 3 matching conditions (Poisoned/Blinded/Frightened; RT's unmatched Deafened/Charmed/etc hidden); batch-cure 2 → running-pool rows 85/80, one pool write 90→80, two cased broken rows, survivors re-filtered; unafflicted EvasiveFighter under the batch tier renders no section; amount-lane control honest (`actualHeal:0` row on a full-HP target — pre-existing lane behavior, untouched).
- Exit hygiene: closed-tab two-pass admin clears GET-verified `change-data {}` + `log []` + overlays `[]`; `git status --porcelain` shows ONLY the two source/test files + this bug file move.
