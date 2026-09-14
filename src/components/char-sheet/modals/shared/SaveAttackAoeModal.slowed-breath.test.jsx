// MA-0087: Adult Copper Dragon Slowing Breath picker — damageless CON DC 18
// cone. Confirming the picker grants the authored "slowed" rider te clauses on
// each NPC failed save: speed_half, no_reactions and no_action_and_bonus_action
// (each an existing registered te with a live consumer, sourced from the
// dragon, duration until_end_of_next_turn + rounds:2 expiry clock, MA-0073
// recipe) with one named Slowed condition log. Successful saves grant nothing.
// ZERO damage (dc_success none) and the picker copy never carries the
// half-damage boilerplate — the "null null damage" cosmetic is gone.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 10, rolls: [3, 3, 4], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((f) => (f ? { total: 10, rolls: [], modifier: 0 } : null)),
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
      { name: 'Adult Copper Dragon 1', type: 'npc', currentHp: 184, maxHp: 184, saveBonuses: {}, resistances: [], immunities: ['Acid'] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { con: 1 }, resistances: [], immunities: [] },
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

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { parseSlowedClauses } from '../../../encounter/MonsterCardHelpers.js';

const COPPER = monstersData.find(m => m.index === 'adult-copper-dragon');
const SLOWING = COPPER.actions.find(a => a.name === 'Slowing Breath');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderBreath() {
  return render(
    <SaveAttackAoeModal
      action={SLOWING}
      playerStats={{ name: 'Adult Copper Dragon 1' }}
      campaignName="test-campaign"
      range={60}
      damage={null}
      damageType=""
      saveType="Constitution"
      saveDc={18}
      dcSuccess="none"
      titleOverride="60-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={['Adult Copper Dragon 1']}
      rangeGateFt={60}
      saveConditions={[]}
      slowedClauses={parseSlowedClauses(SLOWING.save_effect)}
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

describe('MA-0087 Adult Copper Slowing Breath picker', () => {
  it('damageless picker copy states the Slowed riders, never null-null / half-damage boilerplate', async () => {
    spyRandom([0.5]);
    renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    const copy = document.querySelector('.sp-note-copy').textContent;
    expect(copy).toMatch(/Slowed: can't take Reactions, Speed halved/);
    expect(copy).not.toMatch(/null/i);
    expect(copy).not.toMatch(/half damage/i);
  });

  it('NPC failed CON save grants speed_half + no_reactions + no_action_and_bonus_action te + rounds:2 clocks + one Slowed log, zero damage', async () => {
    spyRandom([0.05, 0.05, 0.05, 0.05, 0.05, 0.05]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    const tes = runtime.store['campaign.targetEffects'] || [];
    for (const effect of ['speed_half', 'no_reactions', 'no_action_and_bonus_action']) {
      const te = tes.find(t => t.effect === effect && t.target === 'Thug 1');
      expect(te, `te ${effect}`).toBeTruthy();
      expect(te.source).toBe('Adult Copper Dragon 1');
      expect(te.duration).toBe('until_end_of_next_turn');
      expect(te.actionName).toBe('Slowing Breath');
    }
    expect(expirations.current).toHaveLength(3);
    expect(expirations.current.every(e => e.rounds === 2 && e.targetName === 'Thug 1')).toBe(true);

    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.condition === 'Slowed');
    expect(log).toBeTruthy();
    expect(log.description).toMatch(/can't take Reactions, Speed halved/);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('NPC successful CON save grants nothing — no te, no expiry, no Slowed log', async () => {
    spyRandom([0.99, 0.99, 0.99, 0.99, 0.99, 0.99]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect((runtime.store['campaign.targetEffects'] || []).length).toBe(0);
    expect(expirations.current).toHaveLength(0);
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.condition === 'Slowed')).toBeFalsy();
  });
});
