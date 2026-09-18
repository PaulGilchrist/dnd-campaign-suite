// MA-0367: infernalWoundService — the full lifecycle of the Bearded Devil
// Infernal Wound: failed-save grant (te + ONE rounds:10 clock, RAW skips
// already-wounded targets), the start-of-turn untyped 1d10 bleed tick for PC
// AND monster victims (direct HP write — computeDamageAfterResistances throws
// on empty damageTypes), the heal-closes-the-wound strip + clock cancel, and
// the dc_success:"full" save-reroll cancel.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const addEntryLogs = [];
const storageWrites = [];
const cacheWrites = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`] ?? null,
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
    getAllStoreKeys: () => Object.keys(runtimeStore).map(k => k.split('.')[0]),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (_c, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

const rollExpression = vi.fn((die) => ({ total: die === '1d10' ? 7 : 5, rolls: [7], modifier: 0 }));
vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

let loadedCombatSummary = { creatures: [] };
vi.mock('../../encounters/combatData.js', () => ({
    loadCombatSummary: async () => loadedCombatSummary,
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => loadedCombatSummary,
    setCombatSummaryCache: (cs) => cacheWrites.push(cs),
}));

// Faithful pendingExpirations write (expirationQueue.addExpiration shape) so the
// service's cancelWoundClocks scan runs against a realistic clock entry.
vi.mock('../effects/expirationQueue.js', () => ({
    addExpiration: ({ attackerName, targetName, effects, rounds }) => {
        const storeKey = `${attackerName}.pendingExpirations`;
        const list = runtimeStore[storeKey] || [];
        runtimeStore[storeKey] = [...list, { target: targetName, effects, appliedRound: 1, expiryRounds: rounds }];
    },
}));

vi.mock('../../ui/storage.js', () => ({
    default: { set: (_k, v) => { storageWrites.push(v); } },
}));

import {
    grantInfernalWound,
    applyInfernalWoundBleedTurnStart,
    removeInfernalWoundOnHeal,
    cancelInfernalWoundAfterSaveSuccess,
} from './infernalWoundService.js';

const CAMPAIGN = 'test-campaign';
const DEVIL = 'Bearded Devil 1';

function woundTe(target) {
    return (runtimeStore['campaign.targetEffects'] || []).find(te => te.effect === 'infernal_wound' && te.target === target);
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
    storageWrites.length = 0;
    cacheWrites.length = 0;
    loadedCombatSummary = { creatures: [] };
});

describe('MA-0367 grantInfernalWound', () => {
    it('failed save: registers infernal_wound te + ONE rounds:10 clock + named grant log', async () => {
        const res = await grantInfernalWound({ campaignName: CAMPAIGN, attackerName: DEVIL, targetName: 'Hero', actionName: 'Infernal Glaive', bleedDie: '1d10' });
        expect(res).toEqual({ granted: true, alreadyWounded: false });

        const te = woundTe('Hero');
        expect(te).toMatchObject({ target: 'Hero', effect: 'infernal_wound', source: DEVIL, bleedDie: '1d10', duration: 'until_1_minute' });

        const clocks = runtimeStore[`${DEVIL}.pendingExpirations`] || [];
        expect(clocks).toHaveLength(1);
        expect(clocks[0]).toMatchObject({ target: 'Hero', expiryRounds: 10 });
        expect(clocks[0].effects[0]).toMatchObject({ type: 'remove_target_effect', effectKey: 'infernal_wound', target: 'Hero' });

        const grant = addEntryLogs.find(e => e.automationType === 'infernal_wound_granted');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe('Hero');
        expect(grant.sourceName).toBe(DEVIL);
        expect(grant.description).toMatch(/1d10 Hit Points at the start of each/i);
    });

    it('already-wounded target: RAW inflicts NO second wound, no clock refresh, advisory log only', async () => {
        await grantInfernalWound({ campaignName: CAMPAIGN, attackerName: DEVIL, targetName: 'Hero', actionName: 'Infernal Glaive', bleedDie: '1d10' });
        addEntryLogs.length = 0;
        const res = await grantInfernalWound({ campaignName: CAMPAIGN, attackerName: DEVIL, targetName: 'Hero', actionName: 'Infernal Glaive', bleedDie: '1d10' });
        expect(res).toEqual({ granted: false, alreadyWounded: true });

        expect((runtimeStore['campaign.targetEffects'] || []).filter(te => te.effect === 'infernal_wound' && te.target === 'Hero')).toHaveLength(1);
        expect(runtimeStore[`${DEVIL}.pendingExpirations`]).toHaveLength(1);
        expect(addEntryLogs.some(e => e.automationType === 'infernal_wound_refused')).toBe(true);
        expect(addEntryLogs.some(e => e.automationType === 'infernal_wound_granted')).toBe(false);
    });
});

describe('MA-0367 applyInfernalWoundBleedTurnStart', () => {
    it('PC victim: untyped 1d10 HP loss to runtime currentHitPoints + hp_change log', async () => {
        runtimeStore['Hero.currentHitPoints'] = 30;
        runtimeStore['Hero.hitPoints'] = 50;
        loadedCombatSummary = { creatures: [{ name: 'Hero', type: 'player', currentHp: 30, maxHp: 50 }] };
        await grantInfernalWound({ campaignName: CAMPAIGN, attackerName: DEVIL, targetName: 'Hero', actionName: 'Infernal Glaive', bleedDie: '1d10' });

        await applyInfernalWoundBleedTurnStart('Hero', CAMPAIGN);

        expect(rollExpression).toHaveBeenCalledWith('1d10');
        expect(runtimeStore['Hero.currentHitPoints']).toBe(23);
        const tick = addEntryLogs.find(e => e.type === 'hp_change');
        expect(tick).toMatchObject({ targetName: 'Hero', delta: -7, currentHp: 23, isHealing: false });
        expect(tick.note).toMatch(/Infernal Wound/i);
    });

    it('monster victim: persists currentHp + hit_points.current through the detached cs copy', async () => {
        loadedCombatSummary = { creatures: [{ name: 'Goblin', type: 'monster', currentHp: 20, maxHp: 20, hit_points: { current: 20, max: 20 } }] };
        await grantInfernalWound({ campaignName: CAMPAIGN, attackerName: DEVIL, targetName: 'Goblin', actionName: 'Infernal Glaive', bleedDie: '1d10' });

        await applyInfernalWoundBleedTurnStart('Goblin', CAMPAIGN);

        expect(storageWrites.length).toBe(1);
        const persisted = storageWrites[0].creatures.find(c => c.name === 'Goblin');
        expect(persisted.currentHp).toBe(13);
        expect(persisted.hit_points.current).toBe(13);
        expect(cacheWrites.length).toBe(1);
        expect(addEntryLogs.some(e => e.type === 'hp_change' && e.delta === -7)).toBe(true);
    });

    it('no wound te → zero roll, zero HP change', async () => {
        runtimeStore['Hero.currentHitPoints'] = 30;
        loadedCombatSummary = { creatures: [{ name: 'Hero', type: 'player', currentHp: 30, maxHp: 30 }] };
        await applyInfernalWoundBleedTurnStart('Hero', CAMPAIGN);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(runtimeStore['Hero.currentHitPoints']).toBe(30);
    });
});

describe('MA-0367 close seams', () => {
    it('heal closes the wound: strips te + cancels the 1-minute clock + logs', async () => {
        await grantInfernalWound({ campaignName: CAMPAIGN, attackerName: DEVIL, targetName: 'Hero', actionName: 'Infernal Glaive', bleedDie: '1d10' });
        const closed = await removeInfernalWoundOnHeal('Hero', CAMPAIGN);
        expect(closed).toBe(true);
        expect(woundTe('Hero')).toBeFalsy();
        expect(runtimeStore[`${DEVIL}.pendingExpirations`]).toHaveLength(0);
        expect(addEntryLogs.some(e => e.automationType === 'infernal_wound_closed')).toBe(true);
    });

    it('heal on an unwounded target is a byte-inert no-op', async () => {
        const closed = await removeInfernalWoundOnHeal('Hero', CAMPAIGN);
        expect(closed).toBe(false);
        expect(addEntryLogs.length).toBe(0);
    });

    it('save-reroll success cancels the wound (full attack damage stands)', async () => {
        await grantInfernalWound({ campaignName: CAMPAIGN, attackerName: DEVIL, targetName: 'Hero', actionName: 'Infernal Glaive', bleedDie: '1d10' });
        const cancelled = await cancelInfernalWoundAfterSaveSuccess('Hero', CAMPAIGN);
        expect(cancelled).toBe(true);
        expect(woundTe('Hero')).toBeFalsy();
        expect(runtimeStore[`${DEVIL}.pendingExpirations`]).toHaveLength(0);
    });
});
