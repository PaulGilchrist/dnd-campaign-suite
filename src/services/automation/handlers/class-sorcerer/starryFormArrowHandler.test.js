import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './starryFormArrowHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { buildStarryFormLuminousArrow } from '../../../rules/core/starryFormDamage.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/core/starryFormDamage.js', () => ({
  buildStarryFormLuminousArrow: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

const campaignName = 'TestCampaign';
const playerName = 'TestDruid';

function makePlayerStats(overrides = {}) {
  return {
    name: playerName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
    ...overrides,
  };
}

const action = {
  name: 'Starry Form: Luminous Arrow',
  automation: { type: 'starry_form_arrow' },
};

const defaultAttack = {
  name: 'Starry Form: Luminous Arrow',
  toHit: 8,
  damage: { damage_dice: '2d8', damage_type: 'Radiant' },
};

describe('starryFormArrowHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildStarryFormLuminousArrow.mockReturnValue(defaultAttack);
    getCombatSummary.mockReturnValue({ creatures: [], turnOrder: [] });
    getRuntimeValue.mockReturnValue(null);
  });

  describe('Archer constellation active', () => {
    it('should return attack_roll with target from turn order when available', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }];
        return null;
      });
      getCombatSummary.mockReturnValue({
        creatures: [{ name: playerName }, { name: 'Orc1' }],
        turnOrder: [{ name: playerName, targetName: 'Orc1' }],
      });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBe('Orc1');
      expect(result.payload.attack).toBe(defaultAttack);
      expect(result.payload.sourceName).toBe(action.name);
      expect(buildStarryFormLuminousArrow).toHaveBeenCalledWith(
        expect.objectContaining({ name: playerName }),
        expect.arrayContaining([expect.objectContaining({ constellation: 'Archer' })]),
      );
      expect(addEntry).toHaveBeenCalled();
    });

    it('should fall back to lastAttack when turn order provides no target', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }];
        if (key === 'lastAttack') return { targetName: 'Orc1' };
        return null;
      });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBe('Orc1');
    });

    it('should return attack_roll with null targetName when no target is available anywhere', async () => {
      getRuntimeValue.mockReturnValue([{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }]);

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBeNull();
    });
  });

  describe('Archer constellation not active', () => {
    it('should return popup with automation info when Archer constellation is not active', async () => {
      getRuntimeValue.mockReturnValue([{ name: 'Starry Form', effect: 'starry_form', constellation: 'Chalice' }]);

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(action.name);
      expect(result.payload.description).toBe('Starry Form (Archer constellation) is not active.');
      expect(result.payload.automation).toEqual(action.automation);
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('should return popup when activeBuffs is invalid or empty', async () => {
      getRuntimeValue.mockReturnValue(null);

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Starry Form (Archer constellation) is not active.');
    });
  });

  describe('buildStarryFormLuminousArrow returns null', () => {
    it('should return popup when buildStarryFormLuminousArrow returns null despite Archer buff being present', async () => {
      getRuntimeValue.mockReturnValue([{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }]);
      buildStarryFormLuminousArrow.mockReturnValue(null);

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Archer constellation active.');
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('combat summary edge cases', () => {
    it('should fall back to lastAttack when combat summary is null', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }];
        if (key === 'lastAttack') return { targetName: 'Goblin' };
        return null;
      });
      getCombatSummary.mockReturnValue(null);

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBe('Goblin');
    });

    it('should fall back to lastAttack when turnOrder is empty', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }];
        if (key === 'lastAttack') return { targetName: 'Goblin' };
        return null;
      });
      getCombatSummary.mockReturnValue({ creatures: [], turnOrder: [] });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBe('Goblin');
    });

    it('should fall back to lastAttack when current actor is not in turnOrder', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === 'activeBuffs') return [{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }];
        if (key === 'lastAttack') return { targetName: 'Goblin' };
        return null;
      });
      getCombatSummary.mockReturnValue({
        creatures: [{ name: 'OtherPlayer' }],
        turnOrder: [{ name: 'OtherPlayer', targetName: 'SomethingElse' }],
      });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBe('Goblin');
    });

    it('should return null targetName when combat summary has no turnOrder property', async () => {
      getRuntimeValue.mockReturnValue([{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }]);
      getCombatSummary.mockReturnValue({ creatures: [] });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBeNull();
    });
  });

  describe('addEntry failure', () => {
    it('should still return attack_roll when addEntry rejects', async () => {
      getRuntimeValue.mockReturnValue([{ name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' }]);
      addEntry.mockRejectedValue(new Error('Log write failed'));

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBeNull();
    });
  });
});
