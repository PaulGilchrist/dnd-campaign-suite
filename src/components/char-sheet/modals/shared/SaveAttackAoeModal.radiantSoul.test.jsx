// @maintained-by-ai
// CLA-279: Radiant Soul save-AoE one-target model — +CHA folds onto the FIRST eligible
// selected target's damage roll exactly once per cast, and the once-per-turn stamp plus
// pending-target pointer are consumed at application (cla120 Empowered Evocation shape).
import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// Picker-lane tests use the REAL CreatureSelectionModal: SaveAttackAoeModal
// never passes campaignName/attackerName to it, so its overlay-lookup effect
// early-returns and it renders deterministically without map/network mocks.

// ── Mocked modules (data seams only) ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [7, 3], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0, maximized: true })),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

// Runtime store stand-in: the CLA-279 flag + pending pointer live here; reads are
// live so stamp/consume ordering is observable through runtimeRef.
const runtimeRef = { radiantFlag: null, pendingTarget: undefined };
const FLAG_KEY = '_radiantSoul_HexWarlock_oncePerTurn';
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => {
    if (key === '_radiantSoul_HexWarlock_oncePerTurn') return runtimeRef.radiantFlag;
    if (key === 'pendingRadiantSoulTarget') return runtimeRef.pendingTarget;
    return null;
  }),
  setRuntimeValue: vi.fn((name, key, value) => {
    if (key === '_radiantSoul_HexWarlock_oncePerTurn') runtimeRef.radiantFlag = value;
    if (key === 'pendingRadiantSoulTarget') runtimeRef.pendingTarget = value;
  }),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

// Honest save math: fail = full, success = half, evasion success = 0.
vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 10, newHp: 0 })),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasionActive) =>
    success && dcSuccess === 'half' ? (evasionActive ? 0 : Math.floor(raw / 2)) : raw),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Zombie 1', type: 'npc', currentHp: 15, maxHp: 15, saveBonuses: { dex: -1 }, resistances: [], immunities: [] },
      { name: 'Zombie 2', type: 'npc', currentHp: 15, maxHp: 15, saveBonuses: { dex: -1 }, resistances: [], immunities: [] },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => null),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

// Base never renders on this picker lane (no overlay- targetName), but its
// persistAndNotify util runs unconditionally after every cast — keep mocked.
vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
  renderTargetList: vi.fn(() => null),
  persistAndNotify: vi.fn(),
}));

vi.mock('../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js', () => ({
  handleOverchannelSelfDamage: vi.fn(),
}));

// ── Re-import mocked modules ──

const diceRoller = await import('../../../../services/dice/diceRoller.js');
const runtime = await import('../../../../hooks/runtime/useRuntimeState.js');
const logService = await import('../../../../services/ui/logService.js');
const applyDamage = await import('../../../../services/rules/combat/applyDamage.js');

// The CLA-279 adder arrives via the radiantSoulChaMod prop — the modal
// never re-detects the passive here, so no automation payload is needed.
const mockPlayerStats = {
  name: 'HexWarlock',
  level: 14,
  abilities: [{ name: 'Charisma', bonus: 3 }],
};

const baseProps = {
  action: { name: 'Burning Hands', automation: {} },
  playerStats: mockPlayerStats,
  campaignName: 'test-campaign',
  range: 15,
  damage: '7d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 16,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

function checkboxFor(name) {
  const row = [...document.querySelectorAll('.secondary-target-row')]
    .find(r => r.textContent.includes(name));
  return row.querySelector('input[type="checkbox"]');
}

async function confirmTargets(names) {
  for (const n of names) {
    fireEvent.click(checkboxFor(n));
  }
  await act(async () => {
    fireEvent.click(document.querySelector('.sp-roll-btn'));
  });
}

function damageLogEntries() {
  return logService.addEntry.mock.calls
    .map(c => (c[1]?.rollType === 'save-damage' ? c[1] : c[0]?.rollType === 'save-damage' ? c[0] : null))
    .filter(Boolean);
}

function radiantAbilityLogEntries() {
  return logService.addEntry.mock.calls
    .map(c => (c[1]?.abilityName === 'Radiant Soul' ? c[1] : null))
    .filter(Boolean);
}

function radiantRuntimeWrites() {
  return runtime.setRuntimeValue.mock.calls
    .filter(c => c[1] === FLAG_KEY || c[1] === 'pendingRadiantSoulTarget');
}

describe('SaveAttackAoeModal — CLA-279 Radiant Soul one-target model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeRef.radiantFlag = null;
    runtimeRef.pendingTarget = undefined;
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [7, 3], modifier: 0 });
  });

  it('folds +CHA onto the FIRST selected target roll exactly once per cast, then consumes the Radiant Soul stamps', async () => {
    render(<SaveAttackAoeModal {...baseProps} radiantSoulChaMod={3} />);
    await confirmTargets(['Zombie 1', 'Zombie 2']);

    // Dice level: two rolls for two targets — the CHA-folded formula is rolled ONCE.
    const folded = diceRoller.rollExpression.mock.calls.filter(c => c[0] === '7d6 + 3 [Radiant Soul]');
    expect(folded).toHaveLength(1);
    expect(diceRoller.rollExpression).toHaveBeenCalledTimes(2);
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('7d6');

    // Log level: exactly one [Radiant Soul] save-damage row, on the stamped first target.
    const entries = damageLogEntries();
    expect(entries).toHaveLength(2);
    const radiant = entries.filter(e => String(e.formula).includes('[Radiant Soul]'));
    expect(radiant).toHaveLength(1);
    expect(radiant[0]).toMatchObject({ formula: '7d6 + 3 [Radiant Soul]', targetName: 'Zombie 1' });
    const diceOnly = entries.filter(e => e.formula === '7d6');
    expect(diceOnly).toHaveLength(1);
    expect(diceOnly[0].targetName).toBe('Zombie 2');

    // Damage actually lands on both targets from the caster.
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      expect.anything(), 'Zombie 1', expect.any(Number), ['Fire'], expect.objectContaining({ attackerName: 'HexWarlock' }));

    // Stamp lifecycle: cast stamps pendingRadiantSoulTarget on the first target;
    // application writes the once-per-turn flag and clears the pointer to null.
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('HexWarlock', 'pendingRadiantSoulTarget', 'Zombie 1', 'test-campaign');
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('HexWarlock', FLAG_KEY, true, 'test-campaign');
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('HexWarlock', 'pendingRadiantSoulTarget', null, 'test-campaign');
    expect(runtimeRef.pendingTarget).toBeNull();
    expect(runtimeRef.radiantFlag).toBe(true);

    // Ability log cites the adder and the chosen target.
    const radiantLog = radiantAbilityLogEntries();
    expect(radiantLog).toHaveLength(1);
    expect(radiantLog[0].description).toContain('+3');
    expect(radiantLog[0].description).toContain('Zombie 1');
  });

  it.each([
    { case: 'once-per-turn flag already armed', chaMod: 3, flagArmed: true },
    { case: 'non-holder caster (chaMod 0)', chaMod: 0, flagArmed: false },
  ])('never folds the adder nor writes Radiant Soul keys — $case', async ({ chaMod, flagArmed }) => {
    runtimeRef.radiantFlag = flagArmed;
    render(<SaveAttackAoeModal {...baseProps} radiantSoulChaMod={chaMod} />);
    await confirmTargets(['Zombie 1', 'Zombie 2']);

    // Every target rolls raw dice-only; both still take damage.
    expect(diceRoller.rollExpression).toHaveBeenCalledTimes(2);
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(2);
    const entries = damageLogEntries();
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.formula)).toEqual(['7d6', '7d6']);

    // No Radiant Soul runtime writes (no cast stamp, no flag), no ability log,
    // and the pre-existing flag stays untouched.
    expect(radiantRuntimeWrites()).toHaveLength(0);
    expect(radiantAbilityLogEntries()).toHaveLength(0);
    expect(runtimeRef.pendingTarget).toBeUndefined();
    expect(runtimeRef.radiantFlag).toBe(flagArmed);
  });
});
