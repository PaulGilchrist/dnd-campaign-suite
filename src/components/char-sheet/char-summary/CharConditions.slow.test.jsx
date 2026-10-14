// @improved-by-ai
/**
 * CharConditions — SP-109: store hydration safety and Slow ending on itself.
 *
 * Scope (owned by this suite):
 * - mount-wipe guard: an un-hydrated store (no activeConditions key) must not
 *   be answered with a stale empty POST that wipes server-side conditions,
 *   while a store hydrated to empty may harmlessly re-save []
 * - conditions that hydrate AFTER mount (via the storage change listener)
 *   appear on the sheet and are echoed back intact, never wiped
 * - a successful repeat save vs the stored DC ends Slow AND strips its
 *   target effects (removeSlowEffectsForTarget) with a 'Slow effects'
 *   removal log entry
 * - negatives: a failed repeat save keeps Slow and its effects untouched,
 *   and ending any OTHER condition never strips Slow's target effects
 *
 * Covered by sibling suites (intentionally NOT re-tested here):
 * - CharConditions.logging.test.jsx         — addEntry/logConditionSave payload
 *   shapes, persistence, onConditionsChange, popup payload
 * - CharConditions.rendering.test.jsx       — badge text/tooltips, dedup,
 *   empty state, popup render, re-mount on name change
 * - CharConditions.condition-saves.test.jsx — advantage triggers, dice/bonus
 *   math, unsavable badges, per-condition save scoping
 * - CharConditions.exhaustion.test.jsx      — exhaustion +/- flow and DC math
 *
 * slowEffects unit math is unit-tested at the service level
 * (services/combat/conditions/slowEffects.test.js); this suite only asserts
 * the component calls it at the right moment, with the right arguments.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions from './CharConditions.jsx';

const CHAR = 'Test Character';
const CAMPAIGN = 'test-campaign';

// Runtime-store fake keyed strictly by `${name}::${key}`. Writes flow through
// to the same table so assertions observe real end state, and every write is
// recorded on the setRuntimeValue spy so "POSTed" / "did not POST" is
// positive evidence, not the absence of a coincidence.
let runtimeValues = {};
// Captured storage-change callbacks so tests can simulate the store
// hydrating with server data AFTER the sheet has mounted (the SP-109 race).
let storageListeners = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => runtimeValues[`${name}::${key}`] ?? null),
  setRuntimeValue: vi.fn((name, key, value) => {
    runtimeValues[`${name}::${key}`] = value;
  }),
  addStorageChangeListener: vi.fn((_name, callback) => {
    storageListeners.push(callback);
    return () => {
      storageListeners = storageListeners.filter((cb) => cb !== callback);
    };
  }),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/conditions/conditionUtils.js', () => ({
  // Realistic label mapping so a wrong ability label threaded into the log
  // is caught (an identity mock would echo any garbage).
  getAbilityLabel: vi.fn((abbr) => {
    const labels = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
    return labels[abbr] || abbr || 'None';
  }),
  // Save bonus is always +2 in this suite — the DC math in comments relies on it.
  getAbilitySaveBonus: vi.fn(() => 2),
}));

// Sentinel descriptions: this suite never asserts rules prose.
vi.mock('../../../services/combat/conditions/effectDescriptions.js', () => ({
  CONDITION_DESCRIPTIONS: {
    Slow: 'TEST slow description',
    Charmed: 'TEST charmed description',
  },
}));

vi.mock('../../../services/combat/conditions/exhaustionRules.js', () => ({
  EXHAUSTION_LEVELS: 6,
  isDeadFromExhaustion: vi.fn((level) => level >= 6),
  getExhaustionSaveDC: vi.fn((level) => 10 + level),
}));

vi.mock('../../../hooks/combat/usePopup.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

// NOTE: exact specifier case matters — the file on disk is lowercase
// popup.jsx (mocking 'Popup.jsx' silently does nothing).
vi.mock('../../common/popup.jsx', () => ({
  default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: vi.fn(() => <div data-testid="dice-roll-result" />),
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
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveAdvantage: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  isAuraOfPurityActive: vi.fn(() => false),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(() => []),
}));

// One spy for the Slow-teardown service; the service's own unit tests own
// what stripping actually does.
const removeSlowEffects = vi.fn(() => true);
vi.mock('../../../services/combat/conditions/slowEffects.js', () => ({
  removeSlowEffectsForTarget: (...args) => removeSlowEffects(...args),
}));

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { rollD20 } from '../../../services/dice/diceRoller.js';
import { addEntry } from '../../../services/ui/logService.js';

describe('CharConditions — SP-109 store hydration and Slow teardown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mockReset (not just clear) so unconsumed mockReturnValueOnce queues
    // from a failed test can never leak into the next one.
    vi.mocked(rollD20).mockReset().mockReturnValue(15);
    removeSlowEffects.mockReset().mockReturnValue(true);
    runtimeValues = {};
    storageListeners = [];
  });

  // Per-test props objects — nothing shared between renders.
  const sheet = (props = {}) => (
    <CharConditions
      playerStats={{
        name: CHAR,
        abilities: [{ name: 'Wisdom', bonus: 1, save: 2 }],
      }}
      campaignName={CAMPAIGN}
      activeMapName={null}
      characters={[]}
      exhaustionLevel={0}
      onConditionsChange={vi.fn()}
      conditionEffects={{}}
      {...props}
    />
  );

  function seedConditions(conditions, meta = {}) {
    runtimeValues[`${CHAR}::activeConditions`] = conditions;
    runtimeValues[`${CHAR}::activeConditionMeta`] = meta;
  }

  // Every activeConditions POST made by the component, newest last.
  const conditionWrites = () =>
    setRuntimeValue.mock.calls.filter(([, key]) => key === 'activeConditions');

  const readStoredConditions = () => runtimeValues[`${CHAR}::activeConditions`];

  const conditionLogEntries = () =>
    addEntry.mock.calls.filter(([, entry]) => entry.type === 'condition');

  describe('mount-wipe guard', () => {
    it('makes no activeConditions POST on mount while the store is un-hydrated', () => {
      // Store reports NO activeConditions key at all (fresh sheet, store
      // still hydrating) — a mount must not answer with a stale empty list.
      const { container } = render(sheet());

      expect(conditionWrites()).toHaveLength(0);
      // Nothing to show yet, and nothing invented in its place.
      expect(container.firstChild).toBeNull();
    });

    it('re-saves the empty list harmlessly once the store is hydrated to empty', () => {
      seedConditions([]);
      render(sheet());

      // Positive evidence of the (benign) write-through, not just a value
      // that was seeded and left untouched.
      expect(setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).toHaveBeenCalledWith(CHAR, 'activeConditions', [], CAMPAIGN);
    });

    it('shows conditions that hydrate after mount and echoes them back intact', () => {
      // The SP-109 race: sheet mounts against an un-hydrated store, then
      // server data arrives through the storage change listener.
      render(sheet());
      expect(conditionWrites()).toHaveLength(0);

      seedConditions(['slow'], { slow: { dc: 12, ability: 'wis' } });
      act(() => storageListeners.forEach((callback) => callback()));

      expect(screen.getByRole('button', { name: 'Slow DC 12' })).toBeInTheDocument();
      // The follow-up write must carry the hydrated list, never an empty one.
      expect(conditionWrites()).toEqual([[CHAR, 'activeConditions', ['slow'], CAMPAIGN]]);
      expect(readStoredConditions()).toEqual(['slow']);
    });
  });

  describe('Slow ends on a successful repeat save', () => {
    // Slow sits at DC 12; roll 15 + save bonus 2 = 17 clears it.
    function seedSlow() {
      seedConditions(['slow'], { slow: { dc: 12, ability: 'wis' } });
    }

    it('clears the condition, strips its target effects, and logs the removal', async () => {
      seedSlow();
      render(sheet());

      fireEvent.click(screen.getByRole('button', { name: 'Slow DC 12' }));

      // Effect-strip is scoped to this character and campaign, exactly once.
      await waitFor(() =>
        expect(removeSlowEffects).toHaveBeenCalledWith(CHAR, CAMPAIGN)
      );
      expect(removeSlowEffects).toHaveBeenCalledTimes(1);

      // Condition gone from the store and off the sheet.
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Slow DC 12' })).not.toBeInTheDocument()
      );
      expect(readStoredConditions()).toEqual([]);

      // Exactly one condition-removal log entry, naming the stripped effects.
      // timestamp is Date.now() metadata — only its presence is asserted.
      const entries = conditionLogEntries();
      expect(entries).toHaveLength(1);
      const [, entry] = entries[0];
      expect(entry).toEqual(expect.objectContaining({
        type: 'condition',
        action: 'removed',
        characterName: CHAR,
        condition: 'Slow effects',
        reason: 'Slow (successful repeat save)',
      }));
      expect(entry.timestamp).toEqual(expect.any(Number));
    });

    it('keeps the condition and leaves target effects untouched when the repeat save fails', async () => {
      vi.mocked(rollD20).mockReturnValue(5); // 5 + 2 < DC 12
      seedSlow();
      render(sheet());

      fireEvent.click(screen.getByRole('button', { name: 'Slow DC 12' }));

      // Positive evidence the save flow ran and FAILED, then the negatives.
      await waitFor(() =>
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
          rollType: 'save',
          dc: 12,
          success: false,
        }))
      );

      expect(removeSlowEffects).not.toHaveBeenCalled();
      expect(conditionLogEntries()).toHaveLength(0);
      expect(readStoredConditions()).toEqual(['slow']);
      expect(screen.getByRole('button', { name: 'Slow DC 12' })).toBeInTheDocument();
    });

    it('never strips Slow target effects when a different condition ends', async () => {
      // Same savable shape, different condition — the Slow teardown must not
      // piggyback on unrelated successful saves.
      seedConditions(['charmed'], { charmed: { dc: 12, ability: 'wis' } });
      render(sheet());

      fireEvent.click(screen.getByRole('button', { name: 'Charmed DC 12' }));

      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Charmed DC 12' })).not.toBeInTheDocument()
      );

      expect(removeSlowEffects).not.toHaveBeenCalled();
      expect(conditionLogEntries()).toHaveLength(0);
    });
  });
});
