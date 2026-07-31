export const isDollar = (name: string): boolean => name === "$";

export const isCustomHook = (name: string): boolean => name.startsWith("$use");

export const isComponentFunction = (name: string): boolean => /^[A-Z]/.test(name);

export const isSignal = (name: string): boolean =>
  name.startsWith("$") && !isDollar(name) && !isCustomHook(name);
