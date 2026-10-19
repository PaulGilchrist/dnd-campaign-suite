// @maintained-by-ai
// LANE: NPC_FORM_HANDLERS → runWildShape ONLY (npcClickFormHandlers.js :96-126, guard :224).
// Family finale — all 7 lanes of the npcClick family are now maintained.
// Wildshape-lane distinguishing bytes vs the polymorph/shapechange siblings:
//   - race-derived type via fetchRaceData (:109 → applyDruidRetainedCreatureType :42-48) —
//     polymorph #844 hardcodes type='beast', shapechange #845 never touches type; ONLY this
//     lane looks the caster's race up, and only when race exists (:43) and creature_type
//     exists (:47) — both guards pinned here (tests 4-5).
//   - circleFormsAC is the lane's ONLY armor key (:103-106): runtimeCreature.ac is present in
//     the fixture but deliberately unread here (polymorph/shapechange read it unconditionally).
//     Lane runtime keys are exactly currentHitPoints(+campaign, :102) and circleFormsAC
//     (NO campaign arg, :103) — getRuntimeValue call-count 2 pins that neither sibling's key
//     (polymorphTempHp/shapechangeTempHp) is read on this lane (#845: the old file's use of
//     its key was an inert default — deleted here as noise).
//   - Moon CON save buff: beast con save + WIS mod (:112-115), gated on CLASS (:73-76) —
//     independent of the lunar_radiance PASSIVE gate (:78-82). Class-true/passive-false is a
//     distinct matrix cell pinned by test 3; class-false by test 2.
//   - Lunar Radiance natural-weapon tagging (:117-119) then lunarFormAction APPEND (:120-122):
//     append runs AFTER radiance, so the appended Lunar Form action stays untagged —
//     actions[2].damage_type_choices undefined pins the :117/:120 order (test 1).
//   - wildshape NEVER copies runtime size/speed/challenge_rating (bytes polymorph :137-141 /
//     shapechange :162-165 do copy): runtime fixture carries size/speed here, base bytes must
//     survive (test 1).
// No hit_points_temp exists in this lane — the temp-HP write is pinned absent via the
// getRuntimeValue call-count of exactly 2 (test 1).
// The chain under test is NOT mocked (#791); dataLoader/monsterUtils/combatData/npcStatBlockUtils
// are stubbed only as a zero-network guard (#841/#843). fetchRaceData is THIS lane's one
// legitimate fetch seam — faked, consumers asserted exactly-once (tests 4-5, not-called here
// elsewhere: caster has no race until test 4).
// Cite map (siblings own the rest — do not duplicate here):
//   localhost guard truth table (blocked + obeyed)    → createNpcClickHandler-early-return.test.jsx
//   npc path / format-null fall-INTO fallback / skips → createNpcClickHandler-npc-path.test.jsx
//   fallback hit (formless) + no-statblock no-op      → createNpcClickHandler-fallback.test.jsx
//   runtime monsterIndex merge bytes + retention       → createNpcClickHandler-monster-path.test.jsx
//   polymorph merge / type='beast' / polymorphTempHp   → createNpcClickHandler-polymorph.test.jsx (#844)
//   shapechange merge / type verbatim / shapechangeTempHp → createNpcClickHandler-shapechange.test.jsx (#845)
//   extractBeastSaves source precedence (saving_throws vs ability_score_modifiers, full table)
//     → createNpcClickHandler-polymorph.test.jsx #844 :173-181 — only the wildshape-only Moon
//       CON-buff overlay is pinned here
// Old -> new map:
//   'should load wild shape form with basic beast data and druid overrides'
//     → test 1 (consolidated + strengthened: absorbs circleFormsAC, saves, Lunar Radiance and
//        lunarFormAction tests; every override byte now differs from the bestiary base — old
//        fixture shared base name 'Brown Bear' == beastName and ac 11 == runtime, making
//        override-vs-retain unfalsifiable (#842/#844 lesson); adds exact-once counts,
//        getRuntimeValue lane-key args + call-count 2, fetchRaceData/getMonsterData not-called,
//        clone-not-identity, bestiary-input immutability, size/speed non-copy bytes)
//   'should apply circleFormsAC when set' → folded into test 1 (circleFormsAC 19 ≠ ac 14 ≠
//        base 11 — proves :103 is the only AC read)
//   'should set saving throws from base monster saving_throws' → folded into test 1 (explicit
//        str/dex/con; the int→ability_score_modifiers fallback byte is #844 :179, not
//        re-derived here)
//   'should fall back to ability_score_modifiers for saving throws when saving_throws missing'
//     → REMOVED: shared extractBeastSaves precedence table already pinned verbatim by
//        polymorph #844 :173-181; re-testing it on a cat fixture added only duplication
//   'should tag attacks with Lunar Radiance ... lv6+' → folded into test 1 (name said lv6+
//        but code gates on the passive flag, :78-82 — test 3 pins that honest distinction)
//   'should not add Lunar Radiance choices for Moon Druid below level 6'
//     → test 3 (rewritten to the real seam: moon class TRUE + passive FALSE → weapons stay
//        normal BUT CON save still buffed — the two gates are independent)
//   'should not convert or tag attacks for non-Moon druid wild shape' → folded into test 2
//   'should add lunarFormAction when present' → folded into test 1 (:120-122 positive, with
//        the post-radiance append-order byte)
//   'should use druidCharacter abilities fallback when computedStats missing' → folded into
//        test 4 (raw-disk fixture exercises the same `computedStats?.abilities || abilities`
//        :12 and languages :37 branches — old test 9 and d2 test 1 were the same seam twice)
//   'should match druid character by name with suffix' → folded into test 2 (:51 startsWith
//        branch is this family's only pin of that matcher)
//   'should not modify CON save for non-Moon Druid' → folded into test 2 (con stays beast's
//        own when class gate is false)
//   'should fall back to creature.currentHp when runtime currentHitPoints is null'
//     → folded into test 2 (:102 `?? creature.currentHp` retain side; old fixture runtime 15 /
//        click 25 pinned override but click byte equaled nothing distinct on the retain run —
//        now runtime null, click 28, base 34, three distinct bytes)
//   'retains druid INT/WIS/CHA derived from baseScore+increases' + 'retains the druid
//        humanoid creature type and merges languages'
//     → test 4 (consolidated: one popup payload carries all CLA-391 bytes; strengthened to
//        exercise ALL FOUR ABILITY_INCREASE_KEYS (:5) — old fixture only used
//        backgroundIncrease — wis now 16+miscIncrease=17 and cha 8+feat+racial=10; adds
//        fetchRaceData exact-once args, popup exact-once, fallback-not-reached, rat's
//        str/dex non-retention bytes)
//   'keeps the beast type when race data carries no creature_type'
//     → test 5 (kept: distinct :47 `if (creatureType)` guard byte — falsifiable only with a
//        second fetchRaceData return shape)
//   NEW test 6: guard :224 second half-clause `!!rc.beastIndex` — matcher-false seam,
//        attributable by loadMonsters NOT called (family-consistent with #844 :225/#845 :226)
//   NEW test 7: :99 base-not-found return-false seam — attributable by loadMonsters called
//        once, fetchRaceData NOT called (:99 returns before the race step), fallback popup
//        verbatim by identity
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNpcClickHandler } from './createNpcClickHandler.js';
import { loadMonsters, fetchRaceData } from '../../services/ui/dataLoader.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getMonsterData } from '../../services/npcs/monsterUtils.js';
import { npcToMonsterFormat } from '../../services/encounters/npcStatBlockUtils.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

// Zero-network guard: the real NPC_FORM_HANDLERS are NOT mocked (#841/#843) — runWildShape's
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

// Bestiary base. Every byte runWildShape may override differs from the runtime fixture below
// (#842/#844/#845 discipline): name 'Grizzly'≠beastName, ac 11≠circleFormsAC 19,
// hp 34≠runtime 15≠click 28, int/wis/cha 3/13/7 ≠ druid 16/14/12.
// saving_throws is deliberately NON-empty (str explicit) so extractBeastSaves precedence
// (#844 :173-181) is not re-derived: only int/wis/cha fall to the modifier map, and their
// post-retention values are pinned once as the "saves are the beast's own" order byte.
const baseBear = {
    index: 'bear',
    name: 'Grizzly',
    armor_class: 11,
    hit_points: 34,
    ability_scores: { str: 19, dex: 10, con: 16, int: 3, wis: 13, cha: 7 },
    ability_score_modifiers: { str: 4, dex: 0, con: 3, int: -4, wis: 1, cha: -2 },
    saving_throws: { str: { modifier: 6 }, dex: { modifier: 2 }, con: { modifier: 5 } },
    actions: [
        { name: 'Bite', attack_bonus: 5, damage_type_primary: 'Bludgeoning', damage_type_secondary: 'Piercing', description: 'Melee Weapon Attack: 7 Bludgeoning damage' },
        { name: 'Claw', attack_bonus: 5, damage_type_primary: 'Slashing', description: 'Melee Weapon Attack: 5 Slashing damage' },
    ],
    size: 'Large',
    type: 'Beast',
    challenge_rating: 1,
    speed: '40 ft.',
};

// Runtime combatant as persisted by the wild shape automation. ac 14 is HERE but unread by
// this lane (:103 reads circleFormsAC only); size/speed are here but never copied (:96-126
// has no size/speed assignment — that's polymorph/shapechange's lane).
const makeWildCreature = (overrides = {}) => ({
    name: 'DruidAlice',
    wildShapeSource: 'DruidAlice',
    beastIndex: 'bear',
    beastName: 'Ancient Brown Bear',
    ac: 14,
    size: 'Medium',
    speed: { fly: '60 ft.' },
    ...overrides,
});

const moonDruid = {
    name: 'DruidAlice',
    computedStats: {
        abilities: [
            { name: 'Intelligence', score: 16 },
            { name: 'Wisdom', score: 14 },
            { name: 'Charisma', score: 12 },
        ],
        languages: ['Common', 'Elvish'],
        class: { major: { name: 'Circle of the Moon' } },
        automation: { passives: [{ type: 'damage_type_choice', effect: 'lunar_radiance' }] },
    },
};

// Same moon class, DIFFERENT passive: pins that the radiance tag is gated on the passive
// (:78-82), not the class, while the CON buff (:112) stays class-gated.
const moonDruidNoLunarPassive = {
    name: 'DruidAlice',
    computedStats: {
        abilities: moonDruid.computedStats.abilities,
        languages: moonDruid.computedStats.languages,
        class: { major: { name: 'Circle of the Moon' } },
        automation: { passives: [{ type: 'damage_type_choice', effect: 'stoneskin' }] },
    },
};

// Non-moon caster whose stored name carries the wild-shape suffix — pins findCasterCharacter's
// `startsWith(casterName + ' ')` branch (:51) while the popup is opened under the CLICKED name.
const nonMoonDruid = {
    name: 'DruidBob (Wild Shape)',
    computedStats: {
        abilities: moonDruid.computedStats.abilities,
        languages: ['Common', 'Sylvan'],
        class: { major: { name: 'Land' } },
        automation: { passives: [{ type: 'damage_type_choice', effect: 'lunar_radiance' }] },
    },
};

// Raw character JSON as persisted to disk (CLA-391): abilities carry baseScore + increases and
// NEVER a computed `.score`; no computedStats wrapper. Exercises all four ABILITY_INCREASE_KEYS
// (:5): background→INT 8+1=9, misc→WIS 16+1=17, feat+racial→CHA 8+1+1=10.
const rawDiskDruid = {
    name: 'Wild_Sage_Druid',
    rules: '2024',
    race: { name: 'Human', subrace: { name: '' } },
    languages: ['Common', 'Druidic'],
    abilities: [
        { name: 'Strength', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
        { name: 'Dexterity', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
        { name: 'Constitution', baseScore: 8, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 0 },
        { name: 'Intelligence', baseScore: 8, featIncrease: 0, backgroundIncrease: 1, miscIncrease: 0 },
        { name: 'Wisdom', baseScore: 16, featIncrease: 0, backgroundIncrease: 0, miscIncrease: 1 },
        { name: 'Charisma', baseScore: 8, featIncrease: 1, backgroundIncrease: 0, miscIncrease: 0, racialIncrease: 1 },
    ],
};

const baseRat = {
    index: 'rat',
    name: 'Rat',
    armor_class: 10,
    hit_points: 1,
    ability_scores: { str: 2, dex: 11, con: 9, int: 2, wis: 10, cha: 4 },
    ability_score_modifiers: { str: -4, dex: 0, con: -1, int: -4, wis: 0, cha: -3 },
    saving_throws: { con: { modifier: 4 } },
    actions: [
        { name: 'Bite', attack_bonus: 0, damage_type_primary: 'Piercing', description: 'Bite attack dealing Piercing damage' },
    ],
    size: 'Tiny',
    type: 'Beast',
    challenge_rating: 0,
    speed: '20 ft.',
};

describe('createNpcClickHandler - Wild Shape lane (runWildShape)', () => {
    let setViewingMonster;
    let setViewingMonsterCreatureName;

    beforeEach(() => {
        vi.clearAllMocks();
        setViewingMonster = vi.fn();
        setViewingMonsterCreatureName = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const handlerFor = (characters) => createNpcClickHandler({
        isLocalhost: true,
        campaignNpcs: [],
        campaignName: 'test-campaign',
        characters,
        setViewingMonster,
        setViewingMonsterCreatureName,
    });

    it('merges the full Moon-druid runtime state onto the bestiary block and opens the popup exactly once', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop) => {
            if (prop === 'currentHitPoints') return 15; // ≠ click (absent) ≠ base 34
            if (prop === 'circleFormsAC') return 19; // ≠ runtimeCreature.ac 14 ≠ base 11
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeWildCreature({ lunarFormAction: { name: 'Lunar Form', attack_bonus: 7, damage_type_primary: 'Radiant', description: 'Moon magic attack' } })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handlerFor([moonDruid])({ name: 'DruidAlice' });

        // Lane seam attribution: bestiary reached once, form matched so the external fallback
        // never ran; caster has no race → the race lookup guard (:43) returns before fetching.
        expect(loadMonsters).toHaveBeenCalledTimes(1);
        expect(getMonsterData).not.toHaveBeenCalled();
        expect(npcToMonsterFormat).not.toHaveBeenCalled();
        expect(fetchRaceData).not.toHaveBeenCalled();

        // Lane runtime keys, exact args: currentHitPoints carries the campaign (:102),
        // circleFormsAC does NOT (:103). Call-count 2 pins that shapechangeTempHp /
        // polymorphTempHp (siblings' keys) are never read here and no hit_points_temp exists
        // in this lane.
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledTimes(2);
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('DruidAlice', 'currentHitPoints', 'test-campaign');
        expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('DruidAlice', 'circleFormsAC');

        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster).not.toBe(baseBear); // cloned merge, not the bestiary object itself

        // Runtime overrides — every byte differs from the bestiary base
        expect(monster.name).toBe('Ancient Brown Bear'); // beastName :101, not base 'Grizzly'
        expect(monster.hit_points).toBe(15); // runtime HP, not base 34
        expect(monster.armor_class).toBe(19); // circleFormsAC, not runtime ac 14 nor base 11

        // CLA-391 caster retention: INT/WIS/CHA + languages; STR/CON stay the bear's
        expect(monster.ability_scores.int).toBe(16); // ≠ base 3
        expect(monster.ability_scores.wis).toBe(14); // ≠ base 13
        expect(monster.ability_scores.cha).toBe(12); // ≠ base 7
        expect(monster.ability_scores.str).toBe(19);
        expect(monster.ability_score_modifiers.int).toBe(3); // recomputed from retained 16
        expect(monster.ability_score_modifiers.wis).toBe(2);
        expect(monster.ability_score_modifiers.cha).toBe(1);
        expect(monster.languages).toBe('Common, Elvish');

        // Saves: beast's own (:110-111 run after retention, extracted from the ORIGINAL base) —
        // int keeps the bear's -4, not the retained druid's +3 (precedence table pinned #844)
        expect(monster.saving_throws.str.modifier).toBe(6);
        expect(monster.saving_throws.int.modifier).toBe(-4);
        // Moon-only CON buff (:112-115): beast con 5 + druid WIS mod 2
        expect(monster.saving_throws.con.modifier).toBe(7);

        // Lunar Radiance natural weapons (:117-119): primary(+secondary) gain Radiant choices
        expect(monster.actions[0].damage_type_choices).toEqual(['Bludgeoning', 'Radiant']);
        expect(monster.actions[0].damage_type_secondary).toBe('Piercing'); // retained alongside
        expect(monster.actions[0].description).toBe('Melee Weapon Attack: 7 Bludgeoning or Radiant damage');
        expect(monster.actions[1].damage_type_choices).toEqual(['Slashing', 'Radiant']);
        expect(monster.actions[1].description).toBe('Melee Weapon Attack: 5 Slashing or Radiant damage');

        // lunarFormAction appended AFTER radiance ran (:120-122): the Lunar Form action itself
        // stays untagged — pins the :117/:120 order
        expect(monster.actions.length).toBe(3);
        expect(monster.actions[2].name).toBe('Lunar Form');
        expect(monster.actions[2].damage_type_choices).toBeUndefined();

        // wildshape never copies runtime size/speed (bytes polymorph/shapechange lanes override)
        expect(monster.size).toBe('Large'); // runtime 'Medium' ignored
        expect(monster.speed).toBe('40 ft.'); // runtime { fly: '60 ft.' } ignored
        expect(monster.type).toBe('Beast'); // no race on caster — type untouched (:43 guard)

        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('DruidAlice');

        // Bestiary input object untouched by the merge
        expect(baseBear.name).toBe('Grizzly');
        expect(baseBear.armor_class).toBe(11);
        expect(baseBear.hit_points).toBe(34);
        expect(baseBear.actions[0].damage_type_choices).toBeUndefined();
        expect(baseBear.actions[0].description).toBe('Melee Weapon Attack: 7 Bludgeoning damage');
    });

    it('retains bestiary name/AC, takes click HP on null runtime HP, and skips every Moon-gated byte for a non-Moon suffix-matched caster', async () => {
        // Retain side of :101/:102/:104 + the class-gate-false cells of :112/:117, all in one
        // click. Distinct bytes: base name 'Grizzly', base ac 11, runtime HP null, click 28,
        // base hp 34.
        vi.mocked(runtimeState.getRuntimeValue).mockReturnValue(null); // circleFormsAC null → ac stays base
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeWildCreature({ name: 'DruidBob', wildShapeSource: 'DruidBob', beastName: undefined })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handlerFor([nonMoonDruid])({ name: 'DruidBob', currentHp: 28 });

        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.name).toBe('Grizzly'); // || base name (:101, beastName absent)
        expect(monster.hit_points).toBe(28); // click HP survives null runtime HP (:102 ??)
        expect(monster.armor_class).toBe(11); // base ac — circleFormsAC null, runtime ac unread

        // Class gate false (:112/:117): no CON buff, no radiance tag on the SAME fixture
        // bytes test 1 tagged — the ONLY diff vs test 1 is the caster's class.
        expect(monster.saving_throws.con.modifier).toBe(5); // beast's own, not 5+WIS 2
        expect(monster.actions.length).toBe(2); // no lunarFormAction in runtime — none appended
        expect(monster.actions[0].damage_type_choices).toBeUndefined();
        expect(monster.actions[0].description).toBe('Melee Weapon Attack: 7 Bludgeoning damage');
        expect(monster.actions[1].damage_type_choices).toBeUndefined();

        // Suffix matcher (:51) still retained the caster's mental scores + languages, but the
        // popup opens under the CLICKED name, not the suffixed character name.
        expect(monster.ability_scores.int).toBe(16);
        expect(monster.ability_scores.wis).toBe(14);
        expect(monster.ability_scores.cha).toBe(12);
        expect(monster.languages).toBe('Common, Sylvan');
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('DruidBob');
        expect(getMonsterData).not.toHaveBeenCalled(); // matcher was TRUE — fallback unreached
    });

    it('keeps natural weapons normal for a Moon druid WITHOUT the lunar_radiance passive, yet still buffs the CON save — class and passive gates are independent', async () => {
        // The matrix cell neither test 1 (class✓ passive✓) nor test 2 (class✗) can falsify:
        // if radiance were gated on class alone, test 1 would still pass; if the CON buff were
        // gated on the passive, only this cell catches it.
        vi.mocked(runtimeState.getRuntimeValue).mockImplementation((key, prop) => {
            if (prop === 'currentHitPoints') return 15;
            return null;
        });
        vi.mocked(getCombatSummary).mockReturnValue({ creatures: [makeWildCreature()] });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);

        await handlerFor([moonDruidNoLunarPassive])({ name: 'DruidAlice' });

        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        const monster = setViewingMonster.mock.calls[0][0];
        expect(monster.actions.length).toBe(2); // no lunarFormAction in runtime
        expect(monster.actions[0].damage_type_choices).toBeUndefined(); // :79 passive scan false
        expect(monster.actions[0].description).toBe('Melee Weapon Attack: 7 Bludgeoning damage');
        expect(monster.actions[1].damage_type_choices).toBeUndefined();
        expect(monster.saving_throws.con.modifier).toBe(7); // :112 class gate true: 5 + WIS 2
        expect(getMonsterData).not.toHaveBeenCalled();
    });

    it('derives retained mental scores from raw-disk baseScore+increases and stamps the race creature type via fetchRaceData exactly once (CLA-391)', async () => {
        vi.mocked(runtimeState.getRuntimeValue).mockReturnValue(null);
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeWildCreature({ name: 'Wild_Sage_Druid', wildShapeSource: 'Wild_Sage_Druid', beastIndex: 'rat', beastName: undefined })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseRat]);
        vi.mocked(fetchRaceData).mockResolvedValue({ name: 'Human', creature_type: 'Humanoid' });

        await handlerFor([rawDiskDruid])({ name: 'Wild_Sage_Druid' });

        // The lane's one legitimate fetch: caster rules threaded through (:45), exactly once
        expect(fetchRaceData).toHaveBeenCalledTimes(1);
        expect(fetchRaceData).toHaveBeenCalledWith('Human', '2024');
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        const monster = setViewingMonster.mock.calls[0][0];

        // :47 guard TRUE — race type overwrites the bestiary 'Beast' (the wildshape-lane byte:
        // polymorph #844 hardcodes 'beast', shapechange #845 never touches type)
        expect(monster.type).toBe('Humanoid');

        // baseScore+increases derivation across all four ABILITY_INCREASE_KEYS (:5) — no
        // computedStats wrapper (:12 `|| abilities` branch)
        expect(monster.ability_scores.int).toBe(9); // 8 + backgroundIncrease 1
        expect(monster.ability_scores.wis).toBe(17); // 16 + miscIncrease 1
        expect(monster.ability_scores.cha).toBe(10); // 8 + featIncrease 1 + racialIncrease 1
        expect(monster.ability_score_modifiers.int).toBe(-1);
        expect(monster.ability_score_modifiers.wis).toBe(3);
        expect(monster.ability_score_modifiers.cha).toBe(0); // floor((10-10)/2) — boundary byte
        // Physical scores stay the rat's (≠ druid base 8s) — retention is mental-only
        expect(monster.ability_scores.str).toBe(2);
        expect(monster.ability_scores.dex).toBe(11);
        expect(monster.ability_score_modifiers.str).toBe(-4);

        // languages from the raw character (:37 `|| languages` branch); no Moon class → saves
        // untouched by a CON buff (con keeps rat's explicit saving_throws byte, #844 precedence)
        expect(monster.languages).toBe('Common, Druidic');
        expect(monster.saving_throws.con.modifier).toBe(4);

        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('Wild_Sage_Druid');
        expect(getMonsterData).not.toHaveBeenCalled(); // form matched — fallback unreached
    });

    it('keeps the bestiary Beast type when the race lookup returns no creature_type', async () => {
        // Distinct :47 `if (creatureType)` false-cell: undefined must NOT stomp the type.
        vi.mocked(runtimeState.getRuntimeValue).mockReturnValue(null);
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeWildCreature({ name: 'Wild_Sage_Druid', wildShapeSource: 'Wild_Sage_Druid', beastIndex: 'rat', beastName: undefined })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseRat]);
        vi.mocked(fetchRaceData).mockResolvedValue({ name: 'Human' }); // race exists, no creature_type

        await handlerFor([rawDiskDruid])({ name: 'Wild_Sage_Druid' });

        expect(fetchRaceData).toHaveBeenCalledTimes(1); // lookup ran — guard was on the RESULT
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        expect(setViewingMonster.mock.calls[0][0].type).toBe('Beast');
        expect(getMonsterData).not.toHaveBeenCalled();
    });

    it('skips runWildShape entirely when wildShapeSource is present but beastIndex is missing, falling through to the external fallback verbatim', async () => {
        // Guard :224 is a two-clause matcher; this pins the `!!rc.beastIndex` half.
        // loadMonsters untouched proves the miss is the matcher, not a bestiary miss inside
        // runWildShape (that seam is test 7).
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [{ name: 'DruidAlice', wildShapeSource: 'DruidAlice', ac: 14, currentHp: 28 }],
        });
        const fallbackMonster = { index: 'ogre', name: 'Ogre' };
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        await handlerFor([moonDruid])({ name: 'DruidAlice' });

        expect(loadMonsters).not.toHaveBeenCalled();
        expect(fetchRaceData).not.toHaveBeenCalled();
        expect(getMonsterData).toHaveBeenCalledTimes(1);
        expect(getMonsterData).toHaveBeenCalledWith('DruidAlice');
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        expect(setViewingMonster.mock.calls[0][0]).toBe(fallbackMonster); // verbatim, unmerged
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
        expect(setViewingMonsterCreatureName).toHaveBeenCalledWith('DruidAlice');
    });

    it('returns false and reaches the external fallback verbatim when the beastIndex matches no bestiary monster', async () => {
        vi.mocked(getCombatSummary).mockReturnValue({
            creatures: [makeWildCreature({ beastIndex: 'no-such-form' })],
        });
        vi.mocked(loadMonsters).mockResolvedValue([baseBear]);
        const fallbackMonster = { index: 'ogre', name: 'Ogre' };
        vi.mocked(getMonsterData).mockResolvedValue(fallbackMonster);

        await handlerFor([moonDruid])({ name: 'DruidAlice' });

        expect(loadMonsters).toHaveBeenCalledTimes(1); // matcher TRUE — runWildShape ran
        expect(fetchRaceData).not.toHaveBeenCalled(); // :99 returns before the race step (:109)
        expect(getMonsterData).toHaveBeenCalledTimes(1); // :99 return false → fallback reached
        expect(setViewingMonster).toHaveBeenCalledTimes(1);
        expect(setViewingMonster.mock.calls[0][0]).toBe(fallbackMonster); // not a partial merge
        expect(setViewingMonsterCreatureName).toHaveBeenCalledTimes(1);
    });
});
