// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HandOfHealingModal from './HandOfHealingModal.jsx';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => (!n || typeof n !== 'string' ? 'Unknown' : n)) },
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../../services/encounters/combatData.js';

// Result-stage props only — the pending picker lane is owned by
// HandOfHealingModal.cla159.test.jsx.
const baseProps = {
  healName: 'Monk',
  formula: '1d4 + 2',
  rolls: [3, 1],
  bonus: 2,
  healAmount: 6,
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

describe('HandOfHealingModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  describe('result rendering', () => {
    it('renders the overlay, header with healName and icon, and Done button', () => {
      render(<HandOfHealingModal {...makeProps()} />);
      expect(document.querySelector('.short-rest-overlay')).toBeInTheDocument();
      expect(document.querySelector('.short-rest-modal')).toBeInTheDocument();
      expect(screen.getByText('Monk')).toBeInTheDocument();
      expect(document.querySelector('.fa-hand-sparkles')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Done/ })).toBeInTheDocument();
    });

    it('renders the healing section: target HP, formula, dice, bonus sign, and bold total', () => {
      render(<HandOfHealingModal {...makeProps({ formula: '2d6 + 3', bonus: 2, healAmount: 8 })} />);
      const h4 = screen.getByRole('heading', { level: 4 });
      expect(h4.textContent).toContain('Healing');
      expect(h4.textContent).toContain('Goblin');
      expect(h4.textContent).toContain('15');
      expect(h4.textContent).toContain('20');
      expect(h4.textContent).toContain('HP');
      expect(screen.getByText('2d6 + 3:')).toBeInTheDocument();
      expect(screen.getByText('3 + 1')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
      const totalEl = document.querySelector('.healing-total');
      expect(totalEl.textContent).toContain('=');
      expect(totalEl.textContent).toContain('HP restored');
      expect(totalEl.querySelector('strong').textContent).toBe('8');
    });

    it.each([
      ['positive bonus shows a plus prefix', 2, '+2'],
      ['negative bonus shows a minus prefix', -1, '-1'],
    ])('%s', (_label, bonus, expectedText) => {
      render(<HandOfHealingModal {...makeProps({ bonus })} />);
      expect(screen.getByText(expectedText)).toBeInTheDocument();
      expect(document.querySelector('.healing-bonus')).toBeInTheDocument();
    });

    it('omits the bonus span when bonus is zero', () => {
      render(<HandOfHealingModal {...makeProps({ bonus: 0 })} />);
      expect(document.querySelector('.healing-bonus')).not.toBeInTheDocument();
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty array', []],
    ])('renders the modal with an empty dice list when rolls is %s', async (_label, rolls) => {
      render(<HandOfHealingModal {...makeProps({ rolls })} />);
      expect(document.querySelector('.short-rest-modal')).toBeInTheDocument();
      expect(document.querySelector('.healing-dice-rolled').textContent).toBe('');
      expect(document.querySelector('.healing-total').textContent).toContain('6');
    });

    it('renders zero heal amount and empty formula without crashing', () => {
      render(<HandOfHealingModal {...makeProps({ formula: '', healAmount: 0, rolls: [] })} />);
      expect(document.querySelector('.healing-total').textContent).toContain('0 HP restored');
    });

    it.each([
      ['Escape key', () => fireEvent.keyDown(document, { key: 'Escape' })],
      ['Done button', () => fireEvent.click(screen.getByRole('button', { name: /Done/ }))],
    ])('closes via %s', (_label, action) => {
      const onClose = vi.fn();
      render(<HandOfHealingModal {...makeProps({ onClose })} />);
      action();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when the overlay background or modal content is clicked', () => {
      const onClose = vi.fn();
      render(<HandOfHealingModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.short-rest-overlay'));
      fireEvent.click(document.querySelector('.short-rest-modal'));
      expect(onClose).not.toHaveBeenCalled();
      expect(document.querySelector('.short-rest-modal')).toBeInTheDocument();
    });
  });

  describe('Physicians Touch inactive', () => {
    it.each([
      ['feature off even with a cureable condition', ['blinded'], false],
      ['no conditions', [], true],
      ['only blank/whitespace entries', ['', '  '], true],
      ['only null entries', [null], true],
      ['only undefined entries', [undefined], true],
      ['only object entries', [{ name: 'blinded' }], true],
      ['runtime value is a non-array string', 'blinded', true],
    ])('cures nothing and renders no section when conditions are %s', (_label, runtimeValue, hasPhysiciansTouch) => {
      useRuntimeState.getRuntimeValue.mockReturnValue(runtimeValue);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch })} />);
      expect(screen.queryByText(/Physician/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Condition Cleared/)).not.toBeInTheDocument();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('Physicians Touch auto-cure (single cureable condition)', () => {
    it.each([
      ['lowercase input cures and stores an empty list', 'Blinded', ['blinded'], []],
      ['UPPERCASE input is matched case-insensitively', 'Blinded', ['BLINDED'], []],
      ['padded input is trimmed before matching', 'Blinded', ['  Blinded  '], []],
      ['preserves unrelated conditions in stored state', 'Blinded', ['frightened', 'Blinded'], ['frightened']],
      ['ignores invalid mixed entries while curing', 'Stunned', ['stunned', null, undefined, '  '], [null, undefined, '  ']],
    ])('%s', async (_label, canonical, conditions, expectedStored) => {
      useRuntimeState.getRuntimeValue.mockReturnValue(conditions);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      });
      // Message always shows the canonical condition name from CUREABLE_CONDITIONS.
      expect(screen.getByText(new RegExp(`${canonical} removed from Goblin \\(Physician`))).toBeInTheDocument();
      // Exactly once — pins the curedOnMount guard against re-curing.
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', expectedStored, 'test-campaign'
      );
      expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    });
  });

  describe('Physicians Touch picker (multiple cureable conditions)', () => {
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
    });

    it('removes only the picked condition, stores the rest with original casing, and shows the canonical cured message', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['Blinded', 'POISONED']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      fireEvent.click(screen.getByRole('button', { name: /Remove Poisoned/ }));
      await waitFor(() => {
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
          'Goblin', 'activeConditions', ['Blinded'], 'test-campaign'
        );
        expect(screen.getByText(/Poisoned removed from Goblin \(Physician/)).toBeInTheDocument();
      });
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

    it('deduplicates the same condition across sources into a single auto-cure', async () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'Goblin', conditions: [{ key: 'Blinded' }] }],
      });
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      });
      expect(document.querySelectorAll('.healing-cured-condition')).toHaveLength(1);
    });

    it.each([
      ['auto-cures a condition found only via the summary, ignoring other creatures',
        [{ name: 'Orc', conditions: [{ key: 'blinded' }] }, { name: 'Goblin', conditions: [{ key: 'stunned' }] }],
        /Stunned removed from Goblin/],
      ['ignores conditions on a differently-named creature',
        [{ name: 'Orc', conditions: [{ key: 'blinded' }] }],
        null],
    ])('%s', async (_label, creatures, expectedCure) => {
      combatData.getCombatSummary.mockReturnValue({ creatures });
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      if (expectedCure) {
        await waitFor(() => {
          expect(screen.getByText(expectedCure)).toBeInTheDocument();
        });
      } else {
        expect(screen.queryByText(/Physician|Condition Cleared|Select one/i)).not.toBeInTheDocument();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      }
    });

    it.each([
      ['summary missing creatures entirely', () => ({})],
      ['creatures is null', () => ({ creatures: null })],
      ['a creature entry is null', () => ({ creatures: [null] })],
      ['creature.conditions is null', () => ({ creatures: [{ name: 'Goblin', conditions: null }] })],
      ['creature.conditions is undefined', () => ({ creatures: [{ name: 'Goblin', conditions: undefined }] })],
      ['creature.conditions is a non-array string', () => ({ creatures: [{ name: 'Goblin', conditions: 'stunned' }] })],
      ['getCombatSummary throws', () => { throw new Error('boom'); }],
    ])('still auto-cures the runtime condition when %s', async (_label, summary) => {
      combatData.getCombatSummary.mockImplementation(summary);
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      });
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions', [], 'test-campaign'
      );
    });
  });

  describe('condition log entry', () => {
    it('posts a condition log entry with complete sourceName label', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
      render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
      await waitFor(() => {
        const logCalls = global.fetch.mock.calls.filter((call) => call[0] === '/api/campaigns/test-campaign/log');
        expect(logCalls.length).toBeGreaterThan(0);
      });
      const [url, init] = global.fetch.mock.calls.find((call) => call[0] === '/api/campaigns/test-campaign/log');
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
      await waitFor(() => {
        expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
      });
    });
  });
});
