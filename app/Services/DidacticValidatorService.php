<?php

namespace App\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;
use App\Domain\Services\NormalizationEngine;
use App\Domain\Services\DecompositionService;

class DidacticValidatorService
{
    public function __construct(
        private NormalizationEngine $engine,
        private DecompositionService $decompositionService
    ) {}

    public function validateWithFeedback(RelationSchema $schema): array
    {
        $diagnosis = $this->engine->diagnoseNormalization($schema);
        $ck = $this->engine->findCandidateKeys($schema);
        $fds = $schema->getFds();

        $feedback = [
            'schema' => [
                'name' => $schema->name,
                'attributes' => $schema->getAttributesSet(),
                'attribute_count' => count($schema->getAttributesSet()),
                'dependency_count' => count($fds),
            ],
            'keys' => [
                'candidate_keys' => $ck,
                'primary_key' => $ck[0] ?? [],
                'has_primary_key' => !empty($ck),
                'is_composite_key' => count($ck[0] ?? []) > 1,
            ],
            'normalization' => [
                'current_nf' => $diagnosis['current_nf'],
                'violations' => $diagnosis['violations'],
                'violation_count' => count($diagnosis['violations']),
            ],
            'checks' => $this->runAllChecks($schema),
            'explanations' => $this->generateExplanations($diagnosis),
            'anomalies' => $this->detectAnomalies($schema),
            'recommendations' => $this->prioritizeRecommendations($diagnosis),
            'suggestions' => $diagnosis['suggestions'],
        ];

        return $feedback;
    }

    private function runAllChecks(RelationSchema $schema): array
    {
        $checks = [];
        $attrs = $schema->getAttributesSet();
        $fds = $schema->getFds();

        $checks['primary_key'] = $this->checkPrimaryKey($schema);
        $checks['atomic_attributes'] = $this->checkAtomicAttributes($schema);
        $checks['repeating_groups'] = $this->checkRepeatingGroups($schema);
        $checks['partial_dependencies'] = $this->checkPartialDependencies($schema);
        $checks['transitive_dependencies'] = $this->checkTransitiveDependencies($schema);
        $checks['bcnf_compliance'] = $this->checkBCNF($schema);

        return $checks;
    }

    private function checkPrimaryKey(RelationSchema $schema): array
    {
        $ck = $this->engine->findCandidateKeys($schema);

        if (empty($ck)) {
            return [
                'passed' => false,
                'severity' => 'critical',
                'message' => 'La tabla no tiene clave primaria. Toda tabla debe tener una forma de identificar cada fila de forma única.',
                'solution' => 'Agrega una columna id autogenerada o identifica un conjunto de atributos que sea único.',
            ];
        }

        if (count($ck[0]) > 1) {
            return [
                'passed' => true,
                'severity' => 'warning',
                'message' => "La clave primaria es compuesta: " . implode(', ', $ck[0]) . ". Esto puede requerir 2FN.",
                'solution' => 'Verifica que todos los atributos no clave dependan de la clave completa.',
            ];
        }

        return [
            'passed' => true,
            'severity' => 'ok',
            'message' => "Clave primaria correcta: " . implode(', ', $ck[0]),
        ];
    }

    private function checkAtomicAttributes(RelationSchema $schema): array
    {
        $issues = [];
        foreach ($schema->getAttributesSet() as $attr) {
            $suggestMulti = ['telefonos', 'telefono', 'email', 'emails', 'direccion',
                           'tags', 'categorias', 'productos', 'items', 'datos'];

            foreach ($suggestMulti as $pattern) {
                if (str_contains(strtolower($attr), $pattern)) {
                    $issues[] = $attr;
                    break;
                }
            }
        }

        if (!empty($issues)) {
            return [
                'passed' => false,
                'severity' => 'error',
                'message' => 'Posibles atributos no atómicos detectados: ' . implode(', ', $issues),
                'solution' => 'Cada celda debe contener un solo valor. Crea tablas relacionadas para almacenar valores múltiples.',
                'attributes' => $issues,
            ];
        }

        return [
            'passed' => true,
            'severity' => 'ok',
            'message' => 'No se detectaron atributos no atómicos.',
        ];
    }

    private function checkRepeatingGroups(RelationSchema $schema): array
    {
        $issues = [];
        $attrs = $schema->getAttributesSet();

        foreach ($attrs as $attr) {
            if (preg_match('/([a-zA-Z]+)(\d+)$/', $attr, $matches)) {
                $baseName = $matches[1];
                $similar = [];
                foreach ($attrs as $a2) {
                    if ($a2 !== $attr && str_starts_with($a2, $baseName)) {
                        $similar[] = $a2;
                    }
                }
                if (count($similar) >= 1) {
                    $issues[$baseName] = array_merge([$attr], $similar);
                }
            }
        }

        if (!empty($issues)) {
            return [
                'passed' => false,
                'severity' => 'error',
                'message' => 'Grupos repetitivos detectados: ' . implode(', ', array_keys($issues)),
                'details' => $issues,
                'solution' => 'Reemplaza las columnas repetitivas por una tabla relacionada con una fila por valor.',
            ];
        }

        return [
            'passed' => true,
            'severity' => 'ok',
            'message' => 'No se detectaron grupos repetitivos.',
        ];
    }

    private function checkPartialDependencies(RelationSchema $schema): array
    {
        $ck = $this->engine->findCandidateKeys($schema);
        if (empty($ck) || count($ck[0]) <= 1) {
            return [
                'passed' => true,
                'severity' => 'info',
                'message' => 'No aplica: la clave primaria es simple (una columna). 2FN solo aplica con claves compuestas.',
            ];
        }

        $pk = $ck[0];
        $partials = [];
        foreach ($schema->getFds() as $fd) {
            if (array_diff($fd->determinant, $pk) === [] &&
                count($fd->determinant) < count($pk) &&
                !empty($fd->determinant)) {
                $partials[] = $fd;
            }
        }

        if (!empty($partials)) {
            $details = array_map(fn($fd) =>
                '{' . implode(',', $fd->determinant) . '} → {' . implode(',', $fd->dependent) . '}',
                $partials
            );
            return [
                'passed' => false,
                'severity' => 'error',
                'message' => 'Dependencias parciales detectadas',
                'details' => $details,
                'solution' => 'Crea tablas separadas para los atributos que dependen solo de parte de la clave.',
            ];
        }

        return [
            'passed' => true,
            'severity' => 'ok',
            'message' => 'No hay dependencias parciales.',
        ];
    }

    private function checkTransitiveDependencies(RelationSchema $schema): array
    {
        $ck = $this->engine->findCandidateKeys($schema);
        $pk = $ck[0] ?? [];
        $nonPrimeAttrs = array_diff($schema->getAttributesSet(), $pk);
        $transitives = [];

        foreach ($schema->getFds() as $fd) {
            if (array_diff($fd->determinant, $nonPrimeAttrs) === [] &&
                array_diff($fd->dependent, $nonPrimeAttrs) === [] &&
                !empty($fd->determinant)) {
                $transitives[] = $fd;
            }
        }

        if (!empty($transitives)) {
            $details = array_map(fn($fd) =>
                '{' . implode(',', $fd->determinant) . '} → {' . implode(',', $fd->dependent) . '}',
                $transitives
            );
            return [
                'passed' => false,
                'severity' => 'error',
                'message' => 'Dependencias transitivas detectadas',
                'details' => $details,
                'solution' => 'Crea una tabla separada para los atributos que dependen de otros atributos no clave.',
            ];
        }

        return [
            'passed' => true,
            'severity' => 'ok',
            'message' => 'No hay dependencias transitivas.',
        ];
    }

    private function checkBCNF(RelationSchema $schema): array
    {
        $allAttrs = $schema->getAttributesSet();
        $fds = $schema->getFds();
        $violations = [];

        foreach ($fds as $fd) {
            if (array_diff($fd->dependent, $fd->determinant) === []) continue;
            $closure = $this->engine->computeClosure($fd->determinant, $fds);
            if (array_diff($allAttrs, $closure) !== []) {
                $violations[] = $fd;
            }
        }

        if (!empty($violations)) {
            $details = array_map(fn($fd) =>
                '{' . implode(',', $fd->determinant) . '} → {' . implode(',', $fd->dependent) . '}',
                $violations
            );
            return [
                'passed' => false,
                'severity' => 'warning',
                'message' => 'Se encontraron dependencias que violan BCNF',
                'details' => $details,
                'solution' => 'Todo determinante debe ser superclave. Descompón las tablas según las FDs problemáticas.',
            ];
        }

        return [
            'passed' => true,
            'severity' => 'ok',
            'message' => 'Cumple con BCNF.',
        ];
    }

    private function generateExplanations(array $diagnosis): array
    {
        $explanations = [];

        if (in_array('2FN', $diagnosis['violations'])) {
            $explanations[] = [
                'nf' => '2FN',
                'title' => 'Violación de Segunda Forma Normal',
                'explanation' => 'Uno o más atributos no clave dependen solo de una parte de la clave primaria compuesta.',
                'analogy' => 'Es como si en una agenda escolar, el nombre del profesor dependiera solo del código de la materia, no de toda la combinación (alumno, materia).',
                'how_to_fix' => '1. Identifica qué atributo depende parcialmente\n2. Crea una nueva tabla con el determinante como clave\n3. Elimina el atributo de la tabla original',
            ];
        }

        if (in_array('3FN', $diagnosis['violations'])) {
            $explanations[] = [
                'nf' => '3FN',
                'title' => 'Violación de Tercera Forma Normal',
                'explanation' => 'Existe una cadena de dependencias donde un atributo no clave depende de otro atributo no clave.',
                'analogy' => 'Es como si tuvieras el nombre de una ciudad guardado en una tabla de clientes. El nombre de la ciudad depende del código postal, no del cliente.',
                'how_to_fix' => '1. Identifica la cadena A → B → C\n2. Crea una tabla para B y C\n3. En la tabla original, conserva solo B como referencia',
            ];
        }

        if (in_array('BCNF', $diagnosis['violations'])) {
            $explanations[] = [
                'nf' => 'BCNF',
                'title' => 'Violación de Forma Normal de Boyce-Codd',
                'explanation' => 'Existe una dependencia funcional donde el determinante no es una clave candidata.',
                'analogy' => 'Es como si el nombre de un supervisor dependiera del departamento, pero el departamento no es la clave principal de la tabla de empleados.',
                'how_to_fix' => '1. Encuentra la FD problemática\n2. Crea una nueva tabla con el determinante como clave\n3. Ajusta las relaciones',
            ];
        }

        return $explanations;
    }

    private function detectAnomalies(RelationSchema $schema): array
    {
        $anomalies = [];
        $diagnosis = $this->engine->diagnoseNormalization($schema);

        if (!empty($diagnosis['violations'])) {
            $anomalies[] = [
                'type' => 'insertion',
                'title' => 'Anomalía de Inserción',
                'description' => 'No podrás insertar datos si falta parte de la clave primaria. Por ejemplo, no podrías agregar un nuevo producto sin tener un pedido asociado.',
            ];
            $anomalies[] = [
                'type' => 'update',
                'title' => 'Anomalía de Actualización',
                'description' => 'Los datos repetidos deben actualizarse en múltiples filas. Un cambio en el nombre del producto requeriría actualizar todas las filas de detalle_pedido.',
            ];
            $anomalies[] = [
                'type' => 'deletion',
                'title' => 'Anomalía de Eliminación',
                'description' => 'Al eliminar un registro, podrías perder información importante. Por ejemplo, al eliminar el último pedido de un cliente, perderías sus datos.',
            ];
        }

        return $anomalies;
    }

    private function prioritizeRecommendations(array $diagnosis): array
    {
        $priority = [];
        $severityMap = ['1FN' => 'critical', '2FN' => 'high', '3FN' => 'high', 'BCNF' => 'medium', '4FN' => 'low', '5FN' => 'low'];

        foreach ($diagnosis['violations'] as $violation) {
            $priority[] = [
                'violation' => $violation,
                'severity' => $severityMap[$violation] ?? 'medium',
                'order' => array_search($violation, ['1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN']) + 1,
            ];
        }

        usort($priority, fn($a, $b) => $a['order'] - $b['order']);

        return $priority;
    }
}
