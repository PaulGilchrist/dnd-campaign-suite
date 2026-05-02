---
description: Perform a full static analysis pass to detect architectural issues, unused code, circular dependencies, and other structural risks
subtask: true
---

Your goal is to analyze the codebase for structural, architectural, and maintainability issues before making any changes. This ensures that future edits are safe, localized, and consistent with project standards.

## Step 1 — Run TypeScript analysis

Run:

    npx tsc --noEmit

Collect:
- Type errors
- Incorrect imports
- Missing or invalid types
- Deprecated patterns
- Any file that fails strict mode

These issues must be resolved before deeper analysis.

## Step 2 — Detect unused exports and dead code

Run:

    npx ts-prune

Identify:
- Unused functions
- Unused components
- Unused constants or utilities
- Dead code paths

Mark each for cleanup or refactoring.

## Step 3 — Detect circular dependencies

Run:

    npx madge src --circular

Collect:
- Circular import chains
- Modules that depend on each other indirectly
- Violations of architectural boundaries

These must be addressed before adding new features.

## Step 4 — Validate folder and import structure

Check:
- Components under `src/components`
- Business logic under `src/lib`
- API routes under `src/api`
- No cross‑layer imports that violate architecture rules

## Step 5 — Summarize findings

Provide:
- A list of issues grouped by severity
- Files requiring immediate attention
- Suggested fixes
- Any risks that could affect upcoming work

## Important

- Do not modify files during analysis
- Keep findings concise and actionable
- Prioritize structural issues before stylistic ones
