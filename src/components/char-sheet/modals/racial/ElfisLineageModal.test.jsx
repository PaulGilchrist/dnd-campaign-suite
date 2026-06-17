import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ElfisLineageModal from './ElfisLineageModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-other/elfishLineageHandler.js', () => ({
  confirmElfisLineage: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as elfishLineageHandler from '../../../../services/automation/handlers/class-other/elfishLineageHandler.js';

// ── Test fixtures ──

const baseProps = {
  action: { name: 'Elfish Lineage' },
  playerStats: { name: 'ElfWizard1', level: 1 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('ElfisLineageModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  // ── Initial render / display ──

  it('renders modal overlay and header', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
  });

  it('renders "Elfish Lineage" header text with dragon icon', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    expect(screen.getByText('Elfish Lineage')).toBeInTheDocument();
    const icon = document.querySelector('.fa-dragon');
    expect(icon).toBeInTheDocument();
  });

  it('displays instruction text in modal body', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    expect(screen.getByText(/Choose an elven lineage/)).toBeInTheDocument();
  });

  it('renders all three lineage options', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    expect(screen.getByText('Drow')).toBeInTheDocument();
    expect(screen.getByText('High Elf')).toBeInTheDocument();
    expect(screen.getByText('Wood Elf')).toBeInTheDocument();
  });

  it('renders Font Awesome icons for each lineage option', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const drowIcon = document.querySelector('[name="elfishLineageOption"] + strong .fa-d');
    expect(drowIcon).toBeInTheDocument();
    const highElfIcon = document.querySelectorAll('strong i')[1];
    expect(highElfIcon).toHaveClass('fa-star');
    const woodElfIcon = document.querySelectorAll('strong i')[2];
    expect(woodElfIcon).toHaveClass('fa-tree');
  });

  it('displays lineage descriptions', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    expect(screen.getByText(/Darkvision 120 ft/)).toBeInTheDocument();
    expect(screen.getByText(/Prestidigitation cantrip/)).toBeInTheDocument();
    expect(screen.getByText(/Speed 35 ft/)).toBeInTheDocument();
  });

  it('displays spellcasting ability for each lineage', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    expect(screen.getByText(/Charisma/)).toBeInTheDocument();
    expect(screen.getByText(/Intelligence/)).toBeInTheDocument();
    expect(screen.getByText(/Wisdom/)).toBeInTheDocument();
  });

  it('renders Select Lineage button disabled by default', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const selectBtn = screen.getByRole('button', { name: /Select Lineage/ });
    expect(selectBtn).toBeDisabled();
  });

  it('renders Cancel button', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not show result state on initial render', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    expect(screen.queryByText(/Selected.*lineage/)).not.toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<ElfisLineageModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<ElfisLineageModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<ElfisLineageModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Selecting a lineage ──

  it('selects Drow lineage when clicked', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const drowRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[0];
    fireEvent.click(drowRadio);
    expect(drowRadio).toBeChecked();
  });

  it('selects High Elf lineage when clicked', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const highElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[1];
    fireEvent.click(highElfRadio);
    expect(highElfRadio).toBeChecked();
  });

  it('selects Wood Elf lineage when clicked', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const woodElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[2];
    fireEvent.click(woodElfRadio);
    expect(woodElfRadio).toBeChecked();
  });

  it('enables Select Lineage button after selecting a lineage', async () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const woodElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[2];
    await act(async () => {
      fireEvent.click(woodElfRadio);
    });
    const selectBtn = screen.getByRole('button', { name: /Select Lineage/ });
    expect(selectBtn).not.toBeDisabled();
  });

  it('switches selection when clicking a different lineage', async () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const drowRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[0];
    const highElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[1];
    await act(async () => {
      fireEvent.click(drowRadio);
    });
    expect(drowRadio).toBeChecked();
    await act(async () => {
      fireEvent.click(highElfRadio);
    });
    expect(highElfRadio).toBeChecked();
    expect(drowRadio).not.toBeChecked();
  });

  // ── Apply lineage flow ──

  it('does not call confirmElfisLineage when no lineage is selected and Apply is clicked', async () => {
    render(<ElfisLineageModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    expect(elfishLineageHandler.confirmElfisLineage).not.toHaveBeenCalled();
  });

  it('calls confirmElfisLineage with correct args when Drow is selected', async () => {
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Elfish Lineage',
        description: 'Selected Drow lineage. Spellcasting ability: Charisma.',
      },
    });
    render(<ElfisLineageModal {...makeProps()} />);
    const drowRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[0];
    await act(async () => {
      fireEvent.click(drowRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    expect(elfishLineageHandler.confirmElfisLineage).toHaveBeenCalledWith(
      { name: 'ElfWizard1', level: 1 },
      'Drow',
      'test-campaign'
    );
  });

  it('calls confirmElfisLineage with correct args when High Elf is selected', async () => {
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Elfish Lineage',
        description: 'Selected High Elf lineage. Spellcasting ability: Intelligence.',
      },
    });
    render(<ElfisLineageModal {...makeProps()} />);
    const highElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[1];
    await act(async () => {
      fireEvent.click(highElfRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    expect(elfishLineageHandler.confirmElfisLineage).toHaveBeenCalledWith(
      { name: 'ElfWizard1', level: 1 },
      'High Elf',
      'test-campaign'
    );
  });

  it('calls confirmElfisLineage with correct args when Wood Elf is selected', async () => {
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Elfish Lineage',
        description: 'Selected Wood Elf lineage. Spellcasting ability: Wisdom.',
      },
    });
    render(<ElfisLineageModal {...makeProps()} />);
    const woodElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[2];
    await act(async () => {
      fireEvent.click(woodElfRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    expect(elfishLineageHandler.confirmElfisLineage).toHaveBeenCalledWith(
      { name: 'ElfWizard1', level: 1 },
      'Wood Elf',
      'test-campaign'
    );
  });

  // ── Result state after apply ──

  it('shows result state with description after successful apply', async () => {
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Elfish Lineage',
        description: 'Selected Drow lineage. Spellcasting ability: Charisma.',
      },
    });
    render(<ElfisLineageModal {...makeProps()} />);
    const drowRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[0];
    await act(async () => {
      fireEvent.click(drowRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Selected Drow lineage');
    });
  });

  it('shows result state with dragon icon after apply', async () => {
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Elfish Lineage',
        description: 'Selected Wood Elf lineage.',
      },
    });
    render(<ElfisLineageModal {...makeProps()} />);
    const woodElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[2];
    await act(async () => {
      fireEvent.click(woodElfRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.fa-dragon')).toBeInTheDocument();
    });
  });

  it('renders Done button after apply', async () => {
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Elfish Lineage',
        description: 'Selected High Elf lineage.',
      },
    });
    render(<ElfisLineageModal {...makeProps()} />);
    const highElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[1];
    await act(async () => {
      fireEvent.click(highElfRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides lineage selection options after apply', async () => {
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Elfish Lineage',
        description: 'Selected Drow lineage.',
      },
    });
    render(<ElfisLineageModal {...makeProps()} />);
    const drowRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[0];
    await act(async () => {
      fireEvent.click(drowRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Choose an elven lineage/)).not.toBeInTheDocument();
    });
  });

  it('hides Select Lineage button after apply', async () => {
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Elfish Lineage',
        description: 'Selected Wood Elf lineage.',
      },
    });
    render(<ElfisLineageModal {...makeProps()} />);
    const woodElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[2];
    await act(async () => {
      fireEvent.click(woodElfRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Select Lineage/ })).not.toBeInTheDocument();
    });
  });

  it('hides Cancel button after apply', async () => {
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Elfish Lineage',
        description: 'Selected High Elf lineage.',
      },
    });
    render(<ElfisLineageModal {...makeProps()} />);
    const highElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[1];
    await act(async () => {
      fireEvent.click(highElfRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  // ── Done button after apply ──

  it('calls onClose when Done button is clicked after apply', async () => {
    const onClose = vi.fn();
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Elfish Lineage',
        description: 'Selected Drow lineage.',
      },
    });
    render(<ElfisLineageModal {...makeProps({ onClose })} />);
    const drowRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[0];
    await act(async () => {
      fireEvent.click(drowRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Overlay click in result state ──

  it('calls onClose when clicking overlay in result state', async () => {
    const onClose = vi.fn();
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Elfish Lineage',
        description: 'Selected Drow lineage.',
      },
    });
    render(<ElfisLineageModal {...makeProps({ onClose })} />);
    const drowRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[0];
    await act(async () => {
      fireEvent.click(drowRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Result state with null/empty result ──

  it('does not show result state when confirmElfisLineage returns null', async () => {
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue(null);
    render(<ElfisLineageModal {...makeProps()} />);
    const drowRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[0];
    await act(async () => {
      fireEvent.click(drowRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Select Lineage/ })).toBeInTheDocument();
    });
  });

  it('keeps lineage selection options visible when confirm returns null', async () => {
    elfishLineageHandler.confirmElfisLineage.mockResolvedValue(null);
    render(<ElfisLineageModal {...makeProps()} />);
    const drowRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[0];
    await act(async () => {
      fireEvent.click(drowRadio);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Choose an elven lineage/)).toBeInTheDocument();
    });
  });

  // ── Modal CSS structure ──

  it('renders modal with proper CSS classes', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders Font Awesome dragon icon in header', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const headerIcon = document.querySelector('.sp-header .fa-dragon');
    expect(headerIcon).toBeInTheDocument();
  });

  it('renders Font Awesome dragon icon on Select Lineage button', () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const btnIcon = document.querySelector('.sp-roll-btn .fa-dragon');
    expect(btnIcon).toBeInTheDocument();
  });

  // ── Selection highlighting ──

  it('applies selected style to chosen lineage option', async () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const woodElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[2];
    await act(async () => {
      fireEvent.click(woodElfRadio);
    });
    const label = woodElfRadio.closest('label');
    expect(label.style.background).toContain('rgba(255');
  });

  it('applies border to selected lineage option', async () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const highElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[1];
    await act(async () => {
      fireEvent.click(highElfRadio);
    });
    const label = highElfRadio.closest('label');
    expect(label.style.border).toContain('var(--color-link)');
  });

  // ── Unselected options ──

  it('does not apply selected style to unselected lineage options', async () => {
    render(<ElfisLineageModal {...makeProps()} />);
    const drowRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[0];
    const woodElfRadio = document.querySelectorAll('input[name="elfishLineageOption"]')[2];
    await act(async () => {
      fireEvent.click(woodElfRadio);
    });
    const unselectedLabel = drowRadio.closest('label');
    expect(unselectedLabel.style.background).toBe('transparent');
  });

  // ── Action prop (unused) ──

  it('renders correctly with action prop (unused parameter)', () => {
    render(<ElfisLineageModal {...makeProps({ action: { name: 'Test', automation: {} } })} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });
});
