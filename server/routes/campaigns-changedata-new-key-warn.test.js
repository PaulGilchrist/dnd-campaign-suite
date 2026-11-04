import express from 'express';
import { request } from '../test-utils/localhostSupertest.js';

// Backlog 2026-11-03 CN (changeData-wildcard-phantom-bucket): a mistyped
// top-level key promoted silently to a new bucket. Write lanes must now emit
// console.warn('[changeData] new top-level key "<key>"') at creation, while
// the write itself stays 200 (warn-only observability, never a 400).
//
// changeData.js is REAL here (importActual) so the helper's console.warn is
// the genuine article through the supertest lane; only the disk/SSE side
// effects are stubbed — no debounce timer may fire and write to disk in tests.
vi.mock('../utils/changeData.js', async () => {
    const actual = await vi.importActual('../utils/changeData.js');
    return {
        ...actual,
        publish: vi.fn(),
        markDirty: vi.fn(),
        debouncedSave: vi.fn(),
        saveFile: vi.fn(),
    };
});

import { characterChangeData } from '../utils/changeData.js';
import campaignsChangedata from './campaigns-changedata.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsChangedata);
    return app;
}

let consoleWarn;

beforeEach(() => {
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {
        // no-op
    });
});

afterEach(() => {
    consoleWarn.mockRestore();
    characterChangeData.clear();
});

describe('changeData new-top-level-key warn (wildcard POST lane)', () => {
    it('warns with the exact [changeData] message when a POST creates an unseen key, and still answers 200', async () => {
        characterChangeData.set('test-campaign', { combatSummary: { round: 1 } });
        const app = createTestApp();

        const res = await request(app)
            .post('/api/campaigns/test-campaign/QA-TypoProbe')
            .send({ value: { probe: 1 } });

        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign')['QA-TypoProbe']).toEqual({ probe: 1 });
        expect(consoleWarn).toHaveBeenCalledTimes(1);
        expect(consoleWarn).toHaveBeenCalledWith('[changeData] new top-level key "QA-TypoProbe"');
    });

    it('warns once at creation — a second write to the now-existing key stays silent', async () => {
        characterChangeData.set('test-campaign', {});
        const app = createTestApp();

        const first = await request(app)
            .post('/api/campaigns/test-campaign/QA-TypoProbe')
            .send({ value: { probe: 1 } });
        expect(first.status).toBe(200);
        expect(consoleWarn).toHaveBeenCalledTimes(1);

        const second = await request(app)
            .post('/api/campaigns/test-campaign/QA-TypoProbe')
            .send({ value: { probe: 2 } });
        expect(second.status).toBe(200);
        expect(characterChangeData.get('test-campaign')['QA-TypoProbe']).toEqual({ probe: 2 });
        expect(consoleWarn).toHaveBeenCalledTimes(1);
    });

    it('never warns for a write to a pre-existing key (e.g. combatSummary)', async () => {
        characterChangeData.set('test-campaign', { combatSummary: { round: 1, creatures: [] } });
        const app = createTestApp();

        const res = await request(app)
            .post('/api/campaigns/test-campaign/combatSummary')
            .send({ value: { round: 2, creatures: [] } });

        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').combatSummary.round).toBe(2);
        expect(consoleWarn).not.toHaveBeenCalled();
    });

    it('a legitimate first write for a fresh character bucket succeeds 200 and warns', async () => {
        const app = createTestApp();

        const res = await request(app)
            .post('/api/campaigns/test-campaign/Brand New Hero')
            .send({ hitPoints: { current: 30 } });

        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign')['Brand New Hero']).toEqual({ hitPoints: { current: 30 } });
        expect(consoleWarn).toHaveBeenCalledWith('[changeData] new top-level key "Brand New Hero"');
    });

    it('full-store POST form ({ value: { key: ... } }) warns on unseen key creation', async () => {
        characterChangeData.set('test-campaign', {});
        const app = createTestApp();

        const res = await request(app)
            .post('/api/campaigns/test-campaign/phantomName')
            .send({ value: { phantomName: { hp: 1 }, otherKey: 'ignored' } });

        expect(res.status).toBe(200);
        expect(characterChangeData.get('test-campaign').phantomName).toEqual({ hp: 1 });
        expect(consoleWarn).toHaveBeenCalledWith('[changeData] new top-level key "phantomName"');
    });

    it('a validator-blocked write to an unseen key is refused 400 WITHOUT a new-key warn', async () => {
        characterChangeData.set('test-campaign', {});
        const app = createTestApp();

        // key === campaign is the documented deprecated-post refusal lane
        const res = await request(app)
            .post('/api/campaigns/test-campaign/campaign')
            .send({ value: { targetEffects: [] } });

        expect(res.status).toBe(400);
        expect(consoleWarn).not.toHaveBeenCalled();
    });

    it('positioning and music lanes warn when their rig key is new on a cleared campaign', async () => {
        characterChangeData.set('test-campaign', {});
        const app = createTestApp();

        const positioning = await request(app)
            .post('/api/campaigns/test-campaign/positioning')
            .send({ positioning: {} });
        expect(positioning.status).toBe(200);
        expect(consoleWarn).toHaveBeenCalledWith('[changeData] new top-level key "positioning"');

        const music = await request(app)
            .post('/api/campaigns/test-campaign/music')
            .send({ value: { playing: false } });
        expect(music.status).toBe(200);
        expect(consoleWarn).toHaveBeenCalledWith('[changeData] new top-level key "music"');
        expect(consoleWarn).toHaveBeenCalledTimes(2);

        // Second round-trip on both now-existing keys: silent
        consoleWarn.mockClear();
        await request(app).post('/api/campaigns/test-campaign/positioning').send({ positioning: {} });
        await request(app).post('/api/campaigns/test-campaign/music').send({ value: { playing: false } });
        expect(consoleWarn).not.toHaveBeenCalled();
    });
});
