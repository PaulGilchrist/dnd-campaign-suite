// MA-1853 regression: Archlich legendary_actions[1] "Cast Cantrip" authored
// name+description only — the gated "Expend Legendary" chip spent a use then
// fall-through'd resolveLegendaryRowMechanic (MonsterCardModal.jsx:715) with
// console.error "no resolvable mechanic" (§46/§225 silent-burn): a row whose
// prose promises "one Cantrip spell attack" resolved NOTHING. Fix is DATA-only,
// mirroring the MA-0621 dracolich Sickening-Ray numeric-spellchild byte-shape
// (§204/MA-0676: numeric legendary children render their OWN +N chip riding
// the shared header gate; LegendarySpendLink self-suppresses, MonsterAction.jsx:192).
// Adjudication: Fire Bolt is the ONLY spell ATTACK among the archlich's cantrips
// (Blade Ward, Fire Bolt, Mage Hand, Mage Armor — actions[2] Spellcasting), so
// "one Cantrip spell attack" = Fire Bolt: attack_bonus 14 (archlich's OWN authored
// spell-attack bonus per its 20th-level Spellcasting prose), damage 4d10 Fire
// (Fire Bolt canonical dice at caster level 20, spells.json damage_at_character_level
// "17": "4d10"), range "120 feet" (spells.json Fire Bolt, byte-shape of the
// MA-0621 template's "60 feet"). NO delegates_to (row self-resolves, MA-1846
// Apep precedent), NO advisory (the numeric-attack seam IS the consumer).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spellsData from '../../../public/data/spells.json';
import { canRollExpression } from '../../services/dice/diceRoller.js';

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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Archlich 1', type: 'npc', monsterType: 'undead', targetName: 'Bandit 1', currentHp: 475, maxHp: 475, ac: 15, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const archlich = () => monstersData.find(m => m.name === 'Archlich');
const legendaryRows = () => archlich().legendary_actions;
const headerRow = () => legendaryRows()[0];
const castCantripRow = () => legendaryRows()[1];
const spellcastingRow = () => archlich().actions.find(a => /^Spellcasting$/i.test(a.name || ''));
const fireBolt = () => spellsData.find(s => s.name === 'Fire Bolt');

// MA-1853 data lock: the formerly inert cantrip row now authors the numeric
// spell-attack seam DIRECTLY (MA-0621 byte-shape), resolving "one Cantrip
// spell attack" as +14 / 4d10 Fire / 120 ft instead of burning the use.
describe('MA-1853 monsters.json data: archlich Cast Cantrip legendary row', () => {
  it('rows[0] header + all children untouched-shape: child uses dropped, header owns the economy (§165)', () => {
    expect(headerRow().name).toBe('Legendary Action Uses: 3');
    expect(headerRow().uses).toBe(3);
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
    }
  });

  it('Cast Cantrip row carries attack_bonus 14 + Fire damage dice + range (MA-0621 numeric-spellchild byte-shape)', () => {
    const row = castCantripRow();
    expect(row.name).toBe('Cast Cantrip');
    expect(row.attack_bonus).toBe(14);
    expect(row.spell_attack_bonus).toBe(14);
    expect(row.damage_dice_primary).toBe('4d10');
    expect(row.damage_type_primary).toBe('Fire');
    expect(row.range).toBe('120 feet');
  });

  it('damage dice canRollExpression-parses before it can reach a chip (§256/§383)', () => {
    expect(canRollExpression(castCantripRow().damage_dice_primary)).toBe(true);
  });

  it('row self-resolves: NO delegates_to, NO advisory, NO save_dc (§225 — advisory would preempt the attack leg)', () => {
    const row = castCantripRow();
    expect(row.delegates_to).toBeUndefined();
    expect(row.advisory).toBeUndefined();
    expect(row.save_dc).toBeUndefined();
  });

  it('numerics are the archlich OWN authored spell-attack values from its Spellcasting prose (20th-level, +14)', () => {
    const prose = spellcastingRow().description;
    expect(prose).toContain('20th-level spellcaster');
    expect(prose).toContain('+14 to hit with spell attacks');
    expect(prose).toContain('Fire Bolt');
  });

  it('4d10 is canonical Fire Bolt dice for caster level 20 and 120 ft is its spells.json range', () => {
    const fb = fireBolt();
    expect(fb.level).toBe(0);
    expect(fb.attack_type).toBe('ranged');
    expect(fb.damage.damage_at_character_level['17']).toBe('4d10');
    expect(fb.range).toBe('120 feet');
    // Fire Bolt is the ONLY spell ATTACK among the archlich's cantrips.
    expect(spellcastingRow().description).toMatch(/Cantrips \(at will\):<\/strong> <em>Blade Ward<\/em>, <em>Fire Bolt<\/em>, <em>Mage Hand<\/em>, <em>Mage Armor<\/em>/);
  });
});

// MA-1853 live seam: the numeric row renders its OWN +14 chip riding the shared
// legendary gate (expend chip self-suppressed, MA-0676/§204); a boundary click
// spends ONE use then rolls the +14 / 4d10 Fire spell attack — no console.error
// silent burn. Exhausted press refuses zero-spend, zero-roll.
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
      legendary_actions: archlich().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Archlich 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }

  it('row renders ONE +14 attack chip and NO Expend Legendary chip (MonsterAction.jsx:192 self-suppress)', () => {
    renderArchlich({ max: 3, used: 0 });
    const row = laRow('Cast Cantrip');
    expect(row).not.toBe(null);
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    const chips = row.querySelectorAll('.mc-dice-link');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('+14');
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
  });

  it('chip press spends ONE legendary use then rolls +14 / 4d10 Fire spell attack — zero silent burn', async () => {
    renderArchlich({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chip = laRow('Cast Cantrip').querySelector('.mc-dice-link');
    fireEvent.click(chip);
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

  it('exhausted (3/3): press refuses with legendary_use_refused popup, zero spend, zero roll', async () => {
    renderArchlich({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(laRow('Cast Cantrip').querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Archlich 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
  });
});
