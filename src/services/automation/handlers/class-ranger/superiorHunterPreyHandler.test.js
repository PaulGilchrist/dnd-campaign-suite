// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './superiorHunterPreyHandler.js';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestRanger',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: "Superior Hunter's Prey",
        automation: {
            type: 'superior_hunter_prey',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('superiorHunterPreyHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns info popup with no active combat when getCombatContext returns null', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Prey");
            expect(result.payload.description).toBe('No active combat to target.');
        });

        it('returns info popup when player has no concentration', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestRanger' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Prey");
            expect(result.payload.description).toBe("Hunter's Mark is not currently concentrated on.");
        });

        it('returns success popup when player has any concentration (handler does not validate spell name)', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestRanger', concentration: { spell: 'Shield' } }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Prey");
            expect(result.payload.description).toContain("Superior Hunter's Prey active");
        });

        it('returns info popup when another creature has Hunter\'s Mark but not the player', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'OtherPlayer', concentration: { spell: "Hunter's Mark" } }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Prey");
            expect(result.payload.description).toBe("Hunter's Mark is not currently concentrated on.");
        });

        it('returns info popup when creatures array is empty', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Prey");
            expect(result.payload.description).toBe("Hunter's Mark is not currently concentrated on.");
        });

        it('returns info popup when creatures is undefined', async () => {
            getCombatContext.mockResolvedValue({});

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Prey");
            expect(result.payload.description).toBe("Hunter's Mark is not currently concentrated on.");
        });

        it('returns info popup when player has Hunter\'s Mark concentration active', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestRanger', concentration: { spell: "Hunter's Mark" } }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Prey");
            expect(result.payload.description).toContain("Superior Hunter's Prey active");
            expect(result.payload.description).toContain("creature marked by Hunter's Mark");
            expect(result.payload.description).toContain('a different creature');
            expect(result.payload.description).toContain('within 30 feet');
            expect(result.payload.description).toContain('Once per turn');
        });
    });
});
