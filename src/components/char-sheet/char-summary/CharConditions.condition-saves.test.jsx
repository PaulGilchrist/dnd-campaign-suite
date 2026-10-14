// @maintained-by-ai
/**
 * CharConditions — condition save MECHANICS: which effects grant advantage,
 * how dice + bonuses combine, and how the result popup reports the outcome.
 *
 * Covered by sibling suites (intentionally NOT re-tested here):
 * - CharConditions.logging.test.jsx      — addEntry/logConditionSave payloads,
 *   bonusDetail formatting, persistence, removal on success
 * - CharConditions.rendering.test.jsx    — badge text/tooltips, dedup, re-mount, empty state
 * - CharConditions.exhaustion.test.jsx   — exhaustion +/- buttons and DC formula
 * - CharConditions.slow.test.jsx         — SP-109 mount-wipe guard, Slow ending on repeat save
 *
 * hasSaveAdvantage / restoreBalance internals (saveAdvantage lists, counts,
 * Restore Balance cancellation) are unit-tested at the service level in
 * conditionEffects.test.js and restoreBalance.test.js — this suite wires one
 * representative case through the component and focuses on the component's own
 * gating: grapple-only STR checks, Aura of Purity coverage, Powerful Build
 * saveModifiers (direct and nested), dice-count math, and DC boundaries.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions from './CharConditions.jsx';

let runtimeValues = {};
let mockCombatSummary = null;
const mockSetPopupHtml = vi.fn();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => runtimeValues[`${name}::${key}`] ?? null),
  setRuntimeValue: vi.fn((name, key, value) => {
    runtimeValues[`${name}::${key}`] = value;
  }),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilityLabel: vi.fn((abbr) => {
    const labels = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
    return labels[abbr] || abbr || 'None';
  }),
  getAbilitySaveBonus: vi.fn(() => 2),
}));

vi.mock('../../../services/combat/conditions/exhaustionRules.js', () => ({
  EXHAUSTION_LEVELS: 6,
  isDeadFromExhaustion: vi.fn((level) => level >= 6),
  getExhaustionSaveDC: vi.fn((level) => 10 + level),
}));

vi.mock('../../../hooks/combat/usePopup.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: mockSetPopupHtml })),
}));

vi.mock('../../common/Popup.jsx', () => ({
  default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: vi.fn(() => <div data-testid="dice-roll-result" />),
}));

vi.mock('../../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatLoggingService.js', () => ({
  logConditionSave: vi.fn(() => Promise.resolve()),
  logConcentrationSave: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => mockCombatSummary),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  isAuraOfPurityActive: vi.fn(() => false),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(() => []),
}));

import { rollD20 } from '../../../services/dice/diceRoller.js';
import { getAbilityLabel, getAbilitySaveBonus } from '../../../services/combat/conditions/conditionUtils.js';
import { computeAuraBonus } from '../../../services/combat/auras/auraOfProtection.js';
import { isAuraOfPurityActive, getAuraOfPuritySaveAdvantageConditions } from '../../../services/automation/handlers/buffs/auraOfPurityHandler.js';

const POWERFUL_BUILD_GRAPPLE_MOD = {
  target: 'ability_check',
  effect: 'advantage',
  abilities: ['STR'],
  condition: 'powerful_build_grapple_escape',
};

describe('CharConditions condition saves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mockReset (not just clear) so unconsumed mockReturnValueOnce queues
    // from a failed test can never leak into the next one.
    vi.mocked(rollD20).mockReset().mockReturnValue(15);
    vi.mocked(getAbilitySaveBonus).mockReset().mockReturnValue(2);
    vi.mocked(computeAuraBonus).mockReset().mockResolvedValue({ bonus: 0, sourceName: null });
    vi.mocked(isAuraOfPurityActive).mockReset().mockReturnValue(false);
    vi.mocked(getAuraOfPuritySaveAdvantageConditions).mockReset().mockReturnValue([]);
    runtimeValues = {};
    mockCombatSummary = null;
  });

  const playerStats = {
    name: 'Test Character',
    abilities: [
      { name: 'Constitution', bonus: 2, save: 3 },
      { name: 'Wisdom', bonus: 1, save: 2 },
    ],
  };

  const defaultProps = {
    playerStats,
    campaignName: 'test-campaign',
    activeMapName: 'test-map',
    characters: [],
    exhaustionLevel: 0,
    onConditionsChange: vi.fn(),
    conditionEffects: {},
  };

  function seedCondition(conditionKey, meta) {
    runtimeValues['Test Character::activeConditions'] = [conditionKey];
    runtimeValues['Test Character::activeConditionMeta'] = { [conditionKey]: meta };
  }

  function lastPopup() {
    const calls = mockSetPopupHtml.mock.calls;
    return calls[calls.length - 1][0];
  }

  // Shared save driver: queue `rolls` as the dice, click the condition badge,
  // then assert the full popup contract the component reports. `rolls` doubles
  // as the expected popup roll array (advantage rows pass two distinguishable
  // dice so min/single-roll totals would differ). Success boundary is
  // total >= dc; forcedMode is 'advantage' exactly when two dice were rolled.
  async function checkSave({
    conditionKey, ability, dc, rolls, total, success,
    conditionEffects = {}, auraCover = null, saveModifiers = null, nested = false,
    saveBonus = 2, auraBonus = 0, forcedMode = undefined,
  }) {
    if (auraCover) {
      vi.mocked(isAuraOfPurityActive).mockReturnValue(true);
      vi.mocked(getAuraOfPuritySaveAdvantageConditions).mockReturnValue(auraCover);
    }
    if (saveBonus !== 2) vi.mocked(getAbilitySaveBonus).mockReturnValue(saveBonus);
    if (auraBonus !== 0) vi.mocked(computeAuraBonus).mockResolvedValue({ bonus: auraBonus, sourceName: null });
    const stats = saveModifiers
      ? (nested
        ? { ...playerStats, computedStats: { saveModifiers } }
        : { ...playerStats, saveModifiers })
      : playerStats;

    rolls.forEach((value) => vi.mocked(rollD20).mockReturnValueOnce(value));
    seedCondition(conditionKey, { dc, ability });
    render(<CharConditions {...defaultProps} playerStats={stats} conditionEffects={conditionEffects} />);

    fireEvent.click(screen.getByRole('button', {
      name: `${conditionKey.charAt(0).toUpperCase()}${conditionKey.slice(1)} DC ${dc}`,
    }));

    // The popup is set after the awaited aura lookup, so its presence proves
    // the whole async save flow (including every die roll) has run.
    await waitFor(() => expect(mockSetPopupHtml).toHaveBeenCalled());
    expect(rollD20).toHaveBeenCalledTimes(rolls.length);
    expect(lastPopup()).toEqual(expect.objectContaining({
      rollType: 'condition-save',
      name: `${getAbilityLabel(ability)} (DC ${dc})`,
      rolls,
      bonus: saveBonus + auraBonus,
      total,
      dc,
      success,
      forcedMode,
    }));
  }

  describe('advantage triggers', () => {
    // Each row exercises a distinct component-owned advantage gate. Dice are
    // 6 then 17 so keeping the higher (17+2=19) is the only total that fits.
    it.each([
      { description: 'Aura of Purity covers the condition', conditionKey: 'charmed', ability: 'wis', auraCover: ['charmed'] },
      { description: 'saveAdvantage names the condition', conditionKey: 'charmed', ability: 'wis', conditionEffects: { saveAdvantage: ['charmed'] } },
      { description: 'grappled with strCheckAdvantage', conditionKey: 'grappled', ability: 'str', conditionEffects: { strCheckAdvantage: true } },
      { description: 'grappled with STR in abilityCheckAdvantageAbilities', conditionKey: 'grappled', ability: 'str', conditionEffects: { abilityCheckAdvantageAbilities: ['STR'] } },
      { description: 'grappled with a Powerful Build save modifier', conditionKey: 'grappled', ability: 'str', saveModifiers: [POWERFUL_BUILD_GRAPPLE_MOD] },
      { description: 'Powerful Build modifier nested on computedStats', conditionKey: 'grappled', ability: 'str', saveModifiers: [POWERFUL_BUILD_GRAPPLE_MOD], nested: true },
    ])('rolls two distinguishable d20s and keeps the higher when $description', async (row) => {
      await checkSave({ ...row, rolls: [6, 17], dc: 12, total: 19, success: true, forcedMode: 'advantage' });
    });

    // Negatives of the same gates: one d20, no advantage claim in the popup
    // (15 + 2 = 17 < DC 18, so the failure is also asserted).
    it.each([
      { description: 'no advantage sources are active', conditionKey: 'charmed', ability: 'wis' },
      { description: 'Aura of Purity active but does not cover the condition', conditionKey: 'charmed', ability: 'wis', auraCover: ['frightened'] },
      { description: 'strCheckAdvantage scoped to a non-grappled condition', conditionKey: 'charmed', ability: 'wis', conditionEffects: { strCheckAdvantage: true } },
      { description: 'grappled but only DEX check advantage', conditionKey: 'grappled', ability: 'str', conditionEffects: { abilityCheckAdvantageAbilities: ['DEX'] } },
      { description: 'Powerful Build scoped to a non-grappled condition', conditionKey: 'charmed', ability: 'wis', saveModifiers: [POWERFUL_BUILD_GRAPPLE_MOD] },
    ])('rolls a single d20 when $description', async (row) => {
      await checkSave({ ...row, rolls: [15], dc: 18, total: 17, success: false });
    });
  });

  describe('save result calculation', () => {
    // Arithmetic boundaries that the trigger tables do not pin down: the
    // >= DC seam, aura stacking into bonus/total, and advantage that still fails.
    it.each([
      { description: 'roll exactly ties the DC', rolls: [9], saveBonus: 5 },
      { description: 'roll is one short of the DC', rolls: [11] },
      { description: 'aura bonus stacks into bonus and total', rolls: [15], saveBonus: 5, auraBonus: 3 },
      { description: 'advantage is rolled but both dice are low', conditionEffects: { saveAdvantage: ['charmed'] }, rolls: [4, 9] },
    ])('reports rolls $rolls vs DC 14 when $description', async (row) => {
      const saveBonus = row.saveBonus ?? 2;
      const finalRoll = Math.max(...row.rolls);
      const total = finalRoll + saveBonus + (row.auraBonus ?? 0);
      await checkSave({
        ...row,
        conditionKey: 'charmed',
        ability: 'wis',
        dc: 14,
        total,
        success: total >= 14,
        forcedMode: row.rolls.length > 1 ? 'advantage' : undefined,
      });
    });
  });

  it('passes the character, campaign, map, and combat summary to Aura of Protection', async () => {
    mockCombatSummary = { creatures: [{ name: 'Goblin' }] };
    seedCondition('charmed', { dc: 14, ability: 'wis' });
    render(<CharConditions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Charmed DC 14' }));

    await waitFor(() => expect(computeAuraBonus).toHaveBeenCalled());
    expect(computeAuraBonus).toHaveBeenCalledWith(expect.objectContaining({
      targetName: 'Test Character',
      campaignName: 'test-campaign',
      activeMapName: 'test-map',
      allCreatures: [{ name: 'Goblin' }],
    }));
  });

  describe('unsavable conditions', () => {
    // Both halves of the dc && ability gate: a badge missing either half is
    // static text — not a button — and clicking it must never roll.
    it.each([
      { meta: { dc: 10 }, badgeText: 'Blinded DC 10', missing: 'ability' },
      { meta: { ability: 'con' }, badgeText: 'Blinded', missing: 'dc' },
    ])('renders $badgeText as static text that never rolls (meta has no $missing)', async ({ meta, badgeText }) => {
      seedCondition('blinded', meta);
      render(<CharConditions {...defaultProps} />);

      expect(screen.queryByRole('button', { name: badgeText })).not.toBeInTheDocument();
      fireEvent.click(screen.getByText(badgeText));

      expect(rollD20).not.toHaveBeenCalled();
      expect(mockSetPopupHtml).not.toHaveBeenCalled();
    });
  });

  it('rolls and clears only the condition that was clicked', async () => {
    runtimeValues['Test Character::activeConditions'] = ['charmed', 'frightened'];
    runtimeValues['Test Character::activeConditionMeta'] = {
      charmed: { dc: 14, ability: 'wis' },
      frightened: { dc: 18, ability: 'wis' },
    };
    render(<CharConditions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Charmed DC 14' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Charmed DC 14' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Frightened DC 18' })).toBeInTheDocument();
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(lastPopup()).toEqual(expect.objectContaining({
      name: 'Wisdom (DC 14)',
      dc: 14,
      total: 17, // 15 + 2
      success: true,
    }));
  });
});
