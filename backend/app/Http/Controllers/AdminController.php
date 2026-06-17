<?php
class AdminController {
    private function verificarAdmin() {
        if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'administrador') {
            http_response_code(403);
            echo json_encode(['error' => 'Acceso denegado']);
            exit;
        }
    }
    
    public function getPuzzles() {
        $this->verificarAdmin();
        $db = Database::getConnection();
        $stmt = $db->query("SELECT * FROM puzzles");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function createPuzzle($data) {
        $this->verificarAdmin();
        $db = Database::getConnection();
        $stmt = $db->prepare("INSERT INTO puzzles (enunciado, tablas_inicial, df_inicial, solucion_esperada, nivel_dificultad) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$data['enunciado'], json_encode($data['tablas_inicial']), json_encode($data['df_inicial']), json_encode($data['solucion_esperada']), $data['nivel_dificultad']]);
        LogSistema::registrar('admin_accion', "Puzzle creado", $_SESSION['user_id']);
        return ['success' => true];
    }
    
    public function updatePuzzle($data) {
        $this->verificarAdmin();
        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE puzzles SET enunciado=?, tablas_inicial=?, df_inicial=?, solucion_esperada=?, nivel_dificultad=? WHERE id=?");
        $stmt->execute([$data['enunciado'], json_encode($data['tablas_inicial']), json_encode($data['df_inicial']), json_encode($data['solucion_esperada']), $data['nivel_dificultad'], $data['id']]);
        LogSistema::registrar('admin_accion', "Puzzle {$data['id']} actualizado", $_SESSION['user_id']);
        return ['success' => true];
    }
    
    public function deletePuzzle($data) {
        $this->verificarAdmin();
        $db = Database::getConnection();
        $stmt = $db->prepare("DELETE FROM puzzles WHERE id = ?");
        $stmt->execute([$data['id']]);
        LogSistema::registrar('admin_accion', "Puzzle {$data['id']} eliminado", $_SESSION['user_id']);
        return ['success' => true];
    }
    
    public function getCurrentReto() {
        $this->verificarAdmin();
        $db = Database::getConnection();
        $stmt = $db->query("SELECT * FROM retos_semanales WHERE activo = 1 ORDER BY id DESC LIMIT 1");
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    public function saveReto($data) {
        $this->verificarAdmin();
        $db = Database::getConnection();
        $stmt = $db->prepare("UPDATE retos_semanales SET descripcion=?, tablas=?, df=?, fecha_inicio=?, fecha_fin=? WHERE id=?");
        $stmt->execute([$data['descripcion'], json_encode($data['tablas']), json_encode($data['df']), $data['fecha_inicio'], $data['fecha_fin'], $data['id']]);
        LogSistema::registrar('admin_accion', "Reto semanal actualizado", $_SESSION['user_id']);
        return ['success' => true];
    }
    
    public function getLogs() {
        $this->verificarAdmin();
        $db = Database::getConnection();
        $stmt = $db->query("SELECT l.*, u.apodo FROM logs_sistema l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.fecha DESC LIMIT 100");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function clearLogs() {
        $this->verificarAdmin();
        $db = Database::getConnection();
        $db->exec("TRUNCATE TABLE logs_sistema");
        LogSistema::registrar('admin_accion', "Logs limpiados", $_SESSION['user_id']);
        return ['success' => true];
    }
}