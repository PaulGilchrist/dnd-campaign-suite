---
name: coding-standards
description: Coding Standards
---
## Reuirements

- Use JavaScript, not TypeScript.
- Match the existing folder structure.
- NEVER use inline styles.
- NEVER use !important in CSS.
- You MUST avoid new CSS, using only existing styles.  If you feel a new style is needed, you MUST explain why and get permission before proceeding.

## Conventions

- `"type": "module"` in package.json — all source files use ES modules; `.cjs` only for eslint config
- Components use `.jsx`, pure utilities use `.js`
- Font Awesome icons imported via CSS in `main.jsx` — use `<i className="fa-solid fa-...">` in JSX