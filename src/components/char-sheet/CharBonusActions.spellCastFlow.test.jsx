// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharBonusActions from './CharBonusActions.jsx';

// Full shape of the mocked useSpellMetamagicFlow return — every key the
// component destructures from the hook. Tests override only what they assert.
const { flowShape } = vi.hoisted(() => ({
  flowShape: () => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
    pendingBarkskin: null,
    handleBarkskinConfirm: vi.fn(),
    handleBarkskinSkip: vi.fn(),
    pendingHealingWord: null,
    handleHealingWordConfirm: vi.fn(),
    handleHealingWordSkip: vi.fn(),
    pendingSanctuary: null,
    handleSanctuaryConfirm: vi.fn(),
    handleSanctuarySkip: vi.fn(),
    pendingHex: null,
    handleHexConfirm: vi.fn(),
    handleHexSkip: vi.fn(),
    pendingLesserRestoration: null,
    handleLesserRestorationConfirm: vi.fn(),
    handleLesserRestorationSkip: vi.fn(),
  }),
}));

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => flowShape()),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getMultiTargetSpreadForSpell: vi.fn(() => null),
  triggerPostCastRiderSaves: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  }),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="metamagic-popup">MetamagicPopup</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => {
    return (
      <div data-testid="spell-detail-popup">
        <div data-testid="spell-name">{props.spell?.name}</div>
        <span data-testid="upcast-levels">{JSON.stringify(props.upcastLevels ?? null)}</span>
        {props.onClose && <button data-testid="close-btn" onClick={props.onClose}>Close</button>}
        {props.onCast && <button data-testid="cast-btn" onClick={() => props.onCast(props.spell, {})}>Cast</button>}
      </div>
    );
  }),
}));

vi.mock('./modals/HexAbilityModal.jsx', () => ({
  default: vi.fn((props) => (
    <div className="sp-overlay" data-testid="hex-ability-modal">
      <div className="sp-modal sp-modal--wide">
        <div className="sp-header">Hex — Choose Ability</div>
        <div className="sp-body">
          <p>Choose an ability check for the target to have disadvantage on:</p>
          <div className="hex-ability-buttons">
            <button className="hex-ability-btn" onClick={() => props.onAbilitySelected('STR')}>Strength (STR)</button>
            <button className="hex-ability-btn" onClick={() => props.onAbilitySelected('DEX')}>Dexterity (DEX)</button>
            <button className="hex-ability-btn" onClick={() => props.onAbilitySelected('CON')}>Constitution (CON)</button>
            <button className="hex-ability-btn" onClick={() => props.onAbilitySelected('INT')}>Intelligence (INT)</button>
            <button className="hex-ability-btn" onClick={() => props.onAbilitySelected('WIS')}>Wisdom (WIS)</button>
            <button className="hex-ability-btn" onClick={() => props.onAbilitySelected('CHA')}>Charisma (CHA)</button>
          </div>
        </div>
        <div className="sp-actions">
          <button className="sp-dismiss-btn" onClick={props.onCancel}>
            <i className="fa-solid fa-times"></i> Cancel
          </button>
        </div>
      </div>
    </div>
  )),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn((props) => <div data-testid="secondary-target-modal">{props.title}</div>),
}));

vi.mock('./ArcaneVigorModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="arcane-vigor-modal">Arcane Vigor</div>),
}));

vi.mock('../../services/rules/core/spellDamageUtils.js', () => ({
  resolveSpellDamageAtLevel: vi.fn(() => null),
  isAutoHitSpell: vi.fn(() => false),
  resolveHealExpression: vi.fn(() => ''),
}));

vi.mock('../../services/ui/spellSectionUtils.js', () => ({
  getBonusActionSpellNames: vi.fn(() => new Set(['Hex', 'Shocking Grasp'])),
}));

vi.mock('../../services/character/featureCategories.js', () => ({
  getCategories: vi.fn(() => ({ featuresToIgnore: ['Spellcasting'] })),
}));

vi.mock('../../hooks/combat/useSimpleDamageRoll.js', () => ({
  useSimpleDamageRoll: vi.fn(() => vi.fn()),
}));

vi.mock('../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({ resolvePositions: vi.fn().mockResolvedValue(undefined), cachedPosRef: {} })),
}));

vi.mock('../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../services/ui/formatUtils.js', () => ({
  formatRange: vi.fn((range) => range || ''),
  signFormatter: { format: (n) => (n >= 0 ? `+${n}` : `${n}`) },
  getAttackSpellLevel: vi.fn(() => null),
}));

import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js';

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  bonusActions: [],
  spellAbilities: { spells: [], modifier: 3, toHit: 7, saveDc: 15 },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

// Override the metamagic-flow host with stable mocks for the keys under test.
function mockFlow(overrides = {}) {
  vi.mocked(useSpellMetamagicFlow).mockReturnValue({ ...flowShape(), ...overrides });
}

async function openSpellDetail(spellName) {
  render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [{ name: spellName, level: 1, range: '60 ft.', casting_time: '1 bonus action', prepared: 'Prepared' }] } })} />);
  fireEvent.click(screen.getByText(spellName));
  await waitFor(() => {
    expect(screen.getByTestId('spell-detail-popup')).toBeInTheDocument();
  });
}

async function castUntilHexModal() {
  await openSpellDetail('Hex');
  fireEvent.click(screen.getByTestId('cast-btn'));
  await waitFor(() => {
    expect(screen.getByTestId('hex-ability-modal')).toBeInTheDocument();
  });
}

describe('CharBonusActions - Spell Cast Flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('opens the Hex ability chooser modal when casting Hex from the spell detail popup', async () => {
    await openSpellDetail('Hex');
    expect(screen.getByTestId('spell-name')).toHaveTextContent('Hex');
    fireEvent.click(screen.getByTestId('cast-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('hex-ability-modal')).toBeInTheDocument();
    });
  });

  it('closing the chooser without choosing an ability dismisses the modal without casting', async () => {
    const gateMetamagic = vi.fn();
    mockFlow({ gateMetamagic });
    await castUntilHexModal();
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('hex-ability-modal')).not.toBeInTheDocument();
    });
    expect(gateMetamagic).not.toHaveBeenCalled();
  });

  it('choosing an ability dismisses the chooser and gates the Hex cast with the chosen ability', async () => {
    const gateMetamagic = vi.fn();
    mockFlow({ gateMetamagic });
    await castUntilHexModal();
    fireEvent.click(screen.getByText(/Dexterity \(DEX\)/));
    await waitFor(() => {
      expect(gateMetamagic).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Hex' }),
        expect.objectContaining({ hexAbility: 'DEX' }),
      );
    });
    expect(screen.queryByTestId('hex-ability-modal')).not.toBeInTheDocument();
  });

  it('feeds the selected spell into buildUpcastLevels and surfaces the built levels in the detail popup', async () => {
    const buildUpcastLevels = vi.fn(() => [1, 2, 3]);
    vi.mocked(useSpellUpcastFlow).mockReturnValue({ buildUpcastLevels });
    render(<CharBonusActions playerStats={createStats({ spellAbilities: { spells: [{ name: 'Shocking Grasp', level: 0, range: 'Touch', casting_time: '1 bonus action', prepared: 'Prepared' }] } })} />);
    fireEvent.click(screen.getByText('Shocking Grasp'));
    await waitFor(() => {
      expect(buildUpcastLevels).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Shocking Grasp' })
      );
    });
    expect(screen.getByTestId('upcast-levels')).toHaveTextContent('[1,2,3]');
  });
});
