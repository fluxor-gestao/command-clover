import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso · Nova Era Gestão de Investimentos" },
      {
        name: "description",
        content:
          "Entre no sistema Nova Era para acompanhar operações, recebimentos, inadimplência e retorno da carteira de investimentos.",
      },
      { property: "og:title", content: "Acesso · Nova Era Gestão de Investimentos" },
      {
        property: "og:description",
        content: "Área restrita do sistema de gestão de investimentos Nova Era.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Este e-mail já possui conta. Use a aba Entrar.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
  if (m.includes("password")) return "Senha inválida: use ao menos 6 caracteres.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Falha de conexão com o servidor. Verifique sua internet.";
  return message;
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      const text = translateAuthError(error.message);
      setFeedback({ kind: "error", text });
      toast.error(text);
      return;
    }
    if (!data.session) {
      const text = "Não foi possível abrir a sessão. Tente novamente.";
      setFeedback({ kind: "error", text });
      toast.error(text);
      return;
    }
    navigate({ to: "/dashboard" });
  };

  const signUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) {
      const text = translateAuthError(error.message);
      setFeedback({ kind: "error", text });
      toast.error(text);
      return;
    }
    if (data.session) {
      navigate({ to: "/dashboard" });
      return;
    }
    const text = "Conta criada. Confirme seu e-mail para acessar o sistema.";
    setFeedback({ kind: "success", text });
    toast.success(text);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md border-none shadow-2xl bg-card/80 backdrop-blur-xl">
        <CardHeader className="items-center text-center pt-10 pb-6">
          <div className="mb-6 flex h-24 w-24 items-center justify-center transition-transform hover:scale-105 duration-300">
            <img
              src={logoAsset.url}
              alt="Nova Era Imóveis e Seguros"
              className="h-24 w-24 object-contain drop-shadow-xl"
            />
          </div>

          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            NOVA ERA
          </CardTitle>
          <CardDescription className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mt-2">
            GESTÃO DE INVESTIMENTOS
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-10">
          <Tabs defaultValue="entrar" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger value="entrar" className="rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm">Entrar</TabsTrigger>
              <TabsTrigger value="criar" className="rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm">Criar conta</TabsTrigger>
            </TabsList>
            {(["entrar", "criar"] as const).map((tab) => (
              <TabsContent key={tab} value={tab}>
                <form className="space-y-4" onSubmit={tab === "entrar" ? signIn : signUp}>
                  <div className="space-y-2">
                    <Label htmlFor={`email-${tab}`} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">E-mail</Label>
                    <Input
                      id={`email-${tab}`}
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 border-none bg-muted/50 focus:ring-1 rounded-xl px-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`senha-${tab}`} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Senha</Label>
                    <Input
                      id={`senha-${tab}`}
                      type="password"
                      autoComplete={tab === "entrar" ? "current-password" : "new-password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-11 border-none bg-muted/50 focus:ring-1 rounded-xl px-4"
                    />
                  </div>
                  {feedback && (
                    <p
                      role="alert"
                      className={
                        feedback.kind === "error"
                          ? "rounded-xl bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive"
                          : "rounded-xl bg-primary/10 px-4 py-3 text-xs font-medium text-primary"
                      }
                    >
                      {feedback.text}
                    </p>
                  )}
                  <Button type="submit" className="w-full h-11 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/20 transition-all active:scale-[0.98]" disabled={loading}>
                    {loading ? "Processando..." : tab === "entrar" ? "Acessar Sistema" : "Cadastrar Agora"}
                  </Button>
                </form>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
