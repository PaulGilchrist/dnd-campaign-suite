// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CharActionSpellPopups from './CharActionSpellPopups.jsx';

vi.mock('../common/popup.jsx', () => ({
  default: function TestPopup({ children }) {
    return <div data-testid="popup">{children}</div>;
  },
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: function TestMetamagicPopup() {
    return <div data-testid="metamagic-popup" />;
  },
}));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestCreatureSelectionModal() {
    return <div data-testid="creature-selection-modal" />;
  },
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestSecondaryTargetModal({ title, targets, onTargetSelected, onSkip, description, confirmLabel, hideConfirm }) {
    return (
      <div data-testid={`secondary-modal-${title}`}>
        <span data-testid="title">{title}</span>
        <span data-testid="description">{description}</span>
        <span data-testid="confirm-label">{confirmLabel}</span>
        {targets?.map((t, i) => {
          const targetName = t.value !== undefined ? t.label : t.name;
          return (
            <label key={i} data-testid={`target-${i}`} onClick={() => onTargetSelected(t.value !== undefined ? t.value : t.name)}>
              <span data-testid={`target-name-${i}`}>{targetName}</span>
            </label>
          );
        })}
        {!hideConfirm || targets?.length > 0 ? (
          <button data-testid="confirm" onClick={() => targets?.length > 0 && onTargetSelected(targets[0].value !== undefined ? targets[0].value : targets[0].name)}>Confirm</button>
        ) : null}
        <button data-testid="skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: function TestSpellDetailPopup() {
    return <div data-testid="spell-detail-popup" />;
  },
}));

vi.mock('./popups/MagicMissileTargetPopup.jsx', () => ({
  default: function TestMagicMissileTargetPopup() {
    return <div data-testid="magic-missile-popup" />;
  },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

const runtimeStore = new Map();

function buildRuntimeKey(key, prop) {
  return `${key}:${prop}`;
}

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((key, prop) => {
    return runtimeStore.get(buildRuntimeKey(key, prop)) ?? null;
  }),
  setRuntimeValue: vi.fn((key, prop, value) => {
    runtimeStore.set(buildRuntimeKey(key, prop), value);
  }),
  getStore: () => {
    const store = new Map();
    for (const [key, value] of runtimeStore) {
      const [k, p] = key.split(':');
      if (!store.has(k)) store.set(k, new Map());
      store.get(k).set(p, value);
    }
    return store;
  },
  clearRuntimeState: vi.fn((key) => {
    for (const storeKey of runtimeStore.keys()) {
      if (storeKey.startsWith(`${key}:`)) runtimeStore.delete(storeKey);
    }
  }),
}));

function createBaseProps(overrides) {
  return {
    playerStats: { name: 'Test Character', level: 5 },
    campaignName: 'test-campaign',
    selectedActionSpell: null,
    setSelectedActionSpell: vi.fn(),
    buildUpcastLevels: vi.fn(() => []),
    handleActionSpellCast: vi.fn(),
    actionPendingMetamagic: null,
    actionHandleConfirm: vi.fn(),
    actionHandleSkip: vi.fn(),
    actionPendingAid: null,
    actionHandleAidConfirm: vi.fn(),
    actionHandleAidSkip: vi.fn(),
    actionPendingBane: null,
    actionHandleBaneConfirm: vi.fn(),
    actionHandleBaneSkip: vi.fn(),
    actionPendingBless: null,
    actionHandleBlessConfirm: vi.fn(),
    actionHandleBlessSkip: vi.fn(),
    actionPendingFaerieFire: null,
    actionHandleFaerieFireConfirm: vi.fn(),
    actionHandleFaerieFireSkip: vi.fn(),
    actionPendingBeaconOfHope: null,
    actionHandleBeaconOfHopeConfirm: vi.fn(),
    actionHandleBeaconOfHopeSkip: vi.fn(),
    actionPendingPassWithoutTrace: null,
    actionHandlePassWithoutTraceConfirm: vi.fn(),
    actionHandlePassWithoutTraceSkip: vi.fn(),
    actionPendingHaste: null,
    actionHandleHasteConfirm: vi.fn(),
    actionHandleHasteSkip: vi.fn(),
    actionPendingBarkskin: null,
    actionHandleBarkskinConfirm: vi.fn(),
    actionHandleBarkskinSkip: vi.fn(),
    actionPendingHeal: null,
    actionHandleHealConfirm: vi.fn(),
    actionHandleHealSkip: vi.fn(),
    actionPendingGreaterRestoration: null,
    actionHandleGreaterRestorationConfirm: vi.fn(),
    actionHandleGreaterRestorationSkip: vi.fn(),
    actionHandleGreaterRestorationNoEffects: vi.fn(),
    actionPendingRemoveCurse: null,
    actionHandleRemoveCurseConfirm: vi.fn(),
    actionHandleRemoveCurseSkip: vi.fn(),
    actionPendingMagicMissile: null,
    actionHandleMagicMissileConfirm: vi.fn(),
    actionHandleMagicMissileSkip: vi.fn(),
    actionPendingMageArmor: null,
    actionHandleMageArmorConfirm: vi.fn(),
    actionHandleMageArmorSkip: vi.fn(),
    actionPendingCureWounds: null,
    actionHandleCureWoundsConfirm: vi.fn(),
    actionHandleCureWoundsSkip: vi.fn(),
    actionPendingRevivify: null,
    actionHandleRevivifyConfirm: vi.fn(),
    actionHandleRevivifySkip: vi.fn(),
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    ...overrides,
  };
}

// Seed a target's effect-state in the runtime store; every slot defaults to
// "nothing removable" so each test only states what differs.
function setTargetState(targetName, state = {}) {
  runtimeStore.set(buildRuntimeKey(targetName, 'activeConditions'), state.activeConditions ?? []);
  runtimeStore.set(buildRuntimeKey(targetName, 'exhaustionLevel'), state.exhaustionLevel ?? 0);
  runtimeStore.set(buildRuntimeKey(targetName, 'activeBuffs'), state.activeBuffs ?? []);
  runtimeStore.set(buildRuntimeKey(targetName, 'abilityReductions'), state.abilityReductions ?? {});
  runtimeStore.set(buildRuntimeKey(targetName, 'hpMaxReduction'), state.hpMaxReduction ?? 0);
}

function pendingGR(overrides) {
  return { creatureTargets: ['Ally1'], range: 'Touch', ...overrides };
}

// Render with a pending Greater Restoration cast and advance from the target
// step to the effect step by clicking the first creature target.
async function openEffectStep(props) {
  render(<CharActionSpellPopups {...createBaseProps(props)} />);
  screen.getByTestId('target-0').click();
}

describe('CharActionSpellPopups - Greater Restoration 2-Step Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeStore.clear();
  });

  it('opens the target step with spell metadata, and Skip cancels the cast', () => {
    const skip = vi.fn();
    const confirm = vi.fn();
    render(
      <CharActionSpellPopups
        {...createBaseProps({
          actionPendingGreaterRestoration: pendingGR({ creatureTargets: ['Ally1', 'Ally2'] }),
          actionHandleGreaterRestorationSkip: skip,
          actionHandleGreaterRestorationConfirm: confirm,
        })}
      />
    );
    expect(screen.getByTestId('title')).toHaveTextContent('Greater Restoration');
    expect(screen.getByTestId('description')).toHaveTextContent('Touch');
    expect(screen.getByTestId('confirm-label')).toHaveTextContent('Cast Greater Restoration');
    expect(screen.getByTestId('target-name-0')).toHaveTextContent('Ally1');
    expect(screen.getByTestId('target-name-1')).toHaveTextContent('Ally2');

    screen.getByTestId('skip').click();
    expect(skip).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('advances to the effect step offering only Greater Restoration-removable conditions', async () => {
    setTargetState('Ally1', { activeConditions: ['charmed', 'petrified', 'frightened', 'poisoned', 'blinded'] });
    await openEffectStep({
      actionPendingGreaterRestoration: pendingGR(),
    });

    await waitFor(() => {
      expect(screen.getByText('Charmed condition')).toBeInTheDocument();
      expect(screen.getByText('Petrified condition')).toBeInTheDocument();
    });
    expect(screen.queryByText('Frightened condition')).not.toBeInTheDocument();
    expect(screen.queryByText('Poisoned condition')).not.toBeInTheDocument();
    expect(screen.queryByText('Blinded condition')).not.toBeInTheDocument();
    expect(screen.getByTestId('description')).toHaveTextContent('Ally1');
    expect(screen.getByTestId('confirm-label')).toHaveTextContent('Remove Effect');
  });

  const effectCases = [
    { name: 'condition', state: { activeConditions: ['charmed'] }, text: 'Charmed condition', selection: { type: 'condition', condition: 'charmed' } },
    { name: 'exhaustion', state: { exhaustionLevel: 2 }, text: 'Exhaustion level (current: 2)', selection: { type: 'exhaustion' } },
    { name: 'curse', state: { activeBuffs: [{ type: 'cursed' }] }, text: 'Curse (including attunement to cursed magic item)', selection: { type: 'curse' } },
    { name: 'ability_reduction', state: { abilityReductions: { STR: -2 } }, text: 'Ability score reduction', selection: { type: 'ability_reduction' } },
    { name: 'hp_max_reduction', state: { hpMaxReduction: 10 }, text: 'Hit Point maximum reduction', selection: { type: 'hp_max_reduction' } },
  ];

  it.each(effectCases)('detects $name, confirms it with the right selection payload, and returns to the target step', async ({ state, text, selection }) => {
    const confirm = vi.fn();
    const skip = vi.fn();
    setTargetState('Ally1', state);
    await openEffectStep({
      actionPendingGreaterRestoration: pendingGR(),
      actionHandleGreaterRestorationConfirm: confirm,
      actionHandleGreaterRestorationSkip: skip,
    });

    await waitFor(() => {
      expect(screen.getByText(text)).toBeInTheDocument();
    });
    screen.getByText(text).click();
    expect(confirm).toHaveBeenCalledWith({ targetName: 'Ally1', selections: [selection] });
    expect(skip).not.toHaveBeenCalled();
    // Back at step 1: the first list entry is the creature again, not an effect label.
    await waitFor(() => {
      expect(screen.getByTestId('target-name-0')).toHaveTextContent('Ally1');
    });
  });

  it('shows the no-effects message with confirm hidden and routes dismissal to the no-effects handler', async () => {
    const noEffects = vi.fn();
    const confirm = vi.fn();
    const skip = vi.fn();
    // Nothing removable: unsupported condition, non-curse buff, zero counters.
    setTargetState('Ally1', { activeConditions: ['frightened'], activeBuffs: [{ type: 'blessing' }] });
    await openEffectStep({
      actionPendingGreaterRestoration: pendingGR(),
      actionHandleGreaterRestorationNoEffects: noEffects,
      actionHandleGreaterRestorationConfirm: confirm,
      actionHandleGreaterRestorationSkip: skip,
    });

    await waitFor(() => {
      expect(screen.getByText(/No removable effects found on Ally1/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Exhaustion level/)).not.toBeInTheDocument();
    expect(screen.queryByText('Curse (including attunement to cursed magic item)')).not.toBeInTheDocument();
    expect(screen.queryByText('Ability score reduction')).not.toBeInTheDocument();
    expect(screen.queryByText('Hit Point maximum reduction')).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirm')).not.toBeInTheDocument();

    screen.getByTestId('skip').click();
    expect(noEffects).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(skip).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('target-name-0')).toHaveTextContent('Ally1');
    });
  });

  it('returns to the target step when skipping the effect step with effects present, without casting or refunding', async () => {
    const confirm = vi.fn();
    const noEffects = vi.fn();
    setTargetState('Ally1', { activeConditions: ['charmed'] });
    await openEffectStep({
      actionPendingGreaterRestoration: pendingGR(),
      actionHandleGreaterRestorationConfirm: confirm,
      actionHandleGreaterRestorationNoEffects: noEffects,
    });

    await waitFor(() => {
      expect(screen.getByText('Charmed condition')).toBeInTheDocument();
    });
    screen.getByTestId('skip').click();
    expect(confirm).not.toHaveBeenCalled();
    expect(noEffects).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('target-name-0')).toHaveTextContent('Ally1');
    });
  });
});
