// @maintained-by-ai
/**
 * CharSpells — spell cast popups & innate sorcery.
 *
 * Owns the single-entry cast seam (SpellDetailPopup → handleSpellCast →
 * gateMetamagic): popup closes, position resolves before gating, the gate
 * is hit exactly once with the popup's cast metadata, and prepareSpellCast
 * never runs from JSX. Plus the auto-damage callback CharSpells hands to
 * useLoggedDiceRoll, the Words of Creation secondary-target modal round-trip
 * (flow setter → wordsOfCreationTarget state → SecondaryTargetModal), and
 * the innate sorcery save-DC / spell-attack-advantage rules.
 *
 * Deliberately NOT re-tested here (covered by sibling suites):
 * - attack header to-hit math, conditionAttackMode pass-through, cannotAct
 *   → CharSpells.Interactions.test.jsx
 * - table structure, sorting, prepared filter, 2024 wizard gating
 *   → CharSpells.Table.test.jsx
 * - row formatting, spell-name click opening the detail popup, overlay
 *   behavior → CharSpells.Rendering.test.jsx
 * - pending* popup wiring for individual spells
 *   → CharSpells.Popups.targetSelection / popupWidgets / restoration / creatureSelection
 */
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats } from './CharSpells.test-utils.js';
import { isInnateSorceryActive } from '../../../services/combat/buffs/buffService.js';
import { normalizeAutoDamage, resolveAttackDamageStandalone } from '../useAttackDamageResolution.js';
import { prepareSpellCast } from '../../../services/rules/spells/spellPreparationService.js';

// Stable spies for every seam this suite observes, so tests can assert
// calls and invocation order without re-plumbing mocks per test.
const rolls = vi.hoisted(() => ({
  rollAttack: vi.fn(),
  rollDamage: vi.fn(),
  gateMetamagic: vi.fn(),
  resolvePositions: vi.fn(async () => {}),
}));

// Captures of callbacks CharSpells passes INTO hooks — tests drive these
// directly to exercise the component's wiring (auto-damage, Words of
// Creation modal state).
const seams = vi.hoisted(() => ({
  autoDamageRoll: null,
  openWordsOfCreation: null,
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: () => [],
  // Enforcement off ⇒ assertCanAct takes its deterministic allow fast-path.
  getRuntimeValue: () => null,
  setRuntimeValue: () => {},
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: () => ({}),
}));

vi.mock('../../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: () => ({ setPopupHtml: vi.fn() }),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn((name, campaignName, options) => {
    seams.autoDamageRoll = options?.autoDamageRoll ?? null;
    return {
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: rolls.rollAttack,
      rollDamage: rolls.rollDamage,
      quickRollPlayerSave: vi.fn(),
    };
  }),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(({ setSecondaryTargetModal }) => {
    seams.openWordsOfCreation = setSecondaryTargetModal ?? null;
    // Every popup in CharSpells is guarded by its own pending* truthiness
    // check, so a flow exposing only these two seams renders cleanly here.
    return { gateMetamagic: rolls.gateMetamagic };
  }),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: () => ({
    pendingUpcast: null,
    buildUpcastLevels: () => [],
    handleUpcastConfirm: () => {},
    handleUpcastCancel: () => {},
  }),
}));

vi.mock('../../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: () => ({ castAction: () => {} }),
}));

vi.mock('../../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: () => ({
    resolvePositions: rolls.resolvePositions,
    cachedPosRef: { current: null },
  }),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: () => Promise.resolve(null),
  getTargetFromAttacker: () => null,
  getAttackerTargetName: () => null,
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: () => ({ creatures: [] }),
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
  loadMapData: () => Promise.resolve({ players: [], placedItems: [] }),
}));

vi.mock('../../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: () => null,
  rangeToFeet: (range) => (String(range).includes('60') ? 60 : null),
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadMonsters: () => Promise.resolve([]),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/spells/shapechangeService.js', () => ({
  confirmShapechangeTransform: () => Promise.resolve(),
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(() => Promise.resolve()),
  isFreeCastAuthorized: () => false,
  isWizardRitualAdeptSpell: () => false,
}));

// Stable shape so the auto-damage test can assert exactly what CharSpells
// forwards downstream after normalization.
const NORMALIZED_AUTO_DAMAGE = { attack: { name: 'Fire Bolt' }, ctx: { targetName: 'Orc' } };

vi.mock('../useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn(),
  resolveAttackDamageStandalone: vi.fn(() => Promise.resolve()),
}));

// Sub-components unrelated to the cast seam — inert so they can neither
// fail nor pollute the queries these tests make.
vi.mock('./CharSpellSlots.jsx', () => ({ default: () => null }));
vi.mock('../popups/MetamagicPopup.jsx', () => ({ default: () => null }));
vi.mock('../popups/MultiTargetPopup.jsx', () => ({ default: () => null }));
vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({ default: () => null }));
vi.mock('./UpcastPopup.jsx', () => ({ default: () => null }));

// Faithful minimal stub of SpellDetailPopup: shows the spell, dispatches
// onCast(spell, metaCtx) — mirroring the real popup's contract of passing
// the user's selected cast level.
vi.mock('./SpellDetailPopup.jsx', () => ({
  default: function SpellDetailPopupStub({ spell, onCast }) {
    return (
      <div role="dialog" aria-label={`${spell?.name} details`}>
        <span>{spell?.name}</span>
        <button onClick={() => onCast(spell, { selectedLevel: spell?.level })}>Cast</button>
      </div>
    );
  },
}));

// Faithful minimal stub of SecondaryTargetModal: title, description, one
// button per target dispatching its value, and Skip.
vi.mock('../modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function SecondaryTargetModalStub({ title, targets = [], onTargetSelected, onSkip, description }) {
    return (
      <div role="dialog" aria-label={title}>
        {description && <p>{description}</p>}
        {targets.map((t) => {
          const value = typeof t === 'string' ? t : t.value ?? t.name;
          return (
            <button key={value} onClick={() => onTargetSelected?.(value)}>
              {value}
            </button>
          );
        })}
        <button onClick={() => onSkip?.()}>Skip</button>
      </div>
    );
  },
}));

const CAMPAIGN = 'test-campaign';

function renderCharSpells(props = {}) {
  return render(<CharSpells playerStats={mockPlayerStats} campaignName={CAMPAIGN} {...props} />);
}

function openSpellDetail(spellName = 'Light') {
  fireEvent.click(screen.getByRole('cell', { name: spellName }));
  return screen.getByRole('dialog', { name: `${spellName} details` });
}

/** The Save DC number as a player reads it from the abilities header. */
function displayedSaveDc() {
  const label = screen.getByText('Save DC:');
  const match = label.parentElement.textContent.match(/Save DC:\s*(\d+)/);
  expect(match, 'Save DC value should render next to its label').not.toBeNull();
  return Number(match[1]);
}

describe('CharSpells - spell cast flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seams.autoDamageRoll = null;
    seams.openWordsOfCreation = null;
    vi.mocked(isInnateSorceryActive).mockReturnValue(false);
    vi.mocked(normalizeAutoDamage).mockReturnValue(NORMALIZED_AUTO_DAMAGE);
  });

  it('casting closes the detail popup, resolves position before gating, and routes the spell through the metamagic gate exactly once', async () => {
    renderCharSpells();
    openSpellDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Cast' }));

    expect(screen.queryByRole('dialog', { name: 'Light details' })).not.toBeInTheDocument();
    await waitFor(() => expect(rolls.gateMetamagic).toHaveBeenCalledTimes(1));
    // The popup's selected cast level reaches the gate unchanged.
    expect(rolls.gateMetamagic).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Light', level: 0 }),
      { selectedLevel: 0 }
    );
    // Position must be resolved before the gate fires, exactly once.
    expect(rolls.resolvePositions).toHaveBeenCalledTimes(1);
    expect(rolls.resolvePositions.mock.invocationCallOrder[0])
      .toBeLessThan(rolls.gateMetamagic.mock.invocationCallOrder[0]);
    // Invariant: prepareSpellCast runs only inside the gate, never from JSX.
    expect(prepareSpellCast).not.toHaveBeenCalled();
  });

  it('auto-damage from a spell attack resolves through the standalone damage pipeline', async () => {
    renderCharSpells();
    expect(typeof seams.autoDamageRoll).toBe('function');

    await seams.autoDamageRoll({ autoAttack: 'spell-hit-1' }, true);

    expect(normalizeAutoDamage).toHaveBeenCalledWith(
      { autoAttack: 'spell-hit-1' },
      true,
      expect.objectContaining({ name: mockPlayerStats.name })
    );
    expect(resolveAttackDamageStandalone).toHaveBeenCalledWith(
      NORMALIZED_AUTO_DAMAGE.attack,
      NORMALIZED_AUTO_DAMAGE.ctx,
      expect.objectContaining({
        playerStats: expect.objectContaining({ name: mockPlayerStats.name }),
        campaignName: CAMPAIGN,
        rollDamage: rolls.rollDamage,
      })
    );
  });
});

describe('CharSpells - words of creation target selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seams.autoDamageRoll = null;
    seams.openWordsOfCreation = null;
  });

  function wordsOfCreationRequest(overrides = {}) {
    return {
      title: 'Words of Creation',
      targets: ['Orc', 'Goblin'],
      description: 'Choose a creature within 60 feet.',
      featureDescription: 'Bardic feature description',
      confirmLabel: 'Inspire',
      confirmIcon: 'fa-music',
      range: '60 feet',
      onTargetSelected: vi.fn(),
      onSkip: vi.fn(),
      ...overrides,
    };
  }

  function openWordsOfCreation(request) {
    // The metamagic flow receives CharSpells' real state setter at render;
    // driving it directly exercises the full state → modal round-trip.
    expect(seams.openWordsOfCreation, 'metamagic flow should receive the secondary-target setter').toBeTypeOf('function');
    act(() => seams.openWordsOfCreation(request));
  }

  it('shows the flow-supplied title, description, and targets, and selecting one dispatches it and closes the modal', () => {
    const request = wordsOfCreationRequest({
      onTargetSelected: vi.fn(() => seams.openWordsOfCreation(null)),
    });
    renderCharSpells();
    openWordsOfCreation(request);

    const dialog = screen.getByRole('dialog', { name: 'Words of Creation' });
    expect(within(dialog).getByText('Choose a creature within 60 feet.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Orc' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Goblin' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Orc' }));

    expect(request.onTargetSelected).toHaveBeenCalledTimes(1);
    expect(request.onTargetSelected).toHaveBeenCalledWith('Orc');
    expect(request.onSkip).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Words of Creation' })).not.toBeInTheDocument();
  });

  it('skip closes the modal without selecting a target', () => {
    const request = wordsOfCreationRequest({
      onSkip: vi.fn(() => seams.openWordsOfCreation(null)),
    });
    renderCharSpells();
    openWordsOfCreation(request);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(request.onSkip).toHaveBeenCalledTimes(1);
    expect(request.onTargetSelected).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Words of Creation' })).not.toBeInTheDocument();
  });
});

describe('CharSpells - innate sorcery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seams.autoDamageRoll = null;
    seams.openWordsOfCreation = null;
    vi.mocked(isInnateSorceryActive).mockReturnValue(false);
  });

  it.each([
    { active: true, expectedDc: mockPlayerStats.spellAbilities.saveDc + 1 },
    { active: false, expectedDc: mockPlayerStats.spellAbilities.saveDc },
  ])('shows Save DC $expectedDc when innate sorcery is active=$active', ({ active, expectedDc }) => {
    vi.mocked(isInnateSorceryActive).mockReturnValue(active);
    renderCharSpells();
    expect(displayedSaveDc()).toBe(expectedDc);
  });

  // Only the isSorcerer && innateSorceryActive advantage branch and its two
  // negative guards — condition-mode pass-through (including disadvantage
  // outranking innate advantage) is covered by CharSpells.Interactions.test.jsx.
  it.each([
    { className: 'Sorcerer', active: true, expectedForcedMode: 'advantage' },
    { className: 'Wizard', active: true, expectedForcedMode: undefined },
    { className: 'Sorcerer', active: false, expectedForcedMode: undefined },
  ])('spell attack rolls with forcedMode=$expectedForcedMode (class=$className, innateSorcery=$active)',
    ({ className, active, expectedForcedMode }) => {
      vi.mocked(isInnateSorceryActive).mockReturnValue(active);
      renderCharSpells({
        playerStats: { ...mockPlayerStats, class: { name: className } },
        // Explicit 'normal' so the innate-sorcery branch (not the
        // condition-mode branch) is the one under test.
        conditionAttackMode: 'normal',
      });

      fireEvent.click(screen.getByText('Attack (to hit):'));

      expect(rolls.rollAttack).toHaveBeenCalledTimes(1);
      expect(rolls.rollAttack).toHaveBeenCalledWith(
        'Spell Attack',
        mockPlayerStats.spellAbilities.toHit,
        { forcedMode: expectedForcedMode }
      );
    });
});
