// @maintained-by-ai 2026-11-27 — audit+trim: full-shape pins on proficiencies/Wizard/Warlock, plateau cases cut, getClass major tests merged, getEnergy (dead export) minimal-pinned; header cites re-verified against source bytes
import { describe, it, expect, vi } from 'vitest';
import classRules from './classRules2024.js';
import classes2024 from '../../../public/data/2024/classes.json';

// Lane: 2024 classRules (this file) — closes the dual-ruleset pair with
// classRules.test.js (5e lane). Owns public/data/2024/classes.json
// (separate disk; dataLoader.getDataPath() routes rules==='2024' here, so
// no cross-lane pin reuse — 5e names/values from the 5e lane are deliberately
// NOT copied: Moon formula pins, Archdruid Infinity, Arcane Ward max are 5e-only).
//
// Pair closure (handoff from the 5e lane):
//  - 2024 capstone is FINITE: disk Druid L20 wild_shape:4 (no Archdruid
//    Infinity) — pinned verbatim below.
//  - Moon name-mismatch flag does NOT recur: disk majors here are named
//    'Circle of the Moon' verbatim, matching the source formula's key.
//  - No reciprocal rules!=='2024' guards exist in this module — routing is
//    external (rulesFactory.js:33 / rules-core.js:27 `use2024 ? classRules2024
//    : classRules`, classFeatures.js FEATURE_GETTERS dispatch). Pinned honestly
//    as absent.
//
// Production liveness (re-verified 2026-11-27 against current source bytes):
//  - getClass            → rulesFactory.getPlayerStats (rules-core injects the
//                         2024 module; cr.getClass call site is ruleset-agnostic)
//  - getFeatures         → rules/rules-actions.js:55 (via injected classRules)
//  - getHighestMajorLevel→ rules/core/spellCalc2024.js:532 (subclass
//                         spellcasting). NOTE: that consumer reads
//                         `getHighestMajorLevel(playerStats)?.spellcasting` —
//                         always undefined on this module's number return
//                         (cross-file SOURCE BUG, reported, not fixed here).
//                         This lane pins the return contract: a plain number.
//  - getMartialArtsDie   → rules/core/attackCalc2024.js:663 (Flurry of Blows dice)
//  - getUnarmoredMovementIncrease → charSummaryCalc.js:75 (sheet)
//  - get*Features (x10)  → classFeatures.js getClassFeatures FEATURE_GETTERS
//                         dispatch → CharClassFeatures.jsx, trackedResources,
//                         automation
//  - getRogueSneakAttack / getDruid* delegators → rulesFactory wrappers (live;
//                         consumers incl. encounter/MonsterCardModal.jsx)
//  - getEnergy         → DEAD EXPORT (verified 2026-11-27: zero non-test call
//                         sites anywhere in src/). Deletion recommended; kept
//                         minimally pinned (one disk-shape census + the three
//                         null branches) until removed.
//
// Anti-pattern audit results (canned-vs-disk, 5e-lane block standard):
//  - FIXED canned rows: every { level: N, <field>: X } synthetic progression row
//    in the old file was fabricated and several contradicted disk (e.g. claimed
//    martial_arts_die 6 at L5, disk is 8; sorcery/class channel_divinity 3 at
//    Cleric L5, disk is 2; 'psi' energy type, disk shape is energy_die_type/num).
//    All progression pins below are verbatim /data/2024/classes.json.
//  - FLAG-A (skill path dead vs disk): source reads skill_proficiencies ||
//    skill_proficiencies_choices, but disk uses skill_proficiency_choices for
//    Barbarian/Druid (matches neither field) and every disk string starts with
//    'Choose' (skipped). No disk class ever yields a 'Skill: ' proficiency.
//  - FLAG-B: featureCategories.js getCategories('2024').featuresToIgnore is
//    never consulted by the service-layer addFeatures/categorize path —
//    ignored names ('Fighting Style', 'Extra Attack', 'Druid Subclass'…) still
//    land in specialActions. (UI components — CharActions/CharBonusActions/
//    CharReactions/CharSpecialActions/CharCharacterAdvancement — filter them at
//    RENDER time; the service surface returned here intentionally keeps them.)
//    Pinned as quirk.
//  - FLAG-C: getMartialArtsDie default d4 is unreachable via disk — 2024 Monk
//    rows all carry martial_arts_die and start at d6. Default kept as honest
//    synthetic-row fallback pin only.
//  - FLAG-D: hardcoded, no disk column: Sorcerer metamagic ladder and
//    maxInnateSorcery:2, Paladin auraRange:null, Cleric destroyUndeadCR:null,
//    Bard songOfRestDie:null / subclassMagicalSecrets:0, Warlock arcanum
//    formula (cross-checked honest: disk 'Mystic Arcanum' feature rows appear
//    at exactly L11/13/15/17, matching the >10 / >=11/13/15/17 formula).
//  - Quirks pinned: getRogueSneakAttack/getEldritchInvocations/getCleric-
//    PaladinSorcererBardFeatures use positional [level-1] indexing (not
//    find-by-level); getEnergy required_major check reads only
//    class.major.name (raw subclass shape → null); getClass drops the runtime
//    subclass customProp on the resolved major (disk clone wins).
//
// Ladder-trim policy (2026-11-27 audit): it.each levels are kept only where the
// level is discriminating (a bump boundary, a both-sides pair, a plateau cap
// that kills an off-by-one, or the level-1 zero leg). Repeated values on the
// same branch were cut.

const diskClass = (name) => classes2024.find((c) => c.name === name);
const diskLevels = (name) => diskClass(name).class_levels;
const namesIn = (categorized) => [
  ...categorized.actions,
  ...categorized.bonusActions,
  ...categorized.reactions,
  ...categorized.specialActions,
  ...categorized.characterAdvancement,
].map((f) => f.name);

describe('classRules2024 (2024)', () => {
  describe('getClass', () => {
    it('merges disk Wizard verbatim: long saving names kept, major null, majors deleted', () => {
      // disk Wizard saving_throw_proficiencies are already long names;
      // utils.getAbilityLongName('Intelligence') → undefined → original kept.
      const result = classRules.getClass(classes2024, { class: { name: 'Wizard' } });
      expect(result.name).toBe('Wizard');
      expect(result.saving_throw_proficiencies).toEqual(['Intelligence', 'Wisdom']);
      expect(result.major).toBeNull();
      expect(result.majors).toBeUndefined();
      expect(result.class_levels).toHaveLength(20);
    });

    it('disk-wide scan: no short ability abbreviations exist on disk (conversion is character-JSON path only)', () => {
      const shorts = classes2024.flatMap((c) => c.saving_throw_proficiencies).filter((s) => s.length <= 3);
      expect(shorts).toEqual([]);
    });

    it('converts short names merged in from playerSummary (synthetic wizard-path input)', () => {
      const result = classRules.getClass(classes2024, { class: { name: 'Wizard', saving_throw_proficiencies: ['INT', 'WIS'] } });
      expect(result.saving_throw_proficiencies).toEqual(['Intelligence', 'Wisdom']);
    });

    it('maps disk Fighter weapon/armor strings verbatim (exact 6 entries)', () => {
      const result = classRules.getClass(classes2024, { class: { name: 'Fighter' } });
      expect(result.proficiencies).toEqual(['Simple Weapons', 'Martial Weapons', 'Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields']);
    });

    it('maps disk Rogue Finesse-or-Light string + Thieves Tools verbatim (exact 5 entries)', () => {
      const result = classRules.getClass(classes2024, { class: { name: 'Rogue' } });
      expect(result.proficiencies).toEqual(['Simple Weapons', 'Finesse Martial Weapons', 'Light Martial Weapons', 'Light Armor', "Thieves' Tools"]);
    });

    it('skips armor_training "None" and Choose-prefixed tools (disk Monk exact list)', () => {
      const result = classRules.getClass(classes2024, { class: { name: 'Monk' } });
      expect(result.proficiencies).toEqual(['Simple Weapons', 'Light Martial Weapons']);
    });

    it('maps disk Druid verbatim: armor string yields Shields, Herbalism Kit tool kept, skill_proficiency_choices ignored (exact 4)', () => {
      const result = classRules.getClass(classes2024, { class: { name: 'Druid' } });
      expect(result.proficiencies).toEqual(['Simple Weapons', 'Light Armor', 'Shields', 'Herbalism Kit']);
    });

    it('FLAG-A: no disk class ever emits a Skill: proficiency (all strings Choose-prefixed or field-name mismatch)', () => {
      // Barbarian/Druid store skill_proficiency_choices (matches neither field
      // the module reads); all other disk skill strings start with 'Choose'.
      for (const c of classes2024) {
        const result = classRules.getClass(classes2024, { class: { name: c.name } });
        expect(result.proficiencies.filter((p) => p.startsWith('Skill: '))).toEqual([]);
      }
    });

    it('parses non-Choose skill string and strips " or " inside the last token (synthetic path, quirk)', () => {
      // Synthetic input: no disk string reaches this parser (see FLAG-A).
      // Quirk kept honest: ' or ' is removed (first occurrence only), not
      // split — 'PersuasionReligion'. Full-shape: base Cleric disk profs lead.
      const result = classRules.getClass(classes2024, { class: { name: 'Cleric', skill_proficiencies: 'History, Insight, Medicine, Persuasion or Religion' } });
      expect(result.proficiencies).toEqual([
        'Simple Weapons', 'Light Armor', 'Medium Armor', 'Shields',
        'Skill: History', 'Skill: Insight', 'Skill: Medicine', 'Skill: PersuasionReligion',
      ]);
    });

    it('adds exactly Martial Weapons + Heavy Armor for Divine Order Protector Cleric; other orders add nothing', () => {
      const base = classRules.getClass(classes2024, { class: { name: 'Cleric' } });
      const protector = classRules.getClass(classes2024, { class: { name: 'Cleric', divineOrder: 'Protector' } });
      expect(protector.proficiencies).toEqual([...base.proficiencies, 'Martial Weapons', 'Heavy Armor']);
      // negative leg: non-Protector order value grants nothing extra
      const pacifier = classRules.getClass(classes2024, { class: { name: 'Cleric', divineOrder: 'Pacifier' } });
      expect(pacifier.proficiencies).toEqual(base.proficiencies);
    });

    it('adds exactly Martial Weapons + Medium Armor for Primal Order Warden Druid; other orders add nothing', () => {
      const base = classRules.getClass(classes2024, { class: { name: 'Druid' } });
      const warden = classRules.getClass(classes2024, { class: { name: 'Druid', primalOrder: 'Warden' } });
      expect(warden.proficiencies).toEqual([...base.proficiencies, 'Martial Weapons', 'Medium Armor']);
      // negative leg: wrong order key for the class grants nothing
      const other = classRules.getClass(classes2024, { class: { name: 'Druid', primalOrder: '_other_' } });
      expect(other.proficiencies).toEqual(base.proficiencies);
    });

    it('resolves persisted subclass.name against disk majors as a disk clone (Cleric short-ish + Druid 2024 long name; runtime customProp never rides the resolved major — quirk)', () => {
      const lifeDomain = diskClass('Cleric').majors.find((m) => m.name === 'Life Domain');
      const result = classRules.getClass(classes2024, { class: { name: 'Cleric', subclass: { name: 'Life Domain', customProp: 'x' } } });
      expect(result.major).toEqual(lifeDomain); // verbatim disk clone: Disciple of Life, Preserve Life, Blessed Healer, Supreme Healing
      expect(result.major.customProp).toBeUndefined();
      expect(result.majors).toBeUndefined();

      // 2024 disk long name resolves verbatim (no 5e short-name table)
      const land = diskClass('Druid').majors.find((m) => m.name === 'Circle of the Land');
      const druid = classRules.getClass(classes2024, { class: { name: 'Druid', subclass: { name: 'Circle of the Land' } } });
      expect(druid.major).toEqual(land);
    });

    it('creates empty-features major when not found in disk majors', () => {
      const result = classRules.getClass(classes2024, { class: { name: 'Cleric', subclass: { name: 'Nonexistent Domain' } } });
      expect(result.major).toEqual({ name: 'Nonexistent Domain', features: [] });
    });

    it('warns and returns default class_levels when class not found (incl. empty allClasses)', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(classRules.getClass(classes2024, { class: { name: 'Artificer' } })).toEqual({ class_levels: [] });
      expect(classRules.getClass([], { class: { name: 'Wizard' } })).toEqual({ class_levels: [] });
      expect(consoleWarnSpy).toHaveBeenCalledWith('Could not find class: Artificer');
      consoleWarnSpy.mockRestore();
    });

    it('preserves disk class_levels when playerSummary.class carries its own (source restore-on-merge)', () => {
      const result = classRules.getClass(classes2024, { class: { name: 'Fighter', class_levels: [{ level: 99 }] } });
      expect(result.class_levels).toHaveLength(20);
      expect(result.class_levels[0].level).toBe(1);
    });

    it('throws TypeError when playerSummary.class is null', () => {
      expect(() => classRules.getClass(classes2024, { class: null })).toThrow(TypeError);
    });
  });

  describe('getDruidMaxWildShapeChallengeRating', () => {
    // disk Druid beast_max_cr verbatim (non-Moon path). Kept levels are the
    // L1 zero leg + each bump step (2→0.25, 4→0.5, 8→1 cap entry).
    it.each([
      [1, 0],
      [2, 0.25],
      [4, 0.5],
      [8, 1],
    ])('reads disk beast_max_cr verbatim at level %i', (level, expected) => {
      const playerStats = { class: { name: 'Druid', class_levels: diskLevels('Druid') }, level };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(expected);
    });

    // Moon formula (source: >1 → 1; >5 → floor(level/3)), disk name verbatim.
    // L1 proves the >1 gate stays closed; L2/L6 prove disk is overridden;
    // L17/L20 cap the floor ladder.
    it.each([
      [1, 0],   // no override at L1 (disk value 0)
      [2, 1],   // disk 0.25 overridden
      [6, 2],   // disk 1 overridden by floor(6/3)
      [17, 5],
      [20, 6],
    ])('applies Moon formula over disk at level %i', (level, expected) => {
      const playerStats = {
        class: { name: 'Druid', major: { name: 'Circle of the Moon' }, class_levels: diskLevels('Druid') },
        level,
      };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(expected);
    });

    it('ignores the raw persisted subclass shape for the Moon boost — resolved class.major is the only channel (level 8 falls back to disk CR)', () => {
      const playerStats = { class: { name: 'Druid', subclass: { name: 'Circle of the Moon' }, class_levels: diskLevels('Druid') }, level: 8 };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(1);
    });

    it('does not override for other disk majors (Circle of the Stars at level 8 → disk 1)', () => {
      const playerStats = { class: { name: 'Druid', major: { name: 'Circle of the Stars' }, class_levels: diskLevels('Druid') }, level: 8 };
      expect(classRules.getDruidMaxWildShapeChallengeRating(playerStats)).toBe(1);
    });

    it('returns 0 when class_levels is missing', () => {
      expect(classRules.getDruidMaxWildShapeChallengeRating({ class: { name: 'Druid' }, level: 3 })).toBe(0);
    });
  });

  describe('getDruidWildShapeUses', () => {
    // disk wild_shape verbatim — pair-closure pin: L17 row reaches the FINITE
    // max 4 (no Archdruid Infinity, unlike the 5e lane).
    it.each([
      [1, 0],
      [2, 2],
      [6, 3],
      [17, 4],
    ])('reads disk wild_shape verbatim at level %i', (level, expected) => {
      const playerStats = { class: { name: 'Druid', class_levels: diskLevels('Druid') }, level };
      expect(classRules.getDruidWildShapeUses(playerStats)).toBe(expected);
    });

    it('returns 0 when class_levels is missing', () => {
      expect(classRules.getDruidWildShapeUses({ class: { name: 'Druid' }, level: 3 })).toBe(0);
      expect(classRules.getDruidWildShapeUses({})).toBe(0);
    });
  });

  describe('getDruidBeastKnownForms', () => {
    it.each([
      [1, 0],
      [2, 4],
      [4, 6],
      [8, 8],
    ])('reads disk beast_known_forms verbatim at level %i', (level, expected) => {
      const playerStats = { class: { name: 'Druid', class_levels: diskLevels('Druid') }, level };
      expect(classRules.getDruidBeastKnownForms(playerStats)).toBe(expected);
    });

    it('returns 0 when class_levels is missing', () => {
      expect(classRules.getDruidBeastKnownForms({ class: { name: 'Druid' }, level: 3 })).toBe(0);
    });
  });

  describe('getDruidBeastFlySpeed', () => {
    // disk beast_fly_speed Yes/No verbatim; L7/L8 is the boundary.
    it.each([
      [1, false],
      [7, false],
      [8, true],
    ])('reads disk beast_fly_speed verbatim at level %i', (level, expected) => {
      const playerStats = { class: { name: 'Druid', class_levels: diskLevels('Druid') }, level };
      expect(classRules.getDruidBeastFlySpeed(playerStats)).toBe(expected);
    });

    it('returns false when class_levels is missing', () => {
      expect(classRules.getDruidBeastFlySpeed({ class: { name: 'Druid' }, level: 8 })).toBe(false);
    });
  });

  describe('getFeatures', () => {
    it('categorizes disk Fighter L1-L2 by casting time (FLAG-B: featuresToIgnore names still surface in specialActions)', () => {
      const playerStats = { class: { name: 'Fighter', class_levels: diskLevels('Fighter') }, level: 2 };
      const result = classRules.getFeatures(playerStats);
      expect(result.actions.map((f) => f.name)).toEqual(['Action Surge']);
      expect(result.bonusActions.map((f) => f.name)).toEqual(['Second Wind']);
      expect(result.reactions).toEqual([]);
      // 'Fighting Style'/'Weapon Mastery' are in getCategories('2024').featuresToIgnore,
      // which the service-layer categorizer never consults (UI filters at render).
      expect(result.specialActions.map((f) => f.name)).toEqual(['Tactical Mind', 'Fighting Style', 'Weapon Mastery']);
      expect(result.characterAdvancement).toEqual([]);
    });

    it('filters out level rows beyond the player level (Fighter L1 excludes Action Surge)', () => {
      const playerStats = { class: { name: 'Fighter', class_levels: diskLevels('Fighter') }, level: 1 };
      const names = namesIn(classRules.getFeatures(playerStats));
      expect(names).toContain('Second Wind');
      expect(names).not.toContain('Action Surge');
    });

    it('replaces base bonus-action monk features with Heightened versions at level 10, not at 9', () => {
      const statsAt = (level) => ({ class: { name: 'Monk', class_levels: diskLevels('Monk') }, level });
      const l10 = classRules.getFeatures(statsAt(10));
      expect(l10.bonusActions.map((f) => f.name)).toEqual([
        'Heightened Flurry of Blows', 'Heightened Patient Defense', 'Heightened Step of the Wind',
      ]);
      expect(namesIn(l10)).not.toContain('Flurry of Blows');
      // disk L5 Extra Attack has no casting_time and featuresToIgnore is inert (FLAG-B)
      expect(l10.specialActions.map((f) => f.name)).toContain('Extra Attack');

      const l9 = classRules.getFeatures(statsAt(9));
      expect(l9.bonusActions.map((f) => f.name)).toEqual(['Flurry of Blows', 'Patient Defense', 'Step of the Wind']);
      expect(namesIn(l9)).not.toContain('Heightened Flurry of Blows');
    });

    it('replaces Deflect Attacks with Deflect Energy at level 13, not at 12 (reactions from disk)', () => {
      const statsAt = (level) => ({ class: { name: 'Monk', class_levels: diskLevels('Monk') }, level });
      // disk also carries L3 Slow Fall (1 reaction) in both windows — verbatim.
      const l13 = classRules.getFeatures(statsAt(13));
      expect(l13.reactions.map((f) => f.name)).toEqual(['Deflect Energy', 'Slow Fall']);
      expect(namesIn(l13)).not.toContain('Deflect Attacks');

      const l12 = classRules.getFeatures(statsAt(12));
      // addFeatures walks levels high→low: L3 Slow Fall precedes L2 Deflect Attacks.
      expect(l12.reactions.map((f) => f.name)).toEqual(['Slow Fall', 'Deflect Attacks']);
    });

    it('merges disk Circle of the Moon major features filtered by feature.level (level 3)', () => {
      const playerStats = {
        class: { name: 'Druid', class_levels: diskLevels('Druid'), major: diskClass('Druid').majors.find((m) => m.name === 'Circle of the Moon') },
        level: 3,
      };
      const result = classRules.getFeatures(playerStats);
      expect(result.bonusActions.map((f) => f.name)).toContain('Wild Shape'); // disk Druid L2
      expect(result.specialActions.map((f) => f.name)).toContain('Circle Forms'); // major @3
      expect(result.specialActions.map((f) => f.name)).toContain('Circle of the Moon Spells'); // major @3
      expect(namesIn(result)).not.toContain('Improved Circle Forms'); // major @6
      expect(namesIn(result)).not.toContain('Lunar Form'); // major @14
    });

    it('excludes major features when major is null', () => {
      const playerStats = { class: { name: 'Druid', class_levels: diskLevels('Druid'), major: null }, level: 3 };
      const names = namesIn(classRules.getFeatures(playerStats));
      expect(names).toContain('Wild Shape');
      expect(names).not.toContain('Circle Forms');
    });

    it('returns empty categories when class_levels is empty', () => {
      const result = classRules.getFeatures({ class: { class_levels: [] }, level: 1 });
      expect(result).toEqual({ actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [] });
    });

    it('throws TypeError when playerStats has no class property', () => {
      expect(() => classRules.getFeatures({ level: 1 })).toThrow(TypeError);
    });
  });

  describe('getHighestMajorLevel', () => {
    // disk Circle of the Moon feature levels: [3, 3, 6, 10, 14].
    // Return contract is a PLAIN NUMBER (consumer spellCalc2024.js:532 wrongly
    // reads ?.spellcasting off it — cross-file source bug, reported).
    const moonStats = (level, key = 'major') => ({
      class: { name: 'Druid', [key]: diskClass('Druid').majors.find((m) => m.name === 'Circle of the Moon') },
      level,
    });

    it.each([
      [2, 0],    // below first major feature
      [5, 3],
      [10, 10],
      [13, 10], // gap level: 14-row not yet reached (pins <= semantics)
      [14, 14],
    ])('returns highest disk major feature level <= %i (%i)', (level, expected) => {
      expect(classRules.getHighestMajorLevel(moonStats(level))).toBe(expected);
    });

    it('ignores the raw subclass shape — resolved major only (no persisted-subclass fallback)', () => {
      expect(classRules.getHighestMajorLevel(moonStats(6, 'subclass'))).toBe(0);
    });

    it('returns 0 when major is missing or empty', () => {
      expect(classRules.getHighestMajorLevel({ class: { name: 'Druid' }, level: 10 })).toBe(0);
      expect(classRules.getHighestMajorLevel({ class: { major: null }, level: 10 })).toBe(0);
      expect(classRules.getHighestMajorLevel({ class: { major: { features: [] } }, level: 10 })).toBe(0);
    });

    it('throws TypeError when class is missing', () => {
      expect(() => classRules.getHighestMajorLevel({ level: 10 })).toThrow(TypeError);
    });
  });

  describe('getEnergy', () => {
    // DEAD EXPORT (zero non-test callers, verified 2026-11-27) — minimal pin:
    // one disk-shape census (die bump L9→L11→L20 incl. the L11 num-stays-8
    // quirk) + each null branch. Delete pin with the export.
    const psiStats = (level) => ({
      class: { name: 'Fighter', class_levels: diskLevels('Fighter'), major: { name: 'Psi Warrior' } },
      level,
    });

    it('returns disk Fighter energy rows verbatim (full shape): L9 die bump, L11 type-only bump (num stays 8), L20 d12s', () => {
      expect(classRules.getEnergy(psiStats(9))).toEqual({ required_major: 'Psi Warrior', energy_die_type: 8, energy_die_num: 8 });
      expect(classRules.getEnergy(psiStats(11))).toEqual({ required_major: 'Psi Warrior', energy_die_type: 10, energy_die_num: 8 });
      expect(classRules.getEnergy(psiStats(20))).toEqual({ required_major: 'Psi Warrior', energy_die_type: 12, energy_die_num: 12 });
    });

    it('returns null when required_major does not match the player major', () => {
      const playerStats = { ...psiStats(3), class: { name: 'Fighter', class_levels: diskLevels('Fighter'), major: { name: 'Champion' } } };
      expect(classRules.getEnergy(playerStats)).toBeNull();
    });

    it('returns null when required_major is set but major is absent (quirk: legacy subclass shape is not consulted)', () => {
      const noMajor = { class: { name: 'Fighter', class_levels: diskLevels('Fighter') }, level: 3 };
      expect(classRules.getEnergy(noMajor)).toBeNull();
      const subclassShape = { class: { name: 'Fighter', class_levels: diskLevels('Fighter'), subclass: { name: 'Psi Warrior' } }, level: 3 };
      expect(classRules.getEnergy(subclassShape)).toBeNull();
    });

    it('returns null for disk rows with no energy field (Fighter L1) and missing class_levels', () => {
      const playerStats = { class: { name: 'Fighter', class_levels: diskLevels('Fighter'), major: { name: 'Psi Warrior' } }, level: 1 };
      expect(classRules.getEnergy(playerStats)).toBeNull();
      expect(classRules.getEnergy({ class: { major: { name: 'Psi Warrior' } }, level: 5 })).toBeNull();
    });
  });

  describe('class-specific getters', () => {
    describe('getSecondWind', () => {
      // disk Fighter second_wind verbatim; L3/L4 boundary (2→3), L10 bump to 4.
      it.each([
        [3, 2],
        [4, 3],
        [10, 4],
      ])('reads disk second_wind verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Fighter', class_levels: diskLevels('Fighter') }, level };
        expect(classRules.getSecondWind(playerStats)).toBe(expected);
      });

      it('returns 0 when class_levels is missing', () => {
        expect(classRules.getSecondWind({ class: { name: 'Fighter' }, level: 5 })).toBe(0);
      });
    });

    describe('getWeaponMastery', () => {
      // disk Fighter weapon_mastery verbatim (bumps at L4, L10, L16)
      it.each([
        [1, 3],
        [4, 4],
        [10, 5],
        [16, 6],
      ])('reads disk weapon_mastery verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Fighter', class_levels: diskLevels('Fighter') }, level };
        expect(classRules.getWeaponMastery(playerStats)).toBe(expected);
      });

      it('returns 0 when class_levels is missing', () => {
        expect(classRules.getWeaponMastery({ class: { name: 'Fighter' }, level: 5 })).toBe(0);
      });
    });

    describe('getMartialArtsDie', () => {
      // disk Monk martial_arts_die verbatim. FLAG-C: disk starts at d6, so the
      // source's d4 default never fires for any disk row (it did not in the old
      // canned test either — corrected there: old file claimed d6 at L5, disk is 8).
      it.each([
        [1, 6],
        [5, 8],
        [11, 10],
        [17, 12],
      ])('reads disk martial_arts_die verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Monk', class_levels: diskLevels('Monk') }, level };
        expect(classRules.getMartialArtsDie(playerStats)).toBe(expected);
      });

      it('defaults to d4 only on synthetic rows missing the field (unreachable via disk — FLAG-C)', () => {
        expect(classRules.getMartialArtsDie({ class: { class_levels: [{ level: 5 }] }, level: 5 })).toBe(4);
        expect(classRules.getMartialArtsDie({ class: {}, level: 5 })).toBe(4);
      });
    });

    describe('getFocusPoints', () => {
      // disk Monk focus_points verbatim (== level from L2)
      it.each([
        [2, 2],
        [20, 20],
      ])('reads disk focus_points verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Monk', class_levels: diskLevels('Monk') }, level };
        expect(classRules.getFocusPoints(playerStats)).toBe(expected);
      });

      it('returns 0 when class_levels is missing', () => {
        expect(classRules.getFocusPoints({ class: { name: 'Monk' }, level: 5 })).toBe(0);
      });
    });

    describe('getUnarmoredMovementIncrease', () => {
      // disk verbatim; live consumer charSummaryCalc.js:75
      it.each([
        [2, 10],
        [6, 15],
        [10, 20],
        [18, 30],
      ])('reads disk unarmored_movement_increase verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Monk', class_levels: diskLevels('Monk') }, level };
        expect(classRules.getUnarmoredMovementIncrease(playerStats)).toBe(expected);
      });

      it('returns 0 when class_levels is missing', () => {
        expect(classRules.getUnarmoredMovementIncrease({ class: { name: 'Monk' }, level: 5 })).toBe(0);
      });
    });

    describe('getFavoredEnemy', () => {
      // disk Ranger favored_enemy verbatim (bumps at L5, L9, L13, L17)
      it.each([
        [1, 2],
        [8, 3],
        [9, 4],
        [13, 5],
        [17, 6],
      ])('reads disk favored_enemy verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Ranger', class_levels: diskLevels('Ranger') }, level };
        expect(classRules.getFavoredEnemy(playerStats)).toBe(expected);
      });

      it('returns 0 when class_levels is missing', () => {
        expect(classRules.getFavoredEnemy({ class: { name: 'Ranger' }, level: 5 })).toBe(0);
      });
    });

    describe('getRogueSneakAttack', () => {
      // disk Rogue sneak_attack_num_d6 verbatim (same ladder as 5e sibling)
      it.each([
        [1, { dice_count: 1, dice_value: 6 }],
        [3, { dice_count: 2, dice_value: 6 }],
        [5, { dice_count: 3, dice_value: 6 }],
        [11, { dice_count: 6, dice_value: 6 }],
        [17, { dice_count: 9, dice_value: 6 }],
        [20, { dice_count: 10, dice_value: 6 }],
      ])('reads disk sneak_attack verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Rogue', class_levels: diskLevels('Rogue') }, level };
        expect(classRules.getRogueSneakAttack(playerStats)).toEqual(expected);
      });

      it('indexes class_levels positionally at level-1 (quirk: does not find-by-level)', () => {
        // Row says level 9 (5d6) but sits at index 0; a find-by-level impl
        // would return {1,6} from… nowhere — positional read finds nothing.
        const playerStats = { class: { class_levels: [{ level: 9, sneak_attack_num_d6: 5 }] }, level: 5 };
        expect(classRules.getRogueSneakAttack(playerStats)).toEqual({ dice_count: 0, dice_value: 6 });
      });

      it('returns default {0,6} when class is missing', () => {
        expect(classRules.getRogueSneakAttack({})).toEqual({ dice_count: 0, dice_value: 6 });
      });
    });

    describe('getEldritchInvocations', () => {
      // disk Warlock eldritch_invocations verbatim (same index-based access).
      // Canonical invocation ladder for this module — getWarlockFeatures
      // delegates here, so its own ladder census was cut as redundant.
      it.each([
        [1, 1],
        [2, 3],
        [7, 6],
        [12, 8],
        [20, 10],
      ])('reads disk eldritch_invocations verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Warlock', class_levels: diskLevels('Warlock') }, level };
        expect(classRules.getEldritchInvocations(playerStats)).toBe(expected);
      });

      it('returns 0 when class_levels is missing', () => {
        expect(classRules.getEldritchInvocations({ class: { name: 'Warlock' }, level: 5 })).toBe(0);
      });
    });

    describe('getClericFeatures', () => {
      // disk Cleric channel_divinity verbatim; destroyUndeadCR is hardcoded null
      // (FLAG-D: disk Cleric table has no destroy_undead column at all in 2024).
      it.each([
        [1, { maxChannelDivinity: 0, destroyUndeadCR: null }],
        [2, { maxChannelDivinity: 2, destroyUndeadCR: null }],
        [5, { maxChannelDivinity: 2, destroyUndeadCR: null }], // old canned file claimed 3 here
        [6, { maxChannelDivinity: 3, destroyUndeadCR: null }],
        [18, { maxChannelDivinity: 4, destroyUndeadCR: null }],
      ])('reads disk channel_divinity verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Cleric', class_levels: diskLevels('Cleric') }, level };
        expect(classRules.getClericFeatures(playerStats)).toEqual(expected);
      });

      it('returns defaults when class is missing', () => {
        expect(classRules.getClericFeatures({})).toEqual({ maxChannelDivinity: 0, destroyUndeadCR: null });
      });
    });

    describe('getDruidFeatures', () => {
      it('aggregates disk L2 row exactly (no-fly)', () => {
        const playerStats = { class: { name: 'Druid', class_levels: diskLevels('Druid') }, level: 2 };
        expect(classRules.getDruidFeatures(playerStats)).toEqual({
          maxWildShapeUses: 2,
          maxWildShapeChallengeRating: 0.25,
          beastKnownForms: 4,
          wildShapeLimitations: 'walk or swim only (no fly)',
        });
      });

      it('aggregates disk L8 row exactly (fly boundary)', () => {
        const playerStats = { class: { name: 'Druid', class_levels: diskLevels('Druid') }, level: 8 };
        expect(classRules.getDruidFeatures(playerStats)).toEqual({
          maxWildShapeUses: 3,
          maxWildShapeChallengeRating: 1,
          beastKnownForms: 8,
          wildShapeLimitations: 'walk, swim, or fly',
        });
      });

      it('routes Moon formula through the aggregate at L20 (finite CR 6, uses 4)', () => {
        const playerStats = {
          class: { name: 'Druid', major: { name: 'Circle of the Moon' }, class_levels: diskLevels('Druid') },
          level: 20,
        };
        expect(classRules.getDruidFeatures(playerStats)).toEqual({
          maxWildShapeUses: 4,
          maxWildShapeChallengeRating: 6, // floor(20/3), disk was 1
          beastKnownForms: 8,
          wildShapeLimitations: 'walk, swim, or fly',
        });
      });

      it('returns defaults when class_levels is missing', () => {
        const result = classRules.getDruidFeatures({ class: { name: 'Druid' }, level: 3 });
        expect(result).toEqual({
          maxWildShapeUses: 0,
          maxWildShapeChallengeRating: 0,
          beastKnownForms: 0,
          wildShapeLimitations: 'walk or swim only (no fly)',
        });
      });
    });

    describe('getPaladinFeatures', () => {
      // disk Paladin channel_divinity verbatim (2024 Paladin gets Channel Oath
      // at L3 — unlike the 5e sibling where the class table has none).
      // FLAG-D: auraRange hardcoded null — disk has no aura column (auras live
      // in oath major features, e.g. Oath of the Ancients L7).
      it.each([
        [3, 2, 0],  // level 3 is NOT >4: extraAttacks 0 even with channel at 2
        [11, 3, 1],
      ])('reads disk channel_divinity verbatim at level %i (full shape pins auraRange:null, extraAttacks formula)', (level, expectedChannel, expectedAttacks) => {
        const playerStats = { class: { name: 'Paladin', class_levels: diskLevels('Paladin') }, level };
        expect(classRules.getPaladinFeatures(playerStats)).toEqual({
          maxChannelDivinity: expectedChannel,
          auraRange: null,
          extraAttacks: expectedAttacks,
        });
      });

      it('extraAttacks boundary: 0 at level 4, 1 at level 5 (Extra Attack disk row is L5)', () => {
        const statsAt = (level) => ({ class: { name: 'Paladin', class_levels: diskLevels('Paladin') }, level });
        expect(classRules.getPaladinFeatures(statsAt(4)).extraAttacks).toBe(0);
        expect(classRules.getPaladinFeatures(statsAt(5)).extraAttacks).toBe(1);
        expect(namesIn(classRules.getFeatures(statsAt(5)))).toContain('Extra Attack');
      });

      it('returns defaults when class_levels is missing', () => {
        expect(classRules.getPaladinFeatures({ class: {}, level: 5 })).toEqual({ maxChannelDivinity: 0, auraRange: null, extraAttacks: 1 });
      });
    });

    describe('getSorcererFeatures', () => {
      // disk Sorcerer sorcery_points verbatim (0 at L1, == level after)
      it.each([
        [1, 0],
        [5, 5],
        [20, 20],
      ])('reads disk sorcery_points verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Sorcerer', class_levels: diskLevels('Sorcerer') }, level };
        expect(classRules.getSorcererFeatures(playerStats).maxSorceryPoints).toBe(expected);
      });

      // FLAG-D: metamagicKnown is a hardcoded source formula — disk has no
      // metamagic column. Every threshold boundary pinned from both sides
      // (2/3, 9/10, 16/17); L1 shares the L2 branch, L20 the L17 branch.
      it.each([
        [2, 0],
        [3, 2],
        [9, 2],
        [10, 4],
        [16, 4],
        [17, 6],
      ])('applies hardcoded metamagicKnown formula at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Sorcerer', class_levels: diskLevels('Sorcerer') }, level };
        expect(classRules.getSorcererFeatures(playerStats).metamagicKnown).toBe(expected);
      });

      it('returns defaults when class_levels is missing (maxInnateSorcery: 2 is hardcoded — FLAG-D)', () => {
        expect(classRules.getSorcererFeatures({ class: {}, level: 5 })).toEqual({
          maxSorceryPoints: 0,
          metamagicKnown: 2,
          maxInnateSorcery: 2,
          creatingSpellSlotCosts: [],
        });
      });
    });

    describe('getWarlockFeatures', () => {
      // invocationsKnown is pure delegation to getEldritchInvocations — the
      // ladder census lives there; the delegation is pinned full-shape below
      // (L13 → disk 8).
      it('hasArcanum boundary at level 11 matches disk Mystic Arcanum feature rows', () => {
        const statsAt = (level) => ({ class: { name: 'Warlock', class_levels: diskLevels('Warlock') }, level });
        // formula: >10; disk cross-check: 'Mystic Arcanum' appears at L11, not L10
        const diskHasArcanumRow = (level) => diskLevels('Warlock')[level - 1].features.some((f) => f.name.startsWith('Mystic Arcanum'));
        expect(classRules.getWarlockFeatures(statsAt(10))).toEqual({
          invocationsKnown: 7, // disk L10
          hasArcanum: false,
          arcanumLevels: null,
          arcanums: [],
          invocations: [],
        });
        expect(diskHasArcanumRow(10)).toBe(false);
        expect(classRules.getWarlockFeatures(statsAt(11)).hasArcanum).toBe(true);
        expect(diskHasArcanumRow(11)).toBe(true);
      });

      // FLAG-D: arcanumLevels ladder is source formula (disk exposes only the
      // 'Mystic Arcanum (level N spell)' feature rows, at the same 11/13/15/17 seams).
      it.each([
        [11, { level6: 1, level7: 0, level8: 0, level9: 0 }],
        [13, { level6: 1, level7: 1, level8: 0, level9: 0 }],
        [15, { level6: 1, level7: 1, level8: 1, level9: 0 }],
        [17, { level6: 1, level7: 1, level8: 1, level9: 1 }],
      ])('arcanumLevels ladder at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Warlock', class_levels: diskLevels('Warlock') }, level };
        expect(classRules.getWarlockFeatures(playerStats).arcanumLevels).toEqual(expected);
      });

      it('passes through runtime arcanums/invocations from playerSummary-derived class, delegates invocationsKnown (disk L13 = 8) — no pactBoon key (differs from 5e sibling)', () => {
        const playerStats = {
          class: {
            name: 'Warlock',
            class_levels: diskLevels('Warlock'),
            arcanums: [{ name: 'Foresight', level: 9 }],
            invocations: [{ name: 'Eldritch Sight' }],
          },
          level: 13,
        };
        expect(classRules.getWarlockFeatures(playerStats)).toEqual({
          invocationsKnown: 8, // delegation to disk L13 eldritch_invocations
          hasArcanum: true,
          arcanumLevels: { level6: 1, level7: 1, level8: 0, level9: 0 },
          arcanums: [{ name: 'Foresight', level: 9 }],
          invocations: [{ name: 'Eldritch Sight' }],
        });
      });

      it('returns defaults when class is missing', () => {
        expect(classRules.getWarlockFeatures({})).toEqual({
          invocationsKnown: 0,
          hasArcanum: false,
          arcanumLevels: null,
          arcanums: [],
          invocations: [],
        });
      });
    });

    describe('getWizardFeatures', () => {
      // disk Wizard arcane_recovery_levels verbatim (ceil(level/2))
      it.each([
        [1, 1],
        [4, 2],
        [7, 4],
        [20, 10],
      ])('reads disk arcane_recovery_levels verbatim at level %i (full shape)', (level, expected) => {
        const playerStats = { class: { name: 'Wizard', class_levels: diskLevels('Wizard') }, level };
        expect(classRules.getWizardFeatures(playerStats)).toEqual({
          showWizardFeatures: true,
          arcaneRecoveryLevels: expected,
          arcaneWard: false,
        });
      });

      it('detects arcane_ward passives in both type and passive_rule/effect shapes; false when empty or automation absent', () => {
        const base = { class: { name: 'Wizard', class_levels: diskLevels('Wizard') }, level: 7 };
        expect(classRules.getWizardFeatures({ ...base, automation: { passives: [{ type: 'arcane_ward' }] } }).arcaneWard).toBe(true);
        expect(classRules.getWizardFeatures({ ...base, automation: { passives: [{ type: 'passive_rule', effect: 'arcane_ward' }] } }).arcaneWard).toBe(true);
        expect(classRules.getWizardFeatures({ ...base, automation: { passives: [] } }).arcaneWard).toBe(false);
        expect(classRules.getWizardFeatures(base).arcaneWard).toBe(false);
      });
    });

    describe('getMonkFeatures', () => {
      // disk aggregation via this.* delegators (unlike the 5e sibling's constants)
      it.each([
        [5, { martialArtsDie: 8, unarmoredMovementIncrease: 10, maxFocusPoints: 5 }],
        [18, { martialArtsDie: 12, unarmoredMovementIncrease: 30, maxFocusPoints: 18 }],
      ])('aggregates disk Monk row verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Monk', class_levels: diskLevels('Monk') }, level };
        expect(classRules.getMonkFeatures(playerStats)).toEqual({ ...expected, wisdomBonus: 0 });
      });

      it('returns defaults when class_levels is missing', () => {
        expect(classRules.getMonkFeatures({ class: {}, level: 5 })).toEqual({
          martialArtsDie: 4,
          unarmoredMovementIncrease: 0,
          maxFocusPoints: 0,
          wisdomBonus: 0,
        });
      });
    });

    describe('getRangerFeatures', () => {
      // disk Ranger verbatim at the two-field seam: favored_enemy 2→3 at L5
      // (deeper ladder owned by getFavoredEnemy), extraAttacks 0→1 at L5.
      it.each([
        [4, { favoredEnemies: 2, extraAttacks: 0 }],
        [5, { favoredEnemies: 3, extraAttacks: 1 }],
      ])('reads disk Ranger values verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Ranger', class_levels: diskLevels('Ranger') }, level };
        expect(classRules.getRangerFeatures(playerStats)).toEqual(expected);
      });

      it('returns defaults when class_levels is missing', () => {
        expect(classRules.getRangerFeatures({ class: {}, level: 5 })).toEqual({ favoredEnemies: 0, extraAttacks: 1 });
      });
    });

    describe('getRogueFeatures', () => {
      it('delegates sneak attack to disk L7 row and passes through runtime expertise (full shape)', () => {
        const playerStats = { class: { name: 'Rogue', class_levels: diskLevels('Rogue') }, level: 7, expertise: ['Stealth', 'Persuasion'] };
        expect(classRules.getRogueFeatures(playerStats)).toEqual({
          sneakAttack: { dice_count: 4, dice_value: 6 }, // disk L7
          expertise: ['Stealth', 'Persuasion'],
        });
      });

      it('returns empty expertise by default and defaults when class is missing', () => {
        const playerStats = { class: { name: 'Rogue', class_levels: diskLevels('Rogue') }, level: 5 };
        expect(classRules.getRogueFeatures(playerStats)).toEqual({ sneakAttack: { dice_count: 3, dice_value: 6 }, expertise: [] });
        expect(classRules.getRogueFeatures({})).toEqual({ sneakAttack: { dice_count: 0, dice_value: 6 }, expertise: [] });
      });
    });

    describe('getBardFeatures', () => {
      // disk Bard bardic_die verbatim
      it.each([
        [1, 6],
        [5, 8],
        [10, 10],
        [15, 12],
      ])('reads disk bardic_die verbatim at level %i', (level, expected) => {
        const playerStats = { class: { name: 'Bard', class_levels: diskLevels('Bard') }, level };
        expect(classRules.getBardFeatures(playerStats).bardicDie).toBe(expected);
      });

      it('reads disk class_specific.magical_secrets (only cs row is L10) and hardcoded 2024 constants (FLAG-D: disk has no song_of_rest column)', () => {
        const statsAt = (level) => ({ class: { name: 'Bard', class_levels: diskLevels('Bard') }, level });
        // disk Bard class_specific exists ONLY at L10 {magical_secrets: 2}
        expect(classRules.getBardFeatures(statsAt(10))).toEqual({
          bardicDie: 10,
          songOfRestDie: null,
          magicalSecrets: 2,
          subclassMagicalSecrets: 0, // source: 2024 has no subclass Additional Magical Secrets
        });
        expect(classRules.getBardFeatures(statsAt(9)).magicalSecrets).toBeNull();
      });

      it('returns defaults when class_levels is missing', () => {
        expect(classRules.getBardFeatures({ class: {}, level: 10 })).toEqual({
          bardicDie: 0,
          songOfRestDie: null,
          magicalSecrets: null,
          subclassMagicalSecrets: 0,
        });
      });
    });
  });
});
