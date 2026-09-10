// CLA-388 regression: Wild Companion (Druid lv2, 2024) — the PAID grant stamp
// `_Wild_Companion_freeCast` authorizes the free cast of Find Familiar, is CONSUMED
// on cast (clears to null, Bewitching Magic consume-shared-array precedent), logs a
// summons row, and never touches the spell-slot ledger. Un-stamped = not authorized.
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

import { isFreeCastAuthorized, prepareSpellCast } from './spellPreparationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

const campaignName = 'test-campaign';

function makeDruidStats() {
  return {
    name: 'Wild_Sage_Druid',
    level: 20,
    proficiency: 6,
    class: { name: 'Druid', major: { name: 'Circle of the Stars' } },
    abilities: [{ name: 'Wisdom', bonus: 5 }],
    spellAbilities: {
      spellCastingAbility: 'Wisdom',
      modifier: 5,
      saveDc: 19,
      spell_slots_level_1: 4,
      spells: [{ name: 'Find Familiar', level: 1, prepared: true }],
    },
    automation: {
      actions: [{
        name: 'Wild Companion',
        type: 'free_spell',
        spell: 'Find Familiar',
        resourceCost: 'wild_companion',
      }],
      bonusActions: [],
      specialActions: [],
    },
  };
}

const findFamiliar = { name: 'Find Familiar', level: 1, concentration: false, casting_time: '1 hour or Ritual', components: ['V', 'S', 'M'] };

describe('spellPreparationService - Wild Companion grant consumption (CLA-388)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('authorizes the cast only while the paid grant stamp is present', () => {
    const ps = makeDruidStats();
    expect(isFreeCastAuthorized('Wild_Sage_Druid', 'Find Familiar', 1, ps, campaignName)).toBe(false);

    getRuntimeValue.mockImplementation((name, key) => {
      if (key === '_Wild_Companion_freeCast') return ['Find Familiar'];
      return undefined;
    });
    expect(isFreeCastAuthorized('Wild_Sage_Druid', 'Find Familiar', 1, ps, campaignName)).toBe(true);
  });

  it('consumes the grant on cast: clears _Wild_Companion_freeCast, logs summons, pays no slot', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === '_Wild_Companion_freeCast') return ['Find Familiar'];
      return undefined;
    });
    const ps = makeDruidStats();
    const result = await prepareSpellCast(findFamiliar, {}, {
      playerName: 'Wild_Sage_Druid',
      playerStats: ps,
      campaignName,
      isUpcast: false,
      freeCastAuthorized: true,
    });

    expect(result.freeCastUsed).toBe(true);
    expect(result.slotConsumed).toBe(false);
    expect(setRuntimeValue).toHaveBeenCalledWith('Wild_Sage_Druid', '_Wild_Companion_freeCast', null, campaignName);
    expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'summons',
      characterName: 'Wild_Sage_Druid',
      summonName: 'Familiar',
      description: expect.stringContaining('FEY'),
    }));
    const slotWrites = setRuntimeValue.mock.calls.filter(c => String(c[1]).startsWith('spell_slots_level_'));
    expect(slotWrites).toHaveLength(0);
  });

  it('does not consume or log when the grant stamp is absent', async () => {
    const ps = makeDruidStats();
    await prepareSpellCast(findFamiliar, {}, {
      playerName: 'Wild_Sage_Druid',
      playerStats: ps,
      campaignName,
      isUpcast: false,
      freeCastAuthorized: true,
    });
    const grantClears = setRuntimeValue.mock.calls.filter(c => c[1] === '_Wild_Companion_freeCast');
    expect(grantClears).toHaveLength(0);
    const summonsLogs = addEntry.mock.calls.filter(c => c[1]?.type === 'summons');
    expect(summonsLogs).toHaveLength(0);
  });

  it('does not consume the grant for other spells', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === '_Wild_Companion_freeCast') return ['Find Familiar'];
      return undefined;
    });
    const ps = makeDruidStats();
    await prepareSpellCast({ name: 'Cure Wounds', level: 1, concentration: false }, {}, {
      playerName: 'Wild_Sage_Druid',
      playerStats: ps,
      campaignName,
      isUpcast: false,
      freeCastAuthorized: true,
    });
    const grantClears = setRuntimeValue.mock.calls.filter(c => c[1] === '_Wild_Companion_freeCast');
    expect(grantClears).toHaveLength(0);
  });
});
