import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharHitPoints from './CharHitPoints.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
  clearDeathSavePrompt: vi.fn(),
}));

vi.mock('./DeathSavingThrows.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div>Death Saving Throws for {playerStats.name}</div>
  )),
}));

// Simplified HiddenInput mock matching the real component's behavior
vi.mock('../../common/HiddenInput.jsx', () => {
  const MockHiddenInput = ({ value, showInput, handleValueChange, handleInputToggle }) => {
    if (showInput) {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          onBlur={() => handleInputToggle()}
        />
      );
    }
    return <span>{value}</span>;
  };
  return { default: MockHiddenInput };
});

import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js';

const mockPlayerStats = {
  name: 'TestCharacter',
  hitPoints: 10,
};

const campaignName = 'test-campaign';

function renderCharHitPoints(props = {}) {
  return render(
    <CharHitPoints playerStats={mockPlayerStats} campaignName={campaignName} {...props} />
  );
}

describe('CharHitPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: vi.fn(() => Promise.resolve({})) }));
    useRuntimeValue.mockReturnValue(null);
  });

  describe('initial display', () => {
    it.each([
      ['aidHpMaxIncrease', 3, null, '13'],
      ['heroesFeastHpMaxIncrease', null, 5, '15'],
      ['aid + heroesFeast combined', 3, 5, '18'],
    ])('displays effective max HP with %s: %s', (_name, aidVal, hfVal, expected) => {
      useRuntimeValue.mockImplementation((_, prop) => {
        if (prop === 'aidHpMaxIncrease') return aidVal;
        if (prop === 'heroesFeastHpMaxIncrease') return hfVal;
        return null;
      });

      renderCharHitPoints();

      const clickable = screen.getByText(/Hit Points:/).parentElement;
      expect(clickable).toHaveTextContent(new RegExp(`${expected}\\/${expected}`));
    });

    it('shows stored current HP when available instead of max', () => {
      useRuntimeValue.mockImplementation((_, prop) => {
        if (prop === 'currentHitPoints') return 5;
        return null;
      });

      renderCharHitPoints();

      const clickable = screen.getByText(/Hit Points:/).parentElement;
      expect(clickable).toHaveTextContent(/5\/10/);
    });
  });

  describe('temp HP display', () => {
    it('shows temp HP when tempHp is greater than 0', () => {
      useRuntimeValue.mockImplementation((_, prop) => {
        if (prop === 'tempHp') return 5;
        return null;
      });

      renderCharHitPoints();

      expect(screen.getByText(/Temp HP: 5/)).toBeInTheDocument();
    });

    it.each([
      ['0', 0],
      ['null', null],
    ])('hides temp HP when tempHp is %s', (_label, value) => {
      useRuntimeValue.mockImplementation((_, prop) => {
        if (prop === 'tempHp') return value;
        return null;
      });

      renderCharHitPoints();

      expect(screen.queryByText(/Temp HP/)).not.toBeInTheDocument();
    });
  });

  describe('HP input toggling', () => {
    it('toggles input visibility on click', () => {
      renderCharHitPoints();

      const clickable = screen.getByText(/Hit Points:/).parentElement;
      fireEvent.click(clickable);

      expect(screen.getByRole('spinbutton')).toBeInTheDocument();

      fireEvent.click(clickable);
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });
  });

  describe('HP value changes', () => {
    it.each([
      ['decreased', 7],
      ['increased', 15],
    ])('calls setRuntimeValue when current HP is %s', (_label, newValue) => {
      renderCharHitPoints();

      const clickable = screen.getByText(/Hit Points:/).parentElement;
      fireEvent.click(clickable);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: String(newValue) } });
      fireEvent.blur(input);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        newValue,
        'test-campaign'
      );
    });

    it.each([
      ['damage', 10, 7, -3, false, false],
      ['healing', 5, 10, 5, true, false],
      ['zero HP (unconscious)', 10, 0, -10, false, true],
    ])('logs hp_change event: %s (old=%d, new=%d, delta=%d, isHealing=%s, isUnconscious=%s)', (_label, oldHp, newHp, delta, isHealing, isUnconscious) => {
      const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: vi.fn(() => Promise.resolve({})) }));
      global.fetch = fetchMock;

      if (oldHp !== 10) {
        useRuntimeValue.mockImplementation((_, prop) => {
          if (prop === 'currentHitPoints') return oldHp;
          return null;
        });
      }

      renderCharHitPoints();

      const clickable = screen.getByText(/Hit Points:/).parentElement;
      fireEvent.click(clickable);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: String(newHp) } });
      fireEvent.blur(input);

      const loggedData = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(loggedData).toEqual(
        expect.objectContaining({
          type: 'hp_change',
          targetName: 'TestCharacter',
          delta,
          isHealing,
          isUnconscious,
        })
      );
    });

    it('resets death saves when HP is set above 0', () => {
      renderCharHitPoints();

      const clickable = screen.getByText(/Hit Points:/).parentElement;
      fireEvent.click(clickable);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.blur(input);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'deathSaves',
        [false, false, false],
        'test-campaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'deathFailures',
        [false, false, false],
        'test-campaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'isDead',
        0,
        'test-campaign'
      );
      expect(clearDeathSavePrompt).toHaveBeenCalledWith('test-campaign', 'TestCharacter');
    });

    it('does not reset death saves when HP is set to 0 or below', () => {
      renderCharHitPoints();

      const clickable = screen.getByText(/Hit Points:/).parentElement;
      fireEvent.click(clickable);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '-2' } });
      fireEvent.blur(input);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestCharacter',
        'deathSaves',
        [false, false, false],
        'test-campaign'
      );
      expect(clearDeathSavePrompt).not.toHaveBeenCalled();
    });

  });

  describe('death saving throws rendering', () => {
    it.each([
      ['0', 0],
      ['negative (-5)', -5],
    ])('renders DeathSavingThrows when current HP is %s', (_label, hp) => {
      useRuntimeValue.mockImplementation((_, prop) => {
        if (prop === 'currentHitPoints') return hp;
        return null;
      });

      renderCharHitPoints();

      expect(screen.getByText(/Death Saving Throws/)).toBeInTheDocument();
    });

    it('does not render DeathSavingThrows when current HP is above 0', () => {
      useRuntimeValue.mockImplementation((_, prop) => {
        if (prop === 'currentHitPoints') return 1;
        return null;
      });

      renderCharHitPoints();

      expect(screen.queryByText(/Death Saving Throws/)).not.toBeInTheDocument();
    });
  });

  describe('death-save-result event', () => {
    it('updates current HP when event target matches character name', () => {
      renderCharHitPoints();

      const event = new CustomEvent('death-save-result', {
        detail: { targetName: 'TestCharacter', restoredToHp: 8 },
      });
      window.dispatchEvent(event);

      expect(setRuntimeValue).toHaveBeenLastCalledWith(
        'TestCharacter',
        'currentHitPoints',
        8,
        'test-campaign'
      );
    });

    it.each([
      ['non-matching targetName', { targetName: 'OtherCharacter', restoredToHp: 8 }],
      ['null detail', null],
      ['missing restoredToHp', { targetName: 'TestCharacter' }],
    ])('ignores death-save-result event when %s', (_label, detail) => {
      renderCharHitPoints();

      const event = new CustomEvent('death-save-result', { detail });
      window.dispatchEvent(event);

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
