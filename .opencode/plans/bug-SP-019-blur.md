# Bug — SP-019 Blur (2024) — cast-path hard-throw leaves ward inert; blindsight/truesight immunity unconsumed

Campaign: test-campaign · Caster: DivinationWizard lv20 (Diviner) · Date: 2026-10-03
Verdict: **FAIL** — core clause never engages from a native cast on fresh state (reproduced live); immunity clause structurally unreachable via monster cards.

## Canonical expectation (public/data/2024/spells.json "blur")
"Your body becomes blurred. For the duration, any creature has Disadvantage on attack rolls against you. An attacker is immune to this effect if it perceives you with Blindsight or Truesight." lv2 Illusion, Self, V/S, Concentration up to 1 minute, Wizard/Sorcerer.

## Bug 1 (primary) — blurService throws when campaign targetEffects is null
- File: src/services/rules/features/blurService.js (~line 23-25)
  ```js
  const rawEffects = getRuntimeValue('campaign', 'targetEffects');
  if (rawEffects == null) { console.error('[blurService] Missing array:', rawEffects); throw new Error('Expected array, got ' + rawEffects); }
  ```
- Live console: `[blurService] Missing array: null` then `[useSpellCastExecutor] executeSpellCast error for Blur: Error: Expected array, got null` (stack: blurService.js:25 → triggerSpells.js:265 handleBlur → execution/index.js runTriggerChain/runNoDamagePath → useSpellCastExecutor.js:58).
- Other te-writing services treat null as empty (safe `campaignTargetEffects()` pattern); this strict-throw is inconsistent with codebase convention.
- Consequences, reproduced live on clean change-data (root targetEffects: null):
  1. Blur te (`{target, source, effect:'blur', duration:'concentration'}`) NEVER written — change-data root stays null after cast.
  2. blurService custom log line never written (addEntry is after the throw); only the generic pre-chain spell log lands.
  3. Automation info popup never shown.
  4. Incoming attacks vs the "warded" wizard fold `mode:"normal"` (single d20) — log-proved (Bandit Scimitar rolls:[9,5] mode:normal HIT). Core spell clause INERT.
  5. Slot lv2 still consumed 3→2, activeBuffs + cs.concentration{spell:Blur,dc:10} still stamped → UI lies (Blur badge/concentration with zero mechanical effect).
- Consumer lane itself is healthy: GM Add-effect seed of te {target:DivinationWizard, effect:'blur'} → "Disadv vs" badge (tooltip "Attackers have disadvantage on attack rolls against this creature."), Bandit attack popup `d20 20, 5 → 5 +3` MISS vs AC 9, log mode:"disadvantage"; after badge remove → mode:"normal" control. Fix is one line (coerce null → []).

## Bug 2 (clause 2) — Blindsight/Truesight immunity has zero live consumers
- conditionEffects.js blur handler honors `attackerSenses` (conditionEffects.js:504-507) and is unit-tested (conditionEffectsCompute.test.js:388-395) — but the monster-attack card path never supplies them:
  - MonsterCardModal.jsx:1272 `buildTargetEffectData(...)` → `computeConditionEffects({ conditions, saveModifiers, targetEffects: targetRiderForTarget })` — **attackerSenses omitted** (default null) → `attackerHasBlindsightOrTruesight(null)`===false → disadvantage folds for EVERY attacker.
  - monsterSensesArray (MonsterCardModal.jsx:1918-1933) exists and is passed only to the attacker's OWN effects compute (:2103), not to the target-side compute used by combineAttackModes (:2110).
- Live proof: Flying Sword (card shows "blindsight 60 ft. (blind beyond this radius)") attacks Blur-te-warded wizard → popup `d20 13, 20 → 13 +3`, log mode:"disadvantage". RAW immunity violated.
- (contextBuilder-sync.js:502 hasBlurOrForesightWithoutCounter DOES read attacker senses — but that is the PC-attacker lane; the EB monster lane, which is the inbound lane this spell lives in, never calls it.)

## Minor observations
- Roll popup labels the fold "Disadv (conditions)" / tooltip "Automatically set by active conditions" — no named Blur source in the popup/log (badge supplies source attribution on the card only).
- No round-based 1-minute expiry consumer (expiryRounds:null family); duration enforced only via concentration-break/badge-remove (accepted family precedent CLA-235/SP-083).
- cs.concentration dc:10 stamp is RAW-conform (con save DC 10) — NOT part of this bug.

## Repro (native UI)
1. Fresh change-data (root targetEffects null). 2. Wizard cast Blur (lv2, Self) → console throws, te absent, badge+concentration present. 3. +NPC Bandit, Target=wizard, Scimitar chip → mode:normal (no disadvantage). 4. GM Add-effect Blur on wizard card → Bandit Scimitar → mode:disadvantage (lane healthy). 5. +NPC Flying Sword, Target=wizard, Longsword → mode:disadvantage (immunity ignored). 6. Remove badges → mode:normal control.

## Suggested fix
- blurService.js: replace strict-throw with `const effects = Array.isArray(rawEffects) ? rawEffects : [];` (match campaignTargetEffects convention).
- MonsterCardModal.jsx buildTargetEffectData: thread attacker senses (`attackerSenses: monsterSensesArray`) into the target-side computeConditionEffects so the blur/foresight handler's existing immunity check fires live.
