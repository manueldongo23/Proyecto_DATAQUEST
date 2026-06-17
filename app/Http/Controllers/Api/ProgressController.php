<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AcademicProgressService;
use Illuminate\Http\Request;

class ProgressController extends Controller
{
    public function __construct(
        private AcademicProgressService $progressService
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $progress = $this->progressService->getProgress($user);

        return response()->json([
            'success' => true,
            'data' => $progress
        ]);
    }

    public function learningPath(Request $request)
    {
        $user = $request->user();
        $path = $this->progressService->getLearningPath($user);

        return response()->json([
            'success' => true,
            'data' => $path
        ]);
    }
}
