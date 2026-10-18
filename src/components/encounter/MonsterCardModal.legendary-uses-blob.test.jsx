// @maintained-by-ai — trimmed to blob-distinct lanes: by-name data locks
// (header uses:3, Decay 4d6 auto-damage, Grasping Glob/Lashing Goo delegates)
// + one effect-distinct click per lane (auto-damage ctx, delegated save ctx,
// delegated attack ctx). Generic exhausted/latch/own-turn/cooldown/refusal/
// regain shapes are cite-skipped to their owners (map below).
//
// MA-0405 regression: Blob of Annihilation legendary header was display-only
// prose ("Legendary Action Uses: 3" with NO `uses` field) —
// legendaryHeaderAction() returned null, the card rendered the UNGATED branch
// (no counter, no gate), and the Decay "4d6" chip fired raw ungated damage
// with zero spend and zero refusal log. Fix mirrors the MA-0375 (beholder
// twin, c1217b2b8) / MA-0227 DATA-only shape, header + children SAME pass
// (playbook §5 silent-burn rule): header uses:3 (no lair_actions, nothing
// else to carve); Decay authors numeric damage_dice_primary "4d6" Necrotic
// (auto-damage to engulfed creatures — no to-hit/save, chip gated by the
// section's legendaryGate wrapper so it spends 1 BEFORE the roll); Grasping
// Glob gets delegates_to:"Restraining Glob" (MA-0022/0238 delegate seam);
// Lashing Goo gets delegates_to:"Pseudopod". No advisory rows needed —
// every child resolves a real mechanic, proven live by the three
// effect-distinct clicks below (no "no resolvable mechanic" burn).
//
// Cite-skipped generics (covered by owners — verified):
// - gate / spend / turn-latch / own-turn / exhausted / refusal / regain
//   units: src/services/encounters/monsterLegendaryUses.test.js :79-110,
//   :112-143, :145-162
// - per-action cooldown stamp / refusal / regain re-arm:
//   monsterLegendaryUses.test.js :652-705
// - modal exhausted refusal + turn-latch lanes (the ONE exhausted sibling
//   is kept at the blob's twin beholder #626):
//   MonsterCardModal.legendary-uses-beholder.test.jsx :213-223,
//   MonsterCardModal.legendary-uses.test.jsx :190, :310
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction,
  legendaryDelegateAction, legendaryDelegateAttackName, hasLegendaryCooldownClause,
} from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: () => <div className="sp-overlay sphere-picker-stub" />,
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({
  rollAttack: null, rollDamage: null, rollSavingThrow: null,
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _popupHtml = null;
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    popupHtml: _popupHtml,
    setPopupHtml: vi.fn(),
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })) };
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

describe('MA-0405 monsters.json data: blob legendary rows by-name locks', () => {
  it('header authors uses:3 and resolves through legendaryHeaderAction (was prose-only null)', () => {
    const header = legendary()[0];
    expect(header.uses).toBe(3);
    expect(header.name).toBe('Legendary Action Uses: 3');
    expect(legendaryHeaderAction(blob())).toBe(header);
  });

  it('Decay authors the honest auto-damage mechanic — numeric 4d6 Necrotic, no to-hit/save, cooldown clause live', () => {
    const decay = row('Decay');
    expect(decay.damage_dice_primary).toBe('4d6');
    expect(decay.damage_type_primary).toBe('Necrotic');
    expect(decay.attack_bonus).toBeUndefined();
    expect(decay.save_dc).toBeUndefined();
    expect(decay.delegates_to).toBeUndefined();
    expect(hasLegendaryCooldownClause(decay)).toBe(true);
  });

  it('prose alias rows delegate to the blob\'s own live rows — Grasping Glob→Restraining Glob (DC 23 DEX / 3d6 + 8 Acid), Lashing Goo→Pseudopod (+15 / 3d10 + 8 Force, no own cooldown)', () => {
    const glob = row('Grasping Glob');
    expect(glob.delegates_to).toBe('Restraining Glob');
    expect(glob.attack_bonus).toBeUndefined();
    expect(glob.save_dc).toBeUndefined();
    const rg = actionRow('Restraining Glob');
    expect(rg.save_dc).toBe(23);
    expect(rg.save_type).toBe('Dexterity');
    expect(rg.damage_dice_primary).toBe('3d6 + 8');
    expect(rg.damage_type_primary).toBe('Acid');
    expect(legendaryDelegateAction(blob(), glob)).toBe(rg);
    expect(legendaryDelegateAttackName(glob, rg)).toBe('Grasping Glob (Restraining Glob save)');
    expect(hasLegendaryCooldownClause(glob)).toBe(true);

    const goo = row('Lashing Goo');
    expect(goo.delegates_to).toBe('Pseudopod');
    const ps = actionRow('Pseudopod');
    expect(ps.attack_bonus).toBe(15);
    expect(ps.damage_dice_primary).toBe('3d10 + 8');
    expect(ps.damage_type_primary).toBe('Force');
    expect(legendaryDelegateAction(blob(), goo)).toBe(ps);
    expect(legendaryDelegateAttackName(goo, ps)).toBe('Lashing Goo (Pseudopod attack)');
    expect(hasLegendaryCooldownClause(goo)).toBe(false);
  });
});

// Live seam: counter mounts, one effect-distinct gated click per honest lane
// (auto-damage, delegated save, delegated attack) spends 1 BEFORE rolling and
// lands its ctx once. Refusal vocab (repeat/cooldown/own-turn/exhausted) is
// service/template generic — see cite-skipped header above.
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

  it('header shows (3 left); Decay renders gated numeric 4d6 chip; alias rows render Expend Legendary chips', () => {
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

  it('Grasping Glob gated click spends 1 and rolls the delegated DC 23 DEX save-leg (3d6 + 8 Acid), zero console burn', async () => {
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

  it('Lashing Goo gated click spends 1 and rolls the delegated +15 Pseudopod attack (3d10 + 8 Force), zero console burn', async () => {
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
});
