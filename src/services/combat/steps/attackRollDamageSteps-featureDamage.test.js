// @maintained-by-ai
// Lane: feature-driven damage in the attack pipeline — the two post-damage-calc steps owned by
// attackRollPostDamage.js. Services (features/*.js, automation handlers) own grant/consume store
// and per-spell internals (#945-#951); THIS lane pins only the pipeline-step bytes of the
// generic featureRiders dispatcher (idx 15) and the unarmed damageTypeModifiers step (idx 16).
//
// Composition map (verified against attackRollDamageSteps.js buildAttackRollDamageSteps()):
//   steps[15] = buildFeatureRidersStep()   name 'featureRiders'      subscribe 'celestial:applied' emit 'riders:applied'
//   steps[16] = buildDamageTypeModifiersStep() name 'damageTypeModifiers' subscribe 'riders:applied' emit 'dmg_type:modified'
// Structure (names/order/subscribe-emit chain) is owned by attackRollDamageSteps.test.js exact
// ordered-names toEqual — cited here, not re-pinned. This file covers handler behavior only.
//
// Stub dice (deterministic #1026): 1d4 -> 4, 1d6 -> [4]/total 4. Math hand-derived once (#815).
//
// Old -> new map:
//   featureRiders: condition-tautology removed; skip+call -> one gating test; update+sequence ->
//     one chaining test (adds null-result arm); modal + stops-processing -> one halt test
//     (adds popup arm, the previously uncovered branch); passthrough + missing-rolls merged.
//   damageTypeModifiers: 3 condition its -> 1; auto-select resist/immune/case-insensitive ->
//     1 test, 3 runs; prompt-with-target/prompt-target-not-found -> 1 test, 2 runs
//     (same fall-through branch, both exact-pinned).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    if (!formula || formula === '0') return null;
    const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
    if (!baseFormula) return null;
    const match = baseFormula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (match) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      const modStr = match[3] ? parseInt(match[3], 10) : 0;
      const rolls = Array(count).fill(Math.floor(sides / 2) + 1);
      const total = rolls.reduce((s, r) => s + r, 0) + modStr;
      return { total, rolls, modifier: modStr };
    }
    return { total: 6, rolls: [6], modifier: 0 };
  }),
  rollExpressionDoubled: vi.fn((formula) => {
    if (!formula || formula === '0') return null;
    const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
    if (!baseFormula) return null;
    const match = baseFormula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (match) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      const modStr = match[3] ? parseInt(match[3], 10) : 0;
      const rolls = Array(count).fill(Math.floor(sides / 2) + 1);
      const total = (rolls.reduce((s, r) => s + r, 0) * 2) + modStr;
      const doubledRolls = rolls.concat(rolls);
      return { total, rolls, doubledRolls, modifier: modStr };
    }
    return { total: 12, rolls: [6], modifier: 0 };
  }),
  rollExpressionMaximized: vi.fn((formula) => {
    if (!formula) return null;
    const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
    if (!baseFormula) return null;
    const match = baseFormula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (match) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      const modStr = match[3] ? parseInt(match[3], 10) : 0;
      return { total: count * sides + modStr, rolls: Array(count).fill(sides), modifier: modStr, maximized: true };
    }
    return { total: 12, rolls: [6], modifier: 0 };
  }),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(() => Promise.resolve({ lastAttack: {} })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_characterKey, _propertyName, _campaignName) => null),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
  collectWeaponMastery: vi.fn(),
}));

vi.mock('../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getAttackRiderOptions: vi.fn(() => Promise.resolve([])),
  getAttackRiderOptionsByContext: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../combat/prompts/bardicInspirationPromptUtils.js', () => ({
  sendBardicInspirationOffensePrompt: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
  hasBardicInspirationOffense: vi.fn(() => false),
  getBardicInspirationDieSize: vi.fn(() => null),
}));

vi.mock('../../automation/common/resourceCheck.js', () => ({
  spendResource: vi.fn(),
}));

vi.mock('../../automation/common/buffToggle.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { guid: () => 'test-guid-123' },
}));

vi.mock('./features/index.js', () => ({
  featureModules: [],
}));

vi.mock('../../automation/handlers/combat/weaponMasteryHandler.js', () => ({
  applyMasteryEffect: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 3),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id', promise: Promise.resolve({ success: true }) })),
}));

// ── Imports ──────────────────────────────────────────────────────

const { buildAttackRollDamageSteps } = await import('./attackRollDamageSteps.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { addEntry } = await import('../../ui/logService.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../rules/combat/damageUtils.js');
const { featureModules } = await import('./features/index.js');

// ── Helpers ───────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: {
      name: 'TestChar',
      abilities: [{ name: 'Strength', bonus: 3 }],
      automation: { actions: [], passives: [] },
      level: 5,
      proficiency: 3,
    },
    proceedWithDamage: vi.fn(),
    campaignName: 'test-campaign',
    ...overrides,
  };
}

function makeUnarmedCtx(passives, attackOverrides = {}) {
  return makeCtx({
    attack: { weaponType: 'unarmed', damageType: 'bludgeoning', ...attackOverrides },
    playerStats: { name: 'TestChar', automation: { passives } },
    formula: '1d4',
    total: 4,
    rolls: [4],
  });
}

const EMPOWERED_STRIKES = {
  name: 'Empowered Strikes',
  type: 'damage_type_modifier',
  trigger: 'unarmed_strike_hit',
  options: [
    { name: 'Force', damageType: 'Force' },
    { name: 'Bludgeoning', damageType: 'Bludgeoning' },
  ],
};

// ── Tests ────────────────────────────────────────────────────────

describe('featureRiders step (steps[15]) — dispatcher bytes', () => {
  let step;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    step = buildAttackRollDamageSteps()[15];
    featureModules.length = 0;
  });

  it('passes damage through untouched when no feature module fires (missing rolls normalize to [])', async () => {
    featureModules.push({ condition: () => false, handler: vi.fn() });

    const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(await step.handler(ctx)).toEqual({
      data: { formula: '1d8+3', total: 11, rolls: [8, 3] },
    });

    const noRolls = makeCtx({ formula: '1d8+3', total: 11, rolls: undefined });
    expect(await step.handler(noRolls)).toEqual({
      data: { formula: '1d8+3', total: 11, rolls: [] },
    });
  });

  it('invokes only condition-true features, handing each (ctx, currentData)', async () => {
    const skipped = vi.fn();
    const fired = vi.fn(async () => null);
    featureModules.push(
      { condition: () => false, handler: skipped },
      { condition: () => true, handler: fired },
    );

    const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    const result = await step.handler(ctx);

    expect(skipped).not.toHaveBeenCalled();
    expect(fired).toHaveBeenCalledWith(ctx, { formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(result).toEqual({ data: { formula: '1d8+3', total: 11, rolls: [8, 3] } });
  });

  it('chains feature data in order: null results are skipped, later data replaces earlier', async () => {
    featureModules.push(
      { condition: () => true, handler: async () => null },
      {
        condition: () => true,
        handler: async () => ({ data: { formula: '1d8+3 + 4 [Smite]', total: 15, rolls: [8, 3, 4] } }),
      },
    );
    const last = vi.fn(async () => ({ data: { formula: '1d8+3 + 4 [Smite] + 5 [Bonus]', total: 20, rolls: [8, 3, 4, 5] } }));
    featureModules.push({ condition: () => true, handler: last });

    const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    const result = await step.handler(ctx);

    // Third feature must receive the second feature's output, not the original data.
    expect(last).toHaveBeenCalledWith(ctx, { formula: '1d8+3 + 4 [Smite]', total: 15, rolls: [8, 3, 4] });
    expect(result).toEqual({
      data: { formula: '1d8+3 + 4 [Smite] + 5 [Bonus]', total: 20, rolls: [8, 3, 4, 5] },
    });
  });

  it('halts the chain immediately when a feature returns modal or popup', async () => {
    const afterModal = vi.fn(async () => ({ data: { total: 99 } }));
    featureModules.push(
      { condition: () => true, handler: async () => ({ modal: { type: 'test-modal', props: { a: 1 } } }) },
      { condition: () => true, handler: afterModal },
    );

    const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(await step.handler(ctx)).toEqual({ modal: { type: 'test-modal', props: { a: 1 } } });
    expect(afterModal).not.toHaveBeenCalled();

    featureModules.length = 0;
    const afterPopup = vi.fn(async () => ({ data: { total: 99 } }));
    featureModules.push(
      { condition: () => true, handler: async () => ({ popup: '<b>Smite</b> applied' }) },
      { condition: () => true, handler: afterPopup },
    );

    expect(await step.handler(ctx)).toEqual({ popup: '<b>Smite</b> applied' });
    expect(afterPopup).not.toHaveBeenCalled();
  });

  it('applies feature data then awaits sideEffects', async () => {
    const calls = [];
    featureModules.push({
      condition: () => true,
      handler: async () => ({
        data: { formula: '1d8+3 + 6 [Feature]', total: 17, rolls: [8, 3, 6] },
        sideEffects: async () => {
          await Promise.resolve();
          calls.push('sideEffects');
        },
      }),
    });

    const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    const result = await step.handler(ctx);

    expect(result).toEqual({ data: { formula: '1d8+3 + 6 [Feature]', total: 17, rolls: [8, 3, 6] } });
    expect(calls).toEqual(['sideEffects']);
  });
});

describe('damageTypeModifiers step (steps[16]) — unarmed damage-type bytes', () => {
  let step;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    step = buildAttackRollDamageSteps()[16];
    featureModules.length = 0;
  });

  it('condition gates on unarmed weaponType with a passives array', () => {
    expect(step.condition(makeCtx({ attack: { weaponType: 'unarmed' } }))).toBe(true);
    expect(step.condition(makeCtx({ attack: { weaponType: 'melee' } }))).toBe(false);
    expect(step.condition(makeCtx({ attack: { weaponType: 'unarmed' }, playerStats: { automation: {} } }))).toBe(false);
  });

  it('returns damage untouched when no passive triggers on unarmed_strike_hit', async () => {
    const ctx = makeUnarmedCtx([{ type: 'attack_rider', trigger: 'hit' }], { damageType: 'bludgeoning' });

    expect(await step.handler(ctx)).toEqual({ data: { formula: '1d4', total: 4, rolls: [4] } });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(ctx.attack.damageType).toBe('bludgeoning');
  });

  it('consumes stored empoweredStrikesDamageType once and clears the token', async () => {
    getRuntimeValue.mockReturnValue('psychic');
    const ctx = makeUnarmedCtx([EMPOWERED_STRIKES]);

    const result = await step.handler(ctx);

    expect(ctx.attack.damageType).toBe('psychic');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', 'empoweredStrikesDamageType', null, 'test-campaign');
    expect(result).toEqual({ data: { formula: '1d4', total: 4, rolls: [4] } });
  });

  it('auto-selects Force when the normal damage type is resisted, immune, or resisted case-insensitively — logging each choice', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({ creatures: [] });

    const cases = [
      { defenses: { name: 'Goblin', resistances: ['Bludgeoning'], immunities: [] }, reason: 'resists' },
      { defenses: { name: 'Goblin', resistances: [], immunities: ['Bludgeoning'] }, reason: 'immune to' },
      { defenses: { name: 'Goblin', resistances: ['BLUDGEONING'], immunities: [] }, reason: 'resists' },
    ];

    for (const { defenses, reason } of cases) {
      addEntry.mockClear();
      getTargetFromAttacker.mockReturnValue(defenses);
      const ctx = makeUnarmedCtx([EMPOWERED_STRIKES]);
      const result = await step.handler(ctx);

      expect(ctx.attack.damageType).toBe('Force');
      expect(result.popup).toBe(`<b>Empowered Strikes</b><br/>Goblin ${reason} Bludgeoning — using <b>Force</b>`);
      expect(result.data).toEqual({ formula: '1d4', total: 4, rolls: [4] });
      expect(addEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'ability_use',
        characterName: 'TestChar',
        abilityName: 'Empowered Strikes',
        description: `Empowered Strikes — auto-selected Force damage (Goblin ${reason} Bludgeoning)`,
        targetName: 'Goblin',
      });
    }
  });

  it('prompts via damageTypeChoice modal when nothing forces a choice — target unaffected or absent', async () => {
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({ creatures: [] });
    const expectedModal = {
      type: 'damageTypeChoice',
      props: { title: 'Empowered Strikes — Damage Type', types: ['Force', 'Bludgeoning'] },
    };

    getTargetFromAttacker.mockReturnValue({ name: 'Goblin', resistances: ['Piercing'], immunities: [] });
    const resistedOther = makeUnarmedCtx([EMPOWERED_STRIKES]);
    const r1 = await step.handler(resistedOther);
    expect(r1.modal).toEqual(expectedModal);
    expect(r1.data).toEqual({ formula: '1d4', total: 4, rolls: [4], _damageTypeModifier: EMPOWERED_STRIKES });
    expect(resistedOther.attack.damageType).toBe('bludgeoning');

    getTargetFromAttacker.mockReturnValue(null);
    const r2 = await step.handler(makeUnarmedCtx([EMPOWERED_STRIKES]));
    expect(r2.modal).toEqual(expectedModal);
  });

  it('applies stored Chosen Rider damage_bonus exactly and clears the selection token', async () => {
    // stub: rollExpression('1d6') -> { total: 4, rolls: [4] }; total 4 + 4 = 8, rolls [4, 4].
    getRuntimeValue.mockImplementation((_key, prop) => (prop === '_Chosen_Rider_selectedOption' ? 'Option A' : null));
    const rider = {
      name: 'Chosen Rider',
      type: 'attack_rider',
      trigger: 'unarmed_strike_hit',
      chooseOne: true,
      options: [
        { name: 'Option A', effect: 'damage_bonus', damageExpression: '1d6', damageType: 'force' },
        { name: 'Option B', effect: 'other' },
      ],
    };
    const ctx = makeUnarmedCtx([rider]);

    const result = await step.handler(ctx);

    expect(result).toEqual({
      data: { formula: '1d4 + 1d6 [force]', total: 8, rolls: [4, 4] },
    });
    expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', '_Chosen_Rider_selectedOption', null, 'test-campaign');
  });

  it('opens the Enhanced Unarmed Strike choice modal when no rider option is stored', async () => {
    getRuntimeValue.mockReturnValue(null);
    const ctx = makeCtx({
      attack: { weaponType: 'unarmed' },
      playerStats: {
        name: 'TestChar',
        automation: {
          passives: [
            {
              name: 'Chosen Rider',
              type: 'attack_rider',
              trigger: 'unarmed_strike_hit',
              chooseOne: true,
              options: [{ name: 'Option A' }, { name: 'Option B' }],
            },
          ],
        },
      },
    });

    expect(await step.handler(ctx)).toEqual({
      modal: {
        type: 'damageTypeChoice',
        props: { title: 'Chosen Rider — Enhanced Unarmed Strike', types: ['Option A', 'Option B'] },
      },
    });
  });
});
