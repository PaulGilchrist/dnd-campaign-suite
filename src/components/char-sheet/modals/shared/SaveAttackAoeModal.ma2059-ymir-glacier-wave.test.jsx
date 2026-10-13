// MA-2059: Ymir "Glacier Wave" picker-lane consumer unit — the two-field fix
// (recharge:"5-6" + save_effect Restrained) on the LIVE Line picker seam
// (SaveAttackAoeModal, MA-2033 lane: press opens "120-ft Line (GM positions
// tokens; selection advisory)"). Pre-fix the row carried no save_effect →
// extractConditionsFromSaveEffect [] → applySaveFailConditions early-return
// (:654) → Restrained NEVER landed after failed saves (§567 bait). Post-fix,
// driven from the disk row's own bytes:
//   FAIL face (full-word saveBonuses.strength:-19 → any nat ≤20-19 < DC 26):
//     full 14d10 damage AND restrained granted (activeConditions + meta +
//     `condition applied` log carrying the authored until-clause).
//   SUCCESS face (+30 → any nat ≥31): half damage floor(Σ/2), NO restrained
//     (fail-only grant lane, MA-1921 twin).
// dc_success transported 'half' (row authors none — the half-default IS the
// RAW "Success: Half damage"; copy pinned below). Recharge economy axis rides
// the MONSTER seam (spend at picker-open, refusal pre-gate) — unit-locked in
// monsterRecharge.ma2059-ymir-glacier-wave.test.js; picker mocks stay out of
// it here (thunderbolt MA-0084 sphere twin mock surface reused).
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

import { extractConditionsFromSaveEffect } from '../../../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../../../services/encounters/monsterAbilityUses.js';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  // Deterministic 14d10 pool (live fail face rolled Σ=81; half face floors cleanly).
  rollExpression: vi.fn((f) => (f ? { total: 81, rolls: [5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 5], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((f) => (f ? { total: 81, rolls: [], modifier: 0 } : null)),
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
const roster = vi.hoisted(() => ({ current: [] }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: roster.current })),
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

const WAVE = monstersData.find(m => m.index === 'ymir').actions[3];

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderWave(props = {}) {
  return render(
    <SaveAttackAoeModal
      action={WAVE}
      playerStats={{ name: 'Ymir 1' }}
      campaignName="test-campaign"
      range={120}
      damage={WAVE.damage_dice_primary}
      damageType={WAVE.damage_type_primary}
      saveType={WAVE.save_type}
      saveDc={WAVE.save_dc}
      dcSuccess="half"
      titleOverride="120-ft Line (GM positions tokens; selection advisory)"
      excludeNames={['Ymir 1']}
      rangeGateFt={null}
      saveConditions={extractConditionsFromSaveEffect(WAVE.save_effect)}
      conditionDurationNote={extractConditionDurationNote(WAVE.save_effect)}
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
  roster.current = [
    { name: 'Ymir 1', type: 'npc', currentHp: 615, maxHp: 615, saveBonuses: {}, resistances: [], immunities: [] },
    // FULL-WORD picker fold key (§163/MA-2033): -19 = any nat ≤ 1 < DC 26 (fail face); +30 = any nat ≥ 31 (success face).
    { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { strength: -19 }, resistances: [], immunities: [] },
    { name: 'Bandit 2', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { strength: 30 }, resistances: [], immunities: [] },
  ];
});

describe('MA-2059 fix authored on the disk row (transport inputs)', () => {
  it('save_effect + recharge authored; dc_success UNSET transports the half-default copy', async () => {
    expect(WAVE.save_effect).toBe('The target has the Restrained condition until the end of its next turn.');
    expect(WAVE.recharge).toBe('5-6');
    expect(WAVE.dc_success).toBeUndefined();
    spyRandom([0.5]);
    renderWave();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    expect(document.querySelector('.sp-header').textContent).toMatch(/120-ft Line/);
    expect(document.querySelector('.sp-desc').textContent).toMatch(/Strength/);
    expect(document.querySelector('.sp-desc').textContent).toMatch(/DC 26/);
    const copy = document.querySelector('.sp-note-copy').textContent;
    expect(copy).toMatch(/On a failed save, target takes 14d10 Bludgeoning damage\./);
    expect(copy).toMatch(/On a successful save, target takes half damage\./);
  });
});

describe('MA-2059 picker fail face: full 14d10 AND Restrained lands together (was zero-grant bait)', () => {
  it('failed STR save (strength:-19, deterministic): full 81 Bludgeoning + restrained activeConditions + meta + grant log with authored until-clause', async () => {
    roster.current = roster.current.filter(c => c.name === 'Ymir 1' || c.name === 'Bandit 1'); // success face isolated to its own test
    spyRandom([0.01, 0.01, 0.5, 0.5]);
    renderWave();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    await waitFor(() => expect(applyDamageToTarget).toHaveBeenCalled());
    const failCall = applyDamageToTarget.mock.calls.find(c => c[1] === 'Bandit 1');
    expect(failCall).toBeTruthy();
    expect(failCall[2]).toBe(81); // fail face: no halve

    expect(runtime.store['Bandit 1.activeConditions']).toEqual(['restrained']);
    expect(runtime.store['Bandit 1.activeConditionMeta'].restrained).toEqual(
      expect.objectContaining({ source: 'Ymir 1', dc: 26 }));
    const condLog = addEntry.mock.calls.map(c => c[1]).find(e => e.type === 'condition' && e.action === 'applied' && /Bandit 1/.test(String(e.description)));
    expect(condLog).toBeTruthy();
    expect(condLog.condition).toBe('Restrained');
    expect(condLog.description).toMatch(/Restrained until the end of its next turn \(GM-enforced\)/);
    expect(condLog.description).not.toMatch(/1 minute/); // MA-0063 boilerplate replaced by authored clause (MA-0084 seam)
  });
});

describe('MA-2059 picker success face: half damage floor, zero Restrained grant (fail-only lane)', () => {
  it('saved (strength:+30, deterministic): floor(81/2)=40 applied, no restrained, no grant log', async () => {
    roster.current = roster.current.filter(c => c.name === 'Ymir 1' || c.name === 'Bandit 2'); // only the +30 saver is in the picker — fail-face Bandit 1 isolated out (grants covered above)
    spyRandom([0.9, 0.9, 0.5, 0.5]);
    renderWave();
    await waitFor(() => expect(seenTargets.current.length).toBe(1));
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    await waitFor(() => expect(document.querySelector('.abjure-result-success')).toBeTruthy());
    expect(document.querySelector('.abjure-results-list').textContent).toMatch(/Saved — takes .*damage \(rolled .*halved\)/);
    const saveCall = applyDamageToTarget.mock.calls.find(c => c[1] === 'Bandit 2');
    expect(saveCall).toBeTruthy();
    expect(saveCall[2]).toBe(40); // floor(81/2) — half-default matches RAW "Success: Half damage"
    expect(runtime.store['Bandit 2.activeConditions']).toBeUndefined();
    expect(addEntry.mock.calls.map(c => c[1]).some(e => e.type === 'condition' && e.action === 'applied')).toBe(false);
  });
});
