-- =============================================================================
-- Portal TI — Onboarding & Offboarding
-- PostgreSQL DDL (LGPD-aware)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'ti', 'rh', 'gestor', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM ('Pendente TI', 'Em Andamento', 'Concluído');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(320) NOT NULL UNIQUE,
    role            user_role NOT NULL DEFAULT 'viewer',
    entra_oid       VARCHAR(64),
    job_title       VARCHAR(255),
    department      VARCHAR(128),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_entra_oid ON users (entra_oid);

-- -----------------------------------------------------------------------------
-- onboarding_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_requests (
    id                  VARCHAR(32) PRIMARY KEY, -- ex: ONB-2026-101
    status              ticket_status NOT NULL DEFAULT 'Pendente TI',
    employee_name       VARCHAR(255) NOT NULL,
    cpf                 VARCHAR(14) NOT NULL,          -- sanitizado: 000.000.000-00
    personal_email      VARCHAR(320) NOT NULL,
    position            VARCHAR(255) NOT NULL,
    department          VARCHAR(128) NOT NULL,
    manager             VARCHAR(255) NOT NULL,
    start_date          DATE NOT NULL,
    work_mode           VARCHAR(32) NOT NULL,          -- Presencial | Híbrido | Remoto
    address             TEXT,
    hardware_profile    VARCHAR(64) NOT NULL,
    peripherals         JSONB NOT NULL DEFAULT '{}'::jsonb,
    systems_access      JSONB NOT NULL DEFAULT '{}'::jsonb,
    requires_badge      BOOLEAN NOT NULL DEFAULT FALSE,
    unit_location       VARCHAR(255),
    lgpd_accepted       BOOLEAN NOT NULL DEFAULT FALSE,
    it_checklist        JSONB NOT NULL DEFAULT '{}'::jsonb,
    it_notes            TEXT,
    created_by          UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_requests (status);
CREATE INDEX IF NOT EXISTS idx_onboarding_department ON onboarding_requests (department);
CREATE INDEX IF NOT EXISTS idx_onboarding_created_at ON onboarding_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_cpf ON onboarding_requests (cpf);

-- -----------------------------------------------------------------------------
-- offboarding_requests
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offboarding_requests (
    id                      VARCHAR(32) PRIMARY KEY, -- ex: OFF-2026-202
    status                  ticket_status NOT NULL DEFAULT 'Pendente TI',
    employee_name           VARCHAR(255) NOT NULL,
    corp_email              VARCHAR(320) NOT NULL,
    manager                 VARCHAR(255) NOT NULL,
    termination_datetime    TIMESTAMPTZ NOT NULL,
    email_forward_to        VARCHAR(320),
    cloud_transfer_to       VARCHAR(320),
    auto_reply              BOOLEAN NOT NULL DEFAULT FALSE,
    redirect_email          BOOLEAN NOT NULL DEFAULT FALSE,
    transfer_files          BOOLEAN NOT NULL DEFAULT FALSE,
    guided_no_personal_files BOOLEAN NOT NULL DEFAULT FALSE,
    hardware_assets         JSONB NOT NULL DEFAULT '{}'::jsonb,
    return_method           VARCHAR(32) NOT NULL, -- Presencial | Correios
    return_deadline         DATE,
    it_checklist            JSONB NOT NULL DEFAULT '{}'::jsonb,
    it_notes                TEXT,
    created_by              UUID NOT NULL REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offboarding_status ON offboarding_requests (status);
CREATE INDEX IF NOT EXISTS idx_offboarding_corp_email ON offboarding_requests (LOWER(corp_email));
CREATE INDEX IF NOT EXISTS idx_offboarding_created_at ON offboarding_requests (created_at DESC);

-- -----------------------------------------------------------------------------
-- audit_logs (imutável — sem UPDATE/DELETE em produção via app)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action                  VARCHAR(64) NOT NULL,
    performed_by_user_id    UUID REFERENCES users(id),
    target_request_id       VARCHAR(32),
    timestamp               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details                 JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs (target_request_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs (performed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action);

-- -----------------------------------------------------------------------------
-- Trigger: updated_at automático
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_onboarding_updated_at ON onboarding_requests;
CREATE TRIGGER trg_onboarding_updated_at
    BEFORE UPDATE ON onboarding_requests
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trg_offboarding_updated_at ON offboarding_requests;
CREATE TRIGGER trg_offboarding_updated_at
    BEFORE UPDATE ON offboarding_requests
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Soft-block DELETE em audit_logs (defesa em profundidade)
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs é imutável (LGPD / trilha de auditoria)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_logs;
CREATE TRIGGER trg_audit_no_update
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE PROCEDURE prevent_audit_mutation();
