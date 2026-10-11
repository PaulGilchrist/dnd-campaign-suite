// MA-1847: Apep "Devour the Boat (Costs 2 Actions)" legendary child shipped
// as a save-prose row delegating to Constrict — the press adjudicated the
// delegated ATTACK pool (+18 vs AC, 4d8+9 Bludgeoning) with DC 26 never
// enforced, grapple prerequisite ungated, and the no-heal clause inert.
// DATA fix (this file's lock): the row stops delegating and authors its own
// save mechanic — save_dc/save_type/damage_dice_primary/damage_type_primary/
// dc_success + target_prerequisite:{conditions:["grappled"]} (Mind Flayer
// Tentacle Bite grappled-save byte-shape, no by_attacker/any_ally flags —
// RAW targets the grappled creature itself) + save_target_effect:"no_healing"
// (MA-1847 sanctioned save-lane rider, MA-0016 hit-lane twin). The row
// renders its own "DC 26 Constitution" save chip riding the shared legendary
// gate (MA-0567/0676 twins); handleSaveRoll runs evaluateTargetPrerequisiteGate
// (MA-0019) and resolveLegendaryRow now refuses BEFORE the spend (MA-0023
// pre-spend refusal model). "Costs 2 Actions" stays name-text advisory —
// engine spends 1 per press (codified MA-1839 residual).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const runtimeStore = {};
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
  setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));
vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

import { MonsterAction } from './MonsterAction.jsx';
import { parseSaveTargetEffect, parseTargetPrerequisite, evaluateTargetPrerequisiteGate } from './MonsterCardHelpers.js';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const APEP = monsters.find((m) => m.index === 'apep');
const LEGENDARY = APEP.legendary_actions;
const BOAT = LEGENDARY[3];
const DARKNESS = APEP.actions.find((a) => a.name === 'Venomous Darkness (Recharge 5-6)');

describe('MA-1847 disk fingerprint: Apep Devour the Boat self-resolving save row', () => {
  it('authors the full RAW save mechanic — DC 26 CON, 6d10 Piercing, half on success', () => {
    expect(BOAT.name).toBe('Devour the Boat (Costs 2 Actions)');
    expect(BOAT.save_dc).toBe(26);
    expect(BOAT.save_type).toBe('Constitution');
    expect(BOAT.damage_dice_primary).toBe('6d10');
    expect(BOAT.damage_type_primary).toBe('Piercing');
    expect(BOAT.dc_success).toBe('half');
    expect(canRollExpression(BOAT.damage_dice_primary)).toBe(true);
  });

  it('delegates_to is REMOVED — the row is its own resolver (§225 hijack dead)', () => {
    expect(BOAT.delegates_to).toBeUndefined();
    expect(BOAT.attack_bonus).toBeUndefined();
    expect(BOAT.reach).toBeUndefined();
  });

  it('name/description byte-unchanged; structured keys after description, rider last (MA-1547 placement)', () => {
    expect(BOAT.description).toBe(
      "Apep's coils lunge for one Grappled creature. The target must succeed on a DC 26 Constitution saving throw or take 33 (6d10) Piercing damage and be unable to regain Hit Points until the start of Apep's next turn."
    );
    const keys = Object.keys(BOAT);
    expect(keys).toEqual([
      'name',
      'description',
      'save_dc',
      'save_type',
      'damage_dice_primary',
      'damage_type_primary',
      'dc_success',
      'target_prerequisite',
      'save_target_effect',
    ]);
  });

  it('target_prerequisite:grappled-armed-target shape (Mind Flayer Tentacle Bite twin — no by_attacker/any_ally)', () => {
    expect(BOAT.target_prerequisite).toEqual({ conditions: ['grappled'] });
    expect(parseTargetPrerequisite(BOAT)).toEqual({ conditions: ['grappled'], byAttacker: false, attackName: 'Devour the Boat (Costs 2 Actions)' });
    expect(BOAT.target_prerequisite.any_ally_of_attacker).toBeUndefined();
  });

  it('save_target_effect:"no_healing" arms the sanctioned save-lane rider; clauseless siblings stay byte-inert', () => {
    expect(BOAT.save_target_effect).toBe('no_healing');
    expect(parseSaveTargetEffect(BOAT)).toEqual({ effect: 'no_healing' });
    expect(DARKNESS.save_target_effect).toBeUndefined();
    expect(parseSaveTargetEffect(DARKNESS)).toBeNull();
    expect(parseSaveTargetEffect({})).toBeNull();
    expect(parseSaveTargetEffect(undefined)).toBeNull();
    expect(parseSaveTargetEffect({ save_target_effect: '  ' })).toBeNull();
  });
});

describe('MA-1847 MA-0019 gate on the Devour save row', () => {
  const fakeRV = (store) => (name, key) => store[`${name}.${key}`] ?? [];

  it('un-grappled armed target: refused — popup + devour_the_boat_costs_2_actions_refused log', () => {
    const gate = evaluateTargetPrerequisiteGate({
      action: BOAT,
      target: { name: 'ElderPaladin', type: 'player' },
      monsterName: 'Apep 1',
      campaignName: 'test-campaign',
      getRuntimeValue: fakeRV({ 'ElderPaladin.activeConditions': [], 'ElderPaladin.activeConditionMeta': {} }),
    });
    expect(gate.satisfied).toBe(false);
    expect(gate.popupHtml).toContain('Prerequisite Not Met');
    expect(gate.popupHtml).toContain('Grappled');
    expect(gate.refusalLog.automationType).toBe('devour_the_boat_costs_2_actions_refused');
    expect(gate.refusalLog.description).toMatch(/does not satisfy the prerequisite/i);
  });

  it('grappled armed target: passes (no by_attacker — any grapple satisfies RAW)', () => {
    const gate = evaluateTargetPrerequisiteGate({
      action: BOAT,
      target: { name: 'ElderPaladin', type: 'player' },
      monsterName: 'Apep 1',
      campaignName: 'test-campaign',
      getRuntimeValue: fakeRV({ 'ElderPaladin.activeConditions': ['grappled'], 'ElderPaladin.activeConditionMeta': { grappled: { source: 'Constrictor 1', dc: 26 } } }),
    });
    expect(gate.satisfied).toBe(true);
  });
});

describe('MA-1847 save transport: block-save context arms the no-heal rider', () => {
  function ctxFor(action) {
    return buildAbilitySaveRollContext({
      monsterName: 'Apep 1',
      target: { name: 'ElderPaladin', type: 'player' },
      spellName: null,
      action,
      saveType: 'Constitution',
      dcSuccess: action.dc_success ?? 'half',
      saveDamageFormula: '6d10',
      saveConditions: [],
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction: () => (action.damage_type_primary ? [action.damage_type_primary] : []),
    });
  }

  it('Devour context: DC 26, 6d10 Piercing, half-on-success, saveTargetEffect armed', () => {
    const ctx = ctxFor(BOAT);
    expect(ctx.saveDc).toBe(26);
    expect(ctx.dcSuccess).toBe('half');
    expect(ctx.autoDamageFormula).toBe('6d10');
    expect(ctx.autoDamageDamageType).toBe('Piercing');
    expect(ctx.saveTargetEffect).toEqual({ effect: 'no_healing' });
  });

  it('clauseless sibling context: saveTargetEffect null — legacy rows byte-inert', () => {
    const darkness = { ...DARKNESS, damage_dice_primary: '14d10' };
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Apep 1',
      target: { name: 'ElderPaladin', type: 'player' },
      spellName: null,
      action: darkness,
      saveType: 'Constitution',
      dcSuccess: 'half',
      saveDamageFormula: '14d10',
      saveConditions: [],
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction: () => ['Necrotic'],
    });
    expect(ctx.saveTargetEffect).toBeNull();
  });
});

describe('MA-1847 render: numeric legendary save child rides the gated press', () => {
  it('renders "6d10" + "DC 26 Constitution" chips, no Expend chip (MA-1842/MA-1071 self-suppress), DC chip presses the save seam', () => {
    const onSaveRoll = vi.fn();
    const legendaryGate = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BOAT}
        index={0}
        attackerCannotAct={false}
        onAttack={vi.fn()}
        onDamage={vi.fn()}
        onSaveRoll={onSaveRoll}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
        legendaryGate={legendaryGate}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['6d10', 'DC 26 Constitution']);
    expect(container.querySelector('.mc-dice-link-legendary')).toBeNull();
    const saveChip = container.querySelector('.mc-dice-link-save-clickable');
    fireEvent.click(saveChip);
    expect(onSaveRoll).toHaveBeenCalledWith(BOAT, '6d10', []);
  });
});
