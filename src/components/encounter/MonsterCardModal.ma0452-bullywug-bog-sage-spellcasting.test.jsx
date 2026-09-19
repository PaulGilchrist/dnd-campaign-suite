// MA-0452 data lock: Bullywug Bog Sage Multiattack "replace any attack with
// Spellcasting to cast Ray of Sickness" rode the Spellcasting-row chips
// (MA-0223), but the row wrapped ONLY "Vitriolic Sphere" in markup — Ray of
// Sickness / Dancing Lights / Druidcraft / Speak with Plants were plain text,
// so extractSpellNamesFromSpellcasting yielded ONE chip and the replace clause
// was inert (MA-0421 fingerprint). DATA-MARKUP fix wraps each At-Will name in
// <em> (archmage byte-shape precedent) and Speak with Plants too. Ray of
// Sickness is 2024-only (public/data/2024/spells.json): ranged spell attack
// (+5 authored spell_attack_bonus), 2d8 Poison + Poisoned on hit, NO save.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, monsterSpellAttackBonus, isSpellAttackSpell, spellDamageFormulaAtLevel } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const bogRow = monsters.find(m => m.index === 'bullywug-bog-sage').actions.find(a => a.name === 'Spellcasting');
const RAY = spells2024.find(s => s.name === 'Ray of Sickness');

const BOG_SPELLS = ['Dancing Lights', 'Druidcraft', 'Ray of Sickness', 'Speak with Plants', 'Vitriolic Sphere'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — markup-only diff
// proof: strip every tag from the FIXED row and it equals this byte-for-byte.
const BOG_PLAIN_ORIGINAL = 'The bullywug casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 13, +5 to hit with spell attacks):\nAt Will: Dancing Lights, Druidcraft, Ray of Sickness\n1/Day Each: Speak with Plants, Vitriolic Sphere';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Bullywug Bog Sage 1';

// ── Mocks (mirror MonsterCardModal.spell-attack.test.jsx) ──────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 13, rolls: [5, 8], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 26, rolls: [5, 8, 5, 8], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [RAY] : [])),
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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function spellLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-spell'));
}

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function abilityUseEntries(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use' && e.abilityName === name);
}

function renderBog(armed = true) {
  const m = makeMonster({ name: 'Bullywug Bog Sage', actions: [bogRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'fey', targetName: armed ? 'Bandit' : null, ac: 16, currentHp: 52, maxHp: 52, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 30, maxHp: 30, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: bullywug-bog-sage Spellcasting row ───────────────────────────

describe('MA-0452 monsters.json data lock: Bullywug Bog Sage Spellcasting row', () => {
  it('extracts all five spell names as chips incl. Ray of Sickness (was one)', () => {
    expect(extractSpellNamesFromSpellcasting(bogRow.description)).toEqual(BOG_SPELLS);
  });

  it('keys the 1/Day gate only for Speak with Plants + Vitriolic Sphere (At Will ungated)', () => {
    expect(extractSpellcastingSpellUses(bogRow.description)).toEqual({
      'Speak with Plants': 1, 'Vitriolic Sphere': 1,
    });
  });

  it('authors numeric spell_attack_bonus +5 + spell_save_dc 13 + Wisdom seam', () => {
    expect(bogRow.spell_attack_bonus).toBe(5);
    expect(bogRow.spell_save_dc).toBe(13);
    expect(bogRow.spellcasting_ability).toBe('Wisdom');
    expect(monsterSpellAttackBonus(bogRow)).toBe(5);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(bogRow.description)).toBe(BOG_PLAIN_ORIGINAL);
  });

  it('Ray of Sickness is 2024-only: ranged spell attack, 2d8 Poison, Poisoned on hit, NO save', () => {
    const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
    expect(spells5e.find(s => s.name === 'Ray of Sickness')).toBeFalsy();
    expect(RAY.attack_type).toBe('ranged');
    expect(isSpellAttackSpell(RAY)).toBe(true);
    expect(spellDamageFormulaAtLevel(RAY, 1)).toBe('2d8');
    expect(RAY.damage.damage_type).toBe('Poison');
    expect(RAY.status_effects).toContain('Poisoned');
    expect(RAY.dc ?? null).toBeNull();
  });
});

// ── Modal: Bullywug Bog Sage chips + Ray of Sickness cast routing ───────────

describe('MA-0452 MonsterCardModal Bullywug Bog Sage Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five clickable spell chips (was zero affordances for Ray)', () => {
    renderBog();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names.sort()).toEqual([...BOG_SPELLS].sort());
    expect(linkByText('Ray of Sickness')).toBeTruthy();
  });

  it('routes the Ray of Sickness click through the ATTACK seam (+5, 2d8 Poison, isSpellDamage) and NEVER a save', async () => {
    renderBog();
    await act(async () => { fireEvent.click(linkByText('Ray of Sickness')); });

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    const [name, bonus, options] = rollAttack.mock.calls[0];
    expect(name).toBe('Ray of Sickness');
    expect(bonus).toBe(5);
    expect(options.autoDamageFormula).toBe('2d8');
    expect(options.damageType).toBe('Poison');
    expect(options.targetName).toBe('Bandit');
    expect(options.attackerName).toBe(MONSTER_NAME);
    expect(options.isSpellDamage).toBe(true);
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('logs a spell-named ability_use cast record (level 1 ranged spell attack +5, 2d8); At Will spends no uses', async () => {
    renderBog();
    await act(async () => { fireEvent.click(linkByText('Ray of Sickness')); });

    await waitFor(() => expect(abilityUseEntries('Ray of Sickness').length).toBe(1));
    const entry = abilityUseEntries('Ray of Sickness')[0];
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Ray of Sickness via Spellcasting/);
    expect(entry.description).toMatch(/level 1 ranged spell attack \+5 vs Bandit/);
    expect(entry.description).toMatch(/2d8/);
    expect(entry.description).not.toMatch(/DC Unknown/i);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('refuses Ray of Sickness with no armed target — refusal log, zero roll, zero spend', async () => {
    renderBog(false);
    await act(async () => { fireEvent.click(linkByText('Ray of Sickness')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked' && e.abilityName === 'Ray of Sickness');
    expect(refusal).toBeTruthy();
    expect(rollAttack).not.toHaveBeenCalled();
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Speak with Plants + Vitriolic Sphere carry the 1/Day counter; At Will names do not', () => {
    renderBog();
    expect(linkByText('Vitriolic Sphere').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Speak with Plants').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Dancing Lights').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Druidcraft').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Ray of Sickness').textContent).not.toMatch(/\/Day/);
  });
});
