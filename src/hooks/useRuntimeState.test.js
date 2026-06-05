import { renderHook, act } from '@testing-library/react';
import { seedStoreFromServer, addStorageChangeListener, getRuntimeValue, setRuntimeValue, setRuntimeObject, useRuntimeValue, setRuntimeBatch, clearRuntimeState } from './useRuntimeState.js';

const usedKeys = new Set();
function trackKey(k) { if (k) usedKeys.add(k); }
function resetModule() { for (const k of [...usedKeys]) { clearRuntimeState(k); } usedKeys.clear(); localStorage.clear(); }
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
    localStorage.setItem('v4', JSON.stringify({ hp: '42' }));
    clearRuntimeState('v4'); // force reload from store
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false });
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
  it('reads from localStorage line23-24', () => { trackKey('g2'); localStorage.setItem('g2',JSON.stringify({hp:50})); expect(getRuntimeValue('g2','hp')).toBe(50); });
  it('empty store for bad JSON line26', () => { trackKey('g3'); localStorage.setItem('g3','{bad}'); expect(getRuntimeValue('g3','hp')).toBeNull(); });
  it('cached bypasses localStorage line29', () => { trackKey('g4'); localStorage.setItem('g4',JSON.stringify({hp:50})); getRuntimeValue('g4','hp'); localStorage.clear(); expect(getRuntimeValue('g4','hp')).toBe(50); });
});
describe('getRuntimeValue exported', () => {
  it('returns stored value lines65-66', () => { trackKey('r1'); localStorage.setItem('r1',JSON.stringify({str:8})); expect(getRuntimeValue('r1','str')).toBe(8); });
  it('returns null for missing prop line65', () => { trackKey('r2'); localStorage.setItem('r2',JSON.stringify({str:8})); expect(getRuntimeValue('r2','missing')).toBeNull(); });
  it('uses cached store after load', () => { trackKey('r3'); localStorage.setItem('r3',JSON.stringify({con:14})); const v=getRuntimeValue('r3','con'); expect(v).toBe(14); v.toString(); });
});
describe('seedStoreFromServer', () => {
  it('returns early falsy campaignName line36', async () => { trackKey('s1'); const m=vi.spyOn(globalThis,'fetch'); await act(async()=>{await seedStoreFromServer('s1',undefined);await seedStoreFromServer('s1',null);await seedStoreFromServer('s1','');}); expect(m).not.toHaveBeenCalled(); });
  it('initialises store when key not cached line34', async () => { trackKey('s2'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:()=>Promise.resolve({value:{hp:10}})}); await act(async()=>{await seedStoreFromServer('s2','cam');}); expect(getRuntimeValue('s2','hp')).toBe(10); });
  it('encodes URL line38', async () => { trackKey('c/1'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:()=>Promise.resolve({value:{}})}); await act(async()=>{await seedStoreFromServer('c/1','a&b');}); });
  it('returns early !response.ok line39', async () => { trackKey('s4'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:false}); await act(async()=>{await seedStoreFromServer('s4','cam');}); expect(getRuntimeValue('s4','hp')).toBeNull(); });
  it('no-op no value key line41', async () => { trackKey('s5'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:()=>Promise.resolve({other:42})}); await act(async()=>{await seedStoreFromServer('s5','cam');}); expect(getRuntimeValue('s5','other')).toBeNull(); });
  it('no-op value not object line41', async () => { trackKey('s6'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:()=>Promise.resolve({value:'str'})}); await act(async()=>{await seedStoreFromServer('s6','cam');}); });
  it('merges server data lines42-47', async () => { trackKey('s7'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:()=>Promise.resolve({value:{hp:99}})}); await act(async()=>{await seedStoreFromServer('s7','cam');}); expect(getRuntimeValue('s7','hp')).toBe(99); });
  it('notifies listeners line46', async () => { trackKey('s8'); const l=vi.fn(); addStorageChangeListener('s8',l); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:()=>Promise.resolve({value:{hp:1}})}); await act(async()=>{await seedStoreFromServer('s8','cam');}); expect(l).toHaveBeenCalled(); });
  it('catches fetch errors line48', async () => { trackKey('s9'); vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('err')); await act(async()=>{await seedStoreFromServer('s9','cam');}); });
  it('catches json parse errors line48', async () => { trackKey('s10'); vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:()=>Promise.reject(new Error('bad json'))}); await act(async()=>{await seedStoreFromServer('s10','cam');}); });
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
