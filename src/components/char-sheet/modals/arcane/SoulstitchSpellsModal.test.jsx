// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SoulstitchSpellsModal from './SoulstitchSpellsModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-wizard/soulstitchSpellsHandler.js', () => ({
  applySoulstitchSelection: vi.fn(),
}));

vi.mock('../../../../services/rules/spells/postCastRiderService.js', () => ({
  confirmSoulstitchSelection: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import { applySoulstitchSelection } from '../../../../services/automation/handlers/class-wizard/soulstitchSpellsHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Soulstitch Spells',
  automation: { type: 'soulstitch_spells' },
};

const basePlayerStats = { name: 'Wizard1', level: 5, hitPoints: 30 };

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  maxSelections: 2,
  eligibleTargets: ['Orc Warrior', 'Goblin Acolyte', 'Bugbear'],
  spellName: 'Fireball',
  featureName: 'Soulstitch Spells',
  chosenCreatures: ['Orc Warrior'],
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('SoulstitchSpellsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay, container, and all CSS class sections', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders modal header with feature name and shield icon', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    expect(screen.getByText('Soulstitch Spells')).toBeInTheDocument();
    expect(document.querySelector('.fa-shield-halved')).toBeInTheDocument();
  });

  it('renders description with spell name and selection instructions', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(screen.getByText(/Cast/)).toBeInTheDocument();
    const descriptionP = document.querySelector('.sp-body p');
    expect(descriptionP.textContent).toContain('Choose up to');
    expect(descriptionP.textContent).toContain('2');
    expect(descriptionP.textContent).toContain('creature');
  });

  it('renders all eligible targets as selectable entries', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
    expect(screen.getByText('Goblin Acolyte')).toBeInTheDocument();
    expect(screen.getByText('Bugbear')).toBeInTheDocument();
  });

  it('marks previously chosen creatures with "(previously chosen)" label', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    expect(screen.getByText('(previously chosen)')).toBeInTheDocument();
  });

  it('renders selection counter and action buttons', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply Soulstitch \(0 chosen\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('disables Apply button when no creatures selected', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    expect(screen.getByRole('button', { name: /Apply Soulstitch/ })).toBeDisabled();
  });

  it('does not show result state on initial render', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('renders a checkbox for each eligible target', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(3);
  });

  it('does not show "(previously chosen)" when chosenCreatures is empty', () => {
    render(<SoulstitchSpellsModal {...makeProps({ chosenCreatures: [] })} />);
    expect(screen.queryByText('(previously chosen)')).not.toBeInTheDocument();
  });

  it('renders no creature entries when eligibleTargets is empty', () => {
    render(<SoulstitchSpellsModal {...makeProps({ eligibleTargets: [] })} />);
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });

  it('uses all eligible checkboxes when maxSelections is larger than target count', () => {
    render(<SoulstitchSpellsModal {...makeProps({ maxSelections: 5 })} />);
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(3);
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<SoulstitchSpellsModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Creature selection ──

  it('toggles creature selection on and off via label click', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    expect(screen.getByText(/Selected: 1 \/ 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
  });

  it('toggles previously chosen creature on and off when clicked', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    fireEvent.click(screen.getByText('Orc Warrior'));
    expect(screen.getByText(/Selected: 1 \/ 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Orc Warrior'));
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
  });

  it('enables Apply button after selecting at least one creature', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    expect(screen.getByRole('button', { name: /Apply Soulstitch \(1 chosen\)/ })).toBeEnabled();
  });

  it('updates Apply button text with selection count', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    expect(screen.getByRole('button', { name: /Apply Soulstitch \(1 chosen\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Bugbear'));
    expect(screen.getByRole('button', { name: /Apply Soulstitch \(2 chosen\)/ })).toBeInTheDocument();
  });

  it('prevents selecting more than maxSelections and disables unselected checkboxes', () => {
    render(<SoulstitchSpellsModal {...baseProps} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    fireEvent.click(screen.getByText('Bugbear'));
    expect(screen.getByText(/Selected: 2 \/ 2/)).toBeInTheDocument();
    const orcCheckbox = screen.getByText('Orc Warrior').previousElementSibling;
    expect(orcCheckbox).toHaveAttribute('disabled');
  });

  it('respects maxSelections of 1 and replaces selection when clicking another', () => {
    render(<SoulstitchSpellsModal {...makeProps({ maxSelections: 1, eligibleTargets: ['A', 'B', 'C'] })} />);
    fireEvent.click(screen.getByText('A'));
    expect(screen.getByText(/Selected: 1 \/ 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('B'));
    expect(screen.getByText(/Selected: 1 \/ 1/)).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  // ── Apply flow ──

  it('calls applySoulstitchSelection with correct arguments and selection order', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Test result' },
    });
    render(<SoulstitchSpellsModal {...baseProps} />);
    fireEvent.click(screen.getByText('Bugbear'));
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch \(2 chosen\)/ }));
    });
    expect(applySoulstitchSelection).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign',
      ['Bugbear', 'Goblin Acolyte']
    );
  });

  it('calls confirmSoulstitchSelection with selected names on apply', async () => {
    const { confirmSoulstitchSelection } = await import('../../../../services/rules/spells/postCastRiderService.js');
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Test result' },
    });
    render(<SoulstitchSpellsModal {...baseProps} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    fireEvent.click(screen.getByText('Bugbear'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch \(2 chosen\)/ }));
    });
    expect(confirmSoulstitchSelection).toHaveBeenCalledWith(['Goblin Acolyte', 'Bugbear']);
  });

  it('shows result state after applying and hides selection controls', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Test result' },
    });
    render(<SoulstitchSpellsModal {...baseProps} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Apply Soulstitch/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('renders result description from payload using dangerouslySetInnerHTML', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Orc Warrior automatically succeed on saves and take no damage.' },
    });
    render(<SoulstitchSpellsModal {...baseProps} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-body')).toHaveTextContent(/Orc Warrior automatically succeed/);
    });
  });

  it('shows result state even when result.payload.description is undefined', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells' },
    });
    render(<SoulstitchSpellsModal {...baseProps} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('renders result header with featureName', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Test result' },
    });
    render(<SoulstitchSpellsModal {...makeProps({ featureName: 'My Soulstitch Feature' })} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('My Soulstitch Feature')).toBeInTheDocument();
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

  it('shows info popup when handler returns no-creatures-chosen message', async () => {
    applySoulstitchSelection.mockResolvedValue({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Soulstitch Spells', description: 'Soulstitch Spells: No creatures chosen.' },
    });
    render(<SoulstitchSpellsModal {...baseProps} />);
    fireEvent.click(screen.getByText('Goblin Acolyte'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply Soulstitch/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-body')).toHaveTextContent(/No creatures chosen/);
    });
  });

  // ── Default values ──

  it('uses default maxSelections of 1 when not provided', () => {
    render(<SoulstitchSpellsModal {...makeProps({ maxSelections: undefined })} />);
    const descriptionP = document.querySelector('.sp-body p');
    expect(descriptionP.textContent).toContain('Choose up to');
    expect(descriptionP.textContent).toContain('1');
    expect(descriptionP.textContent).toContain('creature');
  });

  it('uses default spellName when not provided', () => {
    render(<SoulstitchSpellsModal {...makeProps({ spellName: undefined })} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('uses default featureName when not provided', () => {
    render(<SoulstitchSpellsModal {...makeProps({ featureName: undefined })} />);
    expect(screen.getByText('Soulstitch Spells')).toBeInTheDocument();
  });
});
