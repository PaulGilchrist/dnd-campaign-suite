import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import { hasProtectionBuff, getProtectionBuffSource, clearProtectionBuff } from './protectionBuffUtils.js';

describe('protectionBuffUtils', () => {
  let getRuntimeValueSpy;
  let setRuntimeValueSpy;

  beforeEach(() => {
    getRuntimeValueSpy = vi.spyOn(runtimeState, 'getRuntimeValue');
    setRuntimeValueSpy = vi.spyOn(runtimeState, 'setRuntimeValue');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hasProtectionBuff', () => {
    it('returns false when buff is not set', () => {
      getRuntimeValueSpy.mockReturnValue(null);
      const result = hasProtectionBuff('TestTarget', 'testCampaign');
      expect(result).toBe(false);
    });

    it('returns true when buff is a simple value without timestamp', () => {
      getRuntimeValueSpy.mockReturnValue({ source: 'some source' });
      const result = hasProtectionBuff('TestTarget', 'testCampaign');
      expect(result).toBe(true);
    });

    it('returns true when buff has recent timestamp', () => {
      const recentTimestamp = Date.now() - 1000;
      getRuntimeValueSpy.mockReturnValue({ timestamp: recentTimestamp, source: 'some source' });
      const result = hasProtectionBuff('TestTarget', 'testCampaign');
      expect(result).toBe(true);
    });



    it('returns false when buff is undefined', () => {
      getRuntimeValueSpy.mockReturnValue(undefined);
      const result = hasProtectionBuff('TestTarget', 'testCampaign');
      expect(result).toBe(false);
    });
  });

  describe('getProtectionBuffSource', () => {
    it('returns null when buff is not set', () => {
      getRuntimeValueSpy.mockReturnValue(null);
      const result = getProtectionBuffSource('TestTarget', 'testCampaign');
      expect(result).toBeNull();
    });

    it('returns the source from buff object', () => {
      getRuntimeValueSpy.mockReturnValue({ source: 'paladin' });
      const result = getProtectionBuffSource('TestTarget', 'testCampaign');
      expect(result).toBe('paladin');
    });

    it('returns null when buff object has no source property', () => {
      getRuntimeValueSpy.mockReturnValue({ timestamp: Date.now() });
      const result = getProtectionBuffSource('TestTarget', 'testCampaign');
      expect(result).toBeNull();
    });



    it('returns source for buff without timestamp', () => {
      getRuntimeValueSpy.mockReturnValue({ source: 'warlock' });
      const result = getProtectionBuffSource('TestTarget', 'testCampaign');
      expect(result).toBe('warlock');
    });
  });

  describe('clearProtectionBuff', () => {
    it('calls setRuntimeValue with null', () => {
      setRuntimeValueSpy.mockReturnValue();
      clearProtectionBuff('TestTarget', 'testCampaign');
      expect(setRuntimeValueSpy).toHaveBeenCalledWith('TestTarget', 'protectionBuff', null, 'testCampaign');
    });
  });
});
