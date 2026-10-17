import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DragonCompanionModal from './DragonCompanionModal.jsx';

// ── Ownership ──
// This file owns the Dragon Companion confirm modal UI in isolation: verbatim
// header and cast copy; the Skip Concentration checkbox round-trip and its
// exact duration copy both ways; the confirm seam emitting EXACT args
// (identity-pinned frozen action/playerStats + campaignName + noConcentration
// flag); the applied-result view swap (controls gone, exactly one Done, exact
// unescaped result description with its <em> hint parsed); Cancel/Done close
// exactly once; overlay/modal inertness before and after confirm (overlay-click
// dismissal was removed app-wide in 15eb96d46 — pinned against regression);
// refusal paths (handler resolving null leaves live cast controls).
// The component holds all state locally — no runtime-store reads, no
// sanitize.js import — so no live stores here; the handler seam is mocked.
// Deferred to owners:
// - CharActionModals.SecondaryModals.jsx render site (+ its secondary-targets
//   / modal-closes-3 / async-confirm-handlers tests, which mock this
//   component) — onClose → setModalState({ dragonCompanionModal: null }) wiring.
// - dragonCompanionHandler.js (+ its own test lane) — free-cast counter reads/
//   writes via useRuntimeState, popup payload shape consumed here as fixtures.
// - automation/index.js — dragon_companion / dragon_companion_confirm dispatch.
// No creature-selection overlap with AnimalShapesSelectionModal or
// shared/CreatureSelectionModal lanes: this modal selects no creature and
// arms no save prompt — there is no shared selection mechanic to defer.

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/dragonCompanionHandler.js', () => ({
  confirmDragonCompanion: vi.fn(),
}));

import { confirmDragonCompanion } from '../../../services/automation/handlers/class-sorcerer/dragonCompanionHandler.js';

// ── Fixtures ──
// Frozen so the identity pins below prove the component forwards the SAME
// action/playerStats objects from props to the confirm seam, unmutated.
// Popup descriptions mirror the real handler output template verbatim
// (dragonCompanionHandler.js:65-73) — no fixture-echo of invented copy.
const CAST_HINT = 'Open your spell sheet and cast Summon Dragon normally — no spell slot or material components will be consumed.';

const popupResult = Object.freeze({
  type: 'popup',
  payload: Object.freeze({
    type: 'automation_info',
    name: 'Dragon Companion',
    description: `Dragon Companion: Free cast of Summon Dragon (0 remaining).<br/><br/><em>${CAST_HINT}</em>`,
  }),
});

const popupResultNoConc = Object.freeze({
  type: 'popup',
  payload: Object.freeze({
    type: 'automation_info',
    name: 'Dragon Companion',
    description: `Dragon Companion: Free cast of Summon Dragon (0 remaining). Does not require Concentration. Duration: 1 minute.<br/><br/><em>${CAST_HINT}</em>`,
  }),
});

const ACTION = Object.freeze({
  name: 'Dragon Companion',
  automation: Object.freeze({ spell: 'Summon Dragon', usesMax: 1 }),
});

const PLAYER_STATS = Object.freeze({ name: 'Sorcerer1', level: 1 });

const CONCENTRATION_ON_COPY = 'The dragon companion will require Concentration and last up to 1 hour (normal Summon Dragon duration).';
const CONCENTRATION_OFF_COPY = 'The dragon companion will not require Concentration and will last 1 minute.';

// Fresh onClose per call — no cross-test mock residue, no clearAllMocks.
function makeProps(overrides = {}) {
  return { action: ACTION, playerStats: PLAYER_STATS, campaignName: 'test-campaign', onClose: vi.fn(), ...overrides };
}

function renderModal(overrides) {
  return render(<DragonCompanionModal {...makeProps(overrides)} />);
}

const summonBtn = () => screen.getByRole('button', { name: 'Summon Dragon' });
const skipCheckbox = () => screen.getByRole('checkbox', { name: /Skip Concentration \(duration becomes 1 minute\)/ });

// The cast copy interleaves <strong> children, which split getByText's default
// per-element text — pin the EXACT full line via textContent.
function paragraphWithText(text) {
  return screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === text);
}

// NOTE — flagged product defects (DragonCompanionModal audit), NOT fixed here:
// 1. Unguarded await: handleConfirm awaits confirmDragonCompanion with no
//    try/catch — a rejection (offline server, 5xx) leaves the modal stuck on
//    the pre-confirm view with a live cast button and no error UI.
// 2. Null-result trap: the `applied && result` guard falls through to the
//    PRE-CONFIRM view when the handler resolves null — Summon Dragon stays
//    live, inviting a double cast (pinned below).
// 3. No in-flight guard: the Summon button is never disabled, so a double
//    click fires confirmDragonCompanion twice before the result view swaps
//    (pinned below) — two free casts consumed.
// 4. XSS sink: result.payload.description renders through
//    dangerouslySetInnerHTML with no sanitize.js import; feature/spell names
//    from the action flow unescaped into HTML (pinned via the parsed <em>).
// 5. House-rule violation: inline styles on the checkbox wrapper, label, and
//    description paragraph (component-side, flagged only).

// ── Tests ──

describe('DragonCompanionModal', () => {
  beforeEach(() => {
    confirmDragonCompanion.mockResolvedValue(popupResult);
  });

  afterEach(() => {
    // Per-mock reset (no resetAllMocks): the handler seam clears its
    // resolved-value config between tests; onClose is fresh per makeProps.
    confirmDragonCompanion.mockReset();
  });

  // ── Initial render ──

  it('renders the dragon header, exact cast copy, unchecked Skip Concentration, and exactly Summon Dragon + Cancel', () => {
    const { container } = renderModal();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(screen.getByText('Dragon Companion')).toBeInTheDocument();
    expect(container.querySelector('.sp-header i.fa-dragon')).toBeInTheDocument();
    expect(paragraphWithText('Cast Summon Dragon without material components or spell slot.')).toBeInTheDocument();
    expect(skipCheckbox()).not.toBeChecked();
    expect(screen.getByText(CONCENTRATION_ON_COPY)).toBeInTheDocument();
    expect(screen.queryByText(CONCENTRATION_OFF_COPY)).not.toBeInTheDocument();
    expect(summonBtn()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('swaps duration copy both ways across a full Skip Concentration round-trip', () => {
    renderModal();
    const checkbox = skipCheckbox();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getByText(CONCENTRATION_OFF_COPY)).toBeInTheDocument();
    expect(screen.queryByText(CONCENTRATION_ON_COPY)).not.toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(CONCENTRATION_ON_COPY)).toBeInTheDocument();
    expect(screen.queryByText(CONCENTRATION_OFF_COPY)).not.toBeInTheDocument();
  });

  it('stays inert when the overlay or modal container is clicked before confirm', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(document.querySelector('.sp-overlay'));
    fireEvent.click(document.querySelector('.sp-modal'));

    expect(onClose).not.toHaveBeenCalled();
    expect(confirmDragonCompanion).not.toHaveBeenCalled();
    expect(summonBtn()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Confirm seam ──

  it.each([
    { label: 'concentration kept', skip: false, noConcentration: false },
    { label: 'skip concentration checked', skip: true, noConcentration: true },
  ])('calls confirmDragonCompanion once with the identity-pinned props and noConcentration=$noConcentration when $label', async ({ skip, noConcentration }) => {
    renderModal();
    if (skip) {
      fireEvent.click(skipCheckbox());
    }

    await act(async () => {
      fireEvent.click(summonBtn());
    });

    expect(confirmDragonCompanion).toHaveBeenCalledTimes(1);
    const [sentAction, sentStats, sentCampaign, sentFlag] = confirmDragonCompanion.mock.calls[0];
    // Identity pins: the exact frozen objects from props, never a reconstructed copy.
    expect(sentAction).toBe(ACTION);
    expect(sentStats).toBe(PLAYER_STATS);
    expect(sentCampaign).toBe('test-campaign');
    expect(sentFlag).toBe(noConcentration);
  });

  // ── Result view ──

  it.each([
    { label: 'normal concentration', skip: false, result: popupResult },
    { label: 'skipped concentration', skip: true, result: popupResultNoConc },
  ])('replaces all controls with Done after confirm ($label), renders the exact unescaped description, and closes exactly once', async ({ skip, result }) => {
    const onClose = vi.fn();
    confirmDragonCompanion.mockResolvedValue(result);
    const { container } = renderModal({ onClose });
    if (skip) {
      fireEvent.click(skipCheckbox());
    }

    await act(async () => {
      fireEvent.click(summonBtn());
    });

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.queryByRole('button', { name: 'Summon Dragon' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);

    // Defect 4: the description is an unsanitized dangerouslySetInnerHTML
    // sink — the <em> hint arrives PARSED, and raw tags must not leak as text.
    expect(container.querySelector('.sp-body em')).toHaveTextContent(CAST_HINT);
    expect(screen.queryByText(/<br/)).not.toBeInTheDocument();
    expect(screen.queryByText(/<\/?em>/)).not.toBeInTheDocument();

    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays inert when the overlay or modal container is clicked after confirm', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await act(async () => {
      fireEvent.click(summonBtn());
    });
    const done = await screen.findByRole('button', { name: 'Done' });

    fireEvent.click(document.querySelector('.sp-overlay'));
    fireEvent.click(document.querySelector('.sp-modal'));

    expect(onClose).not.toHaveBeenCalled();
    expect(done).toBeInTheDocument();
    expect(confirmDragonCompanion).toHaveBeenCalledTimes(1);
  });

  it('casts nothing and closes exactly once when Cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirmDragonCompanion).not.toHaveBeenCalled();
  });

  // ── Defect pins ──

  it('re-renders the live pre-confirm cast controls when the handler resolves null (defect 2)', async () => {
    confirmDragonCompanion.mockResolvedValueOnce(null);
    const onClose = vi.fn();
    renderModal({ onClose });

    await act(async () => {
      fireEvent.click(summonBtn());
    });

    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(summonBtn()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(confirmDragonCompanion).toHaveBeenCalledTimes(1);
  });

  it('consumes confirmDragonCompanion twice on a double click before the result view swaps (defect 3)', async () => {
    renderModal();

    // Both clicks land synchronously, before the async result view swaps —
    // no disabled/in-flight guard stops the second cast.
    await act(async () => {
      fireEvent.click(summonBtn());
      fireEvent.click(summonBtn());
    });

    expect(confirmDragonCompanion).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
});
