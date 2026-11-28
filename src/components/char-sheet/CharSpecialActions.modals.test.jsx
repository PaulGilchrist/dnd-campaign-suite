// @maintained-by-ai 2026-11-27
// Seam map (#76 family) — this file owns the OPEN-ROUTING seam and is the
// strongest version of those tests (see the modalOnClose.quartet headers):
//   click a Special Actions row → the clicked action flows through
//   executeHandler BY IDENTITY with campaign context → exactly one mounted
//   modal, the one its modalName dispatches to (MODAL_DISPATCH + Savant
//   fuzzy match + CHOICE_MODAL_EVENTS window-event bridge).
//   Payload threading is pinned only where a mock echo DISCRIMINATES (echo
//   text differs from the modal's own fallback): teleport ('Blink Steps' vs
//   'Teleport'), Savant (school-derived testId), boon of energy (title
//   'Boon of Energy' vs 'Energy Resistances' fallback). Name-equal echoes
//   would be masked rows, so they are not asserted.
//   Grid-lane result.logEntries flush (CharSpecialActions.jsx:823-825,
//   #1913 rec — zero component coverage elsewhere): the absent leg rides
//   every census case (addEntry untouched); the present leg + flush-before-
//   dispatch ordering is the dedicated test below. modalsInline only pins
//   confirm-path addEntry writes, not this branch.
// Not duplicated here:
//   Close/dismiss + inertness  → CharSpecialActions.modalOnClose.{arcane,combat,elemental,weapons}.test.jsx
//   Popup / null / undefined result handling → CharSpecialActions.modalsInline.test.jsx
//   Popup fallback name → CharSpecialActions.automationClickHandlers.test.jsx
//   Signature Spells confirm path → CharSpecialActions.signatureSpellsPopup.test.jsx
//   Inline-modal hosts (portent, celestial, lineage, performance targets) →
//   CharSpecialActions.modalsInline.test.jsx; twinkling → twinklingConstellations.test.jsx.
// Mocks come from the shared CharSpecialActions.modalMocks.jsx family module.
// It was extended with 'fiendish_legacy' (present in production
// INTERACTIVE_HANDLER_TYPES) so that row renders clickable and its open
// routing stays testable.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { addEntry } from '../../services/ui/logService.js';
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
    // Discriminating echo: the mock's fallback text is 'Teleport'.
    echo: 'Blink Steps',
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
    // Fuzzy-match branch of dispatchModalResult: 'EvocationSavant' is NOT a
    // MODAL_DISPATCH key — only modalName.includes('Savant') routes it, and
    // the mock's testId derives from payload.school, so this case pins both
    // the fuzzy branch and payload threading in one observable.
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
    // Discriminating echo: the host block derives title from payload.action
    // with fallback 'Energy Resistances'.
    echo: 'Boon of Energy',
  },
];

const assertNoModalMounted = () => {
  for (const { testId } of modalRoutingTests) {
    expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
  }
};

describe('CharSpecialActions - modal open routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  it.each(modalRoutingTests)(
    'clicking the $actionName row runs the automation and mounts only $name',
    async ({ actionName, automation, modalName, payload, testId, echo }) => {
      executeHandler.mockResolvedValue({ type: 'modal', modalName, payload });

      const specialAction = { name: actionName, description: `${actionName} description.`, automation };
      const playerStats = { ...basePlayerStats, specialActions: [specialAction] };
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(rowLabel(actionName)));

      // The exact modal its modalName dispatches to mounts...
      const modal = await screen.findByTestId(testId);

      // ...and the handler payload actually reached the modal (where a mock
      // echo discriminates against the modal's own fallback text).
      if (echo) {
        expect(within(modal).getByText(echo)).toBeInTheDocument();
      }

      // ...because THIS row's action object (the very array entry, uncloned)
      // was routed through the engine with the campaign context.
      expect(executeHandler).toHaveBeenCalledTimes(1);
      const [callAction, callStats, callCampaign, callMap, callCharacters] = executeHandler.mock.calls[0];
      expect(callAction).toBe(specialAction);
      expect(callStats).toBe(playerStats);
      expect(callCampaign).toBe('test');
      expect(callMap).toBeUndefined();
      expect(callCharacters).toBeUndefined();

      // A modal result without logEntries flushes nothing to the campaign log.
      expect(addEntry).not.toHaveBeenCalled();

      // Routing opened exactly one modal — no bleed into sibling modals.
      for (const other of modalRoutingTests) {
        if (other.testId !== testId) {
          expect(screen.queryByTestId(other.testId)).not.toBeInTheDocument();
        }
      }
    },
  );

  // MN-002 + #1913 rec: the grid lane flushes result.logEntries through the
  // log service BEFORE dispatching the result (CharSpecialActions.jsx:823-825).
  // Entry objects pass through untouched (identity), each tagged with the
  // campaign; the modal leg still mounts. Fixture entry shape mirrors real
  // handler returns (thirdEyeHandler.js:27).
  it('flushes a modal result logEntries through addEntry with the campaign, then still mounts the modal', async () => {
    const dieEntry = { type: 'automation', creatureName: 'TestCharacter', name: 'Blink Steps', description: 'Rolled 17 for Blink Steps.' };
    const spendEntry = { type: 'automation', creatureName: 'TestCharacter', name: 'Blink Steps', description: 'Blink Steps charge spent.' };
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'teleport',
      payload: { action: { name: 'Blink Steps' }, playerStats: basePlayerStats, campaignName: 'test' },
      logEntries: [dieEntry, spendEntry],
    });

    const playerStats = {
      ...basePlayerStats,
      specialActions: [{ name: 'Blink Steps', description: 'Blink Steps description.', automation: { type: 'teleport' } }],
    };
    render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
    fireEvent.click(screen.getByText(rowLabel('Blink Steps')));

    await screen.findByTestId('teleport-modal');
    expect(addEntry).toHaveBeenCalledTimes(2);
    expect(addEntry.mock.calls[0]).toEqual(['test', dieEntry]);
    expect(addEntry.mock.calls[0][1]).toBe(dieEntry);
    expect(addEntry.mock.calls[1][1]).toBe(spendEntry);
  });

  // bug-power-of-the-wilds-row-inert-no-producer EMIT pin: the lv14 Power of
  // the Wilds row lives in this grid (casting_time 'passive'), so its
  // combat_stance chooser must bridge out via the window event the CharActions
  // tree listens on. Pre-fix, modalName 'combatStance' matched neither
  // MODAL_DISPATCH nor CHOICE_MODAL_EVENTS — the result fell through
  // dispatchModalResult and the click produced zero observable delta.
  it('bridges a combatStance modal result out as the combat-stance-modal-show window event', async () => {
    const payload = { action: { name: 'Power of the Wilds' }, playerStats: basePlayerStats, campaignName: 'test' };
    executeHandler.mockResolvedValue({ type: 'modal', modalName: 'combatStance', payload });
    const listener = vi.fn();
    window.addEventListener('combat-stance-modal-show', listener);

    try {
      const playerStats = {
        ...basePlayerStats,
        specialActions: [{
          name: 'Power of the Wilds',
          description: 'Falcon, Lion, or Ram while raging.',
          automation: { type: 'combat_stance', effect: 'power_of_wilds_option', options: [{ name: 'Falcon' }, { name: 'Lion' }, { name: 'Ram' }] },
        }],
      };
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      fireEvent.click(screen.getByText(rowLabel('Power of the Wilds')));

      await waitFor(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      });
      expect(listener.mock.calls[0][0].detail).toBe(payload);
      // The grid itself mounts no modal — the chooser lives in the CharActions
      // tree: witness every census testId stays absent.
      assertNoModalMounted();
    } finally {
      window.removeEventListener('combat-stance-modal-show', listener);
    }
  });

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
    ({ action, cannotAct }) => {
      executeHandler.mockResolvedValue({ type: 'popup', payload: { name: 'Should not fire' } });

      const playerStats = { ...basePlayerStats, specialActions: [action] };
      render(<CharSpecialActions playerStats={playerStats} campaignName="test" cannotAct={cannotAct} />);
      fireEvent.click(screen.getByText(rowLabel(action.name)));

      // The gate/row filter short-circuits synchronously in the click handler:
      // zero dispatch, zero log flush, zero modal (the reason-popup copy is
      // pinned by the useMagicDevice lane; only denial lives here).
      expect(executeHandler).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      assertNoModalMounted();
    },
  );
});
