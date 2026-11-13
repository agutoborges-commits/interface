"use client";

import { useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';

type BarcodeScannerInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onScan?: (code: string) => void;
};

const MAX_SCAN_GAP_MS = 250;
const MIN_BARCODE_LENGTH = 8;
const MAX_BARCODE_LENGTH = 30;

function normalizeBarcodeInput(rawValue: string) {
  return rawValue
    .replace(/[\r\n\t\s]+/g, '')
    .replace(/[^0-9A-Za-z]/g, '')
    .trim();
}

export default function BarcodeScannerInput({
  value,
  defaultValue,
  onChange,
  onScan,
  onKeyDown,
  ...inputProps
}: BarcodeScannerInputProps) {
  const bufferRef = useRef('');
  const scanTimestampRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  function emitValue(nextValue: string) {
    const normalized = normalizeBarcodeInput(nextValue);

    if (onChange) {
      onChange(normalized);
    }

    if (!isControlled) {
      setInternalValue(normalized);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === 'Tab') {
      const code = normalizeBarcodeInput(bufferRef.current);
      bufferRef.current = '';
      scanTimestampRef.current = null;

      if (!code || code.length < MIN_BARCODE_LENGTH) {
        onKeyDown?.(event);
        return;
      }

      const now = Date.now();
      const lastScan = lastScanRef.current;
      if (lastScan && lastScan.code === code && now - lastScan.time < 500) {
        event.preventDefault();
        return;
      }

      lastScanRef.current = { code, time: now };
      emitValue(code);
      onScan?.(code);
      event.preventDefault();
      return;
    }

    if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) {
      onKeyDown?.(event);
      return;
    }

    const now = Date.now();
    if (!scanTimestampRef.current || now - scanTimestampRef.current > MAX_SCAN_GAP_MS) {
      bufferRef.current = '';
    }

    if (bufferRef.current.length >= MAX_BARCODE_LENGTH) {
      bufferRef.current = '';
    }

    scanTimestampRef.current = now;
    bufferRef.current += event.key;
    onKeyDown?.(event);
  }

  return (
    <input
      {...inputProps}
      value={currentValue}
      onChange={(event) => {
        const nextValue = event.target.value;
        if (!isControlled) {
          setInternalValue(nextValue);
        }
        onChange?.(nextValue);
      }}
      onKeyDown={handleKeyDown}
    />
  );
}
