<?php

use App\Http\Controllers\Api\NormalizationController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\SchemaController;
use App\Http\Controllers\Api\ActivityController;
use App\Http\Controllers\Api\AcademyController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\DidacticValidatorController;
use App\Http\Controllers\Api\ProgressController;
use App\Http\Controllers\Api\QuestController;
use App\Http\Controllers\Api\AchievementController;
use App\Http\Controllers\Api\GlossaryController;
use App\Http\Controllers\Api\SandboxController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Future versioning strategy: when a breaking change is needed, wrap all
| routes in Route::prefix('v1')->group(...) and create a new routes/api-v2.php
| for the next version. The frontend base URL can then be switched to
| /api/v1 or /api/v2 as needed. For now, all routes are unversioned.
|
*/

// ============================================
// Validación Didáctica
// ============================================
Route::post('/didactic-validate', [DidacticValidatorController::class, 'validate']);
Route::post('/quick-analyze', [DidacticValidatorController::class, 'quickAnalyze']);

// ============================================
// Autenticación
// ============================================
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/forgot-password', [PasswordResetController::class, 'forgotPassword']);
Route::post('/auth/reset-password', [PasswordResetController::class, 'resetPassword']);

// CSRF cookie endpoint for SPA authentication
Route::get('/csrf-cookie', function () {
    return response('', 204);
})->middleware('web');

// ============================================
// Normalización - Motor Principal (Público)
// ============================================
Route::post('/validate-schema', [NormalizationController::class, 'validateSchema']);
Route::post('/export-validation', [NormalizationController::class, 'exportValidation']);

// ============================================
// Import CSV
// ============================================
Route::post('/import/csv', [NormalizationController::class, 'importCsv']);
Route::post('/import/csv-and-validate', [NormalizationController::class, 'importCsvAndValidate']);

// Database import endpoints
Route::post('/import/database', [NormalizationController::class, 'importFromDatabase']);
Route::post('/import/database/test', [NormalizationController::class, 'testDatabaseConnection']);
Route::get('/import/app-database', [NormalizationController::class, 'importFromAppDatabase']);

// DDL Parser endpoints
Route::post('/parse/ddl', [NormalizationController::class, 'parseDdl']);
Route::post('/parse/ddl/advanced', [NormalizationController::class, 'parseDdlAdvanced']);

// Educational endpoints - Step-by-step explanations
Route::post('/explain/closure', [NormalizationController::class, 'explainClosure']);
Route::post('/explain/candidate-keys', [NormalizationController::class, 'explainCandidateKeys']);
Route::post('/explain/decomposition', [NormalizationController::class, 'explainDecomposition']);

// ============================================
// Sandbox — Offline-first normalization playground
// ============================================
Route::prefix('sandbox')->group(function () {
    Route::post('/analyze', [SandboxController::class, 'analyze']);
    Route::post('/parse-ddl', [SandboxController::class, 'parseDdl']);
    Route::post('/import-csv', [SandboxController::class, 'importCsv']);
    Route::get('/exercise', [SandboxController::class, 'exercise']);
    Route::get('/glossary/{term}', [SandboxController::class, 'glossary']);
});

// ============================================
// Healthcheck
// ============================================
Route::get('/health', [HealthController::class, 'index']);

// ============================================
// Academy - Explicaciones, ejercicios y descomposición
// ============================================
Route::prefix('academy')->group(function () {
    Route::get('/', [AcademyController::class, 'index']);
    Route::get('/explain/{nf}', [AcademyController::class, 'explain']);
    Route::get('/exercise', [AcademyController::class, 'exercise']);
    Route::post('/evaluate', [AcademyController::class, 'evaluate']);
    Route::post('/decompose', [AcademyController::class, 'decompose']);
    Route::post('/validate-up-to', [AcademyController::class, 'validateUpTo']);
});

// ============================================
// Reportes - Generar reporte de normalización
// ============================================
Route::post('/report/generate', [ReportController::class, 'generate']);

// ============================================
// Export - DBML, Mermaid, HTML, y exportación completa
// ============================================
Route::post('/export/dbml', [ExportController::class, 'exportDbml']);
Route::post('/export/mermaid', [ExportController::class, 'exportMermaid']);
Route::post('/export/html', [ExportController::class, 'exportHtml']);
Route::post('/export/all', [ExportController::class, 'exportAll']);

// ============================================
// Glosario de Términos
// ============================================
Route::get('/glossary', [GlossaryController::class, 'index']);
Route::get('/glossary/search', [GlossaryController::class, 'search']);
Route::get('/glossary/difficulty/{difficulty}', [GlossaryController::class, 'byDifficulty']);
Route::get('/glossary/{term}', [GlossaryController::class, 'show']);

// ============================================
// Rutas Protegidas (usan Sanctum auth)
// ============================================
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::get('/analytics/mastery/{userId}', [AnalyticsController::class, 'getUserMastery']);
    Route::get('/analytics/history/{userId}', [AnalyticsController::class, 'validationHistory']);
    Route::get('/analytics/mastery-timeline/{userId}', [AnalyticsController::class, 'masteryTimeline']);
    Route::get('/analytics/concept-breakdown/{userId}', [AnalyticsController::class, 'conceptBreakdown']);
    Route::get('/analytics/learning-velocity/{userId}', [AnalyticsController::class, 'learningVelocity']);
    Route::get('/analytics/error-patterns/{userId}', [AnalyticsController::class, 'errorPatterns']);
    Route::get('/analytics/recommendations/{userId}', [AnalyticsController::class, 'recommendations']);
    Route::get('/analytics/session-analytics/{userId}', [AnalyticsController::class, 'sessionAnalytics']);
    Route::get('/analytics/peer-comparison/{userId}', [AnalyticsController::class, 'peerComparison']);

    Route::middleware('admin')->group(function () {
        Route::get('/analytics/cohort-stats', [AnalyticsController::class, 'cohortStats']);
    });

    Route::get('/schemas', [SchemaController::class, 'index']);
    Route::get('/schemas/{id}', [SchemaController::class, 'show']);
    Route::post('/schemas/{id}/open', [SchemaController::class, 'open']);
    Route::get('/schemas/{id}/versions', [SchemaController::class, 'versions']);
    Route::post('/schemas/{id}/versions/{validationId}/restore', [SchemaController::class, 'restoreVersion']);
    Route::patch('/schemas/{id}', [SchemaController::class, 'update']);
    Route::patch('/schemas/{id}/archive', [SchemaController::class, 'archive']);
    Route::patch('/schemas/{id}/restore', [SchemaController::class, 'restore']);
    Route::delete('/schemas/{id}', [SchemaController::class, 'destroy']);
    Route::get('/activity', [ActivityController::class, 'index']);

    Route::get('/progress', [ProgressController::class, 'index']);
    Route::get('/progress/learning-path', [ProgressController::class, 'learningPath']);

    Route::get('/quests', [QuestController::class, 'index']);
    Route::get('/quests/{id}', [QuestController::class, 'show']);
    Route::post('/quests/{id}/start', [QuestController::class, 'start']);
    Route::post('/quests/{id}/submit', [QuestController::class, 'submit']);
    Route::get('/leaderboard', [QuestController::class, 'leaderboard']);

    Route::get('/achievements', [AchievementController::class, 'index']);
    Route::get('/achievements/user/{userId}', [AchievementController::class, 'userAchievements']);

    Route::middleware('admin')->prefix('admin')->group(function () {
        Route::get('/dashboard', [AdminController::class, 'dashboard']);
        Route::get('/users', [AdminController::class, 'listUsers']);
        Route::post('/users/{id}/toggle', [AdminController::class, 'toggleUser']);
        Route::get('/blocked-terms', [AdminController::class, 'listBlockedTerms']);
        Route::post('/blocked-terms', [AdminController::class, 'addBlockedTerm']);
        Route::delete('/blocked-terms/{id}', [AdminController::class, 'removeBlockedTerm']);
    });
});
