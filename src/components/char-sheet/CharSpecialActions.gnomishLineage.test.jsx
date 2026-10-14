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
    const interactiveTypes = [
      'teleport', 'signature_spells', 'spell_mastery', 'combat_superiority',
      'weapon_kind_mastery', 'weapon_mastery_choice', 'defensive_tactics',
      'hunter_prey', 'animal_aspect', 'passive_rule', 'temp_hp_buff',
      'brew_poison', 'stride_of_the_elements', 'elemental_epitome',
      'destructive_stride', 'quivering_palm', 'steps_of_the_fey_taunt',
      'hurl_through_hell', 'clairvoyant_combatant', 'boon_of_energy_resistance',
      'generic', 'silent', 'gnomish_lineage', 'elfish_lineage',
    ];
    if (auto.type === 'passive_rule') {
      const interactiveEffects = [
        'abjuration_savant', 'divination_savant', 'evocation_savant',
        'illusion_savant', 'bonus_healing',
      ];
      return interactiveEffects.includes(auto.effect);
    }
    return interactiveTypes.includes(auto.type);
  }),
}));

// Mock all modals that CharSpecialActionsModals renders
vi.mock('./modals/TeleportModal.jsx', () => ({
  default: ({ action, onClose }) => (
    <div data-testid="teleport-modal">
      <span>{action?.name || 'Teleport'}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('./modals/arcane/SignatureSpellsModal.jsx', () => ({
  default: ({ payload: _payload, onConfirm, onClose }) => (
    <div data-testid="signature-spells-modal" role="presentation" onClick={onClose}>
      <h3>Signature Spells</h3>
      <button onClick={() => onConfirm('Fireball', 'Haste')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('./modals/arcane/SpellMasteryModal.jsx', () => ({
  default: ({ payload: _payload, onConfirm, onClose }) => (
    <div data-testid="spell-mastery-modal" role="presentation" onClick={onClose}>
      <h3>Spell Mastery</h3>
      <button onClick={() => onConfirm('Mage Armor', 'Shield')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('./modals/arcane/SavantModal.jsx', () => ({
  default: ({ payload, onConfirm, onClose }) => (
    <div data-testid={`${payload?.school?.toLowerCase() || 'savant'}-savant-modal`} role="presentation" onClick={onClose}>
      <span>{payload?.school || 'Savant'} Savant</span>
      <button onClick={() => onConfirm(payload?.spellOptions?.[0] || 'Shield', payload?.spellOptions?.[1] || 'Mage Armor')}>Confirm</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('./modals/WeaponKindMasteryModal.jsx', () => ({
  default: ({ action, onClose }) => (
    <div data-testid="weapon-kind-mastery-modal">
      <span>{action?.name || 'Weapon Kind Mastery'}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('./modals/WeaponMasteryChoiceModal.jsx', () => ({
  default: ({ action: _action, onClose, onConfirm }) => (
    <div data-testid="weapon-mastery-choice-modal">
      <span>Weapon Mastery Choice</span>
      <button onClick={onClose}>Close</button>
      <button onClick={() => onConfirm && onConfirm('Finesse')}>Confirm</button>
    </div>
  ),
}));

vi.mock('./modals/CombatSuperiorityModal.jsx', () => ({
  default: ({ _payload, onConfirm, _onReopenSelection, _onClose }) => (
    <div data-testid="combat-superiority-modal">
      <span>Combat Superiority</span>
      <button onClick={() => onConfirm([], null)}>Close</button>
    </div>
  ),
}));

vi.mock('./modals/ResourcePoolModal.jsx', () => ({
  default: () => <div data-testid="resource-pool-modal">Resource Pool</div>,
}));

vi.mock('./modals/NaturalRecoveryModal.jsx', () => ({
  default: () => <div data-testid="natural-recovery-modal">Natural Recovery</div>,
}));

vi.mock('./modals/CircleOfTheLandSpellsModal.jsx', () => ({
  default: () => <div data-testid="circle-of-the-land-modal">Circle Spells</div>,
}));

vi.mock('./modals/ElementalAffinityModal.jsx', () => ({
  default: () => <div data-testid="elemental-affinity-modal">Elemental Affinity</div>,
}));

vi.mock('./modals/WildMagicSurgeModal.jsx', () => ({
  default: () => <div data-testid="wild-magic-surge-modal">Wild Magic Surge</div>,
}));

vi.mock('./modals/StrideOfTheElementsModal.jsx', () => ({
  default: () => <div data-testid="stride-modal">Stride of the Elements</div>,
}));

vi.mock('./modals/ElementalEpitomeModal.jsx', () => ({
  default: () => <div data-testid="epitome-modal">Elemental Epitome</div>,
}));

vi.mock('./modals/DestructiveStrideModal.jsx', () => ({
  default: () => <div data-testid="destructive-stride-modal">Destructive Stride</div>,
}));

vi.mock('./modals/QuiveringPalmModal.jsx', () => ({
  default: () => <div data-testid="quivering-palm-modal">Quivering Palm</div>,
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: () => <div data-testid="secondary-target-modal">Secondary Target</div>,
}));

vi.mock('./modals/StepsOfTheFeyTauntModal.jsx', () => ({
  default: () => <div data-testid="steps-of-the-fey-modal">Steps of the Fey Taunt</div>,
}));

vi.mock('./modals/HurlThroughHellModal.jsx', () => ({
  default: () => <div data-testid="hurl-through-hell-modal">Hurl Through Hell</div>,
}));

vi.mock('./modals/ClairvoyantCombatantModal.jsx', () => ({
  default: () => <div data-testid="clairvoyant-combatant-modal">Clairvoyant Combatant</div>,
}));

vi.mock('./modals/FeyReinforcementsModal.jsx', () => ({
  default: () => <div data-testid="fey-reinforcements-modal">Fey Reinforcements</div>,
}));

vi.mock('./modals/FiendishLegacyModal.jsx', () => ({
  default: () => <div data-testid="fiendish-legacy-modal">Fiendish Legacy</div>,
}));

vi.mock('./modals/SingleResistanceSelectionModal.jsx', () => ({
  default: () => <div data-testid="single-resistance-modal">Single Resistance</div>,
}));

vi.mock('./modals/MultiResistanceSelectionModal.jsx', () => ({
  default: () => <div data-testid="multi-resistance-modal">Multi Resistance</div>,
}));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: ({ onConfirm, onSkip }) => (
    <div data-testid="creature-selection-modal">
      <button onClick={() => onConfirm(['Ally'])}>Confirm</button>
      <button onClick={onSkip}>Skip</button>
    </div>
  ),
}));

vi.mock('./FeatureChoiceModal.jsx', () => ({
  default: ({ featureChoiceModal, handleFeatureChoiceConfirm, handleFeatureChoiceSkip }) => (
    <div data-testid="feature-choice-modal">
      <button onClick={() => handleFeatureChoiceConfirm(featureChoiceModal?.options?.[0] || 'Option')}>Confirm</button>
      <button onClick={handleFeatureChoiceSkip}>Skip</button>
    </div>
  ),
}));

vi.mock('./ElfisLineageModal.jsx', () => ({
  default: ({ elfishLineageModal, handleElfisLineageConfirm, handleElfisLineageSkip }) => (
    <div data-testid="elfish-lineage-modal" className="sp-overlay" onClick={handleElfisLineageSkip}>
      <div className="sp-modal">
        <div className="sp-header">{elfishLineageModal?.action?.name || 'Elfish Lineage'}</div>
        <div className="sp-body">
          {elfishLineageModal?.action?.automation?.options?.map((opt) => {
            const optName = typeof opt === 'string' ? opt : opt.name;
            return (
              <button
                key={optName}
                className="sp-roll-btn"
                onClick={() => handleElfisLineageConfirm(optName, elfishLineageModal?.playerStats, elfishLineageModal?.campaignName)}
              >
                {optName}
              </button>
            );
          })}
        </div>
        <div className="sp-actions">
          <button onClick={handleElfisLineageSkip}>Cancel</button>
        </div>
      </div>
    </div>
  ),
}));

vi.mock('./GnomishLineageModal.jsx', () => ({
  default: ({ gnomishLineageModal, handleGnomishLineageConfirm, handleGnomishLineageSkip }) => (
    <div data-testid="gnomish-lineage-modal" className="sp-overlay" onClick={handleGnomishLineageSkip}>
      <div className="sp-modal">
        <div className="sp-header">{gnomishLineageModal?.action?.name || 'Gnomish Lineage'}</div>
        <div className="sp-body">
          {gnomishLineageModal?.action?.automation?.options?.map((opt) => {
            const optName = typeof opt === 'string' ? opt : opt.name;
            return (
              <button
                key={optName}
                className="sp-roll-btn"
                onClick={() => handleGnomishLineageConfirm(optName, gnomishLineageModal?.playerStats, gnomishLineageModal?.campaignName)}
              >
                {optName}
              </button>
            );
          })}
        </div>
        <div className="sp-actions">
          <button onClick={handleGnomishLineageSkip}>Cancel</button>
        </div>
      </div>
    </div>
  ),
}));

vi.mock('./AspectOfTheWildsModal.jsx', () => ({
  default: () => <div data-testid="aspect-of-the-wilds-modal">Aspect of the Wilds</div>,
}));

// Mock renderMarkdownInline
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  renderMarkdown: vi.fn((md) => md),
  renderMarkdownInline: vi.fn((md) => md),
}));

// Mock fighting styles
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([])),
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

vi.mock('../../services/automation/handlers/buffs/tempHpBuffHandler.js', () => ({
  confirmBolsteringPerformance: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/encouragingSongHandler.js', () => ({
  confirmEncouragingSong: vi.fn(),
  skipEncouragingSong: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Encouraging Song', description: 'Skipped.' } })),
}));

vi.mock('../../services/automation/handlers/reactions/boonOfEnergyResistanceHandler.js', () => ({
  applyTypeChoice: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Boon of Energy', description: 'Resistances chosen.' } })),
}));

vi.mock('../../services/automation/handlers/combat/destructiveStrideHandler.js', () => ({
  applyTargetChoice: vi.fn(() => Promise.resolve({ type: 'popup', payload: { name: 'Destructive Stride', description: 'Struck target.' } })),
}));

// Mock runtime state
const runtimeStore = {};

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, runtimeKey) => runtimeStore[runtimeKey] ?? null),
  setRuntimeValue: vi.fn((_key, runtimeKey, value, _campaign) => {
    runtimeStore[runtimeKey] = value;
    return Promise.resolve();
  }),
  useRuntimeValue: vi.fn((_key, runtimeKey) => runtimeStore[runtimeKey] ?? null),
}));

// Mock DiceRollContext
let _capturedPopup = null;
vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({
    setPopupHtml: (html) => { _capturedPopup = html; },
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

// Import mocked modules
import { executeHandler } from '../../services/automation/index.js';

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
  campaignName: 'test',
};

function createPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function createSpecialAction(name, automation) {
  return { name, description: `${name} description.`, automation };
}

describe('CharSpecialActions - Gnomish Lineage regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _capturedPopup = null;
    Object.keys(runtimeStore).forEach(k => delete runtimeStore[k]);
  });

  describe('gnomishLineage modal routing', () => {
    it('sets gnomishLineageModal state when executeHandler returns gnomishLineage modal', async () => {
      const lineageOptions = [
        { name: 'Deep Gnome', description: 'Darkvision 120 ft. + Magic Stone cantrip.' },
        { name: 'Forest Gnome', description: 'Hide behind larger creatures + Minor Illusion cantrip.' },
        { name: 'Rock Gnome', description: 'Move through larger creatures\' space + Mending cantrip.' },
      ];

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'gnomishLineage',
        payload: {
          action: { name: 'Gnomish Lineage', automation: { type: 'gnomish_lineage', options: lineageOptions } },
          playerStats: basePlayerStats,
          campaignName: 'test',
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Gnomish Lineage', { type: 'gnomish_lineage', options: lineageOptions }),
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      // Click the Gnomish Lineage action (the <b> clickable element)
      fireEvent.click(screen.getAllByText(/Gnomish Lineage/)[0]);

      await waitFor(() => {
        expect(screen.getByTestId('gnomish-lineage-modal')).toBeInTheDocument();
      });

      expect(screen.getByText('Gnomish Lineage')).toBeInTheDocument();
      expect(screen.getByText('Deep Gnome')).toBeInTheDocument();
      expect(screen.getByText('Forest Gnome')).toBeInTheDocument();
      expect(screen.getByText('Rock Gnome')).toBeInTheDocument();
    });

    it('calls confirmGnomishLineage when a lineage option is clicked', async () => {
      const lineageOptions = [
        { name: 'Deep Gnome', description: 'Darkvision 120 ft. + Magic Stone cantrip.' },
        { name: 'Forest Gnome', description: 'Hide behind larger creatures + Minor Illusion cantrip.' },
        { name: 'Rock Gnome', description: 'Move through larger creatures\' space + Mending cantrip.' },
      ];

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'gnomishLineage',
        payload: {
          action: { name: 'Gnomish Lineage', automation: { type: 'gnomish_lineage', options: lineageOptions } },
          playerStats: basePlayerStats,
          campaignName: 'test',
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Gnomish Lineage', { type: 'gnomish_lineage', options: lineageOptions }),
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      // Click the Gnomish Lineage action to open the modal (the <b> clickable element)
      fireEvent.click(screen.getAllByText(/Gnomish Lineage/)[0]);

      await waitFor(() => {
        expect(screen.getByTestId('gnomish-lineage-modal')).toBeInTheDocument();
      });

      // Click a lineage option
      fireEvent.click(screen.getByText('Deep Gnome'));

      await waitFor(() => {
        expect(screen.queryByTestId('gnomish-lineage-modal')).not.toBeInTheDocument();
      });

      // Verify the popup was shown with the confirmation message
      expect(_capturedPopup).toContain('Selected Deep Gnome lineage');
      expect(_capturedPopup).toContain('Spellcasting ability: Intelligence');

      // Verify runtime state was set
      expect(runtimeStore['_gnomishLineageSelection']).toBe('Deep Gnome');
      expect(runtimeStore['_gnomishLineageAbility']).toBe('Intelligence');
      expect(runtimeStore['_gnomishLineageCantrip']).toBe('Magic Stone');
      expect(runtimeStore['_gnomishLineageLevel3']).toBe('Nondetection');
      expect(runtimeStore['_gnomishLineageLevel5']).toBe('Passwall');
    });

    it('closes modal when cancel button is clicked', async () => {
      const lineageOptions = [
        { name: 'Deep Gnome', description: 'Darkvision 120 ft. + Magic Stone cantrip.' },
        { name: 'Forest Gnome', description: 'Hide behind larger creatures + Minor Illusion cantrip.' },
        { name: 'Rock Gnome', description: 'Move through larger creatures\' space + Mending cantrip.' },
      ];

      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'gnomishLineage',
        payload: {
          action: { name: 'Gnomish Lineage', automation: { type: 'gnomish_lineage', options: lineageOptions } },
          playerStats: basePlayerStats,
          campaignName: 'test',
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Gnomish Lineage', { type: 'gnomish_lineage', options: lineageOptions }),
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      // Click the Gnomish Lineage action to open the modal (the <b> clickable element)
      fireEvent.click(screen.getAllByText(/Gnomish Lineage/)[0]);

      await waitFor(() => {
        expect(screen.getByTestId('gnomish-lineage-modal')).toBeInTheDocument();
      });

      // Click cancel
      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('gnomish-lineage-modal')).not.toBeInTheDocument();
      });
    });

    it('shows popup when lineage already selected', async () => {
      runtimeStore['_gnomishLineageSelection'] = 'Forest Gnome';

      const lineageOptions = [
        { name: 'Deep Gnome', description: 'Darkvision 120 ft. + Magic Stone cantrip.' },
        { name: 'Forest Gnome', description: 'Hide behind larger creatures + Minor Illusion cantrip.' },
        { name: 'Rock Gnome', description: 'Move through larger creatures\' space + Mending cantrip.' },
      ];

      executeHandler.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Gnomish Lineage',
          description: 'Gnomish Lineage: Forest Gnome (already selected).',
          automation: { type: 'gnomish_lineage', options: lineageOptions },
        },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          createSpecialAction('Gnomish Lineage', { type: 'gnomish_lineage', options: lineageOptions }),
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      // Click the Gnomish Lineage action (the <b> clickable element)
      fireEvent.click(screen.getAllByText(/Gnomish Lineage/)[0]);

      await waitFor(() => {
        expect(_capturedPopup).toContain('Forest Gnome');
        expect(_capturedPopup).toContain('already selected');
      });
    });
  });
});
