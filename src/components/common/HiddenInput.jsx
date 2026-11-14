
import React from 'react'
import './HiddenInput.css'

function HiddenInput({ handleInputToggle, handleValueChange, showInput, value, displayValue = true, max }) {
    const inputRef = React.useRef(null);
    const [localValue, setLocalValue] = React.useState(value ?? '');
    const isEditingRef = React.useRef(false);
    React.useEffect(() => {
        if(showInput) {
            isEditingRef.current = true;
            inputRef.current.focus();
            } else {
            isEditingRef.current = false;
           }
       }, [showInput]);
    React.useEffect(() => {
        if (!isEditingRef.current) setLocalValue(value);
      }, [value]);

    // Abandoning an edit (Escape, or committing a blank field) writes nothing:
    // an empty draft is not a value the user typed — committing Number('') === 0
    // would silently zero HP or a class resource. Explicitly typed 0 still commits.
    const cancel = () => {
        setLocalValue(value ?? '');
        handleInputToggle();
     };
    const commit = () => {
        if (String(localValue).trim() === '') {
            cancel();
            return;
          }
        const numVal = Number(localValue);
        const clamped = max != null ? Math.min(Math.max(numVal, 0), max) : Math.max(numVal, 0);
        handleValueChange(clamped);
        handleInputToggle();
     };
    const handleChange = (event) => {
        setLocalValue(event.target.value);
     };
    const handleKeyDown = (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
            commit();
          } else if (event.key === "Escape") {
            cancel();
          }
      };
    const handleStopPropagation = (event) => {
        event.stopPropagation();
     };

    return (
           <span className='hidden-input clickable'>
              {
                showInput ? (
                      <input
                         max={max}
                         min="0"
                         onBlur={commit}
                         onChange={handleChange}
                         onClick={handleStopPropagation}
                         onKeyDown={handleKeyDown}
                         ref={inputRef}
                         type="number"
                         value={localValue}
                       />
                  ) : (
                                    displayValue ? value : null
                                   )
              }
          </span>
      )
  }

export default HiddenInput
