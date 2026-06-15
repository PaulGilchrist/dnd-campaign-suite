export function injectSpecialActions(existingActions, features, options = {}) {
  const { includeAutomation = true } = options;
  const added = [];
  features.forEach(f => {
    if (!existingActions.has(f.name)) {
      const entry = {
        name: f.name,
        description: f.description,
        type: f.type || 'passive',
        source: 'feat',
      };
      if (includeAutomation && f.automation) {
        entry.automation = f.automation;
      }
      existingActions.add(f.name);
      added.push(entry);
    }
  });
  return added;
}
