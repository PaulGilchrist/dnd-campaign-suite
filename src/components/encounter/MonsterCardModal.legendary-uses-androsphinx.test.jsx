// MA-0269 regression: Androsphinx legendary_actions had NO economy header at
// all — rows[0] WAS the Claw Attack prose row, so legendaryHeaderAction()
// returned null, the card rendered the UNGATED branch (no counter, no chips),
// "Claw Attack" was inert bare prose (live: 0 affordances, 2× click zero log
// delta), and Teleport/Cast a Spell were ungated-by-absence. Fix mirrors the
// MA-0145/MA-0262 DATA-only template: prepend header
// {name:"Legendary Action Uses: 3", uses:3} (no-lair shape per MA-0277;
// description boilerplate byte-mirrors the VERIFIED adult-white/silver
// headers minus the inapplicable lair sentence, subject swapped
// dragon→sphinx) and give Claw Attack delegates_to:"Claw" (MA-0220/0022
// seam; the MA-0220 movement-advisory parenthetical is pounce-specific and
// would be false prose on a pure delegated attack, so the description stays
// byte-identical to the verified MA-0022 Lash pure-delegate shape).
// Teleport (Costs 2 Actions) / Cast a Spell (Costs 3 Actions) are MA-0270/
// MA-0271 scope — once the header arms the gate their chips burn uses with
// console.error "no resolvable mechanic" (MA-0164 silent-burn) until fixed.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction, legendaryMaxUses, legendaryUsesRemaining,
  legendaryDelegateAction, legendaryDelegateAttackName,
  regainLegendaryUses, buildLegendaryAdvisoryPopup, buildLegendaryAdvisoryLog,
} from '../../services/encounters/monsterLegendaryUses.js';

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
  { name: 'Androsphinx 1', type: 'npc', monsterType: 'monstrosity', targetName: 'TestPC', currentHp: 199, maxHp: 199, ac: 17, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Androsphinx 1.monsterLegendaryUses';
const LATCH_KEY = 'Androsphinx 1._legendaryUses_usedRound';

const sphinx = () => monstersData.find(m => m.index === 'androsphinx');
const legendary = () => sphinx().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const clawRow = () => sphinx().actions.find(a => a.name === 'Claw');

// MA-0269 data lock: economy header PREPENDED with numeric uses:3 (was: no
// header at all — rows[0] was the Claw Attack prose row). No-lair shape per
// MA-0277; description is the verified adult-white/silver boilerplate minus
// the inapplicable lair sentence.
describe('MA-0269 monsters.json data: androsphinx legendary header authors uses:3', () => {
  it('rows[0] is the economy header with uses:3 (was: Claw Attack)', () => {
    expect(legendary()[0].name).toBe('Legendary Action Uses: 3');
    expect(legendary()[0].uses).toBe(3);
    expect(legendary()[1].name).toBe('Claw Attack');
    expect(legendaryHeaderAction(sphinx())).toBe(legendary()[0]);
    expect(legendaryMaxUses(legendary()[0], null)).toBe(3);
    expect(legendaryUsesRemaining(legendary()[0], { max: 3, used: 1 })).toBe(2);
    expect(legendary()[0].description).toBe("Immediately after another creature's turn, the sphinx can expend a use to take one of the following actions. The sphinx regains all expended uses at the start of each of its turns.");
  });

  it('header boilerplate mirrors the VERIFIED adult white/silver siblings', () => {
    for (const idx of ['adult-white-dragon', 'adult-silver-dragon']) {
      const sibling = monstersData.find(m => m.index === idx).legendary_actions[0];
      const mirror = sibling.description.replace(/\bdragon\b/g, 'sphinx').replace(/ In its lair the sphinx has 4 uses \(advisory — no lair flag consumer; GM-enforced\)\./, '');
      expect(legendary()[0].description).toBe(mirror);
    }
  });
});

// MA-0269: Claw Attack delegates_to:"Claw" (MA-0220/0022 seam) — the
// sphinx's OWN weapon is Claw; description stays byte-identical to the
// verified MA-0022 Lash pure-delegate shape (no movement clause applies).
describe('MA-0269 monsters.json data: Claw Attack delegates to Claw', () => {
  it('Claw Attack row delegates_to Claw, no own numeric mechanic', () => {
    const claw = row('Claw Attack');
    expect(claw.delegates_to).toBe('Claw');
    expect(claw.description).toBe('The sphinx makes one claw attack.');
    expect(claw.attack_bonus).toBeUndefined();
    expect(claw.save_dc).toBeUndefined();
  });

  it('delegate resolves the sphinx own Claw row: +12 / 2d10 + 6 slashing', () => {
    const claw = clawRow();
    expect(claw.attack_bonus).toBe(12);
    expect(claw.damage_dice_primary).toBe('2d10 + 6');
    expect(claw.damage_type_primary).toBe('slashing');
    const delegate = legendaryDelegateAction(sphinx(), row('Claw Attack'));
    expect(delegate).toBe(claw);
    expect(legendaryDelegateAttackName(row('Claw Attack'), claw)).toBe('Claw Attack (Claw attack)');
  });

  // MA-0956 stale-pin inversion (was: "byte-identical block UNTOUCHED" —
  // the gynosphinx twin hit the same prose-only defect and is now fixed the
  // same pass with the Death-Knight byte template: header uses:2 + Claw
  // delegates_to. MA-0957: Teleport advisory. MA-0958: Cast a Spell advisory
  // twin of this card's spellcast_adjudication row (honest 3-vs-2 pool copy).
  it('gynosphinx legendary block carries MA-0956 header + Claw delegate', () => {
    const gy = monstersData.find(m => m.index === 'gynosphinx').legendary_actions;
    expect(gy.length).toBe(4);
    expect(gy[0].name).toBe('Legendary Action Uses: 2');
    expect(gy[0].uses).toBe(2);
    expect(gy[1].name).toBe('Claw Attack');
    expect(gy[1].delegates_to).toBe('Claw');
    expect(gy[1].uses).toBeUndefined();
    expect(gy[2].delegates_to).toBeUndefined();
    expect(gy[3].delegates_to).toBeUndefined();
    expect(gy[3].advisory).toBe('spellcast_adjudication');
    expect(gy[3].advisory_message).toMatch(/GM adjudicates spell choice and spell-slot spend/);
  });
});

// MA-0270/0271: the header-armed children must not silent-burn (MA-0164).
// Both route through the MA-0058 advisory seam with row-authored honest copy
// (`advisory_message`): spend 1 + advisory popup + ability_use record, zero
// rolls. CLA-320: no position consumer app-wide — teleport relocation stays
// GM-enforced; no spell list is authored for androsphinx, so cast choice
// stays GM-adjudicated. Canonical costs 2/3 exceed the 1-per-click engine
// spend — the row copy records that honestly.
describe('MA-0270/0271 monsters.json data: advisory children, honest cost copy', () => {
  it('Teleport is an advisory row, no numeric mechanic, honest CLA-320 copy', () => {
    const t = row('Teleport (Costs 2 Actions)');
    expect(t.advisory).toBe('sphinx_teleport');
    expect(t.attack_bonus).toBeUndefined();
    expect(t.save_dc).toBeUndefined();
    expect(t.delegates_to).toBeUndefined();
    expect(t.advisory_message).toMatch(/GM moves the token, no position consumer \(CLA-320\)/);
    expect(t.advisory_message).toMatch(/Canonical cost is 2 legendary uses — the engine spends 1 per click/);
    expect(t.description).toBe('The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.');
  });

  it('Cast a Spell is an advisory row — GM adjudicates, no spell list authored', () => {
    const c = row('Cast a Spell (Costs 3 Actions)');
    expect(c.advisory).toBe('spellcast_adjudication');
    expect(c.attack_bonus).toBeUndefined();
    expect(c.save_dc).toBeUndefined();
    expect(c.delegates_to).toBeUndefined();
    expect(c.advisory_message).toMatch(/GM adjudicates spell choice, no spell list authored/);
    expect(c.advisory_message).toMatch(/Canonical cost is 3 legendary uses — the engine spends 1 per click/);
    expect(c.description).toBe('The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.');
  });

  it('advisory builders use row copy for sphinx rows and MA-0058 fallback byte-identical for Cloaked Flight', () => {
    const popup = buildLegendaryAdvisoryPopup({ monsterName: 'Androsphinx 1', action: row('Teleport (Costs 2 Actions)') });
    expect(popup).toMatch(/Legendary Action — Teleport \(Costs 2 Actions\)/);
    expect(popup).toMatch(/GM moves the token, no position consumer \(CLA-320\)/);
    expect(popup).not.toMatch(/invisibility/);
    const tlog = buildLegendaryAdvisoryLog({ monsterName: 'Androsphinx 1', action: row('Cast a Spell (Costs 3 Actions)') });
    expect(tlog.type).toBe('ability_use');
    expect(tlog.abilityName).toBe('Cast a Spell (Costs 3 Actions)');
    expect(tlog.description).toMatch(/GM adjudicates spell choice, no spell list authored/);
    const cloaked = monstersData.find(m => m.index === 'adult-blue-dragon').legendary_actions.find(a => a.name === 'Cloaked Flight');
    expect(buildLegendaryAdvisoryPopup({ monsterName: 'Ancient Blue Dragon 1', action: cloaked })).toBe(
      '<div class="mc-prerequisite-refusal"><h3>Legendary Action — Cloaked Flight</h3><p>Ancient Blue Dragon 1 casts invisibility on itself via Spellcasting. Advisory record: the invisibility and half-Fly-Speed movement are GM-enforced (no invisibility/movement-distance consumer). Ancient Blue Dragon 1 can\'t take this action again until the start of its next turn.</p></div>');
    expect(buildLegendaryAdvisoryLog({ monsterName: 'Ancient Blue Dragon 1', action: cloaked }).description).toBe(
      'Ancient Blue Dragon 1 legendary action Cloaked Flight: casts invisibility on itself — advisory record: invisibility and half-Fly-Speed movement are GM-enforced (no invisibility/movement-distance consumer, CLA-325).');
  });
});

// MA-0269 live seam: counter mounts DESPITE the prepend, gated spend
// delegates the +12/2d10+6 Claw attack, exhaustion refuses, turn-start
// regain clears (was: no counter, inert rows, 2× click zero-delta).
describe('MA-0269 MonsterCardModal androsphinx gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderASphinx(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Androsphinx',
      actions: sphinx().actions,
      legendary_actions: sphinx().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Androsphinx 1', creatures: CREATURES })} />);
  }
  function sphinxRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('header shows (3 left) despite the prepend; Claw Attack renders a gated chip', () => {
    renderASphinx({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const chip = sphinxRow('Claw Attack').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
  });

  it('Claw Attack gated click spends 1 and rolls the delegated +12 / 2d10 + 6 attack, zero console dead-end', async () => {
    renderASphinx({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(sphinxRow('Claw Attack').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Claw Attack (Claw attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(12);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d10 + 6');
    expect(options.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Claw Attack/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Claw Attack/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('repeat same-window refuses (turn latch): zero extra spend, one spend log', async () => {
    renderASphinx({ max: 3, used: 0 });
    const chip = sphinxRow('Claw Attack').querySelector('.mc-dice-link-legendary');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    const spends = addEntry.mock.calls.map(c => c[1]).filter(e => /expends a legendary use for Claw Attack/.test(String(e.description)));
    expect(spends.length).toBe(1);
  });

  it('Teleport gated click spends 1 and lands the advisory record (popup + ability_use log), zero rolls, zero console dead-end', async () => {
    renderASphinx({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(sphinxRow('Teleport (Costs 2 Actions)').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    const html = String(setPopupHtml.mock.calls.map(c => String(c[0])).find(h => /Teleport/.test(h)));
    expect(html).toMatch(/Legendary Action — Teleport \(Costs 2 Actions\)/);
    expect(html).toMatch(/GM moves the token, no position consumer \(CLA-320\)/);
    expect(html).toMatch(/Canonical cost is 2 legendary uses — the engine spends 1 per click/);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e =>
      e.type === 'ability_use' && e.abilityName === 'Teleport (Costs 2 Actions)' && /advisory record/.test(e.description))).toBe(true));
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('Cast a Spell gated click spends 1 and lands the advisory record (popup + ability_use log), zero rolls, zero console dead-end', async () => {
    renderASphinx({ max: 3, used: 1 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(sphinxRow('Cast a Spell (Costs 3 Actions)').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 2 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    const html = String(setPopupHtml.mock.calls.map(c => String(c[0])).find(h => /Cast a Spell/.test(h)));
    expect(html).toMatch(/Legendary Action — Cast a Spell \(Costs 3 Actions\)/);
    expect(html).toMatch(/GM adjudicates spell choice, no spell list authored/);
    expect(html).toMatch(/Canonical cost is 3 legendary uses — the engine spends 1 per click/);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e =>
      e.type === 'ability_use' && e.abilityName === 'Cast a Spell (Costs 3 Actions)' && /advisory record/.test(e.description))).toBe(true));
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('exhausted (3/3): chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderASphinx({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(sphinxRow('Claw Attack').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('own-turn click refuses (turn latch): zero spend, zero roll', async () => {
    renderASphinx({ max: 3, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Androsphinx 1', creatures: CREATURES };
    fireEvent.click(sphinxRow('Claw Attack').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('not its own');
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('turn-start regain clears uses and latch with an ability_use log', async () => {
    runtime.store[KEY] = { max: 3, used: 2 };
    runtime.store[LATCH_KEY] = { round: 1, activeCreature: 'Thug 1' };
    const res = await regainLegendaryUses({
      monsterName: 'Androsphinx 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: runtime.getRuntimeValue,
        setRuntimeValue: runtime.setRuntimeValue,
        addEntry,
      },
    });
    expect(res).toEqual({ regained: true, max: 3 });
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(runtime.store[LATCH_KEY]).toBe(null);
    const regain = addEntry.mock.calls.map(c => c[1]).find(e => /regains all expended legendary action uses/.test(String(e.description)));
    expect(regain.description).toMatch(/Androsphinx 1 regains all expended legendary action uses at the start of its turn — 3 available\./);
  });
});
