-- =============================================================
-- MOTORMEC — PostgreSQL Multi-Tenant Schema v1.0
-- Ejecutado automáticamente al primer inicio del contenedor
-- =============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- CAPA 1: TENANTS
-- =============================================================

CREATE TABLE tenants (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug        VARCHAR(60) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    plan        VARCHAR(20)  NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free','pro','fleet','enterprise')),
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    settings    JSONB        NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tenants IS 'Un registro por taller o flota cliente';

-- =============================================================
-- CAPA 2: AUTENTICACIÓN (reemplaza Clerk)
-- =============================================================

CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'mechanic'
                      CHECK (role IN ('owner','admin','mechanic','viewer')),
    phone         VARCHAR(30),
    avatar_url    VARCHAR(500),
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE TABLE refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ
);

-- =============================================================
-- CAPA 3: CONFIGURACIÓN DEL TALLER
-- =============================================================

CREATE TABLE app_config (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    company_name        VARCHAR(255) NOT NULL DEFAULT '',
    company_description TEXT,
    copyright           VARCHAR(255),
    settings            JSONB        NOT NULL DEFAULT '{}'
);

CREATE TABLE categories (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(50)  NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name, type)
);

CREATE TABLE service_catalog (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    usage_count INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE TABLE navigation_items (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title       VARCHAR(100) NOT NULL,
    url         VARCHAR(255) NOT NULL,
    icon        VARCHAR(100),
    color       VARCHAR(50),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT true
);

-- =============================================================
-- CAPA 4: SOCIOS / PARTNERS
-- =============================================================

CREATE TABLE partners (
    id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                VARCHAR(255)  NOT NULL,
    email               VARCHAR(255),
    phone               VARCHAR(30),
    investment_pct      NUMERIC(5,2)  NOT NULL DEFAULT 0,
    monthly_contribution NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_contributed   NUMERIC(12,2) NOT NULL DEFAULT 0,
    join_date           DATE,
    is_active           BOOLEAN       NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================
-- CAPA 5: CLIENTES Y VEHÍCULOS
-- =============================================================

CREATE TABLE customers (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255)  NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(30)   NOT NULL,
    address         TEXT,
    document_type   VARCHAR(20),
    document_number VARCHAR(50),
    notes           TEXT,
    is_active       BOOLEAN       NOT NULL DEFAULT true,
    -- Métricas cache (se actualizan via trigger o job)
    total_vehicles  INTEGER       NOT NULL DEFAULT 0,
    total_spent     NUMERIC(12,2) NOT NULL DEFAULT 0,
    last_visit_at   TIMESTAMPTZ,
    visit_count     INTEGER       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, phone)
);

CREATE TABLE vehicles (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id     UUID        REFERENCES customers(id) ON DELETE SET NULL,
    plate           VARCHAR(20)  NOT NULL,
    brand           VARCHAR(100) NOT NULL,
    model           VARCHAR(100) NOT NULL,
    year            INTEGER,
    owner_name      VARCHAR(255) NOT NULL,
    owner_phone     VARCHAR(30)  NOT NULL,
    status          VARCHAR(30)  NOT NULL DEFAULT 'waiting'
                        CHECK (status IN ('waiting','in_progress','delivered','suspended')),
    is_in_workshop  BOOLEAN      NOT NULL DEFAULT true,
    description     TEXT,
    current_mileage INTEGER,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, plate)
);

-- Historial de kilometraje (antes: campo plano — ahora: trazable)
CREATE TABLE mileage_history (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id   UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    mileage      INTEGER     NOT NULL,
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    notes        TEXT
);

-- =============================================================
-- CAPA 6: WORK ORDERS (núcleo del negocio)
-- =============================================================

CREATE SEQUENCE work_order_seq START 1;

CREATE TABLE work_orders (
    id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id       UUID          NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    customer_id      UUID          REFERENCES customers(id) ON DELETE SET NULL,
    -- Número legible: WO-2024-00001
    order_number     VARCHAR(30)   NOT NULL,
    status           VARCHAR(20)   NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','in_progress','paused','closed','invoiced','cancelled')),
    mileage_at_entry INTEGER,
    mileage_at_exit  INTEGER,
    opened_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    closed_at        TIMESTAMPTZ,
    invoiced_at      TIMESTAMPTZ,
    labor_cost       NUMERIC(10,2) NOT NULL DEFAULT 0,
    parts_cost       NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_cost       NUMERIC(10,2) GENERATED ALWAYS AS (labor_cost + parts_cost) STORED,
    diagnosis        TEXT,
    internal_notes   TEXT,
    customer_notes   TEXT,
    created_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, order_number)
);

-- Servicios realizados dentro de cada Work Order
CREATE TABLE work_order_services (
    id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    work_order_id  UUID          NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    service_id     UUID          REFERENCES service_catalog(id) ON DELETE SET NULL,
    service_name   VARCHAR(255)  NOT NULL,
    labor_minutes  INTEGER,
    price          NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes          TEXT
);

-- Repuestos y piezas usados en cada Work Order
CREATE TABLE work_order_parts (
    id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    work_order_id  UUID          NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    product_id     UUID          REFERENCES products(id) ON DELETE SET NULL,
    name           VARCHAR(255)  NOT NULL,
    quantity       NUMERIC(8,3)  NOT NULL DEFAULT 1,
    unit_price     NUMERIC(10,2) NOT NULL,
    total_price    NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    source         VARCHAR(20)   CHECK (source IN ('stock','purchased','client_provided')),
    supplier       VARCHAR(255),
    notes          TEXT
);

-- Asignación de mecánicos a Work Orders
CREATE TABLE work_order_assignments (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    work_order_id  UUID        NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    role           VARCHAR(20) DEFAULT 'mechanic',
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at  TIMESTAMPTZ,
    UNIQUE(work_order_id, user_id)
);

-- Sesiones de trabajo por mecánico (antes: workSessions[] embebido en vehicle)
CREATE TABLE work_sessions (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    work_order_id    UUID        NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paused_at        TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    duration_minutes INTEGER,
    notes            TEXT
);

-- =============================================================
-- CAPA 7: INVENTARIO
-- =============================================================

CREATE TABLE products (
    id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name          VARCHAR(255)  NOT NULL,
    quantity      NUMERIC(10,3) NOT NULL DEFAULT 0,
    unit          VARCHAR(30),
    type          VARCHAR(100),
    price         NUMERIC(10,2) NOT NULL DEFAULT 0,
    reorder_point NUMERIC(10,3),
    is_active     BOOLEAN       NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Vista que calcula is_low_stock dinámicamente (evita columna computed problem)
CREATE VIEW products_with_stock_status AS
    SELECT *,
           (quantity <= COALESCE(reorder_point, 0)) AS is_low_stock
    FROM products;

CREATE TABLE inventory_movements (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id    UUID        REFERENCES products(id) ON DELETE SET NULL,
    product_name  VARCHAR(255) NOT NULL,
    work_order_id UUID        REFERENCES work_orders(id) ON DELETE SET NULL,
    movement_type VARCHAR(30)  NOT NULL
                      CHECK (movement_type IN (
                          'created','updated','deleted',
                          'stock_increase','stock_decrease','consumed_in_wo'
                      )),
    previous_qty  NUMERIC(10,3),
    new_qty       NUMERIC(10,3),
    qty_change    NUMERIC(10,3),
    previous_price NUMERIC(10,2),
    new_price     NUMERIC(10,2),
    reason        TEXT,
    metadata      JSONB,
    performed_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- CAPA 8: FINANZAS
-- =============================================================

CREATE TABLE transactions (
    id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    work_order_id  UUID          REFERENCES work_orders(id) ON DELETE SET NULL,
    vehicle_id     UUID          REFERENCES vehicles(id) ON DELETE SET NULL,
    date           DATE          NOT NULL,
    description    TEXT          NOT NULL,
    type           VARCHAR(10)   NOT NULL CHECK (type IN ('income','expense')),
    category       VARCHAR(100)  NOT NULL,
    amount         NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(50),
    supplier       VARCHAR(255),
    notes          TEXT,
    is_active      BOOLEAN       NOT NULL DEFAULT true,
    suspended_at   TIMESTAMPTZ,
    created_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================
-- CAPA 9: WHATSAPP BOT
-- =============================================================

CREATE TABLE whatsapp_authorized (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone       VARCHAR(30)  NOT NULL,
    name        VARCHAR(255) NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    added_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    added_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(tenant_id, phone)
);

CREATE TABLE whatsapp_conversations (
    id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone                 VARCHAR(30)  NOT NULL,
    stage                 VARCHAR(50)  NOT NULL,
    data                  JSONB        NOT NULL DEFAULT '{}',
    candidate_customer_id UUID        REFERENCES customers(id) ON DELETE SET NULL,
    intake_log_id         UUID,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, phone)
);

CREATE TABLE whatsapp_intake (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    message_id       VARCHAR(255) NOT NULL UNIQUE,
    from_phone       VARCHAR(30)  NOT NULL,
    raw_message      TEXT,
    brand_model      VARCHAR(255),
    mileage          VARCHAR(50),
    plate            VARCHAR(20),
    task_description TEXT,
    client_name      VARCHAR(255),
    photo_urls       TEXT[],
    vehicle_id       UUID        REFERENCES vehicles(id) ON DELETE SET NULL,
    customer_id      UUID        REFERENCES customers(id) ON DELETE SET NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','processed','error','linked')),
    error_message    TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
-- CAPA 10: AUDITORÍA GLOBAL
-- =============================================================

CREATE TABLE audit_log (
    id            BIGSERIAL    PRIMARY KEY,
    tenant_id     UUID         NOT NULL,
    user_id       UUID,
    entity_type   VARCHAR(50)  NOT NULL,
    entity_id     UUID         NOT NULL,
    action        VARCHAR(30)  NOT NULL,
    previous_data JSONB,
    new_data      JSONB,
    ip_address    INET,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
-- CAPA 11: ALERTAS PREVENTIVAS (feature premium)
-- =============================================================

CREATE TABLE maintenance_alerts (
    id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vehicle_id           UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    customer_id          UUID        REFERENCES customers(id) ON DELETE SET NULL,
    work_order_id        UUID        REFERENCES work_orders(id) ON DELETE SET NULL,
    alert_type           VARCHAR(50)  NOT NULL,
    last_service_mileage INTEGER,
    interval_mileage     INTEGER,
    due_mileage          INTEGER,
    last_service_date    DATE,
    interval_days        INTEGER,
    due_date             DATE,
    status               VARCHAR(20)  NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','sent','acknowledged','completed')),
    sent_at              TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
-- ÍNDICES (rendimiento + aislamiento multi-tenant)
-- =============================================================

-- Autenticación
CREATE INDEX idx_users_tenant         ON users(tenant_id);
CREATE INDEX idx_users_email          ON users(tenant_id, email);
CREATE INDEX idx_refresh_tokens_hash  ON refresh_tokens(token_hash) WHERE revoked_at IS NULL;

-- Clientes y vehículos
CREATE INDEX idx_customers_tenant     ON customers(tenant_id);
CREATE INDEX idx_customers_phone      ON customers(tenant_id, phone);
CREATE INDEX idx_customers_document   ON customers(tenant_id, document_type, document_number);
CREATE INDEX idx_vehicles_tenant      ON vehicles(tenant_id);
CREATE INDEX idx_vehicles_plate       ON vehicles(tenant_id, plate);
CREATE INDEX idx_vehicles_status      ON vehicles(tenant_id, status);
CREATE INDEX idx_vehicles_customer    ON vehicles(tenant_id, customer_id);
CREATE INDEX idx_mileage_vehicle      ON mileage_history(vehicle_id, recorded_at DESC);

-- Work Orders
CREATE INDEX idx_wo_tenant            ON work_orders(tenant_id);
CREATE INDEX idx_wo_vehicle           ON work_orders(tenant_id, vehicle_id);
CREATE INDEX idx_wo_status            ON work_orders(tenant_id, status);
CREATE INDEX idx_wo_date              ON work_orders(tenant_id, opened_at DESC);
CREATE INDEX idx_wo_services_wo       ON work_order_services(work_order_id);
CREATE INDEX idx_wo_parts_wo          ON work_order_parts(work_order_id);
CREATE INDEX idx_wo_assignments_wo    ON work_order_assignments(work_order_id);
CREATE INDEX idx_work_sessions_wo     ON work_sessions(work_order_id);
CREATE INDEX idx_work_sessions_user   ON work_sessions(user_id, started_at DESC);

-- Inventario y finanzas
CREATE INDEX idx_products_tenant      ON products(tenant_id);
CREATE INDEX idx_inventory_mov        ON inventory_movements(tenant_id, created_at DESC);
CREATE INDEX idx_transactions_tenant  ON transactions(tenant_id);
CREATE INDEX idx_transactions_date    ON transactions(tenant_id, date DESC);
CREATE INDEX idx_transactions_type    ON transactions(tenant_id, type);

-- Auditoría y alertas
CREATE INDEX idx_audit_entity         ON audit_log(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_date           ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_alerts_vehicle       ON maintenance_alerts(tenant_id, vehicle_id, status);
CREATE INDEX idx_alerts_due           ON maintenance_alerts(tenant_id, due_date) WHERE status = 'pending';

-- WhatsApp
CREATE INDEX idx_wa_auth_tenant       ON whatsapp_authorized(tenant_id, phone);
CREATE INDEX idx_wa_conv_phone        ON whatsapp_conversations(tenant_id, phone);
CREATE INDEX idx_wa_intake_plate      ON whatsapp_intake(tenant_id, plate);
CREATE INDEX idx_wa_intake_status     ON whatsapp_intake(tenant_id, status);

-- =============================================================
-- ROW LEVEL SECURITY (segunda capa de aislamiento)
-- La API setea: SET LOCAL app.current_tenant_id = '<uuid>'
-- =============================================================

ALTER TABLE customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_alerts     ENABLE ROW LEVEL SECURITY;

-- Políticas: solo ves los registros de tu taller
CREATE POLICY tenant_isolation ON customers
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON vehicles
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON work_orders
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON transactions
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON products
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON inventory_movements
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation ON maintenance_alerts
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- =============================================================
-- TRIGGER: updated_at automático
-- =============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_vehicles_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_work_orders_updated_at
    BEFORE UPDATE ON work_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
