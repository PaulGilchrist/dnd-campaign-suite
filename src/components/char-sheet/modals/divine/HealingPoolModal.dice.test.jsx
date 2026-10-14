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

// Mutable pool state tracked via getter so the component always reads the latest value
let currentVal = 15;
let maxVal = 20;
let updateFn;

function setupPoolMock(current = 15, max = 20) {
  currentVal = current;
  maxVal = max;
  updateFn = vi.fn((newVal) => {
    currentVal = newVal;
  });
  useTrackedResource.mockReturnValue({
    get current() { return currentVal; },
    get max() { return maxVal; },
    update: updateFn,
  });
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

// ── Tests ──

describe('HealingPoolModal - Dice Pool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    damageUtils.getCombatContext.mockResolvedValue(null);
    damageUtils.getTargetFromAttacker.mockReturnValue(null);
    useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeConditions') return [];
      if (key === 'currentHitPoints') return 40;
      return null;
    });
    setupPoolMock();
  });

  // ── Pool display ──

  it('displays pool as dice count and die type', async () => {
    await renderModal({ current: 3, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
      resourceKey: 'warriorofthegodsPool',
    });
    const poolSection = document.querySelector('.short-rest-section');
    const p = poolSection?.querySelector('p');
    expect(p?.textContent).toBe('Pool: 3 / 4 d12');
  });

  it('shows dice count and die type in heading', async () => {
    await renderModal({ current: 4, max: 8 }, {
      isDicePool: true,
      dieType: 8,
      name: 'Divine Fury',
    });
    expect(screen.getByText(/Roll Dice — .* \(.*\/.* HP\)/)).toBeInTheDocument();
  });

  it('uses dynamic feature name in heading', async () => {
    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });
    expect(screen.getByText('Warrior of the Gods')).toBeInTheDocument();
    expect(screen.queryByText('Lay On Hands')).not.toBeInTheDocument();
  });

  // ── Roll button state ──

  it('shows Roll a d12 button instead of Apply Heal', async () => {
    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });
    expect(screen.getByText(/Roll a d12/)).toBeInTheDocument();
    expect(screen.queryByText(/Apply Heal/)).not.toBeInTheDocument();
  });

  it('dice pool Roll a d12 button disabled when pool is zero', async () => {
    await renderModal({ current: 0, max: 4 }, {
      isDicePool: true,
      dieType: 12,
    });
    const btn = screen.getByRole('button', { name: /Roll a d12/i });
    expect(btn).toBeDisabled();
  });

  it('dice pool Roll a d12 button disabled when max dice per use reached', async () => {
    // CHA 3 => mod = 1 => effectiveMaxDicePerUse = 1 => disabled after 1 roll
    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      maxDicePerUse: 1,
      playerStats: { ...mockPlayerStats, abilities: { CHA: 3 } },
    });

    let btn = screen.getByRole('button', { name: /Roll a d12/i });
    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);
    btn = screen.getByRole('button', { name: /Roll a d12/i });
    expect(btn).toBeDisabled();
  });

  // ── Dice roll behavior ──

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

  it('dice pool deducts pool and shows updated remaining count', async () => {
    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    expect(screen.getByText(/Remaining: 3 dice/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    expect(screen.getByText(/Remaining: 2 dice/)).toBeInTheDocument();
  });

  it('dice pool shows individual roll values in accumulated total', async () => {
    let faceIndex = 0;
    const faceValues = [7];
    const originalRandom = Math.random;
    Math.random = () => {
      const targetFace = faceValues[faceIndex] ?? 1;
      faceIndex++;
      const dieType = 12;
      const ratio = (targetFace - 1) / (dieType - 1);
      return ratio + 0.001;
    };

    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    Math.random = originalRandom;

    expect(screen.getByText(/Rolled 1d12:/)).toBeInTheDocument();
  });

  it('dice pool displays accumulated total with correct sum and roll format', async () => {
    let faceIndex = 0;
    const faceValues = [3, 5];
    const originalRandom = Math.random;
    Math.random = () => {
      const targetFace = faceValues[faceIndex] ?? 1;
      faceIndex++;
      const dieType = 12;
      const ratio = (targetFace - 1) / (dieType - 1);
      return ratio + 0.001;
    };

    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    Math.random = originalRandom;

    expect(screen.getByText(/3 \+ 5/)).toBeInTheDocument();
    const totalSpan = document.querySelector('.healing-total');
    expect(totalSpan?.textContent).toContain('8');
  });

  // ── Max dice per use ──

  it('enables roll button again when max dice per use not reached', async () => {
    // CHA 14 => mod = 6 => effectiveMaxDicePerUse = 6 => not disabled after 1 roll
    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      maxDicePerUse: 1,
    });

    // Roll once — should still be enabled (cap is 6)
    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    const btn = screen.getByRole('button', { name: /Roll a d12/i });
    expect(btn).not.toBeDisabled();
  });

  // ── Done button behavior ──

  it('dice pool applies self-heal on Done button when rolls accumulated', async () => {
    let faceIndex = 0;
    const faceValues = [5];
    const originalRandom = Math.random;
    Math.random = () => {
      const targetFace = faceValues[faceIndex] ?? 1;
      faceIndex++;
      const dieType = 12;
      const ratio = (targetFace - 1) / (dieType - 1);
      return ratio + 0.001;
    };

    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    Math.random = originalRandom;

    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin1',
      'currentHitPoints',
      expect.any(Number),
      'test-campaign',
    );
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

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Paladin1',
      'currentHitPoints',
      expect.any(Number),
      'test-campaign',
    );
  });

  it('dice pool resets accumulated total after Done', async () => {
    let faceIndex = 0;
    const faceValues = [7];
    const originalRandom = Math.random;
    Math.random = () => {
      const targetFace = faceValues[faceIndex] ?? 1;
      faceIndex++;
      const dieType = 12;
      const ratio = (targetFace - 1) / (dieType - 1);
      return ratio + 0.001;
    };

    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });

    fireEvent.click(screen.getByRole('button', { name: /Roll a d12/i }));
    Math.random = originalRandom;

    // Verify the roll result is displayed
    const totalSpan = document.querySelector('.healing-total');
    expect(totalSpan?.textContent).toContain('7');

    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    // After done, the accumulated total should be cleared
    expect(screen.queryByText(/HP to restore/)).not.toBeInTheDocument();
  });

  it('dice pool does not apply healing on Done when pool is zero', async () => {
    await renderModal({ current: 0, max: 4 }, {
      isDicePool: true,
      dieType: 12,
      name: 'Warrior of the Gods',
    });

    // Can't roll because pool is 0, so no accumulated total
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      'Paladin1',
      'currentHitPoints',
      expect.any(Number),
      'test-campaign',
    );
  });

  // ── Different die types ──

  it('roll button text and display reflect the configured die type', async () => {
    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 8,
      name: 'Test Feature',
    });
    expect(screen.getByRole('button', { name: /Roll a d8/i })).toBeInTheDocument();
  });

  it('roll display reflects a different die type', async () => {
    let faceIndex = 0;
    const faceValues = [4];
    const originalRandom = Math.random;
    Math.random = () => {
      const targetFace = faceValues[faceIndex] ?? 1;
      faceIndex++;
      const dieType = 6;
      const ratio = (targetFace - 1) / (dieType - 1);
      return ratio + 0.001;
    };

    await renderModal({ current: 4, max: 4 }, {
      isDicePool: true,
      dieType: 6,
      name: 'Test Feature',
    });

    fireEvent.click(screen.getByRole('button', { name: /Roll a d6/i }));
    Math.random = originalRandom;

    expect(screen.getByText(/Rolled 1d6:/)).toBeInTheDocument();
  });
});
