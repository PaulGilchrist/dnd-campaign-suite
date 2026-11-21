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
