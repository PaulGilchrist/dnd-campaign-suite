// @maintained-by-ai 2026-11-28
// Celestial Resilience lane of ShortRestModal: when applyShortRest resolves with a
// celestialResilienceAllies grant (shape { creatureTargets, allyTempHp, selfTempHp,
// maxTargets } or null), the modal opens an ally picker; confirm dispatches setTempHp
// per selected ally + ability_use log; skip logs and completes. Class/feature/level
// gating lives in restRules (covered in restRules-shortRest.test.js); this lane gates
// on the payload's truthiness only. Self temp HP is granted by the PRODUCER
// (restRules-shortRest.js setTempHp inside applyShortRest), never here — pinned so a
// UI-side re-grant can't double it. Picker-internal cap enforcement and the
// confirm-disabled-until-selection contract are tested against the REAL
// CreatureSelectionModal in modals/shared/CreatureSelectionModal.test.jsx and
// modals/CelestialResilienceModal.test.jsx — the stub here only surfaces the props
// ShortRestModal passes. The no-grant completion path is owned by the base lane
// (ShortRestModal.test.jsx, whose default mock returns a falsy grant).
// No timers: flow advances only on explicit user clicks.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ShortRestModal from './ShortRestModal.jsx';

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();
const setRuntimeBatchMock = vi.fn();
const setTempHpMock = vi.fn();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (...args) => getRuntimeValueMock(...args),
  setRuntimeValue: (...args) => setRuntimeValueMock(...args),
  setRuntimeBatch: (...args) => setRuntimeBatchMock(...args),
  useRuntimeValue: () => null,
}));

// Deterministic stand-ins (no real dice): each d8 rolls a 4.
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollDice: vi.fn((count, _die) => ({ total: count * 4, rolls: Array(count).fill(4) })),
}));

// REAL static-data producer for labels (restRules-constants.js passthrough).
vi.mock('../../services/rules/effects/restRules.js', async () => {
  const constants = await import('../../services/rules/effects/restRules-constants.js');
  return {
    getHitDieSize: vi.fn(() => 8),
    computeHitDieRecovery: vi.fn((roll, conBonus) => roll + conBonus),
    getShortRestResourceLabels: vi.fn((playerStats) => constants.getShortRestResourceLabels(playerStats)),
    applyShortRest: vi.fn(async () => ({ celestialResilienceAllies: null })),
  };
});

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({})),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(() => 2),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(() => null),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadSpellData: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: (...args) => setTempHpMock(...args),
}));

// Minimal producer-faithful stub: checkbox rows toggle selection, confirm receives
// the selected NAMES array (the real CreatureSelectionModal contract). Cap
// enforcement deliberately NOT mirrored — ShortRestModal only has to pass maxTargets
// through (pinned via the max-targets testid); enforcement is proven against the
// real component in its own lane.
vi.mock('./modals/shared/CreatureSelectionModal.jsx', async () => {
  const { useState } = await import('react');
  function CreatureSelectionModalStub({ title, description, note, confirmLabel, icon, confirmIcon, onConfirm, onSkip, targets, maxTargets }) {
    const [selected, setSelected] = useState([]);
    const toggle = (name) =>
      setSelected((prev) =>
        prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
      );
    return (
      <div data-testid="creature-selection-modal">
        {icon && <i data-testid="modal-icon" className={`fa-solid ${icon}`} />}
        <span data-testid="modal-title">{title}</span>
        <span data-testid="modal-description">{description}</span>
        <span data-testid="modal-note">{note}</span>
        <span data-testid="max-targets">{maxTargets}</span>
        {targets.map((target) => (
          <label key={target.name}>
            <input
              type="checkbox"
              checked={selected.includes(target.name)}
              onChange={() => toggle(target.name)}
            />
            {target.name}
          </label>
        ))}
        <button onClick={() => onConfirm(selected)}>
          {confirmIcon && <i data-testid="confirm-icon" className={`fa-solid ${confirmIcon}`} />}
          {confirmLabel || 'Confirm'} ({selected.length})
        </button>
        {onSkip && <button onClick={onSkip}>Skip</button>}
      </div>
    );
  }
  return { default: CreatureSelectionModalStub };
});

const mockCampaignName = 'test-campaign';

function celestialGrant(overrides = {}) {
  return {
    creatureTargets: [
      { name: 'Ally1', type: 'player' },
      { name: 'Ally2', type: 'npc' },
      { name: 'Ally3', type: 'player' },
    ],
    allyTempHp: 7,
    selfTempHp: 8,
    maxTargets: 3,
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  const playerStats = {
    name: 'Thorin',
    level: 5,
    hitPoints: 45,
    proficiency: 3,
    abilities: [
      { name: 'Constitution', bonus: 2 },
      { name: 'Charisma', bonus: 3 },
    ],
    class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
    automation: { passives: [] },
    specialActions: [{ name: 'Celestial Resilience' }],
    spellAbilities: { spells: [] },
    inventory: { equipped: [] },
    ...overrides,
  };
  const onClose = vi.fn();
  const onComplete = vi.fn();
  const rendered = render(
    <ShortRestModal
      playerStats={playerStats}
      campaignName={mockCampaignName}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
  return { ...rendered, onClose, onComplete, playerStats };
}

async function completeShortRest(applyShortRest, grant) {
  vi.mocked(applyShortRest).mockResolvedValueOnce(grant);
  fireEvent.click(screen.getByText('Complete Short Rest'));
  await act(async () => {});
}

async function flush() {
  await act(async () => {});
}

describe('ShortRestModal - Celestial Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValueMock.mockReturnValue(null);
  });

  it('opens the ally picker on completion with every copy face, cap, target row and icon sourced from the grant payload', async () => {
    renderModal();
    const { applyShortRest } = await import('../../services/rules/effects/restRules.js');

    expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();

    // maxTargets 4 differs from the fixture default (3), the target count (3), and
    // every other number in the payload — so each rendered "4" is interpolated from
    // celestialResilienceModal.maxTargets, never a retyped literal (fix#158
    // single-source law; disk source: classes.json automation.maxAllies). self(8)
    // ≠ ally(7) amounts pin the note template against a swap.
    await completeShortRest(applyShortRest, { celestialResilienceAllies: celestialGrant({ maxTargets: 4 }) });

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Celestial Resilience');
    expect(screen.getByTestId('modal-description')).toHaveTextContent('Choose up to 4 allies to gain temporary hit points from your Celestial Resilience.');
    expect(screen.getByTestId('modal-note')).toHaveTextContent('You gain 8 temporary hit points.');
    expect(screen.getByTestId('modal-note')).toHaveTextContent('Each selected ally gains 7 temporary hit points.');
    expect(screen.getByTestId('max-targets')).toHaveTextContent('4');
    // Every creatureTarget renders as a checkbox row, player and npc alike.
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'Ally1' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Ally2' })).toBeInTheDocument();

    // Typo regression pin (bug-shortrest-celestial-icon-typo): Font Awesome has no
    // `fa-shield-hart` glyph (content:none → dead icon).
    expect(screen.getByTestId('modal-icon')).toHaveClass('fa-shield-heart');
    expect(screen.getByTestId('confirm-icon')).toHaveClass('fa-shield-heart');
    expect(document.querySelector('.fa-shield-hart')).toBeNull();
  });

  it('grants temp HP to exactly the selected allies, logs the ability_use, closes the picker, and completes once', async () => {
    const { onComplete } = renderModal();
    const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    await completeShortRest(applyShortRest, { celestialResilienceAllies: celestialGrant() });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ally1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ally3' }));
    fireEvent.click(screen.getByRole('button', { name: /Grant Resilience/ }));
    await flush();

    expect(setTempHpMock).toHaveBeenCalledTimes(2);
    expect(setTempHpMock).toHaveBeenCalledWith('Ally1', 7, mockCampaignName);
    expect(setTempHpMock).toHaveBeenCalledWith('Ally3', 7, mockCampaignName);
    // Unselected ally gets nothing, and SELF gets nothing here — the producer
    // applies selfTempHp inside applyShortRest, so a UI-side re-grant would double it.
    expect(setTempHpMock).not.toHaveBeenCalledWith('Ally2', 7, mockCampaignName);
    expect(setTempHpMock).not.toHaveBeenCalledWith('Thorin', 8, mockCampaignName);

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'Thorin',
      abilityName: 'Celestial Resilience',
      description: expect.stringMatching(/grants 7 temporary hit points to Ally1, Ally3/),
    }));
    expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('skips the grant: zero temp HP, skip logged, picker closes, completes once', async () => {
    const { onComplete } = renderModal();
    const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    await completeShortRest(applyShortRest, { celestialResilienceAllies: celestialGrant() });

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await flush();

    expect(setTempHpMock).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
      type: 'ability_use',
      abilityName: 'Celestial Resilience',
      description: expect.stringContaining('skipped'),
    }));
    expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
  });

  // 🐛 HONEST PIN of broken behavior (reported to orchestrator): handleComplete
  // early-returns when the grant is truthy, and confirm/skip only dispatch the ally
  // grant + onComplete — the commit block below the branch (currentHitPoints write,
  // shortRestHitDice write, short_rest log) never runs. A Celestial Patron's staged
  // hit-dice recovery is silently dropped. Flip this pin when the source is fixed.
  it('picker branch commits the ally grant but drops the rest own commit: staged hit dice, HP write, dice write, and short_rest log all lost', async () => {
    const { onComplete } = renderModal();
    const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    // Stage one d8 (rolls 4 + CON 2) before completing.
    fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));

    await completeShortRest(applyShortRest, { celestialResilienceAllies: celestialGrant() });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ally1' }));
    fireEvent.click(screen.getByRole('button', { name: /Grant Resilience/ }));
    await flush();

    // The ally grant itself flows...
    expect(setTempHpMock).toHaveBeenCalledWith('Ally1', 7, mockCampaignName);
    expect(onComplete).toHaveBeenCalledTimes(1);

    // ...yet the no-grant path commit block never executes.
    const writtenKeys = setRuntimeValueMock.mock.calls.map((c) => c[1]);
    expect(writtenKeys).not.toContain('currentHitPoints');
    expect(writtenKeys).not.toContain('shortRestHitDice');
    const loggedTypes = vi.mocked(addEntry).mock.calls.map((c) => c[1]?.type);
    expect(loggedTypes).not.toContain('short_rest');
  });
});
