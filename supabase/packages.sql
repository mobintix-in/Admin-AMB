-- ==============================================================================
-- AMB MedERP Subscription Packages Schema (PostgreSQL / Supabase)
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/oaiujdbjbnfflmnjymug/sql)
-- ==============================================================================

-- 1. Create Subscription Packages Table
CREATE TABLE IF NOT EXISTS public.packages (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    monthly_price NUMERIC(12, 2) NOT NULL DEFAULT 999.00,
    yearly_price NUMERIC(12, 2) NOT NULL DEFAULT 9999.00,
    interval VARCHAR(20) DEFAULT 'Yearly',
    terminals VARCHAR(100) DEFAULT '1 Counter Terminal',
    status VARCHAR(20) DEFAULT 'Active',
    is_popular BOOLEAN DEFAULT FALSE,
    features TEXT[] DEFAULT '{}',
    subscribers_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active packages
DROP POLICY IF EXISTS "Allow public read access to active packages" ON public.packages;
CREATE POLICY "Allow public read access to active packages"
ON public.packages FOR SELECT
USING (true);

-- Allow service role full access
DROP POLICY IF EXISTS "Allow service role full management" ON public.packages;
CREATE POLICY "Allow service role full management"
ON public.packages FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Seed Default Packages into Supabase
INSERT INTO public.packages (id, name, code, description, monthly_price, yearly_price, interval, terminals, status, is_popular, features, subscribers_count)
VALUES 
(
    'pkg-starter',
    'Starter Retail',
    'STARTER',
    'Essential billing and inventory for single-counter retail medical chemists.',
    999.00,
    9999.00,
    'Monthly',
    '1 Counter Terminal',
    'Active',
    FALSE,
    ARRAY['High-Speed POS Billing', 'FEFO Expiry Radar Engine', 'Dynamic UPI QR Payment Codes', 'Standard Email & In-App Support'],
    1
),
(
    'pkg-pro',
    'Professional Chemist',
    'PROFESSIONAL',
    'For busy retail chemists with multiple billing counters, AI purchase OCR & GST filing.',
    1999.00,
    19999.00,
    'Yearly',
    '3 Counter Terminals',
    'Active',
    TRUE,
    ARRAY['Everything in Starter', 'AI Purchase Bill Ingestion (OCR)', 'Active Salt Molecule Substitute Finder', 'Automated GSTR-1 Tax Summaries', 'Customer Wholesale Ledgers'],
    2
),
(
    'pkg-ent',
    'Enterprise Cloud',
    'ENTERPRISE',
    'For chain pharmacies, hospital dispensaries, and wholesale pharmaceutical stockists.',
    3999.00,
    39999.00,
    'Yearly',
    'Unlimited Terminals',
    'Active',
    FALSE,
    ARRAY['Everything in Professional', 'Centralized Multi-Branch Stock', 'Realtime Supabase PostgreSQL CDC Sync', 'Dedicated SLA & 24/7 Account Manager', 'Custom E-Invoicing & E-Way Bills'],
    1
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    monthly_price = EXCLUDED.monthly_price,
    yearly_price = EXCLUDED.yearly_price,
    description = EXCLUDED.description,
    features = EXCLUDED.features,
    terminals = EXCLUDED.terminals;
