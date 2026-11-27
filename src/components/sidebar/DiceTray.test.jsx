// @maintained-by-ai 2026-11-26
/* Lane: DiceTray / DicePopup UI behavior only.
 * Sibling lanes (not re-asserted here): decorative-glyph textContent leaks in
 * DiceTray.glyph-leak.test.jsx; campaign-log writes and popup auto-hide via
 * Sidebar in Sidebar.dice-tray-log.test.jsx / Sidebar.dice-tray-auto-hide.test.jsx;
 * dice-engine math in the services/dice tests. */
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DiceTray', () => {
  it('renders exactly one button per standard die, named "Roll dN" by title, aria-label, and text', () => {
    const { container } = render(<DiceTray />);
    // Complete set, no extras.
    expect(container.querySelectorAll('.dice-tray button')).toHaveLength(DICE.length);
    for (const { label } of DICE) {
      // Reachable by both affordances, and each carries its die label as text.
      expect(screen.getByTitle(`Roll ${label}`)).toHaveTextContent(label);
      expect(screen.getByRole('button', { name: `Roll ${label}` })).toHaveTextContent(label);
    }
  });

  it('clicking each die rolls that die and reports { label, value } to onRoll', () => {
    const onRoll = vi.fn();
    const rollSpy = vi.spyOn(diceRoller, 'rollDie').mockReturnValue(MOCK_ROLL_VALUE);
    render(<DiceTray onRoll={onRoll} />);
    DICE.forEach(({ label, sides }, i) => {
      fireEvent.click(screen.getByRole('button', { name: `Roll ${label}` }));
      // Pin the wiring: the dN button must roll dN, not just any die.
      expect(rollSpy).toHaveBeenNthCalledWith(i + 1, sides);
      expect(onRoll).toHaveBeenNthCalledWith(i + 1, { label, value: MOCK_ROLL_VALUE });
    });
  });
});

describe('DicePopup', () => {
  it('renders the rolled value, die label, and a non-null icon for every supported die', () => {
    const { rerender } = renderPopup();
    for (const { label } of DICE) {
      rerender(<DicePopup result={{ label, value: MOCK_ROLL_VALUE }} onClose={vi.fn()} />);
      expect(screen.getByText(String(MOCK_ROLL_VALUE))).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
      // Every supported die must resolve an icon (the null default is a bug here).
      expect(document.querySelector('.dice-tray-result-icon').firstElementChild, `${label} icon`).not.toBeNull();
    }
  });

  it('closes only on backdrop clicks — clicks on the modal or its contents are inert', () => {
    const { container, onClose } = renderPopup();
    const overlay = container.querySelector('.dice-tray-popup-overlay');
    // Child clicks bubble through the overlay handler too — the
    // closest('.dice-tray-popup-modal') guard must keep them inert.
    fireEvent.click(container.querySelector('.dice-tray-popup-modal'));
    fireEvent.click(container.querySelector('.dice-tray-result-value'));
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector('.dice-tray-popup-modal')).toBeInTheDocument();
    // A pure backdrop click is onClose — no re-roll, no state write.
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
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
