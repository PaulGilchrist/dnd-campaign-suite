
import React from 'react'
import './HiddenInput.css'

function HiddenInput({ handleInputToggle, handleValueChange, showInput, value, displayValue = true }) {
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

    const commit = () => {
        handleValueChange(localValue);
        handleInputToggle();
     };
    const handleChange = (event) => {
        setLocalValue(event.target.value);
     };
    const handleKeyDown = (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
            commit();
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
