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
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
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

    it('shows text-muted span with cur/max label', () => {
      renderCharHitPoints();

      expect(screen.getByText('(cur/max)')).toBeInTheDocument();
    });

    it('renders clickable div with proper accessibility attributes', () => {
      renderCharHitPoints();

      const clickable = getClickable();
      expect(clickable).toHaveAttribute('tabindex', '0');
    });
  });

  describe('initialization', () => {
    it('initializes stored HP to max HP when null on mount', () => {
      renderCharHitPoints();

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        10,
        'test-campaign'
      );
    });

    it('does not initialize stored HP when already set', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 8;
        if (prop === 'aidHpMaxIncrease') return 0;
        return null;
      });

      renderCharHitPoints();

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        8,
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
    });

    it('toggles input visibility on Enter key', () => {
      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.keyDown(clickable, { key: 'Enter' });

      expect(screen.getByTestId('hp-input')).toBeInTheDocument();
    });

    it('toggles back to display on second click', () => {
      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.click(clickable);
      expect(screen.getByTestId('hp-input')).toBeInTheDocument();

      fireEvent.click(clickable);
      expect(screen.getByTestId('hp-display')).toBeInTheDocument();
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

    it('logs hp_change event when HP delta is non-zero', async () => {
      const fetchMock = setupFetchMock();

      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.click(clickable);

      const input = screen.getByTestId('hp-input');
      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/log'),
          expect.objectContaining({
            method: 'POST',
            body: expect.any(String),
          })
        );
      });

      const loggedData = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(loggedData).toEqual(
        expect.objectContaining({
          type: 'hp_change',
          targetName: 'TestCharacter',
          delta: -3,
          currentHp: '7',
          maxHp: 10,
          isHealing: false,
          isUnconscious: false,
        })
      );
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

    it('handles empty string input as zero', () => {
      const fetchMock = setupFetchMock();

      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.click(clickable);

      const input = screen.getByTestId('hp-input');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      // Number('') = 0 in JavaScript, so empty string is treated as 0
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        0,
        'test-campaign'
      );
      expect(fetchMock).toHaveBeenCalled();
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

    it('does not reset death saves when HP stays at or below 0', () => {
      renderCharHitPoints();

      const clickable = getClickable();
      fireEvent.click(clickable);

      const input = screen.getByTestId('hp-input');
      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.blur(input);

      const deathSaveCalls = setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'deathSaves'
      );
      expect(deathSaveCalls).toHaveLength(0);
      expect(clearDeathSavePrompt).not.toHaveBeenCalled();
    });
  });

  describe('death saving throws rendering', () => {
    it('renders DeathSavingThrows when current HP is 0', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 0;
        if (prop === 'aidHpMaxIncrease') return 0;
        return null;
      });

      renderCharHitPoints();

      expect(screen.getByTestId('death-saving-throws')).toBeInTheDocument();
    });

    it('renders DeathSavingThrows when current HP is negative', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return -5;
        if (prop === 'aidHpMaxIncrease') return 0;
        return null;
      });

      renderCharHitPoints();

      expect(screen.getByTestId('death-saving-throws')).toBeInTheDocument();
    });

    it('does not render DeathSavingThrows when HP is positive', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 5;
        if (prop === 'aidHpMaxIncrease') return 0;
        return null;
      });

      renderCharHitPoints();

      expect(screen.queryByTestId('death-saving-throws')).not.toBeInTheDocument();
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

    it('ignores death-save-result event for different character', async () => {
      renderCharHitPoints();

      const initCallCount = setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'currentHitPoints'
      ).length;

      const event = new CustomEvent('death-save-result', {
        detail: { targetName: 'OtherCharacter', restoredToHp: 8 },
      });
      window.dispatchEvent(event);

      await waitFor(() => {
        const afterCallCount = setRuntimeValue.mock.calls.filter(
          (call) => call[1] === 'currentHitPoints'
        ).length;
        expect(afterCallCount).toBe(initCallCount);
      });
    });

    it('ignores death-save-result event when restoredToHp is falsy', async () => {
      renderCharHitPoints();

      const initCallCount = setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'currentHitPoints'
      ).length;

      const event = new CustomEvent('death-save-result', {
        detail: { targetName: 'TestCharacter', restoredToHp: 0 },
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

  describe('effective max HP calculation', () => {
    it('combines base hitPoints with aidHpMaxIncrease', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 5;
        if (prop === 'aidHpMaxIncrease') return 3;
        return null;
      });

      renderCharHitPoints();

      const clickable = getClickable();
      expect(clickable.textContent).toContain('13');
    });

    it('treats missing aidHpMaxIncrease as 0', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return null;
        if (prop === 'aidHpMaxIncrease') return undefined;
        return null;
      });

      renderCharHitPoints();

      const clickable = getClickable();
      expect(clickable.textContent).toContain('10');
    });
  });

  describe('death-save-result event edge cases', () => {
    it('ignores death-save-result event when detail is null', async () => {
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

    it('ignores death-save-result event when detail has no targetName', async () => {
      renderCharHitPoints();

      const initCallCount = setRuntimeValue.mock.calls.filter(
        (call) => call[1] === 'currentHitPoints'
      ).length;

      const event = new CustomEvent('death-save-result', {
        detail: { restoredToHp: 8 },
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

  describe('stored HP of zero', () => {
    it('treats stored HP of 0 as valid (not null)', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 0;
        if (prop === 'aidHpMaxIncrease') return 0;
        return null;
      });

      renderCharHitPoints();

      expect(screen.getByTestId('hp-display')).toHaveTextContent('0');
    });

    it('renders DeathSavingThrows when stored HP is 0', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return 0;
        if (prop === 'aidHpMaxIncrease') return 0;
        return null;
      });

      renderCharHitPoints();

      expect(screen.getByTestId('death-saving-throws')).toBeInTheDocument();
    });
  });

  describe('initialization with null/undefined', () => {
    it('initializes stored HP when stored value is null', () => {
      useRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'currentHitPoints') return null;
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

    it('initializes stored HP when stored value is undefined', () => {
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
});
