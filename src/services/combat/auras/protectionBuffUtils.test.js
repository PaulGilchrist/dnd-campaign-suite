// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import { hasProtectionBuff, getProtectionBuffSource, clearProtectionBuff } from './protectionBuffUtils.js';

describe('protectionBuffUtils', () => {
  let getRuntimeValueSpy;
  let setRuntimeValueSpy;

  const TARGET = 'TestTarget';
  const CAMPAIGN = 'testCampaign';

  beforeEach(() => {
    getRuntimeValueSpy = vi.spyOn(runtimeState, 'getRuntimeValue');
    setRuntimeValueSpy = vi.spyOn(runtimeState, 'setRuntimeValue').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hasProtectionBuff', () => {
    it('returns false when buff is null', () => {
      getRuntimeValueSpy.mockReturnValue(null);
      expect(hasProtectionBuff(TARGET, CAMPAIGN)).toBe(false);
    });

    it('returns false when buff is undefined', () => {
      getRuntimeValueSpy.mockReturnValue(undefined);
      expect(hasProtectionBuff(TARGET, CAMPAIGN)).toBe(false);
    });

    it('returns false when buff is empty string', () => {
      getRuntimeValueSpy.mockReturnValue('');
      expect(hasProtectionBuff(TARGET, CAMPAIGN)).toBe(false);
    });

    it('returns false when buff is 0', () => {
      getRuntimeValueSpy.mockReturnValue(0);
      expect(hasProtectionBuff(TARGET, CAMPAIGN)).toBe(false);
    });

    it('returns false when buff is false', () => {
      getRuntimeValueSpy.mockReturnValue(false);
      expect(hasProtectionBuff(TARGET, CAMPAIGN)).toBe(false);
    });

    it('returns true when buff is an object with source', () => {
      getRuntimeValueSpy.mockReturnValue({ source: 'paladin' });
      expect(hasProtectionBuff(TARGET, CAMPAIGN)).toBe(true);
    });

    it('returns true when buff is a non-empty string', () => {
      getRuntimeValueSpy.mockReturnValue('warlock');
      expect(hasProtectionBuff(TARGET, CAMPAIGN)).toBe(true);
    });

    it('passes correct arguments to getRuntimeValue', () => {
      getRuntimeValueSpy.mockReturnValue({ source: 'test' });
      hasProtectionBuff(TARGET, CAMPAIGN);
      expect(getRuntimeValueSpy).toHaveBeenCalledWith(TARGET, 'protectionBuff', CAMPAIGN);
    });
  });

  describe('getProtectionBuffSource', () => {
    it('returns null when buff is not set', () => {
      getRuntimeValueSpy.mockReturnValue(null);
      expect(getProtectionBuffSource(TARGET, CAMPAIGN)).toBeNull();
    });

    it('returns null when buff is undefined', () => {
      getRuntimeValueSpy.mockReturnValue(undefined);
      expect(getProtectionBuffSource(TARGET, CAMPAIGN)).toBeNull();
    });

    it('returns the source when buff object has a source property', () => {
      getRuntimeValueSpy.mockReturnValue({ source: 'paladin' });
      expect(getProtectionBuffSource(TARGET, CAMPAIGN)).toBe('paladin');
    });

    it('returns null when buff object has no source property', () => {
      getRuntimeValueSpy.mockReturnValue({ timestamp: Date.now() });
      expect(getProtectionBuffSource(TARGET, CAMPAIGN)).toBeNull();
    });

    it('returns null when source property is undefined', () => {
      getRuntimeValueSpy.mockReturnValue({ timestamp: Date.now(), source: undefined });
      expect(getProtectionBuffSource(TARGET, CAMPAIGN)).toBeNull();
    });

    it('returns the source when buff is a plain string', () => {
      getRuntimeValueSpy.mockReturnValue('warlock');
      expect(getProtectionBuffSource(TARGET, CAMPAIGN)).toBeNull();
    });

    it('passes correct arguments to getRuntimeValue', () => {
      getRuntimeValueSpy.mockReturnValue({ source: 'test' });
      getProtectionBuffSource(TARGET, CAMPAIGN);
      expect(getRuntimeValueSpy).toHaveBeenCalledWith(TARGET, 'protectionBuff', CAMPAIGN);
    });
  });

  describe('clearProtectionBuff', () => {
    it('calls setRuntimeValue with null to clear the buff', () => {
      clearProtectionBuff(TARGET, CAMPAIGN);
      expect(setRuntimeValueSpy).toHaveBeenCalledWith(TARGET, 'protectionBuff', null, CAMPAIGN);
    });

    it('passes correct arguments to setRuntimeValue', () => {
      clearProtectionBuff(TARGET, CAMPAIGN);
      expect(setRuntimeValueSpy).toHaveBeenCalledWith(TARGET, 'protectionBuff', null, CAMPAIGN);
    });
  });
});
