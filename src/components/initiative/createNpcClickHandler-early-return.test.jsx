import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';

describe('createNpcClickHandler - early return for non-localhost', () => {
    let setViewingMonster;
    let setViewingMonsterCreatureName;
    let campaignNpcs;
    let characters;

    beforeEach(() => {
        vi.clearAllMocks();
        setViewingMonster = vi.fn();
        setViewingMonsterCreatureName = vi.fn();
        campaignNpcs = [];
        characters = [
            {
                name: 'DruidAlice',
                computedStats: {
                    hitPoints: 20,
                    currentHitPoints: 20,
                    armorClass: 15,
                    abilities: [
                        { name: 'Intelligence', score: 16 },
                        { name: 'Wisdom', score: 14 },
                        { name: 'Charisma', score: 12 },
                    ],
                    languages: ['Common', 'Elvish'],
                    class: { major: { name: 'Circle of the Moon' } },
                },
            },
        ];
    });

    it('should return undefined without calling setters when not localhost and allowNonLocalhost is false', async () => {
        const handler = createNpcClickHandler({
            isLocalhost: false,
            campaignNpcs,
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });

        const result = await handler({ name: 'Goblin' });

        expect(result).toBeUndefined();
        expect(setViewingMonster).not.toHaveBeenCalled();
        expect(setViewingMonsterCreatureName).not.toHaveBeenCalled();
    });

});
