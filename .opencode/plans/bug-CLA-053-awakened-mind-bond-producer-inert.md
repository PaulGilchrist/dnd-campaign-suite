# CLA-053 Clairvoyant Combatant — FAIL(b): trigger producer inert; feature unreachable

## Overview
Clairvoyant Combatant (2024 Great Old One lv6, `clairvoyant_combatant`) never fires because its
prerequisite key `awakenedMindTarget` is NEVER written by the UI. Pressing **Awakened Mind** and
confirming with **Establish Link** is a zero-effect no-op: the picker's `onTargetSelected` only
closes the modal — the confirm service `confirmTelepathicSpeech()` (the ONLY writer of
`awakenedMindTarget`, `activeBuffs`, and the bond log) has **zero callers** in app code.
Consequently Clairvoyant Combatant's handler gate always refuses with
"requires an active Awakened Mind bond" — no WIS save, no targetEffects, no adv/dis fold, ever.

## Expected (app-data quote, public/data/2024/classes.json ~:12552, Great Old One lv6)
> "When you form a telepathic bond with a creature using Awakened Mind, force that creature to
> make Wisdom save. On failed save, creature has Disadvantage on attack rolls against you, and
> you have Advantage on attack rolls against that creature for the duration."
automation: `{type:"clairvoyant_combatant", saveType:"WIS", saveDc:"ability", saveAbility:"CHA",
duration:"1_minute", pactMagicRecharge:true, uses:1}` → DC = 8+PB5+CHA3 = **16** on lv14 host.

## Actual (live, 2026-10-02, HexWarlock lv14 Great Old One disk-verified, test-campaign)
- Awakened Mind pressed twice: radio "Bandit 1" verified `checked:true` (name=secondaryTarget),
  "Establish Link" verified `disabled:false`, clicked both times → after 13s debounce:
  change-data `HexWarlock.awakenedMindTarget` = **absent**, `activeBuffs` = **absent**,
  log delta = **zero** (only the 2 `encounter`/`roll` join entries of the rig). No popup even.
- Clairvoyant Combatant press → refusal popup (gate live):
  "Clairvoyant Combatant requires an active Awakened Mind bond. Activate Awakened Mind first…"
- Root grep: `confirmTelepathicSpeech` exported at buffHandler.js:617 — callers: tests only.
  `awakenedMindTarget` writers = buffHandler.js:636/638 (inside that dead function), plus
  nullers in restRules + useInitiativeEffects.js:384. No UI path ever sets it non-null.

## Steps
1. test-campaign, HexWarlock lv14 sheet; EB-join Bandit + Thug, initiative up.
2. Bonus Actions → "Awakened Mind:" → picker → radio Bandit 1 → Establish Link.
3. GET /api/campaigns/test-campaign/change-data → HexWarlock has no awakenedMindTarget; log unchanged.
4. Features → "Clairvoyant Combatant:" → refusal popup "requires an active Awakened Mind bond".

## Likely Location
- `src/components/char-sheet/useCharActionsAutomation.js:334-336` — `telepathicSpeech` modal
  `onTargetSelected: async (_targetName) => { setModalState({ secondaryTargetModal: null }); }`
  drops the payload; must `await confirmTelepathicSpeech(action, playerStats, campaignName, targetName)`
  (pattern: same file / useModalHandlers.js:230 lanes which chain a real confirm call).
- Secondary defect A: `clairvoyantCombatantHandler.js:6-8 resolveClairvoyantSaveDc` returns
  `auto.saveDc || …` — data token `'ability'` is truthy → saveDc becomes the STRING "ability"
  (modal would render "DC ability", createSaveListener compares total >= 'ability' → always-fail).
  Should route through `buildSaveDc()` (savePrompt.js:12 handles `'ability'` via `saveAbility`);
  fallback formula also wrongly uses `auto.saveType` (WIS) where data says `saveAbility` (CHA).
- Secondary defect B (defender-leg fold): ClairvoyantCombatantModal.jsx:40-51 lands te
  `{target: bonded, attackerAdvantage, defenderDisadvantage}`; applyTargetEffect
  (conditionEffects.js:460-468) folds `defenderDisadvantage`→`targetDisadvantageCount` ON THE
  BONDED CREATURE'S OWN te bucket, but combineAttackModes (conditionEffects.js:849) reads
  `targetEffects.targetDisadvantageCount` only when the te holder is the DEFENDER — so
  "bonded Bandit attacks HexWarlock" gets NO disadvantage (grep-zero clairvoyant consumers in
  MonsterCardModal/EB lane). Attacker leg (warlock→bonded) has working channels
  (targetAdvantageCount + contextBuilder-sync.js:361-363) but was unreachable live.

## Notes
- Gate ordering fingerprint: modal (ClairvoyantCombatantModal.jsx:39-51) writes te UNCONDITIONALLY
  at confirm, before the save resolves, then filters it out on save success — expect te to be
  visible pre-save on any fixed lane.
- No `addExpiration` clock in the modal for `duration:"1_minute"` → te would never expire
  (§CLA-032/§CLA-045 anchor-family gap) even if producer is fixed.
- Second-bond/limit behavior not reachable (uses/pactMagicRecharge gate unexercised — refusal
  popup precedes the uses check at clairvoyantCombatantHandler.js:26 vs :37).
- Cleanup: log + change-data admin-cleared post-session; HexWarlock/cast cards untouched
  (spells[] pristine, no HP deltas — zero rolls occurred).
