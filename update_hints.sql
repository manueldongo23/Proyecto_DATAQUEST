USE dataquest;

-- Agregar columna hints
ALTER TABLE learning_levels ADD COLUMN hints JSON NULL;

-- Actualizar niveles con pistas
UPDATE learning_levels 
SET hints = '["Recuerda que un atributo atómico es indivisible.", "Fíjate en el atributo `nombre_completo` y `direccion`.", "Deberías dividir `nombre_completo` en `nombre` y `apellidos`, y `direccion` en `calle` y `ciudad`."]' 
WHERE level_number = 1;

UPDATE learning_levels 
SET hints = '["Revisa qué atributo determina realmente a quién pertenece el departamento.", "El jefe de departamento depende del departamento, no directamente del empleado.", "Crea una tabla `DEPARTAMENTOS(depto, jefe_depto)` y quita `jefe_depto` de empleados."]' 
WHERE level_number = 2;

UPDATE learning_levels 
SET hints = '["Para estar en 2FN, no debe haber dependencias parciales de la clave primaria compuesta.", "La clave de la tabla original es (id_est, id_curso). ¿El nombre del estudiante depende de ambos?", "Separa la información del estudiante y del curso en sus propias tablas, dejando solo las claves en la tabla relacional."]' 
WHERE level_number = 3;

UPDATE learning_levels 
SET hints = '["La 3FN se viola cuando hay dependencias transitivas: X -> Y y Y -> Z.", "¿El teléfono del proveedor depende de la compra o del proveedor?", "Separa los datos del proveedor en `PROVEEDORES(id_proveedor, nom_proveedor, telefono_prov)`."]' 
WHERE level_number = 4;
