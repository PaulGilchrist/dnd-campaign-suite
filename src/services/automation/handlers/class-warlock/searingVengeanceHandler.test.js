// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(() => ({ actualHeal: 25, oldHp: 0, newHp: 25, maxHp: 50 })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(async () => {}),
}));

import { handle, confirmSearingVengeance, skipSearingVengeance } from './searingVengeanceHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import * as expirations from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWarlock',
    level: 14,
    hitPoints: { max: 70 },
    currentHitPoints: 50,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Searing Vengeance',
    automation: {
      healExpression: 'floor(target_max_hp / 2)',
      damageExpression: '2d8 + CHA modifier',
      damageType: 'Radiant',
      range: '30_ft',
      condition: 'blinded',
      conditionDuration: 'until_end_of_current_turn',
      uses: 1,
      usesMax: 1,
      recharge: 'long_rest',
      casting_time: '1 reaction',
      trigger: 'death_save_by_ally_or_self',
      allyRange: '60_ft',
      ...automation,
    },
  };
}

function mockRuntimeValues(values) {
  useRuntimeState.getRuntimeValue.mockImplementation((_subject, key, _campaign) => {
    if (key === 'searingvengeanceUses') return values.searingvengeanceUses;
    if (key === 'targetEffects') return values.targetEffects;
    if (key === 'currentHitPoints') return values.currentHitPoints;
    if (key === 'hitPoints') return values.hitPoints;
    return null;
  });
}

function mockCreatureHp(creatureName, hp) {
  useRuntimeState.getRuntimeValue.mockImplementation((_subject, key, _campaign) => {
    if (key === 'searingvengeanceUses') return 1;
    if (key === 'targetEffects') return [];
    if (key === 'currentHitPoints' && _subject === creatureName) return hp;
    if (key === 'hitPoints') return null;
    return null;
  });
}

describe('searingVengeanceHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resource validation', () => {
    it('returns a popup when uses have been exhausted', async () => {
      mockRuntimeValues({ searingvengeanceUses: 0 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Searing Vengeance');
      expect(result.payload.description).toContain('has no uses remaining');
      expect(result.payload.description).toContain('Long Rest');
      expect(result.payload.automation).toEqual(makeAction().automation);
    });
  });

  describe('combat context', () => {
    it('returns a popup when no combat is active', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No combat active.');
      expect(result.payload.automation).toEqual(makeAction().automation);
    });
  });

  describe('creature at 0 HP check', () => {
    it('returns a popup when no creatures at 0 HP are available', async () => {
      const scenarios = [
        {
          name: 'no creatures at 0 HP',
          creatures: [
            { name: 'Ally', type: 'player', currentHp: 10, maxHp: 50 },
            { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
          ],
          mockHp: null,
          rangeMock: true,
        },
        {
          name: 'only creature at 0 HP is dead',
          creatures: [
            { name: 'Ally', type: 'player', currentHp: 0, maxHp: 50 },
          ],
          mockHp: 'Ally',
          mockDead: true,
          rangeMock: true,
        },
        {
          name: 'all 0 HP creatures are out of range',
          creatures: [
            { name: 'Far Ally', type: 'player', currentHp: 0, maxHp: 50 },
          ],
          mockHp: 'Far Ally',
          rangeMock: false,
        },
      ];

      for (const scenario of scenarios) {
        vi.clearAllMocks();

        if (scenario.mockHp) {
          mockCreatureHp(scenario.mockHp, 0);
          if (scenario.mockDead) {
            useRuntimeState.getRuntimeValue.mockImplementation((subject, key, _campaign) => {
              if (key === 'searingvengeanceUses') return 1;
              if (key === 'isDead' && subject === scenario.mockHp) return 1;
              return null;
            });
          }
        } else {
          mockRuntimeValues({ searingvengeanceUses: 1 });
        }

        damageUtils.getCombatContext.mockResolvedValue({ creatures: scenario.creatures });

        if (typeof scenario.rangeMock === 'boolean') {
          rangeCheck.isWithinRange.mockResolvedValue(scenario.rangeMock);
        }

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('No creatures within 60 feet are at 0 HP');
      }
    });

    it('returns a modal when a creature at 0 HP is found', async () => {
      mockCreatureHp('Ally', 0);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally', type: 'player', currentHp: 0, maxHp: 50 },
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
        ],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('searingVengeance');
      expect(result.payload.targetName).toBe('Ally');
      expect(result.payload.healAmount).toBe(25);
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
      ]);
      expect(result.payload.automation).toEqual(makeAction().automation);
    });

    it('excludes warlock and healed target from burst creature targets', async () => {
      mockCreatureHp('Ally', 0);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally', type: 'player', currentHp: 0, maxHp: 50 },
          { name: 'TestWarlock', type: 'player', currentHp: 50, maxHp: 70 },
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
        ],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.targetName).toBe('Ally');
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
      ]);
    });

    it('includes the warlock themselves as a 0 HP heal target (RAW: you or ally)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((subject, key, _campaign) => {
        if (key === 'searingvengeanceUses') return 1;
        if (key === 'currentHitPoints' && subject === 'TestWarlock') return 0;
        if (key === 'hitPoints' && subject === 'TestWarlock') return 70;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestWarlock', type: 'player', currentHp: 1, maxHp: 1 },
          { name: 'Ally', type: 'player', currentHp: 30, maxHp: 50 },
        ],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.targetName).toBe('TestWarlock');
      expect(result.payload.healAmount).toBe(35);
      // healed target (self) excluded from burst, ally remains a valid burst target
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Ally', type: 'player', currentHp: 30, maxHp: 50 },
      ]);
    });
  });

  describe('range filtering', () => {
    it('filters creatures by ally range and attack range', async () => {
      vi.clearAllMocks();
      mockCreatureHp('Near Ally', 0);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Near Ally', type: 'player', currentHp: 0, maxHp: 50 },
          { name: 'Far Ally', type: 'player', currentHp: 0, maxHp: 50 },
          { name: 'Near Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
          { name: 'Far Goblin', type: 'npc', currentHp: 10, maxHp: 30 },
        ],
      });
      rangeCheck.isWithinRange.mockImplementation(async (source, target) => {
        if (target === 'Near Ally') return true;
        if (target === 'Near Goblin') return true;
        return false;
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.targetName).toBe('Near Ally');
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Near Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
      ]);
    });
  });
});

describe('confirmSearingVengeance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consumes a use and applies damage to selected targets', async () => {
    mockRuntimeValues({ searingvengeanceUses: 1 });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 },
      ],
    });
    diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [6, 6] });
    applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 12 });

    const automation = {
      damageExpression: '2d8 + CHA modifier',
      damageType: 'Radiant',
      usesMax: 1,
    };

    const playerStats = {
      ...makePlayerStats(),
      abilities: [{ name: 'Charisma', bonus: 3 }],
    };

    const payload = {
      name: 'Searing Vengeance',
      targetName: 'Ally',
      healAmount: 25,
      selectedTargets: ['Goblin'],
    };

    const result = await confirmSearingVengeance({
          automation,
          playerStats,
          campaignName,
          mapName: null,
          characters: [],
          payload,
      });

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('12 radiant damage');
    expect(result.payload.description).toContain('regains 25 HP');
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8+3');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWarlock',
      'searingvengeanceUses',
      0,
      campaignName
    );
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestWarlock', targetName: 'Goblin', effects: [{ type: 'condition', condition: 'blinded' }], campaignName, rounds: 1 });
  });

  it('logs ability_use entry with heal and burst amounts', async () => {
    mockRuntimeValues({ searingvengeanceUses: 1 });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 },
      ],
    });
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [5, 5] });
    applyDamage.applyDamageToTarget.mockReturnValue({ finalDamage: 10 });

    const automation = {
      damageExpression: '2d8 + CHA modifier',
      damageType: 'Radiant',
      usesMax: 1,
    };

    const payload = {
      name: 'Searing Vengeance',
      targetName: 'Ally',
      healAmount: 25,
      selectedTargets: ['Goblin'],
    };

    await confirmSearingVengeance({
          automation,
          playerStats: makePlayerStats(),
          campaignName,
          mapName: null,
          characters: [],
          payload,
      });

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestWarlock',
      abilityName: 'Searing Vengeance',
    }));
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      description: expect.stringContaining('healed for 25 HP'),
    }));
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      description: expect.stringContaining('10 radiant damage'),
    }));
  });

  it('declining (skip) heals nothing and consumes no use', async () => {
    mockRuntimeValues({ searingvengeanceUses: 1 });

    const automation = {
      damageExpression: '2d8 + CHA modifier',
      damageType: 'Radiant',
      usesMax: 1,
    };

    const payload = {
      name: 'Searing Vengeance',
      targetName: 'Ally',
      healAmount: 25,
    };

    const result = await skipSearingVengeance(
      automation,
      makePlayerStats(),
      campaignName,
      payload
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('declined');
    expect(result.payload.description).toContain('no use expended');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      description: expect.stringContaining('no use expended'),
    }));
  });
});
