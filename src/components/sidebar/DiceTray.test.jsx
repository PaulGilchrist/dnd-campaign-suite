// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import DiceTray, { DicePopup } from './DiceTray.jsx';
import * as diceRoller from '../../services/dice/diceRoller.js';

// Standard dice set the tray must expose (mirrors DiceTray's dice list).
const DICE = [
  { label: 'd4', sides: 4 },
  { label: 'd6', sides: 6 },
  { label: 'd8', sides: 8 },
  { label: 'd10', sides: 10 },
  { label: 'd12', sides: 12 },
  { label: 'd20', sides: 20 },
  { label: 'd100', sides: 100 },
];

const MOCK_ROLL_VALUE = 7;

function renderPopup(result = { label: 'd20', value: 15 }) {
  const onClose = vi.fn();
  const utils = render(<DicePopup result={result} onClose={onClose} />);
  return { onClose, ...utils };
}

function resultIcon() {
  return document.querySelector('.dice-tray-result-icon').firstElementChild;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DiceTray', () => {
  it('renders a titled button for each standard die', () => {
    render(<DiceTray />);
    for (const { label } of DICE) {
      expect(screen.getByTitle(`Roll ${label}`)).toHaveTextContent(label);
    }
  });

  it('every die button carries a uniform aria-label="Roll dN" matching its die', () => {
    const { container } = render(<DiceTray />);
    const buttons = [...container.querySelectorAll('.dice-tray button')];
    // Complete die set present, no unlabeled buttons in the tray.
    expect(buttons).toHaveLength(DICE.length);
    for (const button of buttons) {
      const label = button.getAttribute('aria-label');
      expect(label, 'every tray button has an aria-label').not.toBeNull();
      expect(label).toMatch(/^Roll d\d+$/);
    }
    // Each die is reachable by its accessible name and the name matches its text.
    for (const { label } of DICE) {
      const button = screen.getByRole('button', { name: `Roll ${label}` });
      expect(button).toHaveTextContent(label);
    }
  });

  it('clicking each die calls onRoll with its label and rolled value', () => {
    const onRoll = vi.fn();
    vi.spyOn(diceRoller, 'rollDie').mockReturnValue(MOCK_ROLL_VALUE);
    render(<DiceTray onRoll={onRoll} />);
    DICE.forEach(({ label }, i) => {
      fireEvent.click(screen.getByRole('button', { name: `Roll ${label}` }));
      expect(onRoll).toHaveBeenNthCalledWith(i + 1, { label, value: MOCK_ROLL_VALUE });
    });
  });
});

describe('DicePopup', () => {
  it('renders the rolled value and die label', () => {
    renderPopup();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('d20')).toBeInTheDocument();
  });

  it('renders an icon for every supported die', () => {
    const { rerender } = renderPopup({ label: 'd4', value: 1 });
    for (const { label } of DICE) {
      rerender(<DicePopup result={{ label, value: 1 }} onClose={vi.fn()} />);
      expect(resultIcon()).not.toBeNull();
    }
  });

  it('does not close when the overlay is clicked', () => {
    const { container, onClose } = renderPopup();
    fireEvent.click(container.querySelector('.dice-tray-popup-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('.dice-tray-popup-modal')).toBeInTheDocument();
  });

  it('closes via the close button and the Escape key', () => {
    const { onClose } = renderPopup();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('removes its Escape listener on unmount', () => {
    const { onClose, unmount } = renderPopup();
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
