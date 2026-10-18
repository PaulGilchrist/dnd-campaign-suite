// @maintained-by-ai — trimmed 2026-10-18 (11→7 tests): kept BY-name extraction
// + exact gate map, save_dc seam pins, strip-tags markup diff, upcast pins,
// save_dc seam e2e via Blight save leg, per spellcasting template (#645-#655).
// Vacuous drops: not.toContain/toBeUndefined subsumed by full toEqual; em-tag
// parenthetical regexes subsumed by exact-name extraction (helper reads
// [^<]+ INSIDE the tag — a parenthetical inside <em> would corrupt the name —
// MonsterCardHelpers.js:401); DC arithmetic restatement (#652 precedent);
// counter-render text folded into the two cast e2es (class owned by
// spellcasting.test.jsx :275); Fly e2e dropped — 1/Day spend/refuse class owned
// by spellcasting.test.jsx :281 + proven here on Blight, advisory lane proven on
// Detect Magic; Fly carries no distinct bytes. Dead mocks purged by empirical
// bisect (dao #652 twin, same lanes): diceRoller (cast lanes roll through mocked
// useLoggedDiceRoll), damageUtils, rangeValidation, mapsService, abilityLookup
// (stub outputs never reach the asserted advisory/gate/save-opts lanes).
// LIVE: conditionEffects (MonsterCardBody :36 useMemo), useLoggedDiceRoll,
// dataLoader (render suspends until resolved), sanitize, logService, runtime.
// MA-0576 data lock: Death Slaad Spellcasting rode the MA-0421/MA-0524/
// MA-0532/MA-0552/MA-0564 twin markup-gap template. Pre-fix ONLY the tier
// headers carried <strong>; Detect Magic/Detect Thoughts/Invisibility/Mage
// Hand/Major Image/Blight/Cloudkill/Fly/Plane Shift/Tongues were plain text —
// extractSpellNamesFromSpellcasting returned [] and extractSpellcastingSpellUses
// returned {} → SpellCastLinks null → zero chips, and the orphaned spell_save_dc
// 16 never reached buildAbilitySaveRollContext (MA-0532 fork). DATA fix: <em>
// on each spell name (headers byte-kept, "(self only)"/"(level N version)"
// parentheticals OUTSIDE the tag, strip-tags byte-equality) + trailing row-level
// numeric save_dc 16 + save_type "Charisma" pair (MA-0454/MA-0421). Distinct
// bytes: the ONLY twin row with TWO (level N version) upcast pins — Blight lv8
// 12d8, Cloudkill lv6 6d8 — plus "no Material components" prose, CHA DC 16.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, spellCastLevelFromSpellcasting, spellDamageFormulaAtLevel } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const slaad = monsters.find(m => m.index === 'death-slaad');
const slaadRow = slaad.actions.find(a => a.name === 'Spellcasting');
const NAMES = ['Detect Magic', 'Detect Thoughts', 'Invisibility', 'Mage Hand', 'Major Image', 'Blight', 'Cloudkill', 'Fly', 'Plane Shift', 'Tongues'];
const ONE_DAY = ['Blight', 'Cloudkill', 'Fly', 'Plane Shift', 'Tongues'];
const SPELLS = Object.fromEntries(NAMES.map(n => [n, spells5e.find(s => s.name === n)]));

const SLAAD_PLAIN_ORIGINAL = 'The slaad casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16):\nAt Will: Detect Magic, Detect Thoughts, Invisibility (self only), Mage Hand, Major Image\n1/Day Each: Blight (level 8 version), Cloudkill (level 6 version), Fly, Plane Shift, Tongues';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Death Slaad 1';

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

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderDeathSlaad() {
  const m = makeMonster({ name: 'Death Slaad', actions: [slaadRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'aberration', targetName: 'Bandit', ac: 18, currentHp: 178, maxHp: 178, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: death-slaad Spellcasting row ──────────────────────────────────

describe('MA-0576 monsters.json data lock: Death Slaad Spellcasting row', () => {
  it('BY-name extraction: ten chips (tier headers skipped, parentheticals sit OUTSIDE the em tags); 1/Day Each binds exactly the five marked names, At Will ungated', () => {
    expect(extractSpellNamesFromSpellcasting(slaadRow.description)).toEqual(NAMES);
    expect(extractSpellcastingSpellUses(slaadRow.description)).toEqual(Object.fromEntries(ONE_DAY.map(n => [n, 1])));
  });

  it('row-level numeric save_dc 16 + save_type Charisma pair authored (trailing)', () => {
    expect(slaadRow.save_dc).toBe(16);
    expect(slaadRow.save_type).toBe('Charisma');
    expect(slaadRow.spell_save_dc).toBe(16);
    expect(slaadRow.spellcasting_ability).toBe('Charisma');
    expect(slaadRow.description).toMatch(/spell save DC 16/);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(slaadRow.description)).toBe(SLAAD_PLAIN_ORIGINAL);
  });

  it('the two (level N version) upcast pins resolve — Blight lv8 12d8 CON half, Cloudkill lv6 6d8 CON half (distinct twin bytes)', () => {
    const blight = SPELLS.Blight;
    const cloudkill = SPELLS.Cloudkill;
    expect(blight.level).toBe(4);
    expect(cloudkill.level).toBe(5);
    expect(blight.dc).toEqual(expect.objectContaining({ dc_type: 'CON', dc_success: 'half' }));
    expect(cloudkill.dc).toEqual(expect.objectContaining({ dc_type: 'CON', dc_success: 'half' }));
    expect(spellCastLevelFromSpellcasting(slaadRow.description, 'Blight', blight)).toBe(8);
    expect(spellDamageFormulaAtLevel(blight, 8)).toBe('12d8');
    expect(spellCastLevelFromSpellcasting(slaadRow.description, 'Cloudkill', cloudkill)).toBe(6);
    expect(spellDamageFormulaAtLevel(cloudkill, 6)).toBe('6d8');
  });
});

// ── Modal: ten chips, counters, gates ────────────────────────────────────────

describe('MA-0576 MonsterCardModal Death Slaad Spellcasting chips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders ten spell chips — the zero-chip inert row is gone', () => {
    renderDeathSlaad();
    expect(spellLinks().map(el => el.textContent.split('(')[0].trim())).toEqual(NAMES);
  });

  it('At Will Detect Magic casts ungated twice — no counter, zero uses, advisory log prints row DC 16', async () => {
    renderDeathSlaad();
    expect(linkByText('Detect Magic').textContent).not.toMatch(/\/Day/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(1));
    expect(abilityUseEntries('Detect Magic')[0].description).toMatch(/\(spell save DC 16/);
    await act(async () => { fireEvent.click(linkByText('Detect Magic')); });
    await waitFor(() => expect(abilityUseEntries('Detect Magic').length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
  });

  it('Blight 1/Day save leg: counter shown; first cast adjudicates CON half at row DC 16 upcast 12d8 and spends the use; second refused — zero extra spend, zero extra save roll', async () => {
    renderDeathSlaad();
    expect(linkByText('Blight').textContent).toMatch(/\(1\/Day · 1 left\)/);
    await act(async () => { fireEvent.click(linkByText('Blight')); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const opts = rollSavingThrow.mock.calls[0][2];
    expect(opts.spellName).toBe('Blight');
    expect(opts.saveType).toBe('CON');
    expect(opts.dcSuccess).toBe('half');
    expect(opts.saveDc).toBe(16);
    expect(opts.autoDamageFormula).toBe('12d8');
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Blight': 1 });
    expect(abilityUseEntries('Blight')[0].description).toMatch(/1\/Day use spent/);

    await act(async () => { fireEvent.click(linkByText('Blight')); });
    await waitFor(() => expect(refusals('Blight').length).toBe(1));
    expect(abilityUseEntries('Blight').length).toBe(1);
    expect(rollSavingThrow.mock.calls.length).toBe(1);
  });
});
