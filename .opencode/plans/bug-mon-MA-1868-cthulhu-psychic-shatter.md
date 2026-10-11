# MA-1868 — Cthulhu Psychic Shatter — FAIL(a) gate clause (save/damage core EXACT)

Row: `cthulhu|actions|3` — "Psychic Shatter", save, DC 24 Intelligence, 6d10 Psychic, Stunned on fail, half on success, "Cthulhu can't use this action again until its next turn."

## Core mechanics — EXACT (live, test-campaign, EB Bandit 1 victim AC12 clean-psychic, HP 999 rig)
- DC 24 INT enforced inline (no `range` field → picker never opens, §461 inline lane): victim save entries carry saveDc:24 saveType:"Intelligence"; popup "SAVE FAILURE/SUCCESS vs DC 24".
- FAIL legs (int −5 rig, deterministic): FULL 6d10 — dice[6,9,7,8,8,6]=44 fd44 hp 999→955; dice[8,2,2,1,4,8]=25 fd25 hp 955→930; saveSuccess:false full-not-halved ✓.
- STUN on fail: `type:"condition" applied Stunned source Cthulhu 1 sourceAbility Psychic Shatter` x2 + change-data `Bandit 1.activeConditions:["stunned"]` + `condition_clauses_advisory` "(GM-enforced)" until-end-of-next-turn; structured `conditions:["stunned"]` transported: `lastAttack.saveConditions:["stunned"]` — MA-1855 save-lane consumption CONFIRMED.
- SUCCESS legs (warding_bond saveBonus:23 char-route fold → total 49/59 ≥ 24, nat-floor deterministic): dice 34 → fd17 hp 930→913; dice 25 → fd12 hp 913→901 — floor-half exact, dcSuccess:"half" stamped, ZERO new condition entries (no stun) ✓.
- Psychic-only all 4 legs; HP chain 999→955→930→913→901 == |hpΔ| ledger exact.
- No dc_success field = engine default half = RAW-correct here (§213).

## FAIL(a) — usage gate absent
- Disk row authors NO `recharge`, `usage`, `uses`, `maxUses` — "can't use this action again until its next turn" is prose-only.
- `rechargeUsageOf` (monsterRecharge.js:35) reads flat `action.recharge` / `usage.type:"recharge"` only → gate null.
- Gate probe: chip re-pressed same turn (round constancy 1, no Next-click) fired freely — 4 total fires, refused:0, blocked:0, ability_use:0 = unlimited refire. MA-1843/MA-0633 trichotomy precedent: ungated refire zero refusal = FAIL(a).
- Fix design: authored once-per-turn latch. Note: non-legendary once-per-turn (regain at owner turn-start, no d6) lane is absent app-wide (§204 cooldown clause is legendary-only; recharge lane is d6). Needs new lane or `uses:1`+turn-start regain consumer.

## Stun expiry
- No `pendingExpirations` clock — expiry GM-enforced advisory (§70 control-subsystem permanent gap). Accepted residual, not filed.

## New pitfalls (session)
- ONE native `chip.click()` on this save chip DOUBLE-FIRED two full adjudications (2 fail legs from 1 press); later presses single-fired. Judge legs by log delta, never click count.
- Save popup prints cosmetic "+0" while bonus:23 folds into total (§212 re-confirmed — total is truth).
- `change-data/<Char>` route 404s; char route `/api/campaigns/:c/Bandit%201` GET/POST with char-key wrapper is the seam (§219 twin).

## Cleanup
Admin API clears (200), log [] + change-data {} stable post-reload; server up; registry appended append-only (599 entries, JSON re-validated, byte-ident house-style roundtrip).

## VERDICT: FAIL(a) — gate clause (prose-only once-per-turn, unlimited refire proven); save/DC/damage/half/stun core byte-exact live.
