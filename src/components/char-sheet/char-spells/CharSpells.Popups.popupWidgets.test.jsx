// @improved-by-ai
/**
 * Scope: the four popup widgets rendered by SpellTargetPopups from CharSpells —
 * MetamagicPopup, MultiTargetPopup, MagicMissileTargetPopup, UpcastPopup.
 *
 * These tests verify the CharSpells/SpellTargetPopups boundary: how pending state
 * produced by useSpellMetamagicFlow / useSpellUpcastFlow is mapped into popup props
 * (spellName → spell.name, _currentSP → playerStats._metamagicCurrentSP, etc.),
 * how the active combat target is resolved, and that confirm/skip clicks are routed
 * back to the correct flow handler. The popup components themselves are stubbed so
 * failures here always point at the wiring, not at popup internals.
 *
 * NOT covered here (see sibling files to avoid duplication):
 * - target-selection modals + staged flows → CharSpells.Popups.targetSelection.test.jsx
 * - cast flow via SpellDetailPopup, innate sorcery → CharSpells.Popups.spellCast.test.jsx
 * - restoration modals → CharSpells.Popups.restoration.test.jsx
 * - shapechange creature selection → CharSpells.Popups.creatureSelection.test.jsx
 * - UpcastPopup internals → UpcastPopup.rendering/events.test.jsx
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats } from './CharSpells.test-utils.js';

const CAMPAIGN = 'test-campaign';

// --- Flow mocks (the pending state under test) ---

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(),
}));

// --- Infrastructure stubs: never render, never run game logic ---

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(),
}));

const rollAttack = vi.fn();
const rollDamage = vi.fn();

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({ rollAttack, rollDamage })),
}));

vi.mock('../../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
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
  getAttackerTargetName: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn(() => null),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({ players: [], placedItems: [] })),
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/spells/shapechangeService.js', () => ({
  confirmShapechangeTransform: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve()),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

vi.mock('../useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn(() => ({ attack: {}, ctx: {} })),
  resolveAttackDamageStandalone: vi.fn(() => Promise.resolve()),
}));

// --- Widget stubs outside this file's scope: render nothing ---

vi.mock('./CharSpellSlots.jsx', () => ({
  default: () => null,
}));

vi.mock('./SpellDetailPopup.jsx', () => ({
  default: () => null,
}));

vi.mock('../modals/shared/CreatureSelectionModal.jsx', () => ({
  default: () => null,
}));

vi.mock('../modals/shared/SecondaryTargetModal.jsx', () => ({
  default: () => null,
}));

vi.mock('../modals/TruePolymorphPathModal.jsx', () => ({
  default: () => null,
}));

vi.mock('../modals/SingleResistanceSelectionModal.jsx', () => ({
  default: () => null,
}));

vi.mock('../modals/HexAbilityModal.jsx', () => ({
  default: () => null,
}));

// --- The four popup widgets under test ---
// Stubs echo back the props CharSpells is responsible for mapping, so a broken
// prop mapping or handler swap fails these tests rather than a popup internals test.

vi.mock('../popups/MetamagicPopup.jsx', () => ({
  default: function MetamagicPopup({ spell, playerStats, onConfirm, onSkip }) {
    return (
      <div role="dialog" aria-label="Metamagic">
        <span>{`${spell?.name} (${spell?.level})`}</span>
        <span>{`SP ${playerStats?._metamagicCurrentSP}`}</span>
        {playerStats?._isPsionicSpell && (
          <span>{`psionic cost ${playerStats?._psionicCost}`}</span>
        )}
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

vi.mock('../popups/MultiTargetPopup.jsx', () => ({
  default: function MultiTargetPopup({ spell, range, creatureTargets, onConfirm, onSkip }) {
    const names = (creatureTargets || []).map(t => (typeof t === 'string' ? t : t.name));
    return (
      <div role="dialog" aria-label="Select targets">
        <span>{spell?.name}</span>
        <span>{range}</span>
        <ul>{names.map(n => <li key={n}>{n}</li>)}</ul>
        <button onClick={() => onConfirm({ targets: creatureTargets })}>Confirm</button>
        <button onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({
  default: function MagicMissileTargetPopup({ spell, totalMissiles, missileDamage, currentTargetName, creatureTargets, onConfirm, onSkip }) {
    return (
      <div role="dialog" aria-label="Magic Missile targets">
        <span>{`${spell?.name} x${totalMissiles} missiles`}</span>
        <span>{missileDamage}</span>
        <span>{`Current target: ${currentTargetName || 'none'}`}</span>
        <button onClick={() => onConfirm({ targets: creatureTargets })}>Confirm</button>
        <button onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));

vi.mock('./UpcastPopup.jsx', () => ({
  default: function UpcastPopup({ spell, levels, onConfirm, onCancel }) {
    return (
      <div role="dialog" aria-label="Upcast spell">
        <span>{spell?.name}</span>
        <span>{(levels || []).join(',')}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  },
}));

import { useSpellMetamagicFlow } from '../../../hooks/combat/useSpellMetamagicFlow.js';
import { useSpellUpcastFlow } from '../../../hooks/combat/useSpellUpcastFlow.js';
import { getTargetFromAttacker } from '../../../services/rules/combat/damageUtils.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';

// --- Per-test fixtures ---

let flow;
let upcastFlow;

function createFlow() {
  return {
    pendingMetamagic: null,
    pendingMultiTarget: null,
    pendingMagicMissile: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    handleMultiTargetConfirm: vi.fn(),
    handleMultiTargetSkip: vi.fn(),
    handleMagicMissileConfirm: vi.fn(),
    handleMagicMissileSkip: vi.fn(),
  };
}

function createUpcastFlow() {
  return {
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
  };
}

function renderCharSpells() {
  return render(<CharSpells playerStats={mockPlayerStats} campaignName={CAMPAIGN} />);
}

function getPopup(ariaLabel) {
  return screen.queryByRole('dialog', { name: ariaLabel });
}

describe('CharSpells - Spell target popup widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flow = createFlow();
    upcastFlow = createUpcastFlow();
    vi.mocked(useSpellMetamagicFlow).mockReturnValue(flow);
    vi.mocked(useSpellUpcastFlow).mockReturnValue(upcastFlow);
    vi.mocked(getTargetFromAttacker).mockReturnValue(null);
    vi.mocked(getCombatSummary).mockReturnValue({ creatures: [] });
  });

  it('renders no popup widgets when no spell step is pending', () => {
    renderCharSpells();

    expect(getPopup('Metamagic')).not.toBeInTheDocument();
    expect(getPopup('Select targets')).not.toBeInTheDocument();
    expect(getPopup('Magic Missile targets')).not.toBeInTheDocument();
    expect(getPopup('Upcast spell')).not.toBeInTheDocument();
  });

  describe('MetamagicPopup', () => {
    beforeEach(() => {
      flow.pendingMetamagic = {
        spellName: 'Fireball',
        spellLevel: 3,
        _currentSP: 7,
        isPsionic: false,
        psionicCost: 0,
      };
    });

    it('shows the pending spell, its level, and available sorcery points', () => {
      renderCharSpells();

      const dialog = screen.getByRole('dialog', { name: 'Metamagic' });
      expect(within(dialog).getByText('Fireball (3)')).toBeInTheDocument();
      expect(within(dialog).getByText('SP 7')).toBeInTheDocument();
      expect(within(dialog).queryByText(/psionic/i)).not.toBeInTheDocument();
    });

    it('defaults the spell level to 0 when the pending step omits it', () => {
      flow.pendingMetamagic = { spellName: 'Shield', _currentSP: 2 };
      renderCharSpells();

      expect(within(screen.getByRole('dialog', { name: 'Metamagic' })).getByText('Shield (0)')).toBeInTheDocument();
    });

    it('surfaces psionic payment details for psionic spells', () => {
      flow.pendingMetamagic = {
        spellName: 'Fireball',
        spellLevel: 3,
        _currentSP: 7,
        isPsionic: true,
        psionicCost: 2,
      };
      renderCharSpells();

      expect(within(screen.getByRole('dialog', { name: 'Metamagic' })).getByText('psionic cost 2')).toBeInTheDocument();
    });

    it('routes confirm and skip clicks to their own metamagic flow handlers', () => {
      renderCharSpells();

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(flow.handleConfirm).toHaveBeenCalledTimes(1);
      expect(flow.handleSkip).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(flow.handleSkip).toHaveBeenCalledTimes(1);
      expect(flow.handleMultiTargetConfirm).not.toHaveBeenCalled();
      expect(flow.handleMagicMissileConfirm).not.toHaveBeenCalled();
    });
  });

  describe('MultiTargetPopup', () => {
    beforeEach(() => {
      flow.pendingMultiTarget = {
        spellName: 'Aid',
        spellLevel: 2,
        range: '30 feet',
        creatureTargets: ['Orc', 'Goblin'],
      };
    });

    it('shows the spell name, range, and every creature target', () => {
      renderCharSpells();

      const dialog = screen.getByRole('dialog', { name: 'Select targets' });
      expect(within(dialog).getByText('Aid')).toBeInTheDocument();
      expect(within(dialog).getByText('30 feet')).toBeInTheDocument();
      expect(within(dialog).getByText('Orc')).toBeInTheDocument();
      expect(within(dialog).getByText('Goblin')).toBeInTheDocument();
    });

    it('passes the pending creature targets to the confirm handler', () => {
      renderCharSpells();

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(flow.handleMultiTargetConfirm).toHaveBeenCalledWith({ targets: ['Orc', 'Goblin'] });
    });

    it('routes skip clicks to handleMultiTargetSkip without confirming', () => {
      renderCharSpells();

      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(flow.handleMultiTargetSkip).toHaveBeenCalledTimes(1);
      expect(flow.handleMultiTargetConfirm).not.toHaveBeenCalled();
      expect(flow.handleSkip).not.toHaveBeenCalled();
    });
  });

  describe('MagicMissileTargetPopup', () => {
    beforeEach(() => {
      flow.pendingMagicMissile = {
        spell: { name: 'Magic Missile', level: 1 },
        totalMissiles: 3,
        missileDamage: '1d4+1',
        creatureTargets: ['Orc', 'Goblin'],
      };
    });

    it('shows missile count, per-missile damage, and resolves the active target from combat', () => {
      const summary = { creatures: [{ name: 'Goblin' }] };
      vi.mocked(getCombatSummary).mockReturnValue(summary);
      vi.mocked(getTargetFromAttacker).mockReturnValue({ name: 'Goblin' });
      renderCharSpells();

      const dialog = screen.getByRole('dialog', { name: 'Magic Missile targets' });
      expect(within(dialog).getByText('Magic Missile x3 missiles')).toBeInTheDocument();
      expect(within(dialog).getByText('1d4+1')).toBeInTheDocument();
      expect(within(dialog).getByText('Current target: Goblin')).toBeInTheDocument();
      expect(getCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
      expect(getTargetFromAttacker).toHaveBeenCalledWith(summary, mockPlayerStats.name);
    });

    it('shows no current target when the attacker has none selected', () => {
      vi.mocked(getTargetFromAttacker).mockReturnValue(null);
      renderCharSpells();

      const dialog = screen.getByRole('dialog', { name: 'Magic Missile targets' });
      expect(within(dialog).getByText('Current target: none')).toBeInTheDocument();
    });

    it('passes the pending creature targets to confirm and routes skip separately', () => {
      renderCharSpells();

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(flow.handleMagicMissileConfirm).toHaveBeenCalledWith({ targets: ['Orc', 'Goblin'] });
      expect(flow.handleMagicMissileSkip).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(flow.handleMagicMissileSkip).toHaveBeenCalledTimes(1);
      expect(flow.handleMagicMissileConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('UpcastPopup', () => {
    it('shows the pending spell with the levels offered by the upcast flow', () => {
      const spell = { name: 'Cure Wounds', level: 1 };
      upcastFlow.pendingUpcast = { spell };
      upcastFlow.buildUpcastLevels = vi.fn(s => (s === spell ? [2, 3] : []));
      vi.mocked(useSpellUpcastFlow).mockReturnValue(upcastFlow);
      renderCharSpells();

      const dialog = screen.getByRole('dialog', { name: 'Upcast spell' });
      expect(within(dialog).getByText('Cure Wounds')).toBeInTheDocument();
      expect(within(dialog).getByText('2,3')).toBeInTheDocument();
      expect(upcastFlow.buildUpcastLevels).toHaveBeenCalledWith(spell);
    });

    it('routes confirm and cancel clicks to their own upcast flow handlers', () => {
      upcastFlow.pendingUpcast = { spell: { name: 'Cure Wounds', level: 1 } };
      vi.mocked(useSpellUpcastFlow).mockReturnValue(upcastFlow);
      renderCharSpells();

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
      expect(upcastFlow.handleUpcastConfirm).toHaveBeenCalledTimes(1);
      expect(upcastFlow.handleUpcastCancel).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(upcastFlow.handleUpcastCancel).toHaveBeenCalledTimes(1);
      expect(flow.gateMetamagic).not.toHaveBeenCalled();
    });
  });
});
