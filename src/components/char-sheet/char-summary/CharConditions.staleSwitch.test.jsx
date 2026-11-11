// @maintained-by-ai
/**
 * CharConditions — character-switch stale-state guard
 * (bug-sheet-open-rebake-evicts-prior-session-conditions).
 *
 * Live-proved race (2026-11-10, run HD + fix run): CharSheet survives a
 * sidebar character switch, so this component's persistence effect re-ran on
 * the playerStats.name flip carrying the PREVIOUS character's stale
 * activeConditions state. setRuntimeValue POSTs the FULL store bucket as a
 * REPLACE (server writes are whole-bucket replaces), so a mount/switch echo
 * of [] (or of the old character's list) silently evicted the newly selected
 * character's server-granted conditions — a GET-proved ['cursed','poisoned']
 * curse erased ~2–8 s after simply opening the sheet, zero log rows.
 *
 * The persistence lane is therefore adoption-only: it must echo exactly what
 * the store holds (never component state). In production the echo is a
 * valuesEqual no-op (same array reference → setRuntimeValue skips the POST
 * entirely), which these mocked-store assertions approximate by pinning that
 * every write's VALUE is byte-equal to the store's own content at that
 * moment — so it can never shrink or replace the bucket with foreign data.
 *
 * Sibling suites (not re-tested here):
 * - CharConditions.slow.test.jsx            — SP-109 un-hydrated mount guard,
 *   hydrated-empty echo, post-mount hydration echo, Slow teardown
 * - CharConditions.logging.test.jsx         — save logging + handler persistence
 * - CharConditions.rendering.test.jsx       — badges, re-mount on name change
 */
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions from './CharConditions.jsx';

const CHAR_A = 'AasimarTest';
const CHAR_B = 'Wild_Sage_Druid';
const CAMPAIGN = 'test-campaign';
const GRANTED = ['cursed', 'poisoned'];

// Runtime-store fake keyed strictly by `${name}::${key}` (mirrors the SP-109
// suite). Writes flow through to the same table so assertions observe real
// end state; setRuntimeValue records every attempted bucket REPLACE.
let runtimeValues = {};
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
  getAbilityLabel: vi.fn((abbr) => abbr),
  getAbilitySaveBonus: vi.fn(() => 2),
}));

vi.mock('../../../services/combat/conditions/effectDescriptions.js', () => ({
  CONDITION_DESCRIPTIONS: {},
}));

vi.mock('../../../services/combat/conditions/exhaustionRules.js', () => ({
  EXHAUSTION_LEVELS: 6,
  isDeadFromExhaustion: vi.fn((level) => level >= 6),
  getExhaustionSaveDC: vi.fn((level) => 10 + level),
}));

vi.mock('../../../hooks/combat/usePopup.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

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

vi.mock('../../../services/combat/conditions/slowEffects.js', () => ({
  removeSlowEffectsForTarget: vi.fn(() => true),
}));

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

describe('CharConditions — character-switch stale-state guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeValues = {};
    storageListeners = [];
  });

  const sheet = (name) => (
    <CharConditions
      playerStats={{ name, abilities: [{ name: 'Wisdom', bonus: 1, save: 2 }] }}
      campaignName={CAMPAIGN}
      activeMapName={null}
      characters={[]}
      exhaustionLevel={0}
      onConditionsChange={vi.fn()}
      conditionEffects={{}}
    />
  );

  const seed = (name, conditions, meta = {}) => {
    runtimeValues[`${name}::activeConditions`] = conditions;
    runtimeValues[`${name}::activeConditionMeta`] = meta;
  };

  const conditionWritesFor = (name) =>
    setRuntimeValue.mock.calls.filter(([who, key]) => who === name && key === 'activeConditions');

  it('switching to a hydrated bucket never POSTs the previous character\'s stale state', () => {
    // Character A open with its own conditions (non-empty stale state — the
    // sibling of the [] face the bug file recorded; both are foreign data).
    seed(CHAR_A, ['charmed']);
    const { rerender } = render(sheet(CHAR_A));

    // While A is open, B's runtime state lands server-side (monster save
    // lane granted the curse) and the SSE echo hydrates B's store mirror.
    seed(CHAR_B, [...GRANTED]);

    // Sidebar switch — the SAME component instance flips identity (CharSheet
    // survives the switch). The old character's list must never be written
    // against B, and a stale [] must never REPLACE B's granted bucket.
    rerender(sheet(CHAR_B));

    const bWrites = conditionWritesFor(CHAR_B);
    for (const call of bWrites) {
      expect(call[2]).toEqual(GRANTED);
    }
    // End state: the granted conditions survive the sheet-open untouched.
    expect(runtimeValues[`${CHAR_B}::activeConditions`]).toEqual(GRANTED);
  });

  it('switching from an empty-condition sheet does not wipe the new character\'s granted bucket', () => {
    // The exact live face: previous character store hydrated to [] (so the
    // component state is a stale empty list), target character already holds
    // the server-granted conditions.
    seed(CHAR_A, []);
    const { rerender } = render(sheet(CHAR_A));
    seed(CHAR_B, [...GRANTED]);

    rerender(sheet(CHAR_B));

    for (const call of conditionWritesFor(CHAR_B)) {
      expect(call[2]).not.toEqual([]);
      expect(call[2]).toEqual(GRANTED);
    }
    expect(runtimeValues[`${CHAR_B}::activeConditions`]).toEqual(GRANTED);
  });

  it('un-hydrated target store on switch writes nothing, and post-switch hydration echoes intact', () => {
    seed(CHAR_A, ['charmed']);
    const { rerender } = render(sheet(CHAR_A));

    // B has NO activeConditions key yet (SSE replay / GET seed still in
    // flight) — the mount-on-switch must not invent a bucket server-side.
    rerender(sheet(CHAR_B));
    expect(conditionWritesFor(CHAR_B)).toHaveLength(0);
    expect('Wild_Sage_Druid::activeConditions' in runtimeValues).toBe(false);

    // The store hydrates afterwards via the storage-change listener; the
    // follow-up echo carries the granted list, never a stale one.
    seed(CHAR_B, [...GRANTED]);
    act(() => storageListeners.forEach((callback) => callback()));

    const bWrites = conditionWritesFor(CHAR_B);
    expect(bWrites.length).toBeGreaterThan(0);
    for (const call of bWrites) {
      expect(call[2]).toEqual(GRANTED);
    }
    expect(runtimeValues[`${CHAR_B}::activeConditions`]).toEqual(GRANTED);
  });

  it('a user-driven condition-save success still persists through the handler lane', async () => {
    seed(CHAR_B, ['slow'], { slow: { dc: 12, ability: 'wis' } });
    const { getByRole } = render(sheet(CHAR_B));

    fireEvent.click(getByRole('button', { name: 'Slow DC 12' }));

    // The successful save clears the condition via its own saveConditions
    // call (the ONLY lane allowed to move the list), and the end state is [].
    // The save flow is async (aura await) — await persistence, mirror the
    // waitFor discipline of CharConditions.slow.test.jsx.
    await vi.waitFor(() =>
      expect(runtimeValues[`${CHAR_B}::activeConditions`]).toEqual([])
    );
    const lastWrite = conditionWritesFor(CHAR_B).at(-1);
    expect(lastWrite).toEqual([CHAR_B, 'activeConditions', [], CAMPAIGN]);
  });
});
