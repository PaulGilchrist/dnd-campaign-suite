// Live-sync broadcast tests: note list create/update (whole-list POST
// replacement) and delete must publish `notes-list-<campaign>` SSE events
// (mirroring npcs-list broadcasts from routes/npcs.js) so other GM tabs'
// note lists update without reload. Backlog 2026-10-26-B.
import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

const FILE_SYSTEM = new Map();

function setupFs(entries) {
    FILE_SYSTEM.clear();
    for (const [p, content] of Object.entries(entries)) {
        FILE_SYSTEM.set(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
}

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

import notes from './notes.js';

function notesPath(campaign) {
    return `/mock/campaigns/${campaign}/data/notes.json`;
}

const app = express();
app.use(express.json());
app.use(notes);

describe('Note live-sync broadcasts', () => {
    beforeEach(() => {
        publishSpy.mockClear();
        setupFs({});
    });

    it('publishes notes-list replaced event when POST creates/updates the list', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/notes')
            .send({ notes: [{ id: 'n1', description: 'A clue by the fire' }] });

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'notes-list-test-campaign',
            { action: 'replaced' },
            'test-campaign'
        );
    });

    it('publishes notes-list deleted event when DELETE removes a note', async () => {
        setupFs({ [notesPath('test-campaign')]: [{ id: 'n1', description: 'A clue by the fire' }] });

        const res = await request(app).delete('/api/campaigns/test-campaign/notes/n1');

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'notes-list-test-campaign',
            { action: 'deleted', name: 'n1' },
            'test-campaign'
        );
    });
});
