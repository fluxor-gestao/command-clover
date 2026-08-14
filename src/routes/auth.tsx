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

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/dashboard" });
  };

  const signUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta criada. Verifique seu e-mail se a confirmação estiver ativa.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <img
            src={logoAsset.url}
            alt="Nova Era Imóveis e Seguros"
            className="mx-auto h-24 w-24 object-contain"
          />
          <CardTitle className="text-xl">Nova Era · Gestão de Investimentos</CardTitle>
          <CardDescription>
            Acesso restrito à diretoria e ao time financeiro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="entrar">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="criar">Criar conta</TabsTrigger>
            </TabsList>
            {(["entrar", "criar"] as const).map((tab) => (
              <TabsContent key={tab} value={tab}>
                <form className="space-y-4" onSubmit={tab === "entrar" ? signIn : signUp}>
                  <div className="space-y-2">
                    <Label htmlFor={`email-${tab}`}>E-mail</Label>
                    <Input
                      id={`email-${tab}`}
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`senha-${tab}`}>Senha</Label>
                    <Input
                      id={`senha-${tab}`}
                      type="password"
                      autoComplete={tab === "entrar" ? "current-password" : "new-password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {tab === "entrar" ? "Entrar" : "Criar conta"}
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
