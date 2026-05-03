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
- NEVER CHANGE PRODUCTION CODE WHEN WRITING TESTS.  Test much match codes current behavior when written.
- Never GIT commit any code when writing tests

## General Architecture

- Framework: Vitest with jsdom, globals enabled
- Setup: `src/tests/setup.js` (imports `@testing-library/jest-dom/vitest` + cleanup)
- Pattern: `src/**/*.{test,spec}.{js,jsx}`
- Run single test: `npm run test:run src/path/to/file.test.jsx`
- All `services/*.js` files have a paired `*.test.js` — keep tests in sync
- Each service module is co-located with its test file (`foo.js` + `foo.test.js`)
- Coverage thresholds are all 0 (no enforced minimums)

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
