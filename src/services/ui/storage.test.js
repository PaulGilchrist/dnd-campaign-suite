// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import storage from './storage.js';
import utils from './utils.js';

describe('storage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    // ── get(key, campaignName) ──────────────────────────────────────
    describe('get', () => {
        it('returns null when no campaignName provided', async () => {
            const result = await storage.get('myKey');
            expect(result).toBeNull();
        });

        it('returns null when campaignName is empty string', async () => {
            const result = await storage.get('myKey', '');
            expect(result).toBeNull();
        });

        it('returns null when campaignName is undefined', async () => {
            const result = await storage.get('myKey');
            expect(result).toBeNull();
        });

        it('fetches from API and returns value when campaignName is provided', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: { apiData: 42 } })
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toEqual({ apiData: 42 });
            expect(fakeFetch).toHaveBeenCalledWith(
                '/api/campaigns/myCampaign/myKey'
            );
        });

        it('does NOT read from localStorage when campaignName is provided', async () => {
            localStorage.setItem('myKey', JSON.stringify({ local: true }));
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: { apiData: 42 } })
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toEqual({ apiData: 42 });
            expect(localStorage.getItem('myKey')).toBe(JSON.stringify({ local: true }));
        });

        it('does NOT cache API response in localStorage', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: { apiData: 42 } })
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            await storage.get('myKey', 'myCampaign');
            expect(localStorage.getItem('myKey')).toBeNull();
        });

        it('returns null when API response is not ok', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({ ok: false });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toBeNull();
        });

        it('returns null when API throws an error', async () => {
            const fakeFetch = vi.fn().mockRejectedValue(new Error('network error'));
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toBeNull();
        });

        it('returns null when API response body lacks a value property', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({})
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toBeNull();
        });

        it('returns null when data.value is null or undefined from API', async () => {
            const fakeFetch = vi.fn()
                .mockResolvedValueOnce({ ok: true, json: async () => ({ value: null }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ value: undefined }) });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            expect(await storage.get('myKey', 'myCampaign')).toBeNull();
            expect(await storage.get('myKey', 'myCampaign')).toBeNull();
        });

        it('returns falsy-but-valid values: 0, false, empty string', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: 0 })
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            expect(await storage.get('myKey', 'myCampaign')).toBe(0);

            fakeFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ value: false })
            });
            expect(await storage.get('myKey', 'myCampaign')).toBe(false);

            fakeFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ value: '' })
            });
            expect(await storage.get('myKey', 'myCampaign')).toBe('');
        });

        it('encodes campaignName and key in fetch URL', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: 'ok' })
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            await storage.get('my key', 'my/campaign');
            expect(fakeFetch).toHaveBeenCalledWith(
                '/api/campaigns/my%2Fcampaign/my%20key'
            );
        });

        it('logs error to console when API call fails', async () => {
            const fakeFetch = vi.fn().mockRejectedValue(new Error('down'));
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);
            const consoleSpy = vi.spyOn(console, 'error');

            await storage.get('myKey', 'myCampaign');

            expect(consoleSpy).toHaveBeenCalledWith(
                'storage.get failed for key "myKey" in campaign "myCampaign"',
                expect.any(Error)
            );
            consoleSpy.mockRestore();
        });
    });

    // ── set(key, value, campaignName) ───────────────────────────────
    describe('set', () => {
        it('does NOT write to localStorage', () => {
            storage.set('myKey', { foo: 'bar' }, 'myCampaign');
            expect(localStorage.getItem('myKey')).toBeNull();
        });

        it('POSTs to API with correct URL, method, headers, and body', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({ ok: true });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            await storage.set('myKey', { foo: 'bar' }, 'myCampaign');
            expect(fakeFetch).toHaveBeenCalledWith(
                '/api/campaigns/myCampaign/myKey',
                expect.objectContaining({
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: { foo: 'bar' } })
                })
            );
        });

        it('encodes campaignName and key in POST URL', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({ ok: true });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            await storage.set('my key', { data: 1 }, 'my/campaign');
            expect(fakeFetch).toHaveBeenCalledWith(
                '/api/campaigns/my%2Fcampaign/my%20key',
                expect.any(Object)
            );
        });

        it('returns a promise (fire-and-forget)', () => {
            const promise = storage.set('myKey', 'value', 'myCampaign');
            expect(promise).toBeInstanceOf(Promise);
        });

        it('silently swallows fetch errors without rethrowing', async () => {
            const fakeFetch = vi.fn().mockRejectedValue(new Error('server down'));
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            await expect(storage.set('myKey', { foo: 'bar' }, 'myCampaign'))
                .resolves.toBeUndefined();
        });

        it('logs error and does not POST when campaignName is undefined', async () => {
            const fakeFetch = vi.fn();
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);
            const consoleSpy = vi.spyOn(console, 'error');

            await storage.set('myKey', { foo: 'bar' });
            expect(fakeFetch).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(
                'storage.set called with undefined campaignName',
                expect.any(Object)
            );
            consoleSpy.mockRestore();
        });

        it('still POSTs when value is null, 0, false, or empty string', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({ ok: true });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            await storage.set('myKey', null, 'myCampaign');
            expect(fakeFetch).toHaveBeenCalled();
            fakeFetch.mockClear();

            await storage.set('myKey', 0, 'myCampaign');
            expect(fakeFetch).toHaveBeenCalled();
            fakeFetch.mockClear();

            await storage.set('myKey', false, 'myCampaign');
            expect(fakeFetch).toHaveBeenCalled();
            fakeFetch.mockClear();

            await storage.set('myKey', '', 'myCampaign');
            expect(fakeFetch).toHaveBeenCalled();
        });
    });

    // ── getProperty(name, propertyName, campaignName) ───────────────
    describe('getProperty', () => {
        it('returns the property value when obj exists and has the property', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({ hp: 50, name: 'PlayerOne' });

            const result = await storage.getProperty('PlayerOne', 'hp');
            expect(result).toBe(50);
        });

        it('returns null when obj exists but property does not', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({ name: 'PlayerOne' });

            const result = await storage.getProperty('PlayerOne', 'hp');
            expect(result).toBeNull();
        });

        it('returns null when obj does not exist (get returns null)', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce(null);

            const result = await storage.getProperty('NonExistent', 'hp');
            expect(result).toBeNull();
        });

        it('returns null when obj property value is null or undefined', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({ hp: null, mana: undefined });

            expect(await storage.getProperty('PlayerOne', 'hp')).toBeNull();
            expect(await storage.getProperty('PlayerOne', 'mana')).toBeNull();
        });

        it('returns the property even if its value is falsy (0, false, empty string)', async () => {
            vi.spyOn(storage, 'get')
                .mockResolvedValueOnce({ xp: 0 })
                .mockResolvedValueOnce({ isVisible: false })
                .mockResolvedValueOnce({ note: '' });

            expect(await storage.getProperty('PlayerOne', 'xp')).toBe(0);
            expect(await storage.getProperty('PlayerOne', 'isVisible')).toBe(false);
            expect(await storage.getProperty('PlayerOne', 'note')).toBe('');
        });

        it('uses utils.getName to derive the key', async () => {
            const getNameSpy = vi.spyOn(utils, 'getName').mockReturnValue('PlayerOne');
            vi.spyOn(storage, 'get').mockResolvedValueOnce({ hp: 50 });

            await storage.getProperty('PlayerOne', 'hp');
            expect(getNameSpy).toHaveBeenCalledWith('PlayerOne');
            getNameSpy.mockRestore();
        });

        it('passes campaignName to storage.get', async () => {
            const getSpy = vi.spyOn(storage, 'get').mockResolvedValueOnce({ hp: 50 });

            await storage.getProperty('PlayerOne', 'hp', 'myCampaign');
            expect(getSpy).toHaveBeenCalledWith('PlayerOne', 'myCampaign');
        });

        it('passes undefined as campaignName when none provided', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({ hp: 50 });

            await storage.getProperty('PlayerOne', 'hp');
            expect(storage.get).toHaveBeenCalledWith('PlayerOne', undefined);
        });

        it('returns null when utils.getName returns "Unknown" and no obj exists', async () => {
            vi.spyOn(utils, 'getName').mockReturnValue('Unknown');
            vi.spyOn(storage, 'get').mockResolvedValueOnce(null);

            const result = await storage.getProperty(null, 'hp');
            expect(result).toBeNull();
        });

        it('returns null when get returns a non-object primitive', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce('not-an-object');

            // Accessing property on a string returns a character or undefined,
            // but obj[propertyName] != null check: 'not-an-object'['hp'] is undefined, so returns null
            const result = await storage.getProperty('PlayerOne', 'hp');
            expect(result).toBeNull();
        });
    });

    // ── setProperty(name, propertyName, value, campaignName) ────────
    describe('setProperty', () => {
        it('creates the object if it does not exist and sets the property', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce(null);
            const setSpy = vi.spyOn(storage, 'set').mockResolvedValueOnce(undefined);

            await storage.setProperty('PlayerOne', 'hp', 50, 'myCampaign');
            expect(setSpy).toHaveBeenCalledWith('PlayerOne', { hp: 50 }, 'myCampaign');
        });

        it('updates an existing object and sets the property', async () => {
            const existing = { name: 'Gandalf', hp: 10 };
            vi.spyOn(storage, 'get').mockResolvedValueOnce(existing);
            const setSpy = vi.spyOn(storage, 'set').mockResolvedValueOnce(undefined);

            await storage.setProperty('Gandalf', 'hp', 50, 'myCampaign');
            expect(setSpy).toHaveBeenCalledWith(
                'Gandalf',
                { name: 'Gandalf', hp: 50 },
                'myCampaign'
            );
        });

        it('uses utils.getName to derive the key', async () => {
            const getNameSpy = vi.spyOn(utils, 'getName').mockReturnValue('PlayerOne');
            vi.spyOn(storage, 'get').mockResolvedValueOnce({});
            vi.spyOn(storage, 'set').mockResolvedValueOnce(undefined);

            await storage.setProperty('PlayerOne', 'hp', 50);
            expect(getNameSpy).toHaveBeenCalledWith('PlayerOne');
            getNameSpy.mockRestore();
        });

        it('passes campaignName to the final storage.set', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce(null);
            const setSpy = vi.spyOn(storage, 'set').mockResolvedValueOnce(undefined);

            await storage.setProperty('PlayerOne', 'hp', 50, 'myCampaign');
            expect(setSpy).toHaveBeenCalledWith('PlayerOne', { hp: 50 }, 'myCampaign');
        });

        it('overwrites existing property value while preserving others', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({ hp: 10, mp: 20 });
            const setSpy = vi.spyOn(storage, 'set').mockResolvedValueOnce(undefined);

            await storage.setProperty('PlayerOne', 'hp', 50, 'myCampaign');
            expect(setSpy).toHaveBeenCalledWith(
                'PlayerOne',
                { hp: 50, mp: 20 },
                'myCampaign'
            );
        });

        it('sets property to falsy values correctly (0, false, null, empty string)', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({});
            const setSpy = vi.spyOn(storage, 'set').mockResolvedValueOnce(undefined);

            await storage.setProperty('PlayerOne', 'count', 0);
            expect(setSpy).toHaveBeenCalledWith('PlayerOne', { count: 0 }, undefined);
            setSpy.mockClear();

            await storage.setProperty('PlayerOne', 'visible', false);
            expect(setSpy).toHaveBeenCalledWith('PlayerOne', { visible: false }, undefined);
            setSpy.mockClear();

            await storage.setProperty('PlayerOne', 'note', null);
            expect(setSpy).toHaveBeenCalledWith('PlayerOne', { note: null }, undefined);
            setSpy.mockClear();

            await storage.setProperty('PlayerOne', 'tag', '');
            expect(setSpy).toHaveBeenCalledWith('PlayerOne', { tag: '' }, undefined);
        });

        it('propagates error when get throws (no error handling in code)', async () => {
            vi.spyOn(storage, 'get').mockRejectedValueOnce(new Error('boom'));

            await expect(storage.setProperty('PlayerOne', 'hp', 50))
                .rejects.toThrow('boom');
        });

        it('throws TypeError when get returns a non-object primitive', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce('not-an-object');

            await expect(storage.setProperty('PlayerOne', 'hp', 50, 'myCampaign'))
                .rejects.toThrow(/Cannot create property/);
        });
    });

    // ── Integration: get ignores localStorage entirely ───────────────
    describe('localStorage is never used', () => {
        it('get ignores localStorage data when campaignName is provided', async () => {
            localStorage.setItem('myKey', JSON.stringify({ stale: true }));
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: { fresh: true } })
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toEqual({ fresh: true });
            expect(localStorage.getItem('myKey')).toBe(JSON.stringify({ stale: true }));
        });

        it('set never writes to localStorage regardless of campaignName', () => {
            storage.set('myKey', { data: 'value' }, 'myCampaign');
            expect(localStorage.getItem('myKey')).toBeNull();
        });
    });
});
