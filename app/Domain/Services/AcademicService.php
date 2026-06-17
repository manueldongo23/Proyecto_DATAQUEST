<?php

namespace App\Domain\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class AcademicService
{
    /**
     * Generar explicación didáctica para una forma normal
     */
    public function explainNormalForm(string $nf): array
    {
        $explanations = [
            '1FN' => [
                'title' => 'Primera Forma Normal (1FN)',
                'description' => 'Una tabla está en 1FN cuando todos los atributos contienen valores atómicos (un solo valor por celda) y no existen grupos repetitivos.',
                'rules' => [
                    'Cada celda debe contener un solo valor',
                    'No deben existir columnas repetitivas (ej: telefono1, telefono2)',
                    'Todos los valores en una columna deben ser del mismo tipo',
                    'Cada fila debe ser única (debe tener una clave primaria)'
                ],
                'before_example' => "CREATE TABLE estudiantes (\n    id INT,\n    nombre TEXT,\n    telefonos TEXT  -- '999111222, 988777666'\n);",
                'after_example' => "CREATE TABLE estudiantes (\n    id INT PRIMARY KEY,\n    nombre TEXT\n);\nCREATE TABLE telefonos_estudiante (\n    id INT PRIMARY KEY,\n    estudiante_id INT REFERENCES estudiantes(id),\n    telefono TEXT\n);",
                'common_mistakes' => [
                    'Guardar listas separadas por comas en una celda',
                    'Usar columnas como telefono1, telefono2, telefono3',
                    'Almacenar JSON o arrays en una sola columna'
                ]
            ],
            '2FN' => [
                'title' => 'Segunda Forma Normal (2FN)',
                'description' => 'Una tabla está en 2FN si está en 1FN y todos los atributos no clave dependen de la clave primaria completa (no solo de una parte).',
                'rules' => [
                    'Debe cumplir 1FN',
                    'No debe tener dependencias parciales',
                    'Cada atributo no clave debe depender de TODA la clave primaria',
                    'Si la clave primaria es simple (una columna), automáticamente cumple 2FN'
                ],
                'before_example' => "-- Clave primaria compuesta: (id_pedido, id_producto)\nCREATE TABLE detalle_pedido (\n    id_pedido INT,\n    id_producto INT,\n    nombre_producto TEXT,  -- Depende solo de id_producto\n    cantidad INT,           -- Depende de toda la clave\n    PRIMARY KEY (id_pedido, id_producto)\n);",
                'after_example' => "CREATE TABLE detalle_pedido (\n    id_pedido INT,\n    id_producto INT,\n    cantidad INT,\n    PRIMARY KEY (id_pedido, id_producto)\n);\nCREATE TABLE productos (\n    id INT PRIMARY KEY,\n    nombre TEXT\n);",
                'common_mistakes' => [
                    'No detectar que un atributo depende solo de parte de la clave',
                    'Asumir que 2FN siempre aplica (con clave simple no hay dependencias parciales)',
                    'Confundir dependencia parcial con dependencia transitiva'
                ]
            ],
            '3FN' => [
                'title' => 'Tercera Forma Normal (3FN)',
                'description' => 'Una tabla está en 3FN si está en 2FN y ningún atributo no clave depende transitivamente de otro atributo no clave.',
                'rules' => [
                    'Debe cumplir 2FN',
                    'No debe tener dependencias transitivas',
                    'Un atributo no clave no debe depender de otro atributo no clave',
                    'Si A → B y B → C, entonces C debe estar en otra tabla'
                ],
                'before_example' => "CREATE TABLE empleados (\n    id INT PRIMARY KEY,\n    nombre TEXT,\n    id_departamento INT,\n    nombre_departamento TEXT  -- Depende de id_departamento, no de id\n);",
                'after_example' => "CREATE TABLE empleados (\n    id INT PRIMARY KEY,\n    nombre TEXT,\n    id_departamento INT REFERENCES departamentos(id)\n);\nCREATE TABLE departamentos (\n    id INT PRIMARY KEY,\n    nombre TEXT\n);",
                'common_mistakes' => [
                    'No detectar cadenas de dependencias (A → B → C)',
                    'Dejar datos repetidos que deberían ser catálogos',
                    'Pensar que 3FN siempre requiere separar todo'
                ]
            ],
            'BCNF' => [
                'title' => 'Forma Normal de Boyce-Codd (BCNF)',
                'description' => 'Una tabla está en BCNF si para toda dependencia funcional no trivial, el determinante es una superclave.',
                'rules' => [
                    'Debe cumplir 3FN',
                    'Todo determinante debe ser clave candidata',
                    'Es una versión más estricta de 3FN',
                    'Si una tabla está en 3FN pero no en BCNF, tiene solapamiento de claves'
                ],
                'before_example' => "-- Profesor dicta varios cursos, un curso tiene un solo profesor\nCREATE TABLE asignacion (\n    id_profesor INT,\n    id_curso INT,\n    nombre_curso TEXT,\n    PRIMARY KEY (id_profesor, id_curso)\n);\n-- FD: id_curso → nombre_curso (problema: id_curso no es superclave)",
                'after_example' => "CREATE TABLE cursos (\n    id INT PRIMARY KEY,\n    nombre TEXT,\n    id_profesor INT REFERENCES profesores(id)\n);",
                'common_mistakes' => [
                    'Confundir BCNF con 3FN',
                    'No detectar determinantes que no son clave',
                    'Olvidar que BCNF es más restrictiva que 3FN'
                ]
            ],
            '4FN' => [
                'title' => 'Cuarta Forma Normal (4FN)',
                'description' => 'Una tabla está en 4FN si está en BCNF y no tiene dependencias multivaluadas no triviales.',
                'rules' => [
                    'Debe cumplir BCNF',
                    'No debe tener dependencias multivaluadas (DMV)',
                    'Si X →→ Y y X →→ Z, e Y y Z son independientes, deben separarse',
                    'Una DMV ocurre cuando dos conjuntos de valores son independientes'
                ],
                'before_example' => "CREATE TABLE estudiante_actividad (\n    id_estudiante INT,\n    idioma TEXT,     -- Valores independientes\n    deporte TEXT,     -- Valores independientes\n    PRIMARY KEY (id_estudiante, idioma, deporte)\n);\n-- Problema: combinaciones artificiales (producto cartesiano)",
                'after_example' => "CREATE TABLE estudiante_idioma (\n    id_estudiante INT REFERENCES estudiantes(id),\n    idioma TEXT,\n    PRIMARY KEY (id_estudiante, idioma)\n);\nCREATE TABLE estudiante_deporte (\n    id_estudiante INT REFERENCES estudiantes(id),\n    deporte TEXT,\n    PRIMARY KEY (id_estudiante, deporte)\n);",
                'common_mistakes' => [
                    'No identificar cuando dos atributos son independientes',
                    'Crear tablas innecesarias cuando no hay DMV reales',
                    'Confundir DMV con dependencias funcionales'
                ]
            ],
            '5FN' => [
                'title' => 'Quinta Forma Normal (5FN)',
                'description' => 'Una tabla está en 5FN si no puede descomponerse más sin pérdida de información. También llamada Forma Normal de Proyección-Join.',
                'rules' => [
                    'Debe cumplir 4FN',
                    'Toda dependencia de unión debe ser implicada por una clave candidata',
                    'La tabla no debe poder descomponerse en proyecciones más pequeñas',
                    'Es muy rara en la práctica; aplica solo en casos muy específicos'
                ],
                'before_example' => "-- Caso muy específico: proveedores, productos, proyectos\nCREATE TABLE suministro (\n    proveedor TEXT,\n    producto TEXT,\n    proyecto TEXT,\n    PRIMARY KEY (proveedor, producto, proyecto)\n);\n-- Si hay reglas: proveedor-proyecto, producto-proyecto, proveedor-producto",
                'after_example' => "CREATE TABLE prov_proy (\n    proveedor TEXT,\n    proyecto TEXT,\n    PRIMARY KEY (proveedor, proyecto)\n);\nCREATE TABLE prod_proy (\n    producto TEXT,\n    proyecto TEXT,\n    PRIMARY KEY (producto, proyecto)\n);\nCREATE TABLE prov_prod (\n    proveedor TEXT,\n    producto TEXT,\n    PRIMARY KEY (proveedor, producto)\n);",
                'common_mistakes' => [
                    'Intentar aplicar 5FN donde no es necesario',
                    'No entender el concepto de dependencia de unión',
                    'Sobre-normalizar tablas simples'
                ]
            ]
        ];

        return $explanations[$nf] ?? ['title' => '', 'description' => ''];
    }

    /**
     * Generar un ejercicio para una forma normal específica
     */
    public function generateExercise(string $nf, int $difficulty = 1): array
    {
        $exercises = [
            '1FN' => [
                [
                    'title' => 'Detectar columnas no atómicas',
                    'description' => 'La siguiente tabla contiene una columna con múltiples valores. Identifica el problema y propón la solución.',
                    'table' => "estudiantes(id, nombre, telefonos)",
                    'sample_data' => "1 | Juan Pérez  | 999111222, 988777666\n2 | María García | 955444333",
                    'hints' => [
                        'Revisa si alguna celda contiene más de un valor',
                        'La columna telefonos tiene varios números separados por coma',
                        'Crea una tabla separada telefonos_estudiante con un teléfono por fila'
                    ],
                    'solution' => "Tablas: estudiantes(id, nombre) y telefonos_estudiante(id, estudiante_id, telefono)"
                ],
                [
                    'title' => 'Identificar columnas repetitivas',
                    'description' => 'Esta tabla usa varias columnas para almacenar el mismo tipo de información.',
                    'table' => "productos(id, nombre, precio1, precio2, precio3)",
                    'sample_data' => "1 | Laptop | 2500 | 2400 | 2600",
                    'hints' => [
                        'Observa las columnas precio1, precio2 y precio3',
                        'Todas almacenan precios, deberían ser filas',
                        'Crea una tabla precios_producto con tipo de precio y valor'
                    ],
                    'solution' => "Tablas: productos(id, nombre) y precios_producto(id, producto_id, tipo_precio, valor)"
                ]
            ],
            '2FN' => [
                [
                    'title' => 'Encontrar dependencia parcial',
                    'description' => 'Identifica qué atributo no depende de toda la clave primaria compuesta.',
                    'table' => "matricula(id_estudiante, id_curso, nombre_estudiante, fecha_matricula)",
                    'hints' => [
                        'La clave primaria es compuesta: (id_estudiante, id_curso)',
                        '¿nombre_estudiante depende de id_estudiante o de toda la clave?',
                        'nombre_estudiante depende solo de id_estudiante → dependencia parcial'
                    ],
                    'solution' => "Separar: estudiantes(id, nombre) y matricula(id_estudiante, id_curso, fecha_matricula)"
                ]
            ],
            '3FN' => [
                [
                    'title' => 'Detectar dependencia transitiva',
                    'description' => 'Encuentra la cadena de dependencias que viola 3FN.',
                    'table' => "ventas(id, id_cliente, nombre_cliente, id_ciudad, nombre_ciudad, total)",
                    'hints' => [
                        'Sigue la cadena: id_venta → id_ciudad → nombre_ciudad',
                        'nombre_ciudad depende de id_ciudad, no de id_venta',
                        'Crea una tabla ciudades separada'
                    ],
                    'solution' => "Tablas: ventas(id, id_cliente, id_ciudad, total), clientes(id, nombre), ciudades(id, nombre)"
                ]
            ],
            'BCNF' => [
                [
                    'title' => 'Identificar determinante no clave',
                    'description' => 'Aunque esta tabla está en 3FN, hay un determinante que no es superclave.',
                    'table' => "asignatura_profesor(id_asignatura, nombre_asignatura, id_profesor, nombre_profesor)",
                    'hints' => [
                        'Revisa todas las dependencias funcionales',
                        '¿nombre_asignatura depende de id_asignatura?',
                        'id_asignatura → nombre_asignatura: pero id_asignatura no es clave candidata'
                    ],
                    'solution' => "Separar: asignaturas(id, nombre, id_profesor) y profesores(id, nombre)"
                ]
            ]
        ];

        return $exercises[$nf][0] ?? ['title' => 'Ejercicio no disponible', 'description' => ''];
    }

    /**
     * Evaluar la respuesta de un usuario contra una solución esperada
     */
    public function evaluateAnswer(array $userAnswer, array $expectedSolution): array
    {
        $correct = true;
        $observations = [];

        foreach ($expectedSolution['tables'] as $expectedTable) {
            $found = false;
            foreach ($userAnswer['tables'] as $userTable) {
                if ($userTable['name'] === $expectedTable['name']) {
                    $found = true;
                    $attrDiff = array_diff($expectedTable['attributes'], $userTable['attributes']);
                    if (!empty($attrDiff)) {
                        $correct = false;
                        $observations[] = "Faltan atributos en {$expectedTable['name']}: " . implode(', ', $attrDiff);
                    }
                    break;
                }
            }
            if (!$found) {
                $correct = false;
                $observations[] = "Falta la tabla: {$expectedTable['name']}";
            }
        }

        return [
            'correct' => $correct,
            'score' => $correct ? 100 : max(0, 100 - count($observations) * 20),
            'observations' => $observations,
            'passed' => $correct
        ];
    }
}
