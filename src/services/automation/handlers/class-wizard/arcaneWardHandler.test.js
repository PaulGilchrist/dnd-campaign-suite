// @maintained-by-ai
// Lane: handle() seam ONLY — not-active guard (distinct-function twin of the
// onArcaneWardBonusActionRestore not-active guard: keep both), arcane_ward_bonus_action →
// 'arcaneWardRestore' modal routing, and the full projected_ward absorption lane
// (no-combat / no-target / out-of-range / no-damage guards, absorption math,
// damage-record consumption, target-HP rollback-skip).
// Routing pins confirm the orphan flag: automation/index.js imports `handle` twice
// (as handleArcaneWard AND handleArcaneWardBonusActionRestore) and maps all three keys
// arcane_ward / projected_ward / arcane_ward_bonus_action to that SAME handle() — so the
// exported onArcaneWardBonusActionRestore is dead code in production; only its dedicated
// test file imports it.
// Sibling lanes (do not duplicate here):
//   arcaneWardBonusActionRestore.test.js — onArcaneWardBonusActionRestore lowest-slot
//                                            auto-select + slot consumption.
//   arcaneWardRestore.test.js            — onArcaneWardRestore explicit-slot arithmetic +
//                                            rethrows-on-addEntry-reject.
//   arcaneWardLifecycle.test.js          — destroy / levelUp / onAbjurationSpellCast.
import {
    handle,
} from './arcaneWardHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

const campaignName = 'test-campaign';

function makeWizardStats(name, level, intBonus) {
    return {
        name,
        rules: '2024',
        level,
        abilities: [{ name: 'Intelligence', bonus: intBonus }],
    };
}

function setMocks(runtimeImpl, combatSummary = null, target = null) {
    getRuntimeValue.mockImplementation(runtimeImpl);
    if (combatSummary) getCombatSummary.mockReturnValue(combatSummary);
    if (target !== null) getTargetFromAttacker.mockReturnValue(target);
}

function wardRuntime(targetName, wardHp, wardMax, projectedDamage, targetCurrentHp, targetMaxHp) {
    return (player, key) => {
        if (key === 'arcaneWardActive') return true;
        if (key === 'arcaneWardHp') return wardHp;
        if (key === 'arcaneWardMax') return wardMax;
        if (player === targetName && key === 'projectedWardDamage') return projectedDamage;
        if (player === targetName && key === 'currentHitPoints') return targetCurrentHp;
        if (player === targetName && key === 'maxHitPoints') return targetMaxHp;
        return undefined;
    };
}

function combatContext(wizardName, targetName) {
    return {
        creatures: [
            { name: wizardName, targetName },
            { name: targetName },
        ],
        activeCreatureName: wizardName,
    };
}

function projectedWardAction(name = 'Arcane Ward') {
    return { name, automation: { type: 'projected_ward' } };
}

describe('arcaneWardHandler handle()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ward not active', () => {
        it('returns info popup directing user to cast an Abjuration spell', async () => {
            setMocks((player, key) => {
                if (key === 'arcaneWardActive') return false;
                return undefined;
            });

            const result = await handle(
                { name: 'Arcane Ward', description: 'Create a magical ward...' },
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Arcane Ward');
            expect(result.payload.description).toContain('not active');
            expect(result.payload.description).toContain('Abjuration');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('bonus action automation type', () => {
        it('routes arcane_ward_bonus_action to the arcaneWardRestore modal with the action payload', async () => {
            setMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                return undefined;
            });

            const action = { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } };
            const result = await handle(
                action,
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('arcaneWardRestore');
            expect(result.payload).toEqual({ action });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('projected ward guards', () => {
        it('returns info popup when there is no combat summary', async () => {
            getCombatSummary.mockReturnValue(null);
            setMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await handle(
                projectedWardAction(),
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.automationType).toBe('projected_ward');
            expect(result.payload.description).toContain('Arcane Ward is active');
            expect(result.payload.description).toContain('No combat context available');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns info popup when no target is selected', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestWizard' }],
                activeCreatureName: 'TestWizard',
            });
            getTargetFromAttacker.mockReturnValue(null);
            setMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 8;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await handle(
                projectedWardAction(),
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.automationType).toBe('projected_ward');
            expect(result.payload.description).toContain('No target selected');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns info popup when target is out of range, consuming nothing', async () => {
            isWithinRange.mockResolvedValueOnce(false);
            setMocks(
                wardRuntime('Goblin', 8, 13, { rawDamage: 7 }, 5, 10),
                combatContext('TestWizard', 'Goblin'),
                { name: 'Goblin' },
            );

            const result = await handle(
                { name: 'Projected Ward', automation: { type: 'projected_ward', range: 30 } },
                makeWizardStats('TestWizard', 6, 3),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('out of range');
            expect(isWithinRange).toHaveBeenCalledWith('TestWizard', 'Goblin', 30);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns info when projectedWardDamage is undefined, writing nothing', async () => {
            setMocks(
                wardRuntime('Goblin', 8, 13, undefined, 5, 10),
                combatContext('TestWizard', 'Goblin'),
                { name: 'Goblin' },
            );

            const result = await handle(
                projectedWardAction(),
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent damage detected');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('projected ward absorption', () => {
        it.each([
            { label: 'full', wardHp: 10, wardMax: 15, projectedDamage: { rawDamage: 7 }, targetCurrentHp: 5, targetMaxHp: 10, expectedTargetHp: 10, expectedWardHp: 3, allAbsorbed: true },
            { label: 'partial', wardHp: 5, wardMax: 13, projectedDamage: { rawDamage: 12 }, targetCurrentHp: 8, targetMaxHp: 15, expectedTargetHp: 13, expectedWardHp: 0, allAbsorbed: false },
            { label: 'zero absorption (ward empty)', wardHp: 0, wardMax: 13, projectedDamage: { rawDamage: 7 }, targetCurrentHp: 5, targetMaxHp: 10, expectedTargetHp: 5, expectedWardHp: null, allAbsorbed: false },
        ])('absorbs $label: wardHp=$wardHp, max=$wardMax, damage=$projectedDamage, targetHp=$targetCurrentHp, maxHp=$targetMaxHp → targetHp=$expectedTargetHp, wardHp=$expectedWardHp, allAbsorbed=$allAbsorbed',
            async ({ wardHp, wardMax, projectedDamage, targetCurrentHp, targetMaxHp, expectedTargetHp, expectedWardHp, allAbsorbed }) => {
                setMocks(
                    wardRuntime('Goblin', wardHp, wardMax, projectedDamage, targetCurrentHp, targetMaxHp),
                    combatContext('TestWizard', 'Goblin'),
                    { name: 'Goblin' },
                );

                const result = await handle(
                    projectedWardAction(),
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.automationType).toBe('projected_ward');
                // default range of 30 is applied when the automation omits one
                expect(isWithinRange).toHaveBeenCalledWith('TestWizard', 'Goblin', 30);
                expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', expectedTargetHp, campaignName);
                if (expectedWardHp !== null) {
                    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', expectedWardHp, campaignName);
                    // the damage record is consumed so the same hit can't be absorbed twice
                    expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'projectedWardDamage', null, campaignName);
                } else {
                    expect(setRuntimeValue).not.toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', expect.any(Number), campaignName);
                    expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'projectedWardDamage', null, campaignName);
                }
                expect(addEntry).toHaveBeenCalledTimes(2);
                expect(addEntry).toHaveBeenNthCalledWith(
                    1,
                    campaignName,
                    expect.objectContaining({
                        type: 'ability_use',
                        characterName: 'TestWizard',
                        abilityName: 'Arcane Ward',
                    }),
                );
                expect(addEntry).toHaveBeenNthCalledWith(
                    2,
                    campaignName,
                    expect.objectContaining({
                        type: 'ward_absorbed',
                        targetName: 'Goblin',
                        wizardName: 'TestWizard',
                        remainingWardHp: expect.any(Number),
                    }),
                );
                if (allAbsorbed) {
                    expect(result.payload.description).toContain('All damage absorbed');
                } else {
                    expect(result.payload.description).toContain('remaining damage');
                }
            },
        );

        it('skips the target HP rollback when currentHitPoints is missing, still paying down the ward', async () => {
            setMocks(
                (player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 10;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 7 };
                    // currentHitPoints intentionally not set
                    return undefined;
                },
                combatContext('TestWizard', 'Goblin'),
                { name: 'Goblin' },
            );

            const result = await handle(
                projectedWardAction(),
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'currentHitPoints', expect.any(Number), campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 3, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'projectedWardDamage', null, campaignName);
        });
    });
});
