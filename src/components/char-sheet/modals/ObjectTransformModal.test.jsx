// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ObjectTransformModal from './ObjectTransformModal.jsx';

// ── Test fixtures ──

const mockOnConfirm = vi.fn();
const mockOnCancel = vi.fn();

function makeProps(overrides) {
  return {
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    ...(overrides || {}),
  };
}

const OBJECT_TYPES = [
  { value: 'stone_block', label: 'Stone Block', icon: 'fa-cube' },
  { value: 'iron_chain', label: 'Iron Chain', icon: 'fa-link' },
  { value: 'wooden_crate', label: 'Wooden Crate', icon: 'fa-box' },
  { value: 'iron_bars', label: 'Iron Bars', icon: 'fa-grip-lines' },
  { value: 'glass_vial', label: 'Glass Vial', icon: 'fa-flask' },
  { value: 'leather_book', label: 'Leather Book', icon: 'fa-book' },
  { value: 'bronze_statue', label: 'Bronze Statue', icon: 'fa-statue' },
  { value: 'other', label: 'Other Object', icon: 'fa-circle' },
];

// ── Helpers ──

function renderModal(props) {
  return render(<ObjectTransformModal {...makeProps(props)} />);
}

function getSelectedButton() {
  return document.querySelector('.object-type-btn.selected');
}

function clickButton(label) {
  const btn = screen.getByText(label).closest('.object-type-btn');
  fireEvent.click(btn);
}

// ── Tests ──

describe('ObjectTransformModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render ──

  describe('initial render', () => {
    it('renders all 8 object type buttons with correct icons', () => {
      renderModal();
      OBJECT_TYPES.forEach(({ label, icon }) => {
        const btn = screen.getByText(label).closest('.object-type-btn');
        expect(btn).toBeInTheDocument();
        expect(btn.querySelector(`i.fa-solid.${icon}`)).toBeInTheDocument();
      });
    });
  });

  // ── Object type selection ──

  describe('object type selection', () => {
    it.each(OBJECT_TYPES.filter(t => t.value !== 'stone_block'))('selects $label when its button is clicked', ({ label }) => {
      renderModal();
      clickButton(label);
      expect(getSelectedButton()).toHaveTextContent(label);
    });

    it('shows custom object input when Other Object is selected', () => {
      renderModal();
      clickButton('Other Object');
      expect(document.querySelector('.custom-object-input input')).toBeInTheDocument();
    });

    it('hides custom object input when switching away from Other Object', () => {
      renderModal();
      clickButton('Other Object');
      expect(document.querySelector('.custom-object-input input')).toBeInTheDocument();
      clickButton('Stone Block');
      expect(document.querySelector('.custom-object-input input')).not.toBeInTheDocument();
    });
  });

  // ── Confirm behavior ──

  describe('confirm behavior', () => {
    it.each(OBJECT_TYPES.filter(t => t.value !== 'other'))('calls onConfirm with $value when $label is selected', ({ value }) => {
      renderModal();
      clickButton(value === 'stone_block' ? 'Stone Block' : OBJECT_TYPES.find(t => t.value === value).label);
      fireEvent.click(screen.getByRole('button', { name: 'Transform' }));
      expect(mockOnConfirm).toHaveBeenCalledWith(value);
    });

    it('calls onConfirm with custom type when Other is selected and input has text', () => {
      renderModal();
      clickButton('Other Object');
      const input = document.querySelector('.custom-object-input input');
      fireEvent.change(input, { target: { value: 'Ancient Rune Stone' } });
      fireEvent.click(screen.getByRole('button', { name: 'Transform' }));
      expect(mockOnConfirm).toHaveBeenCalledWith('Ancient Rune Stone');
    });

    it('calls onConfirm with "Stone Block" fallback when Other is selected but input is empty', () => {
      renderModal();
      clickButton('Other Object');
      fireEvent.click(screen.getByRole('button', { name: 'Transform' }));
      expect(mockOnConfirm).toHaveBeenCalledWith('Stone Block');
    });

    it('trims surrounding whitespace from custom input', () => {
      renderModal();
      clickButton('Other Object');
      const input = document.querySelector('.custom-object-input input');
      fireEvent.change(input, { target: { value: '  Magic Orb  ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Transform' }));
      expect(mockOnConfirm).toHaveBeenCalledWith('Magic Orb');
    });

    it('passes through custom type with internal spaces', () => {
      renderModal();
      clickButton('Other Object');
      const input = document.querySelector('.custom-object-input input');
      fireEvent.change(input, { target: { value: 'Iron Chain Link' } });
      fireEvent.click(screen.getByRole('button', { name: 'Transform' }));
      expect(mockOnConfirm).toHaveBeenCalledWith('Iron Chain Link');
    });
  });

  // ── Cancel behavior ──

  describe('cancel behavior', () => {
    it('calls onCancel when Cancel button is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when overlay is clicked', () => {
      renderModal();
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(mockOnCancel).not.toHaveBeenCalled();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('does not call onCancel when modal content is clicked', () => {
      renderModal();
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  // ── Keyboard interaction ──

  describe('keyboard interaction', () => {
    it('calls onCancel when Escape key is pressed', () => {
      renderModal();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when Escape is pressed after unmount', () => {
      const { unmount } = renderModal();
      unmount();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });
});
