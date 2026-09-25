// MA-0024 regression: structured aboleth lair rows render clickable
// affordances via the same gated pipeline as legendary rows — a save row
// opens the save prompt at the authored DC/type (Grasping Tide DC 14 STR,
// Conduit for Rage DC 14 WIS 2d6 half-on-success untouched math), the
// phantasmal-force row logs a CLA-325 advisory ability_use, and legacy
// plain-string lair rows (every other string-row monster) still render
// statically with zero affordance.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const LAIR = [
  {
    name: 'Phantasmal Force',
    advisory: 'phantasmal_force',
    save_dc: 16,
    save_type: 'Intelligence',
    description: 'The aboleth casts phantasmal force (no components required) on any number of creatures it can see within 60 feet of it.',
  },
  {
    name: 'Grasping Tide',
    save_dc: 14,
    save_type: 'Strength',
    save_effect: 'Failure: The target is pulled up to 20 feet into the water and knocked prone. Success: unaffected.',
    description: 'Pools of water within 90 feet of the aboleth surge outward in a grasping tide.',
  },
  {
    name: 'Conduit for Rage',
    save_dc: 14,
    save_type: 'Wisdom',
    damage_dice_primary: '2d6',
    damage_type_primary: 'Psychic',
    save_effect: 'Failure: 7 (2d6) Psychic damage. Success: Half damage.',
    description: 'Water in the aboleth\'s lair magically becomes a conduit for the creature\'s rage.',
  },
];

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollSavingThrow = vi.fn();
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => ({ name: 'TestPC', type: 'player' })),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
  getCombatContext: vi.fn(() => Promise.resolve({ round: 1, activeCreatureName: 'Thug 1', creatures: [] })),
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

const CREATURES = [
  { name: 'Aboleth 1', type: 'npc', targetName: 'TestPC', currentHp: 185, maxHp: 185, ac: 17, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [] },
];

function lairLinks() {
  return Array.from(document.querySelectorAll('.mc-dice-link-lair'));
}

function lairLinkWithName(name) {
  return lairLinks().find(el => el.textContent.includes(name)) || null;
}

describe('MA-0024 monsters.json data: aboleth lair_actions are structured', () => {
  it('rows carry name + authored DCs, descriptions verbatim (index-aligned stableKey)', () => {
    const aboleth = monstersData.find(m => m.name === 'Aboleth');
    const [pf, tide, rage] = aboleth.lair_actions;
    expect(pf.name).toBe('Phantasmal Force');
    expect(pf.advisory).toBe('phantasmal_force');
    expect(pf.save_dc).toBe(16);
    expect(pf.save_type).toBe('Intelligence');
    expect(tide.name).toBe('Grasping Tide');
    expect(tide.save_dc).toBe(14);
    expect(tide.save_type).toBe('Strength');
    expect(tide.save_effect).toMatch(/prone/i);
    expect(rage.save_dc).toBe(14);
    expect(rage.save_type).toBe('Wisdom');
    expect(rage.damage_dice_primary).toBe('2d6');
    expect(aboleth.legendary_actions[0].uses).toBe(3);
  });
});

describe('MA-0024 MonsterCardModal lair rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  });

  it('all three structured rows render clickable affordances', () => {
    const m = makeMonster({ name: 'Aboleth', lair_actions: LAIR });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
    const links = lairLinks();
    expect(links).toHaveLength(3);
    expect(links.some(el => el.textContent.includes('DC 14 Strength'))).toBe(true);
    expect(links.some(el => el.textContent.includes('DC 14 Wisdom'))).toBe(true);
    expect(links.some(el => el.textContent.includes('Phantasmal Force'))).toBe(true);
    expect(links.every(el => /initiative 20/.test(el.getAttribute('title') || ''))).toBe(true);
  });

  it('save row click → save prompt at authored DC/type via the existing seam', async () => {
    const m = makeMonster({ name: 'Aboleth', lair_actions: LAIR });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
    fireEvent.click(lairLinkWithName('DC 14 Strength'));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const call = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(call[0]).toBe('STR');
    expect(call[2]).toMatchObject({ saveDc: 14, saveType: 'Strength', attackerName: 'Aboleth 1', targetName: 'TestPC' });
    expect(call[2].saveConditions).toEqual(['prone']);
    expect(call[2].autoDamageFormula).toBeNull();
  });

  it('damage-bearing save row keeps half-on-success dcSuccess convention', async () => {
    const m = makeMonster({ name: 'Aboleth', lair_actions: LAIR });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
    fireEvent.click(lairLinkWithName('DC 14 Wisdom'));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const call = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(call[2]).toMatchObject({ saveDc: 14, saveType: 'Wisdom', dcSuccess: 'half', autoDamageFormula: '2d6' });
  });

  it('phantasmal-force row logs advisory ability_use, opens no save prompt', async () => {
    const m = makeMonster({ name: 'Aboleth', lair_actions: LAIR });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
    fireEvent.click(lairLinkWithName('Phantasmal Force'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entry = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(entry).toBeTruthy();
    expect(entry.description).toContain('phantasmal force');
    expect(entry.description).toMatch(/GM-enforced/);
    expect(entry.description).toMatch(/initiative 20/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('legacy plain-string lair rows render statically with zero affordance (other monsters)', () => {
    const m = makeMonster({ name: 'Lich', lair_actions: ['The lich animates a long-dead sprite.', 'Plants grow rapidly in a 30-foot radius.'] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Lich 1', creatures: CREATURES })} />);
    expect(lairLinks()).toHaveLength(0);
    const staticRows = Array.from(document.querySelectorAll('.mc-section .mc-action')).filter(el => el.textContent.includes('animates a long-dead sprite'));
    expect(staticRows).toHaveLength(1);
    expect(staticRows[0].querySelectorAll('span[role="button"]')).toHaveLength(0);
  });

  it('MA-0041 adult black dragon water surge: real data row renders + opens STR DC 15 prompt, zero damage', async () => {
    const dragon = monstersData.find(m => m.index === 'adult-black-dragon');
    const m = makeMonster({ name: 'Adult Black Dragon', lair_actions: dragon.lair_actions });
    const creatures = [{ name: 'Adult Black Dragon 1', type: 'npc', targetName: 'TestPC', currentHp: 195, maxHp: 195, ac: 19, conditions: [] }, ...CREATURES];
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Adult Black Dragon 1', creatures })} />);
    const chip = lairLinkWithName('DC 15 Strength');
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const call = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(call[0]).toBe('STR');
    expect(call[2]).toMatchObject({ saveDc: 15, saveType: 'Strength', attackerName: 'Adult Black Dragon 1', targetName: 'TestPC' });
    expect(call[2].saveConditions).toEqual(['prone']);
    expect(call[2].autoDamageFormula).toBeNull();
  });

  it('nameless dict rows (MV-24 shape) stay static too', () => {
    const m = makeMonster({ name: 'Some Serpent', lair_actions: [{ description: 'Pools of water surge outward.', save_dc: 15, save_type: 'Constitution' }] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Dragon 1', creatures: CREATURES })} />);
    expect(lairLinks()).toHaveLength(0);
  });

  it('named row without any authored mechanic stays static (clickable === resolvable)', () => {
    const m = makeMonster({ name: 'Aboleth', lair_actions: [{ name: 'Broken Row', description: 'prose only' }] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Aboleth 1', creatures: CREATURES })} />);
    expect(lairLinks()).toHaveLength(0);
    const row = Array.from(document.querySelectorAll('.mc-section .mc-action')).find(el => el.textContent.includes('Broken Row'));
    expect(row).toBeTruthy();
    expect(row.querySelector('span[role="button"]')).toBeNull();
  });
});

// MA-1207: mummy-lord lair_actions[0] named advisory row arms the
// mc-dice-link-lair chip (press = record-only advisory ability_use, zero
// save prompt); sibling nameless dicts stay inert static prose — and the
// static branch no longer emits the orphan leading "." from
// <strong>{la.name}.</strong> when !la.name. (Chip count widened 1→2 when
// MA-1208 armed lair_actions[1].)
describe('MA-1207 mummy-lord lair advisory chip + nameless-dot guard', () => {
  const mummyLord = monstersData.find(m => m.index === 'mummy-lord');

  it('named advisory row renders a chip; remaining nameless rows stay chip-less (MA-1208 widened 1→2)', () => {
    const m = makeMonster({ name: 'Mummy Lord', lair_actions: mummyLord.lair_actions });
    const creatures = [{ name: 'Mummy Lord 1', type: 'npc', targetName: 'TestPC', currentHp: 187, maxHp: 187, ac: 17, conditions: [] }, ...CREATURES];
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Mummy Lord 1', creatures })} />);
    const links = lairLinks();
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toContain('Pinpoint Living Creatures');
    expect(links[0].getAttribute('role')).toBe('button');
    expect(links[0].getAttribute('title')).toMatch(/initiative 20/);
  });

  it('chip press logs advisory record with initiative-20 GM-enforced note, opens no save prompt', async () => {
    const m = makeMonster({ name: 'Mummy Lord', lair_actions: mummyLord.lair_actions });
    const creatures = [{ name: 'Mummy Lord 1', type: 'npc', targetName: 'TestPC', currentHp: 187, maxHp: 187, ac: 17, conditions: [] }, ...CREATURES];
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Mummy Lord 1', creatures })} />);
    fireEvent.click(lairLinkWithName('Pinpoint Living Creatures'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entry = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(entry).toBeTruthy();
    expect(entry.abilityName).toBe('Pinpoint Living Creatures');
    expect(entry.description).toMatch(/grants each undead creature in the lair/i);
    expect(entry.description).toMatch(/initiative 20 \(GM-enforced/i);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('nameless dict rows render prose WITHOUT the orphan leading "." (render guard)', () => {
    const m = makeMonster({ name: 'Nameless Test', lair_actions: [{ description: 'Pools of water surge outward.' }] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Nameless Test 1', creatures: CREATURES })} />);
    expect(lairLinks()).toHaveLength(0);
    const row = Array.from(document.querySelectorAll('.mc-section .mc-action')).find(el => el.textContent.includes('Pools of water surge outward.'));
    expect(row).toBeTruthy();
    expect(row.querySelector('strong')).toBeNull();
    expect(row.textContent.trim().startsWith('.')).toBe(false);
  });

  it('named inert row still renders its bold name + period (guard is name-gated)', () => {
    const m = makeMonster({ name: 'Nameless Test', lair_actions: [{ name: 'Keeping Row', description: 'prose only' }] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Nameless Test 1', creatures: CREATURES })} />);
    const row = Array.from(document.querySelectorAll('.mc-section .mc-action')).find(el => el.textContent.includes('Keeping Row'));
    expect(row.querySelector('strong')).toBeTruthy();
    expect(row.querySelector('strong').textContent).toBe('Keeping Row.');
  });
});

// MA-1208: mummy-lord lair_actions[1] twin nameless raw dict fixed to a
// named advisory row → card now shows TWO mc-dice-link-lair chips; press
// of the warding chip = record-only advisory ability_use with the honest
// GM-enforced note, zero save prompt; [2] stays inert static prose.
describe('MA-1208 mummy-lord turn-undead warding chip render lock', () => {
  const mummyLord = monstersData.find(m => m.index === 'mummy-lord');

  it('two advisory rows arm two mc-dice-link-lair chips; [2] save dict stays inert', () => {
    const m = makeMonster({ name: 'Mummy Lord', lair_actions: mummyLord.lair_actions });
    const creatures = [{ name: 'Mummy Lord 1', type: 'npc', targetName: 'TestPC', currentHp: 187, maxHp: 187, ac: 17, conditions: [] }, ...CREATURES];
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Mummy Lord 1', creatures })} />);
    const links = lairLinks();
    expect(links).toHaveLength(2);
    const ward = lairLinkWithName('Turn Undead Warding');
    expect(ward.getAttribute('role')).toBe('button');
    expect(ward.getAttribute('title')).toMatch(/initiative 20/);
    const row2 = Array.from(document.querySelectorAll('.mc-section .mc-action')).find(el => el.textContent.includes('wracked with pain'));
    expect(row2).toBeTruthy();
    expect(row2.querySelector('.mc-dice-link-lair')).toBeNull();
    expect(row2.querySelector('[role="button"]')).toBeNull();
  });

  it('warding chip press logs ONE advisory ability_use with honest note, opens no save prompt', async () => {
    const m = makeMonster({ name: 'Mummy Lord', lair_actions: mummyLord.lair_actions });
    const creatures = [{ name: 'Mummy Lord 1', type: 'npc', targetName: 'TestPC', currentHp: 187, maxHp: 187, ac: 17, conditions: [] }, ...CREATURES];
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Mummy Lord 1', creatures })} />);
    addEntry.mockClear();
    fireEvent.click(lairLinkWithName('Turn Undead Warding'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    const entries = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'ability_use');
    expect(entries).toHaveLength(1);
    expect(entries[0].abilityName).toBe('Turn Undead Warding');
    expect(entries[0].description).toMatch(/grants each undead in the lair advantage on saving throws against effects that turn undead/i);
    expect(entries[0].description).toMatch(/initiative 20 \(GM-enforced/i);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
