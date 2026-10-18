// @maintained-by-ai
// MA-1089 regression: Lich "Frightening Gaze" (legendary_actions[2]) was a
// prose-only "casts Fear" row — MA-0510/0696 silent-burn shape: the Expend
// chip spent the legendary use, then resolveLegendaryRowMechanic hit the
// else-branch console.error "delegates_to undefined — no resolvable mechanic"
// with zero save/zero condition (live-verified 2026-09-24, bug file). Fix is
// DATA-only: structured save lane mirroring the VERIFIED twins — kraken Toxic
// Ink MA-1058 (save_dc arms ActionSaveRoll chip riding the shared legendary
// gate — one chip = spend + adjudication) and same-card Disrupt Life MA-1088
// (inline DC 20 single-target save vs Bandit, PASS live same day).
// DC 20 is the lich's OWN disk spell save DC (Spellcasting row save_dc:20;
// 8 + INT 5 + PB 7 = 20 — the bug-file's "DC 15" guess was wrong vs disk).
// Wisdom/dc_success "none" mirror Fear on disk (WIS, condition-only). No
// range field → single-target inline honest lane; the Fear cone, concentration
// bookkeeping and LOS repeat-save are §70 advisory residuals carried in
// save_effect prose + durationNote.
// Lich-distinct lanes kept: BY-name frightening_gaze cooldown stamp (#387,
// the row's "can't take this action again" prose arming hasLegendaryCooldown
// Clause) + ONE effect-distinct click→ctx: damageless WIS DC 20 frightened
// fail-only save leg, autoDamageFormula null, zero console dead-end.
// Generics cite-skipped (never re-run here): header/max/remaining, expend
// gate (turn / own-turn / exhausted), same-boundary latch, spend flow,
// turn-start regain, cooldown-rearm-at-regain — monsterLegendaryUses.test.js
// :64-77/:79-109/:112-143/:145-162/:652-710; modal latch + exhausted
// sibling seams — legendary-uses.test.jsx (e.g. :310, :418) and
// legendary-uses-beholder.test.jsx:213-223.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal, { breathAoeShape } from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect, parseBothOutcomesClause } from './MonsterCardHelpers.js';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spells5e from '../../../public/data/spells.json';
import spells2024 from '../../../public/data/2024/spells.json';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';
import { hasLegendaryCooldownClause } from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
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

const lich = () => monstersData.find(m => m.index === 'lich');
const legendary = () => lich().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const spellcastingRow = () => lich().actions.find(a => a.name === 'Spellcasting');
const fear5e = () => spells5e.find(s => s.name === 'Fear');
const fear2024 = () => spells2024.find(s => s.name === 'Fear');

// MA-1089 disk lane: the row authors the numeric save lane. DC 20 is the
// lich's own spell save DC (Spellcasting row + ability math), NOT the bug
// file's DC 15 guess; Wisdom is Fear's target save; dc_success "none" is
// condition-only, no half-on-success. Cooldown prose kept (§165 children
// author no uses/recharge — MA-1058 Toxic Ink twin: uses:1 would arm the
// phantom monsterAbilitySaveUsesGate "(1/Day)" double-economy).
describe('MA-1089 monsters.json data: Lich Frightening Gaze structured save lane', () => {
  it('row byte-pins: DC 20 Wisdom dc_success none, no range/attack/damage/delegates, cooldown prose arms hasLegendaryCooldownClause, uses/recharge dropped, key order mirrors ghost/dracolich condition-save twins', () => {
    const fg = row('Frightening Gaze');
    expect(fg.save_dc).toBe(20);
    expect(fg.save_type).toBe('Wisdom');
    expect(fg.dc_success).toBe('none');
    expect(fg.range).toBeUndefined();
    expect(fg.attack_bonus).toBeUndefined();
    expect(fg.damage_dice_primary).toBeUndefined();
    expect(fg.delegates_to).toBeUndefined();
    expect(fg.recharge).toBeUndefined();
    expect(fg.uses).toBeUndefined();
    expect(fg.description).toBe('The lich casts <strong>Fear</strong>, using the same spellcasting ability as Spellcasting. The lich can\'t take this action again until the start of its next turn.');
    expect(hasLegendaryCooldownClause(fg).valueOf()).toBe(true);
    expect(Object.keys(fg)).toEqual(['name', 'description', 'save_dc', 'save_type', 'save_effect', 'dc_success']);
  });

  it('save_effect + parsers: frightened FAIL-only (§157 markers, honest concentration until-clause note), no range → breathAoeShape null (inline save, no picker); DC 20 resolves from the lich OWN Spellcasting row (8 + INT 5 + PB 7); both Fear spell paths say WIS/none', () => {
    const fg = row('Frightening Gaze');
    expect(fg.save_effect).toMatch(/^Failure: /);
    expect(fg.save_effect).toMatch(/Success: The target is unaffected\.$/);
    expect(extractConditionsFromSaveEffect(fg.save_effect)).toEqual(['frightened']);
    expect(parseBothOutcomesClause(fg.save_effect)).toBeNull();
    expect(extractConditionDurationNote(fg.save_effect)).toBe('until the spell ends, Concentration up to 1 minute (GM-enforced)');
    expect(breathAoeShape(fg, null)).toBe(null);
    expect(spellcastingRow().save_dc).toBe(20);
    expect(spellcastingRow().save_type).toBe('Intelligence');
    expect(8 + lich().ability_score_modifiers.int + lich().proficiency_bonus).toBe(20);
    expect(fear5e().dc.dc_type).toBe('WIS');
    expect(fear5e().dc.dc_success).toBe('none');
    expect(fear2024().dc.dc_type).toBe('WIS');
    expect(fear2024().dc.dc_success).toBe('none');
    expect(fear2024().concentration).toBe(true);
    // economy ceiling rides the rows[0] swallowed header (MA-1087 state, untouched)
    expect(legendary()[0].name).toBe('Deathly Teleport');
    expect(legendary()[0].uses).toBe(1);
  });
});

// MA-1089 live seam: the save chip replaces the dead Expend chip and rides
// the shared legendary gate (MA-1058 kraken twin) — one click = spend + BY-name
// frightening_gaze cooldown stamp (#387) + DC 20 WIS adjudication vs the armed
// Bandit, zero console dead-end. Gate refusals (latch/exhausted/own-turn) and
// regain live in monsterLegendaryUses.test.js — cite-skipped above.
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

  it('MA-1058-shape chip swap + gated click: "DC 20 Wisdom" save chip (NO Expend chip, NO "(false)", no phantom "1/Day") spends 1, stamps the BY-name frightening_gaze cooldown, and rolls the damageless DC 20 WIS save-leg (dc_success none, frightened fail-only) — console dead-end gone', async () => {
    renderALich({ max: 1, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = lichRow('Frightening Gaze');
    expect(r.querySelector('.mc-dice-link-legendary')).toBe(null);
    const chip = r.querySelector('.mc-dice-link-save-clickable');
    expect(chip.textContent).toContain('DC 20');
    expect(chip.textContent).toContain('Wisdom');
    expect(chip.textContent).not.toContain('1/Day');
    expect(r.textContent).not.toContain('(false)');
    fireEvent.click(chip);
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
});
