import { describe, expect, test } from "bun:test";
import { translateAuthError } from "./auth-errors";

describe("auth password errors", () => {
  test("uses the minimum length returned by auth instead of assuming six", () => {
    expect(translateAuthError({ message: "Password should be at least 12 characters." }))
      .toBe("Senha muito curta: use ao menos 12 caracteres.");
  });
  test("does not confuse character requirements with length", () => {
    expect(translateAuthError({ message: "Weak password", code: "weak_password", reasons: ["characters"] }))
      .toContain("requisitos de caracteres");
  });
  test("distinguishes compromised passwords", () => {
    expect(translateAuthError({ message: "Weak password", reasons: ["pwned"] }))
      .toContain("vazamentos de dados");
  });
  test("does not invent a minimum for an unknown password rejection", () => {
    expect(translateAuthError({ message: "Password rejected", code: "weak_password" }))
      .toBe("A senha foi recusada pelos requisitos de segurança. Escolha uma senha mais forte e diferente da anterior.");
  });
});