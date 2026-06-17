import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
    },
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';

describe('useInitiativeEffects', () => {
    const mockPlayerStats = {
        name: 'TestMonk',
        level: 15,
        class: {
            name: 'Monk',
            class_levels: [{ level: 15, focus_points: 6 }],
        },
        abilities: [{ name: 'Wisdom', bonus: 4 }],
        automation: {
            passives: [],
            actions: [],
        },
        actions: [],
    };

    const mockCampaignName = 'test-campaign';
    const mockRollDamage = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
        utils.getName.mockImplementation((n) => n);
    });

    function createHook() {
        return renderHook(() => useInitiativeEffects(mockPlayerStats, mockCampaignName, mockRollDamage));
    }

    describe('initiative-rolled event', () => {
        it('does nothing when event detail is missing', () => {
            createHook();
            window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: null }));
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does nothing when characterName is missing from event', () => {
            createHook();
            window.dispatchEvent(new CustomEvent('initiative-rolled', { detail: { roll: 15 } }));
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does nothing when rolling name does not match player name', () => {
            createHook();
            window.dispatchEvent(new CustomEvent('initiative-rolled', {
                detail: { characterName: 'OtherPlayer', roll: 15 },
            }));
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('recovers focus points when hasFocusPointsAction and not perfect focus', () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'uncannyMetabolismUsed') return null;
                if (key === 'focusPoints') return 3;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                actions: [{ automation: { type: 'initiative_action', effect: 'other' } }],
                class: { ...mockPlayerStats.class, class_levels: [{ level: 15, focus_points: 6 }] },
            };
            const { rerender } = renderHook(() => useInitiativeEffects(stats, mockCampaignName, mockRollDamage));
            rerender();
            window.dispatchEvent(new CustomEvent('initiative-rolled', {
                detail: { characterName: 'TestMonk', roll: 15 },
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 6, 'test-campaign');
        });

        it('recovers focus points to 4 with perfect focus when <= 3', () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'uncannyMetabolismUsed') return null;
                if (key === 'focusPoints') return 2;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    ...mockPlayerStats.automation,
                    passives: [{ type: 'passive_rule', effect: 'perfect_focus' }],
                },
                class: { ...mockPlayerStats.class, class_levels: [{ level: 15, focus_points: 4 }] },
            };
            const { rerender } = renderHook(() => useInitiativeEffects(stats, mockCampaignName, mockRollDamage));
            rerender();
            window.dispatchEvent(new CustomEvent('initiative-rolled', {
                detail: { characterName: 'TestMonk', roll: 15 },
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'focusPoints', 4, 'test-campaign');
        });

        it('does not recover focus points with perfect focus when uncanny metabolism was used', () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'uncannyMetabolismUsed') return true;
                if (key === 'focusPoints') return 2;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    ...mockPlayerStats.automation,
                    passives: [{ type: 'passive_rule', effect: 'perfect_focus' }],
                },
            };
            const { rerender } = renderHook(() => useInitiativeEffects(stats, mockCampaignName, mockRollDamage));
            rerender();
            window.dispatchEvent(new CustomEvent('initiative-rolled', {
                detail: { characterName: 'TestMonk', roll: 15 },
            }));
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestMonk', 'focusPoints', expect.any(Number), 'test-campaign');
        });

        it('recovers wild shape use with evergreen wild shape', () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'uncannyMetabolismUsed') return null;
                if (key === 'wildShapeUses') return 0;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                level: 18,
                actions: [{ automation: { type: 'initiative_action', effect: 'wild_shape_regen_on_initiative' } }],
                class: { ...mockPlayerStats.class, class_levels: [{ level: 18, wild_shape: 3 }] },
            };
            const { rerender } = renderHook(() => useInitiativeEffects(stats, mockCampaignName, mockRollDamage));
            rerender();
            window.dispatchEvent(new CustomEvent('initiative-rolled', {
                detail: { characterName: 'TestMonk', roll: 15 },
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'wildShapeUses', 1, 'test-campaign');
        });

        it('recovers rage uses with persistent rage', () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'uncannyMetabolismUsed') return null;
                if (key === 'ragePoints') return 1;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                class: { ...mockPlayerStats.class, name: 'Barbarian', class_levels: [{ level: 15, rages: 4 }] },
                automation: {
                    ...mockPlayerStats.automation,
                    passives: [{ type: 'passive_rule', effect: 'persistent_rage' }],
                },
            };
            const { rerender } = renderHook(() => useInitiativeEffects(stats, mockCampaignName, mockRollDamage));
            rerender();
            window.dispatchEvent(new CustomEvent('initiative-rolled', {
                detail: { characterName: 'TestMonk', roll: 15 },
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'ragePoints', 4, 'test-campaign');
        });

        it('regains bardic inspiration with superior inspiration', () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'uncannyMetabolismUsed') return null;
                if (key === 'focusPoints') return null;
                if (key === 'bardicInspirationUses') return 0;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                class: { ...mockPlayerStats.class, name: 'Bard' },
                automation: {
                    ...mockPlayerStats.automation,
                    actions: [{ type: 'initiative_action', effect: 'regain_bardic_inspiration_on_initiative' }],
                },
                proficiency: 6,
            };
            const { rerender } = renderHook(() => useInitiativeEffects(stats, mockCampaignName, mockRollDamage));
            rerender();
            window.dispatchEvent(new CustomEvent('initiative-rolled', {
                detail: { characterName: 'TestMonk', roll: 15 },
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'bardicInspirationUses', 2, 'test-campaign');
        });
    });

    describe('turn-undead-result event', () => {
        it('applies searing undead radiant damage to failed targets', () => {
            const stats = {
                ...mockPlayerStats,
                name: 'Cleric',
                automation: {
                    ...mockPlayerStats.automation,
                    actions: [{ name: 'Searing Undead', type: 'damage_bonus', trigger: 'turn_undead_fail', damageType: 'Radiant' }],
                },
                abilities: [{ name: 'Wisdom', bonus: 4 }],
            };
            rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
            const { rerender } = renderHook(() => useInitiativeEffects(stats, mockCampaignName, mockRollDamage));
            rerender();
            window.dispatchEvent(new CustomEvent('turn-undead-result', {
                detail: {
                    attackerName: 'Cleric',
                    campaignName: 'test-campaign',
                    failedTargets: ['Goblin', 'Zombie'],
                    saveDc: 13,
                    saveType: 'WIS',
                },
            }));
            expect(mockRollDamage).toHaveBeenCalledTimes(2);
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Searing Undead',
                '4d8',
                4,
                [4],
                0,
                expect.objectContaining({
                    damageType: 'Radiant',
                    attackerName: 'Cleric',
                })
            );
        });

        it('does nothing when attackerName does not match player', () => {
            createHook();
            window.dispatchEvent(new CustomEvent('turn-undead-result', {
                detail: {
                    attackerName: 'OtherCleric',
                    campaignName: 'test-campaign',
                    failedTargets: ['Goblin'],
                },
            }));
            expect(mockRollDamage).not.toHaveBeenCalled();
        });

        it('does nothing when campaignName does not match', () => {
            createHook();
            window.dispatchEvent(new CustomEvent('turn-undead-result', {
                detail: {
                    attackerName: 'TestMonk',
                    campaignName: 'other-campaign',
                    failedTargets: ['Goblin'],
                },
            }));
            expect(mockRollDamage).not.toHaveBeenCalled();
        });

        it('does nothing when no searing undead action exists', () => {
            createHook();
            window.dispatchEvent(new CustomEvent('turn-undead-result', {
                detail: {
                    attackerName: 'TestMonk',
                    campaignName: 'test-campaign',
                    failedTargets: ['Goblin'],
                },
            }));
            expect(mockRollDamage).not.toHaveBeenCalled();
        });

        it('does nothing when rollExpression returns null', () => {
            rollExpression.mockReturnValue(null);
            createHook();
            window.dispatchEvent(new CustomEvent('turn-undead-result', {
                detail: {
                    attackerName: 'TestMonk',
                    campaignName: 'test-campaign',
                    failedTargets: ['Goblin'],
                },
            }));
            expect(mockRollDamage).not.toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('removes event listeners on unmount', () => {
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
            const { unmount } = createHook();
            unmount();
            expect(removeEventListenerSpy).toHaveBeenCalledWith('initiative-rolled', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('turn-undead-result', expect.any(Function));
            removeEventListenerSpy.mockRestore();
        });
    });
});
