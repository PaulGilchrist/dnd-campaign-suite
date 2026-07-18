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
const { getAttackRiderOptions, getAttackRiderOptionsByContext } = await import('../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');
const { loadCombatSummary } = await import('../../encounters/combatData.js');

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

describe('buildAttackRollDamageSteps', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadCombatSummary).mockImplementation(() => Promise.resolve({ lastAttack: { hit: true } }));
    steps = buildAttackRollDamageSteps();
  });

  describe('structure', () => {
    it('returns an array of steps', () => {
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
    });

    it('has 23 steps', () => {
      expect(steps).toHaveLength(23);
    });

    it('has steps with correct names in order', () => {
      const names = steps.map((s) => s.name);
      expect(names).toEqual([
        'housekeeping',
        'attackRiderManeuvers',
        'cunningStrike',
        'bardicInspirationOffense',
        'rollBaseDamage',
        'buildContext',
        'sneakAttack',
        'twoWeaponFighting',
        'targetEffects',
        'superiorityDieBonuses',
        'automationBonuses',
        'weaponHitBonuses',
        'natural20Bonuses',
        'celestialRevelation',
        'featureRiders',
        'damageTypeModifiers',
        'overchannel',
        'proceedToDamage',
        'stalkersFlurryPostDamage',
        'cleaveMastery',
        'tacticalMaster',
        'toppleMastery',
        'masteryDone',
      ]);
    });

    it('has correct subscribe/emit chain', () => {
      const expectedChain = [
        { sub: 'housekeeping:do', emit: 'maneuvers:check' },
        { sub: 'maneuvers:check', emit: 'maneuvers:handled' },
        { sub: 'maneuvers:handled', emit: 'cunning:checked' },
        { sub: 'cunning:checked', emit: 'bi:checked' },
        { sub: 'bi:checked', emit: 'damage:rolled' },
        { sub: 'damage:rolled', emit: 'context:built' },
        { sub: 'context:built', emit: 'sneak:applied' },
        { sub: 'sneak:applied', emit: 'twf:applied' },
        { sub: 'twf:applied', emit: 'effects:applied' },
        { sub: 'effects:applied', emit: 'superiority:applied' },
        { sub: 'superiority:applied', emit: 'automation:applied' },
        { sub: 'automation:applied', emit: 'weapon_hit:applied' },
        { sub: 'weapon_hit:applied', emit: 'n20:applied' },
        { sub: 'n20:applied', emit: 'celestial:applied' },
        { sub: 'celestial:applied', emit: 'riders:applied' },
        { sub: 'riders:applied', emit: 'dmg_type:modified' },
        { sub: 'dmg_type:modified', emit: 'damage:ready' },
        { sub: 'damage:ready', emit: 'damage:applied' },
      ];

      for (let i = 0; i < expectedChain.length; i++) {
        expect(steps[i].subscribe).toBe(expectedChain[i].sub);
        expect(steps[i].emit).toBe(expectedChain[i].emit);
      }
    });

    it('has masteryDone step subscribing to cleave:done (cleaveDone -> tacticalDone -> masteryDone chain)', () => {
      const names = steps.map((s) => s.name);
      const cleaveIdx = names.indexOf('cleaveMastery');
      const tacticalIdx = names.indexOf('tacticalMaster');
      const toppleIdx = names.indexOf('toppleMastery');
      const masteryDoneIdx = names.indexOf('masteryDone');

      expect(cleaveIdx).toBeGreaterThan(0);
      expect(tacticalIdx).toBeGreaterThan(cleaveIdx);
      expect(toppleIdx).toBeGreaterThan(tacticalIdx);
      expect(masteryDoneIdx).toBeGreaterThan(toppleIdx);

      expect(steps[cleaveIdx].emit).toBe('cleave:done');
      expect(steps[tacticalIdx].subscribe).toBe('cleave:done');
      expect(steps[tacticalIdx].emit).toBe('tactical:done');
      expect(steps[toppleIdx].subscribe).toBe('tactical:done');
      expect(steps[toppleIdx].emit).toBe('mastery:done');
      expect(steps[masteryDoneIdx].subscribe).toBe('mastery:done');
      expect(steps[masteryDoneIdx].emit).toBe('pipeline:complete');
    });
  });

  describe('housekeeping step', () => {
    describe('condition', () => {
      it('always returns true', () => {
        expect(steps[0].condition({})).toBe(true);
        expect(steps[0].condition({ attack: null })).toBe(true);
        expect(steps[0].condition({ attack: { type: 'Bonus Action' } })).toBe(true);
      });
    });

    describe('handler', () => {
      it('returns data with isBonusActionAttack for bonus action', async () => {
        const ctx = makeCtx({ attack: { type: 'Bonus Action' } });
        const result = await steps[0].handler(ctx);
        expect(result.data.isBonusActionAttack).toBe(true);
      });

      it('returns data with isBonusActionAttack false for non-bonus action', async () => {
        const ctx = makeCtx({ attack: { type: 'Action' } });
        const result = await steps[0].handler(ctx);
        expect(result.data.isBonusActionAttack).toBe(false);
      });

      it('returns data with isBonusActionAttack false when no attack', async () => {
        const ctx = makeCtx();
        const result = await steps[0].handler(ctx);
        expect(result.data.isBonusActionAttack).toBe(false);
      });

      it('clears pendingSuddenStrike for bonus action attacks', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === 'pendingSuddenStrike') return true;
          return null;
        });

        const ctx = makeCtx({ attack: { type: 'Bonus Action' } });
        await steps[0].handler(ctx);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          'pendingSuddenStrike',
          null,
          'test-campaign',
        );
      });

      it('clears pendingSuddenStrike for all attacks', async () => {
        getRuntimeValue.mockReturnValue(null);
        const ctx = makeCtx({ attack: { type: 'Action' } });
        await steps[0].handler(ctx);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          'pendingSuddenStrike',
          null,
          'test-campaign',
        );
      });

      it('marks Hunter\'s Prey used round for Horde Breaker bonus action', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === "_Hunter's_Prey_choice") return 'Horde Breaker';
          return null;
        });

        const ctx = makeCtx({ attack: { name: 'Horde Breaker', type: 'Bonus Action' } });
        await steps[0].handler(ctx);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestChar',
          '_Hunters_Prey_HordeBreaker_UsedRound',
          1,
          'test-campaign',
        );
      });

      it('does not mark Hunter\'s Prey for non-bonus action Horde Breaker', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === "_Hunter's_Prey_choice") return 'Horde Breaker';
          return null;
        });

        const ctx = makeCtx({ attack: { name: 'Horde Breaker', type: 'Action' } });
        await steps[0].handler(ctx);

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
          'TestChar',
          '_Hunters_Prey_HordeBreaker_UsedRound',
          expect.any(Number),
          'test-campaign',
        );
      });

      it('does not mark Hunter\'s Prey when choice is not Horde Breaker', async () => {
        getRuntimeValue.mockImplementation((_key, prop, _campaign) => {
          if (prop === "_Hunter's_Prey_choice") return 'Other Feature';
          return null;
        });

        const ctx = makeCtx({ attack: { name: 'Horde Breaker', type: 'Bonus Action' } });
        await steps[0].handler(ctx);

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
          'TestChar',
          '_Hunters_Prey_HordeBreaker_UsedRound',
          expect.any(Number),
          'test-campaign',
        );
      });
    });
  });

  describe('attackRiderManeuvers step', () => {
    describe('condition', () => {
      it('returns true when ctx.setAttackRiderManeuverPrompt exists', () => {
        const ctx = makeCtx({ setAttackRiderManeuverPrompt: vi.fn() });
        expect(steps[1].condition(ctx)).toBe(true);
      });

      it('returns false when ctx.setAttackRiderManeuverPrompt is missing', () => {
        const ctx = makeCtx();
        expect(steps[1].condition(ctx)).toBe(false);
      });
    });

    describe('handler - hit', () => {
      it('prompts for maneuvers when attack hits and maneuvers available', async () => {
        const maneuverList = [{ name: 'Pushing Attack' }];
        getAttackRiderOptions.mockResolvedValue(maneuverList);

        const ctx = makeCtx({
          setAttackRiderManeuverPrompt: vi.fn(),
          attack: { weaponType: 'melee' },
          targetName: 'Orc',
          popupHtml: { hit: true },
        });

        const result = await steps[1].handler(ctx);

        expect(getAttackRiderOptions).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'TestChar' }),
          'test-campaign',
          expect.objectContaining({
            weaponType: 'melee',
            targetName: 'Orc',
          }),
        );
        expect(ctx.setAttackRiderManeuverPrompt).toHaveBeenCalledWith({
          maneuvers: maneuverList,
          attack: { weaponType: 'melee' },
          popupHtml: { hit: true },
        });
        expect(result).toEqual({
          modal: {
            type: 'attackRiderManeuver',
            props: { maneuvers: maneuverList, attack: { weaponType: 'melee' }, popupHtml: { hit: true } },
          },
        });
      });

      it('handles crit hits the same as regular hits', async () => {
        const maneuverList = [{ name: 'Trip Attack' }];
        getAttackRiderOptions.mockResolvedValue(maneuverList);

        const ctx = makeCtx({
          setAttackRiderManeuverPrompt: vi.fn(),
          attack: { weaponType: 'ranged' },
          popupHtml: { isCrit: true },
        });

        const result = await steps[1].handler(ctx);

        expect(result).toEqual({
          modal: {
            type: 'attackRiderManeuver',
            props: { maneuvers: maneuverList, attack: { weaponType: 'ranged' }, popupHtml: { isCrit: true } },
          },
        });
      });

      it('returns data when no maneuvers available on hit', async () => {
        getAttackRiderOptions.mockResolvedValue([]);

        const ctx = makeCtx({
          setAttackRiderManeuverPrompt: vi.fn(),
          attack: { weaponType: 'melee' },
          popupHtml: { hit: true },
        });

        const result = await steps[1].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('does not prompt for maneuvers when attack misses', async () => {
        const ctx = makeCtx({
          setAttackRiderManeuverPrompt: vi.fn(),
          attack: { weaponType: 'melee' },
          popupHtml: { hit: false },
        });

        const result = await steps[1].handler(ctx);

        expect(getAttackRiderOptions).not.toHaveBeenCalled();
        expect(result.data).toEqual({});
      });
    });

    describe('handler - miss', () => {
      it('prompts for miss maneuvers when attack misses and maneuvers available', async () => {
        const maneuverList = [{ name: 'Menacing Attack' }];
        getAttackRiderOptionsByContext.mockResolvedValue(maneuverList);

        const ctx = makeCtx({
          setAttackRiderManeuverPrompt: vi.fn(),
          attack: { weaponType: 'melee' },
          popupHtml: { hit: false },
        });

        const result = await steps[1].handler(ctx);

        expect(getAttackRiderOptionsByContext).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'TestChar' }),
          'test-campaign',
          expect.objectContaining({
            weaponType: 'melee',
            isUnarmedStrike: false,
            targetName: undefined,
          }),
          'miss',
        );
        expect(ctx.setAttackRiderManeuverPrompt).toHaveBeenCalledWith({
          maneuvers: maneuverList,
          attack: { weaponType: 'melee' },
          popupHtml: { hit: false },
          isMiss: true,
        });
        expect(result).toEqual({
          modal: {
            type: 'attackRiderManeuver',
            props: { maneuvers: maneuverList, attack: { weaponType: 'melee' }, popupHtml: { hit: false }, isMiss: true },
          },
        });
      });

      it('does not prompt for miss maneuvers on crit', async () => {
        const ctx = makeCtx({
          setAttackRiderManeuverPrompt: vi.fn(),
          popupHtml: { hit: false, isCrit: true },
        });

        const result = await steps[1].handler(ctx);

        expect(getAttackRiderOptionsByContext).not.toHaveBeenCalled();
        expect(result.data).toEqual({});
      });

      it('returns data when no miss maneuvers available', async () => {
        getAttackRiderOptionsByContext.mockResolvedValue([]);

        const ctx = makeCtx({
          setAttackRiderManeuverPrompt: vi.fn(),
          attack: { weaponType: 'melee' },
          popupHtml: { hit: false },
        });

        const result = await steps[1].handler(ctx);

        expect(result.data).toEqual({});
      });

      it('sets isUnarmedStrike when weaponType is unarmed', async () => {
        const maneuverList = [];
        getAttackRiderOptionsByContext.mockResolvedValue(maneuverList);

        const ctx = makeCtx({
          setAttackRiderManeuverPrompt: vi.fn(),
          attack: { weaponType: 'unarmed' },
          popupHtml: { hit: false },
        });

        await steps[1].handler(ctx);

        expect(getAttackRiderOptionsByContext).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({ isUnarmedStrike: true }),
          'miss',
        );
      });
    });
  });

  describe('cunningStrike step', () => {
    describe('condition', () => {
      it('returns true when ctx.hit is true', () => {
        const ctx = makeCtx({ hit: true });
        expect(steps[2].condition(ctx)).toBe(true);
      });

      it('returns false when ctx.hit is false', () => {
        const ctx = makeCtx({ hit: false });
        expect(steps[2].condition(ctx)).toBe(false);
      });

      it('returns falsy when ctx.hit is undefined', () => {
        const ctx = makeCtx();
        expect(steps[2].condition(ctx)).toBeFalsy();
      });
    });

    describe('handler - no sneak attack', () => {
      it('returns sneakDice 0 when buildResult has no sneakAttackDice', async () => {

        const ctx = makeCtx({
          hit: true,
          buildCtx: vi.fn(async () => ({})),
        });

        const result = await steps[2].handler(ctx);

        expect(result.data.sneakDice).toBe(0);
      });

      it('returns sneakDice 0 when lastAttack did not hit', async () => {
        loadCombatSummary.mockImplementation(() => Promise.resolve({ lastAttack: { hit: false } }));

        const ctx = makeCtx({ hit: true });

        const result = await steps[2].handler(ctx);

        expect(result.data.sneakDice).toBe(0);
      });

      it('returns sneakDice 0 when lastAttack isCrit true', async () => {
        loadCombatSummary.mockImplementation(() => Promise.resolve({ lastAttack: { isCrit: true } }));

        const ctx = makeCtx({ hit: true });

        const result = await steps[2].handler(ctx);

        expect(result.data.sneakDice).toBe(0);
      });
    });
  });
});
