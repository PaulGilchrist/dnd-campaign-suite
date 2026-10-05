# BUG BA-001: Dodge — no disadvantage on EB monster attacks against dodging PC; expiration entry never persists

## Title
Dodge (baseAction): incoming EB monster attack rolls ignore the dodge buff (mode:normal, single d20), and the `until_start_of_next_turn` expiration entry is never persisted so Dodge never clears.

## Overview
LightfootHalfling (Fighter lv1, AC 14) takes Dodge on her turn (round 2). Popup + badges stamp correctly and `activeBuffs` gains `{name:'Dodge', effect:'dodge', duration:'until_start_of_next_turn'}`. However:
1. The EB Bandit (scimitar +3, target armed to LightfootHalfling on its own initiative card) rolled TWO attacks at the dodging host — both single-d20, mode normal, no Disadvantage marker: natural 14→17 HIT, natural 3→6 MISS. The popup offers only manual Advantage/Disadvantage override buttons.
2. At the host's NEXT turn start (round 4, activeCreatureName=LightfootHalfling) the Dodge buff is still in runtime and badges still render ("Disadv vs", "Adv DEX Save"). The `addExpiration` entry written by `handleDodgeAction` never appears in change-data (`pendingExpirations: []` at t+4s/8s/12s after activation, on two consecutive activations; `'remove_active_buff'` appears nowhere in change-data).

## Expected (quoted from task)
"until your next turn, any creature making an attack roll against you has Disadvantage" — evidence expected: `rolls:[a,b]` two d20, mode marker / "with Advantage/Disadvantage" wording, and hit/miss consistent with lower-of-two. Expiry: "after the attack resolves (or at host's next turn start per code), the dodge state clears (GET + badge gone)".

## Actual
- Bandit attack popups: single d20 each, no disadvantage fold, no mode marker (two separate presses, one armed target).
- Runtime after host's next-turn start (round 4): `LightfootHalfling.activeBuffs` still contains Dodge; badges still shown; no expiration entry ever recorded.

## Repro
1. http://localhost:5173 → test-campaign → Encounters → search "Bandit" → tick → Join Encounter (Bandit enters initiative).
2. Initiative: set LightfootHalfling init 15, Bandit init 5 (init inputs, Enter commits; cards resort on commit). Walk Next → LightfootHalfling active.
3. Open LFH sheet → click base-action "Dodge" → popup "Dodge activated...". GET `/api/campaigns/test-campaign/change-data`: `LightfootHalfling.activeBuffs` = Dodge ✅; `pendingExpirations` = [] ❌ (expected one `remove_active_buff` entry).
4. Arm Bandit's initiative-card `[data-testid="target-select"]` = LightfootHalfling → Next → Bandit active → open monster modal (.npc-avatar) → click Scimitar `.mc-dice-link` → popup shows single d20, mode normal, no "Disadvantage" indication. Repeat: same.
5. Walk initiative full cycle back to LightfootHalfling (round 4). GET: Dodge buff STILL present; badges still render. Never clears.

## Likely Location
- `src/components/encounter/MonsterCardModal.jsx:1282` `buildTargetEffectData()` — builds defender adv/dis from conditions + targetEffects only; never reads the player target's `activeBuffs` for `effect==='dodge'`. Contrast `applyProtectionFromEvilPenalty` (same file :855) which does read active-buff-backed state; `src/services/automation/contextBuilder-sync.js:213` `countDodgeDisadvantage` exists but is only wired into the PC-attack pipeline, not the EB monster card. Badge layer (`ConditionEffectBadges.jsx:488`) reads activeBuffs, so the UI "lies" about what the roll applies.
- `src/services/rules/effects/expirationQueue.js:10` `addExpiration` — un-awaited `setRuntimeValue(LFH,'pendingExpirations',[])` then `[entry]` double-write (§39 known reorder hazard) — entry never observable in change-data; without it, `expireStaleEffects` at the host's next-turn start (`src/components/initiative/sseHandlers.js:79,127` → `clearExpirationEffects.handleRemoveActiveBuff`) has nothing to consume → Dodge persists forever.

## Notes
- Save lane (task step 5): `SavePromptModal.jsx:117-138` + `useLoggedDiceRollSaves.js:74-79` grant ADVANTAGE on DEX saves while dodging — 2014 RAW. Under the 2024 ruleset (LFH's sheet is 2024-style) Dodge gives no save benefit; popup/log text also asserts the 2014 clause. Not live-verified (no Dex-save attacker in setup) — grep + popup-text evidence.
- Difficult-terrain manifest clause: no consumer found in grep — advisory only.
- Toggle behavior: second click same turn cleanly deactivates ("Dodge deactivated." popup, no duplicate log) — per code gates.
- Console: only pre-existing unrelated `[findFeat]` error; no Dodge-related console errors.
