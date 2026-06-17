<?php
class PuzzlesController {
    public function list() {
        $db = Database::getConnection();
        $stmt = $db->query("SELECT id, enunciado, tablas_inicial, df_inicial, nivel_dificultad FROM puzzles WHERE activo = 1");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function submitAttempt($data) {
        if (!isset($_SESSION['user_id'])) return ['success' => false, 'error' => 'No autenticado'];
        $userId = $_SESSION['user_id'];
        $puzzleId = $data['puzzle_id'];
        $respuesta = $data['respuesta'];
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT solucion_esperada FROM puzzles WHERE id = ?");
        $stmt->execute([$puzzleId]);
        $solucion = $stmt->fetchColumn();
        $correcto = ($respuesta === $solucion);
        $puntuacion = $correcto ? 10 : 0;
        if ($correcto) {
            $stmt = $db->prepare("INSERT INTO intentos_puzzle (user_id, puzzle_id, puntuacion) VALUES (?, ?, ?)");
            $stmt->execute([$userId, $puzzleId, $puntuacion]);
            $db->prepare("UPDATE users SET medallas = medallas + 1 WHERE id = ?")->execute([$userId]);
            LogSistema::registrar('evento', "Puzzle $puzzleId resuelto correctamente", $userId);
        }
        return ['success' => true, 'correcto' => $correcto, 'puntuacion' => $puntuacion];
    }
}