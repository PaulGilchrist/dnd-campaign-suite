import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BoonOfEnergyResistanceModal from './BoonOfEnergyResistanceModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/reactions/boonOfEnergyResistanceHandler.js', () => ({
  applyTypeChoice: vi.fn(),
}));

vi.mock('../../../../services/automation/common/choiceStorage.js', () => ({
  setChosenRuntimeValue: vi.fn(),
  getChosenRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import * as boonHandler from '../../../../services/automation/handlers/reactions/boonOfEnergyResistanceHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Boon Of Energy Resistance',
  damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning'],
  maxSelections: 2,
};

const basePlayerStats = {
  name: 'TestCharacter',
  level: 5,
};

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
  const base = { ...baseAction };
  if (overrides) {
    for (const key of Object.keys(overrides)) {
      if (typeof overrides[key] === 'object' && !Array.isArray(overrides[key]) && overrides[key] !== null) {
        base[key] = { ...base[key], ...overrides[key] };
      } else {
        base[key] = overrides[key];
      }
    }
  }
  return base;
}

// ── Tests ──

describe('BoonOfEnergyResistanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    boonHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Boon Of Energy Resistance',
        description: 'Fire selected. You gain resistance to these damage types.',
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal container', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('renders modal header', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
  });

  it('renders modal body', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
  });

  it('renders modal actions', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders header with shield icon and action name', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    const icon = document.querySelector('.fa-shield-halved');
    expect(icon).toBeInTheDocument();
    expect(screen.getByText('Boon Of Energy Resistance')).toBeInTheDocument();
  });

  it('renders damage type selection instructions when no existing types', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(screen.getByText(/Choose 2 damage types/)).toBeInTheDocument();
  });

  it('shows selection counter', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
  });

  it('renders all damage types as checkboxes', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(screen.getByLabelText('Acid')).toBeInTheDocument();
    expect(screen.getByLabelText('Cold')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
    expect(screen.getByLabelText('Lightning')).toBeInTheDocument();
  });

  it('does not render damage types not in action.damageTypes', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(screen.queryByLabelText('Necrotic')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Poison')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Psychic')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Radiant')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Thunder')).not.toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders apply button with correct label for new selection', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Choose Damage Types' })).toBeInTheDocument();
  });

  it('disables apply button when no types selected', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    const applyBtn = screen.getByRole('button', { name: 'Choose Damage Types' });
    expect(applyBtn).toBeDisabled();
  });

  it('renders Font Awesome shield icon in header', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    const icon = document.querySelector('.fa-shield-halved');
    expect(icon).toBeInTheDocument();
  });

  it('renders Font Awesome shield icon on apply button', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    const icon = document.querySelector('.sp-roll-btn .fa-shield-halved');
    expect(icon).toBeInTheDocument();
  });

  // ── Default values when action is null/missing ──

  it('uses default damage types when action is null', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: null })} />);
    expect(screen.getByLabelText('Acid')).toBeInTheDocument();
    expect(screen.getByLabelText('Thunder')).toBeInTheDocument();
  });

  it('uses default max selection of 2 when action.maxSelections is missing', () => {
    const actionWithoutMax = { name: 'Test', damageTypes: ['Fire'] };
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: actionWithoutMax })} />);
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
  });

  it('uses default action name when action.name is missing', () => {
    const actionWithoutName = { damageTypes: ['Fire'] };
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: actionWithoutName })} />);
    expect(screen.getByText('Boon Of Energy Resistance')).toBeInTheDocument();
  });

  // ── Existing types display ──

  it('shows change instruction when existing types provided', () => {
    const actionWithExisting = makeAction({
      existingTypes: ['Fire', 'Cold'],
    });
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: actionWithExisting })} />);
    expect(screen.getByText(/Change your chosen damage types/)).toBeInTheDocument();
    expect(screen.getByText(/currently Fire, Cold/)).toBeInTheDocument();
  });

  it('marks existing types with "current" label', () => {
    const actionWithExisting = makeAction({
      existingTypes: ['Fire'],
    });
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: actionWithExisting })} />);
    expect(screen.getByText('(current)')).toBeInTheDocument();
  });

  it('renders apply button with change label when existing types provided', () => {
    const actionWithExisting = makeAction({
      existingTypes: ['Fire'],
    });
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: actionWithExisting })} />);
    expect(screen.getByRole('button', { name: 'Change Damage Types' })).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<BoonOfEnergyResistanceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<BoonOfEnergyResistanceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<BoonOfEnergyResistanceModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Checkbox selection ──

  it('selects a damage type when its checkbox is clicked', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByLabelText('Fire')).toBeChecked();
  });

  it('updates selection counter after selecting a type', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByText(/Selected: 1 \/ 2/)).toBeInTheDocument();
  });

  it('deselects a damage type when its checkbox is clicked again', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByLabelText('Fire')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByLabelText('Fire')).not.toBeChecked();
  });

  it('updates selection counter to 0 after deselecting', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
  });

  it('allows selecting up to maxSelections types', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByText(/Selected: 2 \/ 2/)).toBeInTheDocument();
  });

  it('prevents selecting more than maxSelections types', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    fireEvent.click(screen.getByLabelText('Cold'));
    fireEvent.click(screen.getByLabelText('Acid'));
    expect(screen.getByLabelText('Acid')).not.toBeChecked();
    expect(screen.getByText(/Selected: 2 \/ 2/)).toBeInTheDocument();
  });

  it('disables checkboxes for unselected types when at max', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByLabelText('Acid')).toBeDisabled();
    expect(screen.getByLabelText('Lightning')).toBeDisabled();
  });

  it('does not disable checkboxes for already selected types when at max', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByLabelText('Fire')).not.toBeDisabled();
    expect(screen.getByLabelText('Cold')).not.toBeDisabled();
  });

  it('allows deselecting a type when at max to make room for another', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByLabelText('Acid')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByLabelText('Acid')).not.toBeDisabled();
  });

  it('selects a different type after deselecting one', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    fireEvent.click(screen.getByLabelText('Cold'));
    fireEvent.click(screen.getByLabelText('Fire'));
    fireEvent.click(screen.getByLabelText('Acid'));
    expect(screen.getByLabelText('Acid')).toBeChecked();
    expect(screen.getByLabelText('Fire')).not.toBeChecked();
  });

  // ── Apply flow ──

  it('does not call applyTypeChoice when no types are selected', async () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
    });
    expect(boonHandler.applyTypeChoice).not.toHaveBeenCalled();
  });

  it('calls applyTypeChoice when types are selected and apply is clicked', async () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    fireEvent.click(screen.getByLabelText('Cold'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
    });
    expect(boonHandler.applyTypeChoice).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign',
      ['Fire', 'Cold']
    );
  });

  it('shows applied state after successful apply', async () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Choose Damage Types/)).not.toBeInTheDocument();
    });
  });

  it('displays result description after apply', async () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body).toBeInTheDocument();
    });
  });

  it('shows Done button after apply', async () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides Cancel button after apply', async () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('hides selection UI after apply', async () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Selected: 1 \/ 2/)).not.toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after apply', async () => {
    const onClose = vi.fn();
    render(<BoonOfEnergyResistanceModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders result with dangerouslySetInnerHTML content', async () => {
    const mockResult = {
      payload: {
        description: '<p>Fire and Cold selected.</p>',
      },
    };
    boonHandler.applyTypeChoice.mockResolvedValue(mockResult);
    const { getByLabelText } = render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    fireEvent.click(getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.innerHTML).toContain('<p>Fire and Cold selected.</p>');
    });
  });

  // ── Apply with existing types ──

  it('calls applyTypeChoice with existing types action', async () => {
    const actionWithExisting = makeAction({
      existingTypes: ['Fire'],
    });
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: actionWithExisting })} />);
    fireEvent.click(screen.getByLabelText('Cold'));
    fireEvent.click(screen.getByLabelText('Lightning'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Change Damage Types' }));
    });
    expect(boonHandler.applyTypeChoice).toHaveBeenCalledWith(
      actionWithExisting,
      basePlayerStats,
      'test-campaign',
      ['Cold', 'Lightning']
    );
  });

  // ── Custom maxSelections ──

  it('respects custom maxSelections value', () => {
    const actionWithMax3 = makeAction({ maxSelections: 3 });
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: actionWithMax3 })} />);
    expect(document.querySelector('.sp-body').textContent).toContain('Selected: 0 / 3');
  });

  it('allows selecting up to custom maxSelections', () => {
    const actionWithMax3 = makeAction({ maxSelections: 3 });
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: actionWithMax3 })} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    fireEvent.click(screen.getByLabelText('Cold'));
    fireEvent.click(screen.getByLabelText('Acid'));
    expect(screen.getByText(/Selected: 3 \/ 3/)).toBeInTheDocument();
    expect(screen.getByLabelText('Lightning')).toBeDisabled();
  });

  // ── Edge cases ──

  it('renders with empty damageTypes array', () => {
    const actionEmptyTypes = makeAction({ damageTypes: [] });
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: actionEmptyTypes })} />);
    const typeLabels = document.querySelectorAll('label');
    expect(typeLabels.length).toBe(0);
  });

  it('renders with empty existingTypes array as no existing', () => {
    const actionEmptyExisting = makeAction({ existingTypes: [] });
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: actionEmptyExisting })} />);
    expect(document.querySelector('.sp-body').textContent).toContain('Choose 2 damage types');
    expect(screen.queryByText(/(current)/)).not.toBeInTheDocument();
  });

  it('renders with all default damage types when action is null', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps({ action: null })} />);
    expect(screen.getByLabelText('Acid')).toBeInTheDocument();
    expect(screen.getByLabelText('Cold')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
    expect(screen.getByLabelText('Lightning')).toBeInTheDocument();
    expect(screen.getByLabelText('Necrotic')).toBeInTheDocument();
    expect(screen.getByLabelText('Poison')).toBeInTheDocument();
    expect(screen.getByLabelText('Psychic')).toBeInTheDocument();
    expect(screen.getByLabelText('Radiant')).toBeInTheDocument();
    expect(screen.getByLabelText('Thunder')).toBeInTheDocument();
  });

  it('does not show applied state on initial render', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('shows selection UI on initial render', () => {
    render(<BoonOfEnergyResistanceModal {...makeProps()} />);
    expect(document.querySelector('.sp-body').textContent).toContain('Choose 2 damage types');
    expect(screen.getByRole('button', { name: 'Choose Damage Types' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
