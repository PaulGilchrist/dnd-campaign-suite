// @maintained-by-ai
// MA-2059: Ymir "Glacier Wave" picker-lane consumer unit — the two-field fix
// (recharge:"5-6" + save_effect Restrained) on the LIVE Line picker seam
// (SaveAttackAoeModal, MA-2033 lane: press opens "120-ft Line (GM positions
// tokens; selection advisory)"). Pre-fix the row carried no save_effect →
// extractConditionsFromSaveEffect [] → applySaveFailConditions early-return
// (:654) → Restrained NEVER landed after failed saves (§567 bait). Post-fix,
// driven from the disk row's OWN bytes through the picker props:
//   mixed-confirm face per family canon (#200-#220): one picker, two bandits —
//     FAIL (full-word saveBonuses.strength:-19 → any nat ≤20-19 < DC 26):
//       full 14d10 damage AND Restrained granted (activeConditions + meta +
//       `condition applied` log carrying the AUTHORED until-clause, not the
//       MA-0063 1-minute boilerplate — MA-0084 seam).
//     SUCCESS (+30 → any nat ≥1+30 ≥ DC 26): half damage floor(Σ/2), NO
//       Restrained (fail-only grant lane, MA-1921 twin). The ±19/+30 fold pins
//       make both faces deterministic regardless of RNG draw order; the
//       [0.01,0.01,0.99,0.99] seam (2 raw d20s per save, :59-60) is the belt.
// dc_success transported 'half' (row authors none — the half-default IS the
// RAW "Success: Half damage"; copy pinned in the open-lane test). Row data
// pins live on their owning lanes (monsterRecharge.ma2059 name/desc/recharge;
// ma2063 sibling WAVE save_effect/dc/dice twin) — not re-pinned here.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

import { extractConditionsFromSaveEffect } from '../../../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../../../services/encounters/monsterAbilityUses.js';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  // Deterministic 14d10 pool (fail face Σ=81; half face floors cleanly to 40).
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

const grantLogs = () => addEntry.mock.calls.map(c => c[1]).filter(e => e.type === 'condition' && e.action === 'applied');

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  roster.current = [
    { name: 'Ymir 1', type: 'npc', currentHp: 615, maxHp: 615, saveBonuses: {}, resistances: [], immunities: [] },
    // FULL-WORD picker fold key (§163/MA-2033): -19 pins fail, +30 pins success — every natural fails/succeeds.
    { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { strength: -19 }, resistances: [], immunities: [] },
    { name: 'Bandit 2', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { strength: 30 }, resistances: [], immunities: [] },
  ];
});

describe('MA-2059 Line picker opens from the disk row inputs — honest copy, inert until confirmed', () => {
  it('both bandits pickable (Ymir excluded); header/desc/copy carry Line + Str DC 26 + half-default; zero state pre-confirm', async () => {
    spyRandom([0.5]);
    renderWave();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    expect(seenTargets.current.map(t => t.name)).toEqual(['Bandit 1', 'Bandit 2']); // §567 bait would leave the grant lane empty — picker must still list both
    expect(document.querySelector('.sp-header').textContent).toMatch(/120-ft Line/);
    expect(document.querySelector('.sp-desc').textContent).toMatch(/Strength/);
    expect(document.querySelector('.sp-desc').textContent).toMatch(/DC 26/);
    const copy = document.querySelector('.sp-note-copy').textContent;
    expect(copy).toMatch(/On a failed save, target takes 14d10 Bludgeoning damage\./);
    expect(copy).toMatch(/On a successful save, target takes half damage\./); // dc_success UNSET → half-default IS RAW
    // Pre-confirm inertness: nothing rolled, no damage, no conditions, no grant log.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    expect(grantLogs()).toHaveLength(0);
    expect(Object.keys(runtime.store).filter(k => /activeCondition/.test(k))).toHaveLength(0);
  });
});

describe('MA-2059 mixed-confirm: FAIL face lands full 14d10 AND Restrained together (was zero-grant bait); SAVE face halves only', () => {
  it('one picker, two bandits: Bandit 1 (-19) takes 81 + restrained + authored-clause grant log; Bandit 2 (+30) takes floor(81/2)=40, zero grant', async () => {
    spyRandom([0.01, 0.01, 0.99, 0.99]); // canon seam: 2 raw d20s per save; ±pins make faces order-proof
    renderWave();
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    await waitFor(() => expect(applyDamageToTarget.mock.calls.filter(c => c[1] === 'Bandit 1' || c[1] === 'Bandit 2')).toHaveLength(2));

    const failCall = applyDamageToTarget.mock.calls.find(c => c[1] === 'Bandit 1');
    expect(failCall[2]).toBe(81); // fail face: no halve
    const saveCall = applyDamageToTarget.mock.calls.find(c => c[1] === 'Bandit 2');
    expect(saveCall[2]).toBe(40); // floor(81/2) — half-default matches RAW "Success: Half damage"

    // Results UI shows BOTH faces per-target in one panel.
    const results = document.querySelector('.abjure-results-list').textContent;
    expect(results).toMatch(/Failed/);
    expect(results).toMatch(/Saved — takes .*damage \(rolled .*halved\)/);

    // Restrained is fail-ONLY: exactly one grant, on Bandit 1, never Bandit 2.
    expect(runtime.store['Bandit 1.activeConditions']).toEqual(['restrained']);
    expect(runtime.store['Bandit 1.activeConditionMeta'].restrained).toEqual(
      expect.objectContaining({ source: 'Ymir 1', dc: 26 }));
    expect(runtime.store['Bandit 2.activeConditions']).toBeUndefined();
    expect(runtime.store['Bandit 2.activeConditionMeta']).toBeUndefined();
    const grants = grantLogs();
    expect(grants).toHaveLength(1); // non-vacuous: not zero, not a duplicate
    expect(grants[0].characterName).toBe('Bandit 1');
    expect(grants[0].condition).toBe('Restrained');
    expect(grants[0].description).toMatch(/failed the Strength save \(DC 26\)/);
    expect(grants[0].description).toMatch(/Restrained until the end of its next turn \(GM-enforced\)/);
    expect(grants[0].description).not.toMatch(/1 minute/); // MA-0063 boilerplate replaced by authored until-clause (MA-0084 seam)
  });
});
