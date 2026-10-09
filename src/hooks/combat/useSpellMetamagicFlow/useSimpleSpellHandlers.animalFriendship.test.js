import { describe, it, expect, vi } from 'vitest';

// Any-name Proxy mocks — this test only exercises runAnimalFriendship; every
// other gated runner's dependency must resolve but never execute.

// Auto-mocks (vi.mock without factory) neutralize every named export of the
// heavy runner dependencies — this test only exercises runAnimalFriendship.
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
vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve({ modifiedSpell: {}, metaCtx: {} })),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

import { useSimpleSpellHandlers } from './useSimpleSpellHandlers.js';
import { prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js';

const UPCAST_DATA = { 1: '1 target', 2: '2 targets' };

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

function makePending(overrides = {}) {
  const { spell: spellOverride, ...rest } = overrides;
  return {
    spellName: 'Animal Friendship',
    spell: { name: 'Animal Friendship', level: 1, casting_time: 'Action', upcast_at_slot_level: UPCAST_DATA, ...(spellOverride || {}) },
    spellLevel: 1,
    castingTime: 'Action',
    maxTargets: 1,
    creatureTargets: ['Wolf 1', 'Wolf 2'],
    metaCtx: {},
    ...rest,
  };
}

describe('SP-002 runAnimalFriendship — paid-slot threading', () => {
  it('lv1 lane forwards slotLevel 1 and the selected targets', async () => {
    const { run, onExecute } = setupRun();
    const pending = makePending();

    await run(pending, ['Wolf 1']);

    expect(onExecute).toHaveBeenCalledTimes(1);
    const [spell, metaCtx] = onExecute.mock.calls[0];
    expect(spell.level).toBe(1);
    expect(metaCtx.targetNames).toEqual(['Wolf 1']);
    expect(metaCtx.slotLevel).toBe(1);
  });

  it('lv2 upcast forwards the PAID level (2) — handler resolves 2 Beasts at lv2', async () => {
    const { run, onExecute } = setupRun();
    const pending = makePending({
      spell: { upcastLevel: 2, isUpcast: true },
      maxTargets: 2,
      metaCtx: { slotLevel: 2 },
    });

    await run(pending, ['Wolf 1', 'Wolf 2']);

    const [spell, metaCtx] = onExecute.mock.calls[0];
    expect(spell.level).toBe(2);
    expect(spell.baseLevel).toBe(1);
    expect(metaCtx.slotLevel).toBe(2);
    expect(metaCtx.targetNames).toEqual(['Wolf 1', 'Wolf 2']);
  });

  it('does NOT re-run prepareSpellCast — the confirm lane already paid the slot once', async () => {
    const { run } = setupRun();

    await run(makePending({ spell: { upcastLevel: 2, isUpcast: true }, metaCtx: { slotLevel: 2 } }), ['Wolf 1', 'Wolf 2']);

    expect(prepareSpellCast).not.toHaveBeenCalled();
  });

  it('wraps a single non-array selection into targetNames', async () => {
    const { run, onExecute } = setupRun();

    await run(makePending(), 'Wolf 1');

    expect(onExecute.mock.calls[0][1].targetNames).toEqual(['Wolf 1']);
  });
});
