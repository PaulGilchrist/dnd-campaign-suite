// SavePromptModal — test-utils exported utility verification
// Tests the createMockSubscriber factory and fixture functions.
// These utilities are shared across all SavePromptModal test files.
//
// Cleanup: Removed 14 redundant/brittle/low-value tests (19 → 5):
//   - Entire "createMockSubscriber integration" describe block (5 tests):
//     All test SavePromptModal rendering, already covered in rendering.test.jsx
//   - 3 createCharacter custom-param tests: consolidated into 1 test
//   - 1 createRageCharacter custom-rage test: consolidated into structure test
//   - setupDefaults/cleanupDefaults tests: low-value, test test-utility internals
//   - setupGlobalEventSource/teardownGlobalEventSource tests: trivial setup/teardown
//   - 2 createMockSubscriber event-dispatch tests: brittle, test internal event key format

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { createCharacter, createRageCharacter, createMockSubscriber } from './SavePromptModal.test-utils.jsx';

describe('SavePromptModal — test-utils exported functions', () => {
  it('createCharacter returns expected structure with all defaults', () => {
    const char = createCharacter('TestChar');
    expect(char.name).toBe('TestChar');
    expect(char.saveModifiers).toEqual([]);
    expect(char.computedStats.evasionEffects).toEqual([]);
    expect(char.computedStats.abilities).toHaveLength(6);
    expect(char.computedStats.abilities[0].name).toBe('Strength');
    expect(char.computedStats.abilities[0].bonus).toBe(2);
  });

  it('createCharacter accepts custom saveModifiers, evasionEffects, and abilities', () => {
    const mods = [{ target: 'saving_throw', effect: 'advantage' }];
    const evasions = [{ saveType: 'DEX', shareable: true }];
    const abils = [{ name: 'Strength', bonus: 5 }];
    const char = createCharacter('TestChar', mods, evasions, abils);
    expect(char.saveModifiers).toEqual(mods);
    expect(char.computedStats.evasionEffects).toEqual(evasions);
    expect(char.computedStats.abilities).toEqual(abils);
  });

  it('createCharacter abilities default has 6 ability scores in standard order', () => {
    const char = createCharacter('TestChar');
    const names = char.computedStats.abilities.map(a => a.name);
    expect(names).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);
  });

  it('createRageCharacter returns expected structure with custom rage damage', () => {
    const char = createRageCharacter('Rager', 6);
    expect(char.name).toBe('Rager');
    expect(char.level).toBe(1);
    expect(char.class.class_levels).toEqual([{ rage_damage: 6 }]);
    expect(char.computedStats.abilities).toEqual([{ name: 'Constitution', bonus: 3 }]);
    expect(char.computedStats.evasionEffects).toEqual([]);
    expect(char.computedStats.automation).toEqual({ passives: [] });
    expect(char.saveModifiers).toEqual([]);
  });

  it('createMockSubscriber returns a React component that renders trigger buttons', () => {
    const MockSubscriber = createMockSubscriber('my-campaign');
    render(React.createElement(MockSubscriber, { handleEvent: vi.fn() }));
    expect(screen.getByTestId('subscriber-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('subscriber-trigger-second')).toBeInTheDocument();
    expect(screen.getByTestId('subscriber-trigger-cleared')).toBeInTheDocument();
    expect(screen.getByTestId('subscriber-trigger-disadvantage')).toBeInTheDocument();
    expect(screen.getByTestId('subscriber-trigger-dex')).toBeInTheDocument();
    expect(screen.getByTestId('subscriber-trigger-none-dc')).toBeInTheDocument();
  });
});

