// @maintained-by-ai — trimmed 2026-10-18 (13→6): kept BY-name extraction + exact
// gate map, row-level save_dc 19/Charisma pair pin, strip-tags markup diff, At Will
// advisory cast ×2 at row DC 19 (zero-chip inert-row render folded in; counter-render
// class owned by spellcasting.test.jsx :275, counters asserted inline on the gated
// leg), Ray of Sickness 2024-fallback lv2/+11/3d8 leg, merged 1/Day Each gated leg
// (Create Undead + Finger of Death spend, Finger of Death refuse; refusal shape owned
// by spellcasting.test.jsx :281). Create Undead lv8 upcast pin sits at data level
// (spellCastLevelFromSpellcasting — the advisory log does not echo the parenthetical,
// verified live 2026-10-18). Vacuous drops: not.toContain/toBeUndefined subsumed
// by full toEqual; <strong> placement regexes subsumed by exact-name extraction
// (MonsterCardHelpers.js:401 reads [^<]+ INSIDE the tag); DC arithmetic restatement
// (#652/ma0576 precedent); Ray 5e-absent pin folded into the gate-map test. Dead
// mocks purged by empirical bisect (ma0576 twin, same lanes): diceRoller (cast lanes
// roll through mocked useLoggedDiceRoll), damageUtils, rangeValidation, mapsService,
// abilityLookup (stub outputs never reach the asserted advisory/gate lanes).
// LIVE: conditionEffects (MonsterCardBody :36 useMemo), useLoggedDiceRoll, dataLoader
// (render suspends until resolved, §177 ruleset branch), sanitize, logService, runtime.
// MA-0619 data lock: Dracolich Spellcasting rode the MA-0421/MA-0524/MA-0532/
// MA-0576/MA-0611 twin markup-gap template. Pre-fix ONLY the two tier headers
// carried <strong>; Detect Magic/Ray of Sickness/Create Undead/Finger of Death
// were plain text — extractSpellNamesFromSpellcasting returned [] and
// extractSpellcastingSpellUses returned {} → SpellCastLinks null → zero chips,
// 1/Day uses invisible AND ungated, and the orphaned spell_save_dc 19 never
// reached buildAbilitySaveRollContext (MA-0532 fork / MA-0614 spell_save_dc-only
// fingerprint). DATA fix: <strong> on each spell name (headers byte-kept,
// level parentheticals OUTSIDE the tag, strip-tags byte-equality) + trailing
// row-level numeric save_dc 19 + save_type "Charisma" pair (MA-0454/§164).
// Distinct bytes: the twin row whose only attack spell (Ray of Sickness) is
// 2024-only — findMonsterSpell 2024 fallback is the sole resolution lane here.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, spellCastLevelFromSpellcasting } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const dracolich = monsters.find(m => m.index === 'dracolich');
const dracolichRow = dracolich.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Magic', 'Ray of Sickness', 'Create Undead', 'Finger of Death'];
const ONE_DAY = ['Create Undead', 'Finger of Death'];
const SPELLS_5E = NAMES.map(n => spells5e.find(s => s.name === n)).filter(Boolean);
const SPELLS_2024 = NAMES.map(n => spells2024.find(s => s.name === n)).filter(Boolean);

const DRACOLICH_PLAIN_ORIGINAL = 'The dracolich casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 19, +11 to hit with spell attacks):\nAt Will: Detect Magic, Ray of Sickness (level 2 version)\n1/Day Each: Create Undead (level 8 version), Finger of Death';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Dracolich 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// dataLoader LIVE: render suspends until loadSpells resolves; §177 — the mock
// MUST branch on the ruleset arg so Ray of Sickness resolves ONLY on 2024.
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((ruleset) => Promise.resolve(ruleset === '2024' ? SPELLS_2024 : SPELLS_5E)),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  return {
    default: vi.fn(() => ({
      get popupHtml() { return _popupHtml; },
      setPopupHtml: _setPopupHtml,
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
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

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderDracolich() {
  const m = makeMonster({ name: 'Dracolich', actions: [dracolichRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'undead', targetName: 'Bandit', ac: 19, currentHp: 228, maxHp: 228, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: dracolich Spellcasting row ────────────────────────────────────

describe('MA-0619 monsters.json data lock: Dracolich Spellcasting row', () => {
  it('BY-name extraction + exact gate map: four chips (tier headers skipped); 1/Day Each binds exactly {Create Undead:1, Finger of Death:1}, At Will ungated; Ray of Sickness resolves on the 2024 spell list only', () => {
    expect(extractSpellNamesFromSpellcasting(dracolichRow.description)).toEqual(NAMES);
    expect(extractSpellcastingSpellUses(dracolichRow.description)).toEqual({ 'Create Undead': 1, 'Finger of Death': 1 });
    expect(spells5e.some(s => s.name === 'Ray of Sickness')).toBe(false);
    expect(spells2024.some(s => s.name === 'Ray of Sickness')).toBe(true);
  });

  it('row-level numeric save_dc 19 + save_type Charisma pair authored (trailing); Create Undead lv8 upcast pin resolves', () => {
    expect(dracolichRow.save_dc).toBe(19);
    expect(dracolichRow.save_type).toBe('Charisma');
    expect(dracolichRow.spell_save_dc).toBe(19);
    expect(dracolichRow.spell_attack_bonus).toBe(11);
    expect(dracolichRow.spellcasting_ability).toBe('Charisma');
    expect(dracolichRow.description).toMatch(/spell save DC 19/);
    const createUndead = spells5e.find(s => s.name === 'Create Undead');
    expect(spellCastLevelFromSpellcasting(dracolichRow.description, 'Create Undead', createUndead)).toBe(8);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(dracolichRow.description)).toBe(DRACOLICH_PLAIN_ORIGINAL);
  });
});

// ── Modal: four chips, cast lanes, gates ─────────────────────────────────────

describe('MA-0619 MonsterCardModal Dracolich Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('At Will Detect Magic casts ungated twice — four chips rendered (zero-chip inert row gone), no counter, advisory log prints row DC 19, uses store stays empty', async () => {
    renderDracolich();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
    expect(linkByText('Detect Magic').textContent).not.toMatch(/\/Day/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 19/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Ray of Sickness resolves via 2024 fallback — At Will attack cast at level 2, +11, zero uses', async () => {
    renderDracolich();
    await act(async () => { fireEvent.click(linkByText('Ray of Sickness')); });
    await waitFor(() => expect(abilityUseEntries('Ray of Sickness').length).toBe(1));
    expect(abilityUseEntries('Ray of Sickness')[0].description).toMatch(/level 2 ranged spell attack \+11/);
    expect(abilityUseEntries('Ray of Sickness')[0].description).toMatch(/formula 3d8/);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('1/Day Each gated leg: both names carry counters; Create Undead lv8 spends its single use; Finger of Death spends then refuses — zero extra spend', async () => {
    renderDracolich();
    ONE_DAY.forEach(n => expect(linkByText(n).textContent).toMatch(/\(1\/Day · 1 left\)/));

    await act(async () => { fireEvent.click(linkByText('Create Undead')); });
    await waitFor(() => expect(abilityUseEntries('Create Undead').length).toBe(1));
    expect(abilityUseEntries('Create Undead')[0].description).toMatch(/\(spell save DC 19/);
    expect(abilityUseEntries('Create Undead')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Finger of Death')); });
    await waitFor(() => expect(abilityUseEntries('Finger of Death').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Create Undead': 1, 'Finger of Death': 1 });
    expect(abilityUseEntries('Finger of Death')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Finger of Death')); });
    await waitFor(() => expect(refusals('Finger of Death').length).toBe(1));
    expect(abilityUseEntries('Finger of Death').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Create Undead': 1, 'Finger of Death': 1 });
  });
});
