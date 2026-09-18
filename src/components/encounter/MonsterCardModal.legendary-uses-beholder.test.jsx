// MA-0375 regression: Beholder legendary header was display-only prose
// ("Legendary Action Uses: 3 (4 in Lair)" with NO `uses` field) —
// legendaryHeaderAction() returned null, the card rendered the UNGATED branch
// (no counter, zero chips), children inert, monsterLegendaryUses never
// created (forced clicks ×4 all fire-free). Fix mirrors the verified MA-0227
// (ancient green) DATA-only shape, header+children SAME pass (MA-0164 silent-
// burn rule): header uses:3 ("4 in Lair" stays name text — no lair consumer);
// Chomp gets delegates_to:"Bite" (MA-0022/0230 seam, Bite +8 / 3d6+3
// Piercing); Glare gets the MA-0058/0270 advisory seam with row-authored
// honest copy (Eye Rays multi-ray block is MA-0374 unparseable — fabricating
// one ray's numbers misrepresents RAW; the prose-only alternative would burn
// uses through the console.error dead-end at resolveLegendaryRowMechanic, so
// advisory spend + GM-picks-ray adjudication is the honest engine seam).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction, legendaryMaxUses, legendaryUsesRemaining,
  legendaryDelegateAction, legendaryDelegateAttackName, hasLegendaryCooldownClause,
  buildLegendaryAdvisoryPopup, buildLegendaryAdvisoryLog,
  expendLegendaryUse, regainLegendaryUses,
} from '../../services/encounters/monsterLegendaryUses.js';

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
  { name: 'Beholder 1', type: 'npc', monsterType: 'aberration', targetName: 'TestPC', currentHp: 136, maxHp: 136, ac: 17, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Beholder 1.monsterLegendaryUses';
const LATCH_KEY = 'Beholder 1._legendaryUses_usedRound';

const beholder = () => monstersData.find(m => m.name === 'Beholder');
const legendary = () => beholder().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const biteRow = () => beholder().actions.find(a => a.name === 'Bite');

// MA-0375 data lock: header carries numeric uses:3 ("4 in Lair" stays NAME
// text — no lair-toggle consumer, MA-0092/0217 fingerprint); byte-shape and
// field casing copied from the MA-0227 ancient-green header row.
describe('MA-0375 monsters.json data: beholder legendary header authors uses:3', () => {
  it('header row has uses:3 and the lair text stays advisory name prose', () => {
    expect(row('Legendary Action Uses: 3 (4 in Lair)').uses).toBe(3);
    expect(legendaryHeaderAction(beholder())).toBe(legendary()[0]);
    expect(legendaryMaxUses(legendary()[0], null)).toBe(3);
    expect(legendaryUsesRemaining(legendary()[0], { max: 3, used: 1 })).toBe(2);
    expect(legendary()[0].name).toBe('Legendary Action Uses: 3 (4 in Lair)');
  });

  it('every prose child resolves a mechanic — no silent-burn chip (MA-0164)', () => {
    for (const a of legendary().slice(1)) {
      const resolvable = a.attack_bonus != null || a.save_dc != null
        || !!legendaryDelegateAction(beholder(), a) || !!a.advisory || !!a.ability_check;
      expect(resolvable, `legendary row "${a.name}" has no resolvable mechanic`).toBe(true);
    }
  });

  it('descriptions byte-unchanged from the shipped prose', () => {
    expect(legendary()[0].description).toBe("Immediately after another creature's turn, the beholder can expend a use to take one of the following actions. The beholder regains all expended uses at the start of each of its turns.");
    expect(row('Chomp').description).toBe('The beholder makes two Bite attacks.');
    expect(row('Glare').description).toBe('The beholder uses Eye Rays.');
  });
});

// MA-0375: Chomp delegates_to:"Bite" (MA-0022/0227 Pounce→Rend byte-shape:
// delegates_to between name and description). Bite exists with +8 / 3d6+3
// Piercing. RAW is TWO Bite attacks — the single delegated roll per click is
// the accepted MA-0009/0223 count-GM-adjudicated residual.
describe('MA-0375 monsters.json data: Chomp delegates to Bite', () => {
  it('Chomp row delegates_to Bite, no own numeric mechanic', () => {
    const chomp = row('Chomp');
    expect(chomp.delegates_to).toBe('Bite');
    expect(chomp.attack_bonus).toBeUndefined();
    expect(chomp.save_dc).toBeUndefined();
    expect(chomp.advisory).toBeUndefined();
  });

  it('delegate resolves the beholder own Bite row: +8 / 3d6 + 3 Piercing', () => {
    const bite = biteRow();
    expect(bite.attack_bonus).toBe(8);
    expect(bite.damage_dice_primary).toBe('3d6 + 3');
    expect(bite.damage_type_primary).toBe('Piercing');
    const delegate = legendaryDelegateAction(beholder(), row('Chomp'));
    expect(delegate).toBe(bite);
    expect(legendaryDelegateAttackName(row('Chomp'), bite)).toBe('Chomp (Bite attack)');
  });

  it('no once-per-turn cooldown clause authored on Chomp or Glare', () => {
    expect(hasLegendaryCooldownClause(row('Chomp'))).toBe(false);
    expect(hasLegendaryCooldownClause(row('Glare'))).toBe(false);
  });
});

// MA-0375 Glare adjudication — option (c): the MA-0058/0270 advisory seam
// (grep-proven live path in resolveLegendaryRowMechanic, arch-hag Malicious
// Magic byte-shape). Spend 1 (RAW) + popup + ability_use record; the
// MA-0374 multi-ray subsystem is pending so ray choice is GM-enforced.
describe('MA-0375 monsters.json data: Glare advisory seam, honest adjudication copy', () => {
  it('Glare is an advisory row, no numeric mechanic, no fabricated ray numbers', () => {
    const glare = row('Glare');
    expect(glare.advisory).toBe('eye_rays');
    expect(glare.attack_bonus).toBeUndefined();
    expect(glare.save_dc).toBeUndefined();
    expect(glare.damage_dice_primary).toBeUndefined();
    expect(glare.delegates_to).toBeUndefined();
    expect(glare.advisory_message).toMatch(/GM picks one eye ray and adjudicates/);
    expect(glare.advisory_message).toMatch(/MA-0374 pending subsystem/);
    expect(glare.advisory_message).toMatch(/Canonical cost is 1 legendary use — the engine spends 1 per click/);
  });

  it('advisory builders land honest popup + ability_use record copy', () => {
    const popup = buildLegendaryAdvisoryPopup({ monsterName: 'Beholder 1', action: row('Glare') });
    expect(popup).toContain('Legendary Action — Glare');
    expect(popup).toContain('Beholder 1 uses Eye Rays — advisory record: GM picks one eye ray');
    const log = buildLegendaryAdvisoryLog({ monsterName: 'Beholder 1', action: row('Glare') });
    expect(log.type).toBe('ability_use');
    expect(log.abilityName).toBe('Glare');
    expect(log.description).toBe('Beholder 1 legendary action Glare: Beholder 1 uses Eye Rays — advisory record: GM picks one eye ray and adjudicates its save/damage (Eye Rays multi-ray d10 block unparseable, MA-0374 pending subsystem; no ray picker consumer). Canonical cost is 1 legendary use — the engine spends 1 per click.');
  });
});

// Live seam: counter mounts, gated spend/refusal/regain economy runs.
describe('MA-0375 MonsterCardModal beholder gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderBeholder(uses) {
    if (uses !== undefined) runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Beholder',
      actions: beholder().actions,
      legendary_actions: beholder().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Beholder 1', creatures: CREATURES })} />);
  }
  function beholderRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('header shows (3 left); Chomp and Glare render gated Expend Legendary chips', () => {
    renderBeholder({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const chompChip = beholderRow('Chomp').querySelector('.mc-dice-link-legendary');
    expect(chompChip).not.toBe(null);
    expect(chompChip.textContent).toContain('Expend Legendary');
    expect(beholderRow('Glare').querySelector('.mc-dice-link-legendary')).not.toBe(null);
  });

  it('Chomp gated click spends 1 (3→2), creates monsterLegendaryUses + latch, rolls delegated +8 Bite, zero console dead-end', async () => {
    renderBeholder();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(runtime.store[KEY]).toBeUndefined();
    fireEvent.click(beholderRow('Chomp').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(runtime.store[LATCH_KEY]).toEqual({ round: 1, activeCreature: 'Thug 1' }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Chomp (Bite attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(8);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('3d6 + 3');
    expect(options.damageType).toBe('Piercing');
    expect(options.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Chomp/.test(e.description));
    expect(spend.description).toMatch(/Beholder 1 expends a legendary use for Chomp/);
    expect(spend.description).toMatch(/2 of 3 left/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('second same-window Chomp click refuses (turn latch): zero extra spend, legendary_use_refused log', async () => {
    renderBeholder();
    const chip = beholderRow('Chomp').querySelector('.mc-dice-link-legendary');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollAttack).toHaveBeenCalledTimes(1);
  });

  it('Glare gated click spends 1 and lands the advisory record (popup + ability_use log), zero rolls', async () => {
    renderBeholder();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(beholderRow('Glare').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action — Glare');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('GM picks one eye ray');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(
      e => e.type === 'ability_use' && e.abilityName === 'Glare' && /advisory record/.test(e.description))).toBe(true));
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('exhausted (3/3): chip clicks refuse with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderBeholder({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(beholderRow('Chomp').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('no legendary uses left');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('own-turn click refuses (turn gate): zero spend, zero roll', async () => {
    renderBeholder();
    ctx.value = { round: 1, activeCreatureName: 'Beholder 1', creatures: CREATURES };
    fireEvent.click(beholderRow('Chomp').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('not its own');
    expect(runtime.store[KEY]).toBeUndefined();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});

// Turn-start regain + spend/refusal vocabulary unit lock (the same seam the
// initiative monster turn-start path calls).
describe('MA-0375 monsterLegendaryUses unit: beholder gate, spend, refusal, regain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  it('first Chomp expend creates the monsterLegendaryUses key (3→2) with spend log', async () => {
    const result = await expendLegendaryUse({ monsterName: 'Beholder 1', monster: beholder(), actionName: 'Chomp', campaignName: 'test-campaign' });
    expect(result.spent).toBe(true);
    expect(result.remaining).toBe(2);
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(spend.description).toMatch(/expends a legendary use for Chomp/);
  });

  it('exhausted expend refuses with legendary_use_refused, zero spend', async () => {
    runtime.store[KEY] = { max: 3, used: 3 };
    const result = await expendLegendaryUse({ monsterName: 'Beholder 1', monster: beholder(), actionName: 'Glare', campaignName: 'test-campaign' });
    expect(result.spent).toBe(false);
    expect(result.reason).toBe('exhausted');
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'legendary_use_refused');
    expect(refusal.description).toMatch(/Glare legendary action refused \(exhausted\) — zero spend/);
  });

  it('regain at own turn-start resets uses and logs; silent no-op when nothing spent', async () => {
    runtime.store[KEY] = { max: 3, used: 2 };
    runtime.store[LATCH_KEY] = { round: 1, activeCreature: 'Thug 1' };
    const result = await regainLegendaryUses({ monsterName: 'Beholder 1', campaignName: 'test-campaign' });
    expect(result).toEqual({ regained: true, max: 3 });
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(runtime.store[LATCH_KEY]).toBe(null);
    const regain = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use');
    expect(regain.abilityName).toBe('Legendary Action Uses');
    expect(regain.description).toMatch(/Beholder 1 regains all expended legendary action uses at the start of its turn — 3 available/);

    vi.clearAllMocks();
    runtime.store[KEY] = { max: 3, used: 0 };
    const noop = await regainLegendaryUses({ monsterName: 'Beholder 1', campaignName: 'test-campaign' });
    expect(noop).toEqual({ regained: false });
    expect(addEntry).not.toHaveBeenCalled();
  });
});
