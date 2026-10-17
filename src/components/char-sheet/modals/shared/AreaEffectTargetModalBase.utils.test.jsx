// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderTargetList, renderResultsSection, logSaveEntry, persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
import * as logService from '../../../../services/ui/logService.js';
import * as storage from '../../../../services/ui/storage.js';
import * as combatData from '../../../../services/encounters/combatData.js';

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

// Covers every result-row shape: roll+bonus, roll+zero-bonus, no roll at all.
const results = [
  { targetName: 'Goblin', success: false, roll: 7, saveBonus: 2, total: 9 },
  { targetName: 'Orc', success: true, roll: 15, saveBonus: 0, total: 15 },
  { targetName: 'Skeleton', success: false, saveBonus: 1, total: 8 },
];

function findResult(container, name) {
  return [...container.querySelectorAll('.abjure-result')]
    .find(d => d.querySelector('strong')?.textContent === name);
}

// ── renderTargetList Tests ─────────────────────────────────────

describe('renderTargetList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one checkbox row per target with name, type, and selected state', () => {
    const toggleTarget = vi.fn();
    const { container } = render(
      renderTargetList({ eligibleTargets, selected: new Set(['Goblin']), toggleTarget }),
    );

    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Orc')).toBeInTheDocument();
    expect(screen.getByText('Skeleton')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();

    const rows = container.querySelectorAll('.abjure-target-row');
    expect(rows[0]).toHaveClass('abjure-target-selected');
    expect(rows[1]).not.toHaveClass('abjure-target-selected');
    expect(rows[2]).not.toHaveClass('abjure-target-selected');

    const types = [...container.querySelectorAll('.abjure-target-type')].map(s => s.textContent.trim());
    expect(types).toEqual(['(monster)', '(monster)', '(undead)']);
  });

  it('calls toggleTarget with the target name when its checkbox changes', () => {
    const toggleTarget = vi.fn();
    render(renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget }));

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(toggleTarget.mock.calls).toEqual([['Goblin'], ['Orc']]);
  });

  it('shows "No valid targets in range." when there are no eligible targets', () => {
    render(renderTargetList({ eligibleTargets: [], selected: new Set(), toggleTarget: vi.fn() }));

    expect(screen.getByText('No valid targets in range.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows Careful Spell protected note only on protected targets', () => {
    const targets = [
      { name: 'Goblin', type: 'monster', carefulSpellProtected: true },
      { name: 'Orc', type: 'monster' },
    ];
    const { container } = render(
      renderTargetList({ eligibleTargets: targets, selected: new Set(), toggleTarget: vi.fn() }),
    );

    const notes = container.querySelectorAll('.sp-note');
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toContain('Careful Spell protected');
    expect(notes[0].closest('label').textContent).toContain('Goblin');
  });

  it('renders Heighten radios only with metamagicHeighten, marking the current pick and delegating selection', () => {
    const without = render(
      renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget: vi.fn() }),
    ).container.querySelectorAll('input[type="radio"]');
    expect(without).toHaveLength(0);

    const setHeightenTarget = vi.fn();
    const { container } = render(
      renderTargetList({ eligibleTargets, selected: new Set(), toggleTarget: vi.fn(), metamagicHeighten: true, heightenTarget: 'Goblin', setHeightenTarget }),
    );

    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();

    fireEvent.click(radios[1]);
    expect(setHeightenTarget).toHaveBeenCalledWith('Orc');
  });
});

// ── renderResultsSection Tests ─────────────────────────────────

describe('renderResultsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders save header and completion note when all targets are resolved', () => {
    render(
      renderResultsSection({
        results,
        pendingPrompts: [],
        allResolved: true,
        saveType: 'CON',
        saveDc: 15,
      }),
    );

    expect(screen.getByText('Resolving CON saving throws (DC 15)...')).toBeInTheDocument();
    expect(screen.getByText('All targets resolved.')).toBeInTheDocument();
  });

  it('formats result rows: saved/failed text, roll breakdown, no resolved note while pending', () => {
    const { container } = render(
      renderResultsSection({
        results,
        pendingPrompts: [],
        allResolved: false,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const goblin = findResult(container, 'Goblin');
    expect(goblin.textContent).toContain('Failed!');
    expect(goblin.textContent).toContain('(Roll: 7 +2 = 9)');

    const orc = findResult(container, 'Orc');
    expect(orc.textContent).toContain('Saved — unaffected');
    expect(orc.textContent).toContain('(Roll: 15 = 15)');

    // No roll number: roll breakdown omitted entirely.
    const skeleton = findResult(container, 'Skeleton');
    expect(skeleton.textContent).not.toContain('Roll:');

    expect(screen.queryByText('All targets resolved.')).not.toBeInTheDocument();
  });

  it('lists pending prompts with a waiting message', () => {
    const { container } = render(
      renderResultsSection({
        results: [],
        pendingPrompts: [
          { promptId: 'p1', targetName: 'Player1' },
          { promptId: 'p2', targetName: 'Player2' },
        ],
        allResolved: false,
        saveType: 'DEX',
        saveDc: 13,
      }),
    );

    const pendingDivs = container.querySelectorAll('.abjure-result-pending');
    expect(pendingDivs).toHaveLength(2);
    expect(pendingDivs[0].textContent).toContain('Player1');
    expect(pendingDivs[1].textContent).toContain('Player2');
    expect(container.querySelectorAll('.abjure-result-pending em')).toHaveLength(2);
  });

  it('uses custom getResultText when provided', () => {
    const { container } = render(
      renderResultsSection({
        results: [{ targetName: 'Goblin', success: true }],
        pendingPrompts: [],
        allResolved: true,
        saveType: 'DEX',
        saveDc: 13,
        getResultText: (r) => `Custom: ${r.targetName} - ${r.success ? 'passed' : 'failed'}`,
      }),
    );

    expect(findResult(container, 'Goblin').textContent).toContain('Custom: Goblin - passed');
  });
});

// ── logSaveEntry Tests ─────────────────────────────────────────

describe('logSaveEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs complete save-damage payloads, mapping success to saveResult and passing rolls through', () => {
    const fixedTime = 1700000000000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedTime);

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
    logSaveEntry({
      campaignName: 'TestCampaign',
      featureName: 'Fireball',
      attackerName: 'Wizard',
      targetName: 'Orc',
      saveDc: 15,
      saveType: 'DEX',
      success: true,
      total: 18,
      rolls: [],
      bonus: 0,
      formula: '1d20',
    });

    nowSpy.mockRestore();

    expect(logService.addEntry).toHaveBeenCalledTimes(2);
    expect(logService.addEntry).toHaveBeenNthCalledWith(1, 'TestCampaign', {
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
      timestamp: fixedTime,
    });
    expect(logService.addEntry).toHaveBeenNthCalledWith(2, 'TestCampaign', {
      type: 'roll',
      name: 'Fireball',
      characterName: 'Wizard',
      rollType: 'save-damage',
      targetName: 'Orc',
      saveDc: 15,
      saveType: 'DEX',
      saveResult: 'success',
      total: 18,
      rolls: [],
      bonus: 0,
      formula: '1d20',
      timestamp: fixedTime,
    });
  });

  it('catches addEntry rejections, logging without throwing', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logService.addEntry.mockRejectedValueOnce(new Error('network error'));

    expect(() => logSaveEntry({
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
    })).not.toThrow();

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AreaEffectModal] Error:',
        expect.any(Error),
      );
    });
    consoleErrorSpy.mockRestore();
  });
});

// ── persistAndNotify Tests ─────────────────────────────────────

describe('persistAndNotify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('caches, persists, and broadcasts combat-summary-updated', () => {
    const combatSummary = {
      creatures: [{ name: 'Goblin', type: 'monster' }],
      players: [{ name: 'Wizard' }],
    };
    const listener = vi.fn();
    window.addEventListener('combat-summary-updated', listener);
    try {
      persistAndNotify(combatSummary, 'TestCampaign');
    } finally {
      window.removeEventListener('combat-summary-updated', listener);
    }

    expect(combatData.setCombatSummaryCache).toHaveBeenCalledWith(combatSummary, 'TestCampaign');
    expect(storage.default.set).toHaveBeenCalledWith('combatSummary', combatSummary, 'TestCampaign');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toBeInstanceOf(CustomEvent);
  });
});
