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
