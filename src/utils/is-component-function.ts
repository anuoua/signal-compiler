export const isComponentFunction = (name: string) =>
  /[A-Z]/.test(name.at(0) ?? "");
