# Cover sources stack additively — and the new audit message self-contradicts

## Summary
When a single sheet-lane ranged shot is covered by BOTH an enforcement-zones intervening creature (`combat/coverService.js` `_cover_shot` stamp, folded into `targetAc` by `computeTargetAc`) AND a furniture prop (`rules/combat/coverService.js` `computeCover` → `context.coverAcBonus`), the engine sums the two bonuses (+4 on top of raw AC). D&D 2024 RAW: multiple sources of cover never stack — only the highest degree applies (max +2 here). Worse, the effective-AC audit clause shipped in `improve(attack-log-cover-ac)` f78c06905 recomputes its annotation from `coverAcBonus` ALONE, so the row's prose states `vs AC 19 (1/2 Cover +2 AC)` while raw AC is 15 — the sentence's own arithmetic (15+2≠19) contradicts itself, exactly the self-contradiction class that improve was created to eliminate.

## Steps to reproduce
Dev pair on `:5173` (forced-d20 seam), campaign `test-campaign`:

1. Quick-spawn `Goblin` onto the Initiative board (AC 15, +4 lane irrelevant — attacker is a PC).
2. Create sandbox map `eee-cover` via `POST /api/campaigns/test-campaign/maps` with `gridSize:20`, `players:[{name:'EvasiveFighter',gridX:5,gridY:5},{name:'FeyRanger',gridX:12,gridY:12}]`, `placedItems:[{type:'npc',name:'Goblin',gridX:7,gridY:5}]`; `PUT /maps/eee-cover/activate`; reload + re-select.
3. Arm EF→Goblin: scoped `PATCH /combatSummary {value:{creatures:[{name:'EvasiveFighter',targetName:'Goblin'}]}}`.
4. Enable enforcement: `POST /enforcement {value:{mode:'on',zones:true,lineOfSight:true}}`.
5. PUT the map doc with BOTH cover sources on the interior cell of the shot line: `placedItems` carries `{type:'barrel',gridX:6,gridY:5}` AND `players` carries FeyRanger moved to `{gridX:6,gridY:5}`.
6. On EvasiveFighter's sheet press the Shortbow `+7` chip with `window.__forceNextD20(11)` (result must be read via the log row since Studied Attacks may or may not supply a second die).
7. Read the popup, the `roll|attack` log row, and `GET /change-data`.

## Expected behavior
- RAW (PHB 2024 "Cover": only the greatest degree applies): one half-cover (+2) → effective AC 17 → total 18 is a **HIT**. At minimum the engine must not apply +4.
- The audit message must be internally consistent: whatever AC it names, the annotated bonus must reconcile with the raw AC (15 + stated bonus = stated AC).

## Actual behavior
- Popup: `✗ MISS (18 vs AC 19)` with chip `1/2 Cover (+2 AC)` — adjudicated against raw+2+2=19.
- Log row bytes: `targetAc:17` (raw 15 + folded `_cover_shot` 2), `coverAcBonus:2`, `hit:false`, `message:"EvasiveFighter attacks Goblin with Shortbow: 11 +7 (+7 to hit) vs AC 19 (1/2 Cover +2 AC) — MISS"` — 15 + 2 ≠ 19; the parenthetical under-states the cover actually enforced.
- Two separate `enforcement_cover` audit rows plus the furniture badge — each lane alone is honest (`vs AC 17 (1/2 Cover +2 AC)` furniture-only and `vs AC 17` folded enforcement-only were both verified consistent this run); only the intersection breaks.

## Likely location
(Confident — code read + live bytes.)
- Fold site: `src/hooks/combat/targetAcComputation.js:42-45` (`computeTargetAc` adds the `_cover_shot` stamp into `targetAc`) vs the resolver `src/hooks/combat/hitResolution.js:291-292` (`effectiveAc = targetAc + context.coverAcBonus + …` — adds the furniture/TE bonus on top of the already-folded AC). No MAX-vs-SUM cover reconciliation exists.
- Message site: `attackAcClause` in `src/services/ui/logService.js` — assumes stored `targetAc` is RAW (true on the monster-chip lane and the pure-furniture sheet lane; false once the enforcement stamp folded it), so the annotation double-counts.

## Suggested fix
Decide the cover law in ONE place: cap the total cover bonus at the maximum single source (RAW no-stacking) instead of summing lanes. Concretely, in `hitResolution.js` compute `coverTotal = max(coverAcBonus_context, stamp.ac ?? 0)` and have `computeTargetAc`/`attackAcClause` read the same resolved pair — i.e. `targetAc` stored on the row should stay RAW and a single resolved `coverAcBonus` (the winning source) should ride the entry, so `targetAc + coverAcBonus` is always the truth the resolver used. Investigation needed into whether the monster-chip lane (`MonsterCardModal` `computeCoverState`) can also observe an enforcement stamp on the same shot (it reads its own map state — verify before choosing where the cap lives).

## Severity
Data-integrity risk — the engine records a WRONG verdict (`hit:false` on a shot that RAW says hits) in the shared, append-only audit trail, and the audit prose contradicts its own arithmetic; both mislead players, log search, and AI consumers. Reachable only with `enforcement.zones` ON plus prop cover on the same line, but that is exactly the configuration the flag exists for.

## Resolution
FIXED 2026-11-21 (e2e-fix run).

**What was actually wrong.** Confirmed the "Likely location" exactly: the §8.3 enforcement stamp folded `+2` into `targetAc` in `computeTargetAc` (`src/hooks/combat/targetAcComputation.js`) while `computeEffectiveAc` (`hitResolution.js:291-292`) unconditionally re-added the furniture lane's `context.coverAcBonus` on top — the only cover site in the engine that SUMMED two lanes. Every inside-lane cover reconciliation was already MAX-based (`rules/combat/coverService.js computeCover` returns a single tier; the grant loop in `contextBuilder-map.js` breaks at `acBonus >= 2`; DD/Bait-and-Switch folds use `>` comparisons). The audit-message contradiction was a pure consequence: whenever a row carried `coverAcBonus > 0` AND a folded stamp, `attackAcClause` printed `targetAc(folded) + cover` with the annotation measuring only the context lane. `attackAcClause` itself needed NO change.

**Fix (minimal, at the fold site).** `computeTargetAc`'s stamp fold now goes through a hoisted `foldStampCover` helper (same-file helper idiom as `isBarkskinAcFloorActive`; also keeps the complexity budget): the stamp folds only when `stamp.ac > context.coverAcBonus` — RAW no-stacking, greatest degree applies. Since `HALF_COVER_AC = 2` and every context cover source is 0 or ≥ 2, the consequence is exact: whenever the context bonus carries cover, the stamp never folds, so the stored `targetAc` stays RAW and `targetAc + coverAcBonus` is always the AC the resolver adjudicated against — the message's arithmetic reconciles by construction. All four single-source faces keep byte-identical behavior (folded-unannotated enforcement face; annotated furniture faces; raw no-cover face).

**Monster-chip investigation (bug file's open question):** the chip lane CANNOT observe an enforcement stamp on the same shot — `readCoverShot` matches on `attackerName`, stamps are only written by the §8.2/§8.3 gate which is reachable only from the PC sheet handler (`useCharActionsAttackHandlers.js`) and the spell executor (`useSpellCastExecutor.js`), and chip rolls carry only feature-grant cover (Bulwark/Nature's Sanctuary/Smite) via their own `computeCoverState`. The cap lives correctly at the shared fold site; chip-lane bytes are untouched. Dual-ruleset: `targetAcComputation.js`/`hitResolution.js` are ruleset-shared (no 2024 twins), so one fix covers both.

**Files changed.**
- `src/hooks/combat/targetAcComputation.js` — `foldStampCover` helper + RAW no-stacking law.
- `src/hooks/combat/targetAcComputation.cover-no-stack.test.js` — NEW regression suite (9 tests): fold-cap units, resolveHit intersection verdict (18 vs 17 HIT, not 19 MISS), all three single-source faces, ¾-over-stamp face, and byte-exact audit-text reconciliation (`vs AC 17 (1/2 Cover +2 AC) — HIT`).

**Verification.**
- Live repro PRE-fix on `:5173` (rig per Steps): quick-spawned Goblin, sandbox map `eee-fix-cover`, barrel + FeyRanger both at (6,5), enforcement `{mode:'on',zones:true,lineOfSight:true}`, EF Shortbow `+7` with `__forceNextD20(11)` → popup `✗ MISS (18 vs AC 19)` + chip; row bytes `targetAc:17 / effectiveAc:19 / coverAcBonus:2 / hit:false`, message `vs AC 19 (1/2 Cover +2 AC) — MISS` (15+2≠19). Bug confirmed exactly as filed.
- Live re-verify POST-fix (same rig): popup `✓ HIT (18 vs AC 17)` with chip `1/2 Cover (+2 AC)`; row bytes `targetAc:15 / effectiveAc:17 / coverAcBonus:2 / hit:true`; message `… vs AC 17 (1/2 Cover +2 AC) — HIT` — internally consistent, RAW verdict correct. Adjacent faces re-lived: enforcement-only (barrel removed) → folded `vs AC 17` NO annotation byte-identical; furniture-only (FeyRanger parked off-line, stamp null-cleared) → `vs AC 17 (1/2 Cover +2 AC)`; no-cover control → legacy `vs AC 15`. All staged hits cancelled (zero damage churn).
- Tests: `npx vitest run` new file 9/9; touched-area sweep (`src/hooks/combat`, `src/services/combat`, `logService`+cover tests, `contextBuilder-map`, `buildAttackContext-map`, `contextBuilder-cover`) 430 files / 5314 tests green; full `npm run test:run` green; `npm run lint` zero warnings.
- Cleanup: sandbox map deactivated + DELETED (ghost 404); closed-tab admin clears GET-verified `change-data {}` + `log []`; maps back to the 4 owner fixtures; `git status --porcelain public/` EMPTY.
