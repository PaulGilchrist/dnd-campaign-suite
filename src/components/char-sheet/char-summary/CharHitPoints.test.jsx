// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  default: vi.fn(({ playerStats, campaignName }) => (
    <div data-testid="death-saving-throws">
      Death Saving Throws for {playerStats.name} in {campaignName}
    </div>
  )),
}));

vi.mock('../../../services/combat/conditions/deathSaveRules.js', () => ({}));

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveModifier: vi.fn(() => false),
}));

vi.mock('../../../components/common/HiddenInput.jsx', () => {
  const MockHiddenInput = ({ value, showInput, handleValueChange, handleInputToggle }) => {
    if (showInput) {
      return (
        <input
          data-testid="hp-input"
          type="number"
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          onBlur={() => handleInputToggle()}
        />
      );
    }
    return <span data-testid="hp-display">{value}</span>;
  };
  MockHiddenInput.displayName = 'MockHiddenInput';
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

function getClickable() {
  return screen.getByText(/Hit Points:/).parentElement;
}

function setupFetchMock() {
  const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
  global.fetch = fetchMock;
  return fetchMock;
}

describe('CharHitPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: vi.fn() }));
    useRuntimeValue.mockImplementation((_key, prop) => {
      if (prop === 'currentHitPoints') return null;
      if (prop === 'aidHpMaxIncrease') return 0;
      return null;
    });
  });

  describe('initial display', () => {
    it('renders hit points label with current and max values', () => {
      renderCharHitPoints();

      expect(screen.getByText(/Hit Points:/)).toBeInTheDocument();
      expect(screen.getByTestId('hp-display')).toHaveTextContent('10');
    });

    it('displays effective max HP when aidHpMaxIncrease is set', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return null;
        if (prop === 'aidHpMaxIncrease') return 3;
        return null;
      });

      renderCharHitPoints();

      const clickable = getClickable();
      expect(clickable.textContent).toContain('13');
    });

    it('shows stored current HP when available instead of max', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 5;
        if (prop === 'aidHpMaxIncrease') return 0;
        return null;
      });

      renderCharHitPoints();

      expect(screen.getByTestId('hp-display')).toHaveTextContent('5');
    });
  });

  describe('initialization', () => {
    it('initializes stored HP to max HP when null or undefined on mount', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return undefined;
        if (prop === 'aidHpMaxIncrease') return 0;
        return null;
      });

      renderCharHitPoints();

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        10,
        'test-campaign'
      );
    });
  });

  describe('HP input toggling', () => {
    it('toggles input visibility on click', () => {
      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.click(clickable);

      expect(screen.getByTestId('hp-input')).toBeInTheDocument();
      expect(screen.queryByTestId('hp-display')).not.toBeInTheDocument();

      fireEvent.click(clickable);
      expect(screen.getByTestId('hp-display')).toBeInTheDocument();
      expect(screen.queryByTestId('hp-input')).not.toBeInTheDocument();
    });
  });

  describe('HP value changes', () => {
    it('calls setRuntimeValue when current HP is changed', () => {
      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.click(clickable);

      const input = screen.getByTestId('hp-input');
      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.blur(input);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        7,
        'test-campaign'
      );
    });

    it('logs hp_change event with delta, isHealing, and isUnconscious flags', async () => {
      const fetchMock = setupFetchMock();

      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.click(clickable);

      const input = screen.getByTestId('hp-input');
      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const loggedData = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(loggedData).toEqual(
          expect.objectContaining({
            type: 'hp_change',
            targetName: 'TestCharacter',
            delta: -3,
            isHealing: false,
            isUnconscious: false,
          })
        );
      });
    });

    it('logs healing when HP delta is positive', async () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 3;
        if (prop === 'aidHpMaxIncrease') return 0;
        return null;
      });

      const fetchMock = setupFetchMock();

      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.click(clickable);

      const input = screen.getByTestId('hp-input');
      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const loggedData = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(loggedData.isHealing).toBe(true);
      });
    });

    it('logs unconscious when HP is set to 0 or below', async () => {
      const fetchMock = setupFetchMock();

      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.click(clickable);

      const input = screen.getByTestId('hp-input');
      fireEvent.change(input, { target: { value: '-1' } });
      fireEvent.blur(input);

      await waitFor(() => {
        const loggedData = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(loggedData.isUnconscious).toBe(true);
      });
    });

    it('does not log hp_change when HP value is unchanged', () => {
      const fetchMock = setupFetchMock();

      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.click(clickable);

      const input = screen.getByTestId('hp-input');
      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.blur(input);

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('death save reset', () => {
    it('resets death saves when HP is set above 0', () => {
      const fetchMock = setupFetchMock();

      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.click(clickable);

      const input = screen.getByTestId('hp-input');
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
      expect(clearDeathSavePrompt).toHaveBeenCalledWith('test-campaign', 'TestCharacter');

      fetchMock.mockRestore?.();
    });
  });

  describe('death saving throws rendering', () => {
    it('renders DeathSavingThrows when current HP is at or below 0', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return -5;
        if (prop === 'aidHpMaxIncrease') return 0;
        return null;
      });

      renderCharHitPoints();

      expect(screen.getByTestId('death-saving-throws')).toBeInTheDocument();
    });
  });

  describe('death-save-result event', () => {
    it('updates current HP when event target matches character name', async () => {
      renderCharHitPoints();

      const initCallCount = setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'currentHitPoints'
      ).length;

      const event = new CustomEvent('death-save-result', {
        detail: { targetName: 'TestCharacter', restoredToHp: 8 },
      });
      window.dispatchEvent(event);

      await waitFor(() => {
        const afterCallCount = setRuntimeValue.mock.calls.filter(
          (call) => call[1] === 'currentHitPoints'
        ).length;
        expect(afterCallCount).toBe(initCallCount + 1);
        expect(setRuntimeValue).toHaveBeenLastCalledWith(
          'TestCharacter',
          'currentHitPoints',
          8,
          'test-campaign'
        );
      });
    });

    it('ignores death-save-result event when detail is missing or null', async () => {
      renderCharHitPoints();

      const initCallCount = setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'currentHitPoints'
      ).length;

      const event = new CustomEvent('death-save-result', {
        detail: null,
      });
      window.dispatchEvent(event);

      await waitFor(() => {
        const afterCallCount = setRuntimeValue.mock.calls.filter(
          (call) => call[1] === 'currentHitPoints'
        ).length;
        expect(afterCallCount).toBe(initCallCount);
      });
    });
  });
});
