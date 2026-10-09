import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateMetamagic } from './useSpellMetamagicGates.js';
import { prepareSpellCast } from '../../services/rules/spells/spellPreparationService.js';

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

const CAMPAIGN = 'test-campaign';

function makeWizard() {
  return {
    name: 'DivinationWizard',
    class: { name: 'Wizard' },
    level: 20,
    spellAbilities: { spell_slots_level_2: 3, spell_slots_level_3: 3 },
  };
}

function makeVigorSpell(overrides = {}) {
  return {
    name: 'Arcane Vigor',
    level: 2,
    casting_time: 'Bonus Action',
    range: 'Self',
    automation: { type: 'arcane_vigor' },
    ...overrides,
  };
}

async function gate(spell, metaCtx = {}) {
  const playerStats = makeWizard();
  const onExecute = vi.fn();
  await gateMetamagic(spell, metaCtx, {
    hasMaterial: () => true,
    setPopupHtml: vi.fn(),
    isSorcerer: false,
    playerStats,
    campaignName: CAMPAIGN,
    cfSetPending: vi.fn(),
    setSecondaryTargetModal: vi.fn(),
    characters: [],
    onExecute,
  });
  return { onExecute, playerStats };
}

describe('SP-007 gateMetamagic threads the paid slot level into generic automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lv3 upcast: forwarded metaCtx carries slotLevel 3 (paid slot, not base 2)', async () => {
    const spell = makeVigorSpell({ isUpcast: true, upcastLevel: 3 });
    prepareSpellCast.mockImplementation(async (_spell, metaCtx) => ({
      // Mirrors the real prepareSpellCast snapshot: copy taken BEFORE any stamp.
      modifiedSpell: { ...spell, level: 3, baseLevel: 2 },
      metaCtx: { ...metaCtx, slotConsumed: true },
      slotConsumed: true,
    }));

    const { onExecute } = await gate(spell);

    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledTimes(1);
    const [executedSpell, executedMetaCtx] = onExecute.mock.calls[0];
    expect(executedSpell.level).toBe(3);
    expect(executedMetaCtx.slotLevel).toBe(3);
  });

  it('base lv2 cast: no upcastLevel, forwarded metaCtx carries no slotLevel stamp', async () => {
    const spell = makeVigorSpell();
    prepareSpellCast.mockImplementation(async (_spell, metaCtx) => ({
      modifiedSpell: { ...spell },
      metaCtx: { ...metaCtx, slotConsumed: true },
      slotConsumed: true,
    }));

    const { onExecute } = await gate(spell);

    const [, executedMetaCtx] = onExecute.mock.calls[0];
    expect(executedMetaCtx.slotLevel).toBeUndefined();
  });

  it('pre-set metaCtx.slotLevel survives unchanged (byte-twin guard)', async () => {
    const spell = makeVigorSpell({ isUpcast: true, upcastLevel: 3 });
    prepareSpellCast.mockImplementation(async (_spell, metaCtx) => ({
      modifiedSpell: { ...spell, level: 3, baseLevel: 2 },
      metaCtx: { ...metaCtx, slotConsumed: true },
      slotConsumed: true,
    }));

    const { onExecute } = await gate(spell, { slotLevel: 2 });

    const [, executedMetaCtx] = onExecute.mock.calls[0];
    expect(executedMetaCtx.slotLevel).toBe(2);
  });
});
