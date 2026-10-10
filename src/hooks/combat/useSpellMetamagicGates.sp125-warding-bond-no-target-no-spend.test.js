// SP-125: Warding Bond burned the lv2 slot before the handler's no-target
// guard (pay-no-effect, §CLA-208 / SP-080 maze-refused family). When neither
// the chooser gate nor a metaCtx/armed/candidate target exists, gateMetamagic
// must refuse UNPAID: zero prepareSpellCast, popup refusal face, and an honest
// warding_bond_refused automation log.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { prepareSpellCast, isFreeCastAuthorized } from '../../services/rules/spells/spellPreparationService.js';
import { consumeMaterial } from '../../services/rules/spells/materialComponents.js';
import { addEntry } from '../../services/ui/logService.js';
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
  getCreatureTargets: vi.fn(() => []),
}));

vi.mock('../../services/automation/common/targetResolver.js', () => ({
  resolveTarget: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

const CAMPAIGN = 'test-campaign';

function makeCleric() {
  return {
    name: 'War_Cleric',
    class: { name: 'Cleric' },
    level: 8,
    spellAbilities: { spell_slots_level_2: 3 },
  };
}

function makeWardingBond(overrides = {}) {
  return {
    name: 'Warding Bond',
    level: 2,
    casting_time: 'Action',
    range: 'Touch',
    concentration: false,
    duration: '1 hour',
    automation: { type: 'warding_bond', duration: '1 hour', target: 'willing_creature', casting_time: '1 action' },
    ...overrides,
  };
}

async function gate(spell, metaCtx = {}, setPopupHtml = vi.fn()) {
  const playerStats = makeCleric();
  const onExecute = vi.fn();
  await gateMetamagic(spell, metaCtx, {
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
  return { onExecute, setPopupHtml };
}

function refusalLogs() {
  return addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e?.automationType === 'warding_bond_refused');
}

describe('SP-125 Warding Bond untargeted cast — refuse unpaid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareSpellCast.mockResolvedValue({ modifiedSpell: {}, metaCtx: {}, slotConsumed: true });
    isFreeCastAuthorized.mockReturnValue(false);
    consumeMaterial.mockResolvedValue(true);
    getCreatureTargets.mockReturnValue([]);
  });

  it('no target resolvable: prepareSpellCast never called, onExecute never called, slot untouched', async () => {
    const { onExecute } = await gate(makeWardingBond());

    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('no target resolvable: refusal popup names the spell and says nothing spent', async () => {
    const { setPopupHtml } = await gate(makeWardingBond());

    expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_info',
      name: 'Warding Bond',
      automationType: 'warding_bond_refused',
    }));
    expect(setPopupHtml.mock.calls[0][0].description).toContain('Nothing spent.');
  });

  it('no target resolvable: warding_bond_refused automation log with reason no_target', async () => {
    await gate(makeWardingBond());

    const logs = refusalLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      type: 'automation',
      automationType: 'warding_bond_refused',
      reason: 'no_target',
      characterName: 'War_Cleric',
      abilityName: 'Warding Bond',
    });
  });

  it('metaCtx.wardingBondTargetName threaded: paid lane runs once, no refusal', async () => {
    const { onExecute } = await gate(makeWardingBond(), { wardingBondTargetName: 'AasimarTest' });

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(refusalLogs()).toHaveLength(0);
  });

  it('picker candidates exist: no refusal (chooser lane owns the cast)', async () => {
    getCreatureTargets.mockReturnValue(['AasimarTest']);

    const { setPopupHtml } = await gate(makeWardingBond());

    expect(refusalLogs()).toHaveLength(0);
    expect(setPopupHtml).not.toHaveBeenCalledWith(expect.objectContaining({ automationType: 'warding_bond_refused' }));
  });

  it('control: an ordinary non-sorcerer spell is unaffected by the warding-bond gate', async () => {
    const { onExecute } = await gate({ name: 'Fireball', level: 3, casting_time: 'Action', range: '150 feet', damage: { damage_dice: '8d6' } });

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(refusalLogs()).toHaveLength(0);
  });
});
