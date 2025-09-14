// Component for opening a modal dialog that contains a form 
// Form can be generated from fields prop like
// { title: { type: 'string', placeholder: 'Project Title' } }
// values are returned onSubmit like { title: 'My Project' }


import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import VariableInput, { type VariableInputProps } from './VariableInput';

interface FormField {
  type: VariableInputProps['type'];
  placeholder?: string;
  className?: string;
  initialValue?: string | number | boolean;
}

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: { [id: string]: string | number | boolean }) => void;
  fields: { [id: string]: FormField };
  title?: string;
}

const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  fields,
  title = 'Form',
}) => {
  // Initialize state with initial values from fields
  const [values, setValues] = useState<{ [id: string]: string | number | boolean }>({});

  useEffect(() => {
    if (isOpen) {
      const initialValues: { [id: string]: string | number | boolean } = {};
      Object.keys(fields).forEach((id) => {
        initialValues[id] = fields[id].initialValue ?? (fields[id].type === 'boolean' ? false : '');
      });
      setValues(initialValues);
    }
  }, [isOpen, fields]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(values);
    onClose(); // Optionally close after submit
  };

  const handleFieldChange = (id: string) => (value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <h2 className="text-xl font-semibold mb-4 text-zinc-100">{title}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {Object.entries(fields).map(([id, field]) => (
          <div key={id}>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </label>
            <VariableInput
              type={field.type}
              placeholder={field.placeholder}
              value={values[id] ?? (field.type === 'boolean' ? false : '')}
              onChange={handleFieldChange(id)}
              className={field.className}
            />
          </div>
        ))}
        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded hover:bg-zinc-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700"
          >
            Submit
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default FormModal;
