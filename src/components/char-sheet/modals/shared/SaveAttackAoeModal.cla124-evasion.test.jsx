// @maintained-by-ai
// CLA-124/CLA-125 evasion lane for the caster-AoE prompt path (SaveAttackAoeModal).
// Evasion folds 0-on-success / floor-half-on-fail. Eligibility is resolved by
// resolveAoESaveEvasion from the full-stat `characters` prop (persisted
// combatSummary player entries are MINIMAL STUBS with no computedStats —
// CLA-119 family — the old stub read made the fold inert), honors the prompt
// roller's detail.evasionActive, and exempts Incapacitated holders. Every
// adjudicated evasion save emits one rollType:'evasion' ledger entry (both
// outcomes). Twins (Monk lv7 / Rogue lv14) share one fold — these tests pin
// the two eligibility SOURCES and outcomes, not each class.
// Family lanes live elsewhere: ac-penalty, blocking-effects, circle-of-power,
// cla120-empowered-evocation, damage-resolution, soulstitch, creature-selection.
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 35, rolls: [5, 5, 4, 3, 3, 2, 6, 1, 6], modifier: 0, formula: '8d6' })),
  rollExpressionMaximized: vi.fn(() => ({ total: 48, rolls: [], modifier: 0, formula: '8d6', maximized: true })),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

const runtimeRef = { activeConditions: [] };
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => {
    if (name === 'campaign') return [];
    if (key === 'activeConditions') return runtimeRef.activeConditions;
    return null;
  }),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

// Canonical damage folds are MIRRORED here (applyDamage.js:89-128) so the
// evasion math under test is the real formula; only the apply seam is stubbed.
vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn((cs, name, dmg) => ({ finalDamage: dmg, newHp: 100 - dmg })),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasionActive) => {
    if (evasionActive && dcSuccess === 'half') {
      if (success) return 0;
      return Math.floor(raw / 2);
    }
    if (!success) return raw;
    if (dcSuccess === 'half') return Math.floor(raw / 2);
    if (dcSuccess === 'full') return raw;
    return 0;
  }),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn((effects, st) => Array.isArray(effects) && effects.some(e => e.saveType === st)),
  normalizeSaveType: vi.fn((t) => {
    const upper = String(t || '').toUpperCase();
    return { STRENGTH: 'STR', DEXTERITY: 'DEX', CONSTITUTION: 'CON', INTELLIGENCE: 'INT', WISDOM: 'WIS', CHARISMA: 'CHA' }[upper] || upper;
  }),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// CLA-124 real-data shape: persisted player entries are MINIMAL STUBS — no
// computedStats, ever.
vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Disciplined_Monk', type: 'player', currentHp: 183, maxHp: 183 },
      { name: 'DwarfTest', type: 'player', currentHp: 120, maxHp: 120 },
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

// persistAndNotify is LIVE on every prompt resolution (no disk writes in tests);
// renderTargetList only renders via AreaEffectTargetModalBase, which this lane
// never mounts (caster has no 'overlay-' targetName) — export kept purely to
// satisfy the module-scope named import.
vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
  renderTargetList: vi.fn(() => null),
  persistAndNotify: vi.fn(),
}));

vi.mock('../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js', () => ({
  handleOverchannelSelfDamage: vi.fn(async () => {}),
}));

vi.mock('../../../../hooks/combat/loggedDiceRollUtils.js', () => ({
  getGuardianProtectionAcBonus: vi.fn(() => 0),
  hasSoulstitchProtection: vi.fn(() => false),
  clearSoulstitchStamp: vi.fn(),
}));

vi.mock('./CreatureSelectionModal.jsx', async () => {
  const { createInteractivePickerModal } = await import('./SaveAttackAoeModal.test-utils.jsx');
  return { default: createInteractivePickerModal({ dataName: true }) };
});

// ── Re-import mocked modules ──

import { addEntry } from '../../../../services/ui/logService.js';
import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';

const wizardCaster = { name: 'DivinationWizard', level: 20, automation: { actions: [], passives: [] } };

const EVASION = [{ source: 'Evasion', saveType: 'DEX', shareable: false, shareRange: 0 }];
const fullCharacters = [
  { name: 'Disciplined_Monk', type: 'player', computedStats: { evasionEffects: EVASION } },
  { name: 'DwarfTest', type: 'player', computedStats: { evasionEffects: [] } },
];

const baseProps = {
  action: { name: 'Fireball', automation: {} },
  playerStats: wizardCaster,
  campaignName: 'test-campaign',
  range: 150,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 19,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

async function castOn(targetName, characters = fullCharacters) {
  await act(async () => {
    render(<SaveAttackAoeModal {...baseProps} characters={characters} />);
  });
  await act(async () => {
    fireEvent.click(document.querySelector(`input[data-name="${targetName}"]`));
    fireEvent.click(screen.getByRole('button', { name: /Fireball \(1\)/ }));
  });
  expect(sendSavePrompt).toHaveBeenCalledTimes(1);
}

async function rollAndSubmit(detail) {
  const promptId = sendSavePrompt.mock.calls[0][1].promptId;
  await act(async () => {
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, ...detail } }));
  });
  await waitFor(() => {
    expect(addEntry.mock.calls.length).toBeGreaterThan(0);
  });
}

const logs = (filterFn) => addEntry.mock.calls.map(c => c[1]).filter(e => e && filterFn(e));
const appliedTo = (name) => applyDamageToTarget.mock.calls.filter(c => c[1] === name).map(c => c[2]);
const evasionLogs = (name) => logs(e => e.rollType === 'evasion' && e.targetName === name);
const saveDamageLog = (name, total) => logs(e => e.rollType === 'save-damage' && e.targetName === name).find(e => e.total === total);

describe('SaveAttackAoeModal — CLA-124/CLA-125 evasion fold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeRef.activeConditions = [];
  });

  it('eligibility from characters (no detail flag) + success: 0 damage applied, evasion ledger + save-damage note both attribute Evasion', async () => {
    await castOn('Disciplined_Monk');
    await rollAndSubmit({
      targetName: 'Disciplined_Monk',
      success: true,
      roll: 19,
      rawRolls: [19],
      mode: 'normal',
      saveBonus: 7,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 35,
      total: 26,
    });

    expect(appliedTo('Disciplined_Monk')).toHaveLength(0);
    const ledger = evasionLogs('Disciplined_Monk');
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ name: 'Evasion', saveResult: 'success', dcSuccess: 'half', finalDamage: 0 });
    const damageLog = saveDamageLog('Disciplined_Monk', 35);
    expect(damageLog.finalDamage).toBe(0);
    expect(damageLog.note).toBe('Evasion');
  });

  it('prompt roller detail.evasionActive alone folds success to 0 even when characters show no evasion (roller authority)', async () => {
    await castOn('DwarfTest');
    await rollAndSubmit({
      targetName: 'DwarfTest',
      success: true,
      roll: 18,
      rawRolls: [18],
      mode: 'normal',
      saveBonus: 1,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 35,
      total: 19,
      evasionActive: true,
    });

    expect(appliedTo('DwarfTest')).toHaveLength(0);
    const ledger = evasionLogs('DwarfTest');
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ saveResult: 'success', finalDamage: 0 });
    expect(saveDamageLog('DwarfTest', 35).note).toBe('Evasion');
  });

  it('evasion FAIL pays floor(raw/2) and logs rollType:evasion failure', async () => {
    await castOn('Disciplined_Monk');
    await rollAndSubmit({
      targetName: 'Disciplined_Monk',
      success: false,
      roll: 7,
      rawRolls: [7],
      mode: 'normal',
      saveBonus: 7,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 35,
      total: 14,
    });

    expect(appliedTo('Disciplined_Monk')).toEqual([17]);
    const ledger = evasionLogs('Disciplined_Monk');
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ saveResult: 'failure', finalDamage: 17 });
  });

  it('Incapacitated evasion holder is exempt: success pays normal HALF, no evasion ledger', async () => {
    runtimeRef.activeConditions = ['Incapacitated'];
    await castOn('Disciplined_Monk');
    await rollAndSubmit({
      targetName: 'Disciplined_Monk',
      success: true,
      roll: 19,
      rawRolls: [19],
      mode: 'normal',
      saveBonus: 7,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 35,
      total: 26,
    });

    expect(appliedTo('Disciplined_Monk')).toEqual([17]);
    expect(evasionLogs('Disciplined_Monk')).toHaveLength(0);
  });

  it('control — persisted change-data shape (no computedStats, no evasion): success pays HALF, no crash, no evasion ledger', async () => {
    await castOn('DwarfTest', [{ name: 'DwarfTest', type: 'player', currentHp: 120, maxHp: 120 }]);
    await rollAndSubmit({
      targetName: 'DwarfTest',
      success: true,
      roll: 18,
      rawRolls: [18],
      mode: 'normal',
      saveBonus: 1,
      saveType: 'DEX',
      saveDc: 19,
      dcSuccess: 'half',
      rawDamage: 35,
      total: 19,
    });

    expect(appliedTo('DwarfTest')).toEqual([17]);
    expect(evasionLogs('DwarfTest')).toHaveLength(0);
  });
});
