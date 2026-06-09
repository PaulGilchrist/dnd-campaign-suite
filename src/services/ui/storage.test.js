import { describe, it, expect, vi, beforeEach } from 'vitest';
import storage from './storage.js';
import utils from './utils.js';

describe('storage', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    // ── get(key, campaignName) ──────────────────────────────────────
    describe('get', () => {
        it('returns null when key not in localStorage and no campaignName', async () => {
            const result = await storage.get('nonexistent');
            expect(result).toBeNull();
        });

        it('returns parsed value from localStorage when no campaignName', async () => {
            localStorage.setItem('myKey', JSON.stringify({ foo: 'bar' }));
            const result = await storage.get('myKey');
            expect(result).toEqual({ foo: 'bar' });
        });

        it('throws when localStorage value is not valid JSON', async () => {
            localStorage.setItem('badJson', '{invalid}');
            await expect(storage.get('badJson')).rejects.toThrow();
         });

        it('fetches from API and caches in localStorage when campaignName provided', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: { apiData: 42 } })
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toEqual({ apiData: 42 });
            expect(localStorage.getItem('myKey')).toBe(JSON.stringify({ apiData: 42 }));
            expect(fakeFetch).toHaveBeenCalledWith(
                '/api/campaigns/myCampaign/myKey'
            );
        });

        it('falls through to localStorage when API response is not ok', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({ ok: false });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            localStorage.setItem('myKey', JSON.stringify({ local: true }));
            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toEqual({ local: true });
        });

        it('falls through to localStorage when API throws an error', async () => {
            const fakeFetch = vi.fn().mockRejectedValue(new Error('network error'));
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            localStorage.setItem('myKey', JSON.stringify({ local: true }));
            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toEqual({ local: true });
        });

        it('falls through to localStorage when data.value is null from API', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: null })
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            localStorage.setItem('myKey', JSON.stringify({ local: true }));
            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toEqual({ local: true });
        });

        it('falls through to localStorage when data.value is undefined from API', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({})
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            localStorage.setItem('myKey', JSON.stringify({ local: true }));
            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toEqual({ local: true });
        });

        it('returns API value and does not fall through when data.value is 0 (falsy but valid)', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: 0 })
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toBe(0);
        });

        it('returns API value and does not fall through when data.value is false (falsy but valid)', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: false })
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toBe(false);
        });

        it('returns API value and does not fall through when data.value is empty string (falsy but valid)', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: '' })
            });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toBe('');
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

        it('falls through to localStorage then returns null when both empty', async () => {
            const fakeFetch = vi.fn().mockRejectedValue(new Error('down'));
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('missing', 'myCampaign');
            expect(result).toBeNull();
        });

        it('does not attempt API fetch when campaignName is falsy (empty string)', async () => {
            const fakeFetch = vi.fn();
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            localStorage.setItem('myKey', JSON.stringify({ local: true }));
            const result = await storage.get('myKey', '');
            expect(result).toEqual({ local: true });
            expect(fakeFetch).not.toHaveBeenCalled();
        });

        it('does not attempt API fetch when campaignName is undefined', async () => {
            const fakeFetch = vi.fn();
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            localStorage.setItem('myKey', JSON.stringify({ local: true }));
            const result = await storage.get('myKey');
            expect(result).toEqual({ local: true });
            expect(fakeFetch).not.toHaveBeenCalled();
        });
    });

    // ── set(key, value, campaignName) ───────────────────────────────
    describe('set', () => {
        it('writes to localStorage immediately', () => {
            storage.set('myKey', { foo: 'bar' }, 'myCampaign');
            expect(localStorage.getItem('myKey')).toBe(JSON.stringify({ foo: 'bar' }));
        });

        it('POSTs to API when campaignName is provided', async () => {
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

        it('silently swallows fetch errors without rethrowing', async () => {
            const fakeFetch = vi.fn().mockRejectedValue(new Error('server down'));
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            await expect(storage.set('myKey', { foo: 'bar' }, 'myCampaign'))
                .resolves.toBeUndefined();
            // localStorage should still have the value despite fetch failure
            expect(localStorage.getItem('myKey')).toBe(JSON.stringify({ foo: 'bar' }));
        });

        it('returns a promise (fire-and-forget)', () => {
            const promise = storage.set('myKey', 'value');
            expect(promise).toBeInstanceOf(Promise);
        });

        it('still POSTs when campaignName is provided but value is null', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({ ok: true });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            await storage.set('myKey', null, 'myCampaign');
            expect(fakeFetch).toHaveBeenCalled();
        });

        it('still POSTs when campaignName is provided but value is 0', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({ ok: true });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            await storage.set('myKey', 0, 'myCampaign');
            expect(fakeFetch).toHaveBeenCalled();
        });
    });

    // ── getProperty(name, propertyName, campaignName) ───────────────
    describe('getProperty', () => {
        it('returns the property value when obj exists and has the property', async () => {
            localStorage.setItem('PlayerOne', JSON.stringify({ hp: 50, name: 'PlayerOne' }));
            const fakeFetch = vi.fn(); // no campaignName so no API call
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.getProperty('PlayerOne', 'hp');
            expect(result).toBe(50);
        });

        it('returns null when obj exists but property does not', async () => {
            localStorage.setItem('PlayerOne', JSON.stringify({ name: 'PlayerOne' }));

            const result = await storage.getProperty('PlayerOne', 'hp');
            expect(result).toBeNull();
        });

        it('returns null when obj does not exist', async () => {
            const result = await storage.getProperty('NonExistent', 'hp');
            expect(result).toBeNull();
        });

        it('uses utils.getName to derive the localStorage key', async () => {
            localStorage.setItem('PlayerOne', JSON.stringify({ hp: 50 }));

            const getNameSpy = vi.spyOn(utils, 'getName').mockReturnValue('PlayerOne');
            const result = await storage.getProperty('PlayerOne', 'hp');
            expect(result).toBe(50);
            expect(getNameSpy).toHaveBeenCalledWith('PlayerOne');
        });

        it('returns null when utils.getName returns "Unknown" and no obj there', async () => {
            const getNameSpy = vi.spyOn(utils, 'getName').mockReturnValue('Unknown');

            const result = await storage.getProperty(null, 'hp');
            expect(result).toBeNull();
            expect(getNameSpy).toHaveBeenCalledWith(null);
        });

        it('returns the property even if its value is 0 (falsy)', async () => {
            localStorage.setItem('PlayerOne', JSON.stringify({ xp: 0 }));

            const result = await storage.getProperty('PlayerOne', 'xp');
            expect(result).toBe(0);
        });

        it('returns the property even if its value is false (falsy)', async () => {
            localStorage.setItem('PlayerOne', JSON.stringify({ isVisible: false }));

            const result = await storage.getProperty('PlayerOne', 'isVisible');
            expect(result).toBe(false);
        });

        it('returns the property even if its value is empty string (falsy)', async () => {
            localStorage.setItem('PlayerOne', JSON.stringify({ note: '' }));

            const result = await storage.getProperty('PlayerOne', 'note');
            expect(result).toBe('');
        });

        it('passes campaignName to storage.get', async () => {
            const getSpy = vi.spyOn(storage, 'get').mockResolvedValueOnce({ hp: 50 });

            await storage.getProperty('PlayerOne', 'hp', 'myCampaign');
            expect(getSpy).toHaveBeenCalledWith('PlayerOne', 'myCampaign');
        });

        it('passes undefined as campaignName when none provided', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({ hp: 50 });

            await storage.getProperty('PlayerOne', 'hp');
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

        it('uses utils.getName to derive the localStorage key', async () => {
            const getNameSpy = vi.spyOn(utils, 'getName').mockReturnValue('PlayerOne');
            vi.spyOn(storage, 'get').mockResolvedValueOnce({});
            vi.spyOn(storage, 'set').mockResolvedValueOnce(undefined);

            await storage.setProperty('PlayerOne', 'hp', 50);
            expect(getNameSpy).toHaveBeenCalledWith('PlayerOne');
         });

        it('passes campaignName to the final storage.set', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce(null);
            const setSpy = vi.spyOn(storage, 'set').mockResolvedValueOnce(undefined);

            await storage.setProperty('PlayerOne', 'hp', 50, 'myCampaign');
            expect(setSpy).toHaveBeenCalledWith('PlayerOne', { hp: 50 }, 'myCampaign');
         });

        it('overwrites existing property value', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({ hp: 10, mp: 20 });
            const setSpy = vi.spyOn(storage, 'set').mockResolvedValueOnce(undefined);

            await storage.setProperty('PlayerOne', 'hp', 50, 'myCampaign');
            expect(setSpy).toHaveBeenCalledWith(
                 'PlayerOne',
                 { hp: 50, mp: 20 },
                 'myCampaign'
             );
         });

        it('sets property to falsy values correctly (0)', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({});
            const setSpy = vi.spyOn(storage, 'set').mockResolvedValueOnce(undefined);

            await storage.setProperty('PlayerOne', 'hp', 0);
            expect(setSpy).toHaveBeenCalledWith('PlayerOne', { hp: 0 }, undefined);
           });

        it('sets property to falsy values correctly (null)', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({});
            const setSpy = vi.spyOn(storage, 'set').mockResolvedValueOnce(undefined);

            await storage.setProperty('PlayerOne', 'note', null);
            expect(setSpy).toHaveBeenCalledWith('PlayerOne', { note: null }, undefined);
             });
    });

    // ── Edge cases / integration style tests ────────────────────────
    describe('edge cases', () => {
        it('get with valid campaignName fetches and uses API response over localStorage', async () => {
            localStorage.setItem('myKey', JSON.stringify({ stale: true }));
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ value: { fresh: true } })
           });
            vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch);

            const result = await storage.get('myKey', 'myCampaign');
            expect(result).toEqual({ fresh: true });
          });

        it('getProperty with campaignName uses mocked get that returns from API', async () => {
            vi.spyOn(storage, 'get').mockResolvedValueOnce({ hp: 75 });

            const result = await storage.getProperty('PlayerOne', 'hp', 'myCampaign');
            expect(result).toBe(75);
          });

        it('setProperty propagates error when get throws (no error handling in code)', async () => {
             // setProperty does NOT have a try/catch, so an error in get propagates
            vi.spyOn(storage, 'get').mockRejectedValueOnce(new Error('boom'));

            await expect(storage.setProperty('PlayerOne', 'hp', 50))
                 .rejects.toThrow('boom');
         });
    });
});
