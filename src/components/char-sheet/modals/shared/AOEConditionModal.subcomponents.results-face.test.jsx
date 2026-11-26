// @maintained-by-ai 2026-11-24
// The condition-lane Results face itself (improve-condition-aoe-results-face,
// 2026-11-24). The Stinking Cloud sheet-cast chain now terminates on this SAME
// ResultsSummaryModal the AOEConditionModal selection lane rides (renderPopup
// routes the handler's `aoe_condition_results` payload here), so the face's
// copy laws are pinned directly:
//   · per-target `.abjure-result` rows reuse the damage lane's visual vocabulary
//     and print the reconciled `rolled R + B = T vs DC D` equation via
//     saveEquationText on BOTH verdicts;
//   · condition outcomes are honest — "Saved — unaffected" / "Failed — Poisoned!"
//     and NEVER damage or halving vocabulary (the condition lane deals none);
//   · cast-time immune skips print "Immune — no save needed, unaffected" with
//     NO equation (there was no roll to reconcile);
//   · the count line separates saved / failed / immune / dismissed.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ResultsSummaryModal } from './AOEConditionModal.subcomponents.jsx';

const DAMAGE_LANE_RESULTS = [
  { targetName: 'Goblin A', success: true, roll: 13, saveBonus: 3, total: 16, conditionApplied: false },
  { targetName: 'Goblin B', success: false, roll: 4, saveBonus: -1, total: 3, conditionApplied: true },
  { targetName: 'Orc Warden', success: true, immune: true, roll: null, total: 0, saveBonus: 0, conditionApplied: false },
  { targetName: 'Skull Chief', success: true, dismissed: true, roll: null, total: 0, saveBonus: 0, conditionApplied: false },
];

function renderFace(overrides = {}) {
  const onClose = vi.fn();
  render(
    <ResultsSummaryModal
      results={DAMAGE_LANE_RESULTS}
      conditionLabel="Poisoned"
      saveDc={15}
      onClose={onClose}
      {...overrides}
    />
  );
  return onClose;
}

function rowTexts() {
  return [...document.querySelectorAll('.abjure-results-list .abjure-result')].map(r => r.textContent);
}

describe('ResultsSummaryModal — condition-lane Results face', () => {
  it('renders reconciled saveEquationText rows on both verdicts with the shared abjure vocabulary', () => {
    renderFace();

    const rows = rowTexts();
    expect(rows).toContain('Goblin A: Saved — unaffected (rolled 13 + 3 = 16 vs DC 15)');
    expect(rows).toContain('Goblin B: Failed — Poisoned! (rolled 4 + -1 = 3 vs DC 15)');
    // Verdict coloring classes are the damage lane's shared vocabulary.
    expect(document.querySelector('.abjure-result-success')).toBeTruthy();
    expect(document.querySelector('.abjure-result-fail')).toBeTruthy();
  });

  it('never claims damage or halving on the condition lane', () => {
    renderFace();

    expect(document.body.textContent).not.toMatch(/damage/i);
    expect(document.body.textContent).not.toMatch(/halv/i);
  });

  it('states immune skips honestly — no equation for a save that never happened', () => {
    renderFace();

    const rows = rowTexts();
    expect(rows).toContain('Orc Warden: Immune — no save needed, unaffected');
    expect(document.body.textContent).not.toContain('Orc Warden: Saved — unaffected (rolled');
  });

  it('counts saved, failed, immune and dismissed targets on separate legs', () => {
    renderFace();

    expect(document.querySelector('.sp-body p').textContent)
      .toBe('1 target saved, 1 target failed, 1 dismissed, 1 immune.');
  });

  it('Close button drains the face via onClose', () => {
    const onClose = renderFace();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
