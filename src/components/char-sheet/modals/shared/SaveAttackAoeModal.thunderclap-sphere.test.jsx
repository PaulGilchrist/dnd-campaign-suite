// @maintained-by-ai
// MA-0084: Adult Bronze Dragon Thunderclap picker — 20-ft Radius, DC 17
// CON, 3d6 Thunder, dc_success NONE. Copy never carries the half-damage
// boilerplate (success = no damage), and the picker stays inert until the
// GM confirms. Each failed NPC save applies full damage + Deafened with the
// AUTHORED duration clause ("until the end of its next turn", MA-0084
// conditionDurationNote seam) — the MA-0063 1-minute repeat-save copy only
// survives on rows without an authored until-clause (byte-exact, MA-0063
// family canon incl. the literal 'Blinded' variant). Per-target adjudication
// rides the mixed-confirm RNG seam (2 draws/target: fail, fail, save, save).
// Data-pins + routing live in MonsterCardModal.thunderclap-sphere.test.jsx.
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

function conditionLogsFor(targetName) {
  return addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition' && e.characterName === targetName);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
});

describe('MA-0084 Thunderclap picker — copy honesty (dc_success none) + inert until confirm', () => {
  it('damage row copy states success = no damage, never the half-damage boilerplate; nothing fires pre-confirm', async () => {
    spyRandom([0.5]);
    renderClap();
    await waitFor(() => expect(seenTargets.current).toHaveLength(2));
    expect(document.querySelector('.sp-header').textContent).toMatch(/20-ft Radius/);
    expect(document.querySelector('.sp-desc').textContent).toMatch(/<strong>Constitution<\/strong> saving throw \(DC 17\)/);
    const copy = document.querySelector('.sp-note-copy').textContent;
    expect(copy).toMatch(/takes 3d6 Thunder damage/);
    expect(copy).toMatch(/On a successful save, target takes no damage\./);
    expect(copy).not.toMatch(/half/i);
    // Pre-confirm inertness: the picker alone never damages or grants conditions.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(runtime.store['Thug 1.activeConditions']).toBeUndefined();
    expect(runtime.store['Brute 2.activeConditions']).toBeUndefined();
  });
});

describe('MA-0084 Thunderclap picker — save math + Deafened duration honesty', () => {
  it('mixed CON saves: failed target pays FULL 3d6 + Deafened with the authored until-clause; saved target takes nothing', async () => {
    // Mixed-confirm seam (2 draws/target, target order): Thug 1 rolls 1 (1 − 1 = 0)
    // and FAILS DC 17; Brute 2 rolls 19 (19 + 7 = 26) and SUCCEEDS.
    spyRandom([0.01, 0.01, 0.9, 0.9]);
    renderClap();
    await waitFor(() => expect(seenTargets.current).toHaveLength(2));
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalled());
    // dc_success none: the failed save pays the full mock total — no halving.
    expect(applyDamageToTarget.mock.calls.filter(c => c[2] === 10).map(c => c[1])).toEqual(['Thug 1']);
    const results = document.querySelector('.abjure-results-list').textContent;
    expect(results).toMatch(/Thug 1.*Failed — takes .* damage \(rolled 1\)/s);
    expect(results).toMatch(/Brute 2.*Saved — takes no damage \(rolled 19\)/s);
    const condLog = conditionLogsFor('Thug 1')[0];
    expect(condLog.description).toMatch(/Deafened until the end of its next turn \(GM-enforced\)/);
    expect(condLog.description).not.toMatch(/1 minute/);
    expect(runtime.store['Thug 1.activeConditions']).toEqual(['deafened']);
    // Per-target grant (positive leg above): the saving throw succeeds, nothing lands.
    expect(conditionLogsFor('Brute 2')).toHaveLength(0);
    expect(runtime.store['Brute 2.activeConditions']).toBeUndefined();
  });

  it('succeeded CON saves: zero damage, no Deafened grant, honest "no damage" result rows', async () => {
    // d20 pinned to 19: Thug 1 (19 − 1 = 18) and Brute 2 (19 + 7 = 26) both beat DC 17.
    spyRandom([0.9, 0.9]);
    renderClap();
    await waitFor(() => expect(seenTargets.current).toHaveLength(2));
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    await waitFor(() => expect(document.querySelector('.abjure-result-success')).toBeTruthy());
    const results = document.querySelector('.abjure-results-list').textContent;
    expect(results).toMatch(/Thug 1.*Saved — takes no damage \(rolled 19\)/s);
    expect(results).toMatch(/Brute 2.*Saved — takes no damage \(rolled 19\)/s);
    expect(results).not.toMatch(/Failed/);
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(runtime.store['Thug 1.activeConditions']).toBeUndefined();
    expect(runtime.store['Brute 2.activeConditions']).toBeUndefined();
  });

  it('byte-exact guard: no authored duration keeps the MA-0063 1-minute repeat-save copy', async () => {
    spyRandom([0.01, 0.01, 0.9, 0.9]); // Thug 1 fails, Brute 2 saves (per-target grant)
    renderClap({ saveConditions: ['blinded'], conditionDurationNote: undefined });
    await waitFor(() => expect(seenTargets.current).toHaveLength(2));
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    const condLog = await waitFor(() => {
      const e = conditionLogsFor('Thug 1')[0];
      expect(e).toBeTruthy();
      return e;
    });
    expect(condLog.description).toBe(
      "Thug 1 failed the Constitution save (DC 17) in Adult Bronze Dragon 1's Thunderclap — Blinded 1 minute; repeats the save at the end of each of its turns (success ends it on itself). NPC turn-end auto-repeat and 1-minute expiry GM-enforced."
    );
    expect(runtime.store['Thug 1.activeConditions']).toEqual(['blinded']);
    expect(conditionLogsFor('Brute 2')).toHaveLength(0);
    expect(runtime.store['Brute 2.activeConditions']).toBeUndefined();
  });
});
