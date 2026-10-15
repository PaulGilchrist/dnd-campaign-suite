// @maintained-by-ai: 2026-10-15
// SP-088 Power Word Heal slot handling on the Words-of-Creation second-target gate
// (useSpellMetamagicGates.js spendPowerWordSlot / openPowerWordTargetModal).
// Data authority — public/data/2024/spells.json: Power Word Heal is level 9 Enchantment,
// casting_time "Action", range "60 feet", non-concentration; the fixture below mirrors it
// (also true in legacy public/data, where lv8 Power Word Stun is the nearest non-gated
// neighbour — the gate's isPowerWordSpell matches Heal/Kill only).
// Power Word Kill has its own maintained twin,
// useSpellMetamagicGates.powerWordKillSlots.test.js (both cast paths, free-cast guard,
// non-PWK handler guard); this file stays Power Word Heal-specific. CLA-392 first+
// second-target effect spread is covered where it lives, in modalSpells.powerWordSpread.
// test.js. Pinned here: the gate opens the Words-of-Creation chooser, both chooser
// outcomes pay the lv9 slot exactly once BEFORE onExecute with one ability_use log,
// free casts pay nothing, and non-Power-Word spells never reach the chooser.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { addEntry } from '../../services/ui/logService.js';
import { prepareSpellCast, isFreeCastAuthorized } from '../../services/rules/spells/spellPreparationService.js';
import { getMultiTargetSpreadForSpell } from '../../services/rules/spells/postCastRiderService.js';
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

// Divine Domain Word of Creation unlocks Power Word Heal at cleric 17.
function makeCleric() {
  return {
    name: 'Divine_Cleric',
    class: { name: 'Cleric' },
    level: 17,
    spellAbilities: { spell_slots_level_9: 1 },
  };
}

// Fixture mirrors 2024 spells.json: Power Word Heal, lv9, Action, 60 feet.
function makePowerWordHeal(overrides = {}) {
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
  const cfSetPending = vi.fn();
  await gateMetamagic(spell, {}, {
    hasMaterial: () => true,
    setPopupHtml: vi.fn(),
    isSorcerer: false,
    playerStats,
    campaignName: CAMPAIGN,
    cfSetPending,
    setSecondaryTargetModal,
    characters: [],
    onExecute,
  });
  const modal = setSecondaryTargetModal.mock.calls[0][0].secondaryTargetModal;
  return { onExecute, setSecondaryTargetModal, cfSetPending, modal };
}

function slotLogs() {
  return addEntry.mock.calls.filter(c => c[1].type === 'ability_use');
}

beforeEach(() => {
  vi.clearAllMocks();
  prepareSpellCast.mockResolvedValue({ modifiedSpell: {}, metaCtx: {}, slotConsumed: true });
  isFreeCastAuthorized.mockReturnValue(false);
  getMultiTargetSpreadForSpell.mockReturnValue(null);
  getCreatureTargets.mockReturnValue(['AasimarTest', 'HeroesFeastBard']);
});

// Both chooser outcomes cast the spell, so both must pay the lv9 slot first.
const CAST_PATHS = [
  { path: 'skip', choose: modal => modal.onSkip(), expectedMetaCtx: {} },
  { path: 'target-selected', choose: modal => modal.onTargetSelected('AasimarTest'), expectedMetaCtx: { multiTarget: 'AasimarTest' } },
];

describe('SP-088 Power Word Heal Words-of-Creation gate', () => {
  it('opens the chooser with the live creature targets and a 10 ft spread', async () => {
    const { modal } = await gate(makePowerWordHeal());

    expect(modal.title).toBe('Words of Creation — Choose Second Target');
    expect(modal.targets).toEqual([
      { name: 'AasimarTest', type: 'creature' },
      { name: 'HeroesFeastBard', type: 'creature' },
    ]);
    expect(modal.featureDescription).toContain('10 ft');
  });

  describe.each(CAST_PATHS)('$path path', ({ choose, expectedMetaCtx }) => {
    it('spends the lv9 slot exactly once BEFORE onExecute and emits one ability_use log', async () => {
      const spell = makePowerWordHeal();
      const { onExecute, setSecondaryTargetModal, modal } = await gate(spell);

      await choose(modal);

      expect(prepareSpellCast).toHaveBeenCalledTimes(1);
      expect(prepareSpellCast).toHaveBeenCalledWith(spell, {}, expect.objectContaining({
        playerName: 'Divine_Cleric',
        campaignName: CAMPAIGN,
        freeCastAuthorized: false,
      }));
      expect(prepareSpellCast.mock.invocationCallOrder[0]).toBeLessThan(onExecute.mock.invocationCallOrder[0]);
      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({ name: 'Power Word Heal' }), expectedMetaCtx);

      const logs = slotLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0][0]).toBe(CAMPAIGN);
      expect(logs[0][1]).toEqual(expect.objectContaining({
        type: 'ability_use',
        characterName: 'Divine_Cleric',
        abilityName: 'Power Word Heal',
        spellName: 'Power Word Heal',
      }));
      expect(logs[0][1].description).toContain('Expended a level 9 spell slot');
      expect(setSecondaryTargetModal).toHaveBeenLastCalledWith(null);
    });
  });

  it('free cast pays nothing — no slot-spend log', async () => {
    prepareSpellCast.mockResolvedValue({ modifiedSpell: {}, metaCtx: {}, slotConsumed: false });
    const { onExecute, modal } = await gate(makePowerWordHeal());

    await modal.onSkip();

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(slotLogs()).toHaveLength(0);
  });

  it('non-Power-Word spells never reach the chooser (gate matches Heal/Kill only)', async () => {
    // 2024 lv8 Power Word Stun is the nearest non-gated neighbour; with a spread
    // it takes the generic cfSetPending lane instead of the Words-of-Creation modal.
    const spell = makePowerWordHeal({ name: 'Power Word Stun', level: 8 });
    getMultiTargetSpreadForSpell.mockReturnValueOnce({ range: '10 ft' });
    const setSecondaryTargetModal = vi.fn();
    const cfSetPending = vi.fn();
    await gateMetamagic(spell, {}, {
      hasMaterial: () => true,
      setPopupHtml: vi.fn(),
      isSorcerer: false,
      playerStats: makeCleric(),
      campaignName: CAMPAIGN,
      cfSetPending,
      setSecondaryTargetModal,
      characters: [],
      onExecute: vi.fn(),
    });

    expect(setSecondaryTargetModal).not.toHaveBeenCalled();
    expect(cfSetPending).toHaveBeenCalledWith('multiTarget', expect.objectContaining({ spellName: 'Power Word Stun' }));
  });
});
