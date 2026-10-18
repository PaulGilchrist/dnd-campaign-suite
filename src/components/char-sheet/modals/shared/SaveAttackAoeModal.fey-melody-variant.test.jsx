// @maintained-by-ai
// MA-1436: Fey Melody variant picker — the GM-chosen variant threaded via the
// saveVariant prop drives per-variant outcomes on the emanation picker:
// Charming fail = charmed+incapacitated + ONE rounds:10 §37 clock + ZERO damage
// (dc_success none, no formula); Frightening fail = full 2d6+3 Psychic +
// frightened only + clock; Frightening success = half damage, nothing granted,
// clock inert; chooserless rows (saveVariant falsy) arm NO clock but still
// grant their saveConditions. Mirrors the MA-1058 toxic-ink emanation harness.
import { render, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';
import monstersData from '../../../../../public/data/monsters.json';

vi.mock('../../../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn((f) => (f ? { total: 10, rolls: [], modifier: 0 } : null)),
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

// Mixed-confirm seam: Bandit 1 always FAILS (−19 vs DC 14, any roll),
// Bandit 2 saves vs fails per summaryCfg — pins per-target discrimination.
const summaryCfg = vi.hoisted(() => ({ b1Wis: -19, b2Wis: 19 }));
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Satyr Revelmaster 1', type: 'npc', currentHp: 82, maxHp: 82, saveBonuses: {}, resistances: [], immunities: [] },
      { name: 'Bandit 1', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { wisdom: summaryCfg.b1Wis }, resistances: [], immunities: [] },
      { name: 'Bandit 2', type: 'npc', currentHp: 999, maxHp: 999, saveBonuses: { wisdom: summaryCfg.b2Wis }, resistances: [], immunities: [] },
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
  default: ({ targets, onConfirm, onSkip }) => {
    seenTargets.current = targets;
    return (
      <div className="sp-overlay">
        {targets.map(t => (<label key={t.name} className="secondary-target-row"><input type="checkbox" />{t.name}</label>))}
        <button className="sp-roll-btn" onClick={() => onConfirm(seenTargets.current.map(t => t.name))} type="button">Confirm</button>
        <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
      </div>
    );
  },
}));

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';

const FEY_MELODY = monstersData.find(m => m.index === 'satyr-revelmaster').actions.find(a => a.name === 'Fey Melody');
const byKey = Object.fromEntries(FEY_MELODY.variants.map(v => [v.key, v]));

let randomSpy;
function spyRandom(seq) {
  let i = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => seq[Math.min(i++, seq.length - 1)]);
}
afterEach(() => randomSpy?.mockRestore());

function renderAoe(overrides) {
  return render(
    <SaveAttackAoeModal
      action={FEY_MELODY}
      playerStats={{ name: 'Satyr Revelmaster 1' }}
      campaignName="test-campaign"
      saveType="Wisdom"
      saveDc={FEY_MELODY.save_dc}
      excludeNames={['Satyr Revelmaster 1']}
      rangeGateFt={60}
      storeLastAttack={false}
      onClose={vi.fn()}
      {...overrides}
    />
  );
}

function renderVariant(variant) {
  return renderAoe({
    range: 60,
    damage: variant.damage_dice ?? null,
    damageType: variant.damage_dice ? variant.damage_type : null,
    dcSuccess: variant.dc_success,
    titleOverride: '60-ft Radius (GM positions tokens; selection advisory)',
    saveConditions: variant.conditions,
    conditionDurationNote: variant.duration_note,
    saveVariant: variant,
  });
}

async function confirmPicker(getByText) {
  await waitFor(() => expect(seenTargets.current.length).toBe(2));
  fireEvent.click(getByText('Confirm'));
  await waitFor(() => expect(addEntry).toHaveBeenCalled());
}

const clocksFor = name => expirations.current.filter(e => e.targetName === name);
const damageCallsFor = name => applyDamageToTarget.mock.calls.filter(c => c[1] === name);

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(runtime.store).forEach(k => delete runtime.store[k]);
  seenTargets.current = [];
  expirations.current = [];
  summaryCfg.b1Wis = -19;
  summaryCfg.b2Wis = 19;
});

describe('MA-1436 Fey Melody variant picker', () => {
  it('Charming FAIL: charmed+incapacitated w/ meta + ONE rounds:10 clock, ZERO damage; the saving target gets NOTHING', async () => {
    spyRandom([0.01, 0.01]);
    const { getByText } = renderVariant(byKey.charming);
    await confirmPicker(getByText);

    expect(runtime.store['Bandit 1.activeConditions']).toEqual(['charmed', 'incapacitated']);
    expect(runtime.store['Bandit 1.activeConditionMeta'].charmed).toMatchObject({ dc: 14, source: 'Satyr Revelmaster 1' });
    expect(runtime.store['Bandit 1.activeConditionMeta'].incapacitated).toMatchObject({ dc: 14, source: 'Satyr Revelmaster 1' });

    const clocks = clocksFor('Bandit 1');
    expect(clocks).toHaveLength(1);
    expect(clocks[0]).toMatchObject({ attackerName: 'Satyr Revelmaster 1', campaignName: 'test-campaign', rounds: 10 });
    expect(clocks[0].effects).toEqual([
      { type: 'condition', condition: 'charmed' },
      { type: 'condition', condition: 'incapacitated' },
    ]);

    // ZERO damage leg: no applyDamage anywhere, no positive save-damage log.
    expect(applyDamageToTarget).not.toHaveBeenCalled();
    const logs = addEntry.mock.calls.map(c => c[1]);
    expect(logs.filter(e => e.rollType === 'save-damage' && (e.finalDamage ?? 0) > 0)).toHaveLength(0);

    // Mixed-confirm: Bandit 2 saved (dc_success none) — nothing granted.
    expect(runtime.store['Bandit 2.activeConditions'] ?? null).toBeNull();
    expect(clocksFor('Bandit 2')).toHaveLength(0);
  });

  it('Frightening FAIL: full damage + frightened ONLY + clock; saving target takes HALF, no condition, no clock', async () => {
    spyRandom([0.01, 0.01]);
    const { getByText } = renderVariant(byKey.frightening);
    await confirmPicker(getByText);

    expect(runtime.store['Bandit 1.activeConditions']).toEqual(['frightened']);
    expect(runtime.store['Bandit 1.activeConditionMeta'].frightened).toMatchObject({ dc: 14, source: 'Satyr Revelmaster 1' });
    expect(damageCallsFor('Bandit 1')).toEqual([
      [expect.anything(), 'Bandit 1', 10, ['Psychic'], expect.objectContaining({ attackerName: 'Satyr Revelmaster 1' })],
    ]);

    const clocks = clocksFor('Bandit 1');
    expect(clocks).toHaveLength(1);
    expect(clocks[0].effects).toEqual([{ type: 'condition', condition: 'frightened' }]);

    // Mixed-confirm: Bandit 2 saved — HALF damage (5), no frightened, no clock.
    expect(runtime.store['Bandit 2.activeConditions'] ?? null).toBeNull();
    expect(damageCallsFor('Bandit 2')).toEqual([
      [expect.anything(), 'Bandit 2', 5, ['Psychic'], expect.objectContaining({ attackerName: 'Satyr Revelmaster 1' })],
    ]);
    expect(clocksFor('Bandit 2')).toHaveLength(0);
  });

  it('Frightening SUCCESS (both save): half damage, NOTHING granted, clock inert', async () => {
    summaryCfg.b1Wis = 19;
    spyRandom([0.99, 0.99]);
    const { getByText } = renderVariant(byKey.frightening);
    await confirmPicker(getByText);

    expect(runtime.store['Bandit 1.activeConditions'] ?? null).toBeNull();
    expect(expirations.current).toHaveLength(0);
    expect(damageCallsFor('Bandit 1')).toEqual([
      [expect.anything(), 'Bandit 1', 5, ['Psychic'], expect.objectContaining({ attackerName: 'Satyr Revelmaster 1' })],
    ]);
    expect(damageCallsFor('Bandit 2')).toEqual([
      [expect.anything(), 'Bandit 2', 5, ['Psychic'], expect.objectContaining({ attackerName: 'Satyr Revelmaster 1' })],
    ]);
  });

  it('guardrail: chooserless row (no saveVariant) still grants its condition but arms NO clock', async () => {
    spyRandom([0.01, 0.01]);
    renderAoe({
      range: 60,
      damage: null,
      damageType: null,
      dcSuccess: 'half',
      saveConditions: ['blinded'],
    });
    await waitFor(() => expect(seenTargets.current.length).toBe(2));
    fireEvent.click(document.querySelector('.sp-roll-btn'));
    await waitFor(() => expect(addEntry).toHaveBeenCalled());

    // Non-vacuous: the fail-leg condition grant DID land — only the clock is guarded.
    expect(runtime.store['Bandit 1.activeConditions']).toEqual(['blinded']);
    expect(expirations.current).toHaveLength(0);
  });
});
