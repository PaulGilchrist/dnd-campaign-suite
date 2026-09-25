// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PsionicChoicePopup from './PsionicChoicePopup.jsx';

function renderPopup(overrides = {}) {
  const props = {
    spellName: overrides.spellName || 'Eldritch Blast',
    spellLevel: overrides.spellLevel ?? 1,
    sorceryPointsAvailable: overrides.sorceryPointsAvailable ?? 3,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return {
    ...render(<PsionicChoicePopup {...props} />),
    onConfirm: props.onConfirm,
    onCancel: props.onCancel,
  };
}

describe('PsionicChoicePopup', () => {
  // ── Rendering ──

  it.each`
    spellName       | spellLevel
    ${'Eldritch Blast'} | ${0}
    ${'Firebolt'}     | ${1}
    ${'Shillelagh'}    | ${3}
  `('renders title, spell name, and level ($spellName, Level $spellLevel)', ({ spellName, spellLevel }) => {
    renderPopup({ spellName, spellLevel });
    expect(screen.getByText('Psionic Sorcery')).toBeInTheDocument();
    expect(screen.getByText(spellName)).toBeInTheDocument();
    expect(screen.getByText(`Level ${spellLevel}`)).toBeInTheDocument();
    expect(
      screen.getByText(/Psionic Sorcery allows you to cast this spell using sorcery points/),
    ).toBeInTheDocument();
  });

  it('renders both choice options', () => {
    renderPopup();
    expect(screen.getByText('Consume Spell Slot')).toBeInTheDocument();
    expect(screen.getByText('Consume Sorcery Points')).toBeInTheDocument();
  });

  it.each`
    optionName                 | expectedCost        | expectedDesc
    ${'Consume Spell Slot'}    | ${'Level 3'}        | ${/Standard spell slot expenditure/}
    ${'Consume Sorcery Points'}| ${'3 SP'}           | ${/No Verbal or Somatic components/}
  `('renders option with correct cost and description ($optionName)', ({ optionName, expectedCost, expectedDesc }) => {
    renderPopup({ spellLevel: 3 });
    expect(screen.getByText(optionName)).toBeInTheDocument();
    expect(screen.getByText(expectedCost)).toBeInTheDocument();
    expect(screen.getByText(expectedDesc)).toBeInTheDocument();
  });

  // ── Confirm behavior ──

  it.each`
    optionName                 | expectedChoice
    ${'Consume Spell Slot'}    | ${'spellSlot'}
    ${'Consume Sorcery Points'}| ${'sorceryPoints'}
  `('calls onConfirm with correct choice when $optionName is clicked', ({ optionName, expectedChoice }) => {
    const { onConfirm } = renderPopup();
    fireEvent.click(screen.getByText(optionName));
    expect(onConfirm).toHaveBeenCalledWith({ choice: expectedChoice });
  });

  // ── Disabled state ──

  it('prevents Consume Sorcery Points action when no sorcery points available', () => {
    const { onConfirm } = renderPopup({ sorceryPointsAvailable: 0 });
    fireEvent.click(screen.getByText('Consume Sorcery Points'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Cancel behavior ──

  it('calls onCancel when Escape key is pressed', () => {
    const { onCancel } = renderPopup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('removes Escape key listener on unmount', () => {
    const { onCancel, unmount } = renderPopup();
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does not call onCancel when clicking the overlay', () => {
    const { onCancel, container } = renderPopup();
    const overlay = container.querySelector('.popup-overlay');
    fireEvent.click(overlay);
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByText('Psionic Sorcery')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const { onCancel } = renderPopup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel when clicking the modal content', () => {
    const { onCancel } = renderPopup();
    fireEvent.click(screen.getByText('Psionic Sorcery'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
