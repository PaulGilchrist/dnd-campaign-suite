import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createFleshToStoneHandler,
    createPrismaticSprayIndigoHandler,
    createPrismaticSprayVioletHandler,
} from './saveResultHandlers.js';
import * as logService from '../../services/ui/logService.js';
import { clearFleshToStonePrompt } from '../../services/combat/conditions/savePromptService.js';

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({ id: 'log-entry-1' }),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearFleshToStonePrompt: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
    const store = new Map();
    return {
        getRuntimeValue: vi.fn((key, prop, campaign) => {
            const k = `${key}::${prop}::${campaign ?? ''}`;
            return store.get(k) ?? null;
        }),
        setRuntimeValue: vi.fn((key, prop, value, campaign) => {
            const k = `${key}::${prop}::${campaign ?? ''}`;
            store.set(k, value);
        }),
        clearStore: vi.fn(() => store.clear()),
    };
});

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

describe('saveResultHandlers — flesh-to-stone', () => {
    let combatSummary;
    let setCombatSummary;
    let campaignName;
    let saveData;
    let conditions;
    let targetEffects;

    beforeEach(() => {
        vi.clearAllMocks();
        campaignName = 'test-campaign';
        setCombatSummary = vi.fn();
        combatSummary = {
            round: 1,
            creatures: [{ name: 'Alice', type: 'player' }],
        };
        saveData = { casterName: 'Goblin', dc: 15, successes: 0, failures: 0 };
        conditions = ['restrained'];
        targetEffects = [{ target: 'Alice', effect: 'flesh_to_stone', source: 'Goblin' }];

        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === '_fleshToStone_Alice') return saveData;
            if (key === 'Alice' && prop === 'activeConditions') return conditions;
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects;
            return null;
        });
    });

    function makeHandler() {
        return createFleshToStoneHandler(campaignName, combatSummary, setCombatSummary);
    }

    describe('early returns', () => {
        const scenarios = [
            { name: 'campaign mismatch', testCampaign: 'other-campaign' },
            { name: 'null combatSummary', nullCombatSummary: true },
            { name: 'missing result', result: null },
            { name: 'creature not found', targetName: 'Bob' },
            { name: 'missing save data', missingSaveData: true },
        ];

        it.each(scenarios)('should return early when $name', async ({ nullCombatSummary, result, targetName, missingSaveData, testCampaign }) => {
            if (missingSaveData) {
                getRuntimeValue.mockImplementation((key, prop) => {
                    if (key === 'campaign' && prop === '_fleshToStone_Alice') return null;
                    return null;
                });
            }
            const cs = nullCombatSummary ? null : combatSummary;
            const handler = createFleshToStoneHandler(campaignName, cs, setCombatSummary);
            const detail = { campaignName: testCampaign || campaignName, targetName: targetName || 'Alice' };
            if (result === undefined) detail.result = { success: true };
            else detail.result = result;
            await handler({ detail });
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('success path — 3rd success (spell ends)', () => {
        it('should remove restrained condition, clean targetEffects, clear tracking, and call clearFleshToStonePrompt', async () => {
            saveData = { casterName: 'Goblin', dc: 15, successes: 2, failures: 0 };
            const handler = makeHandler();
            await handler({
                detail: { campaignName, targetName: 'Alice', result: { success: true } },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeConditions', [], campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.not.arrayContaining([
                    expect.objectContaining({ target: 'Alice', effect: 'flesh_to_stone', source: 'Goblin' }),
                ]),
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_fleshToStone_Alice', null, campaignName);
            expect(clearFleshToStonePrompt).toHaveBeenCalledWith(campaignName, 'Alice');
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'save_result',
                rollType: 'save-flesh-to-stone',
                targetName: 'Alice',
                success: true,
            }));
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'condition',
                action: 'removed',
                condition: 'Restrained',
            }));
        });
    });

    describe('failure path — 3rd failure (petrified)', () => {
        it('should remove restrained, apply petrified, clean targetEffects, clear tracking, and call clearFleshToStonePrompt', async () => {
            saveData = { casterName: 'Goblin', dc: 15, successes: 0, failures: 2 };
            const handler = makeHandler();
            await handler({
                detail: { campaignName, targetName: 'Alice', result: { success: false } },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeConditions', ['petrified'], campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.not.arrayContaining([
                    expect.objectContaining({ target: 'Alice', effect: 'flesh_to_stone', source: 'Goblin' }),
                ]),
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_fleshToStone_Alice', null, campaignName);
            expect(clearFleshToStonePrompt).toHaveBeenCalledWith(campaignName, 'Alice');
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'condition',
                action: 'applied',
                condition: 'Petrified',
            }));
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'condition',
                action: 'removed',
                condition: 'Restrained',
            }));
        });
    });

    describe('name sanitization in tracking key', () => {
        it('should handle creature names with spaces in tracking key', async () => {
            const creatureSummary = {
                round: 1,
                creatures: [{ name: 'Alice the Brave', type: 'player' }],
            };
            const handler = createFleshToStoneHandler(campaignName, creatureSummary, setCombatSummary);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === '_fleshToStone_Alice_the_Brave') return { casterName: 'Goblin', dc: 15, successes: 0, failures: 0 };
                if (key === 'Alice the Brave' && prop === 'activeConditions') return ['restrained'];
                if (key === 'campaign' && prop === 'targetEffects') return [];
                return null;
            });

            await handler({
                detail: { campaignName, targetName: 'Alice the Brave', result: { success: true } },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                '_fleshToStone_Alice_the_Brave',
                expect.objectContaining({ successes: 1 }),
                campaignName,
            );
        });
    });
});

describe('saveResultHandlers — prismatic-spray-indigo', () => {
    let combatSummary;
    let setCombatSummary;
    let campaignName;
    let saveData;
    let conditions;
    let targetEffects;

    beforeEach(() => {
        vi.clearAllMocks();
        campaignName = 'test-campaign';
        setCombatSummary = vi.fn();
        combatSummary = {
            round: 1,
            creatures: [{ name: 'Alice', type: 'player' }],
        };
        saveData = { casterName: 'Goblin', dc: 15, successes: 0, failures: 0 };
        conditions = ['restrained'];
        targetEffects = [{ target: 'Alice', effect: 'prismatic_spray_indigo', source: 'Goblin' }];

        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === '_prismaticSprayIndigo_Alice') return saveData;
            if (key === 'Alice' && prop === 'activeConditions') return conditions;
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects;
            return null;
        });
    });

    function makeHandler() {
        return createPrismaticSprayIndigoHandler(campaignName, combatSummary, setCombatSummary);
    }

    describe('early returns', () => {
        const scenarios = [
            { name: 'campaign mismatch', testCampaign: 'other-campaign' },
            { name: 'creature not found', targetName: 'Bob' },
            { name: 'missing save data', missingSaveData: true },
        ];

        it.each(scenarios)('should return early when $name', async ({ targetName, missingSaveData, testCampaign }) => {
            if (missingSaveData) {
                getRuntimeValue.mockImplementation((key, prop) => {
                    if (key === 'campaign' && prop === '_prismaticSprayIndigo_Alice') return null;
                    return null;
                });
            }
            const handler = createPrismaticSprayIndigoHandler(campaignName, combatSummary, setCombatSummary);
            await handler({
                detail: { campaignName: testCampaign || campaignName, targetName: targetName || 'Alice', result: { success: true } },
            });
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('success path — 3rd success (restrained ends)', () => {
        it('should remove restrained, clean targetEffects, clear tracking, and log both events', async () => {
            saveData = { casterName: 'Goblin', dc: 15, successes: 2, failures: 0 };
            const handler = makeHandler();
            await handler({
                detail: { campaignName, targetName: 'Alice', result: { success: true } },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeConditions', [], campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.not.arrayContaining([
                    expect.objectContaining({ target: 'Alice', effect: 'prismatic_spray_indigo', source: 'Goblin' }),
                ]),
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_prismaticSprayIndigo_Alice', null, campaignName);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'save_result',
                rollType: 'save-prismatic-spray-indigo',
                targetName: 'Alice',
                success: true,
            }));
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'condition',
                action: 'removed',
                condition: 'Restrained',
            }));
        });

        it('should handle non-matching targetEffects (different target)', async () => {
            saveData = { casterName: 'Goblin', dc: 15, successes: 2, failures: 0 };
            targetEffects = [{ target: 'Bob', effect: 'prismatic_spray_indigo', source: 'Goblin' }];
            const handler = makeHandler();
            await handler({
                detail: { campaignName, targetName: 'Alice', result: { success: true } },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_prismaticSprayIndigo_Alice', null, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ target: 'Bob', effect: 'prismatic_spray_indigo' }),
                ]),
                campaignName,
            );
        });
    });

    describe('failure path — 3rd failure (petrified)', () => {
        it('should remove restrained, apply petrified, clean targetEffects, clear tracking, and log events', async () => {
            saveData = { casterName: 'Goblin', dc: 15, successes: 0, failures: 2 };
            const handler = makeHandler();
            await handler({
                detail: { campaignName, targetName: 'Alice', result: { success: false } },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeConditions', ['petrified'], campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.not.arrayContaining([
                    expect.objectContaining({ target: 'Alice', effect: 'prismatic_spray_indigo', source: 'Goblin' }),
                ]),
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_prismaticSprayIndigo_Alice', null, campaignName);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'condition',
                action: 'applied',
                condition: 'Petrified',
            }));
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'condition',
                action: 'removed',
                condition: 'Restrained',
            }));
        });
    });
});

describe('saveResultHandlers — prismatic-spray-violet', () => {
    let combatSummary;
    let setCombatSummary;
    let campaignName;
    let saveData;
    let conditions;
    let targetEffects;

    beforeEach(() => {
        vi.clearAllMocks();
        campaignName = 'test-campaign';
        setCombatSummary = vi.fn();
        combatSummary = {
            round: 1,
            creatures: [{ name: 'Alice', type: 'player' }],
        };
        saveData = { casterName: 'Goblin', dc: 15 };
        conditions = ['blinded'];
        targetEffects = [{ target: 'Alice', effect: 'prismatic_spray_violet', source: 'Goblin' }];

        getRuntimeValue.mockImplementation((key, prop, _campaign) => {
            if (key === 'campaign' && prop === '_prismaticSprayViolet_Alice') return saveData;
            if (key === 'Alice' && prop === 'activeConditions') return conditions;
            if (key === 'campaign' && prop === 'targetEffects') return targetEffects;
            return null;
        });
    });

    function makeHandler() {
        return createPrismaticSprayVioletHandler(campaignName, combatSummary, setCombatSummary);
    }

    describe('early returns', () => {
        const scenarios = [
            { name: 'campaign mismatch', testCampaign: 'other-campaign' },
            { name: 'creature not found', targetName: 'Bob' },
            { name: 'missing save data', missingSaveData: true },
        ];

        it.each(scenarios)('should return early when $name', async ({ targetName, missingSaveData, testCampaign }) => {
            if (missingSaveData) {
                getRuntimeValue.mockImplementation((key, prop) => {
                    if (key === 'campaign' && prop === '_prismaticSprayViolet_Alice') return null;
                    return null;
                });
            }
            const handler = createPrismaticSprayVioletHandler(campaignName, combatSummary, setCombatSummary);
            await handler({
                detail: { campaignName: testCampaign || campaignName, targetName: targetName || 'Alice', result: { success: true } },
            });
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('success path (blinded removed)', () => {
        it('should remove blinded, clean targetEffects, clear tracking, and log both events', async () => {
            const handler = makeHandler();
            await handler({
                detail: { campaignName, targetName: 'Alice', result: { success: true } },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeConditions', [], campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.not.arrayContaining([
                    expect.objectContaining({ target: 'Alice', effect: 'prismatic_spray_violet', source: 'Goblin' }),
                ]),
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_prismaticSprayViolet_Alice', null, campaignName);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'save_result',
                rollType: 'save-prismatic-spray-violet',
                targetName: 'Alice',
                saveType: 'WIS',
                success: true,
            }));
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'condition',
                action: 'removed',
                condition: 'Blinded',
            }));
        });

        it('should handle non-matching targetEffects (different target)', async () => {
            targetEffects = [{ target: 'Bob', effect: 'prismatic_spray_violet', source: 'Goblin' }];
            const handler = makeHandler();
            await handler({
                detail: { campaignName, targetName: 'Alice', result: { success: true } },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_prismaticSprayViolet_Alice', null, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ target: 'Bob', effect: 'prismatic_spray_violet' }),
                ]),
                campaignName,
            );
        });
    });

    describe('failure path (banishment — incapacitated applied)', () => {
        it('should remove blinded, apply incapacitated, add banishment targetEffect, clear tracking, and log events', async () => {
            const handler = makeHandler();
            await handler({
                detail: { campaignName, targetName: 'Alice', result: { success: false } },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeConditions', ['incapacitated'], campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ effect: 'banishment', target: 'Alice', source: 'Goblin' }),
                ]),
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', '_prismaticSprayViolet_Alice', null, campaignName);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'save_result',
                rollType: 'save-prismatic-spray-violet',
                targetName: 'Alice',
                saveType: 'WIS',
                success: false,
            }));
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'condition',
                action: 'applied',
                condition: 'Incapacitated',
            }));
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'Goblin',
                abilityName: 'Prismatic Spray (Violet ray)',
            }));
        });

        it('should preserve non-banishment targetEffects when adding banishment and remove existing banishment', async () => {
            targetEffects = [
                { target: 'Bob', effect: 'prismatic_spray_violet', source: 'Goblin' },
                { effect: 'banishment', target: 'Bob', source: 'OtherCaster' },
            ];
            const handler = makeHandler();
            await handler({
                detail: { campaignName, targetName: 'Alice', result: { success: false } },
            });

            const targetEffectsCall = setRuntimeValue.mock.calls.find(
                (call) => call[0] === 'campaign' && call[1] === 'targetEffects',
            );
            expect(targetEffectsCall).toBeDefined();
            const effects = targetEffectsCall[2];
            expect(effects).toHaveLength(2);
            expect(effects).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ target: 'Bob', effect: 'prismatic_spray_violet' }),
                    expect.objectContaining({ effect: 'banishment', target: 'Alice', source: 'Goblin' }),
                ]),
            );
        });
    });
});
