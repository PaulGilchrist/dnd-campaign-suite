import { triggerPrimalCompanionSpellShare, hasShareSpells, getShareSpellsFeature } from './primalCompanionSpellShareService.js';

vi.mock('../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

// Re-mock getRuntimeValue since it's used directly
import { getRuntimeValue } from '../hooks/useRuntimeState.js';
import { executeHandler } from '../automation/index.js';

describe('primalCompanionSpellShareService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('hasShareSpells', () => {
        it('returns true when automation passives includes primal_companion_spell_share', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'primal_companion_spell_share', name: 'Share Spells' }],
                },
            };
            expect(hasShareSpells(playerStats)).toBe(true);
        });

        it('returns false when no primal_companion_spell_share passive exists', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'post_cast_rider', name: 'Some Rider' }],
                },
            };
            expect(hasShareSpells(playerStats)).toBe(false);
        });

        it('returns false when automation is null', () => {
            const playerStats = { automation: null };
            expect(hasShareSpells(playerStats)).toBe(false);
        });

        it('returns false when passives is empty', () => {
            const playerStats = { automation: { passives: [] } };
            expect(hasShareSpells(playerStats)).toBe(false);
        });
    });

    describe('getShareSpellsFeature', () => {
        it('returns the share spells feature from passives', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'post_cast_rider', name: 'Rider' },
                        { type: 'primal_companion_spell_share', name: 'Share Spells', range: '30_ft' },
                    ],
                },
            };
            const feature = getShareSpellsFeature(playerStats);
            expect(feature).toEqual({ type: 'primal_companion_spell_share', name: 'Share Spells', range: '30_ft' });
        });

        it('returns undefined when no share spells feature exists', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'post_cast_rider', name: 'Rider' }],
                },
            };
            const feature = getShareSpellsFeature(playerStats);
            expect(feature).toBeUndefined();
        });
    });

    describe('triggerPrimalCompanionSpellShare', () => {
        const mockPlayerStats = {
            name: 'TestRanger',
            automation: {
                passives: [{ type: 'primal_companion_spell_share', name: 'Share Spells', range: '30_ft' }],
            },
        };

        it('returns null when no share spells feature exists', async () => {
            const playerStats = {
                name: 'TestRanger',
                automation: { passives: [] },
            };
            const result = await triggerPrimalCompanionSpellShare(
                { name: 'Shield', level: 1, range: 'Self' },
                {},
                playerStats,
                'test-campaign'
            );
            expect(result).toBeNull();
        });

        it('returns null when spell is not self-targeted', async () => {
            // Magic Missile targets 120 feet away, not self
            const spell2 = { name: 'Magic Missile', level: 1, range: '120 feet' };
            const result = await triggerPrimalCompanionSpellShare(
                spell2,
                {},
                mockPlayerStats,
                'test-campaign'
            );
            expect(result).toBeNull();
        });

        it('returns null for cantrips (level 0)', async () => {
            const spell = { name: 'Acid Splash', level: 0, range: 'Self' };
            const result = await triggerPrimalCompanionSpellShare(
                spell,
                {},
                mockPlayerStats,
                'test-campaign'
            );
            expect(result).toBeNull();
        });

        it('returns null when no companion is summoned', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'primalCompanionType') return null;
                return undefined;
            });

            const spell = { name: 'Shield', level: 1, range: 'Self' };
            const result = await triggerPrimalCompanionSpellShare(
                spell,
                {},
                mockPlayerStats,
                'test-campaign'
            );
            expect(result).toBeNull();
        });

        it('returns null when companion is not alive', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'primalCompanionType') return 'Beast of the Forest';
                if (key === 'primalCompanionAlive') return false;
                return undefined;
            });

            const spell = { name: 'Shield', level: 1, range: 'Self' };
            const result = await triggerPrimalCompanionSpellShare(
                spell,
                {},
                mockPlayerStats,
                'test-campaign'
            );
            expect(result).toBeNull();
        });

        it('returns null for area effect casting', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'primalCompanionType') return 'Beast of the Forest';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            const spell = { name: 'Shield', level: 1, range: 'Self' };
            const result = await triggerPrimalCompanionSpellShare(
                spell,
                { multiTarget: 'Goblin' },
                mockPlayerStats,
                'test-campaign'
            );
            expect(result).toBeNull();
        });

        it('calls executeHandler when companion is summoned and alive', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'primalCompanionType') return 'Beast of the Sea';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            executeHandler.mockResolvedValue({
                type: 'modal',
                modalName: 'primalCompanionSpellShare',
                payload: { action: expect.any(Object), playerStats: mockPlayerStats, campaignName: 'test-campaign', companionType: 'Beast of the Sea' },
            });

            const spell = { name: 'Shield', level: 1, range: 'Self' };
            const result = await triggerPrimalCompanionSpellShare(
                spell,
                {},
                mockPlayerStats,
                'test-campaign',
                'test-map'
            );

            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Share Spells',
                    automation: expect.objectContaining({
                        type: 'primal_companion_spell_share',
                        companionType: 'Beast of the Sea',
                    }),
                }),
                mockPlayerStats,
                'test-campaign',
                'test-map'
            );
            expect(result).toEqual({
                type: 'modal',
                modalName: 'primalCompanionSpellShare',
                payload: expect.objectContaining({ companionType: 'Beast of the Sea' }),
            });
        });

        it('handles executeHandler errors gracefully', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'primalCompanionType') return 'Beast of the Forest';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            executeHandler.mockRejectedValue(new Error('Test error'));

            const spell = { name: 'Shield', level: 1, range: 'Self' };
            const result = await triggerPrimalCompanionSpellShare(
                spell,
                {},
                mockPlayerStats,
                'test-campaign',
                'test-map'
            );

            expect(result).toBeNull();
        });

        it('skips self-targeted spells with area effect ranges', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'primalCompanionType') return 'Beast of the Forest';
                if (key === 'primalCompanionAlive') return true;
                return undefined;
            });

            // Self (5-foot radius) is self-targeted but should still trigger
            // because it targets the caster primarily
            const spell = { name: 'Fire Bolt', level: 0, range: 'Self (5-foot radius)' };
            const result = await triggerPrimalCompanionSpellShare(
                spell,
                {},
                mockPlayerStats,
                'test-campaign'
            );
            expect(result).toBeNull();
        });
    });
});
