import { useState, useEffect } from "react";

/**
 * Debounces a value by `delay` ms. The returned value only updates after the
 * source value has been stable for the specified delay. Useful for search
 * inputs that trigger expensive filter/sort operations on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 150): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
