<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$puzzles = [
    [
        'enunciado' => 'Normaliza la tabla Estudiante que tiene redundancias en la ciudad.',
        'tablas_inicial' => json_encode(['Estudiante']),
        'df_inicial' => json_encode([
            ['determinant' => ['id_est'], 'dependent' => ['nombre', 'ciudad']],
            ['determinant' => ['ciudad'], 'dependent' => ['clima']]
        ]),
        'solucion_esperada' => json_encode(['current_nf' => 'BCNF']),
        'nivel_dificultad' => 1
    ],
    [
        'enunciado' => 'Resuelve las dependencias parciales en la tabla Pedidos.',
        'tablas_inicial' => json_encode(['Pedidos']),
        'df_inicial' => json_encode([
            ['determinant' => ['id_pedido', 'id_producto'], 'dependent' => ['cantidad', 'nombre_producto']],
            ['determinant' => ['id_producto'], 'dependent' => ['nombre_producto']]
        ]),
        'solucion_esperada' => json_encode(['current_nf' => '2NF']),
        'nivel_dificultad' => 2
    ]
];

foreach ($puzzles as $p) {
    DB::table('puzzles')->insert($p);
}

DB::table('retos_semanales')->insert([
    'descripcion' => 'Gran Reto de Normalización: De 1NF a BCNF en un solo paso.',
    'tablas' => json_encode(['GlobalTable']),
    'df' => json_encode([
        ['determinant' => ['A'], 'dependent' => ['B', 'C']],
        ['determinant' => ['B'], 'dependent' => ['D']]
    ]),
    'fecha_inicio' => now()->startOfWeek(),
    'fecha_fin' => now()->endOfWeek(),
    'activo' => true
]);

echo "Puzzles and Retos created in MySQL!\n";
