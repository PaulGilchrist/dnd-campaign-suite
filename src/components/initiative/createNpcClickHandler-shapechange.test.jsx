// @maintained-by-ai
// LANE: NPC_FORM_HANDLERS → runShapechange ONLY (npcClickFormHandlers.js :154-177, guard :226).
// Shapechange-lane distinguishing bytes vs the polymorph/wildshape siblings: type is NEVER
// touched (:154-177 has no type assignment) so the form's bestiary type survives verbatim —
// polymorph hardcodes type='beast' (#844 :136) and wildshape fetches the caster's race type
// via fetchRaceData (:42-48); shapechange does neither. Also lane-specific: formName (:159,
// vs polymorph's beastName), shapechangeForm.index/challengeRating (:156/:163, vs
// polymorphBeast), and the shapechangeTempHp runtime key (:167-169, vs polymorphTempHp).
// Caster INT/WIS/CHA retention here is the SHARED applyDruidRetainedTraits path — RAW makes
// shapechange and polymorph identical on scores ("retain your Intelligence, Wisdom, Charisma"),
// so the honest difference byte is type, pinned here; the retention mechanism itself is
// already pinned by polymorph #844 test 1 and is not re-derived.
// The chain under test is NOT mocked (#791); dataLoader/monsterUtils/combatData are stubbed
// only as a zero-network guard (#841/#843).
// Cite map (siblings own the rest — do not duplicate here):
//   localhost guard truth table (blocked + obeyed)    → createNpcClickHandler-early-return.test.jsx
//   npc path / format-null fall-INTO fallback / skips → createNpcClickHandler-npc-path.test.jsx
//   fallback hit (formless) + no-statblock no-op      → createNpcClickHandler-fallback.test.jsx
//   runtime monsterIndex merge bytes + retention       → createNpcClickHandler-monster-path.test.jsx
//   polymorph merge / type='beast' / polymorphTempHp   → createNpcClickHandler-polymorph.test.jsx (#844)
//   extractBeastSaves source precedence + full save table→ createNpcClickHandler-polymorph.test.jsx :54-64/:173-181
//   wildshape merge / circleFormsAC / Lunar Radiance / race-type → createNpcClickHandler-wildshape.test.jsx
//   (queued wildshape sibling pass #845 owns any tightening of those bytes)
// Old -> new map:
//   'should load shapechange form with merged properties from base monster and runtime creature'
//     → test 1 (consolidated; strengthened: adds the lane-distinguishing type byte,
//        fetchRaceData-not-reached, formName override, exact-once counts, clone-vs-identity,
//        bestiary-input immutability, fallback-not-reached lane attribution; every override
//        byte now differs from the bestiary base — old base wis 14 == druid wis 14 made
//        wis retention unfalsifiable)
//   'should use formName from runtimeCreature when available instead of base monster name'
//     → split: override side folded into test 1; the || retain side now test 2. Old test 2
//        set runtime currentHitPoints 80 == click currentHp 80, making the ?? fallback
//        unfalsifiable (#842/#844 lesson) — test 2 carries distinct bytes (runtime null,
//        click 37, base 100).
//   'should set shapechangeTempHp when positive'
//     → folded: positive-write into test 1, zero-not-written (:168 `> 0` guard) into test 2
//   NEW test 3: guard :226 second half-clause `!!rc.shapechangeForm?.index` — matcher-false
//        seam, attributable by loadMonsters NOT called
//   NEW test 4: :157 base-not-found return-false seam — attributable by loadMonsters
//        called once, fallback popup verbatim by identity
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { loadMonsters, fetchRaceData } from '../../services/ui/dataLoader.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

// Zero-network guard: the real NPC_FORM_HANDLERS are NOT mocked (#841/#843) — runShapechange's
// matcher and merge run genuine; only the data sources are stubbed.
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
vi.mock('../../services/encounters/npcStatBlockUtils.js', () => ({
    npcToMonsterFormat: vi.fn(() => null),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
}));

// Bestiary base for the shapechange form. Every byte a runtime override may replace is chosen
// to differ from the runtime fixture below (incl. wis 12 ≠ druid 14). saving_throws stays
// empty so the extractBeastSaves/applyBeastSaves precedence table (already pinned by polymorph
// #844) is not re-tested here — only the beast-vs-druid retention seam (int -2 ≠ +3) is.
const baseDragon = {
    index: 'dragon',
    name: 'Dragon',
    armor_class: 18,
    hit_points: 100,
    ability_scores: { str: 20, dex: 10, con: 18, int: 6, wis: 12, cha: 16 },
    ability_score_modifiers: { str: 5, dex: 0, con: 4, int: -2, wis: 1, cha: 3 },
    saving_throws: {},
    actions: [
        { name: 'Bite', attack_bonus: 9, damage_type_primary: 'Piercing', description: 'Melee Weapon Attack: 12 Piercing damage' },
    ],
    size: 'Large',
    type: 'Dragon',
    challenge_rating: 3,
    speed: '40 ft.',
};

const characters = [
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
];

const makeRuntimeCreature = (overrides = {}) => ({
    name: 'DruidAlice',
    shapechangeSource: 'DruidAlice',
    shapechangeForm: { index: 'dragon', challengeRating: 5 },
    formName: 'Ancient Red Dragon',
    ac: 21,
    size: 'Huge',
    speed: { fly: '60 ft.', walk: '40 ft.' },
    ...overrides,
});

describe('createNpcClickHandler - Shapechange form path', () => {
    let handler;
    let setViewingMonster;
    let setViewingMonsterCreatureName;

    beforeEach(() => {
        vi.clearAllMocks();
        setViewingMonster = vi.fn();
        setViewingMonsterCreatureName = vi.fn();
        handler = createNpcClickHandler({
            isLocalhost: true,
            campaignNpcs: [],
            campaignName: 'test-campaign',
            characters,
            setViewingMonster,
            setViewingMonsterCreatureName,
        });
    });

    it('merges the runtime shapechange state onto the bestiary block, keeps the form type verbatim, opens the popup exactly once, and reaches neither fallback lane', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((_key, prop) => {
            if (prop === 'currentHitPoints') return 50;
            if (prop === 'shapechangeTempHp') return 20;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({ creatures: [makeRuntimeCreature()] });
        vi.mocked(loadMonsters).mockResolvedValue([baseDragon]);

        await handler({ name: 'DruidAlice' });

        expect(loadMonsters).toHaveBeenCalledTimes(1);
        expect(fetchRaceData).not.toHaveBeenCalled(); // shapechange never touches type — no race lookup like runWildShape
        expect(getMonsterData).not.toHaveBeenCalled(); // form matched — fallback lane not reached
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster).not.toBe(baseDragon); // cloned merge, not the bestiary object itself

        // Runtime overrides — every asserted byte differs from the bestiary base
        expect(monster.name).toBe('Ancient Red Dragon'); // formName :159, not base 'Dragon'
        expect(monster.hit_points).toBe(50); // runtime HP, not base 100
        expect(monster.hit_points_temp).toBe(20); // shapechangeTempHp :167-169
        expect(monster.armor_class).toBe(21); // runtime ac, not base 18
        expect(monster.size).toBe('Huge'); // runtime size, not base 'Large'
        expect(monster.challenge_rating).toBe(5); // shapechangeForm CR, not base 3
        expect(monster.speed).toEqual({ fly: '60 ft.', walk: '40 ft.' });

        // Lane-distinguishing type byte: the form's bestiary type survives verbatim —
        // NOT polymorph's hardcoded 'beast' (#844 :136), NOT the caster's race type (:42-48)
        expect(monster.type).toBe('Dragon');

        // Caster retention (shared CLA-391 path, mechanism pinned by #844): INT/WIS/CHA and
        // languages survive; STR/DEX/CON stay the dragon's
        expect(monster.ability_scores.int).toBe(16); // ≠ base 6
        expect(monster.ability_scores.wis).toBe(14); // ≠ base 12
        expect(monster.ability_scores.cha).toBe(12); // ≠ base 16
        expect(monster.ability_scores.str).toBe(20);
        expect(monster.ability_score_modifiers.int).toBe(3);
        expect(monster.ability_score_modifiers.str).toBe(5);
        expect(monster.languages).toBe('Common, Elvish');

        // Saves are the beast's own (:173 runs after retention): int stays the dragon's -2,
        // not the retained druid's +3
        expect(monster.saving_throws.int.modifier).toBe(-2);
        expect(monster.saving_throws.str.modifier).toBe(5);

        // Lunar Radiance is the wild shape lane's — shapechange natural weapons stay normal damage
        expect(monster.actions[0].damage_type_choices).toBeUndefined();
        expect(monster.actions[0].description).toBe('Melee Weapon Attack: 12 Piercing damage');

        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('DruidAlice');

        // Bestiary input object untouched by the merge
        expect(baseDragon.name).toBe('Dragon');
        expect(baseDragon.armor_class).toBe(18);
        expect(baseDragon.hit_points).toBe(100);
        expect(baseDragon.type).toBe('Dragon');
    });

    it('retains bestiary base defaults and click-carried HP when the runtime shapechange fields are absent, and writes no temp HP for zero', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((_key, prop) => {
            if (prop === 'shapechangeTempHp') return 0;
            return null; // currentHitPoints null → `?? creature.currentHp` (:160)
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeRuntimeCreature({
                formName: undefined,
                size: undefined,
                speed: undefined,
                shapechangeForm: { index: 'dragon' },
            })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseDragon]);

        await handler({ name: 'DruidAlice', currentHp: 37 });

        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.name).toBe('Dragon'); // || base name
        expect(monster.hit_points).toBe(37); // click currentHp survives the null runtime HP
        expect(monster.hit_points_temp).toBeUndefined(); // :168 guard — 0 is not written
        expect(monster.armor_class).toBe(21); // runtime ac still applies
        expect(monster.size).toBe('Large'); // || base size
        expect(monster.challenge_rating).toBe(3); // || base CR
        expect(monster.speed).toBe('40 ft.'); // base speed byte survives — runtime speed absent
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
    });

    it('skips runShapechange entirely when shapechangeSource is present but shapechangeForm is missing, falling through to the external fallback verbatim', async () => {
        // Guard :226 is a two-clause matcher; this pins the `!!rc.shapechangeForm?.index`
        // half. loadMonsters untouched proves the miss is the matcher, not a bestiary miss
        // inside runShapechange (that seam is test 4).
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [{ name: 'DruidAlice', shapechangeSource: 'DruidAlice', ac: 21, currentHp: 37 }],
        });
        const fallbackMonster = { index: 'ogre', name: 'Ogre' };
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        await handler({ name: 'DruidAlice' });

        expect(loadMonsters).not.toHaveBeenCalled();
        expect(getMonsterData).toHaveBeenCalledTimes(1);
        expect(getMonsterData).toHaveBeenCalledWith('DruidAlice');
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        expect(setViewingMonster.mock.calls[0][0]).toBe(fallbackMonster); // verbatim, unmerged
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('DruidAlice');
    });

    it('returns false and reaches the external fallback verbatim when the shapechangeForm index matches no bestiary monster', async () => {
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeRuntimeCreature({ shapechangeForm: { index: 'nonexistent', challengeRating: 5 } })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseDragon]);
        const fallbackMonster = { index: 'ogre', name: 'Ogre' };
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        await handler({ name: 'DruidAlice' });

        expect(loadMonsters).toHaveBeenCalledTimes(1); // matcher was TRUE — runShapechange ran
        expect(getMonsterData).toHaveBeenCalledTimes(1); // :157 return false → fallback reached
        expect(getMonsterData).toHaveBeenCalledWith('DruidAlice');
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        expect(setViewingMonster.mock.calls[0][0]).toBe(fallbackMonster); // not a partial merge
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
    });
});
