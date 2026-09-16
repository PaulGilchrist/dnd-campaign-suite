// MA-0250 regression: Ancient Silver Dragon legendary header was display-only
// prose ("Legendary Action Uses: 3 (4 in Lair)" with NO `uses` field) —
// legendaryHeaderAction() returned null, the card rendered the UNGATED branch
// (no counter, no chips), and Cold Gale fired 2× same window (2× save prompt +
// 2× hp_change) with zero refusals and monsterLegendaryUses never created;
// Chill/Pounce prose children were inert (MA-0163 family). Fix mirrors the
// MA-0227 (ancient green) + MA-0238 (ancient red) DATA-only shape, all
// children authored in the SAME pass (MA-0164 silent-burn): header uses:3
// with the "4 in Lair" advisory annotated into description (byte-identical to
// the verified green/red/adult-red headers); Chill gets the damageless
// CONDITION save seam (Hold Monster: DC 23 = 8 + CHA 8 + PB 7 from the
// dragon's own Spellcasting row, WIS per spells.json BOTH paths,
// dc_success none per app 5e dc.dc_success — PARALYZED is the canonical
// condition per spells.json both paths + row text, not charmed; MA-0233
// Fog Charm shape); Cold Gale keeps its numeric/gated fields untouched
// (auto-gated once the header lands); Pounce gets delegates_to:"Rend"
// (MA-0220/0022 seam; byte-identical pounce sibling prose).
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
  { name: 'Ancient Silver Dragon 1', type: 'npc', monsterType: 'dragon', targetName: 'TestPC', currentHp: 468, maxHp: 468, ac: 22, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Ancient Silver Dragon 1.monsterLegendaryUses';
const COOLDOWNS_KEY = 'Ancient Silver Dragon 1.monsterLegendaryActionCooldowns';
const LATCH_KEY = 'Ancient Silver Dragon 1._legendaryUses_usedRound';

const silver = () => monstersData.find(m => m.name === 'Ancient Silver Dragon');
const legendary = () => silver().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const rendRow = () => silver().actions.find(a => a.name === 'Rend');
const spellcastingRow = () => silver().actions.find(a => a.name === 'Spellcasting');
const holdMonster5e = () => spells5e.find(s => s.name === 'Hold Monster');
const holdMonster2024 = () => spells2024.find(s => s.name === 'Hold Monster');

// MA-0250 data lock: header carries numeric uses:3 ("4 in Lair" advisory
// stays in the name; lair advisory annotated in description, MA-0217/0070
// shape, byte-identical to the verified ancient-green/ancient-red/adult-red
// headers).
describe('MA-0250 monsters.json data: ancient silver dragon legendary header authors uses:3', () => {
  it('header row has uses:3 and the lair advisory stays advisory text', () => {
    expect(row('Legendary Action Uses: 3 (4 in Lair)').uses).toBe(3);
    expect(legendaryHeaderAction(silver())).toBe(legendary()[0]);
    expect(legendaryMaxUses(legendary()[0], null)).toBe(3);
    expect(legendaryUsesRemaining(legendary()[0], { max: 3, used: 1 })).toBe(2);
    expect(row('Legendary Action Uses: 3 (4 in Lair)').description).toMatch(/4 uses \(advisory/);
    for (const name of ['Ancient Green Dragon', 'Ancient Red Dragon', 'Adult Red Dragon']) {
      expect(row('Legendary Action Uses: 3 (4 in Lair)').description).toBe(monstersData.find(m => m.name === name).legendary_actions[0].description);
    }
  });

  it('every prose child resolves a mechanic — no silent-burn chip (MA-0164)', () => {
    for (const a of legendary().slice(1)) {
      const resolvable = a.attack_bonus != null || a.save_dc != null
        || !!legendaryDelegateAction(silver(), a) || !!a.advisory || !!a.ability_check;
      expect(resolvable, `legendary row "${a.name}" has no resolvable mechanic`).toBe(true);
    }
  });
});

// MA-0250: Chill authors the damageless CONDITION save seam (MA-0233 Fog
// Charm shape: description, save_dc, save_type, dc_success, save_effect —
// same key order). DC 23 derives from the dragon's own Spellcasting row
// ("spell save DC 23" = 8 + CHA 8 + PB 7); Hold Monster is a Wisdom save
// (spells.json BOTH paths dc_type WIS); PARALYZED is the canonical
// condition (2024 status_effects + row text) — NOT charmed. No damage:
// dc_success "none" so success is zero (MV-20/MA-0218 family), and the
// fail leg carries zero damage too (no damage dice authored or parsed).
describe('MA-0250 monsters.json data: Chill numeric condition-save seam (Hold Monster)', () => {
  it('Chill authors DC 23 WIS dc_success none, MA-0233 field set, zero damage', () => {
    const chill = row('Chill');
    expect(chill.save_dc).toBe(23);
    expect(chill.save_type).toBe('Wisdom');
    expect(chill.dc_success).toBe('none');
    expect(chill.attack_bonus).toBeUndefined();
    expect(chill.damage_dice_primary).toBeUndefined();
    expect(chill.description).toMatch(/uses Spellcasting to cast <em>Hold Monster<\/em>/);
    expect(chill.description).toMatch(/DC 23 Wisdom saving throw/);
    expect(chill.description).toMatch(/Paralyzed condition/);
    expect(chill.save_effect).toMatch(/paralyzed condition/);
    expect(chill.save_effect).not.toMatch(/half/i);
    const fogCharm = monstersData.find(m => m.name === 'Adult Green Dragon').lair_actions.find(a => a.name === 'Fog Charm');
    expect(Object.keys(chill)).toEqual(Object.keys(fogCharm));
  });

  it('DC 23 and WIS match the Spellcasting row, ability math, and spells.json both paths', () => {
    expect(spellcastingRow().save_dc).toBe(23);
    expect(spellcastingRow().save_type).toBe('Charisma');
    expect(8 + silver().ability_score_modifiers.cha + silver().proficiency_bonus).toBe(23);
    expect(holdMonster5e().dc.dc_type).toBe('WIS');
    expect(holdMonster5e().dc.dc_success).toBe('none');
    expect(holdMonster2024().dc.dc_type).toBe('WIS');
    expect(holdMonster2024().dc.dc_success).toBe('none');
    expect(holdMonster2024().status_effects).toEqual(['Paralyzed']);
    expect(extractConditionsFromSaveEffect(row('Chill').save_effect)).toEqual(['paralyzed']);
  });
});

// MA-0250: Cold Gale keeps its already-authored numerics untouched — the
// header uses:3 arms the gate around it (no row edits expected).
describe('MA-0250 monsters.json data: Cold Gale numerics untouched', () => {
  it('Cold Gale still authors DC 23 DEX 4d6 Cold half, no new fields', () => {
    const cg = row('Cold Gale');
    expect(cg.save_dc).toBe(23);
    expect(cg.save_type).toBe('Dexterity');
    expect(cg.damage_dice_primary).toBe('4d6');
    expect(cg.damage_type_primary).toBe('Cold');
    expect(cg.save_effect).toMatch(/Failure: 14 \(4d6\) Cold damage\. Success: Half damage\./);
    expect(hasLegendaryCooldownClause(cg).valueOf()).toBe(true);
  });
});

// MA-0250: Pounce delegates_to:"Rend" (MA-0220/0022 seam) — the dragon's
// OWN weapon is Rend; byte-identical prose to the verified pounce siblings.
describe('MA-0250 monsters.json data: Pounce delegates to Rend', () => {
  it('Pounce row delegates_to Rend, no own numeric mechanic', () => {
    const pounce = row('Pounce');
    expect(pounce.delegates_to).toBe('Rend');
    expect(pounce.description).toBe('The dragon moves up to half its Speed (movement advisory — GM moves the token; no movement-distance consumer), and it makes one Rend attack.');
    expect(pounce.attack_bonus).toBeUndefined();
    expect(pounce.save_dc).toBeUndefined();
  });

  it('byte-identical to the verified ancient pounce siblings (Green/Gold/Brass/Red)', () => {
    for (const name of ['Ancient Green Dragon', 'Ancient Gold Dragon', 'Ancient Brass Dragon', 'Ancient Red Dragon']) {
      const sibling = monstersData.find(m => m.name === name)?.legendary_actions?.find(a => a.name === 'Pounce');
      expect(sibling?.delegates_to).toBe('Rend');
      expect(sibling?.description).toBe(row('Pounce').description);
    }
  });

  it('delegate resolves the dragon own Rend row: +17 / 2d8 + 10 Slashing + 2d8 Cold', () => {
    const rend = rendRow();
    expect(rend.attack_bonus).toBe(17);
    expect(rend.damage_dice_primary).toBe('2d8 + 10');
    expect(rend.damage_type_primary).toBe('Slashing');
    expect(rend.damage_dice_secondary).toBe('2d8');
    expect(rend.damage_type_secondary).toBe('Cold');
    const delegate = legendaryDelegateAction(silver(), row('Pounce'));
    expect(delegate).toBe(rend);
    expect(legendaryDelegateAttackName(row('Pounce'), rend)).toBe('Pounce (Rend attack)');
  });
});

// MA-0250 live seam: counter mounts, gated spend/refusal economy runs for
// all three children (was: no counter, Cold Gale fired 2× same window
// ungated with zero refusals, Chill/Pounce prose inert).
describe('MA-0250 MonsterCardModal ancient silver dragon gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    aoeProps.current = null;
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderASilver(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Ancient Silver Dragon',
      actions: silver().actions,
      legendary_actions: silver().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Ancient Silver Dragon 1', creatures: CREATURES })} />);
  }
  function silverRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('header shows (3 left); every child renders a gated clickable affordance', () => {
    renderASilver({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    expect(silverRow('Chill').querySelector('.mc-dice-link-save-clickable')).not.toBe(null);
    expect(silverRow('Cold Gale').querySelector('.mc-dice-link-save-clickable')).not.toBe(null);
    const chip = silverRow('Pounce').querySelector('.mc-dice-link-legendary');
    expect(chip).not.toBe(null);
    expect(chip.textContent).toContain('Expend Legendary');
  });

  it('Chill gated click spends 1 and rolls the DC 23 WIS save-leg (dc_success none, paralyzed, zero damage, armed target)', async () => {
    renderASilver({ max: 3, used: 0 });
    expect(hasLegendaryCooldownClause(row('Chill')).valueOf()).toBe(true);
    fireEvent.click(silverRow('Chill').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(runtime.store[COOLDOWNS_KEY]).toMatchObject({ chill: { round: 1 } }));
    await waitFor(() => expect(ROLLERS.rollSavingThrow).toHaveBeenCalled());
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('WIS');
    const context = ROLLERS.rollSavingThrow.mock.calls[0][2];
    expect(context.saveDc).toBe(23);
    expect(context.saveType).toBe('Wisdom');
    expect(context.dcSuccess).toBe('none');
    expect(context.autoDamageFormula).toBe(null);
    expect(context.saveConditions).toEqual(['paralyzed']);
    expect(context.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Chill/.test(e.description));
    expect(spend.description).toMatch(/expends a legendary use for Chill/);
  });

  it('second same-window Chill click refuses (turn latch): zero extra spend, legendary_use_refused log', async () => {
    renderASilver({ max: 3, used: 0 });
    const chip = silverRow('Chill').querySelector('.mc-dice-link-save-clickable');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollSavingThrow.mock.calls.length).toBe(1);
  });

  it('Cold Gale gated click spends 1 and opens the DC 23 line picker (was: fired ungated)', async () => {
    renderASilver({ max: 3, used: 0 });
    fireEvent.click(silverRow('Cold Gale').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(aoeProps.current).not.toBe(null));
    expect(aoeProps.current.saveDc).toBe(23);
    expect(['DEX', 'Dexterity']).toContain(aoeProps.current.saveType);
    expect(aoeProps.current.dcSuccess).toBe('half');
    expect(String(aoeProps.current.titleOverride)).toContain('60-ft Line');
  });

  it('Cold Gale repeat same-window refuses (turn latch): zero extra spend, one selection log — was: 2× fires', async () => {
    renderASilver({ max: 3, used: 0 });
    const chip = silverRow('Cold Gale').querySelector('.mc-dice-link-save-clickable');
    fireEvent.click(chip);
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    fireEvent.click(chip);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    const spends = addEntry.mock.calls.map(c => c[1]).filter(e => /expends a legendary use for Cold Gale/.test(String(e.description)));
    expect(spends.length).toBe(1);
  });

  it('Pounce gated click spends 1 and rolls the delegated +17 Rend attack, zero console dead-end', async () => {
    renderASilver({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(silverRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Pounce (Rend attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(17);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('2d8 + 10');
    expect(options.damageType).toBe('Slashing');
    expect(options.autoDamageSecondaryFormula).toBe('2d8');
    expect(options.autoDamageSecondaryDamageType).toBe('Cold');
    expect(options.targetName).toBe('TestPC');
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('exhausted (3/3): chip clicks refuse with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderASilver({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(silverRow('Chill').querySelector('.mc-dice-link-save-clickable'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('own-turn click refuses (turn latch): zero spend, zero roll', async () => {
    renderASilver({ max: 3, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Ancient Silver Dragon 1', creatures: CREATURES };
    fireEvent.click(silverRow('Pounce').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('not its own');
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('turn-start regain clears uses, latch, and per-action cooldowns with an ability_use log', async () => {
    runtime.store[KEY] = { max: 3, used: 2 };
    runtime.store[LATCH_KEY] = { round: 1, activeCreature: 'Thug 1' };
    runtime.store[COOLDOWNS_KEY] = { chill: { round: 1 }, cold_gale: { round: 1 } };
    const res = await regainLegendaryUses({
      monsterName: 'Ancient Silver Dragon 1',
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
    expect(regain.description).toMatch(/Ancient Silver Dragon 1 regains all expended legendary action uses at the start of its turn — 3 available\./);
  });
});
