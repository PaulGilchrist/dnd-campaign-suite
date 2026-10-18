// @maintained-by-ai
// MA-0079: Adult Bronze Dragon Repulsion Breath picker adjudication — damageless
// STR DC 19 cone. This lane owns the CONDITION + push combination path: failed
// saves grant Prone via the MA-0063 canonical applySaveFailConditions path
// (saveConditions non-empty, so the MA-0138 push-only branch stays inert) PLUS
// an instant `push` marker te (value 60, CLA-384 marker shape, token movement
// GM-enforced) with a named condition-applied log naming the push clause.
// Successes grant nothing; ZERO damage is applied (dc_success none, no formula)
// and the picker copy never carries the half-damage boilerplate. PC targets get
// the prompt with saveConditions carried on the payload (quick-roll lastAttack
// stamp keeps them) and the grant lands at the save-result listener seam.
// Row data-pins (recharge/dc) live in MonsterCardModal.repulsion-breath.test.jsx;
// the click-path routing lives there too. Save bonuses are NOT asserted: the
// component reads saveBonuses[saveType.toLowerCase()] and raw rolls pin every
// outcome here, so the mock creatures stay bonus-free (family recipe).
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
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Guard 1', type: 'npc', currentHp: 55, maxHp: 55, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'AberrantSorcerer', type: 'player', currentHp: 52, maxHp: 52, saveBonuses: {}, resistances: [], immunities: [] },
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
// Each NPC save consumes exactly two draws (raw1, raw2 — SaveAttackAoeModal
// computeNpcSave); the PC prompt id consumes one more. Target order:
// Thug 1, Guard 1, AberrantSorcerer. 0.01 → raw 1 (fail vs DC 19),
// 0.99 → raw 20 (success).
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

const loggedEntries = () => addEntry.mock.calls.map(c => c[1]);
const pushTes = () => (runtime.store['campaign.targetEffects'] || []).filter(te => te.effect === 'push');

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  promptsSent.current = [];
});

describe('MA-0079 Repulsion Breath picker — damageless prone + push adjudication', () => {
  it('one confirm: failed NPC save grants Prone + instant push te (60) + push advisory log; successful NPC save grants nothing; zero damage, no half-boilerplate', async () => {
    // Draws: Thug raw1/2 low → roll 1 (<DC 19, fail); Guard raw1 high →
    // roll 20 (success). Prompt id for AberrantSorcerer consumes the tail.
    spyRandom([0.01, 0.01, 0.99, 0.99, 0.99]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current).toHaveLength(3));

    // Damageless picker copy: Prone-on-fail prose, never half-damage.
    expect(document.querySelector('.sp-note-copy').textContent).toMatch(/On a failed save, target is Prone\./);
    expect(document.querySelector('.sp-note-copy').textContent).not.toMatch(/half/i);
    expect(document.querySelector('.sp-desc').textContent).toContain('DC 19');

    // Pre-confirm inertness: nothing granted before the GM confirms.
    expect(runtime.store['campaign.targetEffects']).toBeUndefined();
    expect(runtime.store['Thug 1.activeConditions']).toBeUndefined();

    fireEvent.click(getByText('Confirm'));

    // FAIL leg — Thug 1: Prone (MA-0063 meta) + push marker te + named log.
    await waitFor(() => expect(runtime.store['Thug 1.activeConditions']).toEqual(['prone']));
    expect(runtime.store['Thug 1.activeConditionMeta'].prone).toEqual({ dc: 19, ability: 'str', source: 'Adult Bronze Dragon 1' });
    await waitFor(() => expect(pushTes()).toHaveLength(1));
    const push = pushTes()[0];
    expect(push).toMatchObject({ target: 'Thug 1', value: 60, duration: 'instant', source: 'Adult Bronze Dragon 1' });
    const conditionLogs = loggedEntries().filter(e => e.type === 'condition');
    expect(conditionLogs).toHaveLength(1);
    expect(conditionLogs[0].characterName).toBe('Thug 1');
    expect(conditionLogs[0].condition).toBe('Prone');
    expect(conditionLogs[0].description).toMatch(/Pushed up to 60 ft straight away from Adult Bronze Dragon 1/);

    // SUCCESS leg — Guard 1: nothing granted (push te set holds Thug only).
    expect(runtime.store['Guard 1.activeConditions']).toBeFalsy();
    expect(pushTes().some(te => te.target === 'Guard 1')).toBe(false);
    expect(loggedEntries().some(e => e.characterName === 'Guard 1')).toBe(false);

    // Damageless row (dc_success none): no damage lane fires at all.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });

  it('PC prompt carries saveConditions + dc_success none + zero raw damage; failed save-result lands Prone + push at the listener seam', async () => {
    spyRandom([0.01, 0.01, 0.99, 0.99, 0.99]);
    const { getByText } = renderBreath();
    await waitFor(() => expect(seenTargets.current).toHaveLength(3));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(promptsSent.current).toHaveLength(1));
    const prompt = promptsSent.current[0];
    expect(prompt).toMatchObject({ targetName: 'AberrantSorcerer', saveType: 'Strength', saveDc: 19, saveConditions: ['prone'], dcSuccess: 'none', rawDamage: 0 });

    // No PC-side grant until the player answers: Thug's push te is the only one.
    expect(pushTes().some(te => te.target === 'AberrantSorcerer')).toBe(false);

    // Re-dispatch until the listener (registered once pendingPrompts state
    // flushes) consumes it — consumed events no-op on -1 index.
    await waitFor(() => {
      fireEvent(window, new CustomEvent('save-result', { detail: { promptId: prompt.promptId, success: false, roll: 5, total: 4, saveBonus: -1 } }));
      expect(runtime.store['AberrantSorcerer.activeConditions']).toContain('prone');
    });
    expect(runtime.store['AberrantSorcerer.activeConditionMeta'].prone).toEqual({ dc: 19, ability: 'str', source: 'Adult Bronze Dragon 1' });
    expect(pushTes().some(te => te.target === 'AberrantSorcerer' && te.value === 60 && te.duration === 'instant')).toBe(true);
    const pcLog = loggedEntries().find(e => e.type === 'condition' && e.characterName === 'AberrantSorcerer');
    expect(pcLog.description).toMatch(/Pushed up to 60 ft straight away from Adult Bronze Dragon 1/);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
  });
});
