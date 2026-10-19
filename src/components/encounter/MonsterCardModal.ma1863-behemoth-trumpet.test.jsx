// @maintained-by-ai
// MA-1863 regression: Behemoth legendary_actions[3] "Trumpet (Costs 2 Actions)"
// authored name+description only — the gated chip spent a use then fall-through'd
// resolveLegendaryRowMechanic (MonsterCardModal.jsx:715) with console.error
// "no resolvable mechanic" (MA-0510/0696 silent-burn family): DC 23 Wisdom was
// never enforced and the fail-face reaction-block landed NOTHING.
// Fix is DATA-only, mirroring the MA-0711 Euphoria-Breath inline slowed-clause
// byte-shape: numeric save_dc > 0 routes the save leg (:693, never the :715
// dead-end), the row renders its OWN "DC 23 Wisdom" chip riding the shared
// header gate (Expend chip self-suppresses, MonsterAction.jsx:192), and the
// block-save inline fire() threads slowedClauses (parseSlowedClauses arms the
// registered te no_reactions) + the /next turn/ duration-note fork (§216).
// dc_success:"none" — condition-only row, half-default would leak fake
// "takes half damage" copy (MV-20/§335). "Costs 2 Actions" rides the row NAME
// — MA-1883 legendaryActionCost spends 2 per press (MA-1847/MA-1839 floor).
// NO costs/cost-token, NO delegates_to (row self-resolves), NO advisory, NO
// structured range (shapeless "within 60 ft." prose → breathAoeShape null →
// inline single-target-vs-armed degradation, accepted §162/§1843).
// Lane cites (owned elsewhere, not duplicated here): save adjudication + parser
// locks (no_reactions grant rounds:2, success face, Gore byte-inert) →
// saveProcessing.ma1863-behemoth-trumpet.test.js:132-191; "(Costs N Actions)"
// cost parse incl. Trumpet=2 + engine spend/insufficient-cost refusals →
// monsterLegendaryUses.ma1883-demogorgon-cast-a-spell.test.js:136-210
// (Trumpet 2 at :156); exhausted save-chip refusal at this modal seam →
// MonsterCardModal.legendary-uses.test.jsx:1236.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const rollSavingThrow = vi.fn();
  return { default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(), rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _rollSavingThrow: rollSavingThrow };
});
// ctx feeds the legendary turn-boundary gate (activeCreatureName: 'Bandit 1' =
// press allowed after another creature's turn) + creature lookup — network-free.
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit 1', creatures: [] } }));
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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

const CREATURES = [
  { name: 'Behemoth 1', type: 'npc', monsterType: 'monstrosity', targetName: 'Bandit 1', currentHp: 594, maxHp: 594, ac: 18, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const behemoth = () => monstersData.find(m => m.name === 'Behemoth');
const legendaryRows = () => behemoth().legendary_actions;
const trumpetRow = () => legendaryRows()[3];

// Disk bytes, judged whole: full-row toEqual pins name/save fields/description/
// save_effect AND every absence in one shot — no costs/cost-token (cost rides the
// NAME, MA-1883), no delegates_to (numeric save_dc self-resolves), no advisory,
// no range (no picker), no damage_dice_primary (condition-only, dc_success none
// stays honest — no half-damage leak, MV-20/§335). §165: header owns the economy.
describe('MA-1863 monsters.json data lock: Behemoth Trumpet inline slowed-clause row', () => {
  it('header owns uses:3, no child authors uses; Trumpet full disk identity DC 23 Wisdom none', () => {
    expect(legendaryRows()[0]).toEqual({
      name: 'Legendary Action Uses: 3',
      uses: 3,
      description: "Immediately after another creature's turn, it can expend a use to take one of the following actions. It regains all expended uses at the start of each of its turns.",
    });
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
    }
    expect(trumpetRow()).toEqual({
      name: 'Trumpet (Costs 2 Actions)',
      save_dc: 23,
      save_type: 'Wisdom',
      dc_success: 'none',
      description: 'Behemoth bellows. Each enemy within 60 ft. that can hear it must succeed on a DC 23 Wisdom saving throw or be unable to use Reactions until the end of its next turn.',
      save_effect: "The target can't take Reactions until the end of its next turn.",
    });
  });
});

describe('MA-1863 live seam: Trumpet press spends RAW cost 2 and rolls the DC 23 Wisdom save — zero silent burn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  it('own "DC 23 Wisdom" chip (Expend self-suppressed §204/MA-1846); press spends 2 of 3 (MA-1883), threads no_reactions transport vs armed Bandit 1, honest spend log, console clean', async () => {
    runtime.store['Behemoth 1.monsterLegendaryUses'] = { max: 3, used: 0 };
    const m = makeMonster({
      name: 'Behemoth',
      actions: behemoth().actions,
      legendary_actions: legendaryRows(),
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Behemoth 1', creatures: CREATURES })} />);

    const row = Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith('Trumpet'));
    expect(row).not.toBe(null);
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    const chips = row.querySelectorAll('.mc-dice-link-save-clickable');
    expect(chips).toHaveLength(1);
    expect(chips[0].textContent).toContain('DC 23 Wisdom');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(chips[0]);
    await waitFor(() => expect(rollSavingThrow).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(runtime.store['Behemoth 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 }));
    const [abbr, , options] = rollSavingThrow.mock.calls[0];
    expect(abbr).toBe('WIS');
    expect(options.saveDc).toBe(23);
    expect(options.saveType).toBe('Wisdom');
    expect(options.dcSuccess).toBe('none');
    expect(options.targetName).toBe('Bandit 1');
    // condition-only row: zero damage ride-along on the save leg
    expect(options.autoDamageFormula).toBeNull();
    expect(options.saveConditions).toEqual([]);
    // transport threaded — saveProcessing lane (cited header) lands the te
    expect(options.slowedClauses).toEqual({ effects: ['no_reactions'] });
    expect(options.conditionDurationNote).toMatch(/until the end of its next turn/);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Trumpet/.test(String(e.description)));
    expect(spend.description).toMatch(/spends 2 legendary uses for Trumpet \(Costs 2 Actions\).*1 of 3 left/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });
});
