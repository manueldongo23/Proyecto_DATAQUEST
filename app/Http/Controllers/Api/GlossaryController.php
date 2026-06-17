<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Domain\Services\GlossaryService;
use Illuminate\Http\Request;

class GlossaryController extends Controller
{
    public function __construct(private GlossaryService $glossary) {}

    public function index(Request $request)
    {
        $locale = $this->getLocale($request);
        $difficulty = $request->input('difficulty');

        if ($difficulty !== null) {
            $terms = $this->glossary->getTermsByDifficulty($difficulty, $locale);
        } else {
            $terms = $this->glossary->getAllTerms($locale);
        }

        return response()->json([
            'success' => true,
            'data' => $terms,
        ]);
    }

    public function show(string $term, Request $request)
    {
        $locale = $this->getLocale($request);
        $definition = $this->glossary->getTerm($term, $locale);

        if ($definition === null) {
            return response()->json([
                'success' => false,
                'message' => "Término '{$term}' no encontrado",
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $definition,
        ]);
    }

    public function search(Request $request)
    {
        $locale = $this->getLocale($request);
        $query = $request->input('q', '');

        if (empty(trim($query))) {
            return response()->json([
                'success' => false,
                'message' => 'Parámetro de búsqueda "q" requerido',
            ], 400);
        }

        $results = $this->glossary->search($query, $locale);

        return response()->json([
            'success' => true,
            'data' => $results,
            'total' => count($results),
        ]);
    }

    public function byDifficulty(string $difficulty, Request $request)
    {
        $locale = $this->getLocale($request);

        $validDifficulties = ['basic', 'intermediate', 'advanced'];

        if (!in_array($difficulty, $validDifficulties)) {
            return response()->json([
                'success' => false,
                'message' => "Dificultad inválida. Usa: " . implode(', ', $validDifficulties),
            ], 400);
        }

        $terms = $this->glossary->getTermsByDifficulty($difficulty, $locale);

        return response()->json([
            'success' => true,
            'data' => $terms,
            'difficulty' => $difficulty,
        ]);
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
