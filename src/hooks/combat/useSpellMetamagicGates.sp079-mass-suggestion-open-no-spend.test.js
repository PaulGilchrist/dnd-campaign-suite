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
  getConsumedMaterial: vi.fn(() => null),
  hasMaterial: vi.fn(() => true),
  consumeMaterial: vi.fn(() => Promise.resolve(true)),
  getMaterialRequirementMessage: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {}, slotConsumed: true })),
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
  getCreatureTargets: vi.fn(() => ['Bandit 1', 'Bandit 2']),
}));

const CAMPAIGN = 'test-campaign';

function makeWizard() {
  return {
    name: 'DivinationWizard',
    class: { name: 'Wizard' },
    level: 20,
    spellAbilities: { spell_slots_level_6: 2, saveDc: 19 },
  };
}

function makeMassSuggestion(overrides = {}) {
  return {
    name: 'Mass Suggestion',
    level: 6,
    casting_time: 'Action',
    range: '60 feet',
    concentration: false,
    automation: { type: 'mass_suggestion', saveType: 'WIS', saveDc: 'spell_save_dc', maxTargets: 12 },
    ...overrides,
  };
}

async function gate(spell, isSorcerer = false) {
  const playerStats = makeWizard();
  const onExecute = vi.fn();
  const cfSetPending = vi.fn();
  await gateMetamagic(spell, {}, {
    hasMaterial: () => true,
    setPopupHtml: vi.fn(),
    isSorcerer,
    playerStats,
    campaignName: CAMPAIGN,
    cfSetPending,
    setSecondaryTargetModal: vi.fn(),
    characters: [],
    onExecute,
  });
  return { playerStats, onExecute, cfSetPending };
}

describe('SP-079 Mass Suggestion pay-at-open fix — open lane spends nothing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareSpellCast.mockResolvedValue({ modifiedSpell: {}, metaCtx: {}, slotConsumed: true });
    isFreeCastAuthorized.mockReturnValue(false);
    consumeMaterial.mockResolvedValue(true);
  });

  it('non-sorcerer Mass Suggestion does NOT call prepareSpellCast at open (no spend at row-click/open)', async () => {
    const { onExecute } = await gate(makeMassSuggestion());

    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(onExecute).toHaveBeenCalledTimes(1);
  });

  it('stamps _deferChooserSlotPayment + slotLevel so the chooser confirm pays', async () => {
    const { onExecute } = await gate(makeMassSuggestion());

    const forwarded = onExecute.mock.calls[0][0];
    expect(forwarded._deferChooserSlotPayment).toBe(true);
    expect(forwarded.slotLevel).toBe(6);
  });

  it('control: an ordinary non-sorcerer spell still pays its slot at open (unchanged lane)', async () => {
    await gate({ name: 'Fireball', level: 3, casting_time: 'Action', range: '150 feet', damage: { damage_dice: '8d6' } });

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
  });

  it('control: a non-sorcerer Mass Suggestion open never spends even after many opens', async () => {
    for (let i = 0; i < 3; i++) {
      await gate(makeMassSuggestion());
    }

    expect(prepareSpellCast).not.toHaveBeenCalled();
  });
});
