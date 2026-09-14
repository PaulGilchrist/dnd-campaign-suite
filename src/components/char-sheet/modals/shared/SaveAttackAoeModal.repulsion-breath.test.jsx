// MA-0079: Adult Bronze Dragon Repulsion Breath picker — damageless STR DC 19
// cone. Confirming the picker: NPC failed STR saves grant Prone (MA-0063
// canonical condition path) + an instant `push` marker te (value 60,
// CLA-384 pull-marker shape, token movement GM-enforced) with a named
// condition-applied log naming the push clause; successes grant nothing; ZERO
// damage is applied (dc_success none) and the picker copy never carries the
// half-damage boilerplate. PC targets get the prompt with saveConditions
// carried on the payload (quick-roll lastAttack stamp keeps them, MA-0079).
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

const promptsSent = vi.hoisted(() => ({ current: [] }));
vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn((campaignName, payload) => { promptsSent.current.push(payload); }),
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
      { name: 'Adult Bronze Dragon 1', type: 'npc', currentHp: 212, maxHp: 212, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { str: 1 }, resistances: [], immunities: [] },
      { name: 'AberrantSorcerer', type: 'player', currentHp: 52, maxHp: 52, saveBonuses: { str: -1 }, resistances: [], immunities: [] },
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
vi.mock('../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js', () => ({
  handleOverchannelSelfDamage: vi.fn(async () => {}),
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

const REPULSION = monstersData.find(m => m.index === 'adult-bronze-dragon').actions.find(a => a.name === 'Repulsion Breath');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderBreath() {
  return render(
    <SaveAttackAoeModal
      action={REPULSION}
      playerStats={{ name: 'Adult Bronze Dragon 1' }}
      campaignName="test-campaign"
      range={30}
      damage={null}
      damageType=""
      saveType="Strength"
      saveDc={19}
      dcSuccess="none"
      titleOverride="30-ft Cone (GM positions tokens; selection advisory)"
      excludeNames={['Adult Bronze Dragon 1']}
      rangeGateFt={30}
      saveConditions={['prone']}
      pushFeet={60}
      storeLastAttack={false}
      onClose={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  promptsSent.current = [];
});

describe('MA-0079 Repulsion Breath — data + picker', () => {
  it('data lock: canonical Recharge 5-6 + dc_success none authored on the row', () => {
    expect(REPULSION.save_dc).toBe(19);
    expect(REPULSION.save_type).toBe('Strength');
    expect(REPULSION.recharge).toBe('5-6');
    expect(REPULSION.dc_success).toBe('none');
    expect(REPULSION.damage_dice_primary).toBeUndefined();
  });

  it('damageless picker copy states Prone-on-fail, never the half-damage boilerplate', async () => {
    spyRandom([0.5]);
    renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    const copy = document.querySelector('.sp-note-copy').textContent;
    expect(copy).toMatch(/On a failed save, target is Prone\./);
    expect(copy).not.toMatch(/half/i);
  });

  it('NPC failed STR save grants Prone + push marker te + push advisory log, zero damage', async () => {
    spyRandom([0.05, 0.05, 0.05, 0.05, 0.05, 0.05]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(runtime.store['Thug 1.activeConditions']).toBeTruthy());
    expect(runtime.store['Thug 1.activeConditions']).toContain('prone');
    expect(runtime.store['Thug 1.activeConditionMeta'].prone.dc).toBe(19);
    expect(runtime.store['Thug 1.activeConditionMeta'].prone.ability).toBe('str');
    const push = runtime.store['campaign.targetEffects'].find(te => te.effect === 'push' && te.target === 'Thug 1');
    expect(push).toBeTruthy();
    expect(push.value).toBe(60);
    expect(push.duration).toBe('instant');
    expect(push.source).toBe('Adult Bronze Dragon 1');
    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && (e.description || '').includes('Prone'));
    expect(log.description).toMatch(/Pushed up to 60 ft straight away from Adult Bronze Dragon 1/);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('NPC successful STR save grants nothing — no prone, no push te, no condition log', async () => {
    spyRandom([0.99, 0.99, 0.99, 0.99, 0.99, 0.99]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect(runtime.store['Thug 1.activeConditions']).toBeFalsy();
    expect((runtime.store['campaign.targetEffects'] || []).find(te => te.effect === 'push')).toBeFalsy();
    expect(addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition')).toBeFalsy();
  });

  it('PC prompt payload carries saveConditions + dc_success none (quick-roll stamp seam)', async () => {
    spyRandom([0.5, 0.5, 0.5, 0.5]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(promptsSent.current.length).toBe(1));
    const prompt = promptsSent.current[0];
    expect(prompt.targetName).toBe('AberrantSorcerer');
    expect(prompt.saveConditions).toEqual(['prone']);
    expect(prompt.dcSuccess).toBe('none');
    expect(prompt.rawDamage).toBe(0);
    // PC fails the rolled prompt → Prone + push marker land at the listener
    // seam. Re-dispatch until the listener (registered once pendingPrompts
    // state flushes) consumes it — consumed events no-op on -1 index.
    await waitFor(() => {
      fireEvent(window, new CustomEvent('save-result', { detail: { promptId: prompt.promptId, success: false, roll: 11, total: 10, saveBonus: -1 } }));
      expect(runtime.store['AberrantSorcerer.activeConditions']).toBeTruthy();
    });
    expect(runtime.store['AberrantSorcerer.activeConditions']).toContain('prone');
    expect(runtime.store['campaign.targetEffects'].find(te => te.effect === 'push' && te.target === 'AberrantSorcerer')).toBeTruthy();
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });
});
