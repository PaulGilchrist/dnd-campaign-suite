// @maintained-by-ai
// Contract tests for the browser tab title derivation in ./config.js
// (backlog KKK 2026-11-21): the tab must always answer "which campaign is
// this?" with a "<campaign> — <view>" pattern while a campaign is mounted,
// and stay neutral (app name) on the campaign-select screen.
import { describe, it, expect } from 'vitest';
import { APP_TITLE, SIDEBAR_BUTTONS, VIEWS, getDocumentTitle } from './config.js';

const CAMPAIGN = 'test-campaign';

describe('getDocumentTitle', () => {
  it('should keep the neutral app name while no campaign is selected', () => {
    expect(getDocumentTitle({ campaignName: null, activeView: null })).toBe(APP_TITLE);
    expect(getDocumentTitle({ campaignName: '', activeView: 'initiative' })).toBe(APP_TITLE);
  });

  it('should hide a stale campaign name once the selection screen is showing again', () => {
    // "Campaigns" only re-arms showCampaignSelection — campaignName and
    // activeView keep their last values, so the gate must cover them.
    expect(getDocumentTitle({
      campaignName: CAMPAIGN,
      showCampaignSelection: true,
      activeView: 'charSheet',
      characterName: 'Aragorn',
    })).toBe(APP_TITLE);
  });

  it('should prefix the campaign name to the sidebar label of the active view', () => {
    expect(getDocumentTitle({ campaignName: CAMPAIGN, activeView: 'initiative' }))
      .toBe('test-campaign — Initiative');
    expect(getDocumentTitle({ campaignName: CAMPAIGN, activeView: 'mapsManager' }))
      .toBe('test-campaign — Maps');
    expect(getDocumentTitle({ campaignName: CAMPAIGN, activeView: 'campaignLog' }))
      .toBe('test-campaign — Log');
  });

  it('should name the open character on the sheet view and fall back to its label without one', () => {
    expect(getDocumentTitle({
      campaignName: CAMPAIGN,
      activeView: VIEWS.CHAR_SHEET.name,
      characterName: 'Aragorn',
    })).toBe('test-campaign — Aragorn');
    expect(getDocumentTitle({ campaignName: CAMPAIGN, activeView: 'charSheet' }))
      .toBe('test-campaign — Character');
  });

  it('should show only the campaign name while the view is in transition (null)', () => {
    // handleCampaignSelect drops activeView before the new roster re-arms it.
    expect(getDocumentTitle({ campaignName: CAMPAIGN, activeView: null }))
      .toBe('test-campaign');
  });

  it('should never render a bare character name or CharSheets-alone while a campaign is mounted', () => {
    const titles = SIDEBAR_BUTTONS.map(button => getDocumentTitle({
      campaignName: CAMPAIGN,
      activeView: button.view,
      characterName: 'Aragorn',
    }));
    titles.forEach((title, i) => {
      expect(title.startsWith(`${CAMPAIGN} — `)).toBe(true);
      expect(title).not.toBe(SIDEBAR_BUTTONS[i].label);
    });
    expect(titles).not.toContain(APP_TITLE);
  });

  it('should give every sidebar button view a "<campaign> — <label>" title (consistency with the sidebar)', () => {
    // No characterName passed: even the sheet view falls back to its label.
    SIDEBAR_BUTTONS.forEach(button => {
      expect(getDocumentTitle({ campaignName: CAMPAIGN, activeView: button.view }))
        .toBe(`${CAMPAIGN} — ${button.label}`);
    });
  });
});
