// @maintained-by-ai
/**
 * HexAbilityModal — chooser lane (fully-controlled presentational modal, pure props).
 *
 * Ownership map (siblings — do not duplicate here):
 * - CharBonusActions.jsx:113-118 + :871 handleHexAbilitySelected — the Hex open/close
 *   host: pendingHexSpell gate, setPendingHexSpell(null) unmount, setSelectedBonusSpell,
 *   and the gateMetamagic(spell, { hexAbility }) handoff. Mocked stubs live in the nine
 *   CharBonusActions.*.test.jsx lanes; hosting/dismissal is theirs.
 * - spellGates.js gateHex:767 + spellGates.hex.test.js — pending.hexAbility threading
 *   (all six keys verbatim, null when absent) through the target picker.
 * - useSimpleSpellHandlers.js:243 runHex (+ useSimpleSpellHandlers.cla107-hex-ability
 *   .test.js) — metaCtx forwarding to executeSpellCast; the key is consumed there.
 * - TargetSpellPopups.jsx:243-258 — the real custom-props caller (Enhance Ability
 *   'ability' stage): the exact five-ability no-CON list and its title/prompt/icon
 *   literals are owned by that lane (CharSpells.Popups.popupWidgets.test.jsx mocks the
 *   modal); this lane pins only that arbitrary props pass through verbatim.
 * - CharSpells.Popups.targetSelection.test.jsx — stub chooser lane; its stub adds
 *   role="dialog" the REAL modal does not have (flag 5 — drift lives there).
 * This lane owns: mount purity (exact stage copy, zero callback calls, zero inline
 * styles), the exact six-row default button matrix, title/prompt fallback semantics
 * (||) vs icon fallback (?? — flag 3), the selection seam (single raw-key arg, no
 * self-close), custom-abilities replacement verbatim, double-click double-fire (flag 2),
 * Cancel-only dismissal (no Escape path — flag 1), container inertness, and degenerate
 * prop shapes (empty list, missing label).
 *
 * NOTE — flagged product defects (HexAbilityModal audit), pinned to actual, NOT fixed:
 * 1. No Escape/keydown handler and no overlay close (:26): Cancel is the ONLY close
 *    path — overlay/modal/header/body clicks and Escape are all inert (pinned). Many
 *    sp-overlay siblings register an Escape listener; this chooser strands keyboard
 *    users on the Cancel button. Product fix: keydown Escape → onCancel.
 * 2. No double-fire guard (:38): the modal never self-unmounts (fully controlled by
 *    the caller) and the button never disables, so two clicks in one flush fire
 *    onAbilitySelected TWICE with the identical key. CharBonusActions.handleHexAbility
 *    Selected .871) closes on click 1, so the live click 2 lands on an unmounted tree
 *    — but at this seam nothing suppresses it (pinned).
 * 3. Fallback inconsistency (:21-23): title/prompt use || (empty string falls back to
 *    the default copy) while icon uses ?? (empty string renders glyph-less
 *    class="fa-solid " — pinned byte-exact incl. the trailing space).
 * 4. Key-only contract (:38): selection emits the raw 2-char key as the ONLY argument
 *    — no label, no object (pinned via calls[i] deep-equal); downstream verbatim
 *    handling (spellGates.hex:76) is owned there.
 * 5. a11y: header is a bare <div>, no role="dialog"/heading anywhere — getByRole
 *    ('dialog'/'heading') are empty at the real component (pinned); the targetSelection
 *    stub papers over this with its own role="dialog".
 * 6. Default ability list hardcoded (:12-19): overridable via `abilities`, but a
 *    renamed/added ability in the rules data drifts the default Hex chooser silently
 *    (structural note; the rows below mirror the shipped literals, not fixture-echo).
 *
 * Anti-vacuity: fully-controlled component — every mutation is an outward callback,
 * inspected as exact call arrays (never call-count echoes alone); frozen fixtures cannot
 * be silently mutated by the component; role-scoped queries plus byte-exact textContent
 * matrices; fresh vi.fn onAbilitySelected/onCancel per makeProps (no shared module-level
 * mocks); afterEach cleanup (never clearAllMocks/resetAllMocks); deterministic dice —
 * none on this seam; no store, log, or timestamp seam exists on this component, so no
 * Date.now freeze is needed; no timers of any kind.
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import HexAbilityModal from './HexAbilityModal.jsx';

// ── Fixtures (frozen; rows mirror HexAbilityModal.jsx:12-19 shipped literals) ──
const DEFAULT_TITLE = 'Hex \u2014 Choose Ability';
const DEFAULT_PROMPT = 'Choose an ability check for the target to have disadvantage on:';

const DEFAULT_ABILITIES = Object.freeze([
  Object.freeze({ key: 'STR', label: 'Strength' }),
  Object.freeze({ key: 'DEX', label: 'Dexterity' }),
  Object.freeze({ key: 'CON', label: 'Constitution' }),
  Object.freeze({ key: 'INT', label: 'Intelligence' }),
  Object.freeze({ key: 'WIS', label: 'Wisdom' }),
  Object.freeze({ key: 'CHA', label: 'Charisma' }),
]);
const DEFAULT_BUTTON_TEXTS = DEFAULT_ABILITIES.map(({ label, key }) => `${label} (${key})`);

// Custom set: two entries incl. a duplicate-of-default plus a made-up skill —
// proves full replacement (defaults absent) and verbatim pass-through.
const CUSTOM_ABILITIES = Object.freeze([
  Object.freeze({ key: 'DEX', label: 'Dexterity' }),
  Object.freeze({ key: 'PER', label: 'Perception' }),
]);

// Fresh vi.fn pair per call — no cross-test residue, no clearAllMocks.
function makeProps(overrides = {}) {
  return { onAbilitySelected: vi.fn(), onCancel: vi.fn(), ...overrides };
}

// ── Query helpers ──
const abilityBtns = (container) => [...container.querySelectorAll('.hex-ability-btn')];
const abilityTexts = (container) => abilityBtns(container).map(b => b.textContent);
const headerIcon = (container) => container.querySelector('.sp-header i');

afterEach(cleanup);

describe('HexAbilityModal', () => {
  // ── Mount purity / exact stage copy ──

  it('mounts the exact default stage: eye header, title, prompt, six-row matrix, Cancel — zero callback calls, zero inline styles', () => {
    const props = makeProps();
    const { container } = render(<HexAbilityModal {...props} />);

    expect(container.querySelector('.sp-overlay .sp-modal')).toBeInTheDocument();
    expect(container.querySelector('.sp-header i.fa-solid.fa-eye')).toBeInTheDocument();
    expect(container.querySelectorAll('.sp-header i')).toHaveLength(1);
    expect(screen.getByText(DEFAULT_TITLE)).toBeInTheDocument();
    expect(container.querySelector('.sp-body p').textContent).toBe(DEFAULT_PROMPT);
    expect(abilityTexts(container)).toEqual(DEFAULT_BUTTON_TEXTS);
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel.querySelector('i.fa-solid.fa-times')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(7);
    // Flag 5: bare divs — no dialog/heading roles anywhere at the real component.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    // No inline styles anywhere (house rule).
    expect(container.innerHTML).not.toContain('style=');
    // Mount purity: callbacks untouched.
    expect(props.onAbilitySelected).not.toHaveBeenCalled();
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  // ── Title / prompt fallback (|| semantics) ──

  it.each([
    { input: undefined, expected: DEFAULT_TITLE },
    { input: null, expected: DEFAULT_TITLE },
    { input: '', expected: DEFAULT_TITLE }, // || — empty string falls back (:21)
    { input: 'Enhance Ability \u2014 Choose Ability', expected: 'Enhance Ability \u2014 Choose Ability' },
  ])('title $input renders "$expected"', ({ input, expected }) => {
    const props = makeProps();
    render(<HexAbilityModal {...props} title={input} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it.each([
    { input: undefined, expected: DEFAULT_PROMPT },
    { input: null, expected: DEFAULT_PROMPT },
    { input: '', expected: DEFAULT_PROMPT }, // || — empty string falls back (:22)
    { input: 'Choose the ability that the target gains Advantage on ability checks with:', expected: 'Choose the ability that the target gains Advantage on ability checks with:' },
  ])('prompt $input renders "$expected"', ({ input, expected }) => {
    const props = makeProps();
    render(<HexAbilityModal {...props} prompt={input} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  // ── Icon fallback: ?? semantics (flag 3) ──

  it.each([
    { input: undefined, className: 'fa-solid fa-eye' },
    { input: null, className: 'fa-solid fa-eye' },
    { input: 'fa-hand', className: 'fa-solid fa-hand' },
    { input: 'fa-skull', className: 'fa-solid fa-skull' },
    { input: '', className: 'fa-solid ' }, // ?? — glyph-less, trailing space (flag 3)
  ])('icon "$input" renders header class "$className"', ({ input, className }) => {
    render(<HexAbilityModal {...makeProps({ icon: input })} />);
    expect(headerIcon(document)).toHaveAttribute('class', className);
  });

  // ── Selection seam (per default ability: render + click, flag 4 arg shape) ──

  it.each(DEFAULT_ABILITIES)('clicking %s fires onAbilitySelected once with the raw key "%s" as its only arg — no close, no self-unmount (flag 2 surface)', ({ key, label }) => {
    const props = makeProps();
    render(<HexAbilityModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: `${label} (${key})` }));

    expect(props.onAbilitySelected).toHaveBeenCalledTimes(1);
    expect(props.onAbilitySelected.mock.calls[0]).toEqual([key]); // flag 4: key only
    expect(props.onCancel).not.toHaveBeenCalled();
    // Fully controlled: the chooser never unmounts itself after selecting.
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('double-click in one flush fires onAbilitySelected twice with identical args (flag 2) — nothing at this seam guards the second click', () => {
    const props = makeProps();
    render(<HexAbilityModal {...props} />);

    const btn = screen.getByRole('button', { name: 'Dexterity (DEX)' });
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(props.onAbilitySelected.mock.calls).toEqual([['DEX'], ['DEX']]);
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('custom abilities replace the defaults verbatim and each click fires its exact raw key', () => {
    const props = makeProps();
    const { container } = render(<HexAbilityModal {...props} abilities={CUSTOM_ABILITIES} />);

    expect(abilityTexts(container)).toEqual(['Dexterity (DEX)', 'Perception (PER)']);
    expect(screen.queryByRole('button', { name: 'Strength (STR)' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3); // two abilities + Cancel

    fireEvent.click(screen.getByRole('button', { name: 'Perception (PER)' }));
    expect(props.onAbilitySelected.mock.calls[0]).toEqual(['PER']);
    fireEvent.click(screen.getByRole('button', { name: 'Dexterity (DEX)' }));
    expect(props.onAbilitySelected.mock.calls).toEqual([['PER'], ['DEX']]);
  });

  it('degrades with a label-less ability row: gap text " (KEY)" renders and the click still emits the exact key', () => {
    const props = makeProps();
    const { container } = render(
      <HexAbilityModal
        {...props}
        abilities={Object.freeze([Object.freeze({ key: 'PER' }), Object.freeze({ key: 'STE', label: 'Stealth' })])}
      />
    );

    expect(abilityTexts(container)).toEqual([' (PER)', 'Stealth (STE)']);
    fireEvent.click(abilityBtns(container)[0]);
    expect(props.onAbilitySelected).toHaveBeenCalledTimes(1);
    expect(props.onAbilitySelected.mock.calls[0]).toEqual(['PER']);
  });

  it('empty abilities list: no ability rows, header/prompt intact, exactly one Cancel remains and closes once', () => {
    const props = makeProps();
    const { container } = render(<HexAbilityModal {...props} abilities={[]} />);

    expect(abilityBtns(container)).toHaveLength(0);
    expect(screen.getByText(DEFAULT_TITLE)).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_PROMPT)).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onAbilitySelected).not.toHaveBeenCalled();
  });

  // ── Close semantics ──

  it('Cancel fires onCancel exactly once, never the selection seam, and the modal stays mounted for the caller', () => {
    const props = makeProps();
    render(<HexAbilityModal {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onAbilitySelected).not.toHaveBeenCalled();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it.each(['.sp-overlay', '.sp-modal', '.sp-header', '.sp-body'])('click on %s is fully inert: no callback of any kind, stage untouched', (selector) => {
    const props = makeProps();
    render(<HexAbilityModal {...props} />);

    fireEvent.click(document.querySelector(selector));

    expect(props.onCancel).not.toHaveBeenCalled();
    expect(props.onAbilitySelected).not.toHaveBeenCalled();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('Escape has no dismissal handler — keydown on document and modal are inert (flag 1); Cancel still closes afterwards', () => {
    const props = makeProps();
    render(<HexAbilityModal {...props} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document.querySelector('.sp-modal'), { key: 'Escape' });
    fireEvent.keyUp(document, { key: 'Escape' });

    expect(props.onCancel).not.toHaveBeenCalled();
    expect(props.onAbilitySelected).not.toHaveBeenCalled();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });
});
