// @improved-by-ai
/**
 * CharConditions — exhaustion +/- controls.
 *
 * Scope (owned by this suite):
 * - badge/controls absent at level 0 (and no side effects)
 * - minus: always rolls a CON save vs the CURRENT level's DC, logs it,
 *   decrements only on success (boundary inclusive), never on failure
 * - plus: increments without rolling, reaches the level-6 cap
 * - minus still rescues at level 6 (dead) vs DC 16
 *
 * Covered by sibling suites (intentionally NOT re-tested here):
 * - CharConditions.logging.test.jsx         — addEntry/logConditionSave payloads, popups
 * - CharConditions.rendering.test.jsx       — badge text/tooltips, dedup, dead styling, plus-disabled at max
 * - CharConditions.condition-saves.test.jsx — condition-save advantage/bonus mechanics
 * - CharConditions.slow.test.jsx            — SP-109 mount-wipe guard, Slow repeat saves
 *
 * exhaustionRules math is mocked here (and unit-tested at the service level);
 * this suite only asserts the component wires the current level's DC through.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions from './CharConditions.jsx';

let runtimeValues = {};
let mockCombatSummary = null;

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_name, key, _campaignName) => runtimeValues[key] ?? null),
  setRuntimeValue: vi.fn((_name, key, value, _campaignName) => {
    runtimeValues[key] = value;
  }),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilityLabel: vi.fn((abbr) => abbr || 'None'),
  // CON save bonus is always 2 in this suite — comment math below relies on it
  getAbilitySaveBonus: vi.fn(() => 2),
}));

vi.mock('../../../services/combat/conditions/exhaustionRules.js', () => ({
  EXHAUSTION_LEVELS: 6,
  isDeadFromExhaustion: vi.fn((level) => level >= 6),
  getExhaustionSaveDC: vi.fn((level) => 10 + level),
}));

const mockSetPopupHtml = vi.fn();

vi.mock('../../../hooks/combat/usePopup.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: mockSetPopupHtml,
  })),
}));

vi.mock('../../common/Popup.jsx', () => ({
  default: vi.fn(({ children }) => (
    <div data-testid="popup">{children}</div>
  )),
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: vi.fn(({ children }) => (
    <div data-testid="dice-roll-result">{children}</div>
  )),
}));

vi.mock('../../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatLoggingService.js', () => ({
  logConditionSave: vi.fn(() => Promise.resolve()),
  logConcentrationSave: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => mockCombatSummary),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  isAuraOfPurityActive: vi.fn(() => false),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(() => []),
}));

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { addEntry } from '../../../services/ui/logService.js';

const CHAR = 'Test Character';
const CAMPAIGN = 'test-campaign';

describe('CharConditions exhaustion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mockReset (not just clear) so unconsumed mockReturnValueOnce queues
    // from a previous test cannot leak into the next one.
    rollD20.mockReset().mockReturnValue(15);
    runtimeValues = {};
    mockCombatSummary = null;
  });

  const defaultProps = {
    playerStats: {
      name: CHAR,
      abilities: [
        { name: 'Constitution', bonus: 2, save: 3 },
        { name: 'Wisdom', bonus: 1, save: 2 },
      ],
    },
    campaignName: CAMPAIGN,
    activeMapName: 'test-map',
    characters: [],
    exhaustionLevel: 0,
    onConditionsChange: vi.fn(),
    conditionEffects: {},
  };

  const renderAt = (exhaustionLevel) =>
    render(<CharConditions {...defaultProps} exhaustionLevel={exhaustionLevel} />);

  const clickMinus = () => fireEvent.click(screen.getByRole('button', { name: '−' }));
  const clickPlus = () => fireEvent.click(screen.getByRole('button', { name: '+' }));

  /** Every setRuntimeValue write that targets the exhaustion level. */
  const exhaustionWrites = () =>
    setRuntimeValue.mock.calls.filter(([, key]) => key === 'exhaustionLevel');

  describe('level 0 (no exhaustion)', () => {
    it('renders no exhaustion badge or buttons and performs no side effects', () => {
      renderAt(0);

      expect(screen.queryByText(/Exhaustion \(\d+\)/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '−' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '+' })).not.toBeInTheDocument();
      expect(rollD20).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('minus button — CON save vs the current level DC', () => {
    it('rolls once and logs a consistent Constitution save entry', async () => {
      // DC for level 3 is 13; roll 15 + bonus 2 = 17 >= 13 → success.
      renderAt(3);
      clickMinus();

      await waitFor(() => expect(addEntry).toHaveBeenCalled());

      expect(rollD20).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'roll',
        characterName: CHAR,
        rollType: 'save',
        name: 'Constitution Save (Exhaustion)',
        rolls: [15],
        mode: 'normal',
        total: 15,
        bonus: 2,
        dc: 13,
        success: true,
        condition: 'Exhaustion',
      });
    });

    it('decrements exhaustion by 1 when the save meets the DC exactly', async () => {
      // DC for level 3 is 13; roll 11 + bonus 2 = 13 → RAW, meets DC succeeds.
      rollD20.mockReturnValueOnce(11);
      renderAt(3);
      clickMinus();

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(CHAR, 'exhaustionLevel', 2, CAMPAIGN);
      });
    });

    it('does not decrement exhaustion when the save fails by one', async () => {
      // DC for level 3 is 13; roll 10 + bonus 2 = 12 < 13 → failure.
      rollD20.mockReturnValueOnce(10);
      renderAt(3);
      clickMinus();

      // Positive evidence the save flow ran to completion, THEN check absence:
      // a bare negative assertion would pass instantly even if broken.
      await waitFor(() => expect(mockSetPopupHtml).toHaveBeenCalled());
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ success: false, dc: 13 }));
      expect(exhaustionWrites()).toEqual([]);
    });

    it('can rescue a dead character at level 6 (minus rolls vs DC 16)', async () => {
      // DC for level 6 is 16; roll 15 + bonus 2 = 17 >= 16 → success, back to 5.
      renderAt(6);
      expect(screen.getByText('Exhaustion (6)')).toBeInTheDocument();

      clickMinus();

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(CHAR, 'exhaustionLevel', 5, CAMPAIGN);
      });
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ dc: 16, success: true }));
    });
  });

  describe('plus button — increment without rolling', () => {
    it.each`
      level | next
      ${1}  | ${2}
      ${3}  | ${4}
      ${5}  | ${6}
    `('level $level → $next with no save roll and no log entry', ({ level, next }) => {
      renderAt(level);
      clickPlus();

      expect(setRuntimeValue).toHaveBeenCalledWith(CHAR, 'exhaustionLevel', next, CAMPAIGN);
      expect(rollD20).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('DC wiring', () => {
    // The DC formula itself lives in exhaustionRules (service-level tests);
    // this only verifies the component feeds the CURRENT level to the popup.
    it.each`
      level | expectedDc
      ${1}  | ${11}
      ${3}  | ${13}
      ${5}  | ${15}
    `('minus save popup shows DC $expectedDc at exhaustion level $level', async ({ level, expectedDc }) => {
      renderAt(level);
      clickMinus();

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ dc: expectedDc }));
      });
    });
  });
});
