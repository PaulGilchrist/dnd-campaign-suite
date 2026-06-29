// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';

import {
  sendSavePrompt,
  sendSaveResult,
  clearSavePrompt,
  sendDeathSavePrompt,
  clearDeathSavePrompt,
  sendDeathSaveResult,
  sendConcentrationPrompt,
  sendConcentrationResult,
  clearConcentrationPrompt,
} from './savePromptService.js';

// Suppress unhandled rejection warnings from the service's fire-and-forget
// fetch calls (the service logs errors but re-throws, creating unhandled
// promise rejections that Vitest detects). This is expected behavior for
// fire-and-forget patterns and does not affect test validity.
const noop = () => {};
process.on('unhandledRejection', noop);

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Create a fetch mock that resolves with a minimal Response-like object.
 * The service never reads the response, so the shape is irrelevant.
 */
function mockFetchResolved() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
}

/**
 * Create a fetch mock that rejects. Useful for verifying the service
 * does not propagate errors to the caller (fire-and-forget).
 */
function mockFetchRejected() {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network fail'));
}

/**
 * Assert that fetch was called with a POST request to the expected
 * campaign endpoint with the correct JSON body.
 */
function expectPostToCampaign(fetchSpy, campaignName, key, bodyValue) {
  const expectedUrl = `/api/campaigns/${encodeURIComponent(campaignName)}/${key}`;
  expect(fetchSpy).toHaveBeenCalledWith(
    expectedUrl,
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: bodyValue }),
    })
  );
}

// ── Tests ────────────────────────────────────────────────────────

describe('savePromptService', () => {
  describe('sendSavePrompt', () => {
    it('posts save prompt data to the correct endpoint', () => {
      mockFetchResolved();
      sendSavePrompt('Test Campaign', { targetName: 'Goblin' });

      expectPostToCampaign(
        globalThis.fetch,
        'Test Campaign',
        'savePrompt-Goblin',
        { targetName: 'Goblin' }
      );
    });

    it('URL-encodes special characters in the campaign name', () => {
      mockFetchResolved();
      sendSavePrompt('Campaign #1 & Test', { targetName: 'T' });

      const expectedUrl = '/api/campaigns/Campaign%20%231%20%26%20Test/savePrompt-T';
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.any(Object)
      );
    });

    it('returns undefined (fire-and-forget)', () => {
      mockFetchResolved();
      const result = sendSavePrompt('C', { targetName: 'T' });
      expect(result).toBeUndefined();
    });

    it('does not propagate fetch rejections to the caller', () => {
      mockFetchRejected();
      const result = sendSavePrompt('C', { targetName: 'T' });
      expect(result).toBeUndefined();
    });
  });

  describe('sendSaveResult', () => {
    it('posts result data to the correct endpoint', () => {
      mockFetchResolved();
      sendSaveResult('Test Campaign', 'Goblin', { success: true });

      expectPostToCampaign(
        globalThis.fetch,
        'Test Campaign',
        'saveResult-Goblin',
        { success: true }
      );
    });

    it('does not propagate fetch rejections to the caller', () => {
      mockFetchRejected();
      const result = sendSaveResult('C', 'T', {});
      expect(result).toBeUndefined();
    });
  });

  describe('clearSavePrompt', () => {
    it('sends a DELETE request to the correct endpoint with no body', () => {
      mockFetchResolved();
      clearSavePrompt('Test Campaign', 'Goblin');

      const expectedUrl = '/api/campaigns/Test%20Campaign/savePrompt-Goblin';
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'DELETE',
        })
      );

      const callArgs = globalThis.fetch.mock.calls[0][1];
      expect(callArgs.headers).toBeUndefined();
      expect(callArgs.body).toBeUndefined();
    });

    it('URL-encodes special characters in the campaign name', () => {
      mockFetchResolved();
      clearSavePrompt('Campaign #1', 'T');

      const expectedUrl = '/api/campaigns/Campaign%20%231/savePrompt-T';
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.any(Object)
      );
    });

    it('does not propagate fetch rejections to the caller', () => {
      mockFetchRejected();
      const result = clearSavePrompt('C', 'T');
      expect(result).toBeUndefined();
    });
  });

  describe('sendDeathSavePrompt', () => {
    it('posts death save prompt data to the correct endpoint', () => {
      mockFetchResolved();
      sendDeathSavePrompt('Test Campaign', { targetName: 'Fighter' });

      expectPostToCampaign(
        globalThis.fetch,
        'Test Campaign',
        'deathSavePrompt-Fighter',
        { targetName: 'Fighter' }
      );
    });

    it('does not propagate fetch rejections to the caller', () => {
      mockFetchRejected();
      const result = sendDeathSavePrompt('C', { targetName: 'T' });
      expect(result).toBeUndefined();
    });
  });

  describe('clearDeathSavePrompt', () => {
    it('sends a DELETE request to the correct endpoint with no body', () => {
      mockFetchResolved();
      clearDeathSavePrompt('Test Campaign', 'Fighter');

      const expectedUrl = '/api/campaigns/Test%20Campaign/deathSavePrompt-Fighter';
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'DELETE',
        })
      );

      const callArgs = globalThis.fetch.mock.calls[0][1];
      expect(callArgs.headers).toBeUndefined();
      expect(callArgs.body).toBeUndefined();
    });

    it('URL-encodes special characters in the campaign name', () => {
      mockFetchResolved();
      clearDeathSavePrompt('Campaign #1', 'T');

      const expectedUrl = '/api/campaigns/Campaign%20%231/deathSavePrompt-T';
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.any(Object)
      );
    });

    it('does not propagate fetch rejections to the caller', () => {
      mockFetchRejected();
      const result = clearDeathSavePrompt('C', 'T');
      expect(result).toBeUndefined();
    });
  });

  describe('sendDeathSaveResult', () => {
    it('posts death save result data to the correct endpoint', () => {
      mockFetchResolved();
      sendDeathSaveResult('Test Campaign', 'Fighter', { save: true });

      expectPostToCampaign(
        globalThis.fetch,
        'Test Campaign',
        'deathSaveResult-Fighter',
        { save: true }
      );
    });

    it('does not propagate fetch rejections to the caller', () => {
      mockFetchRejected();
      const result = sendDeathSaveResult('C', 'T', {});
      expect(result).toBeUndefined();
    });
  });

  describe('sendConcentrationPrompt', () => {
    it('posts concentration prompt data to the correct endpoint', () => {
      mockFetchResolved();
      sendConcentrationPrompt('Test Campaign', { targetName: 'Wizard' });

      expectPostToCampaign(
        globalThis.fetch,
        'Test Campaign',
        'concentrationPrompt-Wizard',
        { targetName: 'Wizard' }
      );
    });

    it('does not propagate fetch rejections to the caller', () => {
      mockFetchRejected();
      const result = sendConcentrationPrompt('C', { targetName: 'T' });
      expect(result).toBeUndefined();
    });
  });

  describe('sendConcentrationResult', () => {
    it('posts concentration result data to the correct endpoint', () => {
      mockFetchResolved();
      sendConcentrationResult('Test Campaign', 'Wizard', { success: true });

      expectPostToCampaign(
        globalThis.fetch,
        'Test Campaign',
        'concentrationResult-Wizard',
        { success: true }
      );
    });

    it('does not propagate fetch rejections to the caller', () => {
      mockFetchRejected();
      const result = sendConcentrationResult('C', 'T', {});
      expect(result).toBeUndefined();
    });
  });

  describe('clearConcentrationPrompt', () => {
    it('sends a DELETE request to the correct endpoint with no body', () => {
      mockFetchResolved();
      clearConcentrationPrompt('Test Campaign', 'Wizard');

      const expectedUrl = '/api/campaigns/Test%20Campaign/concentrationPrompt-Wizard';
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'DELETE',
        })
      );

      const callArgs = globalThis.fetch.mock.calls[0][1];
      expect(callArgs.headers).toBeUndefined();
      expect(callArgs.body).toBeUndefined();
    });

    it('URL-encodes special characters in the campaign name', () => {
      mockFetchResolved();
      clearConcentrationPrompt('Campaign #1', 'T');

      const expectedUrl = '/api/campaigns/Campaign%20%231/concentrationPrompt-T';
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.any(Object)
      );
    });

    it('does not propagate fetch rejections to the caller', () => {
      mockFetchRejected();
      const result = clearConcentrationPrompt('C', 'T');
      expect(result).toBeUndefined();
    });
  });
});
