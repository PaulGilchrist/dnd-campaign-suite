// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
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
  setRuntimeObject: vi.fn(),
}));

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

// ── beforeEach ──

describe('ClairvoyantCombatantModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Info screen rendering ──

  describe('info screen rendering', () => {
    it('renders uses text when uses are available', () => {
      const props = makeProps({ currentUses: 1, maxUses: 3 });
      renderModal(props);
      expect(screen.getByText(/Uses available: 2 \/ 3/)).toBeInTheDocument();
    });

    it('renders no uses message when currentUses equals maxUses', () => {
      const props = makeProps({ currentUses: 3, maxUses: 3 });
      renderModal(props);
      expect(screen.getByText(/No uses remaining/)).toBeInTheDocument();
    });
  });

  // ── Custom action name ──

  describe('custom action name', () => {
    it('renders custom action name when provided', () => {
      const props = makeProps({ action: { name: 'Awakened Mind' } });
      renderModal(props);
      expect(screen.getByText('Awakened Mind')).toBeInTheDocument();
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onClose when cancel button is clicked', () => {
      const onClose = vi.fn();
      const props = makeProps({ currentUses: 1, maxUses: 3, onClose });
      renderModal(props);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
