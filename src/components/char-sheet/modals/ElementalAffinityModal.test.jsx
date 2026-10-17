// @maintained-by-ai
// Ownership — this file owns ElementalAffinityModal in isolation: exact header
// and intro copy across all three branches (new choice / change-current /
// elemental_adept); radio options driven verbatim by action.automation.damageTypes
// (default fallback, custom subset, empty-array inertness); the disabled-until-
// selected gate with Choose/Change Damage Type labels; the '(current)' marker and
// its hide-on-any-selection quirk; the applyTypeChoice seam with identity-pinned
// frozen props; the result-view swap (popup description rendered verbatim, exactly
// one Done closing exactly once); Cancel-only close; and overlay/modal inertness
// in both views. The component is fully local-state — no runtime-store reads — so
// no live stores here; the handler seam is mocked.
//
// NOTE — flagged product defects (ElementalAffinityModal audit), NOT fixed here:
// 1. Unguarded await: handleApply awaits applyTypeChoice with no try/catch — a
//    rejection escapes as an unhandledRejection (guarded in the pin below) and
//    leaves the selection view with no error UI (pinned).
// 2. No in-flight guard: the apply button is never disabled during the await, so
//    a double click fires applyTypeChoice twice — two chosenType store writes and
//    two ability_use log entries (store internals owned by the handler lane; the
//    double-fire itself is pinned below).
// 3. Null-result trap: the `applied && result` guard falls through to the live
//    selection view when the handler resolves null (invalid type), keeping the
//    stale selection and inviting a re-click (pinned).
// 4. XSS sink: result.payload.description flows through dangerouslySetInnerHTML
//    with no sanitize.js import — action.name reaches the HTML unescaped (the
//    real handler emits plain text today; flag only, no markup fixture).
// 5. House-rule violation: inline styles on the options wrapper, radio inputs,
//    intro spacer, and '(current)' span (component-side, flagged only).
//
// Deferred to owners:
// - CharSpecialActions.jsx + CharSpecialActionsModals.jsx / CharActionModals.
//   SecondaryModals.jsx render sites — the elemental_affinity and
//   damage_type_choice interactive-types lane (CharSpecialActions.modalMocks.jsx),
//   the setElementalAffinityModal open payload wiring, and close-on-unmount
//   (CharSpecialActions.modalOnClose.elemental.test.jsx; secondary-targets /
//   modal-closes-3 / async-confirm-handlers lanes mock this component).
// - elementalAffinityHandler.js + elementalAffinityHandler.test.js — chosenType
//   store reads/writes, "set to"/"changed to" log copy, Fiendish Resilience
//   delegation, and the popup payload shape consumed here as verbatim frozen
//   mirrors (elementalAffinityHandler.js:79-81).
// - No mechanic overlap with ElementalAttunementModal / ElementalBurstModal /
//   StrideOfTheElementsModal / SingleResistanceSelectionModal lanes — distinct
//   features and components, not re-pinned here.

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElementalAffinityModal from './ElementalAffinityModal.jsx';

// The handler is the component's only external seam; its imports
// (choiceStorage, logService) never load under this mock, so they are not
// stubbed here — the handler lane owns them.
vi.mock('../../../services/automation/handlers/class-sorcerer/elementalAffinityHandler.js', () => ({
  applyTypeChoice: vi.fn(),
}));

import { applyTypeChoice } from '../../../services/automation/handlers/class-sorcerer/elementalAffinityHandler.js';

// ── Fixtures ──
// Frozen so the identity pins below prove the component forwards the SAME
// action/playerStats objects from props to the apply seam, unmutated. Popup
// descriptions mirror the real handler templates verbatim
// (elementalAffinityHandler.js:79-81) — no fixture-echo of invented copy.

const DEFAULT_DAMAGE_TYPES = Object.freeze(['Acid', 'Cold', 'Fire', 'Lightning', 'Poison']);
const ADEPT_DAMAGE_TYPES = Object.freeze(['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']);

const ACTION = Object.freeze({
  name: 'Elemental Affinity',
  type: 'elemental_affinity',
  automation: Object.freeze({ type: 'elemental_affinity', damageTypes: DEFAULT_DAMAGE_TYPES }),
});

const ADEPT_ACTION = Object.freeze({
  name: 'Elemental Affinity',
  type: 'elemental_affinity',
  effect: 'elemental_adept',
  automation: Object.freeze({ type: 'elemental_affinity', damageTypes: ADEPT_DAMAGE_TYPES, effect: 'elemental_adept' }),
});

const PLAYER_STATS = Object.freeze({ name: 'Sorcerer1', level: 1, charismaModifier: 3 });

const INTRO_DEFAULT = 'Choose one damage type (Acid, Cold, Fire, Lightning, or Poison). You gain resistance to that type. When you cast a spell that deals damage of that type, add your Charisma modifier to one damage roll.';
const INTRO_ADEPT = 'Choose one of the following damage types (Acid, Cold, Fire, Lightning, or Thunder). Spells you cast ignore Resistance to damage of the chosen type. In addition, when you roll damage for a spell you cast that deals damage of that type, you can treat any 1 on a damage die as a 2.';
const INTRO_CHANGE = 'Change damage type (currently Fire):';

const NORMAL_POPUP = Object.freeze({
  type: 'popup',
  payload: Object.freeze({
    type: 'automation_info',
    name: 'Elemental Affinity',
    automationType: 'elemental_affinity',
    description: 'Elemental Affinity: Fire selected. You gain resistance to Fire damage. When you cast a spell that deals Fire damage, add your Charisma modifier.',
    automation: ACTION,
  }),
});

const ADEPT_POPUP = Object.freeze({
  type: 'popup',
  payload: Object.freeze({
    type: 'automation_info',
    name: 'Elemental Affinity',
    automationType: 'elemental_affinity',
    description: 'Elemental Affinity: Fire selected. Spells you cast ignore Resistance to damage of the chosen type. In addition, when you roll damage for a spell you cast that deals damage of that type, you can treat any 1 on a damage die as a 2.',
    automation: ADEPT_ACTION,
  }),
});

// Fresh onClose per call — no cross-test mock residue, no clearAllMocks.
function makeProps(overrides = {}) {
  return { action: ACTION, playerStats: PLAYER_STATS, campaignName: 'test-campaign', onClose: vi.fn(), ...overrides };
}

function makeAction(overrides = {}) {
  return { ...ACTION, ...overrides };
}

const applyBtn = () => screen.getByRole('button', { name: /Damage Type/ });

function radios(container) {
  return [...container.querySelectorAll('input[type="radio"]')];
}

// Label text minus the conditional '(current)' suffix.
function optionTexts(container) {
  return radios(container).map(r => r.closest('label').textContent.replace('(current)', '').trim());
}

// ── Tests ──

describe('ElementalAffinityModal', () => {
  let rejectionGuard = null;

  beforeEach(() => {
    applyTypeChoice.mockResolvedValue(NORMAL_POPUP);
  });

  afterEach(() => {
    if (rejectionGuard) {
      process.off('unhandledRejection', rejectionGuard);
      rejectionGuard = null;
    }
    // Per-mock reset (no resetAllMocks): the seam clears its resolved-value
    // config between tests; onClose is fresh per makeProps.
    applyTypeChoice.mockReset();
  });

  // ── Initial render ──

  it('renders the bolt header, exact default intro, five default radios, disabled "Choose Damage Type" and live Cancel', () => {
    const { container } = render(<ElementalAffinityModal {...makeProps()} />);
    expect(container.querySelector('.sp-overlay .sp-modal')).toBeInTheDocument();
    expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();
    expect(container.querySelector('.sp-header i.fa-bolt')).toBeInTheDocument();
    expect(screen.getByText(INTRO_DEFAULT)).toBeInTheDocument();
    expect(screen.queryByText(INTRO_ADEPT)).not.toBeInTheDocument();
    expect(screen.queryByText('(current)')).not.toBeInTheDocument();
    expect(optionTexts(container)).toEqual([...DEFAULT_DAMAGE_TYPES]);
    expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it.each([
    { action: ACTION, title: 'Elemental Affinity' },
    { action: makeAction({ name: 'Custom Affinity' }), title: 'Custom Affinity' },
    { action: makeAction({ name: undefined }), title: 'Elemental Affinity' },
  ])('renders header title "$title" for action.name=$action.name', ({ action, title }) => {
    render(<ElementalAffinityModal {...makeProps({ action })} />);
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  // ── Intro copy branches ──

  it.each([
    { label: 'new-choice', action: ACTION, shown: INTRO_DEFAULT, hidden: INTRO_CHANGE },
    { label: 'change-current', action: makeAction({ existingType: 'Fire' }), shown: INTRO_CHANGE, hidden: INTRO_DEFAULT },
    { label: 'elemental_adept', action: ADEPT_ACTION, shown: INTRO_ADEPT, hidden: INTRO_DEFAULT },
  ])('renders the exact $label intro line and never the sibling copy', ({ action, shown, hidden }) => {
    render(<ElementalAffinityModal {...makeProps({ action })} />);
    expect(screen.getByText(shown)).toBeInTheDocument();
    expect(screen.queryByText(hidden)).not.toBeInTheDocument();
  });

  // ── Damage type options ──

  it.each([
    { action: Object.freeze({ name: 'Elemental Affinity' }), types: DEFAULT_DAMAGE_TYPES },
    { action: makeAction({ automation: Object.freeze({ type: 'class_feature', damageTypes: ['Fire', 'Cold'] }) }), types: ['Fire', 'Cold'] },
    { action: ADEPT_ACTION, types: ADEPT_DAMAGE_TYPES },
    { action: makeAction({ automation: Object.freeze({ type: 'class_feature', damageTypes: [] }) }), types: [] },
  ])('renders radio options exactly $types from action.automation.damageTypes', ({ action, types }) => {
    const { container } = render(<ElementalAffinityModal {...makeProps({ action })} />);
    expect(optionTexts(container)).toEqual([...types]);
    if (types.length === 0) {
      expect(applyBtn()).toBeDisabled();
    }
  });

  // ── Selection round-trip ──

  it('single-selects radios, enabling apply, and keeps the previous radio unchecked on switch', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByLabelText('Fire')).toBeChecked();
    expect(applyBtn()).toBeEnabled();

    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByLabelText('Cold')).toBeChecked();
    expect(screen.getByLabelText('Fire')).not.toBeChecked();
  });

  // Quirk pin: the '(current)' span renders only while NOTHING is selected
  // (`isExisting && !selected`), so choosing any type hides even the marker
  // on the current type itself.
  it('marks the existing type with "(current)", renames apply to "Change Damage Type", and hides the marker after any selection', () => {
    const { container } = render(<ElementalAffinityModal {...makeProps({ action: makeAction({ existingType: 'Fire' }) })} />);
    const fire = radios(container).find(r => r.closest('label').textContent.startsWith('Fire'));
    expect(fire.closest('label').textContent).toBe('Fire(current)');
    expect(screen.queryByText('(current)')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByLabelText('Cold')).toBeChecked();
    expect(screen.queryByText('(current)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Damage Type' })).toBeEnabled();
  });

  // ── Apply seam — exact identity-pinned args ──

  it('stays inert on a disabled click, then fires applyTypeChoice exactly once with the identity-pinned props and selected type', async () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(applyBtn());
    expect(applyTypeChoice).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(applyBtn());
    });

    expect(applyTypeChoice).toHaveBeenCalledTimes(1);
    const [sentAction, sentStats, sentCampaign, sentType] = applyTypeChoice.mock.calls[0];
    // Identity pins: the exact frozen objects from props, never a reconstructed copy.
    expect(sentAction).toBe(ACTION);
    expect(sentStats).toBe(PLAYER_STATS);
    expect(sentCampaign).toBe('test-campaign');
    expect(sentType).toBe('Fire');
  });

  // ── Result view ──

  it.each([
    { label: 'baseline resistance popup', popup: NORMAL_POPUP, action: ACTION, description: NORMAL_POPUP.payload.description },
    { label: 'elemental_adept popup', popup: ADEPT_POPUP, action: ADEPT_ACTION, description: ADEPT_POPUP.payload.description },
  ])('replaces all controls with one Done after apply ($label), renders the exact popup description, and closes exactly once', async ({ popup, action, description }) => {
    const onClose = vi.fn();
    applyTypeChoice.mockResolvedValue(popup);
    const { container } = render(<ElementalAffinityModal {...makeProps({ action, onClose })} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(applyBtn());
    });

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByText(INTRO_DEFAULT)).not.toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();

    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector('.sp-overlay'));
    fireEvent.click(container.querySelector('.sp-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(done).toBeInTheDocument();
  });

  // ── Close / dismiss inertness (pre-apply) ──

  it('is inert to overlay and modal clicks and closes exactly once via Cancel without applying', () => {
    const onClose = vi.fn();
    const { container } = render(<ElementalAffinityModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText('Fire'));

    fireEvent.click(container.querySelector('.sp-overlay'));
    fireEvent.click(container.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
    expect(applyTypeChoice).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Fire')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(applyTypeChoice).not.toHaveBeenCalled();
  });

  // ── Defect pins ──

  it('keeps the live selection intact with no Done when the handler resolves null (defect 3)', async () => {
    applyTypeChoice.mockResolvedValueOnce(null);
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(applyBtn());
    });

    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeChecked();
    expect(applyBtn()).toBeEnabled();
    expect(applyTypeChoice).toHaveBeenCalledTimes(1);
  });

  it('fires applyTypeChoice twice on a double click before the result view swaps (defect 2)', async () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));

    // Both clicks land synchronously, before the async result view swaps —
    // no disabled/in-flight guard stops the second apply.
    await act(async () => {
      fireEvent.click(applyBtn());
      fireEvent.click(applyBtn());
    });

    expect(applyTypeChoice).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('keeps the selection view with no error UI and stays retryable when the handler rejects (defect 1)', async () => {
    // handleApply has no try/catch — the rejection escapes as an
    // unhandledRejection; the guard keeps only the pinned view contract in play.
    rejectionGuard = () => {};
    process.on('unhandledRejection', rejectionGuard);
    applyTypeChoice.mockRejectedValue(new Error('Network error'));
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(applyBtn());
    });

    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeChecked();
    expect(applyBtn()).toBeEnabled();
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();

    // Live retry reaches the seam again.
    await act(async () => {
      fireEvent.click(applyBtn());
    });
    expect(applyTypeChoice).toHaveBeenCalledTimes(2);
  });
});
