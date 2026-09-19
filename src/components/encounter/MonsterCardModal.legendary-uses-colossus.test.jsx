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
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

const RADIANT_RAY = { name: 'Radiant Ray', attack_bonus: 18, damage_dice_primary: '4d10', damage_type_primary: 'Radiant', range: '300 ft.' };
const SLAM = { name: 'Slam', attack_bonus: 18, damage_dice_primary: '4d10 + 10', damage_type_primary: 'Bludgeoning', reach: '20 ft.' };

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
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const colossus = () => monstersData.find(m => m.name === 'Colossus');

describe('MA-0510 monsters.json data: colossus legendary header+delegates shape', () => {
  it('legendary_actions[0] is the header with numeric uses 2 (no longer the Smite child)', () => {
    const la = colossus().legendary_actions;
    expect(la[0].name).toBe('Legendary Action Uses: 2');
    expect(la[0].uses).toBe(2);
    expect(la[0].name).not.toMatch(/Smite|Stomp/);
  });

  it('Smite child delegates_to the byte-existing Radiant Ray row (+18, 4d10 Radiant)', () => {
    const smite = colossus().legendary_actions.find(a => a.name === 'Smite');
    expect(smite.delegates_to).toBe('Radiant Ray');
    expect(smite.uses).toBeUndefined();
    expect(smite.description).toBe('The colossus makes one Radiant Ray attack.');
    const ray = colossus().actions.find(a => a.name === 'Radiant Ray');
    expect(ray.attack_bonus).toBe(18);
    expect(ray.damage_dice_primary).toBe('4d10');
    expect(ray.damage_type_primary).toBe('Radiant');
  });

  it('Stomp child delegates_to the byte-existing Slam row (+18, 4d10+10 Bludgeoning)', () => {
    const stomp = colossus().legendary_actions.find(a => a.name === 'Stomp');
    expect(stomp.delegates_to).toBe('Slam');
    expect(stomp.uses).toBeUndefined();
    const slam = colossus().actions.find(a => a.name === 'Slam');
    expect(slam.attack_bonus).toBe(18);
    expect(slam.damage_dice_primary).toBe('4d10 + 10');
    expect(slam.damage_type_primary).toBe('Bludgeoning');
  });
});

describe('MA-0510 MonsterCardModal colossus legendary gated rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  function renderColossus(uses) {
    if (uses !== undefined) runtime.store['Colossus 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Colossus',
      actions: [SLAM, RADIANT_RAY],
      legendary_actions: colossus().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Colossus 1', creatures: CREATURES })} />);
  }
  function legendaryRowLink(name) {
    return Array.from(document.querySelectorAll('.mc-action'))
      .find(r => r.textContent.includes(name))?.querySelector('.mc-dice-link') || null;
  }

  it('header shows (2 left); Smite chip renders, spends 1, delegates to Radiant Ray (+18)', async () => {
    renderColossus({ max: 2, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    const link = legendaryRowLink('Smite');
    expect(link).not.toBeNull();
    fireEvent.click(link);
    await waitFor(() => expect(runtime.store['Colossus 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Smite (Radiant Ray attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(18);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Smite/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Smite/);
  });

  it('Stomp spends 1 and delegates to Slam (+18)', async () => {
    renderColossus({ max: 2, used: 0 });
    const link = legendaryRowLink('Stomp');
    expect(link).not.toBeNull();
    fireEvent.click(link);
    await waitFor(() => expect(runtime.store['Colossus 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Stomp (Slam attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(18);
  });

  it('exhausted (2/2): Smite click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderColossus({ max: 2, used: 2 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(legendaryRowLink('Smite'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Colossus 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});

// MA-0566: Death Knight had NO legendary header — legendary_actions[0] was the
// Dread Authority CHILD with uses:1, swallowed by legendaryHeaderAction(): the
// card rendered "Dread Authority (1 left)" as inert header text with ZERO
// affordance (MonsterCardBody slice(1)) and the rendered Lunge sibling
// SILENT-BURNED the shared counter with console.error "no resolvable mechanic"
// (MA-0510/MA-0511 fingerprint). Fix is the same DATA-only one-pass template:
// header "Legendary Action Uses: 2" + numeric uses:2 (RAW two legendary
// actions), Dread Authority authored as the canonical MA-0058/MA-0270
// advisory cast-row (Command has no word→condition consumer — honest
// record-only adjudication), Lunge authored delegates_to:"Dread Blade".
const deathKnight = () => monstersData.find(m => m.name === 'Death Knight');
const DREAD_BLADE = () => deathKnight().actions.find(a => a.name === 'Dread Blade');

describe('MA-0566 monsters.json data: death knight legendary header+children shape', () => {
  it('legendary_actions[0] is the header with numeric uses 2 (no longer the Dread Authority child)', () => {
    const la = deathKnight().legendary_actions;
    expect(la[0].name).toBe('Legendary Action Uses: 2');
    expect(la[0].uses).toBe(2);
    expect(la[0].name).not.toMatch(/Dread Authority|Fell Word|Lunge/);
  });

  it('Dread Authority child rides the canonical advisory cast-row shape, no swallowed uses', () => {
    const da = deathKnight().legendary_actions.find(a => a.name === 'Dread Authority');
    expect(da.uses).toBeUndefined();
    expect(da.advisory).toBe('command');
    expect(da.advisory_message).toMatch(/Command/);
    expect(da.advisory_message).toMatch(/advisory record/);
    expect(da.description).toMatch(/can't take this action again until the start of its next turn/);
  });

  it('Lunge child delegates_to the byte-existing Dread Blade row (+11, 2d6+5 Slashing)', () => {
    const lunge = deathKnight().legendary_actions.find(a => a.name === 'Lunge');
    expect(lunge.delegates_to).toBe('Dread Blade');
    expect(lunge.uses).toBeUndefined();
    const blade = DREAD_BLADE();
    expect(blade.attack_bonus).toBe(11);
    expect(blade.damage_dice_primary).toBe('2d6 + 5');
    expect(blade.damage_type_primary).toBe('Slashing');
  });
});

describe('MA-0566 MonsterCardModal death knight legendary gated rows', () => {
  const DK_CREATURES = [
    { name: 'Death Knight 1', type: 'npc', targetName: 'Bandit 1', currentHp: 180, maxHp: 180, ac: 20, conditions: [] },
    { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
  ];

  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: DK_CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderDeathKnight(uses) {
    if (uses !== undefined) runtime.store['Death Knight 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Death Knight',
      actions: [DREAD_BLADE()],
      legendary_actions: deathKnight().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Death Knight 1', creatures: DK_CREATURES })} />);
  }
  function legendaryRowLink(name) {
    return Array.from(document.querySelectorAll('.mc-action'))
      .find(r => r.textContent.trim().startsWith(name))?.querySelector('.mc-dice-link') || null;
  }

  it('header shows (2 left); Dread Authority renders a gated chip, spends 1, lands advisory adjudication with NO console.error', async () => {
    renderDeathKnight({ max: 2, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    const link = legendaryRowLink('Dread Authority');
    expect(link).not.toBeNull();
    fireEvent.click(link);
    await waitFor(() => expect(runtime.store['Death Knight 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Dread Authority');
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/Command/);
    const record = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && e.abilityName === 'Dread Authority' && !/expends/.test(e.description));
    expect(record).toBeTruthy();
    expect(record.description).toMatch(/Command/);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('Dread Authority once-per-turn clause refuses later boundaries with zero spend', async () => {
    renderDeathKnight({ max: 2, used: 0 });
    runtime.store['Death Knight 1.monsterLegendaryActionCooldowns'] = { dread_authority: { round: 1, usedBefore: 0 } };
    fireEvent.click(legendaryRowLink('Dread Authority'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain("can't take Dread Authority again");
    expect(runtime.store['Death Knight 1.monsterLegendaryUses']).toEqual({ max: 2, used: 0 });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('Lunge spends 1 and delegates to Dread Blade (+11), no silent-burn console.error', async () => {
    renderDeathKnight({ max: 2, used: 0 });
    const link = legendaryRowLink('Lunge');
    expect(link).not.toBeNull();
    fireEvent.click(link);
    await waitFor(() => expect(runtime.store['Death Knight 1.monsterLegendaryUses']).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Lunge (Dread Blade attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(11);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('exhausted (2/2): Lunge click refuses honestly, zero spend, zero roll', async () => {
    renderDeathKnight({ max: 2, used: 2 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(legendaryRowLink('Lunge'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Death Knight 1.monsterLegendaryUses']).toEqual({ max: 2, used: 2 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});
