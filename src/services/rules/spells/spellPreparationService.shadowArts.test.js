// CLA-308 regression: Shadow Arts (2024 Warrior of Shadow lv3 Monk) free-cast
// authorization, per-spell once-per-Long-Rest gate, consumption and rollback in
// spellPreparationService. Mirrors the verified CLA-252 Phantasmal Creatures pattern:
// counters `_Shadow_Arts_<Spell>_freeCastCount`, null = fresh/available, 0 = spent
// until the next Long Rest (reset lives in restRules-longRest.js). No spell slot is
// ever consulted or consumed for these casts.
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
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

import { isFreeCastAuthorized, prepareSpellCast, incrementFreeCastResource } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

const SHADOW_ARTS_SPELLS = ['Darkness', 'Darkvision', 'Pass Without Trace', 'Silence'];

function makeShadowArtsStats() {
  return {
    name: 'Disciplined_Monk',
    level: 17,
    proficiency: 6,
    class: { name: 'Monk', major: { name: 'Warrior of Shadow' } },
    abilities: [{ name: 'Wisdom', bonus: 4 }],
    spellAbilities: {
      spellCastingAbility: 'Wisdom',
      modifier: 4,
      saveDc: 18,
      spells: SHADOW_ARTS_SPELLS.map(name => ({ name, level: 2, prepared: 'Always', _shadowArtsFreeCast: true, spellCastingAbility: 'WIS' })),
    },
    automation: {
      actions: [],
      bonusActions: [],
      specialActions: [],
      passives: [{
        type: 'shadow_arts',
        name: 'Shadow Arts',
        effect: 'shadow_arts',
        freeCastSpells: SHADOW_ARTS_SPELLS,
        usesMax: 1,
        recharge: 'long_rest',
        saveAbility: 'WIS',
      }],
    },
  };
}

function makeSpell(name, level = 2) {
  return { name, level, casting_time: '1 action', range: 'Self', duration: 'Concentration, up to 1 minute', concentration: true, damage: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeValue.mockReturnValue(undefined);
});

describe('isFreeCastAuthorized — CLA-308 Shadow Arts', () => {
  it('authorizes all four spells when counters are fresh (null = available)', () => {
    const stats = makeShadowArtsStats();
    for (const spellName of SHADOW_ARTS_SPELLS) {
      expect(isFreeCastAuthorized('Disciplined_Monk', spellName, 2, stats, 'camp'), spellName).toBe(true);
    }
  });

  it('refuses a second cast of the same spell once its counter is 0', () => {
    const stats = makeShadowArtsStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Shadow_Arts_Darkness_freeCastCount') return 0;
      return undefined;
    });
    expect(isFreeCastAuthorized('Disciplined_Monk', 'Darkness', 2, stats, 'camp')).toBe(false);
  });

  it('spent Darkness does not block Silence (per-spell independence)', () => {
    const stats = makeShadowArtsStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Shadow_Arts_Darkness_freeCastCount') return 0;
      if (key2 === '_Shadow_Arts_Silence_freeCastCount') return 1;
      return undefined;
    });
    expect(isFreeCastAuthorized('Disciplined_Monk', 'Darkness', 2, stats, 'camp')).toBe(false);
    expect(isFreeCastAuthorized('Disciplined_Monk', 'Silence', 2, stats, 'camp')).toBe(true);
  });

  it('returns false for non-Shadow-Arts spells', () => {
    const stats = makeShadowArtsStats();
    expect(isFreeCastAuthorized('Disciplined_Monk', 'Fireball', 3, stats, 'camp')).toBe(false);
  });

  it('returns false without the shadow_arts passive (control)', () => {
    const stats = makeShadowArtsStats();
    stats.automation.passives = [];
    expect(isFreeCastAuthorized('Disciplined_Monk', 'Darkness', 2, stats, 'camp')).toBe(false);
  });

  it('passes campaignName through to the runtime store read', () => {
    const stats = makeShadowArtsStats();
    isFreeCastAuthorized('Disciplined_Monk', 'Darkness', 2, stats, 'camp');
    expect(getRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', '_Shadow_Arts_Darkness_freeCastCount', 'camp');
  });
});

describe('prepareSpellCast — CLA-308 Shadow Arts consumption', () => {
  it('consumes the per-spell counter, logs the slotless cast, and never spends a spell slot', async () => {
    const stats = makeShadowArtsStats();
    const result = await prepareSpellCast(makeSpell('Darkness'), {}, {
      playerName: 'Disciplined_Monk',
      playerStats: stats,
      campaignName: 'camp',
      isUpcast: false,
      freeCastAuthorized: true,
    });

    expect(result.slotConsumed).toBe(false);
    expect(result.freeCastUsed).toBe(true);
    expect(result.metaCtx.freeCastUsed).toBe(true);

    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', '_Shadow_Arts_Darkness_freeCastCount', 0, 'camp');
    // No spell slot expenditure anywhere in the cast.
    const slotWrites = setRuntimeValue.mock.calls.filter(call => String(call[1]).startsWith('spell_slots_level_'));
    expect(slotWrites).toHaveLength(0);

    const logCall = addEntry.mock.calls.find(call => call[1]?.type === 'ability_use' && call[1]?.spellName === 'Darkness');
    expect(logCall).toBeTruthy();
    expect(logCall[1].abilityName).toBe('Shadow Arts');
    expect(logCall[1].note).toContain('no spell slot consumed');
  });

  it('consumes Silence independently of Darkness', async () => {
    const stats = makeShadowArtsStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Shadow_Arts_Darkness_freeCastCount') return 0;
      return undefined;
    });
    await prepareSpellCast(makeSpell('Silence'), {}, {
      playerName: 'Disciplined_Monk',
      playerStats: stats,
      campaignName: 'camp',
      isUpcast: false,
      freeCastAuthorized: true,
    });
    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', '_Shadow_Arts_Silence_freeCastCount', 0, 'camp');
  });

  it('authorized cast carries the Wisdom-derived DC (18) — no DC 10 fallback is introduced', async () => {
    const stats = makeShadowArtsStats();
    // The sheet passes the stamped spell entry (spellCastingAbility carried, CLA-212/234).
    const stampedSpell = { ...makeSpell('Darkness'), spellCastingAbility: 'WIS', _shadowArtsFreeCast: true };
    const result = await prepareSpellCast(stampedSpell, {}, {
      playerName: 'Disciplined_Monk',
      playerStats: stats,
      campaignName: 'camp',
      isUpcast: false,
      freeCastAuthorized: true,
    });
    expect(stats.spellAbilities.saveDc).toBe(18);
    expect(result.metaCtx.freeCastUsed).toBe(true);
    expect(result.modifiedSpell.spellCastingAbility).toBe('WIS');
  });
});

describe('incrementFreeCastResource — CLA-308 Shadow Arts rollback', () => {
  it('restores a spent counter back to usesMax', () => {
    const stats = makeShadowArtsStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Shadow_Arts_Darkness_freeCastCount') return 0;
      return undefined;
    });
    incrementFreeCastResource('Disciplined_Monk', 'Darkness', 2, stats, 'camp');
    expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', '_Shadow_Arts_Darkness_freeCastCount', 1, 'camp');
  });

  it('never over-refunds a fresh (null) counter', () => {
    const stats = makeShadowArtsStats();
    getRuntimeValue.mockReturnValue(undefined);
    incrementFreeCastResource('Disciplined_Monk', 'Darkness', 2, stats, 'camp');
    const shadowWrites = setRuntimeValue.mock.calls.filter(call => String(call[1]).includes('_Shadow_Arts_'));
    expect(shadowWrites).toHaveLength(0);
  });
});
