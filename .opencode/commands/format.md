---
description: Format the entire codebase using the project's formatter
subtask: true
---

Your goal is to ensure the entire repository is formatted consistently according to the project's established rules. This prevents noisy diffs, reduces merge conflicts, and keeps AI‑generated code aligned with team standards.

## Step 1 — Run the formatter

Run:

    npm run format --silent || npx prettier --write .

This will apply formatting to all supported file types across the project.

## Step 2 — Verify formatting changes

After the formatter runs:

- Review the modified files in your editor
- Confirm no unintended structural changes occurred
- Ensure that only whitespace, indentation, and stylistic adjustments were made

## Step 3 — Re-run if needed

If you manually adjust any files or resolve merge conflicts, run the formatter again to maintain consistency.

## Important

- Do not manually reformat files — always use the formatter
- Never commit unformatted code
- Keep formatting changes separate from functional changes to maintain clean commit history
