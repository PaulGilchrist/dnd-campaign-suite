// @maintained-by-ai
import { describe, it, expect } from 'vitest';

import {
  registerPendingSavePrompt,
  getPendingSavePrompt,
  peekPendingSavePrompt,
} from './pendingSaveRegistry.js';

// The module is a pure in-memory Map singleton with no timers — staged save
// prompts wait indefinitely until consumed (constitution: prompts never
// auto-resolve on a clock). Vitest gives each test file a fresh module
// registry, and each test below uses its own static key and consumes
// everything it registers, so no cross-test contamination.
describe('pendingSaveRegistry', () => {
  it('hands back a registered prompt exactly once, then re-arms after consumption', () => {
    const promptId = 'test-lifecycle';
    const prompt1 = { spellName: 'Fireball', dc: 15, saveType: 'dexterity', targetName: 'Thorin' };
    const prompt2 = { spellName: 'Lightning Bolt', dc: 17, saveType: 'dexterity', targetName: 'Thorin' };

    // Nothing staged yet.
    expect(getPendingSavePrompt(promptId)).toBeNull();

    registerPendingSavePrompt(promptId, prompt1);

    expect(getPendingSavePrompt(promptId)).toStrictEqual(prompt1);
    // get consumes the entry: second read finds nothing.
    expect(getPendingSavePrompt(promptId)).toBeNull();

    // After consumption the same promptId can stage a new prompt.
    registerPendingSavePrompt(promptId, prompt2);
    expect(getPendingSavePrompt(promptId)).toStrictEqual(prompt2);
    expect(getPendingSavePrompt(promptId)).toBeNull();
  });

  it('overwrites with the latest prompt when the same promptId is registered twice before consumption', () => {
    const promptId = 'test-overwrite';
    const stale = { spellName: 'Fireball', dc: 15, saveType: 'dexterity', targetName: 'Thorin' };
    const fresh = { spellName: 'Hold Monster', dc: 18, saveType: 'wisdom', targetName: 'Thorin' };

    registerPendingSavePrompt(promptId, stale);
    registerPendingSavePrompt(promptId, fresh);

    expect(getPendingSavePrompt(promptId)).toStrictEqual(fresh);
    // Overwrite does not append: consumption is still one-time.
    expect(getPendingSavePrompt(promptId)).toBeNull();
  });

  it('consumes only the requested promptId, leaving other pending prompts intact', () => {
    const idA = 'test-key-a';
    const idB = 'test-key-b';
    const promptA = { spellName: 'Burning Hands', dc: 13, saveType: 'dexterity', targetName: 'Aria' };
    const promptB = { spellName: 'Dominate Person', dc: 18, saveType: 'wisdom', targetName: 'Bram' };

    registerPendingSavePrompt(idA, promptA);
    registerPendingSavePrompt(idB, promptB);

    expect(getPendingSavePrompt(idA)).toStrictEqual(promptA);
    // Consuming idA must not disturb idB.
    expect(peekPendingSavePrompt(idB)).toStrictEqual(promptB);
    expect(getPendingSavePrompt(idB)).toStrictEqual(promptB);
    expect(getPendingSavePrompt(idA)).toBeNull();
    expect(getPendingSavePrompt(idB)).toBeNull();
  });

  it('peek reads a pending prompt without consuming it, so get still delivers it', () => {
    const promptId = 'test-peek';
    const prompt = { spellName: 'Fireball', dc: 15, saveType: 'dexterity', targetName: 'Thorin' };

    expect(peekPendingSavePrompt(promptId)).toBeNull();

    registerPendingSavePrompt(promptId, prompt);

    // Peeking (as App.jsx does on reconnect) leaves the prompt staged...
    expect(peekPendingSavePrompt(promptId)).toStrictEqual(prompt);
    expect(peekPendingSavePrompt(promptId)).toStrictEqual(prompt);
    // ...so the eventual consumer still gets it exactly once.
    expect(getPendingSavePrompt(promptId)).toStrictEqual(prompt);
    expect(peekPendingSavePrompt(promptId)).toBeNull();
  });
});
