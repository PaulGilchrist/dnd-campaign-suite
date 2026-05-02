---
description: Perform a structured code review to detect risks, inconsistencies, and violations of project standards
subtask: true
---

Your goal is to review the current changeset and identify issues before committing. This includes correctness, safety, architectural alignment, and adherence to coding standards.

## Step 1 — Gather the diff

Run:

    git diff --staged || git diff

Collect:
- Added files
- Modified files
- Deleted files
- Renamed files

Ensure the diff is complete and up to date.

## Step 2 — Evaluate correctness and intent

For each change:
- Confirm the behavior matches the intended feature or fix
- Ensure no unrelated changes are included
- Verify that logic is minimal and localized
- Identify any accidental behavior changes

## Step 3 — Check for architectural violations

Validate:
- Correct folder placement
- Allowed import boundaries
- No circular dependencies introduced
- No business logic leaking into UI components

## Step 4 — Check for coding standards compliance

Ensure:
- Functional components only
- Strict TypeScript usage
- Consistent naming conventions
- Proper error handling
- No unnecessary abstractions

## Step 5 — Identify risks and improvements

Flag:
- Missing tests
- Missing error cases
- Overly complex functions
- Duplicate logic
- Unclear variable names
- Unhandled async flows

## Step 6 — Summarize review findings

Provide:
- A list of required fixes
- A list of optional improvements
- Any potential regressions
- A final recommendation on whether the changes are safe to commit

## Important

- Do not rewrite code during review
- Keep feedback specific and actionable
- Focus on correctness and safety first
