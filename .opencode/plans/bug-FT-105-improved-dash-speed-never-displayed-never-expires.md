# Bug FT-105 — Charger (Improved Dash): +10 ft Speed never displayed, buff never expires, zero log

## Title
FT-105 Charger – Improved Dash: Dash speed bonus writes an unconsumed `activeBuffs` entry with `duration:'same_action'` that has no expiry and never affects the Speed display.

## Overview
Charger's Improved Dash lane is live end-to-end up to the stamp: clicking the sheet's clickable **"Improved Dash:"** row on EvasiveFighter's turn routes `temp_buff` → `buffHandler.checkBuffGates` → `handleDashSpeedBonus`, which pops "Improved Dash: +10 ft Speed for this Dash action." and writes `activeBuffs` `{name:'Improved Dash', tempBuff:true, speedBonus:10, duration:'same_action'}`. The expected **observable** behavior — Speed increases by 10 feet for that Dash action — never happens:
1. **Speed display never changes.** The sheet Speed line stayed `30 ft.` before, during (popup open), and after the Dash. The only `activeBuffs` Speed consumer, `charSummaryCalc.js:212`, keys on `buff.effect === 'speed_boost'`; the dash buff carries **no `effect` key**, so `speedBonus:10` is never folded into the displayed Speed. No other consumer in `src/` reads `speedBonus` off this buff shape (grep: consumers are `speed_boost`-keyed — charSummaryCalc.js:212, turnStartEffects.js:320, auraComboEffects.js, combatStanceHandler/StrideOfTheElements which mint their own `effect:'speed_boost'` entries).
2. **Buff never expires.** `'same_action'` has **zero expiry consumers app-wide** (grep non-test: only the writer `buffHandler.js:234`; no addExpiration is created — live `pendingExpirations: []`). One full round later, on EvasiveFighter's next turn (initiative round 4), `activeBuffs` still contains the identical Improved Dash entry — violating "for that action".
3. **Zero logging.** Campaign log count stayed **0** before and after the Dash — `handleDashSpeedBonus` has no `addEntry` (violates the app rule "every automation must log").

## Expected Behavior
Quote (`public/data/2024/feats.json`, Charger → benefits[1] Improved Dash):
> "When you take the Dash action, your Speed increases by 10 feet for that action."

Automation metadata: `{type:'temp_buff', trigger:'dash_action', effect:'speed_bonus', bonus:'10 ft', duration:'same_action', casting_time:'1 action'}`.

## Actual
- Popup fires verbatim: `Improved Dash: +10 ft Speed for this Dash action.` (automation_info popup + Done).
- change-data `EvasiveFighter.activeBuffs` = `[{"name":"Improved Dash","tempBuff":true,"speedBonus":10,"duration":"same_action"}]`, `pendingExpirations: []`.
- Sheet Speed cell: `30 ft.` pre-Dash → `30 ft.` mid-Dash (popup open) → `30 ft.` on the NEXT turn (round 4) with the buff still stamped. No badge renders for the buff (badges census on sheet showed only Allies/Inner Radiance-class entries).
- Log count 0 before and after; no dash-related entry.

## Steps to Reproduce
1. http://localhost/ → select **test-campaign** → open **EvasiveFighter** (Charger permanent on disk, `feats[8]`). Note Speed `30 ft.`.
2. Initiative view (existing encounter): click **Next →** until `.creature-card.active` = EvasiveFighter.
3. Open EvasiveFighter sheet → click **"Improved Dash:"** row (Actions grid).
4. Popup "+10 ft Speed for this Dash action." appears; Speed line still reads `30 ft.`. Click Done.
5. GET `/api/campaigns/test-campaign/change-data` → `EvasiveFighter.activeBuffs` = `[{name:'Improved Dash', tempBuff:true, speedBonus:10, duration:'same_action'}]`; log count 0.
6. Advance initiative a full cycle back to EvasiveFighter (now round 4) → `activeBuffs` unchanged (buff persists), sheet Speed still `30 ft.`.

## Likely Location
- `src/services/automation/handlers/buffs/buffHandler.js:223-247` (`handleDashSpeedBonus`) — writes buff shape without an `effect` key, creates no `addExpiration` for `same_action`, and emits no log entry.
- `src/components/char-sheet/char-summary/charSummaryCalc.js:212` — Speed fold whitelist keys `'speed_boost'` only; dash buff (`effect` undefined) is dropped. Either stamp `effect:'speed_boost'` on the dash buff (consumer-ready) or register a consumer for the dash shape.
- Expiry clock: `'same_action'` duration needs a turn-end/action-end removal consumer (none exists app-wide; cf. MA-0995/MA-1147 `addExpiration` anchor pattern, itself an accepted end-of-next-turn residual family).

## Notes
- Feat-row lane preserves raw `bonus:"10 ft"` so `bonusAmount` parses to 10 correctly (rules.js:239 keeps raw automation for feat rows; infoBuilder `temp.js` bonus-drop never hits this row).
- Base-actions "Dash" text is NOT clickable (only Dodge is — CharActions.jsx:707); the feat row is the sole trigger seam.
- Same consumer-shape family as FT-106 (Charger Charge Attack on this host); the passive rider lane is separate and unaffected.
- Live environment: initiative was advanced round 2 → round 4 during the test; runtime + log admin-cleared after verification; EvasiveFighter disk unchanged.
