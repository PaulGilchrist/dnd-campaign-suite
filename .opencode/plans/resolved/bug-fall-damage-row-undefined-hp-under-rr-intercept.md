# Bug: fall_damage ledger row prints "(old → undefined HP)" when Relentless Rage intercepts the drop

## Summary
When a GM "Falling" effect kills a raging Barbarian down to 0 and Relentless Rage (RR)
intercepts with its save prompt, the `fall_damage` log row renders the transition as
`(5 → undefined HP)`. Every other zero-HP interceptor (Undying Sentinel, Boon of
Recovery, Relentless Endurance, Death Ward) renders an honest number. The HP bucket
write itself is correct (0 is stored) — only the ledger row text is wrong.

## Steps to reproduce
Starting state: test-campaign, EvasiveFighter with a Relentless Rage carrier build
(class Barbarian / Path of the Berserker via the sanctioned fixture swap), Rage stance
active, HP seeded 5.

1. In test-campaign, open the Initiative view.
2. On the EvasiveFighter card press the effect-add button (`.effect-add-btn`), switch to
   the **Effects** tab, search `fall`, pick **Falling**, set Value ≥ 100 (enough to
   reduce 5 HP to 0 through Heavy Armor Master), press **Apply**.
3. A "Saving Throw Required … CON … DC 10/15" prompt mounts (RR intercept) — press
   **Dismiss** (or Roll; the row is written before the prompt resolves either way).
4. Open the Log view (or `GET /api/campaigns/test-campaign/log`).

## Expected behavior
The `fall_damage` row reads e.g. `(5 → 0 HP)` — the bucket truth at row-write time
(currentHitPoints IS written to 0 before the interception return replaces the result
object; confirmed live: GET change-data shows `currentHitPoints: 0` after dismissal).

## Actual behavior
Row text: `EvasiveFighter falls 100 feet — 20d10 […] = 114 bludgeoning (5 → undefined HP). …`
 witnessed live three separate times this run (DC 10 trigger, DC 15 trigger).
Control faces observed the same session, both honest:
- non-intercepted fall, damage fully absorbed by HAM: `(5 → 5 HP)`;
- code-confirmed differential: `undyingSentinelService.js:83`, `boonOfRecoveryService.js:78`,
  `relentlessEnduranceService.js:66`, `deathWardService.js` all return
  `{ intercepted: true, …, newHp }`, while `relentlessRageService.js:276` returns only
  `{ intercepted: true, awaitingSave: true }`.

## Likely location
Confident on mechanism, from the code path:
- `src/services/combat/fallDamage.js:59` interpolates `${result.oldHp} → ${result.newHp}`
  from the `applyDamageToTarget()` return.
- `src/services/rules/combat/applyDamage.js:650` `interceptZeroHitPoints()` returns
  `{ ...result, damageDealt, oldHp, interceptedFeature }` — the spread of the RR
  trigger result carries no `newHp`, so the caller reads `undefined`.
- RR's async contract is intentional (post-save HP is unknown at trigger time), but no
  fallback exists at the row-render site.

## Suggested fix
`interceptZeroHitPoints` already receives `oldHp` and computes nothing about the stored
write. Simplest honest option: since the HP write to 0 has already happened when the
interception fires, default the field, e.g. in `interceptZeroHitPoints` return
`{ newHp: Math.max(0, oldHp - actualDamageTaken…` — or minimally at the sole consumer:
`fallDamage.js` use `${result.newHp ?? 0}` — but the cleaner fix is threading the actual
stored value: pass the already-computed `newHp` from the damage-application leg into the
interception return so ALL interceptor rows (not just fall) get an honest post-damage HP.
Also worth a grep for other `${result.newHp}` consumers of `applyDamageToTarget` results
(fallDamage is the one confirmed by this repro).

## Severity
Minor UX issue — ledger accuracy only. No state corruption: change-data HP, uses-bump,
prompt lifecycle, and the `save_dismissed`/success rows were all verified honest around
it this session. But it is exactly the "wrong number in the log" class the ledger
honesty law treats as a defect.

## Resolution
FIXED 2026-11-16.

**What was actually wrong** (mechanism confirmed exactly as diagnosed): `applyDamageToTarget`'s
HP leg (`applyPlayerHpDamage`) correctly stores the post-damage bucket value (0), then the
drop-to-0 interception return replaces the whole result object. Every interceptor in
`ZERO_HP_INTERCEPTORS` except Relentless Rage resolves synchronously and carries its own
post-interception `newHp` in its return; `checkRelentlessRage` intentionally returns only
`{ intercepted: true, awaitingSave: true }` (post-save HP is unknowable at trigger time), and
`interceptZeroHitPoints` spread that result without any `newHp` fallback — so the single
`currentHitPoints` consumer that reads the return value's `newHp` (the `fall_damage` row
interpolation in `src/services/combat/fallDamage.js`) rendered `undefined`.

**Fix (threaded stored value, per the bug file's cleaner-option):** `applyDamageToTarget` now
threads its already-computed `newHp` through `resolveTargetDamageOutcome` →
`handlePlayerZeroHpAndConcentration` → `interceptZeroHitPoints`, which returns
`{ newHp, ...result, damageDealt, oldHp, interceptedFeature }` — the default sits UNDER the
spread, so synchronous interceptors (Sentinel / Last Stand / Endurance / Death Ward) keep
their own post-interception bytes byte-identically, while RR (and any future awaitingSave
interceptor) inherits the honest stored bucket truth (0 at trigger time). Only
`src/services/rules/combat/applyDamage.js` changed; `fallDamage.js` untouched (its
interpolation is already correct given an honest result object); `relentlessRageService.js`
untouched (async contract intentional; the fix belongs at the dispatcher so ALL consumers —
popups, `targetCurrentHp` feeds, ledger rows — get the honest number, not just fall).

**Files changed:**
- `src/services/rules/combat/applyDamage.js` — newHp threaded + defaulted in the interception return.
- `src/services/rules/combat/applyDamage.relentlessRage.test.js` — NEW regression lane (mirrors
  `applyDamage.relentlessEndurance.test.js` conventions): pins the awaitingSave intercept
  returning `newHp === 0` (stored bucket truth, renders `'5 → 0 HP'`), the DC-10 prompt request +
  `Relentless Rage triggered` log + zero death-save/hp_change short-circuit bytes, AND that the
  threaded default never shadows a synchronous interceptor (RE still returns its own `newHp: 1`).
  Falsifier verified: reverting the one spread line makes the test fail with
  `expected undefined to be +0` — the exact bug symptom.

**Verification:**
- Repro pre-fix (live, test-campaign, EF Barbarian/Berserker fixture-swap + Rage + HP 5 +
  GM Falling chip 120 ft + Dismiss): row read `(5 → undefined HP)`, bucket honest `currentHitPoints: 0`.
- Re-verified post-fix on :5173 (HMR, fresh reload + re-select): re-armed RR fall logged
  `EvasiveFighter falls 120 feet — 20d10 … = 108 bludgeoning (5 → 0 HP).` — exact Expected.
- Adjacent sanity: unintercepted lethal fall (ElderPaladin 120 ft, no sentinel on canonical
  fixture) logged honest `(5 → 0 HP)` + death-save prompt (GM-Cancelled zero-write);
  unintercepted survive fall (FeyRanger 20 ft) logged `(89 → 67 HP)` with matching `hp_change -22`;
  synchronous sibling interceptor (Relentless Endurance, AasimarTest Orc) logged honest
  `(5 → 1 HP)` + latch + `hp_change +1` — sibling bytes unchanged.
- `npx vitest run src/services/rules/combat/ src/services/combat/fallDamage.test.js <RR feature lanes>`:
  56 files / 515 tests passed; `src/hooks/combat`: 241 files / 2030 passed; interceptor service
  lanes + `src/services/combat/steps`: 50 files / 550 passed. `npm run lint` clean (zero warnings).
  `node .opencode/plans/no-timers-guard.mjs` OK.
- Console 0 errors during the live rides; test-campaign change-data/log/overlays cleared
  two-pass (`{}`/`[]`/`[]` GET-verified, tab closed first); EF fixture restored byte-exact
  (md5 `0df29ff3…`).
