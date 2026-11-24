// @maintained-by-ai
// renderPopup routing for the condition-lane Results payload
// (improve-condition-aoe-results-face, 2026-11-24): the Stinking Cloud
// sheet-cast runner stamps the handler's resolved `{ type:
// 'aoe_condition_results' }` payload on the shared popup transport AFTER the
// last sequential save prompt resolves. This seam owns only the dispatch:
// the payload must mount the shared condition Results face (`.abjure-result`
// rows with saveEquationText equations, honest Poisoned/immune copy), and
// Close must drain popupHtml. Row copy itself is pinned by
// AOEConditionModal.subcomponents.results-face.test.jsx; payload record shape
// by stinkingCloudHandler.results-payload.test.js.
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { renderPopup } from './CharSheet.modals.jsx';

const RESULTS_PAYLOAD = {
  type: 'aoe_condition_results',
  name: 'Stinking Cloud',
  description: 'Stinking Cloud affects 1 creature(s).',
  conditionLabel: 'Poisoned',
  saveDc: 15,
  results: [
    { targetName: 'Goblin A', success: false, roll: 4, saveBonus: -1, total: 3, conditionApplied: true },
    { targetName: 'FixtureLandDruid', success: true, immune: true, roll: null, total: 0, saveBonus: 0, conditionApplied: false },
  ],
};

function renderAoeResultsPopup(popupHtml = RESULTS_PAYLOAD) {
  const setPopupHtml = vi.fn();
  render(
    <div>
      {renderPopup({
        popupHtml,
        setPopupHtml,
        playerStats: { name: 'TestWizard', level: 10 },
        campaignName: 'test-campaign',
        characters: [],
        popupHandlers: {},
      })}
    </div>
  );
  return setPopupHtml;
}

describe('renderPopup — aoe_condition_results routing', () => {
  it('mounts the shared Save Results face with per-target equation rows', () => {
    renderAoeResultsPopup();

    expect(document.querySelector('.sp-modal').textContent).toContain('Save Results');
    const rows = [...document.querySelectorAll('.abjure-results-list .abjure-result')].map(r => r.textContent);
    expect(rows).toContain('Goblin A: Failed — Poisoned! (rolled 4 + -1 = 3 vs DC 15)');
    expect(rows).toContain('FixtureLandDruid: Immune — no save needed, unaffected');
    expect(document.body.textContent).not.toMatch(/damage/i);
  });

  it('Close drains the popup state (server-first UI flag, no bucket writes here)', () => {
    const setPopupHtml = renderAoeResultsPopup();

    fireEvent.click(document.querySelector('.sp-actions button'));

    expect(setPopupHtml).toHaveBeenCalledWith(null);
  });
});
