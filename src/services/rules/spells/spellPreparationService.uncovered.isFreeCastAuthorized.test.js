import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Static mocks
// ---------------------------------------------------------------------------

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const setRuntimeValue = vi.fn();
  const getRuntimeValue = vi.fn(() => undefined);
  const clearRuntimeState = vi.fn();
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState };
});

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  addConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Test-data factories
// ---------------------------------------------------------------------------

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    class: { name: 'Wizard' },
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
    hitPoints: 100,
    ...overrides,
  };
}

function makeMetaCtx(overrides = {}) {
  return { slotLevel: 3, ...overrides };
}

function makeCombatSummary(overrides = {}) {
  return {
    creatures: [{ name: 'TestWizard', concentration: null }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { isFreeCastAuthorized } from './spellPreparationService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { prepareSpellCast } from './spellPreparationService.js';

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — uses_expression level-matching
// (featureLevel !== null branch)
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — uses_expression level-matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('returns true for action with uses_expression where featureLevel matches spellLevel and count > 0', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Level Feature',
          spell: 'level 3',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Level_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'SomeSpell', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('returns false for action with uses_expression where featureLevel matches but count is 0', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Level Feature',
          spell: 'level 3',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Level_Feature_freeCastCount') return 0;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'SomeSpell', 3, playerStats, 'camp');
    expect(authorized).toBe(false);
  });

  it('returns false when featureLevel does not match spellLevel', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Level Feature',
          spell: 'level 3',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Level_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'SomeSpell', 5, playerStats, 'camp');
    expect(authorized).toBe(false);
  });

  it('checks bonusActions for uses_expression level-matching', async () => {
    const playerStats = makePlayerStats({
      automation: {
        bonusActions: [{
          type: 'free_spell',
          name: 'Bonus Level Feature',
          spell: 'level 2',
          uses_expression: true,
          usesMax: 3,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bonus_Level_Feature_freeCastCount') return 2;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'SomeSpell', 2, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('skips non-free_spell types in specialActions loop', async () => {
    const playerStats = makePlayerStats({
      automation: {
        specialActions: [
          {
            type: 'other_type',
            name: 'Other Feature',
            spell: 'Fireball',
          },
          {
            type: 'free_spell',
            name: 'Free Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Free_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('checks bonusActions for uses_expression level-matching with count', async () => {
    const playerStats = makePlayerStats({
      automation: {
        bonusActions: [{
          type: 'free_spell',
          name: 'Bonus Level Feature',
          spell: 'level 2',
          uses_expression: true,
          usesMax: 3,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bonus_Level_Feature_freeCastCount') return 2;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'SomeSpell', 2, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('checks specialActions for uses_expression level-matching with count', async () => {
    const playerStats = makePlayerStats({
      automation: {
        specialActions: [{
          type: 'free_spell',
          name: 'Special Level Feature',
          spell: 'level 4',
          uses_expression: true,
          usesMax: 1,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Special_Level_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'SomeSpell', 4, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('checks bonusActions for uses_expression spell-name matching', async () => {
    const playerStats = makePlayerStats({
      automation: {
        bonusActions: [{
          type: 'free_spell',
          name: 'Bonus Spell Feature',
          spell: 'Fireball',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bonus_Spell_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('checks specialActions for uses_expression spell-name matching', async () => {
    const playerStats = makePlayerStats({
      automation: {
        specialActions: [{
          type: 'free_spell',
          name: 'Special Spell Feature',
          spell: 'Fireball',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Special_Spell_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('evaluates MI specialActions loop iteration', async () => {
    const playerStats = makePlayerStats({
      automation: {
        specialActions: [{
          type: 'free_spell',
          name: 'Level Feature',
          spell: 'level 3',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Level_Feature_freeCastCount') return 0;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'SomeSpell', 5, playerStats, 'camp');
    expect(authorized).toBe(false);
  });

  it('checks bonusActions for uses_expression spell-name matching with count', async () => {
    const playerStats = makePlayerStats({
      automation: {
        bonusActions: [{
          type: 'free_spell',
          name: 'Bonus Spell Feature',
          spell: 'Fireball',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bonus_Spell_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('checks actions for uses_expression spell-name matching (lines 69-73)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Action Spell Feature',
          spell: 'Fireball',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Action_Spell_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('checks specialActions for uses_expression spell-name matching with count', async () => {
    const playerStats = makePlayerStats({
      automation: {
        specialActions: [{
          type: 'free_spell',
          name: 'Special Spell Feature',
          spell: 'Fireball',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Special_Spell_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('checks specialActions perSpellTracking path (FT-070 per-spell counter)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        specialActions: [{
          type: 'free_spell',
          name: 'PerSpell Feature',
          spell: 'Fireball',
          uses: 1,
          recharge: 'long_rest',
          perSpellTracking: true,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_PerSpell_Feature_Fireball_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('checks specialActions shared freeCast array path', async () => {
    const playerStats = makePlayerStats({
      automation: {
        specialActions: [{
          type: 'free_spell',
          name: 'Shared Feature',
          spell: 'Fireball',
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Shared_Feature_freeCast') return ['Fireball', 'Lightning Bolt'];
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('checks bonusActions perSpellTracking path (FT-070 per-spell counter)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        bonusActions: [{
          type: 'free_spell',
          name: 'Bonus PerSpell Feature',
          spell: 'Fireball',
          uses: 1,
          recharge: 'long_rest',
          perSpellTracking: true,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bonus_PerSpell_Feature_Fireball_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('checks bonusActions shared freeCast array path', async () => {
    const playerStats = makePlayerStats({
      automation: {
        bonusActions: [{
          type: 'free_spell',
          name: 'Bonus Shared Feature',
          spell: 'Fireball',
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bonus_Shared_Feature_freeCast') return ['Fireball'];
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('skips non-free_spell types in bonusActions loop', async () => {
    const playerStats = makePlayerStats({
      automation: {
        bonusActions: [
          {
            type: 'other_type',
            name: 'Other Feature',
            spell: 'Fireball',
          },
          {
            type: 'free_spell',
            name: 'Bonus Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bonus_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('skips non-free_spell types in specialActions loop', async () => {
    const playerStats = makePlayerStats({
      automation: {
        specialActions: [
          {
            type: 'other_type',
            name: 'Other Feature',
            spell: 'Fireball',
          },
          {
            type: 'free_spell',
            name: 'Special Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Special_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('skips to next action when featureLevel does not match in bonusActions (line 125)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        bonusActions: [
          {
            type: 'free_spell',
            name: 'Level 3 Feature',
            spell: 'level 3',
            uses_expression: true,
            usesMax: 2,
          },
          {
            type: 'free_spell',
            name: 'Bonus Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bonus_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 5, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('skips perSpellTracking when spell does not match (line 88)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [
          {
            type: 'free_spell',
            name: 'PerSpell Feature',
            spell: 'Lightning Bolt',
            perSpellTracking: true,
          },
          {
            type: 'free_spell',
            name: 'Bonus Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bonus_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('skips perSpellTracking when spell does not match in bonusActions (line 137)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        bonusActions: [
          {
            type: 'free_spell',
            name: 'Bonus PerSpell Feature',
            spell: 'Lightning Bolt',
            perSpellTracking: true,
          },
          {
            type: 'free_spell',
            name: 'Bonus Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bonus_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('skips perSpellTracking when spell does not match in specialActions (line 187)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        specialActions: [
          {
            type: 'free_spell',
            name: 'Special PerSpell Feature',
            spell: 'Lightning Bolt',
            perSpellTracking: true,
          },
          {
            type: 'free_spell',
            name: 'Special Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Special_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('skips non-free_spell types in incrementFreeCastResource', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [
          {
            type: 'other_type',
            name: 'Other Feature',
            spell: 'Fireball',
          },
          {
            type: 'free_spell',
            name: 'Free Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: 'long_rest',
            perSpellTracking: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Free_Feature_Fireball_freeCastCount') return 0;
      return undefined;
    });

    const { incrementFreeCastResource } = await import('./spellPreparationService.js');
    incrementFreeCastResource('TestWizard', 'Fireball', 3, playerStats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Free_Feature_Fireball_freeCastCount', 1, 'test-campaign');
  });

  it('skips non-free_spell types in decrementFreeCastResource via prepareSpellCast', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [
          {
            type: 'other_type',
            name: 'Other Feature',
            spell: 'Fireball',
          },
          {
            type: 'free_spell',
            name: 'Free Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: 'long_rest',
            perSpellTracking: true,
          },
        ],
      },
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Free_Feature_Fireball_freeCastCount', 0, 'test-campaign');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestWizard', 'spell_slots_level_3', expect.anything(), 'test-campaign');
  });

  it('skips non-matching spells in incrementFreeCastResource (line 403)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [
          {
            type: 'free_spell',
            name: 'Spell Feature',
            spell: 'Lightning Bolt',
          },
          {
            type: 'free_spell',
            name: 'Free Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: 'long_rest',
            perSpellTracking: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Free_Feature_Fireball_freeCastCount') return 0;
      return undefined;
    });

    const { incrementFreeCastResource } = await import('./spellPreparationService.js');
    incrementFreeCastResource('TestWizard', 'Fireball', 3, playerStats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Free_Feature_Fireball_freeCastCount', 1, 'test-campaign');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestWizard', '_Spell_Feature_freeCastCount', expect.anything(), 'test-campaign');
  });

  it('calls cleanupBuffsByName when casting Spiritual Weapon with WGB', async () => {
    getRuntimeValue.mockImplementation((_key1, key2, _key3) => {
      if (key2 === '_War_Gods_Blessing_active') return true;
      if (key2 === 'spell_slots_level_2') return 1;
      if (key2 === 'activeBuffs') {
        return [{ name: 'Shield of Faith' }, { name: 'Other Buff' }];
      }
      return undefined;
    });

    const cs = makeCombatSummary({
      creatures: [
        { name: 'TestWizard', concentration: null },
      ],
    });
    getCombatSummary.mockReturnValue(cs);

    const spell = makeSpell({ name: 'Spiritual Weapon', level: 2, concentration: true });
    await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'activeBuffs', [{ name: 'Other Buff' }], 'test-campaign');
  });
});
