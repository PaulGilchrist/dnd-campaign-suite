// @maintained-by-ai
/**
 * CharConditions — RENDERING contract: what the badge grid shows.
 *
 * Scope (owned by this suite):
 * - empty state (nothing renders when there are no conditions and no exhaustion)
 * - badge display text, tooltip wiring (CONDITION_DESCRIPTIONS lookup +
 *   label fallback), savable-vs-static rendering, and semantic colour class
 *   (CreatureBadge.css: Invisible is buff-tinted, others condition-tinted) —
 *   descriptions are mocked with sentinels so these tests verify WIRING,
 *   not the exact wording of rules prose
 * - dedup of repeated condition keys
 * - exhaustion badge: text, level tooltip, DEAD marker, +/- enabled states,
 *   and coexistence with condition badges in the same grid
 * - the roll-result popup actually RENDERS after a save click
 *   (popup → DiceRollResult prop wiring; siblings only spy on the payload)
 * - re-mount on playerStats.name change (each character reads its own slot)
 *
 * Covered by sibling suites (intentionally NOT re-tested here):
 * - CharConditions.logging.test.jsx        — addEntry/logConditionSave payloads,
 *   persistence, and badge removal after a successful save
 * - CharConditions.condition-saves.test.jsx — advantage triggers, dice/bonus math,
 *   the dc && ability gate halves (missing-dc and missing-ability badges are
 *   static and never roll), per-condition save scoping
 * - CharConditions.exhaustion.test.jsx     — exhaustion minus-save flow, DC math,
 *   plus incrementing to the level-6 cap, level-0 side effects
 * - CharConditions.slow.test.jsx           — SP-109 mount-wipe guard, Slow re-saves
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharConditions from './CharConditions.jsx';

const CHAR = 'Test Character';
const CAMPAIGN = 'test-campaign';

// Runtime-store fake keyed strictly by `${name}::${key}`: no bare-key
// fallback, so the rename test genuinely proves each character reads its
// own slot. Writes flow through to the same table so the component's view
// stays coherent across saves.
let runtimeValues = {};

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => runtimeValues[`${name}::${key}`] ?? null),
  setRuntimeValue: vi.fn((name, key, value) => {
    runtimeValues[`${name}::${key}`] = value;
  }),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

// d20 always rolls 15 in this suite — the popup-math comments rely on it.
vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

vi.mock('../../../services/combat/conditions/conditionUtils.js', () => ({
  // Realistic label mapping so the rendered popup name catches a wrong
  // ability label (an identity mock would echo any garbage).
  getAbilityLabel: vi.fn((abbr) => {
    const labels = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
    return labels[abbr] || abbr || 'None';
  }),
  // Save bonus is always +2 in this suite.
  getAbilitySaveBonus: vi.fn(() => 2),
}));

// Sentinel descriptions: tooltip assertions test that the component LOOKS UP
// the dictionary and falls back to the label — rules prose may change freely.
vi.mock('../../../services/combat/conditions/effectDescriptions.js', () => ({
  CONDITION_DESCRIPTIONS: {
    Blinded: 'TEST blinded description',
    Charmed: 'TEST charmed description',
    Exhausted: 'TEST exhaustion description',
    Invisible: 'TEST invisible description',
  },
}));

vi.mock('../../../services/combat/conditions/exhaustionRules.js', () => ({
  EXHAUSTION_LEVELS: 6,
  isDeadFromExhaustion: vi.fn((level) => level >= 6),
  getExhaustionSaveDC: vi.fn((level) => 10 + level),
}));

// Stateful popup hook (mirrors the real one) so the popup RENDER path is
// exercised, not just the setPopupHtml spy.
vi.mock('../../../hooks/combat/usePopup.js', async () => {
  const { useState } = await vi.importActual('react');
  // Named like a hook so lint's rules-of-hooks accepts the useState call.
  function usePopupState() {
    const [popupHtml, setPopupHtml] = useState(null);
    return { popupHtml, setPopupHtml };
  }
  return { default: usePopupState };
});

// NOTE: exact specifier case matters — the file on disk is lowercase popup.jsx
// (mocking 'Popup.jsx' silently does nothing).
vi.mock('../../common/popup.jsx', () => ({
  default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
}));

vi.mock('../DiceRollResult.jsx', () => ({
  default: vi.fn(({ rollType, name, rolls, bonus, total, dc, success }) => (
    <div data-testid="dice-roll-result">
      <span data-testid="roll-type">{rollType}</span>
      <span data-testid="roll-name">{name}</span>
      <span data-testid="roll-value">{rolls?.join(', ')}</span>
      <span data-testid="roll-bonus">{bonus}</span>
      <span data-testid="roll-total">{total}</span>
      <span data-testid="roll-dc">{dc}</span>
      <span data-testid="roll-success">{String(success)}</span>
    </div>
  )),
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
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/automation/handlers/buffs/auraOfPurityHandler.js', () => ({
  isAuraOfPurityActive: vi.fn(() => false),
  getAuraOfPuritySaveAdvantageConditions: vi.fn(() => []),
}));

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
  hasSaveAdvantage: vi.fn(() => false),
}));

describe('CharConditions rendering', () => {
  beforeEach(() => {
    runtimeValues = {};
  });

  function playerStats(name = CHAR) {
    return {
      name,
      abilities: [
        { name: 'Constitution', bonus: 2, save: 3 },
        { name: 'Wisdom', bonus: 1, save: 2 },
      ],
    };
  }

  // Element factory (not just render) so rerender-based tests reuse one props spec.
  const sheet = (props = {}) => (
    <CharConditions
      playerStats={playerStats()}
      campaignName={CAMPAIGN}
      activeMapName="test-map"
      characters={[]}
      exhaustionLevel={0}
      onConditionsChange={vi.fn()}
      conditionEffects={{}}
      {...props}
    />
  );

  const renderSheet = (props = {}) => render(sheet(props));

  function setConditions(conditions, meta) {
    runtimeValues[`${CHAR}::activeConditions`] = conditions;
    runtimeValues[`${CHAR}::activeConditionMeta`] = meta;
  }

  it('renders nothing when no conditions and no exhaustion', () => {
    const { container } = renderSheet();
    expect(container.firstChild).toBeNull();
  });

  describe('condition badges', () => {
    // One row per DISTINCT render path: DC text + live savable button,
    // buff-tint (Invisible), dictionary tooltip with empty meta, and the
    // label fallback when the condition is missing from the dictionary.
    // The static-badge halves of the dc && ability gate (missing-dc,
    // missing-ability) are owned by CharConditions.condition-saves.test.jsx.
    it.each`
      description                       | conditions            | meta                                       | badgeText          | tooltip                      | cls                | savable
      ${'DC and ability'}              | ${['charmed']}        | ${{ charmed: { dc: 12, ability: 'wis' } }} | ${'Charmed DC 12'} | ${'TEST charmed description'}  | ${'effect-condition'} | ${true}
      ${'Invisible buff tint'}        | ${['invisible']}      | ${{}}                                      | ${'Invisible'}       | ${'TEST invisible description'} | ${'effect-buff'}     | ${false}
      ${'no meta'}                    | ${['blinded']}        | ${{}}                                      | ${'Blinded'}         | ${'TEST blinded description'}  | ${'effect-condition'} | ${false}
      ${'missing from the dict'}      | ${['cursed']}         | ${{}}                                      | ${'Cursed'}          | ${'Cursed'}                  | ${'effect-condition'} | ${false}
    `('renders "$badgeText" ($cls, savable=$savable) with the tooltip for $description', ({ conditions, meta, badgeText, tooltip, cls, savable }) => {
      setConditions(conditions, meta);
      renderSheet();

      const badge = screen.getByText(badgeText);
      expect(badge).toHaveAttribute('title', tooltip);
      expect(badge).toHaveClass(cls);
      if (savable) {
        expect(screen.getByRole('button', { name: badgeText })).toBeEnabled();
      } else {
        expect(screen.queryByRole('button', { name: badgeText })).not.toBeInTheDocument();
      }
    });
  });

  it('renders each unique condition once despite duplicates in the store', () => {
    setConditions(['charmed', 'charmed', 'blinded'], {
      charmed: { dc: 12, ability: 'wis' },
      blinded: { dc: 10 },
    });
    renderSheet();

    expect(screen.getAllByText('Charmed DC 12')).toHaveLength(1);
    // No phantom badges: exactly charmed + blinded.
    expect(screen.getAllByTestId('creature-badge')).toHaveLength(2);
  });

  describe('exhaustion badge', () => {
    // Levels 2 and 6 are the live vs dead branches; coexistence with
    // condition badges rides along in the same render pass.
    it.each`
      level | dead    | plusEnabled
      ${2}  | ${false} | ${true}
      ${6}  | ${true}  | ${false}
    `('renders "Exhaustion ($level)" beside the condition badges at level $level', ({ level, dead, plusEnabled }) => {
      setConditions(['charmed'], { charmed: { dc: 12, ability: 'wis' } });
      renderSheet({ exhaustionLevel: level });

      const badge = screen.getByText(`Exhaustion (${level})`);
      expect(badge).toHaveAttribute('title', `Exhaustion level ${level}${dead ? ' - DEAD' : ''}\n\nTEST exhaustion description`);
      // The badge only renders at level > 0, so minus is always live here;
      // plus is capped once dead (click flows live in the exhaustion suite).
      expect(screen.getByRole('button', { name: '−' })).toBeEnabled();
      expect(screen.getByRole('button', { name: '+' }).disabled).toBe(!plusEnabled);
      // Same grid, both kinds of badge.
      expect(screen.getByText('Charmed DC 12')).toBeInTheDocument();
    });
  });

  describe('roll result popup', () => {
    // The popup RENDER path (component state → Popup → DiceRollResult props).
    // Payload contracts are owned by the logging suite; this proves the user
    // actually sees the outcome.
    it('renders the popup with the save outcome after clicking a savable badge', async () => {
      setConditions(['charmed'], { charmed: { dc: 14, ability: 'wis' } });
      renderSheet();

      fireEvent.click(screen.getByRole('button', { name: 'Charmed DC 14' }));

      // roll 15 + save bonus 2 vs DC 14 → success.
      await waitFor(() => expect(screen.getByTestId('popup')).toBeInTheDocument());
      expect(screen.getByTestId('roll-type')).toHaveTextContent('condition-save');
      expect(screen.getByTestId('roll-name')).toHaveTextContent('Wisdom (DC 14)');
      expect(screen.getByTestId('roll-value')).toHaveTextContent('15');
      expect(screen.getByTestId('roll-bonus')).toHaveTextContent('2');
      expect(screen.getByTestId('roll-total')).toHaveTextContent('17');
      expect(screen.getByTestId('roll-dc')).toHaveTextContent('14');
      expect(screen.getByTestId('roll-success')).toHaveTextContent('true');
    });
  });

  describe('character name change re-mount', () => {
    it('swaps to the new character\'s conditions when playerStats.name changes', () => {
      setConditions(['charmed'], { charmed: { dc: 12, ability: 'wis' } });
      runtimeValues['New Character::activeConditions'] = ['blinded'];
      runtimeValues['New Character::activeConditionMeta'] = { blinded: { dc: 10 } };

      const { rerender } = renderSheet();
      expect(screen.getByText('Charmed DC 12')).toBeInTheDocument();

      rerender(sheet({ playerStats: playerStats('New Character') }));

      expect(screen.queryByText('Charmed DC 12')).not.toBeInTheDocument();
      expect(screen.getByText('Blinded DC 10')).toBeInTheDocument();
    });
  });
});
