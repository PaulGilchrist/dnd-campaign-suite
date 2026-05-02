---
name: test-strategy
description: Provide a consistent testing strategy for components, hooks, utilities, and services
---

# Test Strategy Skill

Follow these rules when writing or modifying tests.

## General Principles

- Test behavior, not implementation details
- Keep tests isolated and deterministic
- Use descriptive `describe` and `it` blocks
- Prefer realistic user flows over shallow assertions

## General Architecture

- Vitest config: `vitest.config.js` — jsdom environment, globals enabled, setup file at `src/test/setup.js` (imports `@testing-library/jest-dom`).
- Tests are co-located or in `src/**/*.test.{js,jsx}` — ~48 test files across components, hooks, utils, and data layers.
- To run a single test: `npx vitest run src/path/to/file.test.jsx`

## Components

- Use `render()` from @testing-library/react
- Test DOM output, interactions, and state changes
- Mock external services and network calls
- Test edge cases: missing props, invalid data, conditional rendering

## Hooks

- Use `renderHook()` for hook testing
- Test state transitions and effects
- Mock dependencies and timers when needed

## Utilities

- Test pure functions with multiple input variations
- Cover error cases and boundary conditions
- Avoid mocking unless necessary

## Services

- Mock network calls
- Validate request shapes and response handling
- Test retry logic, error handling, and fallbacks

## Coverage

- Ensure all public exports are tested
- Cover error paths and conditional branches
- Avoid over-testing trivial passthrough files

## Maintainability

- Keep tests small and focused
- Avoid brittle selectors or DOM assumptions
- Prefer readability over cleverness
