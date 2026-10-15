// @maintained-by-ai: 2026-10-15
// SP-125 no-spend family (§CLA-208 pay-no-effect) gate-wiring lane: after
// gateWardingBond declines (its own refusal contract lives in
// spellGates.wardingBond.test.js — never re-run the chooser here),
// refuseUntargetedWardingBondGate inside gateMetamagic must refuse UNPAID:
// zero prepareSpellCast, automation_info refusal face, one warding_bond_refused
// log ending "Nothing spent." Pins the RAW "another creature" mirror filter —
// a solo roster (caster only) still refuses — and the two no-refusal lanes:
// metaCtx.wardingBondTargetName threaded and candidates present (chooser owns
// the cast). Ordinary-spell paid-lane control lives in sp079 — not repeated.
// Shared no-spend family pattern (twins: sp079-mass-suggestion, sp080-maze):
// fixtures mirror public/data/2024/spells.json, table-drive cases, one gate().
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';
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
  getCreatureTargets: vi.fn(() => []),
}));

vi.mock('../../services/automation/common/targetResolver.js', () => ({
  resolveTarget: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

const CAMPAIGN = 'test-campaign';
const CASTER = 'War_Cleric';

function makeCleric() {
  return {
    name: CASTER,
    class: { name: 'Cleric' },
    level: 8,
    spellAbilities: { spell_slots_level_2: 3 },
  };
}

// Fixture mirrors public/data/2024/spells.json Warding Bond (lv2, Action,
// Touch, no concentration, automation { type: 'warding_bond', target:
// 'willing_creature' }). The 5e row shares the same automation block; the
// gate keys off lowercase name or automation.type.
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

async function gate(spell, { metaCtx = {} } = {}) {
  const playerStats = makeCleric();
  const onExecute = vi.fn();
  const setPopupHtml = vi.fn();
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

describe('SP-125 Warding Bond untargeted cast — refuse unpaid before any payment lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Snapshot semantics of the real prepareSpellCast (used by the paid-lane lanes).
    prepareSpellCast.mockImplementation(async (spell, passedCtx) => ({
      modifiedSpell: { ...spell },
      metaCtx: { ...passedCtx, slotConsumed: true },
      slotConsumed: true,
    }));
    consumeMaterial.mockResolvedValue(true);
    getCreatureTargets.mockReturnValue([]);
  });

  const REFUSAL_CASES = [
    {
      name: 'no picker candidates',
      targets: [],
    },
    {
      name: 'solo caster roster (RAW bonds ANOTHER creature)',
      targets: [CASTER],
    },
  ];

  describe.each(REFUSAL_CASES)('$name — refuse face verbatim, nothing spent', ({ targets }) => {
    it('spends nothing (no slot, no material, no cast) and emits the handler refusal face', async () => {
      getCreatureTargets.mockReturnValue(targets);

      const { onExecute, setPopupHtml } = await gate(makeWardingBond());

      expect(prepareSpellCast).not.toHaveBeenCalled();
      expect(consumeMaterial).not.toHaveBeenCalled();
      expect(onExecute).not.toHaveBeenCalled();

      expect(setPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Warding Bond',
        automationType: 'warding_bond_refused',
        description: 'No target selected. Warding Bond has no effect. Nothing spent.',
      });
      expect(addEntry).toHaveBeenCalledTimes(1);
      const refused = addEntry.mock.calls[0][1];
      expect(refused).toMatchObject({
        type: 'automation',
        automationType: 'warding_bond_refused',
        reason: 'no_target',
        characterName: CASTER,
        abilityName: 'Warding Bond',
      });
      expect(refused.description).toBe('Warding Bond refused: no willing creature available to bond with. Nothing spent.');
    });
  });

  it('control: metaCtx.wardingBondTargetName threaded — paid lane pays once, zero refusals', async () => {
    const { onExecute, setPopupHtml } = await gate(makeWardingBond(), { metaCtx: { wardingBondTargetName: 'AasimarTest' } });

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(addEntry).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
  });

  it('control: picker candidates exist — no refusal, cast proceeds to the paid lane (mirror of gateWardingBond\'s list)', async () => {
    getCreatureTargets.mockReturnValue(['AasimarTest', 'Bandit 1']);

    const { onExecute, setPopupHtml } = await gate(makeWardingBond());

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(addEntry).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
  });
});
