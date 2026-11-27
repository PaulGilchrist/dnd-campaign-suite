// @maintained-by-ai 2026-11-27
/**
 * campaignService — client-side fetch contract for campaign/character CRUD.
 *
 * OPENER of the services/campaign/ block (test_maintain_queue lines 2002-2012).
 * This file owns the HTTP semantics at the fetch() boundary: URL encoding,
 * request methods/bodies, response-shape passthrough, error extraction, and
 * the silent-swallow vs rethrow split. Consumers (CampaignSelection.jsx,
 * useCharacterWizard.js, useCharacterManagement.js) wire these results into
 * React state — their behavior is NOT re-tested here.
 *
 * Canonical seam (this lane owns): raw `/api/campaigns`, `/api/campaigns/:campaign`,
 * and `/api/campaigns/:campaign/:file` (character JSON) — fetch-spied per-test,
 * never live. Mock shapes pinned against server/routes/campaigns-basic.js
 * ({ folders } / { files }) and campaigns-character.js ({ error } on 4xx,
 * { message, character, fileName } on create); consumer use of
 * `result.character` (useCharacterWizard) preserved in the create mock.
 *
 * BLOCK seam map (services/campaign/ siblings, queue order):
 *  - campaignService (THIS file): campaign listing + character-file CRUD.
 *  - factionsService, notesService, questsService, settlementsService,
 *    sessionsService: sub-collection CRUD under `/api/campaigns/:campaign/<coll>`
 *    — same fetch-spy idiom, own endpoints; do not re-pin /api/campaigns roots here.
 *  - inventoryService: transfer seam under .../transfer.
 *  - settlementGenerator: static `/data/*.json` name-bank generator — no
 *    /api surface; own mock family.
 *  - travelService, weatherService, randomEventService, sessionPlannerUtils:
 *    no direct fetch — runtime-store / pure-utility lanes (server-first via
 *    the runtime store per AGENTS.md), not fetch-contract lanes.
 *  - Server-side ownership lives in server/routes/campaigns-*.test.js
 *    (out of this queue's scope — noted, not duplicated here).
 *
 * Campaign lockdown: fetch is spied with a fail-loud default (any unmocked
 * call rejects), so fixture campaign names never reach a live server or
 * mutate anything; only 'test-campaign' appears in sanctioned-write fixtures.
 *
 * Consolidated 2026-11-27: success + URL-encode pairs share one full-shape
 * RequestInit census per function; non-2xx/network-reject error paths are
 * assertion-identical and run as it.each tables; every error path pins its
 * single console.error (non-silent doctrine).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCharacterFolders,
  getCharacterFiles,
  loadCharacters,
  deleteCharacter,
  createCharacter,
  updateCharacter
} from './campaignService.js';

describe('campaignService', () => {
  let fetchSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Fail-loud default: any fetch a test forgets to mock rejects instead of
    // reaching a live server (campaign lockdown — never real /api here).
    fetchSpy.mockImplementation((url) => {
      throw new Error(`unmocked fetch in campaignService test: ${url}`);
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCharacterFolders', () => {
    it('returns the folders array from a GET to /api/campaigns (no request body)', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ folders: ['Campaign 1', 'Campaign 2', 'test-campaign'] })
      });

      const result = await getCharacterFolders();

      expect(result).toEqual(['Campaign 1', 'Campaign 2', 'test-campaign']);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns');
    });

    it('returns empty array when folders key is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await getCharacterFolders();

      expect(result).toEqual([]);
    });

    // Rethrow contract (2026-11-02 BG): callers must distinguish an outage
    // from a healthy-but-empty folder list to show the retry path. Both
    // failure triggers (non-2xx, network reject) land in the same
    // log-and-rethrow branch — assertion-identical, so one it.each table.
    it.each([
      ['API error', () => Promise.resolve({ ok: false, statusText: 'Not Found' }), 'Failed to fetch character folders'],
      ['network error', () => Promise.reject(new Error('Network error')), 'Network error']
    ])('rethrows on %s and logs (failure ≠ healthy empty list)', async (_label, impl, message) => {
      fetchSpy.mockImplementation(impl);

      await expect(getCharacterFolders()).rejects.toThrow(message);
      // Failure stays non-silent (AGENTS.md: console.error, not silence).
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching character folders:',
        expect.any(Error)
      );
    });
  });

  describe('getCharacterFiles', () => {
    it('GETs the URL-encoded campaign and returns the files array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: ['char1.json', 'char2.json'] })
      });

      const result = await getCharacterFiles('My Campaign');

      expect(result).toEqual(['char1.json', 'char2.json']);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/My%20Campaign');
    });

    it('returns empty array when files key is missing', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual([]);
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/campaign1');
    });

    // Swallow-to-[] branch for both failure triggers (same catch); the
    // swallow must stay non-silent (AGENTS.md: console.error, not silence).
    it.each([
      ['API error', () => Promise.resolve({ ok: false, statusText: 'Not Found' })],
      ['network error', () => Promise.reject(new Error('Network error'))]
    ])('returns empty array on %s without throwing', async (_label, impl) => {
      fetchSpy.mockImplementation(impl);

      const result = await getCharacterFiles('campaign1');

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching character files:',
        expect.any(Error)
      );
    });
  });

  describe('loadCharacters', () => {
    it('fetches every URL-encoded per-file URL in order and returns parsed characters', async () => {
      const bodies = {
        '/api/campaigns/My%20Campaign/hero.json': { name: 'Hero' },
        '/api/campaigns/My%20Campaign/villain.json': { name: 'Villain' }
      };
      // URL-keyed impl (not an order-dependent *Once chain): each response is
      // pinned to its exact encoded URL, so a wrong URL yields an undefined
      // body and fails the result census below.
      fetchSpy.mockImplementation((url) =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(bodies[url]) })
      );

      const result = await loadCharacters('My Campaign', ['hero.json', 'villain.json']);

      expect(result).toEqual([{ name: 'Hero' }, { name: 'Villain' }]);
      expect(fetchSpy.mock.calls.map(call => call[0])).toEqual([
        '/api/campaigns/My%20Campaign/hero.json',
        '/api/campaigns/My%20Campaign/villain.json'
      ]);
    });

    // All-or-nothing: any single failure resolves the whole batch to [] and
    // logs — both failure triggers hit the same Promise.all catch.
    it.each([
      [
        'one non-2xx response',
        (url) => url.endsWith('char2.json')
          ? Promise.resolve({ ok: false, statusText: 'Not Found' })
          : Promise.resolve({ ok: true, json: () => Promise.resolve({ name: 'Character 1' }) })
      ],
      ['network error', () => Promise.reject(new Error('Network error'))]
    ])('returns empty array for the whole batch when %s', async (_label, impl) => {
      fetchSpy.mockImplementation(impl);

      const result = await loadCharacters('campaign1', ['char1.json', 'char2.json']);

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading characters:',
        expect.any(Error)
      );
    });

    it('returns empty array without calling fetch for empty file list', async () => {
      const result = await loadCharacters('campaign1', []);

      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteCharacter', () => {
    it('sends DELETE with method-only RequestInit to the encoded URL and resolves undefined', async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      await expect(
        deleteCharacter('My Campaign', 'char 1.json')
      ).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/campaigns/My%20Campaign/char%201.json',
        { method: 'DELETE' }
      );
    });

    // This layer owns the single console warning for character-delete
    // failures (App.jsx wrapper alerts only — single-warn doctrine); both
    // failure triggers share the log-and-rethrow branch.
    it.each([
      ['API error', () => Promise.resolve({ ok: false, statusText: 'Not Found' }), 'Failed to delete character: Not Found'],
      ['network error', () => Promise.reject(new Error('Network error')), 'Network error']
    ])('rethrows %s with exactly one console warning', async (_label, impl, message) => {
      fetchSpy.mockImplementation(impl);

      await expect(
        deleteCharacter('campaign1', 'char1.json')
      ).rejects.toThrow(message);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error deleting character:',
        expect.any(Error)
      );
    });
  });

  describe('createCharacter', () => {
    it('POSTs full-shape RequestInit to the encoded URL and returns the parsed response', async () => {
      // Response shape pinned to campaigns-character.js create success:
      // { message, character, fileName }; useCharacterWizard reads .character.
      const characterData = { name: 'New Character', level: 1 };
      const responseData = {
        message: 'Character created',
        character: { ...characterData, id: '123' },
        fileName: 'new-character.json'
      };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData)
      });

      const result = await createCharacter('My Campaign', characterData);

      expect(result).toEqual(responseData);
      // Raw name in body, encoded name in URL.
      expect(fetchSpy).toHaveBeenCalledWith('/api/campaigns/My%20Campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignName: 'My Campaign', character: characterData })
      });
    });

    it.each([
      [
        'statusText fallback when the 4xx carries no JSON body',
        () => Promise.resolve({ ok: false, status: 400, statusText: 'Bad Request' }),
        'Failed to create character: Bad Request'
      ],
      [
        'server { error } body over statusText',
        () => Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () => Promise.resolve({ error: 'A character with that name already exists' })
        }),
        'A character with that name already exists'
      ],
      ['network error', () => Promise.reject(new Error('Network error')), 'Network error']
    ])('rethrows on %s with exactly one console warning', async (_label, impl, message) => {
      fetchSpy.mockImplementation(impl);

      await expect(
        createCharacter('test-campaign', { name: 'Test' })
      ).rejects.toThrow(message);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error creating character:',
        expect.any(Error)
      );
    });
  });

  describe('updateCharacter', () => {
    // PUT success census: full-shape RequestInit both for plain overwrite and
    // rename. JSON.stringify drops the undefined originalFileName key, so
    // same-name PUTs carry no rename hint; renames encode campaign + file.
    it.each([
      [
        'same name',
        ['campaign1', 'char1.json', { name: 'Updated Character', level: 5 }, undefined],
        '/api/campaigns/campaign1/char1.json',
        JSON.stringify({ name: 'Updated Character', level: 5 })
      ],
      [
        'rename',
        ['My Campaign', 'new name.json', { name: 'New Name', level: 5 }, 'old name.json'],
        '/api/campaigns/My%20Campaign/new%20name.json',
        JSON.stringify({ name: 'New Name', level: 5, originalFileName: 'old name.json' })
      ]
    ])('PUTs full-shape RequestInit on %s and returns the parsed response', async (_label, args, url, body) => {
      const responseData = { character: args[2] };

      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData)
      });

      const result = await updateCharacter(...args);

      expect(result).toEqual(responseData);
      expect(fetchSpy).toHaveBeenCalledWith(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body
      });
    });

    it.each([
      ['API error', () => Promise.resolve({ ok: false, statusText: 'Conflict' }), 'Failed to update character: Conflict'],
      ['network error', () => Promise.reject(new Error('Network error')), 'Network error']
    ])('rethrows %s with exactly one console warning', async (_label, impl, message) => {
      fetchSpy.mockImplementation(impl);

      await expect(
        updateCharacter('campaign1', 'char1.json', { name: 'Test' })
      ).rejects.toThrow(message);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error updating character:',
        expect.any(Error)
      );
    });
  });
});
