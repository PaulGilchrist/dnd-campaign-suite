# VERIFIED: FAIL — FT-007 Boon of Combat Prowess (Epic Boon, attack_roll_miss → hit instead)

**Date:** 2026-10-03 · **Campaign:** test-campaign ONLY · **Host:** Disciplined_Monk (lv20, 2024) · **Victim:** Knight 1 (EB join, AC 18)
**Env:** http://localhost:5173 dev server · Playwright MCP only, no direct game-state mutation.

## What was verified working
- DATA ingest: Boon ticked in Edit wizard step Feats + ASI select (Wisdom) → `sidebar-save`; disk GET confirms `feats:["Magic Initiate","Boon Of Combat Prowess"]`, `featAbilityChoices{"Boon Of Combat Prowess-0":{assignment:"Wisdom"}}`, Wisdom featIncrease 0→1, all other ability rows byte-unchanged.
- OFFER (a-visual): first MISS popup shows trigger button `Boon of Combat Prowess` (DiceRollResult.jsx:471-475, context flag via contextBuilder-sync.js:849-865 `auto_reroll`+`convert_miss_to_hit` + latch check).
- ACCEPT affordance: click sets local `boonUsed`, renders row «Boon of Combat Prowess: Miss converted to Hit» (DiceRollResult.jsx:671-676) and stamps runtime latch `boonOfCombatProwessUsed = Date.now()` (CharSheet.handlers.js:57-59). Machine truth observed: stamp 1791010897470.
- LATCH refusals (b): second miss popup (log attack rolls[1,3] total 1+11=12 vs 18) shows NO Boon button.
- Controls (d): HIT popups (nat20, 13+11=24, 18+11=29, 9+11=20, 13+11=24) never show the button; non-holder EvasiveFighter MISS (+9, 3+9=12 vs 18) never shows the button. Differential intact.

## BUG 1 (core) — converted hit deals ZERO damage; accept popup has no Done; conversion unlogged
- After clicking the offer, the popup renders MISS line + conversion row but **all buttons vanish** (`btns:[]`, full modal innerHTML confirmed: no `.dice-roll-reroll-btn`, no `×`).
- Cause: DiceRollResult.jsx:1113 gates Done on `autoDamage && state.computedHit`; `computeComputedHit` (DiceRollResult.computed.js:53-57) RE-COMPUTES `finalTotal >= effectiveAc` whenever `targetName` is set, **ignoring the converted `hit=true` prop** AttackResultPopup.jsx:23 passes. 12 ≥ 18 false → Done never renders.
- No Done → `handleDone` (AttackResultPopup.jsx:43-53) never dispatches `dice-roll-done` → `autoDamageRoll` consumer (useLoggedDiceRoll.js:38-47) never runs → **no damage roll, no hp_change**. Knight 1 held HP 25 across 8×2s polls (16s) after accept+dismiss; log had no `roll damage`/`hp_change` for the converted attack (log count frozen at 6).
- The attack popup also keeps printing «✗ MISS (12 vs AC 18)» after accept (stale recomputed line).
- Accept produces **no log entry at all** (`handleStrokeOfLuck` boon branch CharSheet.handlers.js:57-59 sets latch and returns; sibling Stroke-of-Luck path logs). Violates app convention "every automation must log".
- Lane corruption: the post-accept popup cannot be dismissed (backdrop click, overlay `.click()`, Escape all fail; no close button) — required a hard page reload to resume attacking.

## BUG 2 — latch never re-arms at "start of your next turn"
- Stamp persists across turn/round boundaries (walked initiative to round 5, active card = Disciplined_Monk, then MISS → **no Boon button**, latch still 1791010897470).
- Sole reset seam is `initiative-rolled` (useInitiativeEffects.js:94 in buildInitiativeUpdates + :319-321), i.e. NEW COMBAT only. No own-turn-start reset producer exists app-wide (grep `boonOfCombatProwessUsed` = set:1, read:2, reset:2 both on initiative event).
- RAW: "can't use it again until the start of your next turn" → whole-combat latch is wrong. Fix seam: own-turn-start tracker family (`_<Feature>_usedRound` pattern, playbook §40).
- Note: reset calls at contextBuilder-sync.js:858 / AttackResultPopup.jsx:39 omit campaignName arg — harmless today (getRuntimeValue ignores it) but noise for any fix.

## Repro recipe
1. Edit wizard → Feats tick «Boon Of Combat Prowess» → step-9 ASI select Wisdom → `button.sidebar-save`; disk-verify feats[]; ~10s + hard reload.
2. EB join Knight (AC18) → Initiative → arm `Disciplined_Monk` card `[data-testid/target] select` = Knight 1.
3. Sheet → main-table Unarmed Strike chip `+11` (2nd `.clickable:text-is("+11")` in actions table). MISS popup ⇒ button appears.
4. Click it ⇒ conversion row, ALL buttons gone; poll cs → Knight HP unchanged; log: no entry. Popup un-dismissable ⇒ reload.
5. Keep attacking ⇒ every further miss, any round, holder's own turn included: no button ever again unless initiative re-rolled (Clear + EB re-join).
6. Chip misses: flush BOTH stages between presses (Done for hits; Empowered Strikes `.sp-modal` Skip; overlay click/Escape does NOT close — reload is the escape hatch).

## Config / permanent edits
- test-campaign / Disciplined_Monk.json: +feat "Boon Of Combat Prowess", Wisdom featIncrease 1 (milestone-safe, verified). Left in place as reusable lv20 Epic-Boon host (registry suggested).
- Initiative edit: Disciplined_Monk init=30 (cs only). EvasiveFighter cs.targetName=Knight 1. Knight 1 damaged/killed in test — all change-data/log admin-cleared at session end (see report).

## Verdict
FAIL — half-implemented: offer + latch set/refuse work; hit-conversion damage pipeline dead (UI-cosmetic "hit"), conversion unlogged, latch window wrong (combat-length instead of turn-length).
