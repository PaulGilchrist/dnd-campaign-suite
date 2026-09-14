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
  findCreatureByName: vi.fn(() => null),
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
