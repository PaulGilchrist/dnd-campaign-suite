// @improved-by-ai
/**
 * CharSpells — target-selection modals (integration wiring).
 *
 * Verifies the CharSpells → TargetSpellPopups / CreatureTargetPopups boundary:
 * how each `pending*` step produced by useSpellMetamagicFlow maps to the right
 * modal (title, targets, confirm label) and how user selections dispatch to the
 * correct flow handler with the correct payload shape (array vs object vs raw
 * name — these differ per spell and are the real defect surface).
 *
 * Modals are stubbed with a FAITHFUL MINIMAL contract mirroring the real
 * components' user behavior — radio row selects then Confirm dispatches the
 * selection (SecondaryTargetModal), checkbox rows toggle then Confirm dispatches
 * the selected array with a live count (CreatureSelectionModal), damage-type
 * radios then Choose dispatches the type (SingleResistanceSelectionModal),
 * ability buttons dispatch the ability key from the `abilities` prop
 * (HexAbilityModal) — so tests drive real user behavior via accessible roles.
 *
 * NOT covered here (see sibling files to avoid duplication):
 * - Restoration target/effect flow → CharSpells.Popups.restoration.test.jsx
 * - Metamagic/MultiTarget/MagicMissile/Upcast popup widgets → popupWidgets.test.jsx
 * - Shapechange creature selection + slot payment → creatureSelection.test.jsx
 * - Cast flow via SpellDetailPopup → spellCast.test.jsx
 * - Table rendering edge cases → CharSpells.Rendering.test.jsx
 * - Flow-hook internals (stage transitions, slot rollback) →
 *   hooks/combat/useSpellMetamagicFlow*.test.js (incl. enhance-ability ability
 *   list: CON is intentionally not eligible — see enhanceAbilityHandler.test.js)
 */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpells from './CharSpells.jsx';
import { mockPlayerStats } from './CharSpells.test-utils.js';

const CAMPAIGN = 'test-campaign';

// The metamagic flow is the pending state under test — a plain closure over the
// module-scoped `flow` variable lets each test swap in a minimal fixture without
// mock-implementation gymnastics. Every popup renderer is guarded by its own
// `pending*` truthiness check, so a sparse flow renders nothing by default.
let flow = {};

vi.mock('../../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: () => flow,
}));

// --- Infrastructure stubs: never render, never run game logic ---

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: () => [],
  getRuntimeValue: () => null,
  setRuntimeValue: () => {},
}));

vi.mock('../../../hooks/combat/useActionPopup.js', () => ({
  default: () => ({}),
}));

vi.mock('../../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: () => ({ rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn() }),
}));

vi.mock('../../../hooks/combat/DiceRollContext.js', () => ({
  useDiceRollPopup: () => ({ setPopupHtml: vi.fn() }),
}));

vi.mock('../../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: () => ({
    pendingUpcast: null,
    buildUpcastLevels: () => [],
    gateUpcast: () => false,
    handleUpcastConfirm: vi.fn(),
    handleUpcastCancel: vi.fn(),
    getCantripAutoLevel: () => null,
  }),
}));

vi.mock('../../../hooks/combat/useSpellCastExecutor.js', () => ({
  useSpellCastExecutor: () => ({ castAction: vi.fn() }),
}));

vi.mock('../../../hooks/combat/useSpellPositionResolver.js', () => ({
  useSpellPositionResolver: () => ({
    resolvePositions: () => Promise.resolve(),
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
  rangeToFeet: () => null,
}));

vi.mock('../../../services/ui/dataLoader.js', () => ({
  loadMonsters: () => Promise.resolve([]),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: () => false,
}));

vi.mock('../../../services/automation/handlers/spells/shapechangeService.js', () => ({
  confirmShapechangeTransform: () => Promise.resolve(),
}));

vi.mock('../../../services/rules/spells/spellPreparationService.js', () => ({
  prepareSpellCast: () => Promise.resolve(),
  isFreeCastAuthorized: () => false,
  isWizardRitualAdeptSpell: () => false,
}));

vi.mock('../useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn(() => ({ attack: {}, ctx: {} })),
  resolveAttackDamageStandalone: () => Promise.resolve(),
}));

// --- Widgets outside this file's scope: inert so they can neither fail nor
// pollute the accessible-role queries these tests make ---

vi.mock('./CharSpellSlots.jsx', () => ({ default: () => null }));
vi.mock('./SpellDetailPopup.jsx', () => ({ default: () => null }));
vi.mock('./UpcastPopup.jsx', () => ({ default: () => null }));
vi.mock('../popups/MetamagicPopup.jsx', () => ({ default: () => null }));
vi.mock('../popups/MultiTargetPopup.jsx', () => ({ default: () => null }));
vi.mock('../popups/MagicMissileTargetPopup.jsx', () => ({ default: () => null }));
vi.mock('../modals/PolymorphSelectionModal.jsx', () => ({ default: () => null }));

// --- Faithful minimal stubs of the modals under test ---

// Mirrors SecondaryTargetModal's user contract: radio rows select, Confirm
// dispatches onTargetSelected(selected), disabled until a pick, Skip closes.
vi.mock('../modals/shared/SecondaryTargetModal.jsx', async () => {
  const { useState } = await import('react');
  return {
    default: function SecondaryTargetModalStub({ title, targets = [], onTargetSelected, onSkip, description, confirmLabel, hideConfirm }) {
      const [selected, setSelected] = useState(null);
      const keyOf = (t) => ('value' in t ? t.value : t.name);
      const labelOf = (t) => ('value' in t ? t.label : t.name);
      const showConfirm = !hideConfirm || targets.length > 0;
      return (
        <div role="dialog" aria-label={title}>
          {description && <p dangerouslySetInnerHTML={{ __html: description }} />}
          {targets.map((t) => (
            <label key={keyOf(t)}>
              <input
                type="radio"
                name="secondaryTarget"
                checked={selected === keyOf(t)}
                onChange={() => setSelected(keyOf(t))}
              />
              {labelOf(t)}
            </label>
          ))}
          {showConfirm && (
            <button type="button" disabled={!selected || targets.length === 0} onClick={() => onTargetSelected?.(selected)}>
              {confirmLabel || 'Attack'}
            </button>
          )}
          <button type="button" onClick={() => onSkip?.()}>Skip</button>
        </div>
      );
    },
  };
});

// Mirrors CreatureSelectionModal's multi-select contract: checkbox rows toggle
// (disabled at maxTargets), Confirm dispatches the selected-name array with a
// live count in its label, disabled while empty, Skip closes.
vi.mock('../modals/shared/CreatureSelectionModal.jsx', async () => {
  const { useState } = await import('react');
  return {
    default: function CreatureSelectionModalStub({ title, targets = [], description, maxTargets, confirmLabel, onConfirm, onSkip }) {
      const [selected, setSelected] = useState([]);
      const nameOf = (t) => t.name || t;
      const toggle = (name) => setSelected((prev) =>
        prev.includes(name)
          ? prev.filter((n) => n !== name)
          : (!maxTargets || prev.length < maxTargets ? [...prev, name] : prev));
      return (
        <div role="dialog" aria-label={title}>
          {description && <p dangerouslySetInnerHTML={{ __html: description }} />}
          {targets.map((t) => {
            const name = nameOf(t);
            const isSelected = selected.includes(name);
            const atMax = !!maxTargets && selected.length >= maxTargets && !isSelected;
            return (
              <label key={name}>
                <input type="checkbox" checked={isSelected} disabled={atMax} onChange={() => toggle(name)} />
                {name}
              </label>
            );
          })}
          <button type="button" disabled={selected.length === 0} onClick={() => onConfirm?.(selected)}>
            {confirmLabel || 'Confirm'} ({selected.length})
          </button>
          <button type="button" onClick={() => onSkip?.()}>Skip</button>
        </div>
      );
    },
  };
});

// Mirrors SingleResistanceSelectionModal: damage-type radios from
// action.automation.damageTypes, Choose dispatches the picked type via onConfirm.
vi.mock('../modals/SingleResistanceSelectionModal.jsx', async () => {
  const { useState } = await import('react');
  return {
    default: function SingleResistanceSelectionModalStub({ title, action, onClose, onConfirm }) {
      const [selected, setSelected] = useState(null);
      const damageTypes = action?.automation?.damageTypes || [];
      return (
        <div role="dialog" aria-label={title || action?.name || 'Resistance Selection'}>
          {damageTypes.map((type) => (
            <label key={type}>
              <input
                type="radio"
                name="resistanceSelectionOption"
                checked={selected === type}
                onChange={() => setSelected(type)}
              />
              {type}
            </label>
          ))}
          <button type="button" disabled={!selected} onClick={() => onConfirm?.(selected)}>Choose Damage Type</button>
          <button type="button" onClick={() => onClose?.()}>Cancel</button>
        </div>
      );
    },
  };
});

// Mirrors HexAbilityModal: renders exactly the `abilities` prop it is given,
// each button dispatches its key. (The offered list is asserted against what
// CharSpells passes — Enhance Ability excludes CON by project rule.)
vi.mock('../modals/HexAbilityModal.jsx', () => ({
  default: function HexAbilityModalStub({ title, abilities, onAbilitySelected, onCancel }) {
    const options = abilities || [
      { key: 'STR', label: 'Strength' },
      { key: 'DEX', label: 'Dexterity' },
      { key: 'CON', label: 'Constitution' },
      { key: 'INT', label: 'Intelligence' },
      { key: 'WIS', label: 'Wisdom' },
      { key: 'CHA', label: 'Charisma' },
    ];
    return (
      <div role="dialog" aria-label={title || 'Hex — Choose Ability'}>
        {options.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => onAbilitySelected(key)}>{`${label} (${key})`}</button>
        ))}
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    );
  },
}));

// Mirrors TruePolymorphPathModal's three transformation paths.
vi.mock('../modals/TruePolymorphPathModal.jsx', () => ({
  default: function TruePolymorphPathModalStub({ onConfirm, onCancel }) {
    return (
      <div role="dialog" aria-label="True Polymorph">
        <button type="button" onClick={() => onConfirm('creature_to_creature')}>Creature into Creature</button>
        <button type="button" onClick={() => onConfirm('object_into_creature')}>Object into Creature</button>
        <button type="button" onClick={() => onConfirm('creature_to_object')}>Creature into Object</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    );
  },
}));

// ── Per-test fixtures / helpers ────────────────────────────────────────────

const TARGETS = ['Orc', 'Goblin'];

// The three confirm-payload shapes the renderers use for the picked target.
const asArray = (name) => [name];
const asTargetName = (name) => name;
const asTargetObject = (name) => ({ targetName: name });

function renderCharSpells() {
  return render(<CharSpells playerStats={mockPlayerStats} campaignName={CAMPAIGN} />);
}

/** Arm a single pending step (+ its two handlers) on the flow fixture and render. */
function castPending({ pending, confirm, skip, stageKey, stage, state }) {
  flow = {
    [pending]: { creatureTargets: TARGETS, range: '60 feet', maxTargets: 2, ...state },
    [confirm]: vi.fn(),
    [skip]: vi.fn(),
    ...(stageKey ? { [stageKey]: stage } : {}),
  };
  return renderCharSpells();
}

function skipButton(dialog) {
  return within(dialog).getByRole('button', { name: 'Skip' });
}

// CreatureSelectionModal's confirm always carries a live "(n)" count suffix.
function confirmButton(dialog) {
  return within(dialog).getByRole('button', { name: /\(\d+\)$/ });
}

// ── Spell tables (spells → pending key → handlers → payload shape) ────────
// Greater/Lesser Restoration live in restoration.test.jsx; Shapechange and True
// Polymorph have dedicated describes below.

const SECONDARY_SPELLS = [
  { pending: 'pendingAuraOfVitality', title: 'Aura of Vitality', confirmLabel: 'Cast Aura of Vitality', confirm: 'handleAuraOfVitalityConfirm', skip: 'handleAuraOfVitalitySkip', payload: asArray },
  { pending: 'pendingForesight', title: 'Foresight', confirmLabel: 'Cast Foresight', confirm: 'handleForesightConfirm', skip: 'handleForesightSkip', payload: asArray },
  { pending: 'pendingProtectionFromEvilAndGood', title: 'Protection from Evil and Good', confirmLabel: 'Cast Protection from Evil and Good', confirm: 'handleProtectionFromEvilAndGoodConfirm', skip: 'handleProtectionFromEvilAndGoodSkip', payload: asArray },
  { pending: 'pendingProtectionFromPoison', title: 'Protection from Poison', confirmLabel: 'Cast Protection from Poison', confirm: 'handleProtectionFromPoisonConfirm', skip: 'handleProtectionFromPoisonSkip', payload: asArray },
  { pending: 'pendingStoneSkin', title: 'Stone Skin', confirmLabel: 'Cast Stone Skin', confirm: 'handleStoneSkinConfirm', skip: 'handleStoneSkinSkip', payload: asTargetName },
  { pending: 'pendingLongstrider', title: 'Longstrider', confirmLabel: 'Cast Longstrider', confirm: 'handleLongstriderConfirm', skip: 'handleLongstriderSkip', payload: asArray },
  { pending: 'pendingSpareTheDying', title: 'Spare the Dying', confirmLabel: 'Cast Spare the Dying', confirm: 'handleSpareTheDyingConfirm', skip: 'handleSpareTheDyingSkip', payload: asTargetObject },
  { pending: 'pendingDeathWard', title: 'Death Ward', confirmLabel: 'Cast Death Ward', confirm: 'handleDeathWardConfirm', skip: 'handleDeathWardSkip', payload: asArray },
  { pending: 'pendingHeroism', title: 'Heroism', confirmLabel: 'Cast Heroism', confirm: 'handleHeroismConfirm', skip: 'handleHeroismSkip', payload: asArray },
  { pending: 'pendingHaste', title: 'Haste', confirmLabel: 'Cast Haste', confirm: 'handleHasteConfirm', skip: 'handleHasteSkip', payload: asArray },
  { pending: 'pendingBarkskin', title: 'Barkskin', confirmLabel: 'Cast Barkskin', confirm: 'handleBarkskinConfirm', skip: 'handleBarkskinSkip', payload: asArray },
  { pending: 'pendingInvisibility', title: 'Invisibility', confirmLabel: 'Cast Invisibility', confirm: 'handleInvisibilityConfirm', skip: 'handleInvisibilitySkip', payload: asArray },
  { pending: 'pendingGreaterInvisibility', title: 'Greater Invisibility', confirmLabel: 'Cast Greater Invisibility', confirm: 'handleGreaterInvisibilityConfirm', skip: 'handleGreaterInvisibilitySkip', payload: asArray },
  { pending: 'pendingSanctuary', title: 'Sanctuary', confirmLabel: 'Cast Sanctuary', confirm: 'handleSanctuaryConfirm', skip: 'handleSanctuarySkip', payload: asTargetName },
  { pending: 'pendingFeignDeath', title: 'Feign Death', confirmLabel: 'Cast Feign Death', confirm: 'handleFeignDeathConfirm', skip: 'handleFeignDeathSkip', payload: asArray },
  { pending: 'pendingHeal', title: 'Heal', confirmLabel: 'Cast Heal', confirm: 'handleHealConfirm', skip: 'handleHealSkip', payload: asTargetObject },
  { pending: 'pendingRegenerate', title: 'Regenerate', confirmLabel: 'Cast Regenerate', confirm: 'handleRegenerateConfirm', skip: 'handleRegenerateSkip', payload: asTargetObject },
  { pending: 'pendingHealingWord', title: 'Healing Word', confirmLabel: 'Cast Healing Word', confirm: 'handleHealingWordConfirm', skip: 'handleHealingWordSkip', payload: asTargetObject },
  { pending: 'pendingCureWounds', title: 'Cure Wounds', confirmLabel: 'Cast Cure Wounds', confirm: 'handleCureWoundsConfirm', skip: 'handleCureWoundsSkip', payload: asTargetObject },
  { pending: 'pendingRevivify', title: 'Revivify', confirmLabel: 'Cast Revivify', confirm: 'handleRevivifyConfirm', skip: 'handleRevivifySkip', payload: asTargetObject },
  { pending: 'pendingRemoveCurse', title: 'Remove Curse', confirmLabel: 'Cast Remove Curse', confirm: 'handleRemoveCurseConfirm', skip: 'handleRemoveCurseSkip', payload: asTargetObject },
  { pending: 'pendingMageArmor', title: 'Mage Armor', confirmLabel: 'Cast Mage Armor', confirm: 'handleMageArmorConfirm', skip: 'handleMageArmorSkip', payload: asArray },
  { pending: 'pendingHex', title: 'Hex', confirmLabel: 'Select Target', confirm: 'handleHexConfirm', skip: 'handleHexSkip', payload: asTargetName },
  { pending: 'pendingWardingBond', title: 'Warding Bond', confirmLabel: 'Cast Warding Bond', confirm: 'handleWardingBondConfirm', skip: 'handleWardingBondSkip', payload: asTargetName },
];

const CREATURE_MODAL_SPELLS = [
  { pending: 'pendingHoldMonster', title: 'Hold Monster', confirm: 'handleHoldMonsterConfirm', skip: 'handleHoldMonsterSkip' },
  { pending: 'pendingHoldPerson', title: 'Hold Person', confirm: 'handleHoldPersonConfirm', skip: 'handleHoldPersonSkip' },
  { pending: 'pendingPolymorph', title: 'Polymorph', confirm: 'handlePolymorphConfirm', skip: 'handlePolymorphSkip' },
  { pending: 'pendingAnimalShapes', title: 'Animal Shapes', confirm: 'handleAnimalShapesTargetConfirm', skip: 'handleAnimalShapesSkip' },
  { pending: 'pendingCharmPerson', title: 'Charm Person', confirm: 'handleCharmPersonConfirm', skip: 'handleCharmPersonSkip' },
  { pending: 'pendingCharmMonster', title: 'Charm Monster', confirm: 'handleCharmMonsterConfirm', skip: 'handleCharmMonsterSkip' },
  { pending: 'pendingBanishment', title: 'Banishment', confirm: 'handleBanishmentConfirm', skip: 'handleBanishmentSkip' },
  { pending: 'pendingPrismaticSpray', title: 'Prismatic Spray', confirm: 'handlePrismaticSprayConfirm', skip: 'handlePrismaticSpraySkip' },
  { pending: 'pendingHeroesFeast', title: "Heroes' Feast", confirm: 'handleHeroesFeastConfirm', skip: 'handleHeroesFeastSkip' },
  { pending: 'pendingBane', title: 'Bane', confirm: 'handleBaneConfirm', skip: 'handleBaneSkip' },
  { pending: 'pendingBless', title: 'Bless', confirm: 'handleBlessConfirm', skip: 'handleBlessSkip' },
  { pending: 'pendingFaerieFire', title: 'Faerie Fire', confirm: 'handleFaerieFireConfirm', skip: 'handleFaerieFireSkip' },
  { pending: 'pendingHolyAura', title: 'Holy Aura', confirm: 'handleHolyAuraConfirm', skip: 'handleHolyAuraSkip' },
  { pending: 'pendingBeaconOfHope', title: 'Beacon of Hope', confirm: 'handleBeaconOfHopeConfirm', skip: 'handleBeaconOfHopeSkip' },
  { pending: 'pendingSlow', title: 'Slow', confirm: 'handleSlowConfirm', skip: 'handleSlowSkip' },
  { pending: 'pendingPassWithoutTrace', title: 'Pass Without Trace', confirm: 'handlePassWithoutTraceConfirm', skip: 'handlePassWithoutTraceSkip' },
  { pending: 'pendingGlobe', title: 'Globe of Invulnerability', confirm: 'handleGlobeConfirm', skip: 'handleGlobeSkip' },
  { pending: 'pendingAntimagicField', title: 'Antimagic Field', confirm: 'handleAntimagicFieldConfirm', skip: 'handleAntimagicFieldSkip' },
  { pending: 'pendingForcecage', title: 'Forcecage', confirm: 'handleForcecageConfirm', skip: 'handleForcecageSkip' },
  { pending: 'pendingStinkingCloud', title: 'Stinking Cloud', confirm: 'handleStinkingCloudConfirm', skip: 'handleStinkingCloudSkip' },
  { pending: 'pendingConfusion', title: 'Confusion', confirm: 'handleConfusionConfirm', skip: 'handleConfusionSkip' },
  { pending: 'pendingWeb', title: 'Web', confirm: 'handleWebConfirm', skip: 'handleWebSkip' },
  { pending: 'pendingAnimalFriendship', title: 'Animal Friendship', confirm: 'handleAnimalFriendshipConfirm', skip: 'handleAnimalFriendshipSkip' },
  { pending: 'pendingAuraOfLife', title: 'Aura of Life', confirm: 'handleAuraOfLifeConfirm', skip: 'handleAuraOfLifeSkip' },
  { pending: 'pendingAuraOfPurity', title: 'Aura of Purity', confirm: 'handleAuraOfPurityConfirm', skip: 'handleAuraOfPuritySkip' },
  { pending: 'pendingCircleOfPower', title: 'Circle of Power', confirm: 'handleCircleOfPowerConfirm', skip: 'handleCircleOfPowerSkip' },
  { pending: 'pendingCompulsion', title: 'Compulsion', confirm: 'handleCompulsionConfirm', skip: 'handleCompulsionSkip' },
  { pending: 'pendingSleetStorm', title: 'Sleet Storm', confirm: 'handleSleetStormConfirm', skip: 'handleSleetStormSkip' },
];

describe('CharSpells - Target selection modals', () => {
  beforeEach(() => {
    flow = {};
  });

  it('renders no target-selection modal when no spell step is pending', () => {
    renderCharSpells();

    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
  });

  describe('SecondaryTargetModal spells', () => {
    it.each(SECONDARY_SPELLS)('lists creature targets for $title with $confirmLabel disabled until one is picked', (spell) => {
      castPending(spell);

      const dialog = screen.getByRole('dialog', { name: spell.title });
      expect(within(dialog).getByRole('radio', { name: 'Orc' })).toBeInTheDocument();
      expect(within(dialog).getByRole('radio', { name: 'Goblin' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: spell.confirmLabel })).toBeDisabled();
      expect(flow[spell.confirm]).not.toHaveBeenCalled();
    });

    it.each(SECONDARY_SPELLS)('dispatches the chosen target to $confirm for $title', (spell) => {
      castPending(spell);

      // Pick the SECOND target so a payload of "all targets" or "first target" fails.
      fireEvent.click(screen.getByRole('radio', { name: 'Goblin' }));
      fireEvent.click(screen.getByRole('button', { name: spell.confirmLabel }));

      expect(flow[spell.confirm]).toHaveBeenCalledTimes(1);
      expect(flow[spell.confirm]).toHaveBeenCalledWith(spell.payload('Goblin'));
      expect(flow[spell.skip]).not.toHaveBeenCalled();
    });

    it.each(SECONDARY_SPELLS)('routes Skip to $skip without casting for $title', (spell) => {
      castPending(spell);

      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

      expect(flow[spell.skip]).toHaveBeenCalledTimes(1);
      expect(flow[spell.confirm]).not.toHaveBeenCalled();
    });

    it('surfaces the pending range in the Remove Curse description', () => {
      castPending({
        ...SECONDARY_SPELLS.find((s) => s.pending === 'pendingRemoveCurse'),
        state: { range: '90 feet' },
      });

      expect(screen.getByRole('dialog', { name: 'Remove Curse' })).toHaveTextContent(/within 90 feet/i);
    });
  });

  describe('staged flow — Enhance Ability', () => {
    const flowAtAbilityStage = () => {
      flow = {
        pendingEnhanceAbility: { creatureTargets: TARGETS },
        enhanceAbilityStage: 'ability',
        handleEnhanceAbilityAbilitySelect: vi.fn(),
        handleEnhanceAbilityConfirm: vi.fn(),
        handleEnhanceAbilitySkip: vi.fn(),
      };
      return renderCharSpells();
    };

    it('offers exactly the five CON-excluded eligible abilities at the ability stage', () => {
      flowAtAbilityStage();

      const dialog = screen.getByRole('dialog', { name: 'Enhance Ability — Choose Ability' });
      expect(within(dialog).getByRole('button', { name: 'Strength (STR)' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Dexterity (DEX)' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Intelligence (INT)' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Wisdom (WIS)' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Charisma (CHA)' })).toBeInTheDocument();
      // CON is intentionally not eligible — see enhanceAbilityHandler.test.js.
      expect(within(dialog).queryByRole('button', { name: /Constitution/ })).not.toBeInTheDocument();
      // The target picker must not appear alongside the ability picker.
      expect(screen.queryByRole('dialog', { name: 'Enhance Ability' })).not.toBeInTheDocument();
    });

    it('dispatches the picked ability key and routes Cancel to skip at the ability stage', () => {
      flowAtAbilityStage();

      fireEvent.click(screen.getByRole('button', { name: 'Dexterity (DEX)' }));
      expect(flow.handleEnhanceAbilityAbilitySelect).toHaveBeenCalledWith('DEX');

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(flow.handleEnhanceAbilitySkip).toHaveBeenCalledTimes(1);
      expect(flow.handleEnhanceAbilityAbilitySelect).toHaveBeenCalledTimes(1);
    });

    it('shows the creature target picker at the target stage and dispatches the pick', () => {
      flow = {
        pendingEnhanceAbility: { creatureTargets: TARGETS },
        enhanceAbilityStage: 'target',
        handleEnhanceAbilityAbilitySelect: vi.fn(),
        handleEnhanceAbilityConfirm: vi.fn(),
        handleEnhanceAbilitySkip: vi.fn(),
      };
      renderCharSpells();

      expect(screen.queryByRole('dialog', { name: 'Enhance Ability — Choose Ability' })).not.toBeInTheDocument();
      const dialog = screen.getByRole('dialog', { name: 'Enhance Ability' });
      fireEvent.click(within(dialog).getByRole('radio', { name: 'Goblin' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cast Enhance Ability' }));
      expect(flow.handleEnhanceAbilityConfirm).toHaveBeenCalledWith(['Goblin']);

      fireEvent.click(skipButton(dialog));
      expect(flow.handleEnhanceAbilitySkip).toHaveBeenCalledTimes(1);
    });
  });

  describe('staged flow — Protection from Energy', () => {
    const flowAtStage = (stage) => {
      flow = {
        pendingProtectionFromEnergy: { creatureTargets: TARGETS, range: 'Touch', damageTypes: ['fire', 'cold', 'lightning'] },
        protectionFromEnergyStage: stage,
        handleProtectionFromEnergyTargetSelect: vi.fn(),
        handleProtectionFromEnergyTypeSelect: vi.fn(),
        handleProtectionFromEnergySkip: vi.fn(),
      };
      return renderCharSpells();
    };

    it('picks the creature at the target stage and dispatches the raw name', () => {
      flowAtStage('target');

      const dialog = screen.getByRole('dialog', { name: 'Protection from Energy' });
      fireEvent.click(within(dialog).getByRole('radio', { name: 'Goblin' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cast Protection from Energy' }));
      expect(flow.handleProtectionFromEnergyTargetSelect).toHaveBeenCalledWith('Goblin');

      fireEvent.click(skipButton(dialog));
      expect(flow.handleProtectionFromEnergySkip).toHaveBeenCalledTimes(1);
      expect(flow.handleProtectionFromEnergyTypeSelect).not.toHaveBeenCalled();
    });

    it('offers the pending damage types at the type stage and dispatches the choice or skip', () => {
      flowAtStage('type');

      expect(screen.queryByRole('dialog', { name: 'Protection from Energy' })).not.toBeInTheDocument();
      const dialog = screen.getByRole('dialog', { name: 'Choose Damage Type' });
      expect(within(dialog).getByRole('radio', { name: 'fire' })).toBeInTheDocument();
      expect(within(dialog).getByRole('radio', { name: 'cold' })).toBeInTheDocument();
      expect(within(dialog).getByRole('radio', { name: 'lightning' })).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('radio', { name: 'cold' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Choose Damage Type' }));
      expect(flow.handleProtectionFromEnergyTypeSelect).toHaveBeenCalledWith('cold');

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(flow.handleProtectionFromEnergySkip).toHaveBeenCalledTimes(1);
    });
  });

  describe('staged flow — Resistance', () => {
    const flowAtStage = (stage) => {
      flow = {
        pendingResistance: { creatureTargets: TARGETS, range: 'Touch', damageTypes: ['fire', 'acid'] },
        resistanceStage: stage,
        handleResistanceTargetSelect: vi.fn(),
        handleResistanceTypeSelect: vi.fn(),
        handleResistanceSkip: vi.fn(),
      };
      return renderCharSpells();
    };

    it('picks the creature at the target stage and dispatches the raw name', () => {
      flowAtStage('target');

      const dialog = screen.getByRole('dialog', { name: 'Resistance' });
      fireEvent.click(within(dialog).getByRole('radio', { name: 'Goblin' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cast Resistance' }));
      expect(flow.handleResistanceTargetSelect).toHaveBeenCalledWith('Goblin');

      fireEvent.click(skipButton(dialog));
      expect(flow.handleResistanceSkip).toHaveBeenCalledTimes(1);
    });

    it('dispatches the chosen damage type or cancel at the type stage', () => {
      flowAtStage('type');

      expect(screen.queryByRole('dialog', { name: 'Resistance' })).not.toBeInTheDocument();
      const dialog = screen.getByRole('dialog', { name: 'Choose Damage Type' });
      fireEvent.click(within(dialog).getByRole('radio', { name: 'acid' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Choose Damage Type' }));
      expect(flow.handleResistanceTypeSelect).toHaveBeenCalledWith('acid');

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(flow.handleResistanceSkip).toHaveBeenCalledTimes(1);
      expect(flow.handleResistanceTypeSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('CreatureSelectionModal spells', () => {
    it.each(CREATURE_MODAL_SPELLS)('lists checkbox targets for $title with confirm disabled until one is picked', (spell) => {
      castPending(spell);

      const dialog = screen.getByRole('dialog', { name: spell.title });
      expect(within(dialog).getByRole('checkbox', { name: 'Orc' })).toBeInTheDocument();
      expect(within(dialog).getByRole('checkbox', { name: 'Goblin' })).toBeInTheDocument();
      expect(confirmButton(dialog)).toBeDisabled();
      expect(flow[spell.confirm]).not.toHaveBeenCalled();
    });

    it.each(CREATURE_MODAL_SPELLS)('dispatches the chosen creature to $confirm for $title', (spell) => {
      castPending(spell);

      const dialog = screen.getByRole('dialog', { name: spell.title });
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Goblin' }));
      expect(confirmButton(dialog)).toBeEnabled();
      fireEvent.click(confirmButton(dialog));

      expect(flow[spell.confirm]).toHaveBeenCalledTimes(1);
      expect(flow[spell.confirm]).toHaveBeenCalledWith(['Goblin']);
      expect(flow[spell.skip]).not.toHaveBeenCalled();
    });

    it.each(CREATURE_MODAL_SPELLS)('routes Skip to $skip without casting for $title', (spell) => {
      castPending(spell);

      fireEvent.click(skipButton(screen.getByRole('dialog', { name: spell.title })));

      expect(flow[spell.skip]).toHaveBeenCalledTimes(1);
      expect(flow[spell.confirm]).not.toHaveBeenCalled();
    });

    it('dispatches every checked creature in selection order for multi-target spells', () => {
      castPending(CREATURE_MODAL_SPELLS.find((s) => s.pending === 'pendingBless'));

      const dialog = screen.getByRole('dialog', { name: 'Bless' });
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Orc' }));
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Goblin' }));
      fireEvent.click(confirmButton(dialog));

      expect(flow.handleBlessConfirm).toHaveBeenCalledWith(['Orc', 'Goblin']);
    });
  });

  describe('True Polymorph path flow', () => {
    const castTruePolymorph = (state = {}) => {
      flow = {
        pendingTruePolymorph: { creatureTargets: TARGETS, maxTargets: 2, ...state },
        handleTruePolymorphPathSelect: vi.fn(),
        handleTruePolymorphTargetConfirm: vi.fn(),
        handleTruePolymorphSkip: vi.fn(),
      };
      return renderCharSpells();
    };

    it('shows the path picker, and no creature modal, before a path is chosen', () => {
      castTruePolymorph();

      const dialog = screen.getByRole('dialog', { name: 'True Polymorph' });
      expect(within(dialog).getByRole('button', { name: 'Creature into Creature' })).toBeInTheDocument();
      expect(within(dialog).queryByRole('checkbox', { name: 'Orc' })).not.toBeInTheDocument();
    });

    it.each([
      { path: 'creature_to_creature', label: 'Creature into Creature' },
      { path: 'object_into_creature', label: 'Object into Creature' },
      { path: 'creature_to_object', label: 'Creature into Object' },
    ])('dispatches path $path when $label is chosen', ({ path, label }) => {
      castTruePolymorph();

      fireEvent.click(screen.getByRole('button', { name: label }));

      expect(flow.handleTruePolymorphPathSelect).toHaveBeenCalledTimes(1);
      expect(flow.handleTruePolymorphPathSelect).toHaveBeenCalledWith(path);
      expect(flow.handleTruePolymorphSkip).not.toHaveBeenCalled();
    });

    it.each([
      { path: 'creature_to_creature', description: /challenge rating/i },
      { path: 'creature_to_object', description: /nonmagical object/i },
    ])('advances to the creature picker for path $path', ({ path, description }) => {
      castTruePolymorph({ path });

      const dialog = screen.getByRole('dialog', { name: 'True Polymorph' });
      expect(within(dialog).getByRole('checkbox', { name: 'Orc' })).toBeInTheDocument();
      expect(dialog).toHaveTextContent(description);
      // The path picker is gone once a path is chosen.
      expect(within(dialog).queryByRole('button', { name: 'Object into Creature' })).not.toBeInTheDocument();
    });

    it('dispatches the confirmed target to handleTruePolymorphTargetConfirm', () => {
      castTruePolymorph({ path: 'creature_to_creature' });

      const dialog = screen.getByRole('dialog', { name: 'True Polymorph' });
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Goblin' }));
      fireEvent.click(confirmButton(dialog));

      expect(flow.handleTruePolymorphTargetConfirm).toHaveBeenCalledWith(['Goblin']);
    });

    it('routes Cancel on the path picker to handleTruePolymorphSkip', () => {
      castTruePolymorph();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(flow.handleTruePolymorphSkip).toHaveBeenCalledTimes(1);
      expect(flow.handleTruePolymorphPathSelect).not.toHaveBeenCalled();
    });

    it('routes Skip on the creature picker to handleTruePolymorphSkip', () => {
      castTruePolymorph({ path: 'creature_to_object' });

      fireEvent.click(skipButton(screen.getByRole('dialog', { name: 'True Polymorph' })));

      expect(flow.handleTruePolymorphSkip).toHaveBeenCalledTimes(1);
      expect(flow.handleTruePolymorphTargetConfirm).not.toHaveBeenCalled();
    });
  });
});
