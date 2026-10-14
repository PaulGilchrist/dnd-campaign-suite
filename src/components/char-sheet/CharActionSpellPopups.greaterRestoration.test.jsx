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

function setTargetEffects(targetName, effects) {
  runtimeStore.set(buildRuntimeKey('campaign', 'targetEffects'), effects);
}

describe('CharActionSpellPopups - Greater Restoration 2-Step Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeStore.clear();
  });

  describe('Step 1: Target Selection', () => {
    it('renders SecondaryTargetModal with correct metadata when actionPendingGreaterRestoration is truthy', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1', 'Ally2'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
          })}
        />
      );
      expect(screen.getByTestId('title')).toHaveTextContent('Greater Restoration');
      expect(screen.getByTestId('description')).toHaveTextContent('Touch');
      expect(screen.getByTestId('confirm-label')).toHaveTextContent('Cast Greater Restoration');
      expect(screen.getByTestId('target-0')).toHaveTextContent('Ally1');
      expect(screen.getByTestId('target-1')).toHaveTextContent('Ally2');
    });

    it('calls actionHandleGreaterRestorationSkip when skip is clicked', () => {
      const actionHandleGreaterRestorationSkip = vi.fn();
      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleGreaterRestorationSkip })}
          actionPendingGreaterRestoration={{ creatureTargets: ['Ally1'], range: 'Touch' }}
        />
      );
      screen.getByTestId('skip').click();
      expect(actionHandleGreaterRestorationSkip).toHaveBeenCalled();
    });

    it('renders no targets when creatureTargets is empty', () => {
      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: [], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
          })}
        />
      );
      expect(screen.getByTestId('title')).toHaveTextContent('Greater Restoration');
      expect(screen.queryByTestId('target-0')).not.toBeInTheDocument();
    });
  });

  describe('Step 2: Effect Selection', () => {
    it('displays conditions from activeConditions in runtime store', async () => {
      setTargetEffects('campaign', []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), ['charmed', 'petrified']);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
            actionHandleGreaterRestorationConfirm: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.getByText('Charmed condition')).toBeInTheDocument();
        expect(screen.getByText('Petrified condition')).toBeInTheDocument();
      });
    });

    it('displays exhaustion level when greater than zero', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 2);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
            actionHandleGreaterRestorationConfirm: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.getByText('Exhaustion level (current: 2)')).toBeInTheDocument();
      });
    });

    it('does not display exhaustion when level is zero', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
            actionHandleGreaterRestorationConfirm: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.queryByText(/Exhaustion level/)).not.toBeInTheDocument();
      });
    });

    it('displays curse when activeBuffs has type "cursed"', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), [{ type: 'cursed' }]);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
            actionHandleGreaterRestorationConfirm: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.getByText('Curse (including attunement to cursed magic item)')).toBeInTheDocument();
      });
    });

    it('does not display curse when no cursed buffs exist', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), [{ type: 'other' }]);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
            actionHandleGreaterRestorationConfirm: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.queryByText(/Curse/)).not.toBeInTheDocument();
      });
    });

    it('displays ability score reduction when abilityReductions has entries', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), { STR: -2 });
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
            actionHandleGreaterRestorationConfirm: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.getByText('Ability score reduction')).toBeInTheDocument();
      });
    });

    it('does not display ability score reduction when empty', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
            actionHandleGreaterRestorationConfirm: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.queryByText('Ability score reduction')).not.toBeInTheDocument();
      });
    });

    it('displays HP maximum reduction when greater than zero', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 10);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
            actionHandleGreaterRestorationConfirm: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.getByText('Hit Point maximum reduction')).toBeInTheDocument();
      });
    });

    it('does not display HP reduction when zero', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
            actionHandleGreaterRestorationConfirm: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.queryByText('Hit Point maximum reduction')).not.toBeInTheDocument();
      });
    });

    it('shows "No removable effects" message when target has no removable effects', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
            actionHandleGreaterRestorationConfirm: vi.fn(),
            actionHandleGreaterRestorationNoEffects: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.getByText(/No removable effects found on Ally1/)).toBeInTheDocument();
      });
    });

    it('calls actionHandleGreaterRestorationNoEffects when skipping with no effects', async () => {
      const actionHandleGreaterRestorationNoEffects = vi.fn();
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleGreaterRestorationNoEffects })}
          actionPendingGreaterRestoration={{ creatureTargets: ['Ally1'], range: 'Touch' }}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Skip' })).toBeInTheDocument();
      });
      screen.getByRole('button', { name: 'Skip' }).click();
      expect(actionHandleGreaterRestorationNoEffects).toHaveBeenCalled();
    });

    it('does not call noEffects when skipping with effects present', async () => {
      const actionHandleGreaterRestorationNoEffects = vi.fn();
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), ['charmed']);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleGreaterRestorationNoEffects })}
          actionPendingGreaterRestoration={{ creatureTargets: ['Ally1'], range: 'Touch' }}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.getByText('Charmed condition')).toBeInTheDocument();
      });
      screen.getByRole('button', { name: 'Skip' }).click();
      expect(actionHandleGreaterRestorationNoEffects).not.toHaveBeenCalled();
    });

    it('only includes conditions supported by Greater Restoration', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), ['frightened', 'poisoned', 'blinded']);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
            actionHandleGreaterRestorationConfirm: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.queryByText('Poisoned condition')).not.toBeInTheDocument();
        expect(screen.queryByText('Frightened condition')).not.toBeInTheDocument();
        expect(screen.queryByText('Blinded condition')).not.toBeInTheDocument();
      });
    });
  });

  describe('Effect selection callbacks', () => {
    const effectTests = [
      { name: 'condition selection', setup: () => {
        runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), ['charmed']);
        runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
        runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
        runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
        runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);
      }, searchText: 'Charmed condition', expectedSelection: { type: 'condition', condition: 'charmed' } },
      { name: 'exhaustion selection', setup: () => {
        runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
        runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 3);
        runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
        runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
        runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);
      }, searchText: 'Exhaustion level (current: 3)', expectedSelection: { type: 'exhaustion' } },
      { name: 'curse selection', setup: () => {
        runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
        runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
        runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), [{ type: 'cursed' }]);
        runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
        runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);
      }, searchText: 'Curse (including attunement to cursed magic item)', expectedSelection: { type: 'curse' } },
      { name: 'ability_reduction selection', setup: () => {
        runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
        runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
        runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
        runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), { STR: -2 });
        runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);
      }, searchText: 'Ability score reduction', expectedSelection: { type: 'ability_reduction' } },
      { name: 'hp_max_reduction selection', setup: () => {
        runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), []);
        runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
        runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
        runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
        runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 10);
      }, searchText: 'Hit Point maximum reduction', expectedSelection: { type: 'hp_max_reduction' } },
    ];

    it.each(effectTests)('calls actionHandleGreaterRestorationConfirm with $name', async ({ setup, searchText, expectedSelection }) => {
      const actionHandleGreaterRestorationConfirm = vi.fn();
      setup();

      render(
        <CharActionSpellPopups
          {...createBaseProps({ actionHandleGreaterRestorationConfirm })}
          actionPendingGreaterRestoration={{ creatureTargets: ['Ally1'], range: 'Touch' }}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.getByText(searchText)).toBeInTheDocument();
      });
      screen.getByText(searchText).click();
      expect(actionHandleGreaterRestorationConfirm).toHaveBeenCalledWith({
        targetName: 'Ally1',
        selections: [expectedSelection],
      });
    });

    it('clears selected target after effect is confirmed, returning to target selection', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), ['charmed']);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationConfirm: vi.fn(),
            actionHandleGreaterRestorationSkip: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.getByText('Charmed condition')).toBeInTheDocument();
      });
      screen.getByText('Charmed condition').click();
      expect(screen.getByTestId('target-0')).toBeInTheDocument();
    });

    it('clears selected target on skip during effect selection, returning to target selection', async () => {
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeConditions'), ['charmed']);
      runtimeStore.set(buildRuntimeKey('Ally1', 'exhaustionLevel'), 0);
      runtimeStore.set(buildRuntimeKey('Ally1', 'activeBuffs'), []);
      runtimeStore.set(buildRuntimeKey('Ally1', 'abilityReductions'), {});
      runtimeStore.set(buildRuntimeKey('Ally1', 'hpMaxReduction'), 0);

      render(
        <CharActionSpellPopups
          {...createBaseProps({
            actionPendingGreaterRestoration: { creatureTargets: ['Ally1'], range: 'Touch' },
            actionHandleGreaterRestorationSkip: vi.fn(),
          })}
        />
      );
      screen.getByTestId('target-0').click();
      await waitFor(() => {
        expect(screen.getByText('Charmed condition')).toBeInTheDocument();
      });
      screen.getByRole('button', { name: 'Skip' }).click();
      expect(screen.getByTestId('target-0')).toBeInTheDocument();
    });
  });
});
