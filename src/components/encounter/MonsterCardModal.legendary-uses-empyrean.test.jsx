// @maintained-by-ai — MA-0694 empyrean lane, trimmed to empyrean-distinct
// seams: BY-name data lock (header uses:1 + Bolster self-buff automation +
// Shockwave numeric DC 23 save + Smite→Divine Ray delegate) + the LIVE
// modal-only lanes: header/"(1 left)" render with the swallowed-header
// symptom dead, ONE gated Expend chip (ungated SelfBuffLink suppressed on
// gated children, MonsterAction.jsx), Bolster click → spend → THP 10
// replace-if-larger → te `bolstered` + `bolster_advantage` self+allies
// (gridless §42 lenient, PC excluded) → ONE merged rounds:2 clock → spend +
// grant logs, then refire refused BEFORE spend (modal glue
// legendarySelfBuffActiveRefusal, MonsterCardModal.jsx :795-919 — the only
// modal-level already-bolstered guard), Smite delegated attack ctx once,
// and the bolster_advantage POSITIVE consumer leg (forced advantage on
// save/ability chips) — owned HERE: hasBolsterAdvantageOn/
// bolsterAdvantageContext at MonsterCardModal.jsx :1519-1524, cited live at
// #590 + damage-and-ability-checks.test.jsx:18 ("positive leg owned by
// legendary-uses-empyrean.test.jsx").
//
// Cite-skipped generics (covered by owners — verified):
// - BY-name data-shape units + grant-flow internals + already-bolstered
//   refusal inside the shared service handler:
//   src/services/encounters/monsterSelfBuff.bolster.test.js :76-105, :128, :180-194
// - gate spend / turn-latch / own-turn / exhausted units:
//   src/services/encounters/monsterLegendaryUses.test.js :93-96 (own-turn), :278
// - modal exhausted refusal (the ONE exhausted sibling):
//   MonsterCardModal.legendary-uses-beholder.test.jsx :213-223
// - own numeric-save child gated click + save ctx through the shared gate
//   (§110/§166, Shockwave's shape): MonsterCardModal.legendary-uses.test.jsx :397, :690
// - byte-inert save ctx without a bolster te on the holder (exact
//   undefined, same handleSaveThrow :2458 channel):
//   MonsterCardModal.interaction.test.jsx :173-180
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  rollAttack: null, rollSavingThrow: null, rollAbilityCheck: null,
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollAttack = vi.fn();
  const rollSavingThrow = vi.fn();
  const rollAbilityCheck = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  ROLLERS.rollAbilityCheck = rollAbilityCheck;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollAbilityCheck, rollSavingThrow,
    rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
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
const row = (name) => emp().legendary_actions.find(a => a.name === name);

describe('MA-0694 monsters.json data: empyrean legendary rows by-name locks', () => {
  it('header uses:1 resolves via legendaryHeaderAction (Bolster child no longer swallowed); Bolster authors the self-buff automation (no own uses); Shockwave keeps numeric DC 23 CON 6d8 Force; Smite delegates_to Divine Ray (+15)', () => {
    const header = emp().legendary_actions[0];
    expect(header.name).toBe('Legendary Action Uses: 1');
    expect(header.uses).toBe(1);
    expect(legendaryHeaderAction(emp())).toBe(header);

    const bolster = row('Bolster');
    expect(bolster.uses).toBeUndefined();
    expect(bolster.automation).toMatchObject({ type: 'monster_self_buff', effect: 'bolstered', rounds: 2, temp_hp: 10, ally_radius_ft: 30 });

    const shock = row('Shockwave of Glory');
    expect(shock.save_dc).toBe(23);
    expect(shock.save_type).toBe('Constitution');
    expect(shock.damage_dice_primary).toBe('6d8');
    expect(shock.damage_type_primary).toBe('Force');

    const smite = row('Smite');
    expect(smite.delegates_to).toBe('Divine Ray');
    const ray = emp().actions.find(a => a.name === 'Divine Ray');
    expect(legendaryDelegateAction(emp(), smite)).toBe(ray);
    expect(ray.attack_bonus).toBe(15);
    expect(legendaryDelegateAttackName(smite, ray)).toBe('Smite (Divine Ray attack)');
  });
});

describe('MA-0694 MonsterCardModal empyrean gated legendary seam', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

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

  it('header row shows "Legendary Action Uses: 1 (1 left)" with Bolster NOT swallowed; Bolster arms exactly ONE gated chip (ungated self-buff chip suppressed); Shockwave renders its numeric DC 23 save chip riding the gate', () => {
    renderEmpyrean({ max: 1, used: 0 });
    const header = document.querySelector('.mc-legendary-header-row');
    expect(header.textContent).toContain('Legendary Action Uses: 1');
    expect(header.textContent).not.toContain('Bolster');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(1 left)');
    const links = actionRow('Bolster').querySelectorAll('.mc-dice-link');
    expect(links).toHaveLength(1);
    expect(links[0].className).toContain('mc-dice-link-legendary');
    expect(links[0].className).not.toContain('mc-dice-link-selfbuff');
    expect(actionRow('Shockwave of Glory')?.querySelector('.mc-dice-link-save-clickable')?.textContent).toContain('DC 23');
  });

  it('Bolster click spends 1 via the shared gate, grants THP 10 + te bolstered/bolster_advantage on self + allied NPCs (PC excluded), ONE merged rounds:2 clock, spend + grant logs; refire refused BEFORE spend (already_bolstered, counter + THP held, zero extra clock)', async () => {
    renderEmpyrean({ max: 1, used: 0 });
    fireEvent.click(legendaryRowLink('Bolster'));
    await waitFor(() => expect(setPopupHtml.mock.calls.some(c => /Bolstered/.test(String(c[0] ?? '')))).toBe(true));
    expect(runtime.store['Empyrean 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 });
    expect(runtime.store['Empyrean 1.tempHp']).toBe(10);
    const teKeys = (runtime.store['campaign.targetEffects'] || []).map(te => `${te.target}:${te.effect}`);
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

    // modal-level already-active guard (:795/:919) — refusal BEFORE spend,
    // service-internal twin cite-skipped to monsterSelfBuff.bolster :180
    setPopupHtml.mockClear();
    addEntry.mockClear();
    fireEvent.click(legendaryRowLink('Bolster'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/Already Bolstered/);
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'bolster_refused' && e.automationDetail === 'already_bolstered')).toBe(true);
    expect(runtime.store['Empyrean 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 });
    expect(runtime.store['Empyrean 1.tempHp']).toBe(10);
    expect(EXPIRY.spy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('Smite gated click spends 1 and rolls the delegated +15 Divine Ray attack ctx, zero console burn', async () => {
    renderEmpyrean({ max: 1, used: 0 });
    fireEvent.click(legendaryRowLink('Smite'));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Smite (Divine Ray attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(15);
    expect(runtime.store['Empyrean 1.monsterLegendaryUses']).toEqual({ max: 1, used: 1 });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('te consumer positive leg (:1519-1524): with bolster_advantage on the card holder, save + ability-check chips roll at forced advantage mode', () => {
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
});
