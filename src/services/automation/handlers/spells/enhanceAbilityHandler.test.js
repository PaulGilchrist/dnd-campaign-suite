// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { handle, applyEnhanceAbility, ENHANCE_ABILITY_ABILITIES } from './enhanceAbilityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 5,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Enhance Ability',
    spell: { name: 'Enhance Ability', level: 2, casting_time: 'Action' },
    automation: { type: 'enhance_ability', range: 'Touch', ...automation },
  };
}

describe('enhanceAbilityHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue({});
  });

  describe('ENHANCE_ABILITY_ABILITIES', () => {
    it('exposes the five eligible abilities without Constitution', () => {
      const values = ENHANCE_ABILITY_ABILITIES.map(a => a.value);
      expect(values).toEqual(['STR', 'DEX', 'INT', 'WIS', 'CHA']);
      expect(values).not.toContain('CON');
    });
  });

  describe('handle', () => {
    it('returns target selection payload with all creatures', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster' },
          { name: 'Goblin' },
          { name: 'Wolf' },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('enhance_ability_target_selection');
      expect(result.payload.creatureTargets).toEqual(['TestCaster', 'Goblin', 'Wolf']);
      expect(result.payload.abilities).toEqual(ENHANCE_ABILITY_ABILITIES);
      expect(result.payload.range).toBe('Touch');
    });

    it('returns popup when no combat context', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No combat context');
    });

    it('uses automation range when provided', async () => {
      getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestCaster' }] });

      const result = await handle(makeAction({ range: '30 feet' }), makePlayerStats(), campaignName, null);

      expect(result.payload.range).toBe('30 feet');
    });
  });

  describe('applyEnhanceAbility', () => {
    it('returns null when no targets or ability provided', async () => {
      const result = await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: [],
    ability: 'STR',
});
      expect(result).toBeNull();

      const result2 = await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: ['Wolf'],
    ability: null,
});
      expect(result2).toBeNull();
    });

    it('adds enhance_ability targetEffect with concentration duration', async () => {
      getRuntimeValue.mockReturnValue([]);

      await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: ['Wolf'],
    ability: 'STR',
});

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [expect.objectContaining({
          target: 'Wolf',
          effect: 'enhance_ability',
          source: 'TestCaster',
          ability: 'STR',
          duration: 'concentration',
        })],
        campaignName,
      );
    });

    it('replaces existing enhance_ability effect for the same target/source', async () => {
      getRuntimeValue.mockReturnValue([
        { target: 'Wolf', effect: 'enhance_ability', source: 'TestCaster', ability: 'DEX', duration: 'concentration' },
      ]);

      await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: ['Wolf'],
    ability: 'WIS',
});

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'targetEffects',
        [expect.objectContaining({ ability: 'WIS' })],
        campaignName,
      );
    });

    it('preserves unrelated targetEffects', async () => {
      const existing = [
        { target: 'Goblin', effect: 'bane_penalty', source: 'TestCaster' },
      ];
      getRuntimeValue.mockReturnValue(existing);

      await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: ['Wolf'],
    ability: 'INT',
});

      const effects = setRuntimeValue.mock.calls[0][2];
      expect(effects).toHaveLength(2);
      expect(effects[0]).toEqual(existing[0]);
    });

    it('logs ability_use entry with ability label', async () => {
      getRuntimeValue.mockReturnValue([]);

      await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: ['Wolf'],
    ability: 'CHA',
});

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Enhance Ability',
          targetName: 'Wolf',
          description: expect.stringContaining('Charisma'),
        }),
      );
    });

    it('returns automation_info popup with outcome', async () => {
      getRuntimeValue.mockReturnValue([]);

      const result = await applyEnhanceAbility({
    action: makeAction(),
    playerStats: makePlayerStats(),
    campaignName,
    mapName: null,
    targetNames: ['Wolf'],
    ability: 'STR',
});

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Wolf');
    });
  });
});
