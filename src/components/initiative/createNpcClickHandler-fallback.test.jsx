// @maintained-by-ai
// LANE: createNpcClickHandler.js lines 40-45 — external getMonsterData fallback ONLY
// ("fallback hit + no-statblock no-op", per the cite map in createNpcClickHandler-early-return.test.jsx:9).
// Cite map (siblings own the rest — do not duplicate here):
//   localhost guard truth table (blocked + obeyed)      → createNpcClickHandler-early-return.test.jsx:4-6
//   npc path / format-null fall-INTO fallback / skips   → createNpcClickHandler-npc-path.test.jsx (:103, :128)
//   wildshape / polymorph / shapechange form handlers    → createNpcClickHandler-{wildshape,polymorph,shapechange}.test.jsx
//   runtime monsterIndex merge path                      → createNpcClickHandler-monster-path.test.jsx
// Old -> new map:
//   'should call getMonsterData when runtime creature has no transformation data'
//     → test 1 (strengthened: exact-once counts, verbatim popup-object identity, zero-network guard)
//   'should not set viewing monster when getMonsterData returns null'
//     → test 2 (strengthened: pins that the lookup was reached, so the silent popup is
//        attributable to the null-statblock branch — not an accidental early return)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';
import { loadMonsters } from '../../services/ui/dataLoader.js';

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(() => Promise.resolve(null)),
}));
// Zero-network guard: the real NPC_FORM_HANDLERS are NOT mocked here (the fallback must
// be reached through the genuine chain). Their run() bodies reach the network via
// dataLoader.loadMonsters, so the loader is stubbed empty — no fetch is possible, and a
// fixture that drifts into matching a form handler still lands on the fallback.
vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(() => Promise.resolve([])),
    fetchRaceData: vi.fn(() => Promise.resolve(null)),
}));

describe('createNpcClickHandler - fallback to getMonsterData', () => {
    let handler;
    let setViewingMonster;
    let setViewingMonsterCreatureName;

    beforeEach(() => {
        vi.clearAllMocks();
        setViewingMonster = vi.fn();
        setViewingMonsterCreatureName = vi.fn();
        // No NPC twin in campaignNpcs: this is the custom/combat-only creature
        // lane where the external bestiary lookup is the last resort.
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs: [],
            campaignName: 'test-campaign',
            characters: [],
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
    });

    it('opens the popup from getMonsterData for a combat creature with no NPC twin and no form data, exactly once, verbatim', async () => {
        // Runtime creature present but formless: matches() on every real
        // NPC_FORM_HANDLER must be false (bisect: delete lines 41-45 → red).
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [{ name: 'UnknownCreature', type: 'npc' }],
        });
        const fallbackMonster = { index: 'ogre', name: 'Ogre' };
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        const result = await handler({ name: 'UnknownCreature' });

        expect(result).toBeUndefined();
        expect(loadMonsters).not.toHaveBeenCalled();
        expect(getMonsterData).toHaveBeenCalledTimes(1);
        expect(getMonsterData).toHaveBeenCalledWith('UnknownCreature');
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        // The popup receives the fetched monster object verbatim (identity,
        // not a merged/cloned block a form handler would have produced).
        expect(setViewingMonster.mock.calls[0][0]).toBe(fallbackMonster);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('UnknownCreature');
    });

    it('is a silent no-op when the external lookup returns no statblock, having reached getMonsterData', async () => {
        // No statblock anywhere: no runtime summary at all, unknown name.
        vi.mocked(getCombatSummary).mockReturnValue(null);
        vi.mocked(getMonsterData).mockResolvedValue(null);

        const result = await handler({ name: 'Ghost' });

        expect(result).toBeUndefined();
        // Reached-and-null (not early-returned): without this the no-popup
        // assertions would pass for the wrong reason.
        expect(getMonsterData).toHaveBeenCalledWith('Ghost');
        expect(setViewingMonster).not.toHaveBeenCalled();
        expect(setViewingMonsterCreatureName).not.toHaveBeenCalled();
    });
});
