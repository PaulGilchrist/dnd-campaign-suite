// @maintained-by-ai — trimmed to colossus/death-knight-distinct lanes: by-name
// data locks (header uses:2 resolves, Smite→Radiant Ray + Stomp→Slam, Dread
// Authority advisory cast-row, Lunge→Dread Blade w/ secondary bytes) + one
// effect-distinct click per lane (2 delegated attack ctx with distinct damage
// bytes, 1 advisory record, 1 delegated attack ctx). Generic
// exhausted/latch/own-turn/cooldown/regain/refusal shapes are cite-skipped to
// their owners (map below).
//
// Cite-skipped generics (covered by owners — verified):
// - gate / spend / turn-latch / own-turn / exhausted / refusal / regain units:
//   src/services/encounters/monsterLegendaryUses.test.js :79-110, :112-143, :145-162
// - per-action cooldown stamp / refusal / regain re-arm (incl. the Dread
//   Authority once-per-turn lane): monsterLegendaryUses.test.js :652-705
// - modal exhausted refusal + turn-latch lanes (the ONE exhausted sibling is
//   kept at the beholder #626):
//   MonsterCardModal.legendary-uses-beholder.test.jsx :213-223,
//   MonsterCardModal.legendary-uses.test.jsx :190, :310
// MA-0510 regression: Colossus legendary_actions[0] was the Smite CHILD row
// with uses:1 — legendaryHeaderAction() swallowed it as the header, so the
// card printed "Smite (1 left)" as header text with ZERO Smite affordance
// (MonsterCardBody renders slice(1)), and the rendered Stomp sibling SILENTLY
// BURNED the shared uses:1 counter with console.error "delegates_to undefined —
// no resolvable mechanic" (MA-0510/MA-0511). Fix mirrors the canonical
// MA-0021/MA-0022 aboleth DATA-only one-pass template: header "Legendary
// Action Uses: 2" + numeric uses:2 (RAW two legendary actions), and BOTH
// prose children authored the SAME pass with delegates_to onto byte-existing
// weapon rows (Smite → Radiant Ray +18 4d10 Radiant; Stomp → Slam +18
// 4d10+10 Bludgeoning).
// MA-0566: Death Knight had NO legendary header — legendary_actions[0] was
// the Dread Authority CHILD with uses:1 (same MA-0510/MA-0511 silent-burn
// fingerprint). Fix is the same DATA-only one-pass template: header uses:2,
// Dread Authority authored as the canonical MA-0058/MA-0270 advisory cast-row
// (Command has no word→condition consumer — honest record-only adjudication),
// Lunge authored delegates_to:"Dread Blade".
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction, legendaryDelegateAction, legendaryDelegateAttackName,
} from '../../services/encounters/monsterLegendaryUses.js';

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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Colossus 1', type: 'npc', targetName: 'Bandit 1', currentHp: 553, maxHp: 553, ac: 23, conditions: [] },
  { name: 'Death Knight 1', type: 'npc', targetName: 'Bandit 1', currentHp: 180, maxHp: 180, ac: 20, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const colossus = () => monstersData.find(m => m.name === 'Colossus');
const deathKnight = () => monstersData.find(m => m.name === 'Death Knight');

describe('MA-0510 monsters.json data: colossus legendary rows by-name locks', () => {
  it('header resolves through legendaryHeaderAction with numeric uses 2 (no longer the swallowed Smite child)', () => {
    const m = colossus();
    const header = m.legendary_actions[0];
    expect(header.name).toBe('Legendary Action Uses: 2');
    expect(header.uses).toBe(2);
    expect(header.name).not.toMatch(/Smite|Stomp/);
    expect(legendaryHeaderAction(m)).toBe(header);
  });

  it('Smite→Radiant Ray and Stomp→Slam delegates resolve the byte-existing weapon rows, no swallowed uses', () => {
    const m = colossus();
    const smite = m.legendary_actions.find(a => a.name === 'Smite');
    expect(smite.delegates_to).toBe('Radiant Ray');
    expect(smite.uses).toBeUndefined();
    expect(smite.description).toBe('The colossus makes one Radiant Ray attack.');
    const ray = m.actions.find(a => a.name === 'Radiant Ray');
    expect(legendaryDelegateAction(m, smite)).toBe(ray);
    expect(legendaryDelegateAttackName(smite, ray)).toBe('Smite (Radiant Ray attack)');
    expect(ray.attack_bonus).toBe(18);
    expect(ray.damage_dice_primary).toBe('4d10');
    expect(ray.damage_type_primary).toBe('Radiant');

    const stomp = m.legendary_actions.find(a => a.name === 'Stomp');
    expect(stomp.delegates_to).toBe('Slam');
    expect(stomp.uses).toBeUndefined();
    const slam = m.actions.find(a => a.name === 'Slam');
    expect(legendaryDelegateAction(m, stomp)).toBe(slam);
    expect(legendaryDelegateAttackName(stomp, slam)).toBe('Stomp (Slam attack)');
    expect(slam.attack_bonus).toBe(18);
    expect(slam.damage_dice_primary).toBe('4d10 + 10');
    expect(slam.damage_type_primary).toBe('Bludgeoning');
  });
});

describe('MA-0566 monsters.json data: death knight legendary rows by-name locks', () => {
  it('header resolves through legendaryHeaderAction with numeric uses 2 (no longer the swallowed Dread Authority child)', () => {
    const m = deathKnight();
    const header = m.legendary_actions[0];
    expect(header.name).toBe('Legendary Action Uses: 2');
    expect(header.uses).toBe(2);
    expect(header.name).not.toMatch(/Dread Authority|Fell Word|Lunge/);
    expect(legendaryHeaderAction(m)).toBe(header);
  });

  it('Dread Authority rides the canonical advisory cast-row shape; Lunge→Dread Blade resolves the byte-existing row (+11, 2d6+5 Slashing + 3d8 Necrotic)', () => {
    const m = deathKnight();
    const da = m.legendary_actions.find(a => a.name === 'Dread Authority');
    expect(da.uses).toBeUndefined();
    expect(da.delegates_to).toBeUndefined();
    expect(da.advisory).toBe('command');
    expect(da.advisory_message).toMatch(/Command/);
    expect(da.advisory_message).toMatch(/advisory record/);
    expect(da.description).toMatch(/can't take this action again until the start of its next turn/);

    const lunge = m.legendary_actions.find(a => a.name === 'Lunge');
    expect(lunge.delegates_to).toBe('Dread Blade');
    expect(lunge.uses).toBeUndefined();
    const blade = m.actions.find(a => a.name === 'Dread Blade');
    expect(legendaryDelegateAction(m, lunge)).toBe(blade);
    expect(legendaryDelegateAttackName(lunge, blade)).toBe('Lunge (Dread Blade attack)');
    expect(blade.attack_bonus).toBe(11);
    expect(blade.damage_dice_primary).toBe('2d6 + 5');
    expect(blade.damage_type_primary).toBe('Slashing');
    expect(blade.damage_dice_secondary).toBe('3d8');
    expect(blade.damage_type_secondary).toBe('Necrotic');
  });
});

// Live seam: counter mounts, one effect-distinct gated click per honest lane
// spends 1 BEFORE rolling and lands its ctx once with zero "no resolvable
// mechanic" burn (the MA-0510/MA-0566 fingerprint).
describe('MA-0510/MA-0566 MonsterCardModal gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  function renderMonster(name) {
    const m = makeMonster({ name, actions: monstersData.find(x => x.name === name).actions, legendary_actions: monstersData.find(x => x.name === name).legendary_actions });
    render(<MonsterCardModal {...makeProps(m, { creatureName: `${name} 1`, creatures: CREATURES })} />);
  }
  function laChip(name) {
    return Array.from(document.querySelectorAll('.mc-action'))
      .find(r => r.textContent.trim().startsWith(name))?.querySelector('.mc-dice-link-legendary') || null;
  }
  function expectNoBurn(errSpy) {
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic|delegates_to undefined/.test(String(a)))).toBe(false);
  }

  it('colossus Smite chip click creates the uses map, spends 1 (0→1), stamps the latch, rolls delegated +18 / 4d10 Radiant, logs spend — zero burn', async () => {
    renderMonster('Colossus');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    expect(runtime.store['Colossus 1.monsterLegendaryUses']).toBeUndefined();
    const chip = laChip('Smite');
    expect(chip).not.toBeNull();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Colossus 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(runtime.store['Colossus 1._legendaryUses_usedRound']).toEqual({ round: 1, activeCreature: 'Bandit 1' }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Smite (Radiant Ray attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(18);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('4d10');
    expect(options.damageType).toBe('Radiant');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Smite/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Smite/);
    expect(spend.description).toMatch(/1 of 2 left/);
    expectNoBurn(errSpy);
    errSpy.mockRestore();
  });

  it('colossus Stomp chip click spends 1 and rolls delegated +18 / 4d10 + 10 Bludgeoning — damage bytes distinct from Smite, zero burn', async () => {
    renderMonster('Colossus');
    const chip = laChip('Stomp');
    expect(chip).not.toBeNull();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Colossus 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Stomp (Slam attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(18);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('4d10 + 10');
    expect(options.damageType).toBe('Bludgeoning');
    expectNoBurn(errSpy);
    errSpy.mockRestore();
  });

  it('death knight Dread Authority chip click spends 1 and lands the advisory record (popup + ability_use, zero rolls) — no silent-burn', async () => {
    renderMonster('Death Knight');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    const chip = laChip('Dread Authority');
    expect(chip).not.toBeNull();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Death Knight 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Dread Authority');
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/Command/);
    const record = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.abilityName === 'Dread Authority' && !/expends/.test(e.description));
    expect(record).toBeTruthy();
    expect(record.description).toMatch(/Command/);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expectNoBurn(errSpy);
    errSpy.mockRestore();
  });

  it('death knight Lunge chip click spends 1 and rolls delegated +11 / 2d6 + 5 Slashing (+ 3d8 Necrotic secondary rides), zero burn', async () => {
    renderMonster('Death Knight');
    const chip = laChip('Lunge');
    expect(chip).not.toBeNull();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Death Knight 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Lunge (Dread Blade attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(11);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d6 + 5');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('3d8');
    expectNoBurn(errSpy);
    errSpy.mockRestore();
  });
});
