// Owns the modal's OWN behavior via its own props: option description rendering
// per isTwinkled, self-application on Choose with autoApply defaulting to true
// (the live CharSpecialActionsModals wiring shape), the autoApply={false}
// confirm-only branch (the live CharActionModals.SecondaryModals wiring shape),
// runtime restoration of the active constellation from activeBuffs, and the
// Cancel/Done onClose wiring.
//
// Ownership note: the CLA-368 host lane (../CharSpecialActions.twinklingConstellations.test.jsx)
// pins the grid→modal wiring from outside — Choose disabled until selection
// through the grid, selecting alone never applying, Choose applying via the
// TWINKLING applier with exact args, the Starry Form applier never being
// called, and result view + Done close. Those host-side cases are deliberately
// NOT duplicated here; this file drives the modal directly with its own props.
//
// Flagged, not fixed: the component renders inline styles on the options
// wrapper (L59), option buttons (L79-87), and the description span (L91).
// Selection state is expressed only through those inline styles, so selection
// is pinned behaviorally (Choose enabled state + applier args), never through
// style-attribute selectors.
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ConstellationSelectionModal from './ConstellationSelectionModal.jsx';

vi.mock('../../../services/automation/handlers/class-sorcerer/starryFormHandler.js', () => ({
  applyConstellationOption: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

import * as starryFormHandler from '../../../services/automation/handlers/class-sorcerer/starryFormHandler.js';
import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';

function makeProps(overrides = {}) {
  return {
    action: { name: 'Starry Form', automation: { type: 'constellation_selection' } },
    playerStats: { name: 'Sorcerer1', level: 5 },
    campaignName: 'test-campaign',
    isTwinkled: false,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

const optionButton = (option) => screen.getByRole('button', { name: new RegExp(`^${option}`) });

// Result descriptions echo the chosen option so each result view text is exact
// and per-constellation (mirrors the real handler's "<option> constellation chosen." output).
function chosenText(option) {
  return `${option} constellation chosen.`;
}

beforeEach(() => {
  starryFormHandler.applyConstellationOption.mockImplementation((action, stats, campaign, option) => Promise.resolve({
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: action.name,
      automationType: 'constellation_selection',
      description: chosenText(option),
    },
  }));
  useRuntimeState.getRuntimeValue.mockReturnValue([]);
});

afterEach(() => {
  // mockReset (not clearAllMocks) so per-test impls do not leak into later tests.
  starryFormHandler.applyConstellationOption.mockReset();
  useRuntimeState.getRuntimeValue.mockReset();
});

describe('ConstellationSelectionModal', () => {
  describe('selection view', () => {
    it('renders header, prompt, all three constellation options, Cancel, and a disabled Choose', () => {
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(screen.getByText('Starry Form')).toBeInTheDocument();
      expect(screen.getByText('Choose a constellation:')).toBeInTheDocument();
      expect(optionButton('Archer')).toBeInTheDocument();
      expect(optionButton('Chalice')).toBeInTheDocument();
      expect(optionButton('Dragon')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
    });

    it.each([
      ['Archer', false, 'Ranged Spell Attack: 1d8 + Wisdom Modifier Radiant damage'],
      ['Archer', true, 'Ranged Spell Attack: 2d8 + Wisdom Modifier Radiant damage'],
      ['Chalice', false, 'Healing Spell: 1d8 + Wisdom Modifier HP to ally within 30 feet'],
      ['Chalice', true, 'Healing Spell: 2d8 + Wisdom Modifier HP to ally within 30 feet'],
      ['Dragon', false, 'Concentration: Treat d20 rolls of 9 or lower as 10'],
      ['Dragon', true, 'Concentration: Treat d20 rolls of 9 or lower as 10. Fly Speed 20 feet (hover)'],
    ])('shows the exact %s description when isTwinkled=%s', (option, isTwinkled, text) => {
      render(<ConstellationSelectionModal {...makeProps({ isTwinkled })} />);
      // Exact span text: for plain Dragon this also pins that Fly Speed is NOT appended.
      expect(within(optionButton(option)).getByText(text)).toBeInTheDocument();
    });

    it('renders the action name from the prop in the header, not a hardcoded label', () => {
      render(<ConstellationSelectionModal {...makeProps({ action: { name: 'My Custom Starry Form', automation: { type: 'constellation_selection' } } })} />);
      expect(screen.getByText('My Custom Starry Form')).toBeInTheDocument();
    });
  });

  describe('Choose flow (autoApply defaults to true)', () => {
    it.each(['Archer', 'Chalice', 'Dragon'])('clicking %s then Choose applies once via the applier prop and swaps to the result view', async (option) => {
      const props = makeProps();
      render(<ConstellationSelectionModal {...props} />);

      fireEvent.click(optionButton(option));
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));

      expect(await screen.findByText(chosenText(option))).toBeInTheDocument();
      expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledTimes(1);
      expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledWith(props.action, props.playerStats, props.campaignName, option);
      expect(props.onConfirm).toHaveBeenCalledTimes(1);
      expect(props.onConfirm).toHaveBeenCalledWith(option);

      // Result view replaces the selection options; header persists.
      expect(screen.queryByText('Choose a constellation:')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
      expect(screen.getByText('Starry Form')).toBeInTheDocument();
    });

    it('stays inert when Choose is clicked with no selection', () => {
      const props = makeProps();
      render(<ConstellationSelectionModal {...props} />);

      const choose = screen.getByRole('button', { name: 'Choose' });
      expect(choose).toBeDisabled();
      fireEvent.click(choose);

      expect(starryFormHandler.applyConstellationOption).not.toHaveBeenCalled();
      expect(props.onConfirm).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('routes Choose through the injected applyOption instead of the module default', async () => {
      const applyOption = vi.fn().mockResolvedValue({
        type: 'popup',
        payload: { type: 'automation_info', name: 'Starry Form', description: chosenText('Dragon') },
      });
      const props = makeProps({ applyOption });
      render(<ConstellationSelectionModal {...props} />);

      fireEvent.click(optionButton('Dragon'));
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));

      expect(await screen.findByText(chosenText('Dragon'))).toBeInTheDocument();
      expect(applyOption).toHaveBeenCalledWith(props.action, props.playerStats, props.campaignName, 'Dragon');
      expect(starryFormHandler.applyConstellationOption).not.toHaveBeenCalled();
    });

    it('with autoApply={false}, Choose only confirms once — no apply, no result view', () => {
      const applyOption = vi.fn();
      const props = makeProps({ autoApply: false, applyOption });
      render(<ConstellationSelectionModal {...props} />);

      fireEvent.click(optionButton('Dragon'));
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));

      // The parent lane owns the single application (apply + log + close), so
      // the modal must confirm exactly once and stay on the selection view.
      expect(props.onConfirm).toHaveBeenCalledTimes(1);
      expect(props.onConfirm).toHaveBeenCalledWith('Dragon');
      expect(applyOption).not.toHaveBeenCalled();
      expect(starryFormHandler.applyConstellationOption).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
      expect(screen.getByText('Choose a constellation:')).toBeInTheDocument();
    });
  });

  describe('close buttons', () => {
    it('Cancel closes without confirming or applying', () => {
      const props = makeProps();
      render(<ConstellationSelectionModal {...props} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(props.onConfirm).not.toHaveBeenCalled();
      expect(starryFormHandler.applyConstellationOption).not.toHaveBeenCalled();
    });

    it('Done closes the modal from the result view', async () => {
      const props = makeProps();
      render(<ConstellationSelectionModal {...props} />);

      fireEvent.click(optionButton('Archer'));
      fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
      expect(await screen.findByText(chosenText('Archer'))).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      // Uncontrolled modal: the parent owns the unmount (grid lane pins that),
      // so Done's contract here is exactly one onClose call.
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('runtime restoration of the active constellation', () => {
    it('reads activeBuffs for this character and campaign, pre-selects the matching buff, and applies it on Choose', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue([
        { name: 'Other Buff' },
        { name: 'Twinkling Constellations', constellation: 'Archer' },
        { name: 'Starry Form', constellation: 'Chalice' },
      ]);
      const props = makeProps();
      render(<ConstellationSelectionModal {...props} />);

      expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('Sorcerer1', 'activeBuffs', 'test-campaign');
      const choose = screen.getByRole('button', { name: 'Choose' });
      expect(choose).toBeEnabled();

      fireEvent.click(choose);

      expect(await screen.findByText(chosenText('Chalice'))).toBeInTheDocument();
      expect(starryFormHandler.applyConstellationOption).toHaveBeenCalledWith(props.action, props.playerStats, props.campaignName, 'Chalice');
      expect(props.onConfirm).toHaveBeenCalledWith('Chalice');
    });

    it.each([
      ['no buffs', []],
      ['a non-array value', null],
      ['a starry buff with no constellation', [{ name: 'Starry Form' }]],
      ['a constellation buff under a different action name', [{ name: 'Twinkling Constellations', constellation: 'Archer' }]],
    ])('Choose stays disabled when activeBuffs has %s', (_label, stored) => {
      useRuntimeState.getRuntimeValue.mockReturnValue(stored);
      render(<ConstellationSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
    });
  });
});
