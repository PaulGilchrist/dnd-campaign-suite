---
name: tool-todo-calling
description: Proper method to call the todo tool in OpenCode
---

## todowrite Tool — Correct Input Format

### Requirements
1. Root key: todos — must be a JSON array (not a string).
   - The first error (Expected array, got "...") happened when I accidentally passed a plain string instead of a structured array. Always use { "todos": [...]}.
2. Each item must have exactly 3 keys:
   | Key | Type | Values |
   |-----|------|--------|
   | content | string | Any text describing the task |
   | status | enum | "pending" \| "in_progress" \| "completed" \| "cancelled" |
   | priority | enum | "high" \| "medium" \| "low" |
3. All 3 keys are required on every item. Omitting any key (e.g. forgetting priority) triggers SchemaError(Missing key "...").

## Examples
### Correct:
{
  "todos": [
    { "content": "Fix the bug", "status": "in_progress", "priority": "high" },
    { "content": "Run tests",   "status": "pending",       "priority": "high" }
  ]
}
### Incorrect (causes SchemaError):
- Using strings instead of arrays: "{ \"todos\": \"...\" }"
- Missing priority, status, or content on any item.
- Using invalid enums (e.g. "pending" as status but "urgent" as priority doesn't exist — valid values are high/medium/low).

### Quick Cheatsheet
todos      →  must be an array of objects

each item:
  -  content   →  string   (required)
  -  status    →  enum    (required): pending | in_progress | completed | cancelled
  -  priority  →  enum    (required): high    | medium     | low