// CLA-107: runHex must forward the chooser selection (persisted on pending by
// gateHex) onto the execute metaCtx — previously dropped, so castHex pinned
// STR regardless of the chosen ability.
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
    playerStats: { name: 'HexWarlock' },
    campaignName: 'test-campaign',
    setPopupHtml: vi.fn(),
    getPending: () => null,
    cfClearPending: vi.fn(),
    onExecute,
  });
  return { applies, onExecute };
}

describe('CLA-107 runHex threads the chosen ability through confirm → onExecute', () => {
  it('forwards pending.hexAbility on the execute metaCtx', async () => {
    const { applies, onExecute } = setupRun();
    const pending = {
      spellName: 'Hex',
      spell: { name: 'Hex', level: 1, school: 'Enchantment' },
      spellLevel: 1,
      hexAbility: 'DEX',
    };

    await applies.hex(pending, 'Bandit 1');

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute.mock.calls[0][1]).toEqual({ targetName: 'Bandit 1', hexAbility: 'DEX' });
  });

  it('accepts an array confirm result and keeps the chosen ability', async () => {
    const { applies, onExecute } = setupRun();
    const pending = {
      spellName: 'Hex',
      spell: { name: 'Hex', level: 1, school: 'Enchantment' },
      spellLevel: 1,
      hexAbility: 'WIS',
    };

    await applies.hex(pending, ['Bandit 1']);

    expect(onExecute.mock.calls[0][1]).toEqual({ targetName: 'Bandit 1', hexAbility: 'WIS' });
  });

  it('unarmed pending carries null (no STR coercion)', async () => {
    const { applies, onExecute } = setupRun();
    const pending = {
      spellName: 'Hex',
      spell: { name: 'Hex', level: 1, school: 'Enchantment' },
      spellLevel: 1,
    };

    await applies.hex(pending, 'Bandit 1');

    expect(onExecute.mock.calls[0][1]).toEqual({ targetName: 'Bandit 1', hexAbility: undefined });
  });
});
