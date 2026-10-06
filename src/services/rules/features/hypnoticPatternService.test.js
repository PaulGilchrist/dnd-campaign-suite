// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerHypnoticPattern, breakHypnoticPatternOnDamage } from './hypnoticPatternService.js';
import { executeHandler } from '../../automation/index.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// Silence console.error during tests (the service logs errors before throwing)
const originalError = console.error;
beforeAll(() => { console.error = () => {}; });
afterAll(() => { console.error = originalError; });

describe('hypnoticPatternService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const defaultPlayerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    describe('early returns', () => {
        it('returns null for non-matching spell name', async () => {
            const result = await triggerHypnoticPattern(
                { name: 'Fire Bolt', level: 0 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('throws when spell object is null', async () => {
            await expect(
                triggerHypnoticPattern(
                    null,
                    {},
                    defaultPlayerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow("Cannot read properties of null (reading 'name')");
        });
    });

    describe('save DC resolution', () => {
        it('uses metaCtx spellSaveDc when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                { spellSaveDc: 18, slotLevel: 5 },
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'hypnotic_pattern', saveDc: 18, saveType: 'WIS' },
                }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'hypnotic_pattern', saveDc: 15, saveType: 'WIS' },
                }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('computes saveDc from proficiency when spellAbilities is missing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 3 };

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'hypnotic_pattern', saveDc: 11, saveType: 'WIS' },
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('throws when proficiency is missing', async () => {
            const stats = { name: 'Wizard' };

            await expect(
                triggerHypnoticPattern(
                    { name: 'Hypnotic Pattern', level: 3 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for hypnotic pattern');
        });

        it('treats proficiency 0 as a valid value (saveDc = 8)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 0 };

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'hypnotic_pattern', saveDc: 8, saveType: 'WIS' },
                }),
                stats,
                campaignName,
                mapName,
            );
        });
    });

    describe('slot level resolution', () => {
        it('uses metaCtx slotLevel when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                { slotLevel: 5 },
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 5 }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to spell.level when metaCtx lacks slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 5 },
                { spellSaveDc: 17 },
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 5 }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('throws when neither metaCtx.slotLevel nor spell.level is available', async () => {
            await expect(
                triggerHypnoticPattern(
                    { name: 'Hypnotic Pattern' },
                    {},
                    defaultPlayerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required for hypnotic pattern');
        });
    });

    describe('delegation to executeHandler', () => {
        it('passes spell, campaignName, mapName and playerStats to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Hypnotic Pattern', level: 3, school: 'Illusion' };

            await triggerHypnoticPattern(spell, {}, defaultPlayerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('returns the result from executeHandler', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Hypnotic Pattern', description: 'Hypnotic Pattern affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null when executeHandler throws', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });
    });
});

describe('breakHypnoticPatternOnDamage (SP-069)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        addEntry.mockResolvedValue(undefined);
    });

    it('breaks hypno conditions on a charmed+incapacitated+speed_zero target and logs', () => {
        getRuntimeValue.mockReturnValue(['charmed', 'incapacitated', 'speed_zero']);

        const broke = breakHypnoticPatternOnDamage('Bandit 1', 'test-campaign');

        expect(broke).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledWith('Bandit 1', 'activeConditions', [], 'test-campaign');

        const removedLogs = addEntry.mock.calls
            .map(c => c[1])
            .filter(e => e.type === 'condition' && e.action === 'removed');
        expect(removedLogs.map(e => e.condition).sort()).toEqual(['Charmed', 'Incapacitated', 'Speed_zero']);
        removedLogs.forEach(e => expect(e.reason).toMatch(/Took damage \(Hypnotic Pattern\)/));

        const brokenLog = addEntry.mock.calls.map(c => c[1]).find(e => e.automation === 'hypnotic_pattern_broken');
        expect(brokenLog).toBeTruthy();
        expect(brokenLog.characterName).toBe('Bandit 1');
    });

    it('preserves unrelated conditions while removing the hypno trio', () => {
        getRuntimeValue.mockReturnValue(['prone', 'charmed', 'incapacitated', 'speed_zero', 'poisoned']);

        const broke = breakHypnoticPatternOnDamage('Bandit 1', 'test-campaign');

        expect(broke).toBe(true);
        expect(setRuntimeValue).toHaveBeenCalledWith('Bandit 1', 'activeConditions', ['prone', 'poisoned'], 'test-campaign');
    });

    it('does NOT break a Confusion-charmed target (charmed+speed_zero, no incapacitated)', () => {
        getRuntimeValue.mockReturnValue(['charmed', 'speed_zero']);

        const broke = breakHypnoticPatternOnDamage('Goblin', 'test-campaign');

        expect(broke).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('does NOT break a plain charmed target and guards null stored conditions', () => {
        getRuntimeValue.mockReturnValue(['charmed']);
        expect(breakHypnoticPatternOnDamage('Victim', 'test-campaign')).toBe(false);

        getRuntimeValue.mockReturnValue(null);
        expect(breakHypnoticPatternOnDamage('Victim', 'test-campaign')).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});
