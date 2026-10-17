// @maintained-by-ai
// CharBonusActions host: pending-popup DISPLAY contract.
// When useSpellMetamagicFlow arms a pending state, this host must surface the
// right popup/modal with the right display data (spell identity, sorcery
// points, chooser title + targets) — and stay popup-free when idle.
// Click lanes live in CharBonusActions.interactive.test.jsx; the Hex/upcast
// detail-popup host is covered in CharBonusActions.spellCastFlow.test.jsx;
// Lesser Restoration/Hex target popups in CharBonusActions.lesserRestoration.test.jsx.
import { render, screen } from '@testing-library/react';
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
  rangeToFeet: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn(() => null),
}));

vi.mock('../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

// Echo the display data the host must pass through: spell identity on the
// metamagic popup, title + creature targets on the shared chooser modal.
vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((props) => (
    <div data-testid="metamagic-popup">
      {props.spell?.name} L{props.spell?.level} SP {props.playerStats?._metamagicCurrentSP}
    </div>
  )),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup">{props.spell?.name}</div>),
}));

vi.mock('./modals/HexAbilityModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="hex-ability-modal" />),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn((props) => (
    <div data-testid="secondary-target-modal">
      {props.title}
      {(props.targets || []).map((t) => <span key={t.name}>{t.name}</span>)}
    </div>
  )),
}));

vi.mock('./ArcaneVigorModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="arcane-vigor-modal">Arcane Vigor</div>),
}));

import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js';

const CAMPAIGN = 'test-campaign';

const bonusSpell = (spell) => ({
  casting_time: '1 bonus action',
  prepared: 'Prepared',
  ...spell,
});

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

function renderWithSpells(spells) {
  render(<CharBonusActions playerStats={createStats({ spellAbilities: { ...basePlayerStats.spellAbilities, spells } })} campaignName={CAMPAIGN} />);
}

// Override the metamagic-flow host with stable mocks for the keys under test.
function mockFlow(overrides = {}) {
  vi.mocked(useSpellMetamagicFlow).mockReturnValue({ ...flowShape(), ...overrides });
}

describe('CharBonusActions - pending popup display', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it.each([
    {
      label: 'surfaces the MetamagicPopup mapped from pendingMetamagic (name, level, SP)',
      pending: { spellName: 'Fireball', spellLevel: 3, _currentSP: 5 },
      shown: true,
    },
    {
      label: 'renders no popup and no chooser when the flow is idle',
      pending: null,
      shown: false,
    },
  ])('$label', ({ pending, shown }) => {
    mockFlow({ pendingMetamagic: pending });
    renderWithSpells([bonusSpell({ name: 'Shocking Grasp', level: 0, range: 'Touch' })]);

    const popup = screen.queryByTestId('metamagic-popup');
    expect(!!popup).toBe(shown);
    if (shown) {
      // Pins the host→popup data mapping, not just the popup's presence.
      expect(popup).toHaveTextContent('Fireball L3 SP 5');
    } else {
      expect(screen.queryByTestId('secondary-target-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('spell-detail-popup')).not.toBeInTheDocument();
      expect(screen.getByText('Shocking Grasp')).toBeInTheDocument();
    }
  });

  it.each([
    { pending: 'pendingBarkskin', title: 'Barkskin' },
    { pending: 'pendingHealingWord', title: 'Healing Word' },
    { pending: 'pendingSanctuary', title: 'Sanctuary' },
  ])('arms the $title target chooser when $pending is armed', ({ pending, title }) => {
    mockFlow({ [pending]: { creatureTargets: ['Ally 1', 'Ally 2'] } });
    renderWithSpells([bonusSpell({ name: title, level: 1, range: '60 ft.' })]);

    const modal = screen.getByTestId('secondary-target-modal');
    expect(modal).toHaveTextContent(title);
    expect(modal).toHaveTextContent('Ally 1');
    expect(modal).toHaveTextContent('Ally 2');
  });

  it.each([
    { spellName: 'Healing Word', spell: bonusSpell({ name: 'Healing Word', level: 1, range: '60 ft.', heal_at_slot_level: true }), label: 'Healing' },
    {
      spellName: 'Flaming Sphere',
      spell: bonusSpell({ name: 'Flaming Sphere', level: 1, range: '60 ft.', dc: { dc_type: 'DEX' }, damage: { damage_at_slot_level: { 1: '8d6' }, damage_type: 'Fire' } }),
      label: 'Fire',
    },
    { spellName: 'Misty Step', spell: bonusSpell({ name: 'Misty Step', level: 2, range: 'Self' }), label: 'Utility' },
  ])('$spellName shows $label in the Type column', ({ spell, label }) => {
    renderWithSpells([spell]);
    // Row rendered on the bonus lane, then its own type label — the healing
    // spell must not fall through to the default 'Utility' label.
    expect(screen.getByText(spell.name)).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
