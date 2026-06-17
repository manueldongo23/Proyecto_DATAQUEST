<?php
// Mostrar errores para depurar
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error.log');

session_start();

// Variables globales
$dbConnected = false;
$dbError = null;

// Intentar cargar la base de datos
try {
    require_once __DIR__ . '/config/database.php';
    // Probar la conexión
    Database::getConnection();
    $dbConnected = true;
} catch (Exception $e) {
    $dbError = $e->getMessage();
}

// Si la BD está conectada, cargar el resto de archivos
if ($dbConnected) {
    require_once __DIR__ . '/backend/app/Core/NormalizationEngine.php';
    require_once __DIR__ . '/backend/app/Core/SchemaParser.php';
    require_once __DIR__ . '/backend/app/Models/User.php';
    require_once __DIR__ . '/backend/app/Models/LogSistema.php';
    require_once __DIR__ . '/backend/app/Http/Controllers/AuthController.php';
    require_once __DIR__ . '/backend/app/Http/Controllers/ValidationController.php';
    require_once __DIR__ . '/backend/app/Http/Controllers/PuzzlesController.php';
    require_once __DIR__ . '/backend/app/Http/Controllers/RetosController.php';
    require_once __DIR__ . '/backend/app/Http/Controllers/AdminController.php';
}

$requestUri = $_SERVER['REQUEST_URI'];
$scriptName = $_SERVER['SCRIPT_NAME'];
$basePath = rtrim(dirname($scriptName), '/');
$apiPath = str_replace($basePath, '', $requestUri);
$apiPath = parse_url($apiPath, PHP_URL_PATH);
$apiPath = str_replace('/index.php', '', $apiPath);

// API routes (solo si la BD está conectada)
if (strpos($apiPath, '/api/') === 0 && $dbConnected) {
    header('Content-Type: application/json');
    $endpoint = substr($apiPath, 5);
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    
    require_once __DIR__ . '/backend/routes/api.php';
    $router->dispatch($endpoint, $method, $input);
    exit;
} elseif (strpos($apiPath, '/api/') === 0 && !$dbConnected) {
    header('Content-Type: application/json');
    http_response_code(503);
    echo json_encode(['error' => 'Base de datos no configurada', 'message' => $dbError]);
    exit;
}

// Si no es API, servir el frontend
$frontendFile = __DIR__ . '/frontend/index.html';
if (file_exists($frontendFile)) {
    header('Content-Type: text/html; charset=utf-8');
    $html = file_get_contents($frontendFile);
    
    // Inyectar variable global si hay error de BD
    if (!$dbConnected) {
        $html = str_replace(
            '</head>',
            '<script>window.DB_ERROR = ' . json_encode(['error' => $dbError]) . ';</script></head>',
            $html
        );
    }
    
    echo $html;
} else {
    http_response_code(404);
    die("No se encuentra frontend/index.html. Revisa la estructura de carpetas.");
}