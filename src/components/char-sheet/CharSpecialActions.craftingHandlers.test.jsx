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
    const interactiveTypes = ['teleport', 'signature_spells', 'spell_mastery', 'combat_superiority', 'weapon_kind_mastery', 'weapon_mastery_choice', 'defensive_tactics', 'hunter_prey', 'animal_aspect', 'passive_rule', 'temp_hp_buff', 'brew_poison'];
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
    { name: 'Protection', description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.' },
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

// Mock CreatureSelectionModal
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: ({ title, confirmLabel, description, onConfirm, onSkip, targets }) => (
    <div data-testid="creature-selection-modal">
      <span>{title}</span>
      {description && <p>{description}</p>}
      <button onClick={() => onConfirm && onConfirm(targets.map(t => t.name))}>{confirmLabel}</button>
      <button onClick={onSkip}>Skip</button>
    </div>
  ),
}));

// Mock getCombatContext
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

// Import mocked modules
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

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

// Feature configuration for parameterized tests — eliminates duplication between
// Replenishing Meal and Bolstering Treats which share identical interaction patterns.
const craftingFeatures = [
  {
    name: 'Replenishing Meal',
    runtimeKey: 'replenishingMeals',
    featureKey: 'replenishingMeals',
    targetRuntimeKey: 'replenishingMeals',
    automation: { type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' },
    config: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Replenishing Meal' }] },
    modalButton: 'Distribute Meals',
    modalTitle: 'Choose creatures to receive a replenishing meal.',
    singular: 'replenishing meal',
    plural: 'replenishing meals',
    noRemainingMsg: 'No meals remaining',
  },
  {
    name: 'Bolstering Treats',
    runtimeKey: 'chefBolsteringTreats',
    featureKey: 'chefBolsteringTreats',
    targetRuntimeKey: 'bolsteringTreat',
    automation: { type: 'temp_hp_buff', craftCount: true },
    config: { specialActions: [{ type: 'temp_hp_buff', name: 'Bolstering Treats' }] },
    modalButton: 'Distribute Treats',
    modalTitle: 'Choose creatures to receive a bolstering treat.',
    singular: 'bolstering treat',
    plural: 'bolstering treats',
    noRemainingMsg: 'No treats remaining',
  },
];

describe('CharSpecialActions - Crafting Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = null;
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
  });

  describe('Click handlers', () => {
    it.each(craftingFeatures)(
      'opens creature selection modal when $name count is positive',
      async ({ name, runtimeKey, automation, config, modalTitle }) => {
        mockRuntimeStore[runtimeKey] = 2;

        const playerStats = createPlayerStats({
          specialActions: [
            { name, description: 'Distribute.', automation },
          ],
          automation: config,
        });
        render(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[{ name: 'Ally1' }]} />);

        fireEvent.click(screen.getByText(new RegExp(name)));

        await waitFor(() => {
          expect(screen.getByText(name)).toBeInTheDocument();
          expect(screen.getByText(modalTitle)).toBeInTheDocument();
        });
      },
    );

    it.each(craftingFeatures)(
      'shows popup when $name count is zero',
      async ({ name, runtimeKey, automation, config, noRemainingMsg }) => {
        mockRuntimeStore[runtimeKey] = 0;

        const playerStats = createPlayerStats({
          specialActions: [
            { name, description: 'Distribute.', automation },
          ],
          automation: config,
        });
        render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

        fireEvent.click(screen.getByText(new RegExp(name)));

        await waitFor(() => {
          expect(capturedPopup).toContain(noRemainingMsg);
        });
      },
    );
  });

  describe('Confirm handlers', () => {
    it.each(craftingFeatures)(
      'distributes to single target, decrements counter, logs, and shows popup',
      async ({ name, runtimeKey, featureKey, targetRuntimeKey, automation, config, modalButton, singular }) => {
        mockRuntimeStore[runtimeKey] = 2;

        const playerStats = createPlayerStats({
          specialActions: [
            { name, description: 'Distribute.', automation },
          ],
          automation: config,
        });
        render(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[{ name: 'Ally1' }]} />);

        fireEvent.click(screen.getByText(new RegExp(name)));

        await waitFor(() => {
          expect(screen.getByText(modalButton)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(modalButton));

        await waitFor(() => {
          expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
        });

        // Verify setRuntimeValue was called to give Ally1 the resource
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', targetRuntimeKey, 1, 'test');

        // Verify the counter was decremented (2 - 1 = 1)
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', featureKey, 1, 'test');

        // Verify the log entry was created
        expect(addEntry).toHaveBeenCalledWith('test', expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCharacter',
          abilityName: name,
          description: expect.stringContaining(`distributed 1 ${singular} to Ally1`),
        }));

        // Verify the popup was shown
        expect(capturedPopup).toContain(name);
        expect(capturedPopup).toContain('1');
        expect(capturedPopup).toContain('Ally1');
      },
    );

    it.each(craftingFeatures)(
      'grants to multiple targets and decrements by the count',
      async ({ name, runtimeKey, featureKey, targetRuntimeKey, automation, config, modalButton, plural }) => {
        mockRuntimeStore[runtimeKey] = 3;

        const playerStats = createPlayerStats({
          specialActions: [
            { name, description: 'Distribute.', automation },
          ],
          automation: config,
        });
        render(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[{ name: 'Ally1' }, { name: 'Ally2' }]} />);

        fireEvent.click(screen.getByText(new RegExp(name)));

        await waitFor(() => {
          expect(screen.getByText(modalButton)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(modalButton));

        await waitFor(() => {
          expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
        });

        // Verify setRuntimeValue was called for both targets
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', targetRuntimeKey, 1, 'test');
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally2', targetRuntimeKey, 1, 'test');

        // Verify the counter was decremented by 2 (3 - 2 = 1)
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', featureKey, 1, 'test');

        // Verify plural in log and popup
        expect(addEntry).toHaveBeenCalledWith('test', expect.objectContaining({
          description: expect.stringContaining(`distributed 2 ${plural}`),
        }));
        expect(capturedPopup).toContain('2');
      },
    );

    it.each(craftingFeatures)(
      'caps distribution at maxTargets when more targets are selected',
      async ({ name, runtimeKey, featureKey, targetRuntimeKey, automation, config, modalButton }) => {
        mockRuntimeStore[runtimeKey] = 1;

        const playerStats = createPlayerStats({
          specialActions: [
            { name, description: 'Distribute.', automation },
          ],
          automation: config,
        });
        render(<CharSpecialActions playerStats={playerStats} campaignName="test" characters={[{ name: 'Ally1' }, { name: 'Ally2' }]} />);

        fireEvent.click(screen.getByText(new RegExp(name)));

        await waitFor(() => {
          expect(screen.getByText(modalButton)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(modalButton));

        await waitFor(() => {
          expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
        });

        // Only one available, so only one target should receive it
        expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', targetRuntimeKey, 1, 'test');
        // Ally2 should NOT have received a call (only 1 available)
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Ally2', targetRuntimeKey, 1, 'test');

        // Counter decremented by 1 (1 - 1 = 0)
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', featureKey, 0, 'test');
      },
    );
  });
});
