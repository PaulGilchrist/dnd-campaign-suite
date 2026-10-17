// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ObjectTransformModal from './ObjectTransformModal.jsx';

// Catalogue mirrored from OBJECT_TYPES in ObjectTransformModal.jsx — the contract
// of what the modal renders and what each button emits through onConfirm.
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

function renderModal() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  return { ...render(<ObjectTransformModal onConfirm={onConfirm} onCancel={onCancel} />), onConfirm, onCancel };
}

function clickType(label) {
  fireEvent.click(screen.getByText(label).closest('.object-type-btn'));
}

function clickTransform() {
  fireEvent.click(screen.getByRole('button', { name: 'Transform' }));
}

function getSelectedButton() {
  return document.querySelector('.object-type-btn.selected');
}

describe('ObjectTransformModal', () => {
  it('renders all 8 object types with icons, Stone Block selected by default, no custom input', () => {
    renderModal();
    OBJECT_TYPES.forEach(({ label, icon }) => {
      const btn = screen.getByText(label).closest('.object-type-btn');
      expect(btn).toBeInTheDocument();
      expect(btn.querySelector(`i.fa-solid.${icon}`)).toBeInTheDocument();
    });
    expect(getSelectedButton()).toHaveTextContent('Stone Block');
    expect(document.querySelector('.custom-object-input')).not.toBeInTheDocument();
  });

  it.each(OBJECT_TYPES)(
    'selecting $label then Transform confirms $value',
    ({ label, value }) => {
      const { onConfirm } = renderModal();
      clickType(label);
      expect(getSelectedButton()).toHaveTextContent(label);
      expect(onConfirm).not.toHaveBeenCalled();
      clickTransform();
      // 'other' with an empty custom input falls back to 'Stone Block'.
      expect(onConfirm).toHaveBeenCalledWith(value === 'other' ? 'Stone Block' : value);
    },
  );

  it('shows custom input when Other Object is selected and hides it when switching away', () => {
    renderModal();
    clickType('Other Object');
    expect(document.querySelector('.custom-object-input input')).toBeInTheDocument();
    clickType('Stone Block');
    expect(document.querySelector('.custom-object-input')).not.toBeInTheDocument();
    expect(getSelectedButton()).toHaveTextContent('Stone Block');
  });

  it('confirms trimmed custom text (internal spaces kept) when Other Object has input', () => {
    const { onConfirm } = renderModal();
    clickType('Other Object');
    fireEvent.change(document.querySelector('.custom-object-input input'), {
      target: { value: '  Ancient Rune Stone  ' },
    });
    clickTransform();
    expect(onConfirm).toHaveBeenCalledWith('Ancient Rune Stone');
  });

  it('cancels when the Cancel button or Escape is pressed', () => {
    const { onCancel } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('removes its Escape listener on unmount', () => {
    const { onCancel, unmount } = renderModal();
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('stays open when the overlay or modal body is clicked', () => {
    const { onCancel } = renderModal();
    fireEvent.click(document.querySelector('.sp-overlay'));
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onCancel).not.toHaveBeenCalled();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });
});
