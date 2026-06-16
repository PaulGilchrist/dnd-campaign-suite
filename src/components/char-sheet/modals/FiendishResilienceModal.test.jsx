import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FiendishResilienceModal from './FiendishResilienceModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-warlock/fiendishResilienceHandler.js', () => ({
  applyTypeChoice: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import * as fiendishResilienceHandler from '../../../services/automation/handlers/class-warlock/fiendishResilienceHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Fiendish Resilience',
  automation: {
    type: 'choice',
    damageTypes: ['Acid', 'Fire', 'Cold'],
  },
};

const basePlayerStats = {
  name: 'Warlock1',
  level: 5,
  hitPoints: 30,
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

// ── Tests ──

describe('FiendishResilienceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal content container', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('renders modal header with action name', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    expect(screen.getByText('Fiendish Resilience')).toBeInTheDocument();
  });

  it('renders Font Awesome shield icon in header', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    expect(document.querySelector('.fa-solid.fa-shield-halved')).toBeInTheDocument();
  });

  it('defaults to "Fiendish Resilience" when action name is missing', () => {
    render(<FiendishResilienceModal {...makeProps({ action: null })} />);
    expect(screen.getByText('Fiendish Resilience')).toBeInTheDocument();
  });

  it('displays instruction text for new selection', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    expect(screen.getByText(/Choose one damage type/)).toBeInTheDocument();
  });

  it('displays instruction text with current type when existingType is set', () => {
    const actionWithExisting = {
      ...baseAction,
      existingType: 'Fire',
    };
    render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
    expect(screen.getByText(/Change damage type \(currently Fire\)/)).toBeInTheDocument();
  });

  it('renders damage type radio options', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    expect(screen.getByLabelText('Acid')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
    expect(screen.getByLabelText('Cold')).toBeInTheDocument();
  });

  it('marks existing type with "(current)" label when no selection made', () => {
    const actionWithExisting = {
      ...baseAction,
      existingType: 'Fire',
    };
    render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
    expect(screen.getByText('(current)')).toBeInTheDocument();
  });

  it('does not show "(current)" label when a type is selected', () => {
    const actionWithExisting = {
      ...baseAction,
      existingType: 'Fire',
    };
    render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    expect(screen.queryByText('(current)')).not.toBeInTheDocument();
  });

  it('uses default damage types when automation is missing', () => {
    render(<FiendishResilienceModal {...makeProps({ action: { name: 'Fiendish Resilience' } })} />);
    expect(screen.getByLabelText('Acid')).toBeInTheDocument();
    expect(screen.getByLabelText('Thunder')).toBeInTheDocument();
  });

  it('renders empty list when damageTypes is empty array', () => {
    render(<FiendishResilienceModal {...makeProps({ action: { name: 'Fiendish Resilience', automation: { damageTypes: [] } } })} />);
    const labels = document.querySelectorAll('label');
    expect(labels.length).toBe(0);
  });

  // ── Radio selection ──

  it('does not have a selected option on initial render', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    expect(document.querySelector('input[name="fiendishResilienceOption"]:checked')).toBeNull();
  });

  it('selects a radio option when clicked', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    expect(screen.getByLabelText('Acid')).toBeChecked();
  });

  it('changes selection when a different radio is clicked', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    expect(screen.getByLabelText('Acid')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByLabelText('Cold')).toBeChecked();
    expect(screen.getByLabelText('Acid')).not.toBeChecked();
  });

  it('allows selecting the existing type', () => {
    const actionWithExisting = {
      ...baseAction,
      existingType: 'Fire',
    };
    render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
    const labels = document.querySelectorAll('label');
    let fireLabel = null;
    labels.forEach(label => {
      if (label.textContent.includes('Fire')) {
        fireLabel = label;
      }
    });
    fireEvent.click(fireLabel);
    expect(fireLabel.style.border).toContain('var(--color-link)');
  });

  // ── Apply button ──

  it('renders apply button with "Choose Damage Type" text when no existing type', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeInTheDocument();
  });

  it('renders apply button with "Change Damage Type" text when existing type is set', () => {
    const actionWithExisting = {
      ...baseAction,
      existingType: 'Fire',
    };
    render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
    expect(screen.getByRole('button', { name: 'Change Damage Type' })).toBeInTheDocument();
  });

  it('renders Font Awesome shield icon on apply button', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    const applyBtn = screen.getByRole('button', { name: 'Choose Damage Type' });
    expect(applyBtn.querySelector('.fa-shield-halved')).toBeInTheDocument();
  });

  it('disables apply button when no option is selected', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeDisabled();
  });

  it('enables apply button when an option is selected', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeEnabled();
  });

  // ── Cancel button ──

  it('renders Cancel button', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<FiendishResilienceModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<FiendishResilienceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<FiendishResilienceModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Apply flow ──

  it('calls applyTypeChoice with correct parameters when apply is clicked', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    expect(fiendishResilienceHandler.applyTypeChoice).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign',
      'Acid'
    );
  });

  it('calls applyTypeChoice with existingType when changing damage type', async () => {
    const actionWithExisting = {
      ...baseAction,
      existingType: 'Fire',
    };
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Change Damage Type' }));
    });
    expect(fiendishResilienceHandler.applyTypeChoice).toHaveBeenCalledWith(
      actionWithExisting,
      basePlayerStats,
      'test-campaign',
      'Acid'
    );
  });

  it('does not call applyTypeChoice when no option is selected', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(null);
    render(<FiendishResilienceModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    expect(fiendishResilienceHandler.applyTypeChoice).not.toHaveBeenCalled();
  });

  it('shows result screen after successful apply', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Choose one damage type/)).not.toBeInTheDocument();
    });
  });

  it('displays result description from applyTypeChoice result', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Fiendish Resilience: Acid selected. You gain resistance to Acid damage.')).toBeInTheDocument();
    });
  });

  it('shows Done button after successful apply', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked', async () => {
    const onClose = vi.fn();
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides Cancel button after successful apply', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('hides selection options after successful apply', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Acid')).not.toBeInTheDocument();
    });
  });

  it('shows result modal header with action name', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Fiendish Resilience')).toBeInTheDocument();
    });
  });

  it('renders shield icon in result modal header', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    await waitFor(() => {
      expect(document.querySelector('.fa-solid.fa-shield-halved')).toBeInTheDocument();
    });
  });

  it('renders result with proper CSS classes', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });
  });

  it('renders result with custom action name', async () => {
    const customAction = { name: 'Custom Resilience', automation: { damageTypes: ['Fire'] } };
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Custom Resilience',
        description: 'Custom Resilience: Fire selected.',
      },
    });
    render(<FiendishResilienceModal {...makeProps({ action: customAction })} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Custom Resilience')).toBeInTheDocument();
    });
  });

  it('renders result with null action name fallback', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected.',
      },
    });
    render(<FiendishResilienceModal {...makeProps({ action: null })} />);
    // With null action, no damage types are shown so nothing to click
    // but the component should still render without crashing
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders all 12 default damage types when no custom types', () => {
    render(<FiendishResilienceModal {...makeProps({ action: { name: 'Fiendish Resilience', automation: {} } })} />);
    const expectedTypes = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
    expectedTypes.forEach(type => {
      expect(screen.getByLabelText(type)).toBeInTheDocument();
    });
  });

  it('renders only provided damage types', () => {
    render(<FiendishResilienceModal {...makeProps({ action: { name: 'Fiendish Resilience', automation: { damageTypes: ['Fire', 'Cold'] } } })} />);
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
    expect(screen.getByLabelText('Cold')).toBeInTheDocument();
    expect(screen.queryByLabelText('Acid')).not.toBeInTheDocument();
  });

  it('does not render result state on initial render', () => {
    render(<FiendishResilienceModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('calls applyTypeChoice only once on apply click', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    expect(fiendishResilienceHandler.applyTypeChoice).toHaveBeenCalledTimes(1);
  });

  it('passes campaignName to applyTypeChoice for change flow', async () => {
    const actionWithExisting = {
      ...baseAction,
      existingType: 'Fire',
    };
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Cold selected.',
      },
    });
    render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
    fireEvent.click(screen.getByLabelText('Cold'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Change Damage Type' }));
    });
    expect(fiendishResilienceHandler.applyTypeChoice).toHaveBeenCalledWith(
      actionWithExisting,
      basePlayerStats,
      'test-campaign',
      'Cold'
    );
  });

  it('passes playerStats to applyTypeChoice', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Fire selected.',
      },
    });
    const customPlayerStats = { name: 'Warlock2', level: 10, hitPoints: 50 };
    render(<FiendishResilienceModal {...makeProps({ playerStats: customPlayerStats })} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    expect(fiendishResilienceHandler.applyTypeChoice).toHaveBeenCalledWith(
      baseAction,
      customPlayerStats,
      'test-campaign',
      'Fire'
    );
  });

  it('renders result with dangerouslySetInnerHTML content', async () => {
    fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: '<strong>Fiendish Resilience:</strong> Acid selected. You gain resistance to <em>Acid</em> damage.',
      },
    });
    render(<FiendishResilienceModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Acid'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.querySelector('strong')).toBeInTheDocument();
      expect(body.querySelector('em')).toBeInTheDocument();
    });
  });
});
