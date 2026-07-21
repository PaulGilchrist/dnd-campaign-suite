// @cleaned-by-ai
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

  it('hides loading spinner after combat context resolves', async () => {
    await renderModal({ current: 15, max: 20 });
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });

  // ── Pool display ──

  it('displays pool amount and maximum after loading', async () => {
    await renderModal({ current: 15, max: 20 });
    const poolText = getPoolParagraph();
    expect(poolText).toBe('Pool: 15 / 20 HP');
  });

  it('shows pool text with HP suffix for non-dice pool', async () => {
    await renderModal({ current: 10, max: 15 });
    const poolText = getPoolParagraph();
    expect(poolText).toContain('HP');
    expect(poolText).not.toContain('d');
  });

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

  // ── Target display ──

  it('shows target name with current and max HP', async () => {
    damageUtils.getCombatContext.mockResolvedValue(mockCombatSummary);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 15;
      if (key === 'hitPoints') return 40;
      if (key === 'activeConditions') return [];
      return null;
    });
    await renderModal({ current: 15, max: 20 });
    expect(screen.getByText(/Heal — Paladin1 \(15 \/ 40 HP\)/)).toBeInTheDocument();
  });

  it('uses player stats as fallback when no target found', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 30;
      if (key === 'activeConditions') return [];
      return null;
    });
    await renderModal({ current: 15, max: 20 });
    expect(screen.getByText(/Heal — Paladin1 \(30 \/ 40 HP\)/)).toBeInTheDocument();
  });

  it('uses playerStats.hitPoints when currentHitPoints runtime value is missing', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
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

  it('caps heal amount to remaining pool in the input display', async () => {
    await renderModal({ current: 3, max: 20 });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });
    expect(input.value).toBe('3');
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

  // ── Apply heal with combat context (NPC target) ──

  it('applies healing when apply heal is clicked', async () => {
    applyHealingService.applyHealingToTarget.mockReturnValue({
      actualHeal: 5,
      oldHp: 15,
      newHp: 20,
    });
    damageUtils.getCombatContext.mockResolvedValue(mockCombatSummary);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 15;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 20, max: 20 });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledWith(
      mockCombatSummary,
      'Paladin1',
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
    damageUtils.getCombatContext.mockResolvedValue(mockCombatSummary);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 15;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 20, max: 20 });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    const rows = getLogTableRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Heal');
    expect(rows[0]).toHaveTextContent('Paladin1');
    expect(rows[0]).toHaveTextContent('5');
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
    damageUtils.getCombatContext.mockResolvedValue(mockCombatSummary);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      if (key === 'currentHitPoints') return 15;
      return null;
    });

    await renderModal({ current: 10, max: 20 });
    fireEvent.click(screen.getByRole('button', { name: /Blinded/i }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin1',
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
    damageUtils.getCombatContext.mockResolvedValue(mockCombatSummary);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      if (key === 'currentHitPoints') return 15;
      return null;
    });
    await renderModal({ current: 10, max: 20 });

    fireEvent.click(screen.getByRole('button', { name: /Blinded/i }));

    const rows = getLogTableRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent(/Cure/);
    expect(rows[0]).toHaveTextContent('Paladin1');
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

  it('does not render individual cure buttons when alsoCures is empty or null', async () => {
    await renderModal({ current: 15, max: 20 }, { alsoCures: [] });
    expect(screen.queryByText(/Cure Conditions/)).not.toBeInTheDocument();
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
    damageUtils.getCombatContext.mockResolvedValue(mockCombatSummary);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return ['blinded'];
      if (key === 'currentHitPoints') return 15;
      return null;
    });

    await renderModal({ current: 20, max: 20 }, {
      restoringTouchConditions: ['Blinded'],
      alsoCures: [],
    });
    fireEvent.click(screen.getByText(/Blinded/));
    fireEvent.click(screen.getByRole('button', { name: /Cure Selected/i }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin1',
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

  it('does not render batch cure section when restoringTouchConditions is empty or null', async () => {
    await renderModal({ current: 15, max: 20 }, { restoringTouchConditions: null, alsoCures: [] });
    expect(screen.queryByText(/Select conditions affecting/)).not.toBeInTheDocument();
  });

  // ── Log section ──

  it('does not render log section when no actions taken', async () => {
    await renderModal({ current: 15, max: 20 });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

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

  // ── Modal close interactions ──

  it('calls onClose when Done button is clicked', async () => {
    const onClose = vi.fn();
    await renderModal({ current: 15, max: 20 }, { onClose });
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press', async () => {
    const onClose = vi.fn();
    await renderModal({ current: 15, max: 20 }, { onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking the overlay background', async () => {
    const onClose = vi.fn();
    await renderModal({ current: 15, max: 20 }, { onClose });
    const overlay = document.querySelector('.short-rest-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Bloodied-only mode ──

  it('shows bloodied restriction badge when bloodiedOnly is true', async () => {
    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    expect(screen.getByText(/Bloodied only/)).toBeInTheDocument();
  });

  it('disables apply heal when target is not bloodied and bloodiedOnly is true', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 25 },
      ],
    });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 25;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).toBeDisabled();
  });

  it('enables apply heal when target is bloodied and bloodiedOnly is true', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 15 },
      ],
    });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 15;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).not.toBeDisabled();
  });

  it('shows restriction note when target is not bloodied', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 25 },
      ],
    });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 25;
      if (key === 'activeConditions') return [];
      return null;
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

  it('dice pool shows Roll a d12 button instead of Apply Heal', async () => {
    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });
    expect(screen.getByText(/Roll a d12/)).toBeInTheDocument();
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

  it('dice pool Roll a d12 button disabled when pool is zero', async () => {
    await renderModal({ current: 0, max: 4 }, {
      isDicePool: true,
      dieType: 12,
    });
    const btn = screen.getByRole('button', { name: /Roll a d12/i });
    expect(btn).toBeDisabled();
  });

  it('dice pool shows roll result after clicking Roll button', async () => {
    await renderModal({ current: 3, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });
    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));

    expect(screen.getByText(/HP to restore/)).toBeInTheDocument();
  });

  it('dice pool accumulates total across multiple rolls', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // yields roll ~6-7

    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));

    const totalText = screen.getByText(/HP to restore/);
    expect(totalText).toBeInTheDocument();
  });

  it('dice pool applies self-heal on Done button when rolls accumulated', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

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

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Paladin1', 'currentHitPoints', expect.any(Number), 'test-campaign');
    const logCalls = global.fetch.mock.calls.filter(
      (call) => call[0] === '/api/campaigns/test-campaign/log',
    );
    expect(logCalls.length).toBeGreaterThan(0);
  });

  it('dice pool applies no healing on Done when no rolls made', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith('Paladin1', 'currentHitPoints', expect.any(Number), 'test-campaign');
  });

  it('dice pool deducts pool on each roll', async () => {
    await renderModal({ current: 3, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    expect(updateFn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    expect(updateFn).toHaveBeenCalledTimes(2);
  });

  it('dice pool shows remaining dice count after rolling', async () => {
    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    expect(screen.getByText(/Remaining:.*dice/)).toBeInTheDocument();
  });

  it('dice pool shows dice count and die type in heading', async () => {
    await renderModal({ current: 4, max: 8 }, {
      isDicePool: true,
      dieType: 8,
      name: 'Divine Fury',
    });
    expect(screen.getByText(/Roll Dice — .* \(.*\/.* HP\)/)).toBeInTheDocument();
  });

  it('dice pool shows individual roll values in accumulated total', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25);

    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));

    expect(screen.getByText(/Rolled 1d12:/)).toBeInTheDocument();
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
