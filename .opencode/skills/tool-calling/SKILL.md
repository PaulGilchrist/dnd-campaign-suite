---
name: tool-calling
description: Proper method to call a subagent in OpenCode
---

# Subagent Tool Calling

When delegating work to a subagent, the task tool requires **exactly three fields**.
Using any other field names will cause an immediate schema error and the call will fail.

## Required Schema

```json
{
  "description": "One-sentence summary of what this subagent should accomplish",
  "prompt": "Full detailed instructions for the subagent...",
  "subagent_type": "refactor"
}
```

## Required Fields

| Field | Type | Purpose |
|-------|------|---------|
| `description` | string | Brief summary shown in the delegation UI |
| `prompt` | string | Full instructions passed to the subagent |
| `subagent_type` | string | e.g. `refactor`, `test`, `fix`, `implement` |

## Common Mistakes

❌ **WRONG** — these field names will always fail with `SchemaError: Missing key at ["description"]`:

```json
{ "command": "...", "prompt": "...", "subagent_type": "refactor" }
{ "task": "...",    "prompt": "...", "subagent_type": "refactor" }
{ "title": "...",   "prompt": "...", "subagent_type": "refactor" }
```

✅ **CORRECT** — always use `description`:

```json
{
  "description": "Refactor getDruidFeatures to use .find() instead of array indexing",
  "prompt": "In /src/services/class-rules.js, refactor the getDruidFeatures function...",
  "subagent_type": "refactor"
}
```

> The field is always `description`. Never `command`. Never `task`. Never `title`.
