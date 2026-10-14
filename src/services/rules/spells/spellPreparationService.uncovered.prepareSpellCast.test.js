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

import { prepareSpellCast } from './spellPreparationService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// ---------------------------------------------------------------------------
// prepareSpellCast — Warlock slot substitution (getWarlockSlotLevel)
// ---------------------------------------------------------------------------

describe('prepareSpellCast — Warlock slot substitution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
    getCombatSummary.mockReturnValue(null);
  });

  it('uses Warlock slot substitution when normal slots exhausted', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'spell_slots_level_2') return 0;
      if (key2 === 'spell_slots_level_3') return 1;
      return undefined;
    });

    const warlockStats = makePlayerStats({
      name: 'TestWarlock',
      class: { name: 'Warlock' },
      spellAbilities: {
        spellCastingAbility: 'Charisma',
        toHit: 9,
        saveDc: 15,
        modifier: 4,
        spell_slots_level_2: 2,
        spell_slots_level_3: 2,
      },
      automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
    });
    const spell = makeSpell({ name: 'Fireball', level: 2 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWarlock',
      playerStats: warlockStats,
      campaignName: 'test-campaign',
    });

    expect(result.slotConsumed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'spell_slots_level_3', 0, 'test-campaign');
  });

  it('does not use warlock slot substitution when matching level has slots', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'spell_slots_level_2') return 1;
      if (key2 === 'spell_slots_level_3') return 1;
      return undefined;
    });

    const warlockStats = makePlayerStats({
      name: 'TestWarlock',
      class: { name: 'Warlock' },
      spellAbilities: {
        spellCastingAbility: 'Charisma',
        toHit: 9,
        saveDc: 15,
        modifier: 4,
        spell_slots_level_2: 2,
        spell_slots_level_3: 2,
      },
      automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
    });
    const spell = makeSpell({ name: 'Fireball', level: 2 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWarlock',
      playerStats: warlockStats,
      campaignName: 'test-campaign',
    });

    expect(result.slotConsumed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWarlock', 'spell_slots_level_2', 0, 'test-campaign');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestWarlock', 'spell_slots_level_3', 0, 'test-campaign');
  });

  it('does not substitute when all warlock slots are exhausted', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'spell_slots_level_1' || key2 === 'spell_slots_level_2' || key2 === 'spell_slots_level_3') return 0;
      return undefined;
    });

    const warlockStats = makePlayerStats({
      name: 'TestWarlock',
      class: { name: 'Warlock' },
      spellAbilities: {
        spellCastingAbility: 'Charisma',
        toHit: 9,
        saveDc: 15,
        modifier: 4,
        spell_slots_level_1: 2,
        spell_slots_level_2: 2,
        spell_slots_level_3: 2,
      },
      automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
    });
    const spell = makeSpell({ name: 'Fireball', level: 2 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWarlock',
      playerStats: warlockStats,
      campaignName: 'test-campaign',
    });

    expect(result.slotConsumed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// prepareSpellCast — War God's Blessing Spiritual Weapon cleanup
// ---------------------------------------------------------------------------

describe('prepareSpellCast — WGB Spiritual Weapon cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
    getCombatSummary.mockReturnValue(null);
  });

  it('cleans up Shield of Faith buff when casting Spiritual Weapon with WGB active', async () => {
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
        { name: 'OtherCreature', concentration: null },
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
    expect(setRuntimeValue).toHaveBeenCalledWith('OtherCreature', 'activeBuffs', [{ name: 'Other Buff' }], 'test-campaign');
  });

  it('does not clean up Shield of Faith for non-Spiritual Weapon WGB spells', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_War_Gods_Blessing_active') return true;
      if (key2 === 'spell_slots_level_1') return 1;
      return undefined;
    });

    const cs = makeCombatSummary({
      creatures: [
        { name: 'TestWizard', concentration: null },
      ],
    });
    getCombatSummary.mockReturnValue(cs);

    const spell = makeSpell({ name: 'Shield of Faith', level: 1, concentration: true });
    await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats: makePlayerStats(),
      campaignName: 'test-campaign',
    });

    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestWizard', 'activeBuffs', expect.any(Array), 'test-campaign');
  });
});

// ---------------------------------------------------------------------------
// prepareSpellCast — free cast decrement with uses_expression actions (decrement)
// ---------------------------------------------------------------------------

describe('prepareSpellCast — free cast decrement with uses_expression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
    getCombatSummary.mockReturnValue(null);
  });

  it('decrements freeCastCount when freeCastAuthorized and action has uses_expression with level match', async () => {
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
      if (key2 === '_Level_Feature_freeCastCount') return 2;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Level_Feature_freeCastCount', 1, 'test-campaign');
  });

  it('does not decrement when freeCastCount is 0', async () => {
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

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestWizard', '_Level_Feature_freeCastCount', expect.any(Number), 'test-campaign');
  });

  it('decrements when action has uses_expression with featureLevel null and spell name match', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Spell Feature',
          spell: 'Fireball',
          uses_expression: true,
          usesMax: 3,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Spell_Feature_freeCastCount') return 2;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Spell_Feature_freeCastCount', 1, 'test-campaign');
  });

  it('handles perSpellTracking decrement in free cast (FT-070 per-spell counter)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'PerSpell Feature',
          spell: 'Fireball',
          uses: 1,
          recharge: 'long_rest',
          perSpellTracking: true,
        }],
      },
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_PerSpell_Feature_Fireball_freeCastCount', 0, 'test-campaign');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestWizard', 'spell_slots_level_3', expect.anything(), 'test-campaign');
  });

  it('handles recharge non-uses_expression decrement in free cast', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Recharge Feature',
          spell: 'Fireball',
          uses: 2,
          recharge: true,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Recharge_Feature_freeCastCount') return 2;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Recharge_Feature_freeCastCount', 1, 'test-campaign');
  });

  it('handles Natural Recovery free cast reset in decrement', async () => {
    const playerStats = makePlayerStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'naturalRecoveryFreeCast') return ['Fireball'];
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'naturalRecoveryFreeCast', null, 'test-campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'naturalRecoveryFreeCastUsed', true, 'test-campaign');
  });

  it('handles Bewitching Magic free cast reset in decrement', async () => {
    const playerStats = makePlayerStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bewitching_Magic_freeCast') return true;
      return undefined;
    });

    const spell = makeSpell({ name: 'Misty Step', level: 3 });
    await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Bewitching_Magic_freeCast', null, 'test-campaign');
  });

  it('handles Signature Spells used flag set in decrement', async () => {
    const playerStats = makePlayerStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'SignatureSpells_selection') return ['Teleportation Circle'];
      return undefined;
    });

    const spell = makeSpell({ name: 'Teleportation Circle', level: 3 });
    await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SignatureSpells_Teleportation_Circle_used', true, 'test-campaign');
  });

  it('handles Divination Savant used flag set in decrement', async () => {
    const playerStats = makePlayerStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Divination_Savant_selection') return ['Warding Bond'];
      return undefined;
    });

    const spell = makeSpell({ name: 'Warding Bond', level: 2 });
    await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Divination_Savant_Warding_Bond_used', true, 'test-campaign');
  });

  it('handles Favored Enemy reset in decrement', async () => {
    const playerStats = makePlayerStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Favored_Enemy_freeCastCount') return 2;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'favoredEnemyUses', 2, 'test-campaign');
  });

  it('handles arcanum decrement in decrementFreeCastResource', async () => {
    const playerStats = makePlayerStats({
      class: { arcanums: ['Teleport'] },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'mysticArcanumLevel6') return 1;
      return undefined;
    });

    const spell = makeSpell({ name: 'Teleport', level: 6 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'mysticArcanumLevel6', 0, 'test-campaign');
  });

  it('skips action when featureLevel does not match spellLevel (decrement)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [
          {
            type: 'free_spell',
            name: 'Level 3 Feature',
            spell: 'level 3',
            uses_expression: true,
            usesMax: 2,
          },
          {
            type: 'free_spell',
            name: 'Recharge Feature',
            spell: 'Fireball',
            uses: 2,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Recharge_Feature_freeCastCount') return 2;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 5 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Recharge_Feature_freeCastCount', 1, 'test-campaign');
  });

  it('skips action when spell name does not match (decrement)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [
          {
            type: 'free_spell',
            name: 'Spell Feature',
            spell: 'Lightning Bolt',
            uses: 2,
            recharge: true,
          },
          {
            type: 'free_spell',
            name: 'Recharge Feature',
            spell: 'Fireball',
            uses: 2,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Recharge_Feature_freeCastCount') return 2;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'test-campaign',
      freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Recharge_Feature_freeCastCount', 1, 'test-campaign');
  });
});
