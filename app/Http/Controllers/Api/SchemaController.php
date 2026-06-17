<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Esquema;
use App\Models\Validacion;
use App\Services\ActivityRecorder;
use Illuminate\Http\Request;

class SchemaController extends Controller
{
    public function __construct(
        private ActivityRecorder $activityRecorder
    ) {}

    public function index(Request $request)
    {
        $schemas = Esquema::where('user_id', $request->user()->id)
            ->with(['validaciones' => function ($query) {
                $query->orderBy('version_number')->orderBy('fecha');
            }])
            ->orderBy('fecha_creacion', 'desc')
            ->get()
            ->map(fn (Esquema $esquema) => $this->summarizeSchema($esquema));

        return response()->json(['success' => true, 'data' => $schemas]);
    }

    public function show(Request $request, int $id)
    {
        $esquema = Esquema::where('user_id', $request->user()->id)
            ->with(['validaciones' => function ($query) {
                $query->orderBy('version_number')->orderBy('fecha');
            }])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $this->formatSchemaDetail($esquema),
        ]);
    }

    public function open(Request $request, int $id)
    {
        $esquema = Esquema::where('user_id', $request->user()->id)->findOrFail($id);

        $this->activityRecorder->record(
            $request->user()?->id,
            'proyecto',
            sprintf(
                'Proyecto abierto. Módulo: Proyectos. Destino: Normalizer Engine. Proyecto: %s. schema_id: %d.',
                $esquema->nombre,
                $esquema->id
            )
        );

        return response()->json([
            'success' => true,
            'message' => 'Proyecto abierto',
            'data' => [
                'id' => $esquema->id,
                'nombre' => $esquema->nombre,
            ],
        ]);
    }

    public function versions(Request $request, int $id)
    {
        $esquema = Esquema::where('user_id', $request->user()->id)
            ->with(['validaciones' => function ($query) {
                $query->orderByDesc('version_number')->orderByDesc('fecha');
            }])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $esquema->validaciones->values()->map(
                fn (Validacion $validation, int $index) => $this->formatValidation($validation, $index + 1)
            ),
        ]);
    }

    public function restoreVersion(Request $request, int $id, int $validationId)
    {
        $esquema = Esquema::where('user_id', $request->user()->id)
            ->with(['validaciones' => function ($query) {
                $query->orderBy('version_number')->orderBy('fecha');
            }])
            ->findOrFail($id);

        $validation = $esquema->validaciones->firstWhere('id', $validationId);

        abort_if(!$validation, 404, 'Versión no encontrada');

        $snapshot = is_array($validation->snapshot_json) ? $validation->snapshot_json : [];
        $schemaSnapshot = $snapshot['schema'] ?? [];

        $esquema->fill([
            'nombre' => $schemaSnapshot['table_name'] ?? $esquema->nombre,
            'descripcion' => $schemaSnapshot['description'] ?? $esquema->descripcion,
            'estructura_json' => $schemaSnapshot['attributes'] ?? $esquema->estructura_json,
            'dependencias_json' => $schemaSnapshot['dependencies'] ?? $esquema->dependencias_json,
        ]);
        $esquema->save();

        $this->activityRecorder->record(
            $request->user()?->id,
            'proyecto',
            sprintf(
                'Restauró la versión %s del proyecto "%s".',
                $validation->version_label ?? $validation->nivel_normalizacion ?? 'v',
                $esquema->nombre
            )
        );

        return response()->json([
            'success' => true,
            'message' => 'Versión restaurada',
            'data' => $this->formatSchemaDetail($esquema->fresh(['validaciones' => function ($query) {
                $query->orderBy('version_number')->orderBy('fecha');
            }])),
        ]);
    }

    public function update(Request $request, int $id)
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:100',
            'descripcion' => 'nullable|string|max:500',
            'estructura_json' => 'sometimes|array|max:100',
            'dependencias_json' => 'sometimes|array|max:200',
        ]);

        $esquema = Esquema::where('user_id', $request->user()->id)->findOrFail($id);
        $esquema->fill($validated);
        $esquema->save();

        $this->activityRecorder->record(
            $request->user()?->id,
            'proyecto',
            sprintf('Actualizó el proyecto "%s".', $esquema->nombre)
        );

        return response()->json([
            'success' => true,
            'message' => 'Esquema actualizado',
            'data' => $this->formatSchemaDetail($esquema->fresh(['validaciones' => function ($query) {
                $query->orderBy('version_number')->orderBy('fecha');
            }])),
        ]);
    }

    public function archive(int $id, Request $request)
    {
        $esquema = Esquema::where('user_id', $request->user()->id)->findOrFail($id);
        $esquema->archived_at = now();
        $esquema->save();

        $this->activityRecorder->record(
            $request->user()?->id,
            'proyecto',
            sprintf('Archivó el proyecto "%s".', $esquema->nombre)
        );

        return response()->json([
            'success' => true,
            'message' => 'Esquema archivado',
            'data' => $esquema->fresh(),
        ]);
    }

    public function restore(int $id, Request $request)
    {
        $esquema = Esquema::where('user_id', $request->user()->id)->findOrFail($id);
        $esquema->archived_at = null;
        $esquema->save();

        $this->activityRecorder->record(
            $request->user()?->id,
            'proyecto',
            sprintf('Restauró el proyecto "%s".', $esquema->nombre)
        );

        return response()->json([
            'success' => true,
            'message' => 'Esquema restaurado',
            'data' => $esquema->fresh(),
        ]);
    }

    public function destroy(int $id, Request $request)
    {
        $esquema = Esquema::where('user_id', $request->user()->id)->findOrFail($id);
        $this->activityRecorder->record(
            $request->user()?->id,
            'proyecto',
            sprintf('Eliminó el proyecto "%s".', $esquema->nombre)
        );
        $esquema->delete();

        return response()->json(['success' => true, 'message' => 'Esquema eliminado']);
    }

    private function summarizeSchema(Esquema $esquema): array
    {
        $latestValidation = $esquema->validaciones->last();

        return [
            'id' => $esquema->id,
            'nombre' => $esquema->nombre,
            'descripcion' => $esquema->descripcion,
            'fecha_creacion' => $esquema->fecha_creacion,
            'archived_at' => $esquema->archived_at,
            'validaciones_count' => $esquema->validaciones->count(),
            'last_activity_at' => $latestValidation?->fecha ?? $esquema->fecha_creacion,
            'ultima_validacion' => $latestValidation?->nivel_normalizacion,
            'ultima_version' => $latestValidation?->version_label,
        ];
    }

    private function formatSchemaDetail(Esquema $esquema): array
    {
        return [
            'id' => $esquema->id,
            'user_id' => $esquema->user_id,
            'nombre' => $esquema->nombre,
            'descripcion' => $esquema->descripcion,
            'estructura_json' => $esquema->estructura_json ?? [],
            'dependencias_json' => $esquema->dependencias_json ?? [],
            'fecha_creacion' => $esquema->fecha_creacion,
            'archived_at' => $esquema->archived_at,
            'validaciones' => $esquema->validaciones
                ->values()
                ->map(fn (Validacion $validation, int $index) => $this->formatValidation($validation, $index + 1))
                ->all(),
        ];
    }

    private function formatValidation(Validacion $validation, int $fallbackVersion = 1): array
    {
        $snapshot = is_array($validation->snapshot_json) ? $validation->snapshot_json : [];

        return [
            'id' => $validation->id,
            'esquema_id' => $validation->esquema_id,
            'version_number' => $validation->version_number ?? $fallbackVersion,
            'version_label' => $validation->version_label ?? ('v' . $fallbackVersion),
            'estado' => $validation->estado ?? null,
            'target_nf' => $validation->target_nf ?? $validation->nivel_normalizacion,
            'engine' => $validation->engine ?? null,
            'mode' => $validation->mode ?? null,
            'nivel_normalizacion' => $validation->nivel_normalizacion,
            'violaciones_json' => $validation->violaciones_json ?? [],
            'analysis_json' => $validation->analysis_json ?? null,
            'decomposition_json' => $validation->decomposition_json ?? null,
            'snapshot_json' => $snapshot,
            'changes_json' => $validation->changes_json ?? null,
            'sql_generado' => $validation->sql_generado ?? null,
            'fecha' => $validation->fecha,
        ];
    }
}
