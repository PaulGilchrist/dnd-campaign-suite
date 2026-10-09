// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats } from './CharSpells.test-utils.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

let mockDiceRoll = { rollAttack: vi.fn(), rollDamage: vi.fn(), autoDamageRoll: null };

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn((name, campaignName, options) => {
    mockDiceRoll.autoDamageRoll = options?.autoDamageRoll;
    return {
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: mockDiceRoll.rollAttack,
      rollDamage: mockDiceRoll.rollDamage,
      quickRollPlayerSave: vi.fn(),
    };
  }),
}));

vi.mock('../../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(),
}));

vi.mock('../../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({
    resolvePositions: vi.fn(() => Promise.resolve()),
    cachedPosRef: { current: null },
  })),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue({ players: [], placedItems: [] }),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/spells/shapechangeService.js', () => ({
  confirmShapechangeTransform: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn().mockResolvedValue(undefined),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

vi.mock('../useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn(() => ({ attack: { name: 'Fire Bolt' }, ctx: { targetName: 'Orc' } })),
  resolveAttackDamageStandalone: vi.fn(() => Promise.resolve()),
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function CharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
  },
}));

vi.mock('./SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopup({ spell, onCast }) {
    return (
      <div data-testid="spell-detail-popup">
        <span>{spell?.name}</span>
        <button data-testid="cast-spell-button" onClick={() => onCast(spell, {})}>Cast</button>
      </div>
    );
  },
}));

vi.mock('../popups/MetamagicPopup.jsx', () => ({
  default: function MetamagicPopup({ spell, playerStats, onConfirm, onSkip }) {
    return (
      <div data-testid="metamagic-popup">
        <span>{spell?.name}</span>
        <span data-testid="metamagic-sp">{playerStats?._metamagicCurrentSP}</span>
        <button data-testid="metamagic-confirm" onClick={onConfirm}>confirm</button>
        <button data-testid="metamagic-skip" onClick={onSkip}>skip</button>
      </div>
    );
  },
}));

vi.mock('../popups/MultiTargetPopup.jsx', () => ({
  default: function MultiTargetPopup({ spell, creatureTargets, onConfirm, onSkip }) {
    return (
      <div data-testid="multi-target-popup">
        <span>{spell?.name}</span>
        <button data-testid="mt-confirm" onClick={() => onConfirm({ targets: creatureTargets })}>confirm</button>
        <button data-testid="mt-skip" onClick={onSkip}>skip</button>
      </div>
    );
  },
}));

vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({
  default: function MagicMissileTargetPopup({ spell, totalMissiles, currentTargetName, creatureTargets, onConfirm, onSkip }) {
    return (
      <div data-testid="magic-missile-popup">
        <span>{spell?.name}</span>
        <span data-testid="mm-total">{totalMissiles}</span>
        <span data-testid="mm-current-target">{currentTargetName}</span>
        <button data-testid="mm-confirm" onClick={() => onConfirm({ targets: creatureTargets })}>confirm</button>
        <button data-testid="mm-skip" onClick={onSkip}>skip</button>
      </div>
    );
  },
}));

vi.mock('./UpcastPopup.jsx', () => ({
  default: function UpcastPopup({ spell }) {
    return <div data-testid="upcast-popup">{spell?.name}</div>;
  },
}));

vi.mock('../modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function SecondaryTargetModal({ title, targets, onTargetSelected, onSkip, hideConfirm, description }) {
    return (
      <div data-testid="secondary-target-modal" data-title={title} data-hideconfirm={String(Boolean(hideConfirm))}>
        <span>{title}</span>
        <span data-testid="stm-description">{description}</span>
        <button data-testid="stm-skip" onClick={() => onSkip?.()}>skip</button>
        {targets?.map(t => (
          <button key={t.value || t.name} data-testid={`stm-${t.value || t.name}`} onClick={() => onTargetSelected?.(t.value || t.name)}>
            {t.label || t.name}
          </button>
        ))}
        {!hideConfirm && targets?.length > 0 && (
          <button data-testid="stm-confirm" onClick={() => onTargetSelected?.(targets[0].value || targets[0].name)}>confirm</button>
        )}
      </div>
    );
  },
}));

import { useSpellMetamagicFlow } from '../../../hooks/combat/useSpellMetamagicFlow.js';
import { useSpellUpcastFlow } from '../../../hooks/combat/useSpellUpcastFlow.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isInnateSorceryActive } from '../../../services/combat/buffs/buffService.js';
import { getTargetFromAttacker } from '../../../services/rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { normalizeAutoDamage, resolveAttackDamageStandalone } from '../useAttackDamageResolution.js';

const PENDING_KEYS = [
  'Metamagic', 'MultiTarget', 'HeroesFeast', 'GreaterRestoration', 'LesserRestoration',
  'MageArmor', 'Bane', 'Bless', 'FaerieFire', 'HolyAura', 'BeaconOfHope', 'Slow', 'Haste',
  'EnhanceAbility', 'Barkskin', 'Invisibility', 'GreaterInvisibility', 'FeignDeath', 'Heal',
  'ProtectionFromEvilAndGood', 'ProtectionFromPoison', 'StoneSkin', 'ProtectionFromEnergy',
  'Resistance', 'RemoveCurse', 'MagicMissile', 'PassWithoutTrace', 'Globe', 'Forcecage',
  'AntimagicField', 'Regenerate', 'HealingWord', 'CureWounds', 'StinkingCloud', 'Web',
  'AnimalFriendship', 'AuraOfLife', 'AuraOfPurity', 'CircleOfPower', 'Compulsion',
  'AuraOfVitality', 'Foresight', 'Longstrider', 'SpareTheDying', 'Confusion', 'DeathWard',
  'Heroism', 'Revivify', 'Sanctuary', 'SleetStorm', 'Shapechange',
];

function createFlow(overrides = {}) {
  const flow = { gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn() };
  for (const key of PENDING_KEYS) {
    flow[`pending${key}`] = null;
    flow[`handle${key}Confirm`] = vi.fn();
    flow[`handle${key}Skip`] = vi.fn();
  }
  flow.enhanceAbilityStage = null;
  flow.protectionFromEnergyStage = null;
  flow.resistanceStage = null;
  flow.handleEnhanceAbilityAbilitySelect = vi.fn();
  flow.handleProtectionFromEnergyTargetSelect = vi.fn();
  flow.handleProtectionFromEnergyTypeSelect = vi.fn();
  flow.handleResistanceTargetSelect = vi.fn();
  flow.handleResistanceTypeSelect = vi.fn();
  flow.handleResistanceSkip = vi.fn();
  flow.handleGreaterRestorationNoEffects = vi.fn();
  flow.pendingHoldMonster = null; flow.handleHoldMonsterConfirm = vi.fn(); flow.handleHoldMonsterSkip = vi.fn();
  flow.pendingHoldPerson = null; flow.handleHoldPersonConfirm = vi.fn(); flow.handleHoldPersonSkip = vi.fn();
  flow.pendingPolymorph = null; flow.handlePolymorphConfirm = vi.fn(); flow.handlePolymorphSkip = vi.fn();
  flow.pendingAnimalShapes = null; flow.handleAnimalShapesTargetConfirm = vi.fn(); flow.handleAnimalShapesSkip = vi.fn();
  flow.pendingTruePolymorph = null; flow.handleTruePolymorphPathSelect = vi.fn(); flow.handleTruePolymorphTargetConfirm = vi.fn(); flow.handleTruePolymorphSkip = vi.fn();
  flow.pendingCharmPerson = null; flow.handleCharmPersonConfirm = vi.fn(); flow.handleCharmPersonSkip = vi.fn();
  flow.pendingCharmMonster = null; flow.handleCharmMonsterConfirm = vi.fn(); flow.handleCharmMonsterSkip = vi.fn();
  flow.pendingBanishment = null; flow.handleBanishmentConfirm = vi.fn(); flow.handleBanishmentSkip = vi.fn();
  flow.pendingPrismaticSpray = null; flow.handlePrismaticSprayConfirm = vi.fn(); flow.handlePrismaticSpraySkip = vi.fn();
  return { ...flow, ...overrides };
}

let flow;
let upcastFlow;

function renderWithProps(props = {}) {
  return render(<CharSpells
    playerStats={mockPlayerStats}
    campaignName="test-campaign"
    {...props}
  />);
}

describe('CharSpells - Restoration Spells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    flow = createFlow();
    upcastFlow = {
      pendingUpcast: null,
      buildUpcastLevels: vi.fn(() => []),
      gateUpcast: vi.fn(() => false),
      handleUpcastConfirm: vi.fn(),
      handleUpcastCancel: vi.fn(),
      getCantripAutoLevel: vi.fn(() => null),
    };
    mockDiceRoll = { rollAttack: vi.fn(), rollDamage: vi.fn(), autoDamageRoll: null };
    vi.mocked(useSpellMetamagicFlow).mockReturnValue(flow);
    vi.mocked(useSpellUpcastFlow).mockReturnValue(upcastFlow);
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(isInnateSorceryActive).mockReturnValue(false);
    vi.mocked(getTargetFromAttacker).mockReturnValue(null);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
    vi.mocked(normalizeAutoDamage).mockReturnValue({ attack: { name: 'Fire Bolt' }, ctx: { targetName: 'Orc' } });
    vi.mocked(resolveAttackDamageStandalone).mockResolvedValue(undefined);
  });

  describe('Greater Restoration', () => {
    it('renders target selection modal with creature buttons and skip', () => {
      flow.pendingGreaterRestoration = { creatureTargets: ['Orc', 'Goblin'], range: '60 feet' };
      renderWithProps();

      expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument();
      expect(screen.getByText('Greater Restoration')).toBeInTheDocument();
      expect(screen.getByText('Orc')).toBeInTheDocument();
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.getByTestId('stm-skip')).toBeInTheDocument();
    });

    it('invokes the confirm handler with target name and condition selection when a condition is chosen', async () => {
      flow.pendingGreaterRestoration = { creatureTargets: ['Orc'], range: '60 feet' };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeConditions') return ['Charmed'];
        if (key === 'exhaustionLevel') return 2;
        if (key === 'activeBuffs') return [{ type: 'cursed' }];
        if (key === 'abilityReductions') return { str: 1 };
        if (key === 'hpMaxReduction') return 5;
        return null;
      });
      renderWithProps();

      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByTestId('stm-condition:charmed')).toBeInTheDocument();
      });
      expect(screen.getByTestId('stm-exhaustion')).toBeInTheDocument();
      expect(screen.getByTestId('stm-curse')).toBeInTheDocument();
      expect(screen.getByTestId('stm-ability_reduction')).toBeInTheDocument();
      expect(screen.getByTestId('stm-hp_max_reduction')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('stm-condition:charmed'));
      expect(flow.handleGreaterRestorationConfirm).toHaveBeenCalledWith({
        targetName: 'Orc',
        selections: [{ type: 'condition', condition: 'charmed' }],
      });
    });

    it('invokes the confirm handler with target name and effect selection when a non-condition effect is chosen', async () => {
      flow.pendingGreaterRestoration = { creatureTargets: ['Orc'], range: '60 feet' };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'exhaustionLevel') return 3;
        return null;
      });
      renderWithProps();

      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByTestId('stm-exhaustion')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('stm-exhaustion'));
      expect(flow.handleGreaterRestorationConfirm).toHaveBeenCalledWith({
        targetName: 'Orc',
        selections: [{ type: 'exhaustion' }],
      });
    });

    it('invokes the skip handler when skip is clicked on the effect selection modal', async () => {
      flow.pendingGreaterRestoration = { creatureTargets: ['Orc'], range: '60 feet' };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeConditions') return ['Charmed'];
        return null;
      });
      renderWithProps();

      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByTestId('stm-condition:charmed')).toBeInTheDocument();
      });

      flow.handleGreaterRestorationSkip();
      expect(flow.handleGreaterRestorationSkip).toHaveBeenCalled();
    });

    it('invokes the no-effects handler when skip is clicked and no effects are found', async () => {
      flow.pendingGreaterRestoration = { creatureTargets: ['Orc'], range: '60 feet' };
      renderWithProps();

      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByText('No removable effects found on Orc.')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('stm-skip'));
      expect(flow.handleGreaterRestorationNoEffects).toHaveBeenCalled();
    });

    it('deduplicates conditions from runtime and combat summary, showing exactly one option', async () => {
      flow.pendingGreaterRestoration = { creatureTargets: ['Orc'], range: '60 feet' };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeConditions') return ['CHARMED', 'petrified'];
        return null;
      });
      vi.mocked(getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Orc', conditions: [{ key: 'charmed' }] }],
      });
      renderWithProps();
      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByTestId('stm-condition:charmed')).toBeInTheDocument();
        expect(screen.getByTestId('stm-condition:petrified')).toBeInTheDocument();
        expect(screen.queryAllByTestId('stm-condition:charmed').length).toBe(1);
      });
    });

    it('detects curse from activeBuffs with type or cursed property', async () => {
      flow.pendingGreaterRestoration = { creatureTargets: ['Orc'], range: '60 feet' };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ type: 'cursed', name: 'Armor of Invulnerability' }, { cursed: true }];
        return null;
      });
      renderWithProps();
      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByTestId('stm-curse')).toBeInTheDocument();
      });
    });

    it('detects ability score reduction, HP maximum reduction, and exhaustion level', async () => {
      flow.pendingGreaterRestoration = { creatureTargets: ['Orc'], range: '60 feet' };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'abilityReductions') return { str: 3, dex: 2 };
        if (key === 'hpMaxReduction') return 10;
        if (key === 'exhaustionLevel') return 3;
        return null;
      });
      renderWithProps();
      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByTestId('stm-ability_reduction')).toBeInTheDocument();
        expect(screen.getByTestId('stm-hp_max_reduction')).toBeInTheDocument();
        expect(screen.getByTestId('stm-exhaustion')).toBeInTheDocument();
      });
    });
  });

  describe('Lesser Restoration', () => {
    it('renders target selection modal with creature buttons and skip', () => {
      flow.pendingLesserRestoration = { creatureTargets: ['Orc'], range: '30 feet' };
      renderWithProps();

      expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument();
      expect(screen.getByText('Lesser Restoration')).toBeInTheDocument();
      expect(screen.getByText('Orc')).toBeInTheDocument();
      expect(screen.getByTestId('stm-skip')).toBeInTheDocument();
    });

    it('invokes the confirm handler with target name and condition when a condition is chosen', async () => {
      flow.pendingLesserRestoration = { creatureTargets: ['Orc'], range: '30 feet' };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeConditions') return ['Blinded'];
        return null;
      });
      renderWithProps();
      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByTestId('stm-condition:blinded')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('stm-condition:blinded'));
      expect(flow.handleLesserRestorationConfirm).toHaveBeenCalledWith({ targetName: 'Orc', condition: 'blinded' });
    });

    it('invokes the skip handler when skip is clicked on the condition selection modal', async () => {
      flow.pendingLesserRestoration = { creatureTargets: ['Orc'], range: '30 feet' };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeConditions') return ['Blinded'];
        return null;
      });
      renderWithProps();
      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByTestId('stm-condition:blinded')).toBeInTheDocument();
      });

      flow.handleLesserRestorationSkip();
      expect(flow.handleLesserRestorationSkip).toHaveBeenCalled();
    });

    it('invokes the skip handler (no conditions) when skip is clicked and no conditions are found', async () => {
      flow.pendingLesserRestoration = { creatureTargets: ['Orc'], range: '30 feet' };
      renderWithProps();
      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByText('No removable conditions found on Orc.')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('stm-skip'));
      expect(flow.handleLesserRestorationSkip).toHaveBeenCalled();
    });

    it('filters to allowed conditions only (blinded, deafened, paralyzed, poisoned)', async () => {
      flow.pendingLesserRestoration = { creatureTargets: ['Orc'], range: '30 feet' };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeConditions') return ['Blinded', 'Charmed', 'Poisoned', 'Petrified'];
        return null;
      });
      renderWithProps();
      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByTestId('stm-condition:blinded')).toBeInTheDocument();
        expect(screen.getByTestId('stm-condition:poisoned')).toBeInTheDocument();
        expect(screen.queryByTestId('stm-condition:charmed')).not.toBeInTheDocument();
        expect(screen.queryByTestId('stm-condition:petrified')).not.toBeInTheDocument();
      });
    });

    it('deduplicates conditions from runtime and combat summary, showing exactly one option', async () => {
      flow.pendingLesserRestoration = { creatureTargets: ['Orc'], range: '30 feet' };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeConditions') return ['DEAFENED'];
        return null;
      });
      vi.mocked(getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Orc', conditions: [{ key: 'deafened' }] }],
      });
      renderWithProps();
      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        const deafenedOptions = screen.queryAllByTestId('stm-condition:deafened');
        expect(deafenedOptions.length).toBe(1);
      });
    });

    it('handles combat summary lookup failure gracefully by showing no conditions message', async () => {
      flow.pendingLesserRestoration = { creatureTargets: ['Orc'], range: '30 feet' };
      vi.mocked(getCombatSummary).mockRejectedValue(new Error('boom'));
      renderWithProps();
      fireEvent.click(screen.getByText('Orc'));

      await waitFor(() => {
        expect(screen.getByText('No removable conditions found on Orc.')).toBeInTheDocument();
      });
    });
  });
});
