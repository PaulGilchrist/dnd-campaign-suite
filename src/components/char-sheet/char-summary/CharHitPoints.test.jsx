// @maintained-by-ai
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

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./DeathSavingThrows.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div>Death Saving Throws for {playerStats.name}</div>
  )),
}));

import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { clearDeathSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../services/ui/logService.js';

const NAME = 'TestCharacter';
const CAMPAIGN = 'test-campaign';

function mockRuntimeValues(values = {}) {
  useRuntimeValue.mockImplementation((_, prop) => values[prop] ?? null);
}

function renderCharHitPoints(props = {}) {
  return render(
    <CharHitPoints playerStats={{ name: NAME, hitPoints: 10 }} campaignName={CAMPAIGN} {...props} />
  );
}

// Opens the HP editor (HiddenInput renders its own lane, so use it unmocked)
// and commits a new value via change + blur, the real user path.
function commitHp(newValue) {
  fireEvent.click(screen.getByText(/Hit Points:/).parentElement);
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: String(newValue) } });
  fireEvent.blur(input);
}

describe('CharHitPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addEntry.mockResolvedValue({});
    mockRuntimeValues();
  });

  it.each([
    ['stored current HP plus Aid and Heroe\'s Feast max bonuses', { currentHitPoints: 5, aidHpMaxIncrease: 3, heroesFeastHpMaxIncrease: 5 }, '5/18'],
    ['no stored HP defaults current to base max', {}, '10/10'],
  ])('displays %s', (_label, values, expected) => {
    mockRuntimeValues(values);
    renderCharHitPoints();

    expect(screen.getByText(/Hit Points:/).parentElement).toHaveTextContent(expected);
  });

  it.each([
    [5, true],
    [0, false],
  ])('shows Temp HP only when tempHp is %i', (tempHp, visible) => {
    mockRuntimeValues({ tempHp });
    renderCharHitPoints();

    expect(!!screen.queryByText(/Temp HP:/)).toBe(visible);
  });

  it('toggles the HP input open and closed on click', () => {
    renderCharHitPoints();

    const clickable = screen.getByText(/Hit Points:/).parentElement;
    fireEvent.click(clickable);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();

    fireEvent.click(clickable);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it.each([
    // [label, storedHp, commitTo, delta, isHealing, isUnconscious, resetsDeathSaves]
    ['damage', null, 7, -3, false, false, true],
    ['healing', 5, 10, 5, true, false, true],
    ['dropping to 0 (unconscious)', null, 0, -10, false, true, false],
    ['an unchanged value', null, 10, 0, false, false, true],
  ])('committing %s writes HP, logs hp_change only when HP changed, and %s death saves',
    (_label, storedHp, newValue, delta, isHealing, isUnconscious, resets) => {
      mockRuntimeValues({ currentHitPoints: storedHp });
      renderCharHitPoints();
      commitHp(newValue);

      expect(setRuntimeValue).toHaveBeenCalledWith(NAME, 'currentHitPoints', newValue, CAMPAIGN);

      if (delta !== 0) {
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
          type: 'hp_change',
          targetName: NAME,
          delta,
          isHealing,
          isUnconscious,
        }));
      } else {
        expect(addEntry).not.toHaveBeenCalled();
      }

      if (resets) {
        expect(setRuntimeValue).toHaveBeenCalledWith(NAME, 'deathSaves', [false, false, false], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenCalledWith(NAME, 'deathFailures', [false, false, false], CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenCalledWith(NAME, 'isDead', 0, CAMPAIGN);
        expect(clearDeathSavePrompt).toHaveBeenCalledWith(CAMPAIGN, NAME);
      } else {
        expect(setRuntimeValue).not.toHaveBeenCalledWith(NAME, 'deathSaves', [false, false, false], CAMPAIGN);
        expect(clearDeathSavePrompt).not.toHaveBeenCalled();
      }
    });

  it('restores current HP from a matching death-save-result event', () => {
    renderCharHitPoints();

    window.dispatchEvent(new CustomEvent('death-save-result', {
      detail: { targetName: NAME, restoredToHp: 8 },
    }));

    expect(setRuntimeValue).toHaveBeenCalledWith(NAME, 'currentHitPoints', 8, CAMPAIGN);
  });

  it.each([
    ['non-matching targetName', { targetName: 'OtherCharacter', restoredToHp: 8 }],
    ['missing restoredToHp', { targetName: NAME }],
  ])('ignores death-save-result event when %s', (_label, detail) => {
    renderCharHitPoints();

    window.dispatchEvent(new CustomEvent('death-save-result', { detail }));

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it.each([
    [0, true],
    [1, false],
  ])('renders DeathSavingThrows when current HP is %i only if unconscious', (hp, visible) => {
    mockRuntimeValues({ currentHitPoints: hp });
    renderCharHitPoints();

    expect(!!screen.queryByText(/Death Saving Throws/)).toBe(visible);
  });
});
