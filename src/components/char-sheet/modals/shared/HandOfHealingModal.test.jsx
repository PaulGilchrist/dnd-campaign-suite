import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HandOfHealingModal from './HandOfHealingModal.jsx';

// ── Mocked modules (before the component import) ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => (typeof n === 'string' ? n : '')) },
}));

vi.mock('../../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

// ── Re-import mocked modules ──

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import storage from '../../../../services/ui/storage.js';
import * as combatData from '../../../../services/encounters/combatData.js';

// ── Test fixtures ──

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

// ── Tests ──

describe('HandOfHealingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<HandOfHealingModal {...makeProps()} />);
    expect(document.querySelector('.short-rest-overlay')).toBeInTheDocument();
  });

  it('renders modal content container', () => {
    render(<HandOfHealingModal {...makeProps()} />);
    expect(document.querySelector('.short-rest-modal')).toBeInTheDocument();
  });

  it('renders header with healName and hand-sparkles icon', () => {
    render(<HandOfHealingModal {...makeProps()} />);
    expect(screen.getByText('Monk')).toBeInTheDocument();
    const icon = document.querySelector('.fa-hand-sparkles');
    expect(icon).toBeInTheDocument();
  });

  it('renders healing section with target name and HP info', () => {
    render(<HandOfHealingModal {...makeProps()} />);
    const h4 = document.querySelector('h4');
    expect(h4.textContent).toContain('Healing');
    expect(h4.textContent).toContain('Goblin');
    expect(h4.textContent).toContain('15');
    expect(h4.textContent).toContain('20');
    expect(h4.textContent).toContain('HP');
  });

  it('renders formula text', () => {
    render(<HandOfHealingModal {...makeProps({ formula: '2d6 + 3' })} />);
    expect(screen.getByText('2d6 + 3:')).toBeInTheDocument();
  });

  it('renders dice roll values joined by +', () => {
    render(<HandOfHealingModal {...makeProps({ rolls: [3, 1] })} />);
    expect(screen.getByText('3 + 1')).toBeInTheDocument();
  });

  it('renders positive bonus with + prefix', () => {
    render(<HandOfHealingModal {...makeProps({ bonus: 2 })} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders negative bonus with - prefix', () => {
    render(<HandOfHealingModal {...makeProps({ bonus: -1 })} />);
    expect(screen.getByText('-1')).toBeInTheDocument();
  });

  it('renders healing total with healAmount', () => {
    render(<HandOfHealingModal {...makeProps({ healAmount: 6 })} />);
    const totalEl = document.querySelector('.healing-total');
    expect(totalEl.textContent).toContain('6');
    expect(totalEl.textContent).toContain('HP restored');
  });

  it('renders Done button', () => {
    render(<HandOfHealingModal {...makeProps()} />);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders Done button with check icon', () => {
    render(<HandOfHealingModal {...makeProps()} />);
    const doneBtn = screen.getByText('Done').closest('button');
    const icon = doneBtn.querySelector('.fa-solid.fa-check');
    expect(icon).toBeInTheDocument();
  });

  // ── Overlay / click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<HandOfHealingModal {...makeProps({ onClose })} />);
    const overlay = document.querySelector('.short-rest-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<HandOfHealingModal {...makeProps({ onClose })} />);
    const modalContent = document.querySelector('.short-rest-modal');
    fireEvent.click(modalContent);
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Close interactions ──

  it('calls onClose when Done button is clicked', () => {
    const onClose = vi.fn();
    render(<HandOfHealingModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press', () => {
    const onClose = vi.fn();
    render(<HandOfHealingModal {...makeProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Physician's Touch - no cureable conditions ──

  it('does not render Physician\'s Touch section when no conditions match', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue([]);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
  });

  it('does not render Physician\'s Touch section when hasPhysiciansTouch is false', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: false })} />);
    expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
  });

  // ── Physician's Touch - single cureable condition (auto-cure) ──

  it('auto-removes single cureable condition when hasPhysiciansTouch is true', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
    });
  });

  it('calls setRuntimeValue to remove the auto-cured condition', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.any(Array),
        'test-campaign'
      );
    });
  });

  it('shows cured condition in the result section', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(screen.getByText(/Blinded removed from Goblin \(Physician/)).toBeInTheDocument();
    });
  });

  it('does not show cure options button when single condition auto-cured', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Remove Blinded/ })).not.toBeInTheDocument();
    });
  });

  it('auto-cure respects case-insensitive condition matching', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['BLINDED']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
    });
  });

  it('auto-cure trims whitespace from condition names', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue([' blinded ']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
    });
  });

  // ── Physician's Touch - multiple cureable conditions ──

  it('renders Physician\'s Touch section when multiple cureable conditions exist', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(screen.getByText(/Physician/)).toBeInTheDocument();
    expect(screen.getByText(/Select one to remove/)).toBeInTheDocument();
  });

  it('renders a button for each cureable condition', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(screen.getByRole('button', { name: /Remove Blinded/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Poisoned/ })).toBeInTheDocument();
  });

  it('does not render buttons for non-cureable conditions', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'frightened', 'poisoned']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(screen.getByRole('button', { name: /Remove Blinded/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Poisoned/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove Frightened/ })).not.toBeInTheDocument();
  });

  it('renders shield-virus icon in Physician\'s Touch section', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    const icons = document.querySelectorAll('.fa-shield-virus');
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it('removes condition when its button is clicked', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove Poisoned/ }));

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.any(Array),
        'test-campaign'
      );
    });
  });

  it('shows cured condition after manually removing one', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove Poisoned/ }));

    await waitFor(() => {
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
    });
  });

  it('shows the removed condition name in the cured section', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove Poisoned/ }));

    await waitFor(() => {
      expect(screen.getByText(/Poisoned removed from Goblin \(Physician/)).toBeInTheDocument();
    });
  });

  it('hides cure options after a condition is removed', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove Poisoned/ }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Remove Blinded/ })).not.toBeInTheDocument();
    });
  });

  it('auto-cure does not fire when hasPhysiciansTouch is false', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: false })} />);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('auto-cure does not fire when multiple cureable conditions exist', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  // ── Condition matching edge cases ──

  it('handles empty condition strings gracefully', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['', '  ']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
  });

  it('handles null condition values gracefully', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue([null]);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(screen.queryByText(/Physician/)).not.toBeInTheDocument();
  });

  // ── Combat summary conditions ──

  it('merges conditions from combat summary when target is a creature', () => {
    combatData.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin', conditions: [{ key: 'stunned' }] },
      ],
    });
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(screen.getByText(/Select one to remove/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Blinded/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Stunned/ })).toBeInTheDocument();
  });

  it('deduplicates conditions between runtime and combat summary', async () => {
    combatData.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin', conditions: [{ key: 'Blinded' }] },
      ],
    });
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    // Should auto-cure only once (dedup prevents showing both 'blinded' and 'Blinded')
    await waitFor(() => {
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
    });
    // Should only show one cured condition, not two
    const curedSections = document.querySelectorAll('.healing-cured-condition');
    expect(curedSections).toHaveLength(1);
  });

  it('matches creature names exactly from combat summary', async () => {
    combatData.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin', conditions: [{ key: 'blinded' }] },
      ],
    });
    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    // Should auto-cure the condition found via combat summary creature match
    await waitFor(() => {
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
    });
  });

  it('does not crash when combat summary creatures is undefined', () => {
    combatData.getCombatSummary.mockReturnValue({});
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
  });

  it('does not crash when combat summary throws', () => {
    combatData.getCombatSummary.mockImplementation(() => { throw new Error('fail'); });
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
  });

  // ── Condition removal - combat summary update ──

  it('removes condition from combat summary when present', async () => {
    combatData.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin', conditions: [{ key: 'blinded' }] },
      ],
    });
    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
    });
  });

  it('dispatches combat-summary-updated event after removing condition from combat summary', async () => {
    combatData.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin', conditions: [{ key: 'blinded' }] },
      ],
    });
    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    const handler = vi.fn();
    window.addEventListener('combat-summary-updated', handler);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });

    window.removeEventListener('combat-summary-updated', handler);
  });

  // ── Condition removal - log entry ──

  it('posts a condition log entry when removing a condition', async () => {
    combatData.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin', conditions: [{ key: 'blinded' }] },
      ],
    });
    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/campaigns/test-campaign/log',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  it('includes correct data in the condition log entry', async () => {
    combatData.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin', conditions: [{ key: 'blinded' }] },
      ],
    });
    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      const logCalls = global.fetch.mock.calls.filter(
        (call) => call[0] === '/api/campaigns/test-campaign/log'
      );
      expect(logCalls.length).toBeGreaterThan(0);
      const body = JSON.parse(logCalls[0][1].body);
      expect(body.type).toBe('condition');
      expect(body.characterName).toBe('Goblin');
      expect(body.condition).toBe('Blinded');
      expect(body.action).toBe('broken');
      expect(body.sourceName).toBe('Monk1 (Monk');
    });
  });

  it('does not crash when fetch fails during condition removal', async () => {
    global.fetch.mockRejectedValue(new Error('network error'));
    combatData.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Goblin', conditions: [{ key: 'blinded' }] },
      ],
    });
    useRuntimeState.getRuntimeValue.mockReturnValue([]);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(screen.getByText(/Condition Cleared/)).toBeInTheDocument();
    });
  });

  // ── Rolls array edge cases ──

  it('handles rolls as undefined gracefully', () => {
    render(<HandOfHealingModal {...makeProps({ rolls: undefined })} />);
    expect(screen.getByText('Monk')).toBeInTheDocument();
  });

  it('handles rolls as null gracefully', () => {
    render(<HandOfHealingModal {...makeProps({ rolls: null })} />);
    expect(screen.getByText('Monk')).toBeInTheDocument();
  });

  it('handles rolls as empty array', () => {
    render(<HandOfHealingModal {...makeProps({ rolls: [] })} />);
    expect(screen.getByText('Monk')).toBeInTheDocument();
  });

  // ── Bonus edge cases ──

  it('renders zero bonus without + or - prefix', () => {
    render(<HandOfHealingModal {...makeProps({ bonus: 0 })} />);
    const bonusEl = document.querySelector('.healing-bonus');
    expect(bonusEl).not.toBeInTheDocument();
  });

  // ── Condition name casing in cured section ──

  it('displays the original condition name casing in the cured section', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['Blinded']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(screen.getByText(/Blinded removed from Goblin/)).toBeInTheDocument();
    });
  });

  // ── Check-circle icon on cure buttons ──

  it('renders check-circle icon on each cure button', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    const checkIcons = document.querySelectorAll('.fa-check-circle');
    expect(checkIcons.length).toBeGreaterThanOrEqual(2);
  });

  // ── CSS classes ──

  it('renders short-rest-section divs', () => {
    render(<HandOfHealingModal {...makeProps()} />);
    const sections = document.querySelectorAll('.short-rest-section');
    expect(sections.length).toBeGreaterThanOrEqual(1);
  });

  it('renders healing-roll-details div', () => {
    render(<HandOfHealingModal {...makeProps()} />);
    expect(document.querySelector('.healing-roll-details')).toBeInTheDocument();
  });

  it('renders healing-formula span with formula text', () => {
    render(<HandOfHealingModal {...makeProps({ formula: '1d8' })} />);
    expect(document.querySelector('.healing-formula')).toHaveTextContent('1d8:');
  });

  it('renders healing-dice-rolled span', () => {
    render(<HandOfHealingModal {...makeProps({ rolls: [4, 2] })} />);
    expect(document.querySelector('.healing-dice-rolled')).toHaveTextContent('4 + 2');
  });

  it('renders healing-bonus span for non-zero bonus', () => {
    render(<HandOfHealingModal {...makeProps({ bonus: 3 })} />);
    expect(document.querySelector('.healing-bonus')).toHaveTextContent('+3');
  });

  it('renders healing-total span with bold healAmount', () => {
    render(<HandOfHealingModal {...makeProps({ healAmount: 10 })} />);
    const totalEl = document.querySelector('.healing-total');
    expect(totalEl).toHaveTextContent(/10/);
  });

  it('renders short-rest-actions div with Done button', () => {
    render(<HandOfHealingModal {...makeProps()} />);
    expect(document.querySelector('.short-rest-actions')).toBeInTheDocument();
  });

  it('renders char-btn class on Done button', () => {
    render(<HandOfHealingModal {...makeProps()} />);
    const doneBtn = screen.getByText('Done').closest('button');
    expect(doneBtn.classList.contains('char-btn')).toBe(true);
  });

  it('renders char-btn class on cure buttons', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    const removeBtn = screen.getByRole('button', { name: /Remove Blinded/ });
    expect(removeBtn.classList.contains('char-btn')).toBe(true);
  });

  it('renders healing-cured-condition class on cured condition section', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(document.querySelector('.healing-cured-condition')).toBeInTheDocument();
    });
  });

  it('renders healing-cure-options div when multiple conditions', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(document.querySelector('.healing-cure-options')).toBeInTheDocument();
  });

  // ── Multiple conditions list ──

  it('renders all cureable conditions from the full list', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'deafened', 'paralyzed']);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(screen.getByRole('button', { name: /Remove Blinded/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Deafened/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Paralyzed/ })).toBeInTheDocument();
  });

  it('renders all five cureable conditions when all are present', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue([
      'blinded', 'deafened', 'paralyzed', 'poisoned', 'stunned',
    ]);
    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);
    expect(screen.getByRole('button', { name: /Remove Blinded/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Deafened/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Paralyzed/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Poisoned/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Stunned/ })).toBeInTheDocument();
  });

  // ── getRuntimeValue key/name usage ──

  it('calls getRuntimeValue with targetName and activeConditions key', () => {
    useRuntimeState.getRuntimeValue.mockReturnValue([]);
    render(<HandOfHealingModal {...makeProps()} />);
    expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions');
  });

  it('calls setRuntimeValue with targetName, activeConditions, filtered array, and campaignName', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);

    render(<HandOfHealingModal {...makeProps({ hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.any(Array),
        'test-campaign'
      );
    });
  });

  // ── Event listener cleanup ──

  it('removes keydown listener on unmount', () => {
    const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
    const onClose = vi.fn();
    const { unmount } = render(<HandOfHealingModal {...makeProps({ onClose })} />);
    unmount();
    expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeListenerSpy.mockRestore();
  });

  // ── Encoded campaign name in log URL ──

  it('URL-encodes the campaign name in the log fetch URL', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);

    render(<HandOfHealingModal {...makeProps({ campaignName: 'my campaign/2024', hasPhysiciansTouch: true })} />);

    await waitFor(() => {
      const logCalls = global.fetch.mock.calls.filter(
        (call) => call[0]?.includes('/log')
      );
      expect(logCalls.length).toBeGreaterThan(0);
      expect(logCalls[0][0]).toContain('my%20campaign%2F2024');
    });
  });
});
