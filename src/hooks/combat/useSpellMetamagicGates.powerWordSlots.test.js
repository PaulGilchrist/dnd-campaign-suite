import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { addEntry } from '../../services/ui/logService.js';
import { prepareSpellCast, isFreeCastAuthorized } from '../../services/rules/spells/spellPreparationService.js';
import { getCreatureTargets } from './useSpellMetamagicHelpers.js';

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
  getCreatureTargets: vi.fn(() => ['AasimarTest', 'HeroesFeastBard']),
}));

const CAMPAIGN = 'test-campaign';

function makeCleric() {
  return {
    name: 'Divine_Cleric',
    class: { name: 'Cleric' },
    level: 17,
    spellAbilities: { spell_slots_level_9: 1 },
  };
}

function makePowerWordSpell(overrides = {}) {
  return {
    name: 'Power Word Heal',
    level: 9,
    casting_time: 'Action',
    range: '60 feet',
    ...overrides,
  };
}

async function gate(spell) {
  const playerStats = makeCleric();
  const onExecute = vi.fn();
  const setSecondaryTargetModal = vi.fn();
  await gateMetamagic(spell, {}, {
    hasMaterial: () => true,
    setPopupHtml: vi.fn(),
    isSorcerer: false,
    playerStats,
    campaignName: CAMPAIGN,
    cfSetPending: vi.fn(),
    setSecondaryTargetModal,
    characters: [],
    onExecute,
  });
  const modal = setSecondaryTargetModal.mock.calls[0][0].secondaryTargetModal;
  return { playerStats, onExecute, setSecondaryTargetModal, modal };
}

describe('SP-088/SP-089 Words-of-Creation branch slot consumption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareSpellCast.mockResolvedValue({ modifiedSpell: {}, metaCtx: {}, slotConsumed: true });
    isFreeCastAuthorized.mockReturnValue(false);
    getCreatureTargets.mockReturnValue(['AasimarTest', 'HeroesFeastBard']);
  });

  it('target-selected path calls prepareSpellCast exactly once BEFORE onExecute', async () => {
    const spell = makePowerWordSpell();
    const { onExecute, modal } = await gate(spell);

    await modal.onTargetSelected('AasimarTest');

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(prepareSpellCast).toHaveBeenCalledWith(spell, {}, expect.objectContaining({
      playerName: 'Divine_Cleric',
      campaignName: CAMPAIGN,
      freeCastAuthorized: false,
    }));
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute.mock.calls[0][0]).toBe(spell);
    expect(onExecute.mock.calls[0][1]).toEqual({ multiTarget: 'AasimarTest' });
    expect(prepareSpellCast.mock.invocationCallOrder[0]).toBeLessThan(onExecute.mock.invocationCallOrder[0]);
  });

  it('skip path calls prepareSpellCast exactly once BEFORE onExecute', async () => {
    const spell = makePowerWordSpell();
    const { onExecute, setSecondaryTargetModal, modal } = await gate(spell);

    await modal.onSkip();

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(prepareSpellCast).toHaveBeenCalledWith(spell, {}, expect.objectContaining({
      playerName: 'Divine_Cleric',
      campaignName: CAMPAIGN,
    }));
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute.mock.calls[0][1]).toEqual({});
    expect(prepareSpellCast.mock.invocationCallOrder[0]).toBeLessThan(onExecute.mock.invocationCallOrder[0]);
    expect(setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
  });

  it('logs ability_use slot spend when the slot is consumed', async () => {
    const { modal } = await gate(makePowerWordSpell());

    await modal.onSkip();

    const slotLog = addEntry.mock.calls.filter(c => c[1].type === 'ability_use');
    expect(slotLog).toHaveLength(1);
    expect(slotLog[0][1]).toEqual(expect.objectContaining({
      characterName: 'Divine_Cleric',
      abilityName: 'Power Word Heal',
      spellName: 'Power Word Heal',
    }));
    expect(slotLog[0][1].description).toContain('Expended a level 9 spell slot');
  });

  it('does not log a slot spend for a free cast', async () => {
    prepareSpellCast.mockResolvedValue({ modifiedSpell: {}, metaCtx: {}, slotConsumed: false });
    const { modal } = await gate(makePowerWordSpell());

    await modal.onSkip();

    expect(addEntry.mock.calls.filter(c => c[1].type === 'ability_use')).toHaveLength(0);
  });

  it('Power Word Kill shared branch consumes the slot on target-selected path', async () => {
    const spell = makePowerWordSpell({ name: 'Power Word Kill' });
    const { onExecute, modal } = await gate(spell);

    await modal.onTargetSelected('HeroesFeastBard');

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(prepareSpellCast).toHaveBeenCalledWith(spell, {}, expect.objectContaining({
      playerName: 'Divine_Cleric',
      campaignName: CAMPAIGN,
    }));
    expect(onExecute.mock.calls[0][1]).toEqual({ multiTarget: 'HeroesFeastBard' });
  });

  it('Power Word Kill skip path consumes the slot once', async () => {
    const { onExecute, modal } = await gate(makePowerWordSpell({ name: 'Power Word Kill' }));

    await modal.onSkip();

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({ name: 'Power Word Kill' }), {});
  });
});
