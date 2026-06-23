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
import { rangeToFeet, getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { addEntry } from '../../../ui/logService.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

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

function dispatchSaveResult(promptId, success) {
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: { promptId, success },
  }));
}

describe('beguilingTwistHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findLastAttack.mockResolvedValue({
      attackEvent: null,
      attackerName: null,
      targetName: null,
      primaryDamage: 0,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });
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
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No recent successful save found');
      expect(result.payload.description).toContain('Charmed or Frightened');
    });

    it('should return popup when attack event exists but target does not match player', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'OtherPlayer' },
        attackerName: 'Goblin',
        targetName: 'OtherPlayer',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent successful save found');
    });

    it('should return popup when attack hit is false for self', async () => {
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

    it('should return popup when no attack event at all', async () => {
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
      expect(result.payload.targetName).toBe('TestWarlock');
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

    it('should skip when targetName does not match player', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Ally1' },
        attackerName: 'Goblin',
        targetName: 'Ally1',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No recent successful save found');
    });

    it('should use custom feature name from action', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-custom-name' });

      const result = await handle(
        { name: 'My Custom Feature', automation: { type: 'beguiling_twist', range: '120_ft', target: 'self' } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.name).toBe('My Custom Feature');
    });

    it('should default feature name to Beguiling Twist', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-default-name' });

      const result = await handle(
        { automation: { type: 'beguiling_twist', range: '120_ft', target: 'self' } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.name).toBe('Beguiling Twist');
    });
  });

  describe('different creature target', () => {
    it('should find recent save from ally within range', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Goblin' },
        attackerName: 'Ally1',
        targetName: 'Goblin',
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

    it('should skip when attacker is the player themselves', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Goblin' },
        attackerName: 'TestWarlock',
        targetName: 'Goblin',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toContain('No recent successful save found');
    });

    it('should proceed when ally is within range', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Goblin' },
        attackerName: 'Ally1',
        targetName: 'Goblin',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-in-range' });
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 5, gridY: 5 },
      });
      getDistanceFeet.mockReturnValue(20);
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

    it('should skip ally save if distance exceeds range', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Goblin' },
        attackerName: 'Ally1',
        targetName: 'Goblin',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 50, gridY: 50 },
      });
      getDistanceFeet.mockReturnValue(268);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player' },
          { name: 'TestWarlock', type: 'player' },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toContain('No recent successful save found');
    });

    it('should proceed when no map positions available (range check skipped)', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Goblin' },
        attackerName: 'Ally1',
        targetName: 'Goblin',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-no-positions' });
      resolveMapPositions.mockResolvedValue(null);
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

    it('should proceed when no mapName provided (range check skipped)', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Goblin' },
        attackerName: 'Ally1',
        targetName: 'Goblin',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-no-map' });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player' },
          { name: 'TestWarlock', type: 'player' },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

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
        saveDc: 15,
      });
    });

    it('should use player proficiency from stats', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(5);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-dc-prof' });

      await handle(
        makeAction({ target: 'self' }),
        { ...makePlayerStats(), proficiency: 6 },
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestWarlock',
        saveType: 'WIS',
        saveDc: 19,
      });
    });

    it('should use CHA ability modifier from player stats', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'TestWarlock' },
        attackerName: 'Goblin',
        targetName: 'TestWarlock',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(1);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-dc-cha' });

      await handle(
        makeAction({ target: 'self' }),
        { ...makePlayerStats(), abilities: [{ name: 'Charisma', bonus: 1 }] },
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestWarlock',
        saveType: 'WIS',
        saveDc: 13,
      });
    });

    it('should default proficiency to 0 if missing', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-dc-no-prof' });

      await handle(
        makeAction({ target: 'self' }),
        { ...makePlayerStats(), proficiency: undefined },
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'TestWarlock',
        saveType: 'WIS',
        saveDc: 11,
      });
    });
  });

  describe('save listener setup', () => {
    it('should create save listener with WIS save type', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-wis' });

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

    it('should call resolveMapPositions when differentCreature with map', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Goblin' },
        attackerName: 'Ally1',
        targetName: 'Goblin',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-map' });
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 2, gridY: 2 },
      });
      getDistanceFeet.mockReturnValue(5);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player' },
          { name: 'TestWarlock', type: 'player' },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, 'TestWarlock');
    });
  });

  describe('log entries', () => {
    it('should add ability_use log entry on success', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-log' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestWarlock',
        abilityName: 'Beguiling Twist',
        description: expect.stringContaining('TestWarlock used Beguiling Twist'),
        promptId: 'beguiling-log',
      }));
    });

    it('should include promptId in ability_use log entry', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-prompt-id' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        promptId: 'beguiling-prompt-id',
      }));
    });

    it('should include target name in ability_use description for different creature', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Goblin' },
        attackerName: 'Ally1',
        targetName: 'Goblin',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-diff-log' });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player' },
          { name: 'TestWarlock', type: 'player' },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('Ally1 must make WIS save'),
      }));
    });
  });

  describe('range resolution', () => {
    it('should convert default range string to feet', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-range-default' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(rangeToFeet).toHaveBeenCalledWith('120_ft');
    });

    it('should use custom range from automation', async () => {
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
      rangeToFeet.mockReturnValue(60);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-range-custom' });

      await handle(
        makeAction({ target: 'self', range: '60_ft' }),
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(rangeToFeet).toHaveBeenCalledWith('60_ft');
    });

    it('should default range to 120_ft when missing', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-range-missing' });

      await handle(
        makeAction({ target: 'self' }),
        { ...makePlayerStats(), automation: { type: 'beguiling_twist' } },
        campaignName,
        null,
      );

      expect(rangeToFeet).toHaveBeenCalledWith('120_ft');
    });
  });

  describe('target name in popup', () => {
    it('should include targetName in popup payload for self', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-popup-self' });

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.payload.targetName).toBe('TestWarlock');
    });

    it('should include targetName in popup payload for different creature', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Goblin' },
        attackerName: 'Ally1',
        targetName: 'Goblin',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-popup-ally' });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player' },
          { name: 'TestWarlock', type: 'player' },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.targetName).toBe('Ally1');
    });
  });

  describe('automation info popup type', () => {
    it('should always return popup type with automation_info payload', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-popup-type' });

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.automation).toEqual(expect.objectContaining({
        type: 'beguiling_twist',
      }));
    });

    it('should include automation object in popup payload', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-automation-payload' });

      const result = await handle(makeAction({ target: 'self', range: '60_ft' }), makePlayerStats(), campaignName, null);

      expect(result.payload.automation).toEqual(expect.objectContaining({
        type: 'beguiling_twist',
        range: '60_ft',
        target: 'self',
      }));
    });
  });

  describe('edge cases', () => {
    it('should handle when getRuntimeValue returns null for activeConditions on save failure', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-null-conds' });
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      dispatchSaveResult('beguiling-null-conds', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('should handle when getRuntimeValue returns non-array for activeConditions on save failure', async () => {
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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-nonarray-conds' });
      getRuntimeValue.mockReturnValue('not-an-array');

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      dispatchSaveResult('beguiling-nonarray-conds', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestWarlock',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('should use different creature name in save listener for differentCreature target', async () => {
      findLastAttack.mockResolvedValue({
        attackEvent: { hit: true, timestamp: Date.now(), targetName: 'Goblin' },
        attackerName: 'Ally1',
        targetName: 'Goblin',
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
      });
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'beguiling-diff-target' });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player' },
          { name: 'TestWarlock', type: 'player' },
        ],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Ally1',
        saveType: 'WIS',
        saveDc: 15,
      });
    });

    it('should handle auto.target as undefined (defaults to ally save path)', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: 'TestWarlock', type: 'player' },
        ],
      });

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
      createSaveListener.mockReturnValue({ promptId: 'beguiling-undef-target' });

      const result = await handle(
        { name: 'Beguiling Twist', automation: { type: 'beguiling_twist', range: '120_ft' } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe('Goblin');
    });
  });
});
