import { handle, applyLongstrider } from './longstriderHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { postLogEntry } from '../../../shared/logPoster.js';

vi.mock('../../../../hooks/useRuntimeState.js');
vi.mock('../../../rules/effects/expirations.js');
vi.mock('../../../rules/combat/damageUtils.js');
vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn((range) => {
        if (range === 'Touch') return 0;
        return 30;
    }),
}));
vi.mock('../../common/targetResolver.js');
vi.mock('../../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(() => Promise.resolve()),
}));

const MOCK_CAMPAIGN = 'TestCampaign';
const MOCK_PLAYER = { name: 'TestCharacter', speed: 30 };

describe('longstriderHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return popup with target selection when combat context exists', async () => {
            const mockCombat = {
                creatures: [
                    { name: 'Ally1' },
                    { name: 'Ally2' },
                    { name: 'TestCharacter' },
                ],
            };
            getCombatContext.mockResolvedValue(mockCombat);
            resolveMapPositions.mockResolvedValue(null);

            const action = {
                name: 'Longstrider',
                spell: {
                    name: 'Longstrider',
                    range: 'Touch',
                    duration: '1 hour',
                },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'longstrider_target_selection',
                    name: 'Longstrider',
                    creatureTargets: ['Ally1', 'Ally2'],
                    range: 'Touch',
                    rangeFt: expect.any(Number),
                    duration: '1 hour',
                    attackerPos: null,
                },
            });
        });

        it('should return error popup when no combat context', async () => {
            getCombatContext.mockResolvedValue(null);
            resolveMapPositions.mockResolvedValue(null);

            const action = {
                name: 'Longstrider',
                spell: {
                    name: 'Longstrider',
                    range: 'Touch',
                },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Longstrider',
                    description: expect.stringContaining('No combat context found'),
                },
            });
        });

        it('should exclude caster from target list', async () => {
            const mockCombat = {
                creatures: [
                    { name: 'Ally1' },
                    { name: 'TestCharacter' },
                ],
            };
            getCombatContext.mockResolvedValue(mockCombat);
            resolveMapPositions.mockResolvedValue(null);

            const action = {
                name: 'Longstrider',
                spell: { name: 'Longstrider', range: 'Touch' },
            };

            const result = await handle(action, MOCK_PLAYER, MOCK_CAMPAIGN, null);

            expect(result.payload.creatureTargets).not.toContain('TestCharacter');
            expect(result.payload.creatureTargets).toContain('Ally1');
        });
    });

    describe('applyLongstrider', () => {
        it('should add speed_boost buff to target', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = {
                name: 'Longstrider',
                spell: { name: 'Longstrider', duration: '1 hour' },
            };

            const result = await applyLongstrider(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Longstrider',
                    description: '1 target(s) gained +10 feet speed from Longstrider.',
                },
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Longstrider',
                        effect: 'speed_boost',
                        speedBonus: 10,
                        duration: '1 hour',
                    }),
                ]),
                MOCK_CAMPAIGN
            );

            expect(addExpiration).toHaveBeenCalledWith(
                'TestCharacter',
                'Ally1',
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'remove_active_buff',
                        buffName: 'Longstrider',
                    }),
                ]),
                MOCK_CAMPAIGN
            );
        });

        it('should not duplicate buff if already active', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Longstrider', effect: 'speed_boost', speedBonus: 10 },
                ];
                return null;
            });

            const action = {
                name: 'Longstrider',
                spell: { name: 'Longstrider', duration: '1 hour' },
            };

            const result = await applyLongstrider(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Longstrider',
                    description: '1 target(s) gained +10 feet speed from Longstrider.',
                },
            });

            // Should not add a second buff
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Ally1',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Longstrider' }),
                    expect.objectContaining({ name: 'Longstrider' }),
                ])
            );
        });

        it('should apply to multiple targets', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = {
                name: 'Longstrider',
                spell: { name: 'Longstrider', duration: '1 hour' },
            };

            const result = await applyLongstrider(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1', 'Ally2']);

            expect(result.payload.description).toContain('2 target(s)');
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
        });

        it('should return null for empty target list', async () => {
            const action = {
                name: 'Longstrider',
                spell: { name: 'Longstrider' },
            };

            const result = await applyLongstrider(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, []);

            expect(result).toBeNull();
        });

        it('should use default duration when spell has no duration', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = {
                name: 'Longstrider',
                spell: { name: 'Longstrider' },
            };

            await applyLongstrider(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1 hour' }),
                ]),
                MOCK_CAMPAIGN
            );
        });

        it('should post log entry', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return null;
            });

            const action = {
                name: 'Longstrider',
                spell: { name: 'Longstrider', duration: '1 hour' },
            };

            await applyLongstrider(action, MOCK_PLAYER, MOCK_CAMPAIGN, null, ['Ally1']);

            expect(postLogEntry).toHaveBeenCalledWith(MOCK_CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Longstrider',
                description: expect.stringContaining('Longstrider'),
            }));
        });
    });
});
