// @maintained-by-ai
// CLA-237 regression: Nature's Ward (2024 Druid, Circle of the Land lv10)
// resistance ignored on the PC save-damage prompt lane. Persisted combatSummary
// player entries are minimal stubs (CLA-119 family — no automation/computedStats),
// so applyPlayerSaveDamage / applySecondaryPromptDamage fed resolveCreatureDefenses
// stubs whose automation was undefined → the CLA-336 land_resistance fold never
// fired and failed saves paid FULL unhalved elemental damage. The lanes must
// forward the full-stat characters prop (monster-attack/quick-roll seam twin,
// useLoggedDiceRollSaves.js:367) to applyDamageToTarget instead.
//
// Scope: this file pins the MODAL forwarding contract only (primary leg,
// secondary leg, missing-prop guard). The actual resistance halving lives at
// the real applyDamage choke point — covered in applyDamage.natures-ward.test.js.
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  // Formula-aware so the secondary leg (2d6→7) can't masquerade as the
  // primary (10d6→41) in apply-call assertions.
  rollExpression: vi.fn((formula) => (formula === '2d6'
    ? { total: 7, rolls: [2, 5], modifier: 0, formula }
    : { total: 41, rolls: [6, 6, 6, 5, 5, 4, 3, 2, 1, 3], modifier: 0, formula: '10d6' })),
  rollExpressionMaximized: vi.fn(() => ({ total: 60, rolls: [], modifier: 0, formula: '10d6', maximized: true })),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn((cs, name, dmg) => ({ finalDamage: dmg, newHp: 143 - dmg })),
  computeDamageAfterSave: vi.fn((raw, success, dcSuccess) => {
    if (!success) return raw;
    if (dcSuccess === 'half') return Math.floor(raw / 2);
    return 0;
  }),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasionActive) => {
    if (evasionActive && dcSuccess === 'half') return success ? 0 : Math.floor(raw / 2);
    if (!success) return raw;
    if (dcSuccess === 'half') return Math.floor(raw / 2);
    return 0;
  }),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage, typeDetails: [] })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => String(t || '').toUpperCase().slice(0, 3)),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// CLA-119 shape: persisted cs player entries are minimal stubs — no
// automation, no computedStats.
const CS_STUB = { name: 'Wild_Sage_Druid', type: 'player', currentHp: 143, maxHp: 143, saveBonuses: {}, resistances: [], immunities: [] };

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    round: 1,
    creatures: [CS_STUB, { name: 'Bandit 1', type: 'npc', currentHp: 30, maxHp: 30, saveBonuses: { con: 1 }, resistances: [], immunities: [] }],
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
  return { default: createInteractivePickerModal() };
});

// ── Re-import mocked modules ──

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';

const LAND_PASSIVE = {
  type: 'land_resistance',
  conditionImmunity: 'poisoned',
  landMappings: { arid: 'Fire', polar: 'Cold', temperate: 'Lightning', tropical: 'Poison' },
};

// Full-stat character as the sheet/charactersRef lane supplies it: automation
// with the land_resistance passive is what the CLA-336 fold consumes.
const FULL_STAT_DRUID = {
  name: 'Wild_Sage_Druid',
  campaignName: 'test-campaign',
  computedStats: {
    resistances: ['Lightning'],
    immunities: ['Poisoned'],
    evasionEffects: [],
    automation: { passives: [LAND_PASSIVE] },
  },
  automation: { passives: [LAND_PASSIVE] },
};

const caster = { name: 'Wild_Sage_Druid', level: 20 };

const baseProps = {
  action: { name: 'Lightning Bolt', automation: {} },
  playerStats: caster,
  characters: [FULL_STAT_DRUID],
  campaignName: 'test-campaign',
  damage: '10d6',
  damageType: 'Lightning',
  saveType: 'Dexterity',
  saveDc: 17,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

function selectAndConfirm(name) {
  const input = screen.getByText(name).closest('label').querySelector('input[type="checkbox"]');
  fireEvent.click(input);
  fireEvent.click(screen.getByRole('button', { name: /Lightning Bolt \(1\)/ }));
}

function dispatchSaveResult(detail) {
  const promptId = sendSavePrompt.mock.calls[0][1].promptId;
  window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, ...detail } }));
}

const failedSaveDetail = {
  targetName: 'Wild_Sage_Druid',
  success: false,
  roll: 8,
  rawRolls: [8],
  mode: 'normal',
  saveBonus: -1,
  saveType: 'Dexterity',
  saveDc: 17,
  dcSuccess: 'half',
  rawDamage: 41,
  total: 7,
};

async function castFailOnSelf(props = {}) {
  await act(async () => {
    render(<SaveAttackAoeModal {...baseProps} {...props} />);
  });
  await act(async () => {
    selectAndConfirm('Wild_Sage_Druid');
  });
  await act(async () => {
    dispatchSaveResult(failedSaveDetail);
  });
  await waitFor(() => {
    expect(applyDamageToTarget.mock.calls.some(c => c[1] === 'Wild_Sage_Druid')).toBe(true);
  });
}

const selfApplies = () => applyDamageToTarget.mock.calls.filter(c => c[1] === 'Wild_Sage_Druid');

// CLA-237 regression lock: the resolved character in the forwarded characters
// array must carry the land_resistance passive (full stats, not cs stub).
const carriesLandResistance = (characters) => {
  const resolved = characters?.find(c => c.name === 'Wild_Sage_Druid');
  const passives = resolved?.computedStats?.automation?.passives || resolved?.automation?.passives || [];
  return passives.some(p => p.type === 'land_resistance');
};

describe('SaveAttackAoeModal — CLA-237 Nature\'s Ward save-damage lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('failed-save PC apply forwards FULL-STAT characters (automation.passives visible), not cs stubs', async () => {
    await castFailOnSelf();

    const applied = selfApplies();
    expect(applied).toHaveLength(1);
    const [cs, , damage, types, opts] = applied[0];
    // Raw 41 passes through the evasion/save adjudication uncut for the
    // RESISTANCE fold to halve inside applyDamageToTarget (real impl).
    expect(damage).toBe(41);
    expect(types).toEqual(['Lightning']);
    expect(opts.ignoreResistance).toBe(false);
    expect(carriesLandResistance(opts.characters)).toBe(true);
    // HP still rides the minimal cs player stub — the defense-vs-HP split
    // the CLA-237 fix preserves (cs entry unchanged as first arg).
    expect(cs.creatures.some(c => c.type === 'player' && !c.automation)).toBe(true);
  });

  it('secondary save-damage leg rolls, pays, and forwards its own damage with the SAME full-stat characters', async () => {
    await castFailOnSelf({ secondaryDamage: '2d6', secondaryDamageType: 'Necrotic' });

    const applied = selfApplies();
    expect(applied).toHaveLength(2);
    const primary = applied.find(c => c[3][0] === 'Lightning');
    const secondary = applied.find(c => c[3][0] === 'Necrotic');
    // Each leg pays its OWN rolled pool (2d6→7, not a replayed primary 41).
    expect(primary?.[2]).toBe(41);
    expect(secondary?.[2]).toBe(7);
    expect(carriesLandResistance(primary?.[4].characters)).toBe(true);
    expect(carriesLandResistance(secondary?.[4].characters)).toBe(true);
  });

  it('missing full-stat characters prop is loud (console.error), never silently falls back to cs stubs', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await castFailOnSelf({ characters: undefined });

    const applied = selfApplies();
    expect(applied).toHaveLength(1);
    expect(applied[0][4].characters).toEqual([]);
    expect(errSpy.mock.calls.some(c => {
      const msg = String(c[0]);
      return msg.includes('CLA-237') && msg.includes('save-damage lane');
    })).toBe(true);
    errSpy.mockRestore();
  });
});
