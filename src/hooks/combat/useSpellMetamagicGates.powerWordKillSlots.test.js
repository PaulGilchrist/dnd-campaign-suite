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

vi.mock('../../services/rules/spells/spellCastService/execution/../../../../automation/handlers/spells/shapechangeHandler.js', () => ({
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

describe('SP-089 Power Word Kill lv9 slot consumption + effect routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareSpellCast.mockResolvedValue({ modifiedSpell: {}, metaCtx: {}, slotConsumed: true });
    isFreeCastAuthorized.mockReturnValue(false);
    getCreatureTargets.mockReturnValue(['Archmage 1', 'Wight 1']);
  });

  it('skip path (primary PWK repro) spends the lv9 slot exactly once BEFORE onExecute', async () => {
    const spell = makePowerWordKill();
    const { onExecute, modal } = await gate(spell);

    await modal.onSkip();

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(prepareSpellCast).toHaveBeenCalledWith(spell, {}, expect.objectContaining({
      playerName: 'DivinationWizard',
      campaignName: CAMPAIGN,
      freeCastAuthorized: false,
    }));
    expect(prepareSpellCast.mock.invocationCallOrder[0]).toBeLessThan(onExecute.mock.invocationCallOrder[0]);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({ name: 'Power Word Kill' }), {});
  });

  it('skip path emits exactly one ability_use lv9 slot-spend log for Power Word Kill', async () => {
    const { modal } = await gate(makePowerWordKill());

    await modal.onSkip();

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

  it('target-selected path spends the lv9 slot exactly once BEFORE onExecute with multiTarget payload', async () => {
    const spell = makePowerWordKill();
    const { onExecute, modal } = await gate(spell);

    await modal.onTargetSelected('Wight 1');

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(prepareSpellCast).toHaveBeenCalledWith(spell, {}, expect.objectContaining({
      playerName: 'DivinationWizard',
      campaignName: CAMPAIGN,
    }));
    expect(prepareSpellCast.mock.invocationCallOrder[0]).toBeLessThan(onExecute.mock.invocationCallOrder[0]);
    expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({ name: 'Power Word Kill' }), { multiTarget: 'Wight 1' });
    expect(slotLogs()).toHaveLength(1);
  });

  it('free cast does not emit a slot-spend log', async () => {
    prepareSpellCast.mockResolvedValue({ modifiedSpell: {}, metaCtx: {}, slotConsumed: false });
    const { onExecute, modal } = await gate(makePowerWordKill());

    await modal.onSkip();

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(slotLogs()).toHaveLength(0);
  });

  it('CLA-392: handlePowerWordKill applies to the FIRST resolved target AND the multiTarget second target', async () => {
    const apply = vi.fn(() => Promise.resolve());
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Archmage 1' }));

    const result = await handlePowerWordKill(makePowerWordKill(), { multiTarget: 'Wight 1' }, getTargetInfo, makeWizard(), CAMPAIGN, apply);

    expect(result).toEqual({ handled: true });
    expect(getTargetInfo).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenNthCalledWith(1, 'Archmage 1', expect.objectContaining({ name: 'DivinationWizard' }), CAMPAIGN, expect.anything());
    expect(apply).toHaveBeenNthCalledWith(2, 'Wight 1', expect.objectContaining({ name: 'DivinationWizard' }), CAMPAIGN, expect.anything());
  });

  it('handlePowerWordKill routes single resolved target to applyPowerWordKillToTarget', async () => {
    const apply = vi.fn(() => Promise.resolve());
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Wight 1' }));

    const result = await handlePowerWordKill(makePowerWordKill(), {}, getTargetInfo, makeWizard(), CAMPAIGN, apply);

    expect(result).toEqual({ handled: true });
    expect(getTargetInfo).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith('Wight 1', expect.objectContaining({ name: 'DivinationWizard' }), CAMPAIGN, expect.anything());
  });

  it('handlePowerWordKill ignores non-PWK spells', async () => {
    const apply = vi.fn(() => Promise.resolve());
    const getTargetInfo = vi.fn(() => Promise.resolve({ name: 'Wight 1' }));

    const result = await handlePowerWordKill({ name: 'Fire Bolt' }, {}, getTargetInfo, makeWizard(), CAMPAIGN, apply);

    expect(result).toEqual({ handled: false });
    expect(apply).not.toHaveBeenCalled();
  });
});
