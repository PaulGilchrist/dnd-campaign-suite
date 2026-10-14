import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(() => Promise.resolve(null)),
}));

describe('createNpcClickHandler - Fallback to getMonsterData', () => {
    let handler;
    let setViewingMonster;
    let setViewingMonsterCreatureName;
    let campaignNpcs;

    beforeEach(() => {
        vi.clearAllMocks();
        setViewingMonster = vi.fn();
        setViewingMonsterCreatureName = vi.fn();
        campaignNpcs = [];
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs,
            campaignName: 'test-campaign',
            characters: [],
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
    });

    it('should call getMonsterData when runtime creature has no transformation data', async () => {
        const combatSummary = {
            creatures: [
                {
                    name: 'UnknownCreature',
                    type: 'npc',
                },
            ],
        };
        vi.mocked(getCombatSummary).mockReturnValue(combatSummary);
        const fallbackMonster = { index: 'ogre', name: 'Ogre' };
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        await handler({ name: 'UnknownCreature' });

        expect(getMonsterData).toHaveBeenCalledWith('UnknownCreature');
        expect(setViewingMonster).toHaveBeenCalledWith(fallbackMonster);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('UnknownCreature');
    });

    it('should not set viewing monster when getMonsterData returns null', async () => {
        const combatSummary = {
            creatures: [
                {
                    name: 'Ghost',
                    type: 'npc',
                },
            ],
        };
        vi.mocked(getCombatSummary).mockReturnValue(combatSummary);
        vi.mocked(getMonsterData).mockResolvedValue(null);

        await handler({ name: 'Ghost' });

        expect(setViewingMonster).not.toHaveBeenCalled();
        expect(setViewingMonsterCreatureName).not.toHaveBeenCalled();
    });

});
