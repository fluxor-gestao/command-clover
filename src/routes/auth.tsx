import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Salad } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { APP_NAME, APP_TAGLINE } from "@/lib/platform/labels";
import { db } from "@/lib/platform/db";
import { translateAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `Entrar · ${APP_NAME}` },
      {
        name: "description",
        content:
          "Acesse sua conta para montar o kit da semana, acompanhar a assinatura e as entregas.",
      },
      { property: "og:title", content: `Entrar · ${APP_NAME}` },
      { property: "og:description", content: "Acesse sua conta para montar o kit da semana, acompanhar a assinatura e as entregas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(
    null,
  );

  const goHome = () => {
    queryClient.removeQueries({ queryKey: ["session"] });
    navigate({ to: "/inicio" });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goHome();
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
      const text = translateAuthError(error);
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
    goHome();
  };

  const signUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!consent) {
      setFeedback({
        kind: "error",
        text: "Para criar a conta, aceite o uso dos seus dados para a prestação do serviço.",
      });
      return;
    }
    setLoading(true);
    setFeedback(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/inicio`,
        data: { full_name: fullName.trim(), lgpd_consent: true },
      },
    });
    setLoading(false);
    if (error) {
      const text = translateAuthError(error);
      setFeedback({ kind: "error", text });
      toast.error(text);
      return;
    }
    if (data.session) {
      if (data.user) {
        await db.rpc("ensure_my_customer_records");
        await db
          .from("customer_accounts")
          .update({ full_name: fullName.trim() })
          .eq("customer_id", data.user.id);
        await db
          .from("customer_profiles")
          .update({ consent_at: new Date().toISOString() })
          .eq("customer_id", data.user.id);
      }
      goHome();
      return;
    }
    const text = "Conta criada. Confirme seu e-mail para entrar.";
    setFeedback({ kind: "success", text });
    toast.success(text);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-[400px] border-none shadow-2xl bg-card/80 backdrop-blur-xl">
        <CardHeader className="items-center text-center pt-10 pb-6">
          <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Salad className="size-8" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            {APP_NAME}
          </CardTitle>
          <CardDescription className="mt-1 text-sm text-muted-foreground">
            {APP_TAGLINE}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-10">
          <Tabs defaultValue="entrar" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger
                value="entrar"
                className="rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Entrar
              </TabsTrigger>
              <TabsTrigger
                value="criar"
                className="rounded-lg font-bold text-xs uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Criar conta
              </TabsTrigger>
            </TabsList>
            {(["entrar", "criar"] as const).map((tab) => (
              <TabsContent key={tab} value={tab}>
                <form className="space-y-4" onSubmit={tab === "entrar" ? signIn : signUp}>
                  {tab === "criar" && (
                    <div className="space-y-2">
                      <Label
                        htmlFor="nome"
                        className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80"
                      >
                        Nome
                      </Label>
                      <Input
                        id="nome"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-11 border-none bg-muted/50 focus:ring-1 rounded-xl px-4"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label
                      htmlFor={`email-${tab}`}
                      className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80"
                    >
                      E-mail
                    </Label>
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
                    <Label
                      htmlFor={`senha-${tab}`}
                      className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80"
                    >
                      Senha
                    </Label>
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
                  {tab === "criar" && (
                    <label className="flex items-start gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        Autorizo o uso do meu perfil alimentar (peso, altura, objetivos, alergias)
                        apenas para montar meu cardápio e prestar o serviço, conforme a LGPD. Posso
                        pedir acesso, correção ou exclusão a qualquer momento.
                      </span>
                    </label>
                  )}
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
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                    disabled={loading}
                  >
                    {loading ? "Processando..." : tab === "entrar" ? "Entrar" : "Criar conta"}
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
