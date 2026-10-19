// @maintained-by-ai
// MA-1855: Archlich Dread Word (legendary save row) was a stranded save shell —
// save_dc/save_type authored but NO damage_dice_primary and NO save_effect, so
// the prose "takes 22 (5d8) Psychic damage" (no Hit|Failure|Success: anchor, §255)
// let extractDamageDiceFromDescription return null → failed save paid ZERO damage
// and granted ZERO condition. Data fix (MA-1847/MA-0622 byte-shape siblings):
// damage_dice_primary "5d8" + damage_type_primary "Psychic" + save_effect carrying
// the canonical "Frightened" word (§346 save-lane word-scan). dc_success stays
// ABSENT — engine default 'half' (§335) is RAW ("half as much damage on a
// successful save").
// Lane cites (not re-asserted here): exhausted refusal legendary-uses.test.jsx
// :195-210, same-boundary latch :309-326, per-action cooldown :404+ (shared
// uses:3 header gate owns the economy — Dread Word authors NO own uses);
// multi-spend ma1883; non-legendary cantrip press ma1853; computeDamageAfterSave
// full/half math applyDamage.save-full.test.js ('half' row fail=full/success=half);
// Frightened landing on the target: saveProcessing lane.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal, { saveChipPlan } from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';

const archlich = () => monstersData.find((m) => m.name === 'Archlich');
const dreadRow = () => archlich().legendary_actions.find((a) => a.name === 'Dread Word');

// diceRoller + storage mocks purged (bisect): rollExpression/rollExpressionDoubled
// fire only on handleDamage legs (MonsterCardModal.jsx:2431) — this save lane rolls
// through the mocked rollSavingThrow; the real canRollExpression stays live for chip
// gating inside saveChipPlan/ActionSaveRoll.
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollAttack: null, rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const rollAttack = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack, rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })) };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'AasimarTest', creatures: [] } }));
const armed = vi.hoisted(() => ({ target: null }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => armed.target),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(({ creatures }, name) => (creatures || []).find(c => c.name === name) || null),
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

const CREATURES = [
  { name: 'Archlich 1', type: 'npc', targetName: 'Bandit 1', currentHp: 475, maxHp: 475, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [], resistances: [] },
];

function renderArchlich(uses) {
  runtime.store['Archlich 1.monsterLegendaryUses'] = uses;
  runtime.store['Archlich 1._legendaryUses_usedRound'] = null;
  ctx.value = { round: 2, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  const m = makeMonster({ name: 'Archlich', legendary_actions: archlich().legendary_actions });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Archlich 1', creatures: CREATURES })} />);
}

function dreadWordRow() {
  const row = [...document.querySelectorAll('.mc-action')].find((r) => r.querySelector('strong')?.textContent.trim().startsWith('Dread Word'));
  expect(row).toBeDefined();
  return row;
}

describe('MA-1855 monsters.json data lock: Archlich Dread Word row', () => {
  it('FULL row bytes BY NAME: 5d8 Psychic + canonical Frightened save_effect, dc_success ABSENT (engine default half, §335) — economy rides the uses:3 header, row authors NO own uses', () => {
    expect(dreadRow()).toEqual({
      name: 'Dread Word',
      save_type: 'Wisdom',
      save_dc: 22,
      conditions: ['frightened'],
      description: 'Wisdom Saving Throw: DC 22, each creature within 30 ft. A creature that can hear the word has the Frightened condition until the end of its next turn and takes 22 (5d8) Psychic damage. No damage other than Psychic. The target has the Frightened condition on a failed save.',
      damage_dice_primary: '5d8',
      damage_type_primary: 'Psychic',
      save_effect: 'The target has the Frightened condition until the end of its next turn.',
    });
    expect(archlich().legendary_actions[0].uses).toBe(3);
    // MV-31 transport proof: the REAL save-lane extractor word-scans the disk
    // bytes to exactly one canonical condition — no spray of other words.
    expect(extractConditionsFromSaveEffect(dreadRow().save_effect)).toEqual(['frightened']);
  });

  it('saveChipPlan exact shape rides the authored 5d8 pool — §255 discriminator: stripped of damage_dice_primary the unanchored prose yields formula null (the stranded-shell defect)', () => {
    expect(saveChipPlan(dreadRow(), false)).toEqual({ riderOnly: false, formula: '5d8', rollable: true, clickable: true });
    const shell = { ...dreadRow() };
    delete shell.damage_dice_primary;
    expect(saveChipPlan(shell, false)).toEqual({ riderOnly: false, formula: null, rollable: false, clickable: true });
  });
});

describe('MA-1855 MonsterCardModal Dread Word save lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach((k) => delete runtime.store[k]);
    armed.target = CREATURES[1];
  });

  it('renders its own 5d8 + DC 22 Wisdom chips; press spends ONE use and arms the SAVE transport: WIS/22, 5d8 Psychic, half, frightened — never the attack lane', async () => {
    renderArchlich({ max: 3, used: 0 });
    const row = dreadWordRow();
    expect([...row.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim())).toEqual(['5d8', 'DC 22 Wisdom']);
    fireEvent.click(row.querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store['Archlich 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const [label, , context] = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(label).toBe('WIS');
    expect(context.saveDc).toBe(22);
    expect(context.saveType).toBe('Wisdom');
    expect(context.targetName).toBe('Bandit 1');
    expect(context.autoDamageFormula).toBe('5d8');
    expect(context.autoDamageDamageType).toBe('Psychic');
    expect(context.dcSuccess).toBe('half');
    expect(context.saveConditions).toEqual(['frightened']);
    const spend = addEntry.mock.calls.map((c) => c[1]).find((e) => e.type === 'ability_use');
    expect(spend.abilityName).toBe('Dread Word');
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});
