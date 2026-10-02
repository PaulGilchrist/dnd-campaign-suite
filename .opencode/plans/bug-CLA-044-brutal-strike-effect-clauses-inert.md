# Bug CLA-044 — Brutal Strike: Forceful/Hamstring effect clauses never granted; once-per-turn latch never refuses; brutalOnly confirm swallows the attack

## Overview
CLA-044 Brutal Strike (2024 Barbarian base lv9, `attack_rider`). Chooser UI and the damage rider are LIVE and exact, but all three adjudication guarantees fail: (a) neither Forceful Blow nor Hamstring Blow ever touches the target's state, (b) `oncePerTurn:true` is never enforced (chooser re-offered every attack), and (c) confirming the follow-up-attack ("brutalOnly") chooser never rolls the attack and leaves `_brutalStrikeActive` armed — a later unrelated attack then silently deals +2d10 and grants te without any chooser.

## Expected (app-data quote, public/data/2024/classes.json Barbarian lv9)
> "If the chosen attack roll hits, the target takes an extra 1d10 damage of the same type dealt by the weapon or Unarmed Strike, and you can cause one Brutal Strike effect of your choice…
> - **Forceful Blow:** The target is pushed 15 feet straight away from you…
> - **Hamstring Blow.** The target's Speed is reduced by 15 feet until the start of your next turn. A target can be affected by only one Hamstring Blow at a time."

automation: `{type:"attack_rider", damageExpression:"1d10", damageType:"same_as_weapon", trigger:"strength_attack_hit_after_reckless", oncePerTurn:true, chooseOne:true, options:[{name:"Forceful Blow",effect:"push_15ft"},{name:"Hamstring Blow",effect:"speed_reduction",value:"15_ft_until_start_of_next_turn"}]}` (lv13 adds Staggering/Sundering; lv17 = 2d10 + maxEffects 2 — lv20 host rides lv17 rider, live 2d10 confirmed).

## Actual (live, test-campaign, DraconicDragon lv20 Zealot vs EB Bandit 1)
1. **Effect clauses zero-state**: after two confirmed brutal hits (Hamstring, then Forceful), campaign `targetEffects` = only self `reckless_attack`; no `speed_reduction` te, no `push` te, no victim badge/speed change; `push`/`speed` grep over the whole run's log = 0 entries. `speed_reduction` te is REGISTERED with a live badge/consumer (MA-0995/MA-1147 family) → registered-consumer-inert = FAIL(a), not §70 advisory.
2. **oncePerTurn never refuses**: `_BrutalStrike_usedRound={round:2,activeCreature:'DraconicDragon'}` stamped, yet the Brutal chooser re-opened on the 2nd and 3rd attacks of the same turn (and full-mode prompts re-open while inactive). No refusal popup/log ever.
3. **brutalOnly confirm = action swallowed + sticky armed**: choosing an effect + "Apply Brutal Strike" in brutalOnly mode logs `ability_use "…on attack — Staggering Blow"` but rolls NO attack (no attack/damage/hp_change entries after), and leaves change-data sticky `_brutalStrikeActive:true, _brutalStrikeEffects:['Staggering Blow']`. Any subsequent sheet attack consumes them = retroactive +2d10 same-type + te grants with no chooser consent. Skip rolls a weapon-name-less bare d20 with zero damage entries (choice object passed where attack expected).

## Steps (repro)
1. DraconicDragon lv20 Barbarian (any subclass), Warhammer equipped; EB Join Bandit; stage Bandit HP up via initiative-card spinbuttons.
2. Walk to DraconicDragon turn; arm target Bandit 1; sheet attack "+11" → Reckless modal → tick "Use Brutal Strike", tick "Hamstring Blow" → "Attack Recklessly" → Done.
   - Damage ledger EXACT (`1d8+5 plus 2d10 [Brutal Strike] [bludgeoning]`, `mode:"normal"` forgo ✓), BUT `GET /targetEffects` → no speed_reduction te, Bandit speed unchanged, no grant log.
3. Click "+11" again same turn → Brutal chooser opens AGAIN despite stamped `_BrutalStrike_usedRound` (should be refused/no modal).
4. In that brutalOnly modal tick "Forceful Blow" → "Apply Brutal Strike" → modal closes, NO attack rolls, `_brutalStrikeActive` remains `true` in change-data.

## Likely Location
- `src/services/automation/contextBuilder-sync.js:298` (`applyBrutalStrikeEffectChoices`) and twin `src/services/combat/steps/attackRollBonuses.js:135` — options-filter whitelists ONLY `disadvantage_on_next_save`/`next_attack_bonus`; `speed_reduction` (+value) and `push_15ft` are dropped. Fix ≈ grant `speed_reduction {value:15, duration:'until_start_of_next_turn'}` via the MA-0995/1147 addExpiration anchor and a `push` marker te per MA-0079.
- `src/components/char-sheet/CharActionModals.SecondaryModals.jsx:228/231` — brutalOnly `onConfirm/onCancel` pass `(choice)` only; `handleBrutalStrikeConfirm/Cancel(choice, attack)` (useCharActionsAttackHandlers.js:193/216) then `buildCtx(undefined)` → no roll; sticky `_brutalStrikeActive` never consumed. Fix = forward `rm.attack` (byte-twin the full-mode wiring at :229).
- `src/components/initiative/navigationHandlers.js:196` — Next advances turn via top-level `storage.set('activeCreatureName', …)` only; gate `openRecklessChoiceModal` compares the stamp against `cs.activeCreatureName` (`combatData.js:68-72`) which Next never writes → latch permanently stale. Fix = compare vs top-level truth (or stamp holder AND accept round+holder match).

## Notes
- RAW "one Hamstring at a time / most recent" untestable (zero grants).
- RAW "forgo Advantage on one attack" correct on the full-mode hit (attack normal, following reckless attacks keep advantage — differential proven same session); brutalOnly never rolled so its forgo-leg (and the missing `_brutalStrikeNoAdvantage` set in `handleBrutalStrikeConfirm`, useCharActionsAttackHandlers.js:193-214) is unverifiable live — static gap noted.
- Push lane: PC-producer via this chooser could register a marker te (te `push` registered, MA-0079) — absence here is the filter, distinct from monster-row advisory family.
- Rig caveats: rapid Next-walks split-brain top-level vs cs mirror (§31 confirmed live, client `getActiveCreatureName` pinned "AasimarTest" all session); EB cs carries no speed field (gridless) — speed −15 would have to surface as te/badge, which is exactly what's missing.
- Session cleanup: Bandit removed, change-data `{}` + log `[]` admin-cleared, DraconicDragon disk canonical intact (Barbarian 20 Zealot, Warhammer/Whip).
