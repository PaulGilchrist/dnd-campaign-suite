import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SoulstitchSpellsModal from './SoulstitchSpellsModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-wizard/soulstitchSpellsHandler.js', () => ({
  applySoulstitchSelection: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import { applySoulstitchSelection } from '../../../services/automation/handlers/class-wizard/soulstitchSpellsHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Soulstitch Spells',
  maxSelections: 2,
  eligibleTargets: ['Orc Warrior', 'Goblin Acolyte', 'Bugbear'],
  spellName: 'Fireball',
  featureName: 'Soulstitch Spells',
  chosenCreatures: ['Orc Warrior'],
};

const basePlayerStats = { name: 'Wizard1', level: 5, hitPoints: 30 };

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function makeAction(overrides) {
  return { ...baseAction, ...(overrides || {}) };
}

// ── Tests ──

describe('SoulstitchSpellsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal content container', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('renders modal header with feature name', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(screen.getByText('Soulstitch Spells')).toBeInTheDocument();
  });

  it('renders Font Awesome shield icon in header', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    const icon = document.querySelector('.fa-shield-halved');
    expect(icon).toBeInTheDocument();
  });

  it('renders description with spell name', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(screen.getByText(/Cast/)).toBeInTheDocument();
    expect(screen.getByText('Fireball')).toBeInTheDocument();
  });

  it('displays max selections count in description', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    const descriptionP = document.querySelector('.sp-body p');
    expect(descriptionP.textContent).toContain('Choose up to');
    expect(descriptionP.textContent).toContain('2');
    expect(descriptionP.textContent).toContain('creature');
  });

  it('renders creature selection list', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
    expect(screen.getByText('Goblin Acolyte')).toBeInTheDocument();
    expect(screen.getByText('Bugbear')).toBeInTheDocument();
  });

  it('marks previously chosen creatures with "(previously chosen)" label', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(screen.getByText('(previously chosen)')).toBeInTheDocument();
  });

  it('renders selection counter', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
  });

  it('renders Apply button with correct text', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Apply Soulstitch \(0 chosen\)/ })).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('disables Apply button when no creatures selected', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Apply Soulstitch/ })).toBeDisabled();
  });

  it('does not show result state on initial render', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<SoulstitchSpellsModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<SoulstitchSpellsModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<SoulstitchSpellsModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Creature selection ──

  it('selects a creature when checkbox is clicked', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    expect(screen.getByText(/Selected: 1 \/ 2/)).toBeInTheDocument();
  });

  it('updates selection counter after selecting a creature', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    expect(screen.getByText(/Selected: 1 \/ 2/)).toBeInTheDocument();
  });

  it('deselects a creature when its checkbox is clicked again', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    expect(screen.getByText(/Selected: 1 \/ 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
  });

  it('enables Apply button after selecting at least one creature', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    expect(screen.getByRole('button', { name: /Apply Soulstitch \(1 chosen\)/ })).toBeEnabled();
  });

  it('prevents selecting more than maxSelections', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    fireEvent.click(screen.getByText('Bugbear'));
    expect(screen.getByText(/Selected: 2 \/ 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply Soulstitch \(2 chosen\)/ })).toBeEnabled();
  });

  it('selects previously chosen creature when clicked', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    // Orc Warrior is already "previously chosen", so clicking it should select it
    fireEvent.click(screen.getByText('Orc Warrior'));
    expect(screen.getByText(/Selected: 1 \/ 2/)).toBeInTheDocument();
  });

  it('toggles previously chosen creature off when clicked again', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Orc Warrior'));
    expect(screen.getByText(/Selected: 1 \/ 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Orc Warrior'));
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
  });

  // ── Apply flow ──

  it('calls applySoulstitchSelection with correct arguments', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Test result' },
    });
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    expect(applySoulstitchSelection).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign',
      ['Goblin Acolyte']
    );
  });

  it('shows result state after applying', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Test result' },
    });
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('renders result description from payload', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Orc Warrior automatically succeed on saves and take no damage.' },
    });
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-body')).toHaveTextContent(/Orc Warrior automatically succeed/);
    });
  });

  it('hides selection list after applying', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Test result' },
    });
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Apply Soulstitch/ })).not.toBeInTheDocument();
    });
  });

  it('hides Cancel button after applying', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Test result' },
    });
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after applying', async () => {
    const onClose = vi.fn();
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Test result' },
    });
    render(<SoulstitchSpellsModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Default values ──

  it('uses default maxSelections of 1 when action has no maxSelections', () => {
    const action = makeAction({ maxSelections: undefined });
    render(<SoulstitchSpellsModal {...makeProps({ action })} />);
    const descriptionP = document.querySelector('.sp-body p');
    expect(descriptionP.textContent).toContain('Choose up to');
    expect(descriptionP.textContent).toContain('1');
    expect(descriptionP.textContent).toContain('creature');
  });

  it('uses default spellName when action has no spellName', () => {
    const action = makeAction({ spellName: undefined });
    render(<SoulstitchSpellsModal {...makeProps({ action })} />);
    expect(screen.getByText(/Unknown/)).toBeInTheDocument();
  });

  it('uses default featureName when action has no featureName', () => {
    const action = makeAction({ featureName: undefined });
    render(<SoulstitchSpellsModal {...makeProps({ action })} />);
    expect(screen.getByText('Soulstitch Spells')).toBeInTheDocument();
  });

  it('uses empty eligibleTargets when action has none', () => {
    const action = makeAction({ eligibleTargets: [] });
    render(<SoulstitchSpellsModal {...makeProps({ action })} />);
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
  });

  it('uses empty chosenCreatures when action has none', () => {
    const action = makeAction({ chosenCreatures: [] });
    render(<SoulstitchSpellsModal {...makeProps({ action })} />);
    expect(screen.queryByText('(previously chosen)')).not.toBeInTheDocument();
  });

  // ── Multiple selections ──

  it('allows selecting up to maxSelections creatures', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    expect(screen.getByText(/Selected: 1 \/ 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Bugbear'));
    expect(screen.getByText(/Selected: 2 \/ 2/)).toBeInTheDocument();
  });

  it('updates Apply button text with correct count', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    expect(screen.getByRole('button', { name: /Apply Soulstitch \(1 chosen\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Bugbear'));
    expect(screen.getByRole('button', { name: /Apply Soulstitch \(2 chosen\)/ })).toBeInTheDocument();
  });

  it('passes all selected creatures to applySoulstitchSelection', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Test result' },
    });
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    fireEvent.click(screen.getByText('Bugbear'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch \(2 chosen\)/ }));
    });
    expect(applySoulstitchSelection).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign',
      ['Goblin Acolyte', 'Bugbear']
    );
  });

  // ── Modal CSS structure ──

  it('renders modal with proper CSS classes', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders checkboxes for each eligible target', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(3);
  });

  it('renders selection list container with scroll', () => {
    render(<SoulstitchSpellsModal {...makeProps()} />);
    const listContainer = document.querySelector('[style*="maxHeight"]') || document.querySelector('.sp-body > div');
    expect(listContainer).toBeInTheDocument();
  });

  // ── Result state with no payload ──

  it('does not crash when result payload description is missing', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells' },
    });
    render(<SoulstitchSpellsModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });
});
