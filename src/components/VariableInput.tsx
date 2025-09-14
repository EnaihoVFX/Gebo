// Component for rendering dynamic input fields based on type

import React from 'react';

type InputType = 'string' | 'number' | 'boolean';

export interface VariableInputProps {
  type: InputType;
  placeholder?: string;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  className?: string; // Optional Tailwind classes
}

const VariableInput: React.FC<VariableInputProps> = ({
  type,
  placeholder,
  value,
  onChange,
  className = '',
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value: inputValue } = event.target;
    if (type === 'number') {
      onChange(Number(inputValue));
    } else if (type === 'boolean') {
      onChange(event.target.checked);
    } else {
      onChange(inputValue);
    }
  };

  if (type === 'boolean') {
    return (
      <label className={`flex items-center space-x-2 ${className}`}>
        <input
          type="checkbox"
          checked={value as boolean}
          onChange={handleChange}
          className="form-checkbox h-5 w-5 text-cyan-600"
        />
        <span>{placeholder || 'Toggle'}</span>
      </label>
    );
  }

  return (
    <input
      type={type === 'number' ? 'number' : 'text'}
      placeholder={placeholder}
      value={value as string | number}
      onChange={handleChange}
      className={`px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-cyan-500 ${className}`}
    />
  );
};

export default VariableInput;