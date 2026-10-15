// @maintained-by-ai: 2026-10-15
// CLA-033 handler-side stamping seam (useSimpleSpellHandlers): the onExecute
// runners (runHex / runAnimalFriendship) reach runPostCastTriggers downstream,
// so they must stamp pending.postCastTriggersRan — the confirm-lane seam in
// useConfirmableFlow skips itself when the stamp is present (Beguiling Magic
// fires exactly once). Seam-side behaviour is covered by
// useConfirmableFlow.cla033-rider.test.js; handoff payload shape by the
// per-spell lanes (e.g. useSimpleSpellHandlers.animalFriendship.test.js,
// useSimpleSpellHandlers.cla107-hex-ability.test.js) — not duplicated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Auto-mocks (vi.mock without factory) neutralize every heavy runner dependency
// imported by useSimpleSpellHandlers — this test only exercises the stamp keys.
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

import { useSimpleSpellHandlers } from './useSimpleSpellHandlers.js';

function setupRun() {
  const applies = {};
  const onExecute = vi.fn();
  const buildHandlers = useSimpleSpellHandlers; // pure factory — no React hooks inside
  buildHandlers({
    createConfirmHandler: (name, applyFn) => { applies[name] = applyFn; return vi.fn(); },
    createSkipHandler: () => vi.fn(),
    playerStats: { name: 'Bard' },
    campaignName: 'test-campaign',
    setPopupHtml: vi.fn(),
    getPending: () => null,
    cfClearPending: vi.fn(),
    onExecute,
  });
  return { applies, onExecute };
}

// Fixture mirrors what each runner actually reads before stamping + handing off.
const STAMP_ROWS = [
  {
    handler: 'hex',
    pending: () => ({
      spellName: 'Hex',
      spell: { name: 'Hex', level: 1, school: 'Enchantment' },
      spellLevel: 1,
      hexAbility: 'CHA',
    }),
    selection: 'Goblin',
  },
  {
    handler: 'animalFriendship',
    pending: () => ({
      spellName: 'Animal Friendship',
      spell: { name: 'Animal Friendship', level: 1, school: 'Enchantment' },
      spellLevel: 1,
      metaCtx: {},
    }),
    selection: ['Wolf 1'],
  },
];

describe('CLA-033 onExecute runners stamp the rider opt-out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(STAMP_ROWS)(
    '$handler stamps postCastTriggersRan and hands off to onExecute exactly once',
    async ({ handler, pending, selection }) => {
      const { applies, onExecute } = setupRun();
      const h = pending();

      await applies[handler](h, selection);

      expect(h.postCastTriggersRan).toBe(true);
      expect(onExecute).toHaveBeenCalledTimes(1);
    },
  );

  it('hex with no target resolves nothing — no stamp, no handoff (stamp is tied to a real cast)', async () => {
    const { applies, onExecute } = setupRun();
    const pending = { spellName: 'Hex', spell: { name: 'Hex', level: 1, school: 'Enchantment' }, spellLevel: 1 };

    await applies.hex(pending, []);

    expect(pending.postCastTriggersRan).toBeUndefined();
    expect(onExecute).not.toHaveBeenCalled();
  });
});
