// @maintained-by-ai
// Dialog-semantics pin for HealingPoolModal (backlog 2026-11-10 HD follow-on):
// every top-level shell borrows .short-rest-modal for a NON-rest flow, so each
// one now carries the ShortRestModal tier (bc409413d): role="dialog" +
// aria-modal="true" + aria-labelledby → its visible heading. This keeps a
// [role=dialog]-by-class probe honest on the .short-rest-modal lane. Button
// behavior is pinned unchanged (Done → onClose only, zero writes/log rows).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HealingPoolModal from './HealingPoolModal.jsx';

// Mock set mirrors HealingPoolModal.test.jsx (BASE lane) exactly.
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  addStorageChangeListener: vi.fn(() => () => {}),
}));

vi.mock('../../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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
  CONDITIONS: [{ key: 'blinded', label: 'Blinded' }],
}));

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import useTrackedResource from '../../../../hooks/runtime/useTrackedResource.js';
import * as logService from '../../../../services/ui/logService.js';

const basePlayerStats = { name: 'Paladin1', level: 3, hitPoints: 40, abilities: { CHA: 14 } };

function setupPool(current = 15, max = 20) {
  useTrackedResource.mockReturnValue({
    current: current,
    max: max,
    update: vi.fn(),
  });
}

function makeProps(overrides = {}) {
  return {
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
    alsoCures: ['Blinded'],
    cureCost: 3,
    onClose: vi.fn(),
    ...overrides,
  };
}

// Exactly one dialog root exists, it IS the borrowed .short-rest-modal shell,
// and its accessible name resolves via aria-labelledby → visible heading.
function expectDialogTier(nameMatcher) {
  const dialogs = document.querySelectorAll('[role="dialog"]');
  expect(dialogs).toHaveLength(1);
  const shell = dialogs[0];
  expect(shell.classList.contains('short-rest-modal')).toBe(true);
  expect(shell.getAttribute('aria-modal')).toBe('true');
  const labelledBy = shell.getAttribute('aria-labelledby');
  expect(labelledBy).toBeTruthy();
  const heading = document.getElementById(labelledBy);
  expect(heading).not.toBeNull();
  expect(shell.contains(heading)).toBe(true);
  expect(screen.getByRole('dialog', { name: nameMatcher })).toBe(shell);
  return shell;
}

describe('HealingPoolModal dialog semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    setupPool();
  });

  it('main surface: shell is the live [role="dialog"] labelled by the feature <h3>', async () => {
    render(<HealingPoolModal {...makeProps()} />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
    const shell = expectDialogTier(/Lay On Hands/);
    const heading = document.getElementById(shell.getAttribute('aria-labelledby'));
    expect(heading.tagName).toBe('H3');
  });

  it('target-picker surface: shell is the live [role="dialog"] labelled by the picker title', () => {
    render(
      <HealingPoolModal
        {...makeProps({
          creatureTargets: [
            { name: 'Paladin1', type: 'player', currentHp: 15, maxHp: 40 },
            { name: 'Orc Warrior', type: 'npc', currentHp: 15, maxHp: 30 },
          ],
        })}
      />
    );
    const shell = expectDialogTier(/Choose target for Lay On Hands/);
    const heading = document.getElementById(shell.getAttribute('aria-labelledby'));
    expect(heading.classList.contains('sp-header')).toBe(true);
    // Picker buttons behave: Skip self-targets and swaps to the main dialog.
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expectDialogTier(/Lay On Hands/);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('button behavior is unchanged by the semantics migration (Done → onClose, zero writes)', async () => {
    const onClose = vi.fn();
    render(<HealingPoolModal {...makeProps({ onClose })} />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});
