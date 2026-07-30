
"use client"
import { useState, useEffect, useCallback } from 'react';

// NOTE: This implementation is now a simple useState-based hook.
// The actual data persistence is handled by the Firestore-backed AppProvider.
// This hook is kept for components that might still use its interface,
// but it will only hold state for the duration of the component's lifecycle.
// It does NOT persist data to localStorage or any other storage.

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  // This function is now a simple state setter. It does not interact with localStorage.
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    // Allow value to be a function so we have same API as useState
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);
  }, [storedValue]);

  return [storedValue, setValue];
}


// These functions are no longer relevant in a Firestore-backed setup but are kept to avoid breaking imports.
// They will not perform any operations.
export const getAllDataForExport = async (): Promise<Record<string, any>> => {
    console.warn("getAllDataForExport is not implemented for Firestore backend.");
    return {};
};

export const importData = async (data: Record<string, any>) => {
    console.warn("importData is not implemented for Firestore backend.");
};


export default useLocalStorage;
