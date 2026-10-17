import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClockworkCavalcadeModal from './ClockworkCavalcadeModal.jsx';

// ── Ownership ──
// This file owns the option-choice modal UI in isolation: verbatim header,
// prompt, and three option rows, the choice seam emitting exactly
// onChoose(option.key) WITHOUT closing (the caller owns closing), Cancel-close,
// and overlay/content inertness. The component is fully presentational — no
// runtime-store or dice-module reads, so no module mocks and no live stores;
// fresh vi.fn props per makeProps cover the mock-freshness need.
// Deferred to owners:
// - CharActionModals.clockwork-handlers.test.jsx — handleClockworkCavalcadeChoice
//   routing each key to the heal/repair/dispel follow-up modals and closing
//   clockworkCavalcadeModal (its render site in CharActionModals.SecondaryModals).
// - useCharActionsModalHandlers.healing.test.js — handleClockworkCavalcade
//   {Heal,Dispel,Repair}Confirm delegation and popup handling.
// - clockworkCavalcadeHandler.js — confirm* execution, HP writes, runtime
//   keys, and campaign-log entries.

// ── Fixtures ──
// Verbatim rules text mirrored from the component's OPTIONS table; the exact
// button accessible name is the concatenated title + description.
const OPTION_CASES = [
  {
    key: 'heal',
    name: 'HealRestore up to 100 HP, divided as you choose among any number of creatures of your choice in the Cube.',
    description: 'Restore up to 100 HP, divided as you choose among any number of creatures of your choice in the Cube.',
  },
  {
    key: 'repair',
    name: 'RepairDamaged objects within the Cube are repaired instantly.',
    description: 'Damaged objects within the Cube are repaired instantly.',
  },
  {
    key: 'dispel',
    name: 'DispelEvery spell of level 6 and lower ends on creatures and objects of your choice in the Cube.',
    description: 'Every spell of level 6 and lower ends on creatures and objects of your choice in the Cube.',
  },
];

function makeProps(overrides = {}) {
  return {
    featureName: 'Clockwork Cavalcade',
    onChoose: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

function renderModal(overrides) {
  return render(<ClockworkCavalcadeModal {...makeProps(overrides)} />);
}

// ── Tests ──

describe('ClockworkCavalcadeModal', () => {
  // ── Rendering ──

  describe('rendering', () => {
    it('renders the header, verbatim cube prompt, and Cancel button', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(screen.getByText('Clockwork Cavalcade')).toBeInTheDocument();
      expect(screen.getByText(
        'As a Magic action, you call forth the spirit of order from your body in a 30-foot Cube originating from you. Choose one of the following effects:'
      )).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it.each(OPTION_CASES)(
      'lists the $key option as an enabled button with exact name and verbatim description',
      ({ name, description }) => {
        renderModal();
        const button = screen.getByRole('button', { name });
        expect(button).toBeEnabled();
        expect(screen.getByText(description)).toBeInTheDocument();
      }
    );

    it('shows a custom featureName in the header instead of the default', () => {
      renderModal({ featureName: 'Custom Feature' });
      expect(screen.getByText('Custom Feature')).toBeInTheDocument();
      expect(screen.queryByText('Clockwork Cavalcade')).not.toBeInTheDocument();
    });
  });

  // ── Choice seam ──

  describe('choice seam', () => {
    it.each(OPTION_CASES)(
      'clicking the $key option emits exactly onChoose("$key") without closing or touching the other options',
      ({ key, name }) => {
        const onChoose = vi.fn();
        const onClose = vi.fn();
        renderModal({ onChoose, onClose });

        fireEvent.click(screen.getByRole('button', { name }));

        expect(onChoose).toHaveBeenCalledTimes(1);
        expect(onChoose).toHaveBeenCalledWith(key);
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      }
    );

    it('keeps every option clickable in sequence, each emitting its own exact key', () => {
      const onChoose = vi.fn();
      renderModal({ onChoose });

      for (const { name } of OPTION_CASES) {
        fireEvent.click(screen.getByRole('button', { name }));
      }

      expect(onChoose).toHaveBeenCalledTimes(3);
      expect(onChoose.mock.calls.map(([chosen]) => chosen)).toEqual(['heal', 'repair', 'dispel']);
    });
  });

  // ── Close flows ──

  describe('close flows', () => {
    it('closes once when Cancel is clicked without choosing', () => {
      const onClose = vi.fn();
      const onChoose = vi.fn();
      renderModal({ onClose, onChoose });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onChoose).not.toHaveBeenCalled();
    });

    it('stays inert when the overlay or modal container is clicked', () => {
      const onClose = vi.fn();
      const onChoose = vi.fn();
      renderModal({ onClose, onChoose });

      fireEvent.click(document.querySelector('.sp-overlay'));
      fireEvent.click(document.querySelector('.sp-modal'));

      expect(onClose).not.toHaveBeenCalled();
      expect(onChoose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(4);
    });
  });
});
