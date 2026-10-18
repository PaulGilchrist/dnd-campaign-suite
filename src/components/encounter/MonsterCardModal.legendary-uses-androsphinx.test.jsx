// MA-0269 regression: Androsphinx legendary_actions had NO economy header at
// all — rows[0] WAS the Claw Attack prose row, so legendaryHeaderAction()
// returned null, the card rendered the UNGATED branch (no counter, no chips),
// "Claw Attack" was inert bare prose, and Teleport/Cast a Spell were
// ungated-by-absence. Fix mirrors the MA-0145/MA-0262 DATA-only template:
// prepend header {name:"Legendary Action Uses: 3", uses:3} (no-lair shape per
// MA-0277; description is the verified adult-white/silver boilerplate minus
// the inapplicable lair sentence, dragon→sphinx) and give Claw Attack
// delegates_to:"Claw" (MA-0220/0022 seam; the movement-advisory parenthetical
// is pounce-specific and false on a pure delegated attack).
// MA-0270/0271 + MA-1883: Teleport (Costs 2) / Cast a Spell (Costs 3) route
// the MA-0058 advisory seam with row-authored honest copy; per-row cost
// parsing spends N per press (pre-fix spends-1 residual closed). CLA-320:
// no position consumer app-wide — teleport relocation stays GM-enforced; no
// spell list is authored for androsphinx, so cast choice stays GM-adjudicated.
//
// CITATION-SKIP (generic engine, do not re-litigate here):
// header/max/remaining monsterLegendaryUses.test.js:65-73, turn-latch :86/:136,
// own-turn :93-97, exhausted :99-103/:124, regain :146-155, refusal log :164,
// delegation seam :171-201, advisory builders + Cloaked Flight fallback :607-617;
// modal render/latch/exhausted templates MonsterCardModal.legendary-uses.test.jsx
// (:178/:190/:310/:418/:543/:731/:853). Gynosphinx twin data+economy lives in
// MonsterCardModal.legendary-uses-gynosphinx.test.jsx (MA-0956/0957/0958) — its
// claw is +9/2d8+4 and its 2-use pool makes cost-2/3 pays impossible, so the
// androsphinx-distinct bytes kept here are: no-lair uses:3 header, Claw
// delegate +12 / 2d10 + 6, and the full cost-2 and cost-3 advisory pays.
// @maintained-by-ai
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

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

const sphinx = () => monstersData.find(m => m.index === 'androsphinx');
const legendary = () => sphinx().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const clawRow = () => sphinx().actions.find(a => a.name === 'Claw');

// MA-0269 data lock: economy header PREPENDED with numeric uses:3 (was: no
// header at all) + Claw Attack pure-delegate onto the sphinx's OWN weapon.
describe('MA-0269 monsters.json data: header uses:3 no-lair, Claw Attack delegates own Claw', () => {
  it('rows[0] is the economy header; Claw Attack delegates_to Claw +12 / 2d10 + 6 slashing', () => {
    expect(legendary()[0].name).toBe('Legendary Action Uses: 3');
    expect(legendary()[0].uses).toBe(3);
    expect(legendary()[0].description).toBe("Immediately after another creature's turn, the sphinx can expend a use to take one of the following actions. The sphinx regains all expended uses at the start of each of its turns.");
    expect(legendary()[1].name).toBe('Claw Attack');
    const claw = row('Claw Attack');
    expect(claw.delegates_to).toBe('Claw');
    expect(claw.description).toBe('The sphinx makes one claw attack.');
    expect(claw.attack_bonus).toBeUndefined();
    expect(claw.save_dc).toBeUndefined();
    const own = clawRow();
    expect(own.attack_bonus).toBe(12);
    expect(own.damage_dice_primary).toBe('2d10 + 6');
    expect(own.damage_type_primary).toBe('slashing');
  });

  it('Teleport and Cast a Spell are advisory rows with honest cost/CLA-320 copy, no numeric mechanic', () => {
    const t = row('Teleport (Costs 2 Actions)');
    expect(t.advisory).toBe('sphinx_teleport');
    expect(t.attack_bonus).toBeUndefined();
    expect(t.save_dc).toBeUndefined();
    expect(t.delegates_to).toBeUndefined();
    expect(t.advisory_message).toMatch(/GM moves the token, no position consumer \(CLA-320\)/);
    expect(t.advisory_message).toMatch(/Canonical cost is 2 legendary uses — MA-1883 per-row cost parsing spends 2 per press/);
    expect(t.description).toBe('The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.');
    const c = row('Cast a Spell (Costs 3 Actions)');
    expect(c.advisory).toBe('spellcast_adjudication');
    expect(c.attack_bonus).toBeUndefined();
    expect(c.save_dc).toBeUndefined();
    expect(c.delegates_to).toBeUndefined();
    expect(c.advisory_message).toMatch(/GM adjudicates spell choice, no spell list authored/);
    expect(c.advisory_message).toMatch(/Canonical cost is 3 legendary uses — MA-1883 per-row cost parsing spends 3 per press/);
    expect(c.description).toBe('The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.');
  });
});

// MA-0269 live seam: counter mounts DESPITE the prepend and every row click
// routes once through the gated spend (was: no counter, inert rows, 2× click
// zero-delta). Gate/latch/refusal/regain mechanics cite monsterLegendaryUses
// .test.js + the legendary-uses.test.jsx template — here only the distinct
// androsphinx effects: delegated +12/2d10+6 roll and the MA-1883 full
// cost-2 and cost-3 advisory pays (unpayable on the gynosphinx 2-pool twin).
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

  it('header shows (3 left); Claw Attack click spends 1 and rolls the delegated +12 / 2d10 + 6 attack, zero console dead-end', async () => {
    renderASphinx({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const chip = sphinxRow('Claw Attack').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Claw Attack (Claw attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(12);
    expect(ROLLERS.rollAttack.mock.calls[0][2].autoDamageFormula).toBe('2d10 + 6');
    expect(ROLLERS.rollAttack.mock.calls[0][2].targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Claw Attack/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Claw Attack/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('Teleport click pays its RAW cost 2 of 3 and lands the advisory record (popup + ability_use log), zero rolls, zero console dead-end', async () => {
    renderASphinx({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(sphinxRow('Teleport (Costs 2 Actions)').querySelector('.mc-dice-link-legendary'));
    // MA-1883: "(Costs 2 Actions)" spends 2 — the pre-fix spends-1 residual closed.
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 2 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    const html = String(setPopupHtml.mock.calls.map(c => String(c[0])).find(h => /Teleport/.test(h)));
    expect(html).toMatch(/Legendary Action — Teleport \(Costs 2 Actions\)/);
    expect(html).toMatch(/GM moves the token, no position consumer \(CLA-320\)/);
    expect(html).toMatch(/Canonical cost is 2 legendary uses — MA-1883 per-row cost parsing spends 2 per press/);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e =>
      e.type === 'ability_use' && e.abilityName === 'Teleport (Costs 2 Actions)' && /advisory record/.test(e.description))).toBe(true));
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('Cast a Spell click pays its RAW cost 3 and lands the advisory record (popup + ability_use log), zero rolls, zero console dead-end', async () => {
    renderASphinx({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(sphinxRow('Cast a Spell (Costs 3 Actions)').querySelector('.mc-dice-link-legendary'));
    // MA-1883: "(Costs 3 Actions)" spends the full 3-use RAW cost.
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    const html = String(setPopupHtml.mock.calls.map(c => String(c[0])).find(h => /Cast a Spell/.test(h)));
    expect(html).toMatch(/Legendary Action — Cast a Spell \(Costs 3 Actions\)/);
    expect(html).toMatch(/GM adjudicates spell choice, no spell list authored/);
    expect(html).toMatch(/Canonical cost is 3 legendary uses — MA-1883 per-row cost parsing spends 3 per press/);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e =>
      e.type === 'ability_use' && e.abilityName === 'Cast a Spell (Costs 3 Actions)' && /advisory record/.test(e.description))).toBe(true));
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });
});
