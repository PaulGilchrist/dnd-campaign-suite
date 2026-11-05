// @maintained-by-ai
// Corona of Light (sunlight_aura) picker-route pins — bug-corona-aura-inert-in-
// aoe-picker-route: the SaveAttackAoeModal adjudication seams (computeNpcSave +
// resolvePcTarget prompt builder) resolved saves WITHOUT ever consulting the
// aura the verified seams (aoeService sync lane, handlePlayer/NpcSaveDamage)
// apply. The REAL coronaAuraUtils rides here (no mock) so the 60 ft exact /
// 65 ft / damage-type geometry is locked end-to-end through the picker.
//
// Geometry mirrors the live rig: bearer ElderPaladin-class token at (2,8),
// in-range victim at (14,8) = exactly 60 ft, out-of-range victim at (15,8) =
// 65 ft (FEET_PER_CELL 5). Family RNG seam: raw1=20 (20+bonus beats DC 15),
// raw2=2 — min() only taken when the disadvantage branch is live.

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

const { mapDoc } = vi.hoisted(() => ({
  mapDoc: {
    players: [
      { name: 'Bearer', gridX: 2, gridY: 8 },
      { name: 'Player One', gridX: 14, gridY: 8 },
      { name: 'Player Two', gridX: 15, gridY: 8 },
    ],
    placedItems: [
      { type: 'npc', name: 'Goblin InRange', gridX: 14, gridY: 8 },
      { type: 'npc', name: 'Goblin OutRange', gridX: 15, gridY: 8 },
    ],
  },
}));

// ── Mocked modules (same family kit as damage-resolution.test.jsx) ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
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
  applyDamageToTarget: vi.fn(),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => (success && dcSuccess === 'half' ? Math.floor(raw / 2) : raw)),
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
      { name: 'Goblin InRange', type: 'npc', currentHp: 5, maxHp: 10, saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
      { name: 'Goblin OutRange', type: 'npc', currentHp: 5, maxHp: 10, saveBonuses: { dex: 2 }, resistances: [], immunities: [] },
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 4 } },
      { name: 'Player Two', type: 'player', currentHp: 20, maxHp: 30, saveBonuses: { dex: 4 } },
    ],
  })),
  getCombatContext: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => null),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

// Active-map loader the corona gate uses (sync util measures from the
// returned document — pure distance math, no further fetches). Rest of the
// module stays real (importActual spread — family rec :50 partial-mock rule).
vi.mock('../../../../services/maps/mapsService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadMapData: vi.fn(() => Promise.resolve(mapDoc)),
}));

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';

// ── Fixtures ──

const baseProps = {
  action: { name: 'Fireball', automation: { scaling: { damage: '8d6' } } },
  playerStats: { name: 'Cleric1', level: 12 },
  campaignName: 'test-campaign',
  range: 20,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 15,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

const CORONA_BUFFS = [{ effect: 'sunlight_aura', distance: 60, enemiesDisadvantageSaves: ['Fire'] }];

function checkboxFor(name) {
  const row = [...document.querySelectorAll('.secondary-target-row')].find(r => r.textContent.includes(name));
  return row.querySelector('input[type="checkbox"]');
}

function pick(...names) {
  names.forEach(n => fireEvent.click(checkboxFor(n)));
  const confirmBtn = screen.getByRole('button', { name: new RegExp(`Fireball \\(${names.length}\\)`) });
  return act(async () => {
    fireEvent.click(confirmBtn);
  });
}

function saveDamageLogs(targetName) {
  return logService.addEntry.mock.calls
    .map(c => c[1])
    .filter(e => e && e.rollType === 'save-damage' && (!targetName || e.targetName === targetName));
}

// ── RNG stream ──

let randomSpy;
let randomDraws = [];
let randomCursor = 0;

beforeEach(() => {
  vi.clearAllMocks();
  randomDraws = [];
  randomCursor = 0;
  randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
    if (randomDraws.length) return randomDraws.shift();
    randomCursor = (randomCursor % 10) + 1;
    return 0.9 + randomCursor / 1000;
  });
  diceRoller.rollExpression.mockImplementation(() => ({ total: 12, rolls: [12], modifier: 0 }));
  // Active map present + ElderPaladin-style bearer carrying the authored
  // 60 ft Fire aura. targetEffects/other keys stay null.
  useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => {
    if (key === '__map__' && prop === 'activeMapName') return 'cx-corona-fix';
    if (key === 'Bearer' && prop === 'activeBuffs') return CORONA_BUFFS;
    return null;
  });
});

afterEach(() => randomSpy.mockRestore());

// ── Tests ──

describe('SaveAttackAoeModal - Corona of Light picker route', () => {
  it('NPC face: victim at exactly 60 ft of the Fire aura rolls 2d20 at min, logs mode:"disadvantage"', async () => {
    // raw1=20 (20+2 beats DC 15 → would save), raw2=2 — min(20,2)=2 fails,
    // proving the aura branch is live, not just that a roll happened.
    randomDraws = [0.95, 0.05];
    render(<SaveAttackAoeModal {...baseProps} />);
    await pick('Goblin InRange');

    const logs = saveDamageLogs('Goblin InRange');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      saveResult: 'failure',
      mode: 'disadvantage',
      saveRawRolls: [20, 2],
      saveRoll: 2,
    });
  });

  it('NPC face: victim at 65 ft (beyond the authored 60 ft) rolls single die, mode:"normal"', async () => {
    randomDraws = [0.95, 0.05];
    render(<SaveAttackAoeModal {...baseProps} />);
    await pick('Goblin OutRange');

    const logs = saveDamageLogs('Goblin OutRange');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      saveResult: 'success',
      mode: 'normal',
      saveRoll: 20,
    });
  });

  it('NPC face: non-Fire/Radiant damage type ignores the aura (mode:"normal", single die)', async () => {
    randomDraws = [0.95, 0.05];
    render(<SaveAttackAoeModal {...baseProps} damageType="Cold" />);
    await pick('Goblin InRange');

    const logs = saveDamageLogs('Goblin InRange');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ mode: 'normal', saveResult: 'success', saveRoll: 20 });
  });

  it('PC face: prompt payload carries disadvantage:true at 60 ft and false at 65 ft (CLA-063 machine truth)', async () => {
    render(<SaveAttackAoeModal {...baseProps} />);
    await pick('Player One', 'Player Two');

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(2);
    const byTarget = Object.fromEntries(savePromptService.sendSavePrompt.mock.calls.map(c => [c[1].targetName, c[1]]));
    expect(byTarget['Player One'].disadvantage).toBe(true);
    expect(byTarget['Player Two'].disadvantage).toBe(false);
  });

  it('no aura on the map: prompts stay byte-inert disadvantage:false', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((key, prop) => (
      key === '__map__' && prop === 'activeMapName' ? 'cx-corona-fix' : null
    ));
    render(<SaveAttackAoeModal {...baseProps} />);
    await pick('Player One');

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      targetName: 'Player One',
      disadvantage: false,
    }));
  });
});
