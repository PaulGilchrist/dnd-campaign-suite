// @maintained-by-ai
// MA-1872: Cthulhu legendary_actions[3] "Madness Whisper (Costs 2 Actions)"
// shipped `delegates_to:"Psychic Shatter"` — the gated press spent a legendary
// use then routed into Psychic Shatter's structurally different save pool
// (live pre-fix: INT axis, 6d10 half, Stunned applied, NO no_reactions te —
// MA-1847 save-delegate mis-route family). Fix is DATA-only (§510 MA-1847
// twin): drop delegates_to and author the row's OWN structured save fields —
// numeric save_dc > 0 self-resolves (legendaryRowHasNumericMechanic :744 →
// resolveLegendaryRowMechanic :751 spend-then-save) rendering its own
// "DC 24 Wisdom" chip riding the section-wrapped legendary gate (§204;
// Expend self-suppresses); dc_success:"none" — RAW "No damage on a success"
// (half-default would leak fake half-damage §63/MV-20); damage rides
// damage_dice_primary 4d6 Psychic (fail-full). The fail-face reaction-block
// rides the MA-0711/MA-1863 prose te lane: save_effect → parseSlowedClauses
// arms registered te no_reactions (registered: targetEffectDefinitions.test.js
// :111; parser byte-shape: MonsterCardHelpers.both-outcomes.test.js) →
// saveProcessing grants with the /next turn/ rounds:2 clock (§216).
// "Costs 2 Actions" rides the row name — MA-1883 per-row cost parsing spends
// 2 per press (log prose byte-locked service-side:
// monsterLegendaryUses.ma1883-demogorgon-cast-a-spell.test.js:188), closing
// the MA-1847/MA-1839 spends-1 ADVISORY floor. NO once_per_turn authored —
// that is Psychic Shatter's MA-1868 field (→ ma1868 file + latch service);
// madness_whisper must stay byte-inert on the cooldown lane (latch pin :112).
// Owned elsewhere, NOT duplicated here: exhausted save-chip refusal →
// MonsterCardModal.legendary-uses.test.jsx:1236 (word-identical twin; the
// refusal gate is monster-agnostic); extractConditionDurationNote exact
// string → saveProcessing.ma2078-zmey-dust-storm.test.js:55 +
// monsterAbilityUses.test.js (threading stays pinned at the press test).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY } from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
const ROLLERS = vi.hoisted(() => ({ rollDamage: null, rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollDamage = rollDamage;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(), rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
// ctx feeds the turn-boundary gate + the armed target — network-free.
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
    setRuntimeObject: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    useRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
  };
});
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: runtime.useRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
  setRuntimeObject: runtime.setRuntimeObject,
  getRuntimeValue: runtime.getRuntimeValue,
}));

import { addEntry } from '../../services/ui/logService.js';

const CREATURES = [
  { name: 'Cthulhu 1', type: 'npc', monsterType: 'aberration', targetName: 'Bandit 1', currentHp: 540, maxHp: 540, ac: 21, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const cthulhu = () => monstersData.find(m => m.index === 'cthulhu');
const legendaryRows = () => cthulhu().legendary_actions;
const headerRow = () => legendaryRows()[0];
const whisperRow = () => legendaryRows()[3];

// MA-1872 data lock: full-row toEqual BY NAME — every authored field is
// byte-pinned, every retired/foreign field (delegates_to, costs, advisory,
// uses, once_per_turn, range, hit_conditions) is locked ABSENT by omission.
// Numeric save_dc > 0 makes the row self-resolving (§510 twin); dc_success
// "none" kills the half-damage leak; "Costs 2" rides the name only (MA-1883).
describe('MA-1872 monsters.json data: Cthulhu Madness Whisper self-resolving save row', () => {
  it('Madness Whisper full-row lock — DC 24 Wisdom, 4d6 Psychic fail-full/success-none, no_reactions te prose; delegates_to and cooldown/cost fields absent (§204/§225/§383/MA-1868 innocence)', () => {
    expect(whisperRow()).toEqual({
      name: 'Madness Whisper (Costs 2 Actions)',
      description: 'Cthulhu projects a maddening whisper at one creature within 120 ft. The target must succeed on a DC 24 Wisdom saving throw or take 14 (4d6) Psychic damage and be unable to take Reactions until the end of its next turn. No damage on a success.',
      save_dc: 24,
      save_type: 'Wisdom',
      damage_dice_primary: '4d6',
      damage_type_primary: 'Psychic',
      dc_success: 'none',
      save_effect: "The target can't take Reactions until the end of its next turn.",
    });
  });

  it('economy split: header owns uses:3; no child row authors uses/costs/once_per_turn (§165; the 2-cost is name-parsed, never a field)', () => {
    expect(headerRow().name).toBe('Legendary Action Uses: 3');
    expect(headerRow().uses).toBe(3);
    for (const child of legendaryRows().slice(1)) {
      expect(child.uses).toBeUndefined();
      expect(child.costs).toBeUndefined();
      expect(child.once_per_turn).toBeUndefined();
    }
  });
});

// MA-1872 live seam: the row renders its OWN "DC 24 Wisdom" chip riding the
// shared legendary gate (Expend chip self-suppressed); a boundary click spends
// its RAW cost 2 (MA-1883), then rolls DC 24 WISDOM with the no_reactions
// transport — never Psychic Shatter's INT pool, no 6d10, no Stunned, zero
// silent burn. Exhausted-refusal is the monster-agnostic legendary gate →
// legendary-uses.test.jsx:1236, not re-pinned here.
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

  it('row renders exactly ONE self-resolving "DC 24 Wisdom" save chip — no Expend chip (§204 numeric self-suppress), no Psychic Shatter mis-route residue, economy counter live', () => {
    renderCthulhu({ max: 3, used: 0 });
    const row = laRow('Madness Whisper');
    expect(row).not.toBe(null);
    expect(row.querySelector('.mc-dice-link-legendary')).toBe(null);
    const saveChips = Array.from(row.querySelectorAll('.mc-dice-link-save-clickable'));
    expect(saveChips).toHaveLength(1);
    expect(saveChips[0].textContent).toContain('DC 24 Wisdom');
    expect(row.textContent).not.toMatch(/Intelligence/);
    expect(row.textContent).not.toMatch(/6d10/);
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
  });

  it('chip press spends RAW cost 2 (store {max:3,used:2}, MA-1883) then rolls DC 24 WISDOM, dc_success none, 4d6 fail pool, no_reactions transport — zero mis-route, MA-1868 latch byte-inert', async () => {
    renderCthulhu({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(whisperChip());
    await waitFor(() => expect(runtime.store['Cthulhu 1.monsterLegendaryUses']).toEqual({ max: 3, used: 2 }));
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
    expect(spend.abilityName).toBe('Madness Whisper (Costs 2 Actions)');
    expect(spend.description).toMatch(/spends 2 legendary uses for Madness Whisper \(Costs 2 Actions\).*1 of 3 left/);
    // never routes into Psychic Shatter's pool (no delegate-labeled ability_use)
    expect(addEntry.mock.calls.map(c => c[1]).some(e => /Psychic Shatter/.test(String(e.abilityName)) && e.type === 'ability_use')).toBe(false);
    // MA-1868 lane byte-inert: madness_whisper never stamps the cooldown latch
    expect(runtime.store[`Cthulhu 1.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`]).toBeUndefined();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });
});
