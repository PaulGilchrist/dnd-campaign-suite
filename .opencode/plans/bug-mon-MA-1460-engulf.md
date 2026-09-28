# Bug MA-1460 — Shambling Mound "Engulf": half-damage leaks on save success (RAW success = unaffected); immediate pool substitutes the recurring tick

**Row:** `shambling-mound|actions|2` · save_dc 15 Strength · damage 3d6 Lightning · conditions blinded/grappled/restrained
**Verdict:** FAIL(a) / DATA (one-field `dc_success:"none"`; plus documented-model notes)
**Date:** 2026-09-27

## Expected (row verbatim)
"Strength Saving Throw: DC 15, one Medium or smaller creature within 5 feet. Failure: The target is pulled into the shambling mound's space and has the Grappled condition (escape DC 14). Until the grapple ends, the target has the Blinded and Restrained conditions, and it takes 10 (3d6) Lightning damage at the start of each of its turns." — RAW success = unaffected (no immediate, no half damage; the 3d6 is recurring-only).

## Actual (live, test-campaign, Bandit 1 STR +0 inline §96 seam, 7 fires)
- DC 15 STR enforced ✓; on each FAIL: `activeConditions=['blinded','grappled','restrained']` + meta source + `condition applied` log + badges ✓ (conditions half is correct).
- Every fire pays an IMMEDIATE 3d6 pool (fails fd 11/10/12/13/11/17), and **fire #7 nat19 = SAVE SUCCESS still paid HALF damage (5)** — MV-20 `dc_success ?? half` default leak on a row whose RAW success is "unaffected" (MonsterCardModal.jsx:1032 getSaveDcSuccess).

## Steps to Reproduce
1. test-campaign, EB join Shambling Mound + Bandit; arm Bandit on mound own-card select; HP999 fill.
2. Open card → Engulf "DC 15 Strength" chip → save rolls inline.
3. On any SUCCESS face, victim still takes half the 3d6 pool (hpΔ −5 observed at 925→920).

## Likely Location
DATA: row lacks `dc_success:"none"` (saveEffect gates conditions/grapple only; immediate pool itself is a model choice — RAW pool is recurring at victim turn-start). Recurring tick absent = accepted §70/§87 sustained-grapple zero-producer residual (grapple_damage consumer turnStartEffects.js:154 is PC-producer-only, MA-0771 twin precedent). One-cap + escape_dc 14 (MA-0010 hit-only seam) + move-with clause: advisory/GM-adjudicated; 7 refires on same grappled victim, zero refusals (recorded).

## Notes
- Fix: author `dc_success:"none"` (honest copy both surfaces, §63 family MV-20/MA-0218/0229). Consider whether immediate-pool-on-fail should remain the accepted stand-in for the recurring tick (MA-0771 precedent) or be gated behind grapple state-machine ticket.
- Subagent report wrote `incomplete-mon-MA-1460-engulf.md`; per step-3f this is a gate-violation FAIL, that file removed by orchestrator.
