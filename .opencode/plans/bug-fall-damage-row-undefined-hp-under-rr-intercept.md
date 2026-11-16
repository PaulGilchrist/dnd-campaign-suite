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
