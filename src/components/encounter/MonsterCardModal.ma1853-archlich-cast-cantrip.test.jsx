// @maintained-by-ai
// MA-1853 regression: Archlich legendary_actions[1] "Cast Cantrip" authored
// name+description only — the gated "Expend Legendary" chip spent a use then
// fall-through'd resolveLegendaryRowMechanic (MonsterCardModal.jsx:715) with
// console.error "no resolvable mechanic" (§46/§225 silent-burn). Fix is DATA-only,
// mirroring the MA-0621 dracolich Sickening-Ray numeric-spellchild byte-shape
// (§204/MA-0676: numeric legendary children render their OWN +N chip riding the
// shared header gate; LegendarySpendLink self-suppresses, MonsterAction.jsx:192/217).
// Fire Bolt is the ONLY spell ATTACK among the archlich's cantrips (cantrip-list
// prose and the +14 spell-attack bonus byte-locked at ma1850-archlich-spellcasting
// :40/:170 — cited, not re-asserted). Lane owns the cantrip-cast seam only:
// exhausted/refusal economy is the shared-gate owner legendary-uses.test.jsx:195-210,
// multi-spend is ma1883 — cited, not re-asserted here.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spellsData from '../../../public/data/spells.json';

// diceRoller mock purged (bisect): rollExpression/rollExpressionDoubled fire only
// on handleDamage legs (MonsterCardModal.jsx:1484/2431/2683) — this attack lane
// rolls through the mocked rollAttack; the real canRollExpression stays live for
// chip gating (MonsterAction.jsx:52/217).
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({ rollAttack: null, rollDamage: null, rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })) };
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
  rangeToFeet: vi.fn(() => 120),
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
  { name: 'Archlich 1', type: 'npc', monsterType: 'undead', targetName: 'Bandit 1', currentHp: 475, maxHp: 475, ac: 15, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const archlich = () => monstersData.find(m => m.name === 'Archlich');
const legendaryRows = () => archlich().legendary_actions;
const castCantripRow = () => legendaryRows()[1];

// MA-1853 data lock: the formerly inert cantrip row now authors the numeric
// spell-attack seam DIRECTLY (MA-0621 byte-shape), resolving "one Cantrip
// spell attack" as +14 / 4d10 Fire / 120 ft instead of burning the use.
describe('MA-1853 monsters.json data: archlich Cast Cantrip legendary row', () => {
  it('row is the MA-0621 numeric-spellchild byte-shape, self-resolving — full identity (no delegates_to/advisory/save_dc/uses: the rows[0] header with uses 3 owns the economy, §165)', () => {
    expect(castCantripRow()).toEqual({
      name: 'Cast Cantrip',
      description: 'The archlich makes one Cantrip spell attack.',
      attack_bonus: 14,
      spell_attack_bonus: 14,
      range: '120 feet',
      damage_dice_primary: '4d10',
      damage_type_primary: 'Fire',
    });
    expect(legendaryRows()[0].uses).toBe(3);
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
    }
  });

  it('numerics traced to sources: 4d10 + 120 ft are Fire Bolt\'s spells.json bytes (level-20 ladder key "17"), and it is the ranged cantrip of the four (+14 prose and cantrip list byte-locked at ma1850:40/:170)', () => {
    const fb = spellsData.find(s => s.name === 'Fire Bolt');
    expect(fb.level).toBe(0);
    expect(fb.attack_type).toBe('ranged');
    expect(fb.damage.damage_at_character_level['17']).toBe('4d10');
    expect(fb.range).toBe('120 feet');
  });
});

// MA-1853 live seam: the numeric row renders its OWN +14 chip riding the shared
// legendary gate (expend chip self-suppressed, MA-0676/§204); a boundary click
// spends ONE use then rolls the +14 / 4d10 Fire spell attack — no console.error
// silent burn. Exhausted refusal is the shared-gate owner's canonical leg
// (legendary-uses.test.jsx:195-210), cited not re-asserted.
describe('MA-1853 MonsterCardModal archlich Cast Cantrip resolves as a spell attack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  function renderArchlich(uses) {
    runtime.store['Archlich 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Archlich',
      actions: archlich().actions,
      legendary_actions: legendaryRows(),
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Archlich 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }

  it('row renders ONE +14 attack chip and NO Expend Legendary chip (MonsterAction.jsx:192 self-suppress), header counter honest', () => {
    renderArchlich({ max: 3, used: 0 });
    const row = laRow('Cast Cantrip');
    expect(row).not.toBe(null);
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    const chips = row.querySelectorAll('.mc-dice-link');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('+14');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
  });

  it('chip press spends ONE legendary use then rolls +14 / 4d10 Fire spell attack — zero silent burn (§46/§225)', async () => {
    renderArchlich({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(laRow('Cast Cantrip').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store['Archlich 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Cast Cantrip');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(14);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('4d10');
    expect(options.damageType).toBe('Fire');
    expect(options.isSpellDamage).toBe(true);
    expect(options.targetName).toBe('Bandit 1');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Cast Cantrip/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Cast Cantrip/);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });
});
