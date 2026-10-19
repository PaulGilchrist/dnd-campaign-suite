// @maintained-by-ai
// LANE: createNpcClickHandler.js line 20 guard truth table ONLY.
// Cite map (siblings own the rest — do not duplicate here):
//   guard blocked  (!isLocalhost && !allowNonLocalhost, incl. omitted-options default) → THIS FILE
//   guard obeyed   (!isLocalhost + allowNonLocalhost:true passes click through)         → THIS FILE
//                  (CreatureCard.interactions.test.jsx:175 pins the flag is *passed*; nothing pinned that it is *obeyed*)
//   npc path / format-null fall-through / lookup skips → createNpcClickHandler-npc-path.test.jsx
//   wildshape / polymorph / shapechange form handlers   → createNpcClickHandler-{wildshape,polymorph,shapechange}.test.jsx
//   fallback hit + no-statblock no-op                   → createNpcClickHandler-fallback.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { npcToMonsterFormat } from '../../services/encounters/npcStatBlockUtils.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({
    npcToMonsterFormat: vi.fn(() => null),
}));
vi.mock('../../services/npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(() => Promise.resolve(null)),
}));

describe('createNpcClickHandler - non-localhost guard', () => {
    let setViewingMonster;
    let setViewingMonsterCreatureName;
    // Click WOULD open a popup if the guard were absent: matching NPC +
    // falsifiable format/fallback mocks (bisect: delete guard line 20 → red).
    let goblinNpc;
    let goblinFormatted;
    let handlerDeps;

    beforeEach(() => {
        vi.clearAllMocks();
        setViewingMonster = vi.fn();
        setViewingMonsterCreatureName = vi.fn();
        goblinNpc = { name: 'Goblin', hitPoints: 7 };
        goblinFormatted = { name: 'Goblin', formatted: true };
        vi.mocked(npcToMonsterFormat).mockReturnValue(goblinFormatted);
        handlerDeps = {
            campaignNpcs: [goblinNpc],
            campaignName: 'test-campaign',
            characters: [],
            setViewingMonster,
            setViewingMonsterCreatureName,
        };
    });

    it('blocks the click entirely when not localhost: explicit false and omitted options both produce zero popup, read, or fetch', async () => {
        const handler = createNpcClickHandler({
            ...handlerDeps,
            isLocalhost: false,
        });

        // Scenario 1: explicit allowNonLocalhost:false — resolves undefined.
        const explicit = await handler({ name: 'Goblin' }, { allowNonLocalhost: false });
        // Scenario 2: options omitted (default false) — same hard stop.
        const defaulted = await handler({ name: 'Goblin' });

        expect(explicit).toBeUndefined();
        expect(defaulted).toBeUndefined();
        expect(setViewingMonster).not.toHaveBeenCalled();
        expect(setViewingMonsterCreatureName).not.toHaveBeenCalled();
        expect(npcToMonsterFormat).not.toHaveBeenCalled();
        expect(getCombatSummary).not.toHaveBeenCalled();
        expect(getMonsterData).not.toHaveBeenCalled();
    });

    it('lets the click through to the monster popup when allowNonLocalhost overrides a non-localhost client', async () => {
        const kobold = { index: 'kobold', name: 'Kobold' };
        vi.mocked(getMonsterData).mockResolvedValue(kobold);

        const handler = createNpcClickHandler({
            ...handlerDeps,
            campaignNpcs: [],
            isLocalhost: false,
        });

        await handler({ name: 'Kobold' }, { allowNonLocalhost: true });

        expect(setViewingMonster).toHaveBeenCalledWith(kobold);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('Kobold');
    });
});
