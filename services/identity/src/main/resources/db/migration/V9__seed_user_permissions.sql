-- Grant minimal permissions to USER role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('user.read', 'session.read', 'session.revoke')
WHERE r.name = 'USER'
ON CONFLICT DO NOTHING;
