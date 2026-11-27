// @maintained-by-ai 2026-11-26
// CLA-388 Wild Companion material-waiver seam of gateMetamagic (useSpellMetamagicGates.js
// hasWildCompanionWaiver / isBlockedByConsumedMaterial / handleNonSorcererCast consumption).
// 2024 classes.json (Druid lv2): "expend a spell slot or a use of Wild Shape to cast the
// Find Familiar spell without Material components" — automation metadata {type:'free_spell',
// spell:'Find Familiar', resourceCost:'wild_companion'} mirrors it; the fixture below too.
// Generic block-when-missing / pass-when-carried on the sorcerer lane is owned by
// useSpellMetamagicFlow.gate-material.test.js; this file stays Wild-Companion-specific:
// each unmet conjunct of hasWildCompanionWaiver refuses unpaid (one it.each leg per
// conjunct — authorized grant, resourceCost stamp, spell-stamp specificity), the
// authorized grant waives refusal AND consumption (scalar + array spell stamps), and
// the non-sorcerer pay-and-consume lane with the material carried spends exactly once.
// Like gate-material, the material service is ONLY partially mocked — getConsumedMaterial,
// hasMaterial, and getMaterialRequirementMessage run for REAL against MATERIAL_REGISTRY
// (Find Familiar → 'Incense (10 gp)'), so these tests validate actual gate data. Only
// consumeMaterial is stubbed (it PATCHes the character file).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { hasMaterial, consumeMaterial } from '../../services/rules/spells/materialComponents.js';
import { prepareSpellCast, isFreeCastAuthorized } from '../../services/rules/spells/spellPreparationService.js';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
}));

vi.mock('../../services/rules/spells/materialComponents.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, consumeMaterial: vi.fn(() => Promise.resolve(true)) };
});

// Real MATERIAL_REGISTRY loads the module's runtime-store import — stub it (PATCH side effects).
vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: { name: 'Find Familiar' }, metaCtx: {}, slotConsumed: false })),
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
  getCreatureTargets: vi.fn(() => []),
}));

const CAMPAIGN = 'test-campaign';

// Real-data mirror: 2024 Find Familiar (V, S, M — incense 10+ gp, consumed).
const findFamiliar = { name: 'Find Familiar', level: 1, casting_time: '1 hour or Ritual', components: ['V', 'S', 'M'] };

const wildCompanionEntry = {
  name: 'Wild Companion',
  type: 'free_spell',
  spell: 'Find Familiar',
  resourceCost: 'wild_companion',
};

function makeDruid(automationActions, backpack = []) {
  return {
    name: 'Wild_Sage_Druid',
    class: { name: 'Druid' },
    level: 20,
    inventory: { backpack },
    spellAbilities: { spell_slots_level_1: 4 },
    automation: { actions: automationActions, bonusActions: [], specialActions: [] },
  };
}

async function gate(druid) {
  const onExecute = vi.fn();
  const setPopupHtml = vi.fn();
  await gateMetamagic(findFamiliar, {}, {
    hasMaterial,
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
    prepareSpellCast.mockResolvedValue({ modifiedSpell: { name: 'Find Familiar' }, metaCtx: {}, slotConsumed: false });
  });

  // One branch (refuseMissingMaterial) for all three unmet conjuncts of
  // hasWildCompanionWaiver (grant authorized, resourceCost 'wild_companion',
  // spell stamp names this spell) — one leg per conjunct, identical assertions.
  // The refusal copy/audit-row bytes are owned by the material-refused sibling;
  // this lane pins only the Wild-Companion-shaped UNPAID census.
  it.each([
    ['grant not authorized', wildCompanionEntry, false],
    ['free-cast feature lacks the wild_companion resourceCost', { name: 'Other Free Spell', type: 'free_spell', spell: 'Find Familiar' }, true],
    ['wild companion grant stamped for a different spell', { ...wildCompanionEntry, spell: 'Find Steed' }, true],
  ])('refuses unpaid when the %s conjunct fails', async (_label, entry, authorized) => {
    isFreeCastAuthorized.mockReturnValue(authorized);
    const { onExecute, setPopupHtml } = await gate(makeDruid([entry]));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ automationType: 'material_refused' }));
    expect(onExecute).not.toHaveBeenCalled();
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(consumeMaterial).not.toHaveBeenCalled();
  });

  // Both spell-stamp shapes the feature registry ships (scalar and array;
  // hasWildCompanionWaiver branches on Array.isArray). Bucket placement
  // (actions/bonusActions/specialActions) is one flattened .some scan — no
  // extra legs; the authorization side of the grant is owned by
  // spellPreparationService.wildCompanion.test.js.
  it.each([
    ['scalar', 'Find Familiar'],
    ['array', ['Find Steed', 'Find Familiar']],
  ])('waives the refusal and the consumption for an authorized grant with a %s spell stamp', async (_label, spell) => {
    isFreeCastAuthorized.mockReturnValue(true);
    const { onExecute, setPopupHtml } = await gate(makeDruid([{ ...wildCompanionEntry, spell }]));
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(consumeMaterial).not.toHaveBeenCalled();
  });

  it('consumes the carried incense once on a non-waived paid cast', async () => {
    // The non-sorcerer pay-and-consume lane with the waiver-eligible feature
    // PRESENT but unauthorized: carried material (real hasMaterial exact-name
    // match) unblocks the gate, the slot is paid once, and consumeMaterial is
    // handed the exact registry item name once — the waiver legs above assert
    // the skip; this asserts the spend does not leak to the paid lane.
    const druid = makeDruid([wildCompanionEntry], ['Incense (10 gp)']);
    const { onExecute, setPopupHtml } = await gate(druid);
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(consumeMaterial).toHaveBeenCalledTimes(1);
    expect(consumeMaterial).toHaveBeenCalledWith(druid, 'Incense (10 gp)', CAMPAIGN);
    expect(onExecute).toHaveBeenCalledTimes(1);
  });
});
