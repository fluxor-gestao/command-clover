type AuthErrorDetails = {
  message: string;
  code?: string | undefined;
  reasons?: string[] | undefined;
};

export function translateAuthError(error: AuthErrorDetails): string {
  const m = error.message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Este e-mail já possui conta. Use a aba Entrar.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
  if (error.reasons?.includes("pwned") || m.includes("compromised") || m.includes("breach"))
    return "Esta senha foi encontrada em vazamentos de dados. Escolha outra senha, única e mais segura.";
  if (error.reasons?.includes("characters") || m.includes("password should contain"))
    return "A senha não atende aos requisitos de caracteres. Inclua letras maiúsculas, minúsculas, números e símbolos.";
  const minimum = m.match(/password.*?at least (\d+) characters/);
  if (minimum)
    return `Senha muito curta: use ao menos ${minimum[1]} caracteres.`;
  if (m.includes("same password") || m.includes("different from the old password"))
    return "A nova senha deve ser diferente da senha atual.";
  if (error.code === "weak_password" || m.includes("password"))
    return "A senha foi recusada pelos requisitos de segurança. Escolha uma senha mais forte e diferente da anterior.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Falha de conexão com o servidor. Verifique sua internet.";
  return error.message;
}