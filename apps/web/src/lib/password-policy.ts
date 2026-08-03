import { z } from "zod";

const REQUIREMENTS = [
  {
    label: "Mínimo de 8 caracteres",
    test: (password: string) => password.length >= 8,
    message: "A senha deve ter pelo menos 8 caracteres",
  },
  {
    label: "Pelo menos 1 letra maiúscula",
    test: (password: string) => /[A-Z]/.test(password),
    message: "Inclua pelo menos uma letra maiúscula",
  },
  {
    label: "Pelo menos 1 número",
    test: (password: string) => /[0-9]/.test(password),
    message: "Inclua pelo menos um número",
  },
  {
    label: "Pelo menos 1 caractere especial",
    test: (password: string) => /[^A-Za-z0-9]/.test(password),
    message: "Inclua pelo menos um caractere especial",
  },
] as const;

export function passwordPolicy(password: string) {
  return REQUIREMENTS.map(({ label, test }) => ({ label, met: test(password) }));
}

export const passwordSchema = z.string().superRefine((password, context) => {
  for (const requirement of REQUIREMENTS) {
    if (!requirement.test(password)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: requirement.message });
    }
  }
});
