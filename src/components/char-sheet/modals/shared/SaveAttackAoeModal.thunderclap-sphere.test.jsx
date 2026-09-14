// MA-0084: Adult Bronze Dragon Thunderclap picker — 20-ft Radius, DC 17
// CON, 3d6 Thunder, dc_success NONE. Copy never carries the half-damage
// boilerplate (success = no damage). Failed NPC saves apply full damage +
// Deafened with the AUTHORED duration clause ("until the end of its next
// turn", MA-0084 conditionDurationNote seam) — the MA-0063 1-minute
// repeat-save copy only survives on rows without an authored until-clause.
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
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => (success ? (dcSuccess === 'half' ? Math.floor(raw / 2) : 0) : raw)),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => (success ? (dcSuccess === 'half' ? Math.floor(raw / 2) : 0) : raw)),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));
vi.mock('../../../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Adult Bronze Dragon 1', type: 'npc', currentHp: 200, maxHp: 200, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Thug 1', type: 'npc', currentHp: 45, maxHp: 45, saveBonuses: { constitution: -1 }, resistances: [], immunities: [] },
      { name: 'Brute 2', type: 'npc', currentHp: 55, maxHp: 55, saveBonuses: { constitution: 7 }, resistances: [], immunities: [] },
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

const THUNDERCLAP = monstersData.find(m => m.index === 'adult-bronze-dragon').legendary_actions.find(a => a.name === 'Thunderclap');

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderClap(props = {}) {
  return render(
    <SaveAttackAoeModal
      action={THUNDERCLAP}
      playerStats={{ name: 'Adult Bronze Dragon 1' }}
      campaignName="test-campaign"
      range={20}
      damage="3d6"
      damageType="Thunder"
      saveType="Constitution"
      saveDc={17}
      dcSuccess="none"
      titleOverride="20-ft Radius (GM positions tokens; selection advisory)"
      excludeNames={['Adult Bronze Dragon 1']}
      rangeGateFt={null}
      saveConditions={['deafened']}
      conditionDurationNote="until the end of its next turn (GM-enforced)"
      storeLastAttack={false}
      onClose={vi.fn()}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
});

describe('MA-0084 Thunderclap picker — copy honesty (dc_success none)', () => {
  it('damage row copy states success = no damage, never the half-damage boilerplate', async () => {
    spyRandom([0.5]);
    renderClap();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    expect(document.querySelector('.sp-header').textContent).toMatch(/20-ft Radius/);
    expect(document.querySelector('.sp-desc').textContent).toMatch(/Constitution/);
    expect(document.querySelector('.sp-desc').textContent).toMatch(/DC 17/);
    const copy = document.querySelector('.sp-note-copy').textContent;
    expect(copy).toMatch(/takes 3d6 Thunder damage/);
    expect(copy).toMatch(/On a successful save, target takes no damage\./);
    expect(copy).not.toMatch(/half/i);
  });
});

describe('MA-0084 Thunderclap picker — save math + Deafened duration honesty', () => {
  it('failed CON save: full 3d6 damage + Deafened with the authored until-clause', async () => {
    spyRandom([0.01, 0.01, 0.9, 0.9]);
    renderClap();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalled());
    const failCall = applyDamageToTarget.mock.calls.find(c => c[1] === 'Thug 1' && c[2] === 10);
    expect(failCall).toBeTruthy();
    const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && /Thug 1/.test(String(e.description)));
    expect(condLog.description).toMatch(/Deafened until the end of its next turn \(GM-enforced\)/);
    expect(condLog.description).not.toMatch(/1 minute/);
    expect(runtime.store['Thug 1.activeConditions']).toEqual(['deafened']);
  });

  it('succeeded CON save: zero damage, no Deafened grant', async () => {
    spyRandom([0.9, 0.9]);
    renderClap();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    await waitFor(() => expect(document.querySelector('.abjure-result-success')).toBeTruthy());
    expect(document.querySelector('.abjure-results-list').textContent).toMatch(/Saved — takes no damage \(rolled 19\)/);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(runtime.store['Thug 1.activeConditions']).toBeUndefined();
    expect(runtime.store['Brute 2.activeConditions']).toBeUndefined();
  });

  it('byte-identical guard: no authored duration keeps the MA-0063 1-minute repeat-save copy', async () => {
    spyRandom([0.01, 0.01, 0.9, 0.9]);
    renderClap({ saveConditions: ['blinded'], conditionDurationNote: undefined });
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    const condLog = await waitFor(() => {
      const e = addEntry.mock.calls.map(c => c[1]).find(x => x.type === 'condition' && /Thug 1/.test(String(x.description)));
      expect(e).toBeTruthy();
      return e;
    });
    expect(condLog.description).toMatch(/Blinded 1 minute; repeats the save at the end of each of its turns/);
  });
});
