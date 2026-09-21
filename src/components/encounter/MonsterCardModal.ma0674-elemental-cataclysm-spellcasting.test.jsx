// MA-0674 data lock: Elemental Cataclysm "Control Weather" was an inert
// other-type row — the SpellCastLinks branch is row-NAME gated
// (MonsterAction.jsx /^spellcasting$/i), so the <strong> spell name rendered
// plain bold with zero affordance and spellcasting_ability had no consumer.
// DATA fix (Option A): restructure actions[3] to the canonical Spellcasting
// byte-shape (MA-0611/MA-0619 twins, no-DC Ghast Gravecaller/Giant Owl
// shape): name "Spellcasting" + canonical prefix sentence +
// <strong>At Will:</strong> <em>Control Weather</em> tier markup,
// spellcasting_ability "Constitution" kept (twin convention). NO row
// save_dc/save_type — Control Weather is a save-less zero-target spell; the
// chip rides the advisory utility route (§70 weather stays GM-enforced).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));
const spells2024 = JSON.parse(readFileSync('public/data/2024/spells.json', 'utf8'));

const cataclysm = monsters.find(m => m.index === 'elemental-cataclysm');
const row = cataclysm.actions.find(a => a.name === 'Spellcasting');
const CONTROL_WEATHER = 'Control Weather';
const cw5e = spells5e.find(s => s.name === CONTROL_WEATHER);

const MONSTER_NAME = 'Elemental Cataclysm 1';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 9, rolls: [2, 4, 3], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 18, rolls: [2, 4, 3, 2, 4, 3], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn(() => Promise.resolve([cw5e])),
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
import { _rollSavingThrow, _rollAttack } from '../../hooks/combat/useLoggedDiceRoll.js';

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

function renderCataclysm() {
  const m = makeMonster({ name: 'Elemental Cataclysm', index: 'elemental-cataclysm', actions: [row] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'elemental', targetName: 'Bandit', ac: 24, currentHp: 800, maxHp: 800, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: Elemental Cataclysm Spellcasting row ─────────────────────────

describe('MA-0674 monsters.json data lock: Elemental Cataclysm Spellcasting row', () => {
  it('row restructured to canonical Spellcasting name — the inert other-type row is gone', () => {
    expect(cataclysm.actions[3].name).toBe('Spellcasting');
    expect(cataclysm.actions.some(a => a.name === 'Control Weather')).toBe(false);
  });

  it('extracts "Control Weather" as the single spell name — tier header skipped', () => {
    const names = extractSpellNamesFromSpellcasting(row.description);
    expect(names).toEqual([CONTROL_WEATHER]);
    expect(names).not.toContain('At Will');
  });

  it('At Will tier: zero uses bound — cast ungated', () => {
    expect(extractSpellcastingSpellUses(row.description)).toEqual({});
  });

  it('canonical twin prefix sentence authored; no invented DC fields (save-less spell)', () => {
    expect(row.description).toMatch(/^The cataclysm casts one of the following spells, requiring no spell components and using Constitution as the spellcasting ability:\n<strong>At Will:<\/strong> <em>Control Weather<\/em>$/);
    expect(row.spellcasting_ability).toBe('Constitution');
    expect(row.save_dc).toBeUndefined();
    expect(row.save_type).toBeUndefined();
    expect(row.spell_save_dc).toBeUndefined();
  });

  it('no fake chips: the only emphases are the tier header and the spell name', () => {
    const emphases = [...row.description.matchAll(/<(?:strong|em)>([^<]+)<\/(?:strong|em)>/g)].map(m => m[1]);
    expect(emphases).toEqual(['At Will:', CONTROL_WEATHER]);
  });

  it('Control Weather exists in BOTH spells.json files, save-less and damage-less', () => {
    expect(cw5e).toBeTruthy();
    expect(spells2024.some(s => s.name === CONTROL_WEATHER)).toBe(true);
    expect(cw5e.level).toBe(8);
    expect(cw5e.school).toBe('Transmutation');
    expect(cw5e.concentration).toBe(true);
    expect(cw5e.duration).toBe('Up to 8 hours');
    expect(cw5e.damage).toBeUndefined();
    expect(cw5e.dc).toBeUndefined();
    expect(cw5e.attack_type).toBeUndefined();
  });
});

// ── Modal: chip renders and casts via the advisory utility route ──────────

describe('MA-0674 MonsterCardModal Elemental Cataclysm Spellcasting chip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('renders exactly one spell chip "Control Weather" — no counter, no spent class', () => {
    renderCataclysm();
    const chips = spellLinks();
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent.trim()).toBe(CONTROL_WEATHER);
    expect(chips[0].textContent).not.toMatch(/\/Day/);
    expect(chips[0].className).not.toMatch(/spent/);
  });

  it('cast logs ability_use with concentration + GM-enforced weather advisory', async () => {
    renderCataclysm();
    await act(async () => { fireEvent.click(linkByText(CONTROL_WEATHER)); });
    await waitFor(() => expect(abilityUseEntries(CONTROL_WEATHER).length).toBe(1));
    const entry = abilityUseEntries(CONTROL_WEATHER)[0];
    expect(entry.type).toBe('ability_use');
    expect(entry.characterName).toBe(MONSTER_NAME);
    expect(entry.description).toMatch(/casts Control Weather via Spellcasting/);
    expect(entry.description).toMatch(/Concentration \(Up to 8 hours\)/);
    expect(entry.description).toMatch(/Spell effect is recorded; GM-enforced/);
  });

  it('At Will casts ungated twice — zero uses spent, zero refusals, zero save/attack rolls', async () => {
    renderCataclysm();
    await act(async () => { fireEvent.click(linkByText(CONTROL_WEATHER)); });
    await waitFor(() => expect(abilityUseEntries(CONTROL_WEATHER).length).toBe(1));
    await act(async () => { fireEvent.click(linkByText(CONTROL_WEATHER)); });
    await waitFor(() => expect(abilityUseEntries(CONTROL_WEATHER).length).toBe(2));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(refusals(CONTROL_WEATHER)).toHaveLength(0);
    expect(_rollSavingThrow).not.toHaveBeenCalled();
    expect(_rollAttack).not.toHaveBeenCalled();
  });
});
