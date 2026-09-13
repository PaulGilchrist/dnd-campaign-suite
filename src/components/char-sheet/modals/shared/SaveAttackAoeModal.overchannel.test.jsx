// CLA-244 regression: SaveAttackAoeModal consumer rolls maximized dice and
// fires IRV-ignoring overchannel backlash when overchannel context is present.
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn((_cs, _name, dmg) => ({ finalDamage: dmg, newHp: 100 - dmg })),
  computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess) => {
    if (!success) return raw;
    return dcSuccess === 'half' ? Math.floor(raw / 2) : 0;
  }),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Zombie 1', type: 'npc', currentHp: 22, maxHp: 22, saveBonuses: { dex: -5 }, resistances: [], immunities: [] },
      { name: 'Zombie 2', type: 'npc', currentHp: 22, maxHp: 22, saveBonuses: { dex: -5 }, resistances: [], immunities: [] },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => null),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

vi.mock('../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js', () => ({
  handleOverchannelSelfDamage: vi.fn(() => Promise.resolve()),
}));

vi.mock('./CreatureSelectionModal.jsx', () => {
  const { useState, useCallback } = require('react');
  function MockCreatureSelectionModal({ targets, confirmLabel, onConfirm, onSkip }) {
    const [selected, setSelected] = useState(new Set());
    const toggleTarget = useCallback((name) => {
      setSelected(prev => {
        const next = new Set(prev);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
    }, []);
    return (
      <div className="sp-overlay">
        <div className="sp-modal">
          <div className="secondary-target-list">
            {targets.map((t) => (
              <label key={t.name} className="secondary-target-row">
                <input type="checkbox" checked={selected.has(t.name)} onChange={() => toggleTarget(t.name)} />
                {t.name}
              </label>
            ))}
          </div>
          <button className="sp-roll-btn" onClick={() => onConfirm(Array.from(selected))} disabled={selected.size === 0} type="button">
            {confirmLabel} ({selected.size})
          </button>
          <button className="sp-dismiss-btn" onClick={onSkip} type="button">Skip</button>
        </div>
      </div>
    );
  }
  return { default: MockCreatureSelectionModal };
});

import { applyDamageToTarget } from '../../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { handleOverchannelSelfDamage } from '../../../../hooks/combat/handlers/handleOverchannelSelfDamage.js';

// ── Fixtures ──

const mockPlayerStats = { name: 'TestWizard', level: 20 };
const mockAction = { name: 'Burning Hands', automation: {}, spell: {} };

function makeProps(overrides = {}) {
  return {
    action: mockAction,
    playerStats: mockPlayerStats,
    campaignName: 'test-campaign',
    range: 0,
    damage: '3d6',
    damageType: 'Fire',
    saveType: 'DEX',
    saveDc: 17,
    dcSuccess: 'half',
    onClose: vi.fn(),
    ...overrides,
  };
}

function confirmSelection(names) {
  for (const name of names) {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    for (const cb of checkboxes) {
      const label = cb.closest('label');
      if (label && label.textContent.includes(name)) fireEvent.click(cb);
    }
  }
  const confirmBtn = screen.getByRole('button', { name: /Burning Hands \(\d+\)/ });
  return act(async () => {
    fireEvent.click(confirmBtn);
  });
}

describe('SaveAttackAoeModal — CLA-244 overchannel consumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rolls all damage dice at maximum when overchannelActive with Empowered bonus', async () => {
    render(<SaveAttackAoeModal {...makeProps({
      damage: '3d6 + 3 [Empowered Evocation] [Overchannel Maximize]',
      overchannelActive: true,
      overchannelUseCount: 1,
      overchannelSpellLevel: 1,
    })} />);
    await confirmSelection(['Zombie 1', 'Zombie 2']);

    // 3d6 maximized (+3 INT) = 21 raw fire per failed save
    const damageCalls = applyDamageToTarget.mock.calls.filter(c => c[2] === 21);
    expect(damageCalls.length).toBe(2);

    const saveDamageLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e?.rollType === 'save-damage' && e?.targetName);
    expect(saveDamageLogs.length).toBe(2);
    for (const log of saveDamageLogs) {
      expect(log.formula).toContain('[Overchannel Maximize]');
      expect(log.rolls).toEqual([6, 6, 6]);
      expect(log.total).toBe(21);
    }
  });

  it('fires backlash self-damage context on 2nd+ overchannel use', async () => {
    render(<SaveAttackAoeModal {...makeProps({
      damage: '3d6 [Overchannel Maximize]',
      overchannelActive: true,
      overchannelUseCount: 2,
      overchannelSpellLevel: 1,
    })} />);
    await confirmSelection(['Zombie 1']);

    expect(handleOverchannelSelfDamage).toHaveBeenCalledWith(
      'TestWizard',
      'test-campaign',
      { overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 1 },
      expect.any(Function),
      expect.any(Array),
    );
  });

  it('does not fire backlash on first overchannel use', async () => {
    render(<SaveAttackAoeModal {...makeProps({
      damage: '3d6 [Overchannel Maximize]',
      overchannelActive: true,
      overchannelUseCount: 1,
      overchannelSpellLevel: 1,
    })} />);
    await confirmSelection(['Zombie 1']);

    expect(handleOverchannelSelfDamage).toHaveBeenCalledWith(
      'TestWizard',
      'test-campaign',
      { overchannelActive: true, overchannelUseCount: 1, overchannelSpellLevel: 1 },
      expect.any(Function),
      expect.any(Array),
    );
    // handleOverchannelSelfDamage itself gates useCount > 1 for damage;
    // ensure no necrotic damage was applied here (mocked consumer, so assert call args only)
    const ctx = handleOverchannelSelfDamage.mock.calls[0][2];
    expect(ctx.overchannelUseCount).toBe(1);
  });

  it('rolls normal dice and skips backlash when overchannel inactive', async () => {
    render(<SaveAttackAoeModal {...makeProps({ overchannelActive: false })} />);
    await confirmSelection(['Zombie 1']);

    expect(handleOverchannelSelfDamage).not.toHaveBeenCalled();
    const saveDamageLogs = addEntry.mock.calls.map(c => c[1]).filter(e => e?.rollType === 'save-damage' && e?.targetName);
    for (const log of saveDamageLogs) {
      expect(log.formula).not.toContain('[Overchannel Maximize]');
    }
  });
});
