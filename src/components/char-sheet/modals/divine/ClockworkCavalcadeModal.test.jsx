// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClockworkCavalcadeModal from './ClockworkCavalcadeModal.jsx';

function makeProps(overrides) {
  return {
    featureName: 'Clockwork Cavalcade',
    onChoose: vi.fn(),
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

function renderModal(overrides) {
  return render(<ClockworkCavalcadeModal {...makeProps(overrides)} />);
}

// ── Tests ──

describe('ClockworkCavalcadeModal', () => {
  // ── Initial render / display ──

  it('renders modal overlay with feature name, description, and Cancel button', () => {
    renderModal();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(screen.getByText('Clockwork Cavalcade')).toBeInTheDocument();
    expect(
      screen.getByText(/As a Magic action, you call forth the spirit of order/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders custom feature name when provided', () => {
    renderModal({ featureName: 'Custom Feature' });
    expect(screen.getByText('Custom Feature')).toBeInTheDocument();
  });

  it('renders all three option buttons with their descriptions', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /HealRestore up to 100 HP/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /RepairDamaged objects/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /DispelEvery spell of level 6/ })).toBeInTheDocument();
  });

  // ── Option selection ──

  it.each([
    ['heal', /HealRestore up to 100 HP/],
    ['repair', /RepairDamaged objects/],
    ['dispel', /DispelEvery spell of level 6/],
  ])('calls onChoose with "%s" when the option button is clicked', (_key, buttonName) => {
    const onChoose = vi.fn();
    renderModal({ onChoose });
    fireEvent.click(screen.getByRole('button', { name: buttonName }));
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  // ── Close / dismiss behavior ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking the overlay background or inside the modal content', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    const modal = document.querySelector('.sp-modal');
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });
});
