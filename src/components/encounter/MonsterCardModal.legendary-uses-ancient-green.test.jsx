// MA-0227 regression: Ancient Green Dragon legendary header was display-only
// prose ("Legendary Action Uses: 3 (4 in Lair)" with NO `uses` field) —
// legendaryHeaderAction() returned null, the card rendered the UNGATED branch
// (no counter, no chips), and the numeric Noxious Miasma save fired with zero
// spend/refusal/regain economy (clicked 4× same window, 3 full resolutions,
// monsterLegendaryUses never created). Fix mirrors the verified MA-0217
// (ancient gold) DATA-only shape: header uses:3; prose children authored in
// the SAME pass so no silent-burn chips remain (MA-0164): Mind Invasion gets
// the numeric save seam (2024 Mind Spike lv5 = 6d8 Psychic WIS save DC 21
// half-on-success, MA-0087 Mind Jolt shape — the delegate seam CANNOT resolve
// delegates_to:"Spellcasting": legendaryDelegateAction would land handleSaveRoll
// on the Spellcasting row with a null damage formula), Pounce gets
// delegates_to:"Rend" (MA-0220/0022 seam).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spells2024 from '../../../public/data/2024/spells.json';
import { computeDamageAfterSave, computeDamageAfterEvasion } from '../../services/rules/combat/applyDamage.js';
import {
  legendaryHeaderAction, legendaryMaxUses, legendaryUsesRemaining,
  legendaryDelegateAction, legendaryDelegateAttackName, hasLegendaryCooldownClause,
} from '../../services/encounters/monsterLegendaryUses.js';

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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

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
const rendRow = () => green().actions.find(a => a.name === 'Rend');

// MA-0227 data lock: header carries numeric uses:3 ("4 in Lair" advisory stays
// in the name; lair advisory annotated in description, MA-0217/0070 shape).
describe('MA-0227 monsters.json data: ancient green dragon legendary header authors uses:3', () => {
  it('header row has uses:3 and the lair advisory stays advisory text', () => {
    expect(row('Legendary Action Uses: 3 (4 in Lair)').uses).toBe(3);
    expect(legendaryHeaderAction(green())).toBe(legendary()[0]);
    expect(legendaryMaxUses(legendary()[0], null)).toBe(3);
    expect(legendaryUsesRemaining(legendary()[0], { max: 3, used: 1 })).toBe(2);
    expect(row('Legendary Action Uses: 3 (4 in Lair)').description).toMatch(/4 uses \(advisory/);
  });

  it('every prose child resolves a mechanic — no silent-burn chip (MA-0164)', () => {
    for (const a of legendary().slice(1)) {
      const resolvable = a.attack_bonus != null || a.save_dc != null
        || !!legendaryDelegateAction(green(), a) || !!a.advisory || !!a.ability_check;
      expect(resolvable, `legendary row "${a.name}" has no resolvable mechanic`).toBe(true);
    }
  });
});

// MA-0227: Mind Invasion authors the numeric save seam (the delegate seam
// cannot resolve delegates_to:"Spellcasting"). Numbers from the app's only
// Mind Spike (2024): WIS save, half-on-success, lv5 slot = 6d8 Psychic; DC 21
// is the dragon's own Spellcasting save DC. Mirrors the verified MA-0087
// adult-copper Mind Jolt legendary shape byte-for-byte in structure.
describe('MA-0227 monsters.json data: Mind Invasion numeric save seam (Mind Spike lv5)', () => {
  it('Mind Invasion authors DC 21 WIS half-on-success 6d8 Psychic', () => {
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
  });

  it('6d8 Psychic WIS-save half-on-success matches spells.json (2024 path)', () => {
    const spike = spells2024.find(s => s.index === 'mind-spike');
    expect(spike.damage.damage_at_slot_level['5']).toBe('6d8');
    expect(spike.damage.damage_type).toBe('Psychic');
    expect(spike.dc.dc_type).toBe('WIS');
    expect(spike.dc.dc_success).toBe('half');
  });
});

// MA-0227: Pounce delegates_to:"Rend" (MA-0220/0022 seam), byte-identical
// prose to the verified ancient pounce siblings.
describe('MA-0227 monsters.json data: Pounce delegates to Rend', () => {
  it('Pounce row delegates_to Rend, no own numeric mechanic', () => {
    const pounce = row('Pounce');
    expect(pounce.delegates_to).toBe('Rend');
    expect(pounce.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(pounce.attack_bonus).toBeUndefined();
    expect(pounce.save_dc).toBeUndefined();
  });

  it('byte-identical to the verified ancient pounce siblings (Gold/Brass)', () => {
    for (const name of ['Ancient Gold Dragon', 'Ancient Brass Dragon']) {
      const sibling = monstersData.find(m => m.name === name)?.legendary_actions?.find(a => a.name === 'Pounce');
      expect(sibling?.delegates_to).toBe('Rend');
      expect(sibling?.description).toBe(row('Pounce').description);
    }
  });

  it('delegate resolves the dragon own Rend row: +15 / 2d8 + 8 Slashing + 3d6 Poison', () => {
    const rend = rendRow();
    expect(rend.attack_bonus).toBe(15);
    expect(rend.damage_dice_primary).toBe('2d8 + 8');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('3d6');
    expect(rend.damage_type_secondary).toBe('Poison');
    const delegate = legendaryDelegateAction(green(), row('Pounce'));
    expect(delegate).toBe(rend);
    expect(legendaryDelegateAttackName(row('Pounce'), rend)).toBe('Pounce (Rend attack)');
  });
});

// MA-0229: Noxious Miasma row authored NO half clause (failure-only: "Failure:
// 17 (5d6) Poison damage, and ... −2 penalty to AC"; success prose repeats only
// the once-per-turn restriction) — but the block-save seam defaulted
// dcSuccess to 'half' (MonsterCardModal.jsx resolveBlockSaveDcSuccess), so a
// SUCCESS leaked HALF damage (live: "takes 7 Poison damage (rolled 19, halved)").
// Fix = DATA dc_success:"none" (MA-0218 Banish byte-shape: same key position
// after save_type), consumed by getSaveDcSuccess/resolveBlockSaveDcSuccess →
// computeDamageAfterSave returns ZERO on success.
describe('MA-0229 monsters.json data: Noxious Miasma dc_success none — success is ZERO', () => {
  it('Miasma row authors dc_success:"none" mirroring the ancient-gold Banish seam', () => {
    const miasma = row('Noxious Miasma');
    expect(miasma.save_dc).toBe(21);
    expect(miasma.save_type).toBe('Constitution');
    expect(miasma.dc_success).toBe('none');
    expect(miasma.damage_dice_primary).toBe('5d6');
    expect(miasma.damage_type_primary).toBe('Poison');
    const banish = monstersData.find(m => m.name === 'Ancient Gold Dragon')
      .legendary_actions.find(a => a.name === 'Banish');
    expect(banish.dc_success).toBe('none');
    expect(Object.keys(miasma)).toEqual(Object.keys(banish));
  });

  it('row prose authors no half clause anywhere (zero-on-success intent)', () => {
    const miasma = row('Noxious Miasma');
    expect(miasma.description).not.toMatch(/half/i);
    expect(miasma.save_effect).not.toMatch(/half/i);
  });
});

// MA-0227 live seam: counter mounts, gated spend/refusal economy runs.
describe('MA-0227 MonsterCardModal ancient green dragon gated legendary economy', () => {
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

  it('header shows (3 left); Pounce renders the gated Expend Legendary chip', () => {
    renderAGreen({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    const chip = greenRow('Pounce').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
  });

  it('Miasma gated click spends 1 (3→2), stamps per-action cooldown, opens picker, logs spend', async () => {
    renderAGreen({ max: 3, used: 0 });
    expect(hasLegendaryCooldownClause(row('Noxious Miasma')).valueOf()).toBe(true);
    fireEvent.click(greenRow('Noxious Miasma').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ noxious_miasma: { round: 1 } }));
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Noxious Miasma/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Noxious Miasma/);
  });

  it('second same-window Miasma click refuses (turn latch): zero extra spend, legendary_use_refused log', async () => {
    renderAGreen({ max: 3, used: 0 });
    const chip = greenRow('Noxious Miasma').querySelector('.mc-dice-link-save-clickable');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
  });

  // MA-0229: gated Miasma click routes the Sphere row to the area picker —
  // picker props must carry dcSuccess 'none' (NOT the 'half' default that
  // leaked half damage on a success), and the consumer math must yield ZERO
  // on success / full raw on failure (Banish MA-0218 / Thunderclap MA-0084
  // picker shape).
  it('MA-0229 Miasma picker seam: dcSuccess none — success ZERO, failure full 5d6', async () => {
    renderAGreen({ max: 3, used: 0 });
    fireEvent.click(greenRow('Noxious Miasma').querySelector('.mc-dice-link-save-clickable'));
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
    expect(computeDamageAfterSave(17, false, props.dcSuccess)).toBe(17);
    expect(computeDamageAfterEvasion(17, true, props.dcSuccess, false)).toBe(0);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
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

  it('Pounce gated click spends 1 and rolls the delegated +15 Rend attack, zero console dead-end', async () => {
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

  it('exhausted (3/3): chip clicks refuse with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderAGreen({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(greenRow('Mind Invasion').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('own-turn click refuses (turn latch): zero spend, zero roll', async () => {
    renderAGreen({ max: 3, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Ancient Green Dragon 1', creatures: CREATURES };
    fireEvent.click(greenRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('not its own');
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});
