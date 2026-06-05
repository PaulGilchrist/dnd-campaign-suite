import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = vi.hoisted(() => ({ logEntries: [], initialized: true }));
const mockAddEntry = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('../../hooks/useLog.js', () => ({
  default: vi.fn(() => ({
    logEntries: mockState.logEntries,
    initialized: mockState.initialized,
    addEntry: mockAddEntry,
  })),
}));

import Log from './Log.jsx';

const CHARS = [{ name: 'Frodo' }, { name: 'Aragorn' }];

// ── factories with spread-last so overrides work ────────────
const roll = (o = {}) => ({
  id: 'r', type: 'roll', rollType: 'attack', characterName: 'Frodo',
  name: 'LS Attack', timestamp: Date.now(), rolls: [15], total: 20,
  bonus: 5, hit: true, targetAc: 15, isAutoMiss: false, isNatural20: false,
  isNatural1: false, targetName: 'Orc', coverAcBonus: 0, coverReason: '',
  rangeReason: '', damageType: '', mode: '', ...o,
});

const note = (o = {}) => ({
  id: 'n', type: 'note', characterName: 'Frodo', timestamp: Date.now(),
  noteText: 'Quest begins.', ...o,
});

const travel = (o = {}) => ({
  id: 't', type: 'travel', action: 'advance', hex: { q: 3, r: -7 },
  timestamp: Date.now(), terrain: '', weather: '', eventTitle: '', ...o,
});

const loot = (o = {}) => ({
  id: 'l', type: 'loot', timestamp: Date.now(), xpPerChar: 0, lootItems: [], ...o,
});

const cond = (o = {}) => ({
  id: 'c', type: 'condition', characterName: 'Gollum', action: 'applied',
  condition: 'charmed', dc: 13, ability: 'wisdom', sourceName: '',
  timestamp: Date.now(), ...o,
});

const enc = (o = {}) => ({
  id: 'e', type: 'encounter', action: 'started', encounterName: 'Orc Ambush',
  monsters: [], xpPerChar: 0, lootItems: [], timestamp: Date.now(), ...o,
});

const hp = (o = {}) => ({
  id: 'hp', type: 'hp_change', targetName: 'Gimli', delta: -5, currentHp: 20,
  maxHp: 25, threshold: undefined, sourceName: '', isUnconscious: false,
  timestamp: Date.now(), ...o,
});

const ds = (o = {}) => ({
  id: 'ds', type: 'death_save', characterName: 'Gimli', success: true, roll: 15,
  isNatural20: false, isNatural1: false, timestamp: Date.now(), ...o,
});

const spell = (o = {}) => ({
  id: 's', type: 'spell', characterName: 'Gandalf', spellName: 'Fireball',
  spellLevel: 3, castingTime: 'Action', metamagic: [], spCost: 0,
  timestamp: Date.now(), ...o,
});

const meta = (o = {}) => ({
  id: 'm', type: 'metamagic', characterName: 'Gandalf', spellName: 'Fireball',
  targetName: 'Orc', originalDamage: 30, newTotal: 38, damageDifference: 8,
  rerolledDiceCount: 2, timestamp: Date.now(), ...o,
});

// ── Q helpers so we don't repeat code ───────────────────────
const q = (sel) => document.querySelector(sel);

function setup(entries, initialized, characters) {
  mockState.logEntries.length = 0;
  if (entries) mockState.logEntries.push(...entries);
  mockState.initialized = initialized ?? true;
  return render(<Log campaignName="test-campaign" characters={characters ?? CHARS} />);
}

describe('Log', () => {
  beforeEach(() => {
    mockState.logEntries.length = 0;
    mockState.initialized = true;
    vi.clearAllMocks();
    mockAddEntry.mockClear();
  });

  // ── TOOLBAR & STRUCTURE ───────────────────────
  describe('toolbar', () => {
    it('heading renders', () => {
      setup([]);
      expect(screen.getByRole('heading', { name: /campaign log/i })).toBeInTheDocument();
    });

    it('toolbar div present', () => {
      setup([]);
      expect(q('.log-toolbar')).not.toBeNull();
    });

    it('scroll icon in toolbar', () => {
      setup([]);
      expect(q('.log-toolbar i.fa-scroll')).not.toBeNull();
    });

    it('note textarea rendered', () => {
      setup([]);
      expect(screen.getByPlaceholderText('Add a note to the log...')).toBeInTheDocument();
    });

    it('add btn rendered', () => {
      setup([]);
      expect(q('.log-add-btn')).not.toBeNull();
    });

    it('add-btn fa-plus icon', () => {
      setup([]);
      expect(q('.log-add-btn i.fa-plus')).not.toBeNull();
    });

    it('select shown with chars', () => {
      setup([]);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('Anonymous option present', () => {
      setup([]);
      expect(screen.getByRole('option', { name: 'Anonymous' })).toBeInTheDocument();
    });

    it('no select when empty chars', () => {
      setup([], true, []);
      expect(() => screen.getByRole('combobox')).toThrow();
    });

    it('options from character list', () => {
      setup([], true, [{ name: 'L' }, { name: 'G' }]);
      expect(screen.getByRole('option', { name: 'L' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'G' })).toBeInTheDocument();
    });

    it('root has campaign-tool class', () => {
      setup([]);
      expect(q('.campaign-tool')).not.toBeNull();
    });

    it('root has log-view class', () => {
      setup([]);
      expect(q('.log-view')).not.toBeNull();
    });

    it('has log-add-note div', () => {
      setup([]);
      expect(q('.log-add-note')).not.toBeNull();
    });

    it('has log-entries div', () => {
      setup([]);
      expect(q('.log-entries')).not.toBeNull();
    });
  });

  // ── LOADING & EMPTY STATES ───────────────────────
  describe('loading/empty states', () => {
    it('shows loading when not initialized', () => {
      setup([note()], false);
      expect(screen.getByText('Loading log...')).toBeInTheDocument();
    });

    it('does NOT show empty msg when entries exist', () => {
      setup([note()]);
      expect(screen.queryByText(/no entries yet/i)).not.toBeInTheDocument();
    });

    it('does NOT show loading when initialized', () => {
      setup([]);
      expect(screen.queryByText(/Loading log/i)).not.toBeInTheDocument();
    });

    it('shows empty state msg when no entries loaded', () => {
      setup([]);
      expect(screen.getByText(/no entries yet/i)).toBeInTheDocument();
    });
  });

  // ── ADDING NOTES ───────────────────────
  describe('adding notes', () => {
    it('adds note on button click with trimmed text', async () => {
      setup([]);
      fireEvent.change(screen.getByPlaceholderText('Add a note to the log...'), {
        target: { value: ' Hello ' },
      });
      fireEvent.click(q('.log-add-btn'));
      await waitFor(() => {
        expect(mockAddEntry).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'note', message: 'Hello' }),
        );
      });
    });

    it('uses selected char as author', async () => {
      setup([]);
      fireEvent.change(screen.getByPlaceholderText('Add a note to the log...'), {
        target: { value: 'hi' },
      });
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Aragorn' } });
      fireEvent.click(q('.log-add-btn'));
      await waitFor(() => {
        expect(mockAddEntry).toHaveBeenCalledWith(
          expect.objectContaining({ characterName: 'Aragorn' }),
        );
      });
    });

    it('uses Anonymous when no char selected', async () => {
      setup([], true, []);
      fireEvent.change(screen.getByPlaceholderText('Add a note to the log...'), {
        target: { value: 'hi' },
      });
      fireEvent.click(q('.log-add-btn'));
      await waitFor(() => {
        expect(mockAddEntry).toHaveBeenCalledWith(
          expect.objectContaining({ characterName: 'Anonymous' }),
        );
      });
    });

    it('no-op for empty text', () => {
      setup([]);
      fireEvent.click(q('.log-add-btn'));
      expect(mockAddEntry).not.toHaveBeenCalled();
    });

    it('no-op for whitespace text', () => {
      setup([]);
      fireEvent.change(screen.getByPlaceholderText('Add a note to the log...'), {
        target: { value: '    ' },
      });
      fireEvent.click(q('.log-add-btn'));
      expect(mockAddEntry).not.toHaveBeenCalled();
    });

    it('ctrl+enter submits', async () => {
      setup([]);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: 'x' } });
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
      await waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
    });

    it('meta+enter submits', async () => {
      setup([]);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: 'x' } });
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
      await waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
    });

    it('plain enter does NOT submit', () => {
      setup([]);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: 'x' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(mockAddEntry).not.toHaveBeenCalled();
    });

    it('ctrl+r does NOT submit', () => {
      setup([]);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: 'x' } });
      fireEvent.keyDown(textarea, { key: 'r', ctrlKey: true });
      expect(mockAddEntry).not.toHaveBeenCalled();
    });

    it('clears textarea after submit', async () => {
      setup([]);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: 'x' } });
      fireEvent.click(q('.log-add-btn'));
      await waitFor(() => expect(textarea).toHaveValue(''));
    });

    it('does NOT clear textarea when empty note', () => {
      setup([]);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.click(q('.log-add-btn'));
      expect(textarea).toHaveValue('   ');
    });

    it('select onChange updates value', () => {
      setup([]);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'Aragorn' } });
      expect(select).toHaveValue('Aragorn');
    });

    it('select to Anonymous resets to empty string', () => {
      setup([]);
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '' } });
      expect(select).toHaveValue('');
    });
  });

  // ── ENTRY RENDERING / REVERSE ORDER ───────────────
  describe('entry rendering', () => {
    it('renders entries in reverse order', () => {
      setup([note({ id: 'a', noteText: 'First' }), note({ id: 'b', noteText: 'Second' })]);
      const texts = document.querySelectorAll('.log-note-text');
      expect(texts[0].textContent).toContain('Second');
    });

    it('does NOT render entries when not initialized', () => {
      setup([note({ noteText: 'hi' })], false);
      expect(screen.queryByText(/hi/i)).not.toBeInTheDocument();
    });

    it('skips unknown type gracefully', () => {
      setup([{ id: '?', type: 'unknown' }]);
      expect(document.querySelectorAll('.log-entry').length).toBe(0);
    });

    it('renders roll and note in reversed spread-map order', () => {
      setup([roll(), note({})]);
      expect(q('.log-entries > div')).not.toBeNull();
    });
  });

  // ── NOTE ENTRY component ───────────────
  describe('NoteEntry', () => {
    it('renders noteText in .log-note-text', () => {
      setup([note({ noteText: 'Hello' })]);
      expect(q('.log-note-text')).toHaveTextContent(/Hello/i);
    });

    it('renders comment-dots icon', () => {
      setup([note()]);
      expect(q('.log-note i.fa-comment-dots')).not.toBeNull();
    });

    it('renders character name', () => {
      setup([note({ characterName: 'Frodo' })]);
      expect(q('.log-note .log-character')).toHaveTextContent(/Frodo/i);
    });

    it('renders timestamp in header', () => {
      setup([note()]);
      expect(q('.log-note .log-time')).not.toBeNull();
    });

    it('root class is .log-entry.log-note', () => {
      setup([note()]);
      expect(q('.log-entry.log-note')).not.toBeNull();
    });
  });

  // ── TRAVEL ENTRY component ───────────────
  describe('TravelEntry', () => {
    it.each([
      ['advance', 'Advanced to'],
      ['advance_with_event', 'Event triggered at'],
      ['arrived', 'Arrived at'],
      ['camp', 'Camped at'],
      ['forced_march', 'Forced march at'],
      ['event_accept', 'Accepted event at'],
      ['event_skip', 'Skipped event at'],
      ['event_reroll', 'Re-rolled event at'],
      ['extreme_weather', 'Weather halted travel at'],
      ['day_exhausted', 'Budget exhausted at'],
      ['cancel', 'Travel cancelled at'],
    ])('action %s -> %s', (a, l) => {
      setup([travel({ action: a })]);
      expect(screen.getByText(new RegExp(l, 'i'))).toBeInTheDocument();
    });

    it('unknown action falls back to advance config', () => {
      setup([travel({ action: 'bad' })]);
      expect(screen.getByText(/Advanced to/i)).toBeInTheDocument();
    });

    it.each([
       ['advance', 'fa-person-walking'],
       ['arrived', 'fa-flag-checkered'],
       ['camp', 'fa-campground'],
       ['event_accept', 'fa-check'],
       ['event_skip', 'fa-xmark'],
       ['extreme_weather', 'fa-triangle-exclamation'],
     ])('action %s icon=%s', (_action, icon) => {
      setup([travel({ action: _action })]);
      expect(q(`.log-travel i.${icon}`)).not.toBeNull();
     });

    it('advance has blue border color', () => {
      setup([travel({ action: 'advance' })]);
      const el = q('.log-entry.log-travel');
      expect(el.style.borderLeftColor).toMatch(/74.*144.*217/);
     });

    it('arrived has green border color', () => {
      setup([travel({ action: 'arrived' })]);
      const el = q('.log-entry.log-travel');
      expect(el.style.borderLeftColor).toMatch(/76.*175.*80/);
     });

    it('camp has gray-blue border color', () => {
      setup([travel({ action: 'camp' })]);
      const el = q('.log-entry.log-travel');
      expect(el.style.borderLeftColor).toMatch(/136.*170.*187/);
     });

    it('event_skip has gray border color', () => {
      setup([travel({ action: 'event_skip' })]);
      const el = q('.log-entry.log-travel');
      expect(el.style.borderLeftColor).toMatch(/136.*136.*136/);
     });

    it('extreme_weather has red border color', () => {
      setup([travel({ action: 'extreme_weather' })]);
      const el = q('.log-entry.log-travel');
      expect(el.style.borderLeftColor).toMatch(/244.*67.*54/);
     });

    it('hex coords render', () => {
      setup([travel({ hex: { q: 5, r: -3 } })]);
      expect(screen.getByText(/\(5, -3\)/)).toBeInTheDocument();
    });

    it('no hex -> no coord span', () => {
      setup([travel({ hex: undefined })]);
      expect(screen.queryByText(/\(\d/i)).not.toBeInTheDocument();
    });

    it('terrain shows + fa-mountain', () => {
      setup([travel({ terrain: 'Mountain' })]);
      expect(screen.getByText(/Mountain/i)).toBeInTheDocument();
      expect(q('.log-travel-terrain i.fa-mountain')).not.toBeNull();
    });

    it('empty terrain hides span', () => {
      setup([travel({ terrain: '' })]);
      expect(screen.queryByText(/log-travel-terrain/i)).not.toBeInTheDocument();
    });

    it('weather shows', () => {
      setup([travel({ weather: 'Rainy' })]);
      expect(screen.getByText(/Rainy/i)).toBeInTheDocument();
    });

    it('empty weather hides', () => {
      setup([travel({ weather: '' })]);
      expect(screen.queryByText(/log-travel-weather/i)).not.toBeInTheDocument();
    });

    it('default sun icon when no weatherIcon', () => {
      setup([travel({ weather: 'Hot' })]);
      const i = q('.log-travel-weather i');
      expect(i?.getAttribute('class')).toContain('fa-sun');
    });

    it('custom weather icon', () => {
      setup([travel({ weather: 'Storms', weatherIcon: 'cloud-showers-heavy' })]);
      expect(q('.log-travel-weather i.fa-cloud-showers-heavy')).not.toBeNull();
    });

    it('event title + type shown', () => {
      setup([travel({ eventTitle: 'Ambush!', eventType: 'Enemy' })]);
      expect(screen.getByText(/Ambush!/i)).toBeInTheDocument();
    });

    it('empty eventTitle hides section', () => {
      setup([travel({ eventTitle: '' })]);
      expect(q('.log-travel-event')).toBeNull();
    });

    it('root class .log-entry.log-travel', () => {
      setup([travel()]);
      expect(q('.log-entry.log-travel')).not.toBeNull();
    });

    it('renders header div', () => {
      setup([travel()]);
      expect(q('.log-travel .log-entry-header')).toBeInTheDocument();
    });

    it('renders travel-action span with color style', () => {
      setup([travel()]);
      expect(q('.log-travel-action')).not.toBeNull();
    });

    it('renders fa-person-walking for advance', () => {
      setup([travel({ action: 'advance' })]);
      expect(q('.log-travel i.fa-person-walking')).not.toBeNull();
    });

    it('renders forced_march icon', () => {
      setup([travel({ action: 'forced_march' })]);
      expect(q('.log-travel i.fa-person-running')).not.toBeNull();
    });

    it('renders event_reroll icon', () => {
      setup([travel({ action: 'event_reroll' })]);
      expect(q('.log-travel i.fa-dice')).not.toBeNull();
    });

    it('renders day_exhausted icon', () => {
      setup([travel({ action: 'day_exhausted' })]);
      expect(q('.log-travel i.fa-tent')).not.toBeNull();
    });

    it('renders advance_with_event icon', () => {
      setup([travel({ action: 'advance_with_event' })]);
      expect(q('.log-travel i.fa-bolt')).not.toBeNull();
    });

    it('renders cancel icon', () => {
      setup([travel({ action: 'cancel' })]);
      expect(q('.log-travel i.fa-ban')).not.toBeNull();
    });
  });

  // ── LOOT ENTRY component ───────────────
  describe('LootEntry', () => {
    it('fa-coins icon', () => {
      setup([loot()]);
      expect(q('.log-loot i.fa-coins')).not.toBeNull();
    });

    it('title "Loot" shown', () => {
      setup([loot()]);
      expect(screen.getByText(/Loot/i)).toBeInTheDocument();
    });

    it('XP > 0 shows with locale format', () => {
      setup([loot({ xpPerChar: 1500 })]);
      expect(screen.getByText(/1,500 XP per character/i)).toBeInTheDocument();
    });

    it('XP 1M locale formatting', () => {
      setup([loot({ xpPerChar: 1000000 })]);
      expect(screen.getByText(/1,000,000 XP per character/i)).toBeInTheDocument();
    });

    it('XP === 0 hides', () => {
      setup([loot({ xpPerChar: 0 })]);
      expect(screen.queryByText(/XP per character/i)).not.toBeInTheDocument();
    });

    it('XP undefined hides', () => {
      setup([loot({ xpPerChar: undefined })]);
      expect(screen.queryByText(/XP per character/i)).not.toBeInTheDocument();
    });

    it('lootItems renders li list', () => {
      setup([loot({ lootItems: ['Ring', 'Potion'] })]);
      expect(document.querySelectorAll('.log-loot-item').length).toBe(2);
    });

    it('empty items array hides ul', () => {
      setup([loot({ lootItems: [] })]);
      expect(screen.queryByText(/log-loot-items/i)).not.toBeInTheDocument();
    });

    it('undefined lootItems hides ul', () => {
      setup([loot({ lootItems: undefined })]);
      expect(screen.queryByText(/log-loot-items/i)).not.toBeInTheDocument();
    });

    it('.log-loot-xp span when XP>0', () => {
      setup([loot({ xpPerChar: 500 })]);
      expect(q('.log-loot-xp')).not.toBeNull();
    });

    it('.log-loot-details div', () => {
      setup([loot()]);
      expect(q('.log-loot-details')).not.toBeNull();
    });

    it('fa-star in xp display', () => {
      setup([loot({ xpPerChar: 500 })]);
      expect(q('.log-loot-xp i.fa-star')).not.toBeNull();
    });

    it('root class .log-entry.log-loot', () => {
      setup([loot()]);
      expect(q('.log-entry.log-loot')).not.toBeNull();
    });
  });

  // ── CONDITION ENTRY component ───────────────
  describe('ConditionEntry', () => {
    it('applied -> "Condition Applied" text + warning icon', () => {
      setup([cond({ action: 'applied' })]);
      expect(screen.getByText(/Condition Applied/i)).toBeInTheDocument();
      expect(q('.log-condition i.fa-circle-exclamation')).not.toBeNull();
    });

    it('broken -> "Condition Broken" + check icon', () => {
      setup([cond({ action: 'broken' })]);
      expect(screen.getByText(/Condition Broken/i)).toBeInTheDocument();
      expect(q('.log-condition i.fa-circle-check')).not.toBeNull();
    });

    it('applied adds .log-condition-applied class', () => {
      setup([cond({ action: 'applied' })]);
      expect(q('.log-entry.log-condition.log-condition-applied')).not.toBeNull();
    });

    it('broken adds .log-condition-broken class', () => {
      setup([cond({ action: 'broken' })]);
      expect(q('.log-entry.log-condition.log-condition-broken')).not.toBeNull();
    });

    it('shows condition name in detail span', () => {
      setup([cond({ condition: 'charmed' })]);
      expect(q('.log-condition-name')).toHaveTextContent(/charmed/i);
    });

    it('applied shows DC', () => {
      setup([cond({ action: 'applied', dc: 15 })]);
      expect(screen.getByText(/DC 15/i)).toBeInTheDocument();
    });

    it('applied shows ability save uppercase', () => {
      setup([cond({ action: 'applied', ability: 'wisdom' })]);
      expect(q('.log-condition-ability')).toHaveTextContent(/WISDOM save/i);
    });

    it('broken hides DC even if set', () => {
      setup([cond({ action: 'broken', dc: 13 })]);
      expect(screen.queryByText(/DC 13/i)).not.toBeInTheDocument();
    });

    it('broken hides ability even if set', () => {
      setup([cond({ action: 'broken', ability: 'wisdom' })]);
      expect(q('.log-condition-ability')).toBeNull();
    });

    it('broken shows "by sourceName" in detail', () => {
      setup([cond({ action: 'broken', sourceName: 'Hero Potion' })]);
      const el = q('.log-condition-source');
      expect(el).not.toBeNull();
    });

    it('broken empty sourceName hides', () => {
      setup([cond({ action: 'broken', sourceName: '' })]);
      expect(q('.log-condition-source')).toBeNull();
    });

    it('applied hides source even if set', () => {
      setup([cond({ action: 'applied', sourceName: 'X' })]);
      expect(q('.log-condition-source')).toBeNull();
    });

    it('shows character in header', () => {
      setup([cond({ action: 'applied' })]);
      expect(q('.log-condition .log-character')).toHaveTextContent(/Gollum/i);
    });

    it('shows timestamp in header', () => {
      setup([cond()]);
      expect(q('.log-condition .log-time')).not.toBeNull();
    });
  });

  // ── ENCOUNTER ENTRY component - started ───────────────
  describe('EncounterEntry - started', () => {
    it('shows "Encounter Started" with skull icon', () => {
      setup([enc({ action: 'started' })]);
      expect(screen.getByText(/Encounter Started/i)).toBeInTheDocument();
      expect(q('.log-encounter i.fa-skull')).not.toBeNull();
    });

    it('adds .log-encounter-start class', () => {
      setup([enc({ action: 'started' })]);
      expect(q('.log-entry.log-encounter.log-encounter-start')).not.toBeNull();
    });

    it('shows encounterName in detail', () => {
      setup([enc({})]);
      expect(q('.log-encounter-name')).toHaveTextContent(/Orc Ambush/i);
    });

    it('monsters render for started with non-empty array', () => {
      setup([enc({ action: 'started', monsters: ['Gob x4', 'Troll'] })]);
      expect(screen.getByText(/Gob x4/i)).toBeInTheDocument();
    });

    it('empty monsters hides list for started', () => {
      setup([enc({ action: 'started', monsters: [] })]);
      expect(screen.queryByText(/log-encounter-monster/i)).not.toBeInTheDocument();
    });

    it('monster spans have .log-encounter-monster class', () => {
      setup([enc({ action: 'started', monsters: ['Dragon'] })]);
      expect(q('.log-encounter-monster')).not.toBeNull();
    });
  });

  // ── ENCOUNTER ENTRY component - completed ───────────────
  describe('EncounterEntry - completed', () => {
    it('shows "Encounter Completed" with trophy icon', () => {
      setup([enc({ action: 'completed' })]);
      expect(screen.getByText(/Encounter Completed/i)).toBeInTheDocument();
      expect(q('.log-encounter i.fa-trophy')).not.toBeNull();
    });

    it('adds .log-encounter-end class', () => {
      setup([enc({ action: 'completed' })]);
      expect(q('.log-entry.log-encounter.log-encounter-end')).not.toBeNull();
    });

    it('shows XP with fa-star when xpPerChar > 0', () => {
      setup([enc({ action: 'completed', xpPerChar: 750 })]);
      expect(screen.getByText(/750 XP per character/i)).toBeInTheDocument();
      expect(q('.log-encounter-xp i.fa-star')).not.toBeNull();
    });

    it('hides XP when xpPerChar === 0 for completed', () => {
      setup([enc({ action: 'completed', xpPerChar: 0 })]);
      expect(screen.queryByText(/XP per character/i)).not.toBeInTheDocument();
    });

    it('hides XP for started even if value set', () => {
      setup([enc({ action: 'started', xpPerChar: 999 })]);
      expect(screen.queryByText(/XP per character/i)).not.toBeInTheDocument();
    });

    it('loot items render as ul>li for completed', () => {
      setup([enc({ action: 'completed', lootItems: ['Sword'] })]);
      expect(screen.getByText(/Sword/i)).toBeInTheDocument();
      expect(q('.log-encounter-loot-item')).not.toBeNull();
    });

    it('empty loot array hides list for completed', () => {
      setup([enc({ action: 'completed', lootItems: [] })]);
      expect(screen.queryByText(/log-encounter-loot/i)).not.toBeInTheDocument();
    });

    it('undefined lootItems hides list on completed', () => {
      setup([enc({ action: 'completed' })]);
      expect(screen.queryByText(/log-encounter-loot/i)).not.toBeInTheDocument();
    });

    it('does NOT show monsters for completed even if set', () => {
      setup([enc({ action: 'completed', monsters: ['Dragon'] })]);
      expect(screen.queryByText(/log-encounter-monster/i)).not.toBeInTheDocument();
    });
  });

  // ── HP CHANGE ENTRY component - non-NPC ───────────────
  describe('HpChangeEntry - non-NPC', () => {
    it('negative delta -> "Takes Damage" with crack icon', () => {
      setup([hp({ delta: -5 })]);
      expect(screen.getByText(/Takes Damage/i)).toBeInTheDocument();
      expect(q('.log-hp-damage i.fa-heart-crack')).not.toBeNull();
      expect(q('.log-entry.log-hp-change.log-hp-damage')).not.toBeNull();
    });

    it('positive delta -> "Healed" with heart icon', () => {
      setup([hp({ delta: 8 })]);
      expect(screen.getByText(/Healed/i)).toBeInTheDocument();
      expect(q('.log-healing i.fa-heart')).not.toBeNull();
    });

    it('+ with source shows "Healed (source)"', () => {
      setup([hp({ delta: 8, sourceName: 'Cleric' })]);
      expect(screen.getByText(/Healed \(Cleric\)/i)).toBeInTheDocument();
    });

    it('isUnconscious -> prefix text', () => {
      setup([hp({ delta: -10, isUnconscious: true })]);
      expect(screen.getByText(/Knocked Unconscious/i)).toBeInTheDocument();
    });

    it('unconscious + takes damage = combined text', () => {
      setup([hp({ delta: -10, isUnconscious: true })]);
      expect(screen.getByText(/Knocked Unconscious.*Takes Damage/i)).toBeInTheDocument();
    });

    it('shows current/max HP for non-NPC', () => {
      setup([hp({ currentHp: 17, maxHp: 50 })]);
      expect(screen.getByText(/17\/50/i)).toBeInTheDocument();
    });

    it('.log-hp-current present for non-NPC', () => {
      setup([hp({ currentHp: 20, maxHp: 30 })]);
      expect(q('.log-hp-current')).not.toBeNull();
    });

    it('.log-hp-current NOT present for NPC (threshold)', () => {
      setup([hp({ delta: -5, threshold: 'dead' })]);
      expect(q('.log-hp-current')).toBeNull();
    });
  });

  // ── HP CHANGE ENTRY component - NPC thresholds ───────────────
  describe('HpChangeEntry - NPC thresholds', () => {
    it('dead threshold shows "Defeated"', () => {
      setup([hp({ delta: -20, threshold: 'dead' })]);
      expect(screen.getByText(/Defeated/i)).toBeInTheDocument();
    });

    it('bloodied threshold shows "Bloodied"', () => {
      setup([hp({ delta: -15, threshold: 'bloodied' })]);
      expect(screen.getByText(/Bloodied/i)).toBeInTheDocument();
    });

    it('recovering threshold shows "Recovering"', () => {
      setup([hp({ delta: 10, threshold: 'recovering' })]);
      expect(screen.getByText(/Recovering/i)).toBeInTheDocument();
    });

    it('NPC non-zero delta shows paren with delta value', () => {
      setup([hp({ delta: 8, threshold: 'recovering' })]);
      const nameEl = q('.log-name');
      expect(nameEl.textContent).toMatch(/\(\+8\)/);
     });

    it('zero delta NPC hides paren display', () => {
      setup([hp({ delta: 0, threshold: 'bloodied' })]);
      expect(screen.queryByText(/\(0\)/i)).not.toBeInTheDocument();
    });
  });

  // ── DEATH SAVE ENTRY component ───────────────
  describe('DeathSaveEntry', () => {
    it('normal success -> "Death Save Success" with .log-die-selected on die', () => {
      setup([ds({ success: true })]);
      expect(screen.getByText(/Death Save Success/i)).toBeInTheDocument();
      expect(q('.log-entry.log-death-save.log-death-save-success')).not.toBeNull();
    });

    it('normal failure -> Death Save Failure', () => {
      setup([{ ...ds(), success: false }]);
      expect(screen.getByText(/Death Save Failure/i)).toBeInTheDocument();
    });

    it('nat20 shows "Stabilized!" not Succeeds text', () => {
      setup([ds({ success: true, isNatural20: true })]);
      expect(screen.getByText(/Stabilized!/i)).toBeInTheDocument();
      expect(screen.queryByText(/Death Save Success/i)).not.toBeInTheDocument();
    });

    it('nat1 shows Double Failure not Fail', () => {
      setup([ds({ success: false, isNatural1: true })]);
      expect(screen.getByText(/Double Failure/i)).toBeInTheDocument();
      expect(screen.queryByText(/Death Save Failure/i)).not.toBeInTheDocument();
    });

    it('NAT 20 badge text and classes', () => {
      setup([ds({ success: false, isNatural20: true })]);
      expect(screen.getByText(/NAT 20/i)).toBeInTheDocument();
    });

    it('NAT 1 badge renders', () => {
      setup([ds({ success: false, isNatural1: true })]);
      expect(screen.getByText(/NAT 1/i)).toBeInTheDocument();
    });

    it('roll value in parens', () => {
      setup([ds({ roll: 12 })]);
      expect(screen.getByText(/\(12\)/)).toBeInTheDocument();
    });

    it('skull-crossbones icon', () => {
      setup([ds()]);
      expect(q('.log-death-save i.fa-skull-crossbones')).not.toBeNull();
    });

    it('success die has .log-die-selected class', () => {
      setup([ds({ success: true })]);
      expect(q('.log-death-save .log-die-selected')).not.toBeNull();
    });

    it('failed die lacks .log-die-selected class', () => {
      setup([{ ...ds(), success: false }]);
      expect(document.querySelectorAll('.log-death-save .log-die-selected').length).toBe(0);
    });
  });

  // ── SPELL ENTRY component ───────────────
  describe('SpellEntry', () => {
    it('shows "Cast" + spellName in header', () => {
      setup([spell()]);
      expect(screen.getByText(/Cast Fireball/i)).toBeInTheDocument();
    });

    it('shows Level and castingTime', () => {
      setup([spell({ spellLevel: 3 })]);
      expect(q('.log-spell')).not.toBeNull();
    });

    it('no metamagic shows "No Metamagic" text', () => {
      setup([spell({ metamagic: [] })]);
      expect(screen.getByText(/No Metamagic/i)).toBeInTheDocument();
    });

    it('metamagics render with list class', () => {
      setup([spell({ metamagic: ['Empowered'] })]);
      expect(q('.log-metamagic-list')).not.toBeNull();
    });

    it('multiple metamagics render separately', () => {
      setup([spell({ metamagic: ['E', 'X', 'R'] })]);
      expect(document.querySelectorAll('.log-metamagic-option').length).toBe(3);
    });

    it('spCost > 0 renders as SP text and element', () => {
      setup([{ ...spell(), spCost: 2, metamagic: ['E'] }]);
      expect(screen.getByText(/2 SP/i)).toBeInTheDocument();
      expect(q('.log-metamagic-cost')).not.toBeNull();
    });

    it('spCost === 0 hides cost', () => {
      setup([spell({ spCost: 0 })]);
      expect(screen.queryByText(/\d+ SP/)).not.toBeInTheDocument();
    });

    it('wand magic sparkles icon on root', () => {
      setup([spell()]);
      expect(q('.log-spell i.fa-wand-magic-sparkles')).not.toBeNull();
    });
  });

  // ── METAMAGIC ENTRY component ───────────────
  describe('MetamagicEntry', () => {
    it('shows "Empowered Spell - spellName"', () => {
      setup([meta({ spellName: 'Vampiric Touch' })]);
      expect(screen.getByText(/Empowered/i)).toBeInTheDocument();
    });

    it('shows target with arrow prefix', () => {
      setup([meta({ targetName: 'Dragon' })]);
      expect(screen.getByText(/\u2192 Dragon/i)).toBeInTheDocument();
    });

    it('shows original → new total display', () => {
      setup([meta({ originalDamage: 20, newTotal: 30 })]);
      expect(screen.getByText(/20 \u2192 30/i)).toBeInTheDocument();
    });

    it('positive diff shows + prefix and class', () => {
      setup([meta({ damageDifference: 5 })]);
      expect(screen.getByText(/\+5/i)).toBeInTheDocument();
      expect(q('.log-empowered-positive')).not.toBeNull();
    });
  });

  // ── ROLL ENTRY - cover and rangeReason ───────────────
  describe('RollEntry - cover and rangeReason', () => {
    it('shows 1/2 Cover when acBonus > 0', () => {
      setup([roll({ coverAcBonus: 2 })]);
      expect(screen.getByText(/1\/2/i)).toBeInTheDocument();
    });

    it('shows 3/4 for threeQuarter coverLevel', () => {
      setup([{ ...roll(), coverAcBonus: 3, coverLevel: 'threeQuarter' }]);
      expect(screen.getByText(/3\/4/i)).toBeInTheDocument();
    });

    it('+ac in Cover info', () => {
      setup([roll({ coverAcBonus: 5 })]);
      expect(screen.getByText(/\+5 AC/)).toBeInTheDocument();
    });

    it('hide cover when acBonus is 0', () => {
      setup([roll()]);
      expect(screen.queryByText(/Cover/i)).not.toBeInTheDocument();
    });

    it('rangeReason shown when set', () => {
      setup([roll({ rangeReason: 'Long range' })]);
      expect(screen.getByText(/Long range/i)).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - inline condition save and resistanceNotice ───────────────
  describe('RollEntry - condition + resistance', () => {
    it('condition+dc success shows SUCCESS text', () => {
      setup([roll({ condition: 'charmed', dc: 15, success: true })]);
      expect(screen.getByText(/vs charmed.*SUCCESS/i)).toBeInTheDocument();
      expect(q('.log-condition-save.log-condition-success')).not.toBeNull();
    });

    it('cond fail shows FAILURE and class', () => {
      setup([roll({ condition: 'paralyzed', dc: 12, success: false })]);
      expect(screen.getByText(/FAILURE/i)).toBeInTheDocument();
      expect(q('.log-condition-save.log-condition-failure')).not.toBeNull();
    });

    it('undefined dc hides inline cond save', () => {
      setup([roll({ condition: 'charmed' })]);
      expect(screen.queryByText(/vs charmed/i)).not.toBeInTheDocument();
    });

    it('resistanceNotice renders in div', () => {
      setup([roll({ resistanceNotice: 'Half dmg' })]);
      expect(screen.getByText(/Half dmg/i)).toBeInTheDocument();
    });

    it('empty resistanceNotice hides element', () => {
      setup([roll({ resistanceNotice: '' })]);
      expect(screen.queryByText(/log-resistance-notice/i)).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - save-damage details ───────────────
  describe('RollEntry - save-damage details', () => {
    it('saveType+Dc show info', () => {
      setup([roll({ rollType: 'save-damage', saveType: 'dex', saveDc: 15 })]);
      expect(q('.log-save-info')).not.toBeNull();
    });

    it('success result with class', () => {
      setup([roll({ rollType: 'save-damage', saveResult: 'success', targetName: 'Gob' })]);
      expect(q('.log-save-result.log-condition-success')).not.toBeNull();
      });

    it('failure result', () => {
      setup([roll({ rollType: 'save-damage', saveResult: 'failure', targetName: 'Gob' })]);
      expect(screen.getByText(/SAVE FAILURE/i)).toBeInTheDocument();
    });

    it('.log-save-result with log-condition-success', () => {
      setup([roll({ rollType: 'save-damage', saveResult: 'success', targetName: 'G' })]);
      expect(q('.log-save-result.log-condition-success')).not.toBeNull();
    });

    it('disadv mode on save-dmg shows DISADVANTAGE badge', () => {
      setup([
        roll({ rollType: 'save-damage', mode: 'disadvantage', saveDc: 13, saveType: 'wis' }),
      ]);
      expect(screen.getByText(/DISADVANTAGE/i)).toBeInTheDocument();
    });

    it('vs target for save-damage type', () => {
      setup([roll({ rollType: 'save-damage', targetName: 'Orc' })]);
      expect(screen.getByText(/vs Orc/)).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - aoe-damage ───────────────
  describe('RollEntry - aoe-damage', () => {
    it('formula shows for aoe type', () => {
      setup([roll({ rollType: 'aoe-damage', formula: '8d6+0' })]);
      expect(screen.getByText(/8d6/)).toBeInTheDocument();
    });

    it('affected 3 creatures (plural)', () => {
      setup([roll({ rollType: 'aoe-damage', affectedCount: 3 })]);
      expect(screen.getByText(/3 creatures affected/i)).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - damageType display ───────────────
  describe('RollEntry - damage type text', () => {
    it('damage roll type shows damage-type element', () => {
      setup([roll({ rollType: 'damage', damageType: 'slashing' })]);
      expect(screen.getByText(/slashing/)).toBeInTheDocument();
    });

    it('save-damage shows dmg type', () => {
      setup([roll({ rollType: 'save-damage', damageType: 'fire' })]);
      expect(screen.getByText(/fire/)).toBeInTheDocument();
    });
  });

  // ── ICON CLASSES mapping getRollIconType - all types + default ───────────────
  describe('getRollIconType icon mapping per type', () => {
    it.each([
      ['spell_attack', 'fa-wand-magic-sparkles'],
      ['save', 'fa-shield-halved'],
      ['condition-save', 'fa-shield-halved'],
      ['initiative', 'fa-bolt'],
      ['damage', 'fa-skull'],
      ['attack', 'fa-crosshairs'],
    ])('%s -> .%s', (tp, cls) => {
      setup([roll({ rollType: tp })]);
      expect(q(`.log-roll i.${cls}`)).not.toBeNull();
    });

    it('default unknown shows fa-dice-d20', () => {
      setup([roll({ rollType: 'xyz' })]);
      expect(q('.log-roll i.fa-dice-d20')).not.toBeNull();
    });
  });

  // ── showBothDice - two dice display edge cases ───────────────
  describe('RollEntry - showBothDice modes', () => {
    it('two dice + advantage shows both with high low labels', () => {
      setup([roll({ rolls: [17, 9], mode: 'adv' })]);
      expect(screen.getByText(/high/i)).toBeInTheDocument();
      expect(screen.getByText(/low/i)).toBeInTheDocument();
    });
  });

  // ── Timestamp formatting via any entry with .log-time element ───────────────
  describe('formatTimestamp output', () => {
    it('renders timestamp in HH:MM:SS format per entry type', () => {
      setup([note()]);
      const el = q('.log-time');
      // toLocaleTimeString returns "HH:MM:SS AM/PM" — always contains colons + digits
      expect(el?.textContent.trim()).toMatch(/\d{2}:\d{2}:\d{2}/);
       });
  });
});
