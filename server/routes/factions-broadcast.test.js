// Live-sync broadcast tests: faction list create/update (whole-list POST
// replacement) and delete must publish `factions-list-<campaign>` SSE events
// (mirroring npcs-list broadcasts from routes/npcs.js) so other GM tabs'
// faction lists update without reload. Backlog 2026-10-26-B.
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

import factions from './factions.js';

function factionsPath(campaign) {
    return `/mock/campaigns/${campaign}/data/factions.json`;
}

const app = express();
app.use(express.json());
app.use(factions);

describe('Faction live-sync broadcasts', () => {
    beforeEach(() => {
        publishSpy.mockClear();
        setupFs({});
    });

    it('publishes factions-list replaced event when POST creates/updates the list', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [{ id: 'f1', name: 'Cult of the Deep' }] });

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'factions-list-test-campaign',
            { action: 'replaced' },
            'test-campaign'
        );
    });

    it('publishes factions-list deleted event when DELETE removes a faction', async () => {
        setupFs({ [factionsPath('test-campaign')]: [{ id: 'f1', name: 'Cult of the Deep' }] });

        const res = await request(app).delete('/api/campaigns/test-campaign/factions/f1');

        expect(res.status).toBe(200);
        expect(publishSpy).toHaveBeenCalledWith(
            'factions-list-test-campaign',
            { action: 'deleted', name: 'f1' },
            'test-campaign'
        );
    });

    it('does not broadcast when POST is rejected for a duplicate name', async () => {
        const res = await request(app)
            .post('/api/campaigns/test-campaign/factions')
            .send({ factions: [{ id: 'a', name: 'Cult' }, { id: 'b', name: 'cult' }] });

        expect(res.status).toBe(400);
        expect(publishSpy).not.toHaveBeenCalled();
    });
});
