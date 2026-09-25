// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StrideOfTheElementsModal from './StrideOfTheElementsModal.jsx';
import { STRIDE_OPTIONS } from '../../../services/automation/handlers/combat/strideOfTheElementsHandler.js';

// ── Test fixtures ──

const mockAction = { name: 'Stride of the Elements' };
const mockOnClose = vi.fn();
const mockOnConfirm = vi.fn();

const baseProps = {
  action: mockAction,
  onConfirm: mockOnConfirm,
  onClose: mockOnClose,
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('StrideOfTheElementsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders the modal with instruction text, all stride options, and action buttons', () => {
      render(<StrideOfTheElementsModal {...makeProps()} />);
      expect(screen.getByText('Choose a special movement type:')).toBeInTheDocument();
      for (const opt of STRIDE_OPTIONS) {
        expect(screen.getByText(opt.label)).toBeInTheDocument();
      }
      expect(screen.getByRole('button', { name: 'Choose' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('disables the Choose button when no option is selected', () => {
      render(<StrideOfTheElementsModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
    });
  });

  describe('radio selection', () => {
    it('selects an option when its radio is clicked and enables the Choose button', () => {
      render(<StrideOfTheElementsModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      const chooseBtn = screen.getByRole('button', { name: 'Choose' });

      expect(radios[0]).not.toBeChecked();
      expect(chooseBtn).toBeDisabled();

      fireEvent.click(radios[0]);
      expect(radios[0]).toBeChecked();
      expect(chooseBtn).not.toBeDisabled();
    });

    it('switches selection when a different option is clicked', () => {
      render(<StrideOfTheElementsModal {...makeProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');

      fireEvent.click(radios[0]);
      expect(radios[0]).toBeChecked();
      expect(radios[1]).not.toBeChecked();

      fireEvent.click(radios[2]);
      expect(radios[2]).toBeChecked();
      expect(radios[0]).not.toBeChecked();
      expect(radios[1]).not.toBeChecked();
    });
  });

  describe('confirm flow', () => {
    const expectedCalls = [
      ['Ice Walk', { effect: 'ice_walk' }],
      ['+10 Speed', { effect: 'speed_boost', speedBonus: 10 }],
      ['Fly Speed', { effect: 'fly_speed_equals_walk_speed' }],
      ['Teleport 30 ft', { effect: 'teleport_ready', teleportDistance: '30 ft' }],
    ];

    for (let i = 0; i < STRIDE_OPTIONS.length; i++) {
      it(`calls onConfirm with correct args for '${STRIDE_OPTIONS[i].label}'`, () => {
        mockOnConfirm.mockClear();
        render(<StrideOfTheElementsModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[i]);
        const chooseBtn = screen.getByRole('button', { name: 'Choose' });
        fireEvent.click(chooseBtn);
        expect(mockOnConfirm).toHaveBeenCalledWith(...expectedCalls[i]);
      });
    }

    it('does not call onConfirm when Choose is clicked with no selection', () => {
      render(<StrideOfTheElementsModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked without calling onConfirm', () => {
      render(<StrideOfTheElementsModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('does not call onClose or onConfirm when the overlay is clicked', () => {
      render(<StrideOfTheElementsModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('action name rendering', () => {
    it('displays the action name, with fallback for missing action', () => {
      const { container } = render(<StrideOfTheElementsModal {...makeProps({ action: { name: 'Custom Stride' } })} />);
      expect(container.querySelector('.sp-header').textContent).toContain('Custom Stride');

      mockOnConfirm.mockClear();
      const { container: containerFallback } = render(<StrideOfTheElementsModal {...makeProps({ action: null })} />);
      expect(containerFallback.querySelector('.sp-header').textContent).toContain('Stride of the Elements');
    });
  });
});
