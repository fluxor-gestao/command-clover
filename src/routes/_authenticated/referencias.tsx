import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Building2, Filter, X, MoreHorizontal, Edit, Trash2 } from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCategories, useReferences, useCreateReference } from "@/lib/data/hooks";
import { cn, normalizeString } from "@/lib/utils";

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
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Base de Referências</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filtered.length} ativos cadastrados no mestre
            </p>
          </div>
        </div>
        <NewReferenceDialog />
      </header>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border bg-card/50 p-3 backdrop-blur-sm">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar referência..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 text-xs border-none bg-muted/50 focus-visible:ring-1"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-full md:w-44 text-xs border-none bg-muted/50">
                <Filter className="mr-2 size-3 text-muted-foreground" />
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

            {(search || category !== "TODAS") && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setSearch(""); setCategory("TODAS"); }}
                className="h-8 px-2 text-[10px] uppercase font-bold tracking-wider"
              >
                <X className="mr-1 size-3" /> Limpar filtros
              </Button>
            )}
          </div>
        </div>

        <Card className="border-none shadow-sm overflow-hidden bg-card/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider">Referência</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider">Categoria</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-right">Ops.</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider">Status</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider pr-4">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ref) => (
                  <TableRow key={ref.id} className="group transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <span className="text-sm">{ref.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{(ref as any).investment_categories?.name ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{ref.operations_count || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "h-5 text-[10px] font-bold uppercase tracking-wider px-2",
                          ref.active ? "border-success/30 text-success bg-success/5" : "border-muted-foreground/30 text-muted-foreground bg-muted/5"
                        )}
                      >
                        {ref.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Opções</DropdownMenuLabel>
                          <DropdownMenuItem className="text-xs cursor-pointer">
                            <Edit className="mr-2 h-3.5 w-3.5" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-xs cursor-pointer text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && !references.isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="size-8 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground font-medium">Nenhuma referência encontrada.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
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
    
    const normalizedName = normalizeString(form.name);
    const exists = (references.data ?? []).some(
      (r) => normalizeString(r.name) === normalizedName
    );

    if (exists) {
      toast.error("Já existe uma referência com este nome (mesmo que com acentos ou maiúsculas diferentes).");
      return;
    }

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
