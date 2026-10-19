// @maintained-by-ai
// MA-0220 regression: Ancient Gold Dragon legendary "Pounce" was inert prose
// ("The dragon moves up to half its Speed, and it makes one Rend attack.") —
// the gated "Expend Legendary" chip spent a use then console.errored "no
// resolvable mechanic" (zero roll/log/damage; MA-0164/0219 fingerprint).
// Fix mirrors the verified MA-0040/0197 DATA-only shape (adult/ancient
// siblings): delegates_to:"Rend" resolves the dragon's OWN Rend row (+17 /
// 2d8 + 10 Slashing + 2d8 Fire) through the MA-0022 delegate attack seam,
// logging "Pounce (Rend attack)"; half-Speed movement stays advisory (§7).
// Generic refusal legs are cite-skipped to their owners: exhausted pool
// MonsterCardModal.legendary-uses.test.jsx:195-212 (its canonical trimmed leg
// already absorbs the deleted ancient-gold exhausted dup bytes), turn latch
// same file :309-316, own-turn full-popup bytes pounce-shadow-dragon.test.jsx
// :300-305 — shared gate (monsterLegendaryUses.js), not re-asserted here.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { legendaryDelegateAction, legendaryDelegateAttackName } from '../../services/encounters/monsterLegendaryUses.js';

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
  { name: 'Ancient Gold Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 546, maxHp: 546, ac: 22, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const ancientGold = () => monstersData.find(m => m.name === 'Ancient Gold Dragon');
const pounceRow = () => ancientGold().legendary_actions.find(a => a.name === 'Pounce');
const rendRow = () => ancientGold().actions.find(a => a.name === 'Rend');

// MA-0220 data lock (folded): the Pounce row is the full-row {name,
// delegates_to, description} shape — no own numeric mechanic by design, the
// half-Speed movement advisory annotated into description, byte-identical to
// the verified ancient pounce siblings (MA-0197 family: Bronze/Copper/Black,
// MA-0259 ancient-white mirror) — and the delegate seam resolves the dragon's
// OWN Rend row (+17 / 2d8 + 10 Slashing + 2d8 Fire), labelled
// "Pounce (Rend attack)" (gold Rend carries no save_dc decoy, unlike the
// shadow-dragon "(Rend save)" household quirk).
describe('MA-0220 monsters.json data: ancient gold dragon Pounce delegates to Rend', () => {
  it('full-row delegates_to Rend with the half-Speed advisory prose, byte-identical to Bronze/Copper/Black siblings; own Rend +17 / 2d8 + 10 Slashing + 2d8 Fire resolves through the delegate seam', () => {
    const row = pounceRow();
    expect(Object.keys(row)).toEqual(['name', 'delegates_to', 'description']);
    expect(row.name).toBe('Pounce');
    expect(row.delegates_to).toBe('Rend');
    expect(row.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(row.attack_bonus).toBeUndefined();
    expect(row.save_dc).toBeUndefined();
    for (const name of ['Ancient Bronze Dragon', 'Ancient Copper Dragon', 'Ancient Black Dragon']) {
      const sibling = monstersData.find(m => m.name === name)?.legendary_actions?.find(a => a.name === 'Pounce');
      expect(sibling?.delegates_to).toBe('Rend');
      expect(sibling?.description).toBe(row.description);
    }
    const rend = rendRow();
    expect(rend.attack_bonus).toBe(17);
    expect(rend.damage_dice_primary).toBe('2d8 + 10');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('2d8');
    expect(rend.damage_type_secondary).toBe('Fire');
    expect(legendaryDelegateAction(ancientGold(), row)).toBe(rend);
    expect(legendaryDelegateAttackName(row, rend)).toBe('Pounce (Rend attack)');
  });
});

// MA-0220 live seam (press-folded): counter + gated "Expend Legendary" chip
// render on the prose row; one boundary click spends 1 use then rolls the
// delegated +17 Rend attack (armed target, 2d8 + 10 Slashing auto-damage +
// 2d8 Fire secondary, non-spell) and logs the spend. Refusal legs
// (exhausted/latch/own-turn) are owned elsewhere — see header cites.
describe('MA-0220 MonsterCardModal ancient gold dragon Pounce gated delegate press', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderAGold(uses) {
    runtime.store['Ancient Gold Dragon 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Ancient Gold Dragon',
      actions: ancientGold().actions,
      legendary_actions: ancientGold().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient Gold Dragon 1', creatures: CREATURES })} />);
  }
  function goldRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('counter (3 left) + gated chip; press spends 1 and rolls the delegated +17 Rend attack (armed target, 2d8 + 10 + 2d8 Fire), logs the spend, no save leg, zero console dead-end', async () => {
    renderAGold({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const chip = goldRow('Pounce').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store['Ancient Gold Dragon 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(17);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d8 + 10');
    expect(options.autoDamageName).toBe('Pounce (Rend attack)');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('2d8');
    expect(options.autoDamageSecondaryDamageType).toBe('Fire');
    expect(options.isSpellDamage).toBe(false);
    expect(options.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Pounce/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Pounce/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });
});
