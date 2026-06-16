import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './superiorHunterPreyHandler.js';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');

beforeEach(() => {
    vi.clearAllMocks();
});

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
    it('returns error when no active combat', async () => {
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('No active combat to target.');
    });

    it('returns error when not concentrated on Hunter\'s Mark', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'TestRanger' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain("Hunter's Mark is not currently concentrated on");
    });

    it('returns success when concentrated on Hunter\'s Mark', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'TestRanger', concentration: { spell: "Hunter's Mark" } }],
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe("Superior Hunter's Prey");
        expect(result.payload.description).toContain("Superior Hunter's Prey active");
        expect(result.payload.description).toContain('extra damage to a different creature');
        expect(result.payload.description).toContain('Once per turn');
    });

    it('handles creature not found in combat', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'OtherPlayer', concentration: { spell: "Hunter's Mark" } }],
        });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain("Hunter's Mark is not currently concentrated on");
    });

    it('handles empty creatures array', async () => {
        getCombatContext.mockResolvedValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain("Hunter's Mark is not currently concentrated on");
    });

    it('handles undefined creatures', async () => {
        getCombatContext.mockResolvedValue({});

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain("Hunter's Mark is not currently concentrated on");
    });
});
