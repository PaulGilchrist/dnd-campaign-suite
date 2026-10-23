// @maintained-by-ai
// Celestial Resilience lane of ShortRestModal: when applyShortRest resolves with a
// celestialResilienceAllies grant (shape { creatureTargets, allyTempHp, selfTempHp,
// maxTargets } or null — restRules-shortRest.js:501), the modal opens an ally picker;
// confirm dispatches setTempHp per selected ally + ability_use log; skip logs and
// completes. Class/feature/level gating lives in restRules (covered in
// restRules-shortRest.test.js); this lane gates on the payload's truthiness only.
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

// Producer-faithful stub of the shared picker: checkbox rows toggle selection,
// the toggle clamps at maxTargets and rows disable at the cap (mirrors the real
// CreatureSelectionModal.jsx:50-58,88,101 so copy↔cap coupling is pinned here),
// confirm stays disabled until something is selected, onConfirm receives the
// selected NAMES array (CreatureSelectionModal.jsx:61-64,140).
vi.mock('./modals/shared/CreatureSelectionModal.jsx', async () => {
  const { useState } = await import('react');
  function CreatureSelectionModalStub({ title, description, note, confirmLabel, onConfirm, onSkip, targets, maxTargets }) {
    const [selected, setSelected] = useState([]);
    const toggle = (name) =>
      setSelected((prev) =>
        prev.includes(name)
          ? prev.filter((n) => n !== name)
          : !maxTargets || prev.length < maxTargets
            ? [...prev, name]
            : prev
      );
    return (
      <div data-testid="creature-selection-modal">
        <span data-testid="modal-title">{title}</span>
        <span data-testid="modal-description">{description}</span>
        <span data-testid="modal-note">{note}</span>
        <span data-testid="max-targets">{maxTargets}</span>
        {targets.map((target) => (
          <label key={target.name}>
            <input
              type="checkbox"
              checked={selected.includes(target.name)}
              disabled={!!maxTargets && selected.length >= maxTargets && !selected.includes(target.name)}
              onChange={() => toggle(target.name)}
            />
            {target.name}
          </label>
        ))}
        <button
          disabled={selected.length === 0}
          onClick={() => onConfirm(selected)}
        >
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

  it('opens the ally picker on completion with the grant copy and every target, staying closed before completion', async () => {
    renderModal();
    const { applyShortRest } = await import('../../services/rules/effects/restRules.js');

    expect(screen.queryByText('Celestial Resilience')).not.toBeInTheDocument();

    await completeShortRest(applyShortRest, { celestialResilienceAllies: celestialGrant() });

    expect(screen.getByTestId('modal-title')).toHaveTextContent('Celestial Resilience');
    // Coupling pin (fix#158 single-source law): the description number is the
    // SAME celestialResilienceModal.maxTargets the picker enforces — never a
    // retyped literal. Disk source: classes.json automation.maxAllies.
    expect(screen.getByTestId('modal-description')).toHaveTextContent('Choose up to 3 allies to gain temporary hit points from your Celestial Resilience.');
    expect(screen.getByTestId('modal-note')).toHaveTextContent('You gain 8 temporary hit points.');
    expect(screen.getByTestId('modal-note')).toHaveTextContent('Each selected ally gains 7 temporary hit points.');
    expect(screen.getByTestId('max-targets')).toHaveTextContent('3');
    // Every creatureTarget renders as a checkbox row, player and npc alike.
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'Ally1' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Ally2' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Ally3' })).toBeInTheDocument();
  });

  it.each([3, 5, 6])(
    'description interpolates maxTargets=%i from the grant, matching the picker cap it advertises',
    async (maxTargets) => {
      renderModal();
      const { applyShortRest } = await import('../../services/rules/effects/restRules.js');

      await completeShortRest(applyShortRest, { celestialResilienceAllies: celestialGrant({ maxTargets }) });

      expect(screen.getByTestId('modal-description')).toHaveTextContent(
        `Choose up to ${maxTargets} allies to gain temporary hit points from your Celestial Resilience.`
      );
      expect(screen.getByTestId('max-targets')).toHaveTextContent(String(maxTargets));
    }
  );

  it('cap-behavior pin: copy promises the cap and the picker enforces it — 4th selection at maxTargets=3 is blocked', async () => {
    renderModal();
    const { applyShortRest } = await import('../../services/rules/effects/restRules.js');

    const grant = celestialGrant({
      maxTargets: 3,
      creatureTargets: [
        { name: 'Ally1', type: 'player' },
        { name: 'Ally2', type: 'npc' },
        { name: 'Ally3', type: 'player' },
        { name: 'Ally4', type: 'player' },
      ],
    });
    await completeShortRest(applyShortRest, { celestialResilienceAllies: grant });

    // Copy advertises the same 3 the payload enforces.
    expect(screen.getByTestId('modal-description')).toHaveTextContent(/up to 3 allies/);

    // Fill to the cap, then the 4th row is disabled and inert.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ally1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ally2' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ally3' }));
    const fourth = screen.getByRole('checkbox', { name: 'Ally4' });
    expect(fourth).toBeDisabled();
    fireEvent.click(fourth);

    const confirmBtn = screen.getByRole('button', { name: /Grant Resilience/ });
    expect(confirmBtn).toHaveTextContent('Grant Resilience (3)');
    fireEvent.click(confirmBtn);
    await flush();

    expect(setTempHpMock).toHaveBeenCalledTimes(3);
    expect(setTempHpMock).not.toHaveBeenCalledWith('Ally4', 7, mockCampaignName);
  });

  it('grants temp HP to exactly the selected allies, logs the ability_use, and completes once', async () => {
    const { onComplete } = renderModal();
    const { applyShortRest } = await import('../../services/rules/effects/restRules.js');
    const { addEntry } = await import('../../services/ui/logService.js');

    await completeShortRest(applyShortRest, { celestialResilienceAllies: celestialGrant() });

    const confirmBtn = screen.getByRole('button', { name: /Grant Resilience/ });
    // Nothing selected: confirm is disabled and dispatches nothing.
    fireEvent.click(confirmBtn);
    await flush();
    expect(setTempHpMock).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ally1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ally3' }));
    fireEvent.click(confirmBtn);
    await flush();

    expect(setTempHpMock).toHaveBeenCalledTimes(2);
    expect(setTempHpMock).toHaveBeenCalledWith('Ally1', 7, mockCampaignName);
    expect(setTempHpMock).toHaveBeenCalledWith('Ally3', 7, mockCampaignName);
    expect(setTempHpMock).not.toHaveBeenCalledWith('Ally2', 7, mockCampaignName);

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'Thorin',
      abilityName: 'Celestial Resilience',
      description: expect.stringMatching(/grants 7 temporary hit points to Ally1, Ally3/),
    }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('skips the grant: zero temp HP, skip logged, completes once, picker closes', async () => {
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

  it('completes immediately without the picker when applyShortRest grants nothing', async () => {
    const { onComplete } = renderModal();
    const { applyShortRest } = await import('../../services/rules/effects/restRules.js');

    // Producer-faithful no-grant shape: restRules-shortRest.js returns null here.
    await completeShortRest(applyShortRest, { celestialResilienceAllies: null });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
    expect(setTempHpMock).not.toHaveBeenCalled();
  });

  it('still grants and logs without crashing when onComplete is omitted', async () => {
    render(
      <ShortRestModal
        playerStats={{
          name: 'Thorin',
          level: 5,
          hitPoints: 45,
          proficiency: 3,
          abilities: [{ name: 'Charisma', bonus: 3 }],
          class: { name: 'Warlock', major: { name: 'Celestial Patron' } },
          automation: { passives: [] },
          specialActions: [{ name: 'Celestial Resilience' }],
          spellAbilities: { spells: [] },
          inventory: { equipped: [] },
        }}
        campaignName={mockCampaignName}
        onClose={vi.fn()}
      />
    );
    const { applyShortRest } = await import('../../services/rules/effects/restRules.js');

    await completeShortRest(applyShortRest, { celestialResilienceAllies: celestialGrant() });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ally1' }));

    await expect(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Grant Resilience/ }));
      await flush();
    }).not.toThrow();

    expect(setTempHpMock).toHaveBeenCalledWith('Ally1', 7, mockCampaignName);
    expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
  });
});
