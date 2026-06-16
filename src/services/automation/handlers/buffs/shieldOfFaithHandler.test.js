import { handle, applyShieldOfFaith, isShieldOfFaithActive, getShieldOfFaithBonus } from '../shieldOfFaithHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { postLogEntry } from '../../../shared/logPoster.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn((r) => (r ? 60 : 0)),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(() => Promise.resolve()),
}));

const MOCK_CAMPAIGN = 'test-campaign';
const MOCK_PLAYER = { name: 'Cleric1', level: 5 };

describe('shieldOfFaithHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns target selection popup when combat context exists', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Ally1', type: 'player' },
                    { name: 'Cleric1', type: 'player' },
                    { name: 'Enemy1', type: 'npc' },
                ],
            });
            resolveMapPositions.mockResolvedValue(null);
            rangeToFeet.mockReturnValue(60);

            const action = {
                name: 'Shield of Faith',
                spell: { range: '60 feet', duration: 'Concentration, up to 10 minutes' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('shield_of_faith_target_selection');
            expect(result.payload.name).toBe('Shield of Faith');
            expect(result.payload.creatureTargets).toEqual(['Ally1', 'Enemy1']);
            expect(result.payload.range).toBe('60 feet');
            expect(result.payload.rangeFt).toBe(60);
            expect(result.payload.duration).toBe('Concentration, up to 10 minutes');
            expect(result.payload.attackerPos).toBeNull();
        });

        it('returns error popup when no combat context', async () => {
            getCombatContext.mockResolvedValue(null);
            resolveMapPositions.mockResolvedValue(null);

            const action = {
                name: 'Shield of Faith',
                spell: { range: '60 feet' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No combat context found');
            expect(result.payload.description).toContain('Shield of Faith');
        });

        it('filters out the caster from creature targets', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Cleric1', type: 'player' },
                    { name: 'Enemy1', type: 'npc' },
                ],
            });
            resolveMapPositions.mockResolvedValue(null);

            const action = {
                name: 'Shield of Faith',
                spell: { range: '60 feet' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null);

            expect(result.payload.creatureTargets).toEqual(['Enemy1']);
        });

        it('resolves map positions when mapName is provided', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Enemy1', type: 'npc' }],
            });
            resolveMapPositions.mockResolvedValue({ attackerPos: { gridX: 1, gridY: 2 } });

            const action = {
                name: 'Shield of Faith',
                spell: { range: '60 feet' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, 'test-map');

            expect(resolveMapPositions).toHaveBeenCalledWith(MOCK_CAMPAIGN, 'test-map', 'Cleric1');
            expect(result.payload.attackerPos).toEqual({ gridX: 1, gridY: 2 });
        });

        it('uses default duration when spell has no duration', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Enemy1', type: 'npc' }],
            });
            resolveMapPositions.mockResolvedValue(null);

            const action = {
                name: 'Shield of Faith',
                spell: { range: '60 feet' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null);

            expect(result.payload.duration).toBe('Concentration, up to 10 minutes');
        });

        it('uses default range when spell has no range', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Enemy1', type: 'npc' }],
            });
            resolveMapPositions.mockResolvedValue(null);
            rangeToFeet.mockReturnValue(0);

            const action = {
                name: 'Shield of Faith',
                spell: {},
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null);

            expect(result.payload.range).toBe('60 feet');
            expect(rangeToFeet).toHaveBeenCalledWith('60 feet');
        });

        it('handles spell being undefined in action', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Enemy1', type: 'npc' }],
            });
            resolveMapPositions.mockResolvedValue(null);

            const action = {
                name: 'Shield of Faith',
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null);

            expect(result.type).toBe('popup');
            expect(result.payload.range).toBe('60 feet');
        });
    });

    describe('applyShieldOfFaith', () => {
        it('returns null when no targets provided', async () => {
            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const result = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, null);

            expect(result).toBeNull();
        });

        it('returns null when empty targets array', async () => {
            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const result = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, []);

            expect(result).toBeNull();
        });

        it('returns null when targets is not an array', async () => {
            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const result = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, 'Ally1');

            expect(result).toBeNull();
        });

        it('applies shield of faith buff to target', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const result = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('1 target(s)');
            expect(result.payload.description).toContain('+2 AC');

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

        it('does not apply if buff already active on target', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [{ name: 'Shield of Faith', effect: 'shield_of_faith' }];
                return null;
            });

            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const result = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(result).not.toBeNull();
            expect(result.type).toBe('popup');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('handles multiple targets', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const result = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1', 'Ally2']);

            expect(result).not.toBeNull();
            expect(result.payload.description).toContain('2 target(s)');
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
            expect(addExpiration).toHaveBeenCalledTimes(2);
            expect(postLogEntry).toHaveBeenCalledTimes(2);
        });

        it('skips targets that already have the buff and applies to others', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') {
                    if (name === 'Ally1') return [{ name: 'Shield of Faith', effect: 'shield_of_faith' }];
                    return [];
                }
                return null;
            });

            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const result = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1', 'Ally2']);

            expect(result).not.toBeNull();
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(addExpiration).toHaveBeenCalledTimes(2);
        });

        it('uses default duration when spell has no duration', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = {
                name: 'Shield of Faith',
            };

            await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        duration: 'Concentration, up to 10 minutes',
                    }),
                ]),
                MOCK_CAMPAIGN
            );
        });

        it('handles non-array activeBuffs stored value', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return 'invalid';
                return null;
            });

            const action = {
                name: 'Shield of Faith',
                spell: { duration: 'Concentration, up to 10 minutes' },
            };

            const result = await applyShieldOfFaith(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(result).not.toBeNull();
            expect(setRuntimeValue).toHaveBeenCalled();
        });
    });

    describe('isShieldOfFaithActive', () => {
        it('returns true when shield of faith buff is active', async () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 2 },
            ]);

            const result = isShieldOfFaithActive('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(true);
        });

        it('returns false when no buffs stored', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = isShieldOfFaithActive('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(false);
        });

        it('returns false when activeBuffs is empty array', async () => {
            getRuntimeValue.mockReturnValue([]);

            const result = isShieldOfFaithActive('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(false);
        });

        it('returns false when buff has different name', async () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Mage Armor', effect: 'mage_armor', acBonus: 3 },
            ]);

            const result = isShieldOfFaithActive('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(false);
        });

        it('returns false when buff has different effect', async () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Shield of Faith', effect: 'some_other_effect', acBonus: 2 },
            ]);

            const result = isShieldOfFaithActive('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(false);
        });

        it('returns false when stored value is not an array', async () => {
            getRuntimeValue.mockReturnValue('invalid');

            const result = isShieldOfFaithActive('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(false);
        });

        it('returns true when multiple buffs present including shield of faith', async () => {
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
        it('returns 2 when shield of faith buff is active with acBonus', async () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 2 },
            ]);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(2);
        });

        it('returns default 2 when acBonus is missing', async () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Shield of Faith', effect: 'shield_of_faith' },
            ]);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(2);
        });

        it('returns 0 when no buffs stored', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(0);
        });

        it('returns 0 when activeBuffs is empty array', async () => {
            getRuntimeValue.mockReturnValue([]);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(0);
        });

        it('returns 0 when buff has different name', async () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Mage Armor', effect: 'mage_armor', acBonus: 3 },
            ]);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(0);
        });

        it('returns 0 when buff has different effect', async () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Shield of Faith', effect: 'some_other_effect', acBonus: 5 },
            ]);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(0);
        });

        it('returns 0 when stored value is not an array', async () => {
            getRuntimeValue.mockReturnValue('invalid');

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(0);
        });

        it('returns custom acBonus when present', async () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 5 },
            ]);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(5);
        });

        it('finds shield of faith among multiple buffs', async () => {
            getRuntimeValue.mockReturnValue([
                { name: 'Mage Armor', effect: 'mage_armor', acBonus: 3 },
                { name: 'Shield of Faith', effect: 'shield_of_faith', acBonus: 2 },
                { name: 'Bless', effect: 'bless' },
            ]);

            const result = getShieldOfFaithBonus('Ally1', MOCK_CAMPAIGN);

            expect(result).toBe(2);
        });
    });
});
