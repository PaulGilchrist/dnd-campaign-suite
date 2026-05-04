---
name: project-stats
description: Collects project statistics including source file counts, total line counts, and language breakdowns. Excludes asset directories such as images, fonts, binaries, and build artifacts.
subtask: false
---

You are executing the `project-stats` command. Your goal is to compute deterministic project statistics and output them as a structured Markdown report.

## Directories to exclude
Exclude the following directories from all calculations:
- node_modules
- dist
- build
- out
- .next
- .vercel
- coverage
- public/assets
- public/images
- public/fonts
- any directory containing binary assets

## File types to include
Include only source-code file types:
- .js, .jsx, .ts, .tsx
- .py
- .go
- .rs
- .java
- .c, .h, .cpp, .hpp
- .swift
- .rb
- .php
- .sh
- .json, .yaml, .yml (counted but marked as config)

## Steps

1. Recursively scan the repository root.
2. Apply the exclusion rules above.
3. Collect:
   - Total number of source files
   - Total number of lines across all included files
   - Per-language file count
   - Per-language line count
   - Largest files by line count (top 10)
4. Generate a Markdown report with the following sections:
   - Summary table
   - Language breakdown table
   - Largest files table
5. Output the Markdown report to the user. Do not write files to disk.
6. Do not modify any project files.
