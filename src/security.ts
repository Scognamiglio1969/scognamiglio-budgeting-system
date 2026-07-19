export interface PasswordValidation {
  valid: boolean;
  rules: Array<{ label: string; passed: boolean }>;
}

export function validatePassword(password: string): PasswordValidation {
  const rules = [
    { label: 'Almeno 12 caratteri', passed: password.length >= 12 },
    { label: 'Una lettera maiuscola', passed: /[A-Z]/.test(password) },
    { label: 'Una lettera minuscola', passed: /[a-z]/.test(password) },
    { label: 'Un numero', passed: /\d/.test(password) },
    { label: 'Un simbolo', passed: /[^A-Za-z0-9]/.test(password) },
  ];
  return { valid: rules.every((rule) => rule.passed), rules };
}
