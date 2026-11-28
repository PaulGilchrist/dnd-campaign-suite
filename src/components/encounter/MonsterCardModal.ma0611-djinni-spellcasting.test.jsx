// @maintained-by-ai 2026-11-28
// MA-0611 data lock: Djinni Spellcasting + the MA-0421/MA-0524/MA-0532/MA-0576
// markup-gap template family (19 extension rows committed onto this byte-shape).
// Pre-fix every row was plain-text names with only tier headers carrying
// <strong> → extractSpellNamesFromSpellcasting [] → SpellCastLinks null → zero
// chips; the DATA fix wrapped each spell name (+ trailing numeric save_dc +
// save_type pair where the ticket authored one; MA-0454/MA-0421/MA-0576).
// Lock shape per row (exact toEqual gate map subsumes every At Will / header
// not.toContain negative, #653/#657): BY-name extraction + exact uses gate map
// + save_dc pair + strip-tags byte-equality vs the pre-fix prose + positive
// upcast/qualifier-outside-wrap pins (#656) — distinct bytes ONLY.
// LIVE SPELL LANE: the loadSpells mock below is disk-faithful (full 5e + 2024
// tables), so the Djinni e2e pins the LIVE findMonsterSpell 5e-first
// resolution: Plane Shift refuses through the MA-0033 attack lane ONLY because
// the 5e row authors attack_type melee — the 2024 row carries attack_type null
// and would fall to the advisory lane, failing the refusal pin.
// Coverage ownership elsewhere (trimmed from this file 2026-11-28 per the
// twin-lane #2022 recipe — twin renders of one shared code path + pure
// disk-shape censuses): chip render spellcasting.test.jsx:185; per-day
// counters :275; gated 1/Day + 2/Day spend/refusal wording :281/:317/:518 +
// usage.test.js:16-38 (#571); multi-name EACH independence + refire refusal
// ma0619-dracolich:188 + ma0564-death-knight:219; At Will ungated-twice +
// row-DC advisory log spellcasting.test.jsx:318/:377 + ma0558:180; At Will
// repeated-cast advisory class :317/:552 + ma0524:222; DC 0/Wisdom advisory
// residual → DC-value census lanes (ability-save-uses et al.); quaggoth Claw
// guard → ma1363 file; Control Weather zero-target advisory → ma0674 file;
// MA-1543 storm-giant row is locked by the FAMILY entry below, thunderbolt
// behavior → ma1541 file. Thonot decoy absence is byte-locked by the FAMILY
// notContains ['<strong>Invisible</strong>'] entry. Rakshasa Cursed Touch
// (MA-1378) intact-bytes: MonsterAction.ma1378:39 fused lock pins the FULL
// disk row toEqual + key order (name/hit_conditions/3d12/attack_bonus all
// inside) — this file's weaker 4-field clobber-guard was strictly redundant.
// attack_bonus on Spellcasting rows is INERT (monsterSpellAttackBonus reads
// only spell_attack_bonus/prose — Helpers:633), so the §490 stripped-key and
// §118 save_effect censuses were pure disk shape and are cut.
// CITED BY SIBLINGS: ma0558-death-cultist header cites "ma0611-djinni:2353"
// for at-Will Thaumaturgy row-DC log — that line was stale pre-trim and the
// named behavior now lives ONLY in ma0558's own cast e2e (:180, it casts
// Thaumaturgy itself); ma1541 cites "ma0611 MA-1543 lock" — kept (FAMILY row).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));
const spellRow = (index) => monsters.find(m => m.index === index).actions.find(a => a.name === 'Spellcasting');

const djinniRow = spellRow('djinni');
const nightHagRow = spellRow('night-hag');
const nobleProdigyRow = spellRow('noble-prodigy');
const oniRow = spellRow('oni');
const performerLegendRow = spellRow('performer-legend');
const performerMaestroRow = spellRow('performer-maestro');
const pixieRow = spellRow('pixie');
const pixieWbRow = spellRow('pixie-wonderbringer');
const planetarRow = spellRow('planetar');
const priestRow = spellRow('priest');
const priestAcolyteRow = spellRow('priest-acolyte');
const thonotRow = spellRow('quaggoth-thonot');
const questingKnightRow = spellRow('questing-knight');
const rakshasaRow = spellRow('rakshasa');
const sahuaginPriestRow = spellRow('sahuagin-priest');
const solarRow = spellRow('solar');
const sphinxRow = spellRow('sphinx-of-lore');
const sosRow = spellRow('sphinx-of-secrets');
const svRow = spellRow('sphinx-of-valor');
const stormGiantRow = spellRow('storm-giant');

const NAMES = ['Detect Evil and Good', 'Detect Magic', 'Create Food and Water', 'Tongues', 'Wind Walk', 'Creation', 'Gaseous Form', 'Invisibility', 'Major Image', 'Plane Shift'];
const NH_NAMES = ['Detect Magic', 'Etherealness', 'Magic Missile', 'Phantasmal Killer', 'Plane Shift'];
const NP_NAMES = ['Mage Armor', 'Mage Hand', 'Minor Illusion', 'Befuddlement', 'Detect Thoughts', 'Fly', 'Scrying', 'Shatter'];
const OI_NAMES = ['Charm Person', 'Darkness', 'Gaseous Form', 'Sleep'];
const PL_NAMES = ['Mage Hand', 'Minor Illusion', 'Prestidigitation', 'Major Image', 'Project Image'];
const PM_NAMES = ['Minor Illusion', 'Prestidigitation', "Tasha's Hideous Laughter"];
const PX_NAMES = ['Dancing Lights', 'Druidcraft', 'Invisibility', 'Detect Thoughts', 'Fly', 'Sleep'];
const WB_NAMES = ['Dancing Lights', 'Druidcraft', 'Invisibility', 'Detect Thoughts', 'Fly', 'Major Image'];
const PT_NAMES = ['Detect Evil and Good', 'Commune', 'Control Weather', 'Dispel Evil and Good', 'Raise Dead'];
const PR_NAMES = ['Light', 'Thaumaturgy', 'Spirit Guardians'];
const PA_NAMES = ['Light', 'Thaumaturgy'];
const QT_NAMES = ['Mage Hand', 'Minor Illusion', 'Mind Spike'];
const QK_NAMES = ['Daylight', 'Dispel Evil and Good', 'Greater Restoration', 'Phantom Steed'];
const RK_NAMES = ['Detect Magic', 'Detect Thoughts', 'Disguise Self', 'Mage Hand', 'Minor Illusion', 'Fly', 'Invisibility', 'Major Image', 'Plane Shift'];
const SP_NAMES = ['Thaumaturgy', 'Hold Person', 'Tongues'];
const SL_NAMES = ['Detect Evil and Good', 'Commune', 'Control Weather', 'Dispel Evil and Good', 'Resurrection'];
const SN_NAMES = ['Detect Magic', 'Identify', 'Mage Hand', 'Minor Illusion', 'Prestidigitation', 'Dispel Magic', 'Legend Lore', 'Locate Object', 'Plane Shift', 'Remove Curse', 'Tongues'];
const SS_NAMES = ['Detect Magic', 'Identify', 'Prestidigitation', 'Locate Object', 'Remove Curse'];
const SV_NAMES = ['Detect Evil and Good', 'Thaumaturgy', 'Detect Magic', 'Dispel Magic', 'Greater Restoration', "Heroes' Feast", 'Zone of Truth'];
const SG_NAMES = ['Detect Magic', 'Light', 'Control Weather'];

// Pre-fix disk prose (byte payload for the strip-tags equality lock). The fix
// is markup-only — except NP's OCR typo repair and SG's ticket-directed
// "; " tier-separator fold, both encoded in the constant names/comments below.
const DJINNI_PLAIN_ORIGINAL = 'The djinni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17):\nAt Will: Detect Evil and Good, Detect Magic\n2/Day Each: Create Food and Water (can create wine instead of water), Tongues, Wind Walk\n1/Day Each: Creation, Gaseous Form, Invisibility, Major Image, Plane Shift';
const NH_PLAIN_ORIGINAL = 'The hag casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 14):\nAt Will: Detect Magic, Etherealness, Magic Missile (level 4 version)\n2/Day Each: Phantasmal Killer, Plane Shift (self only)';
const NP_PLAIN_ORIGINAL = 'The noble casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16):\nAt Will: Mage Armor (included in AC), Mage Hand, Minor Illusion\n1/Day Each: Befuddle ment, Detect Thoughts, Fly, Scrying, Shatter (level 7 version)';
const OI_PLAIN_ORIGINAL = 'The oni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13):\n1/Day Each: Charm Person (level 2 version), Darkness, Gaseous Form, Sleep';
const PL_PLAIN_ORIGINAL = 'The performer casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17):\nAt Will: Mage Hand, Minor Illusion, Prestidigitation\n1/Day Each: Major Image, Project Image';
const PM_PLAIN_ORIGINAL = 'The performer casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15):\nAt Will: Minor Illusion, Prestidigitation\n1/Day: Tasha\'s Hideous Laughter (level 3 version)';
const PX_PLAIN_ORIGINAL = 'The pixie casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 12):\nAt Will: Dancing Lights, Druidcraft, Invisibility (self only)\n1/Day Each: Detect Thoughts, Fly, Sleep';
const WB_PLAIN_ORIGINAL = 'The pixie casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15):\nAt Will: Dancing Lights, Druidcraft, Invisibility (self only)\n1/Day Each: Detect Thoughts, Fly, Major Image';
const PT_PLAIN_ORIGINAL = 'The planetar casts one of the following spells, requiring no Material components and using Charisma as spellcasting ability (spell save DC 20):\nAt Will: Detect Evil and Good\n1/Day Each: Commune, Control Weather, Dispel Evil and Good, Raise Dead';
const PR_PLAIN_ORIGINAL = 'The priest casts one of the following spells, using Wisdom as the spellcasting ability:\nAt Will: Light, Thaumaturgy\n1/Day: Spirit Guardians';
const PA_PLAIN_ORIGINAL = 'The priest casts one of the following spells, using Wisdom as the spellcasting ability:\nAt Will: Light, Thaumaturgy';
const QT_PLAIN_ORIGINAL = 'The quaggoth casts one of the following spells, requiring no spell components and using Wisdom as the spellcasting ability (spell save DC 12):\nAt Will: Mage Hand (the hand is Invisible), Minor Illusion\n2/Day: Mind Spike';
const QK_PLAIN_ORIGINAL = 'The knight casts one of the following spells, using Charisma as the spellcasting ability (spell save DC 16):\n1/Day Each: Daylight, Dispel Evil and Good, Greater Restoration, Phantom Steed';
const RK_PLAIN_ORIGINAL = 'The rakshasa casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18):\nAt Will: Detect Magic, Detect Thoughts, Disguise Self, Mage Hand, Minor Illusion\n1/Day Each: Fly, Invisibility, Major Image, Plane Shift';
const SP_PLAIN_ORIGINAL = 'The sahuagin casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 12):\nAt Will: Thaumaturgy\n2/Day Each: Hold Person, Tongues';
const SL_PLAIN_ORIGINAL = 'The solar casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 25): At Will: Detect Evil and Good; 1/Day Each: Commune, Control Weather, Dispel Evil and Good, Resurrection';
const SN_PLAIN_ORIGINAL = 'The sphinx casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 16): At Will: Detect Magic, Identify, Mage Hand, Minor Illusion, Prestidigitation; 1/Day Each: Dispel Magic, Legend Lore, Locate Object, Plane Shift, Remove Curse, Tongues';
const SS_PLAIN_ORIGINAL = 'The sphinx casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 15): At Will: Detect Magic, Identify, Prestidigitation; 1/Day Each: Locate Object, Remove Curse';
const SV_PLAIN_ORIGINAL = 'The sphinx casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 20): At Will: Detect Evil and Good, Thaumaturgy; 1/Day Each: Detect Magic, Dispel Magic, Greater Restoration, Heroes\' Feast, Zone of Truth';
const SG_PLAIN_ORIGINAL = 'The giant casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 18):\nAt Will: Detect Magic, Light\n1/Day: Control Weather';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const FAMILY = [
  { label: 'MA-0611 Djinni', row: djinniRow, plain: DJINNI_PLAIN_ORIGINAL, names: NAMES, uses: { 'Create Food and Water': 2, 'Tongues': 2, 'Wind Walk': 2, 'Creation': 1, 'Gaseous Form': 1, 'Invisibility': 1, 'Major Image': 1, 'Plane Shift': 1 }, saveDc: 17, saveType: 'Charisma', dcProse: true, doubleKey: true, pins: [/<strong>Create Food and Water<\/strong> \(can create wine instead of water\)/] },
  { label: 'MA-1230 Night Hag', row: nightHagRow, plain: NH_PLAIN_ORIGINAL, names: NH_NAMES, uses: { 'Phantasmal Killer': 2, 'Plane Shift': 2 }, saveDc: 14, saveType: 'Intelligence', dcProse: true, pins: [/<strong>Magic Missile<\/strong> \(level 4 version\)/, /<strong>Plane Shift<\/strong> \(self only\)/] },
  { label: 'MA-1241 Noble Prodigy', row: nobleProdigyRow, plain: NP_PLAIN_ORIGINAL.replace('Befuddle ment', 'Befuddlement'), names: NP_NAMES, uses: { 'Befuddlement': 1, 'Detect Thoughts': 1, 'Fly': 1, 'Scrying': 1, 'Shatter': 1 }, saveDc: 16, saveType: 'Charisma', dcProse: true, pins: [/<strong>Mage Armor<\/strong> \(included in AC\)/, /<strong>Shatter<\/strong> \(level 7 version\)/, /<strong>Befuddlement<\/strong>/], notContains: ['Befuddle ment'] },
  { label: 'MA-1261 Oni', row: oniRow, plain: OI_PLAIN_ORIGINAL, names: OI_NAMES, uses: { 'Charm Person': 1, 'Darkness': 1, 'Gaseous Form': 1, 'Sleep': 1 }, saveDc: 13, saveType: 'Charisma', dcProse: true, pins: [/<strong>Charm Person<\/strong> \(level 2 version\)/] },
  { label: 'MA-1289 Performer Legend', row: performerLegendRow, plain: PL_PLAIN_ORIGINAL, names: PL_NAMES, uses: { 'Major Image': 1, 'Project Image': 1 }, saveDc: 17, saveType: 'Charisma', dcProse: true },
  { label: 'MA-1294 Performer Maestro', row: performerMaestroRow, plain: PM_PLAIN_ORIGINAL, names: PM_NAMES, uses: { "Tasha's Hideous Laughter": 1 }, saveDc: 15, saveType: 'Charisma', dcProse: true, pins: [/<strong>Tasha's Hideous Laughter<\/strong> \(level 3 version\)/] },
  { label: 'MA-1320 Pixie', row: pixieRow, plain: PX_PLAIN_ORIGINAL, names: PX_NAMES, uses: { 'Detect Thoughts': 1, 'Fly': 1, 'Sleep': 1 }, saveDc: 12, saveType: 'Charisma', dcProse: true, pins: [/<strong>Invisibility<\/strong> \(self only\)/] },
  { label: 'MA-1323 Pixie Wonderbringer', row: pixieWbRow, plain: WB_PLAIN_ORIGINAL, names: WB_NAMES, uses: { 'Detect Thoughts': 1, 'Fly': 1, 'Major Image': 1 }, saveDc: 15, saveType: 'Charisma', dcProse: true, pins: [/<strong>Invisibility<\/strong> \(self only\)/], notContains: ['Sleep'] },
  { label: 'MA-1327 Planetar', row: planetarRow, plain: PT_PLAIN_ORIGINAL, names: PT_NAMES, uses: { 'Commune': 1, 'Control Weather': 1, 'Dispel Evil and Good': 1, 'Raise Dead': 1 }, saveDc: 20, saveType: 'Charisma', dcProse: true },
  { label: 'MA-1339 Priest', row: priestRow, plain: PR_PLAIN_ORIGINAL, names: PR_NAMES, uses: { 'Spirit Guardians': 1 }, saveDc: 13, saveType: 'Wisdom', dcProse: false },
  { label: 'MA-1342 Priest Acolyte', row: priestAcolyteRow, plain: PA_PLAIN_ORIGINAL, names: PA_NAMES, uses: {}, saveDc: 0, saveType: 'Wisdom', dcProse: false },
  { label: 'MA-1366 Quaggoth Thonot', row: thonotRow, plain: QT_PLAIN_ORIGINAL, names: QT_NAMES, uses: { 'Mind Spike': 2 }, saveDc: 12, saveType: 'Wisdom', dcProse: true, pins: [/<strong>Mage Hand<\/strong> \(the hand is Invisible\)/], notContains: ['<strong>Invisible</strong>', '<em>Invisible</em>'] },
  { label: 'MA-1375 Questing Knight', row: questingKnightRow, plain: QK_PLAIN_ORIGINAL, names: QK_NAMES, uses: { 'Daylight': 1, 'Dispel Evil and Good': 1, 'Greater Restoration': 1, 'Phantom Steed': 1 }, saveDc: 16, saveType: 'Charisma', dcProse: true },
  { label: 'MA-1380 Rakshasa', row: rakshasaRow, plain: RK_PLAIN_ORIGINAL, names: RK_NAMES, uses: { 'Fly': 1, 'Invisibility': 1, 'Major Image': 1, 'Plane Shift': 1 }, saveDc: 18, saveType: 'Charisma', dcProse: true },
  { label: 'MA-1419 Sahuagin Priest', row: sahuaginPriestRow, plain: SP_PLAIN_ORIGINAL, names: SP_NAMES, uses: { 'Hold Person': 2, 'Tongues': 2 }, saveDc: 12, saveType: 'Wisdom', dcProse: true },
  { label: 'MA-1478 Solar', row: solarRow, plain: SL_PLAIN_ORIGINAL, names: SL_NAMES, uses: { 'Commune': 1, 'Control Weather': 1, 'Dispel Evil and Good': 1, 'Resurrection': 1 }, saveDc: 25, saveType: 'Charisma', dcProse: true },
  { label: 'MA-1493 Sphinx of Lore', row: sphinxRow, plain: SN_PLAIN_ORIGINAL, names: SN_NAMES, uses: { 'Dispel Magic': 1, 'Legend Lore': 1, 'Locate Object': 1, 'Plane Shift': 1, 'Remove Curse': 1, 'Tongues': 1 }, saveDc: 16, saveType: 'Intelligence', dcProse: true },
  { label: 'MA-1499 Sphinx of Secrets', row: sosRow, plain: SS_PLAIN_ORIGINAL, names: SS_NAMES, uses: { 'Locate Object': 1, 'Remove Curse': 1 }, saveDc: 15, saveType: 'Intelligence', dcProse: true },
  { label: 'MA-1506 Sphinx of Valor', row: svRow, plain: SV_PLAIN_ORIGINAL, names: SV_NAMES, uses: { 'Detect Magic': 1, 'Dispel Magic': 1, 'Greater Restoration': 1, "Heroes' Feast": 1, 'Zone of Truth': 1 }, saveDc: 20, saveType: 'Wisdom', dcProse: true },
  { label: 'MA-1543 Storm Giant', row: stormGiantRow, plain: SG_PLAIN_ORIGINAL, names: SG_NAMES, uses: { 'Control Weather': 1 }, saveDc: 18, saveType: 'Wisdom', dcProse: true, pins: [/<em>Control Weather<\/em>/] },
];

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  // Disk-faithful full tables: findMonsterSpell is 5e-first with the 2024
  // fallback, and the e2e below pins that live order (Plane Shift's
  // attack_type exists on the 5e row only).
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? spells2024 : spells5e)),
}));

// Bisected dead mocks (kept removed, verified green): diceRoller, useLoggedDiceRoll
// (advisory + refusal lanes never roll). The remaining support mocks above are LIVE —
// loading the real modules fails in jsdom (empirically re-verified this pass).
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures } = {}, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 60)),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn(() => 0),
}));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    key: (characterKey, propertyName) => `${characterKey}.${propertyName}`,
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => { store[`${characterKey}.${propertyName}`] = value; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
    useRuntimeValue: vi.fn((characterKey, propertyName) => store[`${characterKey}.${propertyName}`] ?? null),
  };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

const MONSTER_NAME = 'Djinni 1';

function renderDjinni() {
  const m = makeMonster({ name: 'Djinni', actions: [djinniRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'elemental', targetName: 'Bandit', ac: 17, currentHp: 218, maxHp: 218, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: all twenty MA-0421-family Spellcasting rows, one test per row ──

describe('MA-0421-family data lock: Spellcasting rows — BY-name extraction + exact gate map + save_dc pair + strip-tags byte diff', () => {
  it.each(FAMILY)('$label', ({ row, plain, names, uses, saveDc, saveType, dcProse = true, doubleKey = false, pins = [], notContains = [] }) => {
    // Exact toEqual gate maps subsume every tier-header/At Will not.toContain
    // negative (#653/#657); extraction is unfiltered, so any stray emphasis
    // span (fake-chip decoy, marked parenthetical) fails these bytes (§161).
    expect(extractSpellNamesFromSpellcasting(row.description)).toEqual(names);
    expect(extractSpellcastingSpellUses(row.description)).toEqual(uses);
    expect(row.save_dc).toBe(saveDc);
    expect(row.save_type).toBe(saveType);
    if (doubleKey) {
      expect(row.spell_save_dc).toBe(saveDc);
      expect(row.spellcasting_ability).toBe(saveType);
    }
    if (dcProse) expect(row.description).toContain(`spell save DC ${saveDc}`);
    else expect(row.description).not.toMatch(/spell save DC \d+/);
    pins.forEach(re => expect(row.description).toMatch(re));
    notContains.forEach(s => expect(row.description).not.toContain(s));
    expect(stripTags(row.description)).toBe(plain);
  });
});

// ── Modal lane: one e2e on the flagship row (twin monster renders trimmed) ───

describe('MA-0611 MonsterCardModal Djinni Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('one-render e2e: ten chips in authored order; At Will Detect Magic casts ungated twice, advisory log prints row DC 17, zero uses written; Plane Shift refuses honestly through the 5e-first attack lane (2024 row has attack_type null) with zero spend', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderDjinni();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);

    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/casts Detect Magic via Spellcasting/);
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 17/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(refusals('Detect Magic').length).toBe(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();

    await act(async () => { fireEvent.click(linkByText('Plane Shift')); });
    await waitFor(() => expect(refusals('Plane Shift').length).toBe(1));
    expect(abilityUseEntries('Plane Shift').length).toBe(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    consoleError.mockRestore();
  });
});
