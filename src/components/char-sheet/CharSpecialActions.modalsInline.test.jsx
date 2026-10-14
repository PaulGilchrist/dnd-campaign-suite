import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';

// Mock executeHandler
vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

// Mock automation service
vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn((action) => !!(action?.automation)),
  isInteractiveAutomation: vi.fn((action) => {
    if (!action?.automation) return false;
    const auto = Array.isArray(action.automation) ? action.automation[0] : action.automation;
    const interactiveTypes = ['teleport', 'signature_spells', 'spell_mastery', 'combat_superiority', 'weapon_kind_mastery', 'weapon_mastery_choice', 'defensive_tactics', 'hunter_prey', 'animal_aspect', 'passive_rule', 'temp_hp_buff', 'brew_poison', 'stride_of_the_elements', 'elemental_epitome', 'destructive_stride', 'quivering_palm', 'steps_of_the_fey_taunt', 'hurl_through_hell', 'clairvoyant_combatant', 'portent', 'boon_of_energy_resistance', 'generic', 'silent', 'resource_pool', 'natural_recovery', 'circle_of_the_land', 'elemental_affinity', 'wild_magic_surge', 'stride_of_elements', 'celestial_resilience', 'fiendish_resilience', 'heroic_inspiration_buff', 'magical_cunning', 'tactical_mind', 'concentration_bonus_attack', 'font_of_inspiration', 'combat_stance', 'damage_type_choice', 'wild_magic_tamed', 'feats_of_chaos', 'initiative_action', 'magical_cunning', 'bewitching_magic', 'lucky_point', 'telekinetic_shove'];
    if (auto.type === 'passive_rule') {
      const interactiveEffects = ['abjuration_savant', 'divination_savant', 'evocation_savant', 'illusion_savant', 'bonus_healing'];
      return interactiveEffects.includes(auto.effect);
    }
    return interactiveTypes.includes(auto.type);
  }),
}));

// Mock TeleportModal
vi.mock('./modals/TeleportModal.jsx', () => ({
  default: ({ action, onClose }) => (
    <div data-testid="teleport-modal">
      <span>{action?.name || 'Teleport'}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SignatureSpellsModal
vi.mock('./modals/arcane/SignatureSpellsModal.jsx', () => ({
  default: ({ payload: _payload, onConfirm, onClose }) => (
    <div data-testid="signature-spells-modal" role="presentation" onClick={onClose}>
      <h3>Signature Spells</h3>
      <button onClick={() => onConfirm('Fireball', 'Haste')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SpellMasteryModal
vi.mock('./modals/arcane/SpellMasteryModal.jsx', () => ({
  default: ({ payload: _payload, onConfirm, onClose }) => (
    <div data-testid="spell-mastery-modal" role="presentation" onClick={onClose}>
      <h3>Spell Mastery</h3>
      <button onClick={() => onConfirm('Mage Armor', 'Shield')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SavantModal
vi.mock('./modals/arcane/SavantModal.jsx', () => ({
  default: ({ payload, onConfirm, onClose }) => (
    <div data-testid={`${payload?.school?.toLowerCase() || 'savant'}-savant-modal`} role="presentation" onClick={onClose}>
      <span>{payload?.school || 'Savant'} Savant</span>
      <button onClick={() => onConfirm(payload?.spellOptions?.[0] || 'Shield', payload?.spellOptions?.[1] || 'Mage Armor')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock WeaponKindMasteryModal
vi.mock('./modals/WeaponKindMasteryModal.jsx', () => ({
  default: ({ action, onClose }) => (
    <div data-testid="weapon-kind-mastery-modal">
      <span>{action?.name || 'Weapon Kind Mastery'}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock WeaponMasteryChoiceModal
vi.mock('./modals/WeaponMasteryChoiceModal.jsx', () => ({
  default: ({ action: _action, onClose, onConfirm }) => (
    <div data-testid="weapon-mastery-choice-modal">
      <span>Weapon Mastery Choice</span>
      <button onClick={onClose}>Close</button>
      <button onClick={() => onConfirm && onConfirm('Finesse')}>Confirm</button>
    </div>
  ),
}));

// Mock CombatSuperiorityModal
vi.mock('./modals/CombatSuperiorityModal.jsx', () => ({
  default: ({ _payload, onConfirm, _onReopenSelection, _onClose }) => (
    <div data-testid="combat-superiority-modal">
      <span>Combat Superiority</span>
      <button onClick={() => onConfirm([], null)}>Close</button>
    </div>
  ),
}));

// Mock ResourcePoolModal
vi.mock('./modals/ResourcePoolModal.jsx', () => ({
  default: ({ playerStats: _ps, campaignName: _cn, automation: _auto, onClose }) => (
    <div data-testid="resource-pool-modal">
      <span>Resource Pool</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock NaturalRecoveryModal
vi.mock('./modals/NaturalRecoveryModal.jsx', () => ({
  default: ({ playerStats: _ps, campaignName: _cn, onClose }) => (
    <div data-testid="natural-recovery-modal">
      <span>Natural Recovery</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock CircleOfTheLandSpellsModal
vi.mock('./modals/CircleOfTheLandSpellsModal.jsx', () => ({
  default: ({ playerStats: _ps, campaignName: _cn, onClose }) => (
    <div data-testid="circle-of-the-land-modal">
      <span>Circle of the Land</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock ElementalAffinityModal
vi.mock('./modals/ElementalAffinityModal.jsx', () => ({
  default: ({ action, playerStats: _ps, campaignName: _cn, onClose }) => (
    <div data-testid="elemental-affinity-modal">
      <span>{action?.name || 'Elemental Affinity'}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock WildMagicSurgeModal
vi.mock('./modals/WildMagicSurgeModal.jsx', () => ({
  default: ({ onClose }) => (
    <div data-testid="wild-magic-surge-modal">
      <span>Wild Magic Surge</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock StrideOfTheElementsModal
vi.mock('./modals/StrideOfTheElementsModal.jsx', () => ({
  default: ({ action, playerStats: _ps, campaignName: _cn, onConfirm, onClose }) => (
    <div data-testid="stride-of-the-elements-modal">
      <span>{action?.name || 'Stride of the Elements'}</span>
      <button onClick={() => onConfirm('Ice Walk', { effect: 'ice_walk' })}>Confirm Ice Walk</button>
      <button onClick={() => onConfirm('+10 Speed', { effect: 'speed_boost' })}>Confirm Speed</button>
      <button onClick={() => onConfirm('Fly Speed', { effect: 'fly_speed' })}>Confirm Fly</button>
      <button onClick={() => onConfirm('Teleport 30 ft', { effect: 'teleport' })}>Confirm Teleport</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock ElementalEpitomeModal
vi.mock('./modals/ElementalEpitomeModal.jsx', () => ({
  default: ({ action, playerStats: _ps, campaignName: _cn, currentResistance: _cr, onConfirm, onClose }) => (
    <div data-testid="elemental-epitome-modal">
      <span>{action?.name || 'Elemental Epitome'}</span>
      <button onClick={() => onConfirm({ description: 'Elemental Epitome activated.' })}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock DestructiveStrideModal
vi.mock('./modals/DestructiveStrideModal.jsx', () => ({
  default: ({ action, playerStats: _ps, campaignName: _cn, onConfirm, onClose }) => (
    <div data-testid="destructive-stride-modal">
      <span>{action?.name || 'Destructive Stride'}</span>
      <button onClick={() => onConfirm({ type: 'modal', modalName: 'destructiveStrideTarget', payload: { targets: [{ name: 'Enemy1' }] } })}>Confirm Target</button>
      <button onClick={() => onConfirm({ type: 'popup', payload: { name: 'Destructive Stride', description: 'Struck target.' } })}>Confirm Popup</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock SecondaryTargetModal
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: ({ title, icon: _icon, targets, description, confirmLabel, confirmIcon: _ci, onTargetSelected, onSkip }) => (
    <div data-testid="secondary-target-modal">
      <span>{title}</span>
      {description && <p>{description}</p>}
      <button onClick={() => onTargetSelected(targets[0]?.name)}>{confirmLabel}</button>
      <button onClick={onSkip}>Skip</button>
    </div>
  ),
}));

// Mock QuiveringPalmModal
vi.mock('./modals/QuiveringPalmModal.jsx', () => ({
  default: ({ onClose }) => (
    <div data-testid="quivering-palm-modal">
      <span>Quivering Palm</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock StepsOfTheFeyTauntModal
vi.mock('./modals/StepsOfTheFeyTauntModal.jsx', () => ({
  default: ({ onClose }) => (
    <div data-testid="steps-of-the-fey-taunt-modal">
      <span>Steps of the Fey Taunt</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock HurlThroughHellModal
vi.mock('./modals/HurlThroughHellModal.jsx', () => ({
  default: ({ onClose }) => (
    <div data-testid="hurl-through-hell-modal">
      <span>Hurl Through Hell</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock ClairvoyantCombatantModal
vi.mock('./modals/ClairvoyantCombatantModal.jsx', () => ({
  default: ({ onClose }) => (
    <div data-testid="clairvoyant-combatant-modal">
      <span>Clairvoyant Combatant</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock CreatureSelectionModal
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: ({ title, confirmLabel, description, note, onConfirm, onSkip, targets }) => (
    <div data-testid="creature-selection-modal">
      <span>{title}</span>
      {description && <p>{description}</p>}
      {note && <p>{note}</p>}
      <button onClick={() => onConfirm && onConfirm(targets.map(t => t.name))}>{confirmLabel}</button>
      <button onClick={onSkip}>Skip</button>
    </div>
  ),
}));

// Mock SingleResistanceSelectionModal
vi.mock('./modals/SingleResistanceSelectionModal.jsx', () => ({
  default: ({ onClose }) => (
    <div data-testid="single-resistance-modal">
      <span>Single Resistance</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock MultiResistanceSelectionModal
vi.mock('./modals/MultiResistanceSelectionModal.jsx', () => ({
  default: ({ title, icon: _icon, damageTypes: _dt, existingTypes: _et, maxSelections: _ms, action: _a, playerStats: _ps, campaignName: _cn, onConfirm, onClose }) => (
    <div data-testid="multi-resistance-modal">
      <span>{title}</span>
      <button onClick={() => onConfirm && onConfirm(['fire', 'cold'])}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock FeatureChoiceModal
vi.mock('./FeatureChoiceModal.jsx', () => ({
  default: ({ featureChoiceModal, handleFeatureChoiceConfirm, handleFeatureChoiceSkip }) => (
    <div data-testid="feature-choice-modal">
      <span>{featureChoiceModal?.action?.name || 'Feature Choice'}</span>
      {featureChoiceModal?.options?.map((opt) => (
        <button key={opt} onClick={() => handleFeatureChoiceConfirm(opt)}>{opt}</button>
      ))}
      <button onClick={handleFeatureChoiceSkip}>Cancel</button>
    </div>
  ),
}));

// Mock AspectOfTheWildsModal
vi.mock('./AspectOfTheWildsModal.jsx', () => ({
  default: ({ aspectOfTheWildsModal: _aspectOfTheWildsModal, handleAspectOfTheWildsConfirm, handleAspectOfTheWildsSkip }) => (
    <div data-testid="aspect-of-the-wilds-modal">
      <span>Choose an animal aspect:</span>
      <button onClick={() => handleAspectOfTheWildsConfirm('Owl')}>Owl</button>
      <button onClick={() => handleAspectOfTheWildsConfirm('Panther')}>Panther</button>
      <button onClick={() => handleAspectOfTheWildsConfirm('Salmon')}>Salmon</button>
      <button onClick={handleAspectOfTheWildsSkip}>Cancel</button>
    </div>
  ),
}));

// Mock renderMarkdownInline
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  renderMarkdown: vi.fn((md) => md),
  renderMarkdownInline: vi.fn((md) => md),
}));

// Mock fighting styles
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([
    { name: 'Great Weapon Fighting', description: 'When you roll damage for an attack you make with a Melee weapon that you are holding with two hands, you can treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property to gain this benefit.' },
    { name: 'Interception', description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to reduce the damage by 1d10 + your proficiency bonus.' },
    { name: 'Protection', description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll.' },
    { name: 'Two-Weapon Fighting', description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the bonus attack.' },
  ])),
}));

// Mock the handler functions called by modal confirm callbacks
vi.mock('../../services/automation/handlers/class-wizard/signatureSpellsHandler.js', () => ({
  onSignatureSpellsSelected: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-wizard/spellMasteryHandler.js', () => ({
  onSpellMasterySelected: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-wizard/SavantHandler.js', () => ({
  onSavantSelected: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-ranger/defensiveTacticsHandler.js', () => ({
  applyChoice: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-ranger/hunterPreyHandler.js', () => ({
  applyChoice: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-wizard/portentHandler.js', () => ({
  applyPortentChoice: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Portent', description: 'Die applied.' } })),
}));

vi.mock('../../services/automation/handlers/class-warlock/tempTeleportHandler.js', () => ({
  confirmTeleport: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Moonlight Step', description: 'Teleported.' } })),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(async (creatureName, amount, _campaign) => {
    mockRuntimeStore[`${creatureName}_tempHp`] = amount;
    return amount;
  }),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpBuffHandler.js', () => ({
  confirmBolsteringPerformance: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Bolstering Performance', description: 'Allies inspired.' } })),
}));

vi.mock('../../services/automation/handlers/buffs/encouragingSongHandler.js', () => ({
  confirmEncouragingSong: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Encouraging Song', description: 'Allies inspired.' } })),
  skipEncouragingSong: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Encouraging Song', description: 'Skipped.' } })),
}));

vi.mock('../../services/automation/handlers/reactions/boonOfEnergyResistanceHandler.js', () => ({
  applyTypeChoice: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Boon of Energy', description: 'Resistances chosen.' } })),
}));

vi.mock('../../services/automation/handlers/combat/destructiveStrideHandler.js', () => ({
  applyTargetChoice: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Destructive Stride', description: 'Struck target.' } })),
}));

// Mock runtime state
const mockRuntimeStore = {};

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, runtimeKey) => mockRuntimeStore[runtimeKey] ?? null),
  setRuntimeValue: vi.fn((_key, runtimeKey, value, _campaign) => {
    mockRuntimeStore[runtimeKey] = value;
    return Promise.resolve();
  }),
  useRuntimeValue: vi.fn((_key, runtimeKey) => mockRuntimeStore[runtimeKey] ?? null),
}));

// Mock DiceRollContext — capture popup content for assertion
let capturedPopup = null;
vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({
    setPopupHtml: (html) => { capturedPopup = html; },
  })),
}));

// Mock useCombatSuperiorityModal
vi.mock('../../hooks/combat/useCombatSuperiorityModal.js', () => ({
  useCombatSuperiorityModal: vi.fn(() => ({
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleCombatSuperiorityReopenSelection: vi.fn(),
  })),
}));

// Mock useLoggedDiceRoll
vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

// Mock log service
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// Mock normalizeAutoDamage / resolveAttackDamageStandalone
vi.mock('./useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn(() => ({ attack: {}, ctx: {} })),
  resolveAttackDamageStandalone: vi.fn(() => Promise.resolve()),
}));

// Mock getCombatContext
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

// Import mocked modules for use with vi.mocked()
import { executeHandler } from '../../services/automation/index.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const basePlayerStats = {
  name: 'TestCharacter',
  specialActions: [],
  class: {
    fightingStyles: [],
  },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
  proficiency: 2,
};

function createPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

describe('CharSpecialActions - Inline Modal Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = null;
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
  });

  describe('Moonlight Step Fallback', () => {
    it('renders inline Moonlight Step fallback modal with correct structure', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'moonlightStepFallback',
        payload: {
          action: { name: 'Moonlight Step' },
          slotLevel: 3,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Moonlight Step', description: 'Teleport using Moonlight Step.', automation: { type: 'teleport', effect: 'moonlight_step_teleport' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Moonlight Step/)[0]);

      await waitFor(() => {
        expect(screen.getByText(/Consume a level 3 spell slot/)).toBeInTheDocument();
      });
    });

    it('closes modal when No button is clicked', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'moonlightStepFallback',
        payload: {
          action: { name: 'Moonlight Step' },
          slotLevel: 3,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Moonlight Step', description: 'Teleport using Moonlight Step.', automation: { type: 'teleport', effect: 'moonlight_step_teleport' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Moonlight Step/)[0]);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const noButton = buttons.find(b => b.textContent.includes('No') && !b.textContent.includes('Moonlight'));
        expect(noButton).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const noButton = buttons.find(b => b.textContent.includes('No') && !b.textContent.includes('Moonlight'));
      fireEvent.click(noButton);

      await waitFor(() => {
        expect(screen.queryByText(/Consume a level 3 spell slot/)).not.toBeInTheDocument();
      });
    });

    it('calls confirmTeleport when Yes button is clicked', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'moonlightStepFallback',
        payload: {
          action: { name: 'Moonlight Step' },
          slotLevel: 3,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Moonlight Step', description: 'Teleport using Moonlight Step.', automation: { type: 'teleport', effect: 'moonlight_step_teleport' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Moonlight Step/)[0]);

      await waitFor(() => {
        expect(screen.getByText('Yes, Consume Slot')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Yes, Consume Slot'));

      await waitFor(() => {
        expect(screen.queryByText(/Consume a level 3 spell slot/)).not.toBeInTheDocument();
      });
    });

  });

  describe('Portent Modal', () => {

    it('shows the original roll calculation in the Portent modal', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'portentDiceChoice',
        payload: {
          targetName: 'Goblin',
          eventType: 'attack',
          eventData: { d20: 15, bonus: 3, hit: true },
          diceOptions: [3, 7],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Portent', description: 'Replace a roll.', automation: { type: 'portent' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Portent/)[0]);

      await waitFor(() => {
        expect(screen.getByText(/d20\(15\) \+ 3 = 18/)).toBeInTheDocument();
        expect(screen.getByText(/Hit/)).toBeInTheDocument();
      });
    });


    it('applies portent choice when a die is selected', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'portentDiceChoice',
        payload: {
          targetName: 'Goblin',
          eventType: 'attack',
          eventData: { d20: 15, bonus: 3, hit: true },
          diceOptions: [3, 7],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Portent', description: 'Replace a roll.', automation: { type: 'portent' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Portent/));

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('3'));

      await waitFor(() => {
        expect(screen.queryByText(/Choose a foretelling roll/)).not.toBeInTheDocument();
      });
    });
  });


  describe('Celestial Resilience', () => {
    it('renders CreatureSelectionModal for celestialResilience with correct labels', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'celestialResilienceModal',
        payload: {
          action: { name: 'Celestial Resilience' },
          creatureTargets: [{ name: 'Ally1' }, { name: 'Ally2' }],
          maxTargets: 5,
          selfTempHp: 10,
          allyTempHp: 5,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Celestial Resilience', description: 'Grant temp HP to allies.', automation: { type: 'celestial_resilience' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Celestial Resilience/)[0]);

      await waitFor(() => {
        expect(screen.getByText('Celestial Resilience')).toBeInTheDocument();
        expect(screen.getByText('Choose up to 5 allies to gain temporary hit points from your Celestial Resilience.')).toBeInTheDocument();
        expect(screen.getByText(/Each selected ally gains 5 temporary hit points/)).toBeInTheDocument();
        expect(screen.getByText('Grant Resilience')).toBeInTheDocument();
      });
    });

  });

  describe('Fiendish Resilience', () => {

    it('closes fiendish resilience modal when onClose is called', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'fiendishResilience',
        payload: {
          action: { name: 'Fiendish Resilience' },
          damageTypes: ['Fire', 'Cold'],
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Fiendish Resilience', description: 'Choose a damage resistance.', automation: { type: 'fiendish_resilience' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Fiendish Resilience/)[0]);

      await waitFor(() => {
        expect(screen.getByTestId('single-resistance-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('single-resistance-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Feature Choice Modal', () => {
    it('renders FeatureChoiceModal with options when defensive_tactics has no choice yet', async () => {
      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Defensive Tactics', description: 'Choose a defense.', automation: { type: 'defensive_tactics' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(/Defensive Tactics/)[0]);

      await waitFor(() => {
        expect(screen.getByTestId('feature-choice-modal')).toBeInTheDocument();
        expect(screen.getByText('Escape the Horde')).toBeInTheDocument();
        expect(screen.getByText('Multiattack Defense')).toBeInTheDocument();
      });
    });

  });

  describe('Aspect of the Wilds Modal', () => {
    it('renders AspectOfTheWildsModal with animal choices', async () => {
      mockRuntimeStore.aspectOfTheWildsUsedThisRest = false;

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Aspect of the Wilds', description: 'Choose an animal aspect.', automation: { type: 'animal_aspect' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText('Aspect of the Wilds:'));

      await waitFor(() => {
        expect(screen.getByTestId('aspect-of-the-wilds-modal')).toBeInTheDocument();
        expect(screen.getByText('Choose an animal aspect:')).toBeInTheDocument();
        expect(screen.getByText('Owl')).toBeInTheDocument();
        expect(screen.getByText('Panther')).toBeInTheDocument();
        expect(screen.getByText('Salmon')).toBeInTheDocument();
      });
    });

    it('calls handleAspectOfTheWildsConfirm and closes modal when an aspect is selected', async () => {
      mockRuntimeStore.aspectOfTheWildsUsedThisRest = false;
      mockRuntimeStore.activeBuffs = [];

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Aspect of the Wilds', description: 'Choose an animal aspect.', automation: { type: 'animal_aspect' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText('Aspect of the Wilds:'));

      await waitFor(() => {
        expect(screen.getByTestId('aspect-of-the-wilds-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Owl'));

      await waitFor(() => {
        expect(screen.queryByTestId('aspect-of-the-wilds-modal')).not.toBeInTheDocument();
      });

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'aspectOfTheWildsUsedThisRest', true, 'test');
      expect(capturedPopup).toContain('Aspect of the Wilds');
      expect(capturedPopup).toContain('Owl');
    });

  });

  describe('Replenishing Meal Modal', () => {
    it('renders CreatureSelectionModal for replenishingMeal with correct labels', async () => {
      mockRuntimeStore.replenishingMeals = 2;

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Replenishing Meal', description: 'Distribute meals.', automation: { type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' } },
        ],
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' },
          ],
        },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[{ name: 'Ally1' }]} />);

      fireEvent.click(screen.getByText(/Replenishing Meal/));

      await waitFor(() => {
        expect(screen.getByText('Replenishing Meal')).toBeInTheDocument();
        expect(screen.getByText('Choose creatures to receive a replenishing meal.')).toBeInTheDocument();
        expect(screen.getByText(/Each creature can hold at most 1 meal/)).toBeInTheDocument();
        expect(screen.getByText('Distribute Meals')).toBeInTheDocument();
      });
    });

    it('closes replenishing meal modal when skip is clicked', async () => {
      mockRuntimeStore.replenishingMeals = 2;

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Replenishing Meal', description: 'Distribute meals.', automation: { type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' } },
        ],
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' },
          ],
        },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[{ name: 'Ally1' }]} />);

      fireEvent.click(screen.getByText(/Replenishing Meal/));

      await waitFor(() => {
        expect(screen.getByText('Replenishing Meal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Skip'));

      await waitFor(() => {
        expect(screen.queryByText('Replenishing Meal')).not.toBeInTheDocument();
      });
    });

    it('shows popup when no meals remaining', async () => {
      mockRuntimeStore.replenishingMeals = 0;

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Replenishing Meal', description: 'Distribute meals.', automation: { type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' } },
        ],
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' },
          ],
        },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Replenishing Meal/));

      await waitFor(() => {
        expect(capturedPopup).toContain('No meals remaining');
      });
    });
  });

  describe('Bolstering Treats Modal', () => {
    it('renders CreatureSelectionModal for bolsteringTreats with correct labels', async () => {
      mockRuntimeStore.chefBolsteringTreats = 2;

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Bolstering Treats', description: 'Distribute treats.', automation: { type: 'temp_hp_buff', craftCount: true } },
        ],
        automation: {
          specialActions: [
            { type: 'temp_hp_buff', name: 'Bolstering Treats' },
          ],
        },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[{ name: 'Ally1' }]} />);

      fireEvent.click(screen.getByText(/Bolstering Treats/));

      await waitFor(() => {
        expect(screen.getByText('Bolstering Treats')).toBeInTheDocument();
        expect(screen.getByText('Choose creatures to receive a bolstering treat.')).toBeInTheDocument();
        expect(screen.getByText('Distribute Treats')).toBeInTheDocument();
      });
    });

    it('closes bolstering treats modal when skip is clicked', async () => {
      mockRuntimeStore.chefBolsteringTreats = 2;

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Bolstering Treats', description: 'Distribute treats.', automation: { type: 'temp_hp_buff', craftCount: true } },
        ],
        automation: {
          specialActions: [
            { type: 'temp_hp_buff', name: 'Bolstering Treats' },
          ],
        },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[{ name: 'Ally1' }]} />);

      fireEvent.click(screen.getByText(/Bolstering Treats/));

      await waitFor(() => {
        expect(screen.getByText('Bolstering Treats')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Skip'));

      await waitFor(() => {
        expect(screen.queryByText('Bolstering Treats')).not.toBeInTheDocument();
      });
    });

    it('shows popup when no treats remaining', async () => {
      mockRuntimeStore.chefBolsteringTreats = 0;

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Bolstering Treats', description: 'Distribute treats.', automation: { type: 'temp_hp_buff', craftCount: true } },
        ],
        automation: {
          specialActions: [
            { type: 'temp_hp_buff', name: 'Bolstering Treats' },
          ],
        },
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText(/Bolstering Treats/));

      await waitFor(() => {
        expect(capturedPopup).toContain('No treats remaining');
      });
    });
  });

  describe('Bolstering Performance Modal', () => {

    it('closes bolstering performance modal when skip is clicked', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'bolsteringPerformanceTarget',
        payload: {
          action: { name: 'Bolstering Performance' },
          playerStats: createPlayerStats(),
          campaignName: 'test',
          creatureTargets: [{ name: 'Ally1' }],
          maxTargets: 6,
          tempHp: 5,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Bolstering Performance', description: 'Inspire allies.', automation: { type: 'temp_hp_buff' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText('Bolstering Performance:'));

      await waitFor(() => {
        expect(screen.getByText('Bolstering Performance')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Skip'));

      await waitFor(() => {
        expect(screen.queryByText('Bolstering Performance')).not.toBeInTheDocument();
      });
    });
  });

  describe('Encouraging Song Modal', () => {
    it('renders CreatureSelectionModal for encouragingSong with correct labels', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'encouragingSongTarget',
        payload: {
          action: { name: 'Encouraging Song' },
          playerStats: createPlayerStats(),
          campaignName: 'test',
          creatureTargets: [{ name: 'Ally1' }],
          maxTargets: 2,
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Encouraging Song', description: 'Sing to allies.', automation: { type: 'heroic_inspiration_buff' } },
        ],
      });
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getByText('Encouraging Song:'));

      await waitFor(() => {
        expect(screen.getByText('Encouraging Song')).toBeInTheDocument();
        expect(screen.getByText('Choose up to your Proficiency Bonus allies to hear your song and gain Heroic Inspiration.')).toBeInTheDocument();
        expect(screen.getByText('Inspire')).toBeInTheDocument();
      });
    });

  });

  describe('executeHandler null/undefined handling', () => {
    it.each([
      { name: 'Destructive Stride', automation: { type: 'destructive_stride' }, testId: 'destructive-stride-modal' },
      { name: 'Portent', automation: { type: 'portent' }, testId: 'portent-modal' },
    ])('handles executeHandler returning null/undefined silently without opening $name modal', async ({ name, automation, testId }) => {
      executeHandler.mockResolvedValue(null);

      const playerStats = createPlayerStats({
        specialActions: [
          { name, description: `${name} description.`, automation },
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(new RegExp(name))[0]);

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });

      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    });
  });
});
