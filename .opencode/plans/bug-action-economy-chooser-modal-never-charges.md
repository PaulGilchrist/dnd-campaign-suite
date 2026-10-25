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
