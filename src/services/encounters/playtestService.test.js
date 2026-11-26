// @maintained-by-ai 2026-11-25
// Playtest orchestration contract (plan 2026-11-25): snapshot FIRST (nothing
// writes before the restore point exists), awaited stamp BEFORE any lane that
// could roll back (in-flight stamp vs rollback race), staging → join order,
// abort evicts the stamp, End rides exact-filename rollback + the
// postRestoreNotice/full-reload handoff, and a pruned snapshot surfaces
// without reloading.
import {
    startEncounterPlaytest,
    endEncounterPlaytest,
    isPlaytestActive,
    fetchOtherConnectedClients,
} from './playtestService.js';
import { getRuntimeValue, setRuntimeValue, deleteRuntimeKey } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../ui/logService.js';
import { addMonstersToInitiative } from './encounterToInitiative.js';
import { stageEventEncounterMap } from './encounterStagingService.js';
import { generateOutdoorEncounter } from './outdoorEncounterGenerator.js';
import { generateMonsterPlacements } from './monsterTokenPlacement.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
    deleteRuntimeKey: vi.fn(),
}));
vi.mock('../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));
vi.mock('./encounterToInitiative.js', () => ({
    addMonstersToInitiative: vi.fn(async () => true),
}));
vi.mock('./encounterStagingService.js', () => ({
    stageEventEncounterMap: vi.fn(async () => ({ label: 'Travel Encounter Stage', reused: true })),
}));
vi.mock('./outdoorEncounterGenerator.js', () => ({
    generateOutdoorEncounter: vi.fn(() => ({ placedItems: [], players: [], bgFill: '#7A9B6A' })),
}));
vi.mock('./monsterTokenPlacement.js', () => ({
    generateMonsterPlacements: vi.fn(() => []),
}));
vi.mock('../ui/sseClient.js', () => ({
    getOwnSseClientId: vi.fn(() => null),
}));

import { getOwnSseClientId } from '../ui/sseClient.js';

const CN = 'test-campaign';
const SNAP = `${CN}-2026-11-25T10-00-00-000.zip`;
const MONSTERS = [{ index: 'goblin', name: 'Goblin', qty: 2 }];
const PARTY = [{ name: 'Thorin', level: 5 }, { name: 'Elara', level: 5 }];

const calls = [];
function track(name, impl) {
    return (...args) => { calls.push(name); return impl ? impl(...args) : undefined; };
}

let fetchCalls;
function mockFetch(handler) {
    fetchCalls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        fetchCalls.push({ url, init });
        calls.push(`fetch:${init?.method || 'GET'}`);
        return handler(url, init);
    }));
}
const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubGlobal('location', { reload: vi.fn() });
    mockFetch((url) => (
        url.includes('/admin/snapshot')
            ? jsonResponse(200, { message: 'Snapshot created', filename: SNAP, size: 10 })
            : jsonResponse(200, { message: 'Rollback complete', restored: SNAP })
    ));
    vi.mocked(getRuntimeValue).mockReturnValue(null);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('startEncounterPlaytest — lane order and failure legs', () => {
    it('snapshot → awaited stamp → staging → join, in that order, on the shared staging lanes', async () => {
        vi.mocked(setRuntimeValue).mockImplementation(track('stamp', async () => {}));
        vi.mocked(stageEventEncounterMap).mockImplementation(track('stage', async () => ({ label: 'Travel Encounter Stage', reused: true })));
        vi.mocked(addMonstersToInitiative).mockImplementation(track('join', async () => true));

        const result = await startEncounterPlaytest({
            campaignName: CN, encounterName: 'Goblin Drill', selectedMonsters: MONSTERS, characters: PARTY,
        });

        expect(result).toEqual({ snapshot: SNAP });
        expect(calls.slice(0, 4)).toEqual(['fetch:POST', 'stamp', 'stage', 'join']);
        expect(fetchCalls[0].url).toContain(`/api/campaigns/${CN}/admin/snapshot`);

        // Stamp shape: server filename + encounter name, campaign tier.
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'playtest', {
            active: true, snapshot: SNAP, encounterName: 'Goblin Drill',
        }, CN);

        // Staging rides the travel-event lane with the shared placement rule.
        expect(generateOutdoorEncounter).toHaveBeenCalledWith('plains', 30, ['Thorin', 'Elara'], 0, 0);
        expect(generateMonsterPlacements).toHaveBeenCalledWith([{ name: 'Goblin', qty: 2 }], 30);
        expect(stageEventEncounterMap).toHaveBeenCalledWith(expect.objectContaining({
            campaignName: CN, terrainType: 'plains', gridSize: 30,
        }));

        // Join rides the normal EB lane (full party).
        expect(addMonstersToInitiative).toHaveBeenCalledWith(MONSTERS, PARTY, CN);

        // Audit row names the restore point.
        expect(addEntry).toHaveBeenCalledWith(CN, expect.objectContaining({
            type: 'automation',
            automationType: 'encounter_playtest_started',
            description: expect.stringContaining(SNAP),
        }));
    });

    it('snapshot failure writes NOTHING (no stamp, no staging, no join, no audit)', async () => {
        mockFetch((url) => (
            url.includes('/admin/snapshot') ? jsonResponse(500, { error: 'zip exploded' }) : jsonResponse(200, {})
        ));
        await expect(startEncounterPlaytest({
            campaignName: CN, encounterName: 'X', selectedMonsters: MONSTERS, characters: PARTY,
        })).rejects.toThrow('zip exploded');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(stageEventEncounterMap).not.toHaveBeenCalled();
        expect(addMonstersToInitiative).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it.each([
        ['staging', () => vi.mocked(stageEventEncounterMap).mockRejectedValueOnce(new Error('activate 409'))],
        ['join', () => vi.mocked(addMonstersToInitiative).mockRejectedValueOnce(new Error('board write failed'))],
    ])('failure after the stamp (%s) evicts the stamp and throws — no stranded banner', async (_name, arm) => {
        arm();
        await expect(startEncounterPlaytest({
            campaignName: CN, encounterName: 'X', selectedMonsters: MONSTERS, characters: PARTY,
        })).rejects.toThrow();
        expect(deleteRuntimeKey).toHaveBeenCalledWith('campaign', 'playtest', CN);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('unnamed draft stamps the canonical Unnamed Encounter fallback', async () => {
        await startEncounterPlaytest({ campaignName: CN, selectedMonsters: MONSTERS, characters: PARTY });
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'playtest',
            expect.objectContaining({ encounterName: 'Unnamed Encounter' }), CN);
    });
});

describe('endEncounterPlaytest — rollback handoff', () => {
    const stamp = { active: true, snapshot: SNAP, encounterName: 'Goblin Drill' };

    it('POSTs the EXACT restore point, stores the post-restore notice, and reloads', async () => {
        vi.mocked(getRuntimeValue).mockReturnValue(stamp);
        await endEncounterPlaytest(CN);
        const rollback = fetchCalls.find((f) => f.url.includes('/admin/rollback'));
        expect(rollback.init).toMatchObject({ method: 'POST' });
        expect(JSON.parse(rollback.init.body)).toEqual({ filename: SNAP });
        expect(JSON.parse(sessionStorage.getItem('postRestoreNotice'))).toEqual({
            campaign: CN, restored: SNAP,
        });
        expect(window.location.reload).toHaveBeenCalled();
    });

    it('pruned snapshot (404) throws the admin-list guidance WITHOUT reloading or storing a notice', async () => {
        vi.mocked(getRuntimeValue).mockReturnValue(stamp);
        mockFetch((url) => (
            url.includes('/admin/rollback') ? jsonResponse(404, { error: 'No snapshot found' }) : jsonResponse(200, {})
        ));
        await expect(endEncounterPlaytest(CN)).rejects.toThrow(/Restore point .* no longer exists/);
        expect(sessionStorage.getItem('postRestoreNotice')).toBeNull();
        expect(window.location.reload).not.toHaveBeenCalled();
    });

    it('refuses to run without an active stamp', async () => {
        await expect(endEncounterPlaytest(CN)).rejects.toThrow('No playtest session is active');
        expect(fetchCalls).toHaveLength(0);
    });
});

describe('isPlaytestActive', () => {
    it('reads the campaign stamp', () => {
        vi.mocked(getRuntimeValue).mockReturnValue({ active: true });
        expect(isPlaytestActive(CN)).toBe(true);
        vi.mocked(getRuntimeValue).mockReturnValue(null);
        expect(isPlaytestActive(CN)).toBe(false);
    });
});

describe('fetchOtherConnectedClients — confirm heads-up lane', () => {
    afterEach(() => {
        vi.mocked(getOwnSseClientId).mockReturnValue(null);
    });

    it('names this tab\'s hub-issued client id as exclude so a solo GM never counts themselves', async () => {
        vi.mocked(getOwnSseClientId).mockReturnValue('client-77');
        mockFetch(() => jsonResponse(200, { count: 2 }));
        await expect(fetchOtherConnectedClients(CN)).resolves.toBe(2);
        expect(fetchCalls[0].url)
            .toBe(`/api/sse-clients?campaign=${CN}&exclude=client-77`);
        expect(getOwnSseClientId).toHaveBeenCalledWith(CN);
    });

    it('omits exclude while no connection stamp exists (server then answers the raw total)', async () => {
        vi.mocked(getOwnSseClientId).mockReturnValue(null);
        mockFetch(() => jsonResponse(200, { count: 0 }));
        await expect(fetchOtherConnectedClients(CN)).resolves.toBe(0);
        expect(fetchCalls[0].url).toBe(`/api/sse-clients?campaign=${CN}`);
    });

    it('throws with the server refusal message (confirm hides the notice on a failed read)', async () => {
        mockFetch(() => jsonResponse(403, { error: 'Access denied: GM-only feature' }));
        await expect(fetchOtherConnectedClients(CN))
            .rejects.toThrow('Access denied: GM-only feature');
    });

    it('answers 0 for a malformed success payload instead of inventing a count', async () => {
        mockFetch(() => jsonResponse(200, {}));
        await expect(fetchOtherConnectedClients(CN)).resolves.toBe(0);
    });
});
