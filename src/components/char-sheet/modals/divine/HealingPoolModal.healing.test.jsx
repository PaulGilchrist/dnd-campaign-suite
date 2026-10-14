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

let updateFn;

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

function getLogTableRows() {
  const table = screen.getByRole('table');
  const rows = table.querySelectorAll('tr');
  return Array.from(rows).slice(1);
}

// ── Tests ──

describe('HealingPoolModal - Healing', () => {
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

  // ── Apply heal with combat context (NPC target) ──

  it('applies healing to NPC target and updates pool', async () => {
    applyHealingService.applyHealingToTarget.mockReturnValue({
      actualHeal: 5,
      oldHp: 15,
      newHp: 20,
    });

    await renderModal({ current: 20, max: 20 });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    expect(applyHealingService.applyHealingToTarget).toHaveBeenCalledWith(
      mockCombatSummary,
      'Paladin1',
      5,
      mockCampaignName,
    );
    expect(updateFn).toHaveBeenCalledWith(15);
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
      'Paladin1',
      'currentHitPoints',
      expect.any(Number),
      mockCampaignName,
    );
    expect(updateFn).toHaveBeenCalledWith(15);
  });

  it('caps self-heal at target maximum HP', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    damageUtils.getTargetFromAttacker.mockReturnValue(null);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 38;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 20, max: 20 });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin1',
      'currentHitPoints',
      40,
      mockCampaignName,
    );
  });

  // ── Healing with insufficient pool ──

  it('does not apply healing when pool is zero', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    damageUtils.getTargetFromAttacker.mockReturnValue(null);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 0, max: 20 });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).toBeDisabled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  // ── Multiple sequential heals ──

  it('reduces pool after each successive heal', async () => {
    applyHealingService.applyHealingToTarget.mockReturnValue({
      actualHeal: 3,
      oldHp: 15,
      newHp: 18,
    });

    await renderModal({ current: 10, max: 20 });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));

    expect(updateFn).toHaveBeenNthCalledWith(1, 7);
    expect(updateFn).toHaveBeenNthCalledWith(2, 7);
  });

  it('accumulates multiple log entries for sequential heals', async () => {
    let callCounter = 0;
    applyHealingService.applyHealingToTarget.mockImplementation(() => {
      callCounter++;
      return { actualHeal: 3, oldHp: 15 + (callCounter - 1) * 3, newHp: 18 + (callCounter - 1) * 3 };
    });

    await renderModal({ current: 10, max: 20 });
    for (let i = 0; i < 3; i++) {
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: /Apply Heal/i }));
    }

    const rows = getLogTableRows();
    expect(rows).toHaveLength(3);
  });
});
