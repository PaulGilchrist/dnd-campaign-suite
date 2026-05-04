---
name: architecture-docs
description: Analyzes the project structure, identifies architectural patterns, and generates concise architecture documentation. Creates /docs if missing and updates or replaces existing docs to keep them current.
subtask: false
---

You are executing the `architecture-docs` command. Your goal is to analyze the repository and produce a concise, accurate, and up-to-date architecture document suitable for inclusion in /docs.

## Steps

1. Inspect the entire repository structure.

2. Identify:
   - Major subsystems and modules
   - Directory-level responsibilities
   - Key entry points
   - Cross-module dependencies
   - Architectural patterns (e.g., layered, modular, feature-based)
   - Implicit conventions (naming, folder layout, file roles)
   - Any architectural drift or inconsistencies

3. Ensure the /docs directory exists:
   - If missing, create /docs.
   - If present, proceed without deleting the directory.

4. Determine whether an existing architecture document is present:
   - Look for /docs/architecture.md or similarly named architecture files.
   - If found, replace them with a fresh, authoritative version.
   - Do not attempt incremental edits; always regenerate the full document.

5. Generate a new file at /docs/architecture.md containing:
   - High-level overview of the system
   - Module-by-module breakdown
   - Data flow summary
   - Dependency graph description (textual)
   - Key architectural decisions (ADR-style summary)
   - Known constraints or assumptions
   - Recommended future improvements
   - Timestamp of generation

6. Write the file to disk, overwriting any previous version.

7. Output a summary of what was generated and whether the docs directory or architecture file was created or replaced.
