<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Credenciales de base de datos
$host = 'localhost';
$dbname = 'dataquest';
$user = 'root';
$pass = '';

$setupComplete = false;
$message = '';

if ($_POST['action'] === 'setup') {
    try {
        // Conectar a MySQL sin seleccionar una BD específica
        $pdo = new PDO("mysql:host=$host;charset=utf8", $user, $pass);
        
        // Leer el archivo setup.sql
        $setupSQL = file_get_contents(__DIR__ . '/setup.sql');
        
        // Ejecutar cada sentencia
        foreach (explode(';', $setupSQL) as $statement) {
            $statement = trim($statement);
            if (!empty($statement)) {
                $pdo->exec($statement);
            }
        }
        
        $setupComplete = true;
        $message = '✓ Base de datos creada exitosamente';
    } catch (PDOException $e) {
        $message = '✗ Error: ' . $e->getMessage();
    }
}

// Verificar si la base de datos ya existe
try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $user, $pass);
    $setupComplete = true;
    $alreadySetup = true;
} catch (PDOException $e) {
    $alreadySetup = false;
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DataQuest - Setup</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-indigo-600 mb-2">DataQuest</h1>
            <p class="text-gray-600">Configuración Inicial</p>
        </div>

        <?php if ($alreadySetup && isset($_POST['action']) && $_POST['action'] === 'setup'): ?>
            <div class="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">
                <p class="font-semibold">✓ <?php echo $message; ?></p>
            </div>
            <div class="text-center">
                <a href="/dataquest-project/" class="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
                    Ir al Proyecto
                </a>
            </div>
        <?php elseif (isset($_POST['action']) && $_POST['action'] === 'setup' && !$setupComplete): ?>
            <div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                <p class="font-semibold"><?php echo $message; ?></p>
            </div>
        <?php else: ?>
            <div class="mb-6">
                <p class="text-gray-700 mb-4">
                    <?php if ($alreadySetup): ?>
                        <span class="text-green-600 font-semibold">✓</span> La base de datos ya está configurada.
                        <br><br>
                        <a href="/dataquest-project/" class="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
                            Acceder al Proyecto
                        </a>
                    <?php else: ?>
                        Se va a crear la base de datos "dataquest" con las tablas necesarias.
                        <br><br>
                        <form method="POST" class="mt-6">
                            <input type="hidden" name="action" value="setup">
                            <button type="submit" class="w-full bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition font-semibold">
                                Crear Base de Datos
                            </button>
                        </form>
                    <?php endif; ?>
                </p>
            </div>
        <?php endif; ?>

        <div class="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
            <p><strong>Credenciales:</strong></p>
            <p>Host: <?php echo $host; ?></p>
            <p>Usuario: <?php echo $user; ?></p>
            <p>Base de datos: <?php echo $dbname; ?></p>
        </div>
    </div>
</body>
</html>
