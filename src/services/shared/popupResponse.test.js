// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { automationInfoPopup } from './popupResponse.js';

// Pure envelope builder (popupResponse.js:1-12): zero mocks by design.
// Envelope contract is the gold toStrictEqual below; callers
// (automation/index.js spell_modifier L334, extraActionHandler L131,
// autoRerollHandler L544, bonusActionAttackHandler L271) delegate here
// and are pinned at the delegation seam in their own lanes.
describe('automationInfoPopup', () => {
  it('builds the exact popup envelope: full key-set, exact bytes, no fabricated keys', () => {
    const automation = { type: 'spell_attack', damage: '1d10' };
    const action = {
      name: 'Fire Bolt',
      description: 'A bolt of fire',
      automation,
    };

    const result = automationInfoPopup(action);

    expect(result).toStrictEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fire Bolt',
        automationType: 'spell_attack',
        description: 'A bolt of fire',
        automation: { type: 'spell_attack', damage: '1d10' },
      },
    });
  });

  it("enforces the description `|| ''` operator table: falsy arms coerce, truthy arms pass through verbatim", () => {
    const base = { name: 'Test Action', automation: { type: 'misc' } };

    // Missing-key and explicit-undefined share the identical runtime arm.
    expect(automationInfoPopup(base).payload.description).toBe('');
    expect(automationInfoPopup({ ...base, description: undefined }).payload.description).toBe('');
    expect(automationInfoPopup({ ...base, description: null }).payload.description).toBe('');
    expect(automationInfoPopup({ ...base, description: 0 }).payload.description).toBe('');
    expect(automationInfoPopup({ ...base, description: false }).payload.description).toBe('');
    expect(automationInfoPopup({ ...base, description: '' }).payload.description).toBe('');
    // Truthy non-strings are NOT stringified; whitespace is not trimmed.
    expect(automationInfoPopup({ ...base, description: 42 }).payload.description).toBe(42);
    expect(automationInfoPopup({ ...base, description: '  ' }).payload.description).toBe('  ');
  });

  it('leaves automationType undefined (never fabricated) when automation has no type, envelope otherwise intact', () => {
    const result = automationInfoPopup({ name: 'Test Action', automation: {} });

    expect(result).toStrictEqual({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Test Action',
        automationType: undefined,
        description: '',
        automation: {},
      },
    });
  });

  it("throws TypeError verbatim when action.automation is absent (unguarded read, popupResponse.js:7)", () => {
    expect(() => automationInfoPopup({ name: 'No Automation' })).toThrow(
      TypeError,
    );
    expect(() => automationInfoPopup({ name: 'No Automation' })).toThrow(
      /^Cannot read properties of undefined \(reading 'type'\)$/,
    );
  });

  it('returns fresh envelope objects per call while passing automation by reference, never by copy', () => {
    const action = { name: 'Fire Bolt', automation: { type: 'spell_attack' } };

    const first = automationInfoPopup(action);
    const second = automationInfoPopup(action);

    expect(first).not.toBe(second);
    expect(first.payload).not.toBe(second.payload);
    expect(first.payload.automation).toBe(action.automation);
    expect(second.payload.automation).toBe(action.automation);
    // By-reference law: post-build mutation of the caller's automation is visible.
    action.automation.damage = '2d10';
    expect(first.payload.automation.damage).toBe('2d10');
  });

  it('declares arity 1 (function length census)', () => {
    expect(automationInfoPopup.length).toBe(1);
  });
});
