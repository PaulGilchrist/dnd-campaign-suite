// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import DiceTray, { DicePopup } from './DiceTray.jsx';
import * as diceRoller from '../../services/dice/diceRoller.js';

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

function renderDiceTray(props = {}) {
  return render(<DiceTray {...props} />);
}

function renderPopup(result = { label: 'd20', value: 15 }) {
  const onClose = vi.fn();
  const utils = render(<DicePopup result={result} onClose={onClose} />);
  return { onClose, ...utils };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.removeEventListener('keydown', () => {});
});

describe('DiceTray', () => {
  describe('rendering', () => {
    it.each(DICE)(
      'renders a button with title "Roll $label" for each die type',
      ({ label }) => {
        renderDiceTray();
        const button = screen.getByTitle(`Roll ${label}`);
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent(label);
      },
    );
  });

  describe('rolling', () => {
    it.each(DICE)(
      'calls onRoll with the correct label and rolled value for $label',
      ({ label, sides: _sides }) => {
        const onRoll = vi.fn();
        vi.spyOn(diceRoller, 'rollDie').mockReturnValue(MOCK_ROLL_VALUE);
        renderDiceTray({ onRoll });
        fireEvent.click(screen.getByTitle(`Roll ${label}`));
        expect(onRoll).toHaveBeenCalledWith({ label, value: MOCK_ROLL_VALUE });
      },
    );
  });
});

describe('DicePopup', () => {
  describe('rendering', () => {
    it.each(DICE)(
      'renders the result icon for $label',
      ({ label }) => {
        renderPopup({ label, value: 1 });
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText(label)).toBeInTheDocument();
      },
    );

    it('renders the rolled value and die label', () => {
      renderPopup();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('d20')).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('does not call onClose when the overlay is clicked', () => {
      const { container, onClose } = renderPopup();
      fireEvent.click(container.querySelector('.dice-tray-popup-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(container.querySelector('.dice-tray-popup-modal')).toBeInTheDocument();
    });

    it('calls onClose when the close button is clicked', () => {
      const { onClose } = renderPopup();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose on Escape press', () => {
      const { onClose } = renderPopup();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
