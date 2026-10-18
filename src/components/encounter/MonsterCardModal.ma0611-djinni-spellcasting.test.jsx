// @maintained-by-ai
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
// Cite-skip owners (NOT repeated here): chip render spellcasting.test.jsx:184;
// per-day counters :275; gated 1/Day + 2/Day spend/refusal wording :281/:317/
// :518 + usage.test.js:16-38 (#571); At Will repeated-cast advisory class
// :317/:552 + ma0524:222; quaggoth Claw guard → ma1363 file; Control Weather
// zero-target advisory lane → ma0674 file.
// CITED BY SIBLINGS (keep byte-stable; report any shift):
//   ma0558-death-cultist → MA-1419 'At-Will Thaumaturgy casts ungated twice…'
//   MonsterAction.ma1378 → 'actions[1] Cursed Touch (MA-1378, edited same day)…'
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
const rakshasa = monsters.find(m => m.index === 'rakshasa');
const rakshasaRow = rakshasa.actions.find(a => a.name === 'Spellcasting');
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

// §158/§207: names absent from the 5e index that resolve only via the
// findMonsterSpell 5e→2024 fallback — and which the dataLoader mock below
// MUST serve on the '2024' branch (§177 ruleset-branch pitfall).
const ONLY_2024 = ['Befuddlement', "Tasha's Hideous Laughter", 'Mind Spike'];
const ALL_NAMES = [...new Set([...NAMES, ...NH_NAMES, ...NP_NAMES, ...OI_NAMES, ...PL_NAMES, ...PM_NAMES, ...PX_NAMES, ...WB_NAMES, ...PT_NAMES, ...PR_NAMES, ...PA_NAMES, ...QT_NAMES, ...QK_NAMES, ...RK_NAMES, ...SP_NAMES, ...SL_NAMES, ...SN_NAMES, ...SS_NAMES, ...SV_NAMES, ...SG_NAMES])];
const SPELLS = Object.fromEntries(ALL_NAMES.map(n => [n, spells5e.find(s => s.name === n)]).filter(([, s]) => Boolean(s)));
const SPELLS_2024 = Object.fromEntries(ONLY_2024.map(n => [n, spells2024.find(s => s.name === n)]).filter(([, s]) => Boolean(s)));

// attack_bonus policy (§490/MA-1369): MA-1369/1375/1380/1419/1478/1493/1499/
// 1506/1543 rows stripped the junk key (armed djinni + death-knight twins
// carry none); MA-1320/1323/1339/1342/1366 rows keep the 0 residual (out of
// scope per family precedent).
const attackBonusStripped = ['djinni', 'death-knight', 'questing-knight', 'rakshasa', 'sahuagin-priest', 'solar', 'sphinx-of-lore', 'sphinx-of-secrets', 'sphinx-of-valor', 'storm-giant'];

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
  // §177 ruleset-branch pitfall: findMonsterSpell is 5e-first, falling back
  // to loadSpells('2024') — the ONLY_2024 names resolve on that branch only.
  loadSpells: vi.fn((ruleset) => Promise.resolve(
    ruleset === '2024' ? Object.values(SPELLS_2024) : ALL_NAMES.map(n => SPELLS[n]).filter(Boolean)
  )),
}));

// Bisected dead mocks (kept removed, verified green): diceRoller, useLoggedDiceRoll
// (advisory chip lane never rolls). The remaining support mocks above are LIVE —
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

const PR_MONSTER_NAME = 'Priest 1';

function renderPriest() {
  const m = makeMonster({ name: 'Priest', actions: [priestRow] });
  const creatures = [
    { name: PR_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 13, currentHp: 38, maxHp: 38, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: PR_MONSTER_NAME, creatures })} />);
}

const PA_MONSTER_NAME = 'Priest Acolyte 1';

function renderPriestAcolyte() {
  const m = makeMonster({ name: 'Priest Acolyte', actions: [priestAcolyteRow] });
  const creatures = [
    { name: PA_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 13, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: PA_MONSTER_NAME, creatures })} />);
}

const QT_MONSTER_NAME = 'Quaggoth Thonot 1';

function renderQuaggothThonot() {
  const m = makeMonster({ name: 'Quaggoth Thonot', actions: [thonotRow] });
  const creatures = [
    { name: QT_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 13, currentHp: 67, maxHp: 67, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: QT_MONSTER_NAME, creatures })} />);
}

const QK_MONSTER_NAME = 'Questing Knight 1';

function renderQuestingKnight() {
  const m = makeMonster({ name: 'Questing Knight', actions: [questingKnightRow] });
  const creatures = [
    { name: QK_MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 18, currentHp: 202, maxHp: 202, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: QK_MONSTER_NAME, creatures })} />);
}

const SP_MONSTER_NAME = 'Sahuagin Priest 1';

function renderSahuaginPriest() {
  const m = makeMonster({ name: 'Sahuagin Priest', index: 'sahuagin-priest', type: 'fiend', actions: [sahuaginPriestRow] });
  const creatures = [
    { name: SP_MONSTER_NAME, type: 'npc', monsterType: 'fiend', targetName: 'Bandit', ac: 12, currentHp: 38, maxHp: 38, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: SP_MONSTER_NAME, creatures })} />);
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

  it('§490/MA-1369 attack_bonus census: stripped rows carry no attack_bonus key (armed djinni + death-knight twins precedent); MA-1320/1323/1339/1342/1366 keep the junk-0 residual (§490)', () => {
    attackBonusStripped.forEach(index => expect('attack_bonus' in spellRow(index)).toBe(false));
    expect(thonotRow.attack_bonus).toBe(0);
    expect(priestAcolyteRow.attack_bonus).toBe(0);
  });

  it('save_effect census: solar keeps its plain-text save_effect sibling byte (§118); sphinx family + storm giant carry no save_effect key', () => {
    expect(solarRow.save_effect).toBe(SL_PLAIN_ORIGINAL);
    expect(solarRow.save_effect).not.toMatch(/<(?:strong|em)>/);
    ['sphinx-of-lore', 'sphinx-of-secrets', 'sphinx-of-valor', 'storm-giant'].forEach(index => expect('save_effect' in spellRow(index)).toBe(false));
  });

  it('§207/§158 dual-index lane: Befuddlement + Tasha\'s Hideous Laughter + Mind Spike are 5e-absent/exact-2024 (findMonsterSpell fallback); all other family names byte-match BOTH indexes', () => {
    ONLY_2024.forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(false);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
    expect(spells5e.some(s => s.name === 'Hideous Laughter')).toBe(true);
    const b = spells2024.find(s => s.name === 'Befuddlement');
    expect(b.index).toBe('befuddlement');
    expect(b.level).toBe(8);
    expect(b.school).toBe('Enchantment');
    expect(b.dc.dc_type).toBe('INT');
    ALL_NAMES.filter(n => !ONLY_2024.includes(n)).forEach(n => {
      expect(spells5e.some(s => s.name === n)).toBe(true);
      expect(spells2024.some(s => s.name === n)).toBe(true);
    });
  });

  it('actions[1] Cursed Touch (MA-1378, edited same day) not clobbered — hit_conditions + secondary dice intact', () => {
    const ct = rakshasa.actions[1];
    expect(ct.name).toBe('Cursed Touch');
    expect(ct.hit_conditions).toEqual(['cursed']);
    expect(ct.damage_dice_secondary).toBe('3d12');
    expect(ct.attack_bonus).toBe(10);
  });
});

// ── Modal lanes: the distinct behavioral forks this family exercised ──────────

describe('MA-0611 MonsterCardModal Djinni Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders ten spell chips — the zero-chip inert row is gone', () => {
    renderDjinni();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
  });

  it('At Will Detect Magic casts ungated twice — zero uses, advisory log prints row DC 17', async () => {
    renderDjinni();
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 17/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Plane Shift (spells.json attack_type melee) refuses honestly — zero uses spent', async () => {
    renderDjinni();
    await act(async () => { fireEvent.click(linkByText('Plane Shift')); });
    await waitFor(() => expect(refusals('Plane Shift').length).toBe(1));
    expect(abilityUseEntries('Plane Shift').length).toBe(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

describe('MA-1339 MonsterCardModal Priest Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('At Will Light casts ungated twice — zero uses, advisory log prints row DC 13 (§204)', async () => {
    renderPriest();
    await act(async () => { fireEvent.click(linkByText('Light')); });
    await waitFor(() => expect(abilityUseEntries('Light').length).toBe(1));
    expect(abilityUseEntries('Light')[0].description).toMatch(/\(spell save DC 13/);
    await act(async () => { fireEvent.click(linkByText('Light')); });
    await waitFor(() => expect(abilityUseEntries('Light').length).toBe(2));
    expect(runtime.store[`${PR_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

describe('MA-1342 MonsterCardModal Priest Acolyte Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('save-less arm (§674): two chips render on row NAME + tier markup alone; both At Will names cast ungated, advisory log rides the row save_dc 0 residual (§490)', async () => {
    renderPriestAcolyte();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(PA_NAMES);
    await act(async () => { fireEvent.click(linkByText('Light')); });
    await waitFor(() => expect(abilityUseEntries('Light').length).toBe(1));
    expect(abilityUseEntries('Light')[0].description).toMatch(/casts Light via Spellcasting/);
    expect(abilityUseEntries('Light')[0].description).toMatch(/\(spell save DC 0, Wisdom\)/);
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });
    await waitFor(() => expect(abilityUseEntries('Thaumaturgy').length).toBe(1));
    expect(refusals('Thaumaturgy').length).toBe(0);
    expect(runtime.store[`${PA_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});

describe('MA-1366 MonsterCardModal Quaggoth Thonot Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders three spell chips and NO live junk-cast "Invisible" decoy affordance — the §161 decoy press that logged "casts Invisible via Spellcasting … GM-enforced" is dead', () => {
    renderQuaggothThonot();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(QT_NAMES);
    expect(linkByText('Invisible')).toBeNull();
  });
});

describe('MA-1375 MonsterCardModal Questing Knight Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('1/Day Each binds EACH name: four distinct casts spend one each, same-name re-fire refused', async () => {
    renderQuestingKnight();
    for (const n of QK_NAMES) {
      await act(async () => { fireEvent.click(linkByText(n)); });
      await waitFor(() => expect(abilityUseEntries(n).length).toBe(1));
      expect(refusals(n).length).toBe(0);
    }
    expect(runtime.store[`${QK_MONSTER_NAME}.monsterSpellUses`]).toEqual(Object.fromEntries(QK_NAMES.map(k => [k, 1])));
    await act(async () => { fireEvent.click(linkByText('Phantom Steed')); });
    await waitFor(() => expect(refusals('Phantom Steed').length).toBe(1));
    expect(abilityUseEntries('Phantom Steed').length).toBe(1);
  });
});

describe('MA-1419 MonsterCardModal Sahuagin Priest Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('At-Will Thaumaturgy casts ungated twice — zero uses, advisory log prints row DC 12/Wisdom (§204)', async () => {
    renderSahuaginPriest();
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });
    await waitFor(() => expect(abilityUseEntries('Thaumaturgy').length).toBe(1));
    expect(abilityUseEntries('Thaumaturgy')[0].description).toMatch(/\(spell save DC 12/);
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });
    await waitFor(() => expect(abilityUseEntries('Thaumaturgy').length).toBe(2));
    expect(refusals('Thaumaturgy').length).toBe(0);
    expect(runtime.store[`${SP_MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});
