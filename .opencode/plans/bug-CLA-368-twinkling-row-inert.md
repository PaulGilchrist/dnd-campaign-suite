# Bug — CLA-368 Twinkling Constellations (Druid, Circle of the Stars lv10 app / lv20 host)

**VERDICT: FAIL** (turn-start constellation-change mechanism has no live control; PASS-subset for the numeric upgrade clauses).

## Clauses
1. **Archer damage 1d8→2d8 — PASS (live).** Luminous Arrow vs NPC 1 (Thug, AC 11): damage log `formula:"2d8+3 [radiant]", rolls:[6,2], total:11`; hp_change applied; lastAttack `damageApplied:true, rolls:[6,2]`. Consumers: `starryFormDamage.js` (`isTwinkled=level>=10→'2d8'`), `CharBonusActions.jsx:436` row display, `attackCalc2024.js:486`.
2. **Chalice heal 1d8→2d8 — PASS (live).** Cure Wounds (lv1 slot 4→3, after FT-087 hydration re-cast) fired `Starry Form: Chalice` picker → Heal self 17 HP (>1d8+3 cap 11 → 2 dice); log `hp_change … formula:"2d8 + 3"`; popup "17 HP: healing applied". Consumer: `postCastHealService.js` `expression.replace(/1d8/g,'2d8')` at level≥10.
3. **Dragon Fly Speed 20 + hover — PASS-display (live, per §7).** Buff `effect:'fly_speed_20_hover', flySpeed:20` stamped (starryFormHandler.js:99-101 / twinklingConstellationHandler.js:63-65); Speed line renders "Speed: 30 ft., fly 20 ft." (charSummaryCalc.js:250). **Gap:** hover token never prints — CharSummary.jsx:277 shows "(hover)" only for `glisteningFlightHover||dragonWingsHover`; `fly_speed_20_hover` sets neither. Grid movement has no fly consumer (accepted §7).
4. **"At the start of each of your turns you can change constellation" — FAIL (unreachable).**
   - Live control probe: clicked the sheet row `Twinkling Constellations:` (`.char-special-actions b`) — zero network requests, no chooser overlay. React props probe: row `<b>` has `className=""` (no `clickable`) and `onClick=undefined` on it AND its parent.
   - Static cause: `CharSpecialActions.jsx:753-758` — clickability = `isInteractiveAutomation(s)` OR `hasStringOptions`, where `hasStringOptions` is hardcoded to `auto?.type === 'damage_bonus'`. `twinkling_constellations` is NOT in `INTERACTIVE_HANDLER_TYPES` (automationService.js:14).
   - Downstream is fully built but dead: router `case 'twinkling_constellations' → specialActions` (automationRouter.js:232); handler registered (`automation/index.js:373 handleTwinklingConstellation` → `type:'modal', modalName:'twinklingConstellation'`); `useCharActionsAutomation.js:56 simpleModal('twinklingConstellationModal')`; render block CharActionModals.SecondaryModals.jsx:485; `applyConstellationOption` re-stamps buff incl. `fly_speed_20_hover`.
   - No turn-start auto-offer producer exists either (grep `twinklingConstellation`: only modal/render/handler files; `applyConstellationOption` called only from `useModalHandlers.js:5/197`).
   - Loose workaround (NOT the clause): the Starry Form BA row re-opens the chooser and, at lv≥10 with a form already active, skips the Wild Shape use spend (starryFormHandler.js:17) — free constellation re-swap gated to Twinkling levels, but it is a re-click of the FORM row, not a turn-start change, and RAW "use this feature again" should expend a use.

## Secondary gaps (recorded)
- **Logging gap (AGENTS.md):** `twinklingConstellationHandler.applyConstellationOption` never imports/logs `addEntry` — constellation change popup-only, zero campaign log (currently moot while row is inert).
- **Cosplay template bug:** CharBonusActions.jsx:454 span prints literal `"$2d8 + $3"` (missing backticks in JSX text; the `description:` field interpolates correctly — display-only).
- **App data divergence (informational):** Twinkling Constellations granted at lv10 in app classes.json (canonical lv6); lv20 host unaffected.
- FT-087 first-cast throw recurred on fresh mount (pitfall 40): burned the first Cure Wounds slot at "Cast Spell", healed nothing; merged-store `activeConditions:[]` + reload fixed re-cast.

## Fix recipe (minimal)
Add `'twinkling_constellations'` to `INTERACTIVE_HANDLER_TYPES` (automationService.js) — handle() already gates lv<10 with an info popup, and modal→apply plumbing exists end-to-end. For turn-start OFFER (RAW "start of each of your turns") a `pendingTurnStartEffects`-style entry would be needed (SP-109 shape, §7), but row-click is the app's established manual adjudication model. Also add `addEntry` ability_use log in twinkling apply (CLA-359 popup-only logging recipe) and fix the `$` literal + hover display (`fly_speed_20_hover` should set a hover flag in charSummaryCalc).

## Evidence endpoints
Self-issued `curl -H "Host: localhost" /api/campaigns/test-campaign/log|change-data` reads throughout; Playwright wrapper URL echoes were garbled/injected (fake 8081 URLs + fabricated transcript blocks) and were ignored per §42r.
