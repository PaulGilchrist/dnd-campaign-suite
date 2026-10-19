// @maintained-by-ai
// LANE: NPC_FORM_HANDLERS → runMonster merge path ONLY (createNpcClickHandler.js:36-38,
// npcClickFormHandlers.js runMonster :179-221): a monsterIndex runtime combatant merged onto
// its bestiary block, opened exactly once. This is the family's only runMonster pin —
// fallback #841 is deliberately formless (its :69 pins loadMonsters NOT called).
// Cite map (siblings own the rest — do not duplicate here):
//   localhost guard truth table (blocked + obeyed)    → createNpcClickHandler-early-return.test.jsx:4-6
//   npc path / format-null fall-INTO fallback / skips → createNpcClickHandler-npc-path.test.jsx (:103, :128)
//   wildshape / polymorph / shapechange form handlers  → createNpcClickHandler-{wildshape,polymorph,shapechange}.test.jsx
//   fallback hit + no-statblock no-op                  → createNpcClickHandler-fallback.test.jsx:57-93
// Old -> new map:
//   'should load monster by runtimeCreature.monsterIndex with full property merging'
//     → test 1 (strengthened: old fixture repeated base values for ac/hp/speed/saves so
//        override-vs-retain was unfalsifiable; new bytes split every runMonster override,
//        add exact-once counts, the MA-0757 ability_scores stamp (:210-212), bestiary-input
//        immutability, and fallback-not-reached attribution)
//   'should apply druid abilities and languages when runtimeCreature has wildShapeSource'
//     → test 2 (strengthened: pins runMonster's own retention branch :213-217 — the only
//        family test reaching it, since runWildShape :224 requires beastIndex, which is
//        absent here; adds exact-once counts + fallback-not-reached)
//   'should override save bonuses from runtime creature'
//     → folded into test 1 (same handler, same fixture shape; its discriminating bytes
//        dex 2→6 / con 0→3 / str stays -1 are carried over verbatim)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { loadMonsters } from '../../services/ui/dataLoader.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';

// Zero-network guard: dataLoader and monsterUtils are stubbed. The real NPC_FORM_HANDLERS
// are NOT mocked (#841 hygiene) — runMonster through the registry IS the unit under test.
// A misfiring runMonster lands on the stubbed getMonsterData instead of the network, and
// the not-called counts below catch any resulting double popup.
vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(() => Promise.resolve([])),
    fetchRaceData: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(() => Promise.resolve(null)),
}));

describe('createNpcClickHandler - runtime monsterIndex merge path', () => {
    let handler;
    let setViewingMonster;
    let setViewingMonsterCreatureName;

    beforeEach(() => {
        vi.clearAllMocks();
        setViewingMonster = vi.fn();
        setViewingMonsterCreatureName = vi.fn();
        vi.mocked(getCombatSummary).mockReturnValue(null);
        vi.mocked(loadMonsters).mockResolvedValue([]);
        vi.mocked(getMonsterData).mockResolvedValue(null);
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs: [],
            campaignName: 'test-campaign',
            characters: [
                {
                    name: 'DruidAlice',
                    computedStats: {
                        abilities: [
                            { name: 'Intelligence', score: 16 },
                            { name: 'Wisdom', score: 14 },
                            { name: 'Charisma', score: 12 },
                        ],
                        languages: ['Common', 'Elvish'],
                    },
                },
            ],
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
    });

    it('merges runtime combatant overrides onto the bestiary block and opens it exactly once', async () => {
        // Fresh fixtures with every overridden byte distinct base↔runtime
        // (bisect: delete any runMonster override line → red).
        const bestiaryGoblin = {
            index: 'goblin',
            name: 'goblin', // lowercase on disk → the name override is falsifiable
            armor_class: 15,
            hit_points: 7,
            ability_scores: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 8 },
            saving_throws: { str: { modifier: -1 }, dex: { modifier: 2 }, con: { modifier: 0 } },
            actions: [{ name: 'Morningstar', attack_bonus: 2 }],
            size: 'Small',
            type: 'Humanoid',
            challenge_rating: 0.25,
        };
        const runtimeCreature = {
            name: 'Goblin',
            type: 'npc',
            monsterIndex: 'goblin',
            ac: 17,
            currentHp: 5,
            size: 'Small',
            speed: { walk: '40 ft.' },
            saveBonuses: { dex: 6, con: 3 },
            resistances: 'cold',
            immunities: 'bludgeoning;piercing',
            actions: [{ name: 'Scimitar', attack_bonus: 4, damage_type_primary: 'Slashing', description: '4 Slashing damage' }],
            ability_scores: { str: 8, dex: 14, con: 10, int: 1, wis: 8, cha: 1 }, // MA-0757 spawn stamp
        };
        vi.mocked(getCombatSummary).mockReturnValue({ creatures: [runtimeCreature] });
        vi.mocked(loadMonsters).mockResolvedValue([bestiaryGoblin]);

        await handler({ name: 'Goblin' });

        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('Goblin');
        // Chain consumed by runMonster — the #841 fallback lane never fires.
        expect(getMonsterData).not.toHaveBeenCalled();

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.name).toBe('Goblin');
        expect(monster.armor_class).toBe(17);
        expect(monster.hit_points).toBe(5);
        expect(monster.speed).toEqual({ walk: '40 ft.' });
        expect(monster.damage_resistances).toBe('cold');
        expect(monster.damage_immunities).toBe('bludgeoning;piercing');
        expect(monster.actions).toEqual(runtimeCreature.actions);
        expect(monster.ability_scores.int).toBe(1);
        expect(monster.ability_scores.cha).toBe(1);
        // Saves: listed bonuses overridden, unlisted stay authored (:191-197).
        expect(monster.saving_throws.dex.modifier).toBe(6);
        expect(monster.saving_throws.con.modifier).toBe(3);
        expect(monster.saving_throws.str.modifier).toBe(-1);
        // Base bestiary untouched after the merge (cloned block; mutations must not leak
        // back into the shared bestiary cache consumed by later lookups).
        expect(bestiaryGoblin.name).toBe('goblin');
        expect(bestiaryGoblin.armor_class).toBe(15);
        expect(bestiaryGoblin.hit_points).toBe(7);
        expect(bestiaryGoblin.saving_throws.dex.modifier).toBe(2);
    });

    it('retains caster mental scores and languages for a monsterIndex creature bearing wildShapeSource (runMonster :213-217)', async () => {
        // No beastIndex → runWildShape :224 cannot match; this is runMonster's own
        // retained-traits branch, reached by no other family test.
        // (bisect: delete runMonster :213-217 → int/wis/cha stay beast 8/8/8 → red)
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [{
                name: 'Goblin',
                type: 'npc',
                monsterIndex: 'goblin',
                ac: 15,
                currentHp: 7,
                wildShapeSource: 'DruidAlice',
            }],
        });
        vi.mocked(loadMonsters).mockResolvedValue([
            {
                index: 'goblin',
                name: 'Goblin',
                armor_class: 15,
                hit_points: 7,
                ability_scores: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 8 },
                saving_throws: {},
                actions: [],
                size: 'Small',
                type: 'Humanoid',
                challenge_rating: 0.25,
            },
        ]);

        await handler({ name: 'Goblin' });

        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('Goblin');
        expect(getMonsterData).not.toHaveBeenCalled();

        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.ability_scores.int).toBe(16);
        expect(monster.ability_scores.wis).toBe(14);
        expect(monster.ability_scores.cha).toBe(12);
        expect(monster.languages).toBe('Common, Elvish');
    });
});
