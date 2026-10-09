-- Distingue sensor simulado (docs/scripts/simulador.py) de sensor real (ESP32).
-- O app exibe o selo "SIMULADO" e a análise da Sprint 6 filtra por esta coluna
-- (CLAUDE.md, seção 6: deixar claro qual dado é real e qual é simulado).
ALTER TABLE sensor ADD COLUMN simulado BOOLEAN NOT NULL DEFAULT FALSE;
