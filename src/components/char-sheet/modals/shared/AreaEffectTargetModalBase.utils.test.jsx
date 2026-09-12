// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderTargetList, renderResultsSection, logSaveEntry, persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import * as logService from '../../../../services/ui/logService.js';
import * as storage from '../../../../services/ui/storage.js';
import * as combatData from '../../../../services/encounters/combatData.js';

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

vi.mock('../../../../services/encounters/combatData.js', () => ({
  setCombatSummaryCache: vi.fn(),
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

function createToggleTarget() {
  return vi.fn();
}

// ── renderTargetList Tests ─────────────────────────────────────

describe('renderTargetList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders eligible targets with names, types, and checkboxes', () => {
    const toggleTarget = createToggleTarget();
    render(renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget }));

    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText('Skeleton')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    const typeSpans = document.querySelectorAll('.abjure-target-type');
    const types = [...typeSpans].map(s => s.textContent.trim());
    expect(types).toContain('(monster)');
    expect(types).toContain('(undead)');
  });

  it('renders selected targets with selected class', () => {
    const toggleTarget = createToggleTarget();
    const selected = new Set(['Goblin']);
    const { container } = render(
      renderTargetList({ eligibleTargets, selected, toggleTarget }),
    );

    const rows = container.querySelectorAll('.abjure-target-row');
    expect(rows[0]).toHaveClass('abjure-target-selected');
    expect(rows[1]).not.toHaveClass('abjure-target-selected');
    expect(rows[2]).not.toHaveClass('abjure-target-selected');
  });

  it('calls toggleTarget when checkbox is changed', () => {
    const toggleTarget = createToggleTarget();
    render(renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget }));

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes[0].click();
    expect(toggleTarget).toHaveBeenCalledWith('Goblin');
    checkboxes[1].click();
    expect(toggleTarget).toHaveBeenCalledWith('Orc');
  });

  it('shows "No valid targets in range" when eligibleTargets is empty', () => {
    const toggleTarget = createToggleTarget();
    render(
      renderTargetList({ eligibleTargets: [], selected: new Set(), toggleTarget }),
    );

    expect(screen.getByText('No valid targets in range.')).toBeInTheDocument();
  });

  it('renders carefulSpellProtected indicator when target has it', () => {
    const toggleTarget = createToggleTarget();
    const targetsWithCareful = [
      { name: 'Goblin', type: 'monster', carefulSpellProtected: true },
    ];
    const { container } = render(
      renderTargetList({ eligibleTargets: targetsWithCareful, selected: new Set(), toggleTarget }),
    );

    const note = container.querySelector('.sp-note');
    expect(note).toBeInTheDocument();
    expect(note.textContent).toContain('Careful Spell protected');
  });

  it('renders heighten radio buttons when metamagicHeighten is provided', () => {
    const toggleTarget = createToggleTarget();
    const { container } = render(
      renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget, metamagicHeighten: true }),
    );

    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(3);
  });

  it('calls setHeightenTarget when heighten radio is selected', () => {
    const toggleTarget = createToggleTarget();
    const setHeightenTarget = vi.fn();
    const { container } = render(
      renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget, metamagicHeighten: true, setHeightenTarget }),
    );

    const radios = container.querySelectorAll('input[type="radio"]');
    radios[0].click();
    expect(setHeightenTarget).toHaveBeenCalledWith('Goblin');
  });
});

// ── renderResultsSection Tests ─────────────────────────────────

describe('renderResultsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders save resolution header with save type and DC', () => {
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

  it('renders results with success/fail text based on success prop', () => {
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
    const goblinResult = [...resultDivs].find(d => d.querySelector('strong')?.textContent === 'Goblin');
    const orcResult = [...resultDivs].find(d => d.querySelector('strong')?.textContent === 'Orc');

    expect(goblinResult.textContent).toContain('Failed');
    expect(orcResult.textContent).toContain('Saved');
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
    const waitingMessages = container.querySelectorAll('.abjure-result-pending em');
    expect(waitingMessages).toHaveLength(2);
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

  it('renders roll details when roll is a number, omitting bonus when zero', () => {
    const { container } = render(
      renderResultsSection({
        results,
        pendingPrompts: [],
        allResolved: true,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const goblinResult = [...container.querySelectorAll('.abjure-result')].find(d => d.querySelector('strong')?.textContent === 'Goblin');
    expect(goblinResult.textContent).toContain('Roll: 7');
    expect(goblinResult.textContent).toContain('+2');
    expect(goblinResult.textContent).toContain('= 9');

    const orcResult = [...container.querySelectorAll('.abjure-result')].find(d => d.querySelector('strong')?.textContent === 'Orc');
    expect(orcResult.textContent).toContain('Roll: 15');
    expect(orcResult.textContent).not.toContain('+');

    const skeletonResult = [...container.querySelectorAll('.abjure-result')].find(d => d.querySelector('strong')?.textContent === 'Skeleton');
    expect(skeletonResult.textContent).not.toContain('Roll:');
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

  it('shows no resolved message when allResolved is false with empty data', () => {
    const { container } = render(
      renderResultsSection({
        results: [],
        pendingPrompts: [],
        allResolved: false,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    expect(container.querySelector('.abjure-results-list')).toBeInTheDocument();
    expect(screen.queryByText('All targets resolved.')).not.toBeInTheDocument();
  });
});

// ── logSaveEntry Tests ─────────────────────────────────────────

describe('logSaveEntry', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('calls addEntry with all correct fields for failure', () => {
    logSaveEntry({
      campaignName: 'TestCampaign',
      featureName: 'Fireball',
      attackerName: 'Wizard',
      targetName: 'Goblin',
      saveDc: 15,
      saveType: 'DEX',
      success: false,
      total: 8,
      rolls: [7],
      bonus: 1,
      formula: '1d20+1',
    });

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

  it('calls addEntry with success result when success is true', () => {
    const fixedTime = 1700000000000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedTime);
    logSaveEntry({
      campaignName: 'TestCampaign',
      featureName: 'Fireball',
      attackerName: 'Wizard',
      targetName: 'Goblin',
      saveDc: 15,
      saveType: 'DEX',
      success: true,
      total: 18,
      rolls: [17],
      bonus: 1,
      formula: '1d20+1',
    });
    nowSpy.mockRestore();

    const call = logService.addEntry.mock.calls[0][1];
    expect(call.saveResult).toBe('success');
    expect(call.total).toBe(18);
    expect(call.timestamp).toBe(fixedTime);
  });

  it('handles empty rolls array', () => {
    logSaveEntry({
      campaignName: 'TestCampaign',
      featureName: 'Test Spell',
      attackerName: 'Caster',
      targetName: 'Target',
      saveDc: 10,
      saveType: 'STR',
      success: false,
      total: 0,
      rolls: [],
      bonus: 0,
      formula: '1d20 (waiting)',
    });

    const call = logService.addEntry.mock.calls[0][1];
    expect(call.rolls).toEqual([]);
  });

  it('catches and logs addEntry errors without throwing', async () => {
    logService.addEntry.mockRejectedValueOnce(new Error('network error'));

    logSaveEntry({
      campaignName: 'TestCampaign',
      featureName: 'Test Spell',
      attackerName: 'Caster',
      targetName: 'Target',
      saveDc: 10,
      saveType: 'DEX',
      success: false,
      total: 0,
      rolls: [],
      bonus: 0,
      formula: '1d20',
    });

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AreaEffectModal] Error:',
        expect.any(Error),
      );
    });
  });
});

// ── persistAndNotify Tests ─────────────────────────────────────

describe('persistAndNotify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls setCombatSummaryCache, storage.set, and dispatches event', () => {
    const combatSummary = {
      creatures: [{ name: 'Goblin', type: 'monster' }],
      players: [{ name: 'Wizard' }],
    };

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    persistAndNotify(combatSummary, 'TestCampaign');

    expect(combatData.setCombatSummaryCache).toHaveBeenCalledWith(combatSummary, 'TestCampaign');
    expect(storage.default.set).toHaveBeenCalledWith(
      'combatSummary',
      combatSummary,
      'TestCampaign',
    );
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'combat-summary-updated' }),
    );
  });
});
