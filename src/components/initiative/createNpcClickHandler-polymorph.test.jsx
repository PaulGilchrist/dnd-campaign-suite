// @maintained-by-ai
// LANE: NPC_FORM_HANDLERS → runPolymorph ONLY (npcClickFormHandlers.js :128-152, guard :225).
// Polymorph-lane distinguishing bytes vs the shapechange/wildshape siblings: type='beast'
// hardcoded override (:136 — wildshape retains the caster's race type via fetchRaceData,
// shapechange never touches type), unconditional armor_class = runtimeCreature.ac (:135),
// and the polymorphTempHp runtime key (:142-144). The chain under test is NOT mocked (#791);
// dataLoader/monsterUtils/combatData are stubbed only as a zero-network guard (#841/#843).
// Cite map (siblings own the rest — do not duplicate here):
//   localhost guard truth table (blocked + obeyed)    → createNpcClickHandler-early-return.test.jsx
//   npc path / format-null fall-INTO fallback / skips → createNpcClickHandler-npc-path.test.jsx
//   fallback hit (formless) + no-statblock no-op      → createNpcClickHandler-fallback.test.jsx:57-93
//   runtime monsterIndex merge bytes + retention        → createNpcClickHandler-monster-path.test.jsx
//   wildshape merge / circleFormsAC / Lunar Radiance    → createNpcClickHandler-wildshape.test.jsx
//   shapechange merge / shapechangeTempHp               → createNpcClickHandler-shapechange.test.jsx
// Old -> new map:
//   'load polymorph form ... all merged properties' + 'use beastName when available'
//     + 'set polymorphTempHp when positive' + 'apply druid abilities and languages'
//     + 'keep the beast normal damage types' + 'ability_score_modifiers for saving throws'
//     → test 1 (consolidated; strengthened: every override byte now differs from the
//        bestiary base — old fixture repeated ac 11/hp 34 making override-vs-retain
//        unfalsifiable for size — adds exact-once counts, clone-vs-identity,
//        saving_throws-source precedence (str 6 ≠ derived 4), input immutability, and
//        fallback-not-reached / fetchRaceData-not-reached lane attribution)
//   'fall back to creature.currentHp when runtime currentHitPoints is null'
//     + 'use base monster challenge_rating when missing' + 'base size when runtime size missing'
//     → test 2 (consolidated retain-side: every `|| base` / `?? click` byte in one click;
//        adds tempHp-zero-not-written, the || side of name, and base speed survival)
//   'should not set viewing monster when polymorphBeast is missing'
//     → test 3 (strengthened: no-statblock null result made the silent popup ambiguous;
//        now polymorphSource PRESENT but beast absent pins the second guard clause of
//        :225 — loadMonsters untouched attributes the miss to the matcher, not to a
//        bestiary lookup — and the fallback popup is pinned verbatim by identity)
//   'should not set viewing monster when base monster not found'
//     → test 4 (strengthened: same miss now falls THROUGH to a fallback HIT, so both
//        runPolymorph exit seams — matcher-false (test 3) and base-not-found return
//        false (:131) — are each attributable by their loadMonsters byte count)
//   'should fall back to getMonsterData when no polymorph form exists'
//     → CUT, covered by createNpcClickHandler-fallback.test.jsx:57-78 — same face
//        (formless runtime creature → verbatim getMonsterData popup + creature name).
//        Its polymorph-specific residue (guard half-clause `!!rc.polymorphBeast?.index`)
//        is what test 3 newly pins instead, so no byte of the polymorph lane is lost.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { loadMonsters, fetchRaceData } from '../../services/ui/dataLoader.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

// Zero-network guard: the real NPC_FORM_HANDLERS are NOT mocked (#841/#843) — runPolymorph's
// matchers and merge run genuine; only the data sources are stubbed.
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

// Bestiary base. Every byte a polymorph override may replace is chosen to differ from the
// runtime fixture below. saving_throws carries ONLY str (+6, ≠ its derived +4) so the
// extractBeastSaves source precedence (saving_throws over ability_score_modifiers,
// npcClickFormHandlers.js :54-64) is falsifiable; the remaining five saves derive.
const baseBear = {
    index: 'bear',
    name: 'Brown Bear',
    armor_class: 11,
    hit_points: 34,
    ability_scores: { str: 19, dex: 10, con: 16, int: 3, wis: 13, cha: 7 },
    ability_score_modifiers: { str: 4, dex: 0, con: 3, int: -4, wis: 1, cha: -2 },
    saving_throws: { str: { modifier: 6 } },
    actions: [
        { name: 'Bite', attack_bonus: 5, damage_type_primary: 'Bludgeoning', description: 'Melee Weapon Attack: 5 Bludgeoning damage' },
    ],
    size: 'Large',
    type: 'Beast',
    challenge_rating: 1,
    speed: '30 ft.',
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
    polymorphSource: 'DruidAlice',
    polymorphBeast: { index: 'bear', challengeRating: 2 },
    beastName: 'Greater Bear Form',
    ac: 14,
    size: 'Huge',
    speed: { walk: '40 ft.' },
    ...overrides,
});

describe('createNpcClickHandler - Polymorph form path', () => {
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

    it('merges the runtime polymorph state onto the bestiary block, opens the popup exactly once, and reaches neither fallback lane', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((_key, prop) => {
            if (prop === 'currentHitPoints') return 25;
            if (prop === 'polymorphTempHp') return 10;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({ creatures: [makeRuntimeCreature()] });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice' });

        expect(loadMonsters).toHaveBeenCalledTimes(1);
        expect(fetchRaceData).not.toHaveBeenCalled(); // :136 hardcodes type — no race lookup like runWildShape
        expect(getMonsterData).not.toHaveBeenCalled(); // form matched — fallback lane not reached
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster).not.toBe(baseBear); // cloned merge, not the bestiary object itself

        // Runtime overrides — every asserted byte differs from the bestiary base
        expect(monster.name).toBe('Greater Bear Form'); // beastName :133
        expect(monster.hit_points).toBe(25); // runtime HP, not base 34
        expect(monster.hit_points_temp).toBe(10); // :142-144
        expect(monster.armor_class).toBe(14); // runtime ac, not base 11
        expect(monster.type).toBe('beast'); // :136 lowercase override of base 'Beast'
        expect(monster.size).toBe('Huge'); // runtime size, not base 'Large'
        expect(monster.challenge_rating).toBe(2); // beast CR, not base 1
        expect(monster.speed).toEqual({ walk: '40 ft.' });

        // CLA-391 caster retention: INT/WIS/CHA and languages survive the merge;
        // all other abilities stay the bear's
        expect(monster.ability_scores.int).toBe(16);
        expect(monster.ability_scores.wis).toBe(14);
        expect(monster.ability_scores.cha).toBe(12);
        expect(monster.ability_scores.str).toBe(19);
        expect(monster.ability_score_modifiers.int).toBe(3);
        expect(monster.ability_score_modifiers.wis).toBe(2);
        expect(monster.ability_score_modifiers.cha).toBe(1);
        expect(monster.ability_score_modifiers.str).toBe(4);
        expect(monster.languages).toBe('Common, Elvish');

        // Saves are the beast's own bytes extracted from the ORIGINAL base (:148 runs
        // after retention): str keeps its explicit +6 (not derived +4), int keeps the
        // bear's -4 (not the retained druid's +3)
        expect(monster.saving_throws.str.modifier).toBe(6);
        expect(monster.saving_throws.dex.modifier).toBe(0);
        expect(monster.saving_throws.con.modifier).toBe(3);
        expect(monster.saving_throws.int.modifier).toBe(-4);
        expect(monster.saving_throws.wis.modifier).toBe(1);
        expect(monster.saving_throws.cha.modifier).toBe(-2);

        // Lunar Radiance is the wild shape lane's — polymorph natural weapons stay normal damage
        expect(monster.actions[0].damage_type_choices).toBeUndefined();
        expect(monster.actions[0].description).toBe('Melee Weapon Attack: 5 Bludgeoning damage');

        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('DruidAlice');

        // Bestiary input object untouched by the merge
        expect(baseBear.name).toBe('Brown Bear');
        expect(baseBear.armor_class).toBe(11);
        expect(baseBear.hit_points).toBe(34);
        expect(baseBear.type).toBe('Beast');
    });

    it('retains bestiary base defaults and click-carried HP when the runtime form fields are absent', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((_key, prop) => {
            if (prop === 'polymorphTempHp') return 0;
            return null; // currentHitPoints null → `?? creature.currentHp` (:134)
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeRuntimeCreature({
                beastName: undefined,
                size: undefined,
                speed: undefined,
                polymorphBeast: { index: 'bear' },
            })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handler({ name: 'DruidAlice', currentHp: 25 });

        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.name).toBe('Brown Bear'); // || base name
        expect(monster.hit_points).toBe(25); // click currentHp survives the null runtime HP
        expect(monster.hit_points_temp).toBeUndefined(); // :143 guard — 0 is not written
        expect(monster.armor_class).toBe(14); // runtime ac still applies
        expect(monster.size).toBe('Large'); // || base size
        expect(monster.challenge_rating).toBe(1); // || base CR
        expect(monster.speed).toBe('30 ft.'); // base speed byte survives — runtime speed absent
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
    });

    it('skips runPolymorph entirely when polymorphSource is present but polymorphBeast is missing, falling through to the external fallback verbatim', async () => {
        // Guard :225 is a two-clause matcher; this pins the `!!rc.polymorphBeast?.index`
        // half. loadMonsters untouched proves the miss is the matcher, not a bestiary
        // miss inside runPolymorph (that seam is test 4).
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [{ name: 'DruidAlice', polymorphSource: 'DruidAlice', ac: 14, currentHp: 25 }],
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

    it('returns false and reaches the external fallback verbatim when the polymorphBeast index matches no bestiary monster', async () => {
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeRuntimeCreature({ polymorphBeast: { index: 'nonexistent', challengeRating: 2 } })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);
        const fallbackMonster = { index: 'ogre', name: 'Ogre' };
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        await handler({ name: 'DruidAlice' });

        expect(loadMonsters).toHaveBeenCalledTimes(1); // matcher was TRUE — runPolymorph ran
        expect(getMonsterData).toHaveBeenCalledTimes(1); // :131 return false → fallback reached
        expect(getMonsterData).toHaveBeenCalledWith('DruidAlice');
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        expect(setViewingMonster.mock.calls[0][0]).toBe(fallbackMonster); // not a partial merge
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
    });
});
