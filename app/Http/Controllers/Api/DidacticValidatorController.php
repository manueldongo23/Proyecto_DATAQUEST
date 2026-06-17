<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;
use App\Services\DidacticValidatorService;
use Illuminate\Http\Request;

class DidacticValidatorController extends Controller
{
    public function __construct(
        private DidacticValidatorService $validatorService
    ) {}

    public function validate(Request $request)
    {
        $request->validate([
            'table_name' => 'required|string|max:100',
            'attributes' => 'required|array|min:1|max:100',
            'dependencies' => 'required|array|max:200',
        ]);

        try {
            $fds = array_map(
                fn($dep) => new FunctionalDependency($dep['determinant'], $dep['dependent']),
                $request->dependencies
            );

            $schema = new RelationSchema(
                $request->table_name,
                $request->input('attributes'),
                $fds
            );

            $result = $this->validatorService->validateWithFeedback($schema);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al validar el esquema'
            ], 422);
        }
    }

    public function quickAnalyze(Request $request)
    {
        $request->validate([
            'table_name' => 'required|string|max:100',
            'attributes' => 'required|array|min:1|max:100',
        ]);

        try {
            $schema = new RelationSchema(
                $request->table_name,
                $request->input('attributes'),
                []
            );

            $result = $this->validatorService->validateWithFeedback($schema);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al analizar la tabla'
            ], 422);
        }
    }
}
