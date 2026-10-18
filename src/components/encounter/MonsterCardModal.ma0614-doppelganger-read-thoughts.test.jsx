// @maintained-by-ai
// MA-0614 data lock: Doppelganger "Read Thoughts" — spell_save_dc-only row was
// inert (generic save shell MonsterAction ActionSaveRoll arms exclusively on a
// numeric row-level save_dc, MonsterAction.jsx:116; spell_save_dc never reaches
// buildAbilitySaveRollContext — MA-0421/§89/§164 twin fingerprint). Fix: trailing
// row-level save_dc/save_type pair (MA-0576/MA-0611 byte-shape; Detect Thoughts
// save is Intelligence). Dead-mock purge verified empirically: diceRoller, sanitize,
// logService, dataLoader, conditionEffects, damageUtils, rangeValidation, mapsService,
// abilityLookup, rollAttack/rollDamage/setPopupHtml all unexercised on this lane.
import { readFileSync } from 'node:fs';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

const doppelganger = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'))
  .find(m => m.index === 'doppelganger');
const readThoughts = doppelganger.actions.find(a => a.name === 'Read Thoughts');

const MONSTER_NAME = 'Doppelganger 1';
const CREATURES = [
  { name: MONSTER_NAME, type: 'npc', monsterType: 'monstrosity', targetName: 'Bandit 1', ac: 14, currentHp: 52, maxHp: 52, conditions: [] },
  { name: 'Bandit 1', type: 'player', ac: 12, currentHp: 11, maxHp: 11, conditions: [] },
];

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const rollSavingThrow = vi.fn();
  return {
    default: vi.fn(() => ({ popupHtml: null, rollSavingThrow })),
    rollSavingThrow,
  };
});

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

describe('MA-0614 Doppelganger Read Thoughts save-shell', () => {
  it('authored row: additive save_dc 12 + save_type Intelligence beside spell_save_dc-only fingerprint, no damage adjudicated', () => {
    expect(readThoughts.save_dc).toBe(12);
    expect(readThoughts.save_type).toBe('Intelligence');
    expect(readThoughts.spell_save_dc).toBe(12);
    expect(readThoughts.spellcasting_ability).toBe('Charisma');
    expect(readThoughts.damage_dice_primary ?? null).toBeNull();
    expect(readThoughts.save_effect ?? null).toBeNull();
  });

  it('renders one "DC 12 Intelligence" save chip and click arms the save vs the armed target through the ActionSaveRoll seam', () => {
    const m = makeMonster({ name: 'Doppelganger', type: 'monstrosity', actions: [readThoughts] });
    render(<MonsterCardModal {...makeProps(m, { creatureName: MONSTER_NAME, creatures: CREATURES })} />);
    const row = [...document.querySelectorAll('.mc-action')].find(el => el.querySelector('strong')?.textContent.trim().startsWith('Read Thoughts'));
    const chips = [...row.querySelectorAll('.mc-dice-link')];
    expect(chips.length).toBe(1);
    expect(chips[0].textContent.trim()).toBe('DC 12 Intelligence');

    fireEvent.click(chips[0]);
    expect(useLoggedDiceRoll.rollSavingThrow).toHaveBeenCalledTimes(1);
    const ctx = useLoggedDiceRoll.rollSavingThrow.mock.calls[0][2];
    expect(ctx.saveDc).toBe(12);
    expect(ctx.saveType).toBe('Intelligence');
    expect(ctx.attackerName).toBe(MONSTER_NAME);
    expect(ctx.targetName).toBe('Bandit 1');
  });
});
