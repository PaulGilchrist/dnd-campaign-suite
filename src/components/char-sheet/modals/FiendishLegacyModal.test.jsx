// @maintained-by-ai
// Ownership — this file owns FiendishLegacyModal in isolation: exact header and
// intro copy; the three lineage rows (names, descriptions, spellcasting-ability
// lines, icons) driven by the component's hardcoded FIENDISH_LEGACIES; the
// disabled-until-selected gate on a radio group named 'fiendishLegacyOption';
// the confirmFiendishLegacy seam with identity-pinned frozen props; the
// handler-template-verbatim result view (popup description injected as HTML,
// exactly one Done closing exactly once); Cancel-only close; overlay/modal
// inertness in both views; and the full error lifecycle (exact console.error +
// inline message, single-message replacement, retry to success).
//
// FIXTURE PROVENANCE: option rows and result descriptions mirror the real
// handler templates verbatim (fiendishLegacyHandler.js:10-13, :105) — no
// fixture-echo of invented copy. The runtime store (setRuntimeObject merged
// write on confirm) is owned by fiendishLegacyHandler.test.js and never
// loads under this mock; the modal itself is pure local state.
//
// NOTE — flagged product defects (FiendishLegacyModal audit), NOT fixed here:
// 1. No in-flight guard: the apply button is never disabled during the await,
//    so a double click fires confirmFiendishLegacy twice — two merged runtime
//    writes on the real handler (double-fire pinned below).
// 2. Null-result trap: the `applied && result` guard falls through to the live
//    selection view when the seam resolves null, silently swallowing the
//    "success" and inviting a re-click (pinned).
// 3. Unguarded result.payload.description: a resolved result without payload
//    throws mid-render (no error boundary at any mount site) — flag only.
// 4. XSS sink: result.payload.description flows through dangerouslySetInnerHTML
//    with no sanitize.js import (sink pinned; real handler emits plain text).
// 5. `action` prop ignored (`action: _action`): header title and lineage rows
//    are hardcoded, so a renamed feature or custom automation.options drifts
//    silently (drift pinned; mirrors ElementalAffinity option-driven design).
// 6. House-rule violation: inline styles on the options wrapper, label rows,
//    radio inputs, and description/ability spans (component-side, flagged only).
//
// Deferred to owners:
// - CharSpecialActions.jsx / CharSpecialActionsModals.jsx /
//   CharActionModals.SecondaryModals.jsx render sites and the shared mock
//   lane (CharSpecialActions.modalMocks.jsx now mocks this modal; grid-host
//   mount/dismiss pinned in CharSpecialActions.modals.test.jsx;
//   secondary-targets / async-confirm-handlers lanes mock it too).
// - fiendishLegacyHandler.test.js — the merged _fiendishLegacy* runtime
//   writes, invalid-input guard, and popup payload shape consumed here.

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FiendishLegacyModal from './FiendishLegacyModal.jsx';

// The handler is the component's only external seam; its runtime-store
// imports never load under this mock — the handler lane owns them.
vi.mock('../../../services/automation/handlers/class-other/fiendishLegacyHandler.js', () => ({
  confirmFiendishLegacy: vi.fn(),
}));

import { confirmFiendishLegacy } from '../../../services/automation/handlers/class-other/fiendishLegacyHandler.js';

// ── Fixtures ──
// Frozen so the identity pins prove the component forwards the SAME
// playerStats object from props to the seam, unmutated. Rows and popup copy
// mirror fiendishLegacyHandler.js:10-13 and :105 byte-for-byte.

const CAMPAIGN = 'test-campaign';

const ACTION = Object.freeze({
  name: 'Fiendish Legacy',
  automation: Object.freeze({ type: 'fiendish_legacy' }),
});

const PLAYER_STATS = Object.freeze({ name: 'Warlock1', level: 1, hitPoints: 30 });

const LEGACY_ROWS = Object.freeze([
  { name: 'Abyssal', icon: 'fa-dragon', description: 'Resistance to Poison damage + Poison Spray cantrip. Level 3: Ray of Sickness. Level 5: Hold Person.' },
  { name: 'Chthonic', icon: 'fa-ghost', description: 'Resistance to Necrotic damage + Chill Touch cantrip. Level 3: False Life. Level 5: Ray of Enfeeblement.' },
  { name: 'Infernal', icon: 'fa-fire', description: 'Resistance to Fire damage + Fire Bolt cantrip. Level 3: Hellish Rebuke. Level 5: Darkness.' },
]);
const LEGACIES = LEGACY_ROWS.map(r => r.name);

const INTRO = 'Choose a fiendish legacy (this choice determines your racial spellcasting ability and granted spells):';

// Real handler template (fiendishLegacyHandler.js:105).
const successPopup = (legacy) => Object.freeze({
  type: 'popup',
  payload: Object.freeze({
    type: 'automation_info',
    name: 'Fiendish Legacy',
    description: `Selected ${legacy} legacy. Spellcasting ability: Charisma.`,
    automation: Object.freeze({ type: 'fiendish_legacy' }),
  }),
});

// Fresh onClose per call — no cross-test mock residue, no clearAllMocks.
function makeProps(overrides = {}) {
  return { action: ACTION, playerStats: PLAYER_STATS, campaignName: CAMPAIGN, onClose: vi.fn(), ...overrides };
}

const applyBtn = () => screen.getByRole('button', { name: 'Select Legacy' });
const radioFor = (name) => screen.getByLabelText(new RegExp(`^${name}`));

function optionTexts(container) {
  return [...container.querySelectorAll('input[type="radio"]')]
    .map(r => r.closest('label').textContent.replace(/\s+/g, ' ').trim());
}

// ── Tests ──

describe('FiendishLegacyModal', () => {
  let consoleSpy = null;

  beforeEach(() => {
    // Default seam behaviour mirrors the real handler's success template.
    confirmFiendishLegacy.mockImplementation(async (_stats, legacy) => successPopup(legacy));
  });

  afterEach(() => {
    // Per-mock reset (no resetAllMocks): the seam clears its implementation
    // between tests; onClose is fresh per makeProps.
    confirmFiendishLegacy.mockReset();
    if (consoleSpy) {
      consoleSpy.mockRestore();
      consoleSpy = null;
    }
  });

  // ── Initial render / mount purity ──

  it('renders the dragon header, exact intro, three radio rows, disabled "Select Legacy", live Cancel — touching neither seam nor onClose on mount', () => {
    const { container } = render(<FiendishLegacyModal {...makeProps()} />);
    expect(container.querySelector('.sp-overlay .sp-modal')).toBeInTheDocument();
    expect(screen.getByText('Fiendish Legacy')).toBeInTheDocument();
    expect(container.querySelector('.sp-header i.fa-dragon')).toBeInTheDocument();
    expect(screen.getByText(INTRO)).toBeInTheDocument();
    const radios = [...container.querySelectorAll('input[type="radio"]')];
    expect(radios).toHaveLength(3);
    radios.forEach(r => expect(r.name).toBe('fiendishLegacyOption'));
    expect(applyBtn()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to select legacy/)).not.toBeInTheDocument();
    // Mount purity: no side effects before user action.
    expect(confirmFiendishLegacy).not.toHaveBeenCalled();
  });

  it('renders each lineage row verbatim — icon, name, exact description, and "Spellcasting ability: Charisma"', () => {
    const { container } = render(<FiendishLegacyModal {...makeProps()} />);
    const expected = LEGACY_ROWS.map(r => `${r.name}— ${r.description}Spellcasting ability: Charisma`);
    expect(optionTexts(container)).toEqual(expected);
    LEGACY_ROWS.forEach(({ name, icon }) => {
      expect(radioFor(name).closest('label').querySelector(`i.fa-solid.${icon}`)).toBeInTheDocument();
    });
  });

  // ── Selection gate ──

  it('clicking the disabled apply is inert; Cancel closes exactly once without ever reaching the seam', () => {
    const onClose = vi.fn();
    const { container } = render(<FiendishLegacyModal {...makeProps({ onClose })} />);
    fireEvent.click(applyBtn());
    expect(confirmFiendishLegacy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirmFiendishLegacy).not.toHaveBeenCalled();
    expect(container.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('single-selects radios: each legacy checks alone and enables apply; switching unchecks the previous', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    fireEvent.click(radioFor('Abyssal'));
    expect(radioFor('Abyssal')).toBeChecked();
    expect(screen.getAllByRole('radio').filter(r => r.checked)).toHaveLength(1);
    expect(applyBtn()).toBeEnabled();

    fireEvent.click(radioFor('Infernal'));
    expect(radioFor('Infernal')).toBeChecked();
    expect(radioFor('Abyssal')).not.toBeChecked();
    expect(applyBtn()).toBeEnabled();
  });

  // ── Apply → result view → close (per legacy) ──

  it.each(LEGACIES)('selects %s, fires confirmFiendishLegacy once with identity-pinned args, swaps to the exact popup result view, and Done closes exactly once', async (legacy) => {
    const onClose = vi.fn();
    const { container } = render(<FiendishLegacyModal {...makeProps({ onClose })} />);
    fireEvent.click(radioFor(legacy));
    await act(async () => {
      fireEvent.click(applyBtn());
    });

    expect(confirmFiendishLegacy).toHaveBeenCalledTimes(1);
    const [sentStats, sentLegacy, sentCampaign] = confirmFiendishLegacy.mock.calls[0];
    // Identity pins: the exact frozen object from props, never a copy.
    expect(sentStats).toBe(PLAYER_STATS);
    expect(sentLegacy).toBe(legacy);
    expect(sentCampaign).toBe(CAMPAIGN);

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.getByText(successPopup(legacy).payload.description)).toBeInTheDocument();
    expect(screen.getByText('Fiendish Legacy')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Legacy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByText(INTRO)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);

    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Result-view inertness: overlay and modal clicks never close.
    fireEvent.click(container.querySelector('.sp-overlay'));
    fireEvent.click(container.querySelector('.sp-modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(done).toBeInTheDocument();
  });

  // ── Pre-apply inertness ──

  it('ignores overlay and modal clicks before applying, keeping selection and seam untouched', () => {
    const onClose = vi.fn();
    const { container } = render(<FiendishLegacyModal {...makeProps({ onClose })} />);
    fireEvent.click(radioFor('Chthonic'));

    fireEvent.click(container.querySelector('.sp-overlay'));
    fireEvent.click(container.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
    expect(confirmFiendishLegacy).not.toHaveBeenCalled();
    expect(radioFor('Chthonic')).toBeChecked();
    expect(applyBtn()).toBeEnabled();
  });

  // ── Hardcoded title/options drift (defect 5) ──

  it('ignores action entirely — a renamed action.name and custom options never reach header or rows (defect 5)', () => {
    const customAction = Object.freeze({
      name: 'Custom Legacy Feature',
      automation: Object.freeze({ type: 'other', options: [{ name: 'Mephistopheles' }] }),
    });
    const { container } = render(<FiendishLegacyModal {...makeProps({ action: customAction })} />);
    expect(screen.getByText('Fiendish Legacy')).toBeInTheDocument();
    expect(screen.queryByText('Custom Legacy Feature')).not.toBeInTheDocument();
    expect(screen.queryByText(/Mephistopheles/)).not.toBeInTheDocument();
    expect(optionTexts(container)).toEqual(LEGACY_ROWS.map(r => `${r.name}— ${r.description}Spellcasting ability: Charisma`));
  });

  // ── Defect pins ──

  it('fires confirmFiendishLegacy twice on a double click before the result view swaps (defect 1)', async () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    fireEvent.click(radioFor('Infernal'));

    // Both clicks land synchronously, before the async result view swaps —
    // no disabled/in-flight guard stops the second apply.
    await act(async () => {
      fireEvent.click(applyBtn());
      fireEvent.click(applyBtn());
    });

    expect(confirmFiendishLegacy).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('keeps the live selection with no Done when the seam resolves null (defect 2)', async () => {
    confirmFiendishLegacy.mockResolvedValueOnce(null);
    render(<FiendishLegacyModal {...makeProps()} />);
    fireEvent.click(radioFor('Abyssal'));
    await act(async () => {
      fireEvent.click(applyBtn());
    });

    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Selected Abyssal legacy/)).not.toBeInTheDocument();
    expect(radioFor('Abyssal')).toBeChecked();
    expect(applyBtn()).toBeEnabled();
    expect(confirmFiendishLegacy).toHaveBeenCalledTimes(1);
  });

  it('renders result description as live HTML — un-sanitized dangerouslySetInnerHTML sink (defect 4)', async () => {
    const html = '<strong>Fiendish Legacy:</strong> <em>Abyssal selected.</em>';
    confirmFiendishLegacy.mockResolvedValueOnce({
      type: 'popup',
      payload: { type: 'automation_info', name: 'Fiendish Legacy', description: html, automation: { type: 'fiendish_legacy' } },
    });
    const { container } = render(<FiendishLegacyModal {...makeProps()} />);
    fireEvent.click(radioFor('Abyssal'));
    await act(async () => {
      fireEvent.click(applyBtn());
    });

    await screen.findByRole('button', { name: 'Done' });
    const body = container.querySelector('.sp-body');
    expect(body.querySelector('strong')).toHaveTextContent('Fiendish Legacy:');
    expect(body.querySelector('em')).toHaveTextContent('Abyssal selected.');
  });

  // ── Error lifecycle ──

  it('surfaces the exact inline error on rejection, replaces (never stacks) it on retry-fail, and swaps to the result view on retry-success', async () => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err1 = new Error('Network error');
    const err2 = new Error('Server exploded');
    confirmFiendishLegacy
      .mockRejectedValueOnce(err1)
      .mockRejectedValueOnce(err2);

    render(<FiendishLegacyModal {...makeProps()} />);
    fireEvent.click(radioFor('Abyssal'));

    await act(async () => {
      fireEvent.click(applyBtn());
    });
    expect(consoleSpy).toHaveBeenCalledWith('Fiendish Legacy failed', err1);
    expect(screen.getByText('Failed to select legacy: Network error')).toBeInTheDocument();
    expect(screen.getByText(INTRO)).toBeInTheDocument();
    expect(radioFor('Abyssal')).toBeChecked();
    expect(applyBtn()).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();

    // Retry fails again: exactly one error paragraph, updated copy.
    await act(async () => {
      fireEvent.click(applyBtn());
    });
    expect(screen.queryByText('Failed to select legacy: Network error')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Failed to select legacy/)).toHaveLength(1);
    expect(screen.getByText('Failed to select legacy: Server exploded')).toBeInTheDocument();

    // Retry succeeds (back on the beforeEach success impl): result view,
    // error gone with the whole selection view.
    await act(async () => {
      fireEvent.click(applyBtn());
    });
    expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByText(/Failed to select legacy/)).not.toBeInTheDocument();
    expect(screen.getByText(successPopup('Abyssal').payload.description)).toBeInTheDocument();
    expect(confirmFiendishLegacy).toHaveBeenCalledTimes(3);
  });
});
