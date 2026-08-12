-- Create initial admin user
-- password: G@te9173

INSERT IGNORE INTO users (name, username, password, role)
VALUES (
  'Administrador',
  'administrador',
  '131e106e665d164d6ad066cde74382bcf304667766eba93562128dc4da1a4ec4',
  'admin'
);
