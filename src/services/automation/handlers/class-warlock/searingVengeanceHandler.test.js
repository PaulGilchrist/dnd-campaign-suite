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
    });
  });

  describe('creature at 0 HP check', () => {
    it('returns a popup when no creatures at 0 HP are in range', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally', type: 'player', currentHp: 10, maxHp: 50 },
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
        ],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures within 60 feet are at 0 HP');
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
    });

    it('excludes the warlock themselves from creature targets', async () => {
      // Warlock is at 0 but is excluded; Ally is at 0 and is the healing target
      mockCreatureHp('Ally', 0);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestWarlock', type: 'player', currentHp: 0, maxHp: 70 },
          { name: 'Ally', type: 'player', currentHp: 0, maxHp: 50 },
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
        ],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.targetName).toBe('Ally');
      // Warlock is excluded from targets (they're the caster)
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
      ]);
    });
  });

  describe('range filtering', () => {
    it('only includes creatures within ally range for 0 HP check', async () => {
      mockCreatureHp('Near Ally', 0);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Near Ally', type: 'player', currentHp: 0, maxHp: 50 },
          { name: 'Far Ally', type: 'player', currentHp: 0, maxHp: 50 },
        ],
      });
      rangeCheck.isWithinRange.mockImplementation(async (source, target) => {
        return target === 'Near Ally';
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.targetName).toBe('Near Ally');
    });

    it('returns popup when all 0 HP creatures are out of range', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Far Ally', type: 'player', currentHp: 0, maxHp: 50 },
        ],
      });
      rangeCheck.isWithinRange.mockResolvedValue(false);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures within 60 feet are at 0 HP');
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
      computedStats: { chaMod: 3 },
    };

    const payload = {
      name: 'Searing Vengeance',
      targetName: 'Ally',
      healAmount: 25,
      selectedTargets: ['Goblin'],
    };

    const result = await confirmSearingVengeance(
      automation,
      playerStats,
      campaignName,
      null,
      [],
      payload
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('12 radiant damage');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWarlock',
      'searingvengeanceUses',
      0,
      campaignName
    );
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      expect.any(Object),
      'Goblin',
      12,
      ['Radiant'],
      campaignName,
      [],
      false,
      'TestWarlock'
    );
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8+3');
    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'TestWarlock',
      'Goblin',
      [{ type: 'condition', condition: 'blinded' }],
      campaignName,
      2
    );
  });

  it('logs ability_use entry', async () => {
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

    await confirmSearingVengeance(
      automation,
      makePlayerStats(),
      campaignName,
      null,
      [],
      payload
    );

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestWarlock',
      abilityName: 'Searing Vengeance',
    }));
  });

  it('logs blinded condition for each target', async () => {
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

    await confirmSearingVengeance(
      automation,
      makePlayerStats(),
      campaignName,
      null,
      [],
      payload
    );

    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'condition',
      characterName: 'Goblin',
      condition: 'blinded',
      source: 'Searing Vengeance',
    }));
  });

  it('skips damage when no targets selected', async () => {
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
      selectedTargets: [],
    };

    const result = await confirmSearingVengeance(
      automation,
      makePlayerStats(),
      campaignName,
      null,
      [],
      payload
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('no creatures selected');
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
  });
});

describe('skipSearingVengeance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('still heals the target and consumes a use', async () => {
    mockRuntimeValues({ searingvengeanceUses: 1 });
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Ally', type: 'player', currentHp: 0, maxHp: 50 },
      ],
    });

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
    expect(result.payload.description).toContain('heals for 25 HP');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWarlock',
      'searingvengeanceUses',
      0,
      campaignName
    );
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Ally',
      'currentHitPoints',
      25,
      campaignName
    );
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Ally',
      'activeConditions',
      [],
      campaignName
    );
    expect(expirations.addExpiration).not.toHaveBeenCalled();
  });
});
