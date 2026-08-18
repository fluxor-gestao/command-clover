-- Zeramento incondicional e absoluto de todas as tabelas de investimento
-- Executado em ordem inversa de dependência para evitar erros de FK

BEGIN;

-- 1. Tabelas de dependência (folhas)
DELETE FROM public.investment_receipt_allocations WHERE id IS NOT NULL;
DELETE FROM public.investment_receipts WHERE id IS NOT NULL;
DELETE FROM public.investment_installments WHERE id IS NOT NULL;
DELETE FROM public.investment_contributions WHERE id IS NOT NULL;
DELETE FROM public.investment_import_issues WHERE id IS NOT NULL;
DELETE FROM public.investment_audit_log WHERE id IS NOT NULL;
DELETE FROM public.sync_runs WHERE id IS NOT NULL;
DELETE FROM public.rental_receipts WHERE id IS NOT NULL;

-- 2. Tabelas intermediárias
DELETE FROM public.portfolio_memberships WHERE id IS NOT NULL;
DELETE FROM public.rental_properties WHERE id IS NOT NULL;
DELETE FROM public.investment_imports WHERE id IS NOT NULL;

-- 3. Tabelas base
DELETE FROM public.investment_operations WHERE id IS NOT NULL;
DELETE FROM public.investment_references WHERE id IS NOT NULL;

COMMIT;
