<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$users = [
    [
        'correo' => 'admin@dataquest.com',
        'apodo' => 'AdminMaster',
        'password' => 'password123',
        'role' => 'administrador',
        'medallas' => ['fundador', 'maestro_normalizador'],
        'xp' => 5000,
        'rango' => 'Gran Maestro'
    ],
    [
        'correo' => 'juan.perez@example.com',
        'apodo' => 'JuanitoDB',
        'password' => 'password123',
        'role' => 'usuario',
        'medallas' => ['primera_conexion', 'nivel_1'],
        'xp' => 450,
        'rango' => 'Normalizador Novato'
    ],
    [
        'correo' => 'maria.gomez@example.com',
        'apodo' => 'MariaQuery',
        'password' => 'password123',
        'role' => 'usuario',
        'medallas' => ['experta_1nf', 'velocista'],
        'xp' => 1200,
        'rango' => 'Normalizador Junior'
    ]
];

foreach ($users as $u) {
    User::updateOrCreate(
        ['correo' => $u['correo']],
        [
            'apodo' => $u['apodo'],
            'password_hash' => Hash::make($u['password']),
            'role' => $u['role'],
            'medallas' => $u['medallas'],
            'xp' => $u['xp'],
            'rango' => $u['rango'],
            'activo' => true
        ]
    );
    echo "User created: " . $u['apodo'] . "\n";
}
