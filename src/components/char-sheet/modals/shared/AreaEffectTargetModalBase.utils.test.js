import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderTargetList, renderResultsSection, logSaveEntry, persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import * as logService from '../../../../services/ui/logService.js';
import * as storage from '../../../../services/ui/storage.js';

// Properly mock CustomEvent as a class/constructor
const originalCustomEvent = globalThis.CustomEvent;
beforeEach(() => {
  globalThis.CustomEvent = class MockCustomEvent extends originalCustomEvent {
    constructor(type) {
      super(type);
    }
  };
});

afterEach(() => {
  globalThis.CustomEvent = originalCustomEvent;
});

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue({}),
  },
}));

// ── Helpers ────────────────────────────────────────────────────

const eligibleTargets = [
  { name: 'Goblin', type: 'monster' },
  { name: 'Orc', type: 'monster' },
  { name: 'Skeleton', type: 'undead' },
];

const results = [
  { targetName: 'Goblin', success: false, roll: 7, saveBonus: 2, total: 9 },
  { targetName: 'Orc', success: true, roll: 15, saveBonus: 0, total: 15 },
  { targetName: 'Skeleton', success: false, saveBonus: 1, total: 8 },
];

const pendingPrompts = [
  { promptId: 'p1', targetName: 'Player1' },
  { promptId: 'p2', targetName: 'Player2' },
];

function toggleTargetMock() {
  return vi.fn((name) => console.log('toggle', name));
}

// ── renderTargetList Tests ─────────────────────────────────────

describe('renderTargetList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all eligible targets with checkboxes', () => {
    const toggleTarget = toggleTargetMock();
    render(renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget }));

    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText('Skeleton')).toBeInTheDocument();
  });

  it('renders target types in parentheses', () => {
    const toggleTarget = toggleTargetMock();
    const { container } = render(renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget }));

    const typeSpans = container.querySelectorAll('.abjure-target-type');
    const types = [...typeSpans].map(s => s.textContent.trim());
    expect(types).toContain('(monster)');
    expect(types).toContain('(undead)');
  });

  it('marks selected targets with selected class', () => {
    const toggleTarget = toggleTargetMock();
    const selected = new Set(['Goblin']);
    const { container } = render(
      renderTargetList({ eligibleTargets, selected, toggleTarget }),
    );

    const rows = container.querySelectorAll('.abjure-target-row');
    expect(rows[0]).toHaveClass('abjure-target-selected');
    expect(rows[1]).not.toHaveClass('abjure-target-selected');
    expect(rows[2]).not.toHaveClass('abjure-target-selected');
  });

  it('renders checkboxes for each target', () => {
    const toggleTarget = toggleTargetMock();
    render(renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget }));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  it('calls toggleTarget when checkbox is changed', () => {
    const toggleTarget = toggleTargetMock();
    render(renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget }));

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes[0].click();
    expect(toggleTarget).toHaveBeenCalledWith('Goblin');
    checkboxes[1].click();
    expect(toggleTarget).toHaveBeenCalledWith('Orc');
  });

  it('shows "No valid targets in range" when eligibleTargets is empty', () => {
    const toggleTarget = toggleTargetMock();
    render(
      renderTargetList({ eligibleTargets: [], selected: new Set(), toggleTarget }),
    );

    expect(screen.getByText('No valid targets in range.')).toBeInTheDocument();
  });

  it('renders correctly when all targets are selected', () => {
    const toggleTarget = toggleTargetMock();
    const selected = new Set(eligibleTargets.map(t => t.name));
    const { container } = render(
      renderTargetList({ eligibleTargets, selected, toggleTarget }),
    );

    const rows = container.querySelectorAll('.abjure-target-row');
    rows.forEach(row => {
      expect(row).toHaveClass('abjure-target-selected');
    });
  });

  it('renders inside abjure-targets-list container', () => {
    const toggleTarget = toggleTargetMock();
    const { container } = render(
      renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget }),
    );

    expect(container.querySelector('.abjure-targets-list')).toBeInTheDocument();
  });

  it('uses target name as key', () => {
    const toggleTarget = toggleTargetMock();
    const { container } = render(
      renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget }),
    );

    const labels = container.querySelectorAll('label');
    expect(labels[0].querySelector('.abjure-target-name').textContent).toBe('Goblin');
    expect(labels[1].querySelector('.abjure-target-name').textContent).toBe('Orc');
    expect(labels[2].querySelector('.abjure-target-name').textContent).toBe('Skeleton');
  });

  it('checks checkbox when target is in selected set', () => {
    const toggleTarget = toggleTargetMock();
    const selected = new Set(['Orc']);
    render(renderTargetList({ eligibleTargets, selected, toggleTarget }));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
  });
});

// ── renderResultsSection Tests ─────────────────────────────────

describe('renderResultsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the save resolution header', () => {
    render(
      renderResultsSection({
        results,
        pendingPrompts,
        allResolved: false,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    expect(screen.getByText('Resolving DEX saving throws (DC 13)...')).toBeInTheDocument();
  });

  it('renders all results in abjure-results-list', () => {
    render(
      renderResultsSection({
        results,
        pendingPrompts,
        allResolved: false,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText('Skeleton')).toBeInTheDocument();
  });

  it('marks successful results with success class', () => {
    const { container } = render(
      renderResultsSection({
        results,
        pendingPrompts,
        allResolved: false,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const resultDivs = container.querySelectorAll('.abjure-result');
    const goblinResult = [...resultDivs].find(d => d.textContent.includes('Goblin'));
    const orcResult = [...resultDivs].find(d => d.textContent.includes('Orc'));

    expect(goblinResult).toHaveClass('abjure-result-fail');
    expect(orcResult).toHaveClass('abjure-result-success');
  });

  it('renders pending prompts with waiting message', () => {
    const { container } = render(
      renderResultsSection({
        results,
        pendingPrompts,
        allResolved: false,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const pendingDivs = container.querySelectorAll('.abjure-result-pending');
    expect(pendingDivs).toHaveLength(2);
    expect(screen.getByText('Player1')).toBeInTheDocument();
    expect(screen.getByText('Player2')).toBeInTheDocument();
  });

  it('marks pending prompts with pending class', () => {
    const { container } = render(
      renderResultsSection({
        results,
        pendingPrompts,
        allResolved: false,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const pendingDivs = container.querySelectorAll('.abjure-result-pending');
    expect(pendingDivs).toHaveLength(2);
  });

  it('shows "All targets resolved" when allResolved is true', () => {
    render(
      renderResultsSection({
        results,
        pendingPrompts: [],
        allResolved: true,
        saveType: 'CON',
        saveDc: 15,
      }),
    );

    expect(screen.getByText('All targets resolved.')).toBeInTheDocument();
  });

  it('does not show "All targets resolved" when allResolved is false', () => {
    render(
      renderResultsSection({
        results,
        pendingPrompts,
        allResolved: false,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    expect(screen.queryByText('All targets resolved.')).not.toBeInTheDocument();
  });

  it('shows roll details when roll is a number', () => {
    const { container } = render(
      renderResultsSection({
        results,
        pendingPrompts: [],
        allResolved: true,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const goblinResult = container.querySelector('.abjure-result')?.textContent;
    expect(goblinResult).toContain('Roll: 7');
    expect(goblinResult).toContain('+2');
    expect(goblinResult).toContain('= 9');
  });

  it('omits bonus when saveBonus is 0', () => {
    const { container } = render(
      renderResultsSection({
        results,
        pendingPrompts: [],
        allResolved: true,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const orcResult = [...container.querySelectorAll('.abjure-result')].find(d => d.textContent.includes('Orc'));
    expect(orcResult.textContent).toContain('Roll: 15');
    expect(orcResult.textContent).not.toContain('+');
  });

  it('omits roll details when roll is not a number', () => {
    const resultsNoRoll = [
      { targetName: 'Goblin', success: false, saveBonus: 0 },
    ];
    const { container } = render(
      renderResultsSection({
        results: resultsNoRoll,
        pendingPrompts: [],
        allResolved: true,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const resultText = container.querySelector('.abjure-result')?.textContent;
    expect(resultText).not.toContain('Roll:');
  });

  it('renders custom getResultText when provided', () => {
    const getResultText = (r) => `Custom: ${r.targetName} - ${r.success ? 'passed' : 'failed'}`;
    const { container } = render(
      renderResultsSection({
        results: [{ targetName: 'Goblin', success: true }],
        pendingPrompts: [],
        allResolved: true,
        saveType: 'DEX',
        saveDc: 13,
        getResultText,
      }),
    );

    const resultDiv = container.querySelector('.abjure-result');
    expect(resultDiv.textContent).toContain('Custom: Goblin - passed');
  });

  it('uses default text when getResultText is not provided and result is success', () => {
    const { container } = render(
      renderResultsSection({
        results: [{ targetName: 'Goblin', success: true }],
        pendingPrompts: [],
        allResolved: true,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const resultDiv = container.querySelector('.abjure-result');
    expect(resultDiv.textContent).toContain('Saved');
    expect(resultDiv.textContent).toContain('unaffected');
  });

  it('uses default text when getResultText is not provided and result is failure', () => {
    const { container } = render(
      renderResultsSection({
        results: [{ targetName: 'Goblin', success: false }],
        pendingPrompts: [],
        allResolved: true,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const resultDiv = container.querySelector('.abjure-result');
    expect(resultDiv.textContent).toContain('Failed');
  });

  it('renders inside abjure-results-list container', () => {
    const { container } = render(
      renderResultsSection({
        results,
        pendingPrompts,
        allResolved: false,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    expect(container.querySelector('.abjure-results-list')).toBeInTheDocument();
  });

  it('applies correct classes to result divs', () => {
    const { container } = render(
      renderResultsSection({
        results,
        pendingPrompts: [],
        allResolved: true,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const resultDivs = container.querySelectorAll('.abjure-result');
    expect(resultDivs[0]).toHaveClass('abjure-result');
    expect(resultDivs[0]).toHaveClass('abjure-result-fail');
    expect(resultDivs[1]).toHaveClass('abjure-result');
    expect(resultDivs[1]).toHaveClass('abjure-result-success');
  });

  it('renders with empty results and pending prompts', () => {
    render(
      renderResultsSection({
        results: [],
        pendingPrompts: [],
        allResolved: true,
        saveType: 'WIS',
        saveDc: 10,
      }),
    );

    expect(screen.getByText('Resolving WIS saving throws (DC 10)...')).toBeInTheDocument();
    expect(screen.getByText('All targets resolved.')).toBeInTheDocument();
  });
});

// ── logSaveEntry Tests ─────────────────────────────────────────

describe('logSaveEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('calls addEntry with all correct fields', () => {
    logSaveEntry(
      'TestCampaign',
      'Fireball',
      'Wizard',
      'Goblin',
      15,
      'DEX',
      false,
      8,
      [7],
      1,
      '1d20+1',
    );

    expect(logService.addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'roll',
      name: 'Fireball',
      characterName: 'Wizard',
      rollType: 'save-damage',
      targetName: 'Goblin',
      saveDc: 15,
      saveType: 'DEX',
      saveResult: 'failure',
      total: 8,
      rolls: [7],
      bonus: 1,
      formula: '1d20+1',
      timestamp: expect.any(Number),
    });
  });

  it('marks saveResult as success when success is true', () => {
    logSaveEntry(
      'TestCampaign',
      'Cone of Cold',
      'Wizard',
      'Orc',
      14,
      'CON',
      true,
      20,
      [19],
      1,
      '1d20+1',
    );

    const call = logService.addEntry.mock.calls[0][1];
    expect(call.saveResult).toBe('success');
    expect(call.saveDc).toBe(14);
    expect(call.saveType).toBe('CON');
  });

  it('uses zero bonus when bonus is 0', () => {
    logSaveEntry(
      'TestCampaign',
      'Magic Missile',
      'Wizard',
      'Goblin',
      13,
      'WIS',
      false,
      5,
      [5],
      0,
      '1d20',
    );

    const call = logService.addEntry.mock.calls[0][1];
    expect(call.bonus).toBe(0);
    expect(call.formula).toBe('1d20');
  });

  it('includes timestamp as current time', () => {
    const before = Date.now();
    logSaveEntry(
      'TestCampaign',
      'Burning Hands',
      'Wizard',
      'Orc',
      12,
      'DEX',
      true,
      15,
      [15],
      0,
      '1d20',
    );
    const after = Date.now();

    const call = logService.addEntry.mock.calls[0][1];
    expect(call.timestamp).toBeGreaterThanOrEqual(before);
    expect(call.timestamp).toBeLessThanOrEqual(after);
  });

  it('handles empty rolls array', () => {
    logSaveEntry(
      'TestCampaign',
      'Test Spell',
      'Caster',
      'Target',
      10,
      'STR',
      false,
      0,
      [],
      0,
      '1d20 (waiting)',
    );

    const call = logService.addEntry.mock.calls[0][1];
    expect(call.rolls).toEqual([]);
  });

  it('catches and logs addEntry errors without throwing', async () => {
    logService.addEntry.mockRejectedValue(new Error('network error'));

    await logSaveEntry(
      'TestCampaign',
      'Test Spell',
      'Caster',
      'Target',
      10,
      'DEX',
      false,
      0,
      [],
      0,
      '1d20',
    );

    expect(console.error).toHaveBeenCalledWith(
      '[AreaEffectModal] Error:',
      expect.any(Error),
    );
  });

  it('handles negative bonus values', () => {
    logSaveEntry(
      'TestCampaign',
      'Test Spell',
      'Caster',
      'Target',
      12,
      'DEX',
      false,
      3,
      [5],
      -2,
      '1d20-2',
    );

    const call = logService.addEntry.mock.calls[0][1];
    expect(call.bonus).toBe(-2);
    expect(call.formula).toBe('1d20-2');
  });

  it('passes through complex rolls array', () => {
    logSaveEntry(
      'TestCampaign',
      'Test Spell',
      'Caster',
      'Target',
      15,
      'CON',
      true,
      22,
      [18, 3, 1],
      0,
      '1d20',
    );

    const call = logService.addEntry.mock.calls[0][1];
    expect(call.rolls).toEqual([18, 3, 1]);
  });
});

// ── persistAndNotify Tests ─────────────────────────────────────

describe('persistAndNotify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls storage.set with correct arguments', () => {
    const combatSummary = {
      creatures: [{ name: 'Goblin', type: 'monster' }],
      players: [{ name: 'Wizard' }],
    };

    persistAndNotify(combatSummary, 'TestCampaign');

    expect(storage.default.set).toHaveBeenCalledWith(
      'combatSummary',
      combatSummary,
      'TestCampaign',
    );
  });

  it('dispatches combat-summary-updated event', () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    const combatSummary = {
      creatures: [],
      players: [],
    };

    persistAndNotify(combatSummary, 'TestCampaign');

    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.any(Object),
    );
    expect(dispatchEventSpy.mock.calls[0][0].type).toBe('combat-summary-updated');
  });

  it('dispatches a CustomEvent instance', () => {
    const combatSummary = { creatures: [], players: [] };
    vi.clearAllMocks();

    const eventDispatched = vi.fn();
    window.dispatchEvent = eventDispatched;

    persistAndNotify(combatSummary, 'TestCampaign');

    expect(eventDispatched).toHaveBeenCalledWith(
      expect.anything(),
    );
    expect(eventDispatched.mock.calls[0][0].type).toBe('combat-summary-updated');
  });

  it('persists the exact combatSummary object passed in', () => {
    const combatSummary = {
      creatures: [{ name: 'Dragon', type: 'boss', currentHp: 150, maxHp: 200 }],
      players: [{ name: 'Wizard', gridX: 5, gridY: 10 }],
      turn: 3,
    };

    persistAndNotify(combatSummary, 'DragonFight');

    expect(storage.default.set).toHaveBeenCalledWith(
      'combatSummary',
      combatSummary,
      'DragonFight',
    );
  });

  it('works with empty combatSummary', () => {
    const combatSummary = { creatures: [], players: [] };

    persistAndNotify(combatSummary, 'EmptyCampaign');

    expect(storage.default.set).toHaveBeenCalledWith(
      'combatSummary',
      combatSummary,
      'EmptyCampaign',
    );
  });
});
