// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats } from './CharSpells.test-utils.js';

// --- Shared mock infrastructure ---
let mockDiceRoll = { rollAttack: vi.fn(), rollDamage: vi.fn(), autoDamageRoll: null };

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

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
        <span data-testid="metamagic-spell-name">{spell?.name}</span>
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
        <span data-testid="mt-spell-name">{spell?.name}</span>
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
        <span data-testid="mm-spell-name">{spell?.name}</span>
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

vi.mock('../modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function CreatureSelectionModal({ title, targets, onConfirm, onSkip }) {
    return (
      <div data-testid="creature-selection-modal" data-title={title}>
        <span>{title}</span>
        {targets?.map(t => {
          const name = typeof t === 'string' ? t : t.name;
          return <button key={name} data-testid={`csm-${name}`} onClick={() => onConfirm?.([name])}>{name}</button>;
        })}
        <button data-testid="csm-skip" onClick={() => onSkip?.()}>skip</button>
      </div>
    );
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

vi.mock('../modals/TruePolymorphPathModal.jsx', () => ({
  default: function TruePolymorphPathModal({ onConfirm, onCancel }) {
    return (
      <div data-testid="true-polymorph-path-modal">
        <button data-testid="tp-path-creature" onClick={() => onConfirm('creature_to_creature')}>creature to creature</button>
        <button data-testid="tp-path-object" onClick={() => onConfirm('creature_to_object')}>creature to object</button>
        <button data-testid="tp-cancel" onClick={onCancel}>cancel</button>
      </div>
    );
  },
}));

vi.mock('../modals/SingleResistanceSelectionModal.jsx', () => ({
  default: function SingleResistanceSelectionModal({ title, action }) {
    return (
      <div data-testid="single-resistance-selection-modal">
        <span>{title}</span>
        <span data-testid="res-damage-types">{action?.automation?.damageTypes?.join(',')}</span>
      </div>
    );
  },
}));

vi.mock('../modals/HexAbilityModal.jsx', () => ({
  default: function HexAbilityModal({ title, onAbilitySelected, onCancel }) {
    return (
      <div data-testid="hex-ability-modal" data-title={title}>
        <button data-testid="hex-ability-STR" onClick={() => onAbilitySelected('STR')}>Strength</button>
        <button data-testid="hex-cancel" onClick={onCancel}>cancel</button>
      </div>
    );
  },
}));

// --- Shared test helpers ---

import { useSpellMetamagicFlow } from '../../../hooks/combat/useSpellMetamagicFlow.js';
import { useSpellUpcastFlow } from '../../../hooks/combat/useSpellUpcastFlow.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isInnateSorceryActive } from '../../../services/combat/buffs/buffService.js';
import { getTargetFromAttacker } from '../../../services/rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { normalizeAutoDamage, resolveAttackDamageStandalone } from '../useAttackDamageResolution.js';

function createFlow(overrides = {}) {
  const flow = {
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    handleMultiTargetConfirm: vi.fn(),
    handleMultiTargetSkip: vi.fn(),
    handleMagicMissileConfirm: vi.fn(),
    handleMagicMissileSkip: vi.fn(),
  };
  return { ...flow, ...overrides };
}

let flow;
let upcastFlow;

function renderWithProps(props = {}) {
  return render(
    <CharSpells
      playerStats={mockPlayerStats}
      campaignName="test-campaign"
      {...props}
    />
  );
}

describe('CharSpells - Popup Modal Rendering', () => {
  beforeEach(() => {
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

  describe('metamagic popup', () => {
    it('renders MetamagicPopup with correct spell name and SP, and wires confirm/skip handlers', () => {
      flow.pendingMetamagic = {
        spellName: 'Fireball',
        spellLevel: 3,
        _currentSP: 7,
        isPsionic: false,
        psionicCost: 0,
      };
      renderWithProps();

      expect(screen.getByTestId('metamagic-popup')).toBeInTheDocument();
      expect(screen.getByTestId('metamagic-spell-name')).toHaveTextContent('Fireball');
      expect(screen.getByTestId('metamagic-sp')).toHaveTextContent('7');

      fireEvent.click(screen.getByTestId('metamagic-confirm'));
      expect(flow.handleConfirm).toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('metamagic-skip'));
      expect(flow.handleSkip).toHaveBeenCalled();
    });
  });

  describe('multi-target popup', () => {
    it('renders MultiTargetPopup with spell name and target list, and wires confirm/skip handlers', () => {
      flow.pendingMultiTarget = {
        spellName: 'Aid',
        spellLevel: 2,
        range: '30 feet',
        creatureTargets: ['Orc', 'Goblin'],
      };
      renderWithProps();

      expect(screen.getByTestId('multi-target-popup')).toBeInTheDocument();
      expect(screen.getByTestId('mt-spell-name')).toHaveTextContent('Aid');

      fireEvent.click(screen.getByTestId('mt-confirm'));
      expect(flow.handleMultiTargetConfirm).toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('mt-skip'));
      expect(flow.handleMultiTargetSkip).toHaveBeenCalled();
    });
  });

  describe('magic missile popup', () => {
    it('renders MagicMissileTargetPopup with missile count and current target, and wires confirm/skip handlers', () => {
      flow.pendingMagicMissile = {
        spell: { name: 'Magic Missile', level: 1 },
        totalMissiles: 3,
        missileDamage: '1d4+1',
        creatureTargets: ['Orc', 'Goblin'],
      };
      vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Goblin' });
      renderWithProps();

      expect(screen.getByTestId('magic-missile-popup')).toBeInTheDocument();
      expect(screen.getByTestId('mm-spell-name')).toHaveTextContent('Magic Missile');
      expect(screen.getByTestId('mm-total')).toHaveTextContent('3');
      expect(screen.getByTestId('mm-current-target')).toHaveTextContent('Goblin');

      fireEvent.click(screen.getByTestId('mm-confirm'));
      expect(flow.handleMagicMissileConfirm).toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('mm-skip'));
      expect(flow.handleMagicMissileSkip).toHaveBeenCalled();
    });
  });

  describe('upcast popup', () => {
    it('does not render UpcastPopup when pendingUpcast is null', () => {
      upcastFlow.pendingUpcast = null;
      renderWithProps();

      expect(screen.queryByTestId('upcast-popup')).not.toBeInTheDocument();
    });
  });

});
