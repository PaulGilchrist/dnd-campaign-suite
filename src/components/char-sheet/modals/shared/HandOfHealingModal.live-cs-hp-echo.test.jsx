// @maintained-by-ai
//
// LC 2026-11-14 improve — HoH PICKER-stage combatSummary HP echo. The chooser
// used to be a mount snapshot: mid-dwell writes to combatSummary.creatures
// (scoped PATCH / full-store POST — the board lanes) never refreshed the target
// radios' `N of M HP` text or the aria-label, and the stale cs-row max fed the
// honest commit-time full-HP gate into refusing a legitimate heal. The fix
// subscribes HandOfHealingPickerStage to useRuntimeValue('combatSummary',
// 'creatures') and re-anchors each row's HP pair on the LIVE board via
// resolveLiveTargetHp — bucket (currentHitPoints) stays canonical for `N`, the
// live cs row supplies the fallbacks (max). Wake order mirrors
// HandOfHealingModal.live-cs-conditions-echo.test.jsx: the combatData cache
// (getCombatSummary — the re-anchor's data source) refreshes BEFORE the store
// replace+notify, byte-for-byte the App.jsx handleChangeKeyEvent order
// (syncCombatSummaryCache → applyStoreUpdate). Display echoes must never POST.
//
// Bucket-side picker echo stays pinned in HandOfHealingModal.live-hp-echo.test
// .jsx (untouched); the real commit-time gate leg rides in
// healingHandler.handOfHealing.live-cs-hp-echo.test.js.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import HandOfHealingModal from './HandOfHealingModal.jsx';

// ── Mocked modules (everything except the runtime store itself) ──

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: (n) => (n || '').trim() },
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

// ── Re-imports ──

import * as combatData from '../../../../services/encounters/combatData.js';
import { setRuntimeObject, clearRuntimeState } from '../../../../hooks/runtime/useRuntimeState.js';
// ── Fixtures ──

const CAMPAIGN = 'test-campaign';
const MONK = 'Disciplined_Monk';
const FIGHTER = 'EvasiveFighter';

const fetchMock = vi.fn(() => Promise.reject(new Error('no network in test')));

// Whole-store combatSummary write as the sheet tab adopts it: the module cache
// refreshes first, then the 'combatSummary' store replace + notify wakes the
// picker subscription. Memory-only echo lane — it must never POST.
function externalCsWrite(board) {
  combatData.getCombatSummary.mockReturnValue(board);
  act(() => {
    setRuntimeObject('combatSummary', { creatures: board.creatures }, CAMPAIGN, true);
  });
}

function seedBucket(name, values) {
  act(() => {
    setRuntimeObject(name, values, CAMPAIGN, true); // skipSync — echo path, never POSTs
  });
}

const board = (fighterHp, fighterMax = 112, monkHp = 60) => ({
  creatures: [
    { name: MONK, type: 'player', currentHp: monkHp, maxHp: 112 },
    { name: FIGHTER, type: 'player', currentHp: fighterHp, maxHp: fighterMax },
  ],
});

function makePendingProps(confirmHeal) {
  return {
    healName: 'Hand of Healing',
    monkName: MONK,
    campaignName: CAMPAIGN,
    pending: true,
    creatureTargets: [
      { name: MONK, type: 'player', currentHp: 60, maxHp: 112 },
      { name: FIGHTER, type: 'player', currentHp: 60, maxHp: 112 },
    ],
    confirmHeal,
    onClose: vi.fn(),
  };
}

// ARIA-IS-NOT-TEXT law (playbook §2): aria-label values never enter getByText
// matching — probe them via getByRole name resolution / getAttribute.
const ariaOf = (name) =>
  screen.getByRole('radio', { name: new RegExp(`^Select ${name}`) }).getAttribute('aria-label');
const hpTextOf = (name) => {
  const radio = screen.getByRole('radio', { name: new RegExp(`^Select ${name}`) });
  return radio.closest('label').querySelector('.secondary-target-hp')?.textContent;
};

// ── Tests ──

describe('HandOfHealingModal picker - mid-dwell combatSummary HP echo (display-only, no reopen)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    combatData.getCombatSummary.mockReturnValue(board(60));
    seedBucket(MONK, { currentHitPoints: 60, hitPoints: 112, activeConditions: [] });
    // FIGHTER carries NO HP bucket → the cs row is its HP source (row-sourced
    // creatures: monsters, never-loaded chars — the face that went stale).
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearRuntimeState(MONK);
    clearRuntimeState(FIGHTER);
    clearRuntimeState('combatSummary');
  });

  it('cs-row write mid-dwell refreshes the radio aria-label AND visible HP text within one echo', () => {
    render(<HandOfHealingModal {...makePendingProps(vi.fn())} />);

    expect(ariaOf(FIGHTER)).toBe(`Select ${FIGHTER}, 60 of 112 HP`);
    expect(hpTextOf(FIGHTER)).toBe('60/112 HP (54%)');

    // External board write lowers current AND raises max (the stale-M face).
    externalCsWrite(board(20, 140));

    expect(ariaOf(FIGHTER)).toBe(`Select ${FIGHTER}, 20 of 140 HP`);
    expect(hpTextOf(FIGHTER)).toBe('20/140 HP (14%)');
    // Untouched rows keep their bucket-first values.
    expect(ariaOf(MONK)).toBe(`Select ${MONK}, 60 of 112 HP`);
    // Display-only echo: the subscription introduced ZERO store writes.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bucket stays canonical for `N`: a cs-row currentHp edit under a live bucket moves only the row-supplied max', () => {
    // setRuntimeObject MERGES store keys — rebuild the monk bucket from scratch
    // so it carries currentHitPoints ONLY (the PT#3 live face: picker aria reads
    // bucket-current + cs-row-max).
    clearRuntimeState(MONK);
    seedBucket(MONK, { currentHitPoints: 90, activeConditions: [] });
    render(<HandOfHealingModal {...makePendingProps(vi.fn())} />);

    // Bucket current wins for `N`; the mount board row supplies `M` (112).
    expect(ariaOf(MONK)).toBe(`Select ${MONK}, 90 of 112 HP`);

    // cs write: lower the row's currentHp, raise the max. The bucket current
    // stays canonical (90, not the row's 30); the live row supplies the new max.
    externalCsWrite({
      creatures: [
        { name: MONK, type: 'player', currentHp: 30, maxHp: 140 },
        { name: FIGHTER, type: 'player', currentHp: 60, maxHp: 112 },
      ],
    });

    expect(ariaOf(MONK)).toBe(`Select ${MONK}, 90 of 140 HP`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('full at mount + mid-dwell cs damage = healable legible and the heal commits (stale gate no longer refuses)', async () => {
    const confirmHeal = vi.fn().mockResolvedValue({
      targetName: FIGHTER, formula: '1d12 + 7', rolls: [5], bonus: 7,
      actualHeal: 12, targetCurrentHp: 52, targetMaxHp: 112,
    });
    externalCsWrite(board(112)); // fighter FULL at mount
    render(<HandOfHealingModal {...makePendingProps(confirmHeal)} />);
    expect(ariaOf(FIGHTER)).toBe(`Select ${FIGHTER}, 112 of 112 HP`);

    // Foreign board write damages the full target mid-dwell.
    externalCsWrite(board(40));
    expect(ariaOf(FIGHTER)).toBe(`Select ${FIGHTER}, 40 of 112 HP`);

    // The echo-legitimated row heals honestly: picker → result, no refusal.
    fireEvent.click(screen.getByRole('radio', { name: `Select ${FIGHTER}, 40 of 112 HP` }));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));

    await waitFor(() => {
      expect(confirmHeal).toHaveBeenCalledWith(FIGHTER);
    });
    expect(await screen.findByText(/HP restored/)).toBeInTheDocument();
    expect(screen.queryByText(/already at full HP/)).not.toBeInTheDocument();
  });

  it('mid-dwell cs heal-to-full makes the target ineligible: aria refreshes and the commit refusal rides inline', async () => {
    const confirmHeal = vi.fn().mockResolvedValue({
      refusal: `${FIGHTER} is already at full HP. No focus spent.`,
    });
    render(<HandOfHealingModal {...makePendingProps(confirmHeal)} />);
    expect(ariaOf(FIGHTER)).toBe(`Select ${FIGHTER}, 60 of 112 HP`);

    // Foreign board write heals the wounded target to full mid-dwell.
    externalCsWrite(board(112));
    expect(ariaOf(FIGHTER)).toBe(`Select ${FIGHTER}, 112 of 112 HP`);

    fireEvent.click(screen.getByRole('radio', { name: `Select ${FIGHTER}, 112 of 112 HP` }));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));

    const note = await screen.findByText(`${FIGHTER} is already at full HP. No focus spent.`);
    expect(note).toHaveClass('healing-restriction-note');
    // Picker stays open for another choice; no result stage.
    expect(screen.getByText('Choose target for Hand of Healing')).toBeInTheDocument();
    expect(screen.queryByText(/HP restored/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
