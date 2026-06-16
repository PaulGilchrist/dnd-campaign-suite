import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GnomishLineageModal from './GnomishLineageModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-other/gnomishLineageHandler.js', () => ({
  confirmGnomishLineage: vi.fn(async () => ({
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Gnomish Lineage',
      description: 'Selected Deep Gnome lineage. Spellcasting ability: Intelligence.',
      automation: { type: 'gnomish_lineage', options: [] },
    },
  })),
}));

// ── Re-import mocked modules ──

import { confirmGnomishLineage } from '../../../services/automation/handlers/class-other/gnomishLineageHandler.js';

// ── Test fixtures ──

const baseProps = {
  action: { name: 'Gnomish Lineage' },
  playerStats: { name: 'GnomeWizard', level: 1 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('GnomishLineageModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay and header with title', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    expect(screen.getByText('Gnomish Lineage')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders Font Awesome dragon icon in header', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    const icon = document.querySelector('.fa-dragon');
    expect(icon).toBeInTheDocument();
  });

  it('renders instruction paragraph', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    expect(screen.getByText(/Choose a gnomish lineage/)).toBeInTheDocument();
  });

  it('renders all three lineage options', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    expect(screen.getByText('Deep Gnome')).toBeInTheDocument();
    expect(screen.getByText('Forest Gnome')).toBeInTheDocument();
    expect(screen.getByText('Rock Gnome')).toBeInTheDocument();
  });

  it('renders Font Awesome icons for each lineage option', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    expect(document.querySelector('.fa-eye')).toBeInTheDocument();
    expect(document.querySelector('.fa-tree')).toBeInTheDocument();
    expect(document.querySelector('.fa-hammer')).toBeInTheDocument();
  });

  it('renders lineage descriptions', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    expect(screen.getByText(/Darkvision 120 ft/)).toBeInTheDocument();
    expect(screen.getByText(/Hide behind larger creatures/)).toBeInTheDocument();
    expect(screen.getByText(/Move through larger creatures/)).toBeInTheDocument();
  });

  it('renders spellcasting ability for each lineage', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    const abilities = screen.getAllByText(/Spellcasting ability: Intelligence/);
    expect(abilities).toHaveLength(3);
  });

  it('renders Select Lineage button disabled by default', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    const selectBtn = screen.getByRole('button', { name: /Select Lineage/ });
    expect(selectBtn).toBeDisabled();
  });

  it('renders Cancel button', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders Font Awesome dragon icon on Select Lineage button', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    const icon = screen.getByRole('button', { name: /Select Lineage/ }).querySelector('.fa-dragon');
    expect(icon).toBeInTheDocument();
  });

  // ── Modal CSS classes ──

  it('renders modal with proper CSS classes', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<GnomishLineageModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<GnomishLineageModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<GnomishLineageModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Lineage selection ──

  it('does not show any lineage selected on initial render', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="gnomishLineageOption"]');
    radios.forEach(radio => expect(radio).not.toBeChecked());
  });

  it('selects Deep Gnome when clicked', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    const radios = document.querySelectorAll('input[name="gnomishLineageOption"]');
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
    expect(radios[2]).not.toBeChecked();
  });

  it('selects Forest Gnome when clicked', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Forest Gnome'));
    const radios = document.querySelectorAll('input[name="gnomishLineageOption"]');
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
    expect(radios[2]).not.toBeChecked();
  });

  it('selects Rock Gnome when clicked', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Rock Gnome'));
    const radios = document.querySelectorAll('input[name="gnomishLineageOption"]');
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).not.toBeChecked();
    expect(radios[2]).toBeChecked();
  });

  it('enables Select Lineage button after selection', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    const selectBtn = screen.getByRole('button', { name: /Select Lineage/ });
    expect(selectBtn).not.toBeDisabled();
  });

  it('switches selection when a different lineage is clicked', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    fireEvent.click(screen.getByText('Forest Gnome'));
    const radios = document.querySelectorAll('input[name="gnomishLineageOption"]');
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
    expect(radios[2]).not.toBeChecked();
  });

  // ── Apply lineage flow ──

  it('calls confirmGnomishLineage with correct args when Deep Gnome is selected', async () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    expect(confirmGnomishLineage).toHaveBeenCalledWith(
      { name: 'GnomeWizard', level: 1 },
      'Deep Gnome',
      'test-campaign'
    );
  });

  it('calls confirmGnomishLineage with correct args when Forest Gnome is selected', async () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Forest Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    expect(confirmGnomishLineage).toHaveBeenCalledWith(
      { name: 'GnomeWizard', level: 1 },
      'Forest Gnome',
      'test-campaign'
    );
  });

  it('calls confirmGnomishLineage with correct args when Rock Gnome is selected', async () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Rock Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    expect(confirmGnomishLineage).toHaveBeenCalledWith(
      { name: 'GnomeWizard', level: 1 },
      'Rock Gnome',
      'test-campaign'
    );
  });

  it('does not call confirmGnomishLineage when no lineage is selected', async () => {
    render(<GnomishLineageModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    expect(confirmGnomishLineage).not.toHaveBeenCalled();
  });

  // ── Result state ──

  it('shows result state after applying lineage', async () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Selected Deep Gnome lineage/)).toBeInTheDocument();
    });
  });

  it('shows lineage result description in result body', async () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Spellcasting ability: Intelligence/)).toBeInTheDocument();
    });
  });

  it('renders Done button after applying lineage', async () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides Select Lineage button after applying lineage', async () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Select Lineage/ })).not.toBeInTheDocument();
    });
  });

  it('hides Cancel button after applying lineage', async () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('hides lineage options after applying lineage', async () => {
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Choose a gnomish lineage/)).not.toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after applying lineage', async () => {
    const onClose = vi.fn();
    render(<GnomishLineageModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Done button is clicked via overlay', async () => {
    const onClose = vi.fn();
    render(<GnomishLineageModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside modal after applying lineage', async () => {
    const onClose = vi.fn();
    render(<GnomishLineageModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Deep Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-modal'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Result state with different lineage ──

  it('shows Forest Gnome result description after applying', async () => {
    confirmGnomishLineage.mockResolvedValueOnce({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Gnomish Lineage', description: 'Selected Forest Gnome lineage. Spellcasting ability: Intelligence.', automation: { type: 'gnomish_lineage', options: [] } },
    });
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Forest Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Selected Forest Gnome lineage/)).toBeInTheDocument();
    });
  });

  it('shows Rock Gnome result description after applying', async () => {
    confirmGnomishLineage.mockResolvedValueOnce({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Gnomish Lineage', description: 'Selected Rock Gnome lineage. Spellcasting ability: Intelligence.', automation: { type: 'gnomish_lineage', options: [] } },
    });
    render(<GnomishLineageModal {...makeProps()} />);
    fireEvent.click(screen.getByText('Rock Gnome'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Selected Rock Gnome lineage/)).toBeInTheDocument();
    });
  });

  // ── Edge cases ──

  it('renders with all three lineage radio inputs', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="gnomishLineageOption"]');
    expect(radios).toHaveLength(3);
  });

  it('does not show result on initial render', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    expect(screen.queryByText(/Selected.*lineage/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('renders selection description text for each lineage', () => {
    render(<GnomishLineageModal {...makeProps()} />);
    expect(screen.getByText(/Darkvision 120 ft/)).toBeInTheDocument();
    expect(screen.getByText(/Magic Stone cantrip/)).toBeInTheDocument();
    expect(screen.getByText(/Hide behind larger creatures/)).toBeInTheDocument();
    expect(screen.getByText(/Minor Illusion cantrip/)).toBeInTheDocument();
    expect(screen.getByText(/Move through larger creatures/)).toBeInTheDocument();
    expect(screen.getByText(/Mending cantrip/)).toBeInTheDocument();
  });
});
