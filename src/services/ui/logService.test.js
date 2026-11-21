// @maintained-by-ai
// Unit-canonical home for src/services/ui/logService.js — REAL module, never mocked here.
// Contract (verified against server/routes/log.js): the client is a fetch wrapper over
// GET/POST /api/campaigns/:campaign/log. It performs NO batching, NO buffering, NO
// id/timestamp stamping and NO sorting — the server owns id + numeric Date.now() stamps,
// the last-500 cap, disk persistence (1s save-debounce) and SSE publish. It DOES stamp a
// derived audit `message` onto textless structured rows (bug-log-schema-gate-rejects-app-
// own-combat-rows): the server POST gate 400s any row without canonical readable text, and
// the app's structured combat producers render from structured fields, never prose — the
// one shared POST lane stamps plain-English audit text so real rows land while forged hand-
// POSTs (which never run this code) still 400. Entries carrying canonical text pass through
// byte-identically. NO-CLOCK: this client module contains zero timers; all fixture
// timestamps are inert numbers carried verbatim (log-stamp-only category), never windowed/
// sorted. Error law: both wrappers THROW descriptive Errors before reading the body on
// !ok; fetch rejections propagate untouched. Fire-and-forget .catch() chains live in
// consumers (e.g. autoRewardService, applyRuling), not here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as logService from './logService.js';
import { getLog, addEntry, stampAuditText } from './logService.js';

// REAL producer bodies captured live 2026-11-20 via a fetch spy on the bug repro
// (Goblin Scimitar chip commit in test-campaign) — byte-exact wire bodies, including
// the null/zero passthrough fields no hand-written fixture thought to include.
const REAL_ATTACK_BODY = {
    type: 'roll', characterName: 'Goblin', rollType: 'attack', name: 'Scimitar',
    rolls: [15], mode: 'normal', total: 15, bonus: 4, bonusDetail: '(+4 to hit)',
    baneRoll: null, baneDisplayLabel: 'Bane', subtractDieRoll: null,
    subtractDieDisplayLabel: null, subtractDie: null, blessRoll: null,
    isNatural20: false, isNatural1: false, targetName: 'ElderPaladin', targetAc: 19,
    effectiveAc: 19, shieldAcBonus: 0, shieldOfFaithAcBonus: 0, wardingBondAcBonus: 0,
    slowAcPenalty: 0, parryAcBonus: 0, guardianProtectionAcBonus: 0, hit: true,
    isAutoMiss: false, isCrit: false, damageType: 'Slashing', rangeReason: null,
    resistanceNotice: null, coverLevel: null, coverAcBonus: 0, coverReason: null,
    advantageReason: null,
};
const REAL_DAMAGE_BODY = {
    type: 'roll', characterName: 'Goblin', rollType: 'damage', name: 'Scimitar',
    formula: '1d6 + 2', rolls: [6], total: 8, modifier: 2, damageType: 'Slashing',
    targetName: 'ElderPaladin', finalDamage: 8, note: 'combined_damage_roll',
    isCrit: false, gwfApplied: false, gwfOriginalRolls: null, gwfDisplayRolls: [6],
    rayOfEnfeebleReduction: 0, rayOfEnfeebleRoll: null, weakeningBreathReduction: 0,
    weakeningBreathRoll: null, resistanceReduction: 0, resistanceRoll: null,
};
const REAL_HP_CHANGE_BODY = {
    type: 'hp_change', targetName: 'ElderPaladin', delta: -8, currentHp: 216,
    maxHp: 224, isHealing: false, isUnconscious: false,
    damageBreakdown: [{ damageType: 'Slashing', amount: 8, resisted: false, status: null }],
    isPlayer: true,
};
// Quick-spawn join row (src/services/encounters/quickMonsterSpawn.js) — 400'd live
// with `[quickMonsterSpawn] joined log failed`.
const REAL_JOIN_BODY = {
    type: 'encounter', action: 'joined', encounterName: 'Quick spawn',
    monsters: ['1x Goblin'],
};
// Death-save finality row (DeathSavePromptModal.jsx logFinalityRow / sheet twin in
// DeathSavingThrows.jsx) — the player-death cue lane.
const REAL_DEATH_SAVE_DEAD_BODY = {
    type: 'death_save', characterName: 'EvasiveFighter', result: 'dead',
    totalSuccesses: 1, totalFailures: 3,
};
// Condition leg from the damage lane (handlePlainDamage.js) — carries only the
// non-canonical reason/note prose fields.
const REAL_CONDITION_BODY = {
    type: 'condition', action: 'applied', characterName: 'ElderPaladin',
    condition: 'Prone', reason: 'Scimitar — until the start of Goblin’s next turn',
    note: 'Falls prone.',
};

describe('logService', () => {
    let fetchSpy;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('exports getLog (arity 1), addEntry (arity 2) and stampAuditText (arity 1), the fetch pair async', () => {
        expect(Object.keys(logService).sort()).toEqual(['addEntry', 'deriveAuditText', 'getLog', 'stampAuditText']);
        expect(getLog).toBeTypeOf('function');
        expect(addEntry).toBeTypeOf('function');
        expect(getLog).toHaveLength(1);
        expect(addEntry).toHaveLength(2); // logService.js
        expect(stampAuditText).toBeTypeOf('function');
        expect(stampAuditText).toHaveLength(1);
    });

    describe('getLog', () => {
        it('GETs the campaign log with no fetch options and resolves the parsed payload verbatim', async () => {
            // Server-truth entry shape: server prepends id + numeric-ms timestamp.
            const payload = [
                { id: 'e1', timestamp: 1700000000000, type: 'roll', name: 'Test roll', total: 17 },
                { id: 'e2', timestamp: 1700000000001, type: 'loot', name: 'Combat', xpPerChar: 0 }
            ];
            fetchSpy.mockReturnValueOnce(jsonResponse({ data: payload }));

            const result = await getLog('test-campaign');

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            // Single-argument call pins GET-by-default: any init object would fail this.
            expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/log');
            // Verbatim passthrough: no client-side slice, sort, dedupe or reshape.
            expect(result).toStrictEqual(payload);

            // Fresh-campaign arm: server returns [] — client resolves [] verbatim.
            fetchSpy.mockReturnValueOnce(jsonResponse({ data: [] }));
            await expect(getLog('test-campaign')).resolves.toStrictEqual([]);
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('addEntry', () => {
        it('POSTs a textless real producer body with a stamped audit message, original bytes intact', async () => {
            // Exact live-captured roll:attack wire body (see REAL_ATTACK_BODY header).
            const entry = REAL_ATTACK_BODY;
            const stamped = { ...entry, message: 'Goblin attacks ElderPaladin with Scimitar: 15 +4 (+4 to hit) vs AC 19 — HIT' };
            const stored = { id: 'e1', timestamp: 1700000000000, ...stamped };
            fetchSpy.mockReturnValueOnce(jsonResponse({ data: stored }));

            const result = await addEntry('test-campaign', entry);

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const [url, init] = fetchSpy.mock.calls[0];
            expect(url).toBe('/api/campaigns/test-campaign/log');
            expect(init.method).toBe('POST');
            expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
            // Wire body = every original byte + exactly one derived message key;
            // still no client-fabricated id/timestamp.
            expect(JSON.parse(init.body)).toStrictEqual(stamped);
            // The caller's object is never mutated.
            expect(entry).not.toHaveProperty('message');
            expect(result).toStrictEqual(stored);
        });

        it('POSTs an entry that already carries readable text byte-identically (verbatim lane)', async () => {
            const entry = { type: 'note', noteText: 'GM note', characterName: 'Anonymous' };
            const stored = { id: 'e1', timestamp: 1700000000000, ...entry };
            fetchSpy.mockReturnValueOnce(jsonResponse({ data: stored }));

            await addEntry('test-campaign', entry);

            expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/test-campaign/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry)
            });
        });
    });

    it('both wrappers throw a descriptive Error on non-ok without reading the body', async () => {
        const getRes = jsonResponse({ ok: false });
        fetchSpy.mockReturnValueOnce(getRes);
        await expect(getLog('test-campaign')).rejects.toThrow(new Error('Failed to fetch log'));
        expect(getRes.json).not.toHaveBeenCalled();

        const addRes = jsonResponse({ ok: false });
        fetchSpy.mockReturnValueOnce(addRes);
        await expect(addEntry('test-campaign', { type: 'roll' })).rejects.toThrow(new Error('Failed to add log entry'));
        expect(addRes.json).not.toHaveBeenCalled();
    });

    it('URI-encodes campaign names on both routes', async () => {
        fetchSpy.mockReturnValue(jsonResponse({ data: [] }));

        await getLog('test campaign!');
        await addEntry('test campaign!', { type: 'roll' });

        expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/campaigns/test%20campaign!/log');
        expect(fetchSpy).toHaveBeenNthCalledWith(2, '/api/campaigns/test%20campaign!/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{"type":"roll","message":"Roll"}'
        });
    });

    it('propagates fetch rejections untouched, attempting each route exactly once (no retry, no swallow)', async () => {
        const networkError = new Error('Network down');
        fetchSpy.mockRejectedValue(networkError);

        await expect(getLog('test-campaign')).rejects.toBe(networkError);
        await expect(addEntry('test-campaign', { type: 'roll' })).rejects.toBe(networkError);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    // ── stampAuditText — the POST-lane gate companion ─────────────────────────
    describe('stampAuditText', () => {
        it.each([
            ['message', { type: 'roll', message: 'kept verbatim', total: 3 }],
            ['description', { type: 'automation', description: 'Feature fired', characterName: 'X' }],
            ['noteText', { type: 'note', noteText: 'GM note' }],
            ['summary', { type: 'info', summary: 'Summary row' }],
            ['text', { type: 'info', text: 'Maze blocked the attack' }],
        ])('returns an entry carrying %s unchanged (same object identity)', (_field, entry) => {
            expect(stampAuditText(entry)).toBe(entry);
        });

        it('treats empty/whitespace-only canonical fields as textless and stamps a message', () => {
            const stamped = stampAuditText({ type: 'note', message: '   ', noteText: '' });
            expect(stamped.message).toBe('Note');
        });

        it('non-object inputs pass through untouched', () => {
            expect(stampAuditText(null)).toBe(null);
            expect(stampAuditText(undefined)).toBe(undefined);
            expect(stampAuditText('nope')).toBe('nope');
        });

        // Regression pin (the filed bug): every REAL captured producer body gains
        // plain-English audit text while keeping every original byte.
        it.each([
            ['roll:attack', REAL_ATTACK_BODY,
                'Goblin attacks ElderPaladin with Scimitar: 15 +4 (+4 to hit) vs AC 19 — HIT'],
            ['roll:damage', REAL_DAMAGE_BODY,
                'Goblin rolls Scimitar damage: 8 (1d6 + 2) Slashing'],
            ['hp_change (damage, no threshold)', REAL_HP_CHANGE_BODY,
                'ElderPaladin takes 8 damage (216/224 HP)'],
            ['encounter joined (quick-spawn)', REAL_JOIN_BODY,
                'Encounter Joined — Quick spawn: 1x Goblin'],
            ['death_save finality dead', REAL_DEATH_SAVE_DEAD_BODY,
                'EvasiveFighter Has Perished — three death save failures (1 successes, 3 failures)'],
            ['condition applied (reason/note only)', REAL_CONDITION_BODY,
                'Condition Applied for ElderPaladin — Prone'],
        ])('stamps %s with its derived audit sentence, originals byte-intact', (_label, entry, expected) => {
            const stamped = stampAuditText(entry);
            expect(stamped.message).toBe(expected);
            // Only ONE key added; every original field preserved byte-identically.
            expect({ ...stamped }).toEqual({ ...entry, message: expected });
            expect(entry).not.toHaveProperty('message');
        });

        it('voices death thresholds in the renderer family voice', () => {
            expect(stampAuditText({ type: 'hp_change', targetName: 'Goblin', delta: -7, currentHp: 0, maxHp: 7, threshold: 'dead' }).message)
                .toBe('Goblin takes 7 damage (0/7 HP) — Defeated');
            expect(stampAuditText({ type: 'hp_change', targetName: 'EvasiveFighter', delta: -112, currentHp: 0, maxHp: 112, isPlayer: true, isUnconscious: true, threshold: 'dead' }).message)
                .toBe('EvasiveFighter takes 112 damage (0/112 HP) — falls unconscious');
            expect(stampAuditText({ type: 'hp_change', targetName: 'Thorin', delta: -60, currentHp: 40, maxHp: 120, threshold: 'bloodied' }).message)
                .toBe('Thorin takes 60 damage (40/120 HP) — Bloodied');
        });

        it('describes saves, healing and initiative in the badges family voice', () => {
            expect(stampAuditText({ type: 'roll', characterName: 'Thorin', rollType: 'save', saveType: 'dex', name: 'Fireball', total: 15, bonus: 3, saveDc: 13, saveResult: 'success' }).message)
                .toBe('Thorin makes the DEX saving throw against Fireball: 15 +3 vs DC 13 — SUCCESS');
            expect(stampAuditText({ type: 'hp_change', targetName: 'Thorin', delta: 7, currentHp: 30, maxHp: 30, isHealing: true }).message)
                .toBe('Thorin heals 7 HP (30/30 HP)');
            expect(stampAuditText({ type: 'roll', characterName: 'Goblin', rollType: 'initiative', name: 'Initiative', rolls: [4], total: 4, bonus: 0, mode: 'normal' }).message)
                .toBe('Goblin rolls initiative: 4 (+0)');
        });

        it('never yields empty text for a bare typed entry (no producer can be text-rejected again)', () => {
            for (const type of ['buff', 'summons', 'spell_effect', 'music', 'write_rejected']) {
                const stamped = stampAuditText({ type });
                expect(stamped.message.trim().length).toBeGreaterThan(0);
            }
        });
    });
});

// Minimal response stub: the service reads exactly two members — .ok and .json().
// Nothing else (no status/headers) is stubbed: mock-completeness census = 2.
function jsonResponse({ ok = true, data = null } = {}) {
    const json = vi.fn(async () => data);
    return { ok, json };
}
