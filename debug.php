<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<pre style='font-family: monospace; padding: 20px; background: #f5f5f5;'>";

echo "=== DIAGNÓSTICO DE DATAQUEST ===\n\n";

// 1. Verificar archivos
echo "1. VERIFICACIÓN DE ARCHIVOS:\n";
$files = [
    'config/database.php',
    'frontend/index.html',
    'frontend/js/api.js',
    'frontend/js/auth.js',
    'frontend/js/app.js',
    'backend/app/Core/NormalizationEngine.php',
    'backend/app/Models/User.php',
    'backend/routes/api.php'
];

foreach ($files as $file) {
    $path = __DIR__ . '/' . $file;
    $exists = file_exists($path) ? '✓' : '✗';
    echo "  $exists $file\n";
}

// 2. Verificar PHP
echo "\n2. INFORMACIÓN DE PHP:\n";
echo "  Versión: " . phpversion() . "\n";
echo "  Sistema operativo: " . php_uname() . "\n";

// 3. Verificar extensiones
echo "\n3. EXTENSIONES NECESARIAS:\n";
$extensions = ['pdo', 'pdo_mysql', 'json'];
foreach ($extensions as $ext) {
    $loaded = extension_loaded($ext) ? '✓' : '✗';
    echo "  $loaded $ext\n";
}

// 4. Verificar base de datos
echo "\n4. CONEXIÓN A BASE DE DATOS:\n";
$host = 'localhost';
$dbname = 'dataquest';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;charset=utf8", $user, $pass);
    echo "  ✓ MySQL conectado\n";
    
    // Intentar seleccionar la BD
    try {
        $pdo2 = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $user, $pass);
        echo "  ✓ Base de datos '$dbname' existe\n";
        
        // Verificar tablas
        $result = $pdo2->query("SHOW TABLES");
        $tables = $result->fetchAll(PDO::FETCH_COLUMN);
        echo "  ✓ Tablas encontradas: " . count($tables) . "\n";
        foreach ($tables as $table) {
            echo "    - $table\n";
        }
    } catch (PDOException $e) {
        echo "  ✗ Base de datos '$dbname' NO existe\n";
        echo "    Acción: Ir a http://localhost/dataquest-project/setup.php\n";
    }
} catch (PDOException $e) {
    echo "  ✗ MySQL no conectado: " . $e->getMessage() . "\n";
}

// 5. Verificar permisos
echo "\n5. PERMISOS DE CARPETAS:\n";
$dirs = ['frontend', 'backend', 'storage'];
foreach ($dirs as $dir) {
    $path = __DIR__ . '/' . $dir;
    $readable = is_readable($path) ? '✓' : '✗';
    $writable = is_writable($path) ? '✓' : '✗';
    echo "  Lectura: $readable | Escritura: $writable | $dir\n";
}

// 6. Cargar el index.php normalmente para ver si hay errores
echo "\n6. INTENTO DE CARGAR index.php:\n";
ob_start();
try {
    require_once __DIR__ . '/config/database.php';
    echo "  ✓ config/database.php cargado\n";
} catch (Exception $e) {
    echo "  ✗ Error en config/database.php: " . $e->getMessage() . "\n";
}
ob_end_clean();

echo "\n=== FIN DEL DIAGNÓSTICO ===\n";
echo "</pre>";
