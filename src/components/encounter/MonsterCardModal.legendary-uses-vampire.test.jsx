// @maintained-by-ai
// MA-1640 regression: Vampire "Beguile" (legendary_actions[1] post-fix; pre-fix
// rows[0].uses:1) was swallowed as the economy header (§99 header-swallow):
// legendaryHeaderAction matched rows[0].uses != null and returned Beguile itself,
// the card rendered "Beguile (1 left)" + full prose in a plain no-onClick header
// div (MonsterCardBody slice(1)), LegendarySpendLink never ran — ZERO affordance
// on the Command cast row, click ×2 zero-delta, counter "(1 left)" under-reporting
// the RAW floor 2 (children count). Fix mirrors the MA-1635 unicorn + MA-1204
// mummy-lord disk twins: canonical header {name:"Legendary Action Uses: 2",
// uses:2} (floor = children count; vampire lair_actions is a raw-string block, no
// "(N in Lair)" clause, no lair bump §231), Beguile authored the SAME pass as a
// NUMERIC save child (MA-1204 Dread Command byte-twin: save_dc 17 = 8 + CHA +4 +
// PB +5, Wisdom per spells.json Command, dc_success:"none", range "60 feet",
// save_effect carrying the obey-clause honestly as GM-enforced advisory MA-0058
// family), per-child uses/recharge dropped §165 (header owns the pool).
// Trim pass 2026-10-18 (#635/#637): Deathless Strike delegates_to:"Grave Strike"
// byte-shape + delegated +9 click is MA-1641-sole-owned
// (legendary-uses-vampire-ma1641.test.jsx Object.keys lock — rec #637 cite-only).
// §165 child loop cut: both vampire children individually pinned (Beguile below;
// Deathless Strike via ma1641 key lock); unicorn twin children -> unicorn owner
// :116-143. Gate-math generics cite monsterLegendaryUses.test.js:79-110
// (allow-after-other / latch / own-turn / exhausted); modal-level latch-refire,
// exhausted and own-turn refusal clicks cite unicorn :170-235 and beholder
// :213-223 (#625/#626 sole exhausted sibling); hasLegendaryCooldownClause unit
// leg absorbed by the click leg's COOLDOWNS_KEY stamp below. Dead mocks purged
// by empirical bisect: diceRoller never fires on this lane — the only click is
// the save chip, fully rolled through the mocked rollSavingThrow. damageUtils
// mock KEPT fail-open-caution (#634): getCombatContext arms the gate; if it
// resolved null the refusals would fail open.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spellsData from '../../../public/data/spells.json';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => {
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  return { rollAttack, rollDamage, rollSavingThrow };
});
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: ROLLERS.rollAttack, rollDamage: ROLLERS.rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow: ROLLERS.rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));
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
  { name: 'Vampire 1', type: 'npc', monsterType: 'undead', targetName: 'Bandit 1', currentHp: 195, maxHp: 195, ac: 16, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 11, maxHp: 11, ac: 12, conditions: [] },
];

const KEY = 'Vampire 1.monsterLegendaryUses';
const COOLDOWNS_KEY = 'Vampire 1.monsterLegendaryActionCooldowns';

const vampire = () => monstersData.find(m => m.name === 'Vampire');
const legendary = () => vampire().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const commandSpell = () => spellsData.find(s => s.name === 'Command');

describe('MA-1640 monsters.json data lock: canonical header + Beguile numeric save child', () => {
  it('rows[0] is the canonical uses:2 header, not a swallowed child; boilerplate byte-mirrors the VERIFIED unicorn twin (unicorn→vampire swap)', () => {
    const la = legendary();
    expect(la[0].name).toBe('Legendary Action Uses: 2');
    expect(la[0].uses).toBe(2);
    expect(la[0].name).not.toMatch(/Beguile|Deathless/);
    expect(la[0].delegates_to).toBeUndefined();
    const unicornHeader = monstersData.find(m => m.name === 'Unicorn').legendary_actions[0];
    expect(la[0].description).toBe(unicornHeader.description.replace(/unicorn/g, 'vampire'));
  });

  it('Beguile is a numeric save child — DC 17 = 8 + CHA +4 + PB +5, Wisdom per spells.json Command, own uses/recharge dropped (§165), obey-clause zero condition grants (MA-0058)', () => {
    const beg = row('Beguile');
    expect(beg.save_dc).toBe(17);
    expect(beg.save_type).toBe('Wisdom');
    expect(beg.dc_success).toBe('none');
    expect(beg.range).toBe('60 feet');
    expect(beg.delegates_to).toBeUndefined();
    expect(beg.advisory).toBeUndefined();
    expect(beg.uses).toBeUndefined();
    expect(beg.recharge).toBeUndefined();
    expect(beg.save_effect).toMatch(/^Failure: The target obeys the vampire's one-word command on its next turn/);
    expect(beg.save_effect).toMatch(/Success: The target is unaffected\.$/);
    expect(extractConditionsFromSaveEffect(beg.save_effect)).toEqual([]);
    // DC arithmetic on disk truth + cross-source spells.json lock (Command = WIS, none, 60 ft).
    expect(8 + vampire().ability_score_modifiers.cha + vampire().proficiency_bonus).toBe(17);
    const cmd = commandSpell();
    expect(cmd.dc.dc_type).toBe('WIS');
    expect(cmd.dc.dc_success).toBe('none');
    expect(cmd.range).toBe('60 feet');
  });
});

describe('MA-1640 MonsterCardModal vampire gated legendary economy', () => {
  let consoleSpy;
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { consoleSpy.mockRestore(); });

  function renderVampire(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Vampire',
      actions: vampire().actions,
      legendary_actions: legendary(),
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Vampire 1', creatures: CREATURES })} />);
  }
  function vRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.trim().startsWith(name));
  }

  it('header shows "Legendary Action Uses: 2 (2 left)"; Beguile renders gated DC 17 Wisdom save chip — the affordance the header-swallow killed (§204 shape)', () => {
    renderVampire({ max: 2, used: 0 });
    expect(document.querySelector('.mc-legendary-header-row').textContent).toContain('Legendary Action Uses: 2');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(2 left)');
    expect(document.querySelector('.mc-legendary-header-row').textContent).not.toContain('Beguile');
    const chip = vRow('Beguile').querySelector('.mc-dice-link-save-clickable');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('DC 17');
    expect(chip.textContent).toContain('Wisdom');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('Beguile save-chip click spends 2→1, adjudicates DC 17 WIS vs armed Bandit (effect-distinct ctx, once), stamps until-next-turn cooldown (§204 owner latch — absorbs hasLegendaryCooldownClause + gate-allow + latch legs), honest spend log, console clean', async () => {
    renderVampire({ max: 2, used: 0 });
    fireEvent.click(vRow('Beguile').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 2, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(17);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.targetName).toBe('Bandit 1');
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ beguile: { round: 1 } }));
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Beguile/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Beguile/);
    expect(spend.description).toMatch(/1 of 2 left/);
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
