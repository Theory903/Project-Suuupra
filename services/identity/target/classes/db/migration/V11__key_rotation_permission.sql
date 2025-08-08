INSERT INTO permissions (id, name, resource, action, type, description)
VALUES (gen_random_uuid(), 'keys.rotate', 'keys', 'rotate', 'ALLOW', 'Rotate signing keys')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.name='keys.rotate' WHERE r.name='ADMIN'
ON CONFLICT DO NOTHING;

