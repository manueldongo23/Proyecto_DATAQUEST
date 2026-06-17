USE dataquest;

CREATE TABLE IF NOT EXISTS learning_levels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    world INT NOT NULL,
    level_number INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    initial_schema JSON NOT NULL,
    expected_solution JSON NOT NULL,
    theory TEXT,
    xp INT DEFAULT 100,
    difficulty ENUM('Fácil', 'Medio', 'Difícil', 'Muy Difícil') DEFAULT 'Fácil'
);

CREATE TABLE IF NOT EXISTS user_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    level_id INT NOT NULL,
    stars_earned INT DEFAULT 0,
    score INT DEFAULT 0,
    attempts INT DEFAULT 0,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (level_id) REFERENCES learning_levels(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_level (user_id, level_id)
);

-- Check if levels are empty before inserting
SET @count = (SELECT COUNT(*) FROM learning_levels);

INSERT INTO learning_levels (world, level_number, title, description, initial_schema, expected_solution, difficulty, xp) 
SELECT 1, 1, 'La Ciudad de los Atributos', 'Aprende a identificar atributos atómicos y compuestos.', '["CLIENTES(id, nombre_completo, direccion)"]', '["CLIENTES(id, nombre, apellidos, calle, ciudad)"]', 'Fácil', 100
WHERE @count = 0;

INSERT INTO learning_levels (world, level_number, title, description, initial_schema, expected_solution, difficulty, xp) 
SELECT 1, 2, 'El Puente de las Dependencias', 'Domina las dependencias funcionales básicas.', '["EMPLEADOS(id, nombre, depto, jefe_depto)"]', '["EMPLEADOS(id, nombre, depto)", "DEPARTAMENTOS(depto, jefe_depto)"]', 'Medio', 250
WHERE @count = 0;

INSERT INTO learning_levels (world, level_number, title, description, initial_schema, expected_solution, difficulty, xp) 
SELECT 1, 3, 'La Fortaleza de la 2FN', 'Elimina las dependencias parciales del reino.', '["INSCRIPCIONES(id_est, id_curso, nombre_est, creditos)"]', '["INSCRIPCIONES(id_est, id_curso)", "ESTUDIANTES(id_est, nombre_est)", "CURSOS(id_curso, creditos)"]', 'Difícil', 400
WHERE @count = 0;

INSERT INTO learning_levels (world, level_number, title, description, initial_schema, expected_solution, difficulty, xp) 
SELECT 1, 4, 'El Santuario de la 3FN', 'Purifica las tablas de dependencias transitivas.', '["COMPRAS(id, fecha, id_proveedor, nom_proveedor, telefono_prov)"]', '["COMPRAS(id, fecha, id_proveedor)", "PROVEEDORES(id_proveedor, nom_proveedor, telefono_prov)"]', 'Muy Difícil', 600
WHERE @count = 0;
