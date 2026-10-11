// MA-1863 regression: Behemoth legendary_actions[3] "Trumpet (Costs 2 Actions)"
// authored name+description only — the gated chip spent a use then fall-through'd
// resolveLegendaryRowMechanic (MonsterCardModal.jsx:715) with console.error
// "no resolvable mechanic" (MA-0510/0696 silent-burn family): DC 23 Wisdom was
// never enforced and the fail-face reaction-block landed NOTHING.
// Fix is DATA-only, mirroring the MA-0711 Euphoria-Breath inline slowed-clause
// byte-shape (save_effect "can't take Reactions" → parseSlowedClauses arms the
// registered te no_reactions): numeric save_dc > 0 makes the row render its OWN
// "DC 23 Wisdom" chip riding the shared header gate (LegendarySpendLink
// self-suppresses, MonsterAction.jsx:192), and block-save inline fire() threads
// slowedClauses + conditionDurationNote ("until the end of its next turn" →
// resolveInlineSlowedDuration /next turn/ fork → rounds:2, MA-0073 clock shape).
// dc_success:"none" — condition-only row, half-default would leak fake
// "takes half damage" copy (MV-20/§335). NO costs/cost-token authored:
// "Costs 2 Actions" rides the row name — MA-1883 per-row cost parsing
// (legendaryActionCost) spends 2 per press, closing the MA-1847/MA-1839
// spends-1 ADVISORY floor. NO delegates_to (row self-resolves),
// NO advisory, NO structured range (multi-enemy roar "within 60 ft." carries no
// shape token → breathAoeShape null → inline single-target-vs-armed degradation,
// accepted per orchestrator adjudication §162/§1843).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { parseSlowedClauses } from './MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 2, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 2, 2], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => {
  const r = { rollAttack: null, rollDamage: null, rollSavingThrow: null };
  return r;
});
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
  rangeToFeet: vi.fn(() => 60),
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
  { name: 'Behemoth 1', type: 'npc', monsterType: 'monstrosity', targetName: 'Bandit 1', currentHp: 594, maxHp: 594, ac: 18, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const behemoth = () => monstersData.find(m => m.name === 'Behemoth');
const legendaryRows = () => behemoth().legendary_actions;
const headerRow = () => legendaryRows()[0];
const trumpetRow = () => legendaryRows()[3];

// MA-1863 data lock: the formerly inert prose-only legendary save row now
// authors the MA-0711 inline slowed-clause byte-shape — the DC 23 Wisdom save
// is enforced and the fail face grants the registered te no_reactions with the
// end-of-target's-next-turn duration fork.
describe('MA-1863 monsters.json data: Behemoth Trumpet legendary save row', () => {
  it('rows[0] header owns the economy + no child authors uses (§165)', () => {
    expect(headerRow().name).toBe('Legendary Action Uses: 3');
    expect(headerRow().uses).toBe(3);
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
    }
  });

  it('Trumpet row carries save_dc 23 + save_type Wisdom + dc_success none + save_effect transport', () => {
    const row = trumpetRow();
    expect(row.name).toBe('Trumpet (Costs 2 Actions)');
    expect(row.save_dc).toBe(23);
    expect(row.save_type).toBe('Wisdom');
    expect(row.dc_success).toBe('none');
    expect(row.save_effect).toBe("The target can't take Reactions until the end of its next turn.");
  });

  it('name + description stay RAW byte-identical (§383 anchor innocence)', () => {
    const row = trumpetRow();
    expect(row.name).toBe('Trumpet (Costs 2 Actions)');
    expect(row.description).toBe('Behemoth bellows. Each enemy within 60 ft. that can hear it must succeed on a DC 23 Wisdom saving throw or be unable to use Reactions until the end of its next turn.');
  });

  it('no costs/cost-token, no delegates_to, no advisory, no structured range (MA-1847 advisory floor + §162 accepted inline degradation)', () => {
    const row = trumpetRow();
    expect(row.costs).toBeUndefined();
    expect(row.delegates_to).toBeUndefined();
    expect(row.advisory).toBeUndefined();
    expect(row.range).toBeUndefined();
    expect(row.damage_dice_primary).toBeUndefined();
  });

  it('parse lock: save_effect arms te no_reactions ONLY (MA-0087 byte-shape twin of Spectator Confusion Ray)', () => {
    expect(parseSlowedClauses(trumpetRow().save_effect)).toEqual({ effects: ['no_reactions'] });
  });

  it('duration fork feeds rounds:2 — "until the end of its next turn" (§216 consumer fork)', () => {
    const note = extractConditionDurationNote(trumpetRow().save_effect);
    expect(note).toBe("until the end of its next turn (GM-enforced)");
    expect(/next turn/i.test(note)).toBe(true);
  });

  it('resolvable-mechanic gate: numeric save_dc > 0 routes the save leg (MonsterCardModal.jsx:693), never the :715 console dead-end', () => {
    expect(Number(trumpetRow().save_dc) > 0).toBe(true);
  });
});

// MA-1863 live seam: the row renders its OWN "DC 23 Wisdom" chip riding the
// shared legendary gate (Expend chip self-suppressed, MonsterAction.jsx:192);
// a boundary click spends ONE use (2-cost stays advisory, MA-1847/MA-1839
// floor) then rolls the DC 23 Wisdom save vs the armed target with the
// slowedClauses transport threaded — no console.error silent burn.
describe('MA-1863 MonsterCardModal Behemoth Trumpet resolves as a DC 23 Wisdom save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  function renderBehemoth(uses) {
    runtime.store['Behemoth 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Behemoth',
      actions: behemoth().actions,
      legendary_actions: behemoth().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Behemoth 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }
  function trumpChip() {
    return laRow('Trumpet')?.querySelector('.mc-dice-link-save-clickable') || null;
  }

  it('row renders ONE "DC 23 Wisdom" save chip and NO Expend Legendary chip (numeric self-suppress, §204/MA-1846)', () => {
    renderBehemoth({ max: 3, used: 0 });
    const row = laRow('Trumpet');
    expect(row).not.toBe(null);
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    const chip = trumpChip();
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('DC 23 Wisdom');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
  });

  it('chip press spends its RAW cost 2 (MA-1883) then rolls DC 23 Wisdom with no_reactions transport — zero silent burn', async () => {
    renderBehemoth({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(trumpChip());
    await waitFor(() => expect(runtime.store['Behemoth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const [abbr, , options] = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(abbr).toBe('WIS');
    expect(options.saveDc).toBe(23);
    expect(options.saveType).toBe('Wisdom');
    expect(options.dcSuccess).toBe('none');
    expect(options.targetName).toBe('Bandit 1');
    expect(options.autoDamageFormula).toBeNull();
    expect(options.saveConditions).toEqual([]);
    expect(options.slowedClauses).toEqual({ effects: ['no_reactions'] });
    expect(options.conditionDurationNote).toMatch(/until the end of its next turn/);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Trumpet/.test(String(e.description)));
    // MA-1883: "(Costs 2 Actions)" pays its RAW cost — spends 2 of 3.
    expect(spend.description).toMatch(/spends 2 legendary uses for Trumpet \(Costs 2 Actions\).*1 of 3 left/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('exhausted (3/3): press refuses with legendary_use_refused popup, zero spend, zero save (§339)', async () => {
    renderBehemoth({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(trumpChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Behemoth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
