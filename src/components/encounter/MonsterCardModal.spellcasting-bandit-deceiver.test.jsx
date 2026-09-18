// MA-0348 regression: Bandit Deceiver Spellcasting save-leg — Hold Person was
// damageless, so handleSpellCast routed it advisory: use spent, no save prompt,
// Paralyzed never landed. Fix = DATA save_dc 14 + save_type "Intelligence"
// (8 + INT +3 + PB +3 = 14, MA-0318/0328 shape) AND a routing lift:
// damageless spells with a resolvable dc_type + "must succeed … or be
// <condition>" text route through executeMonsterSaveSpellCast — the condition
// rides saveConditions to the MA-0017 applyFailedSaveConditions leg.
// Damage spells byte-unchanged; no-dc At-Will utility spells stay advisory;
// zone saves (Gust of Wind, MA-0003/CLA-325) stay advisory.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

const SPELLS_5E = [
  { name: 'Hold Person', level: 2, concentration: true, duration: 'Up to 1 minute', range: '60 feet', damage: null, dc: { dc_type: 'WIS', dc_success: 'none' }, description: ['Choose a humanoid that you can see within range. The target must succeed on a wisdom saving throw or be paralyzed for the duration. At the end of each of its turns, the target can make another wisdom saving throw. On a success, the spell ends on the target.'] },
  { name: 'Disguise Self', level: 1, concentration: false, duration: '1 hour', range: 'Self', damage: null, dc: null, description: ['You make yourself, including your equipment, look different.'] },
  { name: 'Mage Hand', level: 0, concentration: false, duration: '1 minute', range: '30 feet', damage: null, dc: null, description: ['A spectral floating hand appears.'] },
  { name: 'Minor Illusion', level: 0, concentration: false, duration: '1 minute', range: '30 feet', damage: null, dc: null, description: ['You create a sound or an image of an object.'] },
  { name: 'Mage Armor', level: 1, concentration: false, duration: '8 hours', range: 'Touch', damage: null, dc: null, description: ['A visible force of force surrounds the creature.'] },
  { name: 'Major Image', level: 3, concentration: true, duration: 'Up to 1 minute', range: '60 feet', damage: null, dc: null, description: ['You create the image of a creature or object.'] },
  { name: 'Gust of Wind', level: 2, concentration: true, duration: 'Up to 1 minute', range: 'Self', damage: null, dc: { dc_type: 'STR', dc_success: 'none' }, area_of_effect: { type: 'line', size: 60 }, description: ['A line of strong wind 60 feet long and 10 feet wide blasts from you. Each creature that starts its turn in the line must succeed on a strength saving throw or be pushed 15 feet away from you in a direction following the line.'] },
];

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 8, rolls: [3, 5], modifier: 2 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 16, rolls: [3, 5], modifier: 2 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve(SPELLS_5E)),
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
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 30)),
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

// ── Re-import mocked modules ────────────────────────────────────────────────

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function monsters() {
  return JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
}

function banditRow() {
  return monsters().find(m => m.index === 'bandit-deceiver').actions.find(a => a.name === 'Spellcasting');
}

function renderBandit(row) {
  const m = makeMonster({ name: 'Bandit Deceiver', actions: [row] });
  const creatures = [
    { name: 'Bandit Deceiver 1', type: 'npc', monsterType: 'humanoid', targetName: 'AberrantSorcerer', currentHp: 130, maxHp: 130, conditions: [] },
    { name: 'AberrantSorcerer', type: 'player', currentHp: 100, maxHp: 100, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Bandit Deceiver 1', creatures })} />);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MA-0348 Bandit Deceiver Spellcasting row — authored DC 14 data lock', () => {
  it('row authors numeric save_dc 14 + save_type Intelligence (8 + INT +3 + PB +3)', () => {
    const bandit = monsters().find(m => m.index === 'bandit-deceiver');
    const row = bandit.actions.find(a => a.name === 'Spellcasting');
    expect(row.save_dc).toBe(14);
    expect(row.save_type).toBe('Intelligence');
    expect(8 + bandit.ability_score_modifiers.int + bandit.proficiency_bonus).toBe(14);
    expect(row.description).toMatch(/spell save DC 14/);
  });

  it('description byte-unchanged and matches the authored ground-truth prose', () => {
    expect(banditRow().description).toBe('The bandit casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 14):<br><strong>At Will:</strong> <em>Disguise Self</em>, <em>Mage Hand</em>, <em>Minor Illusion</em><br><strong>1/Day Each:</strong> <em>Hold Person</em> (level 4 version), <em>Mage Armor</em> (included in AC), <em>Major Image</em>');
  });

  it('spells.json Hold Person is damageless with dc WIS / dc_success none (no half-damage leak)', () => {
    const spells = JSON.parse(readFileSync('public/data/spells.json', 'utf8')).find(s => s.index === 'hold-person');
    expect(spells.damage).toBeFalsy();
    expect(spells.dc).toEqual({ dc_type: 'WIS', dc_success: 'none' });
    expect(spells.area_of_effect).toBeFalsy();
    expect(spells.description.join(' ')).toMatch(/must succeed on a wisdom saving throw or be paralyzed/);
  });
});

describe('MA-0348 Hold Person save-leg routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('damageless Hold Person routes an adjudicated WIS save at DC 14 with paralyzed + honest concentration note', async () => {
    renderBandit(banditRow());
    const holdPerson = linkByText('Hold Person');
    expect(holdPerson).toBeTruthy();
    await act(async () => { fireEvent.click(holdPerson); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const [abbr, , context] = rollSavingThrow.mock.calls[0];
    expect(abbr).toBe('WIS');
    expect(context.spellName).toBe('Hold Person');
    expect(context.saveDc).toBe(14);
    expect(context.saveType).toBe('WIS');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBeNull();
    expect(context.saveConditions).toEqual(['paralyzed']);
    expect(context.conditionDurationNote).toBe("for the spell's duration — Concentration, Up to 1 minute (GM-enforced)");
    expect(context.isSpellDamage).toBe(true);
    expect(context.targetName).toBe('AberrantSorcerer');
  });

  it('spends the Hold Person 1/Day use with an ability_use log and refuses a second same-day cast', async () => {
    renderBandit(banditRow());
    const holdPerson = linkByText('Hold Person');

    await act(async () => { fireEvent.click(holdPerson); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    expect(runtime.store['Bandit Deceiver 1.monsterSpellUses']).toEqual({ 'Hold Person': 1 });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend).toBeTruthy();
    expect(spend.description).toMatch(/casts Hold Person via Spellcasting/);
    expect(spend.description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(holdPerson); });
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'automation blocked');
    expect(refusal).toBeTruthy();
    expect(refusal.description).toMatch(/already cast Hold Person today \(1\/Day\)/);
  });

  it('no-dc At-Will utility spells stay advisory — no save prompt, cast log only', async () => {
    renderBandit(banditRow());
    await act(async () => { fireEvent.click(linkByText('Disguise Self')); });
    await act(async () => { fireEvent.click(linkByText('Mage Hand')); });

    expect(rollSavingThrow).not.toHaveBeenCalled();
    const casts = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use');
    expect(casts).toHaveLength(2);
    expect(casts[0].description).toMatch(/Spell effect is recorded; GM-enforced for monsters\./);
  });

  it('zone save spells (Gust of Wind line, MA-0003/CLA-325) stay advisory — no save prompt', async () => {
    const row = {
      ...banditRow(),
      description: 'The bandit casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 14):<br><strong>At Will:</strong> <em>Gust of Wind</em>',
    };
    renderBandit(row);
    await act(async () => { fireEvent.click(linkByText('Gust of Wind')); });

    expect(rollSavingThrow).not.toHaveBeenCalled();
    const cast = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(cast).toBeTruthy();
    expect(cast.description).toMatch(/Spell effect is recorded/);
  });

  it('single-target save with no armed target refuses via the MA-0049 seam — no save prompt', async () => {
    const m = makeMonster({ name: 'Bandit Deceiver', actions: [banditRow()] });
    const creatures = [
      { name: 'Bandit Deceiver 1', type: 'npc', monsterType: 'humanoid', targetName: null, currentHp: 130, maxHp: 130, conditions: [] },
    ];
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Bandit Deceiver 1', creatures })} />);
    await act(async () => { fireEvent.click(linkByText('Hold Person')); });
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'hold_person_refused')).toBe(true));

    expect(rollSavingThrow).not.toHaveBeenCalled();
  });
});
