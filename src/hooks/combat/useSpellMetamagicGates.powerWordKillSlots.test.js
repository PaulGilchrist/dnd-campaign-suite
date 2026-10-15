// @maintained-by-ai: 2026-10-15
// SP-089 Power Word Kill slot handling on the Words-of-Creation second-target gate
// (useSpellMetamagicGates.js spendPowerWordSlot / openPowerWordTargetModal).
// Data authority — public/data/2024/spells.json: Power Word Kill is level 9 Enchantment,
// casting_time "Action", range "60 feet", non-concentration; the fixture below mirrors it.
// Slot mechanics shared with Power Word Heal live in the twin
// useSpellMetamagicGates.powerWordSlots.test.js; CLA-392 first+second-target effect
// spread is covered where it lives, in modalSpells.powerWordSpread.test.js (including
// the multiTarget===first-target dedupe). This file stays PWK-specific: both cast paths
// pay the lv9 slot exactly once BEFORE onExecute, free casts pay nothing, and the
// modal-spell handler refuses to claim non-PWK spells.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { addEntry } from '../../services/ui/logService.js';
import { prepareSpellCast, isFreeCastAuthorized } from '../../services/rules/spells/spellPreparationService.js';
import { getCreatureTargets } from './useSpellMetamagicHelpers.js';
import { handlePowerWordKill } from '../../services/rules/spells/spellCastService/execution/modalSpells.js';

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
  getCreatureTargets: vi.fn(() => ['Archmage 1', 'Wight 1']),
}));

vi.mock('../../services/automation/handlers/spells/shapechangeHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(async () => ({ creatures: [{ name: 'Archmage 1' }, { name: 'Wight 1' }] })),
}));

const CAMPAIGN = 'test-campaign';

function makeWizard() {
  return {
    name: 'DivinationWizard',
    class: { name: 'Wizard' },
    level: 20,
    spellAbilities: { spell_slots_level_9: 1 },
  };
}

// Fixture mirrors 2024 spells.json: Power Word Kill, lv9, Action, 60 feet.
function makePowerWordKill(overrides = {}) {
  return {
    name: 'Power Word Kill',
    level: 9,
    casting_time: 'Action',
    range: '60 feet',
    ...overrides,
  };
}

async function gate(spell) {
  const playerStats = makeWizard();
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
  return { playerStats, onExecute, modal };
}

function slotLogs() {
  return addEntry.mock.calls.filter(c => c[1].type === 'ability_use');
}

beforeEach(() => {
  vi.clearAllMocks();
  prepareSpellCast.mockResolvedValue({ modifiedSpell: {}, metaCtx: {}, slotConsumed: true });
  isFreeCastAuthorized.mockReturnValue(false);
  getCreatureTargets.mockReturnValue(['Archmage 1', 'Wight 1']);
});

// Both chooser outcomes cast the spell, so both must pay the lv9 slot first.
const CAST_PATHS = [
  { path: 'skip', choose: modal => modal.onSkip(), expectedMetaCtx: {} },
  { path: 'target-selected', choose: modal => modal.onTargetSelected('Wight 1'), expectedMetaCtx: { multiTarget: 'Wight 1' } },
];

describe.each(CAST_PATHS)('SP-089 Power Word Kill $path path', ({ choose, expectedMetaCtx }) => {
  it('spends the lv9 slot exactly once BEFORE onExecute and emits one ability_use log', async () => {
    const spell = makePowerWordKill();
    const { onExecute, modal } = await gate(spell);

    await choose(modal);

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(prepareSpellCast).toHaveBeenCalledWith(spell, {}, expect.objectContaining({
      playerName: 'DivinationWizard',
      campaignName: CAMPAIGN,
      freeCastAuthorized: false,
    }));
    expect(prepareSpellCast.mock.invocationCallOrder[0]).toBeLessThan(onExecute.mock.invocationCallOrder[0]);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({ name: 'Power Word Kill' }), expectedMetaCtx);

    const logs = slotLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0][0]).toBe(CAMPAIGN);
    expect(logs[0][1]).toEqual(expect.objectContaining({
      type: 'ability_use',
      characterName: 'DivinationWizard',
      abilityName: 'Power Word Kill',
      spellName: 'Power Word Kill',
    }));
    expect(logs[0][1].description).toContain('Expended a level 9 spell slot');
  });
});

describe('SP-089 Power Word Kill payment guards', () => {
  it('free cast does not emit a slot-spend log', async () => {
    prepareSpellCast.mockResolvedValue({ modifiedSpell: {}, metaCtx: {}, slotConsumed: false });
    const { onExecute, modal } = await gate(makePowerWordKill());

    await modal.onSkip();

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(slotLogs()).toHaveLength(0);
  });

  it('handlePowerWordKill ignores non-PWK spells', async () => {
    const apply = vi.fn(() => Promise.resolve());
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Wight 1' }));

    const result = await handlePowerWordKill({ spell: { name: 'Fire Bolt' }, metaCtx: {}, getTargetInfo, playerStats: makeWizard(), campaignName: CAMPAIGN, applyPowerWordKillToTarget: apply });

    expect(result).toEqual({ handled: false });
    expect(getTargetInfo).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });
});
