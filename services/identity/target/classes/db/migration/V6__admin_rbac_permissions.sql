-- Add RBAC admin permissions
INSERT INTO permissions (id, name, resource, action, type, description)
VALUES
  (gen_random_uuid(), 'rbac.read', 'rbac', 'read', 'ALLOW', 'Read RBAC configuration'),
  (gen_random_uuid(), 'rbac.write', 'rbac', 'write', 'ALLOW', 'Modify RBAC configuration')
ON CONFLICT (name) DO NOTHING;

-- Grant to ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name IN ('rbac.read','rbac.write') WHERE r.name='ADMIN'
ON CONFLICT DO NOTHING;
