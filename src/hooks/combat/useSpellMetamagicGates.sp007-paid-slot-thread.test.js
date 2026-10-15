// @maintained-by-ai: 2026-10-15
// SP-007 gate lane: handleNonSorcererCast's stampPaidSlotLevelOn threads the paid
// upcast level onto BOTH metaCtx carriers — the caller metaCtx and prepareSpellCast's
// snapshot result.metaCtx (copied BEFORE any caller-side stamp) — so generic automation
// handlers (arcane_vigor upcast) resolve at the level actually consumed, not base 2.
// Byte-twin of the CLA-086 confirm-lane stamp; that flow seam is pinned in
// useSpellMetamagicFlow.cla086-upcast-slot.test.js, Aid upcasts in sp127, and the
// Power Word chooser slot spends in the powerWordSlots / powerWordKillSlots twins.
// Fixture mirrors public/data/2024/spells.json arcane-vigor (lv2, Bonus Action, Self).
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

// Fixture mirrors 2024 spells.json: Arcane Vigor, lv2, Bonus Action, Self.
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
  return { metaCtx, onExecute };
}

describe('SP-007 gateMetamagic threads the paid slot level into generic automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mirrors the real prepareSpellCast snapshot: metaCtx copied BEFORE any caller-side
    // stamp; upcasts pay at upcastLevel on the modified spell, base casts stay verbatim.
    prepareSpellCast.mockImplementation(async (spell, passedCtx) => ({
      modifiedSpell: spell.isUpcast ? { ...spell, level: spell.upcastLevel, baseLevel: spell.level } : { ...spell },
      metaCtx: { ...passedCtx, slotConsumed: true },
      slotConsumed: true,
    }));
  });

  const THREADING_CASES = [
    {
      name: 'lv3 upcast carries slotLevel 3 (paid slot, not base 2)',
      spellOverrides: { isUpcast: true, upcastLevel: 3 },
      initialMetaCtx: {},
      expectedSpellLevel: 3,
      expectedSlotLevel: 3,
    },
    {
      name: 'base lv2 cast carries no slotLevel stamp',
      spellOverrides: {},
      initialMetaCtx: {},
      expectedSpellLevel: 2,
      expectedSlotLevel: undefined,
    },
    {
      name: 'pre-set metaCtx.slotLevel survives unchanged (byte-twin guard)',
      spellOverrides: { isUpcast: true, upcastLevel: 3 },
      initialMetaCtx: { slotLevel: 2 },
      expectedSpellLevel: 3,
      expectedSlotLevel: 2,
    },
  ];

  describe.each(THREADING_CASES)('$name', ({ spellOverrides, initialMetaCtx, expectedSpellLevel, expectedSlotLevel }) => {
    it('stamps both metaCtx carriers and forwards them to onExecute', async () => {
      const spell = makeVigorSpell(spellOverrides);
      const { metaCtx, onExecute } = await gate(spell, initialMetaCtx);

      expect(prepareSpellCast).toHaveBeenCalledTimes(1);
      expect(onExecute).toHaveBeenCalledTimes(1);
      const [executedSpell, executedMetaCtx] = onExecute.mock.calls[0];
      expect(executedSpell.level).toBe(expectedSpellLevel);
      expect(executedMetaCtx.slotLevel).toBe(expectedSlotLevel);
      // Both carriers are stamped: result.metaCtx (forwarded above) AND the caller
      // metaCtx mutated in place land on the same slot level.
      expect(metaCtx.slotLevel).toBe(expectedSlotLevel);
    });
  });
});
