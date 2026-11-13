// @maintained-by-ai
// Regression (bug-designer-draft-accepts-kind-word-entity-name) — the WHOLE-SET
// half of the fix: collectBlueprintErrors must prefix the name-law error into
// the batch repair turn, and applyBlueprint must refuse to write a blueprint
// whose row is named after its kind (the same fail-closed contract the unique-
// name collision guard already honored when "npc" slipped past it). Same
// mocked-fs convention as apply.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn(),
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

import { collectBlueprintErrors, applyBlueprint } from './apply.js';

const C = 'unit';
const scope = { scope: 'session', sessionNumber: 1, entityPlan: [{ kind: 'npc', count: 1 }] };

function fakeContext() {
    const set = (items = []) => new Set(items);
    return {
        quests: set(), npcs: set(), factions: set(), settlements: set(),
        sessions: set(), notes: set(), encounters: set(), maps: set(),
        monsters: new Map(), monsterNames: set(),
    };
}

beforeEach(() => { mockFsState.clear(); createSnapshot.mockClear(); addEntry.mockClear(); });

describe('collectBlueprintErrors — the name law rides the batch repair turn', () => {
    it('quotes the law prefixed by the row position, exactly like the collision guard', () => {
        const errors = collectBlueprintErrors(C, {
            scope,
            npcs: [{ name: 'npc', personality: 'Suspicious harbourmaster' }],
        }, fakeContext());
        expect(errors.join('; ')).toMatch(/npcs\[0\] "npc": name "npc" is a kind word/);
    });

    it('a properly-named batch stays clean (law never blocks compliant drafts)', () => {
        const errors = collectBlueprintErrors(C, {
            scope,
            npcs: [{ name: 'Marta Copperkettle', personality: 'Jovial' }],
        }, fakeContext());
        expect(errors).toEqual([]);
    });
});

describe('applyBlueprint — fail closed before a byte is written', () => {
    it('refuses the kind-word set without snapshot or draft write', async () => {
        const res = await applyBlueprint(C, { scope, npcs: [{ name: 'npc' }] }, { context: fakeContext() });
        expect(res.ok).toBe(false);
        expect(res.errors.join(' ')).toMatch(/kind word/);
        expect(createSnapshot).not.toHaveBeenCalled();
        expect(mockFsState.size).toBe(0); // nothing hit the disk lanes
    });
});
