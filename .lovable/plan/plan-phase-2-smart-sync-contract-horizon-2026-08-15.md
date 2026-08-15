# Plan: Phase 2 - Smart Sync & Contract Horizon

## Implementation Details

### 1. Smart Sync Engine
Upgrade the importer to handle incremental updates and official management portfolio alignment.

- **`src/lib/import/parse-workbook.ts`**:
  - Add `parseManagementSheet` to process "Base2026" style tabs from the official spreadsheet.
  - Implement `calculateSourceHash` for rows to detect changes between Excel and Database.
  - Enhance `ParseResult` to include `comparison` metadata (new vs. changed).

- **`src/lib/import/import-workbook.ts`**:
  - Update `importParseResult` to use `UPSERT` with `source_hash` check.
  - Add logic to automatically link operations found in management tabs to `portfolio_memberships`.
  - Implement a `syncSyncRun` helper to record sync history in the `sync_runs` table.

- **`src/routes/_authenticated/importacao.tsx`**:
  - Add a new "Sync Mode" toggle: Historical Load vs. Management Sync.
  - Implement a diffing UI that highlights changed values (e.g., increased capital, new notes).

### 2. Contractual Horizon (2030 Projections)
Extend reporting to project cash flow beyond imported Excel data.

- **`src/routes/_authenticated/relatorios.tsx`**:
  - Update "Fluxo de Caixa" to use a new hook `useProjectedFlow` that blends real data with calculated projections up to 2030.
  - Use the `simulateContract` engine from `src/lib/finance/contract.ts` to generate missing future installments for active operations.

### 3. Financial UX & Dashboard
Polish the executive experience.

- **`src/components/YearScopeSelect.tsx`**: Add an explicit "Management Mode" toggle to switch between the 27-operation verified view and the full historical audit.
- **Dashboard KPIs**: Ensure "Capital a Recuperar" and "Resultado Projetado" drill down to pre-filtered operation lists.

## Technical Details
- **Sync Integrity**: Use `source_hash` to avoid unnecessary updates and logging.
- **Projections**: Projections will be marked as "Calculated" in the UI to distinguish them from imported "Excel" data.
- **Database**: Leverages the `is_own_property` and `sync_runs` infrastructure already deployed in the previous turn.
