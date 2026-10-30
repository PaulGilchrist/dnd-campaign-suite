// @maintained-by-ai
// TravelPanel leaf lane — owns the panel's own DOM: exact button labels + dispatch payloads,
// byte-guarded disabled states, and prop-rendered display bytes (budget bar, next-hex ETA,
// weather, forced-march status). Owned upstream, not re-tested here: destination-select
// routing + advance logging (HexMap.travel.test.jsx #794), container forwarding
// (HexMap.additional.test.jsx #792), travelInit derivation and pace budgets slow=2/normal=4/
// fast=5 (#803, useTravelManagement), tool activation (#806), getHexTravelTime/
// formatTravelTime math (travelService.test.js). Zero module mocks — real child render,
// vi.fn callbacks only. Display bytes are literals (not recomputed via the service) so a
// mis-wired prop cannot silently agree with itself.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TravelPanel from './TravelPanel.jsx';

const PATH = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
];

const WEATHER = { icon: 'cloud-rain', label: 'Light Rain', description: 'Visibility reduced' };

// Fresh props (and fresh vi.fn spies) per test (#771). dailyBudget 4 is the real
// normal-pace budget (#803); plains at path[0] gives the 1h 30m default ETA.
const makeProps = (overrides = {}) => ({
  travelPace: 'normal',
  path: PATH,
  pathIndex: 0,
  accruedCost: 1.5,
  dailyBudget: 4,
  dayExhausted: false,
  lastMessage: '2 hexes to Thunder Falls',
  hexesRemaining: 3,
  isTravelActive: true,
  pendingEvent: null,
  terrain: { '0,0': 'plains' },
  eventFrequency: 'normal',
  showOwnHexHint: false,
  onChangePace: vi.fn(),
  onAdvance: vi.fn(),
  onCancel: vi.fn(),
  onForceCamp: vi.fn(),
  onForcedMarch: vi.fn(),
  weather: null,
  onReRollWeather: vi.fn(),
  onSetEventFrequency: vi.fn(),
  horseback: false,
  onToggleHorseback: vi.fn(),
  forcedMarchHours: 0,
  exhaustionMultiplier: 100,
  partyHasMaxExhaustion: false,
  ...overrides,
});

const renderPanel = (overrides = {}) => {
  const props = makeProps(overrides);
  const utils = render(<TravelPanel {...props} />);
  return { props, ...utils };
};

describe('TravelPanel', () => {
  it('renders nothing until travel is active', () => {
    renderPanel({ isTravelActive: false });
    expect(screen.queryByText('Travel Mode')).not.toBeInTheDocument();
  });

  describe('own-hex dead-click hint', () => {
    // Render condition for the backlog-2026-10-26 hint: HexMap flips the
    // showOwnHexHint flag on an own-hex click (wired in HexMap.travel.test.jsx);
    // the panel shows the inline line ONLY while that prop is true.
    const HINT = 'Select a hex away from the party to set your destination';

    it('is absent by default (every normal planning/travelling render)', () => {
      renderPanel();
      expect(screen.queryByText(HINT)).not.toBeInTheDocument();
      expect(document.querySelector('.travel-panel-hint')).toBeNull();
    });

    it('renders the muted inline line when HexMap arms the flag', () => {
      renderPanel({ showOwnHexHint: true });
      const hint = document.querySelector('.travel-panel-hint');
      expect(hint).not.toBeNull();
      expect(hint).toHaveTextContent(HINT);
    });

    it('disappears again when the flag clears (valid destination set)', () => {
      const { rerender } = renderPanel({ showOwnHexHint: true });
      expect(screen.getByText(HINT)).toBeInTheDocument();
      rerender(<TravelPanel {...makeProps({ showOwnHexHint: false })} />);
      expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    });
  });

  describe('max-exhaustion travel gate', () => {
    // Backlog 2026-10-26-C: when any PC's exhaustionLevel >= 6 the hook sets
    // partyHasMaxExhaustion, advanceDisabled hard-blocks Advance, and without
    // this lane the GM saw only a dead button (the exhausted banner needs an
    // advance to fire, which is blocked). Pin hint + tooltips present when
    // maxed, absent otherwise; the own-hex hint lane must not regress.
    const MAX_HINT = 'A party member is at maximum exhaustion — rest required';
    const FM_TITLE = 'Cannot forced march — a party member has reached maximum exhaustion';
    const OWN_HEX_HINT = 'Select a hex away from the party to set your destination';

    it('blocks advance and explains the block when a party member is maxed', () => {
      renderPanel({ partyHasMaxExhaustion: true });
      const advance = screen.getByRole('button', { name: 'Advance One Hex' });
      expect(advance).toBeDisabled();
      expect(advance).toHaveAttribute('title', MAX_HINT);
      const hints = [...document.querySelectorAll('.travel-panel-hint')];
      expect(hints).toHaveLength(1);
      expect(hints[0]).toHaveTextContent(MAX_HINT);
    });

    it('pins the exhausted-banner forced-march tooltip to the refusal wording', () => {
      renderPanel({ dayExhausted: true, partyHasMaxExhaustion: true });
      const march = screen.getByRole('button', { name: 'Forced March' });
      expect(march).toBeDisabled();
      expect(march).toHaveAttribute('title', FM_TITLE);
      // Camp stays available (rest is the way out).
      expect(screen.getByRole('button', { name: 'Camp' })).toBeEnabled();
    });

    it('swaps the banner question for the camp-only face at max exhaustion', () => {
      // Backlog 2026-10-30-AN: the FM button is natively disabled at max EX,
      // so the "camp or forced march?" invite names an impossible verb — the
      // question gates on the same predicate and the old copy must NEVER
      // render at max.
      const { rerender } = renderPanel({ dayExhausted: true, partyHasMaxExhaustion: true });
      expect(screen.getByText('Travel budget exhausted — camp to rest.')).toBeInTheDocument();
      expect(screen.queryByText('Travel budget exhausted — camp or forced march?')).not.toBeInTheDocument();
      // Below max the honest invite returns byte-identical (no regression) —
      // and an unexhausted day shows no banner face at all.
      rerender(<TravelPanel {...makeProps({ dayExhausted: true, partyHasMaxExhaustion: false })} />);
      expect(screen.getByText('Travel budget exhausted — camp or forced march?')).toBeInTheDocument();
      expect(screen.queryByText('Travel budget exhausted — camp to rest.')).not.toBeInTheDocument();
      rerender(<TravelPanel {...makeProps({ dayExhausted: false, partyHasMaxExhaustion: true })} />);
      expect(screen.queryByText('Travel budget exhausted — camp to rest.')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Camp' })).not.toBeInTheDocument();
    });

    it('shows no max-exhaustion hint and no advance tooltip otherwise', () => {
      const { props, rerender } = renderPanel({ partyHasMaxExhaustion: false });
      expect(screen.queryByText(MAX_HINT)).not.toBeInTheDocument();
      expect(document.querySelector('.travel-panel-hint')).toBeNull();
      expect(screen.getByRole('button', { name: 'Advance One Hex' })).not.toHaveAttribute('title');
      // Un-seeding re-enables advance with the gate fully cleared.
      rerender(<TravelPanel {...makeProps({ partyHasMaxExhaustion: false })} />);
      expect(screen.getByRole('button', { name: 'Advance One Hex' })).toBeEnabled();
      expect(props.onAdvance).not.toHaveBeenCalled();
    });

    it('coexists with the own-hex hint without regressing it', () => {
      const first = renderPanel({ partyHasMaxExhaustion: true, showOwnHexHint: true });
      expect(screen.getByText(MAX_HINT)).toBeInTheDocument();
      expect(screen.getByText(OWN_HEX_HINT)).toBeInTheDocument();
      // Max-exhaustion alone must not fake the own-hex line.
      first.unmount();
      renderPanel({ partyHasMaxExhaustion: true, showOwnHexHint: false });
      expect(screen.queryByText(OWN_HEX_HINT)).not.toBeInTheDocument();
    });
  });

  describe('state variants', () => {
    // One row per visible panel state; every disabled guard of advanceDisabled
    // (dayExhausted | path end | pendingEvent | partyHasMaxExhaustion) is pinned as a
    // byte guard here — never click-blocked (#788).
    it.each([
      {
        label: 'travelling shows stats and an enabled advance, no banners',
        props: {},
        visible: ['Travel Mode', '2 hexes to Thunder Falls', 'Events:', 'Pace:', 'Mount:', 'Walking',
          'Remaining', '3 hexes', 'Next hex', '1h 30m', 'Budget', '1.5 / 4', '2.5 left'],
        enabled: ['Advance One Hex', 'Cancel'],
        absentText: ['Weather:', '3 / 6 stacks', 'Travel budget exhausted — camp or forced march?', 'Arrived'],
        absentButtons: ['Camp', 'Forced March'],
      },
      {
        label: 'exhausted day shows the banner and clamps the budget readout',
        props: { accruedCost: 4.5, dayExhausted: true },
        visible: ['Travel budget exhausted — camp or forced march?', '4.5 / 4', '0.0 left'],
        enabled: ['Camp', 'Forced March'],
        disabled: ['Advance One Hex'],
      },
      {
        label: 'max exhaustion blocks forced march but not camp',
        props: { dayExhausted: true, partyHasMaxExhaustion: true },
        visible: ['Travel budget exhausted — camp to rest.'],
        absentText: ['Travel budget exhausted — camp or forced march?'],
        enabled: ['Camp'],
        disabled: ['Forced March', 'Advance One Hex'],
      },
      {
        label: 'a pending event blocks advance',
        props: { pendingEvent: { title: 'Ambush' } },
        disabled: ['Advance One Hex'],
      },
      {
        label: 'path end shows Arrived and hides the next-hex ETA',
        props: { pathIndex: 3 },
        visible: ['Arrived'],
        absentText: ['Next hex'],
        disabled: ['Arrived'],
      },
      {
        // Backlog 2026-10-26-E: fresh mount has path=[] and pathIndex=0, so the
        // old `pathIndex >= path.length` test vacuously read "Arrived" before a
        // destination existed — the empty path must prompt instead.
        label: 'empty path prompts for a destination, never claims Arrived',
        props: { path: [], hexesRemaining: 0 },
        visible: ['Select a destination'],
        absentText: ['Arrived', 'Advance One Hex', 'Next hex'],
        disabled: ['Select a destination'],
      },
      {
        label: 'forced march status shows stacks and speed bytes',
        // 3 stacks → 58% is the real multiplier ((5/6)^3, travelService).
        props: { forcedMarchHours: 3, exhaustionMultiplier: 58 },
        visible: ['3 / 6 stacks', 'Speed: 58%'],
      },
    ])('$label', ({ props, visible = [], enabled = [], disabled = [], absentText = [], absentButtons = [] }) => {
      renderPanel(props);
      visible.forEach((text) => expect(screen.getByText(text)).toBeInTheDocument());
      enabled.forEach((name) => expect(screen.getByRole('button', { name })).toBeEnabled());
      disabled.forEach((name) => expect(screen.getByRole('button', { name })).toBeDisabled());
      absentText.forEach((text) => expect(screen.queryByText(text)).not.toBeInTheDocument());
      absentButtons.forEach((name) => expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
    });
  });

  describe('advance button label/tooltip across route states', () => {
    // Backlog 2026-10-26-E lock: one role-query per state pins label text,
    // disabled byte, and tooltip together — fresh mount (empty path), live
    // route, and route end.
    const NO_DEST_TITLE = 'Select a destination hex on the map to plan a route';

    it('locks Select a destination / Advance One Hex / Arrived with sensible tooltips', () => {
      const { rerender } = renderPanel({ path: [], hexesRemaining: 0 });
      const prompt = screen.getByRole('button', { name: 'Select a destination' });
      expect(prompt).toBeDisabled();
      expect(prompt).toHaveAttribute('title', NO_DEST_TITLE);

      rerender(<TravelPanel {...makeProps()} />);
      const live = screen.getByRole('button', { name: 'Advance One Hex' });
      expect(live).toBeEnabled();
      expect(live).not.toHaveAttribute('title');

      rerender(<TravelPanel {...makeProps({ pathIndex: 3 })} />);
      const ended = screen.getByRole('button', { name: 'Arrived' });
      expect(ended).toBeDisabled();
      expect(ended).not.toHaveAttribute('title');
    });

    it('keeps the max-exhaustion tooltip winning over the no-destination tooltip', () => {
      renderPanel({ path: [], hexesRemaining: 0, partyHasMaxExhaustion: true });
      expect(screen.getByRole('button', { name: 'Select a destination' }))
        .toHaveAttribute('title', 'A party member is at maximum exhaustion — rest required');
    });
  });

  describe('control dispatch', () => {
    it.each([
      { label: 'advance → onAdvance', target: 'Advance One Hex', handler: 'onAdvance' },
      { label: 'pace → onChangePace', target: 'Fast', handler: 'onChangePace', arg: 'fast' },
      {
        label: 'frequency → onSetEventFrequency (tooltip byte pinned)',
        target: 'Frequent',
        handler: 'onSetEventFrequency',
        arg: 'frequent',
        title: 'Frequent: 25% chance per hex',
      },
    ])('$label', ({ target, handler, arg, title }) => {
      const { props } = renderPanel();
      const button = screen.getByRole('button', { name: target });
      if (title) expect(button).toHaveAttribute('title', title);
      fireEvent.click(button);
      expect(props[handler]).toHaveBeenCalledTimes(1);
      if (arg !== undefined) expect(props[handler]).toHaveBeenCalledWith(arg);
    });

    it('dispatches onCancel from both the header X and the Cancel button', () => {
      const { props } = renderPanel();
      fireEvent.click(screen.getByTitle('Cancel travel'));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(props.onCancel).toHaveBeenCalledTimes(2);
    });

    it('dispatches the exhausted-banner choices to onForceCamp and onForcedMarch', () => {
      const { props } = renderPanel({ dayExhausted: true });
      fireEvent.click(screen.getByRole('button', { name: 'Camp' }));
      expect(props.onForceCamp).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Forced March' }));
      expect(props.onForcedMarch).toHaveBeenCalledTimes(1);
    });

    it('mount toggle dispatches and flips label, title, and ETA', () => {
      const { props, rerender } = renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'Walking' }));
      expect(props.onToggleHorseback).toHaveBeenCalledTimes(1);

      rerender(<TravelPanel {...makeProps({ horseback: true })} />);
      expect(screen.getByRole('button', { name: 'Horseback' })).toHaveAttribute('title', 'Riding horses — double travel speed');
      expect(screen.queryByRole('button', { name: 'Walking' })).not.toBeInTheDocument();
      expect(screen.getByText('45 min')).toBeInTheDocument();
    });

    it('shows weather bytes and dispatches onReRollWeather only when weather exists', () => {
      const { props, rerender } = renderPanel({ weather: WEATHER });
      expect(screen.getByText('Weather:')).toBeInTheDocument();
      expect(screen.getByText('Light Rain')).toBeInTheDocument();
      expect(screen.getByText('Visibility reduced')).toBeInTheDocument();
      fireEvent.click(screen.getByTitle('Re-roll weather'));
      expect(props.onReRollWeather).toHaveBeenCalledTimes(1);

      rerender(<TravelPanel {...makeProps({ weather: null })} />);
      expect(screen.queryByText('Weather:')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Re-roll weather')).not.toBeInTheDocument();
    });
  });

  describe('active event-frequency readout', () => {
    // Backlog 2026-10-26-D: the default is 'normal' (useTravelManagement), not
    // 'None', and the active chip's styling was too subtle to predict
    // interruption rate. The Events row now renders label + active value +
    // chance description (Weather-row pattern).
    const READOUT = [
      { frequency: 'none', label: 'None', desc: '0% chance per hex' },
      { frequency: 'sparse', label: 'Sparse', desc: '5% chance per hex' },
      { frequency: 'normal', label: 'Normal', desc: '12% chance per hex' },
      { frequency: 'frequent', label: 'Frequent', desc: '25% chance per hex' },
    ];

    it.each(READOUT)('renders "$label" active beside the Events label', ({ frequency, label, desc }) => {
      renderPanel({ eventFrequency: frequency });
      const row = document.querySelector('.travel-panel-frequency');
      expect(row).not.toBeNull();
      // Active word is adjacent to the "Events:" label (label span → active span).
      expect(row.textContent).toMatch(new RegExp(`Events:\\s*${label}`));
      expect(row.querySelector('.travel-frequency-active')).toHaveTextContent(label);
      expect(row.querySelector('.travel-frequency-desc')).toHaveTextContent(desc);
      // The matching chip keeps its active class (chip lane unchanged).
      // Scoped: pace chips share the "Normal" name.
      const chip = row.querySelectorAll('.travel-frequency-btn');
      expect([...chip].find(b => b.textContent === label)).toHaveClass('active');
    });

    it('falls back to None for an unknown frequency key', () => {
      renderPanel({ eventFrequency: 'bogus' });
      expect(document.querySelector('.travel-frequency-active')).toHaveTextContent('None');
    });

    it('tracks the prop as the GM picks a different chip (readout + write payload)', () => {
      const { props, rerender } = renderPanel();
      expect(document.querySelector('.travel-frequency-active')).toHaveTextContent('Normal');
      // Chip click still routes the same runtime-store write through the parent.
      fireEvent.click(screen.getByRole('button', { name: 'Sparse' }));
      expect(props.onSetEventFrequency).toHaveBeenCalledWith('sparse');
      // Parent echoes the stored value back down — readout flips immediately.
      rerender(<TravelPanel {...makeProps({ eventFrequency: 'sparse' })} />);
      expect(document.querySelector('.travel-frequency-active')).toHaveTextContent('Sparse');
      expect(document.querySelector('.travel-frequency-desc')).toHaveTextContent('5% chance per hex');
    });
  });

  describe('next-hex ETA is wired to terrain, pace, and the plains fallback', () => {
    // Default (plains @ normal → 1h 30m) and horseback (→ 45 min) are pinned in the
    // variants/mount tests above; these rows pin the remaining inputs.
    it.each([
      { label: 'terrain cost (hills @ normal)', terrain: { '0,0': 'hills' }, travelPace: 'normal', time: '2h' },
      { label: 'pace cost (mountains @ slow)', terrain: { '0,0': 'mountains' }, travelPace: 'slow', time: '6h' },
      { label: 'plains fallback when the current hex has no entry', terrain: {}, travelPace: 'normal', time: '1h 30m' },
    ])('$label', ({ terrain, travelPace, time }) => {
      renderPanel({ terrain, travelPace });
      expect(screen.getByText('Next hex')).toBeInTheDocument();
      expect(screen.getByText(time)).toBeInTheDocument();
    });
  });
});
