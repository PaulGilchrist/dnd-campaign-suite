// @maintained-by-ai 2026-11-27
/**
 * HurlThroughHellModal — result-screen lane (jsx :290-316).
 *
 * Ownership map (siblings — do not duplicate here):
 * - .test.jsx (base) — info-screen ternary arms, Cancel/Done close, confirm transition,
 *   round-latch + uses stamps.
 * - .saveResults.test.jsx — save-resolution side effects (store writes, ledger fields,
 *   popup detail, addExpiration payload).
 * - -branches.test.jsx (18 blocks / 28 cases) — branch/fallback matrix, byte-exact
 *   ledgers, promptId guard, listener lifecycle, null interim stage.
 * - .save-dismissed.test.jsx — the dismissed-arm copy (:295) and Done, pinned stronger
 *   there (findByText + zero-harm ledger); never re-pinned here.
 * This lane owns ONLY the user-facing fail/success result copy (:297/:299) plus the
 * Done-button contract — the copy closer + Done-click trimmed out of -branches.test.jsx's
 * save-arm ledger it.each (rec).
 *
 * Trim pass 2026-11-27 (3 cases → 2): the old third arm 'failed save (fiend target)'
 * hit the SAME :297 branch as arm 1 with only the target name differing (the result
 * screen never consults combatSummary — no fiend variant exists here, and the fiend
 * routing is saveResults/branches' ledger face, off-limits per the #1956 handoff).
 * Its interpolation duty now rides arm 1: fail arm uses targetName 'Orc Warrior' +
 * saveType 'DEX' so a hardcoded-name/-saveType refactor of :297 is mutant-discriminating;
 * the success arm keeps fixture defaults. Both arms cross-pin the opposite branch's
 * byte (notCopy), falsifying a :296/:298 branch swap in either direction.
 *
 * Split compliance (#1956 handoff): confirms with hasUse=true only (pact ledger is
 * -branches' exclusive); pins no addEntry rows, popup details or Done payloads — the
 * component calls onClose() with no arguments, so there is no payload to project.
 * window.dispatchEvent is the correct dispatch face here: the component registers its
 * own window listeners at :233-234 (not via the mocked factory); -save-dismissed
 * dispatches the same way.
 * No Date.now freeze: neither pinned outlet (copy, Done click) stamps — the stamping
 * outlets (:47/:70/:88/:102/:129/:200) are verified and owned by -branches. Microtask
 * flushes only (no bare setTimeout, no sleeps — #1956 method); fresh onClose per test.
 * Mock-key audit: all 7 vi.mock modules are imported by the component and every exported
 * key is consumed (savePrompt {createSaveListener, logSaveDismissed}, logService
 * {addEntry}, useRuntimeState {getRuntimeValue, setRuntimeValue}, applyDamage
 * {applyDamageToTarget}, combatData {getCombatSummary, getCurrentCombatRound},
 * diceRoller {rollExpression}, expirations {addExpiration}) — no phantoms; only
 * useOverlayEntranceFocus imports unmocked (pure DOM focus hook, jsdom-safe).
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HurlThroughHellModal from './HurlThroughHellModal.jsx';

// ── Mocked modules (services with network/SSE side effects) ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  // save-dismissed sweep (2026-11-05): components under test may now import the shared dismissal log helper.
  logSaveDismissed: vi.fn(() => Promise.resolve()),
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
      // Fail arm interpolates targetName + saveType away from the fixture defaults so
      // the :297 template is pinned, not a hardcoded byte (retired fiend-target arm's
      // duty folded in — same branch, single leg).
      arm: 'failed save',
      props: { targetName: 'Orc Warrior', saveType: 'DEX' },
      detail: { roll: 8, total: 10, success: false },
      copy: 'Orc Warrior failed DEX save — hurled through the lower planes.',
      notCopy: 'Orc Warrior succeeded on DEX save — resists the effect and is not hurled through the lower planes.',
    },
    {
      arm: 'succeeded save',
      props: {},
      detail: { roll: 15, total: 17, success: true },
      copy: 'Goblin1 succeeded on WIS save — resists the effect and is not hurled through the lower planes.',
      notCopy: 'Goblin1 failed WIS save — hurled through the lower planes.',
    },
  ])('$arm: exact result copy, Done-only actions, Done closes once', async ({ props: overrides, detail, copy, notCopy }) => {
    const props = makeProps(overrides);
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
