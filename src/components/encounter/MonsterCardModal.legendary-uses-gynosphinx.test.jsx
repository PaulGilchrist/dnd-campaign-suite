// @maintained-by-ai
// Trimmed (#623/#624): 21→11 tests. Generic legs owned elsewhere — turn-latch/
// own-turn/exhausted gates + regain: services/encounters/monsterLegendaryUses.test.js
// (:86/:93-97/:99-103/:145-156); modal latch/exhausted template:
// MonsterCardModal.legendary-uses.test.jsx (:310/:418/:190); advisory popup/log
// shape: monsterLegendaryUses.test.js (:607) + ma1581. Kept gynosphinx-distinct:
// uses:2 header/delegate data, exact-exhaust cost-2 Teleport, MA-1883
// insufficient-cost refuse (3 > 2-pool, impossible on Androsphinx 3-pool).
// MA-0956 regression: Gynosphinx "Claw Attack" (legendary) was prose-only —
// rows[0] WAS the Claw Attack {name, description} row, so
// legendaryHeaderAction() (monsterLegendaryUses.js:153, rows[0].uses != null)
// returned null, the card rendered the UNGATED branch (MonsterCardBody.jsx),
// LegendarySpendLink early-returned null (MonsterAction.jsx:164), and every
// child was inert bare prose (live: 0 affordances, click zero-delta, cs zero
// legendary keys). Fix is DATA-only per §99/§168: prepend the Death-Knight
// byte-template header {name:"Legendary Action Uses: 2", uses:2} (RAW gynosphinx
// = 2/day, "The sphinx takes 2 legendary actions...") and give Claw Attack
// delegates_to:"Claw" (MA-0022 seam; the sphinx's OWN weapon is Claw:
// +9 / 13 (2d8 + 4) slashing, MA-0955 twin numbers). MA-0957 (same pass):
// Teleport (Costs 2 Actions) rode the live header gate as a silent-burn child
// (MA-0696 shape: Expend chip armed by MA-0956, click spent 1 with console.error
// "no resolvable mechanic" — live-caught) until it gained the MA-0270 advisory
// seam (advisory:"sphinx_teleport" + honest advisory_message, Androsphinx byte-
// twin). MA-0958 (this pass): Cast a Spell (Costs 3 Actions) rode the same
// live gate as a silent-burn child until it gained the same advisory seam
// (advisory:"spellcast_adjudication", Androsphinx sibling key) with honest
// copy: GM adjudicates spell choice + spell-slot spend (no monster spell-slot
// machinery app-wide; spell list is prose Spellcasting trait only) and RAW
// costs-3 vs the disk-canonical 2-use pool (RAW-unusable as printed).
//
// Generic legs live elsewhere and are NOT re-run here: turn-latch / own-turn /
// exhausted gates + turn-start regain — services/encounters/monsterLegendaryUses.test.js
// (MA-0021 expend gate :86/:93-97/:99-103, regain :145-156) and modal template
// MonsterCardModal.legendary-uses.test.jsx (latch :310/:418, exhausted :190);
// advisory popup/log SHAPE — monsterLegendaryUses.test.js (MA-0058 :607) +
// monsterLegendaryUses.ma1581-tarrasque-move-advisory.test.js. This file keeps
// the gynosphinx-distinct legs: uses:2 header/delegate data, exact-exhausting
// cost-2 Teleport on a 2-pool, and the MA-1883 insufficient-cost refusal
// (costs-3 vs 2-pool — impossible on the Androsphinx 3-pool sibling).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction, legendaryMaxUses, legendaryUsesRemaining,
  legendaryDelegateAction, legendaryDelegateAttackName, regainLegendaryUses,
} from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
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
  rangeToFeet: vi.fn(() => 5),
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
  { name: 'Gynosphinx 1', type: 'npc', monsterType: 'monstrosity', targetName: 'TestPC', currentHp: 136, maxHp: 136, ac: 17, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Gynosphinx 1.monsterLegendaryUses';
const LATCH_KEY = 'Gynosphinx 1._legendaryUses_usedRound';

const sphinx = () => monstersData.find(m => m.index === 'gynosphinx');
const legendary = () => sphinx().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const clawRow = () => sphinx().actions.find(a => a.name === 'Claw');

// MA-0956 data lock: economy header PREPENDED with numeric uses:2 (was: no
// header — rows[0] was the Claw Attack prose row). Description byte-mirrors
// the VERIFIED death-knight header (playbook §168) with death knight→sphinx.
describe('MA-0956 monsters.json data: gynosphinx legendary header authors uses:2', () => {
  it('rows[0] is the economy header with uses:2 (was: Claw Attack)', () => {
    expect(legendary()[0].name).toBe('Legendary Action Uses: 2');
    expect(legendary()[0].uses).toBe(2);
    expect(legendary()[1].name).toBe('Claw Attack');
    expect(legendaryHeaderAction(sphinx())).toBe(legendary()[0]);
    expect(legendaryMaxUses(legendary()[0], null)).toBe(2);
    expect(legendaryUsesRemaining(legendary()[0], { max: 2, used: 1 })).toBe(1);
    expect(legendary()[0].description).toBe("The sphinx takes 2 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only immediately after another creature's turn. The sphinx regains expended legendary uses at the start of its turn.");
  });

  it('header boilerplate mirrors the VERIFIED death-knight sibling byte-for-byte', () => {
    const dk = monstersData.find(m => m.index === 'death-knight').legendary_actions[0];
    const mirror = dk.description.replace(/\bdeath knight\b/g, 'sphinx');
    expect(legendary()[0].description).toBe(mirror);
  });

  it('Claw Attack delegates_to Claw, no own numeric mechanic, no per-child uses (§165)', () => {
    const claw = row('Claw Attack');
    expect(claw.delegates_to).toBe('Claw');
    expect(claw.description).toBe('The sphinx makes one claw attack.');
    expect(claw.attack_bonus).toBeUndefined();
    expect(claw.save_dc).toBeUndefined();
    expect(claw.uses).toBeUndefined();
  });

  it('delegate resolves the sphinx own Claw row: +9 / 2d8 + 4 slashing (MA-0955 twin)', () => {
    const claw = clawRow();
    expect(claw.attack_bonus).toBe(9);
    expect(claw.damage_dice_primary).toBe('2d8 + 4');
    expect(claw.damage_type_primary).toBe('slashing');
    const delegate = legendaryDelegateAction(sphinx(), row('Claw Attack'));
    expect(delegate).toBe(claw);
    expect(legendaryDelegateAttackName(row('Claw Attack'), claw)).toBe('Claw Attack (Claw attack)');
  });

  // MA-0957: advisory fields are the Androsphinx row byte-twins (were prose-
  // only silent-burn children); regex-free because byte equality + the sibling
  // suite's own copy lock subsume every fragment check.
  it('MA-0957 Teleport is an advisory row and the Androsphinx row byte-twin', () => {
    const t = row('Teleport (Costs 2 Actions)');
    expect(t.delegates_to).toBeUndefined();
    expect(t.advisory).toBe('sphinx_teleport');
    expect(t.attack_bonus).toBeUndefined();
    expect(t.save_dc).toBeUndefined();
    expect(t.description).toBe('The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.');
    const andro = monstersData.find(m => m.index === 'androsphinx').legendary_actions.find(a => a.name === 'Teleport (Costs 2 Actions)');
    expect(t.advisory).toBe(andro.advisory);
    expect(t.advisory_message).toBe(andro.advisory_message);
    expect(t.description).toBe(andro.description);
  });

  // MA-0958: the cast child rides the MA-0270 advisory seam with the
  // Androsphinx sibling KEY ("spellcast_adjudication") — message shape mirrors
  // the sibling grammar; copy deviates where honesty demands: gynosphinx DOES
  // author its spell list (prose Spellcasting trait, no structured container),
  // and RAW costs-3 EXCEEDS this card's disk-canonical uses:2 pool.
  it('MA-0958 Cast a Spell is an advisory row: sibling key + honest slot/cost/RAW-vs-pool copy', () => {
    const c = row('Cast a Spell (Costs 3 Actions)');
    expect(c.delegates_to).toBeUndefined();
    expect(c.attack_bonus).toBeUndefined();
    expect(c.save_dc).toBeUndefined();
    expect(c.uses).toBeUndefined();
    expect(c.description).toBe('The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.');
    expect(c.advisory).toBe('spellcast_adjudication');
    const andro = monstersData.find(m => m.index === 'androsphinx').legendary_actions.find(a => a.name === 'Cast a Spell (Costs 3 Actions)');
    expect(andro.advisory).toBe('spellcast_adjudication');
    expect(c.advisory).toBe(andro.advisory);
    expect(c.advisory_message).toMatch(/^casts a spell from its list of prepared spells, using a spell slot as normal — advisory record: /);
    expect(c.advisory_message).toMatch(/GM adjudicates spell choice and spell-slot spend/);
    expect(c.advisory_message).toMatch(/no monster spell-slot machinery app-wide/);
    expect(c.advisory_message).toMatch(/spell list lives only in the prose Spellcasting trait/);
    expect(c.advisory_message).toMatch(/RAW costs 3 legendary uses — exceeds this card's disk-canonical 2-use pool, RAW-unusable as printed/);
    expect(c.advisory_message).toMatch(/MA-1883 per-row cost parsing now refuses the press insufficient-cost with zero spend — spell-slot adjudication stays GM-enforced\.$/);
  });
});

// MA-0956 live seam: counter mounts on the gated branch, gated spend delegates
// the +9/2d8+4 Claw attack, refusals hold, turn-start regain clears
// (was: no counter, inert rows, click zero-delta, cs zero legendary keys).
// Generic modal legs (turn-latch re-click, exhausted, own-turn) belong to the
// template suite MonsterCardModal.legendary-uses.test.jsx (:310/:418/:190) and
// the service gates monsterLegendaryUses.test.js (:86/:93-97/:99-103); only
// the gynosphinx-distinct effect legs are here — one click per distinct row
// effect (delegate roll / exact-exhaust cost-2 advisory / insufficient-cost
// refusal) plus the uses:2 turn-start regain.
describe('MA-0956 MonsterCardModal gynosphinx gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderASphinx(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Gynosphinx',
      actions: sphinx().actions,
      legendary_actions: sphinx().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Gynosphinx 1', creatures: CREATURES })} />);
  }
  function sphinxRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('header shows (2 left); Claw Attack renders a gated Expend chip', () => {
    renderASphinx({ max: 2, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    const chip = sphinxRow('Claw Attack').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
  });

  it('Claw Attack gated click spends 1 and rolls the delegated +9 / 2d8 + 4 attack, zero console dead-end', async () => {
    renderASphinx({ max: 2, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(sphinxRow('Claw Attack').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Claw Attack (Claw attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(9);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d8 + 4');
    expect(options.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Claw Attack/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Claw Attack/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  // MA-0957: the gate-armed Teleport child must NOT silent-burn (MA-0696/
  // §98 shape: spend 1 + console.error "no resolvable mechanic", no popup).
  // With the advisory fields it routes the MA-0058 advisory seam: spend +
  // advisory popup + ability_use record, zero rolls, zero console dead-end.
  // MA-1883: canonical RAW cost 2 is now PAID per press (pre-fix spends-1
  // residual closed) — on the gynosphinx 2-pool this EXACTLY exhausts it.
  it('MA-0957 Teleport gated click spends its RAW cost 2 and lands the advisory record (popup + ability_use log), zero rolls, zero console dead-end', async () => {
    renderASphinx({ max: 2, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(sphinxRow('Teleport (Costs 2 Actions)').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 2 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    const html = String(setPopupHtml.mock.calls.map(c => String(c[0])).find(h => /Teleport/.test(h)));
    expect(html).toMatch(/Legendary Action — Teleport \(Costs 2 Actions\)/);
    expect(html).toMatch(/Canonical cost is 2 legendary uses — MA-1883 per-row cost parsing spends 2 per press/);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e =>
      e.type === 'ability_use' && e.abilityName === 'Teleport (Costs 2 Actions)' && /advisory record/.test(e.description))).toBe(true));
    const spends = addEntry.mock.calls.map(c => c[1]).filter(e => /spends 2 legendary uses for Teleport/.test(String(e.description)));
    expect(spends.length).toBe(1);
    expect(spends[0].description).toMatch(/0 of 2 left/);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  // MA-0958 + MA-1883: "(Costs 3 Actions)" on the disk-canonical uses:2 pool
  // is RAW-enforced — the press refuses insufficient-cost with zero spend,
  // zero advisory record: RAW-unusable as printed, exactly as the row's honest
  // copy promised. This leg is gynosphinx-DISTINCT: the Androsphinx sibling's
  // 3-use pool pays cost 3 fine (see legendary-uses-androsphinx.test.jsx).
  it('MA-0958+MA-1883 Cast a Spell gated click refuses insufficient-cost (3 > 2-use pool): zero spend, zero advisory record, zero console dead-end', async () => {
    renderASphinx({ max: 2, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chip = sphinxRow('Cast a Spell (Costs 3 Actions)').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    fireEvent.click(chip);
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    const popup = String(setPopupHtml.mock.calls.map(c => String(c[0])).find(h => /Legendary Action Refused/.test(h)));
    expect(popup).toMatch(/Cast a Spell \(Costs 3 Actions\) costs 3 legendary uses but Gynosphinx 1 has only 2 left/);
    expect(popup).toMatch(/Nothing spent, no roll\./);
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 0 });
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused' && /insufficient-cost: costs 3, 2 left/.test(String(e.description)))).toBe(true);
    expect(addEntry.mock.calls.map(c => c[1]).some(e => /advisory record/.test(String(e.description)))).toBe(false);
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('turn-start regain clears uses and latch with an ability_use log', async () => {
    runtime.store[KEY] = { max: 2, used: 2 };
    runtime.store[LATCH_KEY] = { round: 1, activeCreature: 'Thug 1' };
    const res = await regainLegendaryUses({
      monsterName: 'Gynosphinx 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: runtime.getRuntimeValue,
        setRuntimeValue: runtime.setRuntimeValue,
        addEntry,
      },
    });
    expect(res).toEqual({ regained: true, max: 2 });
    expect(runtime.store[KEY]).toEqual({ max: 2, used: 0 });
    expect(runtime.store[LATCH_KEY]).toBe(null);
    const regain = addEntry.mock.calls.map(c => c[1]).find(e => /regains all expended legendary action uses/.test(String(e.description)));
    expect(regain.description).toMatch(/Gynosphinx 1 regains all expended legendary action uses at the start of its turn — 2 available\./);
  });
});
