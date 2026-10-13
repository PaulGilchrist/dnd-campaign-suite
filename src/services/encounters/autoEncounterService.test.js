// P4-b (§10.2): auto-encounter — enforcement-gated; Accept ⇒ engine-seeded
// initiative + encounter phase; off ⇒ byte-identical zero writes.
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
                round: 1,
                creatures: [
                    ...characters.map((c) => ({ name: c.name, type: 'player' })),
                    ...selected.flatMap((m) => Array.from({ length: m.qty }, (_, i) => ({ name: `${m.name} ${i + 1}`, type: 'npc' }))),
                ],
            },
            firstName: characters[0]?.name,
        };
    }),
}));
vi.mock('../ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(async () => ([
        { index: 'goblin', name: 'Goblin', armor_class: 15, hit_points: 7, initiative: 2 },
        { index: 'wolf', name: 'Wolf', armor_class: 13, hit_points: 11 },
    ])),
}));

import { autoStartEncounterFromEvent } from './autoEncounterService.js';
import { loadEncounterToInitiative } from './encounterToInitiative.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const CN = 'test-campaign';
const EVENT = {
    type: 'combat',
    title: 'Ambush on the road',
    encounter: { monsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }], difficultyLabel: 'Medium', totalXP: 200 },
};

beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    logs.length = 0;
    trackerCalls.length = 0;
    vi.mocked(loadEncounterToInitiative).mockClear();
    vi.mocked(setRuntimeValue).mockClear();
});

describe('autoEncounters OFF (byte parity)', () => {
    it('does nothing — no tracker, no phase, no log', async () => {
        store['campaign::enforcement'] = { mode: 'off' };
        const r = await autoStartEncounterFromEvent({ campaignName: CN, event: EVENT, characters: [] });
        expect(r).toEqual({ started: false, reason: 'autoEncounters off' });
        expect(loadEncounterToInitiative).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(logs).toHaveLength(0);
    });
});

describe('autoEncounters ON', () => {
    beforeEach(() => {
        store['campaign::enforcement'] = { mode: 'on', autoEncounters: true };
        store['campaign::sessionState'] = { phase: 'travel' };
    });

    it('hydrates monsters, starts the tracker, moves the phase, audits', async () => {
        const characters = [{ name: 'FeyRanger', level: 3 }];
        const r = await autoStartEncounterFromEvent({ campaignName: CN, event: EVENT, characters });
        expect(r).toEqual({ started: true });
        expect(trackerCalls).toHaveLength(1);
        const [selected] = trackerCalls[0].selected;
        expect(selected).toMatchObject({ index: 'goblin', name: 'Goblin', qty: 2, armor_class: 15 });
        expect(store['campaign::sessionState'].phase).toBe('encounter');
        expect(store['campaign::sessionState'].changedBy).toBe('auto-encounter');
        const auto = logs.find((l) => l.automationType === 'auto_encounter_started');
        expect(auto).toBeTruthy();
        expect(auto.description).toContain('2x Goblin');
        expect(auto.description).toContain('initiative rolled by the engine');
    });

    it('event without an encounter roster ⇒ zero writes', async () => {
        const r = await autoStartEncounterFromEvent({ campaignName: CN, event: { type: 'weatherChange' }, characters: [] });
        expect(r.started).toBe(false);
        expect(loadEncounterToInitiative).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('unknown monsters are skipped loudly; nothing rostered ⇒ no tracker', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const r = await autoStartEncounterFromEvent({
            campaignName: CN,
            event: { type: 'combat', encounter: { monsters: [{ index: 'tarrasque-clone', name: 'Nope', qty: 1 }] } },
            characters: [],
        });
        expect(r).toEqual({ started: false, reason: 'no hydratable monsters' });
        expect(err).toHaveBeenCalledWith(expect.stringContaining('unknown monster'));
        expect(loadEncounterToInitiative).not.toHaveBeenCalled();
        err.mockRestore();
    });

    it('partial hydration keeps the known monsters', async () => {
        const r = await autoStartEncounterFromEvent({
            campaignName: CN,
            event: { type: 'combat', encounter: { monsters: [{ index: 'wolf', name: 'Wolf', qty: 1 }, { index: 'ghost', name: 'Ghost', qty: 2 }] } },
            characters: [],
        });
        expect(r.started).toBe(true);
        expect(trackerCalls[0].selected.map((m) => m.name)).toEqual(['Wolf']);
    });
});
