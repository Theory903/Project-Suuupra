-- Role templates for reusable role sets and delegated tenant admins

CREATE TABLE IF NOT EXISTS role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_template_permissions (
  template_id UUID NOT NULL,
  permission_id UUID NOT NULL,
  PRIMARY KEY (template_id, permission_id),
  CONSTRAINT fk_rtp_template FOREIGN KEY (template_id) REFERENCES role_templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_rtp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Delegated tenant admins
CREATE TABLE IF NOT EXISTS tenant_admins (
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, user_id),
  CONSTRAINT fk_tadm_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_tadm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


