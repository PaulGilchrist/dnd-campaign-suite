// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TargetPopupBase from './TargetPopupBase.jsx';

// Dedicated TargetPopupBase spec — closes the ⚠ COVERAGE GAP of ledger pass
// run2#290: `spell?.name || 'Spell'` (:28) and the Escape-only keydown guard
// (:10-16) had NO direct pin once the older consumer lanes dropped theirs
// (MagicMissileTargetPopup.test.jsx:44-45 pins its OWN expression, not this
// file). Direct mount of the REAL base, zero mocks of base internals
// (fix#154 vacuous-mock law). Absorbs the subtitle/fallback/Escape dupes
// named in pass #287/#288 consolidation plans.
//
// Guard bytes pinned here:
//   :12    if (e.key === 'Escape') onSkip();          -- Escape is the ONLY
//          handled key: Enter is mouse-lane-only inert, foreign keys inert.
//   :14-15 addEventListener + symmetric removeEventListener of the SAME named
//          handler (fix#145 house idiom: leak-free by construction) — the
//          leak-ledger arm below fails if cleanup is ever deleted.
//   :16    [onSkip] dep: identity swap re-registers; stale handler dies.

const EM_DASH = '\u2014'; // byte at :20

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

// title/icon deliberately distinct from every fallback word.
function makeProps(overrides = {}) {
  return {
    icon: 'fa-solid fa-shield-halved',
    title: 'Base Popup Title',
    spell: { name: 'Shield of Faith', level: 1 },
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    ...overrides,
  };
}

// The <p class="metamagic-spell-name"> line is rendered ONLY by the base
// (:27-29) — no consumer can shadow this selector.
const nameLine = () => document.querySelector('.metamagic-spell-name');
const spellName = () => nameLine().querySelector('strong').textContent;
const confirmButton = () => screen.getByRole('button', { name: 'Confirm' });
const cancelButton = () => screen.getByRole('button', { name: 'Cancel' });

describe('TargetPopupBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('spell name fallback (:28 spell?.name || "Spell")', () => {
    it('renders the byte-exact "Spell" placeholder in the <strong> when the spell prop is absent', () => {
      render(<TargetPopupBase {...makeProps({ spell: undefined })} />);

      expect(spellName()).toBe('Spell');
      expect(screen.getByText('Spell')).toBeInTheDocument();
    });

    it('renders the real spell name and the fallback never shadows it', () => {
      render(<TargetPopupBase {...makeProps({ spell: { name: 'Fireball', level: 3 }, school: 'Evocation' })} />);

      expect(spellName()).toBe('Fireball');
      expect(screen.queryByText('Spell')).not.toBeInTheDocument();
      // whole line is the joined base expression: name + ' ' + subtitle
      expect(nameLine().textContent).toBe(`Fireball ${EM_DASH} Level 3 Evocation`);
    });

    it('treats an empty-string name as absent ("||" not "??" — falsy-string arm)', () => {
      render(<TargetPopupBase {...makeProps({ spell: { name: '', level: 2 } })} />);

      expect(spellName()).toBe('Spell');
    });
  });

  describe('subtitle derivation (:18-20 spellSubtitle != null ? spellSubtitle : em-dash level/school)', () => {
    // #1348 truth-table: every derivation branch, byte-exact full line.
    it.each([
      { label: 'spell-absent-defaults', spell: undefined, school: undefined, defaultLevel: undefined, spellSubtitle: undefined, line: `Spell ${EM_DASH} Level 1 Abjuration` },
      { label: 'spell-level-over-defaultLevel', spell: { name: 'Haste', level: 3 }, school: undefined, defaultLevel: undefined, spellSubtitle: undefined, line: `Haste ${EM_DASH} Level 3 Abjuration` },
      { label: 'level-0-respected-by-??', spell: { name: 'Light', level: 0 }, school: undefined, defaultLevel: undefined, spellSubtitle: undefined, line: `Light ${EM_DASH} Level 0 Abjuration` },
      { label: 'spell-without-level-falls-to-defaultLevel', spell: { name: 'Detect Magic' }, school: undefined, defaultLevel: 2, spellSubtitle: undefined, line: `Detect Magic ${EM_DASH} Level 2 Abjuration` },
      { label: 'school-override', spell: { name: 'Shield', level: 1 }, school: 'Abjuration of the North', defaultLevel: undefined, spellSubtitle: undefined, line: `Shield ${EM_DASH} Level 1 Abjuration of the North` },
      { label: 'spellSubtitle-override-beats-derived', spell: { name: 'Shield', level: 1 }, school: undefined, defaultLevel: undefined, spellSubtitle: 'Ritual, Concentration', line: 'Shield Ritual, Concentration' },
      { label: 'spellSubtitle-empty-string-honored-by-!=null', spell: { name: 'Shield', level: 1 }, school: undefined, defaultLevel: undefined, spellSubtitle: '', line: 'Shield ' },
    ])('$label', ({ spell, school, defaultLevel, spellSubtitle, line }) => {
      render(
        <TargetPopupBase
          {...makeProps({ spell, spellSubtitle })}
          {...(school !== undefined ? { school } : {})}
          {...(defaultLevel !== undefined ? { defaultLevel } : {})}
        />
      );

      expect(nameLine().textContent).toBe(line);
    });
  });

  describe('keydown guard (:10-16, Escape-only)', () => {
    it('Escape calls onSkip once with NO arguments and never onConfirm', () => {
      render(<TargetPopupBase {...makeProps()} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnSkip).toHaveBeenCalledTimes(1);
      expect(mockOnSkip).toHaveBeenCalledWith();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('has no latch: each Escape press while mounted skips again', () => {
      render(<TargetPopupBase {...makeProps()} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnSkip).toHaveBeenCalledTimes(2);
    });

    it('Enter is inert — the guard branches ONLY on "Escape"; confirm is mouse-lane-only', () => {
      render(<TargetPopupBase {...makeProps({ confirmDisabled: false })} />);

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(mockOnConfirm).not.toHaveBeenCalled();
      expect(mockOnSkip).not.toHaveBeenCalled();

      // and the mouse lane still works, proving the keydown was inert not the page dead
      fireEvent.click(confirmButton());
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('foreign keys are inert (tab, a, ArrowDown, Escape-with-modifier-name mismatch)', () => {
      render(<TargetPopupBase {...makeProps({ confirmDisabled: false })} />);

      for (const key of ['Tab', 'a', 'ArrowDown', 'Esc']) {
        fireEvent.keyDown(document, { key });
      }

      expect(mockOnSkip).not.toHaveBeenCalled();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('re-registers on onSkip identity swap ([onSkip] dep :16) — stale handler is dead, fresh handler fires once', () => {
      const skipV1 = vi.fn();
      const skipV2 = vi.fn();
      const { rerender } = render(<TargetPopupBase {...makeProps({ onSkip: skipV1 })} />);

      rerender(<TargetPopupBase {...makeProps({ onSkip: skipV2 })} />);
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(skipV2).toHaveBeenCalledTimes(1);
      expect(skipV1).not.toHaveBeenCalled();
    });

    it('leak ledger: exactly one keydown add per mount, one paired remove per unmount, Escape dead after unmount', () => {
      // vi.spyOn keeps calling through to the real document (fix#155
      // faithful-capture law — no behavior stubbed away).
      const addSpy = vi.spyOn(document, 'addEventListener');
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const handlers = [];
      let skipCalls = 0;
      const skip = () => { skipCalls += 1; };
      const { unmount } = render(<TargetPopupBase {...makeProps({ onSkip: skip })} />);

      const keydownAdds = addSpy.mock.calls.filter(c => c[0] === 'keydown');
      const keydownRemoves = () => removeSpy.mock.calls.filter(c => c[0] === 'keydown');
      // the base registers its own document listener exactly once per mount
      expect(keydownAdds).toHaveLength(1);
      handlers.push(keydownAdds[0][1]);
      // typeof-only pin cut (#245 sharpen, fix#163/#240 verify-not-redo): the
      // captured listener is call-pinned two lines below — :172 proves this is
      // the ONLY keydown listener, so the Escape dispatch runs handlers[0]
      // itself and :177 asserts the outcome; :183 byte-pairs the removal.

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(skipCalls).toBe(1);

      unmount();

      const removes = keydownRemoves();
      expect(removes).toHaveLength(1);
      expect(removes[0][1]).toBe(handlers[0]); // SAME named handler, byte-paired

      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(skipCalls).toBe(1); // post-unmount keys have zero effects

      // second mount cycle re-adds cleanly (adds == removes across cycles)
      render(<TargetPopupBase {...makeProps({ onSkip: skip })} />);
      expect(addSpy.mock.calls.filter(c => c[0] === 'keydown')).toHaveLength(2);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(skipCalls).toBe(2);
    });
  });

  describe('action buttons and content slots (:30-39)', () => {
    it('defaults confirmDisabled=true, confirmLabel="Confirm", cancelLabel="Cancel"', () => {
      render(<TargetPopupBase {...makeProps()} />);

      expect(confirmButton()).toBeDisabled();
      fireEvent.click(confirmButton());
      expect(mockOnConfirm).not.toHaveBeenCalled();

      fireEvent.click(cancelButton());
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('enabled confirm clicks fire onConfirm once, event passed through by onClick={onConfirm} (:36), and never skip', () => {
      render(<TargetPopupBase {...makeProps({ confirmDisabled: false, confirmLabel: 'Take Effect' })} />);

      fireEvent.click(screen.getByRole('button', { name: 'Take Effect' }));

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      // :36 wires onClick={onConfirm} DIRECTLY: the consumer receives the
      // raw click event (contrast Escape, where the guard calls onSkip()
      // with zero args — pinned above).
      const [arg] = mockOnConfirm.mock.calls[0];
      expect(arg.type).toBe('click');
      expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('description renders when provided and is omitted when null/undefined; children sit between description and actions', () => {
      const { unmount } = render(
        <TargetPopupBase {...makeProps({ description: 'A chosen description' })}>
          <p>CHILD-MARKER</p>
        </TargetPopupBase>
      );

      expect(screen.getByText('A chosen description')).toBeInTheDocument();
      expect(screen.getByText('CHILD-MARKER')).toBeInTheDocument();
      unmount();

      render(<TargetPopupBase {...makeProps({ description: undefined })} />);
      expect(screen.queryByText('A chosen description')).not.toBeInTheDocument();
    });
  });
});
