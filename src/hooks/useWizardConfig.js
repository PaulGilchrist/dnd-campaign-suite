import { useState, useEffect } from 'react';

function useWizardConfig(config) {
  const { formData, validateFn, slots, getDeps, preSelect, setFormData } = config;

  const [warnings, setWarnings] = useState([]);

  const initialSlotState = {};
  slots.forEach((slot) => {
    initialSlotState[slot.state.key] = slot.state.initial;
  });
  const [slotState, setSlotState] = useState(initialSlotState);

  const initialPreSelectedState = {};
  slots.forEach((slot) => {
    if (slot.preSelectedKey) {
      initialPreSelectedState[slot.preSelectedKey] = [];
    }
  });
  if (preSelect?.stateKey) {
    initialPreSelectedState[preSelect.stateKey] = preSelect.stateInitial ?? [];
  }
  const [preSelectedState, setPreSelectedState] = useState(initialPreSelectedState);

   // Validation + slot fetching effect
  useEffect(() => {
    let cancelled = false;

     (async () => {
      try {
        const slotResults = {};
        const preSelectedResults = {};

        await Promise.all(
          slots.map(async (slot) => {
            const result = await slot.get(formData);
            slotResults[slot.state.key] = result;
            if (slot.preSelectedKey && result.preSelected) {
              preSelectedResults[slot.preSelectedKey] = result.preSelected;
             }
           })
         );

        const validationWarnings = await validateFn(formData);

        if (!cancelled) {
          setSlotState(slotResults);
          setPreSelectedState(prev => ({ ...prev, ...preSelectedResults }));
          setWarnings(validationWarnings || []);
         }
       } catch (error) {
        if (!cancelled) {
          console.error('Wizard config validation error:', error);
         }
       }
     })();

    return () => {
      cancelled = true;
     };
   }, getDeps(formData)); // eslint-disable-line react-hooks/exhaustive-deps

    // Pre-select auto-merge effect
  useEffect(() => {
    if (!preSelect || !preSelect.getFn || !setFormData) return;

    let cancelled = false;

      (async () => {
      try {
        const items = await preSelect.getFn(formData);
        if (!cancelled) {
          if (preSelect.stateKey) {
            setPreSelectedState(prev => ({ ...prev, [preSelect.stateKey]: items }));
          }
          const hasItemsFn = preSelect.hasItems ?? ((x) => Array.isArray(x) ? x.length > 0 : false);
          if (preSelect.merge && hasItemsFn(items)) {
            setFormData((prev) => preSelect.merge(prev, items));
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Pre-select error:', error);
          }
        }
      })();

    return () => {
      cancelled = true;
      };
    }, preSelect ? preSelect.deps(formData) : []); // eslint-disable-line react-hooks/exhaustive-deps

   // Build return object from slot state
  const result = {};
  slots.forEach((slot) => {
    result[slot.state.key] = slotState[slot.state.key] ?? slot.state.initial;
   });

  Object.entries(preSelectedState).forEach(([key, value]) => {
    result[key] = value;
   });

  return {
     ...result,
    warnings,
    setWarnings,
   };
}

export default useWizardConfig;
