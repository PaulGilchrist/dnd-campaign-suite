// @maintained-by-ai
// SEARING VENGEANCE HANDLE/SKIP LANE (quad file 3/4). Canonical home of:
// - handle() routing: exhausted-uses popup, no-combat popup (the handle() twin —
//   ConfirmPath owns the at-confirm one), 0 HP gate table (alive / dead-flagged /
//   out-of-range each popup, no use consumed), modal-open payload shape.
// - use consumption at confirm: searingvengeanceUses 1→0 pin. The '2d8+3'
//   rollExpression pin here is use-consumption smoke only — ConfirmPath is the
//   canonical CHA resolution table authority.
// - blinded expiration fanout: full-args addExpiration pin (ConfirmPath pins
//   counts only).
// - skip/refusal flow: declined reaction — no heal, no damage, no roll, no use.
// - range filtering keyed by target name (the heal lane owns the source-keyed
//   caster-vs-healed-target gate).
// Absorbed from the deleted NpcPath sibling: NPC heal-target + burst exclusion.
// RAW self-inclusion (warlock themselves at 0 HP as heal target) stays here.
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

vi.mock('../../../dice/diceRoller.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, rollExpression: vi.fn() }
});

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
  useRuntimeState.getRuntimeValue.mockImplementation((_subject, key) => {
    if (key === 'searingvengeanceUses') return values.searingvengeanceUses;
    if (key === 'currentHitPoints') return values.currentHitPoints ?? null;
    return null;
  });
}

function mockCreatureHp(creatureName, hp) {
  useRuntimeState.getRuntimeValue.mockImplementation((subject, key) => {
    if (key === 'searingvengeanceUses') return 1;
    if (key === 'currentHitPoints' && subject === creatureName) return hp;
    return null;
  });
}

describe('searingVengeanceHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a popup when uses have been exhausted', async () => {
    mockRuntimeValues({ searingvengeanceUses: 0 });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Searing Vengeance');
    expect(result.payload.description).toBe('Searing Vengeance has no uses remaining. Must finish a Long Rest to regain.');
    expect(result.payload.automation).toEqual(makeAction().automation);
    // exhausted-use popup short-circuits before any combat read
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
  });

  it('returns a popup when no combat is active', async () => {
    mockRuntimeValues({ searingvengeanceUses: 1 });
    damageUtils.getCombatContext.mockResolvedValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('No combat active.');
    expect(result.payload.automation).toEqual(makeAction().automation);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  describe('creature at 0 HP check', () => {
    it.each([
      {
        label: 'no creatures are at 0 HP',
        creatures: [
          { name: 'Ally', type: 'player', currentHp: 10, maxHp: 50 },
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
        ],
        deadName: null,
        runtimeHp: null,
        inRange: true,
      },
      {
        label: 'the only creature at 0 HP is dead',
        creatures: [
          { name: 'Ally', type: 'player', currentHp: 0, maxHp: 50 },
        ],
        deadName: 'Ally',
        runtimeHp: null,
        inRange: true,
      },
      {
        label: 'all 0 HP creatures are out of range',
        creatures: [
          { name: 'Far Ally', type: 'player', currentHp: 0, maxHp: 50 },
        ],
        deadName: null,
        runtimeHp: 0,
        inRange: false,
      },
    ])('returns a popup when $label and consumes no use', async ({ creatures, deadName, runtimeHp, inRange }) => {
      useRuntimeState.getRuntimeValue.mockImplementation((subject, key) => {
        if (key === 'searingvengeanceUses') return 1;
        if (key === 'isDead') return subject === deadName ? 1 : null;
        if (key === 'currentHitPoints') return runtimeHp;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({ creatures });
      rangeCheck.isWithinRange.mockResolvedValue(inRange);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('No creatures within 60 feet are at 0 HP.');
      // routing popup must not consume the use or touch the board
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns a modal when a creature at 0 HP is found (NPC heal target, absorbed from NpcPath lane)', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally', type: 'npc', currentHp: 0, maxHp: 50 },
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
        ],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('searingVengeance');
      expect(result.payload.targetName).toBe('Ally');
      expect(result.payload.healAmount).toBe(25);
      // healed NPC target excluded from its own burst
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
      mockCreatureHp('Near Ally', 0);
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Near Ally', type: 'player', currentHp: 0, maxHp: 50 },
          { name: 'Far Ally', type: 'player', currentHp: 0, maxHp: 50 },
          { name: 'Near Goblin', type: 'npc', currentHp: 5, maxHp: 20 },
          { name: 'Far Goblin', type: 'npc', currentHp: 10, maxHp: 30 },
        ],
      });
      rangeCheck.isWithinRange.mockImplementation(async (_source, target) => {
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
    // use-consumption smoke — ConfirmPath owns the canonical CHA table pins
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8+3');
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'TestWarlock',
      'searingvengeanceUses',
      0,
      campaignName
    );
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
    // quad-canonical full-args expiration pin (ConfirmPath pins counts only)
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
    expect(result.payload.description).toBe('TestWarlock declined Searing Vengeance — no use expended.');
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      description: expect.stringContaining('no use expended'),
    }));
  });
});
