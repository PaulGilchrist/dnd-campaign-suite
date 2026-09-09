// CLA-368 regression: the Special Actions "Twinkling Constellations:" row must
// be clickable, dispatch twinklingConstellationHandler, open the constellation
// chooser modal, and apply the chosen constellation via the twinkling applier
// (previously the row rendered inert <b className=""> with no onClick — the
// downstream modal→apply plumbing was dead code).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpecialActions from './CharSpecialActions.jsx';

// Mock executeHandler
vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

// Mock automation service — twinkling_constellations must be interactive
vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn((action) => !!(action?.automation)),
  isInteractiveAutomation: vi.fn((action) => {
    if (!action?.automation) return false;
    const auto = Array.isArray(action.automation) ? action.automation[0] : action.automation;
    const interactiveTypes = ['twinkling_constellations'];
    return interactiveTypes.includes(auto.type);
  }),
}));

// Mock the twinkling applier (asserted as the modal's applyOption prop)
vi.mock('../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js', () => ({
  handle: vi.fn(),
  applyConstellationOption: vi.fn(() => Promise.resolve({
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Twinkling Constellations',
      description: 'Dragon constellation chosen (Twinkling Constellations).',
    },
  })),
}));

// Stub the constellation chooser modal
vi.mock('./modals/ConstellationSelectionModal.jsx', () => ({
  default: ({ action, playerStats, campaignName, applyOption, onConfirm, onClose }) => (
    <div data-testid="constellation-modal" className="sp-overlay">
      <div className="sp-modal">
        <div className="sp-header">{action?.name || 'Constellations'}</div>
        <div className="sp-body">
          {['Archer', 'Chalice', 'Dragon'].map((opt) => (
            <button key={opt} className="sp-roll-btn" onClick={() => { applyOption(action, playerStats, campaignName, opt); onConfirm(opt); }}>
              {opt}
            </button>
          ))}
        </div>
        <div className="sp-actions">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  ),
}));

// Mock modals rendered by CharSpecialActionsModals (harness parity with sibling tests)
vi.mock('./modals/TeleportModal.jsx', () => ({ default: () => <div data-testid="teleport-modal">Teleport</div> }));
vi.mock('./modals/arcane/SignatureSpellsModal.jsx', () => ({ default: () => <div data-testid="signature-spells-modal">Signature Spells</div> }));
vi.mock('./modals/arcane/SpellMasteryModal.jsx', () => ({ default: () => <div data-testid="spell-mastery-modal">Spell Mastery</div> }));
vi.mock('./modals/arcane/SavantModal.jsx', () => ({ default: () => <div data-testid="savant-modal">Savant</div> }));
vi.mock('./modals/WeaponKindMasteryModal.jsx', () => ({ default: () => <div data-testid="weapon-kind-mastery-modal">Weapon Kind Mastery</div> }));
vi.mock('./modals/WeaponMasteryChoiceModal.jsx', () => ({ default: () => <div data-testid="weapon-mastery-choice-modal">Weapon Mastery Choice</div> }));
vi.mock('./modals/CombatSuperiorityModal.jsx', () => ({ default: () => <div data-testid="combat-superiority-modal">Combat Superiority</div> }));
vi.mock('./modals/ResourcePoolModal.jsx', () => ({ default: () => <div data-testid="resource-pool-modal">Resource Pool</div> }));
vi.mock('./modals/NaturalRecoveryModal.jsx', () => ({ default: () => <div data-testid="natural-recovery-modal">Natural Recovery</div> }));
vi.mock('./modals/CircleOfTheLandSpellsModal.jsx', () => ({ default: () => <div data-testid="circle-of-the-land-modal">Circle Spells</div> }));
vi.mock('./modals/ElementalAffinityModal.jsx', () => ({ default: () => <div data-testid="elemental-affinity-modal">Elemental Affinity</div> }));
vi.mock('./modals/WildMagicSurgeModal.jsx', () => ({ default: () => <div data-testid="wild-magic-surge-modal">Wild Magic Surge</div> }));
vi.mock('./modals/StrideOfTheElementsModal.jsx', () => ({ default: () => <div data-testid="stride-modal">Stride of the Elements</div> }));
vi.mock('./modals/ElementalEpitomeModal.jsx', () => ({ default: () => <div data-testid="epitome-modal">Elemental Epitome</div> }));
vi.mock('./modals/DestructiveStrideModal.jsx', () => ({ default: () => <div data-testid="destructive-stride-modal">Destructive Stride</div> }));
vi.mock('./modals/QuiveringPalmModal.jsx', () => ({ default: () => <div data-testid="quivering-palm-modal">Quivering Palm</div> }));
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({ default: () => <div data-testid="secondary-target-modal">Secondary Target</div> }));
vi.mock('./modals/StepsOfTheFeyTauntModal.jsx', () => ({ default: () => <div data-testid="steps-of-the-fey-modal">Steps of the Fey Taunt</div> }));
vi.mock('./modals/MistyWandererModal.jsx', () => ({ default: () => <div data-testid="misty-wanderer-modal">Misty Wanderer</div> }));
vi.mock('./modals/HurlThroughHellModal.jsx', () => ({ default: () => <div data-testid="hurl-through-hell-modal">Hurl Through Hell</div> }));
vi.mock('./modals/ClairvoyantCombatantModal.jsx', () => ({ default: () => <div data-testid="clairvoyant-combatant-modal">Clairvoyant Combatant</div> }));
vi.mock('./modals/FeyReinforcementsModal.jsx', () => ({ default: () => <div data-testid="fey-reinforcements-modal">Fey Reinforcements</div> }));
vi.mock('./modals/FiendishLegacyModal.jsx', () => ({ default: () => <div data-testid="fiendish-legacy-modal">Fiendish Legacy</div> }));
vi.mock('./modals/SingleResistanceSelectionModal.jsx', () => ({ default: () => <div data-testid="single-resistance-modal">Single Resistance</div> }));
vi.mock('./modals/MultiResistanceSelectionModal.jsx', () => ({ default: () => <div data-testid="multi-resistance-modal">Multi Resistance</div> }));
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({ default: () => <div data-testid="creature-selection-modal">Creature Selection</div> }));
vi.mock('./FeatureChoiceModal.jsx', () => ({ default: () => <div data-testid="feature-choice-modal">Feature Choice</div> }));
vi.mock('./ElfisLineageModal.jsx', () => ({ default: () => <div data-testid="elfish-lineage-modal">Elfish Lineage</div> }));
vi.mock('./GnomishLineageModal.jsx', () => ({ default: () => <div data-testid="gnomish-lineage-modal">Gnomish Lineage</div> }));
vi.mock('./AspectOfTheWildsModal.jsx', () => ({ default: () => <div data-testid="aspect-of-the-wilds-modal">Aspect of the Wilds</div> }));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
  renderMarkdown: vi.fn((md) => md),
  renderMarkdownInline: vi.fn((md) => md),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadFightingStyles: vi.fn(() => Promise.resolve([])),
}));

const runtimeStore = {};
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, runtimeKey) => runtimeStore[runtimeKey] ?? null),
  setRuntimeValue: vi.fn((_key, runtimeKey, value, _campaign) => {
    runtimeStore[runtimeKey] = value;
    return Promise.resolve();
  }),
  useRuntimeValue: vi.fn((_key, runtimeKey) => runtimeStore[runtimeKey] ?? null),
}));

let _capturedPopup = null;
vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({
    setPopupHtml: (html) => { _capturedPopup = html; },
  })),
}));

vi.mock('../../hooks/combat/useCombatSuperiorityModal.js', () => ({
  useCombatSuperiorityModal: vi.fn(() => ({
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleCombatSuperiorityReopenSelection: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
  })),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn(() => ({ attack: {}, ctx: {} })),
  resolveAttackDamageStandalone: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

import { executeHandler } from '../../services/automation/index.js';
import { applyConstellationOption } from '../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js';

const basePlayerStats = {
  name: 'StarDruid',
  level: 20,
  specialActions: [],
  class: { fightingStyles: [] },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
  proficiency: 6,
};

function makeTwinklingRow() {
  return {
    name: 'Twinkling Constellations',
    description: 'At the start of each of your turns you can change constellation.',
    automation: { type: 'twinkling_constellations', options: ['Archer', 'Chalice', 'Dragon'], casting_time: 'passive', hasAutomation: true },
  };
}

describe('CharSpecialActions - Twinkling Constellations row (CLA-368)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _capturedPopup = null;
    Object.keys(runtimeStore).forEach(k => delete runtimeStore[k]);
  });

  it('renders the row clickable and opens the constellation chooser on click', async () => {
    const row = makeTwinklingRow();
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'twinklingConstellation',
      payload: { action: row, playerStats: basePlayerStats, campaignName: 'test' },
    });

    render(<CharSpecialActions playerStats={{ ...basePlayerStats, specialActions: [row] }} campaignName="test" />);

    const label = screen.getByText('Twinkling Constellations:');
    expect(label.className).toBe('clickable');

    fireEvent.click(label);

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalled();
      expect(screen.getByTestId('constellation-modal')).toBeInTheDocument();
    });
  });

  it('applies the chosen constellation through the twinkling applier', async () => {
    const row = makeTwinklingRow();
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'twinklingConstellation',
      payload: { action: row, playerStats: basePlayerStats, campaignName: 'test' },
    });

    render(<CharSpecialActions playerStats={{ ...basePlayerStats, specialActions: [row] }} campaignName="test" />);

    fireEvent.click(screen.getByText('Twinkling Constellations:'));
    await waitFor(() => expect(screen.getByTestId('constellation-modal')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Dragon'));

    await waitFor(() => {
      expect(applyConstellationOption).toHaveBeenCalledWith(row, basePlayerStats, 'test', 'Dragon');
    });
  });

  it('closes the chooser on cancel without applying', async () => {
    const row = makeTwinklingRow();
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'twinklingConstellation',
      payload: { action: row, playerStats: basePlayerStats, campaignName: 'test' },
    });

    render(<CharSpecialActions playerStats={{ ...basePlayerStats, specialActions: [row] }} campaignName="test" />);

    fireEvent.click(screen.getByText('Twinkling Constellations:'));
    await waitFor(() => expect(screen.getByTestId('constellation-modal')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('constellation-modal')).not.toBeInTheDocument();
    });
    expect(applyConstellationOption).not.toHaveBeenCalled();
  });

  it('shows the lv<10 refusal popup without opening the chooser', async () => {
    const row = makeTwinklingRow();
    executeHandler.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Twinkling Constellations',
        description: 'Twinkling Constellations requires level 10.',
      },
    });

    render(<CharSpecialActions playerStats={{ ...basePlayerStats, specialActions: [row] }} campaignName="test" />);

    fireEvent.click(screen.getByText('Twinkling Constellations:'));

    await waitFor(() => {
      expect(_capturedPopup).toContain('requires level 10');
    });
    expect(screen.queryByTestId('constellation-modal')).not.toBeInTheDocument();
  });
});
