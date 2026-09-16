// MA-0138: Adult Silver Dragon Cold Gale legendary line picker — DEX DC 19,
// 4d6 Cold half-on-success, push-only fail clause ("pushed up to 30 feet
// straight away"). saveConditions is EMPTY (push is not a canonical
// condition), so the MA-0079 marker inside applySaveFailConditions can never
// fire behind its empty-saveConditions guard — the MA-0138 push-only grant in
// resolveSaveFailGrant registers the instant `push` marker te (value 30,
// CLA-384/MA-0079 shape, token movement GM-enforced) with a named
// condition-applied log on failed saves ONLY; successes take half damage and
// grant zero push te / zero condition log.
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
      { name: 'Adult Silver Dragon 1', type: 'npc', currentHp: 216, maxHp: 216, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { dex: -1 }, resistances: [], immunities: [] },
      { name: 'Guard 1', type: 'npc', currentHp: 55, maxHp: 55, saveBonuses: { dex: 7 }, resistances: [], immunities: [] },
      { name: 'AberrantSorcerer', type: 'player', currentHp: 52, maxHp: 52, saveBonuses: { dex: -1 }, resistances: [], immunities: [] },
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
import { extractConditionsFromSaveEffect, parsePushFeetClause } from '../../../encounter/MonsterCardHelpers.js';

const COLD_GALE = monstersData.find(m => m.index === 'adult-silver-dragon').legendary_actions.find(a => a.name === 'Cold Gale');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderGale() {
  return render(
    <SaveAttackAoeModal
      action={COLD_GALE}
      playerStats={{ name: 'Adult Silver Dragon 1' }}
      campaignName="test-campaign"
      range={60}
      damage="4d6"
      damageType="Cold"
      saveType="Dexterity"
      saveDc={19}
      dcSuccess="half"
      titleOverride="60-ft Line (GM positions tokens; selection advisory)"
      excludeNames={['Adult Silver Dragon 1']}
      rangeGateFt={60}
      saveConditions={[]}
      pushFeet={30}
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

describe('MA-0138 Cold Gale — push-only fail clause producer', () => {
  it('data lock: DEX DC 19 4d6 Cold half + header uses:3 + push clause parses to 30', () => {
    expect(COLD_GALE.save_dc).toBe(19);
    expect(COLD_GALE.save_type).toBe('Dexterity');
    expect(COLD_GALE.damage_dice_primary).toBe('4d6');
    expect(COLD_GALE.damage_type_primary).toBe('Cold');
    expect(COLD_GALE.dc_success).toBeUndefined();
    expect(extractConditionsFromSaveEffect(COLD_GALE.save_effect)).toEqual([]);
    expect(parsePushFeetClause(COLD_GALE.save_effect)).toEqual({ feet: 30 });
    const header = monstersData.find(m => m.index === 'adult-silver-dragon').legendary_actions[0];
    expect(header.uses).toBe(3);
  });

  it('NPC failed DEX save: FULL damage + push marker te (value 30, instant) + push advisory log', async () => {
    spyRandom([0.05, 0.05, 0.05, 0.05, 0.05, 0.05]);
    const { getByText } = renderGale();
    await waitFor(() => expect(seenTargets.current.length).toBe(3));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => {
      const push = (runtime.store['campaign.targetEffects'] || []).find(te => te.effect === 'push' && te.target === 'Thug 1');
      expect(push).toBeTruthy();
    });
    const push = runtime.store['campaign.targetEffects'].find(te => te.effect === 'push' && te.target === 'Thug 1');
    expect(push.value).toBe(30);
    expect(push.duration).toBe('instant');
    expect(push.source).toBe('Adult Silver Dragon 1');
    expect(runtime.store['Thug 1.activeConditions']).toBeFalsy();
    const dmg = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'roll' && e.rollType === 'save-damage' && e.targetName === 'Thug 1');
    expect(dmg.finalDamage).toBe(10);
    expect(dmg.saveResult).toBe('failure');
    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && (e.description || '').includes('pushed'));
    expect(log.condition).toBe('Pushed');
    expect(log.description).toMatch(/Thug 1 failed the Dexterity save \(DC 19\) in Adult Silver Dragon 1's Cold Gale — pushed up to 30 ft straight away/);
  });

  it('NPC successful DEX save: HALF damage, zero push te, zero condition log', async () => {
    spyRandom([0.99, 0.99, 0.99, 0.99, 0.99, 0.99]);
    const { getByText } = renderGale();
    await waitFor(() => expect(seenTargets.current.length).toBe(3));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());
    expect((runtime.store['campaign.targetEffects'] || []).find(te => te.effect === 'push' && te.target === 'Guard 1')).toBeFalsy();
    expect(runtime.store['Guard 1.activeConditions']).toBeFalsy();
    const guardLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e.targetName === 'Guard 1' || (e.description || '').includes('Guard 1'));
    expect(guardLogs.find(e => e.type === 'condition')).toBeFalsy();
    const dmg = guardLogs.find(e => e.rollType === 'save-damage' && e.saveResult === 'success');
    expect(dmg.finalDamage).toBe(5);
    expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Guard 1', 5, ['Cold'], expect.anything());
  });

  it('PC prompt fail: push marker te + advisory log land at the save-result listener seam', async () => {
    spyRandom([0.05, 0.05, 0.05, 0.05]);
    const { getByText } = renderGale();
    await waitFor(() => expect(seenTargets.current.length).toBe(3));
    fireEvent.click(getByText('Confirm'));
    await waitFor(() => expect(promptsSent.current.length).toBe(1));
    const prompt = promptsSent.current[0];
    expect(prompt.targetName).toBe('AberrantSorcerer');
    expect(prompt.saveConditions).toEqual([]);
    expect(prompt.dcSuccess).toBe('half');
    await waitFor(() => {
      fireEvent(window, new CustomEvent('save-result', { detail: { promptId: prompt.promptId, success: false, roll: 11, total: 10, saveBonus: -1 } }));
      const push = (runtime.store['campaign.targetEffects'] || []).find(te => te.effect === 'push' && te.target === 'AberrantSorcerer');
      expect(push).toBeTruthy();
    });
    const log = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && (e.description || '').includes('pushed'));
    expect(log.description).toMatch(/Pushed|pushed up to 30 ft/);
  });
});
