-- Seed base roles
INSERT INTO roles (id, name, description, is_system)
VALUES
  (gen_random_uuid(), 'USER', 'Default user role', true),
  (gen_random_uuid(), 'ADMIN', 'Administrator role', true)
ON CONFLICT (name) DO NOTHING;

-- Seed base permissions
INSERT INTO permissions (id, name, resource, action, type, description)
VALUES
  (gen_random_uuid(), 'user.read', 'user', 'read', 'ALLOW', 'Read user profile'),
  (gen_random_uuid(), 'user.write', 'user', 'write', 'ALLOW', 'Modify user profile'),
  (gen_random_uuid(), 'session.read', 'session', 'read', 'ALLOW', 'List sessions'),
  (gen_random_uuid(), 'session.revoke', 'session', 'revoke', 'ALLOW', 'Revoke sessions')
ON CONFLICT (name) DO NOTHING;

-- Link ADMIN role to all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ADMIN'
ON CONFLICT DO NOTHING;
