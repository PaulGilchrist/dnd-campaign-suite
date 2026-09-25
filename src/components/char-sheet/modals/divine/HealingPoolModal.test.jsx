// @improved-by-ai
// @cleaned-by-ai
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

function setupPoolMock(current = 15, max = 20) {
  const updateFn = vi.fn();
  useTrackedResource.mockReturnValue({ current, max, update: updateFn });
  return updateFn;
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
  return rendered;
}

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

  it('shows pool as 0 when tracked resource current is zero', async () => {
    await renderModal({ current: 0, max: 20 });
    const poolText = getPoolParagraph();
    expect(poolText).toBe('Pool: 0 / 20 HP');
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

  // ── Log section ──

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

  it('closes on Escape key press', async () => {
    const onClose = vi.fn();
    await renderModal({ current: 15, max: 20 }, { onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking the overlay background', async () => {
    const onClose = vi.fn();
    await renderModal({ current: 15, max: 20 }, { onClose });
    const overlay = document.querySelector('.short-rest-overlay');
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  // ── Default feature name ──

  it('uses default feature name "Lay On Hands" when name prop is omitted', async () => {
    await renderModal({ current: 15, max: 20 }, { name: undefined });
    expect(screen.getByText('Lay On Hands')).toBeInTheDocument();
  });

  // ── Creature target selection ──

  it.each([
    { label: 'one creatureTarget', creatureTargets: [{ name: 'Orc Warrior', maxHp: 30, currentHp: 15 }] },
    { label: 'empty creatureTargets array', creatureTargets: [] },
    { label: 'undefined creatureTargets', creatureTargets: undefined },
  ])('does not show target selection modal when $label', async ({ creatureTargets }) => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 40;
      if (key === 'activeConditions') return [];
      return null;
    });

    await renderModal({ current: 15, max: 20 }, { creatureTargets });

    expect(screen.queryByText(/Choose target for/i)).not.toBeInTheDocument();
  });

  it('shows target selection modal when multiple creatureTargets are provided', async () => {
    damageUtils.getCombatContext.mockResolvedValue(null);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'currentHitPoints') return 40;
      if (key === 'activeConditions') return [];
      return null;
    });

    const creatureTargets = [
      { name: 'Orc Warrior', maxHp: 30, currentHp: 15 },
      { name: 'Goblin', maxHp: 7, currentHp: 3 },
    ];
    await renderModal({ current: 15, max: 20 }, { creatureTargets });

    expect(screen.getByText(/Choose target for/i)).toBeInTheDocument();
    expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
    expect(screen.getByText('Goblin')).toBeInTheDocument();
  });
});
