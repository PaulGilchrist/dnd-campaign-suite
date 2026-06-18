// @improved-by-ai
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GnomishLineageModal from './GnomishLineageModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-other/gnomishLineageHandler.js', () => ({
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

import { confirmGnomishLineage } from '../../../../services/automation/handlers/class-other/gnomishLineageHandler.js';

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

const lineages = ['Deep Gnome', 'Forest Gnome', 'Rock Gnome'];
const lineageDescriptions = [
  /Darkvision 120 ft/,
  /Hide behind larger creatures/,
  /Move through larger creatures/,
];
const lineageCantrips = [
  /Magic Stone cantrip/,
  /Minor Illusion cantrip/,
  /Mending cantrip/,
];

// ── Tests ──

describe('GnomishLineageModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders modal overlay with header and title', () => {
      render(<GnomishLineageModal {...makeProps()} />);
      expect(screen.getByText('Gnomish Lineage')).toBeInTheDocument();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders dragon icon in header', () => {
      render(<GnomishLineageModal {...makeProps()} />);
      const icon = document.querySelector('.fa-dragon');
      expect(icon).toBeInTheDocument();
    });

    it('renders instruction paragraph', () => {
      render(<GnomishLineageModal {...makeProps()} />);
      expect(screen.getByText(/Choose a gnomish lineage/)).toBeInTheDocument();
    });

    it('renders all three lineage options with icons and descriptions', () => {
      render(<GnomishLineageModal {...makeProps()} />);
      lineages.forEach((name) => {
        expect(screen.getByText(name)).toBeInTheDocument();
        expect(screen.getAllByText(/Spellcasting ability: Intelligence/)).toHaveLength(3);
      });
      lineageDescriptions.forEach(desc => expect(screen.getByText(desc)).toBeInTheDocument());
      lineageCantrips.forEach(cantrip => expect(screen.getByText(cantrip)).toBeInTheDocument());
    });

    it('renders three radio inputs', () => {
      render(<GnomishLineageModal {...makeProps()} />);
      expect(document.querySelectorAll('input[name="gnomishLineageOption"]')).toHaveLength(3);
    });

    it('renders Select Lineage and Cancel buttons', () => {
      render(<GnomishLineageModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Select Lineage/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('disables Select Lineage button when no lineage is selected', () => {
      render(<GnomishLineageModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Select Lineage/ })).toBeDisabled();
    });

    it('does not show result state on initial render', () => {
      render(<GnomishLineageModal {...makeProps()} />);
      expect(screen.queryByText(/Selected.*lineage/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Modal structure ──

  describe('modal structure', () => {
    it('renders expected CSS class hierarchy', () => {
      render(<GnomishLineageModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<GnomishLineageModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Dismiss flow ──

  describe('dismiss flow', () => {
    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<GnomishLineageModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<GnomishLineageModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Lineage selection ──

  describe('lineage selection', () => {
    it('selects a lineage when clicked and enables the apply button', async () => {
      render(<GnomishLineageModal {...makeProps()} />);
      const selectBtn = screen.getByRole('button', { name: /Select Lineage/ });
      expect(selectBtn).toBeDisabled();

      fireEvent.click(screen.getByText('Deep Gnome'));
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

    it('selects the correct radio for each lineage', () => {
      lineages.forEach((name) => {
        render(<GnomishLineageModal {...makeProps()} />);
        fireEvent.click(screen.getByText(name));
        const radios = document.querySelectorAll('input[name="gnomishLineageOption"]');
        const idx = lineages.indexOf(name);
        radios.forEach((radio, j) => {
          if (j === idx) {
            expect(radio).toBeChecked();
          } else {
            expect(radio).not.toBeChecked();
          }
        });
        cleanup();
      });
    });

    it('does not show result state until lineage is applied', () => {
      render(<GnomishLineageModal {...makeProps()} />);
      fireEvent.click(screen.getByText('Deep Gnome'));
      expect(screen.queryByText(/Selected.*lineage/)).not.toBeInTheDocument();
    });
  });

  // ── Apply lineage flow ──

  describe('apply lineage', () => {
    it('calls confirmGnomishLineage with correct args', async () => {
      render(<GnomishLineageModal {...makeProps()} />);
      fireEvent.click(screen.getByText('Deep Gnome'));
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      await waitFor(() => {
        expect(confirmGnomishLineage).toHaveBeenCalledWith(
          { name: 'GnomeWizard', level: 1 },
          'Deep Gnome',
          'test-campaign'
        );
      });
    });

    it('does not call confirmGnomishLineage when no lineage is selected', async () => {
      render(<GnomishLineageModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      expect(confirmGnomishLineage).not.toHaveBeenCalled();
    });

    it('shows result state after applying lineage', async () => {
      render(<GnomishLineageModal {...makeProps()} />);
      fireEvent.click(screen.getByText('Deep Gnome'));
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      await waitFor(() => {
        expect(screen.getByText(/Selected Deep Gnome lineage/)).toBeInTheDocument();
      });
    });

    it('shows lineage result description in result body', async () => {
      render(<GnomishLineageModal {...makeProps()} />);
      fireEvent.click(screen.getByText('Deep Gnome'));
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      await waitFor(() => {
        expect(screen.getByText(/Spellcasting ability: Intelligence/)).toBeInTheDocument();
      });
    });

    it('replaces selection UI with result state', async () => {
      render(<GnomishLineageModal {...makeProps()} />);
      fireEvent.click(screen.getByText('Deep Gnome'));
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      await waitFor(() => {
        expect(screen.queryByText(/Choose a gnomish lineage/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Select Lineage/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('passes custom playerStats and campaignName to confirmGnomishLineage', async () => {
      const customProps = makeProps({
        playerStats: { name: 'CustomGnome', level: 5 },
        campaignName: 'custom-campaign',
      });
      render(<GnomishLineageModal {...customProps} />);
      fireEvent.click(screen.getByText('Forest Gnome'));
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      await waitFor(() => {
        expect(confirmGnomishLineage).toHaveBeenCalledWith(
          { name: 'CustomGnome', level: 5 },
          'Forest Gnome',
          'custom-campaign'
        );
      });
    });
  });

  // ── Result state dismissal ──

  describe('result state dismissal', () => {
    it('calls onClose when Done button is clicked after applying lineage', async () => {
      const onClose = vi.fn();
      render(<GnomishLineageModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByText('Deep Gnome'));
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay after applying lineage', async () => {
      const onClose = vi.fn();
      render(<GnomishLineageModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByText('Deep Gnome'));
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal after applying lineage', async () => {
      const onClose = vi.fn();
      render(<GnomishLineageModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByText('Deep Gnome'));
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-modal'));
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Different lineage results ──

  describe('different lineage results', () => {
    it.each(lineages)('shows %s result description after applying', async (lineage) => {
      const resultDescription = `Selected ${lineage} lineage. Spellcasting ability: Intelligence.`;
      confirmGnomishLineage.mockResolvedValueOnce({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Gnomish Lineage',
          description: resultDescription,
          automation: { type: 'gnomish_lineage', options: [] },
        },
      });
      render(<GnomishLineageModal {...makeProps()} />);
      fireEvent.click(screen.getByText(lineage));
      fireEvent.click(screen.getByRole('button', { name: /Select Lineage/ }));
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`Selected ${lineage} lineage`))).toBeInTheDocument();
      });
    });
  });
});
