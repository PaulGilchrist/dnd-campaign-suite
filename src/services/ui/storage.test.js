// @maintained-by-ai
/**
 * storage.js — server-first HTTP transport for runtime game state.
 *
 * NOT a localStorage wrapper: every read/write goes to `/api/campaigns/:campaign/:key`
 * via fetch (setup.js installs an inert fetch; nothing here ever touches the network).
 * This is the SERVER-FRONT lane itself: game state (combatSummary ~104 call-sites,
 * activeCreatureName, lastAttack, turnState) POSTed to the server, per repo law
 * ("All game state flows through the runtime store"). Zero localStorage inside module.
 * Local-only localStorage users (theme in App.jsx, filters in EncounterBuilder.jsx,
 * wizard scratch in WizardStepAbilities/useWizardBackgroundAbility) bypass this module —
 * correct split, reported, not our contract.
 *
 * Exporter->caller census (production, excluding tests):
 *   get/set: live (rules/effects/automation/initiative lanes). App.jsx:295 set('combatSummary').
 *   getProperty/setProperty: ZERO production callers — dead exports kept only for the
 *   server-route error-text contract (server/routes/campaigns-changedata.js:59/102/114).
 *   Smoke-pinned here; do not expand without adding a caller.
 *
 * Mock strategy: fetch is the ONLY boundary (vi.spyOn + manual deferreds);
 * storage.get/set are NEVER spied (never mock the unit under test). console.error
 * bytes pinned for guard/error arms. No timers — queue proof uses microtask flush
 * (`await Promise.resolve()`) + manual resolves (no-clock law).
 * Campaign names 'test-campaign'/'test-campaign-2' are synthetic strings against a
 * mocked fetch (campaign lockdown honored; no live route is ever contacted).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import storage from './storage.js';

afterEach(() => {
    vi.restoreAllMocks();
});

const jsonResponse = (body, ok = true) => ({ ok, json: async () => body });

const fetchCalls = [];
function queueingFetch() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(
        (url, opts) => new Promise((resolve) => fetchCalls.push({ url, opts, resolve }))
    );
}

describe('storage — server-first fetch transport', () => {
    // ── get(key, campaignName) ──────────────────────────────────────
    describe('get', () => {
        it('GETs the exact encoded /api/campaigns/:campaign/:key URL and returns the parsed value by reference', async () => {
            const value = { hp: 50, name: 'PlayerOne' };
            const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ value }));

            const result = await storage.get('my key&t', 'test campaign/e1');

            expect(result).toBe(value); // pass-through: same parsed reference, no clone
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith('/api/campaigns/test%20campaign%2Fe1/my%20key%26t'); // GET: no options arg
        });

        it('returns falsy stored values (false, 0, empty string) intact — only null/undefined collapse to null', async () => {
            const spy = vi.spyOn(globalThis, 'fetch');
            for (const [raw, expected] of [[false, false], [0, 0], ['', '']]) {
                spy.mockResolvedValue(jsonResponse({ value: raw }));
                expect(await storage.get('myKey', 'test-campaign')).toBe(expected);
            }
            expect(spy).toHaveBeenCalledTimes(3);
        });

        it('returns null on not-ok, thrown fetch, thrown JSON parse, or null/undefined/missing value — logging console bytes on throws', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const spy = vi.spyOn(globalThis, 'fetch');

            spy.mockResolvedValue(jsonResponse({}, false));
            expect(await storage.get('myKey', 'test-campaign')).toBeNull();

            spy.mockResolvedValue(jsonResponse({ value: null }));
            expect(await storage.get('myKey', 'test-campaign')).toBeNull();

            spy.mockResolvedValue(jsonResponse({})); // missing value key
            expect(await storage.get('myKey', 'test-campaign')).toBeNull();

            spy.mockRejectedValue(new Error('network error'));
            expect(await storage.get('myKey', 'test-campaign')).toBeNull();

            spy.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('Unexpected token <'); } });
            expect(await storage.get('myKey', 'test-campaign')).toBeNull();

            const logged = errorSpy.mock.calls.map((c) => c[0]);
            expect(logged).toContain('storage.get failed for key "myKey" in campaign "test-campaign"'); // 2 throw arms
            expect(logged.filter((m) => String(m).startsWith('storage.get failed'))).toHaveLength(2);
        });

        it('returns null without touching fetch when campaignName is missing', async () => {
            const spy = vi.spyOn(globalThis, 'fetch');
            expect(await storage.get('myKey')).toBeNull();
            expect(await storage.get('myKey', '')).toBeNull();
            expect(spy).not.toHaveBeenCalled();
        });
    });

    // ── set(key, value, campaignName) ───────────────────────────────
    describe('set', () => {
        it('POSTs to the exact encoded URL with the full option tuple and JSON {value} body bytes', async () => {
            const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}, true));

            await storage.set('my key&t', { foo: 'bar' }, 'test campaign/e1');

            expect(spy).toHaveBeenCalledWith(
                '/api/campaigns/test%20campaign%2Fe1/my%20key%26t',
                {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{"value":{"foo":"bar"}}',
                }
            ); // no expect.any — every option byte pinned
        });

        it('logs console bytes and resolves without fetching when campaignName is missing', async () => {
            const spy = vi.spyOn(globalThis, 'fetch');
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await expect(storage.set('myKey', { foo: 'bar' })).resolves.toBeUndefined();

            expect(spy).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalledWith(
                'storage.set called with undefined campaignName',
                expect.objectContaining({ key: 'myKey', value: { foo: 'bar' } }) // stack key present, bytes nondeterministic
            );
        });

        it('swallows POST rejections, logging [storage:error] bytes, resolving undefined', async () => {
            const err = new Error('server down');
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(err);
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await expect(storage.set('myKey', { foo: 'bar' }, 'test-campaign')).resolves.toBeUndefined();
            expect(errorSpy).toHaveBeenCalledWith('[storage:error]', err);
        });

        it('serializes combatSummary writes per campaign (second POST fires only after first settles) while different campaigns run in parallel', async () => {
            fetchCalls.length = 0;
            queueingFetch();

            const pA = storage.set('combatSummary', { round: 1 }, 'test-campaign');
            const pB = storage.set('combatSummary', { round: 2 }, 'test-campaign');
            await Promise.resolve(); // flush the queue's queued microtask — A's fetch has now fired

            expect(fetchCalls).toHaveLength(1); // B serialized behind unresolved A — race-condition guard
            expect(fetchCalls[0].url).toBe('/api/campaigns/test-campaign/combatSummary');
            expect(JSON.parse(fetchCalls[0].opts.body)).toEqual({ value: { round: 1 } });

            fetchCalls[0].resolve(jsonResponse({}));
            await pA; // pA settling runs cbB first (registered earlier) — fetchB is now in flight
            expect(fetchCalls).toHaveLength(2);
            fetchCalls[1].resolve(jsonResponse({}));
            await pB;

            expect(fetchCalls.map((c) => JSON.parse(c.opts.body))).toEqual([
                { value: { round: 1 } },
                { value: { round: 2 } },
            ]); // ordered round-1-before-round-2 bytes

            // Separate campaign queues: both fire without waiting on each other.
            const pC = storage.set('combatSummary', { round: 3 }, 'test-campaign');
            const pD = storage.set('combatSummary', { round: 4 }, 'test-campaign-2');
            await Promise.resolve();
            expect(fetchCalls).toHaveLength(4);

            fetchCalls[2].resolve(jsonResponse({}));
            fetchCalls[3].resolve(jsonResponse({}));
            await Promise.all([pC, pD]);
            expect(fetchCalls[3].url).toBe('/api/campaigns/test-campaign-2/combatSummary');
        });
    });

    // ── getProperty / setProperty — dead exports (zero production callers) ─
    // Smoke-pinned through the REAL get/set below. See header census; do not
    // expand coverage without adding a production caller.
    describe('getProperty', () => {
        it('GETs the getName-derived key URL and returns the property, surviving falsy values; null for missing obj/property', async () => {
            const spy = vi.spyOn(globalThis, 'fetch');

            spy.mockResolvedValue(jsonResponse({ value: { hp: 50, active: false } }));
            expect(await storage.getProperty('PlayerOne', 'hp', 'test-campaign')).toBe(50);
            expect(spy).toHaveBeenLastCalledWith('/api/campaigns/test-campaign/PlayerOne');
            expect(await storage.getProperty('PlayerOne', 'active', 'test-campaign')).toBe(false); // falsy survives != null
            expect(await storage.getProperty('PlayerOne', 'missing', 'test-campaign')).toBeNull();

            spy.mockResolvedValue(jsonResponse({ value: null })); // key absent server-side
            expect(await storage.getProperty('PlayerOne', 'hp', 'test-campaign')).toBeNull();

            spy.mockResolvedValue(jsonResponse({ value: 'not-an-object' }));
            expect(await storage.getProperty('PlayerOne', 'hp', 'test-campaign')).toBeNull();

            spy.mockResolvedValue(jsonResponse({ value: { hp: 1 } }));
            expect(await storage.getProperty(123, 'hp', 'test-campaign')).toBe(1);
            expect(spy).toHaveBeenLastCalledWith('/api/campaigns/test-campaign/Unknown'); // utils.getName fallback byte
        });

        it('stores campaign-level keys at the top level (no "campaign" wrapper) in the URL', async () => {
            const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ value: 'v1' }));

            expect(await storage.getProperty('campaign', 'filters', 'test-campaign')).toBe('v1');
            expect(spy).toHaveBeenCalledWith('/api/campaigns/test-campaign/filters');
        });
    });

    describe('setProperty', () => {
        it('read-modify-writes the whole object: GET before POST, preserving siblings, creating when absent', async () => {
            const spy = vi.spyOn(globalThis, 'fetch');

            spy.mockResolvedValueOnce(jsonResponse({ value: { name: 'Gandalf', hp: 10 } }));
            await storage.setProperty('Gandalf', 'hp', 50, 'test-campaign');

            expect(spy).toHaveBeenCalledTimes(2); // read-before-write invocationCallOrder
            expect(spy.mock.calls[0][0]).toBe('/api/campaigns/test-campaign/Gandalf');
            expect(spy.mock.calls[1]).toEqual([
                '/api/campaigns/test-campaign/Gandalf',
                {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{"value":{"name":"Gandalf","hp":50}}',
                },
            ]); // sibling preserved, exact merged bytes

            spy.mockReset();
            spy.mockResolvedValueOnce(jsonResponse({ value: null })); // fresh object arm
            spy.mockResolvedValueOnce(jsonResponse({}));
            await storage.setProperty('PlayerOne', 'hp', 50, 'test-campaign');
            expect(JSON.parse(spy.mock.calls[1][1].body)).toEqual({ value: { hp: 50 } });
        });

        it('routes campaign-level writes to the top level and redirects deprecated combatSummary.lastAttack to the root lastAttack key with console bytes', async () => {
            const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}));
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            await storage.setProperty('campaign', 'filters', 'x', 'test-campaign');
            expect(spy).toHaveBeenCalledTimes(1); // no read — direct top-level POST
            expect(spy).toHaveBeenCalledWith(
                '/api/campaigns/test-campaign/filters',
                expect.objectContaining({ method: 'POST', body: '{"value":"x"}' })
            );

            await storage.setProperty('combatSummary', 'lastAttack', { dmg: 7 }, 'test-campaign');
            expect(errorSpy.mock.calls[0][0]).toContain(
                "[storage] Deprecated: storage.setProperty('combatSummary', 'lastAttack', ...) is no longer supported."
            );
            expect(spy).toHaveBeenCalledTimes(2);
            expect(spy.mock.calls[1][0]).toBe('/api/campaigns/test-campaign/lastAttack'); // root-level, never under combatSummary
            expect(JSON.parse(spy.mock.calls[1][1].body)).toEqual({ value: { dmg: 7 } });
        });
    });
});
