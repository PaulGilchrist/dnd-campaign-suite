import { describe, it, expect, vi } from 'vitest';
import storage from './storage.js';

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

        it('returns null when API value is null or undefined', async () => {
            const fakeFetch = vi.fn()
                .mockResolvedValueOnce({ ok: true, json: async () => ({ value: null }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ value: undefined }) });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            expect(await storage.get('myKey', 'myCampaign')).toBeNull();
            expect(await storage.get('myKey', 'myCampaign')).toBeNull();
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
    });

    // ── getProperty(name, propertyName, campaignName) ───────────────
    describe('getProperty', () => {
        it('returns the property value when obj exists and has the property', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({ hp: 50, name: 'PlayerOne' });

            const result = await storage.getProperty('PlayerOne', 'hp');
            expect(result).toBe(50);
        });

        it('returns null when property is missing, null, undefined, obj is missing, or obj is not an object', async () => {
            vi.spyOn(storage, 'get')
                .mockResolvedValueOnce({ name: 'PlayerOne' })
                .mockResolvedValueOnce({ hp: null })
                .mockResolvedValueOnce({ mana: undefined })
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce('not-an-object');

            expect(await storage.getProperty('PlayerOne', 'hp')).toBeNull();
            expect(await storage.getProperty('PlayerOne', 'hp')).toBeNull();
            expect(await storage.getProperty('PlayerOne', 'mana')).toBeNull();
            expect(await storage.getProperty('NonExistent', 'hp')).toBeNull();
            expect(await storage.getProperty('PlayerOne', 'hp')).toBeNull();
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

        it('updates an existing object and sets the property, overwriting while preserving others', async () => {
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
    });
});
