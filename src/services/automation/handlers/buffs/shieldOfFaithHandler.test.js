// @improved-by-ai
import { handle, applyShieldOfFaith, isShieldOfFaithActive, getShieldOfFaithBonus } from '../shieldOfFaithHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

const MOCK_CAMPAIGN = 'test-campaign';
const MOCK_PLAYER = { name: 'Cleric1', level: 5 };

describe('shieldOfFaithHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rangeToFeet.mockReturnValue(60);
    });

    describe('handle', () => {
        it('returns target selection popup with creature list from combat summary', async () => {
            resolveMapPositions.mockResolvedValue(null);
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Ally1' },
                    { name: 'Cleric1' },
                    { name: 'Enemy1' },
                ],
            });

            const action = {
                name: 'Shield of Faith',
                spell: { range: '60 feet', duration: 'Concentration, up to 10 minutes' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, []);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('shield_of_faith_target_selection');
            expect(result.payload.name).toBe('Shield of Faith');
            expect(result.payload.creatureTargets).toEqual(['Ally1', 'Cleric1', 'Enemy1']);
            expect(result.payload.range).toBe('60 feet');
            expect(result.payload.rangeFt).toBe(60);
            expect(result.payload.duration).toBe('Concentration, up to 10 minutes');
            expect(result.payload.attackerPos).toBeNull();
        });

        it('returns empty creature list when no combat summary', async () => {
            getCombatSummary.mockReturnValue(null);

            const action = {
                name: 'Shield of Faith',
                spell: { range: '60 feet' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, []);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('shield_of_faith_target_selection');
            expect(result.payload.creatureTargets).toEqual([]);
        });

        it('resolves map positions when mapName is provided', async () => {
            resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 2 } });

            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Enemy1' }],
            });

            const action = {
                name: 'Shield of Faith',
                spell: { range: '60 feet' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, 'test-map', []);

            expect(resolveMapPositions).toHaveBeenCalledWith(MOCK_CAMPAIGN, 'test-map', 'Cleric1');
            expect(result.payload.attackerPos).toEqual({ gridX: 1, gridY: 2 });
        });

        it('uses spell range/duration when present, falls back to defaults when absent', async () => {
            resolveMapPositions.mockResolvedValue(null);

            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Enemy1' }],
            });

            const action = {
                name: 'Shield of Faith',
                spell: { range: '30 feet', duration: '1 minute' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, []);

            expect(result.payload.range).toBe('30 feet');
            expect(result.payload.duration).toBe('1 minute');
        });

        it('uses defaults when action has no spell property', async () => {
            resolveMapPositions.mockResolvedValue(null);

            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Enemy1' }],
            });

            const action = { name: 'Shield of Faith' };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, []);

            expect(result.payload.range).toBe('60 feet');
            expect(result.payload.duration).toBe('Concentration, up to 10 minutes');
        });
    });

    describe('applyShieldOfFaith', () => {
        it('returns null when targetNames is null or empty array', async () => {
            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const resultNull = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, null);
            const resultEmpty = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, []);

            expect(resultNull).toBeNull();
            expect(resultEmpty).toBeNull();
        });

        it('applies shield of faith buff and sets expiration for each target', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const result = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Ally1 gained +2 AC from Shield of Faith.');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Shield of Faith',
                        effect: 'shield_of_faith',
                        acBonus: 2,
                        duration: 'Concentration, up to 10 minutes',
                        sourceCharacter: 'Cleric1',
                    }),
                ]),
                MOCK_CAMPAIGN
            );

            expect(addExpiration).toHaveBeenCalledWith(
                'Cleric1',
                'Ally1',
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'remove_active_buff',
                        buffName: 'Shield of Faith',
                    }),
                ]),
                MOCK_CAMPAIGN
            );

            expect(postLogEntry).toHaveBeenCalledWith(MOCK_CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: 'Cleric1',
                abilityName: 'Shield of Faith',
                description: 'Cleric1 cast Shield of Faith on Ally1. Target\'s AC increases by 2.',
            }));
        });

        it('skips adding buff when it already exists on target but still adds expiration and log', async () => {
            getRuntimeValue.mockImplementation((name) => {
                if (name === 'Ally1') return [{ name: 'Shield of Faith', effect: 'shield_of_faith' }];
                return [];
            });

            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const result = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addExpiration).toHaveBeenCalledTimes(1);
            expect(postLogEntry).toHaveBeenCalledTimes(1);
        });

        it('applies to new targets and skips duplicates in multi-target call', async () => {
            getRuntimeValue.mockImplementation((name) => {
                if (name === 'Ally1') return [{ name: 'Shield of Faith', effect: 'shield_of_faith' }];
                return [];
            });

            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1', 'Ally2']);

            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('Ally2', 'activeBuffs', expect.any(Array), MOCK_CAMPAIGN);
            expect(addExpiration).toHaveBeenCalledTimes(2);
            expect(postLogEntry).toHaveBeenCalledTimes(2);
        });

        it('reports correct target count in description for multiple targets', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const result = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['A', 'B', 'C']);

            expect(result.payload.description).toContain('3 targets gained +2 AC from Shield of Faith: A, B, C.');
            expect(setRuntimeValue).toHaveBeenCalledTimes(3);
        });
    });

    describe('isShieldOfFaithActive', () => {
        it('returns true when shield of faith buff is active', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 2 },
            ]);

            const result = isShieldOfFaithActive('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(true);
        });

        it('returns false when no buffs stored', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = isShieldOfFaithActive('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(false);
        });

        it('returns true when shield of faith is among multiple buffs', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Mage Armor', effect: 'mage_armor' },
                { name: 'Shield of Faith', effect: 'shield_of_faith' },
                { name: 'Bless', effect: 'bless' },
            ]);

            const result = isShieldOfFaithActive('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(true);
        });
    });

    describe('getShieldOfFaithBonus', () => {
        it('returns the acBonus value when shield of faith buff is active', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 2 },
            ]);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(2);
        });

        it('returns default 2 when acBonus is missing from buff', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Shield of Faith', effect: 'shield_of_faith' },
            ]);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(2);
        });

        it('returns 0 when no buffs stored', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(0);
        });

        it('returns custom acBonus when present on the buff', () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 5 },
            ]);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(5);
        });
    });
});
