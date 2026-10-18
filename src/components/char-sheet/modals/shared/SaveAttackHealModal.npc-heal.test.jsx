// @maintained-by-ai
// CLA-208 regression lane: Land's Aid style save+heal area features must restore
// real HP to EB-joined monsters. Monster HP lives in combatSummary.currentHp
// (applyDamage NPC branch), NOT in the per-name runtime currentHitPoints —
// so the heal must go through applyHealingToTarget/modifyHitPoints, and the
// result must persist to combatSummary (cache + storage).
//
// This suite uses the REAL applyHealing.js + hpModifier.js, mocking only
// transport (runtime store, storage, SSE/log), range checks, the resistance
// engine (applyDamage) and dice. Sibling lanes: healFlows.test.jsx owns radio
// gating, one-of-two arbitration, report/Done (applyHealing mocked);
// saveFlows.test.jsx owns save routing and pending-player UI.
import { render, fireEvent, waitFor, act, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackHealModal from './SaveAttackHealModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 10),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { guid: vi.fn(() => 'npc-heal-guid') },
}));

vi.mock('../../../../services/ui/storage.js', () => ({
  default: { set: vi.fn(), get: vi.fn(() => null) },
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));

// Simple NPC damage sink — the resistance engine is not this lane's subject;
// it just needs to write real HP onto combatSummary.currentHp pre-heal.
vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn((cs, name, dmg) => {
    const creature = cs.creatures.find(c => c.name === name);
    const oldHp = creature.currentHp;
    creature.currentHp = Math.max(0, oldHp - dmg);
    return { finalDamage: dmg, oldHp, newHp: creature.currentHp };
  }),
  computeDamageAfterEvasion: vi.fn((raw, success) => (success ? Math.floor(raw / 2) : raw)),
  computeDamageAfterSave: vi.fn((raw, success) => (success ? Math.floor(raw / 2) : raw)),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn(t => String(t).toLowerCase()),
}));

// ── Re-import mocked modules (applyHealing.js is NOT mocked — real logic) ──

import * as logService from '../../../../services/ui/logService.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as healingRoll from '../../../../services/automation/common/healingRoll.js';
import storage from '../../../../services/ui/storage.js';
import { setCombatSummaryCache } from '../../../../services/encounters/combatData.js';
import { getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Fixtures ──

const NPC = 'Animated Rug of Smothering 1';
const MAX_HP = 27;
const SAVE_DAMAGE = 7; // 4d6 mock total, save fails (d20 4 vs DC 17) → full damage

function makeProps(overrides) {
  return {
    combatSummary: {
      creatures: [
        { name: 'Wild_Sage_Druid', type: 'player', maxHp: 122 },
        { name: NPC, type: 'npc', maxHp: MAX_HP, currentHp: MAX_HP, saveBonuses: { con: 0 } },
      ],
    },
    attackerName: 'Wild_Sage_Druid',
    attackerPos: null,
    saveDc: 17,
    campaignName: 'test-campaign',
    mapData: null,
    featureName: "Land's Aid",
    saveType: 'CON',
    rangeFeet: 60,
    damageExpression: '4d6',
    damageType: 'Necrotic',
    healExpression: '4d6',
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

function getRug(props) {
  return props.combatSummary.creatures.find(c => c.name === NPC);
}

// Deterministic dice in exact roll order: CON save fails (4 vs DC 17), then
// damage 4d6=7, then heal 4d6=healTotal. Any extra or unexpected roll throws
// so drift in the modal's roll recipe fails loudly instead of silently.
function scriptDice(healTotal) {
  const fourD6Queue = [SAVE_DAMAGE, healTotal];
  diceRoller.rollExpression.mockImplementation(expr => {
    if (expr === '1d20') return { total: 4, rolls: [4], modifier: 0 };
    if (expr === '4d6') {
      const total = fourD6Queue.shift();
      if (total === undefined) throw new Error('Unexpected extra 4d6 roll');
      return { total, rolls: [1, 2, 1, 3], modifier: 0 };
    }
    throw new Error(`Unexpected roll expression: ${expr}`);
  });
}

// Select the rug, resolve the save (fails → 7 necrotic, currentHp 20), then
// radio-select it and heal.
async function applyFeatureAndHeal(props, getByRole, healTotal) {
  scriptDice(healTotal);
  fireEvent.click(getCheckboxByName(NPC));
  await act(async () => {
    fireEvent.click(getByRole('button', { name: /Land's Aid \(1 target\)/ }));
  });
  await waitFor(() => {
    expect(getRug(props).currentHp).toBe(MAX_HP - SAVE_DAMAGE);
  });
  await act(async () => {
    fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
  });
}

// ── Tests ──

describe('SaveAttackHealModal — NPC heal restores combatSummary HP (CLA-208)', () => {
  let props;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    props = makeProps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    // Deficit 7 after the 7-point save damage.
    { case: 'clamps to maxHp when the roll exceeds the deficit', heal: 10, actualHeal: 7, newHp: 27 },
    { case: 'applies the full roll when it lands below maxHp', heal: 4, actualHeal: 4, newHp: 24 },
  ])('$case — heal 4d6=$heal restores $actualHeal HP (20 → $newHp of 27)', async ({ heal, actualHeal, newHp }) => {
    const { getByRole } = render(<SaveAttackHealModal {...props} />);
    await applyFeatureAndHeal(props, getByRole, heal);

    // DECISIVE (CLA-208): NPC HP actually restored on combatSummary.currentHp.
    expect(getRug(props).currentHp).toBe(newHp);

    expect(healingRoll.logHealingToSSE).toHaveBeenCalledTimes(1);
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', {
      targetName: NPC,
      sourceName: "Land's Aid",
      actualHeal,
      newHp,
      maxHp: MAX_HP,
    });

    // Persisted to storage + combat summary cache.
    expect(storage.set).toHaveBeenCalledWith('combatSummary', props.combatSummary, 'test-campaign');
    expect(setCombatSummaryCache).toHaveBeenCalledWith(props.combatSummary, 'test-campaign');

    // Popup reports the actual (nonzero) heal — the user-visible CLA-208 proof.
    await waitFor(() => {
      expect(document.querySelector('.sp-body').textContent).toContain(`actual: ${actualHeal}`);
    });

    // Healing roll logged with the rolled formula and total.
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'roll',
      rollType: 'healing',
      targetName: NPC,
      formula: '4d6',
      total: heal,
    }));
  });
});
