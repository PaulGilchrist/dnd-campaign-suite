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

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isDistanceInRange: vi.fn((dist, rangeFt) => rangeFt == null || dist == null || dist <= rangeFt),
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id', promise: Promise.resolve({ success: true }) })),
}));

// ── Imports ──────────────────────────────────────────────────────

const { buildDamageSteps } = await import('./weaponDamageSteps.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { addEntry } = await import('../../ui/logService.js');
const { collectWeaponMastery } = await import('../../combat/automation/automationService.js');
const { applyMasteryEffect } = await import('../../automation/handlers/combat/weaponMasteryHandler.js');
const { isWithinRange } = await import('../../rules/combat/rangeCheck.js');
const { createSaveListener } = await import('../../automation/common/savePrompt.js');

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

// ── Tests ────────────────────────────────────────────────────────

describe('buildDamageSteps - cleaveMastery, tacticalMaster, toppleMastery, masteryDone', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    steps = buildDamageSteps();
  });

  // ──────────────────────────────────────────────────────────────
  // cleaveMastery (index 15 in the steps array - but actually it's after proceedToDamage)
  // Let's find the correct index
  // ──────────────────────────────────────────────────────────────

  describe('cleaveMastery step', () => {
    let cleaveIdx;

    beforeEach(() => {
      const names = steps.map((s) => s.name);
      cleaveIdx = names.indexOf('cleaveMastery');
    });

    describe('condition', () => {
      it('returns truthy when setSecondaryTargetModal exists and attack and playerStats.automation exist', () => {
        const ctx = makeCtx({
          setSecondaryTargetModal: vi.fn(),
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[cleaveIdx].condition(ctx)).toBeTruthy();
      });

      it('returns false when setSecondaryTargetModal is missing', () => {
        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[cleaveIdx].condition(ctx)).toBeFalsy();
      });

      it('returns false when attack.name is missing', () => {
        const ctx = makeCtx({
          setSecondaryTargetModal: vi.fn(),
          attack: {},
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[cleaveIdx].condition(ctx)).toBeFalsy();
      });

      it('returns false when playerStats.automation is missing', () => {
        const ctx = makeCtx({
          setSecondaryTargetModal: vi.fn(),
          attack: { name: 'Greataxe' },
          playerStats: {},
        });
        expect(steps[cleaveIdx].condition(ctx)).toBeFalsy();
      });
    });

    describe('handler', () => {
      it('returns early when lastAttack did not hit', async () => {
        loadCombatSummary.mockImplementation(() => Promise.resolve({ lastAttack: { hit: false } }));

        const ctx = makeCtx({
          setSecondaryTargetModal: vi.fn(),
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        const result = await steps[cleaveIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when collectWeaponMastery returns null', async () => {
        loadCombatSummary.mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
        collectWeaponMastery.mockReturnValue(null);

        const ctx = makeCtx({
          setSecondaryTargetModal: vi.fn(),
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        const result = await steps[cleaveIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when mastery is not Cleave', async () => {
        loadCombatSummary.mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Push', extraMasteries: [] });

        const ctx = makeCtx({
          setSecondaryTargetModal: vi.fn(),
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        const result = await steps[cleaveIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when no second targets available', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc' },
          creatures: [{ name: 'Orc' }],
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

        const ctx = makeCtx({
          setSecondaryTargetModal: vi.fn(),
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] }, name: 'TestChar' },
        });
        const result = await steps[cleaveIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('prompts for second target selection when targets available (no map)', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' },
          creatures: [
            { name: 'Orc', currentHp: 10, maxHp: 20 },
            { name: 'Goblin', currentHp: 5, maxHp: 7 },
          ],
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

        const setSecondaryTargetModal = vi.fn();
        const ctx = makeCtx({
          setSecondaryTargetModal: setSecondaryTargetModal,
          attack: { name: 'Greataxe' },
          playerStats: {
            automation: { actions: [] },
            name: 'TestChar',
          },
        });
        const result = await steps[cleaveIdx].handler(ctx);

        expect(setSecondaryTargetModal).toHaveBeenCalled();
        expect(result.modal).toEqual({
          type: 'cleaveTargetSelection',
          props: expect.objectContaining({
            title: 'Cleave — Choose Second Target',
          }),
        });
        expect(result.data._cleavePending).toBe(true);
      });

      it('cleave damage formula strips numeric additions from original', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' },
          creatures: [
            { name: 'Orc', currentHp: 10, maxHp: 20 },
            { name: 'Goblin', currentHp: 5, maxHp: 7 },
          ],
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

        const setSecondaryTargetModal = vi.fn();
        const ctx = makeCtx({
          setSecondaryTargetModal: setSecondaryTargetModal,
          attack: { name: 'Greataxe' },
          playerStats: {
            automation: { actions: [] },
            name: 'TestChar',
          },
        });
        await steps[cleaveIdx].handler(ctx);

        expect(ctx._cleaveAttackInfo.damageFormula).toBe('1d12');
      });

      it('calculates second targets with map positions', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc' },
          creatures: [
            { name: 'TestChar', position: { x: 0, y: 0 } },
            { name: 'Orc', position: { x: 0, y: 0 } },
            { name: 'Goblin', position: { x: 3, y: 0 } },
          ],
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === 'currentHitPoints') return 10;
          if (prop === 'hitPoints') return 20;
          return null;
        });

        const setSecondaryTargetModal = vi.fn();
        const ctx = makeCtx({
          setSecondaryTargetModal: setSecondaryTargetModal,
          attack: { name: 'Greataxe' },
          playerStats: {
            automation: { actions: [] },
            name: 'TestChar',
            mapName: 'test-map',
          },
        });
        await steps[cleaveIdx].handler(ctx);

        expect(isWithinRange).toHaveBeenCalled();
      });

      it('resolves HP for player creatures using runtime values', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc' },
          creatures: [
            { name: 'Orc', type: 'player' },
            { name: 'Ally', type: 'player' },
          ],
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === 'currentHitPoints') return 15;
          if (prop === 'hitPoints') return 30;
          return null;
        });

        const setSecondaryTargetModal = vi.fn();
        const ctx = makeCtx({
          setSecondaryTargetModal: setSecondaryTargetModal,
          attack: { name: 'Greataxe' },
          playerStats: {
            automation: { actions: [] },
            name: 'TestChar',
          },
        });
        await steps[cleaveIdx].handler(ctx);

        expect(getRuntimeValue).toHaveBeenCalledWith('Ally', 'currentHitPoints');
        expect(getRuntimeValue).toHaveBeenCalledWith('Ally', 'hitPoints');
      });

      it('resolves HP for non-player creatures using creature properties', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc' },
          creatures: [
            { name: 'Orc' },
            { name: 'Goblin', currentHp: 5, maxHp: 7 },
          ],
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

        const setSecondaryTargetModal = vi.fn();
        const ctx = makeCtx({
          setSecondaryTargetModal: setSecondaryTargetModal,
          attack: { name: 'Greataxe' },
          playerStats: {
            automation: { actions: [] },
            name: 'TestChar',
          },
        });
        await steps[cleaveIdx].handler(ctx);

        expect(setSecondaryTargetModal).toHaveBeenCalled();
      });

      it('stores attack info for cleave secondary attack', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' },
          creatures: [
            { name: 'Orc', currentHp: 10, maxHp: 20 },
            { name: 'Goblin', currentHp: 5, maxHp: 7 },
          ],
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

        const ctx = makeCtx({
          setSecondaryTargetModal: vi.fn(),
          attack: { name: 'Greataxe' },
          playerStats: {
            automation: { actions: [] },
            name: 'TestChar',
          },
        });
        await steps[cleaveIdx].handler(ctx);

        expect(ctx._cleaveAttackInfo.attackName).toBe('Greataxe');
        expect(ctx._cleaveAttackInfo.damageFormula).toBe('1d12');
        expect(ctx._cleaveAttackInfo.damageType).toBe('slashing');
      });

      it('handles onTargetSelected callback hitting', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' },
          creatures: [
            { name: 'Orc' },
            { name: 'Goblin', currentHp: 5, maxHp: 7 },
          ],
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

        const setSecondaryTargetModal = vi.fn();
        const rollDamageMock = vi.fn();
        const ctx = makeCtx({
          setSecondaryTargetModal: setSecondaryTargetModal,
          attack: { name: 'Greataxe' },
          playerStats: {
            automation: { actions: [] },
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
          },
          rollDamage: rollDamageMock,
        });

        await steps[cleaveIdx].handler(ctx);

        // Trigger the callback
        const onTargetSelected = setSecondaryTargetModal.mock.calls[0][0].onTargetSelected;
        await onTargetSelected('Goblin');

        expect(rollDamageMock).toHaveBeenCalled();
      });

      it('handles onTargetSelected callback missing', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' },
          creatures: [
            { name: 'Orc' },
            { name: 'Goblin', currentHp: 5, maxHp: 7 },
          ],
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

        const setSecondaryTargetModal = vi.fn();
        const ctx = makeCtx({
          setSecondaryTargetModal: setSecondaryTargetModal,
          attack: { name: 'Greataxe' },
          playerStats: {
            automation: { actions: [] },
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
          },
        });

        await steps[cleaveIdx].handler(ctx);

        const onTargetSelected = setSecondaryTargetModal.mock.calls[0][0].onTargetSelected;
        await onTargetSelected('Goblin');
        // Should not throw even without rollDamage
      });

      it('logs ability_use for cleave hit', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' },
          creatures: [
            { name: 'Orc' },
            { name: 'Goblin', currentHp: 5, maxHp: 7 },
          ],
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

        const setSecondaryTargetModal = vi.fn();
        const rollDamageMock = vi.fn();
        const ctx = makeCtx({
          setSecondaryTargetModal: setSecondaryTargetModal,
          attack: { name: 'Greataxe' },
          playerStats: {
            automation: { actions: [] },
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
          },
          rollDamage: rollDamageMock,
        });

        await steps[cleaveIdx].handler(ctx);

        const onTargetSelected = setSecondaryTargetModal.mock.calls[0][0].onTargetSelected;
        await onTargetSelected('Goblin');

        expect(addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Cleave',
            targetName: 'Goblin',
          }),
        );
      });

      it('handles onSkip callback (no-op)', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe', damageFormula: '1d12+4', damageType: 'slashing' },
          creatures: [
            { name: 'Orc' },
            { name: 'Goblin', currentHp: 5, maxHp: 7 },
          ],
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

        const setSecondaryTargetModal = vi.fn();
        const ctx = makeCtx({
          setSecondaryTargetModal: setSecondaryTargetModal,
          attack: { name: 'Greataxe' },
          playerStats: {
            automation: { actions: [] },
            name: 'TestChar',
          },
        });

        await steps[cleaveIdx].handler(ctx);

        const onSkip = setSecondaryTargetModal.mock.calls[0][0].onSkip;
        expect(() => onSkip()).not.toThrow();
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // tacticalMaster (index 16)
  // ──────────────────────────────────────────────────────────────

  describe('tacticalMaster step', () => {
    let tacticalIdx;

    beforeEach(() => {
      const names = steps.map((s) => s.name);
      tacticalIdx = names.indexOf('tacticalMaster');
    });

    describe('condition', () => {
      it('returns truthy when attack.name and playerStats.automation exist', () => {
        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[tacticalIdx].condition(ctx)).toBeTruthy();
      });

      it('returns falsy when attack.name is missing', () => {
        const ctx = makeCtx({
          attack: {},
          playerStats: { automation: { actions: [] } },
        });
        expect(steps[tacticalIdx].condition(ctx)).toBeFalsy();
      });

      it('returns falsy when playerStats.automation is missing', () => {
        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {},
        });
        expect(steps[tacticalIdx].condition(ctx)).toBeFalsy();
      });
    });

    describe('handler', () => {
      it('returns early when lastAttack did not hit', async () => {
        loadCombatSummary.mockImplementation(() => Promise.resolve({ lastAttack: { hit: false } }));

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        const result = await steps[tacticalIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when collectWeaponMastery returns null', async () => {
        loadCombatSummary.mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
        collectWeaponMastery.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        const result = await steps[tacticalIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('auto-applies mastery effects when no replace options', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({
          baseMastery: 'Push',
          extraMasteries: ['Sap'],
          replaceMasteryOptions: [],
        });
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        const result = await steps[tacticalIdx].handler(ctx);

        expect(applyMasteryEffect).toHaveBeenCalledWith('Push', expect.anything(), 'test-campaign', 'Orc');
        expect(applyMasteryEffect).toHaveBeenCalledWith('Sap', expect.anything(), 'test-campaign', 'Orc');
        expect(result.data).toEqual({});
      });

      it('skips Graze, Topple, Nick in auto-apply', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({
          baseMastery: 'Graze',
          extraMasteries: ['Topple', 'Nick'],
          replaceMasteryOptions: [],
        });
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        await steps[tacticalIdx].handler(ctx);

        expect(applyMasteryEffect).not.toHaveBeenCalled();
      });

      it('skips mastery when already applied to target', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({
          baseMastery: 'Push',
          extraMasteries: [],
          replaceMasteryOptions: [],
        });
        getRuntimeValue.mockReturnValue('Orc');

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        await steps[tacticalIdx].handler(ctx);

        expect(applyMasteryEffect).not.toHaveBeenCalled();
      });

      it('does not set _Slow_appliedTarget for Slow mastery', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({
          baseMastery: 'Slow',
          extraMasteries: [],
          replaceMasteryOptions: [],
        });
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
        });
        await steps[tacticalIdx].handler(ctx);

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
          'test-campaign',
          '_Slow_appliedTarget',
          'Orc',
          'test-campaign',
        );
      });

      it('prompts for tactical master replacement when options exist', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({
          baseMastery: 'Push',
          replaceMasteryOptions: ['Sap', 'Vex'],
        });

        const setModalState = vi.fn();
        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { automation: { actions: [] } },
          setModalState: setModalState,
        });
        const result = await steps[tacticalIdx].handler(ctx);

        expect(setModalState).toHaveBeenCalled();
        expect(result.modal).toEqual({
          type: 'tacticalMaster',
          props: expect.objectContaining({
            attackName: 'Greataxe',
            baseMastery: 'Push',
            replaceOptions: ['Sap', 'Vex'],
            targetName: 'Orc',
          }),
        });
        expect(result.data._tacticalMasterPending).toBe(true);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // toppleMastery (index 17)
  // ──────────────────────────────────────────────────────────────

  describe('toppleMastery step', () => {
    let toppleIdx;

    beforeEach(() => {
      const names = steps.map((s) => s.name);
      toppleIdx = names.indexOf('toppleMastery');
    });

    describe('condition', () => {
      it('returns truthy when attack.name and playerStats exist', () => {
        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { name: 'TestChar' },
        });
        expect(steps[toppleIdx].condition(ctx)).toBeTruthy();
      });

      it('returns falsy when attack.name is missing', () => {
        const ctx = makeCtx({
          attack: {},
          playerStats: { name: 'TestChar' },
        });
        expect(steps[toppleIdx].condition(ctx)).toBeFalsy();
      });

      it('returns falsy when playerStats is missing', () => {
        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: null,
        });
        expect(steps[toppleIdx].condition(ctx)).toBeFalsy();
      });
    });

    describe('handler', () => {
      it('returns early when lastAttack did not hit', async () => {
        loadCombatSummary.mockImplementation(() => Promise.resolve({ lastAttack: { hit: false } }));

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { name: 'TestChar' },
        });
        const result = await steps[toppleIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when collectWeaponMastery returns null', async () => {
        loadCombatSummary.mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
        collectWeaponMastery.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { name: 'TestChar' },
        });
        const result = await steps[toppleIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when Topple mastery not present', async () => {
        loadCombatSummary.mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Push', extraMasteries: [] });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { name: 'TestChar' },
        });
        const result = await steps[toppleIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('returns early when no target name', async () => {
        loadCombatSummary.mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: { name: 'TestChar' },
        });
        const result = await steps[toppleIdx].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('creates a CON save prompt', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          targetName: 'Orc',
          saveType: 'CON',
          saveDc: 14, // 8 + 3 (STR) + 3 (prof)
        }));
      });

      it('logs a save_triggered entry', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'save_triggered',
            targetName: 'Orc',
            saveType: 'CON',
            saveDc: 14,
          }),
        );
      });

      it('applies prone condition on failed save', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });
        getRuntimeValue.mockReturnValue(null);
        createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Orc',
          'activeConditions',
          expect.arrayContaining(['prone']),
          'test-campaign',
        );
      });

      it('does not apply prone if already prone', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === 'activeConditions') return ['prone'];
          return null;
        });
        createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        // Should not add another prone
        const calls = setRuntimeValue.mock.calls.filter(
          (c) => c[1] === 'activeConditions' && c[0] === 'Orc',
        );
        expect(calls.length).toBe(0);
      });

      it('logs save_result and ability_use entries on failed save', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });
        getRuntimeValue.mockReturnValue(null);
        createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: false }),
        });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'save_result',
            targetName: 'Orc',
            saveType: 'CON',
            success: false,
          }),
        );
        expect(addEntry).toHaveBeenCalledWith(
          'test-campaign',
          expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Topple',
          }),
        );
      });

      it('does nothing on successful save', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });
        getRuntimeValue.mockReturnValue(null);
        createSaveListener.mockReturnValue({
          promptId: 'test-prompt-id',
          promise: Promise.resolve({ success: true }),
        });

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe', abilityName: 'Strength' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
          'Orc',
          'activeConditions',
          expect.arrayContaining(['prone']),
          'test-campaign',
        );
      });

      it('uses weapon abilityName for save DC calculation', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Longbow' },
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { name: 'Longbow' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Dexterity', bonus: 4 }],
            proficiency: 3,
            attacks: [{ name: 'Longbow', abilityName: 'Dexterity' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          saveDc: 15, // 8 + 4 (DEX) + 3 (prof)
        }));
      });

      it('defaults to Strength when weapon attack has no abilityName', async () => {
        loadCombatSummary.mockResolvedValue({
          lastAttack: { hit: true, targetName: 'Orc', attackName: 'Greataxe' },
        });
        collectWeaponMastery.mockReturnValue({ baseMastery: 'Topple', extraMasteries: [] });
        getRuntimeValue.mockReturnValue(null);

        const ctx = makeCtx({
          attack: { name: 'Greataxe' },
          playerStats: {
            name: 'TestChar',
            abilities: [{ name: 'Strength', bonus: 3 }],
            proficiency: 3,
            attacks: [{ name: 'Greataxe' }],
          },
        });
        await steps[toppleIdx].handler(ctx);

        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          saveDc: 14, // 8 + 3 (STR default) + 3 (prof)
        }));
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // masteryDone (index 18)
  // ──────────────────────────────────────────────────────────────

  describe('masteryDone step', () => {
    let masteryDoneIdx;

    beforeEach(() => {
      const names = steps.map((s) => s.name);
      masteryDoneIdx = names.indexOf('masteryDone');
    });

    describe('condition', () => {
      it('always returns true', () => {
        expect(steps[masteryDoneIdx].condition({})).toBe(true);
        expect(steps[masteryDoneIdx].condition({ attack: null })).toBe(true);
      });
    });

    describe('handler', () => {
      it('returns data with _pipelineComplete: true', async () => {
        const result = await steps[masteryDoneIdx].handler({});

        expect(result.data._pipelineComplete).toBe(true);
      });

      it('does not depend on any context values', async () => {
        const result = await steps[masteryDoneIdx].handler({ attack: null, playerStats: null });

        expect(result.data._pipelineComplete).toBe(true);
      });
    });
  });
});
