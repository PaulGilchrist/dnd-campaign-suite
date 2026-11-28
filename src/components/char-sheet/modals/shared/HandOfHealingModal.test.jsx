// @maintained-by-ai 2026-11-27
//
// MAIN lane for HandOfHealingModal: result-stage rendering via the NON-picker
// entry (pending:false), Physician's Touch auto-cure/picker/merge semantics,
// and the condition audit-row funnel (real logService → fetch stub).
// Owned elsewhere, never restated here: pending picker flow (zero-silence
// pre-commit, commit→swap payload render, 'Healing failed to resolve.' error
// copy) — HandOfHealingModal.cla159.test.jsx; honest `Heal self`/`Cancel`
// labels + zero-spend dismiss — .picker-dismiss.test.jsx; refusalNote copy
// face — .refusal-note.test.jsx; role="dialog"/aria-modal/aria-labelledby tier
// + Done→onClose — .dialog-semantics.test.jsx; actualHeal clamp honesty
// ('0 HP restored' + 'Already at full HP') — .restored-hp-honesty.test.jsx;
// mid-dwell echo adoption — the live-*-echo lanes. Healing math/spend
// semantics live in the healingHandler service lanes.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HandOfHealingModal from './HandOfHealingModal.jsx';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null), // display-echo subscription seam (return value unused by the heal modals)
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  // Mirrors the real utils.getName (services/ui/utils.js:12): 'Unknown' for
  // non-strings — the name-match legs depend on this exact coercion.
  default: { getName: vi.fn((n) => (!n || typeof n !== 'string' ? 'Unknown' : n)) },
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../../services/encounters/combatData.js';

// Non-picker entry face only (pending omitted → result stage renders the
// mount-time props directly). Full-shape matches the real
// healingHandler.performMonkHeal payload (healingHandler.js:354-362:
// formula/rolls/bonus/healAmount/actualHeal/targetName/targetCurrentHp/
// targetMaxHp; the component ignores healAmount by design — the clamped
// actualHeal is the only number it may show, pinned by restored-hp-honesty).
const baseProps = {
  healName: 'Monk',
  formula: '1d4 + 2',
  rolls: [3, 1],
  bonus: 2,
  healAmount: 6,
  actualHeal: 6,
  monkName: 'Monk1',
  targetName: 'Goblin',
  targetCurrentHp: 15,
  targetMaxHp: 20,
  hasPhysiciansTouch: false,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// Full textContent of the arithmetic line is the ledger the player reads:
// `{formula}: {dice} {+ bonus} = {actualHeal} HP restored`. Exact strings
// retire the per-span fragment probes; the spaced-operator law (backlog
// 2026-11-13 EH — `+ 9` / `- 1`, never fused `+9=`) and the zero-bonus
// omission are censused here in one place.
function rollDetailsText() {
  return document.querySelector('.healing-roll-details').textContent;
}

function logFetchCalls() {
  return global.fetch.mock.calls.filter((call) => call[0] === '/api/campaigns/test-campaign/log');
}

describe('HandOfHealingModal', () => {
  beforeEach(() => {
    // resetAllMocks restores each vi.fn(impl) factory default AND drops any
    // test-set mockReturnValue/mockImplementation — every overridable stub is
    // re-baselined here so no row can leak into the next.
    vi.resetAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    combatData.getCombatSummary.mockReturnValue(null);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) });
  });

  describe('result-stage rendering (non-picker entry)', () => {
    it('renders the shell, heal-name header with icon, honest target HP line, and Done button', () => {
      render(<HandOfHealingModal {...makeProps()} />);
      expect(document.querySelector('.short-rest-overlay')).toBeInTheDocument();
      expect(document.querySelector('.short-rest-modal')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Monk' })).toBeInTheDocument();
      expect(document.querySelector('.fa-hand-sparkles')).toBeInTheDocument();
      // Exact full header text pins the em-dash byte (source :276
      // `Healing{'\u2014'}`) — no spaces around it.
      expect(screen.getByRole('heading', { level: 4 }).textContent)
        .toBe('Healing\u2014Goblin (15 / 20 HP)');
      expect(screen.getByRole('button', { name: /Done/ })).toBeInTheDocument();
    });

    it.each([
      ['multi-dice with a positive bonus', { formula: '2d6 + 3', rolls: [3, 1], bonus: 2, actualHeal: 8 }, '2d6 + 3: 3 + 1 + 2 = 8 HP restored'],
      ['full-distinctive single-die line', { formula: '1d12 + 7 + 2', rolls: [10], bonus: 9, actualHeal: 19, targetCurrentHp: 41, targetMaxHp: 60 }, '1d12 + 7 + 2: 10 + 9 = 19 HP restored'],
      ['negative bonus renders a spaced minus with the magnitude', { bonus: -1, actualHeal: 3 }, '1d4 + 2: 3 + 1 - 1 = 3 HP restored'],
      ['zero bonus omits the bonus span entirely', { bonus: 0 }, '1d4 + 2: 3 + 1 = 6 HP restored'],
    ])('%s', (_label, overrides, expectedText) => {
      render(<HandOfHealingModal {...makeProps(overrides)} />);
      expect(rollDetailsText()).toBe(expectedText);
      expect(document.querySelector('.healing-total strong').textContent)
        .toBe(String(overrides.actualHeal ?? baseProps.actualHeal));
    });

    it('closes via Escape, and never via an overlay-background or modal-content click', () => {
      const onClose = vi.fn();
      render(<HandOfHealingModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.short-rest-overlay'));
      fireEvent.click(document.querySelector('.short-rest-modal'));
      expect(onClose).not.toHaveBeenCalled();
      expect(document.querySelector('.short-rest-modal')).toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Physician\u2019s Touch inactive — full zero-silence', () => {
    it.each([
      ['feature off even with a cureable condition', ['blinded'], false],
      ['no conditions', [], true],
      ['runtime value is null', null, true],
      ['only blank/null/undefined/object entries', [null, undefined, '  ', { name: 'blinded' }], true],
      ['runtime value is a non-array string', 'blinded', true],
    ])('cures nothing and renders no section when conditions are %s', (_label, runtimeValue, hasPhysiciansTouch) => {
      useRuntimeState.getRuntimeValue.mockReturnValue(runtimeValue);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch })} />);
      expect(screen.queryByText(/Physician|Condition Cleared|Select one/i)).not.toBeInTheDocument();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Physician\u2019s Touch mount-law auto-cure (single cureable condition)', () => {
    it.each([
      ['lowercase input cures and stores an empty list', 'Blinded', ['blinded'], []],
      ['mixed case and padded input match case-insensitively', 'Blinded', ['  BLINDED  '], []],
      ['preserves unrelated conditions in stored state', 'Blinded', ['frightened', 'Blinded'], ['frightened']],
      ['ignores invalid mixed entries while curing', 'Stunned', ['stunned', null, undefined, '  '], [null, undefined, '  ']],
    ])('%s', (_label, canonical, conditions, expectedStored) => {
      useRuntimeState.getRuntimeValue.mockReturnValue(conditions);
      // Auto-cure runs in the mount effect, flushed synchronously by render's
      // act() — direct assertions, no waitFor.
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      // Message always shows the canonical condition name from CUREABLE_CONDITIONS.
      expect(screen.getByText(`${canonical} removed from Goblin (Physician's Touch)`)).toBeInTheDocument();
      // Exactly once — pins the mount-only auto-cure guard against re-curing,
      // and the one paired audit POST against double-logging.
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', expectedStored, 'test-campaign'
      );
      expect(logFetchCalls()).toHaveLength(1);
      expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    });
  });

  describe('Physician\u2019s Touch picker (multiple cureable conditions)', () => {
    it('lists a button per cureable condition, excludes non-cureable ones, and auto-cures nothing', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        'blinded', 'deafened', 'frightened', 'paralyzed', 'poisoned', 'stunned',
      ]);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByText(/Select one to remove/)).toBeInTheDocument();
      for (const name of ['Blinded', 'Deafened', 'Paralyzed', 'Poisoned', 'Stunned']) {
        expect(screen.getByRole('button', { name: new RegExp(`Remove ${name}`) })).toBeInTheDocument();
      }
      expect(screen.queryByRole('button', { name: /Remove Frightened/ })).not.toBeInTheDocument();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('removes only the picked condition, stores the rest with original casing, and retires the picker', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['Blinded', 'POISONED']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      // removeCondition is a synchronous click handler — no waitFor.
      fireEvent.click(screen.getByRole('button', { name: /Remove Poisoned/ }));
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', ['Blinded'], 'test-campaign'
      );
      expect(screen.getByText(/Poisoned removed from Goblin \(Physician/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Remove Blinded/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Select one to remove/)).not.toBeInTheDocument();
    });
  });

  describe('combat summary merge', () => {
    it('merges runtime and summary conditions into the picker without auto-curing', () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'stunned' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByRole('button', { name: /Remove Blinded/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove Stunned/ })).toBeInTheDocument();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('deduplicates the same condition across sources into a single auto-cure', () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'Blinded' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      expect(document.querySelectorAll('.healing-cured-condition')).toHaveLength(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', [], 'test-campaign'
      );
    });

    it.each([
      ['auto-cures a condition found only via the summary, ignoring other creatures',
        [{ name: 'Orc', conditions: [{ key: 'blinded' }] }, { name: 'Goblin', conditions: [{ key: 'stunned' }] }],
        /Stunned removed from Goblin/],
      ['ignores conditions on a differently-named creature',
        [{ name: 'Orc', conditions: [{ key: 'blinded' }] }],
        null],
    ])('%s', (_label, creatures, expectedCure) => {
      combatData.getCombatSummary.mockReturnValue({ creatures });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      if (expectedCure) {
        expect(screen.getByText(expectedCure)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Physician|Condition Cleared|Select one/i)).not.toBeInTheDocument();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
      }
    });

    // One row per malformed-summary branch in getCombatSummaryConditionKeys:
    // missing board (optional chain), non-array creature.conditions
    // (Array.isArray guard), and a throwing summary read (catch). The runtime
    // cure must survive all three.
    it.each([
      ['summary missing creatures entirely', () => ({})],
      ['creature.conditions is a non-array string', () => ({ creatures: [{ name: 'Goblin', conditions: 'stunned' }] })],
      ['getCombatSummary throws', () => { throw new Error('boom'); }],
    ])('still auto-cures the runtime condition when %s', (_label, summary) => {
      combatData.getCombatSummary.mockImplementation(summary);
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', [], 'test-campaign'
      );
    });
  });

  describe('condition log entry', () => {
    it('posts a condition audit row through the real logService funnel with the display label and sourceName', () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      // addEntry fires its fetch synchronously inside the mount effect.
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      const [url, init] = logFetchCalls()[0];
      expect(url).toBe(`/api/campaigns/${encodeURIComponent('test-campaign')}/log`);
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        type: 'condition',
        characterName: 'Goblin',
        condition: 'Blinded',
        action: 'broken',
        sourceName: 'Monk1 (Monk)',
      });
      expect(body.timestamp).toBeTypeOf('number');
    });

    it('still shows the cured state when the log fetch rejects', async () => {
      global.fetch.mockRejectedValue(new Error('network error'));
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
    });
  });
});
