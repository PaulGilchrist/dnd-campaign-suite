// CLA-388 regression: Wild Companion casts Find Familiar "without Material
// components" — a paid free-cast grant waives the consumed-material refusal AND the
// consumption; absent the grant the consumed-material gate stays enforced.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { prepareSpellCast, isFreeCastAuthorized } from '../../services/rules/spells/spellPreparationService.js';
import { consumeMaterial } from '../../services/rules/spells/materialComponents.js';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/materialComponents.js', () => ({
  getConsumedMaterial: vi.fn(() => ({ itemName: 'Incense (10 gp)' })),
  hasMaterial: vi.fn(() => false),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => 'Requires burning incense worth 10+ GP.'),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: { name: 'Find Familiar' }, metaCtx: {}, slotConsumed: false, freeCastUsed: true })),
  isFreeCastAuthorized: vi.fn(() => false),
  incrementFreeCastResource: vi.fn(),
}));

vi.mock('./useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 0),
  getMaxSorceryPoints: vi.fn(() => 0),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

vi.mock('./spellGates.js', () => ({
  tryGateSpell: vi.fn(() => false),
}));

vi.mock('./useSpellMetamagicHelpers.js', () => ({
  getCreatureTargets: vi.fn(() => []),
}));

const CAMPAIGN = 'test-campaign';

const findFamiliar = { name: 'Find Familiar', level: 1, casting_time: '1 hour or Ritual', components: ['V', 'S', 'M'] };

function makeDruid(automationActions) {
  return {
    name: 'Wild_Sage_Druid',
    class: { name: 'Druid' },
    level: 20,
    spellAbilities: { spell_slots_level_1: 4 },
    automation: { actions: automationActions, bonusActions: [], specialActions: [] },
  };
}

const wildCompanionEntry = {
  name: 'Wild Companion',
  type: 'free_spell',
  spell: 'Find Familiar',
  resourceCost: 'wild_companion',
};

async function gate(druid) {
  const onExecute = vi.fn();
  const setPopupHtml = vi.fn();
  await gateMetamagic(findFamiliar, {}, {
    hasMaterial: () => false,
    setPopupHtml,
    isSorcerer: false,
    playerStats: druid,
    campaignName: CAMPAIGN,
    cfSetPending: vi.fn(),
    setSecondaryTargetModal: vi.fn(),
    characters: [],
    onExecute,
  });
  return { onExecute, setPopupHtml };
}

describe('CLA-388 consumed-material waiver (Wild Companion)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFreeCastAuthorized.mockReturnValue(false);
    prepareSpellCast.mockResolvedValue({ modifiedSpell: { name: 'Find Familiar' }, metaCtx: {}, slotConsumed: false, freeCastUsed: true });
  });

  it('refuses the cast when the consumed material is missing and no grant is authorized', async () => {
    const { onExecute, setPopupHtml } = await gate(makeDruid([wildCompanionEntry]));
    expect(onExecute).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ automationType: 'material_required' }));
  });

  it('waives the refusal and the consumption when the wild companion grant is authorized', async () => {
    isFreeCastAuthorized.mockReturnValue(true);
    const { onExecute, setPopupHtml } = await gate(makeDruid([wildCompanionEntry]));
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(onExecute).toHaveBeenCalled();
    expect(consumeMaterial).not.toHaveBeenCalled();
  });

  it('keeps the gate enforced for an authorized free cast from a non-material-waiving feature', async () => {
    isFreeCastAuthorized.mockReturnValue(true);
    const noWaiveEntry = { name: 'Other Free Spell', type: 'free_spell', spell: 'Find Familiar' };
    const { onExecute, setPopupHtml } = await gate(makeDruid([noWaiveEntry]));
    expect(onExecute).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ automationType: 'material_required' }));
  });
});
