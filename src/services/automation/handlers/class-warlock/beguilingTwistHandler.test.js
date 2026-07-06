// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './beguilingTwistHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

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
  findLastAttack: vi.fn(),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'TestMap';
const playerName = 'TestWarlock';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
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

function makeHitAttack(targetName, attackerName = 'Goblin') {
  return {
    attackEvent: { hit: true, timestamp: Date.now(), targetName },
    attackerName,
    targetName,
    primaryDamage: 5,
    secondaryDamage: 0,
    totalDamage: 5,
    damageTypes: ['Piercing'],
  };
}

function makeMissAttack(targetName, attackerName = 'Goblin') {
  return {
    attackEvent: { hit: false, timestamp: Date.now(), targetName },
    attackerName,
    targetName,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
  };
}

function dispatchSaveResult(promptId, success) {
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: { promptId, success },
  }));
}

function defaultHitResult() {
  return makeHitAttack(playerName);
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
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Ally1', type: 'player' },
        { name: playerName, type: 'player' },
      ],
    });
  });

  describe('no recent successful save', () => {
    it('should return popup when no attack event exists', async () => {
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

    it('should return popup when attack missed', async () => {
      findLastAttack.mockResolvedValue(makeMissAttack(playerName));

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent successful save found');
    });

    it('should return popup when attack hit someone else', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('OtherPlayer'));

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No recent successful save found');
    });
  });

  describe('self target with successful save', () => {
    it('should trigger WIS save prompt for self', async () => {
      findLastAttack.mockResolvedValue(defaultHitResult());
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'self-prompt' });

      const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.targetName).toBe(playerName);
      expect(result.payload.description).toContain('WIS saving throw');
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: playerName,
        saveType: 'WIS',
        saveDc: 15,
      });
    });

    it('should use custom or default feature name from action', async () => {
      findLastAttack.mockResolvedValue(defaultHitResult());
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'custom-name-prompt' });

      const customResult = await handle(
        { name: 'My Feature', automation: { type: 'beguiling_twist', range: '120_ft', target: 'self' } },
        makePlayerStats(),
        campaignName,
        null,
      );
      expect(customResult.payload.name).toBe('My Feature');

      vi.clearAllMocks();
      findLastAttack.mockResolvedValue(defaultHitResult());
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'default-name-prompt' });

      const defaultResult = await handle(
        { automation: { type: 'beguiling_twist', range: '120_ft', target: 'self' } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(defaultResult.payload.name).toBe('Beguiling Twist');
    });

    it('should add ability_use log entry with promptId', async () => {
      findLastAttack.mockResolvedValue(defaultHitResult());
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'log-prompt' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Beguiling Twist',
        promptId: 'log-prompt',
      }));
    });
  });

  describe('different creature target', () => {
    it('should trigger save for ally when ally made recent successful attack', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'Ally1'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'ally-prompt' });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe('Ally1');
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Ally1',
        saveType: 'WIS',
        saveDc: 15,
      });
    });

    it('should skip when attacker is the player themselves', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', playerName));

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toContain('No recent successful save found');
    });

    it('should skip when ally is out of range', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'Ally1'));
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 50, gridY: 50 },
      });
      getDistanceFeet.mockReturnValue(268);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toContain('No recent successful save found');
    });

    it('should proceed when map positions are unavailable', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'Ally1'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'no-positions-prompt' });
      resolveMapPositions.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe('Ally1');
    });

    it('should proceed when no mapName provided', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'Ally1'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'no-map-prompt' });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe('Ally1');
    });
  });

  describe('different creature - additional logic paths', () => {
    it('should return error popup when combat context has no creatures', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'Ally1'));
      getCombatContext.mockResolvedValueOnce({
        creatures: [{ name: 'Ally1', type: 'player' }, { name: playerName, type: 'player' }],
      });
      getCombatContext.mockResolvedValueOnce({});

      const result = await handle(
        makeAction({ target: 'different_creature' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Cannot determine targets');
    });

    it('should return error popup when ally is the only creature (no other creatures available)', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'Ally1'));
      getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Ally1', type: 'player' }],
      });

      const result = await handle(
        makeAction({ target: 'different_creature' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no other creatures are available');
      expect(result.payload.description).toContain('Ally1');
    });

    it('should select first other creature when multiple creatures exist', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'Ally1'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'multi-creature-prompt' });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player' },
          { name: 'Ally2', type: 'player' },
          { name: playerName, type: 'player' },
        ],
      });

      const result = await handle(
        makeAction({ target: 'different_creature' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe('Ally2');
      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Ally2',
        saveType: 'WIS',
        saveDc: 15,
      });
    });

    it('should use player as other creature when player is not the one who saved', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'Ally1'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'player-other-prompt' });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player' },
          { name: playerName, type: 'player' },
        ],
      });

      const result = await handle(
        makeAction({ target: 'different_creature' }),
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.targetName).toBe(playerName);
    });
  });

  describe('save DC calculation', () => {
    it('should calculate DC as 8 + CHA bonus + proficiency', async () => {
      findLastAttack.mockResolvedValue(defaultHitResult());
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'dc-prompt' });

      await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveDc: 15,
      }));
    });

    it('should use custom proficiency and CHA modifier from stats', async () => {
      findLastAttack.mockResolvedValue(defaultHitResult());
      getAbilityModifier.mockReturnValue(5);
      createSaveListener.mockReturnValue({ promptId: 'prof-prompt' });

      await handle(makeAction({ target: 'self' }), { ...makePlayerStats(), proficiency: 6 }, campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveDc: 19,
      }));

      vi.clearAllMocks();
      findLastAttack.mockResolvedValue(defaultHitResult());
      getAbilityModifier.mockReturnValue(1);
      createSaveListener.mockReturnValue({ promptId: 'cha-prompt' });

      await handle(
        makeAction({ target: 'self' }),
        { ...makePlayerStats(), abilities: [{ name: 'Charisma', bonus: 1 }] },
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveDc: 13,
      }));
    });

    it('should default proficiency to 0 if missing', async () => {
      findLastAttack.mockResolvedValue(defaultHitResult());
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'no-prof-prompt' });

      await handle(
        makeAction({ target: 'self' }),
        { ...makePlayerStats(), proficiency: undefined },
        campaignName,
        null,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        saveDc: 11,
      }));
    });
  });

  describe('log entries', () => {
    it('should log ability_use with target name in description for different creature', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'Ally1'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'diff-log-prompt' });
      resolveMapPositions.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        description: expect.stringContaining('Ally1 must make WIS save'),
      }));
    });

    it('should include automation object in popup payload', async () => {
      findLastAttack.mockResolvedValue(defaultHitResult());
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'auto-payload-prompt' });

      const result = await handle(makeAction({ target: 'self', range: '60_ft' }), makePlayerStats(), campaignName, null);

      expect(result.payload.automation).toEqual(expect.objectContaining({
        type: 'beguiling_twist',
        range: '60_ft',
        target: 'self',
      }));
    });
  });

  describe('different creature save failure', () => {
    it('should apply condition to the ally who made the save', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'Ally1'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'ally-fail-prompt' });
      getRuntimeValue.mockReturnValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      dispatchSaveResult('ally-fail-prompt', false);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Ally1',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
    });

    it('should apply expiration to the player on ally save failure', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'Ally1'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'ally-exp-prompt' });

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      dispatchSaveResult('ally-exp-prompt', false);

      expect(addExpiration).toHaveBeenCalledWith(
        playerName,
        'Ally1',
        [{ type: 'condition', condition: 'charmed' }],
        campaignName,
        60,
      );
    });
  });

  describe('undefined target defaults to ally path', () => {
    it('should use first other creature when automation.target is undefined', async () => {
      findLastAttack.mockResolvedValue(makeHitAttack(playerName, 'Goblin'));
      getAbilityModifier.mockReturnValue(3);
      createSaveListener.mockReturnValue({ promptId: 'undef-target-prompt' });
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster' },
          { name: playerName, type: 'player' },
        ],
      });

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
