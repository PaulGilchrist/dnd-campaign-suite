// @maintained-by-ai
/**
 * CharSpells — target-selection modals (integration wiring).
 *
 * Verifies the CharSpells → TargetSpellPopups / CreatureTargetPopups boundary:
 * how each `pending*` step produced by useSpellMetamagicFlow maps to the right
 * modal (title, targets, confirm label) and how user selections dispatch to the
 * correct flow handler with the correct payload shape (array vs object vs raw
 * name — these differ per spell and are the real defect surface).
 *
 * One test per spell covers the whole routing seam (render → pick SECOND target
 * → assert payload → Skip), because the per-spell risk is the wiring itself:
 * pending key → modal title → confirm handler → payload shape → skip handler.
 * Modal internals (confirm-disabled-until-picked, multi-select caps, count
 * badges) are owned by the modal suites (../modals/shared/*.test.jsx,
 * ../modals/HexAbilityModal.test.jsx) and are NOT re-asserted here.
 *
 * Modals are stubbed with a FAITHFUL MINIMAL contract mirroring the real
 * components' user behavior — radio row selects then Confirm dispatches the
 * selection (SecondaryTargetModal), checkbox rows toggle then Confirm dispatches
 * the selected array with a live count (CreatureSelectionModal), damage-type
 * radios then Choose dispatches the type (SingleResistanceSelectionModal),
 * ability buttons dispatch the ability key from the `abilities` prop
 * (HexAbilityModal, whose stub default INCLUDES CON as a tripwire so a missing
 * or wrong abilities prop from CharSpells cannot pass the CON-exclusion test) —
 * so tests drive real user behavior via accessible roles.
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
// dispatches onTargetSelected(selected), Skip closes.
vi.mock('../modals/shared/SecondaryTargetModal.jsx', async () => {
  const { useState } = await import('react');
  return {
    default: function SecondaryTargetModalStub({ title, targets = [], onTargetSelected, onSkip, description, confirmLabel }) {
      const [selected, setSelected] = useState(null);
      return (
        <div role="dialog" aria-label={title}>
          {description && <p dangerouslySetInnerHTML={{ __html: description }} />}
          {targets.map((t) => (
            <label key={t.name}>
              <input
                type="radio"
                name="secondaryTarget"
                checked={selected === t.name}
                onChange={() => setSelected(t.name)}
              />
              {t.name}
            </label>
          ))}
          <button type="button" onClick={() => onTargetSelected?.(selected)}>
            {confirmLabel || 'Attack'}
          </button>
          <button type="button" onClick={() => onSkip?.()}>Skip</button>
        </div>
      );
    },
  };
});

// Mirrors CreatureSelectionModal's multi-select contract: checkbox rows toggle
// (disabled at maxTargets), Confirm dispatches the selected-name array with a
// live count in its label, Skip closes.
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
          <button type="button" onClick={() => onConfirm?.(selected)}>
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
        <div role="dialog" aria-label={title || action?.name || 'Choose Damage Type'}>
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
          <button type="button" onClick={() => onConfirm?.(selected)}>Choose Damage Type</button>
          <button type="button" onClick={() => onClose?.()}>Cancel</button>
        </div>
      );
    },
  };
});

// Mirrors HexAbilityModal: renders exactly the `abilities` prop it is given,
// each button dispatches its key. The stub default INCLUDES CON — CharSpells
// must pass its own CON-excluded list (project rule) for the tests to pass.
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

// Protection from Energy and Resistance share one shape: SecondaryTargetModal at
// the 'target' stage (raw name to targetSelect) → SingleResistanceSelectionModal
// at the 'type' stage (damage type to typeSelect). Parameterized over both.
const STAGED_TYPE_FLOWS = [
  {
    pending: 'pendingProtectionFromEnergy',
    stageKey: 'protectionFromEnergyStage',
    title: 'Protection from Energy',
    castLabel: 'Cast Protection from Energy',
    damageTypes: ['fire', 'cold', 'lightning'],
    targetSelect: 'handleProtectionFromEnergyTargetSelect',
    typeSelect: 'handleProtectionFromEnergyTypeSelect',
    skip: 'handleProtectionFromEnergySkip',
  },
  {
    pending: 'pendingResistance',
    stageKey: 'resistanceStage',
    title: 'Resistance',
    castLabel: 'Cast Resistance',
    damageTypes: ['fire', 'acid'],
    targetSelect: 'handleResistanceTargetSelect',
    typeSelect: 'handleResistanceTypeSelect',
    skip: 'handleResistanceSkip',
  },
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
    it.each(SECONDARY_SPELLS)('routes the picked target to $confirm and Skip to $skip for $title', (spell) => {
      castPending(spell);

      const dialog = screen.getByRole('dialog', { name: spell.title });
      expect(within(dialog).getByRole('radio', { name: 'Orc' })).toBeInTheDocument();

      // Pick the SECOND target so a payload of "all targets" or "first target" fails.
      fireEvent.click(within(dialog).getByRole('radio', { name: 'Goblin' }));
      fireEvent.click(within(dialog).getByRole('button', { name: spell.confirmLabel }));

      expect(flow[spell.confirm]).toHaveBeenCalledTimes(1);
      expect(flow[spell.confirm]).toHaveBeenCalledWith(spell.payload('Goblin'));
      expect(flow[spell.skip]).not.toHaveBeenCalled();

      fireEvent.click(skipButton(dialog));
      expect(flow[spell.skip]).toHaveBeenCalledTimes(1);
      expect(flow[spell.confirm]).toHaveBeenCalledTimes(1);
    });

    it('interpolates the live pending range into the Remove Curse description', () => {
      castPending({
        ...SECONDARY_SPELLS.find((s) => s.pending === 'pendingRemoveCurse'),
        state: { range: '90 feet' },
      });

      expect(screen.getByRole('dialog', { name: 'Remove Curse' })).toHaveTextContent(/within 90 feet/i);
    });
  });

  describe('staged flow — Enhance Ability', () => {
    const flowAtStage = (stage) => {
      flow = {
        pendingEnhanceAbility: { creatureTargets: TARGETS },
        enhanceAbilityStage: stage,
        handleEnhanceAbilityAbilitySelect: vi.fn(),
        handleEnhanceAbilityConfirm: vi.fn(),
        handleEnhanceAbilitySkip: vi.fn(),
      };
      return renderCharSpells();
    };

    it('offers exactly the five CON-excluded abilities at the ability stage, dispatching the pick or Cancel', () => {
      flowAtStage('ability');

      const dialog = screen.getByRole('dialog', { name: 'Enhance Ability — Choose Ability' });
      // The offered list must come from CharSpells' prop, not the stub default (which includes CON).
      for (const label of ['Strength (STR)', 'Dexterity (DEX)', 'Intelligence (INT)', 'Wisdom (WIS)', 'Charisma (CHA)']) {
        expect(within(dialog).getByRole('button', { name: label })).toBeInTheDocument();
      }
      // CON is intentionally not eligible — see enhanceAbilityHandler.test.js.
      expect(within(dialog).queryByRole('button', { name: /Constitution/ })).not.toBeInTheDocument();
      // The target picker must not appear alongside the ability picker.
      expect(screen.queryByRole('dialog', { name: 'Enhance Ability' })).not.toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Dexterity (DEX)' }));
      expect(flow.handleEnhanceAbilityAbilitySelect).toHaveBeenCalledWith('DEX');

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(flow.handleEnhanceAbilitySkip).toHaveBeenCalledTimes(1);
      expect(flow.handleEnhanceAbilityAbilitySelect).toHaveBeenCalledTimes(1);
    });

    it('shows the creature target picker at the target stage and dispatches the pick or Skip', () => {
      flowAtStage('target');

      expect(screen.queryByRole('dialog', { name: 'Enhance Ability — Choose Ability' })).not.toBeInTheDocument();
      const dialog = screen.getByRole('dialog', { name: 'Enhance Ability' });
      fireEvent.click(within(dialog).getByRole('radio', { name: 'Goblin' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cast Enhance Ability' }));
      expect(flow.handleEnhanceAbilityConfirm).toHaveBeenCalledWith(['Goblin']);

      fireEvent.click(skipButton(dialog));
      expect(flow.handleEnhanceAbilitySkip).toHaveBeenCalledTimes(1);
      expect(flow.handleEnhanceAbilityConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('staged flows — Protection from Energy & Resistance', () => {
    it.each(STAGED_TYPE_FLOWS)('routes $title through its target then damage-type stage', (spell) => {
      flow = {
        [spell.pending]: { creatureTargets: TARGETS, range: 'Touch', damageTypes: spell.damageTypes },
        [spell.stageKey]: 'target',
        [spell.targetSelect]: vi.fn(),
        [spell.typeSelect]: vi.fn(),
        [spell.skip]: vi.fn(),
      };
      const view = renderCharSpells();

      // Target stage: creature picker, raw-name dispatch.
      const targetDialog = screen.getByRole('dialog', { name: spell.title });
      expect(targetDialog).toHaveTextContent(/within Touch/i);
      fireEvent.click(within(targetDialog).getByRole('radio', { name: 'Goblin' }));
      fireEvent.click(within(targetDialog).getByRole('button', { name: spell.castLabel }));
      expect(flow[spell.targetSelect]).toHaveBeenCalledWith('Goblin');
      expect(flow[spell.typeSelect]).not.toHaveBeenCalled();
      fireEvent.click(skipButton(targetDialog));
      expect(flow[spell.skip]).toHaveBeenCalledTimes(1);
      view.unmount();

      // Type stage: damage-type picker only, dispatches the chosen type; Cancel skips.
      flow = { ...flow, [spell.stageKey]: 'type' };
      renderCharSpells();
      expect(screen.queryByRole('dialog', { name: spell.title })).not.toBeInTheDocument();
      const typeDialog = screen.getByRole('dialog', { name: 'Choose Damage Type' });
      for (const type of spell.damageTypes) {
        expect(within(typeDialog).getByRole('radio', { name: type })).toBeInTheDocument();
      }
      const chosen = spell.damageTypes[spell.damageTypes.length - 1];
      fireEvent.click(within(typeDialog).getByRole('radio', { name: chosen }));
      fireEvent.click(within(typeDialog).getByRole('button', { name: 'Choose Damage Type' }));
      expect(flow[spell.typeSelect]).toHaveBeenCalledWith(chosen);

      fireEvent.click(within(typeDialog).getByRole('button', { name: 'Cancel' }));
      expect(flow[spell.skip]).toHaveBeenCalledTimes(2);
      expect(flow[spell.targetSelect]).toHaveBeenCalledTimes(1);
    });
  });

  describe('CreatureSelectionModal spells', () => {
    it.each(CREATURE_MODAL_SPELLS)('routes the checked creature to $confirm and Skip to $skip for $title', (spell) => {
      castPending(spell);

      const dialog = screen.getByRole('dialog', { name: spell.title });
      expect(within(dialog).getByRole('checkbox', { name: 'Orc' })).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Goblin' }));
      fireEvent.click(confirmButton(dialog));

      expect(flow[spell.confirm]).toHaveBeenCalledTimes(1);
      expect(flow[spell.confirm]).toHaveBeenCalledWith(['Goblin']);
      expect(flow[spell.skip]).not.toHaveBeenCalled();

      fireEvent.click(skipButton(dialog));
      expect(flow[spell.skip]).toHaveBeenCalledTimes(1);
      expect(flow[spell.confirm]).toHaveBeenCalledTimes(1);
    });

    it('caps multi-target selection at the pending maxTargets and dispatches all checked names in order', () => {
      // If CharSpells dropped the maxTargets prop, the third target would stay
      // selectable and the payload would carry three names.
      castPending({
        ...CREATURE_MODAL_SPELLS.find((s) => s.pending === 'pendingBless'),
        state: { creatureTargets: ['Orc', 'Goblin', 'Ogre'], maxTargets: 2 },
      });

      const dialog = screen.getByRole('dialog', { name: 'Bless' });
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Orc' }));
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Goblin' }));
      const ogre = within(dialog).getByRole('checkbox', { name: 'Ogre' });
      expect(ogre).toBeDisabled();
      fireEvent.click(ogre);
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

    it('routes every transformation path and Cancel from the path picker, before any creature picker', () => {
      castTruePolymorph();

      const dialog = screen.getByRole('dialog', { name: 'True Polymorph' });
      expect(within(dialog).queryByRole('checkbox', { name: 'Orc' })).not.toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Creature into Creature' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Object into Creature' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Creature into Object' }));
      expect(flow.handleTruePolymorphPathSelect.mock.calls).toEqual([
        ['creature_to_creature'],
        ['object_into_creature'],
        ['creature_to_object'],
      ]);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(flow.handleTruePolymorphSkip).toHaveBeenCalledTimes(1);
      expect(flow.handleTruePolymorphPathSelect).toHaveBeenCalledTimes(3);
    });

    it.each([
      { path: 'creature_to_creature', description: /challenge rating/i },
      { path: 'creature_to_object', description: /nonmagical object/i },
    ])('advances to the creature picker for path $path, dispatching confirm or Skip', ({ path, description }) => {
      castTruePolymorph({ path });

      const dialog = screen.getByRole('dialog', { name: 'True Polymorph' });
      expect(within(dialog).getByRole('checkbox', { name: 'Orc' })).toBeInTheDocument();
      expect(dialog).toHaveTextContent(description);
      // The path picker is gone once a path is chosen.
      expect(within(dialog).queryByRole('button', { name: 'Object into Creature' })).not.toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Goblin' }));
      fireEvent.click(confirmButton(dialog));
      expect(flow.handleTruePolymorphTargetConfirm).toHaveBeenCalledWith(['Goblin']);

      fireEvent.click(skipButton(dialog));
      expect(flow.handleTruePolymorphSkip).toHaveBeenCalledTimes(1);
      expect(flow.handleTruePolymorphTargetConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
