// @maintained-by-ai
// MA-1850 data lock: Archlich Spellcasting rode the MA-0421/MA-0611/MA-0619
// twin markup-gap template. Pre-fix the WHOLE description was plain text —
// extractors returned []/{} → SpellCastLinks null → ZERO .mc-dice-link-spell
// chips, nothing castable on the row. DATA fix: house-style
// <strong>Tier:</strong> <em>Spell</em> INLINE (yochlol MA-1742 byte-shape,
// no <br>); cosmetic "Mage Hand,Mage Armor" missing space fixed in the same
// pass. Row already carried save_dc 22 + save_type "Intelligence" (§89).
// Phantasmagoria is ABSENT from BOTH spells.json (MA-0599 junk-log lane) —
// it stays PLAIN TEXT: emphasis marks resolvable names only, no fake chip.
// Blade Ward is 2024-only — casts live via the 5e→2024 fallback (§207).
// Lane owns Spellcasting-ROW bytes only: Fire Bolt legendary-cast lane is
// ma1853, Dread Word DC 22 chip lane is ma1855 — cited, not absorbed.
// Generic owners cited (not duplicated here): 1/Day spend+refusal
// spellcasting.test.jsx:282-305 (this row authors NO gates — uses map {},
// so no spend cascade exists in this lane); Lightning Bolt save routing
// (half/8d6) spellcasting.test.jsx:227-242.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, monsterSpellAttackBonus } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const archlich = monsters.find(m => m.index === 'archlich');
const archlichRow = archlich.actions.find(a => a.name === 'Spellcasting');

const CHIP_NAMES = [
  'Blade Ward', 'Fire Bolt', 'Mage Hand', 'Mage Armor',
  'Counterspell', 'Dispel Magic', 'Fly', 'Hold Monster', 'Lightning Bolt', 'Shield',
  'Mind Blank', 'Power Word Stun', 'Dominate Monster', 'Meteor Swarm', 'Time Stop', 'Wish',
];

// Post-fix authored markup, byte-locked: tier headers <strong>-wrapped ending
// ":", resolvable spells <em>-wrapped inline, no <br>, Phantasmagoria plain.
const EXACT_DESCRIPTION = 'The archlich is a 20th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 22, +14 to hit with spell attacks). It has the following Wizard spells prepared: <strong>Cantrips (at will):</strong> <em>Blade Ward</em>, <em>Fire Bolt</em>, <em>Mage Hand</em>, <em>Mage Armor</em>. <strong>1st-7th level (at will):</strong> <em>Counterspell</em>, <em>Dispel Magic</em>, <em>Fly</em>, <em>Hold Monster</em>, <em>Lightning Bolt</em>, Phantasmagoria, <em>Shield</em>. <strong>8th-9th level (3 slots total per spell level):</strong> <em>Mind Blank</em>, <em>Power Word Stun</em>, <em>Dominate Monster</em>, <em>Meteor Swarm</em>, <em>Time Stop</em>, <em>Wish</em>.';
// Pre-fix plain baseline: identical text, names unmarked, typo fixed.
const PRE_FIX_DESCRIPTION = 'The archlich is a 20th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 22, +14 to hit with spell attacks). It has the following Wizard spells prepared: Cantrips (at will): Blade Ward, Fire Bolt, Mage Hand, Mage Armor. 1st-7th level (at will): Counterspell, Dispel Magic, Fly, Hold Monster, Lightning Bolt, Phantasmagoria, Shield. 8th-9th level (3 slots total per spell level): Mind Blank, Power Word Stun, Dominate Monster, Meteor Swarm, Time Stop, Wish.';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Archlich 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// §177: loadSpells mock MUST branch on the ruleset arg — findMonsterSpell is
// 5e-exact-first, Blade Ward only ever resolves through the 2024 fallback.
const NAMES_5E = CHIP_NAMES.filter(n => spells5e.some(s => s.name === n));
const SPELLS_5E = NAMES_5E.map(n => spells5e.find(s => s.name === n));
const SPELLS_2024 = CHIP_NAMES.map(n => spells2024.find(s => s.name === n)).filter(Boolean);

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? SPELLS_2024 : SPELLS_5E)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  })),
}));

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

function refusalEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderArchlich() {
  const m = makeMonster({ name: 'Archlich', actions: [archlichRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'undead', targetName: 'Bandit', ac: 15, currentHp: 475, maxHp: 475, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: archlich Spellcasting row ─────────────────────────────────────

describe('MA-1850 monsters.json data lock: Archlich Spellcasting row', () => {
  it('raw description byte-locked: house-style inline markup, Phantasmagoria plain, stripped text equals the pre-fix baseline (typo fixed)', () => {
    expect(archlichRow.description).toBe(EXACT_DESCRIPTION);
    expect(stripTags(archlichRow.description)).toBe(PRE_FIX_DESCRIPTION);
    expect(archlichRow.description).not.toMatch(/<(?:strong|em)>Phantasmagoria<\/(?:strong|em)>/);
  });

  it('extractor exact-map: all sixteen resolvable names harvest, tier headers and the unresolvable name never enter the harvest (§57, no fake chips)', () => {
    expect(extractSpellNamesFromSpellcasting(archlichRow.description)).toEqual(CHIP_NAMES);
  });

  it('no 1/Day headers on this row — every chip ungated (At-Will/level bands by design §57; spend-cascade lane N/A, owner spellcasting.test.jsx:282-305)', () => {
    expect(extractSpellcastingSpellUses(archlichRow.description)).toEqual({});
  });

  it('row adjudication pair: numeric save_dc 22 + save_type Intelligence (§89); +14 spell-attack seam resolves from the prose (monsterSpellAttackBonus)', () => {
    expect(archlichRow.save_dc).toBe(22);
    expect(archlichRow.save_type).toBe('Intelligence');
    expect(monsterSpellAttackBonus(archlichRow)).toBe(14);
  });

  it('spell-DB pins: Phantasmagoria absent from BOTH spells.json (why it stays unmarked); Blade Ward 2024-only (§207 fallback). Lightning Bolt half/8d6 shape owned by spellcasting.test.jsx:227-242', () => {
    expect(spells5e.some(s => s.name === 'Phantasmagoria')).toBe(false);
    expect(spells2024.some(s => s.name === 'Phantasmagoria')).toBe(false);
    expect(spells5e.some(s => s.name === 'Blade Ward')).toBe(false);
    expect(spells2024.some(s => s.name === 'Blade Ward')).toBe(true);
  });
});

// ── Modal: sixteen chips, ungated casts, honest refusals ─────────────────────

describe('MA-1850 MonsterCardModal Archlich Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders sixteen spell chips in authored order, none carrying a /Day counter (exact-name match subsumes counter check)', () => {
    renderArchlich();
    expect(spellLinks().map(el => el.textContent.trim())).toEqual(CHIP_NAMES);
  });

  it('cast lane: At-Will Fly repeats ungated, advisory log prints row DC 22, zero uses spent; Hold Monster records DC 22 WIS (§336 row-local axis)', async () => {
    renderArchlich();
    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(abilityUseEntries('Fly').length).toBe(1));
    expect(abilityUseEntries('Fly')[0].description).toMatch(/spell save DC 22/);
    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(abilityUseEntries('Fly').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();

    await act(async () => { fireEvent.click(linkByText('Hold Monster')); });
    await waitFor(() => expect(abilityUseEntries('Hold Monster').length).toBe(1));
    expect(abilityUseEntries('Hold Monster')[0].description).toMatch(/spell save DC 22, WIS/);
    expect(refusalEntries('Fly').length + refusalEntries('Hold Monster').length).toBe(0);
  });

  it('Fire Bolt routes the spell-attack seam at +14 and refuses honestly pre-spend (cantrip-ladder data gap, zero spend) — Spellcasting-row lane, legendary-cast lane owned by ma1853', async () => {
    renderArchlich();
    await act(async () => { fireEvent.click(linkByText('Fire Bolt')); });
    await waitFor(() => expect(refusalEntries('Fire Bolt').length).toBe(1));
    expect(refusalEntries('Fire Bolt')[0].description).toMatch(/no damage formula in spells\.json/);
    expect(refusalEntries('Fire Bolt')[0].description).toMatch(/Zero spend/);
    expect(abilityUseEntries('Fire Bolt').length).toBe(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});
