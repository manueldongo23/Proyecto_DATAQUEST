<?php
class AuthController {
    public function register($data) {
        $db = Database::getConnection();
        $correo = $data['correo'];
        $apodo = $data['apodo'];
        $password = password_hash($data['password'], PASSWORD_DEFAULT);
        try {
            $stmt = $db->prepare("INSERT INTO users (correo, apodo, password_hash, role) VALUES (?, ?, ?, 'usuario')");
            $stmt->execute([$correo, $apodo, $password]);
            $_SESSION['user_id'] = $db->lastInsertId();
            $_SESSION['role'] = 'usuario';
            LogSistema::registrar('evento', "Nuevo usuario registrado: $apodo", $_SESSION['user_id']);
            $user = User::find($_SESSION['user_id']);
            return ['success' => true, 'user' => ['id'=>$user['id'], 'apodo'=>$user['apodo'], 'role'=>$user['role'], 'medallas'=>$user['medallas']]];
        } catch(PDOException $e) {
            return ['success' => false, 'error' => 'Correo o apodo ya existe'];
        }
    }
    public function guest() {
        if (session_status() === PHP_SESSION_NONE) session_start();
        $_SESSION['user_id'] = 0;
        $_SESSION['role'] = 'invitado';
        return ['success' => true, 'user' => ['id'=>0, 'apodo'=>'Invitado', 'role'=>'invitado', 'medallas'=>0]];
    }
    
    public function login($data) {
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT * FROM users WHERE correo = ?");
        $stmt->execute([$data['correo']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user && password_verify($data['password'], $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['role'] = $user['role'];
            LogSistema::registrar('evento', "Usuario {$user['apodo']} inició sesión", $user['id']);
            return ['success' => true, 'user' => ['id'=>$user['id'], 'apodo'=>$user['apodo'], 'role'=>$user['role'], 'medallas'=>$user['medallas']]];
        }
        return ['success' => false, 'error' => 'Credenciales incorrectas'];
    }
    
    public function logout() {
        session_destroy();
        return ['success' => true];
    }
    
    public function me() {
        if (!isset($_SESSION['user_id'])) return ['authenticated' => false];
        if ($_SESSION['user_id'] === 0) {
            return ['authenticated' => true, 'user' => ['id'=>0, 'apodo'=>'Invitado', 'role'=>'invitado', 'medallas'=>0]];
        }
        $user = User::find($_SESSION['user_id']);
        if (!$user) return ['authenticated' => false];
        return ['authenticated' => true, 'user' => ['id'=>$user['id'], 'apodo'=>$user['apodo'], 'role'=>$user['role'], 'medallas'=>$user['medallas']]];
    }
}