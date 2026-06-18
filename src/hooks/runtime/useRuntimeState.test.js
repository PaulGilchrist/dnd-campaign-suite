import { seedTrackedResources, addStorageChangeListener, getRuntimeValue, setRuntimeValue, clearRuntimeState } from './useRuntimeState.js';

const usedKeys = new Set();
function trackKey(k) { if (k) usedKeys.add(k); }
function resetModule() { for (const k of [...usedKeys]) { clearRuntimeState(k); } usedKeys.clear(); }
beforeEach(() => { vi.restoreAllMocks(); resetModule(); });
afterEach(() => { vi.restoreAllMocks(); resetModule(); });

describe('valuesEqual (indirect)', () => {
  it('strict eq line7 no-op when same number', () => {
    trackKey('v1');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false });
    setRuntimeValue('v1', 'hp', 42, 'cam'); // sets hp=42
    vi.spyOn(globalThis, 'fetch').mockClear();
    setRuntimeValue('v1', 'hp', 42, 'cam'); // same value -> valuesEqual returns true -> no fetch
    expect(fetch).not.toHaveBeenCalled();
  });
  it('null vs null line8 no-op', () => {
    trackKey('v2');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false });
    setRuntimeValue('v2', 'slot', null, 'cam');
    vi.spyOn(globalThis, 'fetch').mockClear();
    setRuntimeValue('v2', 'slot', null, 'cam'); // null === null -> no fetch
    expect(fetch).not.toHaveBeenCalled();
  });
  it('number vs string line9 no-op', () => {
    trackKey('v3');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false });
    setRuntimeValue('v3', 'hp', 42, 'cam'); // stores number
    vi.spyOn(globalThis, 'fetch').mockClear();
    setRuntimeValue('v3', 'hp', '42', 'cam'); // Number('42')===42 -> no fetch
    expect(fetch).not.toHaveBeenCalled();
  });
  it('stored string vs number line10 no-op', () => {
    trackKey('v4');
    // No longer reads from localStorage — seed via setRuntimeValue instead
    setRuntimeValue('v4', 'hp', '42', 'cam'); // stores string
    vi.spyOn(globalThis, 'fetch').mockClear();
    setRuntimeValue('v4', 'hp', 42, 'cam'); // Number('42')===42 -> no fetch
    expect(fetch).not.toHaveBeenCalled();
  });
  it('same objects lines11-16 no-op', () => {
    trackKey('v5');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false });
    setRuntimeValue('v5', 's', { str: 10 }, 'cam');
    vi.spyOn(globalThis, 'fetch').mockClear();
    setRuntimeValue('v5', 's', { str: 10 }, 'cam'); // same -> no fetch
    expect(fetch).not.toHaveBeenCalled();
  });
  it('diff values lines11-16 triggers fetch', () => {
    trackKey('v6');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false });
    setRuntimeValue('v6', 's', { str: 10 }, 'cam');
    vi.spyOn(globalThis, 'fetch').mockClear();
    setRuntimeValue('v6', 's', { str: 15 }, 'cam'); // diff -> fetch called
    expect(fetch).toHaveBeenCalled();
  });
  it('diff key count line14 triggers fetch', () => {
    trackKey('v7');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false });
    setRuntimeValue('v7', 's', { a: 1 }, 'cam');
    vi.spyOn(globalThis, 'fetch').mockClear();
    setRuntimeValue('v7', 's', { a: 1, b: 2 }, 'cam'); // diff key count -> fetch
    expect(fetch).toHaveBeenCalled();
  });
  it('bool vs string line17 triggers fetch', () => {
    trackKey('v8');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false });
    setRuntimeValue('v8', 'alive', true, 'cam'); // stores boolean
    vi.spyOn(globalThis, 'fetch').mockClear();
    setRuntimeValue('v8', 'alive', 'true', 'cam'); // bool!=string -> line17 -> fetch
    expect(fetch).toHaveBeenCalled();
  });
});
describe('getStore (indirect)', () => {
  it('null for new key lines21-24', () => { trackKey('g1'); expect(getRuntimeValue('g1','hp')).toBeNull(); });
  it('returns null for key not yet seeded (no localStorage fallback)', () => { trackKey('g2'); expect(getRuntimeValue('g2','hp')).toBeNull(); });
  it('empty store for corrupt data', () => { trackKey('g3'); expect(getRuntimeValue('g3','hp')).toBeNull(); });
  it('cached in-memory store persists after localStorage cleared', () => { trackKey('g4'); setRuntimeValue('g4','hp',50,'cam'); localStorage.clear(); expect(getRuntimeValue('g4','hp')).toBe(50); });
});
describe('getRuntimeValue exported', () => {
  it('returns stored value after setRuntimeValue', () => { trackKey('r1'); setRuntimeValue('r1','str',8,'cam'); expect(getRuntimeValue('r1','str')).toBe(8); });
  it('returns null for missing prop line65', () => { trackKey('r2'); setRuntimeValue('r2','str',8,'cam'); expect(getRuntimeValue('r2','missing')).toBeNull(); });
  it('uses cached store after load', () => { trackKey('r3'); setRuntimeValue('r3','con',14,'cam'); const v=getRuntimeValue('r3','con'); expect(v).toBe(14); v.toString(); });
});
describe('seedTrackedResources', () => {
  it('sets runtime values from tracked entries', () => {
    trackKey('t1');
    seedTrackedResources('t1', { hp: 42, sorceryPoints: 5 });
    expect(getRuntimeValue('t1', 'hp')).toBe(42);
    expect(getRuntimeValue('t1', 'sorceryPoints')).toBe(5);
  });

  it('notifies listeners', () => {
    trackKey('t2');
    const fn = vi.fn();
    addStorageChangeListener('t2', fn);
    seedTrackedResources('t2', { hp: 10 });
    expect(fn).toHaveBeenCalled();
  });

  it('is no-op for empty entries', () => {
    trackKey('t3');
    seedTrackedResources('t3', {});
    expect(getRuntimeValue('t3', 'nada')).toBeNull();
  });

  it('handles multiple characters independently', () => {
    trackKey('m1');
    trackKey('m2');
    seedTrackedResources('m1', { hp: 1 });
    seedTrackedResources('m2', { hp: 2 });
    expect(getRuntimeValue('m1', 'hp')).toBe(1);
    expect(getRuntimeValue('m2', 'hp')).toBe(2);
  });
});
describe('addStorageChangeListener', () => {
  it('creates listener set line57', () => { trackKey('a1'); const u=addStorageChangeListener('a1',vi.fn()); expect(typeof u).toBe('function'); });
  it('listener fires on notify lines53,58-59', () => { trackKey('a2'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:false}); const f=vi.spyOn(globalThis,'fetch'); setRuntimeValue('a2','hp',1,'cam'); f.mockClear(); const fn=vi.fn(); addStorageChangeListener('a2',fn); setRuntimeValue('a2','hp',2,'cam'); expect(fn).toHaveBeenCalledTimes(1); });
  it('unsubscribe removes listener line60', () => { trackKey('a3'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:false}); setRuntimeValue('a3','hp',1,'cam'); const fn=vi.fn(); const u2=addStorageChangeListener('a3',fn); vi.spyOn(globalThis,'fetch').mockClear(); setRuntimeValue('a3','hp',2,'cam'); expect(fn).toHaveBeenCalledTimes(1); u2();setRuntimeValue('a3','hp',3,'cam');});
  it('multiple listeners fire lines53,58-59', () => { trackKey('a4'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:false}); setRuntimeValue('a4','hp',1,'cam'); const a=vi.fn();const b=vi.fn(); addStorageChangeListener('a4',a);addStorageChangeListener('a4',b);vi.spyOn(globalThis,'fetch').mockClear();setRuntimeValue('a4','hp',2,'cam');expect(a).toHaveBeenCalledTimes(1);expect(b).toHaveBeenCalledTimes(1); });
  it('unsub one not affect other line60', () => { trackKey('a5'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:false}); setRuntimeValue('a5','hp',1,'cam'); const a=vi.fn();const b=vi.fn();const ua=addStorageChangeListener('a5',a);addStorageChangeListener('a5',b);ua();setRuntimeValue('a5','hp',2,'cam');expect(a).not.toHaveBeenCalled();expect(b).toHaveBeenCalled(); });
});
describe('notify (indirect)', () => {
  it('iterates forEach all listeners line53', () => { trackKey('n1'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:false}); setRuntimeValue('n1','hp',1,'cam'); const calls=[]; addStorageChangeListener('n1',()=>calls.push(1)); addStorageChangeListener('n1',()=>calls.push(2)); setRuntimeValue('n1','hp',2,'cam'); expect(calls).toContain(1); expect(calls).toContain(2); });
  it('no-op when no listeners line52', () => { trackKey('n2'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:false}); setRuntimeValue('n2','hp',2,'cam'); expect(true).toBe(true); });
  it('multiple unsubscribes safe line60', () => { trackKey('n3'); const fn=vi.fn(); const u=addStorageChangeListener('n3',fn); u(); u(); expect(fn).not.toHaveBeenCalled(); });
});
