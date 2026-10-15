// @maintained-by-ai
// Deterministic unit contract for superiorHunterPreyHandler: an info-only popup
// handler with three branches (no combat context / no Hunter's Mark concentration
// / active rules recap). getCombatContext is a stable module seam; each test sets
// its own resolved value and beforeEach restores the fail-loud default so a mock
// value can never leak into the next test. Distinct lane from hunterPreyHandler
// (owns _Hunter's_Prey_choice pins) and superiorHunterDefenseHandler.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './superiorHunterPreyHandler.js';

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({})),
}));

const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');

const PLAYER_NAME = 'TestRanger';

function makePlayerStats() {
    return { name: PLAYER_NAME };
}

function makeAction() {
    return {
        name: "Superior Hunter's Prey",
        automation: { type: 'superior_hunter_prey' },
    };
}

describe('superiorHunterPreyHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks clears calls but NOT implementations — restore the
        // factory default so a mockResolvedValue leaked from a prior test
        // cannot make a branch test pass vacuously.
        getCombatContext.mockImplementation(() => Promise.resolve({}));
    });

    describe('handle', () => {
        it('returns info popup with no active combat when getCombatContext returns null', async () => {
            getCombatContext.mockResolvedValueOnce(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Prey");
            expect(result.payload.description).toBe('No active combat to target.');
        });

        it('returns info popup when player has no Hunter\'s Mark concentration', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: PLAYER_NAME }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Prey");
            expect(result.payload.description).toBe("Hunter's Mark is not currently concentrated on.");
        });

        it('returns info popup when the player is absent from combat creatures', async () => {
            // Distinct input path to the concentration gate: optional-chaining
            // guard (!attacker) must produce the same refusal, not throw.
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Someone Else', concentration: { spell: "Hunter's Mark" } }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe("Hunter's Mark is not currently concentrated on.");
        });

        it('returns info popup with player concentration showing ability description', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: PLAYER_NAME, concentration: { spell: "Hunter's Mark" } }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Prey");
            // Own-composition phrase pins: the RAW recap must name the trigger,
            // the splash radius, and the once-per-turn limit.
            expect(result.payload.description).toContain("Superior Hunter's Prey active");
            expect(result.payload.description).toContain("marked by Hunter's Mark");
            expect(result.payload.description).toContain('within 30 feet');
            expect(result.payload.description).toContain('Once per turn');
        });
    });
});
