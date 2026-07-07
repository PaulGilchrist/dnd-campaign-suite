# Attack → Damage Pipeline Refactor

## Problem

The attack→damage transition has **two parallel code paths** handling overlapping concerns differently:

| Path | Entry Point | Where | Used When |
|------|------------|-------|-----------|
| **Old inline** | `autoDamageRoll` callback | `CharActions.jsx:98-399`, `CharSpells.jsx`, `CharSpecialActions.jsx` | Auto-damage after attack roll popup (the usual flow) |
| **New pipeline** | `resolveAttackDamage` | `useAttackDamageResolution.js` → `buildPipelineForAction` → `weaponDamageSteps.js` | Manual damage text click |

Both accumulate bonus damage, roll dice, show modals (Cunning Strike, damage type choice, etc.), and call `rollDamage()`. Adding a new feature means implementing it twice — and it's easy to miss one path.

Additionally, `featureRiders` in `weaponDamageSteps.js` is a monolithic 300+ line handler, `applyDamage.js` has too many inline feature checks, modal state has exploded to 50+ individual variables, and SSE broadcasting is implicit rather than explicit.

---

## Recommendation 1 (HIGHEST PRIORITY): Single Unified Pipeline

**Merge both paths so ALL attack damage goes through the `actionPipeline`.**

The pipeline infrastructure already exists (`actionPipeline.js` + `steps/index.js` + `weaponDamageSteps.js`). It needs to:
- Handle all action types (weapon attacks, spells, automation)
- Accept input from both auto-damage and manual damage click
- Cover everything the old inline path handles (Empowered Evocation, Overchannel, Cleave, Topple, etc.)
- Have `autoDamageRoll` call the pipeline instead of doing everything inline

Once unified, the pipeline is the only place features need to be added. Details below.

---

## Recommendation 2: Break Up `featureRiders`

The `featureRiders` step in `weaponDamageSteps.js` (lines 651-1008+) handles ~15+ features in one monolithic handler. Split into individual step files per feature (or feature category), following the existing pattern in `automationInfoBuilder/` where handlers are spread across 20+ files.

*Low risk — mechanical extraction, existing behavior unchanged.*

---

## Recommendation 3: Extract `applyDamage.js` Death-Prevention Features

`applyDamage.js` (857 lines) has Undying Sentinel, Boon of Recovery, Relentless Endurance, Dark One's Blessing, Warding Bond, Thought Shield, Holy Aura, Psychic Veil mechanics all baked into a single function. Extract each death-prevention feature into its own module in `src/services/rules/features/` where similar services already live (`sleepService.js`, `heroismService.js`, etc.). The damage pipeline should call out to these.

*Medium risk — these features have specific interactions (e.g., `_reTriggeredSequenceIds` for multi-attack). Must preserve set ordering.*

---

## Recommendation 4: Add Explicit SSE Pipeline Observer

Currently SSE is a side effect of `setRuntimeValue`. Add a pipeline observer (in `observers.js`) that broadcasts SSE events for key pipeline milestones (damage:rolled, damage:applied, modal shown). This makes the SSE contract testable and visible.

*Low risk — additive, no existing code changes.*

---

## Recommendation 5: Consolidate Modal State

`useCharActionModals.js` manages 50+ individual `useState` variables. Replace with a single `modalState` object + dispatch pattern, or a context-based modal system. Each modal type becomes a case in a reducer rather than a separate `useState` + setter threaded through 4+ files.

*High risk — touches every modal. Do last, after pipeline is stable.*

---

## Implementation Priority Order

```
Rec 1 (Single Pipeline)  ─── HIGH ─── DO FIRST
Rec 2 (Feature Riders)    ─── LOW  ─── Can do in parallel with Rec 1
Rec 3 (applyDamage)       ─── MED  ─── After Rec 1 stable
Rec 4 (SSE Observer)      ─── LOW  ─── After Rec 1 stable
Rec 5 (Modal State)       ─── HIGH ─── Last, after everything else
```

---

## Recommendation #1: Detailed Plan

### Current Architecture

```
auto-damage after attack roll:
  [Attack Roll Popup] → [dice-roll-done event] → autoDamageRoll() → rollDamage()
     ↳ inline in CharActions.jsx: handles Empowered Evocation, weapon hit bonuses,
       Overchannel, Sneak Attack, Cunning Strike, BI Offense, weapon masteries

manual damage click:
  [Damage text clicked] → resolveAttackDamage() → buildPipelineForAction()
    → weaponDamageSteps pipeline (16 steps) → proceedWithDamage() → rollDamage()
```

### Target Architecture

```
ALL paths:
  [Trigger] → normalizeInput() → runPipeline() → rollDamage()
      ↳ pipeline is the single source of truth for all bonus accumulation
```

### What the Pipeline Currently Handles (from weaponDamageSteps)

1. housekeeping
2. attackRiderManeuvers (Battle Master modal)
3. cunningStrike (Rogue modal)
4. bardicInspirationOffense (modal)
5. rollBaseDamage
6. buildContext
7. sneakAttack
8. twoWeaponFighting
9. targetEffects
10. superiorityDieBonuses
11. automationBonuses (Rage, Frenzy, Divine Fury)
12. weaponHitBonuses (Divine Strike, Primal Strike)
13. natural20Bonuses
14. celestialRevelation (Aasimar)
15. featureRiders (Assassinate, Charger, Shield Bash, Colossus Slayer, etc.)

### What the Pipeline is MISSING (currently only in old inline path)

- **Empowered Evocation** — `autoDamageRoll` adds int mod to evocation cantrip damage
- **Overchannel** — `rollExpressionMaximized` for wizard overchannel
- **Cleave mastery** — secondary target selection modal + damage
- **Topple mastery** — CON save or prone
- **Tactical Master** — mastery replacement choice
- **Weapon hit bonus uses tracking** — `uses_expression` + `recharge` tracking (pipeline has this but old path also does)
- **Pending bonus damage type choice** — `damage_type_choice` popup for weapon hit bonuses with "or" in damage type

### Steps to Implement

#### Step 1-A: Audit what each path does

Read the full `autoDamageRoll` block in CharActions (lines 98-399) and catalog every feature it handles that the pipeline doesn't. [DONE — list above]

#### Step 1-B: Add missing steps to the pipeline

Create new step definitions (in new files under `src/services/combat/steps/` or add to existing) for:
- `empoweredEvocation` — int mod bonus to evocation cantrip damage, condition: caster has Empowered Evocation
- `overchannel` — maximize damage dice, condition: overchannelActive is true
- `cleaveMastery` — show secondary target selection modal, condition: weapon has Cleave mastery
- `toppleMastery` — CON save prompt after damage, condition: weapon has Topple mastery
- `tacticalMaster` — show mastery replacement modal, condition: replaceMasteryOptions exist

These steps should be inserted at the appropriate point in the pipeline (overchannel early, mastery steps after damage is applied).

#### Step 1-C: Normalize auto-damage input to attack-like object

Create a `normalizeAutoDamage(autoDamage, isCrit)` function that converts the `autoDamage` object (which has fields like `name`, `formula`, `damageType`, `targetName`, `saveDc`, `saveType`, `overchannelActive`, `sneakAttackDice`, etc.) to the `attack` object shape the pipeline expects.

This lives in `useAttackDamageResolution.js` or a new shared utility.

#### Step 1-D: Route `autoDamageRoll` through the pipeline

Replace the inline `autoDamageRoll` callback in `CharActions.jsx:98-399` with:

```js
const autoDamageRoll = async (autoDamage, isCrit) => {
  const attack = normalizeAutoDamage(autoDamage, isCrit);
  await resolveAttackDamage(attack);
};
```

This means `autoDamageRoll` calls the same `resolveAttackDamage` that the manual damage click uses. The pipeline handles all bonus accumulation, modals, and logging.

#### Step 1-E: Remove duplicated logic from CharActions.jsx

After Step 1-D, the `autoDamageRoll` block (lines 98-399) shrinks to the 3-line function above. Delete all the inline logic for Empowered Evocation, weapon hit bonuses, Overchannel, Sneak Attack, Cunning Strike, Bardic Inspiration Offense, Rend Mind, and Cleave/Topple mastery — these are all in the pipeline now.

#### Step 1-F: Extend pipeline to handle non-weapon actions

`steps/index.js:buildPipelineForAction` currently only builds steps for weapon attacks (`isWeaponAttack` check). Extend to:
- Build weapon steps for weapon attacks (existing behavior)
- Build spell steps for spell attacks (add `spellDamageSteps.js`)
- Build generic steps for automation actions (add `genericAutomationSteps.js`)

For now, weapon steps work for most cases. Spells and automations that don't need the weapon-specific steps can have their own short pipeline or skip.

#### Step 1-G: Update all callers

- `CharActions.jsx` — `autoDamageRoll` calls pipeline
- `CharSpells.jsx` — `autoDamageRoll` calls pipeline
- `CharSpecialActions.jsx` — `autoDamageRoll` calls pipeline
- `CharBonusActions.jsx` — `onResolveAttackDamage` already uses pipeline
- `MonsterCardModal.jsx` — `autoDamageRoll` calls pipeline (or uses `resolveAttackDamage` if shared)
- `CharReactions.jsx` — verify reaction attacks use pipeline

#### Step 1-H: Remove old inline code

Once all callers route through the pipeline, verify nothing references the old inline logic and delete it.

### Step Interface

Each pipeline step (existing and new):

```js
{
  name: 'cunningStrike',       // unique name for pause/resume
  subscribe: 'priorStep:done', // event from prior step
  emit: 'thisStep:done',      // event for next step
  condition: (ctx) => boolean, // true = run this step
  handler: async (ctx) => {
    // ctx has: attack, playerStats, campaignName, formula, total, rolls, hit, isCrit, ...
    // ctx also has: setPopupHtml, setAttackRiderModal, etc. (modal setters)
    if (shouldPause) {
      ctx.setAttackRiderModal({ ... });
      return { modal: { type: 'cunningStrike', props: { ... } } };
    }
    return { data: { formula, total, rolls, ... } }; // modifies ctx
  }
}
```

### Resume Pattern (unchanged)

When a step returns `{ modal }`, the pipeline pauses and stores state in `pendingDamageRef`. The modal handler reads it and calls `proceedWithDamage()` or the pipeline resumes via `resume()` on `pendingDamageRef`. This is the existing pattern — no change needed.

### `normalizeAutoDamage` Design

Converts the `autoDamage` object from `useLoggedDiceRollAttack.js:352-374` into the `attack` object + `ctx` fields the pipeline expects.

```js
// autoDamage object shape (from useLoggedDiceRollAttack.js):
{
  name: string,               // attack/spell name
  formula: string,            // raw damage formula (e.g. "1d12+3")
  autoDamageSchool: string,   // spell school for Empowered Evocation
  damageType: string,
  targetName: string,
  attackerName: string,
  saveDc: number,             // undefined if no save
  saveType: string,
  dcSuccess: string,          // 'half' for half-on-save
  metamagicTwinTarget: string,
  metamagicHeighten: boolean,
  isCantrip: boolean,
  overchannelActive: boolean,
  overchannelUseCount: number,
  overchannelSpellLevel: number,
  secondaryFormula: string,   // NPC multi-damage-type
  secondaryDamageType: string,
  ripostePopup: object,
  source: string,
  isAutoCrit: boolean,
  sneakAttackDice: number,
}

// normalizeAutoDamage(autoDamage, isCrit) → { attack, ctx }
// Where:
//   attack = { name, damage (the formula), damageType, ...weaponOrSpellAttrs }
//   ctx fields = { hit, isCrit, isNatural20, targetName, overchannelActive, ...flags }

function normalizeAutoDamage(autoDamage, isCrit) {
  const attack = {
    name: autoDamage.name,
    damage: autoDamage.formula,  // raw formula → pipeline rollBaseDamage uses this
    damageType: autoDamage.damageType,
    weaponType: 'weapon',        // generic; pipeline steps check this
    properties: [],
  };

  const ctxOverrides = {
    hit: true,                   // if auto-damage fired, the attack hit
    isCrit: isCrit || autoDamage.isAutoCrit,
    isNatural20: isCrit,
    targetName: autoDamage.targetName || null,
    isBonusActionAttack: false,
    overchannelActive: autoDamage.overchannelActive || false,
    overchannelUseCount: autoDamage.overchannelUseCount || 0,
    overchannelSpellLevel: autoDamage.overchannelSpellLevel || 1,
    autoDamageSchool: autoDamage.autoDamageSchool || '',
    isCantrip: autoDamage.isCantrip || false,
    sneakAttackDice: autoDamage.sneakAttackDice || 0,
    saveDc: autoDamage.saveDc,
    saveType: autoDamage.saveType,
    dcSuccess: autoDamage.dcSuccess,
    secondaryFormula: autoDamage.secondaryFormula,
    secondaryDamageType: autoDamage.secondaryDamageType,
    autoDamageSource: true,       // flag for pipeline to know this came from auto-damage
  };

  return { attack, ctx: ctxOverrides };
}
```

### Pipeline Step: `overchannel`

```
name: 'overchannel'
subscribe: 'prior:step',  // inserted between rollBaseDamage and the next step
emit: 'overchannel:done'
condition: (ctx) => ctx.overchannelActive
handler: (ctx) → modifies rolls to maximized values
```

Optimizes damage dice: `rollExpressionMaximized(formula)` instead of `rollExpression(formula)`. Also tracks overchannel self-damage (necrotic backlash) for later application.

### Pipeline Step: `empoweredEvocation`

```
name: 'empoweredEvocation'
subscribe: 'overchannel:done' | 'damage:rolled'
emit: 'evocation:applied'
condition: (ctx) => player has Empowered Evocation AND spell school is 'evocation'
handler: (ctx) → adds intMod bonus to total
```

### Pipeline Steps: Weapon Mastery Post-Damage

These run AFTER damage is applied (after `proceedToDamage` or at the end of the pipeline):

```
name: 'cleaveMastery'
subscribe: 'riders:applied'   // after all damage bonuses applied
emit: 'mastery:applied'
condition: (ctx) => weapon has Cleave mastery AND there's a second target in range
handler: (ctx) → shows secondary target selection modal, applies damage to chosen target

name: 'toppleMastery'
subscribe: 'mastery:applied'
emit: 'mastery:done'
condition: (ctx) => weapon has Topple mastery AND target not immune to prone
handler: (ctx) → CON save prompt, applies prone on failure

name: 'tacticalMaster'
subscribe: 'mastery:done'
emit: 'pipeline:done'
condition: (ctx) => weapon has replaceMasteryOptions
handler: (ctx) → shows mastery replacement choice modal
```

### Integration into `buildPipelineForAction`

```js
export function buildPipelineForAction(action, playerStats) {
  const pipeline = createPipeline();

  // Always register observers
  for (const obs of createObservers()) {
    pipeline.observe(obs.event, obs.handler);
  }

  // Always add core steps (these apply to weapon, spell, and generic actions)
  const steps = buildDamageSteps();  // renamed from buildWeaponDamageSteps
  for (const step of steps) {
    pipeline.step(step);
  }

  return pipeline;
}
```

The pipeline handles ALL action types now. Weapon-specific steps check `ctx.attack.weaponType` or `ctx.attack.properties` to conditionally apply. Spell-specific steps check `ctx.autoDamageSchool`.

### How Each Caller Integrates

**CharActions.jsx** (currently the most complex at ~530 lines):
```js
autoDamageRoll: async (autoDamage, isCrit) => {
  const { attack, ctx: ctxOverrides } = normalizeAutoDamage(autoDamage, isCrit);
  await resolveAttackDamage(attack, ctxOverrides);
}
```

**CharSpells.jsx** (~90 lines):
```js
autoDamageRoll: async (autoDamage, isCrit) => {
  const { attack, ctx: ctxOverrides } = normalizeAutoDamage(autoDamage, isCrit);
  await resolveAttackDamage(attack, ctxOverrides);
}
```

**CharSpecialActions.jsx** (~45 lines):
```js
autoDamageRoll: async (autoDamage, isCrit) => {
  const { attack, ctx: ctxOverrides } = normalizeAutoDamage(autoDamage, isCrit);
  // handle superiority dice already embedded in formula
  await resolveAttackDamage(attack, ctxOverrides);
}
```

**MonsterCardModal.jsx** (~25 lines):
```js
autoDamageRoll: (autoDamage, isCrit) => {
  const { attack, ctx: ctxOverrides } = normalizeAutoDamage(autoDamage, isCrit);
  await resolveAttackDamage(attack, ctxOverrides);
}
```

### What Gets Deleted After Migration

From **CharActions.jsx** (lines 98-625, ~530 lines):
- Empowered Evocation block
- Weapon hit bonuses loop + pendingBonusDamage handling
- Overchannel + rollExpressionMaximized
- Bardic Inspiration Offense flagging
- Sneak Attack + Cunning Strike + Rend Mind block
- Cleave target selection
- Tactical Master modal
- Topple mastery save prompt
- Eldritch Strikes attack_riders
- Overchannel self-damage
- Remarkable Athlete
- Lunging Attack / Commander's Strike cleanup

From **CharSpells.jsx** (lines 46-122, ~77 lines):
- Empowered Evocation block
- Overchannel + rollExpressionMaximized
- Overchannel self-damage
- Remarkable Athlete

From **CharSpecialActions.jsx** (lines 38-82, ~45 lines):
- Superiority dice handling
- ripostePopup handling

From **MonsterCardModal.jsx** (lines 88-109, ~22 lines):
- Entire inline roll logic


1. **No pipeline behavior changes** — the same logic runs, just organized differently. Existing `weaponDamageSteps.test.js` and `actionPipeline.test.js` should pass.
2. **Add `normalizeAutoDamage.test.js`** — test conversion of autoDamage objects.
3. **Verify `autoDamageRoll` tests still pass** — the old tests mock `rollDamage` and check which formula/total gets passed. The new code routes through the pipeline but the same `rollDamage` is called at the end, so existing CharActions tests should still pass.
4. **Run `npm run test:run` after each step** — catch regressions early.

### Risk Mitigation

- **Incremental**: add one missing pipeline step at a time, test after each
- **Don't remove old code until the new path is verified**: keep the old `autoDamageRoll` inline code behind a feature flag, or keep it and verify the pipeline produces identical results
- **Start with a single entry point** (e.g., CharActions weapons) before expanding to spells and monster cards
- **No modal component changes** — only change how they're called

### Files Changed

| File | Change |
|------|--------|
| `src/components/char-sheet/useAttackDamageResolution.js` | Add `normalizeAutoDamage`, route `resolveAttackDamage` through pipeline for all cases |
| `src/components/char-sheet/CharActions.jsx` | Replace inline `autoDamageRoll` with pipeline call; delete ~300 lines of old logic |
| `src/components/char-sheet/CharSpells.jsx` | Same — `autoDamageRoll` calls pipeline |
| `src/components/char-sheet/CharSpecialActions.jsx` | Same — `autoDamageRoll` calls pipeline |
| `src/components/encounter/MonsterCardModal.jsx` | `autoDamageRoll` calls pipeline |
| `src/services/combat/steps/index.js` | Extend `buildPipelineForAction` for non-weapon action types |
| `src/services/combat/steps/weaponDamageSteps.js` | Add steps: empoweredEvocation, overchannel, cleaveMastery, toppleMastery, tacticalMaster |
| `src/services/combat/steps/spellDamageSteps.js` | *New* — spell-specific pipeline steps |
| `src/services/combat/steps/genericSteps.js` | *New* — generic steps usable by any action type |
