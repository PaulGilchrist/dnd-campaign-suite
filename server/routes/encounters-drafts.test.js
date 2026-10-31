// @maintained-by-ai
/**
 * Campaign-authoring plan Phase 3 — draft invisibility on the custom
 * encounters lane (not factory-based): AI-drafted builder presets stay
 * invisible to network clients in both the list and by-name faces.
 */
import express from 'express';
import { vi } from 'vitest';
import { request } from '../test-utils/localhostSupertest.js';
import encounters from './encounters.js';

const MOCK_FS = new Map();
const ENC_PATH = `${process.cwd()}/public/campaigns/test-campaign/data/encounters.json`;

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn((p) => MOCK_FS.has(p)),
        readFileSync: vi.fn((p) => {
            const c = MOCK_FS.get(p);
            if (c === undefined) throw new Error(`ENOENT ${p}`);
            return JSON.stringify(c);
        }),
        writeFileSync: vi.fn((p, data) => { MOCK_FS.set(p, JSON.parse(data)); }),
        mkdirSync: vi.fn(),
    },
}));

vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use(encounters);

beforeEach(() => {
    MOCK_FS.clear();
    MOCK_FS.set(ENC_PATH, {
        encounters: [
            { name: 'Approved Fight', savedAt: 'x', selectedMonsters: [] },
            { name: 'Session 4 Ambush', savedAt: 'y', selectedMonsters: [], draft: true },
        ],
    });
});

describe('encounters route draft filtering', () => {
    it('list omits drafts for LAN clients, keeps them for the GM', async () => {
        const lan = await request(app).get('/api/campaigns/test-campaign/encounters').set('Host', '10.0.0.5');
        expect(lan.body.encounters.map(e => e.name)).toEqual(['Approved Fight']);
        const gm = await request(app).get('/api/campaigns/test-campaign/encounters').set('Host', 'localhost');
        expect(gm.body.encounters.map(e => e.name)).toEqual(['Approved Fight', 'Session 4 Ambush']);
    });

    it('by-name fetch of a draft 404s for LAN (existence unconfirmable) but serves the GM', async () => {
        const lan = await request(app).get('/api/campaigns/test-campaign/encounters/Session 4 Ambush').set('Host', '10.0.0.5');
        expect(lan.status).toBe(404);
        const gm = await request(app).get('/api/campaigns/test-campaign/encounters/Session 4 Ambush').set('Host', 'localhost');
        expect(gm.status).toBe(200);
        expect(gm.body.draft).toBe(true);
    });
});
