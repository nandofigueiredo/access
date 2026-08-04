-- =============================================================================
-- 003 — Número do chamado GLPI
-- =============================================================================

ALTER TABLE onboarding_requests
    ADD COLUMN IF NOT EXISTS glpi_ticket_number VARCHAR(64);

ALTER TABLE offboarding_requests
    ADD COLUMN IF NOT EXISTS glpi_ticket_number VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_onboarding_glpi_ticket ON onboarding_requests (glpi_ticket_number);
CREATE INDEX IF NOT EXISTS idx_offboarding_glpi_ticket ON offboarding_requests (glpi_ticket_number);
