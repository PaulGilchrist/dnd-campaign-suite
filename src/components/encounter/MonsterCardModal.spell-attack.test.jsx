// MA-0033 regression: Adult Black Dragon Spellcasting — Melf's Acid Arrow
// (level 3 version) is a RANGED SPELL ATTACK (+9), not a save spell. The
// per-spell link must resolve through the attack seam (MA-0022 delegated
// roll shape): d20+9 vs the armed target, lv3 formula 5d4 Acid, spell-named
// logs, isSpellDamage marker — and NEVER a block-save prompt or the
// "Half damage on successful save" boilerplate. Refusals (no armed target)
// spend nothing.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { isSpellAttackSpell, spellDamageFormulaAtLevel, spellCastLevelFromSpellcasting, monsterSpellAttackBonus, extractSpellNamesFromSpellcasting } from './MonsterCardHelpers.js';

const SPELLCASTING = {
  name: 'Spellcasting',
  description: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17, +9 to hit with spell attacks):<br><strong>At Will:</strong> <em>Detect Magic</em>, <em>Fear</em>, <strong>Melf\'s Acid Arrow</strong> (level 3 version)<br><strong>1/Day Each:</strong> <em>Speak with Dead</em>, <em>Vitriolic Sphere</em>',
  save_dc: 17,
  save_type: 'Charisma',
  spell_attack_bonus: 9,
};

const SPELLS_5E = [
  { name: 'Detect Magic', level: 1, concentration: true, duration: 'Up to 10 minutes', damage: null, dc: null },
  { name: 'Fear', level: 3, concentration: true, duration: 'Concentration, up to 1 minute', damage: null, dc: { dc_type: 'WIS', dc_success: 'none' } },
];
const SPELLS_2024 = [
  { name: 'Melf\'s Acid Arrow', level: 2, attack_type: 'ranged', concentration: false, duration: 'Instantaneous', range: '90 feet', damage: { damage_type: 'Acid', damage_at_slot_level: { 2: '4d4', 3: '5d4' } }, dc: null },
];

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 13, rolls: [1, 4, 4, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 26, rolls: [1, 4, 4, 4], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? SPELLS_2024 : SPELLS_5E)),
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
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 90)),
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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollAttack = useLoggedDiceRoll._rollAttack;
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const MONSTER_NAME = 'Adult Black Dragon 1';

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function renderDragon(armed = true) {
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', targetName: armed ? 'DivinationWizard' : null, ac: 22 },
    { name: 'DivinationWizard', type: 'player', ac: 13 },
  ];
  const m = makeMonster({ name: 'Adult Black Dragon', actions: [SPELLCASTING] });
  const props = makeProps(m, { creatureName: MONSTER_NAME, creatures });
  render(<MonsterCardModal {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
});

describe('MA-0033 helpers — spell-attack detection and authored upcast parsing', () => {
  it('isSpellAttackSpell flags ranged/melee attack_type and rejects save spells', () => {
    expect(isSpellAttackSpell(SPELLS_2024[0])).toBe(true);
    expect(isSpellAttackSpell({ attack_type: 'save' })).toBe(false);
    expect(isSpellAttackSpell({ attack_type: 'melee' })).toBe(true);
    expect(isSpellAttackSpell(null)).toBe(false);
  });

  it('spellCastLevelFromSpellcasting parses the authored "(level 3 version)"', () => {
    const spell = SPELLS_2024[0];
    expect(spellCastLevelFromSpellcasting(SPELLCASTING.description, 'Melf\'s Acid Arrow', spell)).toBe(3);
    expect(spellCastLevelFromSpellcasting('<em>Guiding Bolt</em> (level 2 version)', 'Guiding Bolt', { level: 1 })).toBe(2);
    expect(spellCastLevelFromSpellcasting('<em>Guiding Bolt</em>', 'Guiding Bolt', { level: 1 })).toBe(1);
    expect(spellCastLevelFromSpellcasting(null, 'X', { level: 2 })).toBe(2);
  });

  it('spellDamageFormulaAtLevel returns the upcast formula (lv3 → 5d4)', () => {
    const spell = SPELLS_2024[0];
    expect(spellDamageFormulaAtLevel(spell, 3)).toBe('5d4');
    expect(spellDamageFormulaAtLevel(spell, 2)).toBe('4d4');
    expect(spellDamageFormulaAtLevel(spell, 5)).toBe('4d4');
  });

  it('monsterSpellAttackBonus prefers authored spell_attack_bonus, falls back to prose', () => {
    expect(monsterSpellAttackBonus(SPELLCASTING)).toBe(9);
    expect(monsterSpellAttackBonus({ description: 'using Charisma (+9 to hit with spell attacks)' })).toBe(9);
    expect(monsterSpellAttackBonus({ description: 'no numbers here' })).toBeNull();
  });
});

describe('MA-0033 monsters.json data — adult-black-dragon Spellcasting row', () => {
  it('enumerates Melf\'s Acid Arrow in strong markup and authors spell_attack_bonus 9', () => {
    const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
    const dragon = monsters.find(m => m.index === 'adult-black-dragon');
    const row = dragon.actions.find(a => a.name === 'Spellcasting');
    expect(extractSpellNamesFromSpellcasting(row.description)).toContain('Melf\'s Acid Arrow');
    expect(row.spell_attack_bonus).toBe(9);
    expect(row.description).toMatch(/\+9 to hit with spell attacks/);
    expect(row.description).toMatch(/level 3 version/);
  });
});

describe('MA-0033 MonsterCardModal — Melf\'s Acid Arrow casts as a spell attack, not a save', () => {
  it('routes the per-spell click through the attack seam with +9, lv3 5d4 Acid, spell-named and isSpellDamage-marked', async () => {
    renderDragon(true);
    const link = linkByText('Melf\'s Acid Arrow');
    expect(link).toBeTruthy();
    await act(async () => { fireEvent.click(link); });

    await waitFor(() => expect(rollAttack).toHaveBeenCalled());
    const [name, bonus, options] = rollAttack.mock.calls[0];
    expect(name).toBe('Melf\'s Acid Arrow');
    expect(bonus).toBe(9);
    expect(options.autoDamageFormula).toBe('5d4');
    expect(options.damageType).toBe('Acid');
    expect(options.targetName).toBe('DivinationWizard');
    expect(options.attackerName).toBe(MONSTER_NAME);
    expect(options.isSpellDamage).toBe(true);
    expect(options.saveDc).toBeNull();

    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('logs a spell-named ability_use cast record with level 3, +9, and no Half-damage boilerplate; At Will spends no uses', async () => {
    renderDragon(true);
    await act(async () => { fireEvent.click(linkByText('Melf\'s Acid Arrow')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entry = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.abilityName === 'Melf\'s Acid Arrow');
    expect(entry).toBeTruthy();
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Melf's Acid Arrow via Spellcasting/);
    expect(entry.description).toMatch(/level 3 ranged spell attack \+9 vs DivinationWizard/);
    expect(entry.description).toMatch(/5d4/);
    expect(entry.description).toMatch(/GM-enforced for monsters/);
    expect(entry.description).not.toMatch(/half damage/i);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('does not record concentration when spells.json says concentration: false', async () => {
    renderDragon(true);
    await act(async () => { fireEvent.click(linkByText('Melf\'s Acid Arrow')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entry = addEntry.mock.calls.map(c => c[1]).find(e => e.abilityName === 'Melf\'s Acid Arrow');
    expect(entry.description).not.toMatch(/Concentration/i);
  });

  it('records a concentration note when an attack spell is authored concentration: true', async () => {
    SPELLS_2024[0] = { ...SPELLS_2024[0], concentration: true, duration: 'Concentration, up to 1 minute' };
    try {
      renderDragon(true);
      await act(async () => { fireEvent.click(linkByText('Melf\'s Acid Arrow')); });

      await waitFor(() => expect(addEntry).toHaveBeenCalled());
      const entry = addEntry.mock.calls.map(c => c[1]).find(e => e.abilityName === 'Melf\'s Acid Arrow');
      expect(entry.description).toMatch(/Concentration \(Concentration, up to 1 minute\)/);
    } finally {
      SPELLS_2024[0] = { ...SPELLS_2024[0], concentration: false, duration: 'Instantaneous' };
    }
  });

  it('refuses with no armed target: refusal popup + automation blocked log, zero roll, zero uses spend', async () => {
    renderDragon(false);
    await act(async () => { fireEvent.click(linkByText('Melf\'s Acid Arrow')); });

    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(refusal).toBeTruthy();
    expect(refusal.abilityName).toBe('Melf\'s Acid Arrow');
    expect(refusal.description).toMatch(/no armed target/);
    expect(setPopupHtml).toHaveBeenCalled();
    expect(rollAttack).not.toHaveBeenCalled();
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});
