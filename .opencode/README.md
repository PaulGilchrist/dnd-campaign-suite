# 📘 .opencode/ Architecture  
A deterministic, skill‑scoped, agent‑driven workflow for OpenCode (May 2026)

This project uses OpenCode as a structured, rule‑driven coding assistant.  
The `.opencode/` directory defines:

- Global project rules  
- Reusable skills  
- Atomic commands  
- Task‑specific agents  
- A router agent that automatically selects the correct agent  

The goal is to create a predictable, safe, and deterministic development workflow.

---------------------------------------------------------------------

1. Project‑Level Configuration (opencode.json)

Located at the project root: .opencode.json

This file defines:

Global skills (always loaded)
- coding-standards  
- architecture-rules  

These apply to every task in the project.

Global behavioral rules
- Always generate a plan before making changes  
- Never execute git commands without confirmation  
- Always follow coding standards and architecture rules  

Default model
Configured to use your local Qwen 27B coding model.

This file does not list agents or commands — OpenCode auto‑discovers those.

---------------------------------------------------------------------

2. Skills (.opencode/skills/)

Skills are reusable rule modules.  
They do not perform actions — they shape the agent’s reasoning.

Each skill lives in: .opencode/skills/<skill-name>/SKILL.md

Global skills (loaded by default)
- coding-standards — naming, TypeScript strictness, minimal diffs, safe changes  
- architecture-rules — folder boundaries, import rules, layering constraints  

Task‑specific skills (loaded by agents)
- react-patterns — functional components, hooks, memoization, accessibility  
- refactor-safety — small changes, no behavior changes, no rewrites  
- test-strategy — missing tests → failing tests → coverage  
- typescript-best-practices — narrowing, unions, strict mode  
- migration-helper — framework upgrades, API migrations  

Skills keep your rules centralized and version‑controlled.

---------------------------------------------------------------------

3. Commands (.opencode/commands/)

Commands are atomic actions.  
They do not think — they simply run.

Each command is a Markdown file with front‑matter: .opencode/commands/<command-name>.md

Your commands include:

format  
Formats the entire codebase using Prettier or project formatter.

lint  
Runs ESLint, applies autofixes, and guides manual fixes.

test  
Prioritizes:  
1. Missing tests  
2. Failing tests  
3. Coverage ≥ 85%  
Uses your Vitest scripts.

plan  
Generates a step‑by‑step plan before any code changes.

analyze  
Static analysis: TypeScript, unused exports, circular deps, architecture violations.

review  
Structured code review: risks, standards, architecture, missing tests.

Commands are intentionally simple — all reasoning happens in agents.

---------------------------------------------------------------------

4. Agents (.opencode/agents/)

Agents are task‑specific reasoning modules.  
Each agent loads only the skills it needs.

Each agent lives in: .opencode/agents/<agent-name>/AGENT.md

coding-agent  
General coding: features, bug fixes, new files.  
Loads: coding standards, architecture rules, React patterns, refactor safety, TS best practices.

refactor-agent  
Safe, incremental refactoring.  
Loads: coding standards, architecture rules, React patterns, refactor safety.

test-agent  
Writing, fixing, and improving tests.  
Loads: coding standards, test strategy, React patterns.

review-agent  
Structured code review.  
Loads: coding standards, architecture rules, test strategy, React patterns.

migration-agent  
Framework upgrades and large‑scale migrations.  
Loads: architecture rules, migration helper, TS best practices.

Agents enforce deterministic behavior and prevent accidental overreach.

---------------------------------------------------------------------

5. Task Router Agent (task-router)

Located at: .opencode/agents/task-router/AGENT.md

This agent:
- Reads the user’s request  
- Classifies it  
- Delegates to the correct agent  
- Never edits files  
- Never runs commands  
- Explains its routing decision  

Routing rules:

New features, bug fixes → coding-agent  
Refactoring → refactor-agent  
Tests → test-agent  
Code review → review-agent  
Migrations → migration-agent  

Example workflow:
opencode run task-router: "Refactor the login flow"

---------------------------------------------------------------------

6. Workflow Summary

1. You issue a request  
   opencode run task-router: "Add tests for UserSettings"

2. Router selects the correct agent  
   Routing to test-agent because the request involves writing tests.

3. Agent generates a plan  
   Agents always plan first.

4. You approve  
   No changes happen without your confirmation.

5. Agent executes the plan  
   Using commands + skills.

This creates a safe, predictable, deterministic development loop.

---------------------------------------------------------------------

7. Philosophy of This Architecture

Determinism  
Agents always plan first.  
Commands never think.  
Skills define rules.  
No surprises.

Separation of concerns  
Skills = rules  
Commands = actions  
Agents = reasoning  
Router = classification  

Minimal context  
Only the skills needed for a task are loaded.

Safety  
No git commands without confirmation.  
No multi‑file edits without approval.  
No behavior changes during refactors.

---------------------------------------------------------------------

8. Extending This System

You can add:
- New agents  
- New skills  
- New commands  
- Project‑specific rules  
- Domain‑specific patterns  

Everything is modular.
