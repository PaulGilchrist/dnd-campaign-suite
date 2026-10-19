// @maintained-by-ai
// MA-1868: Cthulhu "Psychic Shatter" once-per-turn gate on the REGULAR
// save-chip lane. The row (actions[3], numeric save_dc → "DC 24 Intelligence"
// chip) resolves through handleSaveRoll and NEVER reaches expendLegendaryUse,
// so the MA-0073 cooldown never armed — pre-fix the chip re-fired unlimited
// times per turn (live: 2/2 fires, 0 refused). Fix = DATA `once_per_turn:
// true` + oncePerTurnActionGate (MonsterCardModal.jsx:2492) reusing the
// MA-0073 latch vocabulary; the monster's OWN turn-start (regainLegendaryUses
// :361, legendary-state-independent) clears the latch → next-turn refire.
// Owned elsewhere (not duplicated here): disk fingerprint incl. key-order,
// save_effect bytes, dc_success-absent, slug, latch stamp/refusal/idempotence/
// clear, byte-inert rows at service level →
// monsterLegendaryUses.ma1868-psychic-shatter-cooldown.test.js:53-139;
// legendary turn economy → MonsterCardModal.legendary-uses.test.jsx;
// Madness Whisper mis-route + its latch-innocence pin → ma1872:233.
// This file locks ONLY the modal chip→handleSaveRoll gate seam.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';
import monstersData from '../../../public/data/monsters.json';
import { regainLegendaryUses, MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY } from '../../services/encounters/monsterLegendaryUses.js';

vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
const ROLLERS = vi.hoisted(() => ({ rollAttack: null, rollSavingThrow: null }));
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const rollAttack = vi.fn();
  const rollSavingThrow = vi.fn();
  ROLLERS.rollAttack = rollAttack;
  ROLLERS.rollSavingThrow = rollSavingThrow;
  return { default: vi.fn(() => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack, rollDamage: vi.fn(), rollAbilityCheck: vi.fn(),
    rollSavingThrow, rollSkillCheck: vi.fn(), rollInitiative: vi.fn(), quickRollPlayerSave: vi.fn(),
  })), _setPopupHtml };
});
// ctx feeds the turn-boundary gate + the round the latch stamps — network-free.
const ctx = vi.hoisted(() => ({ value: { round: 1, activeCreatureName: 'Bandit 1', creatures: [] } }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((t) => (t || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn((cs, name) => (cs?.creatures || []).find(c => c.name === name) || null),
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
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
const setPopupHtml = useLoggedDiceRoll._setPopupHtml;

const CTHULHU = monstersData.find((m) => m.index === 'cthulhu');
const CAMPAIGN = 'test-campaign';
const MONSTER = 'Cthulhu 1';
const VICTIM = 'Bandit 1';

const CREATURES = [
  { name: MONSTER, type: 'npc', targetName: VICTIM, currentHp: 540, maxHp: 540, ac: 22, conditions: [] },
  { name: VICTIM, type: 'npc', currentHp: 999, maxHp: 999, ac: 12, conditions: [], ability_score_modifiers: { int: -2 } },
];

const latch = () => runtime.store[`${MONSTER}.${MONSTER_LEGENDARY_ACTION_COOLDOWNS_KEY}`];
const refusedLogs = () => addEntry.mock.calls.map((c) => c[1]).filter((e) => e.automationType === 'psychic_shatter_refused (once per turn)');

function actionRow(name) {
  return [...document.querySelectorAll('.mc-action')].find((r) => r.querySelector('strong')?.textContent.trim().startsWith(name)) || null;
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(runtime.store)) delete runtime.store[k];
  ctx.value = { round: 1, activeCreatureName: VICTIM, creatures: [] };
});

describe('MA-1868 once-per-turn gate on the regular save-chip lane', () => {
  it('press fires the DC 24 INT save and stamps the latch; same-turn re-press REFUSES (popup + refusal log, zero roll, latch unchanged); own turn-start clear re-arms next-turn refire', async () => {
    render(<MonsterCardModal {...makeProps(makeMonster({ ...CTHULHU }), { creatureName: MONSTER, creatures: CREATURES })} />);
    // REGULAR lane: numeric save_dc renders its own clickable save chip, NO
    // legendary expend chip (prose "can't USE…until ITS next turn" never arms
    // the legend lane — field-driven only, pinned in the service twin).
    const row = actionRow('Psychic Shatter');
    const chip = row.querySelector('.mc-dice-link-save-clickable');
    expect(chip.textContent.trim()).toBe('DC 24 Intelligence');
    expect(row.querySelector('.mc-dice-link-legendary')).toBeNull();

    // first press resolves through handleSaveRoll and stamps the MA-0073 latch
    fireEvent.click(chip);
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
    expect(ROLLERS.rollSavingThrow.mock.calls[0][0]).toBe('INT');
    // absent authored dc_success → honest engine half-default ("Success: Half damage")
    expect(ROLLERS.rollSavingThrow.mock.calls[0][2]).toMatchObject({ saveDc: 24, saveType: 'Intelligence', dcSuccess: 'half' });
    await waitFor(() => expect(latch()).toMatchObject({ psychic_shatter: { round: 1 } }));

    // SECOND press, same turn — refused before any roll, latch not refreshed
    ROLLERS.rollSavingThrow.mockClear();
    setPopupHtml.mockClear();
    fireEvent.click(chip);
    expect(ROLLERS.rollSavingThrow).not.toHaveBeenCalled();
    await waitFor(() => expect(setPopupHtml).toHaveBeenCalled());
    expect(String(setPopupHtml.mock.calls[0][0])).toMatch(/can't take Psychic Shatter again until the start of its next turn/);
    await waitFor(() => expect(refusedLogs().length).toBeGreaterThan(0));
    expect(latch()).toMatchObject({ psychic_shatter: { round: 1 } });

    // monster's OWN turn-start: the MA-0073 :361 clear runs for regular
    // monsters too and clears the same key this lane stamps
    ctx.value = { round: 2, activeCreatureName: MONSTER, creatures: CREATURES };
    await regainLegendaryUses({ monsterName: MONSTER, campaignName: CAMPAIGN });
    expect(latch()).toBeNull();

    // next turn — chip re-fires honestly (fresh save roll, fresh stamp at new round)
    ctx.value = { round: 2, activeCreatureName: VICTIM, creatures: CREATURES };
    ROLLERS.rollSavingThrow.mockClear();
    fireEvent.click(chip);
    expect(ROLLERS.rollSavingThrow).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(latch()).toMatchObject({ psychic_shatter: { round: 2 } }));
    expect(refusedLogs()).toHaveLength(1); // exactly one refusal across the whole lifecycle
  });

  it('rows without once_per_turn stay ungated at this modal seam: Claw chip fires repeatedly, never stamps the latch', async () => {
    render(<MonsterCardModal {...makeProps(makeMonster({ ...CTHULHU }), { creatureName: MONSTER, creatures: CREATURES })} />);
    const clawChip = actionRow('Claw').querySelector('.mc-dice-link');
    expect(clawChip).toBeTruthy();
    fireEvent.click(clawChip);
    expect(ROLLERS.rollAttack).toHaveBeenCalledTimes(1);
    // re-press allowed — ungated rows never gain a cooldown stamp
    fireEvent.click(clawChip);
    expect(ROLLERS.rollAttack).toHaveBeenCalledTimes(2);
    expect(latch()).toBeUndefined();
  });
});
