// No component-specific CSS needed - uses shared wizard styles

function WizardStepSpecial({ formData, onArrayFieldChange }) {
  // Normalize special actions to ensure they're objects with name/description/details
  const normalizedActions = (formData.specialActions || []).map(action => 
    typeof action === 'string' ? { name: action, description: '', details: null } : action
  );
  
  // Track form fields as part of formData to persist across renders
  const newActionName = formData.newSpecialAction?.name || '';
  const newActionDescription = formData.newSpecialAction?.description || '';
  const newActionDetails = formData.newSpecialAction?.details || '';
  
  // Update function for form fields
  const updateNewActionField = (field, value) => {
    onArrayFieldChange('newSpecialAction', { ...formData.newSpecialAction, [field]: value });
  };

  const addAction = () => {
    if (newActionName.trim()) {
      const newAction = {
        name: newActionName.trim(),
        description: newActionDescription.trim(),
        details: newActionDetails.trim() || null
      };
      
      // Check if action with same name already exists
      const existingActions = formData.specialActions || [];
      const updatedActions = [...existingActions, newAction];
      
      onArrayFieldChange('specialActions', updatedActions);
      // Clear the form fields
      onArrayFieldChange('newSpecialAction', {});
    }
  };

  const removeAction = (normalizedIndex) => {
    // Remove from normalized array, then pass original to parent
    const updatedNormalized = normalizedActions.filter((_, i) => i !== normalizedIndex);
    onArrayFieldChange('specialActions', updatedNormalized);
  };

  return (
    <div className="wizard-step">
      <h2>Step 12: Special Actions</h2>
      
      {/* Add new action form */}
      <div className="form-group">
        <label>Add New Action</label>
        <input
          type="text"
          value={newActionName}
          onChange={(e) => updateNewActionField('name', e.target.value)}
          placeholder="Action name (required)"
          className="wizard-input"
        />
        <textarea
          value={newActionDescription}
          onChange={(e) => updateNewActionField('description', e.target.value)}
          placeholder="Description"
          className="wizard-textarea"
          rows={2}
        />
        <textarea
          value={newActionDetails}
          onChange={(e) => updateNewActionField('details', e.target.value)}
          placeholder="Additional details (optional)"
          className="wizard-textarea"
          rows={2}
        />
        <button type="button" onClick={addAction} className="btn btn-primary">
          Add Action
        </button>
      </div>

      {/* List of existing actions */}
      {normalizedActions && normalizedActions.length > 0 ? (
        <div className="form-group">
          <label>Custom Special Actions</label>
          <ul style={{ listStyle: 'none', padding: 0, marginBottom: 0 }}>
            {normalizedActions.map((action, index) => (
              <li key={index} style={{ borderBottom: '1px solid #ccc', padding: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{action.name}</strong>
                  <button 
                    type="button" 
                    onClick={() => removeAction(index)}
                    className="btn btn-danger"
                    style={{ padding: '2px 8px', fontSize: '12px' }}
                  >
                    Remove
                  </button>
                </div>
                {action.description && (
                  <p style={{ marginBottom: '5px', color: '#666' }}>{action.description}</p>
                )}
                {action.details && (
                  <p style={{ fontSize: '14px', fontStyle: 'italic', color: '#888' }}>{action.details}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}


    </div>
  );
}

export default WizardStepSpecial;
