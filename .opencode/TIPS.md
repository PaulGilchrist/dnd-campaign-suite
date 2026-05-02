# Task‑Router Cheat Sheet (Agent Mappings + How to Use It for Everything)

## tldr: 
    opencode run task-router: "<your request>"

============================================================
1. ROUTER → AGENT MAPPINGS (DETERMINISTIC)
============================================================

The task-router uses rule-based classification.  
Here are the exact mappings:

• Feature work → coding-agent  
  (new components, new files, bug fixes, utilities, hooks)

• Bug fixes → coding-agent  
  (anything that changes behavior intentionally)

• Linting → coding-agent  
  (because linting modifies files)

• Refactoring → refactor-agent  
  (behavior-preserving structural changes)

• Cleanup → refactor-agent  
  (renaming, reorganizing, extracting helpers)

• Tests → test-agent  
  (writing tests, fixing tests, improving coverage)

• Code review → review-agent  
  (diff review, risk detection, standards enforcement)

• Static analysis → review-agent  
  (analyze command, architecture checks, unused exports)

• Migrations → migration-agent  
  (framework upgrades, API migrations, breaking changes)

• Anything unclear → router asks clarifying questions  
  (it never guesses)


============================================================
2. HOW TO ALWAYS USE TASK-ROUTER
============================================================

You can run *every* task through the router.  
The router will:

1. Read your request  
2. Classify it  
3. Choose the correct agent  
4. Rewrite the request in agent-ready form  
5. Delegate automatically  

This means you can stop thinking about which agent to use.

Examples:

• “Add tests for LoginForm”
  → router → test-agent → test command

• “Fix the bug in userService”
  → router → coding-agent → plan → build

• “Refactor the auth flow”
  → router → refactor-agent

• “Review the current diff”
  → router → review-agent

• “Analyze the project”
  → router → review-agent → analyze command

• “Upgrade to React 19”
  → router → migration-agent


============================================================
3. HOW TO INVOKE IT (UNIVERSAL PATTERN)
============================================================

Use this for everything:

opencode run task-router: "<your request>"

Examples:

opencode run task-router: "Fix the failing tests"
opencode run task-router: "Refactor the login flow"
opencode run task-router: "Review the current changes"
opencode run task-router: "Add tests for UserSettings"
opencode run task-router: "Analyze the project"
opencode run task-router: "Upgrade the API layer"


============================================================
4. WHY THIS WORKS SO WELL
============================================================

• You never have to remember which agent handles what  
• The router is deterministic and rule-based  
• It never performs work itself  
• It always produces a clean, agent-ready reformulation  
• It prevents accidental misuse of agents  
• It keeps your workflow simple and predictable  


============================================================
5. TL;DR
============================================================

YES — you can always use task-router.  
It will always pick the correct agent.  
You never need to manually choose an agent again.
