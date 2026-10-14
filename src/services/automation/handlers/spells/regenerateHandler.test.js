import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

import { handle } from './regenerateHandler.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Cleric1',
        level: 7,
        proficiency: 4,
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        hitPoints: 50,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Regenerate',
        automation: { ...overrides.automation },
        spell: {
            name: 'Regenerate',
            range: 'Touch',
            level: 7,
            ...overrides.spell,
        },
        ...Object.fromEntries(
            Object.entries(overrides).filter(([k]) => !['spell', 'automation'].includes(k)),
        ),
    };
}

function makeNonRegenerateAction(overrides = {}) {
    return {
        name: 'Cure Wounds',
        automation: { ...overrides.automation },
        spell: {
            name: 'Cure Wounds',
            range: 'Touch',
            level: 1,
        },
        ...overrides,
    };
}

describe('regenerateHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('spell matching', () => {
        it('should return null when spell name does not match Regenerate', async () => {
            const result = await handle(
                makeNonRegenerateAction(),
                makePlayerStats(),
                campaignName,
                null,
            );
            expect(result).toBeNull();
        });

        it('should return null when spell name is missing', async () => {
            const result = await handle(
                { name: 'Regenerate', spell: {} },
                makePlayerStats(),
                campaignName,
                null,
            );
            expect(result).toBeNull();
        });
    });

    describe('combat context validation', () => {
        it('should return popup when no combat context exists', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue(null);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No combat context found');
        });
    });

    describe('target selection popup', () => {
        it('should return target selection popup with creature list', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Goblin' },
                    { name: 'Orc' },
                    { name: 'Cleric1' },
                ],
            });

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('regenerate_target_selection');
            expect(result.payload.name).toBe('Regenerate');
            expect(result.payload.creatureTargets).toEqual(['Goblin', 'Orc', 'Cleric1']);
            expect(result.payload.range).toBe('Touch');
        });

        it('should use spell.range when provided', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await handle(
                makeAction({ spell: { range: '60ft' } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.range).toBe('60ft');
        });

        it('should default range to Touch when not provided', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await handle(
                makeAction({ spell: {} }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.range).toBe('Touch');
        });

        it('should pass automation through to popup payload', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await handle(
                makeAction({ automation: { customFlag: true } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.automation).toEqual({ customFlag: true });
        });
    });
});
