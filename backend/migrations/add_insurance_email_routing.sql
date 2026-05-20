-- Migration: Insurance Email Routing
-- Adds service_cities (dynamic city list) and insurance_email_recipients
-- Run once: psql -d <db> -f add_insurance_email_routing.sql

-- ── 1. Service Cities ─────────────────────────────────────────────────────────
-- Admin-managed list of service area cities. The city list is org-scoped so
-- each org controls which cities appear in the insurance email routing UI.

CREATE TABLE IF NOT EXISTS service_cities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_service_cities_org ON service_cities(org_id, is_active);


-- ── 2. Insurance Email Recipients ─────────────────────────────────────────────
-- Each row is one email address that is approved to receive insurance
-- notifications. subscribed_city_ids is a JSONB array of service_cities.id
-- (as text UUIDs) — the recipient only gets emails for their selected cities.
-- An empty array means "subscribed to ALL cities".

CREATE TABLE IF NOT EXISTS insurance_email_recipients (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email                VARCHAR(255) NOT NULL,
    label                VARCHAR(255),             -- friendly display name / company
    is_active            BOOLEAN NOT NULL DEFAULT true,
    subscribed_city_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [] = all cities
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ins_email_org ON insurance_email_recipients(org_id, is_active);
