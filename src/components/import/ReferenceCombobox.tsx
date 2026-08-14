import * as React from "react";
import { Check, ChevronsUpDown, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useReferences, useCreateReference } from "@/lib/data/hooks";

interface ReferenceComboboxProps {
  value: string;
  onChange: (value: string) => void;
  categoryId?: string | null;
}

export function ReferenceCombobox({ value, onChange, categoryId }: ReferenceComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const references = useReferences({ activeOnly: true });
  const create = useCreateReference();

  const selectedReference = React.useMemo(() => 
    references.data?.find((ref) => ref.id === value),
    [references.data, value]
  );

  const handleCreate = async () => {
    if (!search.trim()) return;
    try {
      const newRef = await create.mutateAsync({ 
        name: search.trim(),
        category_id: categoryId ?? null
      });
      onChange(newRef.id);
      setOpen(false);
      setSearch("");
      toast.success(`Referência "${newRef.name}" criada.`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar referência.");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 opacity-50" />
            {selectedReference ? selectedReference.name : "Selecionar referência..."}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Buscar ou criar referência..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nenhuma referência encontrada.</CommandEmpty>
            <CommandGroup>
              {references.data
                ?.filter(ref => ref.name.toLowerCase().includes(search.toLowerCase()))
                .map((ref) => (
                <CommandItem
                  key={ref.id}
                  value={ref.id}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === ref.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {ref.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {search.trim() && !references.data?.some(r => r.name.toLowerCase() === search.toLowerCase()) && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleCreate} className="text-primary font-medium">
                    <Plus className="mr-2 h-4 w-4" />
                    Criar "{search}"
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
