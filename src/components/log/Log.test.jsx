// @cleaned-by-ai
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = vi.hoisted(() => ({ logEntries: [], initialized: true }));
const mockAddEntry = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('../../hooks/runtime/useLog.js', () => ({
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
    cleanup();
    mockState.logEntries.length = 0;
    mockState.initialized = true;
    mockAddEntry.mockClear();
  });

  // ── TOOLBAR & STRUCTURE ───────────────────────
  describe('toolbar', () => {
    it('renders heading, textarea, add button, and character select', () => {
      setup([]);
      expect(screen.getByRole('heading', { name: /campaign log/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Add a note to the log...')).toBeInTheDocument();
      expect(q('.log-add-btn')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Anonymous' })).toBeInTheDocument();
    });

    it('hides select when no characters', () => {
      setup([], true, []);
      expect(() => screen.getByRole('combobox')).toThrow();
    });

    it('populates select options from character list', () => {
      setup([], true, [{ name: 'L' }, { name: 'G' }]);
      expect(screen.getByRole('option', { name: 'L' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'G' })).toBeInTheDocument();
    });
  });

  // ── LOADING & EMPTY STATES ───────────────────────
  describe('loading/empty states', () => {
    it('shows loading when not initialized, hides entries', () => {
      setup([note()], false);
      expect(screen.getByText('Loading log...')).toBeInTheDocument();
      expect(screen.queryByText(/hi/i)).not.toBeInTheDocument();
    });

    it('shows empty state when initialized with no entries', () => {
      setup([]);
      expect(screen.queryByText(/Loading log/i)).not.toBeInTheDocument();
      expect(screen.getByText(/no entries yet/i)).toBeInTheDocument();
    });

    it('hides empty msg when entries exist', () => {
      setup([note()]);
      expect(screen.queryByText(/no entries yet/i)).not.toBeInTheDocument();
    });
  });

  // ── ADDING NOTES ───────────────
  describe('adding notes', () => {
    it('adds note on button click with trimmed text', async () => {
      setup([]);
      fireEvent.change(screen.getByPlaceholderText('Add a note to the log...'), {
        target: { value: ' Hello ' },
      });
      fireEvent.click(q('.log-add-btn'));
      await waitFor(() => {
        expect(mockAddEntry).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'note', noteText: 'Hello' }),
        );
      });
    });

    it('uses selected char as author, Anonymous when none selected', async () => {
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

    it('uses Anonymous when no char options available', async () => {
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

    it('no-op for empty or whitespace text', () => {
      setup([]);
      fireEvent.click(q('.log-add-btn'));
      expect(mockAddEntry).not.toHaveBeenCalled();
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

    it('plain enter and ctrl+r do NOT submit', () => {
      setup([]);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: 'x' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(mockAddEntry).not.toHaveBeenCalled();
      fireEvent.keyDown(textarea, { key: 'r', ctrlKey: true });
      expect(mockAddEntry).not.toHaveBeenCalled();
    });

    it('clears textarea after submit but not on empty note', async () => {
      setup([]);
      const textarea = screen.getByPlaceholderText('Add a note to the log...');
      fireEvent.change(textarea, { target: { value: 'x' } });
      fireEvent.click(q('.log-add-btn'));
      await waitFor(() => expect(textarea).toHaveValue(''));
      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.click(q('.log-add-btn'));
      expect(textarea).toHaveValue('   ');
    });
  });

  // ── ENTRY RENDERING / REVERSE ORDER ───────────────
  describe('entry rendering', () => {
    it('renders entries in reverse order, skips unknown types', () => {
      setup([note({ id: 'a', noteText: 'First' }), note({ id: 'b', noteText: 'Second' }), { id: '?', type: 'unknown' }]);
      const texts = document.querySelectorAll('.log-note-text');
      expect(texts.length).toBe(2);
      expect(texts[0].textContent).toContain('Second');
      expect(texts[1].textContent).toContain('First');
    });

    it('does NOT render entries when not initialized', () => {
      setup([note({ noteText: 'hi' })], false);
      expect(screen.queryByText(/hi/i)).not.toBeInTheDocument();
    });
  });

  // ── NOTE ENTRY component ───────────────
  describe('NoteEntry', () => {
    it('renders noteText, character name, timestamp, and icon', () => {
      setup([note({ noteText: 'Hello' })]);
      expect(q('.log-note-text')).toHaveTextContent(/Hello/i);
      expect(q('.log-note .log-character')).toHaveTextContent(/Frodo/i);
      expect(q('.log-note .log-time')).toBeInTheDocument();
      expect(q('.log-note i.fa-comment-dots')).toBeInTheDocument();
      expect(q('.log-entry.log-note')).toBeInTheDocument();
    });
  });

  // ── TRAVEL ENTRY component ───────────────
  describe('TravelEntry', () => {
    it.each([
      ['advance', 'Advanced to', 'fa-person-walking'],
      ['advance_with_event', 'Event triggered at', 'fa-bolt'],
      ['arrived', 'Arrived at', 'fa-flag-checkered'],
      ['camp', 'Camped at', 'fa-campground'],
      ['forced_march', 'Forced march at', 'fa-person-running'],
      ['event_accept', 'Accepted event at', 'fa-check'],
      ['event_skip', 'Skipped event at', 'fa-xmark'],
      ['event_reroll', 'Re-rolled event at', 'fa-dice'],
      ['extreme_weather', 'Weather halted travel at', 'fa-triangle-exclamation'],
      ['day_exhausted', 'Budget exhausted at', 'fa-tent'],
      ['cancel', 'Travel cancelled at', 'fa-ban'],
    ])('action %s -> label "%s" with icon .%s', (action, label, icon) => {
      setup([travel({ action })]);
      expect(screen.getByText(new RegExp(label, 'i'))).toBeInTheDocument();
      expect(q(`.log-travel i.${icon}`)).toBeInTheDocument();
    });

    it('unknown action falls back to advance config', () => {
      setup([travel({ action: 'bad' })]);
      expect(screen.getByText(/Advanced to/i)).toBeInTheDocument();
    });

    it('renders hex coords, terrain, weather, and event title', () => {
      setup([travel({ hex: { q: 5, r: -3 }, terrain: 'Mountain', weather: 'Rainy', eventTitle: 'Ambush!', eventType: 'Enemy' })]);
      expect(screen.getByText(/\(5, -3\)/)).toBeInTheDocument();
      expect(screen.getByText(/Mountain/i)).toBeInTheDocument();
      expect(q('.log-travel-terrain i.fa-mountain')).toBeInTheDocument();
      expect(screen.getByText(/Rainy/i)).toBeInTheDocument();
      expect(screen.getByText(/Ambush!/i)).toBeInTheDocument();
    });

    it('uses custom weather icon when provided', () => {
      setup([travel({ weather: 'Storms', weatherIcon: 'cloud-showers-heavy' })]);
      expect(q('.log-travel-weather i.fa-cloud-showers-heavy')).toBeInTheDocument();
    });
  });

  // ── LOOT ENTRY component ───────────────
  describe('LootEntry', () => {
    it('renders icon, title, and details container', () => {
      setup([loot()]);
      expect(q('.log-loot i.fa-coins')).toBeInTheDocument();
      expect(screen.getByText(/Loot/i)).toBeInTheDocument();
      expect(q('.log-loot-details')).toBeInTheDocument();
      expect(q('.log-entry.log-loot')).toBeInTheDocument();
    });

    it('formats XP with locale and shows/hides based on value', () => {
      setup([loot({ xpPerChar: 1500 })]);
      expect(screen.getByText(/1,500 XP per character/i)).toBeInTheDocument();
      expect(q('.log-loot-xp i.fa-star')).toBeInTheDocument();
      cleanup();
      setup([loot({ xpPerChar: 0 })]);
      expect(screen.queryByText(/XP per character/i)).not.toBeInTheDocument();
    });

    it('renders loot items as list, hides when empty', () => {
      setup([loot({ lootItems: ['Ring', 'Potion'] })]);
      expect(document.querySelectorAll('.log-loot-item').length).toBe(2);
      cleanup();
      setup([loot({ lootItems: [] })]);
      expect(screen.queryByText(/log-loot-items/i)).not.toBeInTheDocument();
    });
  });

  // ── CONDITION ENTRY component ───────────────
  describe('ConditionEntry', () => {
    it('applied -> "Condition Applied" with warning icon, shows DC and ability save', () => {
      setup([cond({ action: 'applied', dc: 15, ability: 'wisdom' })]);
      expect(screen.getByText(/Condition Applied/i)).toBeInTheDocument();
      expect(q('.log-condition i.fa-circle-exclamation')).toBeInTheDocument();
      expect(q('.log-entry.log-condition.log-condition-applied')).toBeInTheDocument();
      expect(q('.log-condition-name')).toHaveTextContent(/charmed/i);
      expect(screen.getByText(/DC 15/i)).toBeInTheDocument();
      expect(q('.log-condition-ability')).toHaveTextContent(/WISDOM save/i);
    });

    it('broken -> "Condition Broken" with check icon, hides DC/ability, shows source', () => {
      setup([cond({ action: 'broken', dc: 13, ability: 'wisdom', sourceName: 'Hero Potion' })]);
      expect(screen.getByText(/Condition Broken/i)).toBeInTheDocument();
      expect(q('.log-condition i.fa-circle-check')).toBeInTheDocument();
      expect(q('.log-entry.log-condition.log-condition-broken')).toBeInTheDocument();
      expect(screen.queryByText(/DC 13/i)).not.toBeInTheDocument();
      expect(q('.log-condition-ability')).not.toBeInTheDocument();
      expect(q('.log-condition-source')).toBeInTheDocument();
    });

    it('hides source when empty for broken action', () => {
      setup([cond({ action: 'broken', sourceName: '' })]);
      expect(q('.log-condition-source')).not.toBeInTheDocument();
    });

    it('shows character and timestamp in header', () => {
      setup([cond({ action: 'applied' })]);
      expect(q('.log-condition .log-character')).toHaveTextContent(/Gollum/i);
      expect(q('.log-condition .log-time')).toBeInTheDocument();
    });
  });

  // ── ENCOUNTER ENTRY component - started ───────────────
  describe('EncounterEntry - started', () => {
    it('shows "Encounter Started" with skull icon, encounter name, and monsters', () => {
      setup([enc({ action: 'started', monsters: ['Gob x4', 'Troll'] })]);
      expect(screen.getByText(/Encounter Started/i)).toBeInTheDocument();
      expect(q('.log-encounter i.fa-skull')).toBeInTheDocument();
      expect(q('.log-entry.log-encounter.log-encounter-start')).toBeInTheDocument();
      expect(q('.log-encounter-name')).toHaveTextContent(/Orc Ambush/i);
      expect(screen.getByText(/Gob x4/i)).toBeInTheDocument();
      expect(q('.log-encounter-monster')).toBeInTheDocument();
    });
  });

  // ── ENCOUNTER ENTRY component - completed ───────────────
  describe('EncounterEntry - completed', () => {
    it('shows "Encounter Completed" with trophy icon, XP, and loot items', () => {
      setup([enc({ action: 'completed', xpPerChar: 750, lootItems: ['Sword'] })]);
      expect(screen.getByText(/Encounter Completed/i)).toBeInTheDocument();
      expect(q('.log-encounter i.fa-trophy')).toBeInTheDocument();
      expect(q('.log-entry.log-encounter.log-encounter-end')).toBeInTheDocument();
      expect(screen.getByText(/750 XP per character/i)).toBeInTheDocument();
      expect(q('.log-encounter-xp i.fa-star')).toBeInTheDocument();
      expect(screen.getByText(/Sword/i)).toBeInTheDocument();
      expect(q('.log-encounter-loot-item')).toBeInTheDocument();
    });

    it('hides XP when zero, hides loot when empty', () => {
      setup([enc({ action: 'completed', xpPerChar: 0 })]);
      expect(screen.queryByText(/XP per character/i)).not.toBeInTheDocument();
      cleanup();
      setup([enc({ action: 'completed' })]);
      expect(screen.queryByText(/log-encounter-loot/i)).not.toBeInTheDocument();
    });
  });

  // ── HP CHANGE ENTRY component - non-NPC ───────────────
  describe('HpChangeEntry - non-NPC', () => {
    it('negative delta -> "Takes Damage" with crack icon and HP display', () => {
      setup([hp({ delta: -5, currentHp: 20, maxHp: 25 })]);
      expect(screen.getByText(/Takes Damage/i)).toBeInTheDocument();
      expect(q('.log-hp-damage i.fa-heart-crack')).toBeInTheDocument();
      expect(q('.log-entry.log-hp-change.log-hp-damage')).toBeInTheDocument();
      expect(screen.getByText(/20\/25/i)).toBeInTheDocument();
      expect(q('.log-hp-current')).toBeInTheDocument();
    });

    it('positive delta -> "Healed" with heart icon, shows source when set', () => {
      setup([hp({ delta: 8 })]);
      expect(screen.getByText(/Healed/i)).toBeInTheDocument();
      expect(q('.log-healing i.fa-heart')).toBeInTheDocument();
      cleanup();
      setup([hp({ delta: 8, sourceName: 'Cleric' })]);
      expect(screen.getByText(/Healed \(Cleric\)/i)).toBeInTheDocument();
    });

    it('isUnconscious shows prefix text combined with damage', () => {
      setup([hp({ delta: -10, isUnconscious: true })]);
      expect(screen.getByText(/Knocked Unconscious/i)).toBeInTheDocument();
      expect(screen.getByText(/Knocked Unconscious.*Takes Damage/i)).toBeInTheDocument();
    });

    it('hides HP current display for NPC (threshold)', () => {
      setup([hp({ delta: -5, threshold: 'dead' })]);
      expect(q('.log-hp-current')).not.toBeInTheDocument();
    });
  });

  // ── HP CHANGE ENTRY component - NPC thresholds ───────────────
  describe('HpChangeEntry - NPC thresholds', () => {
    it('dead/bloodied/recovering thresholds show correct labels', () => {
      setup([hp({ delta: -20, threshold: 'dead' })]);
      expect(screen.getByText(/Defeated/i)).toBeInTheDocument();
      cleanup();
      setup([hp({ delta: -15, threshold: 'bloodied' })]);
      expect(screen.getByText(/Bloodied/i)).toBeInTheDocument();
      cleanup();
      setup([hp({ delta: 10, threshold: 'recovering' })]);
      expect(screen.getByText(/Recovering/i)).toBeInTheDocument();
    });

    it('shows paren delta for recovering NPC', () => {
      setup([hp({ delta: 8, threshold: 'recovering' })]);
      expect(q('.log-name').textContent).toMatch(/\(\+8\)/);
    });

    it('zero delta NPC hides paren display', () => {
      setup([hp({ delta: 0, threshold: 'bloodied' })]);
      expect(screen.queryByText(/\(0\)/i)).not.toBeInTheDocument();
    });
  });

  // ── DEATH SAVE ENTRY component ───────────────
  describe('DeathSaveEntry', () => {
    it('normal success/failure with correct text, classes, and die styling', () => {
      setup([ds({ success: true })]);
      expect(screen.getByText(/Death Save Success/i)).toBeInTheDocument();
      expect(q('.log-entry.log-death-save.log-death-save-success')).toBeInTheDocument();
      expect(q('.log-death-save .log-die-selected')).toBeInTheDocument();
      cleanup();
      setup([{ ...ds(), success: false }]);
      expect(screen.getByText(/Death Save Failure/i)).toBeInTheDocument();
      expect(q('.log-death-save .log-die-selected')).not.toBeInTheDocument();
    });

    it('nat20 shows "Stabilized!" with NAT 20 badge', () => {
      setup([ds({ success: true, isNatural20: true })]);
      expect(screen.getByText(/Stabilized!/i)).toBeInTheDocument();
      expect(screen.queryByText(/Death Save Success/i)).not.toBeInTheDocument();
      expect(screen.getByText(/NAT 20/i)).toBeInTheDocument();
    });

    it('nat1 shows "Double Failure" with NAT 1 badge', () => {
      setup([ds({ success: false, isNatural1: true })]);
      expect(screen.getByText(/Double Failure/i)).toBeInTheDocument();
      expect(screen.queryByText(/Death Save Failure/i)).not.toBeInTheDocument();
      expect(screen.getByText(/NAT 1/i)).toBeInTheDocument();
    });

    it('shows roll value in parens and skull-crossbones icon', () => {
      setup([ds({ roll: 12 })]);
      expect(screen.getByText(/\(12\)/)).toBeInTheDocument();
      expect(q('.log-death-save i.fa-skull-crossbones')).toBeInTheDocument();
    });
  });

  // ── SPELL ENTRY component ───────────────
  describe('SpellEntry', () => {
    it('shows "Cast" + spellName, level, casting time, and wand icon', () => {
      setup([spell()]);
      expect(screen.getByText(/Cast Fireball/i)).toBeInTheDocument();
      expect(q('.log-spell')).toBeInTheDocument();
      expect(q('.log-spell i.fa-wand-magic-sparkles')).toBeInTheDocument();
    });

    it('shows "No Metamagic" when empty, renders metamagic list and SP cost when present', () => {
      setup([spell({ metamagic: [] })]);
      expect(screen.getByText(/No Metamagic/i)).toBeInTheDocument();
      cleanup();
      setup([spell({ metamagic: ['Empowered'] })]);
      expect(q('.log-metamagic-list')).toBeInTheDocument();
      expect(q('.log-metamagic-option')).toBeInTheDocument();
      cleanup();
      setup([{ ...spell(), spCost: 2, metamagic: ['Empowered'] }]);
      expect(screen.getByText(/2 SP/i)).toBeInTheDocument();
      expect(q('.log-metamagic-cost')).toBeInTheDocument();
    });

    it('renders multiple metamagics separately', () => {
      setup([spell({ metamagic: ['E', 'X', 'R'] })]);
      expect(document.querySelectorAll('.log-metamagic-option').length).toBe(3);
    });
  });

  // ── METAMAGIC ENTRY component ───────────────
  describe('MetamagicEntry', () => {
    it('shows spell name, target arrow, damage diff, and positive class', () => {
      setup([meta({ spellName: 'Vampiric Touch', targetName: 'Dragon', originalDamage: 20, newTotal: 30, damageDifference: 5 })]);
      expect(screen.getByText(/Empowered/i)).toBeInTheDocument();
      expect(screen.getByText(/\u2192 Dragon/i)).toBeInTheDocument();
      expect(screen.getByText(/20 \u2192 30/i)).toBeInTheDocument();
      expect(screen.getByText(/\+5/i)).toBeInTheDocument();
      expect(q('.log-empowered-positive')).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - cover and rangeReason ───────────────
  describe('RollEntry - cover and rangeReason', () => {
    it('shows 1/2 or 3/4 cover with AC bonus, hides when zero', () => {
      setup([roll({ coverAcBonus: 2 })]);
      expect(screen.getByText(/1\/2 Cover \(.*AC\)/i)).toBeInTheDocument();
      cleanup();
      setup([{ ...roll(), coverAcBonus: 3, coverLevel: 'threeQuarter' }]);
      expect(screen.getByText(/3\/4 Cover \(.*AC\)/i)).toBeInTheDocument();
      cleanup();
      setup([roll()]);
      expect(screen.queryByText(/Cover/i)).not.toBeInTheDocument();
    });

    it('shows rangeReason when set, hides when empty', () => {
      setup([roll({ rangeReason: 'Long range' })]);
      expect(screen.getByText(/Long range/i)).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - condition save and resistanceNotice ───────────────
  describe('RollEntry - condition + resistance', () => {
    it('condition+dc success/failure shows correct text and classes', () => {
      setup([roll({ condition: 'charmed', dc: 15, success: true })]);
      expect(screen.getByText(/vs charmed.*SUCCESS/i)).toBeInTheDocument();
      expect(q('.log-condition-save.log-condition-success')).toBeInTheDocument();
      cleanup();
      setup([roll({ condition: 'paralyzed', dc: 12, success: false })]);
      expect(screen.getByText(/FAILURE/i)).toBeInTheDocument();
      expect(q('.log-condition-save.log-condition-failure')).toBeInTheDocument();
    });

    it('shows/hides resistanceNotice', () => {
      setup([roll({ resistanceNotice: 'Half dmg' })]);
      expect(screen.getByText(/Half dmg/i)).toBeInTheDocument();
      cleanup();
      setup([roll({ resistanceNotice: '' })]);
      expect(screen.queryByText(/log-resistance-notice/i)).not.toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - save-damage details ───────────────
  describe('RollEntry - save-damage details', () => {
    it('shows save info, result, target, and disadvantage badge', () => {
      setup([roll({ rollType: 'save-damage', saveType: 'dex', saveDc: 15 })]);
      expect(q('.log-save-info')).toBeInTheDocument();
      cleanup();
      setup([roll({ rollType: 'save-damage', saveResult: 'success', targetName: 'Gob' })]);
      expect(q('.log-save-result.log-condition-success')).toBeInTheDocument();
      cleanup();
      setup([roll({ rollType: 'save-damage', saveResult: 'failure', targetName: 'Gob' })]);
      expect(screen.getByText(/SAVE FAILURE/i)).toBeInTheDocument();
      cleanup();
      setup([roll({ rollType: 'save-damage' })]);
      expect(q('.log-save-result')).not.toBeInTheDocument();
      cleanup();
      setup([
        roll({ rollType: 'save-damage', mode: 'disadvantage', saveDc: 13, saveType: 'wis' }),
      ]);
      expect(screen.getByText(/DISADVANTAGE/i)).toBeInTheDocument();
    });
  });

  // ── ROLL ENTRY - aoe-damage and damage type ───────────────
  describe('RollEntry - aoe-damage and damage type', () => {
    it('shows formula, affected count, and damage type', () => {
      setup([roll({ rollType: 'aoe-damage', formula: '8d6+0', affectedCount: 3 })]);
      expect(screen.getByText(/8d6/)).toBeInTheDocument();
      expect(screen.getByText(/3 creatures affected/i)).toBeInTheDocument();
      cleanup();
      setup([roll({ rollType: 'damage', damageType: 'slashing' })]);
      expect(screen.getByText(/slashing/)).toBeInTheDocument();
      cleanup();
      setup([roll({ rollType: 'save-damage', damageType: 'fire' })]);
      expect(screen.getByText(/fire/)).toBeInTheDocument();
    });
  });

  // ── ICON CLASSES mapping getRollIconType ───────────────
  describe('getRollIconType icon mapping', () => {
    it.each([
      ['spell_attack', 'fa-wand-magic-sparkles'],
      ['save', 'fa-shield-halved'],
      ['condition-save', 'fa-shield-halved'],
      ['save-damage', 'fa-shield-halved'],
      ['initiative', 'fa-bolt'],
      ['damage', 'fa-skull'],
      ['attack', 'fa-crosshairs'],
    ])('%s -> .%s', (tp, cls) => {
      setup([roll({ rollType: tp })]);
      expect(q(`.log-roll i.${cls}`)).toBeInTheDocument();
    });
  });

  // ── showBothDice - two dice display edge cases ───────────────
  describe('RollEntry - showBothDice modes', () => {
    it('two dice + advantage shows both with selected/discarded labels', () => {
      setup([roll({ rolls: [17, 9], mode: 'advantage' })]);
      expect(screen.getByText(/selected/i)).toBeInTheDocument();
      expect(screen.getByText(/discarded/i)).toBeInTheDocument();
    });
  });
});
