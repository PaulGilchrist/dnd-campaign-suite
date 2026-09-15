// MA-0021 regression: legendary-uses economy on the Aboleth card. The header
// row shows a "(N left)" counter via the monsterLegendaryUses runtime map;
// the verbatim action rows beneath become gated clickable rows — click expends
// a use (+ spend log) / refuses when exhausted (popup + legendary_use_refused,
// zero spend).
// MA-0022: the non-numeric Lash row delegates_to Tentacle — clicking spends 1
// use and rolls the delegated attack (+9 / 2d6+5) via the same attack seam,
// named "Lash (Tentacle attack)".
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

function renderAboleth(uses) {
  if (uses !== undefined) runtime.store['Aboleth 1.monsterLegendaryUses'] = uses;
  const m = makeMonster({ name: 'Aboleth', actions: [TENTACLE], legendary_actions: LEGENDARY });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
}

function lashLink() {
  return Array.from(document.querySelectorAll('.mc-dice-link-legendary')).find(el => el.closest('div')?.textContent.includes('Lash')) || null;
}

describe('MA-0021 monsters.json data: aboleth legendary header authors uses:3', () => {
  it('legendary_actions[0] carries numeric uses 3 (no longer name-text only)', () => {
    const aboleth = monstersData.find(m => m.name === 'Aboleth');
    expect(aboleth.legendary_actions[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(aboleth.legendary_actions[0].uses).toBe(3);
  });
});

const brass = () => monstersData.find(m => m.name === 'Adult Brass Dragon');
const brassActions = () => [{ name: 'Rend', attack_bonus: 11, damage_dice_primary: '2d10 + 6', damage_type_primary: 'Slashing', reach: '10 ft.' }];

// MA-0070 data lock: Adult Brass Dragon legendary rows mirror the verified
// MA-0058/MA-0060 Adult Blue Dragon shape — header authors uses:3 (counter
// renders), spell-attack row authors the MA-0033 seam, Pounce delegates to
// Rend, Scorching Sands authors its own save numbers with dc_success none.
describe('MA-0070 monsters.json data: adult brass dragon legendary economy authored', () => {
  it('header carries numeric uses 3 (no longer name-text only)', () => {
    const la = brass().legendary_actions;
    expect(la[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(la[0].uses).toBe(3);
  });

  it('Blazing Light authors the spell-attack seam (+8, 2d6 Fire per ray)', () => {
    const row = brass().legendary_actions.find(a => a.name === 'Blazing Light');
    expect(row.attack_bonus).toBe(8);
    expect(row.spell_attack_bonus).toBe(8);
    expect(row.damage_dice_primary).toBe('2d6');
    expect(row.damage_type_primary).toBe('Fire');
    expect(row.description).toMatch(/Ranged Spell Attack: \+8/);
  });

  it('Pounce delegates_to the Rend row', () => {
    const row = brass().legendary_actions.find(a => a.name === 'Pounce');
    expect(row.delegates_to).toBe('Rend');
    expect(brass().actions.find(a => a.name === 'Rend')?.attack_bonus).toBe(11);
  });

  it('Scorching Sands authors its own save numbers, no effect on success', () => {
    const row = brass().legendary_actions.find(a => a.name === 'Scorching Sands');
    expect(row.save_dc).toBe(16);
    expect(row.save_type).toBe('Dexterity');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('6d8');
    expect(row.damage_type_primary).toBe('Fire');
  });
});

// MA-0070: with the header authored, the brass dragon card renders the
// "(3 left)" counter and every legendary row click routes through the gated
// spend (never the ungated generic handlers).
describe('MA-0070 MonsterCardModal brass dragon legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderBrass(uses) {
    if (uses !== undefined) runtime.store['Adult Brass Dragon 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Adult Brass Dragon',
      actions: brassActions(),
      legendary_actions: brass().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Brass Dragon 1', creatures: CREATURES })} />);
  }
  function legendaryRowLink(name) {
    return Array.from(document.querySelectorAll('.mc-dice-link-legendary')).find(el => el.closest('div')?.textContent.includes(name)) || null;
  }

  it('header shows (3 left); clicking Pounce spends 1, delegates to Rend (+11), logs spend', async () => {
    renderBrass({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    fireEvent.click(legendaryRowLink('Pounce'));
    await waitFor(() => expect(runtime.store['Adult Brass Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(11);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
  });

  it('exhausted (3/3): Scorching Sands click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderBrass({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    const sandsRow = Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Scorching Sands'));
    fireEvent.click(sandsRow.querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult Brass Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('Blazing Light spends 1 and rolls the +8 spell attack', async () => {
    renderBrass({ max: 3, used: 0 });
    const row = Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Blazing Light'));
    fireEvent.click(row.querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Adult Brass Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(8);
  });
});

const bronze = () => monstersData.find(m => m.name === 'Adult Bronze Dragon');
const bronzeActions = () => [{ name: 'Rend', attack_bonus: 12, damage_dice_primary: '2d8 + 7', damage_type_primary: 'Slashing', damage_dice_secondary: '1d10', damage_type_secondary: 'Lightning', reach: '10 ft.' }];

// MA-0081 data lock: Adult Bronze Dragon legendary rows mirror the verified
// MA-0070 Adult Brass Dragon shape — header authors uses:3 (counter renders,
// 4-in-lair stays advisory), Guiding Light authors the MA-0033 spell-attack
// seam (+10 from the Spellcasting row: PB +5 + CHA +5; level 2 Guiding Bolt
// = 5d6 Radiant per spells.json), Pounce delegates to Rend (+12), and
// Thunderclap authors its own save numbers with dc_success none.
describe('MA-0081 monsters.json data: adult bronze dragon legendary economy authored', () => {
  it('header carries numeric uses 3 + lair advisory (no longer name-text only)', () => {
    const la = bronze().legendary_actions;
    expect(la[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(la[0].uses).toBe(3);
    expect(la[0].description).toMatch(/lair.*advisory/i);
  });

  it('Guiding Light authors the spell-attack seam (+10, 5d6 Radiant)', () => {
    const row = bronze().legendary_actions.find(a => a.name === 'Guiding Light');
    expect(row.attack_bonus).toBe(10);
    expect(row.spell_attack_bonus).toBe(10);
    expect(row.damage_dice_primary).toBe('5d6');
    expect(row.damage_type_primary).toBe('Radiant');
    expect(row.description).toMatch(/Ranged Spell Attack: \+10/);
  });

  it('Pounce delegates_to the Rend row (+12)', () => {
    const row = bronze().legendary_actions.find(a => a.name === 'Pounce');
    expect(row.delegates_to).toBe('Rend');
    expect(bronze().actions.find(a => a.name === 'Rend')?.attack_bonus).toBe(12);
  });

  it('Thunderclap authors its own save numbers, no effect on success', () => {
    const row = bronze().legendary_actions.find(a => a.name === 'Thunderclap');
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Constitution');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('3d6');
    expect(row.damage_type_primary).toBe('Thunder');
  });
});

// MA-0081: with the header authored, the bronze dragon card renders the
// "(3 left)" counter and every legendary row click routes through the gated
// spend (never the ungated generic handlers).
describe('MA-0081 MonsterCardModal bronze dragon legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderBronze(uses) {
    if (uses !== undefined) runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Adult Bronze Dragon',
      actions: bronzeActions(),
      legendary_actions: bronze().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Bronze Dragon 1', creatures: CREATURES })} />);
  }
  function bronzeRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
  }

  it('header shows (3 left); clicking Pounce spends 1, delegates to Rend (+12), logs spend', async () => {
    renderBronze({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    fireEvent.click(bronzeRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(12);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
  });

  it('Guiding Light spends 1 and rolls the +10 spell attack', async () => {
    renderBronze({ max: 3, used: 0 });
    fireEvent.click(bronzeRow('Guiding Light').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(10);
  });

  it('exhausted (3/3): Thunderclap click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderBronze({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(bronzeRow('Thunderclap').querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('turn latch: same-boundary second click refuses via the MA-0021 latch (zero extra spend)', async () => {
    renderBronze({ max: 3, used: 0 });
    fireEvent.click(bronzeRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(bronzeRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Adult Bronze Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });
});

const copper = () => monstersData.find(m => m.name === 'Adult Copper Dragon');
const copperActions = () => [{ name: 'Rend', attack_bonus: 11, damage_dice_primary: '2d10 + 6', damage_type_primary: 'Slashing', damage_dice_secondary: '1d8', damage_type_secondary: 'Acid', reach: '10 ft.' }];

// MA-0092 data lock: Adult Copper Dragon legendary rows mirror the verified
// MA-0070/MA-0081 shape — header authors uses:3 (counter renders, 4-in-lair
// stays advisory), Giggling Magic authors its own save numbers with
// dc_success none (failure-only per prose; the subtract-1d6 rider is
// advisory), Mind Jolt keeps the MA-0087 numeric save-leg shape (DC 17 WIS
// 5d8 Psychic half), and Pounce delegates to Rend (+11 from the actions row).
describe('MA-0092 monsters.json data: adult copper dragon legendary economy authored', () => {
  it('header carries numeric uses 3 + lair advisory (no longer name-text only)', () => {
    const la = copper().legendary_actions;
    expect(la[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(la[0].uses).toBe(3);
    expect(la[0].description).toMatch(/lair.*advisory/i);
  });

  it('Giggling Magic authors its own save numbers, no effect on success', () => {
    const row = copper().legendary_actions.find(a => a.name === 'Giggling Magic');
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Charisma');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('7d6');
    expect(row.damage_type_primary).toBe('Psychic');
  });

  it('Mind Jolt keeps the MA-0087 numeric save-leg shape (DC 17 WIS 5d8 half)', () => {
    const row = copper().legendary_actions.find(a => a.name === 'Mind Jolt');
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Wisdom');
    expect(row.dc_success).toBe('half');
    expect(row.damage_dice_primary).toBe('5d8');
    expect(row.damage_type_primary).toBe('Psychic');
  });

  it('Pounce delegates_to the Rend row (+11)', () => {
    const row = copper().legendary_actions.find(a => a.name === 'Pounce');
    expect(row.delegates_to).toBe('Rend');
    expect(copper().actions.find(a => a.name === 'Rend')?.attack_bonus).toBe(11);
  });
});

// MA-0092: with the header authored, the copper dragon card renders the
// "(3 left)" counter and every legendary row click routes through the gated
// spend (never the ungated generic handlers).
describe('MA-0092 MonsterCardModal copper dragon legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderCopper(uses) {
    if (uses !== undefined) runtime.store['Adult Copper Dragon 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Adult Copper Dragon',
      actions: copperActions(),
      legendary_actions: copper().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Copper Dragon 1', creatures: CREATURES })} />);
  }
  function copperRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
  }

  it('header shows (3 left); clicking Pounce spends 1, delegates to Rend (+11), logs spend', async () => {
    renderCopper({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    fireEvent.click(copperRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Adult Copper Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(11);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
  });

  it('Giggling Magic gated click spends 1 (never the ungated handleSaveRoll) and logs spend', async () => {
    renderCopper({ max: 3, used: 0 });
    fireEvent.click(copperRow('Giggling Magic').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Adult Copper Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Giggling Magic/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Giggling Magic/);
  });

  it('exhausted (3/3): Mind Jolt click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderCopper({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(copperRow('Mind Jolt').querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult Copper Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('turn latch: same-boundary second click refuses via the MA-0021 latch (zero extra spend)', async () => {
    renderCopper({ max: 3, used: 0 });
    fireEvent.click(copperRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Adult Copper Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(copperRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Adult Copper Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });

  it('per-action cooldown: Giggling Magic re-click at a later boundary refuses zero-spend with (once per turn) log', async () => {
    renderCopper({ max: 3, used: 0 });
    fireEvent.click(copperRow('Giggling Magic').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Adult Copper Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult Copper Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ giggling_magic: { round: 1 } });
    ctx.value = { round: 1, activeCreatureName: 'AasimarTest', creatures: CREATURES };
    fireEvent.click(copperRow('Giggling Magic').querySelector('.mc-dice-link'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'giggling_magic_refused (once per turn)')).toBe(true));
    expect(runtime.store['Adult Copper Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });
});

const gold = () => monstersData.find(m => m.name === 'Adult Gold Dragon');
const goldActions = () => [{ name: 'Rend', attack_bonus: 14, damage_dice_primary: '2d8 + 8', damage_type_primary: 'Slashing', damage_dice_secondary: '1d8', damage_type_secondary: 'Fire', reach: '10 ft.' }];

// MA-0103 data lock: Adult Gold Dragon legendary rows mirror the verified
// MA-0070/MA-0081/MA-0092 shape — header authors uses:3 (counter renders,
// 4-in-lair stays advisory), Banish keeps its save shape (DC 21 Charisma)
// and authors dc_success none (canonical: no damage or effect on a successful
// save; demiplane transport advisory), Guiding Light authors the MA-0033
// spell-attack seam (+13 from the Spellcasting row: PB +6 + CHA +7; level 2
// Guiding Bolt = 5d6 Radiant per spells.json), Pounce delegates to Rend (+14
// from the actions row).
describe('MA-0103 monsters.json data: adult gold dragon legendary economy authored', () => {
  it('header carries numeric uses 3 + lair advisory (no longer name-text only)', () => {
    const la = gold().legendary_actions;
    expect(la[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(la[0].uses).toBe(3);
    expect(la[0].description).toMatch(/lair.*advisory/i);
  });

  it('Banish keeps DC 21 Charisma and authors dc_success none (success = no damage)', () => {
    const row = gold().legendary_actions.find(a => a.name === 'Banish');
    expect(row.save_dc).toBe(21);
    expect(row.save_type).toBe('Charisma');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('3d6');
    expect(row.damage_type_primary).toBe('Force');
    expect(row.description).toMatch(/No damage or effect on a successful save/i);
    expect(row.description).toMatch(/can'?t take this action again until the start of its next turn/i);
  });

  it('Guiding Light authors the spell-attack seam (+13, 5d6 Radiant)', () => {
    const row = gold().legendary_actions.find(a => a.name === 'Guiding Light');
    expect(row.attack_bonus).toBe(13);
    expect(row.spell_attack_bonus).toBe(13);
    expect(row.damage_dice_primary).toBe('5d6');
    expect(row.damage_type_primary).toBe('Radiant');
    expect(row.description).toMatch(/Ranged Spell Attack: \+13/);
    expect(gold().actions.find(a => a.name === 'Spellcasting')?.description).toMatch(/\+13 to hit with spell attacks/);
  });

  it('Pounce delegates_to the Rend row (+14)', () => {
    const row = gold().legendary_actions.find(a => a.name === 'Pounce');
    expect(row.delegates_to).toBe('Rend');
    expect(gold().actions.find(a => a.name === 'Rend')?.attack_bonus).toBe(14);
  });
});

// MA-0103: with the header authored, the gold dragon card renders the
// "(3 left)" counter and every legendary row click routes through the gated
// spend (never the ungated generic handlers).
describe('MA-0103 MonsterCardModal gold dragon legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderGold(uses) {
    if (uses !== undefined) runtime.store['Adult Gold Dragon 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Adult Gold Dragon',
      actions: goldActions(),
      legendary_actions: gold().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Gold Dragon 1', creatures: CREATURES })} />);
  }
  function goldRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
  }

  it('header shows (3 left); clicking Pounce spends 1, delegates to Rend (+14), logs spend', async () => {
    renderGold({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    fireEvent.click(goldRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Adult Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(14);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
  });

  it('Banish gated click spends 1, stamps once-per-turn cooldown, save at DC 21 success=none', async () => {
    renderGold({ max: 3, used: 0 });
    fireEvent.click(goldRow('Banish').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Adult Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult Gold Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ banish: { round: 1 } });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Banish/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Banish/);
  });

  it('exhausted (3/3): Guiding Light click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderGold({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(goldRow('Guiding Light').querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('turn latch: same-boundary second click refuses via the MA-0021 latch (zero extra spend)', async () => {
    renderGold({ max: 3, used: 0 });
    fireEvent.click(goldRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Adult Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(goldRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Adult Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });

  it('per-action cooldown: Banish re-click at a later boundary refuses zero-spend with (once per turn) log', async () => {
    renderGold({ max: 3, used: 0 });
    fireEvent.click(goldRow('Banish').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Adult Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    ctx.value = { round: 1, activeCreatureName: 'TestPC', creatures: CREATURES };
    fireEvent.click(goldRow('Banish').querySelector('.mc-dice-link'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'banish_refused (once per turn)')).toBe(true));
    expect(runtime.store['Adult Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });
});

const green = () => monstersData.find(m => m.name === 'Adult Green Dragon');
const greenActions = () => [{ name: 'Rend', attack_bonus: 11, damage_dice_primary: '2d8 + 6', damage_type_primary: 'Slashing', damage_dice_secondary: '2d6', damage_type_secondary: 'Poison', reach: '10 ft.' }];

// MA-0113 data lock: Adult Green Dragon legendary rows mirror the verified
// MA-0070/MA-0081/MA-0092/MA-0103 shape — header authors uses:3 (counter
// renders, 4-in-lair stays advisory), Noxious Miasma keeps its save shape
// (DC 17 Constitution, 2d6 Poison) and authors dc_success none (success = no
// damage or effect; AC-penalty te advisory), Mind Invasion keeps the gated
// economy and — MA-0114 — its MA-0113 interim advisory placeholder is
// replaced by the real numeric save shape, Pounce delegates to Rend (+11
// from the actions row).
describe('MA-0113 monsters.json data: adult green dragon legendary economy authored', () => {
  it('header carries numeric uses 3 + lair advisory (no longer name-text only)', () => {
    const la = green().legendary_actions;
    expect(la[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(la[0].uses).toBe(3);
    expect(la[0].description).toMatch(/lair.*advisory/i);
  });

  it('Noxious Miasma keeps DC 17 Constitution and authors dc_success none (success = no damage)', () => {
    const row = green().legendary_actions.find(a => a.name === 'Noxious Miasma');
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Constitution');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('2d6');
    expect(row.damage_type_primary).toBe('Poison');
    expect(row.description).toMatch(/No effect on a successful save/i);
    expect(row.description).toMatch(/can'?t take this action again until the start of its next turn/i);
  });

  // MA-0114: the MA-0113 interim advisory placeholder ("advisory":
  // "mind_spike") is REPLACED by the row's real numeric save shape, mirroring
  // the verified MA-0087/MA-0092 Copper Mind Jolt pattern — Mind Spike lv3
  // per 2024 spells.json (3d8 base +1d8/slot = 4d8 Psychic), Spellcasting
  // row save_dc 17, app-data dc_success half.
  it('MA-0114 Mind Invasion authors the numeric save shape (DC 17 WIS 4d8 Psychic half), advisory placeholder removed', () => {
    const row = green().legendary_actions.find(a => a.name === 'Mind Invasion');
    expect(row.advisory == null).toBe(true);
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Wisdom');
    expect(row.dc_success).toBe('half');
    expect(row.damage_dice_primary).toBe('4d8');
    expect(row.damage_type_primary).toBe('Psychic');
    expect(row.description).toMatch(/level 3 version/);
    expect(row.description).toMatch(/DC 17 Wisdom saving throw/);
    expect(green().actions.find(a => a.name === 'Spellcasting')?.save_dc).toBe(17);
    const spike = spells2024.find(s => s.index === 'mind-spike');
    expect(spike.damage.damage_at_slot_level['3']).toBe('4d8');
    expect(spike.damage.damage_at_slot_level['2']).toBe('3d8');
    expect(spike.dc.dc_success).toBe('half');
  });

  it('Pounce delegates_to the Rend row (+11)', () => {
    const row = green().legendary_actions.find(a => a.name === 'Pounce');
    expect(row.delegates_to).toBe('Rend');
    expect(green().actions.find(a => a.name === 'Rend')?.attack_bonus).toBe(11);
  });
});

// MA-0113: with the header authored, the green dragon card renders the
// "(3 left)" counter and every legendary row click routes through the gated
// spend (never the ungated generic handlers).
describe('MA-0113 MonsterCardModal green dragon legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderGreen(uses) {
    if (uses !== undefined) runtime.store['Adult Green Dragon 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Adult Green Dragon',
      actions: greenActions(),
      legendary_actions: green().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Green Dragon 1', creatures: CREATURES })} />);
  }
  function greenRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
  }

  it('header shows (3 left); clicking Pounce spends 1, delegates to Rend (+11), logs spend', async () => {
    renderGreen({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    fireEvent.click(greenRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Adult Green Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(11);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
  });

  it('Noxious Miasma gated click spends 1, stamps once-per-turn cooldown, never the ungated roll', async () => {
    renderGreen({ max: 3, used: 0 });
    fireEvent.click(greenRow('Noxious Miasma').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Adult Green Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult Green Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ noxious_miasma: { round: 1 } });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Noxious Miasma/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Noxious Miasma/);
  });

  // MA-0114: the advisory-only chip is gone — the row now renders the
  // numeric save affordances (plain .mc-dice-link "4d8" + "DC 17 Wisdom"
  // save chip, MA-0092 pitfall: gated save rows render plain .mc-dice-link)
  // and a gated click spends 1 then rolls the numeric save leg: WIS DC 17,
  // 4d8 Psychic, half-on-success (armed target, no AoE picker).
  function renderGreenArmed(uses) {
    runtime.store['Adult Green Dragon 1.monsterLegendaryUses'] = uses;
    const creatures = [
      { name: 'Adult Green Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 230, maxHp: 230, ac: 19, conditions: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
    ];
    const m = makeMonster({ name: 'Adult Green Dragon', actions: greenActions(), legendary_actions: green().legendary_actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Green Dragon 1', creatures })} />);
  }

  it('MA-0114 Mind Invasion renders numeric save chips (4d8 + DC 17 Wisdom), no advisory expend chip', () => {
    renderGreenArmed({ max: 3, used: 0 });
    const row = greenRow('Mind Invasion');
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    expect(row.querySelector('.mc-dice-link').textContent).toContain('4d8');
    expect(row.querySelector('.mc-dice-link-save-clickable').textContent).toMatch(/DC 17 Wisdom/);
  });

  it('MA-0114 Mind Invasion gated click spends 1 and rolls the numeric save leg (WIS DC 17, 4d8 Psychic half)', async () => {
    renderGreenArmed({ max: 3, used: 0 });
    fireEvent.click(greenRow('Mind Invasion').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Adult Green Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(17);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('4d8');
    expect(context.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Mind Invasion/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Mind Invasion/);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): Mind Invasion click refuses with popup + legendary_use_refused, zero spend, zero save roll', async () => {
    renderGreen({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(greenRow('Mind Invasion').querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult Green Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): Noxious Miasma click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderGreen({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(greenRow('Noxious Miasma').querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult Green Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('turn latch: same-boundary second click refuses via the MA-0021 latch (zero extra spend)', async () => {
    renderGreen({ max: 3, used: 0 });
    fireEvent.click(greenRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Adult Green Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(greenRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Adult Green Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });

  it('per-action cooldown: Noxious Miasma re-click at a later boundary refuses zero-spend with (once per turn) log', async () => {
    renderGreen({ max: 3, used: 0 });
    fireEvent.click(greenRow('Noxious Miasma').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Adult Green Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    ctx.value = { round: 1, activeCreatureName: 'TestPC', creatures: CREATURES };
    fireEvent.click(greenRow('Noxious Miasma').querySelector('.mc-dice-link'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'noxious_miasma_refused (once per turn)')).toBe(true));
    expect(runtime.store['Adult Green Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });
});

const red = () => monstersData.find(m => m.name === 'Adult Red Dragon');
// MA-0127: mirrors the live actions[1] Rend exactly (secondary Fire leg rides
// the delegate through buildAutoDamageOptions autoDamageSecondaryFormula).
const redActions = () => [{ name: 'Rend', attack_bonus: 14, damage_dice_primary: '1d10 + 8', damage_type_primary: 'Slashing', damage_dice_secondary: '2d4', damage_type_secondary: 'Fire', reach: '10 ft.' }];

// MA-0124 data lock: Adult Red Dragon legendary header mirrors the verified
// MA-0070/MA-0081/MA-0092/MA-0103/MA-0113 shape — header authors uses:3
// (counter renders; 4-in-lair stays advisory, monsterLegendaryUses.js:114).
// SCOPE HEADER ONLY: Commanding Presence / Fiery Rays payloads landed in
// MA-0125 / MA-0126; Pounce carries no own numbers — MA-0127 authored its
// delegates_to payload.
describe('MA-0124 monsters.json data: adult red dragon legendary header authors uses:3', () => {
  it('header carries numeric uses 3 + lair advisory (no longer name-text only)', () => {
    const la = red().legendary_actions;
    expect(la[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(la[0].uses).toBe(3);
    expect(la[0].description).toMatch(/lair.*advisory/i);
  });

  it('Pounce authors no own numbers — the delegate seam owns them (MA-0127)', () => {
    const row = red().legendary_actions.find(a => a.name === 'Pounce');
    expect(row.uses == null).toBe(true);
    expect(row.save_dc == null).toBe(true);
    expect(row.attack_bonus == null).toBe(true);
  });
});

// MA-0125 data lock: Adult Red Dragon legendary "Commanding Presence" was a
// prose-only "uses Spellcasting to cast Command (level 2 version)" row with
// ZERO affordances (0 clickableChildren) — the gated "Expend Legendary" chip
// spent a use then console.errored "no resolvable mechanic" (MA-0114 inert
// fingerprint). Fix authors the numeric save shape mirroring the MA-0114 Mind
// Invasion recipe: WIS save vs the Spellcasting save_dc 20, NO damage
// (dc_success "none" — Command deals none), failed save charms the target
// ("charmed" — RE-USED canonical condition vocabulary from charmSpellUtils /
// charmPersonHandler; no new te, no "commanded" key exists in the registry),
// the per-action "can't take again until next turn" latch rides verbatim
// (MA-0073 commanding_presence cooldown, already LIVE via expendLegendaryUse).
describe('MA-0125 monsters.json data: adult red dragon Commanding Presence authors the numeric save shape', () => {
  it('Commanding Presence authors DC 20 Wisdom, dc_success none, charmed save_effect (advisory placeholder gone)', () => {
    const row = red().legendary_actions.find(a => a.name === 'Commanding Presence');
    expect(row.advisory == null).toBe(true);
    expect(row.save_dc).toBe(20);
    expect(row.save_type).toBe('Wisdom');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary == null).toBe(true);
    expect(row.save_effect).toMatch(/charmed/i);
    expect(row.description).toMatch(/Command.*level 2 version/i);
    expect(row.description).toMatch(/DC 20 Wisdom saving throw/i);
    expect(row.description).toMatch(/second creature.*advisory/i);
    expect(row.description).toMatch(/can'?t take this action again until the start of its next turn/i);
    expect(red().actions.find(a => a.name === 'Spellcasting')?.save_dc).toBe(20);
    const command = spells2024.find(s => s.index === 'command');
    expect(command.dc.dc_type).toBe('WIS');
    expect(command.dc.dc_success).toBe('none');
  });
});

// MA-0124: with the header authored, the red dragon card renders the
// "(3 left)" counter and every legendary row click routes through the gated
// spend (never the ungated generic handlers).
describe('MA-0124 MonsterCardModal red dragon legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderRed(uses) {
    if (uses !== undefined) runtime.store['Adult Red Dragon 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Adult Red Dragon',
      actions: redActions(),
      legendary_actions: red().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Red Dragon 1', creatures: CREATURES })} />);
  }
  function redRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
  }

  it('header shows (3 left); Fiery Rays expend chip is gone — numeric +12 chip owns the row (MA-0126)', () => {
    renderRed({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const row = redRow('Fiery Rays');
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    expect(row.querySelector('.mc-dice-link').textContent).toContain('+12');
  });

  it('exhausted (3/3): Commanding Presence save-chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderRed({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('turn latch: same-boundary second click refuses via the MA-0021 latch (zero extra spend)', async () => {
    renderRed({ max: 3, used: 0 });
    fireEvent.click(redRow('Fiery Rays').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(redRow('Fiery Rays').querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });

  it('per-action cooldown: Commanding Presence save-chip re-click at a later boundary refuses zero-spend with (once per turn) log', async () => {
    renderRed({ max: 3, used: 0 });
    fireEvent.click(redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult Red Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ commanding_presence: { round: 1 } });
    ctx.value = { round: 1, activeCreatureName: 'TestPC', creatures: CREATURES };
    fireEvent.click(redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'commanding_presence_refused (once per turn)')).toBe(true));
    expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });
});

// MA-0125: Commanding Presence is no longer an inert expend chip — it renders
// the numeric save chip ("DC 20 Wisdom") and a gated click spends 1, stamps
// the commanding_presence latch, and rolls the damageless WIS DC 20 save leg
// (armed target, no AoE picker, no auto-damage — Command deals none, save
// fail charms the target). MA-0073 per-action cooldown refuses same-turn
// re-click zero-spend; regain clears it.
describe('MA-0125 MonsterCardModal red dragon Commanding Presence gated save row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderRedArmed(uses) {
    runtime.store['Adult Red Dragon 1.monsterLegendaryUses'] = uses;
    const creatures = [
      { name: 'Adult Red Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 256, maxHp: 256, ac: 22, conditions: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
    ];
    const m = makeMonster({ name: 'Adult Red Dragon', actions: redActions(), legendary_actions: red().legendary_actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Red Dragon 1', creatures })} />);
  }
  function redRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
  }

  it('renders the DC 20 Wisdom save chip (no expend-legendary chip, no advisory)', () => {
    renderRedArmed({ max: 3, used: 0 });
    const row = redRow('Commanding Presence');
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    expect(row.querySelector('.mc-dice-link-save-clickable').textContent).toMatch(/DC 20 Wisdom/);
  });

  it('gated click spends 1, stamps the commanding_presence latch, rolls damageless WIS DC 20 (charmed, no auto-damage)', async () => {
    renderRedArmed({ max: 3, used: 0 });
    fireEvent.click(redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult Red Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ commanding_presence: { round: 1 } });
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(20);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula == null).toBe(true);
    expect(context.saveConditions).toEqual(['charmed']);
    expect(context.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Commanding Presence/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Commanding Presence/);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('same-turn re-click (latch) refuses zero-spend, zero extra save roll', async () => {
    renderRedArmed({ max: 3, used: 0 });
    fireEvent.click(redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollSavingThrow.mock.calls.length).toBe(1);
  });

  it('regain at the dragon turn-start clears the latch; next-boundary click spends again', async () => {
    renderRedArmed({ max: 3, used: 0 });
    fireEvent.click(redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    ctx.value = { round: 2, activeCreatureName: 'Thug 1', creatures: CREATURES };
    runtime.store['Adult Red Dragon 1.monsterLegendaryUses'] = { max: 3, used: 0 };
    delete runtime.store['Adult Red Dragon 1.monsterLegendaryActionCooldowns'];
    fireEvent.click(redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(ROLLERS.rollSavingThrow.mock.calls.length).toBe(2);
  });
});

// MA-0126 data lock: Adult Red Dragon legendary "Fiery Rays" was prose-only
// ("uses Spellcasting to cast Scorching Ray") — inert text with zero numeric
// mechanic (MA-0114 fingerprint). Fix authors the MA-0033 spell-attack seam
// mirroring the verified MA-0070 Adult Brass "Blazing Light" shape: +12 to
// hit (Spellcasting row "+12 to hit with spell attacks"), 2d6 Fire per ray
// per spells.json (both paths carry the MA-0065 numeric damage shape),
// single-ray-per-click (multi-ray stays §7 advisory, GM-enforced for
// monsters). The verbatim "can't take this action again until the start of
// its next turn" clause rides the LIVE MA-0073 per-action cooldown latch.
describe('MA-0126 monsters.json data: adult red dragon Fiery Rays authors the spell-attack seam', () => {
  it('Fiery Rays authors +12 spell attack, 2d6 Fire, 120 ft range, verbatim cooldown clause', () => {
    const row = red().legendary_actions.find(a => a.name === 'Fiery Rays');
    expect(row.attack_bonus).toBe(12);
    expect(row.spell_attack_bonus).toBe(12);
    expect(row.damage_dice_primary).toBe('2d6');
    expect(row.damage_type_primary).toBe('Fire');
    expect(row.range).toBe('120 ft.');
    expect(row.description).toMatch(/uses Spellcasting to cast <em>Scorching Ray<\/em>/);
    expect(row.description).toMatch(/Ranged Spell Attack: \+12/);
    expect(row.description).toMatch(/2d6 Fire damage per ray/);
    expect(row.description).toMatch(/multi-ray.*advisory/i);
    expect(row.description).toMatch(/can'?t take this action again until the start of its next turn/i);
    expect(red().actions.find(a => a.name === 'Spellcasting')?.description).toMatch(/\+12 to hit with spell attacks/);
    const ray = spells2024.find(s => s.index === 'scorching-ray');
    expect(ray.damage.damage_type).toBe('Fire');
    expect(ray.damage.damage_at_slot_level['2']).toBe('2d6');
    expect(ray.attack_type).toBe('ranged');
  });
});

// MA-0126: the gated +12 chip spends 1 legendary use then rolls the spell
// attack through the LIVE attack seam (armed target, 2d6 Fire auto-damage on
// hit, isSpellDamage marker), cooldown refuses later re-clicks zero-spend.
describe('MA-0126 MonsterCardModal red dragon Fiery Rays gated spell-attack row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderRedArmed(uses) {
    runtime.store['Adult Red Dragon 1.monsterLegendaryUses'] = uses;
    const creatures = [
      { name: 'Adult Red Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 256, maxHp: 256, ac: 19, conditions: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
    ];
    const m = makeMonster({ name: 'Adult Red Dragon', actions: redActions(), legendary_actions: red().legendary_actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Red Dragon 1', creatures })} />);
  }
  function redRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
  }
  function fieryChip() {
    return redRow('Fiery Rays').querySelector('.mc-dice-link');
  }

  it('renders the +12 numeric chip, no expend-legendary chip', () => {
    renderRedArmed({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const row = redRow('Fiery Rays');
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    expect(fieryChip().textContent).toContain('+12');
  });

  it('gated click spends 1, stamps the fiery_rays latch, rolls +12 spell attack (2d6 Fire auto-damage, spell-origin, armed target)', async () => {
    renderRedArmed({ max: 3, used: 0 });
    fireEvent.click(fieryChip());
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult Red Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ fiery_rays: { round: 1 } });
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Fiery Rays');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(12);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d6');
    expect(options.autoDamageName).toBe('Fiery Rays');
    expect(options.damageType).toBe('Fire');
    expect(options.isSpellDamage).toBe(true);
    expect(options.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Fiery Rays/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Fiery Rays/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): +12 chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderRedArmed({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(fieryChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('per-action cooldown: re-click at a later boundary refuses zero-spend with (once per turn) log', async () => {
    renderRedArmed({ max: 3, used: 0 });
    fireEvent.click(fieryChip());
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    ctx.value = { round: 1, activeCreatureName: 'TestPC', creatures: CREATURES };
    fireEvent.click(fieryChip());
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'fiery_rays_refused (once per turn)')).toBe(true));
    expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollAttack.mock.calls.length).toBe(1);
  });

  it('regain at the dragon turn-start clears the latch; next-boundary click spends and rolls again', async () => {
    renderRedArmed({ max: 3, used: 0 });
    fireEvent.click(fieryChip());
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    ctx.value = { round: 2, activeCreatureName: 'Thug 1', creatures: CREATURES };
    runtime.store['Adult Red Dragon 1.monsterLegendaryUses'] = { max: 3, used: 0 };
    delete runtime.store['Adult Red Dragon 1.monsterLegendaryActionCooldowns'];
    fireEvent.click(fieryChip());
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(ROLLERS.rollAttack.mock.calls.length).toBe(2);
  });
});

describe('MA-0021 MonsterCardModal legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  it('header shows (3 left) fresh; clicking Lash spends 1 and decrements to 2', async () => {
    renderAboleth({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const link = lashLink();
    expect(link).toBeTruthy();
    fireEvent.click(link);
    await waitFor(() => expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Lash/.test(e.description));
    expect(spend).toBeTruthy();
    expect(spend.characterName).toBe('Aboleth 1');
    expect(spend.description).toMatch(/expends a legendary use for Lash/);
  });

  it('exhausted (3/3): popup + legendary_use_refused log, zero spend, counter 0 left', async () => {
    renderAboleth({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(lashLink());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'ability_use')).toBe(false);
    expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  // MA-0022: Lash has no own numbers — it delegates_to the Tentacle row and
  // must roll THAT attack (+9 / 2d6+5) via the same attack seam, named
  // "Lash (Tentacle attack)", after spending 1 legendary use.
  it('MA-0022 Lash delegates to Tentacle: spends 1 and rolls +9 attack named "Lash (Tentacle attack)"', async () => {
    renderAboleth({ max: 3, used: 0 });
    fireEvent.click(lashLink());
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    const call = ROLLERS.rollAttack.mock.calls[0];
    expect(call[0]).toBe('Lash (Tentacle attack)');
    expect(call[1]).toBe(9);
    expect(call[2]).toMatchObject({ autoDamageFormula: '2d6 + 5', autoDamageName: 'Lash (Tentacle attack)', damageType: 'Bludgeoning' });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/expends a legendary use for Lash \(Tentacle attack\)/);
  });

  it('MA-0022 dangling delegates_to: refusal popup + log, zero spend, zero roll', async () => {
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
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused' && /no-delegate/.test(e.description))).toBe(true));
    expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('same-turn double click: first spends, second refused via turn latch (zero extra spend)', async () => {
    renderAboleth({ max: 3, used: 0 });
    fireEvent.click(lashLink());
    await waitFor(() => expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Aboleth 1._legendaryUses_usedRound']).toEqual({ round: 1, activeCreature: 'Thug 1' });
    fireEvent.click(lashLink());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Aboleth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });
});

// MA-0073: Scorching Sands per-action cooldown on the live card. First
// gated click spends 1 + stamps the action-keyed cooldown; a later boundary
// in the same round refuses with popup + scorching_sands_refused (once per
// turn) log, zero spend, zero second save prompt.
describe('MA-0073 MonsterCardModal Scorching Sands once-per-turn gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderBrass(uses) {
    if (uses !== undefined) runtime.store['Adult Brass Dragon 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Adult Brass Dragon',
      actions: brassActions(),
      legendary_actions: brass().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Brass Dragon 1', creatures: CREATURES })} />);
  }
  function sandsRow() {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Scorching Sands'));
  }

  it('first click spends + stamps cooldown; next-boundary re-click refuses zero-spend with (once per turn) log', async () => {
    renderBrass({ max: 3, used: 0 });
    fireEvent.click(sandsRow().querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Adult Brass Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult Brass Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ scorching_sands: { round: 1 } });

    // Later boundary, same round — row's own gate refuses even though the
    // boundary latch would allow and 2 uses remain.
    ctx.value = { round: 1, activeCreatureName: 'AasimarTest', creatures: CREATURES };
    fireEvent.click(sandsRow().querySelector('.mc-dice-link'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'scorching_sands_refused (once per turn)')).toBe(true));
    expect(runtime.store['Adult Brass Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(String(setPopupHtml.mock.calls.map(c => c[0]).join('|'))).toMatch(/can't take Scorching Sands again/);
  });
});

// MA-0127 data lock: Adult Red Dragon legendary "Pounce" was prose-only
// ("moves up to half its Speed, and it makes one Rend attack") — inert
// MA-0116 fingerprint (zero affordances, clicks zero-effect). Fix mirrors the
// MA-0113 Green Pounce exactly: delegates_to "Rend", derived numbers live on
// the delegate row (actions[1]: +14, 1d10 + 8 Slashing + 2d4 Fire) and are
// resolved through the identical attack seam; the secondary Fire leg forwards
// via buildAutoDamageOptions autoDamageSecondaryFormula (MonsterCardModal.jsx
// :502, MA-0116 disproval proof). Movement clause stays advisory (§7 — no
// movement-distance consumer).
describe('MA-0127 monsters.json data: adult red dragon Pounce delegates to the +14 Rend row', () => {
  it('Pounce authors delegates_to Rend, no own numbers; Rend carries +14, 1d10 + 8 Slashing, 2d4 Fire', () => {
    const row = red().legendary_actions.find(a => a.name === 'Pounce');
    expect(row.delegates_to).toBe('Rend');
    expect(row.attack_bonus == null && row.save_dc == null && row.uses == null).toBe(true);
    expect(row.description).toMatch(/moves up to half its Speed.*advisory/i);
    expect(row.description).toMatch(/makes one Rend attack/);
    const rend = red().actions.find(a => a.name === 'Rend');
    expect(rend.attack_bonus).toBe(14);
    expect(rend.damage_dice_primary).toBe('1d10 + 8');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('2d4');
    expect(rend.damage_type_secondary).toBe('Fire');
  });
});

// MA-0127: the gated "Expend Legendary" chip spends 1 and rolls the
// delegated Rend (+14, both damage legs, armed target) named
// "Pounce (Rend attack)"; exhausted clicks refuse zero-spend.
describe('MA-0127 MonsterCardModal red dragon Pounce gated delegate row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderRedArmed(uses) {
    runtime.store['Adult Red Dragon 1.monsterLegendaryUses'] = uses;
    const creatures = [
      { name: 'Adult Red Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 256, maxHp: 256, ac: 19, conditions: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
    ];
    const m = makeMonster({ name: 'Adult Red Dragon', actions: redActions(), legendary_actions: red().legendary_actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Red Dragon 1', creatures })} />);
  }
  function pounceRow() {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Pounce'));
  }
  function pounceChip() {
    return pounceRow().querySelector('.mc-dice-link-legendary');
  }

  it('renders the gated Expend-legendary chip (no own numeric affordance)', () => {
    renderRedArmed({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(pounceChip()).toBeTruthy();
    expect(pounceRow().querySelector('.mc-dice-link:not(.mc-dice-link-legendary)')).toBe(null);
  });

  it('gated click spends 1 and rolls delegated Rend +14 named "Pounce (Rend attack)" with both damage legs', async () => {
    renderRedArmed({ max: 3, used: 0 });
    fireEvent.click(pounceChip());
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
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
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderRedArmed({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(pounceChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('turn latch: same-boundary second click refuses via the MA-0021 latch (zero extra spend, one roll)', async () => {
    renderRedArmed({ max: 3, used: 0 });
    fireEvent.click(pounceChip());
    await waitFor(() => expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(pounceChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Adult Red Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollAttack.mock.calls.length).toBe(1);
  });
});

const silver = () => monstersData.find(m => m.name === 'Adult Silver Dragon');
const silverActions = () => [{ name: 'Rend', attack_bonus: 13, damage_dice_primary: '2d8 + 8', damage_type_primary: 'Slashing', damage_dice_secondary: '1d8', damage_type_secondary: 'Cold', reach: '10 ft.' }];

// MA-0136 data lock: Adult Silver Dragon legendary rows mirror the verified
// MA-0070/MA-0113/MA-0124 shape — header authors uses:3 (counter renders,
// 4-in-lair stays advisory), Chill authors the numeric save shape mirroring
// red Commanding Presence (DC 19 from the Spellcasting block, Wisdom per
// hold-monster dc_type, dc_success none, paralyzed mechanical marker),
// Cold Gale stays byte-identical (generic save path, default half matches
// "Half damage only" prose), Pounce delegates to the +13 Rend row.
describe('MA-0136 monsters.json data: adult silver dragon legendary economy authored', () => {
  it('header carries numeric uses 3 + lair advisory (no longer name-text only)', () => {
    const la = silver().legendary_actions;
    expect(la[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(la[0].uses).toBe(3);
    expect(la[0].description).toMatch(/lair.*advisory/i);
  });

  it('Chill authors DC 19 Wisdom, dc_success none, paralyzed save_effect (inert prose gone)', () => {
    const row = silver().legendary_actions.find(a => a.name === 'Chill');
    expect(row.save_dc).toBe(19);
    expect(row.save_type).toBe('Wisdom');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary == null).toBe(true);
    expect(row.save_effect).toMatch(/paralyzed/i);
    expect(row.description).toMatch(/Hold Monster/i);
    expect(row.description).toMatch(/DC 19 Wisdom saving throw/i);
    expect(row.description).toMatch(/90 feet.*advisory|advisory/i);
    expect(row.description).toMatch(/can'?t take this action again until the start of its next turn/i);
    expect(silver().actions.find(a => a.name === 'Spellcasting')?.save_dc).toBe(19);
    const hold = spells2024.find(s => s.index === 'hold-monster');
    expect(hold.dc.dc_type).toBe('WIS');
    expect(hold.dc.dc_success).toBe('none');
  });

  it('Cold Gale untouched: DC 19 Dexterity, 4d6 Cold, dc_success default half matches prose', () => {
    const row = silver().legendary_actions.find(a => a.name === 'Cold Gale');
    expect(row.save_dc).toBe(19);
    expect(row.save_type).toBe('Dexterity');
    expect(row.dc_success == null).toBe(true);
    expect(row.damage_dice_primary).toBe('4d6');
    expect(row.damage_type_primary).toBe('Cold');
    expect(row.save_effect).toMatch(/Half damage only/);
  });

  it('Pounce delegates_to the +13 Rend row with the verbatim advisory movement clause', () => {
    const row = silver().legendary_actions.find(a => a.name === 'Pounce');
    expect(row.delegates_to).toBe('Rend');
    expect(row.attack_bonus == null && row.save_dc == null && row.uses == null).toBe(true);
    expect(row.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(silver().actions.find(a => a.name === 'Rend')?.attack_bonus).toBe(13);
  });
});

// MA-0136: with the header authored, the silver dragon card renders the
// "(3 left)" counter and every legendary row click routes through the gated
// spend (Cold Gale no longer the ungated generic save path).
describe('MA-0136 MonsterCardModal silver dragon legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderSilver(uses) {
    if (uses !== undefined) runtime.store['Adult Silver Dragon 1.monsterLegendaryUses'] = uses;
    const creatures = [
      { name: 'Adult Silver Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 216, maxHp: 216, ac: 19, conditions: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
    ];
    const m = makeMonster({ name: 'Adult Silver Dragon', actions: silverActions(), legendary_actions: silver().legendary_actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Silver Dragon 1', creatures })} />);
  }
  function silverRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
  }

  it('header shows (3 left); Chill renders the DC 19 Wisdom save chip; Pounce the expend chip', () => {
    renderSilver({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(silverRow('Chill').querySelector('.mc-dice-link-save-clickable').textContent).toMatch(/DC 19 Wisdom/);
    expect(silverRow('Pounce').querySelector('.mc-dice-link-legendary')).toBeTruthy();
  });

  it('Chill gated click spends 1, stamps chill latch, rolls damageless WIS DC 19 (paralyzed, no auto-damage)', async () => {
    renderSilver({ max: 3, used: 0 });
    fireEvent.click(silverRow('Chill').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Adult Silver Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult Silver Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ chill: { round: 1 } });
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(19);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula == null).toBe(true);
    expect(context.saveConditions).toEqual(['paralyzed']);
    expect(context.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Chill/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Chill/);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('Cold Gale gated click spends 1 (no longer the ungated generic save path), stamps cold_gale cooldown, half-on-save intact', async () => {
    renderSilver({ max: 3, used: 0 });
    fireEvent.click(silverRow('Cold Gale').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Adult Silver Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult Silver Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ cold_gale: { round: 1 } });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Cold Gale/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Cold Gale/);
    expect(document.querySelector('.sp-overlay')).toBeTruthy();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('Pounce gated click spends 1 and rolls delegated Rend +13 named "Pounce (Rend attack)"', async () => {
    renderSilver({ max: 3, used: 0 });
    fireEvent.click(silverRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Adult Silver Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(13);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): save-chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderSilver({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(silverRow('Cold Gale').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult Silver Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('turn latch: same-boundary second click refuses via the MA-0021 latch (zero extra spend)', async () => {
    renderSilver({ max: 3, used: 0 });
    fireEvent.click(silverRow('Cold Gale').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Adult Silver Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(silverRow('Cold Gale').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Adult Silver Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });
});

const white = () => monstersData.find(m => m.name === 'Adult White Dragon');
const whiteActions = () => [{ name: 'Rend', attack_bonus: 11, damage_dice_primary: '2d6 + 6', damage_type_primary: 'Slashing', damage_dice_secondary: '1d8', damage_type_secondary: 'Cold', reach: '10 ft.' }];

// MA-0145 data lock: Adult White Dragon legendary rows mirror the verified
// MA-0136 silver shape — header authors uses:3 (counter renders, 4-in-lair
// stays advisory), Freezing Burst/Frightful Presence numerics byte-untouched
// (FP structuring is MA-0147), Pounce delegates to the +11 Rend row.
describe('MA-0145 monsters.json data: adult white dragon legendary economy authored', () => {
  it('header carries numeric uses 3 + lair advisory (no longer name-text only)', () => {
    const la = white().legendary_actions;
    expect(la[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(la[0].uses).toBe(3);
    expect(la[0].description).toMatch(/lair.*advisory/i);
  });

  it('Freezing Burst numerics byte-untouched: DC 14 Constitution, 2d6 Cold', () => {
    const row = white().legendary_actions.find(a => a.name === 'Freezing Burst');
    expect(row.save_dc).toBe(14);
    expect(row.save_type).toBe('Constitution');
    expect(row.damage_dice_primary).toBe('2d6');
    expect(row.damage_type_primary).toBe('Cold');
    expect(row.save_effect).toMatch(/Speed is 0/);
  });

  it('Frightful Presence numerics byte-untouched: DC 14 Charisma (MA-0147 stays queued)', () => {
    const row = white().legendary_actions.find(a => a.name === 'Frightful Presence');
    expect(row.save_dc).toBe(14);
    expect(row.save_type).toBe('Charisma');
    expect(row.description).toMatch(/spell save DC 14/i);
  });

  it('Pounce delegates_to the +11 Rend row with the verbatim advisory movement clause', () => {
    const row = white().legendary_actions.find(a => a.name === 'Pounce');
    expect(row.delegates_to).toBe('Rend');
    expect(row.attack_bonus == null && row.save_dc == null && row.uses == null).toBe(true);
    expect(row.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(white().actions.find(a => a.name === 'Rend')?.attack_bonus).toBe(11);
  });
});

// MA-0145: with the header authored, the white dragon card renders the
// "(3 left)" counter and every legendary row click routes through the gated
// spend (Freezing Burst/Frightful Presence no longer the ungated generic
// save paths).
describe('MA-0145 MonsterCardModal white dragon legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderWhite(uses) {
    if (uses !== undefined) runtime.store['Adult White Dragon 1.monsterLegendaryUses'] = uses;
    const creatures = [
      { name: 'Adult White Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 200, maxHp: 200, ac: 18, conditions: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
    ];
    const m = makeMonster({ name: 'Adult White Dragon', actions: whiteActions(), legendary_actions: white().legendary_actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult White Dragon 1', creatures })} />);
  }
  function whiteRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
  }

  it('header shows (3 left); Freezing Burst/Frightful Presence save chips; Pounce the expend chip', () => {
    renderWhite({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(whiteRow('Freezing Burst').querySelector('.mc-dice-link-save-clickable').textContent).toMatch(/DC 14 Constitution/);
    expect(whiteRow('Frightful Presence').querySelector('.mc-dice-link-save-clickable').textContent).toMatch(/DC 14 Charisma/);
    expect(whiteRow('Pounce').querySelector('.mc-dice-link-legendary')).toBeTruthy();
  });

  it('Freezing Burst gated click spends 1, stamps freezing_burst cooldown, opens the DC 14 CON picker', async () => {
    renderWhite({ max: 3, used: 0 });
    fireEvent.click(whiteRow('Freezing Burst').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Adult White Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult White Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ freezing_burst: { round: 1 } });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Freezing Burst/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Freezing Burst/);
    expect(document.querySelector('.sp-overlay')).toBeTruthy();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('Frightful Presence gated click spends 1 on its own boundary (no longer the ungated generic save path)', async () => {
    renderWhite({ max: 3, used: 0 });
    fireEvent.click(whiteRow('Frightful Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Adult White Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Adult White Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ frightful_presence: { round: 1 } });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Frightful Presence/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Frightful Presence/);
  });

  it('Pounce gated click spends 1 and rolls delegated Rend +11 named "Pounce (Rend attack)"', async () => {
    renderWhite({ max: 3, used: 0 });
    fireEvent.click(whiteRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store['Adult White Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(11);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): save-chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderWhite({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(whiteRow('Freezing Burst').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Adult White Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('turn latch: same-boundary second click refuses via the MA-0021 latch (zero extra spend)', async () => {
    renderWhite({ max: 3, used: 0 });
    fireEvent.click(whiteRow('Freezing Burst').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Adult White Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(whiteRow('Freezing Burst').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Adult White Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });
});

const ancient = () => monstersData.find(m => m.name === 'Ancient Black Dragon');

// MA-0161 data lock: Ancient Black Dragon header authors uses:3 (counter
// renders, 4-in-lair stays advisory); Cloud of Insects numerics byte-
// untouched; MA-0163 authored the FP save-cast shape; MA-0164 delegates
// Pounce to the +15 Rend row.
describe('MA-0161 monsters.json data: ancient black dragon legendary economy authored', () => {
  it('header carries numeric uses 3 + lair advisory (no longer name-text only)', () => {
    const la = ancient().legendary_actions;
    expect(la[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(la[0].uses).toBe(3);
    expect(la[0].description).toMatch(/lair.*advisory/i);
  });

  it('Cloud of Insects numerics byte-untouched: DC 21 Dexterity, 6d10 Poison', () => {
    const row = ancient().legendary_actions.find(a => a.name === 'Cloud of Insects');
    expect(row.save_dc).toBe(21);
    expect(row.save_type).toBe('Dexterity');
    expect(row.damage_dice_primary).toBe('6d10');
    expect(row.damage_type_primary).toBe('Poison');
  });

  it('FP row MA-0163 save-cast shape; MA-0164 Pounce delegates to the +15 Rend row, no own numbers', () => {
    const fp = ancient().legendary_actions.find(a => a.name === 'Frightful Presence');
    expect(fp.save_dc).toBe(21);
    expect(fp.save_type).toBe('Wisdom');
    expect(fp.repeat_save?.condition).toBe('frightened');
    expect(fp.success_immunity?.effect).toBe('frightful_presence_immunity');
    expect(fp.attack_bonus == null && fp.uses == null).toBe(true);
    const pounce = ancient().legendary_actions.find(a => a.name === 'Pounce');
    expect(pounce.delegates_to).toBe('Rend');
    expect(pounce.attack_bonus == null && pounce.save_dc == null && pounce.uses == null).toBe(true);
    expect(pounce.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    const rend = ancient().actions.find(a => a.name === 'Rend');
    expect(rend.attack_bonus).toBe(15);
    expect(rend.damage_dice_primary).toBe('2d8 + 8');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('2d8');
    expect(rend.damage_type_secondary).toBe('Acid');
  });
});

// MA-0161: with the header authored, the ancient black dragon card renders
// the "(3 left)" counter and Cloud of Insects routes through the gated
// spend (no longer the ungated generic save path).
describe('MA-0161 MonsterCardModal ancient black dragon legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderAncient(uses) {
    if (uses !== undefined) runtime.store['Ancient Black Dragon 1.monsterLegendaryUses'] = uses;
    const creatures = [
      { name: 'Ancient Black Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 367, maxHp: 367, ac: 22, conditions: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
    ];
    const m = makeMonster({ name: 'Ancient Black Dragon', actions: [{ name: 'Rend', attack_bonus: 15, damage_dice_primary: '2d8 + 8', damage_type_primary: 'Slashing', damage_dice_secondary: '2d8', damage_type_secondary: 'Acid', reach: '15 ft.' }], legendary_actions: ancient().legendary_actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient Black Dragon 1', creatures })} />);
  }
  function ancientRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
  }

  it('header shows (3 left); Cloud of Insects gated save chip DC 21 Dexterity', () => {
    renderAncient({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(ancientRow('Cloud of Insects').querySelector('.mc-dice-link-save-clickable').textContent).toMatch(/DC 21 Dexterity/);
  });

  it('Cloud gated click spends 1 (3→2), stamps cloud_of_insects cooldown, routes the DEX save through the block-save seam', async () => {
    renderAncient({ max: 3, used: 0 });
    fireEvent.click(ancientRow('Cloud of Insects').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Ancient Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    expect(runtime.store['Ancient Black Dragon 1.monsterLegendaryActionCooldowns']).toMatchObject({ cloud_of_insects: { round: 1 } });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Cloud of Insects/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Cloud of Insects/);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('DEX');
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('turn latch: same-boundary second Cloud click refuses via the MA-0021 latch (zero extra spend)', async () => {
    renderAncient({ max: 3, used: 0 });
    fireEvent.click(ancientRow('Cloud of Insects').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Ancient Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(ancientRow('Cloud of Insects').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Ancient Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
  });

  it('exhausted (3/3): Cloud save-chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderAncient({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(ancientRow('Cloud of Insects').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Ancient Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});

// MA-0164: Ancient Black Dragon legendary "Pounce" was prose-only inert —
// post-MA-0161 the gated chip spent a use then dead-ended in console.error
// ("no resolvable mechanic"). Fix mirrors MA-0136 silver / MA-0145 white
// exactly: delegates_to "Rend"; derived numbers (+15, 2d8 + 8 Slashing +
// 2d8 Acid) live on the delegate row (actions[1]) and resolve through the
// identical attack seam; movement clause stays advisory (§7 — no
// movement-distance consumer).
describe('MA-0164 MonsterCardModal ancient black dragon Pounce gated delegate row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderAncientArmed(uses) {
    runtime.store['Ancient Black Dragon 1.monsterLegendaryUses'] = uses;
    const creatures = [
      { name: 'Ancient Black Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 367, maxHp: 367, ac: 22, conditions: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
    ];
    const m = makeMonster({
      name: 'Ancient Black Dragon',
      actions: [{ name: 'Rend', attack_bonus: 15, damage_dice_primary: '2d8 + 8', damage_type_primary: 'Slashing', damage_dice_secondary: '2d8', damage_type_secondary: 'Acid', reach: '15 ft.' }],
      legendary_actions: ancient().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient Black Dragon 1', creatures })} />);
  }
  function pounceRow() {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes('Pounce'));
  }
  function pounceChip() {
    return pounceRow().querySelector('.mc-dice-link-legendary');
  }

  it('renders the gated Expend-legendary chip (no own numeric affordance)', () => {
    renderAncientArmed({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(pounceChip()).toBeTruthy();
    expect(pounceRow().querySelector('.mc-dice-link:not(.mc-dice-link-legendary)')).toBe(null);
  });

  it('gated click spends 1 and rolls delegated Rend +15 named "Pounce (Rend attack)" with both damage legs', async () => {
    renderAncientArmed({ max: 3, used: 0 });
    fireEvent.click(pounceChip());
    await waitFor(() => expect(runtime.store['Ancient Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(15);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d8 + 8');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('2d8');
    expect(options.autoDamageSecondaryDamageType).toBe('Acid');
    expect(options.targetName).toBe('TestPC');
    expect(options.isSpellDamage).toBe(false);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderAncientArmed({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(pounceChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Ancient Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('turn latch: same-boundary second click refuses via the MA-0021 latch (zero extra spend, one roll)', async () => {
    renderAncientArmed({ max: 3, used: 0 });
    fireEvent.click(pounceChip());
    await waitFor(() => expect(runtime.store['Ancient Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(pounceChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Ancient Black Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollAttack.mock.calls.length).toBe(1);
  });
});

const ancientBlue = () => monstersData.find(m => m.index === 'ancient-blue-dragon');
const ANCIENT_BLUE_REND = { name: 'Rend', attack_bonus: 16, damage_dice_primary: '2d8 + 9', damage_type_primary: 'Slashing', damage_dice_secondary: '2d10', damage_type_secondary: 'Lightning', reach: '15 ft.' };

// MA-0172 data lock: Ancient Blue Dragon header authors uses:3 (counter
// renders; 4-in-lair stays advisory — no lair flag consumer, MA-0070
// residual). Component rows stay byte-untouched prose-only — their
// affordances are SEPARATE queued bugs (MA-0173 Cloaked Flight,
// MA-0174 Sonic Boom, MA-0175 Tail Swipe); this lock pins them inert.
describe('MA-0172 monsters.json data: ancient blue dragon legendary header authors uses:3', () => {
  it('header carries numeric uses 3 + lair advisory (no longer name-text only)', () => {
    const la = ancientBlue().legendary_actions;
    expect(la[0].name).toMatch(/Legendary Action Uses: 3 \(4 in Lair\)/);
    expect(la[0].uses).toBe(3);
    expect(la[0].description).toMatch(/In its lair the dragon has 4 uses \(advisory — no lair flag consumer; GM-enforced\)\.$/);
  });

  it('component rows stay prose-only (MA-0173/0174/0175 queued): no affordances authored', () => {
    ['Cloaked Flight', 'Sonic Boom', 'Tail Swipe'].forEach(name => {
      const row = ancientBlue().legendary_actions.find(a => a.name === name);
      expect(row).toBeTruthy();
      expect(row.attack_bonus == null && row.save_dc == null && row.damage_dice_primary == null
        && row.delegates_to == null && row.advisory == null && row.uses == null).toBe(true);
    });
  });

  it('Rend delegate target authors the +16 numeric (control row, byte-untouched)', () => {
    const rend = ancientBlue().actions.find(a => a.name === 'Rend');
    expect(rend.attack_bonus).toBe(16);
    expect(rend.damage_dice_primary).toBe('2d8 + 9');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('2d10');
    expect(rend.damage_type_secondary).toBe('Lightning');
  });
});

// MA-0172: with the header authored, the ancient blue dragon card renders the
// "(3 left)" counter and the prose component rows gain the gated
// Expend-legendary chip (MA-0021 fork). PITFALL pinned as-is (MA-0164
// fingerprint): Tail Swipe burns a use with console.error "no resolvable
// mechanic" — its delegates_to is MA-0175's fix, NOT this row's scope.
describe('MA-0172 MonsterCardModal ancient blue dragon legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderAncientBlue(uses) {
    if (uses !== undefined) runtime.store['Ancient Blue Dragon 1.monsterLegendaryUses'] = uses;
    const creatures = [
      { name: 'Ancient Blue Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 481, maxHp: 481, ac: 22, conditions: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
      { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
    ];
    const m = makeMonster({ name: 'Ancient Blue Dragon', actions: [ANCIENT_BLUE_REND], legendary_actions: ancientBlue().legendary_actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient Blue Dragon 1', creatures })} />);
  }
  function blueRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.includes(name));
  }
  function blueChip(name) {
    return blueRow(name).querySelector('.mc-dice-link-legendary');
  }

  it('header shows (3 left); Tail Swipe renders the gated Expend chip, no numeric affordance', () => {
    renderAncientBlue({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(blueChip('Tail Swipe')).toBeTruthy();
    expect(blueRow('Tail Swipe').querySelector('.mc-dice-link:not(.mc-dice-link-legendary)')).toBe(null);
  });

  it('economy walk: Tail Swipe gated click spends 1 (3→2) + ability_use log — chip-burn pinned as-is, no roll (MA-0174/0175 pending)', async () => {
    renderAncientBlue({ max: 3, used: 0 });
    fireEvent.click(blueChip('Tail Swipe'));
    await waitFor(() => expect(runtime.store['Ancient Blue Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Tail Swipe/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Tail Swipe/);
    // No tail_swipe cooldown stamp — the row's prose lacks the once-per-turn
    // clause (only Cloaked Flight/Sonic Boom carry it; MA-0173/0175 scope).
    expect(runtime.store['Ancient Blue Dragon 1.monsterLegendaryActionCooldowns'] == null).toBe(true);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });

  it('turn latch: same-boundary second Tail Swipe chip click refuses (popup + refusal log), zero extra spend', async () => {
    renderAncientBlue({ max: 3, used: 0 });
    fireEvent.click(blueChip('Tail Swipe'));
    await waitFor(() => expect(runtime.store['Ancient Blue Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    fireEvent.click(blueChip('Tail Swipe'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(runtime.store['Ancient Blue Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderAncientBlue({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(blueChip('Tail Swipe'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Ancient Blue Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });
});
