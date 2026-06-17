<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Esquema;
use App\Models\Log as SystemLog;
use Illuminate\Http\Request;

class ActivityController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $limit = max(20, min(100, (int) $request->query('limit', 50)));

        $schemaEvents = Esquema::where('user_id', $user->id)
            ->with(['validaciones' => function ($query) {
                $query->orderByDesc('fecha');
            }])
            ->orderByDesc('fecha_creacion')
            ->take($limit)
            ->get()
            ->flatMap(function ($schema) {
                return $schema->validaciones->map(function ($validation) use ($schema) {
                    $violations = is_array($validation->violaciones_json ?? null) ? count($validation->violaciones_json) : 0;

                    return [
                        'id' => sprintf('validation-%d', $validation->id),
                        'type' => 'validation',
                        'title' => $schema->nombre,
                        'detail' => sprintf(
                            'Validación %s con %d hallazgos',
                            $validation->nivel_normalizacion,
                            $violations
                        ),
                        'date' => $validation->fecha,
                        'meta' => [
                            'schema_id' => $schema->id,
                            'level' => $validation->nivel_normalizacion,
                            'violations' => $violations,
                            'description' => $schema->descripcion,
                        ],
                    ];
                });
            });

        $logEvents = SystemLog::where('user_id', $user->id)
            ->orderByDesc('fecha')
            ->take($limit)
            ->get()
            ->map(function ($log) {
                $activityType = $this->activityTypeForLog($log);

                return [
                    'id' => sprintf('log-%d', $log->id),
                    'type' => $activityType,
                    'title' => $this->titleForLogType($activityType),
                    'detail' => $this->detailForLog($log->mensaje),
                    'date' => $log->fecha,
                    'meta' => $this->metaForLog($log),
                ];
            });

        $timeline = $schemaEvents
            ->concat($logEvents)
            ->sortByDesc(fn (array $event) => $this->timestampForEvent($event['date'] ?? null))
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => [
                    'total_events' => $timeline->count(),
                    'validation_events' => $schemaEvents->count(),
                    'log_events' => $logEvents->count(),
                    'latest_activity_at' => $timeline->first()['date'] ?? null,
                ],
                'timeline' => $timeline,
            ],
        ]);
    }

    private function titleForLogType(string $type): string
    {
        return match ($type) {
            'proyecto' => 'Proyecto',
            'validacion' => 'Validación',
            'reto' => 'Reto',
            'reporte' => 'Reporte',
            'perfil' => 'Perfil',
            'academia' => 'Academia',
            default => ucfirst($type),
        };
    }

    private function activityTypeForLog(SystemLog $log): string
    {
        if ($log->tipo !== 'evento') {
            return $log->tipo;
        }

        if (preg_match('/^\[([a-z_]+)\]\s*/i', $log->mensaje, $typeMatch)) {
            return strtolower($typeMatch[1]);
        }

        return $log->tipo;
    }

    private function detailForLog(string $message): string
    {
        return preg_replace('/^\[[a-z_]+\]\s*/i', '', $message) ?: $message;
    }

    private function metaForLog(SystemLog $log): array
    {
        $meta = [
            'log_type' => $log->tipo,
        ];

        $message = $this->detailForLog($log->mensaje);

        if (preg_match('/schema_id:\s*(\d+)/i', $message, $schemaIdMatch)) {
            $meta['schema_id'] = (int) $schemaIdMatch[1];
        }

        if (preg_match('/Módulo:\s*([^\.]+)\./u', $message, $moduleMatch)) {
            $meta['module'] = trim($moduleMatch[1]);
        }

        if (preg_match('/Destino:\s*([^\.]+)\./u', $message, $destinationMatch)) {
            $meta['destination'] = trim($destinationMatch[1]);
        }

        return $meta;
    }

    private function timestampForEvent(mixed $value): int
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->getTimestamp();
        }

        $timestamp = strtotime((string) $value);
        return $timestamp !== false ? $timestamp : 0;
    }
}
