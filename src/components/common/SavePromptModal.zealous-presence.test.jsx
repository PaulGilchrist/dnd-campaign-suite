// @maintained-by-ai
// @improved-by-ai
// CLA-394 modal lane: the Zealous Presence buff (effect advantage_attacks_and_saves
// read from the target's activeBuffs) must grant BLANKET saving-throw advantage in
// the SavePromptModal roll path.
//
// Scope discipline (no duplicates across lanes):
//   - Server lanes handlePlayerSaveDamage.zealousPresence.test.js and
//     handleNpcSaveDamage.zealousPresence.test.js cover the same effect OUTSIDE
//     this component; this file pins only the modal UI/roll path.
//   - Conditional saveModifiers advantage → .cla034 lane; Dodge ruleset gate →
//     .dodge-2024 lane; Beacon/Holy Aura → .holy-aura lane.
//
// Every test picks dice so each roll mode produces a DIFFERENT visible total and
// SUCCESS/FAILURE outcome — the breakdown and total prove the mode, not just a die
// count or a label. The NPC target lives outside the player roster, so its +3 save
// bonus is resolved through the real combat-summary lookup (saveBonuses), keeping
// the on-screen math honest.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

vi.mock('../../services/ui/utils.js', () => ({
  default: { getName: (name) => name || 'Unknown' },
}));

// Dice controlled per-test so every roll mode changes the visible outcome.
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

// Import-graph stub: the modal resolves this NPC target's bonus through the
// combat-summary saveBonuses lookup, never through getAbilitySaveBonus, so no
// test in this lane attributes any total to this mock.
vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

// Other blanket-advantage producers must stay inert so any advantage seen here
// can only come from the Zealous Presence buff branch.
vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCircleOfPowerActive: vi.fn(() => false),
  };
});

const ZEALOUS_BUFF = [{ name: 'Zealous Presence', effect: 'advantage_attacks_and_saves' }];

vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const trigger = (testId, data) =>
      React.createElement('button', {
        'data-testid': testId,
        onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-zealotTarget`, data }),
      });
    return React.createElement(
      'div',
      { 'data-testid': 'subscriber' },
      // The reported CLA-394 repro: Frost Ray DEX save vs DC 12.
      trigger('prompt-dex', { promptId: 'zp-dex', targetName: 'zealotTarget', saveType: 'dex', saveDc: 12, disadvantage: false, dcSuccess: 'half', sourceName: 'Frost Ray' }),
      // Blanket clause: a non-Dexterity save must benefit identically.
      trigger('prompt-wis', { promptId: 'zp-wis', targetName: 'zealotTarget', saveType: 'WIS', saveDc: 12, disadvantage: false, dcSuccess: 'half', sourceName: 'Thunderclap' }),
      // Explicit prompt disadvantage must outrank the buff.
      trigger('prompt-dex-disadv', { promptId: 'zp-disadv', targetName: 'zealotTarget', saveType: 'dex', saveDc: 12, disadvantage: true, dcSuccess: 'half', sourceName: 'Ray of Enfeeblement' }),
    );
  }
  return { default: MockSubscriber };
});

// The buff lives in the target's runtime activeBuffs; feed it there and keep
// every other store read neutral.
function seedBuffs(buffs, targetName = 'zealotTarget') {
  getRuntimeValue.mockImplementation((name, key) =>
    (key === 'activeBuffs' && name === targetName) ? buffs : null
  );
}

async function openPrompt(testId) {
  render(<SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />);
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

/** Click Roll Save, wait for the result panel, return its visible text. */
async function rollSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(/Total:/i)).toBeInTheDocument();
  });
  return {
    total: screen.getByText(/Total:/i).textContent,
    breakdown: screen.getByText(/^d20 /).textContent,
  };
}

describe('SavePromptModal — CLA-394 Zealous Presence blanket save advantage', () => {
  beforeEach(() => {
    // Neutral baseline: rollD20→15, no aura, all store reads null.
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    // NPC target resolved through the combat-summary save-bonus lane: +3 saves.
    getCombatSummary.mockReturnValue({
      creatures: [{ name: 'zealotTarget', saveBonuses: { dex: 3, wis: 3 } }],
    });
  });
  afterEach(cleanupDefaults);

  it('rolls 2d20 keeping the high die with an Advantage breakdown, and submits that mode on Done', async () => {
    // max(4, 16) + 3 = 19 ≥ DC 12 → success. A normal roll would keep the 4
    // (7 → failure) and disadvantage would too, so total+outcome prove advantage.
    seedBuffs(ZEALOUS_BUFF);
    rollD20.mockReturnValueOnce(4).mockReturnValueOnce(16);

    await openPrompt('prompt-dex');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (4, 16) + 3 (Advantage)');
    expect(total).toContain('19');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'zealotTarget', expect.objectContaining({
      promptId: 'zp-dex',
      mode: 'advantage',
      roll: 16,
      rawRolls: [4, 16],
      total: 19,
      success: true,
    }));
  });

  it('is blanket: the buff grants advantage on a non-Dexterity (WIS) save too', async () => {
    // max(5, 13) + 3 = 16 ≥ DC 12 → success; single-die normal would be 8+3=11 fail.
    seedBuffs(ZEALOUS_BUFF);
    rollD20.mockReturnValueOnce(5).mockReturnValueOnce(13);

    await openPrompt('prompt-wis');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (5, 13) + 3 (Advantage)');
    expect(total).toContain('16');
    expect(screen.getByText('SAVE SUCCESS')).toBeInTheDocument();
  });

  it('does not trigger on buffs with other effects: a non-qualifying activeBuffs entry rolls a plain single d20', async () => {
    // 8 + 3 = 11 < DC 12 → failure. If the check were vacuous (e.g. any buff
    // counts), the second die (default 15) would lift this to 18/success.
    seedBuffs([{ name: 'Enlarge', effect: 'size_increase' }]);
    rollD20.mockReturnValueOnce(8);

    await openPrompt('prompt-dex');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (8) + 3');
    expect(total).toContain('11');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
  });

  it('does not bleed across creatures: the same buff on another creature grants nothing', async () => {
    seedBuffs(ZEALOUS_BUFF, 'otherTarget');
    rollD20.mockReturnValueOnce(8);

    await openPrompt('prompt-dex');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (8) + 3');
    expect(total).toContain('11');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
    expect(screen.queryByText(/Advantage/i)).not.toBeInTheDocument();
  });

  it('prompt disadvantage outranks the buff: rolls 2d20 keeping the low die', async () => {
    // min(16, 4) + 3 = 7 < DC 12 → failure. If the buff wrongly outranked the
    // prompt it would keep the 16 → 19/success.
    seedBuffs(ZEALOUS_BUFF);
    rollD20.mockReturnValueOnce(16).mockReturnValueOnce(4);

    await openPrompt('prompt-dex-disadv');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(2);
    expect(breakdown).toBe('d20 (16, 4) + 3 (Disadvantage)');
    expect(total).toContain('7');
    expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
  });

  it('with no buffs active the save rolls a plain single d20 with no advantage copy', async () => {
    // setupDefaults leaves every store read null — the baseline must stay normal.
    rollD20.mockReturnValueOnce(15);

    await openPrompt('prompt-dex');
    const { total, breakdown } = await rollSave();

    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(breakdown).toBe('d20 (15) + 3');
    expect(total).toContain('18');
    expect(screen.queryByText(/Advantage/i)).not.toBeInTheDocument();
  });
});
