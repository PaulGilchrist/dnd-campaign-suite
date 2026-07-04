// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TravelPanel from './TravelPanel.jsx';

describe('TravelPanel', () => {
  let props;

  const mockPath = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 2, r: 0 },
  ];

  const defaultProps = {
    travelPace: 'normal',
    path: mockPath,
    pathIndex: 0,
    accruedCost: 5,
    dailyBudget: 10,
    dayExhausted: false,
    lastMessage: null,
    hexesRemaining: 3,
    isTravelActive: true,
    pendingEvent: null,
    terrain: {},
    eventFrequency: 'none',
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
  };

  beforeEach(() => {
    props = { ...defaultProps };
  });

  describe('rendering', () => {
    it('should return null when travel is not active', () => {
      const { container } = render(<TravelPanel {...props} isTravelActive={false} />);
      expect(container.innerHTML).toBe('');
    });

    it('should render travel panel title', () => {
      render(<TravelPanel {...props} />);
      expect(screen.getByText('Travel Mode')).toBeInTheDocument();
    });

    it('should render close and cancel buttons', () => {
      render(<TravelPanel {...props} />);
      expect(screen.getByTitle('Cancel travel')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render remaining hexes stat', () => {
      render(<TravelPanel {...props} hexesRemaining={5} />);
      expect(screen.getByText('5 hexes')).toBeInTheDocument();
    });

    it('should render budget remaining', () => {
      render(<TravelPanel {...props} accruedCost={3} dailyBudget={10} />);
      expect(screen.getByText('7.0 left')).toBeInTheDocument();
    });

    it('should show "Arrived" when path is fully traversed', () => {
      render(<TravelPanel {...props} pathIndex={mockPath.length} />);
      expect(screen.getByText('Arrived')).toBeInTheDocument();
    });

    it('should render last message when provided', () => {
      render(<TravelPanel {...props} lastMessage="Traveling through the forest" />);
      expect(screen.getByText('Traveling through the forest')).toBeInTheDocument();
    });

    it('should not render last message when null', () => {
      render(<TravelPanel {...props} lastMessage={null} />);
      expect(screen.queryByText('Traveling through the forest')).not.toBeInTheDocument();
    });
  });

  describe('budget bar', () => {
    it('should render budget bar with correct percentage', () => {
      const { container } = render(<TravelPanel {...props} accruedCost={5} dailyBudget={10} />);
      const bar = container.querySelector('.travel-budget-fill');
      expect(bar.style.width).toBe('50%');
    });

    it('should cap budget bar at 100%', () => {
      const { container } = render(<TravelPanel {...props} accruedCost={15} dailyBudget={10} />);
      const bar = container.querySelector('.travel-budget-fill');
      expect(bar.style.width).toBe('100%');
    });

    it('should show budget text with accrued cost', () => {
      render(<TravelPanel {...props} accruedCost={7.5} dailyBudget={10} />);
      expect(screen.getByText('7.5 / 10')).toBeInTheDocument();
    });
  });

  describe('day exhausted state', () => {
    it('should render exhausted message, camp button, and forced march button when dayExhausted', () => {
      render(<TravelPanel {...props} dayExhausted={true} />);
      expect(screen.getByText('Travel budget exhausted — camp or forced march?')).toBeInTheDocument();
      expect(screen.getByText('Camp')).toBeInTheDocument();
      expect(screen.getByText('Forced March')).toBeInTheDocument();
    });

    it('should disable forced march button when party has max exhaustion', () => {
      render(<TravelPanel {...props} dayExhausted={true} partyHasMaxExhaustion={true} />);
      const forcedMarchBtn = screen.getByText('Forced March');
      expect(forcedMarchBtn).toBeDisabled();
    });

    it('should not render exhausted section when dayExhausted is false', () => {
      render(<TravelPanel {...props} dayExhausted={false} />);
      expect(screen.queryByText('Travel budget exhausted')).not.toBeInTheDocument();
      expect(screen.queryByText('Camp')).not.toBeInTheDocument();
      expect(screen.queryByText('Forced March')).not.toBeInTheDocument();
    });
  });

  describe('forced march display', () => {
    it('should render forced march exhaustion info when forcedMarchHours > 0', () => {
      render(<TravelPanel {...props} forcedMarchHours={3} exhaustionMultiplier={83} />);
      expect(screen.getByText('Forced March')).toBeInTheDocument();
      expect(screen.getByText('3 / 6 stacks')).toBeInTheDocument();
      expect(screen.getByText('Speed: 83%')).toBeInTheDocument();
    });

    it('should not render forced march exhaustion when forcedMarchHours is 0', () => {
      render(<TravelPanel {...props} forcedMarchHours={0} />);
      expect(screen.queryByText('3 / 6 stacks')).not.toBeInTheDocument();
    });
  });

  describe('weather section', () => {
    it('should render weather details when provided', () => {
      render(<TravelPanel {...props} weather={{ icon: 'cloud-sun', label: 'Partly Cloudy', description: 'Mostly clear skies' }} />);
      expect(screen.getByText('Weather:')).toBeInTheDocument();
      expect(screen.getByText('Partly Cloudy')).toBeInTheDocument();
      expect(screen.getByText('Mostly clear skies')).toBeInTheDocument();
    });

    it('should render weather re-roll button when weather is present', () => {
      render(<TravelPanel {...props} weather={{ icon: 'sun', label: 'Sunny', description: 'Clear skies' }} />);
      expect(screen.getByTitle('Re-roll weather')).toBeInTheDocument();
    });

    it('should not render weather section when weather is null', () => {
      render(<TravelPanel {...props} weather={null} />);
      expect(screen.queryByText('Weather:')).not.toBeInTheDocument();
    });
  });

  describe('event frequency buttons', () => {
    it('should render event frequency buttons for all frequencies', () => {
      const { container } = render(<TravelPanel {...props} />);
      const freqContainer = container.querySelector('.travel-panel-frequency');
      const buttons = freqContainer.querySelectorAll('button');
      expect(buttons[0].textContent).toBe('None');
      expect(buttons[1].textContent).toBe('Sparse');
      expect(buttons[2].textContent).toBe('Normal');
      expect(buttons[3].textContent).toBe('Frequent');
    });

    it('should highlight active frequency button', () => {
      const { container } = render(<TravelPanel {...props} eventFrequency='sparse' />);
      const freqContainer = container.querySelector('.travel-panel-frequency');
      const buttons = freqContainer.querySelectorAll('button');
      expect(buttons[1].classList.contains('active')).toBe(true);
      expect(buttons[2].classList.contains('active')).toBe(false);
    });

    it('should call onSetEventFrequency when frequency button clicked', () => {
      const { container } = render(<TravelPanel {...props} eventFrequency='sparse' />);
      const freqContainer = container.querySelector('.travel-panel-frequency');
      const buttons = freqContainer.querySelectorAll('button');
      fireEvent.click(buttons[3]);
      expect(props.onSetEventFrequency).toHaveBeenCalledWith('frequent');
    });
  });

  describe('pace buttons', () => {
    it('should render all three pace options', () => {
      const { container } = render(<TravelPanel {...props} />);
      const paceContainer = container.querySelector('.travel-panel-pace');
      const buttons = paceContainer.querySelectorAll('button');
      expect(buttons[0].textContent).toBe('Slow');
      expect(buttons[1].textContent).toBe('Normal');
      expect(buttons[2].textContent).toBe('Fast');
    });

    it('should highlight active pace button', () => {
      const { container } = render(<TravelPanel {...props} travelPace='slow' />);
      const paceContainer = container.querySelector('.travel-panel-pace');
      const buttons = paceContainer.querySelectorAll('button');
      expect(buttons[0].classList.contains('active')).toBe(true);
      expect(buttons[1].classList.contains('active')).toBe(false);
    });

    it('should call onChangePace when pace button clicked', () => {
      const { container } = render(<TravelPanel {...props} travelPace='normal' />);
      const paceContainer = container.querySelector('.travel-panel-pace');
      const buttons = paceContainer.querySelectorAll('button');
      fireEvent.click(buttons[2]);
      expect(props.onChangePace).toHaveBeenCalledWith('fast');
    });
  });

  describe('horseback toggle', () => {
    it('should show correct mount label based on horseback state', () => {
      render(<TravelPanel {...props} horseback={false} />);
      expect(screen.getByText('Walking')).toBeInTheDocument();

      render(<TravelPanel {...props} horseback={true} />);
      expect(screen.getByText('Horseback')).toBeInTheDocument();
    });

    it('should have active class when horseback is true', () => {
      render(<TravelPanel {...props} horseback={true} />);
      const btn = screen.getByRole('button', { name: /horseback/i });
      expect(btn).toHaveClass('active');
    });

    it('should call onToggleHorseback when clicked', () => {
      render(<TravelPanel {...props} horseback={false} />);
      const btn = screen.getByRole('button', { name: /walking/i });
      fireEvent.click(btn);
      expect(props.onToggleHorseback).toHaveBeenCalled();
    });
  });

  describe('advance button disabled states', () => {
    it('should be disabled when dayExhausted', () => {
      render(<TravelPanel {...props} dayExhausted={true} />);
      expect(screen.getByText('Advance One Hex')).toBeDisabled();
    });

    it('should be disabled when at end of path', () => {
      render(<TravelPanel {...props} pathIndex={mockPath.length} />);
      expect(screen.getByText('Arrived')).toBeDisabled();
    });

    it('should be disabled when pendingEvent exists', () => {
      render(<TravelPanel {...props} pendingEvent={{ title: 'Ambush' }} />);
      expect(screen.getByText('Advance One Hex')).toBeDisabled();
    });

    it('should be disabled when party has max exhaustion', () => {
      render(<TravelPanel {...props} partyHasMaxExhaustion={true} />);
      expect(screen.getByText('Advance One Hex')).toBeDisabled();
    });

    it('should be enabled when all conditions are clear', () => {
      render(<TravelPanel {...props} />);
      expect(screen.getByText('Advance One Hex')).not.toBeDisabled();
    });
  });

  describe('click handlers', () => {
    it('should call onCancel when close button or cancel button clicked', () => {
      render(<TravelPanel {...props} />);
      fireEvent.click(screen.getByTitle('Cancel travel'));
      expect(props.onCancel).toHaveBeenCalledTimes(1);

      props.onCancel.mockClear();
      fireEvent.click(screen.getByText('Cancel'));
      expect(props.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onAdvance when advance button clicked', () => {
      render(<TravelPanel {...props} />);
      fireEvent.click(screen.getByText('Advance One Hex'));
      expect(props.onAdvance).toHaveBeenCalled();
    });

    it('should call onForceCamp when camp button clicked', () => {
      render(<TravelPanel {...props} dayExhausted={true} />);
      fireEvent.click(screen.getByText('Camp'));
      expect(props.onForceCamp).toHaveBeenCalled();
    });

    it('should call onForcedMarch when forced march button clicked', () => {
      render(<TravelPanel {...props} dayExhausted={true} />);
      fireEvent.click(screen.getByText('Forced March'));
      expect(props.onForcedMarch).toHaveBeenCalled();
    });

    it('should call onReRollWeather when re-roll button clicked', () => {
      render(<TravelPanel {...props} weather={{ icon: 'sun', label: 'Sunny', description: 'Clear' }} />);
      fireEvent.click(screen.getByTitle('Re-roll weather'));
      expect(props.onReRollWeather).toHaveBeenCalled();
    });
  });

  describe('draggable header', () => {
    it('should set cursor to grabbing on header pointer down', () => {
      const { container } = render(<TravelPanel {...props} />);
      const header = container.querySelector('.travel-panel-header');
      fireEvent.pointerDown(header, { clientX: 100, clientY: 100 });
      const panel = container.querySelector('.travel-panel');
      expect(panel.style.cursor).toBe('grabbing');
    });

    it('should move panel on pointer move', () => {
      const { container } = render(<TravelPanel {...props} />);
      const header = container.querySelector('.travel-panel-header');
      fireEvent.pointerDown(header, { clientX: 100, clientY: 100 });
      const panel = container.querySelector('.travel-panel');

      fireEvent.pointerMove(document, { clientX: 150, clientY: 120 });
      expect(panel.style.left).toBe('50px');
      expect(panel.style.top).toBe('20px');
      expect(panel.style.bottom).toBe('auto');
      expect(panel.style.transform).toBe('none');
    });

    it('should reset cursor on pointer up', () => {
      const { container } = render(<TravelPanel {...props} />);
      const header = container.querySelector('.travel-panel-header');
      fireEvent.pointerDown(header, { clientX: 100, clientY: 100 });
      const panel = container.querySelector('.travel-panel');

      fireEvent.pointerUp(document);
      expect(panel.style.cursor).toBe('');
    });

    it('should not start drag when clicking a button in header', () => {
      const { container } = render(<TravelPanel {...props} />);
      const header = container.querySelector('.travel-panel-header');
      const closeBtn = header.querySelector('button');

      fireEvent.pointerDown(closeBtn, { clientX: 100, clientY: 100, target: closeBtn });
      const panel = container.querySelector('.travel-panel');
      expect(panel.style.cursor).toBe('');
    });
  });

  describe('travel time display', () => {
    it('should render next hex travel time when terrain is provided', () => {
      const terrain = { '0,0': 'plains' };
      render(<TravelPanel {...props} terrain={terrain} />);
      expect(screen.getByText('1h 30m')).toBeInTheDocument();
    });

    it('should not render next hex when terrain lookup fails', () => {
      render(<TravelPanel {...props} terrain={{}} />);
      const statsContainer = screen.getByText('Remaining').closest('.travel-panel-stats');
      const statLabels = statsContainer.querySelectorAll('.travel-stat-label');
      const nextHexLabel = Array.from(statLabels).find(l => l.textContent === 'Next hex');
      expect(nextHexLabel).toBeInTheDocument();
    });

    it('should show different travel time for slow pace on plains', () => {
      const terrain = { '0,0': 'plains' };
      render(<TravelPanel {...props} travelPace='slow' terrain={terrain} />);
      expect(screen.getByText('2h 15m')).toBeInTheDocument();
    });

    it('should show different travel time for fast pace on plains', () => {
      const terrain = { '0,0': 'plains' };
      render(<TravelPanel {...props} travelPace='fast' terrain={terrain} />);
      expect(screen.getByText('1h 8m')).toBeInTheDocument();
    });

    it('should show different travel time for mountains', () => {
      const terrain = { '0,0': 'mountains' };
      render(<TravelPanel {...props} terrain={terrain} />);
      expect(screen.getByText('4h')).toBeInTheDocument();
    });

    it('should account for horseback speed multiplier', () => {
      const terrain = { '0,0': 'plains' };
      render(<TravelPanel {...props} terrain={terrain} horseback={true} />);
      expect(screen.getByText('45 min')).toBeInTheDocument();
    });
  });

  describe('CSS classes', () => {
    it('should have required CSS classes on all sections', () => {
      const { container } = render(<TravelPanel {...props} />);
      expect(container.querySelector('.travel-panel')).toBeInTheDocument();
      expect(container.querySelector('.travel-panel-header')).toBeInTheDocument();
      expect(container.querySelector('.travel-panel-frequency')).toBeInTheDocument();
      expect(container.querySelector('.travel-panel-pace')).toBeInTheDocument();
      expect(container.querySelector('.travel-panel-horseback')).toBeInTheDocument();
      expect(container.querySelector('.travel-panel-stats')).toBeInTheDocument();
      expect(container.querySelector('.travel-panel-controls')).toBeInTheDocument();
      expect(container.querySelector('.travel-panel-budget-bar')).toBeInTheDocument();
    });

    it('should have conditional CSS classes when features are active', () => {
      const { container } = render(<TravelPanel {...props} dayExhausted={true} weather={{ icon: 'sun', label: 'Sunny', description: 'Clear' }} />);
      expect(container.querySelector('.travel-panel-exhausted')).toBeInTheDocument();
      expect(container.querySelector('.travel-panel-weather')).toBeInTheDocument();
    });
  });
});
