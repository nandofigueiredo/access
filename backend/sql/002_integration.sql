-- =============================================================================
-- 002 — Integração portal: status extras, workflow, app_settings
-- =============================================================================

-- Novos status usados pelo frontend (workflow N3 / fechamento)
-- Requer autocommit (fora de bloco DO) em Postgres < 12
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'Aguardando N3';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'Pronta p/ Fechamento';

ALTER TABLE onboarding_requests
    ADD COLUMN IF NOT EXISTS workflow JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS requester_email VARCHAR(320),
    ADD COLUMN IF NOT EXISTS assigned_queue VARCHAR(128);

ALTER TABLE offboarding_requests
    ADD COLUMN IF NOT EXISTS workflow JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS requester_email VARCHAR(320),
    ADD COLUMN IF NOT EXISTS assigned_queue VARCHAR(128);

CREATE TABLE IF NOT EXISTS app_settings (
    key         VARCHAR(64) PRIMARY KEY,
    value       JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_assigned_queue ON onboarding_requests (assigned_queue);
CREATE INDEX IF NOT EXISTS idx_offboarding_assigned_queue ON offboarding_requests (assigned_queue);
