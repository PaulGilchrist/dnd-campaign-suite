// MA-1842: constrict_grapple turn-start tick consumer — whirlwindService /
// infernalWoundService seam twin. te-keyed + Grappled-gated recurring
// start-of-turn HP loss at the ACTIVE creature's turn start; release choke
// points (grapple cleared / grappler dead) strip the te with a log and pay
// zero damage.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ rolls: [3, 5, 4, 6], total: 18 })),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(async () => null),
    setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../ui/storage.js', () => ({ default: { set: vi.fn(), get: vi.fn() } }));

import { rollExpression } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { loadCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import { applyConstrictGrappleTurnStart, CONSTRICT_GRAPPLE_TE } from './constrictGrappleService.js';

const CAMPAIGN = 'test-campaign';

const TE = {
    effect: CONSTRICT_GRAPPLE_TE,
    target: 'ElderPaladin',
    source: 'Apep 1',
    die: '4d8',
    damageType: 'Bludgeoning',
    escapeDc: 26,
    actionName: 'Constrict',
};

function store(overrides = {}) {
    getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') return overrides.targetEffects ?? [TE];
        if (key === 'ElderPaladin' && prop === 'activeConditions') return overrides.activeConditions ?? ['grappled'];
        if (key === 'ElderPaladin' && prop === 'currentHitPoints') return overrides.currentHitPoints ?? 175;
        if (key === 'ElderPaladin' && prop === 'hitPoints') return 224;
        return null;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ rolls: [3, 5, 4, 6], total: 18 });
});

describe('MA-1842 constrict_grapple turn-start tick', () => {
    it('is inert (no dice rolled) without the te', async () => {
        store({ targetEffects: [] });
        await applyConstrictGrappleTurnStart('ElderPaladin', CAMPAIGN);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('PC victim: rolls 4d8 and pays it through runtime currentHitPoints with roll + hp_change + tick logs', async () => {
        store();
        loadCombatSummary.mockResolvedValue({
            creatures: [
                { name: 'ElderPaladin', type: 'player', currentHp: 175, maxHp: 224 },
                { name: 'Apep 1', type: 'npc', currentHp: 624, maxHp: 624 },
            ],
        });
        await applyConstrictGrappleTurnStart('ElderPaladin', CAMPAIGN);

        expect(rollExpression).toHaveBeenCalledWith('4d8');
        expect(setRuntimeValue).toHaveBeenCalledWith('ElderPaladin', 'currentHitPoints', 157, CAMPAIGN);

        const roll = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'roll');
        expect(roll).toMatchObject({ rollType: 'damage', formula: '4d8', total: 18, damageType: 'Bludgeoning', targetName: 'ElderPaladin' });
        const hp = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'hp_change');
        expect(hp).toMatchObject({ targetName: 'ElderPaladin', delta: -18, currentHp: 157, maxHp: 224, isHealing: false });
        expect(addEntry.mock.calls.map(c => c[1])).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'automation', automationType: 'constrict_grapple_tick', sourceName: 'Apep 1' }),
        ]));
    });

    it('monster victim: pays through the detached combatSummary copy (cs HP truth)', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return [{ ...TE, target: 'Bandit 1' }];
            if (key === 'Bandit 1' && prop === 'activeConditions') return ['grappled'];
            return null;
        });
        loadCombatSummary.mockResolvedValue({
            creatures: [
                { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11 },
                { name: 'Apep 1', type: 'npc', currentHp: 624, maxHp: 624 },
            ],
        });
        await applyConstrictGrappleTurnStart('Bandit 1', CAMPAIGN);
        expect(rollExpression).toHaveBeenCalledWith('4d8');
        const cs = setCombatSummaryCache.mock.calls[0][0];
        expect(cs.creatures.find(c => c.name === 'Bandit 1').currentHp).toBe(0);
    });

    it('escaped / cleared grapple: te stripped, release logged, zero damage', async () => {
        store({ activeConditions: [] });
        await applyConstrictGrappleTurnStart('ElderPaladin', CAMPAIGN);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], CAMPAIGN, true);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ automationType: 'constrict_grapple_released' }));
    });

    it('dead grappler: te stripped with release log, zero damage', async () => {
        store();
        loadCombatSummary.mockResolvedValue({
            creatures: [
                { name: 'ElderPaladin', type: 'player', currentHp: 175, maxHp: 224 },
                { name: 'Apep 1', type: 'npc', currentHp: 0, maxHp: 624 },
            ],
        });
        await applyConstrictGrappleTurnStart('ElderPaladin', CAMPAIGN);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], CAMPAIGN, true);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({ automationType: 'constrict_grapple_released' }));
    });

    it('dead victim: no tick, no negative HP', async () => {
        store({ currentHitPoints: 0 });
        loadCombatSummary.mockResolvedValue({
            creatures: [
                { name: 'ElderPaladin', type: 'player', currentHp: 0, maxHp: 224 },
                { name: 'Apep 1', type: 'npc', currentHp: 624, maxHp: 624 },
            ],
        });
        await applyConstrictGrappleTurnStart('ElderPaladin', CAMPAIGN);
        expect(setRuntimeValue).not.toHaveBeenCalledWith('ElderPaladin', 'currentHitPoints', expect.anything(), CAMPAIGN);
    });

    it('does nothing without an active creature', async () => {
        store();
        await applyConstrictGrappleTurnStart(null, CAMPAIGN);
        expect(rollExpression).not.toHaveBeenCalled();
    });
});
