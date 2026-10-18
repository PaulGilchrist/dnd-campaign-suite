// @maintained-by-ai — MA-0421 lane (bone-naga spellcasting bytes + save_dc seam).
// Trimmed 12→6 tests: generic chip/spend/refuse/advisory/At-Will/formula lanes
// cited-skipped to owners (MonsterCardModal.spellcasting.test.jsx #588, usage #571,
// spell-save lane). Kept by-name: bone-naga markup-only diff proof, 1/Day gate
// extraction (At Will ungated), save_dc/save_type seam end-to-end, spirit-naga
// sibling fingerprint, 5-chip render with counters. Dead diceRoller mock purged
// (empirical bisect: never reached in this lane).
// MA-0421 data lock (commit b16c018b0 — monsters.json only): Bone Naga
// Spellcasting row had plain-text spell names (zero affordances) and only
// spell_save_dc, which never reaches the save prompt — buildAbilitySaveRollContext
// (MonsterCardModal.jsx) reads action.save_dc. The fix wraps the five spell
// names in <strong> on the archmage/lich byte-shape (<br> delimiters,
// "1/Day Each:" header) and authors save_dc/save_type. Sibling hygiene:
// spirit-naga carried the identical unmarked fingerprint and got the same
// markup in-pass. Generic lanes (chip render, spend/refuse, advisory casts,
// At Will repeat, dc_success/formula routing) are owned by
// MonsterCardModal.spellcasting.test.jsx (#588) — this file locks only the
// MA-0421-bytes and the save_dc seam.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const allSpells = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const realSpells = (names) => allSpells.filter(s => names.includes(s.name));

const BONE_SPELLS = ['Mage Hand', 'Thaumaturgy', 'Command', 'Detect Thoughts', 'Lightning Bolt'];
const SPIRIT_SPELLS = ['Detect Magic', 'Mage Hand', 'Minor Illusion', 'Water Breathing', 'Detect Thoughts', 'Dimension Door', 'Hold Person', 'Lightning Bolt'];

// Pre-fix description fingerprints (git HEAD, monsters.json) — the markup-only
// diff proof: strip every tag from the FIXED row and it must equal these
// originals byte-for-byte (<br> normalized back to the original \n form).
const BONE_PLAIN_ORIGINAL = 'The naga casts one of the following spells, requiring no Material components and using Intelligence as the spellcasting ability (spell save DC 13):\nAt Will: Mage Hand, Thaumaturgy\n1/Day Each: Command, Detect Thoughts, Lightning Bolt';
const SPIRIT_PLAIN_ORIGINAL = 'The naga casts one of the following spells, requiring no Somatic or Material components and using Intelligence as the spellcasting ability (spell save DC 14): At Will: Detect Magic, Mage Hand, Minor Illusion, Water Breathing; 2/Day Each: Detect Thoughts, Dimension Door, Hold Person (level 3 version), Lightning Bolt (level 4 version)';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const boneRow = monsters.find(m => m.index === 'bone-naga').actions.find(a => a.name === 'Spellcasting');
const spiritRow = monsters.find(m => m.index === 'spirit-naga').actions.find(a => a.name === 'Spellcasting');

// ── Mocks (mirror MonsterCardModal.spellcasting.test.jsx) ─────────────────

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : realSpells([...BONE_SPELLS, ...SPIRIT_SPELLS]))),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollSavingThrow = vi.fn();
  const noop = () => vi.fn();
  const mockHook = vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: noop(),
    rollAttack: noop(),
    rollDamage: noop(),
    rollAbilityCheck: noop(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: noop(),
    rollInitiative: noop(),
    quickRollPlayerSave: noop(),
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

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';

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

function renderBoneNaga() {
  const monster = monsters.find(m => m.index === 'bone-naga');
  const m = makeMonster({ name: monster.name, actions: [boneRow] });
  const creatures = [
    { name: `${monster.name} 1`, type: 'npc', monsterType: 'monstrosity', targetName: 'TestPC', currentHp: monster.hit_points, maxHp: monster.hit_points, conditions: [] },
    { name: 'TestPC', type: 'player', currentHp: 60, maxHp: 60, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: `${monster.name} 1`, creatures })} />);
}

// ── Data lock: row bytes + save_dc seam ───────────────────────────────────

describe('MA-0421 monsters.json data lock: Bone Naga Spellcasting row', () => {
  it('archmage/lich byte-shape markup: five spell names extract as chips, and stripped text equals the pre-fix description byte-for-byte (markup-only diff)', () => {
    expect(extractSpellNamesFromSpellcasting(boneRow.description)).toEqual(BONE_SPELLS);
    expect(stripTags(boneRow.description)).toBe(BONE_PLAIN_ORIGINAL);
  });

  it('1/Day Each gate binds Command/Detect Thoughts/Lightning Bolt only — At Will cantrips stay ungated', () => {
    expect(extractSpellcastingSpellUses(boneRow.description)).toEqual({
      'Command': 1, 'Detect Thoughts': 1, 'Lightning Bolt': 1,
    });
  });

  it('carries save_dc 13 + save_type Intelligence (8 + INT + PB) — the seam buildAbilitySaveRollContext reads; spell_save_dc alone never reached the prompt', () => {
    expect(boneRow.save_dc).toBe(13);
    expect(boneRow.save_type).toBe('Intelligence');
    expect(8 + monsters.find(m => m.index === 'bone-naga').ability_score_modifiers.int + monsters.find(m => m.index === 'bone-naga').proficiency_bonus).toBe(13);
  });

  it('sibling hygiene: spirit-naga identical fingerprint cured — eight chips, 2/Day gate, markup-only diff', () => {
    expect(extractSpellNamesFromSpellcasting(spiritRow.description)).toEqual(SPIRIT_SPELLS);
    expect(extractSpellcastingSpellUses(spiritRow.description)).toEqual({
      'Detect Thoughts': 2, 'Dimension Door': 2, 'Hold Person': 2, 'Lightning Bolt': 2,
    });
    expect(stripTags(spiritRow.description)).toBe(SPIRIT_PLAIN_ORIGINAL);
  });
});

// ── Modal: bone-naga chips + save_dc seam, by name ─────────────────────────

describe('MA-0421 MonsterCardModal Bone Naga Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders five clickable spell chips (was zero affordances) with the 1/Day counter on the limited trio only', () => {
    renderBoneNaga();
    const names = spellLinks().map(el => el.textContent.split('(')[0].trim());
    expect(names.sort()).toEqual([...BONE_SPELLS].sort());
    expect(document.querySelector('.mc-dice-link-save-clickable')).toBeNull();
    expect(linkByText('Lightning Bolt').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Command').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Detect Thoughts').textContent).toMatch(/\(1\/Day · 1 left\)/);
    expect(linkByText('Mage Hand').textContent).not.toMatch(/\/Day/);
    expect(linkByText('Thaumaturgy').textContent).not.toMatch(/\/Day/);
  });

  it('Lightning Bolt save prompt resolves DC 13 DEX from the newly-authored save_dc seam and logs the cast', async () => {
    renderBoneNaga();
    await act(async () => { fireEvent.click(linkByText('Lightning Bolt')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Lightning Bolt');
    expect(context.saveDc).toBe(13);
    expect(context.saveType).toBe('DEX');
    await waitFor(() => expect(abilityUseEntries('Lightning Bolt').length).toBe(1));
  });
});
