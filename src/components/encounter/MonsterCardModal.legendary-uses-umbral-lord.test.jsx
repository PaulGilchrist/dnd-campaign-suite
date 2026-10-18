// @maintained-by-ai — trimmed to umbral-lord-distinct lanes: BY-name data
// locks (header uses:2 — was the swallowed Beguile child, MA-1657; Beguile
// numeric save child DC 18 WIS — the vampire twin's DC 17 lives in
// MonsterCardModal.legendary-uses-vampire.test.jsx; Umbral Strike
// delegates_to Grave Strike, MA-1658 — the vampire Deathless Strike twin
// lives in ...-vampire-ma1641.test.jsx) + ONE effect-distinct click per
// lane run exactly once (Beguile save→ctx, Umbral Strike delegated
// attack→ctx).
//
// Cite-skipped generics (covered by owners — verified):
// - gate / max / remaining / latch / own-turn / exhausted units + cooldown
//   clause: src/services/encounters/monsterLegendaryUses.test.js :67-75, :81-102, :638-639
// - modal counter mount, exhausted refusal, turn-latch refire, per-action
//   cooldown refire lanes: src/components/encounter/MonsterCardModal.legendary-uses.test.jsx :178-219, :310, :427
// - exhausted refusal sibling: MonsterCardModal.legendary-uses-beholder.test.jsx :213-223
// - plain-vampire DC 17 twin + unicorn boilerplate byte-swap:
//   MonsterCardModal.legendary-uses-vampire.test.jsx :111-215
//
// MA-1657 regression: Umbral Lord "Beguile" (legendary_actions[0], uses:1)
// was swallowed as the economy header (§99 header-swallow, MA-1640 twin) —
// ZERO affordance, frozen counter, silent-burn unreachable. Fix mirrors the
// VERIFIED MA-1640 disk byte-shape: canonical header uses:2 (floor =
// children count §202, no lair bump §231), Beguile re-authored as a
// numeric save child (save_dc 18 = 8 + CHA +5 + PB +5, Wisdom per
// spells.json Command, obey-clause honest as MA-0058 advisory), child
// uses/recharge dropped §165 (header owns the pool, MA-1058/1089 twins).
// MA-1658: Umbral Strike delegates_to "Grave Strike" (§216 pin, §165).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spellsData from '../../../public/data/spells.json';
import {
  legendaryHeaderAction, hasLegendaryCooldownClause,
  legendaryDelegateAction, legendaryDelegateAttackName,
} from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => {
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  return { rollAttack, rollDamage, rollSavingThrow };
});
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: ROLLERS.rollAttack, rollDamage: ROLLERS.rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow: ROLLERS.rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })) };
});
vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ noAdvantageAgainst: false, targetDisadvantageCount: 0, riderSaveDisadvantage: false, riderAttackBonus: 0, riderCannotOpportunityAttack: false, speedZero: false })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit 1', creatures: [] } }));
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

const CREATURES = [
  { name: 'Vampire Umbral Lord 1', type: 'npc', monsterType: 'undead', targetName: 'Bandit 1', currentHp: 187, maxHp: 187, ac: 16, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const KEY = 'Vampire Umbral Lord 1.monsterLegendaryUses';
const COOLDOWNS_KEY = 'Vampire Umbral Lord 1.monsterLegendaryActionCooldowns';

const umbralLord = () => monstersData.find(m => m.name === 'Vampire Umbral Lord');
const legendary = () => umbralLord().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);

describe('MA-1657 monsters.json data lock: umbral lord legendary rows by-name', () => {
  it('rows[0] is the canonical header with numeric uses:2 (was: the swallowed Beguile child)', () => {
    const la = legendary();
    expect(la[0].name).toBe('Legendary Action Uses: 2');
    expect(la[0].uses).toBe(2);
    expect(la[0].name).not.toMatch(/Beguile|Umbral Strike|Lair/);
    expect(legendaryHeaderAction(umbralLord())).toBe(la[0]);
  });

  it('Beguile is a numeric save child DC 18 WIS — uses/recharge dropped §165, obey-clause honest zero-grant, until-next-turn latch', () => {
    const beg = row('Beguile');
    expect(beg.save_dc).toBe(18);
    expect(beg.save_type).toBe('Wisdom');
    expect(beg.dc_success).toBe('none');
    expect(beg.range).toBe('60 feet');
    expect(beg.uses).toBeUndefined();
    expect(beg.recharge).toBeUndefined();
    expect(beg.delegates_to).toBeUndefined();
    expect(beg.advisory).toBeUndefined();
    expect(beg.save_effect).toMatch(/^Failure: The target obeys the vampire's one-word command/);
    // DC arithmetic on disk truth: 8 + CHA +5 + PB +5 = 18; spells.json
    // Command truth: WIS save, dc_success none, range 60 ft.
    expect(8 + umbralLord().ability_score_modifiers.cha + umbralLord().proficiency_bonus).toBe(beg.save_dc);
    const command = spellsData.find(s => s.name === 'Command');
    expect(command.dc.dc_type).toBe('WIS');
    expect(command.dc.dc_success).toBe('none');
    expect(command.range).toBe('60 feet');
    // obey-the-command has no canonical-condition consumer (MA-0058 twin).
    expect(extractConditionsFromSaveEffect(beg.save_effect)).toEqual([]);
    expect(beg.description).toMatch(/can't take this action again until the start of its next turn/);
    expect(hasLegendaryCooldownClause(beg)).toBe(true);
  });

  it('MA-1658: Umbral Strike delegates_to Grave Strike (§165/§216) — delegate resolves the real attack row', () => {
    const us = row('Umbral Strike');
    expect(Object.keys(us)).toEqual(['name', 'description', 'delegates_to']);
    expect(us.delegates_to).toBe('Grave Strike');
    const delegate = legendaryDelegateAction(umbralLord(), us);
    expect(delegate).not.toBeNull();
    expect(delegate.attack_bonus).toBe(10);
    expect(delegate.damage_dice_primary).toBe('1d8 + 5');
    expect(delegate.damage_type_primary).toBe('Slashing');
    expect(delegate.damage_dice_secondary).toBe('3d8');
    expect(delegate.damage_type_secondary).toBe('Necrotic');
    expect(legendaryDelegateAttackName(us, delegate)).toBe('Umbral Strike (Grave Strike attack)');
  });
});

// Live seam: gated counter mounts, each effect-distinct chip click runs its
// honest lane ONCE. Refusal siblings (latch/exhausted/own-turn) are
// cite-skipped generics — see header map.
describe('MA-1657/1658 MonsterCardModal umbral lord gated legendary clicks', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderUmbralLord(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Vampire Umbral Lord',
      actions: umbralLord().actions,
      legendary_actions: legendary(),
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Vampire Umbral Lord 1', creatures: CREATURES })} />);
  }
  function uRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.trim().startsWith(name));
  }

  it('Beguile gated save click spends 2→1, adjudicates DC 18 WIS vs armed Bandit, stamps cooldown, honest spend log, console clean', async () => {
    renderUmbralLord({ max: 2, used: 0 });
    expect(document.querySelector('.mc-legendary-header-row').textContent).toContain('Legendary Action Uses: 2');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    expect(document.querySelector('.mc-legendary-header-row').textContent).not.toContain('Beguile');
    const chip = uRow('Beguile').querySelector('.mc-dice-link-save-clickable');
    expect(chip.textContent).toContain('DC 18');
    expect(chip.textContent).toContain('Wisdom');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(18);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.targetName).toBe('Bandit 1');
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ beguile: { round: 1 } }));
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Beguile/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Beguile/);
    expect(spend.description).toMatch(/1 of 2 left/);
    expect(consoleSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
  });

  it('MA-1658: Umbral Strike Expend-Legendary chip click spends 2→1, rolls delegated +10 "Umbral Strike (Grave Strike attack)" with both damage legs, honest spend log, console clean', async () => {
    renderUmbralLord({ max: 2, used: 0 });
    const chip = uRow('Umbral Strike').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Umbral Strike (Grave Strike attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(10);
    const opts = ROLLERS.rollAttack.mock.calls[0][2];
    expect(opts.autoDamageFormula).toBe('1d8 + 5');
    expect(opts.damageType).toBe('Slashing');
    expect(opts.autoDamageSecondaryFormula).toBe('3d8');
    expect(opts.autoDamageSecondaryDamageType).toBe('Necrotic');
    expect(opts.targetName).toBe('Bandit 1');
    expect(opts.saveDc).toBeNull();
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Umbral Strike/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Umbral Strike/);
    expect(spend.description).toMatch(/1 of 2 left/);
    expect(consoleSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
  });
});
