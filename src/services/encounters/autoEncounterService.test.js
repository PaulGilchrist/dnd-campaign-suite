// @maintained-by-ai
// autoEncounterService contract lane: auto-start on GM Accept (§10.2).
// Encounters family map: THIS file owns the auto-trigger predicate and the
// full Accept→dispatch request bytes (enforcement gate, roster hydration,
// one-dispatch, campaign pinning, audit prose). The phase state machine
// itself (sessionState read/write, session_phase log) is owned by
// combat/sessionService.test.js (#1021); initiative rolling belongs to
// encounterToInitiative/initiativeService lanes (#862-#875) — here the
// tracker is stubbed and only the exact call tuple is pinned.
// Trigger is the human Accept gesture in HexMap (move-driven event) —
// never a polling timer (§ No Game Timers; repo guard: npm run guard:no-timers).
//
// Old → new test map:
//   'does nothing — no tracker, no phase, no log'
//     → 'disarmed ⇒ exact refusal and zero traffic' (adds mode:on-with-flag-missing
//       leg and proves short-circuit happens BEFORE any data load)
//   'hydrates monsters, starts the tracker, moves the phase, audits'
//     → 'armed Accept: hydrates, dispatches once, moves phase, audits — exact bytes'
//   'event without an encounter roster ⇒ zero writes'
//     → 'refuses degenerate events with exact reasons, then re-arms' (folded with
//       no-campaign/no-event guards + determinism re-arm)
//   'unknown monsters are skipped loudly...' / 'partial hydration...'
//     → kept, strengthened to exact payload/error bytes and qty default
const store = {};
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((who, key) => store[`${who}::${key}`] ?? null),
    setRuntimeValue: vi.fn(async (who, key, value) => { store[`${who}::${key}`] = value; }),
}));
const logs = [];
vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn(async (c, e) => { logs.push(e); }) }));
const trackerCalls = [];
vi.mock('./encounterToInitiative.js', () => ({
    loadEncounterToInitiative: vi.fn(async (selected, characters) => {
        trackerCalls.push({ selected, characters });
        return {
            combatSummary: {
                creatures: [
                    ...characters.map((c) => ({ name: c.name, type: 'player' })),
                    ...selected.flatMap((m) => Array.from({ length: m.qty }, (_, i) => ({ name: `${m.name} ${i + 1}`, type: 'npc' }))),
                ],
            },
        };
    }),
}));
const MONSTERS = [
    { index: 'goblin', name: 'Goblin', armor_class: 15, hit_points: 7, initiative: 2 },
    { index: 'wolf', name: 'Wolf', armor_class: 13, hit_points: 11 },
];
vi.mock('../ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(async () => MONSTERS),
}));

import { autoStartEncounterFromEvent } from './autoEncounterService.js';
import { loadEncounterToInitiative } from './encounterToInitiative.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { loadMonsters } from '../ui/dataLoader.js';

const CN = 'test-campaign';
const EVENT = {
    type: 'combat',
    title: 'Ambush on the road',
    encounter: { monsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }], difficultyLabel: 'Medium', totalXP: 200 },
};
const CHARACTERS = [{ name: 'FeyRanger', level: 3 }];

beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    logs.length = 0;
    trackerCalls.length = 0;
    vi.mocked(loadEncounterToInitiative).mockClear();
    setRuntimeValue.mockClear();
    getRuntimeValue.mockClear();
    loadMonsters.mockClear();
});

describe('autoEncounters disarmed (byte parity)', () => {
    it('disarmed ⇒ exact refusal and zero traffic', async () => {
        // mode off, and mode on without the autoEncounters sub-flag (default
        // OFF) — both must short-circuit before hydrating anything.
        for (const enforcement of [{ mode: 'off' }, { mode: 'on' }, { mode: 'on', autoEncounters: false }]) {
            store['campaign::enforcement'] = enforcement;
            const r = await autoStartEncounterFromEvent({ campaignName: CN, event: EVENT, characters: CHARACTERS });
            expect(r).toEqual({ started: false, reason: 'autoEncounters off' });
        }
        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'enforcement', CN);
        expect(loadMonsters).not.toHaveBeenCalled();
        expect(loadEncounterToInitiative).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(logs).toHaveLength(0);
    });
});

describe('autoEncounters armed', () => {
    beforeEach(() => {
        store['campaign::enforcement'] = { mode: 'on', autoEncounters: true };
        store['campaign::sessionState'] = { phase: 'travel' };
    });

    it('armed Accept: hydrates, dispatches once, moves phase, audits — exact bytes', async () => {
        const r = await autoStartEncounterFromEvent({ campaignName: CN, event: EVENT, characters: CHARACTERS });
        expect(r).toEqual({ started: true });
        // ONE dispatch (#951), campaign pinned (#934), full hydrated stat block.
        expect(trackerCalls).toHaveLength(1);
        expect(loadEncounterToInitiative).toHaveBeenCalledWith(
            [{ index: 'goblin', name: 'Goblin', armor_class: 15, hit_points: 7, initiative: 2, qty: 2 }],
            CHARACTERS,
            CN,
        );
        // Phase move (contract owned by sessionService #1021; here just the seam).
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'sessionState',
            expect.objectContaining({ phase: 'encounter', changedBy: 'auto-encounter' }), CN);
        // Audit entry, description hand-derived once (#815): 1 player + 2 goblins = 3.
        const auto = logs.find((l) => l.automationType === 'auto_encounter_started');
        expect(logs.filter((l) => l.automationType === 'auto_encounter_started')).toHaveLength(1);
        expect(auto).toEqual({
            type: 'automation',
            automationType: 'auto_encounter_started',
            difficulty: 'Medium',
            totalXP: 200,
            description: 'Auto-encounter started: 2x Goblin (3 on the tracker, initiative rolled by the engine).',
        });
    });

    it('refuses degenerate events with exact reasons, then re-arms', async () => {
        const refusals = [
            [{ event: EVENT }, { started: false, reason: 'no campaign/event' }],
            [{ campaignName: CN }, { started: false, reason: 'no campaign/event' }],
            [{ campaignName: CN, event: { type: 'weatherChange' } }, { started: false, reason: 'event has no encounter roster' }],
            [{ campaignName: CN, event: { type: 'combat', encounter: { monsters: [] } } }, { started: false, reason: 'event has no encounter roster' }],
        ];
        for (const [args, expected] of refusals) {
            expect(await autoStartEncounterFromEvent(args)).toEqual(expected);
        }
        expect(loadEncounterToInitiative).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(store['campaign::sessionState']).toEqual({ phase: 'travel' });
        expect(logs).toHaveLength(0);
        // Determinism re-arm (#1057): refusals are not sticky — a real armed
        // Accept after near-misses still dispatches exactly once.
        const r = await autoStartEncounterFromEvent({ campaignName: CN, event: EVENT, characters: [] });
        expect(r).toEqual({ started: true });
        expect(trackerCalls).toHaveLength(1);
    });

    it('unknown monster is skipped loudly with exact bytes; nothing rosterable ⇒ no tracker', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const r = await autoStartEncounterFromEvent({
            campaignName: CN,
            event: { type: 'combat', encounter: { monsters: [{ index: 'tarrasque-clone', name: 'Nope', qty: 1 }] } },
            characters: [],
        });
        expect(r).toEqual({ started: false, reason: 'no hydratable monsters' });
        expect(err).toHaveBeenCalledWith('[autoEncounter] unknown monster index/name: tarrasque-clone — skipped');
        expect(loadEncounterToInitiative).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        err.mockRestore();
    });

    it('partial hydration: name-only match and qty default survive; unknown dropped from payload', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const r = await autoStartEncounterFromEvent({
            campaignName: CN,
            // name-only ref (no index) exercises the by-name leg; qty omitted ⇒ 1.
            event: { type: 'combat', encounter: { monsters: [{ name: 'Wolf' }, { index: 'ghost', name: 'Ghost', qty: 2 }] } },
            characters: [],
        });
        expect(r).toEqual({ started: true });
        expect(loadEncounterToInitiative).toHaveBeenCalledWith(
            [{ index: 'wolf', name: 'Wolf', armor_class: 13, hit_points: 11, qty: 1 }], [], CN,
        );
        expect(err).toHaveBeenCalledWith('[autoEncounter] unknown monster index/name: ghost — skipped');
        const auto = logs.find((l) => l.automationType === 'auto_encounter_started');
        expect(auto.description).toBe('Auto-encounter started: 1x Wolf (1 on the tracker, initiative rolled by the engine).');
        err.mockRestore();
    });
});
