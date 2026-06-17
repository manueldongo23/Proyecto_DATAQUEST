<?php
$router = new class {
    private $routes = [];
    public function post($endpoint, $callback) { $this->routes['POST'][$endpoint] = $callback; }
    public function get($endpoint, $callback) { $this->routes['GET'][$endpoint] = $callback; }
    public function dispatch($endpoint, $method, $data) {
        $endpoint = '/' . ltrim($endpoint, '/');
        if (isset($this->routes[$method][$endpoint])) {
            echo json_encode(call_user_func($this->routes[$method][$endpoint], $data));
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint no encontrado: ' . $endpoint]);
        }
    }
};

$auth = new AuthController();
$validation = new ValidationController();
$puzzlesCtrl = new PuzzlesController();
$retosCtrl = new RetosController();
$admin = new AdminController();
require_once __DIR__ . '/../app/Http/Controllers/LearningPathController.php';
$learningPath = new LearningPathController();

// Auth
$router->post('/auth/register', fn($d) => $auth->register($d));
$router->post('/auth/login', fn($d) => $auth->login($d));
$router->post('/auth/guest', fn() => $auth->guest());
$router->get('/auth/logout', fn() => $auth->logout());
$router->get('/auth/me', fn() => $auth->me());

// Validación
$router->post('/validation/closure', fn($d) => $validation->computeClosure($d));
$router->post('/validation/normalform', fn($d) => $validation->getNormalForm($d));
$router->post('/validation/er', fn($d) => $validation->generateER($d));

// Puzzles
$router->get('/puzzles/list', fn() => $puzzlesCtrl->list());
$router->post('/puzzles/submit', fn($d) => $puzzlesCtrl->submitAttempt($d));

// Retos
$router->get('/retos/current', fn() => $retosCtrl->current());
$router->get('/retos/ranking', fn() => $retosCtrl->ranking());
$router->post('/retos/submit', fn($d) => $retosCtrl->submitAnswer($d));

// Learning Path
$router->get('/learning-path/progress', fn() => $learningPath->getProgress());
$router->post('/learning-path/submit', fn($d) => $learningPath->submitSolution($d));

// Admin
$router->get('/admin/puzzles', fn() => $admin->getPuzzles());
$router->post('/admin/puzzle/create', fn($d) => $admin->createPuzzle($d));
$router->post('/admin/puzzle/update', fn($d) => $admin->updatePuzzle($d));
$router->post('/admin/puzzle/delete', fn($d) => $admin->deletePuzzle($d));
$router->get('/admin/reto', fn() => $admin->getCurrentReto());
$router->post('/admin/reto/save', fn($d) => $admin->saveReto($d));
$router->get('/admin/logs', fn() => $admin->getLogs());
$router->post('/admin/logs/clear', fn() => $admin->clearLogs());