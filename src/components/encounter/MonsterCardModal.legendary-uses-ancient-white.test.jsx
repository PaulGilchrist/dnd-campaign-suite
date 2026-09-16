// MA-0259 regression: Ancient White Dragon legendary header was display-only
// prose ("Legendary Action Uses: 3 (4 in Lair)" with NO `uses` field) —
// legendaryHeaderAction() returned null, the card rendered the UNGATED branch
// (no counter, no chips), and Freezing Burst fired 2× same window (2× save
// prompt, live-verified) with zero refusals and monsterLegendaryUses never
// created; Frightful Presence/Pounce prose children were inert (MA-0163
// family). Fix mirrors the MA-0227/0238/0250 DATA-only shape, all children
// authored in the SAME pass (MA-0164 silent-burn): header uses:3 with the
// "4 in Lair" advisory annotated into description (byte-identical to the
// verified adult-white/silver/green/red headers); Frightful Presence gets the
// numeric CONDITION save seam byte-mirroring the VERIFIED adult-white MA-0147
// objects, DC 18 derived from the ancient's own ability math (8 + CHA 4 +
// PB 6 — adult mirrors 8 + CHA 1 + PB 5 = 14; FP uses Charisma per the
// verified white pattern, Fear spell prose carries no named DC); Pounce gets
// delegates_to:"Rend" (MA-0220/0022 seam; byte-identical pounce sibling
// prose). Freezing Burst numerics are untouched here — its save_effect
// 5d6-vs-4d6 discrepancy is MA-0260's scope.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import spells5e from '../../../public/data/spells.json';
import spells2024 from '../../../public/data/2024/spells.json';
import {
  legendaryHeaderAction, legendaryMaxUses, legendaryUsesRemaining,
  legendaryDelegateAction, legendaryDelegateAttackName, hasLegendaryCooldownClause,
  regainLegendaryUses,
} from '../../services/encounters/monsterLegendaryUses.js';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';

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
  { name: 'Ancient White Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 333, maxHp: 333, ac: 20, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Ancient White Dragon 1.monsterLegendaryUses';
const COOLDOWNS_KEY = 'Ancient White Dragon 1.monsterLegendaryActionCooldowns';
const LATCH_KEY = 'Ancient White Dragon 1._legendaryUses_usedRound';

const white = () => monstersData.find(m => m.name === 'Ancient White Dragon');
const legendary = () => white().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const rendRow = () => white().actions.find(a => a.name === 'Rend');
const adultFP = () => monstersData.find(m => m.name === 'Adult White Dragon').legendary_actions.find(a => a.name === 'Frightful Presence');
const fear5e = () => spells5e.find(s => s.name === 'Fear');
const fear2024 = () => spells2024.find(s => s.name === 'Fear');

// MA-0259 data lock: header carries numeric uses:3 ("4 in Lair" advisory
// stays in the name; lair advisory annotated in description, MA-0217/0070
// shape, byte-identical to the verified adult-white/silver/green/red headers).
describe('MA-0259 monsters.json data: ancient white dragon legendary header authors uses:3', () => {
  it('header row has uses:3 and the lair advisory stays advisory text', () => {
    expect(row('Legendary Action Uses: 3 (4 in Lair)').uses).toBe(3);
    expect(legendaryHeaderAction(white())).toBe(legendary()[0]);
    expect(legendaryMaxUses(legendary()[0], null)).toBe(3);
    expect(legendaryUsesRemaining(legendary()[0], { max: 3, used: 1 })).toBe(2);
    expect(row('Legendary Action Uses: 3 (4 in Lair)').description).toMatch(/4 uses \(advisory/);
    for (const name of ['Adult White Dragon', 'Ancient Silver Dragon', 'Ancient Green Dragon', 'Ancient Red Dragon']) {
      expect(row('Legendary Action Uses: 3 (4 in Lair)').description).toBe(monstersData.find(m => m.name === name).legendary_actions[0].description);
    }
  });

  it('every prose child resolves a mechanic — no silent-burn chip (MA-0164)', () => {
    for (const a of legendary().slice(1)) {
      const resolvable = a.attack_bonus != null || a.save_dc != null
        || !!legendaryDelegateAction(white(), a) || !!a.advisory || !!a.ability_check;
      expect(resolvable, `legendary row "${a.name}" has no resolvable mechanic`).toBe(true);
    }
  });
});

// MA-0259: Frightful Presence authors the numeric CONDITION save seam
// byte-mirroring the VERIFIED adult-white MA-0147 objects (success_immunity
// and repeat_save must be objects, NOT booleans — parseSuccessImmunity and
// the repeat gate silently drop booleans). DC 18 = 8 + CHA 4 + PB 6 from the
// ancient's own ability math §8#35 (adult mirrors 8 + CHA 1 + PB 5 = 14);
// Charisma is the verified white FP pattern; app Fear (BOTH spell paths)
// carries dc_success "none" — success is ZERO damage, frightened fail-only.
describe('MA-0259 monsters.json data: Frightful Presence numeric condition-save seam', () => {
  it('FP authors DC 18 Charisma dc_success none, MA-0147 object seam, zero damage', () => {
    const fp = row('Frightful Presence');
    expect(fp.save_dc).toBe(18);
    expect(fp.save_type).toBe('Charisma');
    expect(fp.dc_success).toBe('none');
    expect(fp.attack_bonus).toBeUndefined();
    expect(fp.damage_dice_primary).toBeUndefined();
    expect(fp.success_immunity).toEqual({ effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 });
    expect(fp.repeat_save).toEqual({ condition: 'frightened', save_type: 'Charisma', duration_minutes: 1 });
    expect(fp.save_effect).toMatch(/becomes Frightened/);
    expect(fp.save_effect).toMatch(/deals no damage/);
    expect(fp.save_effect).not.toMatch(/half/i);
    expect(fp.description).toMatch(/DC 18 Charisma saving throw/);
    expect(fp.description).toMatch(/become Frightened for 1 minute/);
    expect(Object.keys(fp)).toEqual(Object.keys(adultFP()));
  });

  it('DC 18 derives from the ancient ability math; seam byte-mirrors verified adult white at its own DC', () => {
    expect(8 + white().ability_score_modifiers.cha + white().proficiency_bonus).toBe(18);
    expect(adultFP().save_dc).toBe(14);
    expect(row('Frightful Presence').save_effect).toBe(adultFP().save_effect);
    expect(row('Frightful Presence').success_immunity).toEqual(adultFP().success_immunity);
    expect(row('Frightful Presence').repeat_save).toEqual(adultFP().repeat_save);
    expect(fear5e().dc.dc_success).toBe('none');
    expect(fear2024().dc.dc_success).toBe('none');
    expect(extractConditionsFromSaveEffect(row('Frightful Presence').save_effect)).toEqual(['frightened']);
  });
});

// MA-0259: Freezing Burst numerics are UNTOUCHED by this fix (MA-0260 owns
// its save_effect dice) — the header uses:3 arms the gate around it.
describe('MA-0259 monsters.json data: Freezing Burst numerics untouched (MA-0260 scope)', () => {
  it('Freezing Burst still authors DC 20 CON 4d6 Cold, no new fields', () => {
    const fb = row('Freezing Burst');
    expect(fb.save_dc).toBe(20);
    expect(fb.save_type).toBe('Constitution');
    expect(fb.damage_dice_primary).toBe('4d6');
    expect(fb.damage_type_primary).toBe('Cold');
    expect(fb.dc_success).toBeUndefined();
    expect(fb.delegates_to).toBeUndefined();
    expect(hasLegendaryCooldownClause(fb).valueOf()).toBe(true);
  });
});

// MA-0259: Pounce delegates_to:"Rend" (MA-0220/0022 seam) — the dragon's
// OWN weapon is Rend; byte-identical prose to the verified pounce siblings.
describe('MA-0259 monsters.json data: Pounce delegates to Rend', () => {
  it('Pounce row delegates_to Rend, no own numeric mechanic', () => {
    const pounce = row('Pounce');
    expect(pounce.delegates_to).toBe('Rend');
    expect(pounce.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(pounce.attack_bonus).toBeUndefined();
    expect(pounce.save_dc).toBeUndefined();
  });

  it('byte-identical to the verified pounce siblings (Adult White/Silver/Green/Red)', () => {
    for (const name of ['Adult White Dragon', 'Ancient Silver Dragon', 'Ancient Green Dragon', 'Ancient Red Dragon']) {
      const sibling = monstersData.find(m => m.name === name)?.legendary_actions?.find(a => a.name === 'Pounce');
      expect(sibling?.delegates_to).toBe('Rend');
      expect(sibling?.description).toBe(row('Pounce').description);
    }
  });

  it('delegate resolves the dragon own Rend row: +14 / 2d8 + 8 Slashing + 2d6 Cold', () => {
    const rend = rendRow();
    expect(rend.attack_bonus).toBe(14);
    expect(rend.damage_dice_primary).toBe('2d8 + 8');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('2d6');
    expect(rend.damage_type_secondary).toBe('Cold');
    const delegate = legendaryDelegateAction(white(), row('Pounce'));
    expect(delegate).toBe(rend);
    expect(legendaryDelegateAttackName(row('Pounce'), rend)).toBe('Pounce (Rend attack)');
  });
});

// MA-0259 live seam: counter mounts, gated spend/refusal economy runs for
// all three children (was: no counter, Freezing Burst fired 2× same window
// ungated with zero refusals, FP/Pounce prose inert).
describe('MA-0259 MonsterCardModal ancient white dragon gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    aoeProps.current = null;
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderAWhite(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Ancient White Dragon',
      actions: white().actions,
      legendary_actions: white().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient White Dragon 1', creatures: CREATURES })} />);
  }
  function whiteRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('header shows (3 left); every child renders a gated clickable affordance', () => {
    renderAWhite({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(whiteRow('Freezing Burst').querySelector('.mc-dice-link-save-clickable')).not.toBe(null);
    expect(whiteRow('Frightful Presence').querySelector('.mc-dice-link-save-clickable')).not.toBe(null);
    const chip = whiteRow('Pounce').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
  });

  it('Frightful Presence gated click spends 1 and rolls the DC 18 CHA save-leg (dc_success none, frightened fail-only, zero damage, armed target)', async () => {
    renderAWhite({ max: 3, used: 0 });
    expect(hasLegendaryCooldownClause(row('Frightful Presence')).valueOf()).toBe(true);
    fireEvent.click(whiteRow('Frightful Presence').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ frightful_presence: { round: 1 } }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('CHA');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(18);
    expect(context.saveType).toBe('Charisma');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe(null);
    expect(context.saveConditions).toEqual(['frightened']);
    expect(context.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Frightful Presence/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Frightful Presence/);
  });

  it('Freezing Burst gated click spends 1 and opens the DC 20 sphere picker (was: fired ungated)', async () => {
    renderAWhite({ max: 3, used: 0 });
    fireEvent.click(whiteRow('Freezing Burst').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(aoeProps.current).not.toBe(null));
    expect(aoeProps.current.saveDc).toBe(20);
    expect(['CON', 'Constitution']).toContain(aoeProps.current.saveType);
    // dc_success/dice honesty is MA-0260 scope — only the gate is judged here.
    expect(String(aoeProps.current.titleOverride)).toContain('30-ft Radius');
  });

  it('Freezing Burst repeat same-window refuses (turn latch): zero extra spend, one selection log — was: 2× fires', async () => {
    renderAWhite({ max: 3, used: 0 });
    const chip = whiteRow('Freezing Burst').querySelector('.mc-dice-link-save-clickable');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    const spends = addEntry.mock.calls.map(c => c[1]).filter(e => /expends a legendary use for Freezing Burst/.test(String(e.description)));
    expect(spends.length).toBe(1);
  });

  it('Pounce gated click spends 1 and rolls the delegated +14 Rend attack, zero console dead-end', async () => {
    renderAWhite({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(whiteRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(14);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d8 + 8');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('2d6');
    expect(options.autoDamageSecondaryDamageType).toBe('Cold');
    expect(options.targetName).toBe('TestPC');
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('exhausted (3/3): chip clicks refuse with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderAWhite({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(whiteRow('Freezing Burst').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('own-turn click refuses (turn latch): zero spend, zero roll', async () => {
    renderAWhite({ max: 3, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Ancient White Dragon 1', creatures: CREATURES };
    fireEvent.click(whiteRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('not its own');
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('turn-start regain clears uses, latch, and per-action cooldowns with an ability_use log', async () => {
    runtime.store[KEY] = { max: 3, used: 2 };
    runtime.store[LATCH_KEY] = { round: 1, activeCreature: 'Thug 1' };
    runtime.store[COOLDOWNS_KEY] = { freezing_burst: { round: 1 }, frightful_presence: { round: 1 } };
    const res = await regainLegendaryUses({
      monsterName: 'Ancient White Dragon 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: runtime.getRuntimeValue,
        setRuntimeValue: runtime.setRuntimeValue,
        addEntry,
      },
    });
    expect(res).toEqual({ regained: true, max: 3 });
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(runtime.store[LATCH_KEY]).toBe(null);
    expect(runtime.store[COOLDOWNS_KEY]).toBe(null);
    const regain = addEntry.mock.calls.map(c => c[1]).find(e => /regains all expended legendary action uses/.test(String(e.description)));
    expect(regain.description).toMatch(/Ancient White Dragon 1 regains all expended legendary action uses at the start of its turn — 3 available\./);
  });
});
