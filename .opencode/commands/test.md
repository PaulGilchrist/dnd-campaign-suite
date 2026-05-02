---
description: Run the test suite with priority on missing tests, failing tests, and achieving ≥85% coverage
subtask: true
---

Your goal is to ensure the project has complete, reliable test coverage by following a strict priority order:

1. Identify components and services **with no tests at all**
2. Fix any **existing failing tests**
3. Raise overall coverage to **at least 85%**

This workflow ensures correctness before coverage and prevents regressions.

---

## Step 1 — Identify files with *no* tests

Run:

    npm run test:coverage

Then inspect the coverage report for:
- Files showing **0% coverage**
- Files missing a corresponding `*.test.*` file
- Any component or service under `src/` with no test artifacts

These files have the highest priority. For each uncovered file:

1. Open the source file and understand its public API  
2. Check existing test conventions in the project  
3. Create a new test file co-located with the source  
4. Test all public exports, props, behaviors, and edge cases  
5. Use `@testing-library/react` for UI components  
6. Use `renderHook()` for hooks  
7. Test pure functions directly  

Do not move on until all missing-test files have at least baseline coverage.

---

## Step 2 — Fix failing tests

After adding missing tests, run:

    npm run test:run

Collect:
- Failing tests — must be fixed immediately  
- Tests failing due to outdated assumptions  
- Tests failing due to recent refactors  

For each failing test:

1. Read the failure output  
2. Open both the test file and the implementation  
3. Determine whether the test or the implementation is incorrect  
4. Apply the minimal fix  
5. Re-run `npm run test:run` to confirm the fix  

Do not skip or comment out tests.  
Do not modify implementation code unless the test reveals a real bug.

---

## Step 3 — Raise coverage to ≥85%

Once all tests pass, run:

    npm run test:coverage

Focus on:
- Files below **85%** coverage  
- Branches or lines marked as uncovered  
- Conditional logic, error paths, optional props, and edge cases  

For each below-threshold file:

1. Run targeted coverage:

       npx vitest run --coverage src/path/to/file.tsx

2. Read the uncovered lines  
3. Add tests that exercise those paths  
4. Re-run coverage until the file reaches ≥85%  

---

## Step 4 — Final verification

Run:

    npm run test:coverage

Confirm:
- All tests pass  
- No file under `src/` is below **85%** coverage  
- No component or service is missing a test file  
- No failing or flaky tests remain  

---

## Important

- Always prioritize **missing tests → failing tests → coverage gaps**  
- Keep test changes separate from functional changes  
- Never reduce coverage or remove tests without explicit approval  
- Avoid over-testing trivial passthrough files (3–5 LOC)  
- Skip CSS-only files and `main.jsx` — no unit tests needed
- Run in small batches (2-5 files) to keep iterations fast
- Trivially thin passthrough files (3-5 LOC) can be skipped if already acceptable
