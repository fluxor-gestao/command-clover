import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Building2, Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCategories, useReferences, useCreateReference } from "@/lib/data/hooks";

export const Route = createFileRoute("/_authenticated/referencias")({
  head: () => ({
    meta: [
      { title: "Referências · Nova Era Investimentos" },
      {
        name: "description",
        content: "Gestão de ativos e referências para investimentos.",
      },
    ],
  }),
  component: ReferencesPage,
});

function ReferencesPage() {
  const references = useReferences();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("TODAS");

  const categories = useMemo(() => {
    const names = (references.data ?? [])
      .map((r) => (r as any).investment_categories?.name)
      .filter(Boolean);
    return [...new Set(names)] as string[];
  }, [references.data]);

  const filtered = useMemo(() => {
    return (references.data ?? []).filter((r) => {
      const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === "TODAS" || (r as any).investment_categories?.name === category;
      return matchSearch && matchCategory;
    });
  }, [references.data, search, category]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Referências</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} ativos cadastrados
          </p>
        </div>
        <NewReferenceDialog />
      </header>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar referência..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as categorias</SelectItem>
                {categories.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ref) => (
                <TableRow key={ref.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {ref.name}
                    </div>
                  </TableCell>
                  <TableCell>{(ref as any).investment_categories?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={ref.active ? "default" : "secondary"}>
                      {ref.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm">Editar</Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Excluir</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !references.isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Nenhuma referência encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NewReferenceDialog() {
  const categories = useCategories();
  const create = useCreateReference();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category_id: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync(form);
      toast.success("Referência cadastrada com sucesso.");
      setOpen(false);
      setForm({ name: "", category_id: "", description: "" });
    } catch (error: any) {
      toast.error(error.message || "Erro ao cadastrar referência.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova referência
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Referência</DialogTitle>
          <DialogDescription>
            Cadastre um novo ativo, imóvel ou pessoa para vincular operações.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Referência *</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Jardins do Lago - Qd. 11"
            />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.data?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição / Notas</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              Salvar Referência
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
