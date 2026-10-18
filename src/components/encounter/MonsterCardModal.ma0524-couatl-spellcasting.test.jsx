// @maintained-by-ai
// MA-0524 data lock: Couatl Spellcasting rode the MA-0454 double-defect
// template (markup + row save fields). Pre-fix the row marked ONLY the tier
// headers plus prose emphasis "**Concentration**" / "**Temporary Hit
// Points**" — all nine REAL spell names plain text — so
// extractSpellNamesFromSpellcasting yielded TWO false-positive chips
// (extractor keeps every <strong>/<em> token not ending ':') and clicking
// "Concentration" logged a bogus ability_use for a NON-spell. No row-level
// save_dc/save_type either (spell_save_dc never reaches
// buildAbilitySaveRollContext, MA-0237). DATA fix: <em> on each spell name,
// <strong> removed from the prose emphasis, MA-0237 numeric save_dc 15 +
// save_type "Wisdom" trailing pair (bogus chip gone).
// GENERIC legs cite-skipped (behavioral coverage lives in the spellcasting
// family): cast-click advisory record → MonsterCardModal.spellcasting.test.jsx
// :195/:419; save routing with dc_success :226; 1/Day spend + second-cast
// refusal :281/:306 (+ usage.test.js:17-38 #571 spend-log owner); At Will
// ungated repeat casts :317/:432/:552/:639; per-day counter on limited only
// :275/:628; extractSpellcastingSpellUses parsing :332/:340 + tier split
// :604; save-pair byte-shape precedent → ma0421-bone-naga:161 /
// ma0452-bog-sage. Couatl poison-bite hit_conditions + constrict save row →
// owned by MonsterAction.ma1153/ma0795-bite-hit-conditions (couatl cited).
// Kept here: couatl's nine-name BY-name extraction fingerprint (zero fake
// chips), the markup-strip-diff proof, the save_dc byte-shape + DC math,
// gated-counters render split (5 gated / 4 At Will), Sleep advisory-vs-Dream
// save-seam adjudication pair at row DC 15.
// Dead mocks purged by empirical bisect (throwing-probe green): diceRoller
// rollExpression/rollExpressionDoubled (spell chips never enter the damage-
// roll lane, MonsterCardModal.jsx:1484/:2431). dataLoader kept LIVE (#632).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const couRow = monsters.find(m => m.index === 'couatl').actions.find(a => a.name === 'Spellcasting');
const SLEEP = spells5e.find(s => s.name === 'Sleep');
const DREAM = spells5e.find(s => s.name === 'Dream');

const REAL_SPELLS = ['Detect Evil and Good', 'Detect Magic', 'Detect Thoughts', 'Shapechange', 'Create Food and Water', 'Dream', 'Greater Restoration', 'Scrying', 'Sleep'];
const ONCE_PER_DAY = ['Create Food and Water', 'Dream', 'Greater Restoration', 'Scrying', 'Sleep'];

// Pre-fix description fingerprint (git HEAD, monsters.json) — markup-only diff
// proof: strip every tag from the FIXED row and it equals this byte-for-byte.
const COU_PLAIN_ORIGINAL = 'The couatl casts one of the following spells, requiring no spell components and using Wisdom as the spellcasting ability (spell save DC 15):\nAt Will: Detect Evil and Good, Detect Magic, Detect Thoughts, Shapechange (Beast or Humanoid form only, no Temporary Hit Points gained from the spell, and no Concentration or Temporary Hit Points required to maintain the spell)\n1/Day Each: Create Food and Water, Dream, Greater Restoration, Scrying, Sleep';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Couatl 1';

// ── Mocks (mirror MonsterCardModal.ma0452-bullywug-bog-sage-spellcasting.test.jsx) ─

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : [SLEEP, DREAM])),
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

function renderCouatl(armed = true) {
  const m = makeMonster({ name: 'Couatl', actions: [couRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'celestial', targetName: armed ? 'Bandit' : null, ac: 19, currentHp: 60, maxHp: 60, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: couatl Spellcasting row ──────────────────────────────────────

describe('MA-0524 monsters.json data lock: Couatl Spellcasting row', () => {
  it('extracts all nine REAL spell names as chips — zero false positives (no Concentration/THP/tier headers)', () => {
    expect(extractSpellNamesFromSpellcasting(couRow.description)).toEqual(REAL_SPELLS);
  });

  it('authors the MA-0454 save seam: numeric save_dc 15 + save_type Wisdom pair, DC 15 = 8 + WIS 5 + PB 2 (CR4)', () => {
    const cou = monsters.find(m => m.index === 'couatl');
    expect(couRow.save_dc).toBe(15);
    expect(couRow.save_type).toBe('Wisdom');
    expect(couRow.spell_save_dc).toBe(15);
    expect(couRow.spellcasting_ability).toBe('Wisdom');
    expect(cou.ability_score_modifiers.wis).toBe(5);
    expect(cou.proficiency_bonus).toBe(2);
    expect(couRow.description).toMatch(/spell save DC 15/);
    expect(couRow.description).not.toMatch(/<strong>Concentration<\/strong>|<strong>Temporary Hit Points<\/strong>/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(couRow.description)).toBe(COU_PLAIN_ORIGINAL);
  });

  it('5e Sleep is damageless + sphere → advisory by MA-0348 design; Dream carries the row\'s DC-15 WIS save leg (3d6 Psychic, dc_success none)', () => {
    expect(SLEEP.damage).toBeNull();
    expect(SLEEP.area_of_effect).toBeTruthy();
    expect(DREAM.level).toBe(5);
    expect(DREAM.damage.damage_at_slot_level['5']).toBe('3d6');
    expect(DREAM.damage.damage_type).toBe('Psychic');
    expect(DREAM.dc).toEqual(expect.objectContaining({ dc_type: 'WIS', dc_success: 'none' }));
    expect(DREAM.area_of_effect ?? null).toBeNull();
  });
});

// ── Modal: nine real chips, fake chips gone, gates enforced, adjudication ───

describe('MA-0524 MonsterCardModal Couatl Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders nine real-spell chips, ZERO fake chips; the five 1/Day names carry counters, the four At Will names do not', () => {
    renderCouatl();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(REAL_SPELLS);
    expect(linkByText('Concentration')).toBeNull();
    expect(linkByText('Temporary Hit Points')).toBeNull();
    for (const n of ONCE_PER_DAY) expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/);
    for (const n of REAL_SPELLS.filter(x => !ONCE_PER_DAY.includes(x))) expect(linkByText(n).textContent).not.toMatch(/\/Day/);
  });

  it('casts gated Sleep as an adjudicated advisory record — row DC 15 + WIS in the log, 1/Day spent, no bogus save roll', async () => {
    renderCouatl();
    await act(async () => { fireEvent.click(linkByText('Sleep')); });

    await waitFor(() => expect(abilityUseEntries('Sleep').length).toBe(1));
    const entry = abilityUseEntries('Sleep')[0];
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Sleep via Spellcasting \(spell save DC 15, WIS\)/);
    expect(entry.description).toMatch(/1\/Day use spent — 0 remaining today/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Sleep: 1 });
    // damageless + area_of_effect spell stays advisory (MA-0348/CLA-325)
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(rollAttack).not.toHaveBeenCalled();
  });

  it('Dream routes the DC-15 Wisdom save seam (3d6 Psychic, dc_success none) and spends its 1/Day', async () => {
    renderCouatl();
    await act(async () => { fireEvent.click(linkByText('Dream')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Dream');
    expect(context.saveDc).toBe(15);
    expect(context.saveType).toBe('WIS');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe('3d6');
    expect(context.autoDamageDamageType).toBe('Psychic');
    expect(context.isSpellDamage).toBe(true);
    expect(context.targetName).toBe('Bandit');
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ Dream: 1 });
    expect(rollAttack).not.toHaveBeenCalled();
  });
});
