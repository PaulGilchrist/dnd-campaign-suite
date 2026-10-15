// @maintained-by-ai
// starryFormArrowHandler: Archer-gated Luminous Arrow launch.
// Deterministic seam: activeBuffs gate → buildStarryFormLuminousArrow →
// target resolution (turnOrder → campaign lastAttack → null) → log → attack_roll.
// Owns handler orchestration only; starryFormDamage.test.js owns attack construction,
// starryFormHandler.test.js owns constellation application, targetEffectDefinitions.test.js owns registry internals.
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

const campaignName = 'test-campaign';
const playerName = 'TestSorcerer';

const archerBuff = { name: 'Starry Form', effect: 'starry_form', constellation: 'Archer' };

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

// Keyed runtime router: activeBuffs and lastAttack resolved independently.
function mockRuntime({ buffs = [archerBuff], lastAttack = null } = {}) {
  getRuntimeValue.mockImplementation((_caster, key) => {
    if (key === 'activeBuffs') return buffs;
    if (key === 'lastAttack') return lastAttack;
    return null;
  });
}

describe('starryFormArrowHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildStarryFormLuminousArrow.mockReturnValue(defaultAttack);
    getCombatSummary.mockReturnValue({ creatures: [], turnOrder: [] });
    mockRuntime();
  });

  describe('target resolution', () => {
    it('returns attack_roll with turn-order target and logs the ability use', async () => {
      getCombatSummary.mockReturnValue({
        creatures: [{ name: playerName }, { name: 'Orc1' }],
        turnOrder: [{ name: playerName, targetName: 'Orc1' }],
      });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result).toEqual({
        type: 'attack_roll',
        payload: {
          attack: defaultAttack,
          targetName: 'Orc1',
          sourceName: action.name,
        },
      });
      expect(buildStarryFormLuminousArrow).toHaveBeenCalledWith(
        expect.objectContaining({ name: playerName }),
        expect.arrayContaining([expect.objectContaining({ constellation: 'Archer' })]),
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: playerName,
          abilityName: action.name,
          description: `${playerName} fired a Starry Form Luminous Arrow at Orc1.`,
        }),
      );
    });

    it('falls back to lastAttack when current actor in turnOrder has no targetName', async () => {
      getCombatSummary.mockReturnValue({
        creatures: [{ name: playerName }],
        turnOrder: [{ name: playerName }],
      });
      mockRuntime({ lastAttack: { targetName: 'Goblin' } });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBe('Goblin');
    });

    it('falls back to lastAttack when combat summary is null', async () => {
      getCombatSummary.mockReturnValue(null);
      mockRuntime({ lastAttack: { targetName: 'Goblin' } });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBe('Goblin');
    });

    it('falls back to lastAttack when current actor is not in turnOrder', async () => {
      getCombatSummary.mockReturnValue({
        creatures: [{ name: 'OtherPlayer' }],
        turnOrder: [{ name: 'OtherPlayer', targetName: 'SomethingElse' }],
      });
      mockRuntime({ lastAttack: { targetName: 'Goblin' } });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBe('Goblin');
    });

    it('returns null targetName when no target is available anywhere', async () => {
      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.targetName).toBeNull();
    });
  });

  describe('Archer constellation gate', () => {
    it('returns automation_info popup and logs nothing when a non-Archer constellation is active', async () => {
      mockRuntime({ buffs: [{ name: 'Starry Form', effect: 'starry_form', constellation: 'Chalice' }] });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: action.name,
          description: 'Starry Form (Archer constellation) is not active.',
          automation: action.automation,
        },
      });
      expect(buildStarryFormLuminousArrow).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when activeBuffs is invalid or empty', async () => {
      mockRuntime({ buffs: null });

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Starry Form (Archer constellation) is not active.');
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns popup and logs nothing when buildStarryFormLuminousArrow returns null despite Archer buff', async () => {
      buildStarryFormLuminousArrow.mockReturnValue(null);

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No Archer constellation active.');
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('log failure', () => {
    it('still returns attack_roll when addEntry rejects', async () => {
      addEntry.mockRejectedValueOnce(new Error('Log write failed'));

      const result = await handle(action, makePlayerStats(), campaignName);

      expect(result.type).toBe('attack_roll');
      expect(result.payload.attack).toBe(defaultAttack);
      expect(result.payload.targetName).toBeNull();
    });
  });
});
