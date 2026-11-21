// @maintained-by-ai
// Improvement (backlog 2026-11-21 JII): the scoped PATCH success body said
// `applied: 0` for EVERY char-bucket field merge — the counter is combat-
// Summary-ROW-scoped semantics (records merged by name), leaking into char
// buckets where no records exist and reading as a lie while the GET shows the
// value landed. Fix: an honest `appliedFields` counter — the number of
// TOP-LEVEL patch fields actually WRITTEN into the merged bucket. Semantics
// pinned here: WRITE counts, not diff counts (a field written with an
// identical value still counts); a recursive object merge and a named-records
// merge each count their top-level key ONCE (never per leaf/record); rows-
// lane `applied`/`skipped`/`staleArmDropped` bytes are untouched. Mock
// strategy mirrors campaigns-changedata.combatsummary-patch.test.js.
import { request } from '../test-utils/localhostSupertest.js';
import express from 'express';

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    characterChangeData: new Map(),
    publish: vi.fn(),
    saveFile: vi.fn(),
    debouncedSave: vi.fn(),
    markDirty: vi.fn(),
}));

import { characterChangeData, publish, markDirty } from '../utils/changeData.js';
import campaignsChangedata from './campaigns-changedata.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(campaignsChangedata);
    return app;
}

const CAMPAIGN = 'applied-fields-test';

const charBucket = () => ({
    currentHitPoints: 3,
    maxHitPoints: 20,
    ac: 16,
    nested: { a: 1, b: 2 },
});

const board = () => ({
    round: 2,
    activeCreatureName: 'Bandit',
    creatures: [
        { name: 'Bandit', type: 'npc', currentHp: 7, maxHp: 11, targetName: null },
        { name: 'Alice', type: 'player', currentHp: 20, maxHp: 20, targetName: 'Bandit' },
    ],
});

beforeEach(() => {
    characterChangeData.clear();
    vi.clearAllMocks();
});

describe('scoped PATCH appliedFields honesty (char-bucket lane)', () => {
    it('(i) a single-field char-bucket patch answers applied: 0 (record truth) with appliedFields: 1', async () => {
        characterChangeData.set(CAMPAIGN, { FeyRanger: charBucket() });
        const app = createTestApp();

        const res = await request(app)
            .patch(`/api/campaigns/${CAMPAIGN}/FeyRanger`)
            .send({ value: { currentHitPoints: 8 } });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Data patched successfully');
        // applied stays honest RECORD truth — there were no named records.
        expect(res.body.applied).toBe(0);
        // The field landed: nothing reads as a lie anymore.
        expect(res.body.appliedFields).toBe(1);
        expect(res.body.skipped).toEqual([]);
        expect(res.body.staleArmDropped).toEqual([]);
        // GET-side truth: the merged bucket carries the write.
        expect(characterChangeData.get(CAMPAIGN).FeyRanger.currentHitPoints).toBe(8);
        expect(publish).toHaveBeenCalledTimes(1);
        expect(markDirty).toHaveBeenCalledWith(CAMPAIGN);
    });

    it('(ii) a multi-field patch counts every top-level field written', async () => {
        characterChangeData.set(CAMPAIGN, { FeyRanger: charBucket() });
        const app = createTestApp();

        const res = await request(app)
            .patch(`/api/campaigns/${CAMPAIGN}/FeyRanger`)
            .send({ value: { currentHitPoints: 8, ac: 17, conditions: ['prone'] } });

        expect(res.status).toBe(200);
        expect(res.body.applied).toBe(0);
        expect(res.body.appliedFields).toBe(3);
        const stored = characterChangeData.get(CAMPAIGN).FeyRanger;
        expect(stored.currentHitPoints).toBe(8);
        expect(stored.ac).toBe(17);
        expect(stored.conditions).toEqual(['prone']);
    });

    it('(iii) a recursive object merge counts its top-level key ONCE, never per leaf', async () => {
        characterChangeData.set(CAMPAIGN, { FeyRanger: charBucket() });
        const app = createTestApp();

        const res = await request(app)
            .patch(`/api/campaigns/${CAMPAIGN}/FeyRanger`)
            .send({ value: { nested: { b: 9, c: 10 } } });

        expect(res.status).toBe(200);
        expect(res.body.appliedFields).toBe(1);
        expect(characterChangeData.get(CAMPAIGN).FeyRanger.nested).toEqual({ a: 1, b: 9, c: 10 });
    });

    it('write counts, not diff counts — re-writing identical values still counts', async () => {
        characterChangeData.set(CAMPAIGN, { FeyRanger: charBucket() });
        const app = createTestApp();

        const res = await request(app)
            .patch(`/api/campaigns/${CAMPAIGN}/FeyRanger`)
            .send({ value: { currentHitPoints: 3 } });

        expect(res.status).toBe(200);
        expect(res.body.appliedFields).toBe(1);
    });

    it('a fully-skipped record overlay counts NO fields (nothing was written)', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board() });
        const app = createTestApp();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .patch(`/api/campaigns/${CAMPAIGN}/combatSummary`)
            .send({ value: { creatures: [{ name: 'Ghost', targetName: 'Alice' }] } });

        expect(res.status).toBe(200);
        expect(res.body.applied).toBe(0);
        expect(res.body.appliedFields).toBe(0);
        expect(res.body.skipped).toEqual(['Ghost']);
    });
});

describe('scoped PATCH rows lane keeps record semantics', () => {
    it('(iv) a combatSummary row merge: applied counts RECORDS, appliedFields counts the top-level key ONCE (no double-count)', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board() });
        const app = createTestApp();

        const res = await request(app)
            .patch(`/api/campaigns/${CAMPAIGN}/combatSummary`)
            .send({ value: { creatures: [
                { name: 'Bandit', targetName: 'Alice' },
                { name: 'Alice', targetName: null },
            ] } });

        expect(res.status).toBe(200);
        // Rows-lane truth byte-identical: two records merged.
        expect(res.body.applied).toBe(2);
        expect(res.body.skipped).toEqual([]);
        expect(res.body.staleArmDropped).toEqual([]);
        // …but only ONE top-level patch field was written — records never
        // double-count into appliedFields.
        expect(res.body.appliedFields).toBe(1);
        const stored = characterChangeData.get(CAMPAIGN).combatSummary;
        expect(stored.creatures.find(c => c.name === 'Bandit').targetName).toBe('Alice');
        expect(stored.creatures.find(c => c.name === 'Alice').targetName).toBeNull();
    });

    it('scalar + record overlay: each top-level key counts once beside its record count', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board() });
        const app = createTestApp();

        const res = await request(app)
            .patch(`/api/campaigns/${CAMPAIGN}/combatSummary`)
            .send({ value: { round: 3, creatures: [{ name: 'Bandit', targetName: 'Alice' }] } });

        expect(res.status).toBe(200);
        expect(res.body.applied).toBe(1);
        expect(res.body.appliedFields).toBe(2); // round (replace) + creatures (records)
        expect(characterChangeData.get(CAMPAIGN).combatSummary.round).toBe(3);
    });
});
