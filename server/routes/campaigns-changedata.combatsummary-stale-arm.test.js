// @maintained-by-ai
// Regression (bug-race-arm-patch-beats-swap-clear-post): the owner law "a direct
// controller→controller swap (or release) leaves the new controller UNARMED" lived
// only in the client swap handler's full-board POST. The scoped arm PATCH coalesces
// ~120 ms client-side, so cross-tab it could land AFTER the swap POST and the
// by-name merge re-armed the already-swapped row (live-confirmed 2026-11-12 run NN,
// POST +17 ms / PATCH +124 ms) — silently defeating the law and falsifying the
// control_arm_cleared audit row. Fix: the arm lane stamps seenController (the row's
// delegated controller at issue time, a wire-only field); dropStaleArmWrites strips
// it and drops the record's targetName when the stored row now answers to a
// different controller. Mock strategy mirrors
// campaigns-changedata.combatsummary-patch.test.js.
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

const CAMPAIGN = 'stale-arm-test';
const url = `/api/campaigns/${CAMPAIGN}/combatSummary`;

// Post-swap board: the Goblin was handed directly from HeroesFeastBard to
// AasimarTest — the swap's full POST deleted targetName on the same write.
const swappedBoard = () => ({
    round: 1,
    creatures: [
        { name: 'AasimarTest', type: 'player', currentHp: 20 },
        { name: 'HeroesFeastBard', type: 'player', currentHp: 18 },
        { name: 'FeyRanger', type: 'player', currentHp: 15 },
        { name: 'Goblin', type: 'npc', currentHp: 7, controller: 'AasimarTest' },
    ],
});

const goblin = (campaign = CAMPAIGN) =>
    characterChangeData.get(campaign).combatSummary.creatures.find(c => c.name === 'Goblin');

beforeEach(() => {
    characterChangeData.clear();
    vi.clearAllMocks();
});

describe('combatSummary PATCH — stale arm writes lose to a controller swap/release', () => {
    it('drops a late arm whose seenController no longer owns the row — board stays unarmed, stamp never persists', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: swappedBoard() });
        const app = createTestApp();
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // The race face: tab A's coalesced PATCH (armed against the pre-swap
        // HeroesFeastBard context) lands after tab B's swap POST.
        const res = await request(app)
            .patch(url)
            .send({ value: { creatures: [{ name: 'Goblin', targetName: 'FeyRanger', seenController: 'HeroesFeastBard' }] } });

        expect(res.status).toBe(200);
        expect(res.body.staleArmDropped).toEqual(['Goblin']);
        const row = goblin();
        expect('targetName' in row).toBe(false); // exactly what the swap POST left behind
        expect('seenController' in row).toBe(false); // wire-only field — never stored
        expect(row.controller).toBe('AasimarTest');
        // Named server-log line beside the drop (never-silent-success doctrine).
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('dropped stale arm write(s) for: Goblin'));
        // The echo still broadcasts the FULL merged (unarmed) board so every
        // tab's arm select re-derives to ''.
        expect(publish).toHaveBeenCalledTimes(1);
        const echoed = publish.mock.calls[0][1];
        expect('targetName' in echoed.creatures.find(c => c.name === 'Goblin')).toBe(false);
        expect(markDirty).toHaveBeenCalledWith(CAMPAIGN);
    });

    it('drops a late arm that lands after a RELEASE (controller absent) — the released row stays unarmed', async () => {
        const board = swappedBoard();
        delete board.creatures.find(c => c.name === 'Goblin').controller;
        characterChangeData.set(CAMPAIGN, { combatSummary: board });
        const app = createTestApp();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .patch(url)
            .send({ value: { creatures: [{ name: 'Goblin', targetName: 'FeyRanger', seenController: 'AasimarTest' }] } });

        expect(res.body.staleArmDropped).toEqual(['Goblin']);
        expect('targetName' in goblin()).toBe(false);
    });

    it('still APPLIES the arm when the row answers to the same controller (normal delegation arming unchanged)', async () => {
        characterChangeData.set(CAMPAIGN, { combatSummary: swappedBoard() });
        const app = createTestApp();

        const res = await request(app)
            .patch(url)
            .send({ value: { creatures: [{ name: 'Goblin', targetName: 'FeyRanger', seenController: 'AasimarTest' }] } });

        expect(res.status).toBe(200);
        expect(res.body.staleArmDropped).toEqual([]);
        expect(res.body.applied).toBe(1);
        expect(goblin().targetName).toBe('FeyRanger');
        expect('seenController' in goblin()).toBe(false);
    });

    it('a POST-swap then arm sequence (stamp captured after adoption) lands — the guard is context-staleness, not ordering', async () => {
        // Same end-state as above written as two requests: the swap POST first,
        // then an arm whose mirror already carried the new controller.
        characterChangeData.set(CAMPAIGN, { combatSummary: swappedBoard() });
        const app = createTestApp();

        await request(app)
            .patch(url)
            .send({ value: { creatures: [{ name: 'Goblin', targetName: null, seenController: 'AasimarTest' }] } });

        expect(goblin().targetName).toBeNull(); // explicit unarm honors the merge law (key PRESENT)
        expect('seenController' in goblin()).toBe(false);
    });

    it('permissive for GM-issued arms (seenController null/absent) — the blessed first-time-assign face survives the race', async () => {
        const board = swappedBoard();
        delete board.creatures.find(c => c.name === 'Goblin').controller;
        // GM pre-arms WHILE uncontrolled; a FIRST-TIME assign POST lands first.
        // Owner law: first-time assign KEEPS the arm, so the late arm must merge.
        board.creatures.find(c => c.name === 'Goblin').controller = 'HeroesFeastBard';
        characterChangeData.set(CAMPAIGN, { combatSummary: board });
        const app = createTestApp();

        const stamped = await request(app)
            .patch(url)
            .send({ value: { creatures: [{ name: 'Goblin', targetName: 'FeyRanger', seenController: null }] } });
        expect(stamped.body.staleArmDropped).toEqual([]);
        expect(goblin().targetName).toBe('FeyRanger');

        // Legacy unstamped writer (old client / other lane) merges byte-identically to today.
        const g = goblin();
        delete g.targetName;
        const legacy = await request(app)
            .patch(url)
            .send({ value: { creatures: [{ name: 'Goblin', targetName: 'AasimarTest' }] } });
        expect(legacy.body.staleArmDropped).toEqual([]);
        expect(legacy.body.applied).toBe(1);
        expect(goblin().targetName).toBe('AasimarTest');
        expect('seenController' in goblin()).toBe(false);
    });

    it('per-record granularity in a coalesced burst: the stale arm drops, the matched-context arm merges', async () => {
        const board = swappedBoard();
        board.creatures.push({ name: 'Kobold', type: 'npc', currentHp: 6, controller: 'HeroesFeastBard' });
        characterChangeData.set(CAMPAIGN, { combatSummary: board });
        const app = createTestApp();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .patch(url)
            .send({
                value: {
                    creatures: [
                        { name: 'Goblin', targetName: 'FeyRanger', seenController: 'HeroesFeastBard' }, // stale — swapped away
                        { name: 'Kobold', targetName: 'AasimarTest', seenController: 'HeroesFeastBard' }, // still owned
                    ],
                },
            });

        expect(res.body.staleArmDropped).toEqual(['Goblin']);
        expect('targetName' in goblin()).toBe(false);
        const kobold = characterChangeData.get(CAMPAIGN).combatSummary.creatures.find(c => c.name === 'Kobold');
        expect(kobold.targetName).toBe('AasimarTest');
        expect('seenController' in kobold).toBe(false);
        expect(res.body.applied).toBe(2); // both records merged — the stale one only survived its name
    });

    it('leaves untouched rows and scalar fields alone when an arm drops (neighbors survive)', async () => {
        const board = swappedBoard();
        board.creatures.find(c => c.name === 'Goblin').targetName = null; // prior honest unarm
        characterChangeData.set(CAMPAIGN, { combatSummary: board });
        const app = createTestApp();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .patch(url)
            .send({ value: { round: 3, creatures: [{ name: 'Goblin', targetName: 'FeyRanger', seenController: 'HeroesFeastBard' }] } });

        expect(res.body.staleArmDropped).toEqual(['Goblin']);
        const stored = characterChangeData.get(CAMPAIGN).combatSummary;
        expect(stored.round).toBe(3); // un-arm-related fields still merge
        expect(stored.creatures.find(c => c.name === 'Goblin').targetName).toBeNull(); // untouched, not overwritten
    });
});
