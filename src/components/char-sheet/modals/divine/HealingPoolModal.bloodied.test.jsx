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

// ── Test fixtures ──

const mockPlayerStats = {
  name: 'Paladin1',
  level: 3,
  hitPoints: 40,
  abilities: { CHA: 14 },
};
const mockCampaignName = 'test-campaign';

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
  render(<HealingPoolModal {...makeProps(overrides)} />);
  await waitFor(() => {
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });
  return { updateFn };
}

// ── Tests ──

describe('HealingPoolModal - Bloodied', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    setupPoolMock();
  });

  // ── Bloodied restriction badge ──

  it('shows bloodied restriction badge when bloodiedOnly is true', async () => {
    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    expect(screen.getByText(/Bloodied only/)).toBeTruthy();
  });

  it('does not show bloodied restriction badge when bloodiedOnly is false', async () => {
    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: false });
    expect(screen.queryByText(/Bloodied only/)).not.toBeInTheDocument();
  });

  // ── Apply heal button state with bloodiedOnly ──

  it.each([
    { targetHp: 15, maxHp: 30, label: 'bloodied target with bloodiedOnly true' },
  ])('enables apply heal when target is $label', async ({ targetHp, maxHp }) => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Orc Warrior', type: 'npc', maxHp, currentHp: targetHp },
      ],
    });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return targetHp;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).not.toBeDisabled();
  });

  it.each([
    { playerHp: 25, label: 'non-bloodied target with bloodiedOnly true' },
    { playerHp: 21, label: 'target just above half HP with bloodiedOnly true' },
  ])('disables apply heal when target is $label', async ({ playerHp }) => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 15 },
      ],
    });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return playerHp;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).toBeDisabled();
  });

  it('disables apply heal when bloodiedOnly is true and pool is zero', async () => {
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

    await renderModal({ current: 0, max: 20 }, { bloodiedOnly: true });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).toBeDisabled();
  });

  // ── Restriction note ──

  it('shows restriction note when target is not bloodied and bloodiedOnly is true', async () => {
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
    expect(screen.getByText(/This feature can only heal Bloodied creatures/)).toBeTruthy();
  });

  it('does not show restriction note when target is bloodied and bloodiedOnly is true', async () => {
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
    expect(screen.queryByText(/This feature can only heal Bloodied creatures/)).not.toBeInTheDocument();
  });

  // ── Boundary conditions for bloodied check ──

  it('treats target at exactly half HP as bloodied', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 15 },
      ],
    });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).not.toBeDisabled();
    expect(screen.queryByText(/This feature can only heal Bloodied creatures/)).not.toBeInTheDocument();
  });

  it('treats target at floor(maxHp/2) + 1 as not bloodied', async () => {
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Orc Warrior', type: 'npc', maxHp: 30, currentHp: 15 },
      ],
    });
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 21;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 15, max: 20 }, { bloodiedOnly: true });
    const btn = screen.getByRole('button', { name: /Apply Heal/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/This feature can only heal Bloodied creatures/)).toBeTruthy();
  });
});
