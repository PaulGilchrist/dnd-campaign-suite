// @maintained-by-ai
// MA-0532 data lock: Cultist Fanatic Spellcasting rode the MA-0421/MA-0500
// markup-gap template (save fields already authored). Pre-fix ONLY the tier
// headers carried <strong>; Light/Thaumaturgy/Command/Hold Person were plain
// text — extractSpellNamesFromSpellcasting returned [] and
// extractSpellcastingSpellUses returned {} → SpellCastLinks null → zero
// chips, and the row-level numeric save_dc 12 + save_type Wisdom were
// orphaned by the Spellcasting-row fork. DATA fix: <em> on each spell name,
// Couatl MA-0524 byte-shape; headers byte-kept. Cultist fanatic disk spells
// are Light/Thaumaturgy/Command/Hold Person (no Sacred Flame/Guidance).
// Cite-skip owners: chip render + per-day counters spellcasting.test.jsx
// :184/:275 (MA-0003/MA-0012) + ability-save-uses.test.jsx:127 (MA-0020
// pins chip bytes '(2/Day · 2 left)') + ma0543:213 (2/Day Each + 1/Day
// counters, twin of this row's tiers); gated spend/refusal wording
// spellcasting.test.jsx:281/:317/:518 (2/Day spend + 3rd-cast refusal,
// MA-0276) + usage.test.js:16-38 (#571 usage-text owner); advisory cast-log
// with row DC class ma0524:222 (Sleep — damageless gated advisory, no bogus
// save roll); Hold Person spell shape (damageless, dc WIS/none,
// "or be paralyzed") MA-0348 owner damageless-spell-save-leg.test.js (BY
// NAME disk fixture) + bandit-deceiver:167/:182 (DC-14 modal twin). This
// lane keeps the ORIGIN save_dc-seam leg — ma0459-cambion:163 cites
// MA-0532 for the row-level save_dc/save_type pair reaching
// buildAbilitySaveRollContext; the DC-14 pair there is the twin echo.
// Distinct here: Command is damageless with "or follow the command" (no
// "or be X" clause — zero suite-wide pins prior) → CLA-325 advisory, never
// a save leg; Hold Person carries the save leg at row DC 12 WIS.
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const cf = monsters.find(m => m.index === 'cultist-fanatic');
const cfRow = cf.actions.find(a => a.name === 'Spellcasting');
const COMMAND = spells5e.find(s => s.name === 'Command');
const HOLD_PERSON = spells5e.find(s => s.name === 'Hold Person');

const REAL_SPELLS = ['Light', 'Thaumaturgy', 'Command', 'Hold Person'];

const CF_PLAIN_ORIGINAL = 'The cultist casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 12, +4 to hit with spell attacks):\nAt Will: Light, Thaumaturgy\n2/Day: Command\n1/Day: Hold Person';
const stripTags = (d) => d.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

const MONSTER_NAME = 'Cultist Fanatic 1';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : [COMMAND, HOLD_PERSON])),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollSavingThrow = vi.fn();

  const mockHook = vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: vi.fn((val) => { _popupHtml = val; }),
    rollAttack: _rollAttack,
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return { default: mockHook, _rollAttack, _rollSavingThrow };
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

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;
const rollAttack = useLoggedDiceRoll._rollAttack;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function renderCultist() {
  const m = makeMonster({ name: 'Cultist Fanatic', actions: [cfRow] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: 'humanoid', targetName: 'Bandit', ac: 13, currentHp: 44, maxHp: 44, conditions: [] },
    { name: 'Bandit', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock: cultist-fanatic Spellcasting row ─────────────────────────────

describe('MA-0532 monsters.json data lock: Cultist Fanatic Spellcasting row', () => {
  it('extracts the four BY-name em-marked spells as chips and binds gates to marked names only — tier headers skipped', () => {
    const names = extractSpellNamesFromSpellcasting(cfRow.description);
    expect(names).toEqual(REAL_SPELLS);
    expect(names).not.toContain('At Will');
    expect(names).not.toContain('2/Day');
    expect(names).not.toContain('1/Day');
    expect(extractSpellcastingSpellUses(cfRow.description)).toEqual({ Command: 2, 'Hold Person': 1 });
  });

  it('ORIGIN save_dc seam: numeric save_dc 12 + save_type Wisdom (8 + WIS +2 + PB +2) — the pair buildAbilitySaveRollContext reads (twin cited at ma0459:163)', () => {
    expect(cfRow.save_dc).toBe(12);
    expect(cfRow.save_type).toBe('Wisdom');
    expect(cfRow.spell_save_dc).toBe(12);
    expect(cfRow.spellcasting_ability).toBe('Wisdom');
    expect(cfRow.description).toMatch(/spell save DC 12/);
    expect(8 + cf.ability_score_modifiers.wis + cf.proficiency_bonus).toBe(12);
  });

  it('markup-only diff proof: stripped text equals the pre-fix description byte-for-byte', () => {
    expect(stripTags(cfRow.description)).toBe(CF_PLAIN_ORIGINAL);
  });

  it('Command justification: damageless, no area, dc WIS/none with the "or follow the command" tail → CLA-325 advisory, never a save leg (Hold Person twin BY-name owned by MA-0348 owner)', () => {
    expect(COMMAND.damage ?? null).toBeNull();
    expect(COMMAND.area_of_effect ?? null).toBeNull();
    expect(COMMAND.dc).toEqual(expect.objectContaining({ dc_type: 'WIS', dc_success: 'none' }));
    expect(COMMAND.description.join(' ')).toMatch(/or follow the command/);
  });
});

// ── Modal: save_dc seam e2e (the MA-0532 fork fix) ─────────────────────────

describe('MA-0532 MonsterCardModal Cultist Fanatic Spellcasting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('Hold Person click routes the DC-12 WIS save seam (chips live, save_dc 12 no longer orphaned by the Spellcasting-row fork) and spends its 1/Day', async () => {
    renderCultist();
    await act(async () => { fireEvent.click(linkByText('Hold Person')); });

    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalled());
    const context = rollSavingThrow.mock.calls[0][2];
    expect(context.spellName).toBe('Hold Person');
    expect(context.saveDc).toBe(12);
    expect(context.saveType).toBe('WIS');
    expect(context.targetName).toBe('Bandit');
    expect(context.autoDamageFormula ?? null).toBeNull();
    expect(rollAttack).not.toHaveBeenCalled();
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 1 });
  });
});
