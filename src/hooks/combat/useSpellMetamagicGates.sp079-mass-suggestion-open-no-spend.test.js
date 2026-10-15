// @maintained-by-ai: 2026-10-15
// SP-079 pay-at-confirm family (§CLA-208) gate lane: for Mass Suggestion the gate
// OPENS THE CHOOSER UNPAID — handleNonSorcererCast short-circuits before
// prepareSpellCast/consumeMaterial/addEntry and stamps _deferChooserSlotPayment +
// slotLevel (upcastLevel || level) so executeSpellCast skips the cast log and
// MassSuggestionModal's confirm consumes the slot once. Skip/cancel spends nothing.
// Shared no-spend family pattern (twins: sp080-maze, sp125-warding-bond): fixtures
// mirror public/data/2024/spells.json, table-drive cases, one gate() helper, and a
// control pinning that ordinary casts keep the paid lane verbatim.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';
import { consumeMaterial } from '../../services/rules/spells/materialComponents.js';
import { addEntry } from '../../services/ui/logService.js';

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
  prepareSpellCast: vi.fn(),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
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

// Fixture mirrors public/data/2024/spells.json mass-suggestion (lv6, Action,
// 60 feet, no concentration, WIS save vs spell_save_dc, maxTargets 12).
function makeMassSuggestion(overrides = {}) {
  return {
    name: 'Mass Suggestion',
    level: 6,
    casting_time: 'Action',
    range: '60 feet',
    concentration: false,
    automation: { type: 'mass_suggestion', saveType: 'WIS', saveDc: 'spell_save_dc', range: '60 feet', duration: '24 hours', maxTargets: 12 },
    ...overrides,
  };
}

async function gate(spell, { isSorcerer = false, metaCtx = {} } = {}) {
  const playerStats = makeWizard();
  const onExecute = vi.fn();
  const cfSetPending = vi.fn();
  await gateMetamagic(spell, metaCtx, {
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
  return { metaCtx, onExecute, cfSetPending };
}

describe('SP-079 Mass Suggestion pay-at-confirm — gate opens the chooser unpaid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Snapshot semantics of the real prepareSpellCast (used by the paid-lane control).
    prepareSpellCast.mockImplementation(async (spell, passedCtx) => ({
      modifiedSpell: { ...spell },
      metaCtx: { ...passedCtx, slotConsumed: true },
      slotConsumed: true,
    }));
  });

  const DEFERRED_CASES = [
    {
      name: 'base lv6 cast',
      spellOverrides: {},
      expectedSlotLevel: 6,
    },
    {
      name: 'lv7 upcast',
      spellOverrides: { isUpcast: true, upcastLevel: 7 },
      expectedSlotLevel: 7,
    },
  ];

  describe.each(DEFERRED_CASES)('$name — non-sorcerer opens unpaid, chooser confirm pays', ({ spellOverrides, expectedSlotLevel }) => {
    it('spends nothing (no slot, no material, no cast log) and stamps the deferred-payment forward', async () => {
      const spell = makeMassSuggestion(spellOverrides);
      const { metaCtx, onExecute } = await gate(spell);

      expect(prepareSpellCast).not.toHaveBeenCalled();
      expect(consumeMaterial).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();

      expect(onExecute).toHaveBeenCalledTimes(1);
      const [forwarded, forwardedCtx] = onExecute.mock.calls[0];
      expect(forwarded._deferChooserSlotPayment).toBe(true);
      expect(forwarded.slotLevel).toBe(expectedSlotLevel);
      // metaCtx rides through untouched — the confirm lane pays and logs once.
      expect(forwardedCtx).toBe(metaCtx);
      // The original spell row is not mutated by the stamp.
      expect(spell._deferChooserSlotPayment).toBeUndefined();
    });
  });

  it('control: an ordinary non-sorcerer spell still pays its slot at open (paid lane unchanged)', async () => {
    const { onExecute } = await gate({ name: 'Fireball', level: 3, casting_time: 'Action', range: '150 feet', damage: { damage_dice: '8d6' } });

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
  });

  it('control: a sorcerer Mass Suggestion queues the metamagic modal instead (unpaid, no defer stamp)', async () => {
    const { onExecute, cfSetPending } = await gate(makeMassSuggestion(), { isSorcerer: true });

    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(cfSetPending).toHaveBeenCalledWith('metamagic', expect.objectContaining({ spellName: 'Mass Suggestion', spellLevel: 6 }));
  });
});
