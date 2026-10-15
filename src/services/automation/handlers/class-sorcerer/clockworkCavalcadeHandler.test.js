// @maintained-by-ai — deterministic uses-ledger / heal-pool / popup-composition contract of
// clockworkCavalcadeHandler with every collaborator mocked; popup strings are full-string
// own-composition pins. Dispelling internals are owned by clockworkCavalcadeDispel.test.js
// (this file pins delegation only). Consumer modal-wiring lives in useCharActionsModalHandlers.*.
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
    isWithinRange: vi.fn(async () => true),
}));

vi.mock('./clockworkCavalcadeDispel.js', () => ({
    dispelSpellsOnTarget: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

// Mocked metamagic — the real sorcery-point fallback lives in useMetamagic,
// not here; this file pins the 4-arg spend call once (see consumeUse).
vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
    getCurrentSorceryPoints: vi.fn(),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
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
        (c) => c[1] === USES_KEY
    );
}

function abilityUseLog() {
    return addEntry.mock.calls.map(c => c[1]).find(l => l.type === 'ability_use');
}

function hpChangeLogs() {
    return addEntry.mock.calls.map(c => c[1]).filter(l => l.type === 'hp_change');
}

function conditionRemovalLogs() {
    return addEntry.mock.calls.map(c => c[1]).filter(l => l.type === 'condition');
}

describe('clockworkCavalcadeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        getCurrentSorceryPoints.mockReturnValue(7);
        getClassFeatures.mockReturnValue({ maxSorceryPoints: 8 });
        isWithinRange.mockResolvedValue(true);
        dispelSpellsOnTarget.mockImplementation(async (targetName) => ({
            target: targetName,
            effects: [],
            buffs: [],
            conditions: [],
        }));
        getCombatContext.mockResolvedValue(makeCombatSummary([
            { name: 'Ally', type: 'player', currentHp: 20, maxHp: 50 },
            { name: 'Enemy', type: 'npc', currentHp: 40, maxHp: 40 },
        ]));
    });

    describe('handle', () => {
        it('returns a clockworkCavalcade modal with default maxHeal and restoreCost', async () => {
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('clockworkCavalcade');
            expect(result.payload).toEqual(expect.objectContaining({
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
            expect(result.payload.description).toBe(
                'Clockwork Cavalcade has no uses remaining (recharges on a Long Rest). ' +
                'You need 7 Sorcery Points to restore it, but you only have 5.'
            );
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('does not spend SP or touch uses when reopening at 0 uses with sufficient SP', async () => {
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
            expect(calls[0]).toEqual(['TestSorcerer', USES_KEY, 1, CAMPAIGN]);
        });

        it('spends SP to restore a use when none remain, writing 1 then consuming to 0', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');

            const result = await consumeUse(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 7, CAMPAIGN, 8);
            expect(result).toEqual({ ok: true, spentSP: 7, usesLeft: 0 });
            const calls = getUsesCalls();
            expect(calls).toEqual([
                ['TestSorcerer', USES_KEY, 1, CAMPAIGN],
                ['TestSorcerer', USES_KEY, 0, CAMPAIGN],
            ]);
            expect(abilityUseLog()).toEqual(expect.objectContaining({
                characterName: 'TestSorcerer',
                abilityName: 'Clockwork Cavalcade',
                description: 'TestSorcerer restored Clockwork Cavalcade by spending 7 Sorcery Points.',
            }));
        });

        it('returns not ok when no uses remain and SP are insufficient', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');
            getCurrentSorceryPoints.mockReturnValue(3);

            const result = await consumeUse(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(result).toEqual({
                ok: false,
                reason: 'Clockwork Cavalcade has no uses remaining. You need 7 Sorcery Points to restore it, but you only have 3.',
            });
            expect(spendSorceryPoints).not.toHaveBeenCalled();
            expect(getUsesCalls()).toHaveLength(0);
        });
    });

    describe('confirmClockworkCavalcadeHeal', () => {
        it('heals across the distribution, consumes a use, logs both lanes and reports totals', async () => {
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
            expect(getUsesCalls()).toEqual([['TestSorcerer', USES_KEY, 0, CAMPAIGN]]);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Clockwork Cavalcade (Heal) restored 40 HP across 2 creature(s) in the Cube: Ally (+30 HP), Enemy (+10 HP).'
            );
            expect(abilityUseLog()).toEqual(expect.objectContaining({
                characterName: 'TestSorcerer',
                abilityName: 'Clockwork Cavalcade',
                description: 'TestSorcerer used Clockwork Cavalcade (Heal), restoring 40 HP across 2 creature(s): Ally (+30 HP), Enemy (+10 HP).',
            }));
            // Player maxHp comes from runtime (50), NPC maxHp from combatSummary (40).
            const allyLog = hpChangeLogs().find(l => l.targetName === 'Ally');
            expect(allyLog).toEqual(expect.objectContaining({ delta: 30, currentHp: 50, maxHp: 50, isHealing: true }));
            const enemyLog = hpChangeLogs().find(l => l.targetName === 'Enemy');
            expect(enemyLog).toEqual(expect.objectContaining({ delta: 10, currentHp: 40, maxHp: 40, isHealing: true }));
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

            const total = applyHealingToTarget.mock.calls.reduce((sum, c) => sum + c[2], 0);
            expect(total).toBe(100);
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
            expect(result.payload.description).toBe(
                'Clockwork Cavalcade (Heal) restored 20 HP across 2 creature(s) in the Cube: Ally (+10 HP), Enemy (+10 HP).'
            );
        });

        it('returns a not-consumed popup without healing anyone when no uses and insufficient SP', async () => {
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
            expect(result.payload.description).toBe(
                'Clockwork Cavalcade has no uses remaining. You need 7 Sorcery Points to restore it, but you only have 3.'
            );
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(getUsesCalls()).toHaveLength(0);
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
            const aasimarLog = hpChangeLogs().find(l => l.targetName === 'AasimarTest');
            expect(aasimarLog).toEqual(expect.objectContaining({
                delta: 63, currentHp: 143, maxHp: 143, isHealing: true,
            }));
            const rangerLog = hpChangeLogs().find(l => l.targetName === 'FeyRanger');
            expect(rangerLog).toEqual(expect.objectContaining({
                delta: 37, currentHp: 77, maxHp: 89, isHealing: true,
            }));
            expect(result.payload.description).toBe(
                'Clockwork Cavalcade (Heal) restored 100 HP across 2 creature(s) in the Cube: AasimarTest (+63 HP), FeyRanger (+37 HP).'
            );
            expect(getUsesCalls()).toEqual([['TestSorcerer', USES_KEY, 0, CAMPAIGN]]);
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
            const hpLog = hpChangeLogs().find(l => l.targetName === 'AasimarTest');
            expect(hpLog).toEqual(expect.objectContaining({ delta: 3, currentHp: 143, maxHp: 143 }));
        });
    });

    describe('confirmClockworkCavalcadeDispel', () => {
        it('dispels spells on each selected target and consumes a use', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('1');

            const result = await confirmClockworkCavalcadeDispel(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                ['Ally', 'Enemy']
            );

            expect(dispelSpellsOnTarget).toHaveBeenCalledWith('Ally', CAMPAIGN);
            expect(dispelSpellsOnTarget).toHaveBeenCalledWith('Enemy', CAMPAIGN);
            expect(getUsesCalls()).toEqual([['TestSorcerer', USES_KEY, 0, CAMPAIGN]]);
            expect(result.type).toBe('popup');
        });

        it('counts every removed effect and logs each condition entry (string and object)', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('1');
            dispelSpellsOnTarget.mockResolvedValueOnce({
                target: 'Ally',
                effects: [{ effect: 'bless' }],
                buffs: [{ name: 'Mage Armor' }],
                conditions: ['paralyzed', { key: 'restrained' }],
            });

            const result = await confirmClockworkCavalcadeDispel(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                ['Ally']
            );

            expect(result.payload.description).toBe(
                'Clockwork Cavalcade (Dispel) ended 4 spell effect(s) of level 6 or lower on 1 creature(s): ' +
                'Ally: 1 spell effect(s), 1 buff(s), 2 condition(s).'
            );
            expect(abilityUseLog()).toEqual(expect.objectContaining({
                characterName: 'TestSorcerer',
                abilityName: 'Clockwork Cavalcade',
                description: 'TestSorcerer used Clockwork Cavalcade (Dispel) on 1 creature(s), ending 4 spell effect(s) of level 6 or lower.',
            }));
            expect(conditionRemovalLogs().map(l => l.condition)).toEqual(['paralyzed', 'restrained']);
            for (const log of conditionRemovalLogs()) {
                expect(log).toEqual(expect.objectContaining({
                    type: 'condition',
                    action: 'removed',
                    characterName: 'Ally',
                    reason: 'Clockwork Cavalcade (Dispel)',
                }));
            }
        });

        it('returns a not-consumed popup without dispelling when no uses and insufficient SP', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');
            getCurrentSorceryPoints.mockReturnValue(2);

            const result = await confirmClockworkCavalcadeDispel(
                makeAction(),
                makePlayerStats(),
                CAMPAIGN,
                ['Ally']
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Clockwork Cavalcade has no uses remaining. You need 7 Sorcery Points to restore it, but you only have 2.'
            );
            expect(dispelSpellsOnTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('confirmClockworkCavalcadeRepair', () => {
        it('consumes a use and logs the repair', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('1');

            const result = await confirmClockworkCavalcadeRepair(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(getUsesCalls()).toEqual([['TestSorcerer', USES_KEY, 0, CAMPAIGN]]);
            expect(abilityUseLog()).toEqual(expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Clockwork Cavalcade',
                description: 'TestSorcerer used Clockwork Cavalcade (Repair). Damaged objects within the 30-foot Cube are repaired instantly.',
            }));
            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Clockwork Cavalcade (Repair) — damaged objects in the 30-foot Cube are repaired instantly.'
            );
        });

        it('returns a not-consumed popup without logging or spending when no uses and insufficient SP', async () => {
            useRuntimeState.getRuntimeValue.mockReturnValue('0');
            getCurrentSorceryPoints.mockReturnValue(0);

            const result = await confirmClockworkCavalcadeRepair(makeAction(), makePlayerStats(), CAMPAIGN);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                'Clockwork Cavalcade has no uses remaining. You need 7 Sorcery Points to restore it, but you only have 0.'
            );
            expect(addEntry).not.toHaveBeenCalled();
            expect(spendSorceryPoints).not.toHaveBeenCalled();
            expect(getUsesCalls()).toHaveLength(0);
        });
    });
});
