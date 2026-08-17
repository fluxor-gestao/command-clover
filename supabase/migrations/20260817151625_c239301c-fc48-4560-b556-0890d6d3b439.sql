-- 1. Remover parcelas com vencimento anterior a 2026
DELETE FROM public.investment_installments 
WHERE due_date < '2026-01-01';

-- 2. Remover recibos órfãos (que não alocam nada em parcelas de 2026+)
DELETE FROM public.investment_receipts
WHERE id NOT IN (SELECT receipt_id FROM public.investment_receipt_allocations)
AND source = 'SISTEMA';