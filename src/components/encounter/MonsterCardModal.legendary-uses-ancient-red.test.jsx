// MA-0238 regression: Ancient Red Dragon legendary header was display-only
// prose ("Legendary Action Uses: 3 (4 in Lair)" with NO `uses` field) —
// legendaryHeaderAction() returned null, the card rendered the UNGATED branch
// (no counter, no chips), and Fiery Rays clicked 4× same window produced
// zero fires and zero refusals (plain rows had no click targets;
// monsterLegendaryUses never created). Fix mirrors the MA-0227 (ancient
// green) + verified adult-red (MA-0126/MA-0220 sibling) DATA-only shape:
// header uses:3 with the "4 in Lair" advisory annotated into description;
// prose children authored in the SAME pass so no silent-burn chips remain
// (MA-0164): Commanding Presence gets the numeric save seam (Command lv2:
// DC 23 = 8 + CHA 8 + PB 7 from the dragon's own Spellcasting row, WIS,
// dc_success none, charmed mechanical marker — adult-red byte-mirror),
// Fiery Rays gets the numeric spell-attack seam (+15 = CHA 8 + PB 7,
// 120 ft., 2d6 Fire — adult-red field set copied exactly), Pounce gets
// delegates_to:"Rend" (MA-0220/0022 seam; the dragon's own weapon is Rend).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
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
  { name: 'Ancient Red Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 507, maxHp: 507, ac: 22, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Ancient Red Dragon 1.monsterLegendaryUses';
const COOLDOWNS_KEY = 'Ancient Red Dragon 1.monsterLegendaryActionCooldowns';

const red = () => monstersData.find(m => m.name === 'Ancient Red Dragon');
const legendary = () => red().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const rendRow = () => red().actions.find(a => a.name === 'Rend');
const spellcastingRow = () => red().actions.find(a => a.name === 'Spellcasting');
const adultRed = () => monstersData.find(m => m.name === 'Adult Red Dragon');

// MA-0238 data lock: header carries numeric uses:3 ("4 in Lair" advisory
// stays in the name; lair advisory annotated in description, MA-0217/0070
// shape, byte-identical to the verified adult-red/green headers).
describe('MA-0238 monsters.json data: ancient red dragon legendary header authors uses:3', () => {
  it('header row has uses:3 and the lair advisory stays advisory text', () => {
    expect(row('Legendary Action Uses: 3 (4 in Lair)').uses).toBe(3);
    expect(legendaryHeaderAction(red())).toBe(legendary()[0]);
    expect(legendaryMaxUses(legendary()[0], null)).toBe(3);
    expect(legendaryUsesRemaining(legendary()[0], { max: 3, used: 1 })).toBe(2);
    expect(row('Legendary Action Uses: 3 (4 in Lair)').description).toMatch(/4 uses \(advisory/);
    const adultHeader = adultRed().legendary_actions[0];
    expect(row('Legendary Action Uses: 3 (4 in Lair)').description).toBe(adultHeader.description);
  });

  it('every prose child resolves a mechanic — no silent-burn chip (MA-0164)', () => {
    for (const a of legendary().slice(1)) {
      const resolvable = a.attack_bonus != null || a.save_dc != null
        || !!legendaryDelegateAction(red(), a) || !!a.advisory || !!a.ability_check;
      expect(resolvable, `legendary row "${a.name}" has no resolvable mechanic`).toBe(true);
    }
  });
});

// MA-0238: Commanding Presence authors the numeric save seam (adult-red
// sibling MA-0126 verified shape). DC 23 derives from the dragon's own
// Spellcasting row ("spell save DC 23" = 8 + CHA 8 + PB 7); Command is a
// Wisdom save; no damage — dc_success "none" so success is zero (MV-20/
// MA-0218 family). Charmed is the mechanical marker (charmed is the
// mechanical marker — no command-control subsystem consumer).
describe('MA-0238 monsters.json data: Commanding Presence numeric save seam (Command lv2)', () => {
  it('Commanding Presence authors DC 23 WIS dc_success none, adult-red field set', () => {
    const cp = row('Commanding Presence');
    expect(cp.save_dc).toBe(23);
    expect(cp.save_type).toBe('Wisdom');
    expect(cp.dc_success).toBe('none');
    expect(cp.attack_bonus).toBeUndefined();
    expect(cp.damage_dice_primary).toBeUndefined();
    const adultCp = adultRed().legendary_actions.find(a => a.name === 'Commanding Presence');
    expect(Object.keys(cp)).toEqual(Object.keys(adultCp));
    expect(adultCp.dc_success).toBe('none');
  });

  it('DC 23 matches the Spellcasting row and ability math (8 + CHA 8 + PB 7)', () => {
    expect(spellcastingRow().save_dc).toBe(23);
    expect(spellcastingRow().save_type).toBe('Charisma');
    expect(8 + red().ability_score_modifiers.cha + red().proficiency_bonus).toBe(23);
    expect(row('Commanding Presence').description).toMatch(/uses Spellcasting to cast <em>Command<\/em> \(level 2 version\)/);
    expect(row('Commanding Presence').description).toMatch(/DC 23 Wisdom saving throw/);
    expect(row('Commanding Presence').save_effect).toMatch(/charmed/);
    expect(row('Commanding Presence').save_effect).not.toMatch(/half/i);
  });
});

// MA-0238: Fiery Rays authors the numeric spell-attack seam (adult-red
// verified field set copied exactly — MA-0183/0185 spell_attack_bonus shape,
// never the MA-0065 "automation blocked" prose-only shape). +15 derives from
// the Spellcasting row ("+15 to hit with spell attacks" = CHA 8 + PB 7);
// Scorching Ray lv3 = 2d6 Fire per ray, nothing on a miss.
describe('MA-0238 monsters.json data: Fiery Rays numeric spell-attack seam (Scorching Ray lv3)', () => {
  it('Fiery Rays authors +15/+15 120 ft. 2d6 Fire — adult-red field set exact', () => {
    const fr = row('Fiery Rays');
    expect(fr.attack_bonus).toBe(15);
    expect(fr.spell_attack_bonus).toBe(15);
    expect(fr.range).toBe('120 ft.');
    expect(fr.damage_dice_primary).toBe('2d6');
    expect(fr.damage_type_primary).toBe('Fire');
    expect(fr.save_dc).toBeUndefined();
    const adultFr = adultRed().legendary_actions.find(a => a.name === 'Fiery Rays');
    expect(Object.keys(fr)).toEqual(Object.keys(adultFr));
    expect(spellcastingRow().description).toMatch(/\+15 to hit with spell attacks/);
    expect(red().ability_score_modifiers.cha + red().proficiency_bonus).toBe(15);
    expect(fr.description).toMatch(/Ranged Spell Attack: \+15 to hit/);
    expect(fr.description).toMatch(/2d6 Fire damage per ray, nothing on a miss/);
  });
});

// MA-0238: Pounce delegates_to:"Rend" (MA-0220/0022 seam) — the dragon's
// OWN weapon is Rend; byte-identical prose to the verified pounce siblings.
describe('MA-0238 monsters.json data: Pounce delegates to Rend', () => {
  it('Pounce row delegates_to Rend, no own numeric mechanic', () => {
    const pounce = row('Pounce');
    expect(pounce.delegates_to).toBe('Rend');
    expect(pounce.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(pounce.attack_bonus).toBeUndefined();
    expect(pounce.save_dc).toBeUndefined();
  });

  it('byte-identical to the verified ancient pounce siblings (Green/Gold/Brass) + adult red', () => {
    for (const name of ['Ancient Green Dragon', 'Ancient Gold Dragon', 'Ancient Brass Dragon', 'Adult Red Dragon']) {
      const sibling = monstersData.find(m => m.name === name)?.legendary_actions?.find(a => a.name === 'Pounce');
      expect(sibling?.delegates_to).toBe('Rend');
      expect(sibling?.description).toBe(row('Pounce').description);
    }
  });

  it('delegate resolves the dragon own Rend row: +17 / 2d8 + 10 Slashing + 3d6 Fire', () => {
    const rend = rendRow();
    expect(rend.attack_bonus).toBe(17);
    expect(rend.damage_dice_primary).toBe('2d8 + 10');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('3d6');
    expect(rend.damage_type_secondary).toBe('Fire');
    const delegate = legendaryDelegateAction(red(), row('Pounce'));
    expect(delegate).toBe(rend);
    expect(legendaryDelegateAttackName(row('Pounce'), rend)).toBe('Pounce (Rend attack)');
  });
});

// MA-0238 live seam: counter mounts, gated spend/refusal economy runs for
// all three children (was: no counter, plain rows, zero fires zero refusals).
describe('MA-0238 MonsterCardModal ancient red dragon gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    aoeProps.current = null;
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderARed(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Ancient Red Dragon',
      actions: red().actions,
      legendary_actions: red().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient Red Dragon 1', creatures: CREATURES })} />);
  }
  function redRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('header shows (3 left); every child renders a gated clickable affordance', () => {
    renderARed({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable')).not.toBe(null);
    expect(redRow('Fiery Rays').querySelector('.mc-dice-link')).not.toBe(null);
    const chip = redRow('Pounce').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
  });

  it('Commanding Presence gated click spends 1 and rolls the DC 23 WIS save-leg (dc_success none, charmed, armed target)', async () => {
    renderARed({ max: 3, used: 0 });
    expect(hasLegendaryCooldownClause(row('Commanding Presence')).valueOf()).toBe(true);
    fireEvent.click(redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ commanding_presence: { round: 1 } }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(23);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe(null);
    expect(context.saveConditions).toEqual(['charmed']);
    expect(context.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Commanding Presence/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Commanding Presence/);
  });

  it('Fiery Rays gated click spends 1 and rolls the +15 spell attack (2d6 Fire)', async () => {
    renderARed({ max: 3, used: 0 });
    fireEvent.click(redRow('Fiery Rays').querySelector('.mc-dice-link'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Fiery Rays');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(15);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d6');
    expect(options.damageType).toBe('Fire');
    expect(options.targetName).toBe('TestPC');
  });

  it('Pounce gated click spends 1 and rolls the delegated +17 Rend attack, zero console dead-end', async () => {
    renderARed({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(redRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(17);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d8 + 10');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('3d6');
    expect(options.autoDamageSecondaryDamageType).toBe('Fire');
    expect(options.targetName).toBe('TestPC');
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('second same-window Commanding Presence click refuses (turn latch): zero extra spend, legendary_use_refused log', async () => {
    renderARed({ max: 3, used: 0 });
    const chip = redRow('Commanding Presence').querySelector('.mc-dice-link-save-clickable');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollSavingThrow.mock.calls.length).toBe(1);
  });

  it('Fiery Rays repeat same-window refuses (per-action cooldown + turn latch): zero extra spend, zero second roll', async () => {
    renderARed({ max: 3, used: 0 });
    const chip = redRow('Fiery Rays').querySelector('.mc-dice-link');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollAttack.mock.calls.length).toBe(1);
  });

  it('exhausted (3/3): chip clicks refuse with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderARed({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(redRow('Fiery Rays').querySelector('.mc-dice-link'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('own-turn click refuses (turn latch): zero spend, zero roll', async () => {
    renderARed({ max: 3, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Ancient Red Dragon 1', creatures: CREATURES };
    fireEvent.click(redRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('not its own');
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });
});
