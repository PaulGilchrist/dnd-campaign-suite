import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn((r) => {
    if (typeof r === 'number') return r;
    const m = String(r).match(/(\d+)_?ft/);
    return m ? parseInt(m[1], 10) : null;
  }),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn().mockResolvedValue({
    attackEvent: null,
    attackerName: null,
    targetName: null,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  }),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((abilities, ability) => {
    const ab = abilities?.find(a => a.name === ability);
    return ab?.bonus ?? 0;
  }),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

import { handle } from './beguilingTwistHandler.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWarlock',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Beguiling Twist',
    automation: { type: 'beguiling_twist', range: '120_ft', ...automation },
  };
}

describe('beguilingTwistHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('no recent save found', () => {
    it('should return popup when no recent save for self (self target)', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent successful save found');
    });

    it('should return popup when no recent save for allies', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent successful save found');
    });
  });

  describe('self target', () => {
    it('should find recent successful attack roll for self', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-self' });

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('WIS saving throw');
    });



    it('should skip failed attack rolls', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: false, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
      });

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No recent successful save found');
    });
  });

  describe('different creature target', () => {
    it('should find recent save from ally within range', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Ally1' },
        attackerName: 'Ally1',
        targetName: 'Ally1',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-ally' });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player' },
          { name: 'TestWarlock', type: 'player' },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe('Ally1');
    });
  });

  describe('save DC calculation', () => {
    it('should calculate save DC as 8 + CHA bonus + proficiency', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-dc' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestWarlock',
        saveType: 'WIS',
        saveDc: 15, // 8 + 3 + 4
      });
    });

    it('should use custom condition from automation', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-cond' });

      await handle(
        makeAction({ target: 'self', condition: 'charmed' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestWarlock',
        saveType: 'WIS',
        saveDc: 15,
      });
    });
  });

  describe('save listener', () => {
    it('should create save listener with WIS save', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-listener' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveType: 'WIS',
      }));
    });

    it('should add event listener for save-result', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-event' });

      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(addEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
      addEventListenerSpy.mockRestore();
    });
  });

  describe('range resolution', () => {
    it('should convert range string to feet', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      rangeToFeet.mockReturnValue(120);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-range-conv' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(rangeToFeet).toHaveBeenCalledWith('120_ft');
    });
  });
});
