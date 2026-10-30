// @maintained-by-ai
// Regression: bug-initiative-concurrent-npc-spawn-lost-update — the generic
// change-data POST replaced combatSummary blindly (last write wins), so two GM
// tabs read-modify-writing the full board silently dropped one tab's accepted
// mutation. New guarded lane (the .ct-* jsonEntityCrud 409 doctrine for the raw
// full-replace store): a POST carrying baseVersion commits ONLY when the stamp
// matches the CURRENT stored board's boardVersion; a stale base 409s with the
// live version so the client can re-read and re-apply once. Writers without
// baseVersion (HP edits, Next/Prev, EB join, scripted seeds) keep byte-exact
// pass-through behaviour. Mock strategy mirrors campaigns-changedata.test.js.
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    characterChangeData: new Map(),
    publish: vi.fn(),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
    markDirty: vi.fn(),
}));

import { characterChangeData, markDirty } from '../utils/changeData.js';
import campaignsChangedata from './campaigns-changedata.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsChangedata);
    return app;
}

const CAMPAIGN = 'guard-test';
const url = `/api/campaigns/${CAMPAIGN}/combatSummary`;

const board = (boardVersion, name = 'NPC 1') => ({
    round: 1,
    creatures: [{ name, type: 'npc' }],
    ...(boardVersion === null ? {} : { boardVersion }),
});

beforeEach(() => {
    characterChangeData.clear();
    vi.clearAllMocks();
});

describe('combatSummary guarded POST (baseVersion stamp)', () => {
    it('accepts a write whose baseVersion matches the stored board and persists the stamped value', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board(1, 'NPC 1') });
        const app = createTestApp();

        const res = await request(app).post(url).send({ value: board(2, 'NPC 2'), baseVersion: 1 });

        expect(res.status).toBe(200);
        expect(characterChangeData.get(CAMPAIGN).combatSummary.creatures.map(c => c.name)).toEqual(['NPC 2']);
        expect(characterChangeData.get(CAMPAIGN).combatSummary.boardVersion).toBe(2);
        expect(markDirty).toHaveBeenCalledWith(CAMPAIGN);
    });

    it('409s a stale base WITHOUT touching the store or publishing', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board(1, 'NPC 1') });
        const app = createTestApp();

        const res = await request(app).post(url).send({ value: board(1, 'NPC 1 from the losing tab'), baseVersion: 0 });

        expect(res.status).toBe(409);
        expect(res.body.conflict).toBe(true);
        expect(res.body.boardVersion).toBe(1);
        expect(res.body.error).toMatch(/modified in another tab or session/);
        // The loser's board never landed — the winner's mutation survives.
        expect(characterChangeData.get(CAMPAIGN).combatSummary.creatures.map(c => c.name)).toEqual(['NPC 1']);
    });

    it('treats an absent/never-stamped board as version 0 (first guarded write on a legacy board)', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: { round: 1, creatures: [] } });
        const app = createTestApp();

        const res = await request(app).post(url).send({ value: board(1), baseVersion: 0 });

        expect(res.status).toBe(200);
        expect(characterChangeData.get(CAMPAIGN).combatSummary.boardVersion).toBe(1);
    });

    it('accepts baseVersion 0 when the campaign has no stored board at all', async () => {
        const app = createTestApp();

        const res = await request(app).post(url).send({ value: board(1), baseVersion: 0 });

        expect(res.status).toBe(200);
        expect(characterChangeData.get(CAMPAIGN).combatSummary.boardVersion).toBe(1);
    });

    it('baseVersion after an admin-clear-cleared board is stale — 409 forces an honest re-read', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: { round: 1, creatures: [{ name: 'Fresh Seed', type: 'npc' }] } });
        const app = createTestApp();

        const res = await request(app).post(url).send({ value: board(4), baseVersion: 3 });

        // Unversioned seed write reset the chain to 0 — the v3-base sender is stale.
        expect(res.status).toBe(409);
        expect(res.body.boardVersion).toBe(0);
        expect(characterChangeData.get(CAMPAIGN).combatSummary.creatures.map(c => c.name)).toEqual(['Fresh Seed']);
    });
});

describe('combatSummary legacy (unguarded) POST passthrough', () => {
    it('writes through without baseVersion even against a versioned board (HP edits, seeds)', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board(7, 'NPC 1') });
        const app = createTestApp();

        const res = await request(app).post(url).send({ value: board(null, 'Goblin') });

        expect(res.status).toBe(200);
        expect(characterChangeData.get(CAMPAIGN).combatSummary.creatures.map(c => c.name)).toEqual(['Goblin']);
    });

    it('other keys never gain the guard — baseVersion on a non-combatSummary key is ignored', async () => {
        characterChangeData.set(CAMPAIGN, { activeCreatureName: 'Alice' });
        const app = createTestApp();

        const res = await request(app)
            .post(`/api/campaigns/${CAMPAIGN}/activeCreatureName`)
            .send({ value: 'Bob', baseVersion: 99 });

        expect(res.status).toBe(200);
        expect(characterChangeData.get(CAMPAIGN).activeCreatureName).toBe('Bob');
    });
});
