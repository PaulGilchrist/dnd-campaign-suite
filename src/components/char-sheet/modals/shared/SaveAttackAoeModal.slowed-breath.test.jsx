// @maintained-by-ai
// MA-0087 lane: damageless "slowed" rider picker (Adult Copper Slowing Breath
// shape — CON DC 18, dc_success none, no damage formula). Given an authored
// slowedClauses prop, the picker shows the Slowed rider copy (never null-null /
// half-damage boilerplate) and stays inert until Confirm. On confirm, each NPC
// that FAILS the save grants the three registered te clauses (speed_half,
// no_reactions, no_action_and_bonus_action) sourced from the caster with
// until_end_of_next_turn duration + a rounds:2 expiry clock each (MA-0073
// recipe) plus one named Slowed condition log; each NPC that SAVES grants
// nothing. Zero damage either way. JSON parsing of the clause is pinned in
// MonsterCardHelpers.slowed-clauses.test.js — this lane feeds the literal.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

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
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { constitution: 2 }, resistances: [], immunities: [] },
      { name: 'Acolyte 2', type: 'npc', currentHp: 33, maxHp: 33, saveBonuses: {}, resistances: [], immunities: [] },
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

const SLOWING_ACTION = { name: 'Slowing Breath' };
const SLOWED_CLAUSES = { effects: ['speed_half', 'no_reactions', 'no_action_and_bonus_action'] };

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderBreath() {
  return render(
    <SaveAttackAoeModal
      action={SLOWING_ACTION}
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
      slowedClauses={SLOWED_CLAUSES}
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
  it('damageless picker copy states the full Slowed rider and stays inert until Confirm — no null / half-damage boilerplate', async () => {
    spyRandom([0.5]);
    renderBreath();
    await waitFor(() => expect(seenTargets.current).toHaveLength(2));
    expect(seenTargets.current.map(t => t.name)).toEqual(['Thug 1', 'Acolyte 2']);

    const copy = document.querySelector('.sp-note-copy').textContent;
    expect(copy).toContain("Slowed: can't take Reactions, Speed halved, and one action or Bonus Action (not both) until the end of its next turn.");
    expect(document.querySelector('.sp-desc').textContent).toContain('Constitution');
    expect(document.querySelector('.sp-desc').textContent).toContain('DC 18');
    expect(document.querySelector('.sp-overlay').textContent).not.toMatch(/null/i);
    expect(document.querySelector('.sp-overlay').textContent).not.toMatch(/half damage/i);

    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
    expect(expirations.current).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('mixed confirm: failed CON save grants the slowed te trio + rounds:2 clocks + one Slowed log; successful save grants nothing; zero damage', async () => {
    // Two draws per NPC save in selection order: Thug 1 rolls 1+2=3 (fails DC 18),
    // Acolyte 2 rolls 20 (succeeds).
    spyRandom([0.01, 0.01, 0.99, 0.99]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current).toHaveLength(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(runtime.store['campaign.targetEffects']).toHaveLength(3));

    const tes = runtime.store['campaign.targetEffects'];
    expect(tes.map(t => t.effect).sort()).toEqual(['no_action_and_bonus_action', 'no_reactions', 'speed_half']);
    for (const te of tes) {
      expect(te.target).toBe('Thug 1');
      expect(te.source).toBe('Adult Copper Dragon 1');
      expect(te.duration).toBe('until_end_of_next_turn');
      expect(te.actionName).toBe('Slowing Breath');
    }

    expect(expirations.current).toHaveLength(3);
    expect(expirations.current.every(e => e.rounds === 2 && e.targetName === 'Thug 1')).toBe(true);
    expect(expirations.current.map(e => e.effects[0].effectKey).sort()).toEqual(['no_action_and_bonus_action', 'no_reactions', 'speed_half']);

    const slowedLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition' && e.condition === 'Slowed');
    expect(slowedLogs).toHaveLength(1);
    expect(slowedLogs[0].characterName).toBe('Thug 1');
    expect(slowedLogs[0].description).toMatch(/failed the Constitution save \(DC 18\)/);

    // Zero damage on this damageless row, for either outcome.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });
});
