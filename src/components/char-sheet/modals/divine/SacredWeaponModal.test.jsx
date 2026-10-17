// @maintained-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SacredWeaponModal from './SacredWeaponModal.jsx';

// ── Ownership ──
// This file owns the damage-type picker modal UI in isolation: verbatim header,
// prompt, radio-option rendering and mutually-exclusive selection gating, the
// Activate disabled→enabled seam, the apply choke point emitting EXACT args
// (identity-pinned frozen action/playerStats + campaignName + selected option
// NAME, not damageType), the result view (verbatim handler description, picker
// fully replaced, Done→onClose exactly once), Cancel precedence (onCancel wins,
// onClose fallback), overlay/modal inertness, and empty/missing-automation
// degradation (no radios, permanently disabled Activate).
// The component holds all state locally — no runtime-store reads, no
// sanitize.js import, no window listeners, so no live stores and sanitizer
// inertness pins are N/A in this lane.
// Deferred to owners:
// - CharActionModals.SecondaryModals.jsx render site — onClose →
//   setModalState({ sacredWeaponModal: null }) and onCancel → CLA-301
//   cancelSacredWeapon charge refund wiring (its secondary-targets and
//   async-confirm-handlers tests mock this component outright).
// - sacredWeaponHandler.js handle() — opens this picker only when
//   automation.options.length > 0, Channel Divinity charge spend, activeBuffs
//   / expirations writes, addEntry logs, activateSacredWeapon result copy.
//   Consumed here only as a mocked seam with exact-arg pins.
// - useCharActionsAutomation.js — sacredWeaponModal open-state seeding.

// ── Mocked modules ──

vi.mock(
  '../../../../services/automation/handlers/class-cleric-paladin/sacredWeaponHandler.js',
  () => ({
    applyDamageTypeChoice: vi.fn(),
  })
);

// ── Re-import mocked modules ──

import * as sacredWeaponHandler from '../../../../services/automation/handlers/class-cleric-paladin/sacredWeaponHandler.js';

// ── Fixtures & helpers ──
// Frozen so the identity pins below prove the component forwards the SAME
// action/playerStats objects to the apply choke point, unmutated.

const baseAction = Object.freeze({
  name: 'Sacred Weapon',
  automation: Object.freeze({
    type: 'sacred_weapon',
    options: Object.freeze([
      Object.freeze({ name: 'Radiant', damageType: 'Radiant' }),
      Object.freeze({ name: 'Fire', damageType: 'Fire' }),
      Object.freeze({ name: 'Cold', damageType: 'Cold' }),
    ]),
  }),
});

const basePlayerStats = Object.freeze({ name: 'Paladin1', level: 5, hitPoints: 40 });

// Fresh onClose/onCancel per call — no cross-test mock residue, no clearAllMocks.
function makeProps(overrides = {}) {
  return {
    action: baseAction,
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
    onClose: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

function renderModal(overrides) {
  return render(<SacredWeaponModal {...makeProps(overrides)} />);
}

const activateBtn = () => screen.getByRole('button', { name: 'Activate Sacred Weapon' });
const radio = (name) => screen.getByRole('radio', { name });

// Result descriptions are plain strings the component injects via
// dangerouslySetInnerHTML into the sp-body div — getByText (exact) matches
// the whole line against the node's text content.
function makeResult(description = 'Sacred Weapon activated for 10 minutes.') {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Sacred Weapon',
      automationType: 'sacred_weapon',
      description,
    },
  };
}

// NOTE — flagged product defects (divine-lane audit), NOT fixed here:
// 1. Unguarded await: handleApply awaits applyDamageTypeChoice with no
//    try/catch — a rejection is an unhandled rejection and the modal stays
//    silently on the picker with no error feedback (picker-resolves-null
//    variant pinned below; rejection deliberately unpinned to avoid
//    failing the run on the unhandled rejection).
// 2. Null-result no-op: handler resolving null trips the `applied && result`
//    guard false — the picker re-renders with zero feedback while `applied`
//    sticks true (pinned below).
// 3. Double-fire: the Activate button is never disabled while the apply
//    await is in flight — rapid clicks fire the handler repeatedly, each
//    real activation costing a Channel Divinity charge downstream (pinned).
// 4. Dead guard: `if (!selected) return;` is unreachable via the UI — the
//    button carries disabled={!selected} (pinned: a disabled click never
//    reaches the seam).
// 5. Unsanitized sink: result.payload.description goes through
//    dangerouslySetInnerHTML with no sanitize.js import — trusted handler
//    constants today, an XSS seam if description ever becomes user-authored.
// 6. Missing-payload crash: a result without a `payload` key throws in
//    render on result.payload.description (the applied guard checks result
//    truthiness only).

// ── Tests ──

describe('SacredWeaponModal', () => {
  beforeEach(() => {
    sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValue(makeResult());
  });

  afterEach(() => {
    // Per-mock reset (no resetAllMocks): the bare vi.fn() clears its
    // resolved value back to the factory default between tests.
    sacredWeaponHandler.applyDamageTypeChoice.mockReset();
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders header, prompt, three unchecked radios, and an initially disabled Activate beside an enabled Cancel', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
      expect(screen.getByText('Choose the damage type for Sacred Weapon:')).toBeInTheDocument();
      expect(screen.getAllByRole('radio')).toHaveLength(3);
      for (const name of ['Radiant', 'Fire', 'Cold']) {
        expect(radio(name)).not.toBeChecked();
      }
      expect(activateBtn()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
      expect(screen.getAllByRole('button')).toHaveLength(2);
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    it('renders a single radio when only one option is available', () => {
      renderModal({
        action: Object.freeze({
          ...baseAction,
          automation: Object.freeze({
            type: 'sacred_weapon',
            options: Object.freeze([Object.freeze({ name: 'Radiant', damageType: 'Radiant' })]),
          }),
        }),
      });
      expect(screen.getAllByRole('radio')).toHaveLength(1);
      expect(screen.queryByRole('radio', { name: 'Fire' })).not.toBeInTheDocument();
      expect(activateBtn()).toBeDisabled();
    });

    it.each([
      { label: 'automation is null', automation: null },
      { label: 'automation has no options', automation: Object.freeze({ type: 'sacred_weapon' }) },
      { label: 'options is empty', automation: Object.freeze({ type: 'sacred_weapon', options: Object.freeze([]) }) },
    ])('degrades to no radios with Activate permanently inert when $label', async ({ automation }) => {
      const onClose = vi.fn();
      const action = Object.freeze({ ...baseAction, automation });
      renderModal({ action, onClose, onCancel: undefined });

      expect(screen.getByText('Sacred Weapon')).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(activateBtn()).toBeDisabled();

      // The disabled button never reaches the apply seam; Cancel still closes.
      await act(async () => {
        fireEvent.click(activateBtn());
      });
      expect(sacredWeaponHandler.applyDamageTypeChoice).not.toHaveBeenCalled();
      // Cancel's preferred onCancel seam stays present; with none provided,
      // the fallback onClose still closes the degraded modal.
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('stays inert when the overlay or modal container is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      fireEvent.click(document.querySelector('.sp-overlay'));
      fireEvent.click(document.querySelector('.sp-modal'));

      expect(onClose).not.toHaveBeenCalled();
      expect(sacredWeaponHandler.applyDamageTypeChoice).not.toHaveBeenCalled();
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
  });

  // ── Selection gating ──

  it.each(['Radiant', 'Fire', 'Cold'])(
    'selecting %s enables Activate and keeps exactly one radio checked',
    (name) => {
      renderModal();
      expect(activateBtn()).toBeDisabled();

      fireEvent.click(radio(name));
      expect(radio(name)).toBeChecked();
      expect(activateBtn()).toBeEnabled();
      expect(screen.getAllByRole('radio').filter((r) => r.checked)).toHaveLength(1);

      // Switching selection moves the single check and keeps Activate enabled.
      const other = name === 'Cold' ? 'Fire' : 'Cold';
      fireEvent.click(radio(other));
      expect(radio(other)).toBeChecked();
      expect(radio(name)).not.toBeChecked();
      expect(activateBtn()).toBeEnabled();
      expect(sacredWeaponHandler.applyDamageTypeChoice).not.toHaveBeenCalled();
    }
  );

  it('reaches the apply seam only through an enabled, selected Activate click', async () => {
    renderModal();

    await act(async () => {
      fireEvent.click(activateBtn());
    });
    // NOTE defect 4: `if (!selected) return;` dead guard — the disabled button
    // already prevents reaching handleApply unselected.
    expect(sacredWeaponHandler.applyDamageTypeChoice).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  // ── Apply seam ──

  it('emits the exact identity-pinned args (action, playerStats, campaignName, selected option name)', async () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    renderModal({ onClose, onCancel });

    fireEvent.click(radio('Radiant'));
    await act(async () => {
      fireEvent.click(activateBtn());
    });

    expect(sacredWeaponHandler.applyDamageTypeChoice).toHaveBeenCalledTimes(1);
    expect(sacredWeaponHandler.applyDamageTypeChoice).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign',
      'Radiant'
    );
    // Identity pins: the SAME frozen objects, forwarded unmutated.
    const [sentAction, sentStats] = sacredWeaponHandler.applyDamageTypeChoice.mock.calls[0];
    expect(sentAction).toBe(baseAction);
    expect(sentStats).toBe(basePlayerStats);
    expect(onClose).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('replaces the whole picker with the verbatim result view and closes once via Done (onClose, never onCancel)', async () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    const description =
      'Sacred Weapon activated for 10 minutes. Your melee weapon sheds bright light in a 20-foot radius and dim light for an additional 20 feet. Damage type set to Fire.';
    sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValueOnce(makeResult(description));
    renderModal({ onClose, onCancel });

    fireEvent.click(radio('Fire'));
    await act(async () => {
      fireEvent.click(activateBtn());
    });

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activate Sacred Weapon' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByText('Choose the damage type for Sacred Weapon:')).not.toBeInTheDocument();

    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Charge already spent by the handler — Done must NOT trigger the refund lane.
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('fires the apply seam again on a second click while the first await is in flight (defect 3)', async () => {
    let resolveFirst;
    sacredWeaponHandler.applyDamageTypeChoice.mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirst = resolve; })
    );
    renderModal();

    fireEvent.click(radio('Cold'));
    await act(async () => {
      fireEvent.click(activateBtn());
    });
    expect(sacredWeaponHandler.applyDamageTypeChoice).toHaveBeenCalledTimes(1);

    // Button stays enabled and the view unchanged mid-flight — second click refires.
    expect(activateBtn()).toBeEnabled();
    await act(async () => {
      fireEvent.click(activateBtn());
    });
    expect(sacredWeaponHandler.applyDamageTypeChoice).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFirst(makeResult());
    });
    expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('silently re-renders the picker when the handler resolves null (defect 2)', async () => {
    sacredWeaponHandler.applyDamageTypeChoice.mockResolvedValueOnce(null);
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(radio('Radiant'));
    await act(async () => {
      fireEvent.click(activateBtn());
    });

    // No crash, no feedback: picker re-rendered, no result view, no close.
    expect(screen.getByText('Choose the damage type for Sacred Weapon:')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel ──

  it('routes Cancel to onCancel exactly once, bypassing onClose and the apply seam', () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    renderModal({ onClose, onCancel });

    fireEvent.click(radio('Radiant'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(sacredWeaponHandler.applyDamageTypeChoice).not.toHaveBeenCalled();
  });

  it('falls back to onClose when Cancel has no onCancel provided', () => {
    const onClose = vi.fn();
    renderModal({ onClose, onCancel: undefined });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
