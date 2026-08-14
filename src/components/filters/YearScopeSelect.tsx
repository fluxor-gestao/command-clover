import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PortfolioScope } from "@/lib/data/hooks";
import { usePortfolioYears } from "@/lib/data/hooks";

export const ALL_SCOPE = "all";

export function scopeFromValue(value: string): PortfolioScope {
  return value === ALL_SCOPE ? { scope: "all" } : { year: Number(value) };
}

export function YearScopeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const years = usePortfolioYears();

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Período</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[190px] text-xs font-semibold">
          <SelectValue placeholder="Selecione o período" />
        </SelectTrigger>
        <SelectContent>
          {(years.data ?? []).map((year) => (
            <SelectItem key={year} value={String(year)}>
              Ano {year}
            </SelectItem>
          ))}
          <SelectItem value={ALL_SCOPE}>Carteira completa</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
