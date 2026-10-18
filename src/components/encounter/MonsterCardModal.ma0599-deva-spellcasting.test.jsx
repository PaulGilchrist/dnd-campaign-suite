// @maintained-by-ai — trimmed 2026-10-18 (11→6 tests): kept BY-name extraction
// + exact gate map (not.toContain/toBeUndefined subsumed by full toEqual, #576
// precedent), spell_save_dc/spellcasting_ability data pins (DC arithmetic
// restatement dropped, #652 precedent; no save_dc seam e2e — all four spells are
// DC-less utility, zero save-prompt folded into the advisory e2e; advisory class
// owned by ma0524-couatl:222, spell-shape dc-null class owned by
// ma1959-orcus-wand:243), strip-tags markup-only diff + decoy-strong guard
// merged, cast e2es merged to advisory + gate lanes one-render-multi-spell
// (#576/#652 template; counter-render text folded into the cast e2es, class
// owned by spellcasting.test.jsx :275, 1/Day spend/refuse :281). Shapechange
// second-advisory click dropped — same lane as Detect Evil and Good, its
// parenthetical bytes proven NOT captured by exact-name extraction. No upcast
// pins (#656) — deva carries none. Dead mocks purged by empirical bisect
// (ma0576 #652 twin, same advisory/gate lanes): diceRoller (cast lanes roll
// through mocked useLoggedDiceRoll), damageUtils, rangeValidation, mapsService,
// abilityLookup (stub outputs never reach the asserted lanes). LIVE:
// conditionEffects (MonsterCardBody :36 useMemo), useLoggedDiceRoll, dataLoader
// (render suspends until resolved), sanitize, logService, runtime.
// MA-0599 data lock: Deva Spellcasting rode the MA-0421/MA-0524/MA-0532/
// MA-0576 twin markup-gap template plus the §158 fake-chip variant: pre-fix
// Detect Evil and Good/Shapechange/Commune/Raise Dead were plain text (zero
// chips, 1/Day gating invisible) while mid-prose <strong>Concentration</strong>
// and <strong>Temporary Hit Points</strong> rendered clickable FAKE chips —
// clicks logged junk ability_use "casts Concentration via Spellcasting" +
// console "Spell 'Concentration' not found" with zero adjudication.
// DATA fix = archmage MA-0421 byte-shape: <em> on each spell name (headers
// byte-kept), decoy mid-prose <strong> emphases stripped, strip-tags
// byte-equality proves markup-only diff.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const deva = monsters.find(m => m.index === 'deva');
const devaRow = deva.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Evil and Good', 'Shapechange', 'Commune', 'Raise Dead'];
const ONE_DAY = ['Commune', 'Raise Dead'];
const SPELLS = Object.fromEntries(NAMES.map(n => [n, spells5e.find(s => s.name === n)]));

const PRE_FIX_DESCRIPTION = 'The deva casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17):\n<strong>At Will:</strong> Detect Evil and Good, Shapechange (Beast or Humanoid form only, no Temporary Hit Points gained from the spell, and no <strong>Concentration</strong> or <strong>Temporary Hit Points</strong> required to maintain the spell)\n<strong>1/Day Each:</strong> Commune, Raise Dead';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Deva 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// dataLoader LIVE (#652): render suspends until loadSpells resolves
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve(NAMES.map(n => SPELLS[n]))),
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
    _rollSavingThrow,
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
const rollSavingThrow = (await import('../../hooks/combat/useLoggedDiceRoll.js'))._rollSavingThrow;

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

function renderDeva() {
  const m = makeMonster({ name: 'Deva', actions: [devaRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'celestial', targetName: 'Bandit', ac: 24, currentHp: 229, maxHp: 229, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: deva Spellcasting row ─────────────────────────────────────────

describe('MA-0599 monsters.json data lock: Deva Spellcasting row', () => {
  it('BY-name extraction: four real spell names, zero fakes (headers + decoy words skipped, Shapechange parenthetical NOT captured); 1/Day Each binds exactly Commune + Raise Dead, At Will ungated; all four resolve in spells.json', () => {
    expect(extractSpellNamesFromSpellcasting(devaRow.description)).toEqual(NAMES);
    expect(extractSpellcastingSpellUses(devaRow.description)).toEqual(Object.fromEntries(ONE_DAY.map(n => [n, 1])));
    NAMES.forEach(n => expect(SPELLS[n]).toBeTruthy());
  });

  it('spell_save_dc 17 + spellcasting_ability Charisma authored; DC 17 prose present', () => {
    expect(devaRow.spell_save_dc).toBe(17);
    expect(devaRow.spellcasting_ability).toBe('Charisma');
    expect(devaRow.description).toMatch(/spell save DC 17/);
  });

  it('markup-only diff: decoy mid-prose <strong> emphases GONE, tier headers byte-kept, stripped text equals the pre-fix description byte-for-byte', () => {
    expect(devaRow.description).not.toMatch(/<strong>Concentration<\/strong>/);
    expect(devaRow.description).not.toMatch(/<strong>Temporary Hit Points<\/strong>/);
    expect(devaRow.description).toMatch(/no Concentration or Temporary Hit Points required to maintain the spell/);
    expect(devaRow.description).toMatch(/<strong>At Will:<\/strong>/);
    expect(devaRow.description).toMatch(/<strong>1\/Day Each:<\/strong>/);
    expect(stripTags(devaRow.description)).toBe(stripTags(PRE_FIX_DESCRIPTION));
  });
});

// ── Modal: four chips, counters, gates ───────────────────────────────────────

describe('MA-0599 MonsterCardModal Deva Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders exactly four spell chips — the two fake chips are gone', () => {
    renderDeva();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
  });

  it('At Will advisory lane: Detect Evil and Good shows no counter, casts ungated twice — advisory cast log, zero uses stored, zero save prompts (all four spells DC-less utility)', async () => {
    renderDeva();
    expect(linkByText('Detect Evil and Good').textContent).not.toMatch(/\/Day/);
    await act(async () => { fireEvent.click(linkByText('Detect Evil and Good')); });
    await waitFor(() => expect(abilityUseEntries('Detect Evil and Good').length).toBe(1));
    expect(abilityUseEntries('Detect Evil and Good')[0].description).toMatch(/casts Detect Evil and Good via Spellcasting/);
    expect(abilityUseEntries('Detect Evil and Good')[0].description).toMatch(/Concentration/);
    await act(async () => { fireEvent.click(linkByText('Detect Evil and Good')); });
    await waitFor(() => expect(abilityUseEntries('Detect Evil and Good').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(rollSavingThrow).not.toHaveBeenCalled();
  });

  it('Gate lane: Commune shows (1/Day · 1 left); first cast spends the single use, second refused — zero extra spend', async () => {
    renderDeva();
    expect(linkByText('Commune').textContent).toMatch(/\(1\/Day · 1 left\)/);
    await act(async () => { fireEvent.click(linkByText('Commune')); });
    await waitFor(() => expect(abilityUseEntries('Commune').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Commune': 1 });
    expect(abilityUseEntries('Commune')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Commune')); });
    await waitFor(() => expect(refusals('Commune').length).toBe(1));
    expect(abilityUseEntries('Commune').length).toBe(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Commune': 1 });
  });
});
