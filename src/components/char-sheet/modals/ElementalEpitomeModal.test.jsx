/**
 * ElementalEpitomeModal — single-file lane (jsx:1-70, the whole modal). Ownership (grep ElementalEpitome):
 * - elementalEpitomeHandle.test.js — how the modal is OPENED (payload {action, playerStats,
 *   campaignName, currentResistance} feeds these props). Not here.
 * - elementalEpitomeApplyResistanceChoice.test.js — everything INSIDE applyResistanceChoice
 *   (runtime writes, byte-exact ability_use log, invalid-type → null at handler jsx:36). Consumed
 *   here ONLY as a captured boundary: exact 4-arg call shape, same-object identity, result dispatch.
 * - CharSpecialActions.elementalEffects.test.jsx / CharActionModals.async-confirm-handlers.test.jsx —
 *   host handleEpitomeConfirm/handleEpitomeClose side effects (popup-only confirm, CLA-113
 *   double-apply guard). Deferred to those lanes; the popup-only *modal-side* contract is pinned here.
 *
 * Owned here (nothing else can show it):
 * - exact chooser copy (header, instruction line, five radio rows byte-exact with icons, button pair),
 * - currentResistance preseed: captured at mount by useState (jsx:16) and NEVER live — the
 *   'Current resistance:' line IS live, the selection is NOT (snapshot-vs-live split pinned below),
 * - the apply payload contract: applyResistanceChoice(action, playerStats, campaignName, selected)
 *   fires SYNCHRONOUSLY at click with the SAME frozen objects (jsx:20),
 * - result dispatch: onConfirm is popup-only and precedes onClose; onClose ALWAYS fires with ZERO
 *   args while Cancel forwards the raw click event (arg asymmetry, jsx:24 vs jsx:63),
 * - mount purity/inertness; deep-frozen fixtures prove prop inertness.
 *
 * This modal touches no runtime store directly — the runtime lane lives entirely inside the mocked
 * handler seam, so no live-store wiring is needed here.
 *
 * FLAGS (pinned or documented; product fixes belong to the component, not this lane):
 * - jsx:18-25: NO submitting guard — only `!selected` is checked. The component never unmounts
 *   itself (parent closes via onClose), so with the parent's onClose mocked out, a second Choose
 *   click re-fires applyResistanceChoice AND re-fires onClose. Pinned below (double-fire, real).
 *   A real double-fire is possible in-app on a slow network before the parent unmounts.
 * - jsx:20: NO catch lane — if applyResistanceChoice REJECTS (real handler derefs `action.name`
 *   at handler jsx:62 on undefined action, and any runtime-store failure), onClose never fires:
 *   SILENT STRAND, the Burst jsx:31 pattern. Not pinnable (unhandled rejection fails the run);
 *   documented only. Product fix: try/finally around the await, or always onClose().
 * - jsx:16 + jsx:60: a non-list currentResistance (e.g. 'Poison') enables Choose with NO radio
 *   checked (selected='Poison' is truthy) — the modal forwards the unknown value verbatim; the
 *   null-returning guard is the handler's (jsx:36), so the modal closes silently. Pinned.
 * - jsx:31: header DOES reflect action?.name (no hardcode drift — Burst jsx:64 pattern absent).
 *   DC/NaN coercion: N/A — no saving throw computes in this modal.
 * - jsx:35/40/46/54: inline styles (violates the no-inline-styles house rule). Not a test defect;
 *   flagged for the component owner. This lane's render helpers use NO inline styles.
 *
 * Anti-vacuity: fixtures deep-frozen (mutation attempts throw); call-args pinned by IDENTITY
 * (toBe), not echo; exact full-line text everywhere (no objectContaining on owned keys);
 * role-scoped queries; fresh vi.fn onClose/onConfirm per makeProps; afterEach mockReset + re-arm
 * (never clearAllMocks); zero bare setTimeout — the single act-flush IS the async proof.
 */
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElementalEpitomeModal from './ElementalEpitomeModal.jsx';

// ── Mocks — the apply seam is the ONLY module boundary of this modal (component jsx:2).
// logService is NOT imported by the component (it lives inside the handler) — not mocked. ──

vi.mock('../../../services/automation/handlers/combat/elementalEpitomeHandler.js', () => ({
  applyResistanceChoice: vi.fn(),
}));

// ── Re-import mocked module ──

import * as epitomeHandler from '../../../services/automation/handlers/combat/elementalEpitomeHandler.js';

// ── Fixtures (deep-frozen: the component MUST NOT mutate them; attempts throw) ──

const CAMPAIGN = 'test-campaign';
const PLAYER = 'Sorcerer1';

function deepFreeze(obj) {
  Object.values(obj).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); });
  return Object.freeze(obj);
}

const baseAction = deepFreeze({
  name: 'Elemental Epitome',
  automation: { type: 'class_feature' },
});

const basePlayerStats = deepFreeze({ name: PLAYER, level: 1 });

// Authored resistance copy (component jsx:5-13) — byte-exact against the component.
const COPY = {
  Acid: { icon: 'fa-biohazard', description: 'Corrosive acid damage resistance.' },
  Cold: { icon: 'fa-snowflake', description: 'Biting cold damage resistance.' },
  Fire: { icon: 'fa-fire', description: 'Searing fire damage resistance.' },
  Lightning: { icon: 'fa-bolt-lightning', description: 'Crackling lightning damage resistance.' },
  Thunder: { icon: 'fa-volume-high', description: 'Deafening thunder damage resistance.' },
};
const TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

const radioName = type => `${type} — ${COPY[type].description}`;

// Realistic popup shape mirrors the real handler's success return (handler jsx:67-76).
function popupResult(action, chosen) {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: action?.name,
      automationType: action?.automation?.type,
      description: `Damage Resistance set to ${chosen}.`,
      automation: action?.automation,
    },
  };
}

// Stable stub for re-arm (house rule: mockReset then re-arm, never clearAllMocks).
const DEFAULT_APPLY = async (action, _stats, _campaign, chosen) => popupResult(action, chosen);

// Fresh vi.fn per render (house rule: no shared module-level onClose/onConfirm).
function makeProps(overrides = {}) {
  return {
    action: baseAction,
    playerStats: basePlayerStats,
    campaignName: CAMPAIGN,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

function renderModal(props = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const utils = render(<ElementalEpitomeModal {...makeProps({ onClose, onConfirm, ...props })} />);
  return {
    onClose,
    onConfirm,
    ...utils,
    rerenderWith: (nextProps = {}) => utils.rerender(<ElementalEpitomeModal {...makeProps({ onClose, onConfirm, ...nextProps })} />),
  };
}

// ── Helpers ──

const chooseBtn = () => screen.getByRole('button', { name: 'Choose' });
const cancelBtn = () => screen.getByRole('button', { name: 'Cancel' });

function selectType(type) {
  fireEvent.click(screen.getByRole('radio', { name: radioName(type) }));
}

// Single act-flush: fireEvent dispatches handleApply synchronously (the handler CALL is already
// recorded); the inner await drains handleApply's single continuation (jsx:20) so onClose/onConfirm
// have settled when this returns. Zero waitFor, zero bare setTimeout.
async function clickChoose() {
  await act(async () => {
    fireEvent.click(chooseBtn());
    await Promise.resolve();
  });
}

// The 'Current resistance:' line is the optional tail <p> — byte-exact or absent.
function currentLines(container) {
  return [...container.querySelectorAll('.sp-body p')].map(p => p.textContent).filter(t => t.startsWith('Current resistance:'));
}

// ── Setup / teardown ──

beforeEach(() => {
  epitomeHandler.applyResistanceChoice.mockReset().mockImplementation(DEFAULT_APPLY);
});

afterEach(() => {
  cleanup();
  epitomeHandler.applyResistanceChoice.mockReset().mockImplementation(DEFAULT_APPLY);
});

// ── Tests ──

describe('ElementalEpitomeModal', () => {
  describe('mount purity and exact copy', () => {
    it('renders the exact chrome: header, instruction line, five named radios, Choose + Cancel', () => {
      const { container } = renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(container.querySelector('.sp-modal')).toBeInTheDocument();
      expect(container.querySelector('.sp-header').textContent.trim()).toBe('Elemental Epitome');
      expect(container.querySelector('.sp-header i').className).toBe('fa-solid fa-shield-halved');
      expect(container.querySelector('.sp-body p').textContent).toBe('Choose your damage resistance type:');
      // Five radios share ONE native group name — authored order, no extras.
      const radios = screen.getAllByRole('radio');
      expect(radios.map(r => r.getAttribute('name'))).toEqual(TYPES.map(() => 'epitomeResistance'));
      expect(radios.map(r => r.closest('label').textContent.trim())).toEqual(TYPES.map(radioName));
      expect(screen.getAllByRole('button').map(b => b.textContent.trim())).toEqual(['Choose', 'Cancel']);
    });

    it.each(TYPES)('%s row is byte-exact: icon, label copy, accessible name, unchecked at mount', (type) => {
      renderModal();
      const radio = screen.getByRole('radio', { name: radioName(type) });
      const label = radio.closest('label');
      expect(label.textContent.trim()).toBe(radioName(type));
      expect(label.querySelector('i').className).toBe(`fa-solid ${COPY[type].icon}`);
      expect(radio).not.toBeChecked();
      expect(chooseBtn()).toBeDisabled();
    });

    it('mounts inertly and a disabled Choose click is a structural no-op; fixtures resist mutation', () => {
      const { onClose, onConfirm } = renderModal();
      expect(epitomeHandler.applyResistanceChoice).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
      fireEvent.click(chooseBtn()); // disabled — React never dispatches onClick
      expect(epitomeHandler.applyResistanceChoice).not.toHaveBeenCalled();
      expect(() => { baseAction.name = 'mutated'; }).toThrow();
      expect(() => { basePlayerStats.name = 'mutated'; }).toThrow();
    });

    it.each([
      { label: 'undefined', value: undefined },
      { label: 'null', value: null },
      { label: 'empty string', value: '' },
    ])('falsy currentResistance ($label): no current-line, nothing checked, Choose disabled', ({ value }) => {
      const { container } = renderModal({ currentResistance: value });
      expect(currentLines(container)).toEqual([]);
      expect(screen.getAllByRole('radio').map(r => r.checked)).toEqual(TYPES.map(() => false));
      expect(chooseBtn()).toBeDisabled();
    });
  });

  describe('currentResistance preseed — selection captured at mount only, current-line live', () => {
    it('seeds Fire: exact current-line, Fire checked, Choose enabled, still fully inert', () => {
      const { container, onClose, onConfirm } = renderModal({ currentResistance: 'Fire' });
      expect(currentLines(container)).toEqual(['Current resistance: Fire']);
      expect(screen.getByRole('radio', { name: radioName('Fire') })).toBeChecked();
      expect(chooseBtn()).toBeEnabled();
      expect(epitomeHandler.applyResistanceChoice).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it.each(TYPES)('seed %s preselects exactly that radio and enables Choose', (type) => {
      renderModal({ currentResistance: type });
      expect(screen.getAllByRole('radio').map(r => r.checked)).toEqual(TYPES.map(t => t === type));
      expect(chooseBtn()).toBeEnabled();
    });

    it('SNAPSHOT vs LIVE: rerender with a new seed updates the current-line but NOT the selection', () => {
      const { container, rerenderWith } = renderModal({ currentResistance: 'Fire' });
      rerenderWith({ currentResistance: 'Cold' });
      // The line reads the LIVE prop; useState(currentResistance || null) (jsx:16) never re-seeds.
      expect(currentLines(container)).toEqual(['Current resistance: Cold']);
      expect(screen.getAllByRole('radio').map(r => r.checked)).toEqual(TYPES.map(t => t === 'Fire'));
      expect(chooseBtn()).toBeEnabled();
    });

    it('a user click beats the seed and survives rerenders unchanged', () => {
      const { rerenderWith } = renderModal({ currentResistance: 'Fire' });
      selectType('Acid');
      expect(screen.getAllByRole('radio').map(r => r.checked)).toEqual(TYPES.map(t => t === 'Acid'));
      rerenderWith({ currentResistance: 'Thunder' });
      expect(screen.getByRole('radio', { name: radioName('Acid') })).toBeChecked();
      expect(screen.getByRole('radio', { name: radioName('Fire') })).not.toBeChecked();
    });

    it('re-clicking the same radio keeps exactly one checked (native group is exclusive)', () => {
      renderModal();
      const fire = screen.getByRole('radio', { name: radioName('Fire') });
      fireEvent.click(fire);
      fireEvent.click(fire);
      expect(screen.getAllByRole('radio').map(r => r.checked)).toEqual(TYPES.map(t => t === 'Fire'));
    });
  });

  describe('apply payload contract — exact args, same-object identity, synchronous dispatch', () => {
    it('the handler call is recorded SYNCHRONOUSLY at click, before any flush', () => {
      renderModal();
      selectType('Fire');
      fireEvent.click(chooseBtn());
      // fireEvent wraps act; handleApply invokes the handler before its await (jsx:20).
      expect(epitomeHandler.applyResistanceChoice).toHaveBeenCalledTimes(1);
    });

    it('Choose forwards the SAME frozen action/playerStats objects plus campaign and selection', async () => {
      const { onClose } = renderModal();
      selectType('Fire');
      await clickChoose();
      const call = epitomeHandler.applyResistanceChoice.mock.calls[0];
      expect(epitomeHandler.applyResistanceChoice).toHaveBeenCalledTimes(1);
      expect(call).toHaveLength(4);
      expect(call[0]).toBe(baseAction);
      expect(call[1]).toBe(basePlayerStats);
      expect(call[2]).toBe(CAMPAIGN);
      expect(call[3]).toBe('Fire');
      // Apply-lane onClose strips the event arg (jsx:24) — the Cancel asymmetry is pinned below.
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose.mock.calls[0]).toEqual([]);
    });

    it.each(TYPES)('%s: verbatim 4th arg, one dispatch, popup auto-confirm carries the exact description', async (type) => {
      const { onConfirm } = renderModal();
      selectType(type);
      await clickChoose();
      expect(epitomeHandler.applyResistanceChoice).toHaveBeenCalledTimes(1);
      expect(epitomeHandler.applyResistanceChoice.mock.calls[0][3]).toBe(type);
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm.mock.calls[0][0]).toEqual({
        type: 'automation_info',
        name: 'Elemental Epitome',
        automationType: 'class_feature',
        description: `Damage Resistance set to ${type}.`,
        automation: baseAction.automation,
      });
    });

    it('custom campaign routes verbatim and a custom action name reaches BOTH header and payload by identity', async () => {
      const custom = deepFreeze({ name: 'Storm Palm Epitome', automation: { type: 'class_feature' } });
      const { container } = renderModal({ action: custom, campaignName: 'Frostfall-clone-test' });
      expect(container.querySelector('.sp-header').textContent.trim()).toBe('Storm Palm Epitome');
      selectType('Cold');
      await clickChoose();
      const call = epitomeHandler.applyResistanceChoice.mock.calls[0];
      expect(call[0]).toBe(custom);
      expect(call[2]).toBe('Frostfall-clone-test');
      expect(call[3]).toBe('Cold');
    });

    it('FLAG pinned: undefined action is forwarded unguarded (this lane is strand-safe only because the seam is mocked)', async () => {
      // FLAG: the REAL handler derefs action.name while logging (handler jsx:62) and would REJECT —
      // handleApply has no catch (jsx:20), so onClose would never fire: silent strand, Burst jsx:31
      // pattern. Unpinnable here (unhandled rejection fails the run); documented only.
      const { container, onClose } = renderModal({ action: undefined });
      expect(container.querySelector('.sp-header').textContent.trim()).toBe('Elemental Epitome');
      selectType('Fire');
      await clickChoose();
      expect(epitomeHandler.applyResistanceChoice.mock.calls[0][0]).toBeUndefined();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('FLAG pinned: non-list seed Poison enables Choose with NOTHING checked and forwards the unknown value verbatim', async () => {
      const { container, onConfirm, onClose } = renderModal({ currentResistance: 'Poison' });
      expect(currentLines(container)).toEqual(['Current resistance: Poison']);
      expect(screen.getAllByRole('radio').map(r => r.checked)).toEqual(TYPES.map(() => false));
      expect(chooseBtn()).toBeEnabled(); // selected='Poison' is truthy (jsx:16/60) — checked/enable decoupled
      epitomeHandler.applyResistanceChoice.mockResolvedValueOnce(null); // handler's own invalid-type arm (jsx:36)
      await clickChoose();
      expect(epitomeHandler.applyResistanceChoice.mock.calls[0][3]).toBe('Poison');
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1); // closes SILENTLY — no popup, no onConfirm
    });
  });

  describe('result dispatch — onConfirm popup-only, ordered before onClose, which always fires (jsx:21-24)', () => {
    it('popup result: onConfirm receives the payload BY IDENTITY, then onClose fires with zero args', async () => {
      const payload = deepFreeze({
        type: 'automation_info',
        name: 'Elemental Epitome',
        automationType: 'class_feature',
        description: 'Damage Resistance set to Fire.',
        automation: baseAction.automation,
      });
      epitomeHandler.applyResistanceChoice.mockResolvedValueOnce({ type: 'popup', payload });
      const order = [];
      const onClose = vi.fn((...args) => order.push(['close', args.length]));
      const onConfirm = vi.fn((...args) => order.push(['confirm', args.length]));
      renderModal({ onClose, onConfirm });
      selectType('Fire');
      await clickChoose();
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm.mock.calls[0][0]).toBe(payload); // identity, not deep echo
      expect(order).toEqual([['confirm', 1], ['close', 0]]);
      expect(onClose.mock.calls[0]).toEqual([]);
    });

    it('popup result with NO onConfirm prop: no crash, onClose still fires once', async () => {
      const { onClose } = renderModal({ onConfirm: undefined });
      selectType('Fire');
      await clickChoose(); // DEFAULT_APPLY returns the popup shape
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('non-popup result (modal): onConfirm NOT called, onClose still fires once', async () => {
      epitomeHandler.applyResistanceChoice.mockResolvedValueOnce({ type: 'modal', modalName: 'other', payload: {} });
      const { onConfirm, onClose } = renderModal();
      selectType('Cold');
      await clickChoose();
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it.each([
      { label: 'null', value: null },
      { label: 'undefined', value: undefined },
    ])('result $label: onConfirm skipped (result?.type, jsx:21), onClose fires once', async ({ value }) => {
      epitomeHandler.applyResistanceChoice.mockResolvedValueOnce(value);
      const { onConfirm, onClose } = renderModal();
      selectType('Fire');
      await clickChoose();
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('FLAG pinned: double Choose click double-fires — no submitting guard (jsx:18-25)', async () => {
      // The modal never unmounts itself; with the parent's onClose mocked it stays mounted and
      // Choose stays enabled. In-app this window is the network round-trip — a real double-apply risk.
      const { onClose } = renderModal();
      selectType('Fire');
      await clickChoose();
      expect(chooseBtn()).toBeEnabled();
      await clickChoose();
      expect(epitomeHandler.applyResistanceChoice).toHaveBeenCalledTimes(2);
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cancel and overlay', () => {
    it('Cancel calls onClose ONCE and forwards the raw click event (jsx:63 vs stripped apply-path onClose)', () => {
      const { onClose } = renderModal();
      fireEvent.click(cancelBtn());
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose.mock.calls[0][0].type).toBe('click');
      expect(epitomeHandler.applyResistanceChoice).not.toHaveBeenCalled();
    });

    it('overlay-background and modal-content clicks are inert — full chooser intact', () => {
      const { container, onClose } = renderModal();
      fireEvent.click(document.querySelector('.sp-overlay'));
      fireEvent.click(container.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getAllByRole('radio')).toHaveLength(5);
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    it('selection persists after Cancel — the component keeps state until the parent unmounts it', () => {
      const { onClose } = renderModal();
      selectType('Thunder');
      fireEvent.click(cancelBtn());
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('radio', { name: radioName('Thunder') })).toBeChecked();
      expect(chooseBtn()).toBeEnabled();
      expect(epitomeHandler.applyResistanceChoice).not.toHaveBeenCalled();
    });
  });

  describe('header fallback and stats pass-through', () => {
    it.each([
      { label: '{}', value: {} },
      { label: '{ automation: {} }', value: { automation: {} } },
      { label: 'null', value: null },
      { label: 'undefined', value: undefined },
    ])('action $label → header falls back to Elemental Epitome, full chooser renders safely', ({ value }) => {
      const { container } = renderModal({ action: value });
      expect(container.querySelector('.sp-header').textContent.trim()).toBe('Elemental Epitome');
      expect(screen.getAllByRole('radio')).toHaveLength(5);
      expect(screen.getAllByRole('button').map(b => b.textContent.trim())).toEqual(['Choose', 'Cancel']);
      expect(chooseBtn()).toBeDisabled();
    });

    it('playerStats without a name is forwarded by identity; the modal renders no player-name sink', async () => {
      const anonymous = deepFreeze({});
      const { container, onClose } = renderModal({ playerStats: anonymous });
      expect(container.textContent).not.toContain(PLAYER);
      selectType('Cold');
      await clickChoose();
      expect(epitomeHandler.applyResistanceChoice.mock.calls[0][1]).toBe(anonymous);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
