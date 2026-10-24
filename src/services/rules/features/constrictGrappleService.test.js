// @maintained-by-ai
// MA-1842: constrict_grapple turn-start tick consumer — whirlwindService /
// infernalWoundService seam twin. te-keyed + Grappled-gated recurring
// start-of-turn HP loss at the ACTIVE creature's turn start; release choke
// points (grapple cleared / grappler dead) strip the te with a log and pay
// zero damage. SOLE owner of the REAL applyConstrictGrappleTurnStart body
// (turnStartEffects.constrict-grapple.test.js stubs this service and owns
// only the pre-guard dispatch seam; arming/DC-save prose belongs to the
// handlePlainDamage producer + grapple lanes — cited, not re-run here).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));
vi.mock('../../encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../ui/storage.js', () => ({ default: { set: vi.fn(), get: vi.fn() } }));

import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { loadCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import storage from '../../ui/storage.js';
import { applyConstrictGrappleTurnStart, CONSTRICT_GRAPPLE_TE } from './constrictGrappleService.js';

const CAMPAIGN = 'test-campaign';
const VICTIM = 'ElderPaladin';
const GRAPPLER = 'Apep 1';

// Disk canon (monsters.json Apep row): grapple_ongoing_damage
// {dice:'4d8', damage_type:'Bludgeoning'}, escape_dc 26 — the MA-0010
// producer stamps these verbatim onto the constrict_grapple te.
const TE = {
    effect: CONSTRICT_GRAPPLE_TE,
    target: VICTIM,
    source: GRAPPLER,
    die: '4d8',
    damageType: 'Bludgeoning',
    escapeDc: 26,
    actionName: 'Constrict',
};

const pcCombatSummary = () => ({
    creatures: [
        { name: VICTIM, type: 'player', currentHp: 175, maxHp: 224 },
        { name: GRAPPLER, type: 'npc', currentHp: 624, maxHp: 624 },
    ],
});

function store({
    target = VICTIM,
    targetEffects = [TE],
    activeConditions = ['grappled'],
    currentHitPoints = 175,
} = {}) {
    getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') return targetEffects;
        if (key === target && prop === 'activeConditions') return activeConditions;
        if (key === target && prop === 'currentHitPoints') return currentHitPoints;
        if (key === target && prop === 'hitPoints') return 224;
        return null;
    });
}

const loggedEntries = () => addEntry.mock.calls.map(c => c[1]);

beforeEach(() => {
    vi.resetAllMocks();
    // explicit re-seed of every stub the REAL body consumes — never real dice
    rollExpression.mockReturnValue({ rolls: [3, 5, 4, 6], total: 18 });
    getRuntimeValue.mockReturnValue(null);
    setRuntimeValue.mockResolvedValue(undefined);
    addEntry.mockResolvedValue(undefined);
    loadCombatSummary.mockResolvedValue(null);
    setCombatSummaryCache.mockReturnValue(undefined);
});

describe('MA-1842 constrict_grapple turn-start tick', () => {
    it('inert without a matching constrict_grapple te on the active creature (null / absent / foreign target)', async () => {
        await applyConstrictGrappleTurnStart(null, CAMPAIGN);
        store({ targetEffects: [] });
        await applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN);
        store({ targetEffects: [{ ...TE, target: 'Bandit 1' }, { effect: 'blessing', target: VICTIM, source: GRAPPLER }] });
        await applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN);

        expect(rollExpression).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(setCombatSummaryCache).not.toHaveBeenCalled();
    });

    it('PC victim: rolls te.die, pays through runtime currentHitPoints, logs roll + hp_change + tick in order', async () => {
        store();
        loadCombatSummary.mockResolvedValue(pcCombatSummary());
        await applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN);

        expect(rollExpression).toHaveBeenCalledWith('4d8');
        expect(setRuntimeValue).toHaveBeenCalledWith(VICTIM, 'currentHitPoints', 157, CAMPAIGN);
        expect(setCombatSummaryCache).not.toHaveBeenCalled();

        const entries = loggedEntries();
        expect(addEntry.mock.calls.every(c => c[0] === CAMPAIGN)).toBe(true);
        expect(entries.map(e => e.type)).toEqual(['roll', 'hp_change', 'automation']);
        expect(entries[0]).toMatchObject({
            rollType: 'damage', characterName: GRAPPLER, name: 'Constrict (ongoing grapple)',
            formula: '4d8', rolls: [3, 5, 4, 6], total: 18, targetName: VICTIM, damageType: 'Bludgeoning',
        });
        expect(entries[1]).toMatchObject({
            targetName: VICTIM, delta: -18, currentHp: 157, maxHp: 224, isHealing: false, isUnconscious: false,
            damageBreakdown: [{ damageType: 'Bludgeoning', amount: 18, resisted: false }],
            // escapeDc is honest forwarder copy — the DC/save verdict is owned by grapple lanes
            note: expect.stringContaining('escape DC 26'),
        });
        expect(entries[2]).toMatchObject({
            automationType: 'constrict_grapple_tick', characterName: VICTIM, sourceName: GRAPPLER, abilityName: 'Constrict',
        });
    });

    it('monster victim: pays through the detached combatSummary copy (cs HP truth), never runtime HP', async () => {
        store({ target: 'Bandit 1', targetEffects: [{ ...TE, target: 'Bandit 1' }] });
        const csObj = {
            creatures: [
                { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, hit_points: { current: 11 } },
                { name: GRAPPLER, type: 'npc', currentHp: 624, maxHp: 624 },
            ],
        };
        loadCombatSummary.mockResolvedValue(csObj);
        const dispatch = vi.spyOn(window, 'dispatchEvent');
        try {
            await applyConstrictGrappleTurnStart('Bandit 1', CAMPAIGN);

            expect(rollExpression).toHaveBeenCalledWith('4d8');
            expect(setRuntimeValue.mock.calls.filter(c => c[0] === 'Bandit 1')).toEqual([]);

            const cs = setCombatSummaryCache.mock.calls[0][0];
            const bandit = cs.creatures.find(c => c.name === 'Bandit 1');
            expect(bandit.currentHp).toBe(0);            // 11 - 18 clamped at 0
            expect(bandit.hit_points.current).toBe(0);   // legacy hit_points mirror kept in sync
            expect(cs).not.toBe(csObj);                   // detached copy — caller's object never mutated
            expect(csObj.creatures[0].currentHp).toBe(11);
            expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, CAMPAIGN);
            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));

            const hp = loggedEntries().find(e => e.type === 'hp_change');
            expect(hp).toMatchObject({ targetName: 'Bandit 1', delta: -18, currentHp: 0, maxHp: 11, isUnconscious: true });
        } finally {
            dispatch.mockRestore();
        }
    });

    it('escaped / cleared grapple: strips ONLY this victim\'s te (foreign tes survive), logs release, zero damage', async () => {
        const foreignConstrict = { ...TE, target: 'Bandit 1' };
        const blessing = { effect: 'blessing', target: VICTIM, source: 'Someone' };
        store({ targetEffects: [TE, foreignConstrict, blessing], activeConditions: [] });
        await applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN);

        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [foreignConstrict, blessing], CAMPAIGN, true);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledTimes(1);
        const release = loggedEntries()[0];
        expect(release).toMatchObject({
            type: 'automation', automationType: 'constrict_grapple_released',
            characterName: VICTIM, sourceName: GRAPPLER, abilityName: 'Constrict',
        });
        expect(release.description).toContain('Grappled condition is no longer standing');
    });

    it('grappler gate: dead grappler releases with zero damage; unlocatable grappler ticks leniently', async () => {
        store();
        loadCombatSummary
            .mockResolvedValueOnce({ creatures: [{ name: VICTIM, type: 'player', currentHp: 175, maxHp: 224 }, { name: GRAPPLER, type: 'npc', currentHp: 0, maxHp: 624 }] })
            .mockResolvedValueOnce({ creatures: [{ name: VICTIM, type: 'player', currentHp: 175, maxHp: 224 }] });

        await applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN); // grappler dead → release
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], CAMPAIGN, true);
        const relDescriptions = loggedEntries().filter(e => e.automationType === 'constrict_grapple_released').map(e => e.description);
        expect(relDescriptions).toHaveLength(1);
        expect(relDescriptions[0]).toContain(`${GRAPPLER} has died`);

        await applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN); // grappler absent → lenient, tick pays
        expect(rollExpression).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith(VICTIM, 'currentHitPoints', 157, CAMPAIGN);
        expect(loggedEntries().filter(e => e.automationType === 'constrict_grapple_released')).toHaveLength(1);
    });

    it('silent when combat context is missing (no cs / victim not in cs): te survives, dice untouched', async () => {
        store(); // loadCombatSummary default-resolves null from beforeEach
        await applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN);
        loadCombatSummary.mockResolvedValueOnce({ creatures: [{ name: GRAPPLER, type: 'npc', currentHp: 624, maxHp: 624 }] });
        await applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN);

        expect(rollExpression).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled(); // marker survives — no strip, no writes
        expect(setCombatSummaryCache).not.toHaveBeenCalled();
    });

    it('dead victim: pays nothing — no roll burn, no HP write, no cs rewrite, no logs', async () => {
        store({ currentHitPoints: 0 });
        loadCombatSummary.mockResolvedValue({
            creatures: [
                { name: VICTIM, type: 'player', currentHp: 0, maxHp: 224 },
                { name: GRAPPLER, type: 'npc', currentHp: 624, maxHp: 624 },
            ],
        });
        await applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN);

        expect(rollExpression).not.toHaveBeenCalled(); // fix#363 #1350: guard precedes roll — dead victim never burns a die
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(setCombatSummaryCache).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('zero-total roll pays nothing (dice rolled, no HP write, no logs)', async () => {
        store();
        loadCombatSummary.mockResolvedValue(pcCombatSummary());
        rollExpression.mockReturnValueOnce({ rolls: [], total: 0 }).mockReturnValueOnce(null);
        await applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN);
        await applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN);

        expect(rollExpression).toHaveBeenCalledTimes(2);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('log failures never block the HP payment — each swallowed with a prefixed console.error', async () => {
        store();
        loadCombatSummary.mockResolvedValue(pcCombatSummary());
        addEntry.mockRejectedValue(new Error('log down'));
        const err = vi.spyOn(console, 'error').mockImplementation(() => { });
        try {
            await expect(applyConstrictGrappleTurnStart(VICTIM, CAMPAIGN)).resolves.toBeUndefined();
            expect(setRuntimeValue).toHaveBeenCalledWith(VICTIM, 'currentHitPoints', 157, CAMPAIGN);
            expect(err.mock.calls.map(c => c[0])).toEqual(expect.arrayContaining([
                '[constrictGrappleService:tick-roll]', '[constrictGrappleService:tick-hp]', '[constrictGrappleService:tick-log]',
            ]));
        } finally {
            err.mockRestore();
        }
    });
});
