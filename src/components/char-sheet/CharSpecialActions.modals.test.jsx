// @maintained-by-ai
// Seam map (#76 family) — this file owns the OPEN-ROUTING seam and is the
// strongest version of those tests (see the modalOnClose.quartet headers):
//   click a Special Actions row → the clicked action flows through
//   executeHandler with campaign context → exactly one mounted modal, the
//   one its modalName dispatches to (MODAL_DISPATCH + Savant fuzzy match).
// Not duplicated here:
//   Close/dismiss + inertness  → CharSpecialActions.modalOnClose.{arcane,combat,elemental,weapons}.test.jsx
//   Popup / null / undefined result handling → CharSpecialActions.modalsInline.test.jsx
//   Popup fallback name → CharSpecialActions.automationClickHandlers.test.jsx
//   Signature Spells confirm path → CharSpecialActions.signatureSpellsPopup.test.jsx
// Mocks come from the shared CharSpecialActions.modalMocks.jsx family module.
// It was extended with 'fiendish_legacy' (present in production
// INTERACTIVE_HANDLER_TYPES) so that row renders clickable and its open
// routing stays testable.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';

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

// CharSpecialActions renders each clickable row label as `<b>Name:</b>` (the
// colon is a separate text node, and some modals echo the bare name, so the
// tag-scoped matcher is the precise handle for the clickable row).
const rowLabel = (name) => (_content, element) =>
  element?.tagName === 'B' && element.textContent === `${name}:`;

const modalRoutingTests = [
  {
    name: 'TeleportModal',
    modalName: 'teleport',
    actionName: 'Blink Steps',
    automation: { type: 'teleport' },
    payload: { action: { name: 'Blink Steps' }, playerStats: basePlayerStats, campaignName: 'test' },
    testId: 'teleport-modal',
  },
  {
    name: 'SignatureSpellsModal',
    modalName: 'signatureSpells',
    actionName: 'Signature Spells',
    automation: { type: 'signature_spells' },
    payload: { action: { name: 'Signature Spells' }, playerStats: basePlayerStats, campaignName: 'test', level3Options: ['Fireball', 'Haste'] },
    testId: 'signature-spells-modal',
  },
  {
    name: 'SpellMasteryModal',
    modalName: 'spellMastery',
    actionName: 'Spell Mastery',
    automation: { type: 'spell_mastery' },
    payload: { action: { name: 'Spell Mastery' }, playerStats: basePlayerStats, campaignName: 'test', levelOptions: ['Mage Armor', 'Shield'] },
    testId: 'spell-mastery-modal',
  },
  {
    name: 'SavantModal',
    modalName: 'EvocationSavant',
    actionName: 'Evocation Savant',
    automation: { type: 'passive_rule', effect: 'evocation_savant' },
    payload: { action: { name: 'Evocation Savant' }, playerStats: basePlayerStats, campaignName: 'test', school: 'Evocation', spellOptions: ['Shocking Burst', 'Flaming Burst'] },
    testId: 'evocation-savant-modal',
  },
  {
    name: 'WeaponKindMasteryModal',
    modalName: 'weaponKindMastery',
    actionName: 'Weapon Kind Mastery',
    automation: { type: 'weapon_kind_mastery' },
    payload: { action: { name: 'Weapon Kind Mastery' } },
    testId: 'weapon-kind-mastery-modal',
  },
  {
    name: 'WeaponMasteryChoiceModal',
    modalName: 'weaponMasteryChoice',
    actionName: 'Weapon Mastery',
    automation: { type: 'weapon_mastery_choice' },
    payload: { action: { name: 'Weapon Mastery' } },
    testId: 'weapon-mastery-choice-modal',
  },
  {
    name: 'ResourcePoolModal',
    modalName: 'resourcePool',
    actionName: 'Resource Pool',
    automation: { type: 'resource_pool' },
    payload: { automation: { type: 'resource_pool' } },
    testId: 'resource-pool-modal',
  },
  {
    name: 'NaturalRecoveryModal',
    modalName: 'naturalRecovery',
    actionName: 'Natural Recovery',
    automation: { type: 'natural_recovery' },
    payload: {},
    testId: 'natural-recovery-modal',
  },
  {
    name: 'CircleOfTheLandSpellsModal',
    modalName: 'circleOfTheLandSpells',
    actionName: 'Circle of the Land',
    automation: { type: 'circle_of_the_land' },
    payload: {},
    testId: 'circle-of-the-land-modal',
  },
  {
    name: 'ElementalAffinityModal',
    modalName: 'elementalAffinity',
    actionName: 'Elemental Affinity',
    automation: { type: 'elemental_affinity' },
    payload: { action: { name: 'Elemental Affinity' } },
    testId: 'elemental-affinity-modal',
  },
  {
    name: 'WildMagicSurgeModal',
    modalName: 'wildMagicSurge',
    actionName: 'Wild Magic Surge',
    automation: { type: 'wild_magic_surge' },
    payload: {},
    testId: 'wild-magic-surge-modal',
  },
  {
    name: 'StrideOfTheElementsModal',
    modalName: 'strideOfTheElements',
    actionName: 'Stride of the Elements',
    automation: { type: 'stride_of_elements' },
    payload: { action: { name: 'Stride of the Elements' } },
    testId: 'stride-of-the-elements-modal',
  },
  {
    name: 'ElementalEpitomeModal',
    modalName: 'elementalEpitome',
    actionName: 'Elemental Epitome',
    automation: { type: 'elemental_epitome' },
    payload: { action: { name: 'Elemental Epitome' } },
    testId: 'elemental-epitome-modal',
  },
  {
    name: 'DestructiveStrideModal',
    modalName: 'destructiveStride',
    actionName: 'Destructive Stride',
    automation: { type: 'destructive_stride' },
    payload: { action: { name: 'Destructive Stride' } },
    testId: 'destructive-stride-modal',
  },
  {
    name: 'QuiveringPalmModal',
    modalName: 'quiveringPalm',
    actionName: 'Quivering Palm',
    automation: { type: 'quivering_palm' },
    payload: {},
    testId: 'quivering-palm-modal',
  },
  {
    name: 'StepsOfTheFeyTauntModal',
    modalName: 'stepsOfTheFeyTaunt',
    actionName: 'Steps of the Fey Taunt',
    automation: { type: 'steps_of_the_fey_taunt' },
    payload: {},
    testId: 'steps-of-the-fey-taunt-modal',
  },
  {
    name: 'HurlThroughHellModal',
    modalName: 'hurlThroughHell',
    actionName: 'Hurl Through Hell',
    automation: { type: 'hurl_through_hell' },
    payload: {},
    testId: 'hurl-through-hell-modal',
  },
  {
    name: 'ClairvoyantCombatantModal',
    modalName: 'clairvoyantCombatant',
    actionName: 'Clairvoyant Combatant',
    automation: { type: 'clairvoyant_combatant' },
    payload: {},
    testId: 'clairvoyant-combatant-modal',
  },
  {
    name: 'FiendishResilienceModal',
    modalName: 'fiendishResilience',
    actionName: 'Fiendish Resilience',
    automation: { type: 'fiendish_resilience' },
    payload: { action: { name: 'Fiendish Resilience' }, playerStats: basePlayerStats, campaignName: 'test' },
    testId: 'single-resistance-modal',
  },
  {
    name: 'FiendishLegacyModal',
    modalName: 'fiendishLegacy',
    actionName: 'Fiendish Legacy',
    automation: { type: 'fiendish_legacy' },
    payload: { action: { name: 'Fiendish Legacy' }, playerStats: basePlayerStats, campaignName: 'test' },
    testId: 'fiendish-legacy-modal',
  },
  {
    name: 'MultiResistanceSelectionModal',
    modalName: 'boonOfEnergyResistance',
    actionName: 'Boon of Energy',
    automation: { type: 'boon_of_energy_resistance' },
    payload: { action: { name: 'Boon of Energy' }, damageTypes: ['Fire', 'Cold', 'Lightning'], existingTypes: [], maxSelections: 2, playerStats: basePlayerStats, campaignName: 'test' },
    testId: 'multi-resistance-modal',
  },
];

describe('CharSpecialActions - modal open routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  it.each(modalRoutingTests)(
    'clicking the $actionName row runs the automation and mounts only $name',
    async ({ actionName, automation, modalName, payload, testId }) => {
      executeHandler.mockResolvedValue({ type: 'modal', modalName, payload });

      const playerStats = {
        ...basePlayerStats,
        specialActions: [{ name: actionName, description: `${actionName} description.`, automation }],
      };
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(rowLabel(actionName)));

      // The exact modal its modalName dispatches to mounts...
      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });

      // ...because THIS row's action object (identity-relevant fields) was
      // routed through the engine with the campaign context.
      expect(executeHandler).toHaveBeenCalledTimes(1);
      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({ name: actionName, automation }),
        expect.objectContaining({ name: basePlayerStats.name }),
        'test',
        undefined,
        undefined,
      );

      // Routing opened exactly one modal — no bleed into sibling modals.
      for (const other of modalRoutingTests) {
        if (other.testId !== testId) {
          expect(screen.queryByTestId(other.testId)).not.toBeInTheDocument();
        }
      }
    },
  );

  it.each([
    {
      reason: 'cannotAct is true',
      action: { name: 'Blocked Action', description: 'Blocked.', automation: { type: 'teleport' } },
      cannotAct: true,
    },
    {
      reason: 'the action declares no automation',
      action: { name: 'Plain Action', description: 'No automation here.' },
    },
  ])(
    'does not run the automation when $reason',
    async ({ action, cannotAct }) => {
      executeHandler.mockResolvedValue({ type: 'popup', payload: { name: 'Should not fire' } });

      const playerStats = { ...basePlayerStats, specialActions: [action] };
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" cannotAct={cannotAct} />);
      fireEvent.click(screen.getByText(rowLabel(action.name)));

      await waitFor(() => {
        expect(executeHandler).not.toHaveBeenCalled();
      });
      expect(screen.queryByTestId('teleport-modal')).not.toBeInTheDocument();
    },
  );
});
