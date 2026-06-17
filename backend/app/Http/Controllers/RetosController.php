<?php
class RetosController {
    public function current() {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT id, descripcion, tablas, df FROM retos_semanales WHERE activo = 1 AND fecha_inicio <= CURDATE() AND fecha_fin >= CURDATE() LIMIT 1");
        $stmt->execute();
        $reto = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$reto) return null;
        // Calcular la forma normal esperada automáticamente para verificar respuestas
        $tablas = json_decode($reto['tablas'], true);
        $dfs = json_decode($reto['df'], true);
        // Extraer todos los atributos de las tablas (simplificado)
        $attrs = [];
        foreach ($tablas as $t) {
            preg_match_all('/\w+/', $t, $matches);
            foreach ($matches[0] as $m) $attrs[] = $m;
        }
        $attrs = array_unique($attrs);
        $fds = [];
        foreach ($dfs as $fd) $fds[] = ['lhs' => $fd['lhs'], 'rhs' => $fd['rhs']];
        $nf = NormalizationEngine::getNormalForm($attrs, $fds);
        $reto['expected_nf'] = $nf;
        return $reto;
    }
    
    public function ranking() {
        $db = Database::getConnection();
        $stmt = $db->query("SELECT u.apodo, SUM(pr.puntuacion) as total_puntos FROM participaciones_reto pr JOIN users u ON pr.user_id = u.id GROUP BY u.id ORDER BY total_puntos DESC LIMIT 10");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function submitAnswer($data) {
        if (!isset($_SESSION['user_id'])) return ['success' => false, 'error' => 'No autenticado'];
        $userId = $_SESSION['user_id'];
        $retoId = $data['reto_id'];
        $respuesta = strtolower(trim($data['respuesta']));
        $db = Database::getConnection();
        // Obtener el reto y la forma normal esperada
        $stmt = $db->prepare("SELECT * FROM retos_semanales WHERE id = ?");
        $stmt->execute([$retoId]);
        $reto = $stmt->fetch(PDO::FETCH_ASSOC);
        $tablas = json_decode($reto['tablas'], true);
        $dfs = json_decode($reto['df'], true);
        $attrs = [];
        foreach ($tablas as $t) {
            preg_match_all('/\w+/', $t, $matches);
            foreach ($matches[0] as $m) $attrs[] = $m;
        }
        $attrs = array_unique($attrs);
        $fds = [];
        foreach ($dfs as $fd) $fds[] = ['lhs' => $fd['lhs'], 'rhs' => $fd['rhs']];
        $nfEsperado = NormalizationEngine::getNormalForm($attrs, $fds);
        $correcto = ($respuesta === strtolower($nfEsperado));
        if ($correcto) {
            $stmt = $db->prepare("SELECT id FROM participaciones_reto WHERE user_id = ? AND reto_id = ?");
            $stmt->execute([$userId, $retoId]);
            if (!$stmt->fetch()) {
                $puntos = 20;
                $stmt = $db->prepare("INSERT INTO participaciones_reto (user_id, reto_id, puntuacion, tiempo_segundos) VALUES (?, ?, ?, 0)");
                $stmt->execute([$userId, $retoId, $puntos]);
                LogSistema::registrar('evento', "Usuario acertó reto semanal $retoId", $userId);
                return ['success' => true, 'correcto' => true, 'puntos' => $puntos];
            } else {
                return ['success' => true, 'correcto' => true, 'puntos' => 0, 'mensaje' => 'Ya participaste en este reto'];
            }
        }
        return ['success' => true, 'correcto' => false];
    }
}