// @maintained-by-ai
/**
 * CharSpells — Shapechange creature-selection popup (integration).
 *
 * Verifies the CharSpells → CreatureTargetPopups wiring while a Shapechange
 * cast is pending: the real PolymorphSelectionModal receives the integration's
 * selection props (maxCR from character level, allowAnyCreature, excludeTypes
 * construct/undead) and confirming dispatches to the spell-preparation and
 * shapechange services with the correct slot-payment semantics. Cancel is the
 * negative path: nothing is dispatched or spent.
 *
 * Not re-tested here (covered elsewhere):
 * - Modal internals (CR parsing, search, exclusion UI, empty state): modals/PolymorphSelectionModal*.test.jsx
 * - CharSheet-level popup routing: CharSheet.modalConfirmHandlers.test.jsx
 * - Other creature/target popups: sibling CharSpells.Popups.*.test.jsx files
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats } from './CharSpells.test-utils.js';
import { useSpellMetamagicFlow } from '../../../hooks/combat/useSpellMetamagicFlow.js';
import { loadMonsters } from '../../../services/ui/dataLoader.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import { prepareSpellCast, isFreeCastAuthorized } from '../../../services/rules/spells/spellPreparationService.js';
import { confirmShapechangeTransform } from '../../../services/automation/handlers/spells/shapechangeService.js';

// Hooks/services with network or store side effects — mocked so the test
// exercises only the CharSpells popup wiring it owns.
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => []),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({ rollAttack: vi.fn(), rollDamage: vi.fn() })),
}));

vi.mock('../../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: vi.fn(() => ({ setPopupHtml: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({})),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    pendingUpcast: null,
    buildUpcastLevels: vi.fn(() => []),
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
  })),
}));

vi.mock('../../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: vi.fn(() => ({ castAction: vi.fn() })),
}));

vi.mock('../../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: vi.fn(() => ({
    resolvePositions: vi.fn(async () => {}),
    cachedPosRef: { current: null },
  })),
}));

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(async () => null),
  getTargetFromAttacker: vi.fn(() => null),
  getAttackerTargetName: vi.fn(() => null),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(async () => []),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
}));

// Asserted interaction points.
vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: vi.fn(async () => {}),
  isFreeCastAuthorized: vi.fn(() => false),
  isWizardRitualAdeptSpell: vi.fn(() => false),
}));

vi.mock('../../../services/automation/handlers/spells/shapechangeService.js', () => ({
  confirmShapechangeTransform: vi.fn(async () => {}),
}));

vi.mock('./CharSpellSlots.jsx', () => ({
  default: function CharSpellSlots() {
    return <div data-testid="char-spell-slots">Spell Slots</div>;
  },
}));

const SHAPECHANGE_SPELL = { name: 'Shapechange', level: 9, isUpcast: false, upcastLevel: 9 };

// A beast (CR ≤ 3), a non-beast form allowed by Shapechange (fey),
// an excluded type (undead), and a form above the CR cap (CR 20).
const CREATURE_FORMS = [
  { index: 'brown-bear', name: 'Brown Bear', type: 'beast', challenge_rating: '1', size: 'Large', speed: { walk: '40 ft' }, actions: [{ name: 'Bite' }] },
  { index: 'sprite', name: 'Sprite', type: 'fey', challenge_rating: '1/4', size: 'Tiny', speed: { fly: '20 ft' }, actions: [{ name: 'Longsword' }] },
  { index: 'ghast', name: 'Ghast', type: 'undead', challenge_rating: '2', size: 'Medium', speed: { walk: '30 ft' }, actions: [{ name: 'Claws' }] },
  { index: 'ancient-brass-dragon', name: 'Ancient Brass Dragon', type: 'dragon', challenge_rating: '20', size: 'Huge', speed: { walk: '40 ft' }, actions: [{ name: 'Bite' }] },
];

const SHAPECHANGE_LEVEL_3_CHARACTER = { ...mockPlayerStats, level: 3 };

function renderShapechangeFlow({ monsters = CREATURE_FORMS, combat = { creatures: [] }, playerStats = SHAPECHANGE_LEVEL_3_CHARACTER } = {}) {
  vi.mocked(loadMonsters).mockResolvedValue(monsters);
  vi.mocked(getCombatSummary).mockReturnValue(combat);
  vi.mocked(useSpellMetamagicFlow).mockReturnValue({
    pendingShapechange: { spell: SHAPECHANGE_SPELL, spellLevel: 9 },
  });
  return render(<CharSpells playerStats={playerStats} campaignName="test-campaign" />);
}

async function selectForm(name) {
  await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
  fireEvent.click(screen.getByText(name));
}

describe('CharSpells - Shapechange creature selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isFreeCastAuthorized).mockReturnValue(false);
  });

  it('offers creature forms within the CR cap, excluding construct and undead, while the cast is pending', async () => {
    renderShapechangeFlow();

    await waitFor(() => expect(screen.getByText('Brown Bear')).toBeInTheDocument());

    // maxCR = character level (3), not a fixed cap: the modal advertises the
    // level-derived CR ceiling to the player.
    expect(screen.getByText('Choose a creature form (CR 3 or lower)')).toBeInTheDocument();
    // allowAnyCreature: the non-beast fey form shows...
    expect(screen.getByText('Sprite')).toBeInTheDocument();
    // ...excludeTypes hides undead, and over-cap CRs never appear.
    expect(screen.queryByText('Ghast')).not.toBeInTheDocument();
    expect(screen.queryByText('Ancient Brass Dragon')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shapechange' })).toBeInTheDocument();
  });

  it('spends the 9th-level slot and transforms into the selected creature on confirm', async () => {
    renderShapechangeFlow();
    await selectForm('Brown Bear');

    fireEvent.click(screen.getByRole('button', { name: 'Shapechange' }));

    await waitFor(() => expect(confirmShapechangeTransform).toHaveBeenCalledTimes(1));
    expect(prepareSpellCast).toHaveBeenCalledTimes(1);
    expect(prepareSpellCast).toHaveBeenCalledWith(
      SHAPECHANGE_SPELL,
      {},
      expect.objectContaining({
        playerName: 'Test Character',
        campaignName: 'test-campaign',
        isUpcast: false,
        upcastLevel: 9,
        freeCastAuthorized: false,
      })
    );
    expect(confirmShapechangeTransform).toHaveBeenCalledWith(expect.objectContaining({
      targetName: 'Test Character',
      casterName: 'Test Character',
      form: expect.objectContaining({ name: 'Brown Bear' }),
      spell: SHAPECHANGE_SPELL,
      spellLevel: 9,
      campaignName: 'test-campaign',
      formChange: false,
    }));
  });

  it('does not spend a spell slot when recasting into a new form while already transformed (SP-103)', async () => {
    renderShapechangeFlow({
      combat: { creatures: [{ name: 'Test Character', shapechangeOriginal: { name: 'Test Character' } }] },
    });
    await selectForm('Brown Bear');

    fireEvent.click(screen.getByRole('button', { name: 'Shapechange' }));

    await waitFor(() => expect(confirmShapechangeTransform).toHaveBeenCalledTimes(1));
    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(isFreeCastAuthorized).not.toHaveBeenCalled();
    expect(confirmShapechangeTransform).toHaveBeenCalledWith(expect.objectContaining({ formChange: true }));
  });

  it('does not transform or spend a slot when the selection is cancelled', async () => {
    renderShapechangeFlow();
    await selectForm('Brown Bear');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(prepareSpellCast).not.toHaveBeenCalled();
    expect(confirmShapechangeTransform).not.toHaveBeenCalled();
  });
});
