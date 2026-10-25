# actionEconomy enforcement never charges chooser-modal bonus actions (Cunning Action repeats unlimited)

## Summary
With Enforcement ON and `actionEconomy` (and `turnLock`) engaged, executing a Bonus Action that routes through the chooser modal (`BonusActionChoiceModal` — Cunning Action's Dash/Disengage/Hide) applies the effect and logs `ability_use` but never charges the economy slot. Repeating the same Bonus Action in the same turn is allowed unlimited times; `turnState.<Char>.bonusActionsUsed` stays 0 forever. The deny side of the gate works — the charge side is missing at the modal's apply seam.

## Steps to reproduce
Starting state: test-campaign, localhost GM tab, Enforcement master ON with `turnLock` + `actionEconomy` checked (Admin → Enforcement).

1. Encounters page → search "Bandit" → check the Bandit row → `Join Encounter` (auto-navigates to Initiative; round 1, pointer lands on first PC).
2. Initiative page → click `Next →` until the change-data top-level `activeCreatureName` is `AasimarTest` (she must be the active creature so turn-lock admits her).
3. Open AasimarTest's character sheet → Bonus Actions section → click `Cunning Action:` → chooser opens → select **Dash** → click `Use Bonus Action` → `Done`. Log shows `ability_use` "Dash selected — Speed doubled…" (+ handler entry).
4. `GET /api/campaigns/test-campaign/change-data` → inspect `turnState.AasimarTest.bonusActionsUsed`.
5. Click `Cunning Action:` again → chooser opens unchanged → select Dash → `Use Bonus Action` again → succeeds again (second full Dash the same turn, second `ability_use` pair in the log).
6. Repeat as often as you like — never refused.

## Expected behavior
With `actionEconomy` ON, the first resolved Cunning Action should charge the bonus-action slot (`turnState.AasimarTest.bonusActionsUsed → 1`), and the second click in the same turn must be refused with the popup "No bonus action left this turn." + an `enforcement_denied` log entry — exactly the refusal the lane DOES produce once the slot is (here, manually) marked spent.

## Actual behavior
- `bonusActionsUsed` stays **0** after each full execution (server change-data read 1.5 s after resolve; multiple Dash executions logged in the same turn).
- The chooser reopens and re-executes indefinitely — no refusal, no charge.
- Control (proves the gate consumer is alive): POSTing a valid `turnState` with `bonusActionsUsed:1` from localhost makes the very next `Cunning Action:` click refuse with popup "No bonus action left this turn." + `enforcement_denied {creature:'AasimarTest', bucket:'bonusAction'}` log entry, and NO chooser opens. So only the CHARGE call is missing, not the gate.

## Likely location
Confident (code + live): `src/components/char-sheet/modals/shared/BonusActionChoiceModal.jsx` — `handleApply` calls `applyBonusActionChoice(...)` and logs, but never calls `chargeSlot(...)`. The deferred-charge contract lives in `src/components/char-sheet/useCharActionsAutomation.js:453-459`: "modal results defer — their apply callbacks stamp…" and `AUTOMATION_CHARGEABLE_RESULTS` excludes modals — but this chooser's apply callback implements no charge. Any other modal chooser whose confirm resolves a chargeable bucket rides the same hole (audit the modalMap apply callbacks).

## Suggested fix
In `BonusActionChoiceModal.handleApply` (after `applyBonusActionChoice` succeeds), call
`chargeSlot({ creatureName: playerStats.name, bucket: 'bonusAction', campaignName })`.
Better: thread a single deferred-charge callback into the modal props from `useCharActionsAutomation` so every deferred lane charges at its own confirm seam, matching `chargeEconomy.js` semantics (refunds on Cancel if the modal lane supports them — currently Cancel spends nothing, which is correct and must stay). Add a component test mirroring `chargeEconomy.test.js` expectations.

## Severity
Broken feature — the enforcement flag is advertised ("extra attempts are refused") and silently fails for the whole chooser-modal lane; a player can double-Dash (and repeat any chooser bonus action) every turn with enforcement fully engaged.

## Resolution
FIXED 2026-10-24. Root cause confirmed exactly as diagnosed: `BonusActionChoiceModal.handleApply` resolved the chooser (effect + `ability_use` logs) but never called `chargeSlot`, while `useCharActionsAutomation.js` intentionally defers economy charging for `{type:'modal'}` results ("modal results defer … their apply callbacks stamp", L5-002 / plan §7.2). The apply callback implemented no charge, so `turnState.<char>.bonusActionsUsed` stayed at 0 forever and the assertCanAct gate had nothing to read.

Fix (minimal, mirrors the established deferred-confirm pattern in `handleHordeBreakerTargetSelected` / `handleApplyPoison` / `handleEatBolsteringTreat` in `CharBonusActions.jsx` — direct `chargeSlot({ creatureName, bucket, campaignName })` at the lane's own confirm seam):
- `src/components/char-sheet/modals/shared/BonusActionChoiceModal.jsx`
  - `handleApply`: after `applyBonusActionChoice` resolves truthy, `chargeSlot({ creatureName: playerStats.name, bucket: 'bonusAction', campaignName })`. Placed after the resolve (charge-on-resolve semantics; no phantom charge on a null-result apply — the chooser stays open for retry and spends nothing). Cancel path untouched — still spends nothing. `chargeSlot` self-gates: enforcement/actionEconomy off ⇒ zero-write no-op, so off-switch gameplay is byte-identical.
  - Also closed the flagged inline-style violation in the same file: options list now uses the existing global `.choice-list` / `.choice-option` / `.choice-selected` / `.choice-label` / `.choice-description` classes from `CharSheet.css` (exact visual match confirmed by screenshot; same class family `ChoiceListModal.jsx` uses).
- Dual-ruleset: 5e (`classes.json` L9281) and 2024 (`2024/classes.json` L9167) Cunning Action both declare `type:"bonus_action_choice"` and share this one modal component + the Fast Hands lane (5e Thief) rides it too — one fix covers all consumers of the chooser.
- No new events, helpers, or prop threading: the bug file's "thread a deferred-charge callback through modal props" was considered and rejected as a new abstraction; the codebase pattern is per-lane `chargeSlot` calls at execute seams (7 existing call sites), mirrored here.

## Verification
- **Live re-verify (Playwright, test-campaign, enforcement master+turnLock+actionEconomy ON, Bandit EB-joined, pointer on AasimarTest, own turn):**
  1. Cunning Action → Dash → `Use Bonus Action` → Done ⇒ `GET /change-data` `turnState.AasimarTest.bonusActionsUsed === 1` (was `null` pre-fix).
  2. Second `Cunning Action:` click same turn ⇒ chooser does NOT open; popup "No bonus action left this turn."; `enforcement_denied {creature:'AasimarTest', bucket:'bonusAction', source:'useCharActionsAutomation'}` log entry; zero new `ability_use`.
  3. Adjacent sanity — initiative walk to round 2 / her turn ⇒ slot re-armed (`bonusActionsUsed:0, turnActive:true`).
  4. Adjacent sanity — Cancel lane: chooser opens, Cancel ⇒ `bonusActionsUsed` stays 0, modal closed (Cancel still spends nothing).
  5. Adjacent sanity — non-Dash option: Disengage resolves ⇒ `bonusActionsUsed:1`; third click refused again (denial lane holds after cancel+round-reset).
  6. Restyled chooser screenshot: identical layout/highlight, 0 console errors.
- **Tests:** new co-located `BonusActionChoiceModal.economy-charge.test.jsx` (7 tests: exact-arg charge once on confirm, charge-after-apply order, no double-charge/no-missed-charge across re-opens, null-result no phantom charge, Cancel/overlay/disabled-Apply zero charge) — all pass. Touched folders green: `modals/shared/` 84 files / 515 tests; whole `char-sheet/` 534 files / 5236 tests. `npm run lint` exit 0. `npm run guard:no-timers` OK (32 sites, all pre-existing allowlisted).
- **Cleanup:** enforcement master OFF (sub-flags zeroed), Admin cleared change-data (GET `0 keys`) + log (GET `0 entries`) — API-verified; only test-campaign touched.

Residual note: the modalMap-wide audit ("any other modal chooser whose confirm resolves a chargeable bucket") — the `bonus_action_choice` family is now fully plugged; other picker modals that ride their own resource latches (dice/uses) were not re-audited here and remain a separate seed if turn-economy charging is desired at more seams.

## Evidence (repro, pre-fix, same session)
Confirmed live before the fix: two full Dash executions the same turn (`ability_use` pairs ×2, activeBuffs speed_boost stamped), `turnState` stayed `null` server-side; refusal never fired. Matches the report exactly.

