// @maintained-by-ai
/**
 * HurlThroughHellModal — result-screen lane (jsx :270-294).
 *
 * Ownership map (siblings — do not duplicate here):
 * - .test.jsx (base) — info-screen ternary arms, Cancel/Done close, confirm transition,
 *   round-latch + uses stamps.
 * - .saveResults.test.jsx — save-resolution side effects (store writes, ledger fields,
 *   popup detail, addExpiration payload).
 * - -branches.test.jsx — branch/fallback matrix, byte-exact ledgers, promptId guard,
 *   listener lifecycle, null interim stage.
 * This lane owns ONLY the user-facing result screen: exact copy for both save arms and
 * the Done-button contract. The previous single test here asserted the INFO-screen pact
 * note (/level 4/) — misnamed and already covered by base (:117-126) and the branch
 * pact arms; trimmed. Microtask flushes only (no bare setTimeout); per-test onClose.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HurlThroughHellModal from './HurlThroughHellModal.jsx';

// ── Mocked modules (services with network/SSE side effects) ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'rs-prompt-1' })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 22 })),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 5),
  getCombatSummary: vi.fn(() => ({ creatures: [{ name: 'Goblin1', type: 'npc' }] })),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 22, rolls: [15, 7] })),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Fixtures ──

function makeProps(overrides = {}) {
  return {
    action: { name: 'Hurl Through Hell' },
    playerStats: { name: 'Throg', level: 15 },
    campaignName: 'test-campaign',
    targetName: 'Goblin1',
    saveType: 'WIS',
    saveDc: 16,
    damageType: 'Psychic',
    damageExpression: '4d10',
    damageTotal: 22,
    currentUses: 0,
    maxUses: 3,
    pactMagicRecharge: false,
    pactSlotLevel: 0,
    pactSlotsAvailable: 0,
    onClose: vi.fn(),
    ...overrides,
  };
}

// Bounded microtask flushes — handleConfirm resolves on the microtask queue only.
const flush = () => act(async () => { await Promise.resolve(); });

async function resolveSave(props, detail) {
  render(<HurlThroughHellModal {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /Hurl Through Hell/ }));
  await flush();
  await act(async () => {
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: 'rs-prompt-1', ...detail } }));
    await Promise.resolve();
  });
  await flush();
}

// ── Tests ──

describe('HurlThroughHellModal — result screen', () => {
  it.each([
    {
      arm: 'failed save',
      detail: { roll: 8, total: 10, success: false },
      copy: 'Goblin1 failed WIS save — hurled through the lower planes.',
      notCopy: 'Goblin1 succeeded on WIS save — resists the effect and is not hurled through the lower planes.',
    },
    {
      arm: 'succeeded save',
      detail: { roll: 15, total: 17, success: true },
      copy: 'Goblin1 succeeded on WIS save — resists the effect and is not hurled through the lower planes.',
      notCopy: 'Goblin1 failed WIS save — hurled through the lower planes.',
    },
  ])('$arm: exact result copy, Done-only actions, Done closes once', async ({ detail, copy, notCopy }) => {
    const props = makeProps();
    await resolveSave(props, detail);

    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(screen.queryByText(notCopy)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hurl Through Hell/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
