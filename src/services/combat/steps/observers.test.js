// @maintained-by-ai
// Lane: INTERNALS of observers.js (log observers) ONLY — registration census + per-handler
// payload bytes against the logger boundary. SSE broadcast internals live in
// sseObservers.test.js; pipeline assembly and the campaignName registration gate
// (createObservers zero-args, handler-fires-with-ctx-identity, no-campaign → SSE factory
// never invoked while log observers are still registered) are pinned by index.test.js
// (#1064) — cited, never re-pinned here.
//
// Discipline: golden registration census (#985); happy paths pin FULL addEntry bytes
// (#829/#1007); inert/degenerate payloads co-located per observer (#945/#948);
// campaignName flows from ctx, decoy campaign proves pass-through not hardcode (#1050);
// thrown-logger honesty pins console.error, not just non-rejection (#1056 + logging
// mandate); timestamps are log stamps only — no game state on wall-clock (#942).
//
// old→new map (old 9 tests → new 7):
//   'calls addEntry with roll data' → kept exact (test 2)
//   'calls addEntry when sneak dice applied' → kept exact (test 3)
//   'calls addEntry on completed damage' → kept exact (test 4)
//   'skips when no formula' + 'skips when no effectiveSneakDice' + 'skips when not done'
//     → ONE inert-payload table test (test 6), extended with empty-string / zero /
//     false / undefined-result degenerate rows
//   'handles null targetName' (weak objectContaining) → exact-bytes defaults test (test 5),
//     also pinning 'unknown'/'Attack'/'Action'/''/0 fallbacks and foreign-campaign pass-through
//   'handles addEntry error gracefully' (asserted only non-rejection) → all three observers'
//     .catch paths + console.error byte-pin (test 7)
//   'returns three observers' → strengthened golden census with handler presence (test 1)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { addEntry } = vi.hoisted(() => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../ui/logService.js', () => ({ addEntry }));

import { createObservers } from './observers.js';

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Gimli' },
    attack: { name: 'Greataxe', damageType: 'slashing' },
    targetName: 'Orc',
    total: 25,
    ...overrides,
  };
}

// One distinguishable triggering payload per observer (#1022) — reused for
// error-honesty and defaults tests so inert-vs-live is the only variable.
const TRIGGERS = {
  'damage:rolled': { data: { formula: '1d12+3', rolls: [7], total: 10, modifier: 3 } },
  'sneak:applied': { data: { effectiveSneakDice: 3 } },
  'damage:applied': { data: { _done: true } },
};

// Payloads that must NOT log, per the guard in each handler (#945 degenerate honest).
const INERT_ROWS = [
  ['damage:rolled', { data: {} }],
  ['damage:rolled', { data: { formula: '' } }],
  ['damage:rolled', undefined],
  ['sneak:applied', { data: {} }],
  ['sneak:applied', { data: { effectiveSneakDice: 0 } }],
  ['sneak:applied', undefined],
  ['damage:applied', { data: {} }],
  ['damage:applied', { data: { _done: false } }],
  ['damage:applied', undefined],
];

function observerFor(event) {
  return createObservers().find(o => o.event === event);
}

describe('createObservers', () => {
  let observers;

  beforeEach(() => {
    vi.clearAllMocks(); // preserves the hoisted resolve impl; wipes call history (#1007)
    observers = createObservers();
  });

  it('returns exactly three observers — exact ordered [event, handler-present] census', () => {
    expect(observers.map(o => [o.event, typeof o.handler])).toEqual([
      ['damage:rolled', 'function'],
      ['sneak:applied', 'function'],
      ['damage:applied', 'function'],
    ]);
  });

  it('damage:rolled logs a full roll entry with exact bytes', async () => {
    await observerFor('damage:rolled').handler(makeCtx(), TRIGGERS['damage:rolled']);

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'roll',
      characterName: 'Gimli',
      rollType: 'damage',
      name: 'Greataxe',
      formula: '1d12+3',
      rolls: [7],
      total: 10,
      modifier: 3,
      damageType: 'slashing',
      targetName: 'Orc',
    });
  });

  it('sneak:applied logs an ability_use entry with exact bytes', async () => {
    await observerFor('sneak:applied').handler(makeCtx(), TRIGGERS['sneak:applied']);

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'ability_use',
      characterName: 'Gimli',
      abilityName: 'Sneak Attack',
      description: 'Gimli applied Sneak Attack (3d6)',
      targetName: 'Orc',
      timestamp: expect.any(Number), // log stamp only — not game state (#942)
    });
  });

  it('damage:applied logs an action_complete entry with exact bytes', async () => {
    await observerFor('damage:applied').handler(makeCtx(), TRIGGERS['damage:applied']);

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'action_complete',
      characterName: 'Gimli',
      actionName: 'Greataxe',
      description: 'Gimli completed Greataxe with 25 total damage.',
      total: 25,
      targetName: 'Orc',
      timestamp: expect.any(Number), // log stamp only — not game state (#942)
    });
  });

  it('bare ctx logs exact fallback bytes to the ctx-supplied campaign, not a hardcoded one', async () => {
    // Foreign-campaign decoy (#1050): campaignName flows from ctx.
    // Honest pin (#910): description interpolation does NOT carry the 'unknown' fallback
    // (observers.js:40/:57 — flagged as source bug), so the 'undefined' byte is pinned.
    const ctx = { campaignName: 'other-campaign' };

    await Promise.all(observers.map(o => o.handler(ctx, TRIGGERS[o.event])));

    expect(addEntry.mock.calls).toEqual([
      ['other-campaign', {
        type: 'roll',
        characterName: 'unknown',
        rollType: 'damage',
        name: 'Attack',
        formula: '1d12+3',
        rolls: [7],
        total: 10,
        modifier: 3,
        damageType: '',
        targetName: null,
      }],
      ['other-campaign', {
        type: 'ability_use',
        characterName: 'unknown',
        abilityName: 'Sneak Attack',
        description: 'undefined applied Sneak Attack (3d6)',
        targetName: null,
        timestamp: expect.any(Number),
      }],
      ['other-campaign', {
        type: 'action_complete',
        characterName: 'unknown',
        actionName: 'Action',
        description: 'undefined completed action with 0 total damage.',
        total: 0,
        targetName: null,
        timestamp: expect.any(Number),
      }],
    ]);
  });

  it('inert payloads never reach the logger (full skip table)', async () => {
    for (const [event, result] of INERT_ROWS) {
      const obs = observerFor(event);
      await obs.handler(makeCtx(), result);
      expect(addEntry, `${event} with ${JSON.stringify(result)}`).not.toHaveBeenCalled();
    }
  });

  it('logger rejection is caught and console.error-logged by every observer', async () => {
    // thrown-logger honesty (#1056): non-rejection alone is not enough — the .catch
    // must log. All three observers, one rejection each.
    const err = new Error('Network error');
    addEntry.mockRejectedValueOnce(err).mockRejectedValueOnce(err).mockRejectedValueOnce(err);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await Promise.all(observers.map(o =>
      expect(o.handler(makeCtx(), TRIGGERS[o.event])).resolves.toBeUndefined()
    ));

    expect(consoleError).toHaveBeenCalledTimes(3);
    expect(consoleError.mock.calls.map(c => c[c.length - 1])).toEqual([err, err, err]);
    consoleError.mockRestore();
  });
});
