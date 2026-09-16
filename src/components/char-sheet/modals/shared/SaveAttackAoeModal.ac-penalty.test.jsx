// MA-0115: Adult Green Dragon Noxious Miasma sphere picker — CON DC 17,
// 2d6 Poison, 20-ft radius. Confirming the picker grants the authored
// "−2 penalty to AC until the end of its next turn" clause as the registered
// ac_penalty te (value 2, sourced from the dragon, until_end_of_next_turn +
// rounds:2 expiry clock, MA-0073/MA-0087 shape) with one named AC Penalty
// condition log on each NPC failed save. Successful saves grant nothing;
// acPenaltyClause null (every other row) is byte-inert.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 7, rolls: [2, 5], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((f) => (f ? { total: 7, rolls: [], modifier: 0 } : null)),
}));
vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({ resolveScaling: vi.fn(() => null) }));

const runtime = vi.hoisted(() => {
  const store = {};
  return {
    store,
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; }),
  };
});
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: runtime.getRuntimeValue,
  setRuntimeValue: runtime.setRuntimeValue,
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));
vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));
vi.mock('../../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Adult Green Dragon 1', type: 'npc', currentHp: 224, maxHp: 224, saveBonuses: {}, resistances: [], immunities: ['Poison'] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { con: -1 }, resistances: [], immunities: [] },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../../../hooks/useAllySelection.js', () => ({ getAllyList: vi.fn(() => null) }));
vi.mock('../../../../services/automation/common/damageRollback.js', () => ({ storeSpellLastAttack: vi.fn(), addTargetResult: vi.fn() }));
vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
  isDistanceInRange: vi.fn(() => true),
}));
vi.mock('../../../../services/rules/features/sleepService.js', () => ({ stageSleepTargets: vi.fn() }));

const expirations = vi.hoisted(() => ({ current: [] }));
vi.mock('../../../../services/rules/effects/expirationQueue.js', () => ({
  addExpiration: vi.fn((arg) => { expirations.current.push(arg); }),
}));

const seenTargets = vi.hoisted(() => ({ current: [] }));
vi.mock('./CreatureSelectionModal.jsx', () => ({
  default: ({ title, description, note, targets, onConfirm, onSkip }) => {
    seenTargets.current = targets;
    return (
      <div className="sp-overlay">
        <div className="sp-header">{title}</div>
        <div className="sp-desc">{description}</div>
        <div className="sp-note-copy">{note}</div>
        {targets.map(t => (<label key={t.name} className="secondary-target-row"><input type="checkbox" />{t.name}</label>))}
        <button className="sp-roll-btn" onClick={() => onConfirm(seenTargets.current.map(t => t.name))} type="button">Confirm</button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
      </div>
    );
  },
}));

import { addEntry } from '../../../../services/ui/logService.js';
import { parseAcPenaltyClause } from '../../../encounter/MonsterCardHelpers.js';

const GREEN = monstersData.find(m => m.index === 'adult-green-dragon');
const MIASMA = GREEN.legendary_actions.find(a => a.name === 'Noxious Miasma');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderMiasma(acPenaltyClause = parseAcPenaltyClause(MIASMA.save_effect)) {
  return render(
    <SaveAttackAoeModal
      action={MIASMA}
      playerStats={{ name: 'Adult Green Dragon 1' }}
      campaignName="test-campaign"
      range={20}
      damage="2d6"
      damageType="Poison"
      saveType="Constitution"
      saveDc={17}
      dcSuccess="none"
      titleOverride="20-ft Radius (GM positions tokens; selection advisory)"
      excludeNames={['Adult Green Dragon 1']}
      saveConditions={[]}
      acPenaltyClause={acPenaltyClause}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  expirations.current = [];
});

describe('MA-0115 Adult Green Noxious Miasma picker', () => {
  it('failed NPC CON save grants ac_penalty te value 2 + rounds:2 clock + named AC Penalty log', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    const { getByText } = renderMiasma();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    const tes = runtime.store['campaign.targetEffects'] || [];
    const te = tes.find(t => t.effect === 'ac_penalty' && t.target === 'Thug 1');
    expect(te).toBeTruthy();
    expect(te).toMatchObject({ source: 'Adult Green Dragon 1', duration: 'until_end_of_next_turn', value: 2, actionName: 'Noxious Miasma' });

    expect(expirations.current.some(x =>
      x.rounds === 2
      && x.targetName === 'Thug 1'
      && x.effects.some(e => e.type === 'remove_target_effect' && e.effectKey === 'ac_penalty'))).toBe(true);

    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.condition === 'AC Penalty');
    expect(log).toBeTruthy();
    expect(log.characterName).toBe('Thug 1');
    expect(log.description).toMatch(/\u22122 AC until the end of Thug 1's next turn/);
  });

  it('successful NPC CON save grants nothing — no te, no expiry, no AC Penalty log', async () => {
    spyRandom([0.99, 0.99, 0.99, 0.99]);
    const { getByText } = renderMiasma();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect((runtime.store['campaign.targetEffects'] || []).some(t => t.effect === 'ac_penalty')).toBe(false);
    expect(expirations.current.some(x => x.effects?.some(e => e.effectKey === 'ac_penalty'))).toBe(false);
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.condition === 'AC Penalty')).toBeFalsy();
  });

  it('acPenaltyClause null (every other row) is byte-inert: failed save grants no te', async () => {
    spyRandom([0.01, 0.01, 0.01, 0.01]);
    const { getByText } = renderMiasma(null);
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect((runtime.store['campaign.targetEffects'] || []).some(t => t.effect === 'ac_penalty')).toBe(false);
    expect(expirations.current.some(x => x.effects?.some(e => e.effectKey === 'ac_penalty'))).toBe(false);
  });
});
