// MA-0405 regression: Blob of Annihilation legendary header was display-only
// prose ("Legendary Action Uses: 3" with NO `uses` field) —
// legendaryHeaderAction() returned null, the card rendered the UNGATED branch
// (no counter, no gate), and the Decay "4d6" chip fired raw ungated damage
// with zero spend and zero refusal log (worse than dead children). Fix mirrors
// the MA-0375 (beholder twin, c1217b2b8) / MA-0227 DATA-only shape, header +
// children SAME pass (playbook §5 silent-burn rule): header uses:3; Decay
// already authors numeric damage_dice_primary "4d6" Necrotic (auto-damage to
// engulfed creatures — no to-hit/save in prose, damage chip gated by the
// section's legendaryGate wrapper); Grasping Glob gets delegates_to:
// "Restraining Glob" (MA-0022/0238 delegate seam → live DC 23 DEX /
// 3d6 + 8 Acid save row); Lashing Goo gets delegates_to:"Pseudopod"
// (+15 / 3d10 + 8 Force). No advisory rows needed — every child resolves a
// real mechanic, so no console.error "no resolvable mechanic" burn.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction, legendaryMaxUses, legendaryUsesRemaining,
  legendaryDelegateAction, legendaryDelegateAttackName, hasLegendaryCooldownClause,
  expendLegendaryUse, regainLegendaryUses,
} from '../../services/encounters/monsterLegendaryUses.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: () => <div className="sp-overlay sphere-picker-stub" />,
}));

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
  { name: 'Blob of Annihilation 1', type: 'npc', monsterType: 'ooze', targetName: 'TestPC', currentHp: 448, maxHp: 448, ac: 18, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Blob of Annihilation 1.monsterLegendaryUses';
const LATCH_KEY = 'Blob of Annihilation 1._legendaryUses_usedRound';
const COOLDOWNS_KEY = 'Blob of Annihilation 1.monsterLegendaryActionCooldowns';

const blob = () => monstersData.find(m => m.index === 'blob-of-annihilation');
const legendary = () => blob().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const actionRow = (name) => blob().actions.find(a => a.name === name);

// MA-0405 data lock: header authors numeric uses:3 (MA-0277 no-lair shape —
// Blob has no lair_actions, nothing else to carve). legendaryHeaderAction()
// was null before this field existed (rows[0].uses != null gate).
describe('MA-0405 monsters.json data: blob legendary header authors uses:3', () => {
  it('header row has uses:3 and resolves through legendaryHeaderAction', () => {
    expect(row('Legendary Action Uses: 3').uses).toBe(3);
    expect(legendaryHeaderAction(blob())).toBe(legendary()[0]);
    expect(legendaryMaxUses(legendary()[0], null)).toBe(3);
    expect(legendaryUsesRemaining(legendary()[0], { max: 3, used: 1 })).toBe(2);
    expect(legendary()[0].name).toBe('Legendary Action Uses: 3');
  });

  it('every prose child resolves a mechanic — no silent-burn chip (playbook §5)', () => {
    for (const a of legendary().slice(1)) {
      const formula = a.damage_dice_primary != null && canRollExpression(a.damage_dice_primary);
      const resolvable = a.attack_bonus != null || a.save_dc != null
        || !!legendaryDelegateAction(blob(), a) || !!a.advisory || !!formula;
      expect(resolvable, `legendary row "${a.name}" has no resolvable mechanic`).toBe(true);
    }
  });

  it('descriptions byte-unchanged from the shipped prose', () => {
    expect(legendary()[0].description).toBe("Immediately after another creature's turn, the blob can expend a use to take one of the following actions. The blob regains all expended uses at the start of each of its turns.");
    expect(row('Decay').description).toBe('The blob deals 14 (4d6) Necrotic damage to each creature engulfed by it. The blob can\'t take this action again until the start of its next turn.');
    expect(row('Grasping Glob').description).toBe('The blob uses Restraining Glob. The blob can\'t take this action again until the start of its next turn.');
    expect(row('Lashing Goo').description).toBe('The blob makes one Pseudopod attack.');
  });
});

// MA-0405 Decay adjudication: prose is auto-damage to engulfed creatures —
// no to-hit, no save — so the authored numeric damage_dice_primary "4d6"
// stays its honest mechanic. Inside the gated legendary section the section
// wrapper routes every chip click (dmg) through legendaryGate, so the chip
// spends 1 BEFORE the roll fires (MA-0406 ungated repeat-fire dies here).
describe('MA-0405 monsters.json data: Decay numeric auto-damage row', () => {
  it('Decay authors 4d6 Necrotic, no attack_bonus/save_dc', () => {
    const decay = row('Decay');
    expect(decay.damage_dice_primary).toBe('4d6');
    expect(decay.damage_type_primary).toBe('Necrotic');
    expect(decay.attack_bonus).toBeUndefined();
    expect(decay.save_dc).toBeUndefined();
    expect(decay.delegates_to).toBeUndefined();
    expect(hasLegendaryCooldownClause(decay)).toBe(true);
  });
});

// MA-0405/0407/0408 same-pass adjudication: prose alias rows forward to the
// blob's OWN live numeric rows via the MA-0022 delegate seam (byte-shape of
// MA-0238 Pounce→Rend / MA-0375 Chomp→Bite: delegates_to between name and
// description).
describe('MA-0405 monsters.json data: Grasping Glob and Lashing Goo delegate to live rows', () => {
  it('Grasping Glob delegates_to Restraining Glob (DC 23 DEX / 3d6 + 8 Acid)', () => {
    const glob = row('Grasping Glob');
    expect(glob.delegates_to).toBe('Restraining Glob');
    expect(glob.attack_bonus).toBeUndefined();
    expect(glob.save_dc).toBeUndefined();
    const rg = actionRow('Restraining Glob');
    expect(rg.save_dc).toBe(23);
    expect(rg.save_type).toBe('Dexterity');
    expect(rg.damage_dice_primary).toBe('3d6 + 8');
    expect(rg.damage_type_primary).toBe('Acid');
    const delegate = legendaryDelegateAction(blob(), glob);
    expect(delegate).toBe(rg);
    expect(legendaryDelegateAttackName(glob, rg)).toBe('Grasping Glob (Restraining Glob save)');
    expect(hasLegendaryCooldownClause(glob)).toBe(true);
  });

  it('Lashing Goo delegates_to Pseudopod (+15 / 3d10 + 8 Force), no own cooldown clause', () => {
    const goo = row('Lashing Goo');
    expect(goo.delegates_to).toBe('Pseudopod');
    const ps = actionRow('Pseudopod');
    expect(ps.attack_bonus).toBe(15);
    expect(ps.damage_dice_primary).toBe('3d10 + 8');
    expect(ps.damage_type_primary).toBe('Force');
    const delegate = legendaryDelegateAction(blob(), goo);
    expect(delegate).toBe(ps);
    expect(legendaryDelegateAttackName(goo, ps)).toBe('Lashing Goo (Pseudopod attack)');
    expect(hasLegendaryCooldownClause(goo)).toBe(false);
  });
});

// Live seam: counter mounts, gated spend/refusal/regain economy runs.
describe('MA-0405 MonsterCardModal blob gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderBlob(uses) {
    if (uses !== undefined) runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Blob of Annihilation',
      actions: blob().actions,
      legendary_actions: blob().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Blob of Annihilation 1', creatures: CREATURES })} />);
  }
  function blobRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('header shows (3 left); Decay renders gated 4d6 chip; alias rows render Expend Legendary chips', () => {
    renderBlob({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(blobRow('Decay').querySelector('.mc-dice-link').textContent).toContain('4d6');
    const globChip = blobRow('Grasping Glob').querySelector('.mc-dice-link-legendary');
    expect(globChip).not.toBe(null);
    expect(globChip.textContent).toContain('Expend Legendary');
    expect(blobRow('Lashing Goo').querySelector('.mc-dice-link-legendary')).not.toBe(null);
  });

  it('Decay gated click spends 1 (3→2) BEFORE rolling 4d6 — no ungated fire, cooldown stamped', async () => {
    renderBlob();
    expect(runtime.store[KEY]).toBeUndefined();
    fireEvent.click(blobRow('Decay').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(runtime.store[LATCH_KEY]).toEqual({ round: 1, activeCreature: 'Thug 1' }));
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ decay: { round: 1 } }));
    await waitFor(() => expect(ROLLERS.rollDamage).toHaveBeenCalled());
    expect(ROLLERS.rollDamage.mock.calls[0][0].name).toBe('Decay');
    expect(ROLLERS.rollDamage.mock.calls[0][0].formula).toBe('4d6');
    expect(ROLLERS.rollDamage.mock.calls[0][0].context.damageType).toBe('Necrotic');
    expect(ROLLERS.rollDamage.mock.calls[0][0].context.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Decay/.test(e.description));
    expect(spend.description).toMatch(/Blob of Annihilation 1 expends a legendary use for Decay/);
    expect(spend.description).toMatch(/2 of 3 left/);
  });

  it('Decay repeat same-window refuses (turn latch): zero extra spend, legendary_use_refused log', async () => {
    renderBlob();
    const chip = blobRow('Decay').querySelector('.mc-dice-link');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollDamage).toHaveBeenCalledTimes(1);
  });

  it('Decay next-boundary click refuses (once-per-turn cooldown): zero spend, zero roll', async () => {
    renderBlob();
    fireEvent.click(blobRow('Decay').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    ctx.value = { round: 1, activeCreatureName: 'TestPC', creatures: CREATURES };
    fireEvent.click(blobRow('Decay').querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('can\'t take Decay again until the start of its next turn');
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollDamage).toHaveBeenCalledTimes(1);
  });

  it('Grasping Glob gated click spends 1 and rolls the delegated DC 23 DEX save-leg (3d6 + 8 Acid, Restrained)', async () => {
    renderBlob();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(blobRow('Grasping Glob').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('DEX');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(23);
    expect(context.saveType).toBe('Dexterity');
    expect(context.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Grasping Glob/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Grasping Glob \(Restraining Glob save\)/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('Lashing Goo gated click spends 1 and rolls the delegated +15 Pseudopod attack (3d10 + 8 Force)', async () => {
    renderBlob();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(blobRow('Lashing Goo').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Lashing Goo (Pseudopod attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(15);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('3d10 + 8');
    expect(options.damageType).toBe('Force');
    expect(options.targetName).toBe('TestPC');
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('exhausted (3/3): chip clicks refuse with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderBlob({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(blobRow('Lashing Goo').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('no legendary uses left');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('own-turn click refuses (turn gate): zero spend, zero roll', async () => {
    renderBlob();
    ctx.value = { round: 1, activeCreatureName: 'Blob of Annihilation 1', creatures: CREATURES };
    fireEvent.click(blobRow('Decay').querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('not its own');
    expect(runtime.store[KEY]).toBeUndefined();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });
});

// Turn-start regain + spend/refusal vocabulary unit lock (the same seam the
// initiative monster turn-start path calls).
describe('MA-0405 monsterLegendaryUses unit: blob gate, spend, refusal, regain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  it('first Lashing Goo expend creates the monsterLegendaryUses key (3→2) with spend log', async () => {
    const result = await expendLegendaryUse({ monsterName: 'Blob of Annihilation 1', monster: blob(), actionName: 'Lashing Goo (Pseudopod attack)', campaignName: 'test-campaign' });
    expect(result.spent).toBe(true);
    expect(result.remaining).toBe(2);
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/expends a legendary use for Lashing Goo \(Pseudopod attack\)/);
  });

  it('exhausted expend refuses with legendary_use_refused, zero spend', async () => {
    runtime.store[KEY] = { max: 3, used: 3 };
    const result = await expendLegendaryUse({ monsterName: 'Blob of Annihilation 1', monster: blob(), actionName: 'Decay', campaignName: 'test-campaign' });
    expect(result.spent).toBe(false);
    expect(result.reason).toBe('exhausted');
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'legendary_use_refused');
    expect(refusal.description).toMatch(/Decay legendary action refused \(exhausted\) — zero spend/);
  });

  it('regain at own turn-start resets uses, clears cooldowns, logs; silent no-op when nothing spent', async () => {
    runtime.store[KEY] = { max: 3, used: 2 };
    runtime.store[LATCH_KEY] = { round: 1, activeCreature: 'Thug 1' };
    runtime.store[COOLDOWNS_KEY] = { decay: { round: 1, usedBefore: 1 } };
    const result = await regainLegendaryUses({ monsterName: 'Blob of Annihilation 1', campaignName: 'test-campaign' });
    expect(result).toEqual({ regained: true, max: 3 });
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(runtime.store[LATCH_KEY]).toBe(null);
    expect(runtime.store[COOLDOWNS_KEY]).toBe(null);
    const regain = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(regain.abilityName).toBe('Legendary Action Uses');
    expect(regain.description).toMatch(/Blob of Annihilation 1 regains all expended legendary action uses at the start of its turn — 3 available/);

    vi.clearAllMocks();
    runtime.store[KEY] = { max: 3, used: 0 };
    const noop = await regainLegendaryUses({ monsterName: 'Blob of Annihilation 1', campaignName: 'test-campaign' });
    expect(noop).toEqual({ regained: false });
    expect(addEntry).not.toHaveBeenCalled();
  });
});
