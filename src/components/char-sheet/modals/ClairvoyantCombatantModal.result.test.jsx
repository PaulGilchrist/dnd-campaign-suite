// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ClairvoyantCombatantModal from './ClairvoyantCombatantModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  clearRuntimeState: vi.fn(),
}));

// ── Re-import mocked modules ──

import { addEntry } from '../../../services/ui/logService.js';

// ── Test fixtures ──

const baseAction = { name: 'Clairvoyant Combatant' };
const basePlayerStats = { name: 'Paladin1', level: 5 };

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  targetName: 'Goblin1',
  saveType: 'Wisdom',
  saveDc: 13,
  currentUses: 0,
  maxUses: 3,
  pactSlotLevel: 0,
  pactSlotsAvailable: false,
  pactMagicRecharge: false,
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(props) {
  return render(<ClairvoyantCombatantModal {...props} />);
}

function dispatchSaveEvent(success, overrides = {}) {
  window.dispatchEvent(
    new CustomEvent('save-result', {
      detail: {
        promptId: 'test-prompt-id',
        roll: success ? 10 : 5,
        total: success ? 15 : 10,
        success,
        ...overrides,
      },
    }),
  );
}

// ── beforeEach ──

describe('ClairvoyantCombatantModal - result screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Result screen: save failure ──

  describe('save failure', () => {
    it('displays failure description with target name and effect status', async () => {
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await new Promise(r => setTimeout(r, 10));
      dispatchSaveEvent(false);

      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.textContent).toContain('Goblin1 failed');
        expect(body.textContent).toContain('Clairvoyant Combatant active');
      });
    });

    it('closes when Done button is clicked', async () => {
      const onClose = vi.fn();
      const props = makeProps({ currentUses: 1, maxUses: 3, onClose });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await new Promise(r => setTimeout(r, 10));
      dispatchSaveEvent(false);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when overlay is clicked', async () => {
      const onClose = vi.fn();
      const props = makeProps({ currentUses: 1, maxUses: 3, onClose });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await new Promise(r => setTimeout(r, 10));
      dispatchSaveEvent(false);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('does not close when modal content is clicked', async () => {
      const onClose = vi.fn();
      const props = makeProps({ currentUses: 1, maxUses: 3, onClose });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await new Promise(r => setTimeout(r, 10));
      dispatchSaveEvent(false);

      await waitFor(() => {
        const modal = document.querySelector('.sp-modal');
        fireEvent.click(modal);
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('adds failure save_result log entry with correct details', async () => {
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await new Promise(r => setTimeout(r, 10));
      dispatchSaveEvent(false);

      await waitFor(() => {
        const saveResultCalls = addEntry.mock.calls.filter(
          c => c[1] && c[1].type === 'save_result' && c[1].success === false,
        );
        expect(saveResultCalls.length).toBeGreaterThan(0);
        const match = saveResultCalls.find(
          c =>
            c[1].targetName === 'Goblin1' &&
            c[1].saveType === 'Wisdom' &&
            c[1].saveDc === 13,
        );
        expect(match).toBeDefined();
      });
    });
  });

  // ── Result screen: successful save ──

  describe('save success', () => {
    it('displays success description with target name and no-effect message', async () => {
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await new Promise(r => setTimeout(r, 10));
      dispatchSaveEvent(true);

      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.textContent).toContain('Goblin1 succeeded');
        expect(body.textContent).toContain('no effect');
      });
    });

    it('adds success save_result log entry with correct details', async () => {
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));

      await new Promise(r => setTimeout(r, 10));
      dispatchSaveEvent(true);

      await waitFor(() => {
        const saveResultCalls = addEntry.mock.calls.filter(
          c => c[1] && c[1].type === 'save_result' && c[1].success === true,
        );
        expect(saveResultCalls.length).toBeGreaterThan(0);
        const match = saveResultCalls.find(
          c =>
            c[1].targetName === 'Goblin1' &&
            c[1].saveType === 'Wisdom' &&
            c[1].saveDc === 13,
        );
        expect(match).toBeDefined();
      });
    });
  });
});
