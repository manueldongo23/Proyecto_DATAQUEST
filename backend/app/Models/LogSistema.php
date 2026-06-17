<?php
class LogSistema {
    public static function registrar($tipo, $mensaje, $userId = null) {
        $db = Database::getConnection();
        // Si el userId es 0 (Invitado), lo guardamos como NULL para evitar errores de FK
        if ($userId === 0) $userId = null;
        $stmt = $db->prepare("INSERT INTO logs_sistema (tipo, mensaje, user_id) VALUES (?, ?, ?)");
        $stmt->execute([$tipo, $mensaje, $userId]);
    }
}