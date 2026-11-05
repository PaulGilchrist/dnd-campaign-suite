// @maintained-by-ai
// Regression (improvement backlog 2026-11-04 CR): initiative target arming used
// to re-POST the ENTIRE combatSummary ({value:{round,creatures[14…]}}) per
// selectOption — flooding the write lane and shipping the full-store-snapshot
// clobber family on every stale mirror. New general lane: PATCH
// /api/campaigns/:campaign/:key merges a SCOPED field payload into the
// server's CURRENT truth (named-record arrays merge per record by `name`),
// then broadcasts the FULL merged bucket on the normal change-<campaign>-<key>
// channel — cross-tab adoption bytes identical to a full POST. Mock strategy
// mirrors campaigns-changedata.combatsummary-guard.test.js.
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

const CAMPAIGN = 'patch-test';
const url = `/api/campaigns/${CAMPAIGN}/combatSummary`;

const board = () => ({
    round: 2,
    activeCreatureName: 'Bandit',
    creatures: [
        { name: 'Bandit', type: 'npc', currentHp: 7, maxHp: 11, targetName: null, conditions: ['prone'] },
        { name: 'Alice', type: 'player', currentHp: 20, maxHp: 20, targetName: 'Bandit' },
    ],
});

beforeEach(() => {
    characterChangeData.clear();
    vi.clearAllMocks();
});

describe('combatSummary scoped PATCH (arming lane)', () => {
    it('merges one creature\'s targetName by name WITHOUT touching any other combatant field', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board() });
        const app = createTestApp();

        const res = await request(app)
            .patch(url)
            .send({ value: { creatures: [{ name: 'Bandit', targetName: 'Alice' }] } });

        expect(res.status).toBe(200);
        // Response honesty (backlog 2026-11-04 CS): the body reports the
        // merge outcome, not just a blanket success message.
        expect(res.body.message).toBe('Data patched successfully');
        expect(res.body.applied).toBe(1);
        expect(res.body.skipped).toEqual([]);
        const stored = characterChangeData.get(CAMPAIGN).combatSummary;
        expect(stored.round).toBe(2);
        expect(stored.activeCreatureName).toBe('Bandit');
        expect(stored.creatures.find(c => c.name === 'Bandit').targetName).toBe('Alice');
        // Untouched neighbours: the record merge overwrites present fields only.
        expect(stored.creatures.find(c => c.name === 'Bandit').currentHp).toBe(7);
        expect(stored.creatures.find(c => c.name === 'Bandit').conditions).toEqual(['prone']);
        expect(stored.creatures.find(c => c.name === 'Alice').targetName).toBe('Bandit');
        expect(stored.creatures).toHaveLength(2);
        expect(markDirty).toHaveBeenCalledWith(CAMPAIGN);
    });

    it('echoes the FULL merged bucket on change-<campaign>-combatSummary (adopters unchanged)', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board() });
        const app = createTestApp();

        await request(app).patch(url).send({ value: { creatures: [{ name: 'Alice', targetName: null }] } });

        expect(publish).toHaveBeenCalledTimes(1);
        const [eventKey, payload, campaign] = publish.mock.calls[0];
        expect(eventKey).toBe(`change-${CAMPAIGN}-combatSummary`);
        expect(campaign).toBe(CAMPAIGN);
        // Full board — both creatures with every field, not just the patched slice.
        expect(payload.creatures).toHaveLength(2);
        expect(payload.creatures.find(c => c.name === 'Alice').currentHp).toBe(20);
        expect(payload.creatures.find(c => c.name === 'Alice').targetName).toBeNull();
    });

    it('clearing (targetName:null) lands as null — never treated as a delete', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board() });
        const app = createTestApp();

        await request(app).patch(url).send({ value: { creatures: [{ name: 'Alice', targetName: null }] } });

        const alice = characterChangeData.get(CAMPAIGN).combatSummary.creatures.find(c => c.name === 'Alice');
        expect(alice.targetName).toBeNull();
        expect('targetName' in alice).toBe(true);
    });

    it('skips (with a named console.error) a patch record whose name has no stored match — no phantom combatant', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board() });
        const app = createTestApp();
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .patch(url)
            .send({ value: { creatures: [{ name: 'Ghost', targetName: 'Alice' }] } });

        expect(res.status).toBe(200);
        const stored = characterChangeData.get(CAMPAIGN).combatSummary;
        expect(stored.creatures.map(c => c.name)).toEqual(['Bandit', 'Alice']);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('skipped unmatched record(s): Ghost'));
        // An all-unmatched overlay no longer hides behind "success": the body
        // admits zero applied records and names every dropped one.
        expect(res.body.message).toBe('Data patched successfully');
        expect(res.body.applied).toBe(0);
        expect(res.body.skipped).toEqual(['Ghost']);
    });

    it('reports exact applied/skipped counts for a PARTIAL overlay — matched records still merge', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board() });
        const app = createTestApp();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .patch(url)
            .send({
                value: {
                    creatures: [
                        { name: 'Bandit', targetName: 'Alice' },
                        { name: 'GhostOne', targetName: 'Bandit' },
                        { name: 'Alice', targetName: null },
                        { name: 'GhostTwo', targetName: 'Alice' },
                    ],
                },
            });

        expect(res.status).toBe(200);
        expect(res.body.applied).toBe(2);
        expect(res.body.skipped).toEqual(['GhostOne', 'GhostTwo']);
        // By-name merge behaves exactly as before for the matched half.
        const stored = characterChangeData.get(CAMPAIGN).combatSummary;
        expect(stored.creatures).toHaveLength(2);
        expect(stored.creatures.find(c => c.name === 'Bandit').targetName).toBe('Alice');
        expect(stored.creatures.find(c => c.name === 'Alice').targetName).toBeNull();
        expect(stored.creatures.find(c => c.name === 'Alice').currentHp).toBe(20);
    });

    it('404s honestly when no object bucket is stored — structural creation stays on the POST lane', async () => {
        const app = createTestApp();

        const res = await request(app).patch(url).send({ value: { creatures: [{ name: 'Bandit', targetName: 'Alice' }] } });

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/no object stored/);
        expect(publish).not.toHaveBeenCalled();
        expect(markDirty).not.toHaveBeenCalled();
        expect(characterChangeData.has(CAMPAIGN)).toBe(false);
    });

    it('400s on a non-object patch (the {value:{…}} wrapper contract)', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board() });
        const app = createTestApp();

        const res = await request(app).patch(url).send({ value: 'Bandit' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/must wrap an object patch/);
        expect(characterChangeData.get(CAMPAIGN).combatSummary).toEqual(board());
    });

    it('general lane: any object bucket merges recursively; arrays without named records replace', async () => {
        characterChangeData.set(CAMPAIGN, { someBucket: { nested: { a: 1, b: 2 }, list: [1, 2, 3] } });
        const app = createTestApp();

        const res = await request(app)
            .patch(`/api/campaigns/${CAMPAIGN}/someBucket`)
            .send({ value: { nested: { b: 9 }, list: [4] } });

        expect(res.status).toBe(200);
        // Field-level patches (no named-record arrays) honestly report
        // applied: 0 / skipped: [] — nothing was dropped, there were just no
        // records to merge; drop detection is `skipped.length > 0`.
        expect(res.body.applied).toBe(0);
        expect(res.body.skipped).toEqual([]);
        expect(characterChangeData.get(CAMPAIGN).someBucket).toEqual({ nested: { a: 1, b: 9 }, list: [4] });
        expect(publish).toHaveBeenCalledWith(`change-${CAMPAIGN}-someBucket`, { nested: { a: 1, b: 9 }, list: [4] }, CAMPAIGN);
    });

    it('top-level scalar fields merge alongside the record array (round/active CreatureName survive)', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board() });
        const app = createTestApp();

        const res = await request(app)
            .patch(url)
            .send({ value: { round: 3, creatures: [{ name: 'Bandit', targetName: 'Alice' }] } });

        expect(res.status).toBe(200);
        // Scalar fields merge but only named RECORDS count toward `applied`.
        expect(res.body.applied).toBe(1);
        expect(res.body.skipped).toEqual([]);
        const stored = characterChangeData.get(CAMPAIGN).combatSummary;
        expect(stored.round).toBe(3);
        expect(stored.activeCreatureName).toBe('Bandit');
        expect(stored.creatures.find(c => c.name === 'Bandit').targetName).toBe('Alice');
    });

    it('an empty array patch replaces (no named records to merge) — raw semantics stay honest', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: board() });
        const app = createTestApp();

        await request(app).patch(url).send({ value: { creatures: [] } });

        expect(characterChangeData.get(CAMPAIGN).combatSummary.creatures).toEqual([]);
    });
});
