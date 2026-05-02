---
description: Run the project's linter and fix all detectable issues
subtask: true
---

Your goal is to ensure the codebase adheres to the project's linting rules. This improves readability, prevents common bugs, and enforces consistent patterns across the repository.

## Step 1 — Run the linter

Run:

    npm run lint --silent || npx eslint .

Collect:
- Files with **errors** — must be fixed immediately
- Files with **warnings** — should be addressed unless explicitly allowed
- Any **autofixable issues** — apply fixes automatically

## Step 2 — Apply autofixes

Run:

    npx eslint . --fix

Then review the changes to ensure no unintended modifications were introduced.

## Step 3 — Fix remaining issues manually

For each remaining lint error:

1. Open the file
2. Read the rule description
3. Apply the minimal fix required
4. Re-run the linter to confirm the issue is resolved

## Important

- Do not disable lint rules unless explicitly approved
- Keep lint fixes separate from functional changes
- Lint errors must be resolved before running tests or committing code
