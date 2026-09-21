// MA-0694 regression: Empyrean legendary_actions[0] was the Bolster CHILD
// with uses:1 — legendaryHeaderAction() swallowed it as the header, so the
// card printed "Bolster (1 left)" as inert header text with ZERO affordance
// (§99/§165 header-swallow, MA-0675 twin). Fix template applied: canonical
// header "Legendary Action Uses: 1" + numeric uses:1; Bolster child rides the
// shared legendary gate via the MA-0655 monster_self_buff seam (single
// "Expend Legendary" chip — the ungated SelfBuffLink is suppressed on gated
// children, MonsterAction.jsx); click = gate → already-bolstered refusal →
// expend (expendLegendaryUse) → THP 10 replace-if-larger (tempHpService) +
// te `bolstered` + te `bolster_advantage` on self + allied NPCs (gridless
// §42 lenient) → ONE merged rounds:2 clock → spend + grant logs. Smite
// delegates_to:"Divine Ray" same pass (§165 header+children same-pass rule);
// Shockwave keeps numeric save fields riding the shared gate (§110/§166).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({
  rollAttack: null, rollDamage: null, rollSavingThrow: null, rollAbilityCheck: null, rollSkillCheck: null,
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  const rollAbilityCheck = vi.fn();
  const rollSkillCheck = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  ROLLERS.rollAbilityCheck = rollAbilityCheck;
  ROLLERS.rollSkillCheck = rollSkillCheck;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage, rollAbilityCheck,
    rollSavingThrow, rollSkillCheck, rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
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
const EXPIRY = vi.hoisted(() => ({ spy: null }));
vi.mock('../../services/rules/effects/expirations.js', async (importActual) => {
  const actual = await importActual();
  const spy = vi.fn();
  EXPIRY.spy = spy;
  return { ...actual, addExpiration: spy };
});

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
  { name: 'Empyrean 1', type: 'npc', currentHp: 346, maxHp: 346, ac: 19, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
  { name: 'Bandit 2', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
  { name: 'AasimarTest', type: 'player', currentHp: 200, maxHp: 200, ac: 20, conditions: [] },
];

const DIVINE_RAY = { name: 'Divine Ray', attack_bonus: 15, range: '120 ft.', damage_dice_primary: '6d8 + 8', damage_type_primary: 'Radiant' };

const emp = () => monstersData.find(m => m.index === 'empyrean');

function renderEmpyrean(uses) {
  if (uses !== undefined) runtime.store['Empyrean 1.monsterLegendaryUses'] = uses;
  const m = makeMonster({
    name: 'Empyrean',
    saving_throws: { dexterity: { modifier: 5 }, constitution: { modifier: 5 }, wisdom: { modifier: 9 }, charisma: { modifier: 12 } },
    actions: [DIVINE_RAY],
    legendary_actions: emp().legendary_actions,
  });
  render(<MonsterCardModal {...makeProps(m, { creatureName: 'Empyrean 1', creatures: CREATURES })} />);
}
function actionRow(name) {
  return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.trim().startsWith(name)) || null;
}
function legendaryRowLink(name) {
  return actionRow(name)?.querySelector('.mc-dice-link') || null;
}

describe('MA-0694 Empyrean card legendary section: header + clickable Bolster', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  it('header row shows "Legendary Action Uses: 1 (1 left)"; Bolster is NOT the swallowed header', () => {
    renderEmpyrean({ max: 1, used: 0 });
    const header = document.querySelector('.mc-legendary-header-row');
    expect(header.textContent).toContain('Legendary Action Uses: 1');
    expect(header.textContent).not.toContain('Bolster');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(1 left)');
  });

  it('Bolster arms ONE gated Expend-Legendary chip (ungated self-buff chip suppressed on gated children)', () => {
    renderEmpyrean({ max: 1, used: 0 });
    const row = actionRow('Bolster');
    expect(row).not.toBeNull();
    const links = row.querySelectorAll('.mc-dice-link');
    expect(links).toHaveLength(1);
    expect(links[0].className).toContain('mc-dice-link-legendary');
    expect(links[0].className).not.toContain('mc-dice-link-selfbuff');
  });

  it('Bolster expend: spends 1 via the shared gate, grants THP 10 (replace-if-larger), te bolstered + bolster_advantage on self + allied NPCs (PC excluded), ONE merged rounds:2 clock, spend + grant logs, zero console.error', async () => {
    renderEmpyrean({ max: 1, used: 0 });
    fireEvent.click(legendaryRowLink('Bolster'));
    await waitFor(() => expect(setPopupHtml.mock.calls.some(c => /Bolstered/.test(String(c[0] ?? '')))).toBe(true));
    expect(runtime.store['Empyrean 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 });
    expect(runtime.store['Empyrean 1.tempHp']).toBe(10);
    const tes = runtime.store['campaign.targetEffects'] || [];
    const teKeys = tes.map(te => `${te.target}:${te.effect}`);
    expect(teKeys).toContain('Empyrean 1:bolstered');
    expect(teKeys).toContain('Empyrean 1:bolster_advantage');
    expect(teKeys).toContain('Bandit 1:bolster_advantage');
    expect(teKeys).toContain('Bandit 2:bolster_advantage');
    expect(teKeys).not.toContain('AasimarTest:bolster_advantage');
    expect(EXPIRY.spy).toHaveBeenCalledTimes(1);
    const clock = EXPIRY.spy.mock.calls[0][0];
    expect(clock.rounds).toBe(2);
    expect(clock.effects.map(e => e.effectKey)).toEqual(['bolstered', 'bolster_advantage']);
    const entries = addEntry.mock.calls.map(c => c[1]);
    expect(entries.some(e => e.type === 'ability_use' && /expends a legendary use for Bolster/.test(e.description))).toBe(true);
    expect(entries.some(e => e.automationType === 'bolster_temp_hp_granted')).toBe(true);
    expect(entries.some(e => e.automationType === 'bolstered_granted')).toBe(true);
    expect(entries.some(e => e.automationType === 'bolster_advantage_granted' && /Bandit 1, Bandit 2/.test(e.description))).toBe(true);
    expect(String(setPopupHtml.mock.calls.at(-1)[0])).toMatch(/Bolstered/);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('refire while bolstered refuses BEFORE spend: bolster_refused / already_bolstered, counter held, zero THP change', async () => {
    renderEmpyrean({ max: 1, used: 0 });
    fireEvent.click(legendaryRowLink('Bolster'));
    await waitFor(() => expect(runtime.store['Empyrean 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 }));
    setPopupHtml.mockClear();
    addEntry.mockClear();
    fireEvent.click(legendaryRowLink('Bolster'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/Already Bolstered/);
    const entries = addEntry.mock.calls.map(c => c[1]);
    expect(entries.some(e => e.automationType === 'bolster_refused' && e.automationDetail === 'already_bolstered')).toBe(true);
    expect(runtime.store['Empyrean 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 });
  });

  it('exhausted pool (1/1 spent, te cleared): Bolster click refuses with Legendary Action Refused + legendary_use_refused, zero THP, zero te', async () => {
    renderEmpyrean({ max: 1, used: 1 });
    fireEvent.click(legendaryRowLink('Bolster'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/Legendary Action Refused/);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Empyrean 1.tempHp'] ?? null).toBeNull();
    expect(runtime.store['campaign.targetEffects'] ?? []).toEqual([]);
    expect(EXPIRY.spy).not.toHaveBeenCalled();
  });

  it('child rows stay live: Shockwave save chip intact, Smite delegates Divine Ray (+15) through the shared gate', async () => {
    renderEmpyrean({ max: 1, used: 0 });
    const shockwave = actionRow('Shockwave of Glory')?.querySelector('.mc-dice-link-save-clickable');
    expect(shockwave?.textContent).toContain('DC 23');
    const smite = legendaryRowLink('Smite');
    expect(smite.className).toContain('mc-dice-link-legendary');
    fireEvent.click(smite);
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Smite (Divine Ray attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(15);
    expect(runtime.store['Empyrean 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('own-turn gate: while the empyrean is the active creature, Bolster refuses own-turn, zero spend', async () => {
    ctx.value = { round: 1, activeCreatureName: 'Empyrean 1', creatures: CREATURES };
    renderEmpyrean({ max: 1, used: 0 });
    fireEvent.click(legendaryRowLink('Bolster'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/ANOTHER creature's turn/);
    expect(runtime.store['Empyrean 1.monsterLegendaryUses']).toEqual({ max: 1, used: 0 });
    expect(runtime.store['Empyrean 1.tempHp'] ?? null).toBeNull();
    expect(runtime.store['campaign.targetEffects'] ?? []).toEqual([]);
  });

  it('te consumer seam: with bolster_advantage on the card holder, save + ability-check chips roll at forced advantage mode', () => {
    runtime.store['campaign.targetEffects'] = [{ target: 'Empyrean 1', effect: 'bolster_advantage', source: 'Empyrean 1' }];
    renderEmpyrean({ max: 1, used: 0 });
    ROLLERS.rollSavingThrow.mockClear();
    ROLLERS.rollAbilityCheck.mockClear();
    const saveRow = Array.from(document.querySelectorAll('.mc-defense-row')).find(r => r.querySelector('.mc-defense-label')?.textContent === 'Saving Throws');
    expect(saveRow).toBeTruthy();
    fireEvent.click(saveRow.querySelector('.mc-dice-link'));
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow.mock.calls.at(-1)[2]?.forcedMode).toBe('advantage');
    fireEvent.click(document.querySelector('.mc-ability-mod.mc-dice-link'));
    expect(ROLLERS.rollAbilityCheck).toHaveBeenCalled();
    expect(ROLLERS.rollAbilityCheck.mock.calls.at(-1)[2]?.forcedMode).toBe('advantage');
  });

  it('without the bolster te the defense save chip rolls with no forced mode (byte-inert)', () => {
    renderEmpyrean({ max: 1, used: 0 });
    ROLLERS.rollSavingThrow.mockClear();
    const saveRow = Array.from(document.querySelectorAll('.mc-defense-row')).find(r => r.querySelector('.mc-defense-label')?.textContent === 'Saving Throws');
    fireEvent.click(saveRow.querySelector('.mc-dice-link'));
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow.mock.calls.at(-1)[2]?.forcedMode).toBeUndefined();
  });
});
