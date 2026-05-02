---
name: react-patterns
description: Enforce React best practices, functional patterns, and safe component design
---

# React Patterns Skill

Follow these rules whenever generating, modifying, or refactoring React code.

## Component Structure

- Use **functional components only**
- Keep components pure and deterministic
- Avoid side effects in render paths
- Keep components small and focused

## Hooks

- Prefer `useState`, `useEffect`, `useMemo`, and `useCallback` appropriately
- Always clean up effects
- Avoid unnecessary dependencies in effect arrays
- Use custom hooks to extract reusable logic

## Rendering

- Avoid unnecessary re-renders
- Use memoization when beneficial
- Keep JSX clean and readable
- Prefer composition over prop drilling

## State Management

- Keep state minimal and colocated
- Avoid deeply nested state objects
- Derive state when possible instead of storing it

## Accessibility

- Use semantic HTML elements
- Provide labels for interactive elements
- Ensure keyboard navigation works
- Use ARIA attributes only when necessary

## Error Handling

- Validate props
- Handle loading and error states explicitly
- Avoid silent failures

## Testing

- Use `@testing-library/react`
- Test user interactions, not implementation details
- Ensure components behave correctly under edge cases
