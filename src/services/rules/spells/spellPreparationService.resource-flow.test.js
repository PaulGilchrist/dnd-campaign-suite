import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  addEntry: vi.fn(),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

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

import { prepareSpellCast } from './spellPreparationService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import * as metamagicRules from './metamagicRules.js';

describe('prepareSpellCast — resource consumption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
    getCombatSummary.mockReturnValue(null);
  });

  it('consumes a spell slot when available', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'spell_slots_level_3') return 3;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats: makePlayerStats(),
      campaignName: 'camp',
    });

    expect(result.slotConsumed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_3', 2, 'camp');
    expect(result.freeCastUsed).toBe(false);
  });

  it('does not consume a slot when none are available', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'spell_slots_level_3') return 0;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats: makePlayerStats(),
      campaignName: 'camp',
    });

    expect(result.slotConsumed).toBe(false);
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('falls back to max slots when current is null', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'spell_slots_level_3') return null;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const playerStats = makePlayerStats({
      spellAbilities: { spell_slots_level_3: 4 },
    });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats,
      campaignName: 'camp',
    });

    expect(result.slotConsumed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_3', 3, 'camp');
  });

  it('consumes an upcast slot at the upcast level', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'spell_slots_level_5') return 2;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats: makePlayerStats(),
      campaignName: 'camp',
      isUpcast: true,
      upcastLevel: 5,
    });

    expect(result.slotConsumed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_5', 1, 'camp');
    expect(result.modifiedSpell.level).toBe(5);
    expect(result.modifiedSpell.baseLevel).toBe(3);
  });
});

describe('prepareSpellCast — free cast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
    getCombatSummary.mockReturnValue(null);
  });

  it('uses a free cast without consuming a slot', async () => {
    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats: makePlayerStats(),
      campaignName: 'camp',
      freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(result.slotConsumed).toBe(false);
    expect(result.metaCtx.freeCastUsed).toBe(true);
  });

  it('does not consume a slot when free cast is authorized', async () => {
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'spell_slots_level_3') return 3;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestWizard',
      playerStats: makePlayerStats(),
      campaignName: 'camp',
      freeCastAuthorized: true,
    });

    expect(result.slotConsumed).toBe(false);
    expect(result.freeCastUsed).toBe(true);
  });
});

describe('prepareSpellCast — psionic sorcery payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
    getCombatSummary.mockReturnValue(null);
  });

  it('spends sorcery points for psionic spells when payment enabled', async () => {
    vi.mocked(metamagicRules.isPsionicSpell).mockReturnValue(true);
    vi.mocked(metamagicRules.hasPsionicSorcery).mockReturnValue(true);
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'sorceryPoints') return 5;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestSorcerer',
      playerStats: makePlayerStats({ class: { name: 'Sorcerer' } }),
      campaignName: 'camp',
      usePsionicPayment: true,
    });

    expect(result.metaCtx.psionicSorcery).toBe('sorceryPoints');
    expect(result.metaCtx.psionicCost).toBe(3);
    expect(result.metaCtx._psionicUsed).toBe(true);
    expect(setRuntimeValue).toHaveBeenCalledWith('TestSorcerer', 'sorceryPoints', 2, 'camp');
    expect(metamagicRules.isPsionicSpell).toHaveBeenCalled();
  });

  it('does not spend SP when insufficient sorcery points', async () => {
    vi.mocked(metamagicRules.isPsionicSpell).mockReturnValue(true);
    vi.mocked(metamagicRules.hasPsionicSorcery).mockReturnValue(true);
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'sorceryPoints') return 2;
      if (key2 === 'spell_slots_level_3') return 3;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestSorcerer',
      playerStats: makePlayerStats({ class: { name: 'Sorcerer' } }),
      campaignName: 'camp',
      usePsionicPayment: true,
    });

    expect(result.metaCtx.psionicSorcery).toBeUndefined();
    expect(result.metaCtx._psionicUsed).toBeUndefined();
    expect(setRuntimeValue).toHaveBeenCalledWith('TestSorcerer', 'spell_slots_level_3', 2, 'camp');
  });

  it('does not spend SP when free cast is authorized', async () => {
    vi.mocked(metamagicRules.isPsionicSpell).mockReturnValue(true);
    vi.mocked(metamagicRules.hasPsionicSorcery).mockReturnValue(true);
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'sorceryPoints') return 5;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestSorcerer',
      playerStats: makePlayerStats({ class: { name: 'Sorcerer' } }),
      campaignName: 'camp',
      usePsionicPayment: true,
      freeCastAuthorized: true,
    });

    expect(result.metaCtx.psionicSorcery).toBeUndefined();
    expect(result.metaCtx._psionicUsed).toBeUndefined();
  });

  it('does not spend SP for non-psionic spells', async () => {
    vi.mocked(metamagicRules.isPsionicSpell).mockReturnValue(false);
    vi.mocked(metamagicRules.hasPsionicSorcery).mockReturnValue(true);

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    const result = await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestSorcerer',
      playerStats: makePlayerStats({ class: { name: 'Sorcerer' } }),
      campaignName: 'camp',
      usePsionicPayment: true,
    });

    expect(result.metaCtx.psionicSorcery).toBeUndefined();
    expect(result.metaCtx._psionicUsed).toBeUndefined();
  });

  it('logs psionic sorcery entry', async () => {
    vi.mocked(metamagicRules.isPsionicSpell).mockReturnValue(true);
    vi.mocked(metamagicRules.hasPsionicSorcery).mockReturnValue(true);
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'sorceryPoints') return 10;
      return undefined;
    });

    const spell = makeSpell({ name: 'Fireball', level: 3 });
    await prepareSpellCast(spell, makeMetaCtx(), {
      playerName: 'TestSorcerer',
      playerStats: makePlayerStats({ class: { name: 'Sorcerer' } }),
      campaignName: 'camp',
      usePsionicPayment: true,
    });

    expect(setRuntimeValue).toHaveBeenCalledWith('TestSorcerer', 'sorceryPoints', 7, 'camp');
    const { addEntry } = await import('../../../services/ui/logService.js');
    expect(addEntry).toHaveBeenCalledWith('camp', expect.objectContaining({
      type: 'psionic_sorcery',
      spellName: 'Fireball',
      spellLevel: 3,
      sorceryPointsSpent: 3,
      componentsWaived: ['V', 'S'],
      note: 'Cast without Verbal or Somatic components. No Material components unless consumed or have cost.',
    }));
  });
});
