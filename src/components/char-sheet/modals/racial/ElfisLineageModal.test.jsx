// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ElfisLineageModal from './ElfisLineageModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-other/elfishLineageHandler.js', () => ({
  confirmElfisLineage: vi.fn(),
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

const lineageOptions = [
  { name: 'Drow', icon: 'fa-d', ability: 'Charisma' },
  { name: 'High Elf', icon: 'fa-star', ability: 'Intelligence' },
  { name: 'Wood Elf', icon: 'fa-tree', ability: 'Wisdom' },
];

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function getRadioInputs() {
  return document.querySelectorAll('input[name="elfishLineageOption"]');
}

function getRadioByName(name) {
  const radios = getRadioInputs();
  return radios[
    lineageOptions.findIndex((opt) => opt.name === name)
  ];
}

// ── Tests ──

describe('ElfisLineageModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the modal overlay with header, body, and actions sections', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the header with dragon icon and title text', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      expect(screen.getByText('Elfish Lineage')).toBeInTheDocument();
      expect(document.querySelector('.fa-dragon')).toBeInTheDocument();
    });

    it('renders the instruction paragraph', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      expect(screen.getByText(/Choose an elven lineage/)).toBeInTheDocument();
    });

    it('renders all three lineage options', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      for (const opt of lineageOptions) {
        expect(screen.getByText(opt.name)).toBeInTheDocument();
      }
    });

    it('renders the correct icon for each lineage option', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      for (const opt of lineageOptions) {
        expect(document.querySelector(`.${opt.icon}`)).toBeInTheDocument();
      }
    });

    it('renders lineage descriptions', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      expect(screen.getByText(/Darkvision 120 ft/)).toBeInTheDocument();
      expect(screen.getByText(/Prestidigitation cantrip/)).toBeInTheDocument();
      expect(screen.getByText(/Speed 35 ft/)).toBeInTheDocument();
    });

    it('renders the spellcasting ability for each lineage', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      expect(screen.getByText(/Charisma/)).toBeInTheDocument();
      expect(screen.getByText(/Intelligence/)).toBeInTheDocument();
      expect(screen.getByText(/Wisdom/)).toBeInTheDocument();
    });

    it('renders three radio inputs for lineage selection', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      expect(getRadioInputs()).toHaveLength(3);
    });

    it('renders Select Lineage button disabled by default', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Select Lineage/ })).toBeDisabled();
    });

    it('renders Cancel button', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not show result state on initial render', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Selected.*lineage/)).not.toBeInTheDocument();
    });

    it('renders the dragon icon on the Select Lineage button', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      const btnIcon = document.querySelector('.sp-roll-btn .fa-dragon');
      expect(btnIcon).toBeInTheDocument();
    });
  });

  // ── Overlay click behavior ──

  describe('overlay click behavior', () => {
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
  });

  // ── Cancel button ──

  describe('Cancel button', () => {
    it('calls onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      render(<ElfisLineageModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Lineage selection ──

  describe('lineage selection', () => {
    it('does not have any lineage selected on initial render', () => {
      render(<ElfisLineageModal {...makeProps()} />);
      getRadioInputs().forEach((radio) => expect(radio).not.toBeChecked());
    });

    it.each(lineageOptions)(
      'selects %s when clicked',
      (opt) => {
        render(<ElfisLineageModal {...makeProps()} />);
        const radio = getRadioByName(opt.name);
        fireEvent.click(radio);
        expect(radio).toBeChecked();
      }
    );

    it('enables Select Lineage button after selecting a lineage', async () => {
      render(<ElfisLineageModal {...makeProps()} />);
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
      });
      expect(screen.getByRole('button', { name: /Select Lineage/ })).not.toBeDisabled();
    });

    it('switches selection when clicking a different lineage', async () => {
      render(<ElfisLineageModal {...makeProps()} />);
      const drowRadio = getRadioByName('Drow');
      const highElfRadio = getRadioByName('High Elf');
      await act(async () => {
        fireEvent.click(drowRadio);
      });
      expect(drowRadio).toBeChecked();
      expect(highElfRadio).not.toBeChecked();
      await act(async () => {
        fireEvent.click(highElfRadio);
      });
      expect(highElfRadio).toBeChecked();
      expect(drowRadio).not.toBeChecked();
    });

    it('applies visual highlight to the selected lineage option', async () => {
      render(<ElfisLineageModal {...makeProps()} />);
      const radio = getRadioByName('Wood Elf');
      await act(async () => {
        fireEvent.click(radio);
      });
      const label = radio.closest('label');
      expect(label.style.background).not.toBe('transparent');
    });

    it('applies a visible border to the selected lineage option', async () => {
      render(<ElfisLineageModal {...makeProps()} />);
      const radio = getRadioByName('High Elf');
      await act(async () => {
        fireEvent.click(radio);
      });
      const label = radio.closest('label');
      expect(label.style.border).not.toBe('1px solid transparent');
    });

    it('removes highlight from previously selected lineage when a new one is chosen', async () => {
      render(<ElfisLineageModal {...makeProps()} />);
      const drowRadio = getRadioByName('Drow');
      const woodElfRadio = getRadioByName('Wood Elf');
      await act(async () => {
        fireEvent.click(drowRadio);
      });
      const drowLabel = drowRadio.closest('label');
      await act(async () => {
        fireEvent.click(woodElfRadio);
      });
      expect(drowLabel.style.background).toBe('transparent');
    });
  });

  // ── Apply lineage flow ──

  describe('apply lineage flow', () => {
    it.each(lineageOptions)(
      'calls confirmElfisLineage with correct args when %s is selected',
      async (opt) => {
        elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Elfish Lineage',
            description: `Selected ${opt.name} lineage. Spellcasting ability: ${opt.ability}.`,
          },
        });
        render(<ElfisLineageModal {...makeProps()} />);
        const radio = getRadioByName(opt.name);
        await act(async () => {
          fireEvent.click(radio);
        });
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
        });
        expect(elfishLineageHandler.confirmElfisLineage).toHaveBeenCalledWith(
          { name: 'ElfWizard1', level: 1 },
          opt.name,
          'test-campaign'
        );
      }
    );

    it('does not call confirmElfisLineage when no lineage is selected and Apply is clicked', async () => {
      render(<ElfisLineageModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      });
      expect(elfishLineageHandler.confirmElfisLineage).not.toHaveBeenCalled();
    });
  });

  // ── Result state after apply ──

  describe('result state after apply', () => {
    it.each(lineageOptions)(
      'shows result state with description after applying %s',
      async (opt) => {
        elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Elfish Lineage',
            description: `Selected ${opt.name} lineage. Spellcasting ability: ${opt.ability}.`,
          },
        });
        render(<ElfisLineageModal {...makeProps()} />);
        const radio = getRadioByName(opt.name);
        await act(async () => {
          fireEvent.click(radio);
        });
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
        });
        await waitFor(() => {
          const body = document.querySelector('.sp-body');
          expect(body.textContent).toContain(`Selected ${opt.name} lineage`);
        });
      }
    );

    it('shows the dragon icon in the result state header', async () => {
      elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Elfish Lineage',
          description: 'Selected Drow lineage.',
        },
      });
      render(<ElfisLineageModal {...makeProps()} />);
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      });
      await waitFor(() => {
        expect(document.querySelector('.fa-dragon')).toBeInTheDocument();
      });
    });

    it('renders Done button after applying lineage', async () => {
      elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Elfish Lineage',
          description: 'Selected Drow lineage.',
        },
      });
      render(<ElfisLineageModal {...makeProps()} />);
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('hides lineage selection options after applying', async () => {
      elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Elfish Lineage',
          description: 'Selected Drow lineage.',
        },
      });
      render(<ElfisLineageModal {...makeProps()} />);
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      });
      await waitFor(() => {
        expect(screen.queryByText(/Choose an elven lineage/)).not.toBeInTheDocument();
      });
    });

    it('hides Select Lineage button after applying', async () => {
      elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Elfish Lineage',
          description: 'Selected Drow lineage.',
        },
      });
      render(<ElfisLineageModal {...makeProps()} />);
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Select Lineage/ })).not.toBeInTheDocument();
      });
    });

    it('hides Cancel button after applying', async () => {
      elfishLineageHandler.confirmElfisLineage.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Elfish Lineage',
          description: 'Selected Drow lineage.',
        },
      });
      render(<ElfisLineageModal {...makeProps()} />);
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });
  });

  // ── Done button after apply ──

  describe('Done button after apply', () => {
    it('calls onClose when Done is clicked after applying lineage', async () => {
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
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Overlay click in result state ──

  describe('overlay click in result state', () => {
    it('calls onClose when clicking the overlay background after applying', async () => {
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
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal after applying', async () => {
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
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-modal'));
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Null/empty result handling ──

  describe('null/empty result handling', () => {
    it('does not show result state when confirmElfisLineage returns null', async () => {
      elfishLineageHandler.confirmElfisLineage.mockResolvedValue(null);
      render(<ElfisLineageModal {...makeProps()} />);
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
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
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Choose an elven lineage/)).toBeInTheDocument();
      });
    });

    it('does not show Done button when confirm returns null', async () => {
      elfishLineageHandler.confirmElfisLineage.mockResolvedValue(null);
      render(<ElfisLineageModal {...makeProps()} />);
      const radio = getRadioByName('Drow');
      await act(async () => {
        fireEvent.click(radio);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });
  });
});
