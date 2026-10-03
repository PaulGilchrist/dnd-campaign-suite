// CLA-033: runHex/runAnimalFriendship hand off to onExecute, whose
// runPostCastTriggers fires the Beguiling Magic rider — they must stamp
// pending.postCastTriggersRan so the confirm-lane seam skips it (exactly once).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/automation/index.js');
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

describe('CLA-033 onExecute runners stamp the rider opt-out', () => {
  it('runHex stamps postCastTriggersRan before handing off to onExecute', async () => {
    const { applies, onExecute } = setupRun();
    const pending = { spellName: 'Hex', spell: { name: 'Hex', level: 1, school: 'Enchantment' }, spellLevel: 1 };

    await applies.hex(pending, 'Goblin');

    expect(pending.postCastTriggersRan).toBe(true);
    expect(onExecute).toHaveBeenCalledTimes(1);
  });

  it('runAnimalFriendship stamps postCastTriggersRan before handing off to onExecute', async () => {
    const { applies, onExecute } = setupRun();
    const pending = { spellName: 'Animal Friendship', spell: { name: 'Animal Friendship', level: 1, school: 'Enchantment' }, spellLevel: 1, metaCtx: {} };

    await applies.animalFriendship(pending, ['Wolf 1']);

    expect(pending.postCastTriggersRan).toBe(true);
    expect(onExecute).toHaveBeenCalledTimes(1);
  });
});
