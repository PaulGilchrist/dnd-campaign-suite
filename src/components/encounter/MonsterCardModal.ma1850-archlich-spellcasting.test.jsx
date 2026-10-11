// MA-1850 data lock: Archlich Spellcasting rode the MA-0421/MA-0611/MA-0619
// twin markup-gap template. Pre-fix the WHOLE description was plain text —
// extractSpellNamesFromSpellcasting returned [] and extractSpellcastingSpellUses
// {} → SpellCastLinks null → ZERO .mc-dice-link-spell chips, no spell on the
// card castable, no DC/save/attack adjudication possible on the row (the only
// "DC 22 Wisdom" chip on the card belonged to legendary Dread Word — decoy).
// Row already carried the required save_dc 22 + save_type "Intelligence" pair
// (§89/§167 satisfied — MA-0614 spell_save_dc-only trap N/A). DATA fix:
// house-style <strong>Tier:</strong> <em>Spell</em> INLINE (originally-inline
// prose, no <br> — yochlol MA-1742 byte-shape), strip-tags byte-equality
// pinned; cosmetic "Mage Hand,Mage Armor" missing space fixed in the same
// pass. Phantasmagoria is ABSENT from BOTH spells.json (MA-0599 junk-log /
// console "Spell not found" fingerprint, Modal:2339 no resolvable-name guard
// in this lane) — it stays PLAIN TEXT: emphasis marks resolvable names only,
// the authored prose list survives byte-intact and no fake chip is armed.
// Blade Ward is 2024-only — casts live via the 5e→2024 fallback (§207/MA-0680).
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
const HEADERS = ['Cantrips (at will)', '1st-7th level (at will)', '8th-9th level (3 slots total per spell level)'];

// Pre-fix plain baseline: identical text, names unmarked, cosmetic typo fixed.
const PRE_FIX_DESCRIPTION = 'The archlich is a 20th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 22, +14 to hit with spell attacks). It has the following Wizard spells prepared: Cantrips (at will): Blade Ward, Fire Bolt, Mage Hand, Mage Armor. 1st-7th level (at will): Counterspell, Dispel Magic, Fly, Hold Monster, Lightning Bolt, Phantasmagoria, Shield. 8th-9th level (3 slots total per spell level): Mind Blank, Power Word Stun, Dominate Monster, Meteor Swarm, Time Stop, Wish.';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Archlich 1';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 9, rolls: [2, 4, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 18, rolls: [2, 4, 3, 2, 4, 3], modifier: 0 })),
}));

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

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: _rollAbilityCheck,
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: _rollSkillCheck,
    rollInitiative: _rollInitiative,
    quickRollPlayerSave: _quickRollPlayerSave,
  }));

  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _rollSavingThrow,
    _setPopupHtml,
  };
});

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
  it('extracts all sixteen resolvable spell names as chips — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(archlichRow.description);
    expect(names).toEqual(CHIP_NAMES);
    expect(names.length).toBeGreaterThanOrEqual(1);
    HEADERS.forEach(h => expect(names).not.toContain(h));
    // MA-0599 guard: the unresolvable name never becomes a chip.
    expect(names).not.toContain('Phantasmagoria');
  });

  it('no 1/Day headers on this row — every chip ungated (At-Will/level bands by design §57)', () => {
    expect(extractSpellcastingSpellUses(archlichRow.description)).toEqual({});
  });

  it('row-level numeric save_dc 22 + save_type Intelligence pair authored (§89 requirement)', () => {
    expect(archlichRow.save_dc).toBe(22);
    expect(archlichRow.save_type).toBe('Intelligence');
    expect(archlichRow.description).toMatch(/spell save DC 22/);
  });

  it('+14 spell attack seam resolves from the row prose (monsterSpellAttackBonus)', () => {
    expect(monsterSpellAttackBonus(archlichRow)).toBe(14);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description (typo fixed) byte-for-byte', () => {
    expect(stripTags(archlichRow.description)).toBe(PRE_FIX_DESCRIPTION);
  });

  it('house style: tier headers <strong>-wrapped ending ":", spell names <em>-wrapped inline, no <br>', () => {
    expect(archlichRow.description).not.toMatch(/<br>/);
    HEADERS.forEach(h => expect(archlichRow.description).toContain(`<strong>${h}:</strong>`));
    CHIP_NAMES.forEach(n => expect(archlichRow.description).toContain(`<em>${n}</em>`));
  });

  it('no fake chips: every marked token is a ":" header or a resolvable spell name (Phantasmagoria stays plain)', () => {
    expect(archlichRow.description).toContain(', Phantasmagoria,');
    expect(archlichRow.description).not.toMatch(/<(?:strong|em)>Phantasmagoria<\/(?:strong|em)>/);
    const marked = [...archlichRow.description.matchAll(/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g)].map(m => m[1]);
    marked.forEach(t => {
      const ok = t.endsWith(':') || CHIP_NAMES.includes(t);
      expect(ok, `marked token must be header or spell name: ${t}`).toBe(true);
    });
  });

  it('Phantasmagoria absent from BOTH spells.json (the reason it stays unmarked); Blade Ward 2024-only via §207 fallback', () => {
    expect(spells5e.some(s => s.name === 'Phantasmagoria')).toBe(false);
    expect(spells2024.some(s => s.name === 'Phantasmagoria')).toBe(false);
    expect(spells5e.some(s => s.name === 'Blade Ward')).toBe(false);
    expect(spells2024.some(s => s.name === 'Blade Ward')).toBe(true);
  });

  it('Lightning Bolt adjudicates with the row DC: DEX save, half on success, 8d6 at level 3', () => {
    const lb = spells5e.find(s => s.name === 'Lightning Bolt');
    expect(lb.dc.dc_type).toBe('DEX');
    expect(lb.dc.dc_success).toBe('half');
    expect(lb.damage.damage_at_slot_level['3']).toBe('8d6');
  });
});

// ── Modal: sixteen chips, ungated casts, honest refusals ─────────────────────

describe('MA-1850 MonsterCardModal Archlich Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders sixteen spell chips — the zero-chip inert row is gone', () => {
    renderArchlich();
    expect(spellLinks().map(el => el.textContent.trim())).toEqual(CHIP_NAMES);
    expect(spellLinks().length).toBeGreaterThan(0);
  });

  it('no chip carries a /Day counter (no 1/Day tier authored)', () => {
    renderArchlich();
    spellLinks().forEach(el => expect(el.textContent).not.toMatch(/\/Day/));
  });

  it('At-Will Fly casts ungated twice — zero uses, advisory log prints row DC 22', async () => {
    renderArchlich();
    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(abilityUseEntries('Fly').length).toBe(1));
    expect(abilityUseEntries('Fly')[0].description).toMatch(/spell save DC 22/);
    await act(async () => { fireEvent.click(linkByText('Fly')); });
    await waitFor(() => expect(abilityUseEntries('Fly').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Hold Monster records DC 22 WIS on the cast log (§336 row-local axis)', async () => {
    renderArchlich();
    await act(async () => { fireEvent.click(linkByText('Hold Monster')); });
    await waitFor(() => expect(abilityUseEntries('Hold Monster').length).toBe(1));
    expect(abilityUseEntries('Hold Monster')[0].description).toMatch(/spell save DC 22, WIS/);
  });

  it('Fire Bolt routes the spell-attack seam at +14 and refuses honestly pre-spend (cantrip-ladder data gap, zero spend)', async () => {
    renderArchlich();
    await act(async () => { fireEvent.click(linkByText('Fire Bolt')); });
    await waitFor(() => expect(refusalEntries('Fire Bolt').length).toBe(1));
    expect(refusalEntries('Fire Bolt')[0].description).toMatch(/no damage formula in spells\.json/);
    expect(refusalEntries('Fire Bolt')[0].description).toMatch(/Zero spend/);
    expect(abilityUseEntries('Fire Bolt').length).toBe(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});
