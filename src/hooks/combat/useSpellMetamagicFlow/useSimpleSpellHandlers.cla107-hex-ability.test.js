// @maintained-by-ai: 2026-10-15
// CLA-107 runHex handoff seam: the ability chosen in HexAbilityModal arrives via
// metaCtx and is persisted by gateHex (spellGates.js — the ONLY hex-pending producer,
// stamping hexAbility as a STR..CHA key or null). runHex must forward it verbatim
// onto the execute metaCtx — previously dropped, so castHex pinned STR regardless of
// the choice. 2024 Hex data confirms the contract (lv1 Enchantment, Bonus Action,
// "choose one ability"). Rider-stamp seam (postCastTriggersRan) and empty-selection
// no-handoff are covered by cla033-rider-stamps.test.js — not duplicated here.
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

// Rows mirror gateHex's pending shape. Selection may be a raw name or the
// confirm-picker's single-element array; hexAbility is always present
// (modal key or gateHex's null default) — never coerced, never dropped.
const HANDOFF_ROWS = [
  { label: 'string selection forwards the chosen ability', selection: 'Bandit 1', hexAbility: 'DEX' },
  { label: 'array confirm result keeps the chosen ability', selection: ['Bandit 1'], hexAbility: 'WIS' },
  { label: 'unselected cast carries gateHex null (no STR coercion)', selection: 'Bandit 1', hexAbility: null },
];

describe('CLA-107 runHex threads the chosen ability through confirm → onExecute', () => {
  it.each(HANDOFF_ROWS)(
    '$label',
    async ({ selection, hexAbility }) => {
      const { applies, onExecute } = setupRun();
      const pending = {
        spellName: 'Hex',
        spell: { name: 'Hex', level: 1, school: 'Enchantment' },
        spellLevel: 1,
        hexAbility,
      };

      await applies.hex(pending, selection);

      expect(onExecute).toHaveBeenCalledTimes(1);
      expect(onExecute.mock.calls[0][0]).toBe(pending.spell);
      expect(onExecute.mock.calls[0][1]).toEqual({ targetName: 'Bandit 1', hexAbility });
    },
  );
});
