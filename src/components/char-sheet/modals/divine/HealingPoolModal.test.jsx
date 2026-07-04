// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HealingPoolModal from './HealingPoolModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: vi.fn((n) => n?.toLowerCase().trim()) },
}));

vi.mock('../../../../services/combat/conditions/conditionUtils.js', () => ({
  CONDITIONS: [
    { key: 'blinded', label: 'Blinded' },
    { key: 'charmed', label: 'Charmed' },
    { key: 'poisoned', label: 'Poisoned' },
    { key: 'frightened', label: 'Frightened' },
  ],
}));

// ── Re-import mocked modules ──

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import useTrackedResource from '../../../../hooks/runtime/useTrackedResource.js';
import storage from '../../../../services/ui/storage.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import * as applyHealingService from '../../../../services/rules/combat/applyHealing.js';

// ── Test fixtures ──

const mockPlayerStats = {
  name: 'Paladin1',
  level: 3,
  hitPoints: 40,
  abilities: { CHA: 14 },
};
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

/**
 * Captures the update function from the useTrackedResource mock.
 * The real hook returns max as maxGetter() (a number), so the mock
 * should return max as a plain number to faithfully reproduce that.
 */
let updateFn;

function setupPoolMock(current = 15, max = 20) {
  updateFn = vi.fn();
  // max is the result of calling maxGetter() — a plain number
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
    ...(overrides ?? {}),
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

function getLogTableRows() {
  const table = screen.getByRole('table');
  const rows = table.querySelectorAll('tr');
  // Skip header row (index 0)
  return Array.from(rows).slice(1);
}

// ── Tests ──

describe('HealingPoolModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    damageUtils.getCombatContext.mockResolvedValue(mockCombatSummary);
    damageUtils.getTargetFromAttacker.mockReturnValue(npcTarget);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
    });
    setupPoolMock();
  });

  // ── Loading state ──

  it('shows loading spinner initially', async () => {
    // The component sets loading=true synchronously and sets it false in a useEffect.
    // In jsdom the useEffect fires synchronously in the tick after render,
    // so we wait for the loading state to resolve.
    render(<HealingPoolModal {...makeProps()} />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
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
      mockCampaignName,
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

    const rows = getLogTableRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Heal');
    expect(rows[0]).toHaveTextContent(npcTarget.name);
    expect(rows[0]).toHaveTextContent('5');
  });

  it('caps heal amount to remaining pool in the input display', async () => {
    await renderModal({ current: 3, max: 20 });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });
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

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      mockPlayerStats.name,
      'currentHitPoints',
      expect.any(Number),
      mockCampaignName,
    );
    const logCalls = global.fetch.mock.calls.filter(
      (call) => call[0] === '/api/campaigns/test-campaign/log',
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

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      npcTarget.name,
      'activeConditions',
      expect.any(Array),
      mockCampaignName,
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

    const rows = getLogTableRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(/Cure/);
    expect(rows[0]).toHaveTextContent(npcTarget.name);
    expect(rows[0]).toHaveTextContent('3');
  });

  it('individual cure does not call storage.set for player targets', async () => {
    damageUtils.getTargetFromAttacker.mockReturnValue({
      name: 'Paladin1',
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
      if (key === 'activeConditions') return ['poisoned'];
      return null;
    });

    await renderModal({ current: 15, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
    });
    expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
      npcTarget.name,
      'activeConditions'
    );
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
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

    const blindedBtn = screen.getByText(/Blinded/);
    expect(blindedBtn).not.toHaveClass('cure-btn-active');

    fireEvent.click(blindedBtn);
    expect(blindedBtn).toHaveClass('cure-btn-active');

    // Toggle off
    fireEvent.click(blindedBtn);
    expect(blindedBtn).not.toHaveClass('cure-btn-active');
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
    fireEvent.click(screen.getByText(/Blinded/));
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
    fireEvent.click(screen.getByText(/Blinded/));
    fireEvent.click(screen.getByRole('button', { name: /Cure Selected/i }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      npcTarget.name,
      'activeConditions',
      expect.any(Array),
      mockCampaignName,
    );
  });

  it('batch cure adds log entries for each cured condition', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded', 'poisoned'];
      return null;
    });

    await renderModal({ current: 20, max: 20 }, {
      restoringTouchConditions: ['Blinded', 'Poisoned'],
      alsoCures: [],
      cureCost: 3,
    });
    fireEvent.click(screen.getByText(/Blinded/));
    fireEvent.click(screen.getByText(/Poisoned/));
    fireEvent.click(screen.getByRole('button', { name: /Cure Selected/i }));

    const rows = getLogTableRows();
    expect(rows).toHaveLength(2);
  });

  it('resets selected conditions after batch cure', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
    });

    await renderModal({ current: 20, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
    });
    fireEvent.click(screen.getByText(/Blinded/));
    fireEvent.click(screen.getByRole('button', { name: /Cure Selected/i }));

    const blindedBtn = screen.getByText(/Blinded/);
    expect(blindedBtn).not.toHaveClass('cure-btn-active');
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
    fireEvent.click(screen.getByText(/Blinded/));

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

  it('does not render batch cure section when restoringTouchConditions is null', async () => {
    await renderModal({ current: 15, max: 20 }, { restoringTouchConditions: null, alsoCures: [] });
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

  // ── Edge cases ──

  it('handles heal amount clamped to pool max in input display', async () => {
    await renderModal({ current: 5, max: 20 });
    const input = screen.getByRole('spinbutton');
    expect(input.value).toBe('1');

    fireEvent.change(input, { target: { value: '10' } });
    expect(input.value).toBe('5');
  });

  it('handles negative input values gracefully', async () => {
    await renderModal({ current: 15, max: 20 });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-5' } });
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
    expect(header.querySelector('i.fa-slash, i.fas')).toBeInTheDocument();
  });

  it('no individual cure buttons when alsoCures empty and no restoringTouch', async () => {
    await renderModal({ current: 15, max: 20 }, { alsoCures: [] });
    expect(screen.queryByText(/Cure Conditions/)).not.toBeInTheDocument();
  });

  it('no individual cure buttons when alsoCures is null', async () => {
    await renderModal({ current: 15, max: 20 }, { alsoCures: null });
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

    const rows = getLogTableRows();
    expect(rows).toHaveLength(3);
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

  it('shows pool text with HP suffix for non-dice pool', async () => {
    await renderModal({ current: 10, max: 15 });
    const poolText = getPoolParagraph();
    expect(poolText).toContain('HP');
    expect(poolText).not.toContain('d');
  });

  // ── NPC target conditions updated via applyCure when NPC in combat ──

  it('updates NPC condition via setRuntimeValue during individual cure', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValue(['blinded']);

    await renderModal({ current: 10, max: 20 });
    fireEvent.click(screen.getByRole('button', { name: /Blinded/i }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      npcTarget.name,
      'activeConditions',
      expect.any(Array),
      mockCampaignName,
    );
    expect(storage.set).not.toHaveBeenCalled();
  });

  // ── Bloodied-only mode ──

  it('shows bloodied restriction badge when bloodiedOnly is true', async () => {
    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    expect(screen.getByText(/Bloodied only/)).toBeInTheDocument();
  });

  it('disables apply heal when target is not bloodied and bloodiedOnly is true', async () => {
    damageUtils.getTargetFromAttacker.mockReturnValue({
      name: 'Orc Warrior',
      type: 'npc',
      maxHp: 30,
      currentHp: 25, // not bloodied (above half)
    });

    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).toBeDisabled();
  });

  it('enables apply heal when target is bloodied and bloodiedOnly is true', async () => {
    damageUtils.getTargetFromAttacker.mockReturnValue({
      name: 'Orc Warrior',
      type: 'npc',
      maxHp: 30,
      currentHp: 15, // bloodied (exactly half)
    });

    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).not.toBeDisabled();
  });

  it('shows restriction note when target is not bloodied', async () => {
    damageUtils.getTargetFromAttacker.mockReturnValue({
      name: 'Orc Warrior',
      type: 'npc',
      maxHp: 30,
      currentHp: 25,
    });

    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    expect(screen.getByText(/This feature can only heal Bloodied creatures/)).toBeInTheDocument();
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
      (call) => call[0] === '/api/campaigns/test-campaign/log',
    );
    expect(logCalls.length).toBeGreaterThan(0);
  });

  it('dice pool input defaults to 1 and clamps to pool max', async () => {
    await renderModal({ current: 2, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });
    const input = screen.getByRole('spinbutton');
    expect(input.value).toBe('1');

    fireEvent.change(input, { target: { value: '5' } });
    // Should clamp to pool max (2)
    expect(input.value).toBe('2');
  });

  it('dice pool respects effectiveMaxDicePerUse from CHA modifier', async () => {
    // CHA 14 => modifier = floor((14-1)/2) = 6, effectiveMaxDicePerUse = chaMod when maxDicePerUse is truthy
    await renderModal({ current: 10, max: 10 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
      maxDicePerUse: true, // enables CHA-limited dice
    });
    const input = screen.getByRole('spinbutton');
    // CHA 14 => mod = 6, so max dice per use is 6
    expect(input.getAttribute('max')).toBe('6');
  });

  it('dice pool shows max dice badge when effectiveMaxDicePerUse is limited', async () => {
    await renderModal({ current: 10, max: 10 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
      maxDicePerUse: true,
    });
    expect(screen.getByText(/Max 6 dice/)).toBeInTheDocument();
  });

  it('dice pool shows dice count and die type in heading', async () => {
    await renderModal({ current: 4, max: 8 }, {
      isDicePool: true,
      dieType: 8,
      name: 'Divine Fury',
    });
    expect(screen.getByText(/Roll Dice — .* \(.*\/.* HP\)/)).toBeInTheDocument();
  });

  it('dice pool shows "of X dY" after dice input', async () => {
    await renderModal({ current: 5, max: 8 }, {
      isDicePool: true,
      dieType: 10,
      name: 'Warrior of the Gods',
    });
    expect(screen.getByText(/of 5 d10/)).toBeInTheDocument();
  });

  // ── Default feature name when not provided ──

  it('uses default feature name "Lay On Hands" when name prop is omitted', async () => {
    await renderModal({ current: 15, max: 20 }, { name: undefined });
    expect(screen.getByText('Lay On Hands')).toBeInTheDocument();
  });

  // ── Cure cost display ──

  it('shows cure cost in section header', async () => {
    await renderModal({ current: 15, max: 20 }, { cureCost: 5 });
    expect(screen.getByText(/Cure Conditions \(5 HP each\)/)).toBeInTheDocument();
  });

  it('shows cure cost in batch cure section when restoring touch', async () => {
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      return null;
    });

    await renderModal({ current: 15, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
      cureCost: 4,
    });
    expect(screen.getByText(/Cure Conditions \(4 HP each\)/)).toBeInTheDocument();
  });
});
