import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, grantCelestialResilience } from './celestialResilienceHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((_expr) => 5),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(async () => null),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => 10),
    rangeToFeet: vi.fn((r) => {
        const m = String(r).match(/^(\d+)_ft$/);
        return m ? parseInt(m[1], 10) : null;
    }),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Celestial Resilience',
        description: 'Gain temporary hit points.',
        automation: {
            type: 'celestial_resilience',
            tempHpExpression: 'warlock level + CHA modifier',
            allyTempHpExpression: 'floor(warlock level / 2) + CHA modifier',
            maxAllies: 5,
            range: '60_ft',
        },
        ...overrides,
    };
}

function makeCelestialPlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        class: { major: { name: 'Celestial Patron' }, subclass: { name: 'Celestial Patron' } },
        characterAdvancement: [
            { name: 'Celestial Resilience', automation: { tempHpExpression: 'warlock level + CHA modifier', allyTempHpExpression: 'floor(warlock level / 2) + CHA modifier', maxAllies: 5, range: '60_ft' } },
        ],
        ...overrides,
    };
}

function makeNonCelestialPlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        class: { major: { name: 'Other Patron' } },
        characterAdvancement: [],
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('celestialResilienceHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('grantCelestialResilience', () => {
        it('should return null for non-celestial patron', async () => {
            const result = await grantCelestialResilience(makeNonCelestialPlayerStats(), 'campaign', 'magical_cunning', 'map');
            expect(result).toBe(null);
        });

        it('should return null when Celestial Resilience feature is missing', async () => {
            const stats = makeCelestialPlayerStats({ characterAdvancement: [] });
            const result = await grantCelestialResilience(stats, 'campaign', 'magical_cunning', 'map');
            expect(result).toBe(null);
        });

        it('should return null when automation is missing', async () => {
            const stats = makeCelestialPlayerStats({
                characterAdvancement: [{ name: 'Celestial Resilience', automation: null }],
            });
            const result = await grantCelestialResilience(stats, 'campaign', 'magical_cunning', 'map');
            expect(result).toBe(null);
        });

        it('should set temp HP and return result when valid', async () => {
            getRuntimeValue.mockReturnValue(0);
            const stats = makeCelestialPlayerStats();
            const result = await grantCelestialResilience(stats, 'campaign', 'magical_cunning', 'map');

            expect(result).not.toBe(null);
            expect(result.selfTempHp).toBe(5);
            expect(result.message).toContain('5 temporary hit points');
        });

        it('should add to existing temp HP', async () => {
            getRuntimeValue.mockReturnValue(3);
            const stats = makeCelestialPlayerStats();
            const result = await grantCelestialResilience(stats, 'campaign', 'magical_cunning', 'map');

            expect(result.selfTempHp).toBe(5);
        });

        it('should return null when temp HP expression evaluates to non-positive', async () => {
            vi.mocked(await import('../../../combat/automation/automationService.js')).evaluateAutoExpression.mockReturnValue(0);
            const stats = makeCelestialPlayerStats();
            const result = await grantCelestialResilience(stats, 'campaign', 'magical_cunning', 'map');
            expect(result).toBe(null);
        });

        it('should not add ally temp HP when source is not magical_cunning', async () => {
            const { evaluateAutoExpression } = await import('../../../combat/automation/automationService.js');
            evaluateAutoExpression.mockReturnValue(5);
            getRuntimeValue.mockImplementation((_name, _key, _campaign) => 0);
            const stats = makeCelestialPlayerStats();
            const result = await grantCelestialResilience(stats, 'campaign', 'other_source', 'map');

            expect(result).not.toBe(null);
            expect(result.selfTempHp).toBe(5);
            expect(result.allyTempHp).toBeUndefined();
        });
    });

    describe('handle', () => {
        it('should return null when grantCelestialResilience returns null', async () => {
            const stats = makeNonCelestialPlayerStats();
            const result = await handle(makeAction(), stats, 'campaign', 'map');
            expect(result).toBe(null);
        });
    });
});
