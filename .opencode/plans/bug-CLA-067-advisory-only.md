# CLA-067 — Cunning Action (2024 Rogue lv2) — VERDICT: PASS-subset

## Canonical (`public/data/2024/classes.json`, Rogue lv2)
> "On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or Hide."

Automation block: `type: "bonus_action_choice"`, options `Dash / Disengage / Hide`, `casting_time: "1 bonus action"`. **No `oncePerTurn` flag** → handler latch `_CunningAction_usedRound` intentionally dormant (bonus-action economy governs; Fast Hands uses `_FastHands_usedRound`).

## Seam (verified statically + live)
- Row: `CharBonusActions.jsx` L486 `isBonusClickable = details || hasAutomation` → `onAutomationAction`.
- Handler: `src/services/automation/handlers/combat/bonusActionChoiceHandler.js` → `{type:'modal', modalName:'bonusActionChoice'}` (registered `useCharActionsAutomation.js` L285).
- Modal: `BonusActionChoiceModal.jsx` — radio chooser → "Use Bonus Action" → `applyBonusActionChoice` → advisory `automation_info` popup + Done.

## Live evidence (host AasimarTest, lv20 2024 Rogue/Thief, header test-campaign, turn active `.creature-card player active`, Goblin 1 joined)
Row on sheet BONUS actions: **"Cunning Action:"** `b.clickable`, opens chooser "Choose a Bonus Action:" with radios Dash/Disengage/Hide, "Use Bonus Action" disabled until selection.

| Option | Popup stamp (advisory) | Log (`ability_use`, characterName AasimarTest, abilityName "Cunning Action") |
|---|---|---|
| Dash | "Dash selected: You take the Dash bonus action. Your movement speed is doubled until the end of the turn." | "Dash selected" + "Dash selected — Object use" |
| Disengage | "Disengage selected: ... doesn't provoke opportunity attacks until the end of the turn." | "Disengage selected" + "Disengage selected — Object use" |
| Hide | "Hide selected: You attempt to Hide. Make a Dexterity (Stealth) check ... until the end of the turn." | "Hide selected" + "Hide selected — Object use" |

All 6 log entries confirmed via GET `/api/campaigns/test-campaign/log`.

- **Latch:** no `_CunningAction_usedRound` in change-data (matches data — no oncePerTurn declared). Options repeatable within the session by design of the advisory family; once-per-turn rests on unmodeled bonus-action economy.
- **Control:** EvasiveFighter sheet has NO "Cunning Action:" row (only Action Surge / Base Actions). PASS.

## Why subset (grep-documented unmodeled mechanics)
- No te/activeBuffs/activeConditions stamps for any option: Dash speed temp-buff, Disengage AoO suppression, Hide `hidden` condition + stealth roll are all advisory popup-only in `applyBonusActionChoice` (switch produces description text only). App's advisory family ⇒ rows clickable + logged ⇒ PASS-subset, not FAIL (rows fully reactive, log emitted each use).
- Cosmetic log nit: modal's second `ability_use` says "— Object use" for Dash/Disengage/Hide (Fallback in `BonusActionChoiceModal.jsx` L23); non-blocking.

## Cleanup done
Goblin removed (confirm accepted, absent from tracker); Admin Clear Change Data + Clear Campaign Log accepted; GETs confirm log entries 0 / change-data keys 0. No conditions applied ⇒ no undo round-trip needed.
