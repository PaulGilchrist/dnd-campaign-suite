// CLA-388: Wild Companion (Druid lv2, 2024) — row click must route to the
// WildCompanion chooser modal (pay BEFORE stamping the grant); refuse at
// both-zero with popup + wild_companion_refused log spending nothing.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

const mockAddEntry = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../ui/logService.js', () => ({
  addEntry: (...args) => mockAddEntry(...args),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

import { handle } from './spellCastHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';

const wildCompanionAction = {
  name: 'Wild Companion',
  automation: {
    type: 'free_spell',
    spell: 'Find Familiar',
    action: 'action',
    casting_time: '1 action',
    resourceCost: 'wild_companion',
  },
};

function makeDruid() {
  return {
    name: 'Wild_Sage_Druid',
    level: 20,
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 3,
      spell_slots_level_4: 3,
      spell_slots_level_5: 3,
      spell_slots_level_6: 1,
      spell_slots_level_7: 1,
      spell_slots_level_8: 1,
      spell_slots_level_9: 1,
    },
    _trackedResources: { wildShapeUses: { max: 2 } },
    class: { name: 'Druid', class_levels: [{ level: 2, wild_shape: 2 }] },
  };
}

describe('spellCastHandler - Wild Companion (CLA-388)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('routes a row click to the wildCompanion chooser modal WITHOUT stamping or spending', async () => {
    const ps = makeDruid();
    const result = await handle(wildCompanionAction, ps, campaignName, null);

    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('wildCompanion');
    expect(result.payload.playerStats).toBe(ps);
    expect(result.payload.campaignName).toBe(campaignName);
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(mockAddEntry).not.toHaveBeenCalled();
  });

  it('still routes to the chooser when only Wild Shape uses remain', async () => {
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'wildShapeUses') return 1;
      return 0;
    });
    const result = await handle(wildCompanionAction, makeDruid(), campaignName, null);
    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('wildCompanion');
  });

  it('still routes to the chooser when only spell slots remain', async () => {
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'spell_slots_level_5') return 1;
      if (key === 'wildShapeUses') return 0;
      return null;
    });
    const ps = makeDruid();
    ps._trackedResources = { wildShapeUses: { max: 0 } };
    const result = await handle(wildCompanionAction, ps, campaignName, null);
    expect(result.type).toBe('modal');
    expect(result.modalName).toBe('wildCompanion');
  });

  it('refuses at zero slots AND zero wild shape with popup + wild_companion_refused log, spending nothing', async () => {
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'wildShapeUses') return 0;
      return 0;
    });
    const ps = makeDruid();
    ps._trackedResources = { wildShapeUses: { max: 0 } };
    const result = await handle(wildCompanionAction, ps, campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('spell slot or a use of Wild Shape');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(mockAddEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'automation',
      automationType: 'wild_companion_refused',
      characterName: 'Wild_Sage_Druid',
    }));
  });

  it('never falls through to the generic unpaid _freeCast stamp for wild companion', async () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);
    await handle(wildCompanionAction, makeDruid(), campaignName, null);
    const stampedKeys = runtimeState.setRuntimeValue.mock.calls.map(c => c[1]);
    expect(stampedKeys).not.toContain('_Wild_Companion_freeCast');
  });
});
