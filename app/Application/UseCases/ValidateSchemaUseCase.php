<?php
namespace App\Application\UseCases;

use App\Domain\Services\NormalizationEngine;
use App\Domain\Entities\RelationSchema;

class ValidateSchemaUseCase
{
    public function __construct(private NormalizationEngine $engine) {}

    public function execute(RelationSchema $schema): array
    {
        $diagnosis = $this->engine->diagnoseNormalization($schema);
        $candidateKeys = $this->engine->findCandidateKeys($schema);
        $canonicalCover = $this->engine->computeCanonicalCover($schema->getFds());
        $synthesis3NF = $this->engine->synthesizeTo3NF($schema->getFds());
        
        return [
            'schema_name' => $schema->name,
            'candidate_keys' => $candidateKeys,
            'diagnosis' => $diagnosis,
            'canonical_cover' => array_map(fn($fd) => $fd->toArray(), $canonicalCover),
            'synthesis_3nf' => $synthesis3NF,
            'is_fully_normalized' => $diagnosis['current_nf'] === '5NF',
            'message' => $this->generatePedagogicalMessage($diagnosis, $synthesis3NF)
        ];
    }

    private function generatePedagogicalMessage(array $diagnosis, array $synthesis = []): string
    {
        $currentNf = $diagnosis['current_nf'];
        if (in_array($currentNf, ['4NF', '5NF'])) {
            return "¡Excelente! Tu esquema cumple con {$currentNf}, el más alto nivel de normalización. Tus datos están protegidos contra anomalías de inserción, actualización y eliminación.";
        }
        if ($currentNf === 'BCNF') {
            return "Tu esquema alcanza BCNF. Revisa dependencias multivaluadas para alcanzar formas normales superiores.";
        }
        
        $lastViolation = end($diagnosis['violations']);
        $messages = [
            '2FN' => "Tu esquema tiene dependencias parciales. Recuerda: cada atributo no clave debe depender de TODA la clave primaria, no solo de una parte.",
            '3FN' => "Hay dependencias transitivas. Los atributos no clave no deberían depender de otros atributos no clave.",
            'BCNF' => "Alguna dependencia funcional tiene un determinante que no es superclave. Revisa las sugerencias para descomponer.",
            '4FN' => "Hay dependencias multivaluadas. Atributos independientes deben estar en tablas separadas.",
            '5FN' => "Hay dependencias de unión. La tabla podría descomponerse sin pérdida."
        ];
        
        $msg = $messages[$lastViolation] ?? "Revisa las violaciones detectadas y aplica las sugerencias de normalización.";

        if (!empty($synthesis)) {
            $tableCount = count($synthesis);
            $msg .= " Se ha generado una síntesis 3NF con {$tableCount} tabla(s).";
        }

        return $msg;
    }
}
