// @maintained-by-ai
// MA-0348 regression lane — Bandit Deceiver Spellcasting, damageless-save lift.
// Pre-fix Hold Person was damageless, so handleSpellCast routed it advisory:
// use spent, no save prompt, Paralyzed never landed. Fix = DATA save_dc 14 +
// save_type "Intelligence" AND a routing lift (MonsterCardModal.jsx:2565
// spellDamagelessSaveCondition): damageless single-target spells with a
// resolvable dc_type + "must succeed … or be <condition>" text route through
// executeMonsterSaveSpellCast — the condition rides saveConditions to the
// MA-0017 applyFailedSaveConditions leg. Zone saves stay advisory (CLA-325);
// no-dc At Will utility spells stay advisory; unarmed presses refuse with
// zero spend via the MA-0049 guard (refuseUnarmedMonsterSaveCast rides the
// lifted routesToSave, MonsterCardModal.jsx:2578).
// Generic lanes cited, not duplicated: badge shape spellcasting.test.jsx:276,
// exhausted 1/Day spend + spell-named refusal spellcasting.test.jsx:282-303,
// At Will repeat/null store spellcasting.test.jsx:318, zone-save advisory
// (Gust of Wind — NOT on this row, owner lane) spellcasting.test.jsx:196,
// no-target refusal builder bytes MonsterCardHelpers.usage.test.js:41,
// modal unarmed-save press owner ma1150-merfolk-wavebender:197. Fabricated
// Gust-of-Wind row test removed (row bytes invented; lane owned :195).
// DC arithmetic removed — row save_dc bytes pinned once (MA-0318/0328 shape).
import { readFileSync } from 'node:fs';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const spells5e = JSON.parse(readFileSync('public/data/spells.json', 'utf8'));

const bandit = monsters.find(m => m.index === 'bandit-deceiver');
const row = bandit.actions.find(a => a.name === 'Spellcasting');
const MONSTER_NAME = 'Bandit Deceiver 1';

const CHIP_NAMES = ['Disguise Self', 'Mage Hand', 'Minor Illusion', 'Hold Person', 'Mage Armor', 'Major Image'];

// Byte-lock of the row the MA-0348 fix rides on: <br>-separated tier headers,
// em-marked names, "1/Day Each:" gate over Hold Person / Mage Armor / Major
// Image, At Will tier ungated.
const EXACT_DESCRIPTION = 'The bandit casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 14):<br><strong>At Will:</strong> <em>Disguise Self</em>, <em>Mage Hand</em>, <em>Minor Illusion</em><br><strong>1/Day Each:</strong> <em>Hold Person</em> (level 4 version), <em>Mage Armor</em> (included in AC), <em>Major Image</em>';

// ── Mocks (bisected: diceRoller/sanitize/damageUtils/rangeValidation/
// mapsService/abilityLookup purged — save seam rolls only through the fully
// mocked useLoggedDiceRoll hook; inert fetch in setup.js keeps the real
// getCombatContext harmless) ────────────────────────────────────────────────

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// Real 5e spells.json bytes filtered to this row's chips (no fixture
// restatement); bandit is a 5e caster so the 2024 branch stays empty-honest.
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpells: vi.fn((version) => Promise.resolve(version === '2024' ? [] : spells5e.filter(s => CHIP_NAMES.includes(s.name)))),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollSavingThrow = vi.fn();
  return {
    default: vi.fn(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: _rollSavingThrow,
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
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

// ── Re-import mocked modules ────────────────────────────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

function linkByText(text) {
  return Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text)) || null;
}

function entriesOf(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.abilityName === name);
}

function refusals(name) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'automation blocked' && e.abilityName === name);
}

function renderBandit({ armed = true } = {}) {
  const m = makeMonster({ name: bandit.name, index: bandit.index, type: bandit.type, actions: [row] });
  const creatures = [
    { name: MONSTER_NAME, type: 'npc', monsterType: bandit.type, targetName: armed ? 'AberrantSorcerer' : null, currentHp: bandit.hit_points, maxHp: bandit.hit_points, ac: bandit.armor_class, conditions: [] },
    { name: 'AberrantSorcerer', type: 'player', currentHp: 100, maxHp: 100, conditions: [], computedStats: {} },
  ];
  render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures })} />);
}

// ── Data lock ─────────────────────────────────────────────────────────────────

describe('MA-0348 monsters.json data lock: Bandit Deceiver Spellcasting row', () => {
  it('numeric save_dc 14 + save_type "Intelligence" pair present (the MA-0348 data fix) and description byte-locked; extractor exact-map harvests six chips in authored order and gates the 1/Day Each trio only', () => {
    expect(row.save_dc).toBe(14);
    expect(row.save_type).toBe('Intelligence');
    expect(row.description).toBe(EXACT_DESCRIPTION);
    expect(extractSpellNamesFromSpellcasting(row.description)).toEqual(CHIP_NAMES);
    expect(extractSpellcastingSpellUses(row.description)).toEqual({ 'Hold Person': 1, 'Mage Armor': 1, 'Major Image': 1 });
  });

  it('Hold Person DB pin: lv2 Concentration damageless, WIS dc_success none, no AoE, paralyzed clause (the exact bytes the lifted save-leg adjudicates, read from the REAL spells.json the mock serves)', () => {
    const holdPerson = spells5e.find(s => s.index === 'hold-person');
    expect(holdPerson.level).toBe(2);
    expect(holdPerson.concentration).toBe(true);
    expect(holdPerson.duration).toBe('Up to 1 minute');
    expect(holdPerson.damage).toBeFalsy();
    expect(holdPerson.dc).toEqual({ dc_type: 'WIS', dc_success: 'none' });
    expect(holdPerson.area_of_effect).toBeFalsy();
    expect(holdPerson.description.join(' ')).toMatch(/must succeed on a wisdom saving throw or be paralyzed/);
  });
});

// ── Modal: chips + lifted save-leg press ────────────────────────────────────

describe('MA-0348 MonsterCardModal Bandit Deceiver Spellcasting — lifted Hold Person save-leg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('Hold Person chip carries the parsed 1/Day counter, press routes an adjudicated WIS save at DC 14 exactly once (row save_dc, damageless autoDamageFormula null, saveConditions paralyzed + honest concentration note — the MA-0348 fix), spend + store + refusal accumulate, second same-day cast refuses spell-named zero-spend, and no-dc At Will Disguise Self on the same row stays advisory', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderBandit();
    const holdPerson = linkByText('Hold Person');
    expect(holdPerson).toBeTruthy();
    expect(holdPerson.textContent).toMatch(/\(1\/Day · 1 left\)/);
    // At Will cantrips stay bare (badge shape owner spellcasting.test.jsx:276).
    expect(linkByText('Minor Illusion').textContent).not.toMatch(/\/Day/);

    await act(async () => { fireEvent.click(holdPerson); });
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
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

    await waitFor(() => expect(entriesOf('Hold Person').filter(e => e.type === 'ability_use').length).toBe(1));
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 1 });

    // Exhausted-refuse shape owned by spellcasting.test.jsx:282-303 — this
    // pins only that THIS row's parsed "1/Day Each:" header gates live.
    await act(async () => { fireEvent.click(linkByText('Hold Person')); });
    await waitFor(() => expect(refusals('Hold Person').length).toBe(1));
    expect(refusals('Hold Person')[0].description).toMatch(/already cast Hold Person today \(1\/Day\)/);
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 1 });

    // Negative guard for the MA-0348 lift predicate: a no-dc, no-condition
    // At Will spell on THIS row must not ride the save leg (ungated repeat
    // lane owner spellcasting.test.jsx:318).
    await act(async () => { fireEvent.click(linkByText('Disguise Self')); });
    await waitFor(() => expect(entriesOf('Disguise Self').length).toBe(1));
    expect(rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(entriesOf('Disguise Self')[0].description).toMatch(/Spell effect is recorded; GM-enforced for monsters\./);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`]).toEqual({ 'Hold Person': 1 });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('unarmed press of the lifted damageless Hold Person refuses via MA-0049 before any spend — no save prompt, zero ledger burn (guard bytes owner usage.test.js:41, modal lane owner ma1150:197)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderBandit({ armed: false });
    await act(async () => { fireEvent.click(linkByText('Hold Person')); });
    await waitFor(() => expect(entriesOf('Hold Person').some(e => e.type === 'automation' && e.automationType === 'hold_person_refused')).toBe(true));

    const refusal = entriesOf('Hold Person').find(e => e.automationType === 'hold_person_refused');
    expect(refusal.description).toMatch(/refused \(no target\)/);
    expect(refusal.description).toMatch(/Zero spend, no save prompt\./);
    expect(rollSavingThrow).not.toHaveBeenCalled();
    expect(entriesOf('Hold Person').filter(e => e.type === 'ability_use')).toHaveLength(0);
    expect(runtime.store[`${MONSTER_NAME}.monsterSpellUses`] ?? null).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
