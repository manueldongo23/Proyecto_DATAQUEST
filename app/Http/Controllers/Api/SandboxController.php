<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Domain\Services\SandboxService;
use Illuminate\Http\Request;

class SandboxController extends Controller
{
    public function __construct(private SandboxService $sandbox) {}

    public function analyze(Request $request)
    {
        $validated = $request->validate([
            'table_name' => 'required|string|max:100',
            'attributes' => 'required|array|min:1|max:100',
            'dependencies' => 'required|array|max:200',
        ]);

        try {
            $result = $this->sandbox->analyze($validated);
            return response()->json(['success' => true, 'data' => $result]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function parseDdl(Request $request)
    {
        $validated = $request->validate(['sql' => 'required|string']);

        try {
            $result = $this->sandbox->parseDdl($validated['sql']);
            return response()->json(['success' => true, 'data' => $result]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function importCsv(Request $request)
    {
        $validated = $request->validate([
            'csv' => 'required|string',
            'table_name' => 'sometimes|string|max:100',
        ]);

        try {
            $result = $this->sandbox->importCsv($validated['csv'], $validated['table_name'] ?? null);
            return response()->json(['success' => true, 'data' => $result]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function glossary(string $term, Request $request)
    {
        $locale = $this->getLocale($request);

        try {
            $result = $this->sandbox->glossary($term, $locale);

            if ($result === null) {
                return response()->json([
                    'success' => false,
                    'message' => "Término '{$term}' no encontrado",
                ], 404);
            }

            return response()->json(['success' => true, 'data' => $result]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    public function exercise(Request $request)
    {
        $validated = $request->validate(['nf' => 'required|string|in:1FN,2FN,3FN,BCNF,4FN,5FN']);

        try {
            $result = $this->sandbox->generateExercise($validated['nf']);
            return response()->json(['success' => true, 'data' => $result]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    private function getLocale(Request $request): string
    {
        if ($request->hasHeader('X-Locale')) {
            return $request->header('X-Locale');
        }

        $acceptLanguage = $request->header('Accept-Language');

        if ($acceptLanguage) {
            $locales = explode(',', $acceptLanguage);
            $primary = trim(explode(';', $locales[0])[0]);
            return $primary;
        }

        return 'es';
    }
}
