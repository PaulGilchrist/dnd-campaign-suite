// @maintained-by-ai: 2026-10-15
// SP-002 runAnimalFriendship unit seam (useSimpleSpellHandlers): createConfirmHandler
// already paid the slot at the stamped paid level (stampPaidSlotLevel / CLA-086), so
// the runner must only forward the PAID level + selection to onExecute — never
// re-prepare the cast. Downstream triggerAnimalFriendship(spell, metaCtx) consumes
// exactly this shape: metaCtx.targetNames + metaCtx.slotLevel, lv2 adjudicating 2
// Beasts via spell.level. Rider stamp (CLA-033 postCastTriggersRan) lives in
// useSimpleSpellHandlers.cla033-rider-stamps.test.js — not duplicated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells2024 from '../../../../public/data/2024/spells.json';

// Auto-mocks (vi.mock without factory) neutralize every heavy runner dependency
// imported by useSimpleSpellHandlers — this test only exercises runAnimalFriendship.
vi.mock('../../../services/automation/index.js');
vi.mock('../../../services/rules/features/faerieFireService.js');
vi.mock('../../../services/rules/features/healService.js');
vi.mock('../../../services/rules/features/foresightService.js');
vi.mock('../../../services/rules/features/holdMonsterService.js');
vi.mock('../../../services/rules/features/charmPersonService.js');
vi.mock('../../../services/rules/features/charmMonsterService.js');
vi.mock('../../../services/rules/features/banishmentService.js');
vi.mock('../../../services/rules/features/revivifyService.js');
vi.mock('../../../services/rules/features/healingWordService.js');
vi.mock('../../../services/automation/handlers/spells/polymorphService.js');
vi.mock('../../../services/rules/features/greaterRestorationService.js');
vi.mock('../../../services/rules/features/removeCurseService.js');
vi.mock('../../../services/rules/features/regenerateService.js');
vi.mock('../../../services/rules/spells/materialComponents.js');
vi.mock('../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../useConfirmableFlow.js', () => ({ rollbackSpellSlot: vi.fn() }));
vi.mock('../../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));
// Regression seam: if the confirm runner ever wires prepareSpellCast back in
// (SP-002 double-payment regression), this mock catches the re-call.
vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

import { useSimpleSpellHandlers } from './useSimpleSpellHandlers.js';
import { prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js';

// Data authority: 2024 Essentials row carries the upcast_at_slot_level ladder
// (lv1 "1 target", lv2 "2 targets") that the paid-slot threading must honour.
const AF = spells2024.find(s => s.name === 'Animal Friendship');

function setupRun() {
  const applies = {};
  const onExecute = vi.fn();
  const buildHandlers = useSimpleSpellHandlers; // pure factory — no React hooks inside
  buildHandlers({
    createConfirmHandler: (name, applyFn) => { applies[name] = applyFn; return vi.fn(); },
    createSkipHandler: () => vi.fn(),
    playerStats: { name: 'Wild_Sage_Druid' },
    campaignName: 'test-campaign',
    setPopupHtml: vi.fn(),
    getPending: () => null,
    cfClearPending: vi.fn(),
    onExecute,
  });
  return { run: applies.animalFriendship, onExecute };
}

// Fixture mirrors what runAnimalFriendship actually reads: spell, spellLevel, metaCtx.
function makePending(spell = {}, overrides = {}) {
  return {
    spellName: 'Animal Friendship',
    spell: { ...AF, ...spell },
    spellLevel: 1,
    metaCtx: {},
    ...overrides,
  };
}

const CONTRACT_ROWS = [
  {
    label: 'lv1 base forwards slotLevel 1 and the selected Beast',
    spell: {},
    metaCtx: {},
    selection: ['Wolf 1'],
    expectLevel: 1,
    expectBaseLevel: undefined,
    expectSlotLevel: 1,
    expectTargetNames: ['Wolf 1'],
  },
  {
    label: 'lv2 upcast forwards the PAID level (2) — trigger resolves 2 Beasts at lv2',
    spell: { upcastLevel: 2, isUpcast: true },
    metaCtx: { slotLevel: 2 },
    selection: ['Wolf 1', 'Wolf 2'],
    expectLevel: 2,
    expectBaseLevel: 1,
    expectSlotLevel: 2,
    expectTargetNames: ['Wolf 1', 'Wolf 2'],
  },
  {
    label: 'wraps a single non-array selection into targetNames',
    spell: {},
    metaCtx: {},
    selection: 'Wolf 1',
    expectLevel: 1,
    expectBaseLevel: undefined,
    expectSlotLevel: 1,
    expectTargetNames: ['Wolf 1'],
  },
  {
    label: 'missing metaCtx.slotLevel falls back to pending.spellLevel',
    spell: {},
    metaCtx: undefined,
    selection: ['Wolf 2'],
    expectLevel: 1,
    expectBaseLevel: undefined,
    expectSlotLevel: 1,
    expectTargetNames: ['Wolf 2'],
  },
];

describe('SP-002 runAnimalFriendship — paid-slot threading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(CONTRACT_ROWS)(
    '$label',
    async ({ spell, metaCtx, selection, expectLevel, expectBaseLevel, expectSlotLevel, expectTargetNames }) => {
      const { run, onExecute } = setupRun();

      await run(makePending(spell, { metaCtx }), selection);

      expect(onExecute).toHaveBeenCalledTimes(1);
      const [sentSpell, sentMeta] = onExecute.mock.calls[0];
      expect(sentSpell.level).toBe(expectLevel);
      expect(sentSpell.baseLevel).toBe(expectBaseLevel);
      expect(sentMeta).toEqual({ targetNames: expectTargetNames, slotLevel: expectSlotLevel });
      // The confirm lane already paid the slot once — the runner must never re-prepare.
      expect(prepareSpellCast).not.toHaveBeenCalled();
    },
  );
});

describe('data-drift guard — spells.json Animal Friendship', () => {
  it('2024 row keeps the lv1 Enchantment base + +1 Beast/slot ladder the contract assumes', () => {
    expect(AF.level).toBe(1);
    expect(AF.school).toBe('Enchantment');
    expect(AF.dc.dc_type).toBe('WIS');
    expect(AF.upcast_at_slot_level['1']).toBe('1 target');
    expect(AF.upcast_at_slot_level['2']).toBe('2 targets');
  });
});
