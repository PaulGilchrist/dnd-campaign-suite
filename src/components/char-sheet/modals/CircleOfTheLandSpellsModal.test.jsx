// @maintained-by-ai
// Caller seams: opened from CharSpecialActions.jsx ('circleOfTheLandSpells' action →
// setCircleOfTheLandSpellsModal) and mounted by CharSpecialActionsModals.jsx with
// { playerStats, campaignName, onClose: () => setCircleOfTheLandSpellsModal(null) }.
// The runtime key '_circleOfTheLandType' is written CAPITALISED here and consumed
// (lower-cased defensively) by NaturalRecoveryModal, CharClassFeatures, CharSheet,
// automationPassives, rulesFactory/spellCalc2024 (nature's ward); restRules clears it
// on a long rest. Routing/handler lanes are deferred to those suites.

import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CircleOfTheLandSpellsModal from './CircleOfTheLandSpellsModal.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  useSyncedState: vi.fn(),
  useRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

// Spell fixture mirrors the modal's land-filter contract. Descriptions are written
// out longhand (not derived) so they pin the log payload independently of the
// component's level-note template.
const LANDS = [
  {
    label: 'Arid',
    icon: 'fa-sun',
    spells: [['Armor of Agathys', 1], ['Misty Step', 2]],
    logDescription: 'Chose land type: Arid. Always-prepared at fixed levels: Armor of Agathys (level 1), Misty Step (level 2)',
  },
  {
    label: 'Polar',
    icon: 'fa-snowflake',
    spells: [['Sleet Storm', 3], ['Ice Storm', 4]],
    logDescription: 'Chose land type: Polar. Always-prepared at fixed levels: Sleet Storm (level 3), Ice Storm (level 4)',
  },
  {
    label: 'Temperate',
    icon: 'fa-cloud-sun',
    spells: [['Fog Cloud', 1], ['Silence', 2]],
    logDescription: 'Chose land type: Temperate. Always-prepared at fixed levels: Fog Cloud (level 1), Silence (level 2)',
  },
  {
    label: 'Tropical',
    icon: 'fa-leaf',
    spells: [['Barkskin', 2], ['Spore Dust', 3]],
    logDescription: 'Chose land type: Tropical. Always-prepared at fixed levels: Barkskin (level 2), Spore Dust (level 3)',
  },
];

const FIXTURE_SPELLS = LANDS.flatMap(l => l.spells.map(([name]) => name));

function fixtureStats(name = 'Eldara') {
  return {
    name,
    class: {
      major: {
        spells: LANDS.flatMap(land =>
          land.spells.map(([spellName, level]) => ({
            name: spellName,
            level,
            landType: land.label.toLowerCase(),
          }))),
      },
    },
  };
}

function makeProps(overrides) {
  return {
    playerStats: fixtureStats(),
    campaignName: 'test-campaign',
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

function landButton(label) {
  return screen.getByRole('button', { name: new RegExp(`^${label}`) });
}

describe('CircleOfTheLandSpellsModal', () => {
  beforeEach(() => {
    // Fresh mock state per test; addEntry must keep resolving because the component
    // chains .catch() on its return value.
    getRuntimeValue.mockReset().mockReturnValue(null);
    setRuntimeValue.mockReset();
    addEntry.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    // mockReset strips mockResolvedValue — clearAllMocks would NOT, so reset here
    // and let beforeEach re-apply the defaults.
    getRuntimeValue.mockReset();
    setRuntimeValue.mockReset();
    addEntry.mockReset();
  });

  describe('rendering', () => {
    it('renders title, hint, all four territory buttons with icons, Cancel, and no preview by default', () => {
      render(<CircleOfTheLandSpellsModal {...makeProps()} />);

      const heading = screen.getByRole('heading', { name: /Circle of the Land Spells/ });
      expect(heading).toBeInTheDocument();
      expect(heading.querySelector('.fa-solid.fa-leaf')).toBeInTheDocument();
      expect(screen.getByText(/Choose your land type to determine bonus prepared spells/)).toBeInTheDocument();
      expect(screen.getByText('Current selection: None chosen')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

      LANDS.forEach(({ label, icon }) => {
        const btn = landButton(label);
        expect(btn).toBeInTheDocument();
        expect(btn.querySelector(`.${icon}`)).toBeInTheDocument();
        expect(btn).not.toHaveClass('cotl-land-btn--active');
      });
      // No spell previews or selection hint until a territory is hovered.
      expect(document.querySelectorAll('.cotl-spell-list')).toHaveLength(0);
      expect(screen.queryByText('Click a land type above to select it.')).not.toBeInTheDocument();
    });

    it('shows the current selection read from the runtime store', () => {
      getRuntimeValue.mockReturnValue('temperate');
      const props = makeProps();
      render(<CircleOfTheLandSpellsModal {...props} />);

      expect(getRuntimeValue).toHaveBeenCalledWith('Eldara', '_circleOfTheLandType');
      expect(screen.getByText('Current selection: temperate')).toBeInTheDocument();
    });
  });

  describe.each(LANDS)('$label territory', ({ label, spells, logDescription }) => {
    it('previews only its spells on hover, then writes, logs, and closes on click', () => {
      const props = makeProps();
      render(<CircleOfTheLandSpellsModal {...props} />);

      fireEvent.mouseEnter(landButton(label));
      const btn = landButton(label);
      expect(btn).toHaveClass('cotl-land-btn--active');
      spells.forEach(([spellName, level]) => {
        expect(within(btn).getByText(spellName)).toBeInTheDocument();
        expect(within(btn).getByText(`(level ${level})`)).toBeInTheDocument();
      });
      // Other territories' spells are not previewed, and other buttons stay inactive.
      FIXTURE_SPELLS.filter(n => !spells.map(s => s[0]).includes(n)).forEach(name => {
        expect(screen.queryByText(name)).not.toBeInTheDocument();
      });
      LANDS.filter(l => l.label !== label).forEach(l => {
        expect(landButton(l.label)).not.toHaveClass('cotl-land-btn--active');
      });
      expect(screen.getByText('Click a land type above to select it.')).toBeInTheDocument();

      fireEvent.click(btn);
      // Write contract: CAPITALISED land type under '_circleOfTheLandType',
      // full log entry with fixed levels, modal closed exactly once.
      expect(setRuntimeValue).toHaveBeenCalledWith('Eldara', '_circleOfTheLandType', label, 'test-campaign');
      expect(addEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'ability_use',
        characterName: 'Eldara',
        abilityName: 'Circle of the Land Spells',
        description: logDescription,
      });
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('threads playerStats.name through the runtime read, write, and log', () => {
    const props = makeProps({ playerStats: fixtureStats('Gromak') });
    render(<CircleOfTheLandSpellsModal {...props} />);

    expect(getRuntimeValue).toHaveBeenCalledWith('Gromak', '_circleOfTheLandType');
    fireEvent.click(landButton('Arid'));
    expect(setRuntimeValue).toHaveBeenCalledWith('Gromak', '_circleOfTheLandType', 'Arid', 'test-campaign');
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'ability_use',
      characterName: 'Gromak',
      abilityName: 'Circle of the Land Spells',
      description: LANDS[0].logDescription,
    });
  });

  it('renders empty previews and still writes with an empty level note when spell data is missing', () => {
    const props = makeProps({ playerStats: { name: 'Eldara', class: {} } });
    render(<CircleOfTheLandSpellsModal {...props} />);

    LANDS.forEach(({ label }) => expect(landButton(label)).toBeInTheDocument());
    fireEvent.mouseEnter(landButton('Tropical'));
    expect(document.querySelectorAll('.cotl-spell-name')).toHaveLength(0);

    fireEvent.click(landButton('Tropical'));
    expect(setRuntimeValue).toHaveBeenCalledWith('Eldara', '_circleOfTheLandType', 'Tropical', 'test-campaign');
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'ability_use',
      characterName: 'Eldara',
      abilityName: 'Circle of the Land Spells',
      description: 'Chose land type: Tropical. Always-prepared at fixed levels: ',
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  describe('close behavior', () => {
    it.each([
      ['Cancel button', () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
      ['Escape key', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ])('%s closes once without writing state', (_path, act) => {
      const props = makeProps();
      render(<CircleOfTheLandSpellsModal {...props} />);

      act();
      expect(props.onClose).toHaveBeenCalledTimes(1);
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('ignores overlay clicks (no close, no write, modal stays mounted)', () => {
      const props = makeProps();
      render(<CircleOfTheLandSpellsModal {...props} />);

      fireEvent.click(document.querySelector('.cotl-overlay'));
      expect(props.onClose).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('detaches the Escape listener after unmount', async () => {
      const props = makeProps();
      const { unmount } = render(<CircleOfTheLandSpellsModal {...props} />);

      unmount();
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => expect(props.onClose).not.toHaveBeenCalled());
    });
  });

  describe('log rejection lane', () => {
    let errorSpy;

    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it('logs to console and still applies the selection when addEntry rejects', async () => {
      const failure = new Error('log unavailable');
      addEntry.mockRejectedValueOnce(failure);
      const props = makeProps();
      render(<CircleOfTheLandSpellsModal {...props} />);

      fireEvent.click(landButton('Polar'));

      expect(setRuntimeValue).toHaveBeenCalledWith('Eldara', '_circleOfTheLandType', 'Polar', 'test-campaign');
      expect(props.onClose).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('[circleOfTheLandSpellsModal:log-error]', failure));
    });
  });
});
