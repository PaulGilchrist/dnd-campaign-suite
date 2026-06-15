export function infoPopup(actionName, description, automation, extraProps) {
  const result = {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: actionName,
      description,
      automation,
    },
  };
  if (extraProps) {
    Object.assign(result, extraProps);
  }
  return result;
}
