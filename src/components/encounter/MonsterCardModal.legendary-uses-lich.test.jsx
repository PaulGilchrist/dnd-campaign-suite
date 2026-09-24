// MA-1089 regression: Lich "Frightening Gaze" (legendary_actions[2]) was a
// prose-only "casts Fear" row — MA-0510/0696 silent-burn shape: the Expend
// chip spent the legendary use, then resolveLegendaryRowMechanic hit the
// else-branch console.error "delegates_to undefined — no resolvable mechanic"
// with zero save/zero condition (live-verified 2026-09-24, bug file). Fix is
// DATA-only structured save lane, mirroring the VERIFIED twins: kraken Toxic
// Ink MA-1058 (save_dc arms ActionSaveRoll chip riding the shared legendary
// gate — one chip = spend + adjudication) and same-card Disrupt Life MA-1088
// (inline DC 20 single-target save vs Bandit, PASS live same day).
// DC 20 is the lich's OWN disk spell save DC (Spellcasting row save_dc:20;
// 8 + INT 5 + PB 7 = 20 — the bug-file's "DC 15" guess was wrong vs disk).
// Wisdom is the TARGET save Fear names on disk (spells.json dc_type WIS,
// dc_success "none", concentration up to 1 minute). No range field: the
// legendary prose names NO range → single-target inline honest lane; the
// Fear cone, concentration bookkeeping and LOS repeat-save are §70 advisory
// residuals carried in save_effect prose + durationNote.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal, { breathAoeShape } from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect, parseBothOutcomesClause } from './MonsterCardHelpers.js';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spells5e from '../../../public/data/spells.json';
import spells2024 from '../../../public/data/2024/spells.json';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';
import {
  legendaryHeaderAction, legendaryMaxUses, legendaryUsesRemaining,
  hasLegendaryCooldownClause, regainLegendaryUses,
} from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => {
  const rollAttack = vi.fn();
  const rollDamage = vi.fn();
  const rollSavingThrow = vi.fn();
  return { rollAttack, rollDamage, rollSavingThrow };
});
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: ROLLERS.rollAttack, rollDamage: ROLLERS.rollDamage, rollAbilityCheck: vi.fn(),
    rollSavingThrow: ROLLERS.rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
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

const CREATURES = [
  { name: 'Lich 1', type: 'npc', monsterType: 'undead', targetName: 'Bandit 1', currentHp: 315, maxHp: 315, ac: 17, conditions: [] },
  { name: 'Bandit 1', type: 'npc', currentHp: 391, maxHp: 999, ac: 12, conditions: [] },
];

const KEY = 'Lich 1.monsterLegendaryUses';
const COOLDOWNS_KEY = 'Lich 1.monsterLegendaryActionCooldowns';
const LATCH_KEY = 'Lich 1._legendaryUses_usedRound';

const lich = () => monstersData.find(m => m.index === 'lich');
const legendary = () => lich().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const spellcastingRow = () => lich().actions.find(a => a.name === 'Spellcasting');
const fear5e = () => spells5e.find(s => s.name === 'Fear');
const fear2024 = () => spells2024.find(s => s.name === 'Fear');

// MA-1089 data lock: the row authors the numeric save lane. DC 20 is the
// lich's own spell save DC (Spellcasting row + ability math), NOT the bug
// file's DC 15 guess; save_type Wisdom is Fear's target save; dc_success
// "none" mirrors Fear's disk dc (condition-only, no half-on-success).
describe('MA-1089 monsters.json data: Lich Frightening Gaze structured save lane', () => {
  it('row authors DC 20 Wisdom dc_success none, description byte-unchanged, no range (single-target inline lane)', () => {
    const fg = row('Frightening Gaze');
    expect(fg.save_dc).toBe(20);
    expect(fg.save_type).toBe('Wisdom');
    expect(fg.dc_success).toBe('none');
    expect(fg.range).toBeUndefined();
    expect(fg.attack_bonus).toBeUndefined();
    expect(fg.damage_dice_primary).toBeUndefined();
    expect(fg.delegates_to).toBeUndefined();
    expect(fg.description).toBe('The lich casts <strong>Fear</strong>, using the same spellcasting ability as Spellcasting. The lich can\'t take this action again until the start of its next turn.');
  });

  it('DC 20 resolves from the lich OWN Spellcasting row (8 + INT 5 + PB 7); both Fear spell paths say WIS/none', () => {
    expect(spellcastingRow().save_dc).toBe(20);
    expect(spellcastingRow().save_type).toBe('Intelligence');
    expect(8 + lich().ability_score_modifiers.int + lich().proficiency_bonus).toBe(20);
    expect(fear5e().dc.dc_type).toBe('WIS');
    expect(fear5e().dc.dc_success).toBe('none');
    expect(fear2024().dc.dc_type).toBe('WIS');
    expect(fear2024().dc.dc_success).toBe('none');
    expect(fear2024().concentration).toBe(true);
  });

  it('save_effect grants frightened FAIL-only (§157 marker byte-inert), carries the honest concentration until-clause note', () => {
    const fg = row('Frightening Gaze');
    expect(extractConditionsFromSaveEffect(fg.save_effect)).toEqual(['frightened']);
    expect(parseBothOutcomesClause(fg.save_effect)).toBeNull();
    expect(fg.save_effect).toMatch(/^Failure: /);
    expect(fg.save_effect).toMatch(/Success: The target is unaffected\.$/);
    expect(extractConditionDurationNote(fg.save_effect)).toBe('until the spell ends, Concentration up to 1 minute (GM-enforced)');
  });

  it('cooldown prose kept: hasLegendaryCooldownClause honest; recharge:false AND uses dropped (§165 children-author-no-uses, MA-1058 Toxic Ink twin: uses:1 arms the phantom monsterAbilitySaveUsesGate "(1/Day)" dawn-counter double-economy)', () => {
    const fg = row('Frightening Gaze');
    expect(hasLegendaryCooldownClause(fg).valueOf()).toBe(true);
    expect(fg.recharge).toBeUndefined();
    expect(fg.uses).toBeUndefined();
    // key order mirrors the verified ghost/dracolich condition-save twins:
    expect(Object.keys(fg)).toEqual(['name', 'description', 'save_dc', 'save_type', 'save_effect', 'dc_success']);
  });

  it('no range field → breathAoeShape null (inline save, no picker)', () => {
    expect(breathAoeShape(row('Frightening Gaze'), null)).toBe(null);
  });

  it('economy ceiling rides the rows[0] swallowed header (MA-1087 state, untouched): uses 1, our child unchanged', () => {
    expect(legendaryHeaderAction(lich())).toBe(legendary()[0]);
    expect(legendaryHeaderAction(lich()).name).toBe('Deathly Teleport');
    expect(legendaryMaxUses(legendary()[0], null)).toBe(1);
    expect(legendaryUsesRemaining(legendary()[0], { max: 1, used: 1 })).toBe(0);
  });
});

// MA-1089 live seam: the save chip replaces the dead Expend chip and rides
// the shared legendary gate (MA-1058 kraken twin) — one click = spend + DC 20
// WIS adjudication vs the armed Bandit, zero console dead-end.
describe('MA-1089 MonsterCardModal lich gated legendary save economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Bandit 1', creatures: CREATURES };
  });

  function renderALich(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Lich',
      actions: lich().actions,
      legendary_actions: lich().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Lich 1', creatures: CREATURES })} />);
  }
  function lichRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('MA-1058-shape chip swap: "DC 20 Wisdom" save chip, NO Expend chip, NO cosmetic "(false)"', () => {
    renderALich({ max: 1, used: 0 });
    const r = lichRow('Frightening Gaze');
    expect(r.querySelector('.mc-dice-link-legendary')).toBe(null);
    const chip = r.querySelector('.mc-dice-link-save-clickable');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('DC 20');
    expect(chip.textContent).toContain('Wisdom');
    expect(chip.textContent).not.toContain('1/Day');
    expect(r.textContent).not.toContain('(false)');
  });

  it('gated click spends 1, stamps the per-action cooldown, and rolls the DC 20 WIS save-leg (dc_success none, frightened fail-only, zero damage) — console dead-end gone', async () => {
    renderALich({ max: 1, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(lichRow('Frightening Gaze').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 1, used: 1 }));
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ frightening_gaze: { round: 1 } }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(20);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe(null);
    expect(context.saveConditions).toEqual(['frightened']);
    expect(context.conditionDurationNote).toBe('until the spell ends, Concentration up to 1 minute (GM-enforced)');
    expect(context.targetName).toBe('Bandit 1');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Frightening Gaze/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Frightening Gaze/);
    expect(spend.description).toMatch(/0 of 1 left/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('repeat same-boundary click refuses (turn latch): zero extra spend, one save roll', async () => {
    renderALich({ max: 1, used: 0 });
    const chip = lichRow('Frightening Gaze').querySelector('.mc-dice-link-save-clickable');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 1, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 1, used: 1 });
    expect(ROLLERS.rollSavingThrow.mock.calls.length).toBe(1);
  });

  it('exhausted (1/1): chip click refuses with popup + legendary_use_refused, zero spend, zero save', async () => {
    renderALich({ max: 1, used: 1 });
    fireEvent.click(lichRow('Frightening Gaze').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 1, used: 1 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('own-turn click refuses (turn latch): zero spend, zero save', async () => {
    renderALich({ max: 1, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Lich 1', creatures: CREATURES };
    fireEvent.click(lichRow('Frightening Gaze').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 1, used: 0 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
  });

  it('turn-start regain clears uses, latch and the frightening_gaze cooldown with an ability_use log', async () => {
    runtime.store[KEY] = { max: 1, used: 1 };
    runtime.store[LATCH_KEY] = { round: 1, activeCreature: 'Bandit 1' };
    runtime.store[COOLDOWNS_KEY] = { frightening_gaze: { round: 1, usedBefore: 0 } };
    const res = await regainLegendaryUses({
      monsterName: 'Lich 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: runtime.getRuntimeValue,
        setRuntimeValue: runtime.setRuntimeValue,
        addEntry,
      },
    });
    expect(res).toEqual({ regained: true, max: 1 });
    expect(runtime.store[KEY]).toEqual({ max: 1, used: 0 });
    expect(runtime.store[LATCH_KEY]).toBe(null);
    expect(runtime.store[COOLDOWNS_KEY]).toBe(null);
    const regain = addEntry.mock.calls.map(c => c[1]).find(e => /regains all expended legendary action uses/.test(String(e.description)));
    expect(regain.description).toMatch(/Lich 1 regains all expended legendary action uses at the start of its turn — 1 available\./);
  });
});
