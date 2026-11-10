"use client";

import { useId, useState, type ChangeEvent } from 'react';

export type SearchableCatalogOption = {
  value: string;
  label: string;
  description?: string;
};

type SearchableCatalogSelectProps = {
  label: string;
  value: string;
  options: SearchableCatalogOption[];
  placeholder: string;
  emptyLabel: string;
  emptyMessage: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function SearchableCatalogSelect({
  label,
  value,
  options,
  placeholder,
  emptyLabel,
  emptyMessage,
  disabled = false,
  onChange,
}: SearchableCatalogSelectProps) {
  const selectId = useId();
  const [query, setQuery] = useState('');
  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
  );
  const visibleOptions = selectedOption && !filteredOptions.includes(selectedOption)
    ? [selectedOption, ...filteredOptions]
    : filteredOptions;

  return (
    <div className="form-field searchable-select">
      <label htmlFor={selectId}>{label}</label>
      <input
        type="search"
        aria-label={`Filtrar ${label.toLocaleLowerCase('pt-BR')}`}
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
      />
      <select
        id={selectId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {visibleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.description ? `${option.label} — ${option.description}` : option.label}
          </option>
        ))}
      </select>
      {filteredOptions.length === 0 && query && (
        <small className="searchable-select-empty">{emptyMessage}</small>
      )}
    </div>
  );
}