import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Mocked modules (before the component import) ──

vi.mock('../../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../hooks/useTrackedResource.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => n?.toLowerCase().trim()) },
}));

// ── Re-import mocked modules ──
import * as useRuntimeState from '../../../hooks/useRuntimeState.js';
import useTrackedResource from '../../../hooks/useTrackedResource.js';
import storage from '../../../services/ui/storage.js';
import * as damageUtils from '../../../services/rules/combat/damageUtils.js';
import * as applyHealingService from '../../../services/rules/combat/applyHealing.js';

// ── Test fixtures ──

const mockPlayerStats = { name: 'Paladin1', level: 3, hitPoints: 40 };
const mockCampaignName = 'test-campaign';
const npcTarget = {
  name: 'Orc Warrior',
  type: 'npc',
  maxHp: 30,
  currentHp: 15,
  conditions: [{ key: 'blinded' }],
};

const mockCombatSummary = {
  creatures: [
      { name: 'Paladin1', type: 'player', targetName: 'Orc Warrior' },
    npcTarget,
    ],
};

// ── Test helpers ──

let updateFn; // captured update function from useTrackedResource mock

function setupPoolMock(current = 15, max = 20) {
  updateFn = vi.fn();
  useTrackedResource.mockReturnValue({ current, max, update: updateFn });
}

function makeProps(overrides) {
  return {
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    alsoCures: ['Blinded'],
    cureCost: 3,
    restoringTouchConditions: null,
    onClose: vi.fn(),
      ...(overrides || {}),
    };
}

async function renderModal(poolConfig, overrides) {
  setupPoolMock(poolConfig?.current, poolConfig?.max);
  const rendered = render(<HealingPoolModal {...makeProps(overrides)} />);
  await waitFor(() => {
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
  return { ...rendered, updateFn };
}

/**
 * Get the text of the first <p> inside the first .short-rest-section.
 * This avoids multiple-element matches since ancestor divs also contain "Pool".
 */
function getPoolParagraph() {
  const poolSection = document.querySelector('.short-rest-section');
  if (!poolSection) return null;
  const p = poolSection.querySelector('p');
  return p?.textContent || null;
}

// ── Tests ──

describe('HealingPoolModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    damageUtils.getCombatContext.mockResolvedValue(mockCombatSummary);
    damageUtils.getTargetFromAttacker.mockReturnValue(npcTarget);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
      });
    // Default pool mock so that direct renders work without renderModal
    setupPoolMock();
     });

  afterEach(() => {
    vi.restoreAllMocks();
    });

   // ── Loading state ──

  it('shows loading spinner initially', () => {
    render(<HealingPoolModal {...makeProps()} />);
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });

  it('hides spinner after combat context resolves', async () => {
    await renderModal({ current: 15, max: 20 });
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });

   // ── Pool display ──

  it('displays pool amount and maximum after loading', async () => {
    await renderModal({ current: 15, max: 20 });
    const poolText = getPoolParagraph();
    expect(poolText).toBe('Pool: 15 / 20 HP');
     });

  it('shows target name with current and max HP', async () => {
    await renderModal({ current: 15, max: 20 });
    expect(screen.getByText(/Heal — Orc Warrior \(15 \/ 30 HP\)/)).toBeInTheDocument();
    });

   // ── No combat context fallback ──

  it('uses player stats as fallback when no target found', async () => {
    damageUtils.getTargetFromAttacker.mockReturnValue(null);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 30;
      if (key === 'activeConditions') return [];
      return null;
      });
    await renderModal({ current: 15, max: 20 });
    expect(screen.getByText(/Heal — Paladin1 \(30 \/ 40 HP\)/)).toBeInTheDocument();
    });

  it('uses playerStats.hitPoints when currentHitPoints runtime value is missing', async () => {
    damageUtils.getTargetFromAttacker.mockReturnValue(null);
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    await renderModal({ current: 15, max: 20 });
    expect(screen.getByText(/Heal — Paladin1 \(40 \/ 40 HP\)/)).toBeInTheDocument();
    });

   // ── Heal input and button ──

  it('renders heal amount input', async () => {
    await renderModal({ current: 15, max: 20 });
    const input = screen.getByRole('spinbutton');
    expect(input).toBeInTheDocument();
    });

  it('disables apply heal when pool is zero', async () => {
    await renderModal({ current: 0, max: 20 });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).toBeDisabled();
    });

  it('disables apply heal when amount is zero or negative', async () => {
    await renderModal({ current: 15, max: 20 });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '0' } });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).toBeDisabled();
    });

  it('updates heal amount on input change', async () => {
    await renderModal({ current: 15, max: 20 });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });
    expect(input.value).toBe('10');
    });

   // ── Apply heal with combat context (NPC target) ──

  it('applies healing when apply heal is clicked', async () => {
    applyHealingService.applyHealingToTarget.mockReturnValue({
      actualHeal: 5,
      oldHp: 15,
      newHp: 20,
      });

    await renderModal({ current: 20, max: 20 });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledWith(
      mockCombatSummary,
      npcTarget.name,
        5,
      mockCampaignName
      );
    expect(updateFn).toHaveBeenCalled();
    });

  it('adds heal entry to log after applying healing', async () => {
    applyHealingService.applyHealingToTarget.mockReturnValue({
      actualHeal: 5,
      oldHp: 15,
      newHp: 20,
      });

    await renderModal({ current: 20, max: 20 });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    expect(screen.getByRole('table')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
      // Header row + 1 data row
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent('Heal');
    expect(rows[1]).toHaveTextContent(npcTarget.name);
    });

  it('caps heal amount to remaining pool in the input display', async () => {
    await renderModal({ current: 3, max: 20 });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });
      // After changing to 10, healAmount becomes 10 but display shows Math.min(10, 3) = 3
    expect(input.value).toBe('3');
    });

   // ── Apply heal without combat context (self-heal) ──

  it('applies self-heal when no combat context exists', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    damageUtils.getTargetFromAttacker.mockReturnValue(null);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') return [];
      return null;
      });

    await renderModal({ current: 20, max: 20 });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
    const logCalls = global.fetch.mock.calls.filter(
        (call) => call[0] === '/api/campaigns/test-campaign/log'
      );
    expect(logCalls.length).toBeGreaterThan(0);
    });

   // ── Individual cure conditions (no restoring touch) ──

  it('renders individual cure buttons when alsoCures provided without restoringTouch', async () => {
    await renderModal({ current: 15, max: 20 }, { restoringTouchConditions: null });
    expect(screen.getByText(/Cure Conditions/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Blinded/i })).toBeInTheDocument();
    });

  it('applies individual cure when cure button clicked', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
      });

    await renderModal({ current: 10, max: 20 });
    fireEvent.click(screen.getByRole('button', { name: /Blinded/i }));

      // verify runtime state update to remove condition
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      npcTarget.name,
        'activeConditions',
      expect.any(Array),
      mockCampaignName
      );
    });

  it('does not apply cure when pool insufficient for cost', async () => {
    await renderModal({ current: 1, max: 20 }, { cureCost: 3 });
    const btn = screen.getByRole('button', { name: /Blinded/i });
    expect(btn).toBeDisabled();
    });

  it('individual cure adds log entry with capitalized condition label', async () => {
    await renderModal({ current: 10, max: 20 });

    fireEvent.click(screen.getByRole('button', { name: /Blinded/i }));

    expect(screen.getByRole('table')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(2);
      // Log entry uses the label "Cure Blinded" (capitalized, not lowercase)
    expect(rows[1]).toHaveTextContent(/Cure Blinded/);
    });

   // ── Restoring touch batch cure section ──

  it('renders restoring touch batch cure section with matching conditions', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
      });

    await renderModal({ current: 15, max: 20 }, {
      restoringTouchConditions: ['Blinded', 'Poisoned'],
      alsoCures: [],
      });
    expect(screen.getByText(/Select conditions affecting/)).toBeInTheDocument();
    });

  it('does not render batch cure section when no matching conditions on target', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return []; // empty - no matches
      return null;
      });

    await renderModal({ current: 15, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
      });
    expect(screen.queryByText(/Select conditions affecting/)).not.toBeInTheDocument();
    });

  it('toggles condition selection on button click', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
      });

    await renderModal({ current: 15, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
      });

      // Before toggling - no active class
    expect(document.querySelector('.cure-btn-active')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Blinded/));
    expect(document.querySelector('.cure-btn-active')).toBeInTheDocument();
    });

  it('batch cure button is disabled when no conditions selected', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
      });

    await renderModal({ current: 15, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
      });
    const batchBtn = screen.getByRole('button', { name: /Cure Selected/i });
    expect(batchBtn).toBeDisabled();
    });

  it('batch cure button enabled after selecting a condition with sufficient pool', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
      });

    await renderModal({ current: 20, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
      });
    fireEvent.click(screen.getByText(/Blinded/)); // select condition
    const batchBtn = screen.getByRole('button', { name: /Cure Selected/i });
    expect(batchBtn).not.toBeDisabled();
    });

  it('applies batch cure for all selected conditions', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
      });

    await renderModal({ current: 20, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
      });
    fireEvent.click(screen.getByText(/Blinded/)); // select condition
    fireEvent.click(screen.getByRole('button', { name: /Cure Selected/i }));

      // Verify setRuntimeValue was called to remove the condition
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      npcTarget.name,
        'activeConditions',
      expect.any(Array),
      mockCampaignName
      );
    });

  it('batch cure adds entries to action log', async () => {
    await renderModal({ current: 20, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
      });
    fireEvent.click(screen.getByText(/Blinded/));
    fireEvent.click(screen.getByRole('button', { name: /Cure Selected/i }));

    expect(screen.getByRole('table')).toBeInTheDocument();
    });

  it('shows "Pool after" info when selections are affordable', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
      });

    await renderModal({ current: 20, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
      });
    fireEvent.click(screen.getByText(/Blinded/)); // selects condition; cureCost defaults to 3

    expect(screen.getByText(/Pool after/)).toBeInTheDocument();
    });

  it('shows warning when not enough pool for batch cure', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
      });

    await renderModal({ current: 1, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
      cureCost: 5,
      });
    fireEvent.click(screen.getByText(/Blinded/));

    expect(screen.getByText(/Not enough pool!/)).toBeInTheDocument();
    const batchBtn = screen.getByRole('button', { name: /Cure Selected/i });
    expect(batchBtn).toBeDisabled();
    });

  it('does not render batch cure section when restoringTouchConditions is empty', async () => {
    await renderModal({ current: 15, max: 20 }, { alsoCures: [] });
    expect(screen.queryByText(/Select conditions affecting/)).not.toBeInTheDocument();
    });

   // ── Log section ──

  it('renders log table with headers after actions are performed', async () => {
    applyHealingService.applyHealingToTarget.mockReturnValue({
      actualHeal: 5,
      oldHp: 15,
      newHp: 20,
      });

    await renderModal({ current: 20, max: 20 });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByText('Pool Used')).toBeInTheDocument();
    expect(screen.getByText('Pool Left')).toBeInTheDocument();
    });

  it('does not render log section when no actions taken', async () => {
    await renderModal({ current: 15, max: 20 });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

   // ── Modal close interactions ──

  it('calls onClose when Done button is clicked', async () => {
    const onClose = vi.fn();
    await renderModal({ current: 15, max: 20 }, { onClose });
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
    });

  it('renders Done button', async () => {
    await renderModal({ current: 15, max: 20 });
    expect(screen.getByText('Done')).toBeInTheDocument();
    });

   // ── Keyboard dismiss ──

  it('closes on Escape key press', async () => {
    const onClose = vi.fn();
    await renderModal({ current: 15, max: 20 }, { onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    });

   // ── Overlay click behavior ──

  it('closes when clicking the overlay background', async () => {
    const onClose = vi.fn();
    await renderModal({ current: 15, max: 20 }, { onClose });
    const overlay = document.querySelector('.short-rest-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
    });

  it('does not close when clicking inside the modal content', async () => {
    const onClose = vi.fn();
    await renderModal({ current: 15, max: 20 }, { onClose });
    const modalContent = document.querySelector('.short-rest-modal');
    fireEvent.click(modalContent);
    expect(onClose).not.toHaveBeenCalled();
    });

   // ── Edge cases ──

  it('handles heal amount clamped to pool max in input display', async () => {
    await renderModal({ current: 5, max: 20 });
    const input = screen.getByRole('spinbutton');
      // The input value is Math.min(healAmount, safePool) — defaults to 1, which is <= 5
    expect(input.value).toBe('1'); // initial value

    fireEvent.change(input, { target: { value: '10' } });
      // After changing to 10, healAmount becomes 10 but display shows Math.min(10, 5) = 5
    expect(input.value).toBe('5');
    });

  it('handles negative input values gracefully', async () => {
    await renderModal({ current: 15, max: 20 });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-5' } });
      // Negative raw → setHealAmount(0) — button should be disabled for amount <= 0
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Apply Heal/i });
      expect(btn).toBeDisabled();
      });
    });

  it('renders modal with proper heading and icon', async () => {
    await renderModal({ current: 15, max: 20 });
    expect(screen.getByText('Lay On Hands')).toBeInTheDocument();
    const header = document.querySelector('h3');
    expect(header).toBeInTheDocument();
    });

  it('no individual cure buttons when alsoCures empty and no restoringTouch', async () => {
    await renderModal({ current: 15, max: 20 }, { alsoCures: [] });
    expect(screen.queryByText(/Cure Conditions/)).not.toBeInTheDocument();
    });

   // ── Multiple heal applications stack in log ──

  it('accumulates multiple entries in the log', async () => {
    let callCounter = 0;
    applyHealingService.applyHealingToTarget.mockImplementation(() => {
      callCounter++;
      return { actualHeal: 5, oldHp: 15 + (callCounter - 1) * 5, newHp: 20 + (callCounter - 1) * 5 };
      });

    await renderModal({ current: 20, max: 20 });
    for (let i = 0; i < 3; i++) {
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
      fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));
      }

    const dataRows = screen.getAllByRole('row').filter((r, idx) => idx > 0);
    expect(dataRows).toHaveLength(3);
    });

   // ── Pool display edge cases ──

  it('shows pool as 0 when tracked resource current is zero', async () => {
    await renderModal({ current: 0, max: 20 });
    const poolText = getPoolParagraph();
    expect(poolText).toBe('Pool: 0 / 20 HP');
      });

  it('safeMax falls back to 0 when hook returns non-numeric max', async () => {
    updateFn = vi.fn();
    useTrackedResource.mockReturnValue({ current: 10, max: NaN, update: updateFn });
    const rendered = render(<HealingPoolModal {...makeProps()} />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    const poolText = getPoolParagraph();
    expect(poolText).toBe('Pool: 10 / 0 HP');
    rendered.unmount?.();
    });

   // ── NPC target conditions updated via applyCure when NPC in combat ──

  it('updates NPC condition in combatSummary during individual cure', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);

    await renderModal({ current: 10, max: 20 });
    fireEvent.click(screen.getByRole('button', { name: /Blinded/i }));

    expect(storage.set).toHaveBeenCalled();
    });

   // When target is not NPC, storage should NOT be called from cure path
  it('does not update combatSummary for non-NPC cures', async () => {
    damageUtils.getTargetFromAttacker.mockReturnValue({
      name: 'Ally',
      type: 'player',
      maxHp: 40,
      currentHp: 30,
      });

    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
      });

    await renderModal({ current: 10, max: 20 });
    fireEvent.click(screen.getByRole('button', { name: /Blinded/i }));

    expect(storage.set).not.toHaveBeenCalled();
    });

  // ── Dice pool mode (Warrior of the Gods) ──

  it('dice pool displays pool as dice count and die type', async () => {
    await renderModal({ current: 3, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
      resourceKey: 'warriorofthegodsPool',
    });
    const poolText = getPoolParagraph();
    expect(poolText).toBe('Pool: 3 / 4 d12');
  });

  it('dice pool shows Roll & Heal button instead of Apply Heal', async () => {
    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });
    expect(screen.getByText(/Roll & Heal/)).toBeInTheDocument();
    expect(screen.queryByText(/Apply Heal/)).not.toBeInTheDocument();
  });

  it('dice pool uses dynamic feature name in heading', async () => {
    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });
    expect(screen.getByText('Warrior of the Gods')).toBeInTheDocument();
    expect(screen.queryByText('Lay On Hands')).not.toBeInTheDocument();
  });

  it('dice pool Roll & Heal button disabled when pool is zero', async () => {
    await renderModal({ current: 0, max: 4 }, {
      isDicePool: true,
      dieType: 12,
    });
    const btn = screen.getByRole('button', { name: /Roll & Heal/i });
    expect(btn).toBeDisabled();
  });

  it('dice pool displays roll result after healing', async () => {
    applyHealingService.applyHealingToTarget.mockReturnValue({
      actualHeal: 10,
      oldHp: 15,
      newHp: 25,
    });

    await renderModal({ current: 3, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });
    fireEvent.click(screen.getByRole('button', { name: /Roll & Heal/i }));

    expect(screen.getByText(/HP restored/)).toBeInTheDocument();
  });

  it('dice pool applies healing and logs entry on Roll & Heal', async () => {
    applyHealingService.applyHealingToTarget.mockReturnValue({
      actualHeal: 8,
      oldHp: 15,
      newHp: 23,
    });

    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });
    fireEvent.click(screen.getByRole('button', { name: /Roll & Heal/i }));

    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalled();
    expect(updateFn).toHaveBeenCalled();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('dice pool applies self-heal when no combat context', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    damageUtils.getTargetFromAttacker.mockReturnValue(null);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });
    fireEvent.click(screen.getByRole('button', { name: /Roll & Heal/i }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
    const logCalls = global.fetch.mock.calls.filter(
        (call) => call[0] === '/api/campaigns/test-campaign/log'
      );
    expect(logCalls.length).toBeGreaterThan(0);
  });
});
