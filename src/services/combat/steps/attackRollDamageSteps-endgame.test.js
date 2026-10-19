// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Lane: buildAttackRollDamageSteps() idx 17 + 18 ─────────────────────────
// attackRollDamageSteps.js:25-26 composes:
//   idx 17 buildOverchannelStep()     (attackRollPostDamage.js:157-175)
//   idx 18 buildProceedToDamageStep() (attackRollPostDamage.js:329-347)
// Behavioral coverage only; names/subscribe/emit composition is cited to
// attackRollDamageSteps.test.js (structural lane, :189-190).
// The poisoned-weapons save flow (attackRollPostDamage.js:183-327) has NO
// other step-level coverage in the repo (grep poisonedWeaponsActive: UI-only)
// — this file is its CANON owner. Prompts await an event, never a timer.
// Fold-cut map (old → new):
//   overchannel condition x4            → condition truth table (1)
//   overchannel dice formulas x3      → replaced-oracle table: ROLL_TABLE maps
//                                         formula → exact total, never re-parsed (#1032)
//   'logs a damage entry' + 'calls applyDamageToTarget' → exact per-row payloads (#829)
//   'handles null rollExpression'     → zero-writes sentinel (#934)
//   proceed condition x5              → condition truth table (1)
//   'calls proceedWithDamage...' + 'returns _done' → one exact-handoff test (#951)
// Added (CANON, own lane): poisoned-weapons save fail/save/miss arms.

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => {
  // Deterministic replaced-oracle table (#1032): stub die value 7 on d12
  // (2d12→14, 4d12→28, 9d12→63), 5 on d8 (#1026 convention 2d8→10).
  const ROLL_TABLE = {
    '2d12': { total: 14, rolls: [7, 7], modifier: 0 },
    '4d12': { total: 28, rolls: [7, 7, 7, 7], modifier: 0 },
    '9d12': { total: 63, rolls: [7, 7, 7, 7, 7, 7, 7, 7, 7], modifier: 0 },
    '2d8': { total: 10, rolls: [5, 5], modifier: 0 },
  };
  return {
    ROLL_TABLE,
    rollExpression: vi.fn((formula) => {
      if (!ROLL_TABLE[formula]) throw new Error(`unexpected roll in endgame lane: ${formula}`);
      return ROLL_TABLE[formula];
    }),
    // Tripwires: named exports required by attackRollDamageCalc/attackRollBonuses
    // module bindings — must never roll in this lane (#1027 sentinels).
    rollExpressionDoubled: vi.fn(() => { throw new Error('crit doubling must not roll in endgame lane'); }),
    rollExpressionMaximized: vi.fn(() => { throw new Error('maximize must not roll in endgame lane'); }),
    parseConstant: vi.fn(() => { throw new Error('parseConstant must not run in endgame lane'); }),
  };
});

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(async () => ({ summaryId: 'cs-1' })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
  collectWeaponMastery: vi.fn(),
}));

vi.mock('../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 42 })),
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

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'prompt-1', promise: Promise.resolve({ success: true }) })),
}));

vi.mock('../../combat/conditions/conditionSaveService.js', () => ({
  addCondition: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

const { buildAttackRollDamageSteps } = await import('./attackRollDamageSteps.js');
const { rollExpression, ROLL_TABLE } = await import('../../dice/diceRoller.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { addEntry } = await import('../../ui/logService.js');
const { applyDamageToTarget } = await import('../../rules/combat/applyDamage.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { createSaveListener } = await import('../../automation/common/savePrompt.js');
const { addCondition } = await import('../../combat/conditions/conditionSaveService.js');

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

// Arms the poisoned-weapons feature: dose active, last attack recorded,
// save listener resolving to `saveSucceeds`. Returns the target creature
// so tests can observe HP after the handler runs.
function armPoison({ hit = true, saveSucceeds = false } = {}) {
  const goblin = { name: 'Goblin', currentHp: 30 };
  const lastAttack = {
    hit,
    targetName: 'Goblin',
    damageFormula: '1d8',
    modifier: 2,
    damageType: 'slashing',
    primaryDamageType: 'slashing',
    primaryDamage: 11,
    attackName: 'Poisoned Dagger',
  };
  getRuntimeValue.mockImplementation((_key, prop) => {
    if (prop === 'poisonedWeaponsActive') return true;
    if (prop === 'lastAttack') return lastAttack;
    return null;
  });
  createSaveListener.mockImplementation(() => ({
    promptId: 'prompt-1',
    promise: Promise.resolve({ success: saveSucceeds }),
  }));
  loadCombatSummary.mockResolvedValue({ creatures: [goblin] });
  return goblin;
}

// DC 13 hand-derived once (#815): 8 + max(dex 2, int 1) + prof 3.
const poisonStats = {
  name: 'TestChar',
  abilities: [{ name: 'Dexterity', bonus: 2 }, { name: 'Intelligence', bonus: 1 }],
  automation: { actions: [], passives: [] },
  proficiency: 3,
};

// ── Tests ────────────────────────────────────────────────────────

describe('buildAttackRollDamageSteps — endgame (idx 17 overchannel, idx 18 proceedToDamage)', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    steps = buildAttackRollDamageSteps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('overchannel step (idx 17)', () => {
    it('condition truth table: fires only when active AND useCount > 1', () => {
      const rows = [
        [{ overchannelActive: true, overchannelUseCount: 2 }, true],
        [{ overchannelActive: true, overchannelUseCount: 3 }, true],
        [{ overchannelActive: false, overchannelUseCount: 2 }, false],
        [{ overchannelActive: true, overchannelUseCount: 1 }, false],
        [{ overchannelActive: true, overchannelUseCount: 0 }, false],
        [{ overchannelActive: true, overchannelUseCount: undefined }, false],
      ];
      for (const [ctxOverrides, expected] of rows) {
        expect(steps[17].condition(makeCtx(ctxOverrides))).toBe(expected);
      }
    });

    it('CLA-244 RAW: rolls max(2,useCount)*spellLevel d12, applies exact table total, logs exact entry', async () => {
      // Hand-derived once (#815): useCount 2, lvl 1 → 2*1=2; 2, 2 → 4; 3, 3 → 9.
      const rows = [
        { overchannelUseCount: 2, overchannelSpellLevel: 1, formula: '2d12' },
        { overchannelUseCount: 2, overchannelSpellLevel: 2, formula: '4d12' },
        { overchannelUseCount: 3, overchannelSpellLevel: 3, formula: '9d12' },
      ];
      for (const { formula, ...ctxOverrides } of rows) {
        vi.clearAllMocks();
        const roll = ROLL_TABLE[formula]; // byte→total lookup, never re-parse (#1032)
        const ctx = makeCtx({ overchannelActive: true, ...ctxOverrides });

        const result = await steps[17].handler(ctx);

        expect(rollExpression).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledWith(formula);
        expect(applyDamageToTarget).toHaveBeenCalledWith(
          { summaryId: 'cs-1' },
          'TestChar',
          roll.total,
          ['Necrotic'],
          { campaignName: 'test-campaign', characters: null, ignoreResistance: true, attackerName: 'TestChar' },
        );
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
          type: 'roll',
          characterName: 'TestChar',
          rollType: 'overchannel-damage',
          name: 'Overchannel',
          formula,
          rolls: roll.rolls,
          total: roll.total,
          modifier: 0,
          damageType: 'Necrotic',
          targetName: 'TestChar',
          finalDamage: 42,
          note: 'Overchannel self-damage (ignores resistance/immunity)',
        });
        expect(result).toEqual({ data: {} });
      }
    });

    it('null roll → zero writes, empty data', async () => {
      rollExpression.mockImplementationOnce(() => null);
      const ctx = makeCtx({ overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 1 });

      const result = await steps[17].handler(ctx);

      expect(result).toEqual({ data: {} });
      expect(loadCombatSummary).not.toHaveBeenCalled();
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('proceedToDamage step (idx 18)', () => {
    it('condition truth table: gates on formula != null (0 proceeds; null/undefined withheld)', () => {
      const rows = [
        [{ formula: '1d6' }, true],
        [{ formula: 0 }, true],
        [{ formula: 10 }, true],
        [{}, false],
        [{ formula: null }, false],
      ];
      for (const [ctxOverrides, expected] of rows) {
        expect(steps[18].condition(makeCtx(ctxOverrides))).toBe(expected);
      }
    });

    it('hands off exact payload (incl. critLabels) to proceedWithDamage, returns _done; unarmed → zero save writes', async () => {
      const ctx = makeCtx({
        attack: { name: 'Greataxe', damage: '1d12' },
        formula: '1d12+4',
        total: 16,
        rolls: [12, 4],
        modifier: 4,
        critLabels: 'Natural 20',
      });

      const result = await steps[18].handler(ctx);

      expect(ctx.proceedWithDamage).toHaveBeenCalledWith({
        attack: { name: 'Greataxe', damage: '1d12' },
        formula: '1d12+4',
        total: 16,
        rolls: [12, 4],
        modifier: 4,
        critLabels: 'Natural 20',
        pipelineCtx: ctx,
      });
      expect(result).toEqual({ data: { _done: true } });
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('poison armed, hit, failed save → exact CON prompt (DC 13), dose spent, 2d8 Poison secondary, HP 30→20, Poisoned applied', async () => {
      const goblin = armPoison({ saveSucceeds: false });
      const ctx = makeCtx({
        formula: '1d8+2',
        total: 11,
        rolls: [5, 6],
        modifier: 2,
        playerStats: poisonStats,
      });

      const result = await steps[18].handler(ctx);

      expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 13,
        attackerName: 'TestChar',
        damageFormula: '1d8+2',
        damageType: 'slashing',
        rawDamage: 11,
        sourceName: 'Poisoned Dagger',
      });
      expect(ctx.proceedWithDamage).toHaveBeenCalledTimes(1);
      expect(ctx.autoDamageSecondaryFormula).toBe('2d8');
      expect(ctx.autoDamageSecondaryName).toBe('Poison');
      expect(ctx.autoDamageSecondaryDamageType).toBe('Poison');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', 'poisonedWeaponsActive', null, 'test-campaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', expect.objectContaining({
        secondaryDamage: 10,
        secondaryDamageType: 'Poison',
        actualDamage: 10,
      }), 'test-campaign');
      expect(rollExpression).toHaveBeenCalledTimes(1);
      expect(rollExpression).toHaveBeenCalledWith('2d8');
      expect(goblin.currentHp).toBe(20); // 30 − 10 (2d8 table total, unreduced)
      expect(addCondition).toHaveBeenCalledWith(expect.objectContaining({
        creatureName: 'Goblin',
        conditionDef: { key: 'poisoned', label: 'Poisoned' },
        ability: 'CON',
        dc: 13,
        campaignName: 'test-campaign',
      }));
      expect(addEntry).toHaveBeenNthCalledWith(1, 'test-campaign', {
        type: 'save_result',
        characterName: 'TestChar',
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 13,
        description: 'Poisoned weapon: Goblin must make a DC 13 CON save or take slashing damage plus 2d8 Poison damage and gain the Poisoned condition until the end of your next turn.',
        success: null,
      });
      expect(addEntry).toHaveBeenNthCalledWith(2, 'test-campaign', {
        type: 'ability_use',
        characterName: 'TestChar',
        abilityName: 'Poisoned Weapons',
        description: 'Poison dose triggered on Goblin — target failed CON save (DC 13), took 10 Poison damage (plus 11 slashing damage) and gained Poisoned condition.',
        targetName: 'Goblin',
      });
      expect(ctx.proceedWithDamage.mock.invocationCallOrder[0]).toBeLessThan(addCondition.mock.invocationCallOrder[0]);
      expect(result).toEqual({ data: { _done: true } });
    });

    it('poison armed, hit, saved → dose spent, no secondary damage, no condition, target HP untouched', async () => {
      const goblin = armPoison({ saveSucceeds: true });
      const ctx = makeCtx({ formula: '1d8+2', total: 11, rolls: [5, 6], modifier: 2, playerStats: poisonStats });

      const result = await steps[18].handler(ctx);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestChar', 'poisonedWeaponsActive', null, 'test-campaign');
      expect(ctx.autoDamageSecondaryFormula).toBeUndefined();
      expect(addCondition).not.toHaveBeenCalled();
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(goblin.currentHp).toBe(30);
      expect(result).toEqual({ data: { _done: true } });
    });

    it('poison armed but attack missed → no prompt, zero writes, damage still handed off', async () => {
      armPoison({ hit: false });
      const ctx = makeCtx({ formula: '1d8+2', total: 11, rolls: [5, 6], modifier: 2, playerStats: poisonStats });

      const result = await steps[18].handler(ctx);

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(ctx.proceedWithDamage).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: { _done: true } });
    });
  });
});
