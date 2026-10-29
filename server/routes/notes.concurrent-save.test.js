// @maintained-by-ai: 2026-10-29
// notes-conflict-banner-identity-flip (2026-10-29-V backlog): the Notes 409
// banner must name the row by the identity in the REQUESTER's loaded copy —
// partyLocation, else a plain-text 40-char excerpt of the description — never
// by the current stored row (the other session's fresh values flip "which
// note?" under the user's eyes). Proves routes/notes.js actually wires the
// rowLabel override into the shared factory (generic coverage lives in
// jsonEntityCrud.concurrent-save.test.js). Mirrors the quests harness.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

vi.mock('fs', () => ({
    default: {
        existsSync: (p) => FILE_SYSTEM.has(p),
        readFileSync: (p) => {
            const val = FILE_SYSTEM.get(p);
            if (val === undefined) throw new Error(`ENOENT: ${p}`);
            return val;
        },
        writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
    },
    existsSync: (p) => FILE_SYSTEM.has(p),
    readFileSync: (p) => {
        const val = FILE_SYSTEM.get(p);
        if (val === undefined) throw new Error(`ENOENT: ${p}`);
        return val;
    },
    writeFileSync: (p, c) => FILE_SYSTEM.set(p, c),
}));

vi.mock('../utils/campaignPaths.js', () => ({
    campaignDataFile: (campaign, name) => `/mock/campaigns/${campaign}/data/${name}`,
    ensureDataDir: vi.fn((campaign) => `/mock/campaigns/${campaign}/data`),
}));

const publishSpy = vi.hoisted(() => vi.fn());
vi.mock('../utils/changeData.js', () => ({
    publish: publishSpy,
}));

// Import AFTER mocks so the real route code wires against the in-memory fs.
const { default: notesRouter } = await import('./notes.js');

const campaign = 'test-campaign';
const filePath = `/mock/campaigns/${campaign}/data/notes.json`;
const url = `/api/campaigns/${campaign}/notes`;

const VERBATIM_MODIFIED_COPY = (label) =>
    `Note "${label}" was modified in another tab or session since you loaded it — ` +
    'reload the list and re-apply your edit — it was NOT saved.';

const app = express();
app.use(express.json());
app.use(notesRouter);

const readDisk = () => JSON.parse(FILE_SYSTEM.get(filePath));
const postArray = (notes) => request(app).post(url).send({ notes });

beforeEach(() => {
    FILE_SYSTEM.clear();
    publishSpy.mockClear();
});

describe('notes array POST — 409 conflict copy labels by the requester\'s loaded identity', () => {
    it('names a remote-renamed row by the stale copy\'s partyLocation, never the disk value', async () => {
        // Tab A loads the baseline row (boot write).
        const boot = await postArray([
            { id: 'n1', partyLocation: 'Skull Creek Cave', description: 'Baseline note', isPrivate: true },
        ]);
        expect(boot.status).toBe(200);
        const loadedStamp = readDisk()[0].updatedAt;

        // Tab B (another session) renames the row on disk — fresh stamp.
        const remote = await postArray([
            { id: 'n1', partyLocation: 'X-bump', description: 'Baseline note', isPrivate: true, updatedAt: loadedStamp },
        ]);
        expect(remote.status).toBe(200);

        // Tab A's stale save: body still carries the title it loaded.
        const stale = await postArray([
            { id: 'n1', partyLocation: 'Skull Creek Cave', description: 'Tab A draft', isPrivate: true, updatedAt: loadedStamp },
        ]);
        expect(stale.status).toBe(409);
        expect(stale.body.conflict).toBe(true);
        expect(stale.body.error).toBe(VERBATIM_MODIFIED_COPY('Skull Creek Cave'));
        expect(stale.body.error).not.toContain('X-bump');
        // The remote rename survives — the stale write never landed.
        expect(readDisk()[0].partyLocation).toBe('X-bump');
    });

    it('names an unset-location row by the stale copy\'s 40-char description excerpt', async () => {
        const loadedDesc = 'QA RunV transient note for create/delete ladder **checks** with markdown and extra tail';
        const boot = await postArray([{ id: 'n2', partyLocation: '', description: loadedDesc }]);
        expect(boot.status).toBe(200);
        const loadedStamp = readDisk()[0].updatedAt;

        // Remote session rewrites BOTH mutable identity fields.
        const remote = await postArray([
            { id: 'n2', partyLocation: 'X-bump', description: 'totally new remote description', updatedAt: loadedStamp },
        ]);
        expect(remote.status).toBe(200);

        const stale = await postArray([
            { id: 'n2', partyLocation: '', description: loadedDesc, v: 2, updatedAt: loadedStamp },
        ]);
        expect(stale.status).toBe(409);
        // Markdown-stripped, whitespace-collapsed, 40 chars + ellipsis — the
        // same recipe noteDisplayName renders as the row title.
        const excerpt = loadedDesc.replace(/\*\*/g, '').slice(0, 40) + '…';
        expect(stale.body.error).toBe(VERBATIM_MODIFIED_COPY(excerpt));
        expect(stale.body.error).not.toContain('X-bump');
        expect(stale.body.error).not.toContain('totally new remote description');
    });

    it('blank location and blank description fall back to the id — never renders ""', async () => {
        const boot = await postArray([{ id: 'blank-uuid', partyLocation: '', description: '   ' }]);
        expect(boot.status).toBe(200);
        const stamp = readDisk()[0].updatedAt;
        const stale = await postArray([
            { id: 'blank-uuid', partyLocation: '', description: '', v: 2, updatedAt: stamp - 1000 },
        ]);
        expect(stale.status).toBe(409);
        expect(stale.body.error).toContain('Note "blank-uuid" was modified');
        expect(stale.body.error).not.toContain('Note ""');
    });

    it('a dropped-row (created or deleted) 409 keeps naming by the disk row — no sender copy exists', async () => {
        await postArray([
            { id: 'e1', partyLocation: 'Keep', description: 'one' },
            { id: 'e2', partyLocation: 'Crossing Roads', description: 'two' },
        ]);
        const stale = await postArray([{ id: 'e1', partyLocation: 'Keep', description: 'edited' }]);
        expect(stale.status).toBe(409);
        expect(stale.body.error).toContain('Note "Crossing Roads" was created or deleted');
        expect(stale.body.error).not.toContain('e2');
    });
});
