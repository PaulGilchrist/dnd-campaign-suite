// MA-0306/MA-0307/MA-0308 regression: Arch-hag legendary_actions[0] carried
// "Legendary Action Uses: 3 (4 in Lair)" ONLY as name-text — no numeric
// `uses` — so legendaryHeaderAction() returned null, the card rendered the
// UNGATED branch (live: 0 .mc-legendary-counter, Hag's Swipe / Malicious Magic
// bare prose with 0 affordances, clicks zero-delta, monsterLegendaryUses never
// created; control Spectral Claw +14 chip alive). Fix mirrors the MA-0259/
// MA-0277 DATA-only one-pass template: header "uses":3 (+ "(4 in Lair)" advisory
// boilerplate byte-mirroring the VERIFIED aboleth sibling) arms counter/spend/
// refusal/regain, and BOTH prose children are authored the SAME pass (MA-0164
// silent-burn): Hag's Swipe delegates_to:"Spectral Claw" (MA-0220/0022 seam,
// +14 / 3d6 + 7 Force + prone hit_conditions intact from MA-0302); Malicious
// Magic is a cast-choice row with NO Spellcasting container to delegate into
// (a delegates_to:"Spellcasting" would misroute through the save leg per
// MA-0227) → MA-0270/0271 advisory seam (advisory + honest advisory_message)
// spend + popup + ability_use record; the canonical once-per-turn clause is
// enforced by the MA-0073 legendary gate (description byte-intact).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import {
  legendaryHeaderAction, legendaryMaxUses, legendaryUsesRemaining,
  legendaryDelegateAction, legendaryDelegateAttackName,
  regainLegendaryUses, buildLegendaryAdvisoryPopup, buildLegendaryAdvisoryLog,
  hasLegendaryCooldownClause, legendaryActionSlug, MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY,
} from '../../services/encounters/monsterLegendaryUses.js';

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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CREATURES = [
  { name: 'Arch-hag 1', type: 'npc', monsterType: 'Fey', targetName: 'TestPC', currentHp: 333, maxHp: 333, ac: 20, conditions: [] },
  { name: 'Thug 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'Brute 1', type: 'npc', currentHp: 32, maxHp: 32, conditions: [] },
  { name: 'TestPC', type: 'player', currentHp: 41, maxHp: 41, conditions: [], computedStats: {} },
];

const KEY = 'Arch-hag 1.monsterLegendaryUses';
const LATCH_KEY = 'Arch-hag 1._legendaryUses_usedRound';
const COOLDOWN_KEY = `Arch-hag 1.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`;

const hag = () => monstersData.find(m => m.index === 'arch-hag');
const legendary = () => hag().legendary_actions;
const row = (name) => legendary().find(a => a.name === name);
const clawRow = () => hag().actions.find(a => a.name === 'Spectral Claw');

// MA-0306 data lock: economy header authors numeric uses:3 (was: 3 only in the
// name string — legendaryHeaderAction null, ungated branch, no counter). The
// "(4 in Lair)" clause stays advisory in the header name AND the description
// boilerplate mirrors the VERIFIED aboleth sibling (dragon→hag).
describe('MA-0306 monsters.json data: arch-hag legendary header authors uses:3', () => {
  it('rows[0] carries uses:3 and arms legendaryHeaderAction', () => {
    expect(legendary()[0].name).toBe('Legendary Action Uses: 3 (4 in Lair)');
    expect(legendary()[0].uses).toBe(3);
    expect(legendaryHeaderAction(hag())).toBe(legendary()[0]);
    expect(legendaryMaxUses(legendary()[0], null)).toBe(3);
    expect(legendaryUsesRemaining(legendary()[0], { max: 3, used: 1 })).toBe(2);
  });

  it('header description byte-mirrors the VERIFIED aboleth (4 in Lair) sibling (aboleth→hag)', () => {
    const sibling = monstersData.find(m => m.index === 'aboleth').legendary_actions[0];
    const mirror = sibling.description.replace(/\baboleth\b/g, 'hag');
    expect(legendary()[0].description).toBe(mirror);
    expect(legendary()[0].description).toMatch(/In its lair the hag has 4 uses \(advisory — no lair flag consumer; GM-enforced\)\./);
  });
});

// MA-0307: Hag's Swipe delegates_to the hag's OWN Spectral Claw attack row by
// exact actions[] name — no own numeric mechanic, no silent burn. The prone
// hit_conditions authored on Spectral Claw (MA-0302) ride the delegate.
describe('MA-0307 monsters.json data: Hag\'s Swipe delegates to Spectral Claw', () => {
  it('Hag\'s Swipe delegates_to Spectral Claw, no own numeric mechanic', () => {
    const swipe = row('Hag\'s Swipe');
    expect(swipe.delegates_to).toBe('Spectral Claw');
    expect(swipe.attack_bonus).toBeUndefined();
    expect(swipe.save_dc).toBeUndefined();
    expect(swipe.description).toBe('The hag makes one Spectral Claw attack.');
  });

  it('delegate resolves the hag own Spectral Claw row: +14 / 3d6 + 7 Force, prone clause intact (MA-0302)', () => {
    const claw = clawRow();
    expect(claw.attack_bonus).toBe(14);
    expect(claw.damage_dice_primary).toBe('3d6 + 7');
    expect(claw.damage_type_primary).toBe('Force');
    expect(claw.hit_conditions).toEqual(['prone']);
    const delegate = legendaryDelegateAction(hag(), row('Hag\'s Swipe'));
    expect(delegate).toBe(claw);
    expect(legendaryDelegateAttackName(row('Hag\'s Swipe'), claw)).toBe('Hag\'s Swipe (Spectral Claw attack)');
  });

  it('anchor discipline: green/night/sea hags legendary blocks UNTOUCHED', () => {
    for (const idx of ['green-hag', 'night-hag', 'sea-hag']) {
      const h = monstersData.find(m => m.index === idx);
      if (!h) continue;
      const swipe = (h.legendary_actions || []).find(a => a.name === 'Hag\'s Swipe');
      expect(swipe?.delegates_to).toBeUndefined();
      expect(h.legendary_actions?.[0]?.uses).toBeUndefined();
    }
  });
});

// MA-0308: Malicious Magic is a cast-choice row (Dimension Door / Hypnotic
// Pattern) with NO Spellcasting container to delegate into on the legendary
// block → MA-0270/0271 advisory seam with honest advisory_message. The
// canonical once-per-turn clause stays byte-intact in the description and is
// enforced by the MA-0073 legendary gate cooldown.
describe('MA-0308 monsters.json data: Malicious Magic advisory seam, honest copy', () => {
  it('Malicious Magic is an advisory row, no numeric mechanic, no Spellcasting delegate', () => {
    const mm = row('Malicious Magic');
    expect(mm.advisory).toBe('malicious_magic');
    expect(mm.attack_bonus).toBeUndefined();
    expect(mm.save_dc).toBeUndefined();
    expect(mm.delegates_to).toBeUndefined();
  });

  it('advisory_message honestly records spellcast-choice/no-consumer/once-per-turn', () => {
    const mm = row('Malicious Magic');
    expect(mm.advisory_message).toMatch(/GM adjudicates spell choice/);
    expect(mm.advisory_message).toMatch(/Dimension Door or Hypnotic Pattern/);
    expect(mm.advisory_message).toMatch(/once-per-turn clause is enforced by the legendary gate/);
    expect(mm.advisory_message).toMatch(/no Spellcasting container authored/);
  });

  it('canonical once-per-turn description stays byte-intact and arms the MA-0073 cooldown gate', () => {
    const mm = row('Malicious Magic');
    expect(mm.description).toBe('The hag uses Spellcasting to cast <em>Dimension Door</em> or <em>Hypnotic Pattern</em>. The hag can\'t take this action again until the start of its next turn.');
    expect(hasLegendaryCooldownClause(mm)).toBe(true);
    expect(legendaryActionSlug('Malicious Magic')).toBe('malicious_magic');
  });

  it('advisory builders use row copy (popup + ability_use log)', () => {
    const popup = buildLegendaryAdvisoryPopup({ monsterName: 'Arch-hag 1', action: row('Malicious Magic') });
    expect(popup).toMatch(/Legendary Action — Malicious Magic/);
    expect(popup).toMatch(/casts Dimension Door or Hypnotic Pattern/);
    expect(popup).not.toMatch(/invisibility/);
    const log = buildLegendaryAdvisoryLog({ monsterName: 'Arch-hag 1', action: row('Malicious Magic') });
    expect(log.type).toBe('ability_use');
    expect(log.abilityName).toBe('Malicious Magic');
    expect(log.description).toMatch(/GM adjudicates spell choice/);
  });
});

// MA-0306 live seam: counter mounts, Hag's Swipe gated click spends + rolls the
// delegated +14 / 3d6+7 Force attack (prone clause), Malicious Magic gated click
// spends + advisory popup/log, once-per-turn refusal holds at the next boundary,
// exhaustion refuses, turn-start regain clears (was: no counter, 0-affordance
// rows, zero-delta clicks).
describe('MA-0306 MonsterCardModal arch-hag gated legendary economy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
    ctx.value = { round: 1, activeCreatureName: 'Thug 1', creatures: CREATURES };
  });

  function renderAHag(uses) {
    runtime.store[KEY] = uses;
    const m = makeMonster({
      name: 'Arch-hag',
      actions: hag().actions,
      legendary_actions: hag().legendary_actions,
    });
    render(<MonsterCardModal {...makeProps(m, { creatureName: 'Arch-hag 1', creatures: CREATURES })} />);
  }
  function hagRow(name) {
    return Array.from(document.querySelectorAll('.mc-action')).find(r => r.textContent.startsWith(name));
  }

  it('header shows (3 left); both prose children render gated chips', () => {
    renderAHag({ max: 3, used: 0 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(3 left)');
    for (const name of ['Hag\'s Swipe', 'Malicious Magic']) {
      const chip = hagRow(name).querySelector('.mc-dice-link-legendary');
      expect(chip).not.toBe(null);
      expect(chip.textContent).toContain('Expend Legendary');
    }
  });

  it('Hag\'s Swipe gated click spends 1 and rolls the delegated +14 / 3d6 + 7 Force + prone clause, zero console dead-end', async () => {
    renderAHag({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(hagRow('Hag\'s Swipe').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(ROLLERS.rollAttack).toHaveBeenCalled());
    expect(ROLLERS.rollAttack.mock.calls[0][0]).toBe('Hag\'s Swipe (Spectral Claw attack)');
    expect(ROLLERS.rollAttack.mock.calls[0][1]).toBe(14);
    const options = ROLLERS.rollAttack.mock.calls[0][2];
    expect(options.autoDamageFormula).toBe('3d6 + 7');
    expect(options.damageType).toBe('Force');
    expect(options.hitClause.conditions).toEqual(['prone']);
    expect(options.targetName).toBe('TestPC');
    const spend = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'ability_use' && /Hag's Swipe/.test(String(e.description)));
    expect(spend.description).toMatch(/expends a legendary use for Hag's Swipe/);
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    errSpy.mockRestore();
  });

  it('Malicious Magic gated click spends 1 and lands the advisory record (popup + ability_use log), zero rolls, zero console dead-end', async () => {
    renderAHag({ max: 3, used: 0 });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(hagRow('Malicious Magic').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    const html = String(setPopupHtml.mock.calls.map(c => String(c[0])).find(h => /Malicious Magic/.test(h)));
    expect(html).toMatch(/Legendary Action — Malicious Magic/);
    expect(html).toMatch(/casts Dimension Door or Hypnotic Pattern/);
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e =>
      e.type === 'ability_use' && e.abilityName === 'Malicious Magic' && /advisory record/.test(String(e.description)))).toBe(true));
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    expect(ROLLERS.rollDamage).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.flat().some(a => /no resolvable mechanic/.test(String(a)))).toBe(false);
    // once-per-turn cooldown stamped on the spend
    expect(runtime.store[COOLDOWN_KEY]).toMatchObject({ malicious_magic: expect.any(Object) });
    errSpy.mockRestore();
  });

  it('once-per-turn refusal: Malicious Magic at the NEXT boundary refuses (cooldown), zero extra spend', async () => {
    renderAHag({ max: 3, used: 0 });
    fireEvent.click(hagRow('Malicious Magic').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 }));
    // advance to another creature's turn boundary (turn latch no longer matches)
    ctx.value = { round: 1, activeCreatureName: 'Brute 1', creatures: CREATURES };
    fireEvent.click(hagRow('Malicious Magic').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e =>
      /malicious_magic_refused \(once per turn\)/.test(String(e.automationType)))).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 1 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('exhausted (3/3): chip click refuses with popup + legendary_use_refused, zero spend, zero roll', async () => {
    renderAHag({ max: 3, used: 3 });
    expect(document.querySelector('.mc-legendary-counter').textContent).toBe('(0 left)');
    fireEvent.click(hagRow('Hag\'s Swipe').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('Legendary Action Refused');
    await waitFor(() => expect(addEntry.mock.calls.map(c => c[1]).some(e => e.automationType === 'legendary_use_refused')).toBe(true));
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 3 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('own-turn click refuses (turn latch): zero spend, zero roll', async () => {
    renderAHag({ max: 3, used: 0 });
    ctx.value = { round: 1, activeCreatureName: 'Arch-hag 1', creatures: CREATURES };
    fireEvent.click(hagRow('Hag\'s Swipe').querySelector('.mc-dice-link-legendary'));
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toContain('not its own');
    expect(runtime.store[KEY]).toEqual({ max: 3, used: 0 });
    expect(ROLLERS.rollAttack).not.toHaveBeenCalled();
  });

  it('turn-start regain clears uses, latch AND per-action cooldown with an ability_use log', async () => {
    runtime.store[KEY] = { max: 3, used: 2 };
    runtime.store[LATCH_KEY] = { round: 1, activeCreature: 'Thug 1' };
    runtime.store[COOLDOWN_KEY] = { malicious_magic: { round: 1, usedBefore: 1 } };
    const res = await regainLegendaryUses({
      monsterName: 'Arch-hag 1',
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
    expect(runtime.store[COOLDOWN_KEY]).toBe(null);
    const regain = addEntry.mock.calls.map(c => c[1]).find(e => /regains all expended legendary action uses/.test(String(e.description)));
    expect(regain.description).toMatch(/Arch-hag 1 regains all expended legendary action uses at the start of its turn — 3 available\./);
  });
});
