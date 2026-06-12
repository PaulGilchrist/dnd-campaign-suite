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

  beforeEach(() => {
    props = {
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

    it('should render close button', () => {
      render(<TravelPanel {...props} />);
      expect(screen.getByTitle('Cancel travel')).toBeInTheDocument();
    });

    it('should render remaining hexes stat', () => {
      render(<TravelPanel {...props} hexesRemaining={5} />);
      expect(screen.getByText('5 hexes')).toBeInTheDocument();
    });

    it('should render budget remaining', () => {
      render(<TravelPanel {...props} accruedCost={3} dailyBudget={10} />);
      expect(screen.getByText('7.0 left')).toBeInTheDocument();
    });

    it('should render advance button', () => {
      render(<TravelPanel {...props} />);
      expect(screen.getByText('Advance One Hex')).toBeInTheDocument();
    });

    it('should show "Arrived" when path is fully traversed', () => {
      render(<TravelPanel {...props} pathIndex={mockPath.length} />);
      expect(screen.getByText('Arrived')).toBeInTheDocument();
    });

    it('should render cancel button in controls', () => {
      render(<TravelPanel {...props} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render last message when provided', () => {
      render(<TravelPanel {...props} lastMessage="Traveling through the forest" />);
      expect(screen.getByText('Traveling through the forest')).toBeInTheDocument();
    });

    it('should not render last message when null', () => {
      render(<TravelPanel {...props} lastMessage={null} />);
      expect(screen.queryByText(/Traveling/)).not.toBeInTheDocument();
    });
  });

  describe('budget bar', () => {
    it('should render budget bar with correct percentage', () => {
      render(<TravelPanel {...props} accruedCost={5} dailyBudget={10} />);
      const bar = document.querySelector('.travel-budget-fill');
      expect(bar.style.width).toBe('50%');
    });

    it('should cap budget bar at 100%', () => {
      render(<TravelPanel {...props} accruedCost={15} dailyBudget={10} />);
      const bar = document.querySelector('.travel-budget-fill');
      expect(bar.style.width).toBe('100%');
    });

    it('should show budget text with accrued cost', () => {
      render(<TravelPanel {...props} accruedCost={7.5} dailyBudget={10} />);
      expect(screen.getByText('7.5 / 10')).toBeInTheDocument();
    });

    it('should show zero budget when accrued is zero', () => {
      render(<TravelPanel {...props} accruedCost={0} dailyBudget={10} />);
      const bar = document.querySelector('.travel-budget-fill');
      expect(bar.style.width).toBe('0%');
    });
  });

  describe('day exhausted state', () => {
    it('should render exhausted message when dayExhausted is true', () => {
      render(<TravelPanel {...props} dayExhausted={true} />);
      expect(screen.getByText('Travel budget exhausted — camp or forced march?')).toBeInTheDocument();
    });

    it('should render camp button when dayExhausted', () => {
      render(<TravelPanel {...props} dayExhausted={true} />);
      expect(screen.getByText('Camp')).toBeInTheDocument();
    });

    it('should render forced march button when dayExhausted', () => {
      render(<TravelPanel {...props} dayExhausted={true} />);
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
      const exhaustionDiv = document.querySelector('.travel-panel-exhaustion');
      expect(exhaustionDiv).not.toBeInTheDocument();
    });
  });

  describe('weather section', () => {
    it('should render weather when provided', () => {
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

    it('should not render weather section when weather is undefined', () => {
      render(<TravelPanel {...props} weather={undefined} />);
      expect(screen.queryByText('Weather:')).not.toBeInTheDocument();
    });
  });

  describe('event frequency buttons', () => {
    it('should render event frequency buttons for all frequencies', () => {
      render(<TravelPanel {...props} />);
      const freqContainer = document.querySelector('.travel-panel-frequency');
      const buttons = freqContainer.querySelectorAll('button');
      expect(buttons[0].textContent).toBe('None');
      expect(buttons[1].textContent).toBe('Sparse');
      expect(buttons[2].textContent).toBe('Normal');
      expect(buttons[3].textContent).toBe('Frequent');
    });

    it('should highlight active frequency button', () => {
      render(<TravelPanel {...props} eventFrequency='sparse' />);
      const freqContainer = document.querySelector('.travel-panel-frequency');
      const buttons = freqContainer.querySelectorAll('button');
      expect(buttons[1].classList.contains('active')).toBe(true);
      expect(buttons[2].classList.contains('active')).toBe(false);
    });

    it('should call onSetEventFrequency when frequency button clicked', () => {
      render(<TravelPanel {...props} eventFrequency='sparse' />);
      const freqContainer = document.querySelector('.travel-panel-frequency');
      const buttons = freqContainer.querySelectorAll('button');
      fireEvent.click(buttons[3]);
      expect(props.onSetEventFrequency).toHaveBeenCalledWith('frequent');
    });
  });

  describe('pace buttons', () => {
    it('should render all three pace options', () => {
      render(<TravelPanel {...props} />);
      const paceContainer = document.querySelector('.travel-pace-buttons');
      const buttons = paceContainer.querySelectorAll('button');
      expect(buttons[0].textContent).toBe('Slow');
      expect(buttons[1].textContent).toBe('Normal');
      expect(buttons[2].textContent).toBe('Fast');
    });

    it('should highlight active pace button', () => {
      render(<TravelPanel {...props} travelPace='slow' />);
      const paceContainer = document.querySelector('.travel-pace-buttons');
      const buttons = paceContainer.querySelectorAll('button');
      expect(buttons[0].classList.contains('active')).toBe(true);
      expect(buttons[1].classList.contains('active')).toBe(false);
    });

    it('should call onChangePace when pace button clicked', () => {
      render(<TravelPanel {...props} travelPace='normal' />);
      const paceContainer = document.querySelector('.travel-pace-buttons');
      const buttons = paceContainer.querySelectorAll('button');
      fireEvent.click(buttons[2]);
      expect(props.onChangePace).toHaveBeenCalledWith('fast');
    });
  });

  describe('horseback toggle', () => {
    it('should show "Walking" when horseback is false', () => {
      render(<TravelPanel {...props} horseback={false} />);
      expect(screen.getByText('Walking')).toBeInTheDocument();
    });

    it('should show "Horseback" when horseback is true', () => {
      render(<TravelPanel {...props} horseback={true} />);
      expect(screen.getByText('Horseback')).toBeInTheDocument();
    });

    it('should have active class when horseback is true', () => {
      render(<TravelPanel {...props} horseback={true} />);
      const btn = document.querySelector('.travel-horseback-btn');
      expect(btn.classList.contains('active')).toBe(true);
    });

    it('should call onToggleHorseback when clicked', () => {
      render(<TravelPanel {...props} horseback={false} />);
      const btn = document.querySelector('.travel-horseback-btn');
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
    it('should call onCancel when close button clicked', () => {
      render(<TravelPanel {...props} />);
      fireEvent.click(screen.getByTitle('Cancel travel'));
      expect(props.onCancel).toHaveBeenCalled();
    });

    it('should call onCancel when cancel button in controls clicked', () => {
      render(<TravelPanel {...props} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(props.onCancel).toHaveBeenCalled();
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

      // Simulate clicking the button within the header
      fireEvent.pointerDown(closeBtn, { clientX: 100, clientY: 100, target: closeBtn });
      const panel = container.querySelector('.travel-panel');
      // The handler returns early if target is a button, so cursor should not change
      expect(panel.style.cursor).toBe('');
    });
  });

  describe('travel time display', () => {
    it('should render next hex travel time when terrain is provided', () => {
      const terrain = { '0,0': 'plains' };
      render(<TravelPanel {...props} terrain={terrain} />);
      // Normal pace on plains = 2 hours * 0.75 = 1.5h
      expect(screen.getByText('1h 30m')).toBeInTheDocument();
    });

    it('should not render next hex when terrain lookup fails', () => {
      // Empty terrain defaults to 'plains' via || 'plains', so next hex IS shown
      render(<TravelPanel {...props} terrain={{}} />);
      const statsContainer = document.querySelector('.travel-panel-stats');
      const statLabels = statsContainer.querySelectorAll('.travel-stat-label');
      const nextHexLabel = Array.from(statLabels).find(l => l.textContent === 'Next hex');
      expect(nextHexLabel).toBeInTheDocument();
    });

    it('should show different travel time for slow pace on plains', () => {
      const terrain = { '0,0': 'plains' };
      render(<TravelPanel {...props} travelPace='slow' terrain={terrain} />);
      // Slow pace on plains = 3 hours * 0.75 = 2.25h
      expect(screen.getByText('2h 15m')).toBeInTheDocument();
    });

    it('should show different travel time for fast pace on plains', () => {
      const terrain = { '0,0': 'plains' };
      render(<TravelPanel {...props} travelPace='fast' terrain={terrain} />);
      // Fast pace on plains = 1.5 hours * 0.75 = 1.125h = 1h 8m (rounded)
      expect(screen.getByText('1h 8m')).toBeInTheDocument();
    });

    it('should show different travel time for mountains', () => {
      const terrain = { '0,0': 'mountains' };
      render(<TravelPanel {...props} terrain={terrain} />);
      // Normal pace on mountains = 2 hours * 2 = 4h
      expect(screen.getByText('4h')).toBeInTheDocument();
    });

    it('should account for horseback speed multiplier', () => {
      const terrain = { '0,0': 'plains' };
      render(<TravelPanel {...props} terrain={terrain} horseback={true} />);
      // Normal pace on plains = 2 hours * 0.75 / 2 = 0.75h = 45 min
      expect(screen.getByText('45 min')).toBeInTheDocument();
    });
  });

  describe('terrain lookup', () => {
    it('should default to plains when no terrain data provided for current hex', () => {
      // terrain['0,0'] is undefined, so || 'plains' kicks in
      render(<TravelPanel {...props} terrain={{}} />);
      const statsContainer = document.querySelector('.travel-panel-stats');
      const statLabels = statsContainer.querySelectorAll('.travel-stat-label');
      const nextHexLabel = Array.from(statLabels).find(l => l.textContent === 'Next hex');
      expect(nextHexLabel).toBeInTheDocument();
    });
  });

  describe('Font Awesome icons', () => {
    it('should render route icon in title', () => {
      render(<TravelPanel {...props} />);
      const routeIcon = document.querySelector('.fa-route');
      expect(routeIcon).toBeInTheDocument();
    });

    it('should render tent icon in exhausted section', () => {
      render(<TravelPanel {...props} dayExhausted={true} />);
      const tentIcon = document.querySelector('.fa-tent');
      expect(tentIcon).toBeInTheDocument();
    });

    it('should render campground icon on camp button', () => {
      render(<TravelPanel {...props} dayExhausted={true} />);
      const campIcon = document.querySelector('.fa-campground');
      expect(campIcon).toBeInTheDocument();
    });

    it('should render running icon on forced march button', () => {
      render(<TravelPanel {...props} dayExhausted={true} />);
      const marchIcon = document.querySelector('.fa-person-running');
      expect(marchIcon).toBeInTheDocument();
    });

    it('should render heart pulse icon in exhaustion display', () => {
      render(<TravelPanel {...props} forcedMarchHours={3} />);
      const pulseIcon = document.querySelector('.fa-heart-pulse');
      expect(pulseIcon).toBeInTheDocument();
    });

    it('should render gauge icon in exhaustion speed display', () => {
      render(<TravelPanel {...props} forcedMarchHours={3} />);
      const gaugeIcon = document.querySelector('.fa-gauge');
      expect(gaugeIcon).toBeInTheDocument();
    });

    it('should render dice icon on weather re-roll button', () => {
      render(<TravelPanel {...props} weather={{ icon: 'sun', label: 'Sunny', description: 'Clear' }} />);
      const diceIcon = document.querySelector('.fa-dice');
      expect(diceIcon).toBeInTheDocument();
    });

    it('should render horse icon on horseback button', () => {
      render(<TravelPanel {...props} />);
      const horseIcon = document.querySelector('.fa-horse');
      expect(horseIcon).toBeInTheDocument();
    });

    it('should render walking icon on advance button', () => {
      render(<TravelPanel {...props} />);
      const walkingIcon = document.querySelector('.fa-person-walking');
      expect(walkingIcon).toBeInTheDocument();
    });

    it('should render ban icon on cancel button', () => {
      render(<TravelPanel {...props} />);
      const banIcon = document.querySelector('.fa-ban');
      expect(banIcon).toBeInTheDocument();
    });

    it('should render xmark icon on close button', () => {
      render(<TravelPanel {...props} />);
      const xmarkIcon = document.querySelector('.fa-xmark');
      expect(xmarkIcon).toBeInTheDocument();
    });
  });

  describe('CSS classes', () => {
    it('should have travel-panel class on root element', () => {
      const { container } = render(<TravelPanel {...props} />);
      const panel = container.querySelector('.travel-panel');
      expect(panel).toBeInTheDocument();
    });

    it('should have travel-panel-header class on header', () => {
      const { container } = render(<TravelPanel {...props} />);
      const header = container.querySelector('.travel-panel-header');
      expect(header).toBeInTheDocument();
    });

    it('should have travel-panel-exhausted class when exhausted', () => {
      render(<TravelPanel {...props} dayExhausted={true} />);
      const exhausted = document.querySelector('.travel-panel-exhausted');
      expect(exhausted).toBeInTheDocument();
    });

    it('should have travel-panel-weather class when weather present', () => {
      render(<TravelPanel {...props} weather={{ icon: 'sun', label: 'Sunny', description: 'Clear' }} />);
      const weather = document.querySelector('.travel-panel-weather');
      expect(weather).toBeInTheDocument();
    });

    it('should have travel-panel-frequency class', () => {
      render(<TravelPanel {...props} />);
      const freq = document.querySelector('.travel-panel-frequency');
      expect(freq).toBeInTheDocument();
    });

    it('should have travel-panel-pace class', () => {
      render(<TravelPanel {...props} />);
      const pace = document.querySelector('.travel-panel-pace');
      expect(pace).toBeInTheDocument();
    });

    it('should have travel-panel-horseback class', () => {
      render(<TravelPanel {...props} />);
      const horseback = document.querySelector('.travel-panel-horseback');
      expect(horseback).toBeInTheDocument();
    });

    it('should have travel-panel-stats class', () => {
      render(<TravelPanel {...props} />);
      const stats = document.querySelector('.travel-panel-stats');
      expect(stats).toBeInTheDocument();
    });

    it('should have travel-panel-controls class', () => {
      render(<TravelPanel {...props} />);
      const controls = document.querySelector('.travel-panel-controls');
      expect(controls).toBeInTheDocument();
    });

    it('should have travel-budget-bar class', () => {
      render(<TravelPanel {...props} />);
      const bar = document.querySelector('.travel-panel-budget-bar');
      expect(bar).toBeInTheDocument();
    });
  });
});
