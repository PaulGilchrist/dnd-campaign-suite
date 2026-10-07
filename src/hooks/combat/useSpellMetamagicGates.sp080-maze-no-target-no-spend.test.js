import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { prepareSpellCast, isFreeCastAuthorized } from '../../services/rules/spells/spellPreparationService.js';
import { consumeMaterial } from '../../services/rules/spells/materialComponents.js';
import { addEntry } from '../../services/ui/logService.js';
import { resolveTarget } from '../../services/automation/common/targetResolver.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';

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
  getCreatureTargets: vi.fn(() => []),
}));

vi.mock('../../services/automation/common/targetResolver.js', () => ({
  resolveTarget: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ creatures: [{ name: 'DivinationWizard' }, { name: 'Androsphinx 1' }] })),
}));

const CAMPAIGN = 'test-campaign';

function makeWizard() {
  return {
    name: 'DivinationWizard',
    class: { name: 'Wizard' },
    level: 20,
    spellAbilities: { spell_slots_level_8: 1, saveDc: 19 },
  };
}

function makeMaze(overrides = {}) {
  return {
    name: 'Maze',
    level: 8,
    casting_time: 'Action',
    range: '60 feet',
    concentration: true,
    automation: { type: 'maze', saveType: 'WIS', saveDc: 'spell_save_dc' },
    ...overrides,
  };
}

async function gate(spell, setPopupHtml = vi.fn()) {
  const playerStats = makeWizard();
  const onExecute = vi.fn();
  await gateMetamagic(spell, {}, {
    hasMaterial: () => true,
    setPopupHtml,
    isSorcerer: false,
    playerStats,
    campaignName: CAMPAIGN,
    cfSetPending: vi.fn(),
    setSecondaryTargetModal: vi.fn(),
    characters: [],
    onExecute,
  });
  return { playerStats, onExecute, setPopupHtml };
}

function refusalLogs() {
  return addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e?.automationType === 'maze_refused');
}

describe('SP-080 Maze unarmed cast — refuse unpaid before prepareSpellCast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareSpellCast.mockResolvedValue({ modifiedSpell: {}, metaCtx: {}, slotConsumed: true });
    isFreeCastAuthorized.mockReturnValue(false);
    consumeMaterial.mockResolvedValue(true);
    getCombatContext.mockResolvedValue({ creatures: [{ name: 'DivinationWizard' }, { name: 'Androsphinx 1' }] });
    resolveTarget.mockResolvedValue(null);
  });

  it('no armed target: prepareSpellCast never called, onExecute never called, nothing spent', async () => {
    const { onExecute } = await gate(makeMaze());

    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('no armed target: refusal popup mirrors the handler face verbatim', async () => {
    const { setPopupHtml } = await gate(makeMaze());

    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      name: 'Maze',
      description: 'No target selected. Maze has no effect.',
    }));
  });

  it('no armed target: maze_refused automation log with reason no_target and "Nothing spent."', async () => {
    await gate(makeMaze());

    const logs = refusalLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      type: 'automation',
      automationType: 'maze_refused',
      reason: 'no_target',
      characterName: 'DivinationWizard',
      abilityName: 'Maze',
    });
    expect(logs[0].description).toContain('Nothing spent.');
  });

  it('no creatures in combat: refusal face + no spend, reason no_creatures', async () => {
    getCombatContext.mockResolvedValue({ creatures: [] });

    const { onExecute, setPopupHtml } = await gate(makeMaze());

    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      description: 'No creatures in combat. Maze has no effect.',
    }));
    expect(refusalLogs()[0].reason).toBe('no_creatures');
  });

  it('armed valid target: paid lane unchanged — prepareSpellCast pays once, onExecute runs', async () => {
    resolveTarget.mockResolvedValue({ target: { name: 'Androsphinx 1' } });

    const { onExecute } = await gate(makeMaze());

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(refusalLogs()).toHaveLength(0);
  });

  it('control: an ordinary non-sorcerer spell is unaffected by the maze gate', async () => {
    resolveTarget.mockResolvedValue(null);

    await gate({ name: 'Fireball', level: 3, casting_time: 'Action', range: '150 feet', damage: { damage_dice: '8d6' } });

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(refusalLogs()).toHaveLength(0);
  });
});
