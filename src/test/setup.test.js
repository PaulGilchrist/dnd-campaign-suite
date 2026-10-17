// @maintained-by-ai
// @improved-by-ai
/**
 * Pinning suite for src/test/setup.js — the shared Vitest harness.
 *
 * Every other suite in the repo silently depends on these guarantees:
 *  - fetch is inert (no test can reach a live dev/api server and persist
 *    campaign data) but still overridable per-test via assignment/spy/stub
 *  - EventSource exists so SSE-connecting components render in jsdom
 *  - the localStorage mock works like storage (string values, null misses)
 *  - jest-dom matchers are registered
 *  - afterEach cleans the DOM (RTL cleanup) and the areaEffectModalInstances
 *    busy flag (clearActiveInstances)
 *
 * Cross-test cleanup is pinned with adjacent "dirty → clean" test pairs:
 * vitest runs tests in declaration order within a file, so if setup.js's
 * afterEach ever stops doing its job, the second half of each pair fails
 * loudly instead of suites silently bleeding into each other.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import {
  setApplyBusy,
  isApplyBusy,
  clearActiveInstances,
} from '../components/char-sheet/modals/shared/areaEffectModalInstances.js';

// Capture harness globals before any test in this file can dirty them.
const harnessFetch = globalThis.fetch;
const harnessEventSource = globalThis.EventSource;
const harnessLocalStorage = window.localStorage;

// Self-defense only — setup.js deliberately does NOT restore fetch/EventSource
// overrides (consumers own their mocks). This keeps this file's own overrides
// from leaking into its later tests.
afterEach(() => {
  globalThis.fetch = harnessFetch;
  globalThis.EventSource = harnessEventSource;
});

describe('inert fetch — no test can reach a live server', () => {
  it('resolves ok-shaped responses without a server', async () => {
    const response = await fetch('/api/anything-at-all');

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(await response.json()).toEqual({});
    expect((await response.arrayBuffer()).byteLength).toBe(0);
    expect(response.headers.get('x-anything')).toBeNull();
    expect(response.clone().ok).toBe(true);
  });

  it('is the same inert mock via window.fetch as via globalThis.fetch', () => {
    // setup.js stubs both paths; suites call either interchangeably.
    expect(globalThis.fetch).toBe(window.fetch);
    expect(window.fetch).toBe(harnessFetch);
  });

  it('can be replaced per-test by plain assignment', async () => {
    const custom = vi.fn(async () => ({ ok: false, status: 500 }));
    globalThis.fetch = custom;

    const response = await fetch('/api/campaigns');

    expect(custom).toHaveBeenCalledWith('/api/campaigns');
    expect(response.status).toBe(500);
  });

  it('can be replaced per-test by vi.spyOn so consumers can assert on calls', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });

    await fetch('/api/log');

    expect(spy).toHaveBeenCalledWith('/api/log');
    spy.mockRestore();
    expect(globalThis.fetch).toBe(harnessFetch);
  });
});

describe('inert EventSource — SSE-connecting components render in jsdom', () => {
  it('is constructible and exposes the readyState constants components gate on', () => {
    expect(typeof EventSource).toBe('function');
    expect(EventSource.CONNECTING).toBe(0);
    expect(EventSource.OPEN).toBe(1);
    expect(EventSource.CLOSED).toBe(2);

    const es = new EventSource('/subscribe/test-campaign');
    expect(es.url).toBe('/subscribe/test-campaign');
    expect(es.readyState).toBe(EventSource.CONNECTING);
  });

  it('accepts subscriptions and closes without throwing or firing events', () => {
    const es = new EventSource('/subscribe/test-campaign');
    const handler = vi.fn();

    expect(() => es.addEventListener('message', handler)).not.toThrow();
    expect(() => es.removeEventListener('message', handler)).not.toThrow();
    es.close();

    expect(es.readyState).toBe(EventSource.CLOSED);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('localStorage mock', () => {
  it('is one stable mock object reachable as localStorage and window.localStorage', () => {
    expect(window.localStorage).toBe(harnessLocalStorage);
    expect(localStorage).toBe(window.localStorage);
  });

  it('round-trips strings and coerces non-string values (consumers store JSON)', () => {
    localStorage.setItem('harness-key', 'value');
    expect(localStorage.getItem('harness-key')).toBe('value');

    localStorage.setItem('harness-number', 42);
    expect(localStorage.getItem('harness-number')).toBe('42');

    localStorage.setItem('harness-json', JSON.stringify({ filter: 'forest' }));
    expect(JSON.parse(localStorage.getItem('harness-json'))).toEqual({ filter: 'forest' });

    // Explicit clear() is the sanctioned wipe — setup.js never does it for
    // you (its afterEach only cleans DOM + modal instances, see below).
    localStorage.clear();
    expect(localStorage.getItem('harness-key')).toBeNull();
    expect(localStorage.getItem('harness-number')).toBeNull();
    expect(localStorage.getItem('harness-json')).toBeNull();
  });

  it('returns null for missing keys and after removeItem', () => {
    expect(localStorage.getItem('harness-missing')).toBeNull();

    localStorage.setItem('harness-removed', 'x');
    localStorage.removeItem('harness-removed');
    expect(localStorage.getItem('harness-removed')).toBeNull();
  });
});

describe('afterEach auto-cleanup (dirty → clean pairs)', () => {
  // Order-dependent by design: the first test dirties shared state, the
  // next verifies setup.js's afterEach restored it.

  it('dirties the DOM, localStorage, and the modal busy flag', () => {
    render(
      createElement('button', { 'data-testid': 'harness-button' }, 'render me')
    );

    // Also pins that @testing-library/jest-dom matchers are registered.
    expect(screen.getByTestId('harness-button')).toBeInTheDocument();

    localStorage.setItem('harness-persisted', 'visible-next-test');
    setApplyBusy(true);
    expect(isApplyBusy()).toBe(true);
  });

  it('has cleaned the DOM and busy flag but preserved localStorage for the next test', () => {
    // RTL cleanup removed the render container entirely.
    expect(document.body).toBeEmptyDOMElement();
    expect(screen.queryByText('render me')).toBeNull();

    // localStorage deliberately persists across tests in a file — the
    // contract documented in App.state-transitions.test.jsx: suites that
    // care call clear() themselves. setup.js never auto-clears.
    expect(localStorage.getItem('harness-persisted')).toBe('visible-next-test');

    // AGENTS.md contract: setup.js clears area effect modal instances.
    expect(isApplyBusy()).toBe(false);

    localStorage.clear();
  });

  it('clearActiveInstances() resets the busy flag (what a closing modal calls)', () => {
    setApplyBusy(true);
    clearActiveInstances();
    expect(isApplyBusy()).toBe(false);
  });
});
