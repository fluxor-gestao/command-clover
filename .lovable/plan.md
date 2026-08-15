# Plan: Phase 2 - Incremental Sync & Projections

## Implementation Details

### 1. Smart Sync Importer
Update the import engine to handle the official "Controle Gerencial" format and allow incremental updates.

- **`src/lib/import/parse-workbook.ts`**:
  - Add logic to parse the "Controle Gerencial" specific tabs.
  - Detect changes in existing operations (status, capital, notes).
  - Map the "Base2026" (27 operations) to `portfolio_memberships` automatically.

- **`src/lib/import/import-workbook.ts`**:
  - Implement a diffing mechanism: compare incoming spreadsheet rows with DB records via `source_key` or `reference`.
  - Create a preview state for the UI showing: *New*, *Updated*, *Conflict*.

- **`src/routes/_authenticated/importacao.tsx`**:
  - Add a "Sync Review" step before final commit.

### 2. Relatórios & 2030 Projections
Expand the reporting capabilities to show the full contractual horizon requested by the user.

- **`src/routes/_authenticated/relatorios.tsx`**:
  - Update the "Fluxo de Caixa" tab to generate projections for all valid contracts up to 2030, regardless of whether the Excel year tab was imported.
  - Implement a "Year Comparison" view (e.g., 2025 vs 2026).

### 3. Financial UX Polish
Final touch-ups on the executive dashboard and simulation components.

- **`src/components/YearScopeSelect.tsx`**: Add "Carteira Completa" (historical) vs "Carteira Gerencial" (annual) explicit toggle.
- **Dashboard**: Ensure KPI drill-downs lead to filtered views in Operations/Installments correctly.

## Technical Details
- **Sync Logic**: `UPSERT` with `source_key` is already partially there, but need to track if a row was *removed* from the management portfolio in Excel.
- **Projections**: Use the `deriveContractDates` and `simulateContract` logic from `src/lib/finance/contract.ts` to fill gaps in future competencies.
