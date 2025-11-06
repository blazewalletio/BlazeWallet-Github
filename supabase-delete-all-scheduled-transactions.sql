-- VERWIJDER ALLE SCHEDULED TRANSACTIONS
-- WARNING: Dit verwijdert ALLES! Kan niet ongedaan gemaakt worden!

-- Eerst checken hoeveel er zijn
SELECT COUNT(*) AS total_transactions
FROM scheduled_transactions;

-- Verwijder alle scheduled transactions
DELETE FROM scheduled_transactions;

-- Verifieer dat alles verwijderd is
SELECT COUNT(*) AS remaining_transactions
FROM scheduled_transactions;

