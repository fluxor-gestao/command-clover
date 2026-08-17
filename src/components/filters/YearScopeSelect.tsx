import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Database } from "lucide-react";
import type { PortfolioScope } from "@/lib/data/hooks";
import { usePortfolioYears } from "@/lib/data/hooks";

export const ALL_SCOPE = "all";

export function scopeFromValue(value: string): PortfolioScope {
  return value === ALL_SCOPE ? { type: "all" } : { type: "management", year: Number(value) };
}

export function YearScopeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const years = usePortfolioYears();
  const isManagement = value !== ALL_SCOPE;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visão</span>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-9 w-full sm:w-[190px] text-xs font-semibold bg-card/50">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SCOPE}>Carteira Completa (Audit Mode)</SelectItem>
            {(years.data ?? []).map((year) => (
              <SelectItem key={year} value={String(year)}>
                Controle Gerencial {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Badge 
        variant="outline" 
        className={isManagement 
          ? "h-9 px-3 border-primary/20 bg-primary/5 text-primary gap-1.5 font-bold text-[10px] uppercase tracking-wider" 
          : "h-9 px-3 border-muted-foreground/20 bg-muted/5 text-muted-foreground gap-1.5 font-bold text-[10px] uppercase tracking-wider"
        }
      >
        {isManagement ? (
          <>
            <ShieldCheck className="size-3" />
            Management Mode
          </>
        ) : (
          <>
            <Database className="size-3" />
            Audit Mode
          </>
        )}
      </Badge>
    </div>
  );
}
