-- Amplia modalidade de devolução para valores do catálogo (além de Presencial|Correios).
ALTER TABLE offboarding_requests
  ALTER COLUMN return_method TYPE VARCHAR(64);
