// @maintained-by-ai 2026-11-28 — trimmed 2026-11-28: 104 tests -> 17. The per-monster clone
// army (brass/bronze/copper/gold/green/red/silver/white/ancient-black/ancient-blue each
// re-asserting the same monster-agnostic gate) collapsed to: parameterized disk-data sweeps
// (headers uses:3 + lair advisory; Pounce/Tail Swipe delegates_to Rend + Rend bonus;
// spell-attack seams; save-row numeric shapes; 2024 spell cross-checks) plus one canonical
// modal leg per distinct behavior: delegated-fixture press (MA-0021/0022 aboleth Lash),
// dangling-delegate refusal, turn latch (+usedRound stamp), disk-row delegate press with both
// damage legs and no console dead-end (red Pounce, MA-0127), exhausted refusal (brass
// Scorching Sands save chip), per-action cooldown (copper Giggling Magic, MA-0092 canonical,
// incl. popup wording), numeric save chip + gated save roll (green Mind Invasion, MA-0114
// cited owner), damageless charmed save + same-boundary latch (red Commanding Presence, MA-0125
// "DC 20 Wisdom save chip" cited owner), spell-attack press + regain re-arm (red Fiery Rays,
// MA-0126), advisory row press + refusal ladder (ancient-blue Cloaked Flight, MA-0173), and AoE
// picker press (ancient-blue Sonic Boom, MA-0174). Shed as duplicates: 8 exhausted clones, 9
// turn-latch clones, 2 regain clones, 6 Pounce-click clones (delegation seam owned here +
// pounce-ancient-gold/pounce-dracolich siblings), 4 spell-attack-click clones (Fiery Rays
// canonical; spell-attack seam also MonsterCardModal.scorching-ray.test.jsx), save-chip click
// clones (Chill/Cold Gale/Cold-free clones: Commanding Presence + Mind Invasion canonical; AoE
// picker canonical = Sonic Boom; white FP/ancient-black FP rows + clicks owned by
// MonsterCardModal.adult-white-fp/ancient-black-fp.test.jsx; bronze Thunderclap full-row lock
// owned by MonsterCardModal.thunderclap-sphere.test.jsx), and the generic gate truth-table /
// regain / advisory vocabulary owned service-side by
// src/services/encounters/monsterLegendaryUses.test.js.
// MA-0021 regression: legendary-uses economy on the monster card. The header row shows a
// "(N left)" counter via the monsterLegendaryUses runtime map; the verbatim action rows
// beneath become gated clickable rows — click expends a use (+ spend log) / refuses when
// exhausted (popup + legendary_use_refused, zero spend). MA-0022: a delegates_to row spends
// 1 use and rolls the delegated attack via the same attack seam, named "<row> (<delegate> attack)".
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spells2024 from '../../../public/data/2024/spells.json';

const TENTACLE = { name: 'Tentacle', attack_bonus: 9, damage_dice_primary: '2d6 + 5', damage_type_primary: 'Bludgeoning', reach: '15 ft.' };

const LEGENDARY = [
  { name: 'Legendary Action Uses: 3 (4 in Lair)', uses: 3, description: 'Immediately after another creature\'s turn, expend a use.' },
  { name: 'Lash', delegates_to: 'Tentacle', description: 'The aboleth makes one Tentacle attack.' },
  { name: 'Psychic Drain', description: 'It uses Consume Memories and regains 5 (1d10) Hit Points.' },
];

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({
  rollAttack: null, rollDamage: null, rollSavingThrow: null,
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Thug 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve(ctx.value)),
}));
vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => 30),
}));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn().mockResolvedValue(null) }));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Aboleth 1', type: 'npc', targetName: 'TestPC', currentHp: 185, maxHp: 185, ac: 17, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

// ---- disk helpers shared by the data sweeps and the modal legs --------------------------

const disk = (key) => monstersData.find(m => m.name === key || m.index === key);
const legendaryRow = (key, rowName) => disk(key).legendary_actions.find(a => a.name === rowName);
const spellcastingRow = (key) => disk(key).actions.find(a => a.name === 'Spellcasting');

const POUNCE_MOVEMENT_BYTES = 'The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.';
const ONCE_PER_TURN_CLAUSE = /can'?t take this action again until the start of its next turn/i;

// ---- MA-0021/0022 fixture aboleth (synthetic rows for the pure seams) -------------------

function renderAboleth(uses) {
  if (uses !== undefined) runtime.store['Aboleth 1.monsterLegendaryUses'] = uses;
  const m = makeMonster({ name: 'Aboleth', actions: [TENTACLE], legendary_actions: LEGENDARY });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
}

function lashLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link-legendary')).find(el => el.closest('div')?.textContent.includes('Lash')) || null;
}

describe('MA-0021/0022 legendary-uses disk data: aboleth header authors uses:3', () => {
  it('legendary_actions[0] carries numeric uses 3 (no longer name-text only)', () => {
    const aboleth = monstersData.find(m => m.name === 'Aboleth');
    expect(aboleth.legendary_actions[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(aboleth.legendary_actions[0].uses).toBe(3);
  });
});

// ---- parameterized monsters.json data locks (this lane owns the adult/ancient disk rows) --

describe('monsters.json legendary data locks', () => {
  it('every legendary header authors numeric uses 3 + the advisory 4-in-lair note', () => {
    const keys = ['Aboleth', 'Adult Brass Dragon', 'Adult Bronze Dragon', 'Adult Copper Dragon',
      'Adult Gold Dragon', 'Adult Green Dragon', 'Adult Red Dragon', 'Adult Silver Dragon',
      'Adult White Dragon', 'Ancient Black Dragon', 'ancient-blue-dragon'];
    expect(keys.length).toBe(11);
    for (const key of keys) {
      const header = disk(key).legendary_actions[0];
      expect(header.name, key).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
      expect(header.uses, key).toBe(3);
      expect(header.description, key).toMatch(/4 uses \(advisory — no lair flag consumer; GM-enforced\)/);
    }
  });

  it('every Pounce/Tail Swipe delegates_to the Rend row, owns no numbers, and the Rend carries the bonus', () => {
    const delegates = [
      ['Adult Brass Dragon', 'Pounce', 11],
      ['Adult Bronze Dragon', 'Pounce', 12],
      ['Adult Copper Dragon', 'Pounce', 11],
      ['Adult Gold Dragon', 'Pounce', 14],
      ['Adult Green Dragon', 'Pounce', 11],
      ['Adult Red Dragon', 'Pounce', 14],
      ['Adult Silver Dragon', 'Pounce', 13],
      ['Adult White Dragon', 'Pounce', 11],
      ['Ancient Black Dragon', 'Pounce', 15],
      ['ancient-blue-dragon', 'Tail Swipe', 16],
    ];
    for (const [key, rowName, rendBonus] of delegates) {
      const label = `${key} ${rowName}`;
      const row = legendaryRow(key, rowName);
      expect(row, label).toBeTruthy();
      expect(row.delegates_to, label).toBe('Rend');
      expect(row.attack_bonus ?? null, label).toBe(null);
      expect(row.save_dc ?? null, label).toBe(null);
      expect(row.damage_dice_primary ?? null, label).toBe(null);
      expect(row.uses ?? null, label).toBe(null);
      expect(row.description, label).toBe(rowName === 'Pounce' ? POUNCE_MOVEMENT_BYTES : 'The dragon makes one Rend attack.');
      expect(disk(key).actions.find(a => a.name === 'Rend')?.attack_bonus, label).toBe(rendBonus);
    }
  });

  it('spell-attack legendary rows author the MA-0033 seam (attack_bonus + spell_attack_bonus + dice/type + prose)', () => {
    const rows = [
      { key: 'Adult Brass Dragon', row: 'Blazing Light', bonus: 8, dice: '2d6', type: 'Fire', range: '120 ft.' },
      { key: 'Adult Bronze Dragon', row: 'Guiding Light', bonus: 10, dice: '5d6', type: 'Radiant', range: '120 ft.' },
      { key: 'Adult Gold Dragon', row: 'Guiding Light', bonus: 13, dice: '5d6', type: 'Radiant', range: '120 ft.', spellcasting: true },
      { key: 'Adult Red Dragon', row: 'Fiery Rays', bonus: 12, dice: '2d6', type: 'Fire', range: '120 ft.', spellcasting: true,
        description: [/uses Spellcasting to cast <em>Scorching Ray<\/em>/, /2d6 Fire damage per ray/, /multi-ray.*advisory/i, ONCE_PER_TURN_CLAUSE] },
    ];
    for (const e of rows) {
      const label = `${e.key} ${e.row}`;
      const row = legendaryRow(e.key, e.row);
      expect(row.attack_bonus, label).toBe(e.bonus);
      expect(row.spell_attack_bonus, label).toBe(e.bonus);
      expect(row.damage_dice_primary, label).toBe(e.dice);
      expect(row.damage_type_primary, label).toBe(e.type);
      expect(row.description, label).toMatch(new RegExp(`Ranged Spell Attack: \\+${e.bonus}`));
      expect(row.range ?? null, label).toBe(e.range ?? null);
      if (e.spellcasting) {
        expect(spellcastingRow(e.key)?.description, label).toMatch(new RegExp(`\\+${e.bonus} to hit with spell attacks`));
      }
      for (const re of e.description ?? []) expect(row.description, label).toMatch(re);
    }
    // MA-0126: Fiery Rays mirrors the 2024 Scorching Ray source.
    const ray = spells2024.find(s => s.index === 'scorching-ray');
    expect(ray.damage.damage_type).toBe('Fire');
    expect(ray.damage.damage_at_slot_level['2']).toBe('2d6');
    expect(ray.attack_type).toBe('ranged');
  });

  it('save legendary rows author their numeric shape (save_dc/save_type/dc_success/dice/type + prose riders)', () => {
    const rows = [
      { key: 'Adult Brass Dragon', row: 'Scorching Sands', dc: 16, type: 'Dexterity', dcSuccess: 'none', dice: '6d8', damageType: 'Fire' },
      { key: 'Adult Copper Dragon', row: 'Giggling Magic', dc: 17, type: 'Charisma', dcSuccess: 'none', dice: '7d6', damageType: 'Psychic' },
      { key: 'Adult Copper Dragon', row: 'Mind Jolt', dc: 17, type: 'Wisdom', dcSuccess: 'half', dice: '5d8', damageType: 'Psychic' },
      { key: 'Adult Gold Dragon', row: 'Banish', dc: 21, type: 'Charisma', dcSuccess: 'none', dice: '3d6', damageType: 'Force',
        description: [/No damage or effect on a successful save/i, ONCE_PER_TURN_CLAUSE] },
      { key: 'Adult Green Dragon', row: 'Noxious Miasma', dc: 17, type: 'Constitution', dcSuccess: 'none', dice: '2d6', damageType: 'Poison',
        description: [/No effect on a successful save/i, ONCE_PER_TURN_CLAUSE] },
      { key: 'Adult Green Dragon', row: 'Mind Invasion', dc: 17, type: 'Wisdom', dcSuccess: 'half', dice: '4d8', damageType: 'Psychic',
        noAdvisory: true, spellcastingSaveDc: 17, description: [/level 3 version/, /DC 17 Wisdom saving throw/] },
      { key: 'Adult Red Dragon', row: 'Commanding Presence', dc: 20, type: 'Wisdom', dcSuccess: 'none', dice: null, damageType: null,
        noAdvisory: true, saveEffect: /charmed/i, spellcastingSaveDc: 20,
        description: [/Command.*level 2 version/i, /DC 20 Wisdom saving throw/i, /second creature.*advisory/i, ONCE_PER_TURN_CLAUSE] },
      { key: 'Adult Silver Dragon', row: 'Chill', dc: 19, type: 'Wisdom', dcSuccess: 'none', dice: null, damageType: null,
        saveEffect: /paralyzed/i, spellcastingSaveDc: 19, description: [/Hold Monster/, /DC 19 Wisdom saving throw/i, /advisory/i, ONCE_PER_TURN_CLAUSE] },
      { key: 'Adult Silver Dragon', row: 'Cold Gale', dc: 19, type: 'Dexterity', dcSuccess: null, dice: '4d6', damageType: 'Cold',
        saveEffect: /Half damage only/ },
      { key: 'Adult White Dragon', row: 'Freezing Burst', dc: 14, type: 'Constitution', dcSuccess: null, dice: '2d6', damageType: 'Cold',
        saveEffect: /Speed is 0/ },
      { key: 'Ancient Black Dragon', row: 'Cloud of Insects', dc: 21, type: 'Dexterity', dcSuccess: null, dice: '6d10', damageType: 'Poison' },
      { key: 'ancient-blue-dragon', row: 'Sonic Boom', dc: 22, type: 'Constitution', dcSuccess: 'half', dice: '4d8', damageType: 'Thunder',
        description: [/level 3 version/, ONCE_PER_TURN_CLAUSE] },
    ];
    // Adult White + Ancient Black Frightful Presence rows are NOT swept here: they are
    // byte-locked (with their gated presses) by MonsterCardModal.adult-white-fp.test.jsx
    // and MonsterCardModal.ancient-black-fp.test.jsx. The bronze Thunderclap row is
    // full-row toEqual-locked by MonsterCardModal.thunderclap-sphere.test.jsx.
    for (const e of rows) {
      const label = `${e.key} ${e.row}`;
      const row = legendaryRow(e.key, e.row);
      expect(row, label).toBeTruthy();
      expect(row.save_dc, label).toBe(e.dc);
      expect(row.save_type, label).toBe(e.type);
      expect(row.dc_success ?? null, label).toBe(e.dcSuccess ?? null);
      expect(row.damage_dice_primary ?? null, label).toBe(e.dice ?? null);
      expect(row.damage_type_primary ?? null, label).toBe(e.damageType ?? null);
      if (e.noAdvisory) expect(row.advisory == null, label).toBe(true);
      if (e.saveEffect) expect(String(row.save_effect), label).toMatch(e.saveEffect);
      for (const re of e.description ?? []) expect(row.description, label).toMatch(re);
      if (e.spellcastingSaveDc) expect(spellcastingRow(e.key)?.save_dc, label).toBe(e.spellcastingSaveDc);
    }
  });

  it('save-row legendary mirrors agree with their 2024 spell sources (Mind Spike / Command / Hold Monster)', () => {
    const spike = spells2024.find(s => s.index === 'mind-spike');
    expect(spike.dc.dc_type).toBe('WIS');
    expect(spike.dc.dc_success).toBe('half');
    expect(spike.damage.damage_at_slot_level['2']).toBe('3d8');
    expect(spike.damage.damage_at_slot_level['3']).toBe('4d8');
    for (const index of ['command', 'hold-monster']) {
      const spell = spells2024.find(s => s.index === index);
      expect(spell.dc.dc_type, index).toBe('WIS');
      expect(spell.dc.dc_success, index).toBe('none');
    }
  });
});

// ---- modal-level gated seams (one canonical leg per distinct behavior) -------------------

const brassActions = () => [{ name: 'Rend', attack_bonus: 11, damage_dice_primary: '2d10 + 6', damage_type_primary: 'Slashing', reach: '10 ft.' }];
const copperActions = () => [{ name: 'Rend', attack_bonus: 11, damage_dice_primary: '2d10 + 6', damage_type_primary: 'Slashing', damage_dice_secondary: '1d8', damage_type_secondary: 'Acid', reach: '10 ft.' }];
const greenActions = () => [{ name: 'Rend', attack_bonus: 11, damage_dice_primary: '2d8 + 6', damage_type_primary: 'Slashing', damage_dice_secondary: '2d6', damage_type_secondary: 'Poison', reach: '10 ft.' }];
const redActions = () => [{ name: 'Rend', attack_bonus: 14, damage_dice_primary: '1d10 + 8', damage_type_primary: 'Slashing', damage_dice_secondary: '2d4', damage_type_secondary: 'Fire', reach: '10 ft.' }];
const ANCIENT_BLUE_REND = { name: 'Rend', attack_bonus: 16, damage_dice_primary: '2d8 + 9', damage_type_primary: 'Slashing', damage_dice_secondary: '2d10', damage_type_secondary: 'Lightning', reach: '15 ft.' };

function armedRoster(creatureName, ac = 19) {
  return [
    { name: creatureName, type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 256, maxHp: 256, ac, conditions: [] },
    { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
    { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
  ];
}

function renderDiskLegendary(key, uses, actions, ac = 19) {
  const monster = disk(key);
  const creatureName = `${monster.name} 1`;
  if (uses !== undefined) runtime.store[`${creatureName}.monsterLegendaryUses`] = uses;
  const m = makeMonster({ name: monster.name, actions, legendary_actions: monster.legendary_actions });
  render(<MonsterCardModal {...makeProps(m, { creatureName, creatures: armedRoster(creatureName, ac) })} />);
  return creatureName;
}

function actionRow(name) {
  return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
}
function legendaryChip(name) {
  return actionRow(name).querySelector('.mc-dice-link-legendary');
}
function saveChip(name) {
  return actionRow(name).querySelector('.mc-dice-link-save-clickable');
}
function spendLog(name) {
  return addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && new RegExp(name).test(e.description));
}
const logged = (predicate) => addEntry.mock.calls.map(c => c[1]).some(predicate);

describe('MonsterCardModal legendary gated seams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  // MA-0021 + MA-0022 in one fixture leg: counter renders, gated delegated click spends,
  // decrements, logs, and rolls the DELEGATE's numbers under the "<row> (<delegate> attack)" name.
  it('MA-0021/0022 aboleth Lash: header shows (3 left); delegated click spends 1, logs the exact spend, rolls +9 "Lash (Tentacle attack)" 2d6+5', async () => {
    renderAboleth({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const link = lashLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    await waitFor(() => expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    const call = ROLLERS.rollAttack.mock.calls[0];
    expect(call[0]).toBe('Lash (Tentacle attack)');
    expect(call[1]).toBe(9);
    expect(call[2]).toMatchObject({ autoDamageFormula: '2d6 + 5', autoDamageName: 'Lash (Tentacle attack)', damageType: 'Bludgeoning' });
    const spend = spendLog('Lash');
    expect(spend.characterName).toBe('Aboleth 1');
    expect(spend.description).toMatch(/expends a legendary use for Lash \(Tentacle attack\)/);
  });

  it('MA-0022 dangling delegates_to: refusal popup + legendary_use_refused (no-delegate), zero spend, zero roll', async () => {
    runtime.store['Aboleth 1.monsterLegendaryUses'] = { max: 3, used: 0 };
    const m = makeMonster({
      name: 'Aboleth',
      actions: [TENTACLE],
      legendary_actions: [
        LEGENDARY[0],
        { name: 'Lash', delegates_to: 'Bite', description: 'The aboleth makes one Bite attack.' },
      ],
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
    fireEvent.click(lashLink());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(logged(e => e.automationType === 'legendary_use_refused' && /no-delegate/.test(e.description))).toBe(true));
    expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('MA-0021 turn latch: same-boundary second click refuses (popup + usedRound stamp), zero extra spend', async () => {
    renderAboleth({ max: 3, used: 0 });
    fireEvent.click(lashLink());
    await waitFor(() => expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Aboleth 1._legendaryUses_usedRound']).toEqual({ round: 1, activeCreature: 'Thug 1' });
    fireEvent.click(lashLink());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });

  it('MA-0127 disk red Pounce: expend chip owns the row (no own numeric chip); gated click spends 1 and rolls delegated Rend +14 with both damage legs, logs spend, no console dead-end', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const creatureName = renderDiskLegendary('Adult Red Dragon', { max: 3, used: 0 }, redActions());
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(legendaryChip('Pounce')).toBeTruthy();
    expect(actionRow('Pounce').querySelector('.mc-dice-link:not(.mc-dice-link-legendary)')).toBe(null);
    fireEvent.click(legendaryChip('Pounce'));
    await waitFor(() => expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(14);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('1d10 + 8');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('2d4');
    expect(options.autoDamageSecondaryDamageType).toBe('Fire');
    expect(options.targetName).toBe('TestPC');
    expect(options.isSpellDamage).toBe(false);
    expect(spendLog('Pounce').description).toMatch(/expends a legendary use for Pounce/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  // Canonical exhausted leg: single shared gate (monsterLegendaryUses.js); absorbs the
  // per-monster exhausted clones (attack-chip and save-chip faces alike — the gate fires
  // before chip-type dispatch).
  it('MA-0070 exhausted (3/3): save-chip click refuses with popup + legendary_use_refused, zero spend, zero roll, zero ability_use log', async () => {
    const creatureName = renderDiskLegendary('Adult Brass Dragon', { max: 3, used: 3 }, brassActions());
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(actionRow('Scorching Sands').querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(logged(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(logged(e => e.type === 'ability_use')).toBe(false);
  });

  // Canonical per-action cooldown leg (MA-0092): absorbs the popup-wording bytes from the
  // deleted Scorching Sands/Commanding Presence cooldown clones. The no-cooldown-stamp
  // branch (rows lacking the clause, e.g. Tail Swipe) is owned service-side
  // (monsterLegendaryUses.test.js "rows without the clause stamp no cooldown").
  it('MA-0092 per-action cooldown: Giggling Magic click spends 1 + stamps giggling_magic (never the ungated handleSaveRoll); later-boundary re-click refuses zero-spend with (once per turn) log + wording', async () => {
    const creatureName = renderDiskLegendary('Adult Copper Dragon', { max: 3, used: 0 }, copperActions());
    fireEvent.click(actionRow('Giggling Magic').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 }));
    expect(runtime.store[`${creatureName}.monsterLegendaryActionCooldowns`]).toMatchObject({ giggling_magic: { round: 1 } });
    expect(spendLog('Giggling Magic').description).toMatch(/expends a legendary use for Giggling Magic/);
    ctx.value = { round: 1, activeCreatureName: 'AasimarTest', creatures: CREATURES };
    fireEvent.click(actionRow('Giggling Magic').querySelector('.mc-dice-link'));
    await waitFor(() => expect(logged(e => e.automationType === 'giggling_magic_refused (once per turn)')).toBe(true));
    expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 });
    expect(String(setPopupHtml.mock.calls.map(c => c[0]).join('|'))).toMatch(/can't take Giggling Magic again/);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  // MA-0114 cited owner: Mind Invasion numeric save chips + gated numeric save-leg roll.
  it('MA-0114 green Mind Invasion: renders numeric save chips (4d8 + DC 17 Wisdom, no expend chip); gated click spends 1 and rolls the save leg (WIS DC 17, 4d8 Psychic half, armed target)', async () => {
    const creatureName = renderDiskLegendary('Adult Green Dragon', { max: 3, used: 0 }, greenActions());
    const row = actionRow('Mind Invasion');
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    expect(row.querySelector('.mc-dice-link').textContent).toContain('4d8');
    expect(row.querySelector('.mc-dice-link-save-clickable').textContent).toMatch(/DC 17 Wisdom/);
    fireEvent.click(row.querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(17);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('4d8');
    expect(context.targetName).toBe('TestPC');
    expect(spendLog('Mind Invasion').description).toMatch(/expends a legendary use for Mind Invasion/);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  // MA-0125 cited owner: "DC 20 Wisdom save chip". Damageless save row with saveConditions;
  // also the canonical same-boundary save-chip latch.
  it('MA-0125 red Commanding Presence: DC 20 Wisdom chip (no expend chip); gated click spends 1 + stamps commanding_presence latch + rolls damageless WIS DC 20 (charmed); same-boundary re-click rolls nothing more', async () => {
    const creatureName = renderDiskLegendary('Adult Red Dragon', { max: 3, used: 0 }, redActions(), 22);
    expect(actionRow('Commanding Presence').querySelector('.mc-dice-link-legendary')).toBe(null);
    expect(saveChip('Commanding Presence').textContent).toMatch(/DC 20 Wisdom/);
    fireEvent.click(saveChip('Commanding Presence'));
    await waitFor(() => expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 }));
    expect(runtime.store[`${creatureName}.monsterLegendaryActionCooldowns`]).toMatchObject({ commanding_presence: { round: 1 } });
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(20);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula == null).toBe(true);
    expect(context.saveConditions).toEqual(['charmed']);
    expect(context.targetName).toBe('TestPC');
    expect(spendLog('Commanding Presence').description).toMatch(/expends a legendary use for Commanding Presence/);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    fireEvent.click(saveChip('Commanding Presence'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollSavingThrow.mock.calls.length).toBe(1);
  });

  // Canonical spell-attack press + canonical regain/re-arm leg (regain mechanics also
  // service-side monsterLegendaryUses.test.js).
  it('MA-0126 red Fiery Rays: +12 chip (no expend chip); gated click spends 1 + stamps fiery_rays + rolls +12 spell attack (2d6 Fire auto-damage, spell-origin, armed target); regain at the next boundary re-arms for a second press', async () => {
    const creatureName = renderDiskLegendary('Adult Red Dragon', { max: 3, used: 0 }, redActions());
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(actionRow('Fiery Rays').querySelector('.mc-dice-link-legendary')).toBe(null);
    const chip = actionRow('Fiery Rays').querySelector('.mc-dice-link');
    expect(chip.textContent).toContain('+12');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 }));
    expect(runtime.store[`${creatureName}.monsterLegendaryActionCooldowns`]).toMatchObject({ fiery_rays: { round: 1 } });
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Fiery Rays');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(12);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d6');
    expect(options.autoDamageName).toBe('Fiery Rays');
    expect(options.damageType).toBe('Fire');
    expect(options.isSpellDamage).toBe(true);
    expect(options.targetName).toBe('TestPC');
    expect(spendLog('Fiery Rays').description).toMatch(/expends a legendary use for Fiery Rays/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    // Regain at the dragon turn-start clears uses + latch; next-boundary click spends again.
    ctx.value = { round: 2, activeCreatureName: 'Thug 1', creatures: CREATURES };
    runtime.store[`${creatureName}.monsterLegendaryUses`] = { max: 3, used: 0 };
    delete runtime.store[`${creatureName}.monsterLegendaryActionCooldowns`];
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 }));
    expect(ROLLERS.rollAttack.mock.calls.length).toBe(2);
  });

  it('MA-0173 ancient blue Cloaked Flight advisory row: click spends 1 + stamps cloaked_flight + advisory popup + ability_use log, no roll; same-boundary re-click refuses, later boundary once-per-turn refuses, refusals never log advisories', async () => {
    const creatureName = renderDiskLegendary('ancient-blue-dragon', { max: 3, used: 0 }, [ANCIENT_BLUE_REND], 22);
    fireEvent.click(legendaryChip('Cloaked Flight'));
    await waitFor(() => expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 }));
    expect(runtime.store[`${creatureName}.monsterLegendaryActionCooldowns`]).toMatchObject({ cloaked_flight: { round: 1 } });
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    const html = String(setPopupHtml.mock.calls.map(c => String(c[0])).find(h => h.includes('Cloaked Flight')));
    expect(html).toMatch(/Legendary Action — Cloaked Flight/);
    expect(html).toMatch(/casts invisibility on itself/);
    expect(html).toMatch(/GM-enforced/);
    await waitFor(() => expect(logged(e =>
      e.type === 'ability_use' && e.abilityName === 'Cloaked Flight' && /casts invisibility on itself.*GM-enforced/s.test(e.description))).toBe(true));
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    fireEvent.click(legendaryChip('Cloaked Flight'));
    await waitFor(() => expect(logged(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 });
    ctx.value = { round: 1, activeCreatureName: 'AasimarTest', creatures: CREATURES };
    fireEvent.click(legendaryChip('Cloaked Flight'));
    await waitFor(() => expect(logged(e => e.automationType === 'cloaked_flight_refused (once per turn)')).toBe(true));
    expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  // Canonical AoE-picker legendary press (SaveAttackAoeModal routing owned by the
  // SaveAttackAoeModal.* lanes; here only the gated spend + picker open is the face).
  it('MA-0174 ancient blue Sonic Boom: DC 22 Constitution chip (no expend chip); gated click spends 1 + stamps sonic_boom + opens the AoE picker with no console error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const creatureName = renderDiskLegendary('ancient-blue-dragon', { max: 3, used: 0 }, [ANCIENT_BLUE_REND], 22);
    expect(actionRow('Sonic Boom').querySelector('.mc-dice-link-legendary')).toBe(null);
    expect(saveChip('Sonic Boom').textContent).toMatch(/DC 22 Constitution/);
    fireEvent.click(saveChip('Sonic Boom'));
    await waitFor(() => expect(runtime.store[`${creatureName}.monsterLegendaryUses`]).toEqual({ max: 3, used: 1 }));
    expect(runtime.store[`${creatureName}.monsterLegendaryActionCooldowns`]).toMatchObject({ sonic_boom: { round: 1 } });
    expect(spendLog('Sonic Boom').description).toMatch(/expends a legendary use for Sonic Boom/);
    await waitFor(() => expect(document.querySelector('.sp-overlay')).toBeTruthy());
    expect(errSpy).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
