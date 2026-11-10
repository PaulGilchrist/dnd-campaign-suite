# Save-margin rider clock ignores the authored duration — every margin rider arms a 600-round (1-hour) ceiling even for 1-minute rows (Thri-Kreen, Homunculus)

## Summary

`applySaveMarginRider` (src/hooks/combat/saveProcessing.js, ~:878-:900) grants the base + rider conditions correctly and now logs honest, data-derived prose ("…also paralyzed while poisoned (1 minute; …)"), but the merged expiration clock it arms is hardcoded `rounds: 600` — the legacy hours×600 encoding sized for the Drow row, which used to be the only margin rider. The data now has five authored `save_margin` rows (Drow, Drow Elite Warrior, Homunculus, Pseudodragon, Thri-Kreen — all 5e). For the 1-minute rows the engine holds Poisoned + the rider condition for ~590 rounds past RAW expiry: the log tells the truth while the engine state outlasts it.

**OWNER-RULATED 2026-11-10 (Paul):** 1 round = 6 seconds, so durations convert minutes×10 — a "1 minute" rider row expires on a `rounds: 10` clock; "1 hour" rows (Drow shape) keep 600. Initiative rolls, short rests, and long rests continue to clear conditions as the old-combat-ends/new-combat-begins seam (existing behavior to preserve, not replace).

## Steps to reproduce

1. Code face: `src/hooks/combat/saveProcessing.save-margin-rider.test.js` + `src/components/encounter/MonsterCardModal.ma1584-thri-kreen-bite-margin.test.jsx` pin `rounds: 600` for the Thri-Kreen (authored 1 minute) row — deliberately pinned at the time; now ruled incorrect for non-hour rows.
2. Live face (test-campaign): EB-join a Thri-Kreen, Bite a character with a deep save fail (margin ≥5, e.g. force-fail rig) → `activeConditions ['poisoned','paralyzed']`; read the expiration record for the grant — ceiling 600 rounds instead of 10.

## Expected behavior

The merged clock's `rounds` derive from the row's authored duration (`margin.duration`, already parsed by `parseSaveMarginClause`): "1 minute" → `rounds: 10`, "1 hour" → `rounds: 600`; one merged clock still (never two racing clocks). At expiry the clock removes base + rider condition exactly as the 600 clock does today. New initiative roll / short rest / long rest still clear the conditions independently. Drow-shape rows are byte-unchanged (600).

## Likely location

`applySaveMarginRider` in `src/hooks/combat/saveProcessing.js` — `addExpiration({ rounds: 600, … })`.

## Suggested fix

Map `margin.duration` (and the Homunculus composite-row fallback the prose builder already uses) to rounds (minutes×10, hours×600) for the `addExpiration` call; default to 600 only when no duration is authored. Re-pin MA-1584 (Thri-Kreen → 10), MA-1000 (Homunculus → 10), and the rider suite's clock pins; keep drow pins at 600. Verify the rest/new-initiative clear lanes still evict rider conditions.

## Resolution (2026-11-10, FIXED)

### Files changed

- `src/hooks/combat/saveProcessing.js` — new file-local `saveMarginRiderRounds(duration)` (owner ruling 2026-11-10: 1 round = 6 s — minutes×10 / hours×600 / rounds:N, the CLA-334 encoding used by the sibling `parseBarkskinDurationRounds`/`summonDurationRounds` parsers; fallback 600 when no duration authored), consumed by `applySaveMarginRider`'s single merged `addExpiration` as `rounds: saveMarginRiderRounds(margin.duration)`; header comment updated. Both call legs (damageless `applyDamagelessSaveConditions` :1260 / damage-bearing `applySaveDamage` :1729) share the function — one edit covers both. No new shared abstraction: every sibling duration parser in the repo is file-local, and the two exported helpers (`durationParser.parseDurationRounds`, `zoneDurationClock.clauseDurationRounds`) deliberately return 0/undefined for ≥1-minute text, so neither fits the owner-ruled encoding.
- `src/hooks/combat/saveProcessing.save-margin-rider.test.js` — Thri-Kreen clock pin 600 → **10**; added a no-authored-duration fallback pin (ONE merged rounds:600 clock); header comment reworded (clock derives from authored duration).
- `src/hooks/combat/saveProcessing.ma1000-homunculus-margin-band.test.js` — `MARGIN` now rides the REAL `parseSaveMarginClause(biteRow)` (live-lane parity; composite-row description fallback yields `duration:'1 minute'`); clock pin 600 → **10**; data lock asserts the parser output incl. duration.
- `src/components/encounter/MonsterCardModal.ma1584-thri-kreen-bite-margin.test.jsx` — clock pin 600 → **10** (context already rode `buildSaveOptions`, so the authored duration flowed live).
- `src/services/rules/effects/clearExpirationEffects.condition-expiry-log.test.js` — NEW pin: the save-margin twin-condition clock at the authored `expiryRounds:10` evicts BOTH conditions in one pass (`Poisoned`/`Paralyzed` removed rows, "N-round clock expired" copy, store left `[]`).
- `src/components/encounter/MonsterCardModal.ma1000-homunculus-bite-save-rider.test.js` — inspected: pins data/transport shapes only, no clock number → unchanged. `saveProcessing.ma1351-pseudodragon-sting-margin.test.js` — unchanged: its hand-built duration-less margin still lands 600, now doubling as the fallback pin on the damage-bearing leg (the authored Pseudodragon duration is "1 hour" → 600 either way).
- `docs/test-setup-playbook.md` — in-place correction of the stale "ONE merged rounds:600 clock" claim in §10 Save-margin two-band + new §5 bullet "Rider-condition seam-clear lane truth" (seam lanes + PC force-fail rig recipe + the write-race pitfall below).
- `.opencode/plans/bug-sheet-initiative-seam-resurrects-rider-conditions.md` — NEW open bug filed from the 7b findings (not fixed — out of this ticket's lane, per instructions).

### Verification evidence

- **Rules-data census**: 5 authored `save_margin` rows, ALL 5e: Drow (1 h), Drow Elite Warrior (1 h), Pseudodragon Sting (1 h), Homunculus Bite (composite — "1 minute" only in description, `parseSaveMarginClause` fallback carries it), Thri-Kreen Bite (1 min). `grep -rn save_margin public/data/2024/` → ZERO rows → no 2024 twin needed.
- **Red state confirmed**: baseline run of the 5 legacy-pinned files: 5/5 files green pinning `rounds: 600` for the 1-minute rows (deliberate pin = the bug); pre-fix LIVE face: EB-joined Thri-Kreen deep-failed its Bite on an EB Bandit (cs `saveBonuses.con:-15` force-fail, "failed the save by 6") → `Thri-Kreen.pendingExpirations` carried `expiryRounds: 600` against the 1-minute grant.
- **Post-fix live (test-campaign)**: same face re-ridden → ONE clock with `expiryRounds: 10`, grant log "…paralyzed while poisoned (1 minute; …)" byte-honest, `activeConditions ['poisoned','paralyzed']`, repeat-save te armed. **Drow sanity**: EB-joined Drow, Hand Crossbow save chip on the still-stamped Bandit → `Drow.pendingExpirations` `expiryRounds: 600`, prose "(1 hour; waking on damage/shake is GM-enforced)" — byte-unchanged drow shape; conditions merged `['poisoned','paralyzed','unconscious']`.
- **Seam-clear findings (7b)**: SHORT REST on the rider-bearing PC victim (AberrantSorcerer, `warding_bond saveBonus:-25` dial for a deterministic 1-press deep fail) — GENUINELY EVICTS: settled `activeConditions []`, `activeConditionMeta {}`, victim clock drained from the Thri-Kreen queue, `condition removed` rows with "10-round clock expired". **NEW-INITIATIVE ROLL is NOT a clean evict lane for these clocks — two precise gaps, documented in the follow-up bug file:** (a) victim's own sheet initiative re-roll fires the clock (removed rows + attacker-queue trim) but the seam's same-tick un-awaited full-store sibling writes resurrect the pre-strip `activeConditions` — 2/2 reproduced (MA-0809 write-race family); (b) a board-wide new roll via EB Join never sweeps finite-round rider clocks at all (only `dominated` entries + enforcement-gated `until:'combat'` sweeps) — confirmed live (Bandit grant survived a Drow-join re-roll, matching the code). Behavior PRESERVED, not replaced; the fix is clock-value-only and touched neither lane.
- **Unit/lint**: touched files 6/6 (51 tests) → folders `src/hooks/combat` + `src/components/encounter` 627 files/3946 tests → `src/services/rules/effects` 54 files/471 tests → FULL SUITE `npx vitest run`: **3186 files / 34473 tests, all passed, exit 0** → `npm run lint` zero warnings → `no-timers-guard` OK (43 benign sites, none added).
- **Exit hygiene**: browser closed, two-pass headless admin clears GET-verified `change-data {}` + `log []`, overlay `[]`, `git status --porcelain public/campaigns/` empty, dev pair (`npm run dev:locked`, started by this run, PID 18518 tree) killed by PID.

