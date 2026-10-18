// @maintained-by-ai
// MA-0227 regression: Ancient Green Dragon legendary header was display-only
// prose ("Legendary Action Uses: 3 (4 in Lair)" with NO `uses` field) —
// legendaryHeaderAction() returned null, the card rendered the UNGATED branch,
// and the numeric Noxious Miasma save fired with zero spend/refusal/regain
// economy. Fix mirrors the verified MA-0217 (ancient gold) DATA-only shape:
// header uses:3; prose children authored in the SAME pass so no silent-burn
// chips remain (MA-0164): Mind Invasion gets the numeric save seam (2024 Mind
// Spike lv5 = 6d8 Psychic WIS save DC 21 half-on-success — the delegate seam
// CANNOT resolve delegates_to:"Spellcasting"), Pounce gets delegates_to:
// "Rend" (MA-0220/0022 seam).
// MA-0229: Noxious Miasma authored dc_success:"none" (failure-only row) so
// the block-save/picker seam no longer leaks HALF damage on a success.
// Scope note: counter/chip render, exhausted + turn-latch refusals, spend
// wording, cooldown mechanics and save math are owned generically by
// MonsterCardModal.legendary-uses.test.jsx / pounce-ancient-gold.test.jsx /
// applyDamage.save-full.test.js — this file locks only the ANCIENT GREEN
// distinct row bytes (#387) and the distinct gated clicks through them.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spells2024 from '../../../public/data/2024/spells.json';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import { hasLegendaryCooldownClause } from '../../services/encounters/monsterLegendaryUses.js';

const aoeProps = vi.hoisted(() => ({ current: null }));
vi.mock('../char-sheet/modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: (props) => {
    aoeProps.current = props;
    return (
      <div className="sp-overlay sphere-picker-stub">
        <div className="sp-body">{props.titleOverride}</div>
      </div>
    );
  },
}));

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 10, rolls: [3, 3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 20, rolls: [3, 3, 4], modifier: 0 })),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/ui/dataLoader.js', () => ({ loadSpells: vi.fn(() => Promise.resolve([])) }));
const ROLLERS = vi.hoisted(() => ({
  rollAttack: null, rollDamage: null, rollSavingThrow: null,
}));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => {
    const rollAttack = vi.fn();
    const rollDamage = vi.fn();
    const rollSavingThrow = vi.fn();
    ROLLERS.rollAttack = rollAttack;
    ROLLERS.rollDamage = rollDamage;
    ROLLERS.rollSavingThrow = rollSavingThrow;
    return {
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack, rollDamage, rollAbilityCheck: vi.fn(),
      rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
    };
  }),
}));
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
  { name: 'Ancient Green Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 402, maxHp: 402, ac: 21, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Ancient Green Dragon 1.monsterLegendaryUses';
const COOLDOWNS_KEY = 'Ancient Green Dragon 1.monsterLegendaryActionCooldowns';

const green = () => monstersData.find(m => m.name === 'Ancient Green Dragon');
const legendary = () => green().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);

// MA-0227 data locks — ancient-green distinct row bytes only.
describe('MA-0227 monsters.json data: ancient green dragon legendary rows', () => {
  it('header row has uses:3 and the lair advisory stays advisory text', () => {
    expect(legendary()[0].name).toBe('Legendary Action Uses: 3 (4 in Lair)');
    expect(legendary()[0].uses).toBe(3);
    expect(row('Legendary Action Uses: 3 (4 in Lair)').description).toMatch(/4 uses \(advisory/);
  });

  // Mind Invasion authors the numeric save seam (the delegate seam cannot
  // resolve delegates_to:"Spellcasting"): app's only Mind Spike (2024) lv5
  // = 6d8 Psychic WIS half; DC 21 is the dragon's own Spellcasting save DC.
  it('Mind Invasion authors DC 21 WIS half-on-success 6d8 Psychic (Mind Spike lv5, spells.json cross-checked)', () => {
    const mi = row('Mind Invasion');
    expect(mi.save_dc).toBe(21);
    expect(mi.save_type).toBe('Wisdom');
    expect(mi.dc_success).toBe('half');
    expect(mi.damage_dice_primary).toBe('6d8');
    expect(mi.damage_type_primary).toBe('Psychic');
    expect(mi.delegates_to).toBeUndefined();
    expect(mi.description).toMatch(/uses Spellcasting to cast <em>Mind Spike<\/em> \(level 5 version\)/);
    expect(mi.description).toMatch(/DC 21 Wisdom saving throw/);
    expect(mi.description).toMatch(/27 \(6d8\) Psychic damage/);
    const spike = spells2024.find(s => s.index === 'mind-spike');
    expect(spike.damage.damage_at_slot_level['5']).toBe('6d8');
    expect(spike.damage.damage_type).toBe('Psychic');
    expect(spike.dc.dc_type).toBe('WIS');
    expect(spike.dc.dc_success).toBe('half');
  });

  it('Pounce delegates_to Rend with the sibling-prose byte, no own numeric mechanic', () => {
    const pounce = row('Pounce');
    expect(pounce.delegates_to).toBe('Rend');
    expect(pounce.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(pounce.attack_bonus).toBeUndefined();
    expect(pounce.save_dc).toBeUndefined();
  });

  // MA-0229: row authored NO half clause but the block-save seam defaulted
  // dcSuccess to 'half' — fix = DATA dc_success:"none" (MA-0218 Banish
  // byte-shape, same key position after save_type) → success pays ZERO.
  it('MA-0229 Noxious Miasma authors dc_success:"none" mirroring the ancient-gold Banish seam', () => {
    const miasma = row('Noxious Miasma');
    expect(miasma.save_dc).toBe(21);
    expect(miasma.save_type).toBe('Constitution');
    expect(miasma.dc_success).toBe('none');
    expect(miasma.damage_dice_primary).toBe('5d6');
    expect(miasma.damage_type_primary).toBe('Poison');
    expect(miasma.description).not.toMatch(/half/i);
    expect(miasma.save_effect).not.toMatch(/half/i);
    const banish = monstersData.find(m => m.name === 'Ancient Gold Dragon')
      .legendary_actions.find(a => a.name === 'Banish');
    expect(banish.dc_success).toBe('none');
    expect(Object.keys(miasma)).toEqual(Object.keys(banish));
  });
});

// MA-0227 live seam: gated clicks spend through the counter and route each
// distinct row to its own mechanic. (Counter render, exhausted/turn-latch
// refusals and spend wording: generic legendary-uses.test.jsx owners.)
describe('MA-0227 MonsterCardModal ancient green dragon gated legendary clicks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    aoeProps.current = null;
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderAGreen(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Ancient Green Dragon',
      actions: green().actions,
      legendary_actions: green().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient Green Dragon 1', creatures: CREATURES })} />);
  }
  function greenRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  // MA-0229: the save-clickable chip routes the Sphere row to the area
  // picker carrying dcSuccess 'none' (NOT the 'half' default that leaked half
  // damage on a success) — success face pays ZERO (Banish MA-0218 shape).
  it('Miasma save-clickable chip spends 1 (3→2), stamps once-per-turn cooldown, logs spend, opens picker with dcSuccess none — success ZERO', async () => {
    renderAGreen({ max: 3, used: 0 });
    expect(hasLegendaryCooldownClause(row('Noxious Miasma'))).toBe(true);
    fireEvent.click(greenRow('Noxious Miasma').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ noxious_miasma: { round: 1 } }));
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Noxious Miasma/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Noxious Miasma/);
    await waitFor(() => expect(aoeProps.current).toBeTruthy());
    const props = aoeProps.current;
    expect(props.titleOverride).toMatch(/^30-ft Radius/);
    expect(props.saveDc).toBe(21);
    expect(props.saveType).toBe('Constitution');
    expect(props.dcSuccess).toBe('none');
    expect(props.damage).toBe('5d6');
    expect(props.damageType).toBe('Poison');
    expect(props.excludeNames).toEqual(['Ancient Green Dragon 1']);
    expect(computeDamageAfterSave(17, true, props.dcSuccess)).toBe(0);
  });

  it('Mind Invasion gated click spends 1 and rolls the DC 21 WIS save-leg (6d8 Psychic, half-on-success, armed target)', async () => {
    renderAGreen({ max: 3, used: 0 });
    fireEvent.click(greenRow('Mind Invasion').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(21);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('half');
    expect(context.autoDamageFormula).toBe('6d8');
    expect(context.autoDamageDamageType).toBe('Psychic');
    expect(context.autoDamageName).toBe('Mind Invasion');
    expect(context.isSpellDamage).toBe(false);
    expect(context.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Mind Invasion/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Mind Invasion/);
  });

  it('Pounce gated click spends 1 and rolls the delegated +15 Rend attack (2d8 + 8 Slashing + 3d6 Poison), zero console dead-end', async () => {
    renderAGreen({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(greenRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(15);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d8 + 8');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('3d6');
    expect(options.autoDamageSecondaryDamageType).toBe('Poison');
    expect(options.targetName).toBe('TestPC');
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });
});
