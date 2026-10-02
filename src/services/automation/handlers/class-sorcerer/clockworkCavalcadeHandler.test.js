// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    handle,
    consumeUse,
    confirmClockworkCavalcadeHeal,
    confirmClockworkCavalcadeDispel,
    confirmClockworkCavalcadeRepair,
} from './clockworkCavalcadeHandler.js';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('./clockworkCavalcadeDispel.js', () => ({
    dispelSpellsOnTarget: vi.fn(async (targetName) => ({
        target: targetName,
        effects: [],
        buffs: [],
        conditions: [],
    })),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
    getCurrentSorceryPoints: vi.fn(() => 7),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => ({ maxSorceryPoints: 8 })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { dispelSpellsOnTarget } from './clockworkCavalcadeDispel.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import { spendSorceryPoints, getCurrentSorceryPoints } from '../../../../hooks/combat/useMetamagic.js';
import { getClassFeatures } from '../../../character/classFeatures.js';
import { addEntry } from '../../../ui/logService.js';

const CAMPAIGN = 'test-campaign';
const USES_KEY = 'clockworkCavalcadeUses';

function makeAction(overrides = {}) {
    return {
        name: 'Clockwork Cavalcade',
        automation: {
            type: 'clockwork_cavalcade',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        hitPoints: 60,
        resources: { sorcery_points: { current: 7 } },
        ...overrides,
    };
}

function makeCombatSummary(creatures = []) {
    return { creatures };
}

function getUsesCalls() {
    return useRuntimeState.setRuntimeValue.mock.calls.filter(
        (c) => c[1] && typeof c[1] === 'string' && c[1].includes(USES_KEY)
    );
}

describe('clockworkCavalcadeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        getCurrentSorceryPoints.mockReturnValue(7);
        getClassFeatures.mockReturnValue({ maxSorceryPoints: 8 });
        isWithinRange.mockResolvedValue(true);
        getCombatContext.mockResolvedValue(makeCombatSummary([
            { name: 'Ally', type: 'player', currentHp: 20, maxHp: 50 },
            { name: 'Enemy', type: 'npc', currentHp: 40, maxHp: 40 },
        ]));
    });

    describe('handle', () => {
        it('returns a clockworkCavalcade modal with payload', async () => {
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('clockworkCavalcade');
            expect(result.payload).toEqual(expect.objectContaining({
                action: expect.any(Object),
                playerStats: expect.any(Object),
                featureName: 'Clockwork Cavalcade',
                playerName: 'TestSorcerer',
                campaignName: CAMPAIGN,
                maxHeal: 100,
                restoreCost: 7,
                auto: { type: 'clockwork_cavalcade' },
            }));
        });

        it('uses automation-provided maxHeal and restoreCost', async () => {
            const action = makeAction({ automation: { type: 'clockwork_cavalcade', maxHeal: 50, restoreCost: 5 } });
            const result = await handle(action, makePlayerStats(), CAMPAIGN);

            expect(result.payload.maxHeal).toBe(50);
            expect(result.payload.restoreCost).toBe(5);
        });

        it('gathers only creatures within range as targets', async () => {
            isWithinRange.mockImplementation(async (_from, targetName) => targetName === 'Ally');

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(result.payload.creatureTargets).toEqual([
                { name: 'Ally', type: 'player', currentHp: 20, maxHp: 50 },
            ]);
        });

        it('returns a popup when no uses remain and SP are insufficient', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');
            getCurrentSorceryPoints.mockReturnValue(5);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('7 Sorcery Points');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('does not spend SP or consume uses during handle', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(result.type).toBe('modal');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
            expect(getUsesCalls()).toHaveLength(0);
        });
    });

    describe('consumeUse', () => {
        it('decrements uses when a use remains', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('2');

            const result = await consumeUse(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(result).toEqual({ ok: true, spentSP: 0, usesLeft: 1 });
            const calls = getUsesCalls();
            expect(calls).toHaveLength(1);
            expect(calls[0][2]).toBe(1);
        });

        it('spends SP to restore a use when no uses remain', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');

            const result = await consumeUse(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 7, CAMPAIGN, 8);
            expect(result).toEqual({ ok: true, spentSP: 7, usesLeft: 0 });
            const calls = getUsesCalls();
            expect(calls[0][2]).toBe(1);
            expect(calls[1][2]).toBe(0);
        });

        it('logs the SP restore', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');

            await consumeUse(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Clockwork Cavalcade',
            }));
        });

        it('returns not ok when no uses remain and SP are insufficient', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');
            getCurrentSorceryPoints.mockReturnValue(3);

            const result = await consumeUse(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(result.ok).toBe(false);
            expect(result.reason).toContain('7 Sorcery Points');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('falls back to class feature max SP', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');
            getCurrentSorceryPoints.mockReturnValue(null);
            getClassFeatures.mockReturnValue({ maxSorceryPoints: 12 });

            await consumeUse(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(getClassFeatures).toHaveBeenCalledWith(expect.any(Object));
        });
    });

    describe('confirmClockworkCavalcadeHeal', () => {
        it('heals across the distribution and consumes a use', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
                if (key === USES_KEY) return '1';
                if (key === 'currentHitPoints') return 20;
                if (key === 'hitPoints') return 50;
                return null;
            });
            getCombatContext.mockResolvedValue(makeCombatSummary([
                { name: 'Ally', type: 'player', currentHp: 20, maxHp: 50 },
                { name: 'Enemy', type: 'npc', currentHp: 30, maxHp: 40 },
            ]));

            const result = await confirmClockworkCavalcadeHeal(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                { Ally: 30, Enemy: 10 },
                100
            );

            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'Ally', 30, CAMPAIGN);
            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'Enemy', 10, CAMPAIGN);
            expect(getUsesCalls()[0][2]).toBe(0);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored 40 HP');
        });

        it('caps total healing at the pool', async () => {
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === USES_KEY) return '1';
                if (key === 'currentHitPoints') return 1;
                if (key === 'hitPoints') return 100;
                return null;
            });
            getCombatContext.mockResolvedValue(makeCombatSummary([
                { name: 'Ally', type: 'player', currentHp: 1, maxHp: 100 },
                { name: 'Enemy', type: 'npc', currentHp: 1, maxHp: 100 },
            ]));

            await confirmClockworkCavalcadeHeal(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                { Ally: 80, Enemy: 80 },
                100
            );

            const calls = applyHealingToTarget.mock.calls;
            const total = calls.reduce((sum, c) => sum + c[2], 0);
            expect(total).toBe(100);
        });

        it('returns a not-consumed popup when no uses and insufficient SP', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');
            getCurrentSorceryPoints.mockReturnValue(3);

            const result = await confirmClockworkCavalcadeHeal(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                { Ally: 10 },
                100
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('logs an ability_use entry', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('1');

            await confirmClockworkCavalcadeHeal(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                { Ally: 25 },
                100
            );

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Clockwork Cavalcade',
            }));
        });

        it('heals player targets from runtime HP despite combatSummary stub maxHp:1 (CLA-055)', async () => {
            getCombatContext.mockResolvedValue(makeCombatSummary([
                { name: 'AasimarTest', type: 'player', currentHp: 1, maxHp: 1 },
                { name: 'FeyRanger', type: 'player', currentHp: 1, maxHp: 1 },
            ]));
            useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
                if (key === USES_KEY) return '1';
                if (name === 'AasimarTest' && key === 'currentHitPoints') return 80;
                if (name === 'AasimarTest' && key === 'hitPoints') return 143;
                if (name === 'FeyRanger' && key === 'currentHitPoints') return 40;
                if (name === 'FeyRanger' && key === 'hitPoints') return 89;
                return null;
            });

            const result = await confirmClockworkCavalcadeHeal(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                { AasimarTest: 63, FeyRanger: 37 },
                100
            );

            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'AasimarTest', 63, CAMPAIGN);
            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'FeyRanger', 37, CAMPAIGN);
            const hpLogs = addEntry.mock.calls.filter(c => c[1].type === 'hp_change');
            expect(hpLogs.map(c => c[1]).find(l => l.targetName === 'AasimarTest')).toEqual(expect.objectContaining({
                delta: 63, currentHp: 143, maxHp: 143, isHealing: true,
            }));
            expect(hpLogs.map(c => c[1]).find(l => l.targetName === 'FeyRanger')).toEqual(expect.objectContaining({
                delta: 37, currentHp: 77, maxHp: 89, isHealing: true,
            }));
            expect(result.payload.description).toContain('restored 100 HP');
            expect(getUsesCalls()[0][2]).toBe(0);
        });

        it('clamps player healing at runtime max HP', async () => {
            getCombatContext.mockResolvedValue(makeCombatSummary([
                { name: 'AasimarTest', type: 'player', currentHp: 1, maxHp: 1 },
            ]));
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === USES_KEY) return '1';
                if (key === 'currentHitPoints') return 140;
                if (key === 'hitPoints') return 143;
                return null;
            });

            await confirmClockworkCavalcadeHeal(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                { AasimarTest: 63 },
                100
            );

            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'AasimarTest', 3, CAMPAIGN);
            const hpLog = addEntry.mock.calls.map(c => c[1]).find(l => l.type === 'hp_change');
            expect(hpLog.delta).toBe(3);
            expect(hpLog.currentHp).toBe(143);
        });

        it('spends pool by actual healed amount, not allocated amount', async () => {
            getCombatContext.mockResolvedValue(makeCombatSummary([
                { name: 'Ally', type: 'player', currentHp: 1, maxHp: 1 },
                { name: 'Enemy', type: 'npc', currentHp: 30, maxHp: 40 },
            ]));
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === USES_KEY) return '1';
                if (key === 'currentHitPoints') return 133;
                if (key === 'hitPoints') return 143;
                return null;
            });

            const result = await confirmClockworkCavalcadeHeal(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                { Ally: 50, Enemy: 50 },
                100
            );

            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'Ally', 10, CAMPAIGN);
            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'Enemy', 10, CAMPAIGN);
            expect(result.payload.description).toContain('restored 20 HP');
        });

        it('keeps npc healing resolved from combatSummary (unchanged path)', async () => {
            getCombatContext.mockResolvedValue(makeCombatSummary([
                { name: 'Bandit 1', type: 'npc', currentHp: 4, maxHp: 11 },
            ]));
            useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
                if (key === USES_KEY) return '1';
                return null;
            });

            await confirmClockworkCavalcadeHeal(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                { 'Bandit 1': 7 },
                100
            );

            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'Bandit 1', 7, CAMPAIGN);
            const hpLog = addEntry.mock.calls.map(c => c[1]).find(l => l.type === 'hp_change');
            expect(hpLog.delta).toBe(7);
            expect(hpLog.maxHp).toBe(11);
        });
    });

    describe('confirmClockworkCavalcadeDispel', () => {
        it('dispels spells on each selected target', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('1');

            const result = await confirmClockworkCavalcadeDispel(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                ['Ally', 'Enemy']
            );

            expect(dispelSpellsOnTarget).toHaveBeenCalledWith('Ally', CAMPAIGN);
            expect(dispelSpellsOnTarget).toHaveBeenCalledWith('Enemy', CAMPAIGN);
            expect(getUsesCalls()[0][2]).toBe(0);
            expect(result.type).toBe('popup');
        });

        it('reports how many effects were removed', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('1');
            dispelSpellsOnTarget.mockResolvedValue({
                target: 'Ally',
                effects: [{ effect: 'bless' }],
                buffs: [{ name: 'Mage Armor' }],
                conditions: ['paralyzed'],
            });

            const result = await confirmClockworkCavalcadeDispel(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                ['Ally']
            );

            expect(result.payload.description).toContain('ended 3 spell effect');
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'condition',
                action: 'removed',
                condition: 'paralyzed',
            }));
        });

        it('logs removed conditions for each target', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('1');
            dispelSpellsOnTarget.mockResolvedValue({
                target: 'Ally',
                effects: [],
                buffs: [],
                conditions: [{ key: 'restrained' }],
            });

            await confirmClockworkCavalcadeDispel(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                ['Ally']
            );

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                condition: 'restrained',
            }));
        });

        it('returns a not-consumed popup when no uses and insufficient SP', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');
            getCurrentSorceryPoints.mockReturnValue(2);

            const result = await confirmClockworkCavalcadeDispel(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                ['Ally']
            );

            expect(result.type).toBe('popup');
            expect(dispelSpellsOnTarget).not.toHaveBeenCalled();
        });
    });

    describe('confirmClockworkCavalcadeRepair', () => {
        it('consumes a use and logs the repair', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('1');

            const result = await confirmClockworkCavalcadeRepair(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(getUsesCalls()[0][2]).toBe(0);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Clockwork Cavalcade',
            }));
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Repair');
        });

        it('returns a not-consumed popup when no uses and insufficient SP', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');
            getCurrentSorceryPoints.mockReturnValue(0);

            const result = await confirmClockworkCavalcadeRepair(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });
});
