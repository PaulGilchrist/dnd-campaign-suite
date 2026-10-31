import { vi } from 'vitest';
import { applyBlueprint } from './apply.js';

// ---------------------------------------------------------------------------
// Mock filesystem + side channels (factions-real.test.js convention)
// ---------------------------------------------------------------------------
const mockFsState = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => mockFsState.has(p)),
        mkdirSync: vi.fn(),
        readdirSync: vi.fn(() => []),
        readFileSync: vi.fn((p) => {
            if (!mockFsState.has(p)) throw new Error('ENOENT ' + p);
            return mockFsState.get(p);
        }),
        writeFileSync: vi.fn((p, data) => mockFsState.set(p, data)),
    },
}));

vi.mock('../../../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, fileName) => `/mock/campaigns/${campaign}/data/${fileName}`,
    ensureDataDir: (campaign) => `/mock/campaigns/${campaign}/data`,
    campaignDir: (campaign) => `/mock/campaigns/${campaign}`,
}));

const publish = vi.fn();
vi.mock('../../../utils/changeData.js', () => ({
    publish: (...args) => publish(...args),
    saveFile: vi.fn(),
}));

const createSnapshot = vi.fn(async () => ({ filename: 'unit-2026.zip', size: 10 }));
vi.mock('../../../utils/campaignSnapshots.js', () => ({
    createSnapshot: (...a) => createSnapshot(...a),
}));

const addEntry = vi.fn();
vi.mock('../../../routes/log.js', () => ({
    addEntry: (...a) => addEntry(...a),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const C = 'unit';
const dataFile = n => `/mock/campaigns/${C}/data/${n}`;
const readData = n => JSON.parse(mockFsState.get(dataFile(n)) || '[]');

function fakeContext() {
    const set = (items = []) => new Set(items);
    return {
        quests: set(), npcs: set(), factions: set(), settlements: set(),
        sessions: set(), notes: set(), encounters: set(), maps: set(),
        monsters: new Map([['goblin', 'Goblin'], ['ogre', 'Ogre']]),
        monsterNames: set(['goblin', 'ogre']),
    };
}

// encounterUtils resolves via process.cwd() (unlike the campaignPaths lanes)
const ENC_PATH = `${process.cwd()}/public/campaigns/${C}/data/encounters.json`;

const blueprint = () => ({
    scope: { scope: 'session', sessionNumber: 4 },
    factions: [{ name: 'Cult of the Frostmaw', influence: 4 }],
    settlements: [{ name: 'Mudport', size: 'village', notableNPCs: ['Oldhem the Ferryman'] }],
    npcs: [{ name: 'Oldhem the Ferryman', personality: 'Gruff but kind' }],
    quests: [{ name: 'Silence the Bell', status: 'active' }],
    encounters: [{ name: 'Ferry Ambush', selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }] }],
    sessions: [{ name: 'Session 4', links: { encounters: ['Ferry Ambush'], npcs: ['Oldhem the Ferryman'] } }],
});

beforeEach(() => {
    mockFsState.clear();
    publish.mockClear();
    addEntry.mockClear();
    createSnapshot.mockClear();
});

describe('applyBlueprint — validation gate (nothing written unless fully valid)', () => {
    it('rejects shape violations BEFORE snapshot or write', async () => {
        const bp = blueprint();
        bp.npcs[0].image = 'data:image/png;base64...'; // GM-owned field
        const res = await applyBlueprint(C, bp, { context: fakeContext() });
        expect(res.ok).toBe(false);
        expect(res.errors.join('\n')).toMatch(/unknown field 'image'/);
        expect(createSnapshot).not.toHaveBeenCalled();
        expect(mockFsState.size).toBe(0);
    });

    it('rejects fabricated references and bestiary-shadow names', async () => {
        const bp = blueprint();
        bp.settlements[0].notableNPCs = ['Nobody At All'];
        bp.npcs.push({ name: 'Ogre' });
        const res = await applyBlueprint(C, bp, { context: fakeContext() });
        expect(res.ok).toBe(false);
        const all = res.errors.join('\n');
        expect(all).toMatch(/notableNPCs references unknown NPC "Nobody At All"/);
        expect(all).toMatch(/"Ogre" is a bestiary monster/);
        expect(mockFsState.size).toBe(0);
    });
});

describe('applyBlueprint — draft application through the lane semantics', () => {
    let res;
    beforeEach(async () => {
        res = await applyBlueprint(C, blueprint(), { context: fakeContext() });
    });

    it('creates every entity, snapshots first, logs once', () => {
        expect(res.ok).toBe(true);
        expect(res.created).toMatchObject({ factions: 1, settlements: 1, npcs: 1, quests: 1, sessions: 1, encounters: 1, maps: 0 });
        expect(res.snapshot).toBe('unit-2026.zip');
        expect(createSnapshot).toHaveBeenCalledWith(C);
        expect(addEntry).toHaveBeenCalledWith(C, expect.objectContaining({
            type: 'ai_authoring',
            name: 'AI designer',
            scope: 'session',
            snapshot: 'unit-2026.zip',
        }));
    });

    it('uuid kinds get server-assigned ids; name-keyed kinds do not', () => {
        const [faction] = readData('factions.json');
        const [quest] = readData('quests.json');
        expect(faction.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
        expect(quest.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
        const [npc] = readData('npcs.json');
        expect(npc.id).toBeUndefined(); // name-keyed lane (npcs PUT-upsert)
    });

    it('force-stamps draft:true even when the model omits it', () => {
        for (const file of ['factions.json', 'settlements.json', 'npcs.json', 'quests.json', 'sessions.json']) {
            for (const row of readData(file)) {
                expect(row.draft, file).toBe(true);
                expect(typeof row.updatedAt, file).toBe('number');
            }
        }
    });

    it('encounters land as builder presets in the wrapper file, as drafts', () => {
        const data = JSON.parse(mockFsState.get(ENC_PATH));
        expect(data.encounters).toHaveLength(1);
        const enc = data.encounters[0];
        expect(enc).toMatchObject({ name: 'Ferry Ambush', draft: true, selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }] });
        expect(typeof enc.savedAt).toBe('string');
    });

    it('publishes the SAME list channels the HTTP lanes use', () => {
        const channels = publish.mock.calls.map(([ch]) => ch);
        expect(channels).toEqual(expect.arrayContaining([
            'factions-list-unit', 'settlements-list-unit', 'npcs-list-unit',
            'quests-list-unit', 'sessions-list-unit', 'encounters-list-unit',
        ]));
        const encCall = publish.mock.calls.find(([ch]) => ch === 'encounters-list-unit');
        expect(encCall[1]).toEqual({ action: 'created', encounter: { name: 'Ferry Ambush' } });
    });
});

describe('applyBlueprint — mid-batch failure stays recoverable', () => {
    it('reports the snapshot when a write throws after the gate', async () => {
        const fsMod = await import('fs');
        let calls = 0;
        fsMod.default.writeFileSync.mockImplementation((p, d) => {
            calls += 1;
            if (calls > 1) throw new Error('disk on fire');
            mockFsState.set(p, d);
        });
        const res = await applyBlueprint(C, blueprint(), { context: fakeContext() });
        expect(res.ok).toBe(false);
        expect(res.errors[0]).toMatch(/apply failed mid-batch.*restore point: unit-2026\.zip/s);
        expect(addEntry).toHaveBeenCalledWith(C, expect.objectContaining({ type: 'ai_authoring', error: 'disk on fire' }));
    });
});
