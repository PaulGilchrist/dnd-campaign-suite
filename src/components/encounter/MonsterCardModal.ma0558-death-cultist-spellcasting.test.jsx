// @maintained-by-ai
// MA-0558 data lock: Death Cultist Spellcasting rode the MA-0524/0532
// markup-gap twin template. Pre-fix ONLY the tier header carried <strong>;
// Speak with Dead/Thaumaturgy were plain text — extractSpellNamesFromSpellcasting
// returned [] → SpellCastLinks null → zero chips, and the orphaned
// spell_save_dc 14 never reached the advisory cast log (row-level save_dc
// absent; MA-0532 Spellcasting-row fork). DATA fix: <em> on each spell name
// + trailing numeric save_dc 14 + save_type Wisdom; headers byte-kept,
// strip-tags byte-equality proves markup-only diff.
// Cite-skip owners: chip render + per-day counters spellcasting.test.jsx
// :184/:275 (MA-0003/MA-0012); gated spend/refusal wording :281/:317/:518
// (MA-0276) + usage.test.js:16-38 (#571); advisory no-save-roll class
// ma0524:222 (Sleep); Speak with Dead damageless advisory + row-DC log
// ma1959-orcus:37/:329; at-Will Thaumaturgy ungated-twice row-DC log
// ma0611-djinni:2353. Distinct here: the full At Will two-spell row —
// exact toEqual gate map {} subsumes the ungated/At Will negatives (#653),
// the DC 14 + Wisdom save_dc pair is this row's orphaned fork fix (seam
// e2e only, per ticket claim), and zero save rolls across BOTH damageless
// spells in one cast lane is row-specific (asserted inline in the cast e2e).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const dc = monsters.find(m => m.index === 'death-cultist');
const dcRow = dc.actions.find(a => a.name === 'Spellcasting');
const SPEAK_WITH_DEAD = spells5e.find(s => s.name === 'Speak with Dead');
const THAUMATURGY = spells5e.find(s => s.name === 'Thaumaturgy');

const REAL_SPELLS = ['Speak with Dead', 'Thaumaturgy'];

const DC_PLAIN_ORIGINAL = 'The cultist casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 14):\nAt Will: Speak with Dead, Thaumaturgy';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Death Cultist 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : [SPEAK_WITH_DEAD, THAUMATURGY])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollSavingThrow = vi.fn();

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return { default: mockHook, _rollSavingThrow };
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

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';

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

function renderCultist() {
  const m = makeMonster({ name: 'Death Cultist', actions: [dcRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 17, currentHp: 127, maxHp: 127, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: death-cultist Spellcasting row ────────────────────────────────

describe('MA-0558 monsters.json data lock: Death Cultist Spellcasting row', () => {
  it('extracts both BY-name em-marked spells with an exact {} gate map — tier header skipped, At Will ungated (exact map subsumes the negatives, #653)', () => {
    expect(extractSpellNamesFromSpellcasting(dcRow.description)).toEqual(REAL_SPELLS);
    expect(extractSpellcastingSpellUses(dcRow.description)).toEqual({});
  });

  it('ORIGIN save_dc seam: numeric save_dc 14 + save_type Wisdom (8 + WIS +3 + PB +3) — the pair the advisory cast log reads, no longer orphaned by the Spellcasting-row fork', () => {
    expect(dcRow.save_dc).toBe(14);
    expect(dcRow.save_type).toBe('Wisdom');
    expect(dcRow.spell_save_dc).toBe(14);
    expect(dcRow.spellcasting_ability).toBe('Wisdom');
    expect(dcRow.description).toMatch(/spell save DC 14/);
    expect(8 + dc.ability_score_modifiers.wis + dc.proficiency_bonus).toBe(14);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(dcRow.description)).toBe(DC_PLAIN_ORIGINAL);
  });
});

// ── Modal: two chips, ungated advisory casts print row DC 14 ─────────────────

describe('MA-0558 MonsterCardModal Death Cultist Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders exactly two spell chips — the zero-chip inert row is gone, neither At Will name carries a /Day counter', () => {
    renderCultist();
    const links = spellLinks();
    expect(links.map(el => el.textContent.split('(')[0].trim())).toEqual(REAL_SPELLS);
    expect(links.every(el => !/\/Day/.test(el.textContent))).toBe(true);
  });

  it('ungated advisory casts — Thaumaturgy once + Speak with Dead twice log row DC 14 Wisdom, zero save rolls on both damageless spells, zero uses spent', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Thaumaturgy')); });
    await waitFor(() => expect(abilityUseEntries('Thaumaturgy').length).toBe(1));
    await act(async () => { fireEvent.click(linkByText('Speak with Dead')); });
    await waitFor(() => expect(abilityUseEntries('Speak with Dead').length).toBe(1));
    await act(async () => { fireEvent.click(linkByText('Speak with Dead')); });
    await waitFor(() => expect(abilityUseEntries('Speak with Dead').length).toBe(2));

    expect(abilityUseEntries('Thaumaturgy')[0].description).toMatch(/casts Thaumaturgy via Spellcasting \(spell save DC 14, Wisdom\)/);
    expect(abilityUseEntries('Thaumaturgy')[0].characterName).toBe(MONSTER_NAME);
    expect(abilityUseEntries('Speak with Dead')[1].description).toMatch(/\(spell save DC 14, Wisdom\)/);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });
});
