-- ==============================================================================
-- AMB MedERP • Enterprise Pharmacy & Inventory Management
-- Complete PostgreSQL / Supabase Production DDL Schema
-- Features: Multi-Tenancy, FEFO Batch Tracking, Automatic Stock Triggers, Realtime Sync
-- ==============================================================================

-- 0. Enable UUID generation (native in PostgreSQL 13+, with uuid-ossp fallback)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tenant / Pharmacy Store Information
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    branch_name VARCHAR(100) DEFAULT 'Main Branch',
    gstin VARCHAR(15),
    pan VARCHAR(10),
    drug_license_no VARCHAR(100) NOT NULL,
    fssai_no VARCHAR(50),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT NOT NULL,
    state VARCHAR(100) DEFAULT 'Maharashtra',
    state_code VARCHAR(2) DEFAULT '27',
    currency VARCHAR(3) DEFAULT 'INR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Parties / Accounts Master (Retail Customers, Hospitals, Doctors, Wholesale Stockists)
CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    party_type VARCHAR(20) NOT NULL CHECK (party_type IN ('CUSTOMER', 'SUPPLIER', 'DOCTOR')),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    gstin VARCHAR(15),
    drug_license_no VARCHAR(100),
    address TEXT,
    credit_limit NUMERIC(12, 2) DEFAULT 0.00,
    credit_days INT DEFAULT 0,
    current_balance NUMERIC(12, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parties_tenant_type ON parties(tenant_id, party_type);
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);

-- 3. Items / Medicines Catalog (With generic active salt composition)
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    item_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    brand_name VARCHAR(255) NOT NULL,
    salt_composition TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(150) NOT NULL,
    hsn_code VARCHAR(10) NOT NULL DEFAULT '300490',
    unit VARCHAR(20) NOT NULL DEFAULT 'Strip',
    pack_size VARCHAR(50) DEFAULT '10 Tablets',
    conversion_factor INT DEFAULT 1,
    tax_rate NUMERIC(5, 2) DEFAULT 12.00,
    cess_rate NUMERIC(5, 2) DEFAULT 0.00,
    reorder_level INT DEFAULT 10,
    is_prescription_required BOOLEAN DEFAULT FALSE,
    storage_condition VARCHAR(100) DEFAULT 'Store in cool & dry place',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, item_code)
);

CREATE INDEX IF NOT EXISTS idx_items_salt ON items USING gin (to_tsvector('english', salt_composition));
CREATE INDEX IF NOT EXISTS idx_items_name ON items USING gin (to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(brand_name, '')));

-- 4. Batch & Inventory Table (Handles FEFO: First Expired First Out)
CREATE TABLE IF NOT EXISTS item_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    mfg_date VARCHAR(10) NOT NULL,
    expiry_date VARCHAR(10) NOT NULL,
    mrp NUMERIC(12, 2) NOT NULL,
    purchase_rate NUMERIC(12, 2) NOT NULL,
    sale_rate NUMERIC(12, 2) NOT NULL,
    quantity_available INT NOT NULL DEFAULT 0,
    rack_location VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, item_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_batches_expiry ON item_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_item_qty ON item_batches(item_id, quantity_available);

-- 5. Sales Invoices Header
CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    invoice_time TIME NOT NULL DEFAULT CURRENT_TIME,
    party_id UUID REFERENCES parties(id),
    party_name VARCHAR(255) NOT NULL,
    party_gstin VARCHAR(15),
    doctor_name VARCHAR(150),
    patient_name VARCHAR(150),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    round_off NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    profit_margin_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    profit_margin_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PARTIAL', 'PENDING', 'HELD')),
    payment_mode VARCHAR(20) DEFAULT 'CASH' CHECK (payment_mode IN ('CASH', 'UPI', 'CARD', 'CREDIT', 'SPLIT')),
    amount_received NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    upi_ref_id VARCHAR(100),
    irn_number VARCHAR(64),
    e_way_bill_no VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON sales_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_party ON sales_invoices(party_id);

-- 6. Sales Invoice Line Items
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    item_name VARCHAR(255) NOT NULL,
    brand_name VARCHAR(255),
    salt_composition TEXT,
    batch_id UUID NOT NULL REFERENCES item_batches(id),
    batch_number VARCHAR(100) NOT NULL,
    expiry_date VARCHAR(10) NOT NULL,
    quantity INT NOT NULL,
    free_quantity INT DEFAULT 0,
    mrp NUMERIC(12, 2) NOT NULL,
    rate NUMERIC(12, 2) NOT NULL,
    purchase_rate NUMERIC(12, 2) NOT NULL,
    discount_percent NUMERIC(5, 2) DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) NOT NULL,
    taxable_amount NUMERIC(12, 2) NOT NULL,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Purchase Inward Receipts (GRN)
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES parties(id),
    supplier_name VARCHAR(255) NOT NULL,
    supplier_invoice_no VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    round_off NUMERIC(4, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PENDING')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Purchase Invoice Line Items
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    item_name VARCHAR(255) NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    mfg_date VARCHAR(10) NOT NULL,
    expiry_date VARCHAR(10) NOT NULL,
    quantity INT NOT NULL,
    free_quantity INT DEFAULT 0,
    purchase_rate NUMERIC(12, 2) NOT NULL,
    mrp NUMERIC(12, 2) NOT NULL,
    sale_rate NUMERIC(12, 2) NOT NULL,
    tax_rate NUMERIC(5, 2) NOT NULL,
    taxable_amount NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- AUTOMATED TRIGGERS FOR STOCK MANAGEMENT
-- ==============================================================================

-- 1. Deduct Stock Function
CREATE OR REPLACE FUNCTION trg_deduct_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE item_batches
    SET quantity_available = quantity_available - (NEW.quantity + COALESCE(NEW.free_quantity, 0)),
        updated_at = NOW()
    WHERE id = NEW.batch_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sale_stock_deduction ON sales_invoice_items;
CREATE TRIGGER trg_sale_stock_deduction
AFTER INSERT ON sales_invoice_items
FOR EACH ROW
EXECUTE FUNCTION trg_deduct_stock_on_sale();

-- 2. Increment Stock Function (With proper tenant_id resolution)
CREATE OR REPLACE FUNCTION trg_add_stock_on_purchase()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Look up tenant_id from parent purchase invoice
    SELECT tenant_id INTO v_tenant_id 
    FROM purchase_invoices 
    WHERE id = NEW.purchase_id;

    IF v_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id 
        FROM items 
        WHERE id = NEW.item_id;
    END IF;

    -- Upsert batch with resolved tenant_id matching unique constraint
    INSERT INTO item_batches (
        tenant_id, item_id, batch_number, mfg_date, expiry_date, 
        mrp, purchase_rate, sale_rate, quantity_available
    )
    VALUES (
        v_tenant_id, NEW.item_id, NEW.batch_number, NEW.mfg_date, NEW.expiry_date, 
        NEW.mrp, NEW.purchase_rate, NEW.sale_rate, (NEW.quantity + COALESCE(NEW.free_quantity, 0))
    )
    ON CONFLICT (tenant_id, item_id, batch_number)
    DO UPDATE SET
        quantity_available = item_batches.quantity_available + (NEW.quantity + COALESCE(NEW.free_quantity, 0)),
        purchase_rate = NEW.purchase_rate,
        sale_rate = NEW.sale_rate,
        mrp = NEW.mrp,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_stock_addition ON purchase_invoice_items;
CREATE TRIGGER trg_purchase_stock_addition
AFTER INSERT ON purchase_invoice_items
FOR EACH ROW
EXECUTE FUNCTION trg_add_stock_on_purchase();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & PUBLIC READ/WRITE POLICIES
-- ==============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Tenants policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenants' AND policyname = 'tenants_all_access') THEN
        CREATE POLICY tenants_all_access ON tenants FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Parties policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'parties' AND policyname = 'parties_all_access') THEN
        CREATE POLICY parties_all_access ON parties FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Items policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'items' AND policyname = 'items_all_access') THEN
        CREATE POLICY items_all_access ON items FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Batches policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'item_batches' AND policyname = 'item_batches_all_access') THEN
        CREATE POLICY item_batches_all_access ON item_batches FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Invoices policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sales_invoices' AND policyname = 'sales_invoices_all_access') THEN
        CREATE POLICY sales_invoices_all_access ON sales_invoices FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Invoice items policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sales_invoice_items' AND policyname = 'sales_invoice_items_all_access') THEN
        CREATE POLICY sales_invoice_items_all_access ON sales_invoice_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Purchase invoices policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_invoices' AND policyname = 'purchase_invoices_all_access') THEN
        CREATE POLICY purchase_invoices_all_access ON purchase_invoices FOR ALL USING (true) WITH CHECK (true);
    END IF;
    -- Purchase invoice items policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_invoice_items' AND policyname = 'purchase_invoice_items_all_access') THEN
        CREATE POLICY purchase_invoice_items_all_access ON purchase_invoice_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ==============================================================================
-- REALTIME PUBLICATION FOR SUPABASE (IDEMPOTENT SAFE ADD)
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'item_batches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE item_batches;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'sales_invoices'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sales_invoices;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore if publication doesn't exist or already configured
    NULL;
END $$;
