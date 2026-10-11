// MA-1872: Cthulhu legendary_actions[3] "Madness Whisper (Costs 2 Actions)"
// shipped `delegates_to:"Psychic Shatter"` — the gated press spent a legendary
// use then routed into Psychic Shatter's structurally different save pool
// (live pre-fix: ability_use "(Psychic Shatter save)", lastAttack.saveType
// INTELLIGENCE dcSuccess half, 6d10 35 psychic + Stunned applied, NO
// no_reactions te — MA-1847 save-delegate mis-route family). Fix is DATA-only
// (§510 MA-1847 twin): drop delegates_to and author the row's OWN structured
// save fields — numeric save_dc > 0 makes it self-resolve
// (legendaryRowHasNumericMechanic :705 → resolveLegendaryRowMechanic :713
// spend-then-save) rendering its own "DC 24 Wisdom" chip riding the
// section-wrapped legendary gate (§204; Expend self-suppresses, MonsterAction
// numeric rows); dc_success:"none" — RAW "No damage on a success" (half-default
// would leak fake half-damage copy §63/MV-20); damage rides
// damage_dice_primary 4d6 Psychic (fail-full via computeDamageAfterSave).
// The fail-face reaction-block rides the MA-0711/MA-1863 victim-anchored prose
// te lane: save_effect "can't take Reactions" → parseSlowedClauses arms the
// registered te no_reactions (targetEffectDefinitions), /next turn/ →
// rounds:2 clock (§216 consumer fork). "Costs 2 Actions" stays name-text —
// engine spends 1 per press (MA-1847/MA-1839 ADVISORY floor, grep-zero
// cost-token parse). NO once_per_turn authored — that is Psychic Shatter's
// MA-1868 field; madness_whisper must stay byte-inert on the cooldown lane.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { parseSlowedClauses } from './MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';
import { MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY } from '../../services/encounters/monsterLegendaryUses.js';

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
  { name: 'Cthulhu 1', type: 'npc', monsterType: 'aberration', targetName: 'Bandit 1', currentHp: 540, maxHp: 540, ac: 21, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const cthulhu = () => monstersData.find(m => m.index === 'cthulhu');
const legendaryRows = () => cthulhu().legendary_actions;
const headerRow = () => legendaryRows()[0];
const whisperRow = () => legendaryRows()[3];

// MA-1872 data lock: the delegating child is now a SELF-RESOLVING structured
// save row (§510 MA-1847 twin) — DC 24 Wisdom, 4d6 Psychic fail-full/
// success-none, no_reactions te on the MA-0711/MA-1863 prose lane.
describe('MA-1872 monsters.json data: Cthulhu Madness Whisper self-resolving save row', () => {
  it('rows[0] header owns the economy + no child authors uses (§165)', () => {
    expect(headerRow().name).toBe('Legendary Action Uses: 3');
    expect(headerRow().uses).toBe(3);
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
    }
  });

  it('Madness Whisper authors save_dc 24 + save_type Wisdom + 4d6 Psychic + dc_success none + save_effect te transport', () => {
    const row = whisperRow();
    expect(row.name).toBe('Madness Whisper (Costs 2 Actions)');
    expect(row.save_dc).toBe(24);
    expect(row.save_type).toBe('Wisdom');
    expect(row.damage_dice_primary).toBe('4d6');
    expect(row.damage_type_primary).toBe('Psychic');
    expect(row.dc_success).toBe('none');
    expect(row.save_effect).toBe("The target can't take Reactions until the end of its next turn.");
  });

  it('delegates_to is GONE — the mis-route into Psychic Shatter\'s INT/6d10/Stunned pool is dead (§204/§225)', () => {
    const row = whisperRow();
    expect(row.delegates_to).toBeUndefined();
    // numeric mechanic gate: save_dc > 0 self-resolves, delegate leg never runs
    expect(Number(row.save_dc) > 0).toBe(true);
  });

  it('name + description stay RAW byte-identical (§383 anchor innocence)', () => {
    const row = whisperRow();
    expect(row.name).toBe('Madness Whisper (Costs 2 Actions)');
    expect(row.description).toBe('Cthulhu projects a maddening whisper at one creature within 120 ft. The target must succeed on a DC 24 Wisdom saving throw or take 14 (4d6) Psychic damage and be unable to take Reactions until the end of its next turn. No damage on a success.');
  });

  it('no cost-token/advisory/uses/once_per_turn (MA-1847/MA-1839 advisory floor; MA-1868 field is Psychic Shatter\'s)', () => {
    const row = whisperRow();
    expect(row.costs).toBeUndefined();
    expect(row.advisory).toBeUndefined();
    expect(row.once_per_turn).toBeUndefined();
    expect(row.range).toBeUndefined();
  });

  it('parse lock: save_effect arms te no_reactions ONLY (MA-0087/MA-1863 byte-shape); RAW description prose stays inert (parser keys "can\'t take Reactions" only)', () => {
    expect(parseSlowedClauses(whisperRow().save_effect)).toEqual({ effects: ['no_reactions'] });
    expect(parseSlowedClauses(whisperRow().description)).toBeNull();
  });

  it('duration fork feeds rounds:2 — "until the end of its next turn" victim-anchored (§216/§529 MA-0711 lane)', () => {
    const note = extractConditionDurationNote(whisperRow().save_effect);
    expect(note).toBe('until the end of its next turn (GM-enforced)');
    expect(/next turn/i.test(note)).toBe(true);
  });
});

// MA-1872 live seam: the row renders its OWN "DC 24 Wisdom" chip riding the
// shared legendary gate (Expend chip self-suppressed); a boundary click spends
// ONE use (2-cost advisory residual) then rolls the DC 24 WISDOM save vs the
// armed target with the no_reactions transport — never Psychic Shatter's INT
// pool, no 6d10, no Stunned, zero silent burn. MA-1868 lane untouched.
describe('MA-1872 MonsterCardModal Madness Whisper resolves as its own DC 24 Wisdom save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  function renderCthulhu(uses) {
    runtime.store['Cthulhu 1.monsterLegendaryUses'] = uses;
    const m = makeMonster({
      name: 'Cthulhu',
      actions: cthulhu().actions,
      legendary_actions: cthulhu().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Cthulhu 1', creatures: CREATURES })} />);
  }
  function laRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => (r.querySelector('strong')?.textContent || '').startsWith(name));
  }
  function whisperChip() {
    return laRow('Madness Whisper')?.querySelector('.mc-dice-link-save-clickable') || null;
  }

  it('row renders ONE self-resolving "DC 24 Wisdom" save chip — NOT Psychic Shatter\'s INT chip, NO Expend chip (§204 numeric self-suppress)', () => {
    renderCthulhu({ max: 3, used: 0 });
    const row = laRow('Madness Whisper');
    expect(row).not.toBe(null);
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    const saveChips = Array.from(row.querySelectorAll('.mc-dice-link-save-clickable'));
    expect(saveChips.length).toBeGreaterThan(0);
    expect(saveChips.some(c => c.textContent.includes('DC 24 Wisdom'))).toBe(true);
    expect(row.textContent).not.toMatch(/Intelligence/);
    expect(row.textContent).not.toMatch(/6d10/);
    // Psychic Shatter's own regular-row chip is untouched (MA-1868 innocence)
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
  });

  it('chip press spends ONE legendary use then rolls DC 24 WISDOM with no_reactions transport + 4d6 fail pool — zero mis-route, zero silent burn', async () => {
    renderCthulhu({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(whisperChip());
    await waitFor(() => expect(runtime.store['Cthulhu 1.monsterLegendaryUses']).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    const [abbr, , options] = ROLLERS.rollSavingThrow.mock.calls[0];
    expect(abbr).toBe('WIS');
    expect(options.saveDc).toBe(24);
    expect(options.saveType).toBe('Wisdom');
    expect(options.dcSuccess).toBe('none');
    expect(options.targetName).toBe('Bandit 1');
    expect(options.autoDamageFormula).toBe('4d6');
    expect(options.saveConditions).toEqual([]);
    expect(options.slowedClauses).toEqual({ effects: ['no_reactions'] });
    expect(options.conditionDurationNote).toMatch(/until the end of its next turn/);
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Madness Whisper/.test(String(e.description)));
    expect(spend).toBeTruthy();
    expect(spend.abilityName).toBe('Madness Whisper (Costs 2 Actions)');
    expect(spend.description).toMatch(/expends a legendary use/i);
    // never routes into Psychic Shatter's pool (no delegate label, no INT axis, no stun conditions)
    expect(String(spend.abilityName)).not.toMatch(/Psychic Shatter/);
    expect(addEntry.mock.calls.map(c => c[1]).some(e => /Psychic Shatter/.test(String(e.abilityName)) && e.type === 'ability_use')).toBe(false);
    // MA-1868 lane byte-inert: madness_whisper never stamps the cooldown latch
    expect(runtime.store[`Cthulhu 1.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toBeUndefined();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('exhausted (3/3): press refuses with legendary_use_refused popup, zero spend, zero save (§339)', async () => {
    renderCthulhu({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(whisperChip());
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store['Cthulhu 1.monsterLegendaryUses']).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });
});
