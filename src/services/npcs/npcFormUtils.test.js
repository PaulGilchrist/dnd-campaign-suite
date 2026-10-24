// @maintained-by-ai
// Lane: custom-NPC form utilities — authoring defaults, save-time AC/HP
// coercion, and attitude style lookup.
// @app invariant: npcs.json is custom-NPC-only; these form defaults belong to
// custom-NPC authoring and stay distinct from bestiary data (transport owner:
// monsterUtils #1177). Persisted NPC shapes (raw-string bonuses, textarea
// traits) are owned by npcStatBlockUtils #1159 — this file pins form-field
// defaults and coercion honesty only. AC-null-until-filled blocks initiative
// (read side: npcCombatService #1178).
//
// Full export census: ABILITY_ABBR, ABILITY_LABELS, ATTITUDE_OPTIONS,
// ATTITUDE_COLORS, getDefaultFormData, cleanNPCData, getAttitudeStyle — all
// covered here; consumers: NPCs.jsx (defaults+clean), NPCListItem.jsx
// (getAttitudeStyle → React style prop, so camelCase suffixes are pinned),
// NPCRoleplayForm.jsx (ATTITUDE_OPTIONS), NPCStatBlockForm (ability lists).
//
// Old → new map (16 it-blocks → 10):
//   ABILITY_ABBR + ABILITY_LABELS goldens        → 1 combined golden
//   ATTITUDE_OPTIONS keys + ATTITUDE_COLORS shape → 1 options golden + key-parity
//   (colors content re-pinned via getAttitudeStyle goldens; loop dropped)
//   full default golden / overrides / fresh-nested → kept (overrides strengthened)
//   clone / no-mutate / null-AC silent / parse-log / zero-AC / undef-name
//                                                  → 1 immutability test + AC rule table
//   hitPoints blanking                             → HP rule table
//   style props / per-attitude goldens / fallback→ 5-row it.each golden + fallback
//   (props-exist test vacuous vs golden; new-object-per-call dropped —
//    style objects are read-only React props, not mutated like form state)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ABILITY_ABBR,
  ABILITY_LABELS,
  ATTITUDE_OPTIONS,
  ATTITUDE_COLORS,
  getDefaultFormData,
  cleanNPCData,
  getAttitudeStyle,
} from './npcFormUtils.js';

describe('npcFormUtils', () => {
  describe('constants', () => {
    it('pins the six ability abbreviations and their uppercase labels', () => {
      expect(ABILITY_ABBR).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
      // #1006 fix#363: hand-typed uppercase-label golden trimmed as low-value —
      // key-set stays exact here; the LABEL bytes are pinned consumer-side where
      // they render verbatim: NPCStatBlockForm.jsx:134 prints ABILITY_LABELS[ab]
      // and NPCStatBlockForm.test.jsx:86 pins the rendered list against the map.
      expect(Object.keys(ABILITY_LABELS)).toEqual(ABILITY_ABBR);
    });

    it('pins attitude options and matches every option value to a color entry', () => {
      expect(ATTITUDE_OPTIONS).toEqual([
        { value: 'deep bonds', label: 'Deep Bonds' },
        { value: 'positive', label: 'Positive' },
        { value: 'neutral', label: 'Neutral' },
        { value: 'negative', label: 'Negative' },
        { value: 'extreme opposition', label: 'Extreme Opposition' },
      ]);
      // Parity: every selectable attitude has colors, so the selected NPC
      // never renders via the getAttitudeStyle fallback.
      expect(ATTITUDE_OPTIONS.map((o) => o.value)).toEqual(Object.keys(ATTITUDE_COLORS));
    });
  });

  describe('getDefaultFormData', () => {
    it('returns the full default form — exact key-set, junk absent by construction', () => {
      expect(getDefaultFormData()).toEqual({
        name: '',
        race: '',
        classRole: '',
        appearance: '',
        personality: '',
        goals: '',
        secrets: '',
        notes: '',
        tags: '',
        attitude: 'neutral',
        image: '',
        imageName: '',
        imagePath: '',
        armorClass: null, // null until GM fills real combat stats (initiative gate)
        hitPoints: '',
        hitDice: '',
        initiativeBonus: '',
        speed: { walk: '30 ft.' },
        abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        savingThrowBonuses: {},
        skillBonuses: {},
        damageResistances: [],
        damageImmunities: [],
        conditionImmunities: [],
        actions: [],
        traits: '',
        reactions: '',
      });
    });

    it('applies overrides while untouched fields keep their defaults', () => {
      const form = getDefaultFormData({
        name: 'Grog',
        hitPoints: 20,
        armorClass: 15,
        abilityScores: { str: 18, dex: 14, con: 16, int: 10, wis: 8, cha: 12 },
        damageResistances: ['fire', 'cold'],
        actions: [{ name: 'Longsword' }],
      });
      expect(form.name).toBe('Grog');
      expect(form.hitPoints).toBe(20);
      expect(form.armorClass).toBe(15);
      expect(form.abilityScores).toEqual({ str: 18, dex: 14, con: 16, int: 10, wis: 8, cha: 12 });
      expect(form.damageResistances).toEqual(['fire', 'cold']);
      expect(form.actions).toEqual([{ name: 'Longsword' }]);
      expect(form.attitude).toBe('neutral');
      expect(form.speed).toEqual({ walk: '30 ft.' });
    });

    it('gives each call its own mutable nested fields', () => {
      const form1 = getDefaultFormData();
      const form2 = getDefaultFormData();
      form1.abilityScores.str = 20;
      form1.damageResistances.push('fire');
      form1.speed.walk = '40 ft.';
      expect(form2.abilityScores.str).toBe(10);
      expect(form2.damageResistances).toEqual([]);
      expect(form2.speed.walk).toBe('30 ft.');
    });
  });

  describe('cleanNPCData', () => {
    let consoleSpy;
    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('returns a new object, passes valid fields through, and never mutates the input', () => {
      const data = { name: 'Grog', race: 'Orc', armorClass: '16', hitPoints: '20' };
      const cleaned = cleanNPCData(data);
      expect(cleaned).not.toBe(data);
      expect(cleaned).toEqual({ name: 'Grog', race: 'Orc', armorClass: 16, hitPoints: '20' });
      expect(data).toEqual({ name: 'Grog', race: 'Orc', armorClass: '16', hitPoints: '20' });
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    // AC coercion: one row per distinct rule of the GM text-field pipeline.
    it.each([
      ['number passes through', { name: 'Grog', armorClass: 16 }, 16, null],
      ['zero AC is data, not blank', { name: 'Grog', armorClass: 0 }, 0, null],
      ['negative AC is kept', { name: 'Grog', armorClass: -5 }, -5, null],
      ['numeric string parsed to number', { name: 'Grog', armorClass: '16' }, 16, null],
      ['zero string parses to 0, not blank', { name: 'Grog', armorClass: '0' }, 0, null],
      ['leading digits parsed, trailing text ignored', { name: 'Grog', armorClass: '16 ac' }, 16, null],
      ['empty string blanked to null', { name: 'Grog', armorClass: '' }, null, null],
      ['null stays null', { name: 'Grog', armorClass: null }, null, null],
      ['undefined blanked to null', { name: 'Grog', armorClass: undefined }, null, null],
      [
        'unparseable blanked to null and logged',
        { name: 'Grog', armorClass: 'bad' },
        null,
        '[AC] NPC "Grog" has invalid AC: bad. Leaving AC blank.',
      ],
      [
        'missing name logged as "undefined"',
        { armorClass: 'bad' },
        null,
        '[AC] NPC "undefined" has invalid AC: bad. Leaving AC blank.',
      ],
    ])('%s', (_title, data, expectedAC, expectedLog) => {
      const cleaned = cleanNPCData(data);
      expect(cleaned.armorClass).toBe(expectedAC);
      if (expectedLog) {
        expect(consoleSpy).toHaveBeenCalledWith(expectedLog);
      } else {
        expect(consoleSpy).not.toHaveBeenCalled();
      }
    });

    // hitPoints: only empty-string is normalized; values pass through uncoerced.
    it.each([
      ['empty string blanked to null', '', null],
      ['numeric string kept as string (not coerced)', '20', '20'],
      ['number passes through', 20, 20],
      ['zero HP is data, kept', 0, 0],
    ])('%s', (_title, hitPoints, expected) => {
      expect(cleanNPCData({ name: 'Grog', hitPoints }).hitPoints).toBe(expected);
    });
  });

  describe('getAttitudeStyle', () => {
    // React style prop consumed by NPCListItem — camelCase suffixes pinned.
    it.each([
      ['deep bonds', { backgroundColor: '#1a472a', color: '#90ee90', borderColor: '#2d6a4f' }],
      ['positive', { backgroundColor: '#1b4332', color: '#b7e4c7', borderColor: '#40916c' }],
      ['neutral', { backgroundColor: '#4a4a4a', color: '#e0e0e0', borderColor: '#6b6b6b' }],
      ['negative', { backgroundColor: '#7b241c', color: '#f4a0a0', borderColor: '#a43330' }],
      ['extreme opposition', { backgroundColor: '#5c030e', color: '#ff6b6b', borderColor: '#8b0000' }],
    ])('returns the pinned style for %s attitude', (attitude, expected) => {
      expect(getAttitudeStyle(attitude)).toEqual(expected);
    });

    it('falls back to neutral style for unknown or empty attitudes', () => {
      const neutralStyle = getAttitudeStyle('neutral');
      for (const attitude of ['nope', null, undefined, '']) {
        expect(getAttitudeStyle(attitude)).toEqual(neutralStyle);
      }
    });
  });
});
