<?php

class LearningPathController {
    
    public function getProgress() {
        if (!isset($_SESSION['user_id'])) return ['success' => false, 'error' => 'No autenticado'];
        $userId = $_SESSION['user_id'];
        
        $db = Database::getConnection();
        
        // Obtenemos todos los niveles ordenados
        $stmt = $db->prepare("SELECT * FROM learning_levels ORDER BY world, level_number");
        $stmt->execute();
        $levels = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Obtenemos el progreso del usuario si no es invitado (user_id = 0)
        $progressMap = [];
        if ($userId > 0) {
            $stmt = $db->prepare("SELECT * FROM user_progress WHERE user_id = ?");
            $stmt->execute([$userId]);
            $progressList = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($progressList as $p) {
                $progressMap[$p['level_id']] = $p;
            }
        }
        
        // Determinar niveles bloqueados/desbloqueados
        $maxCompletedLevelNumber = 0;
        foreach ($levels as $l) {
            if (isset($progressMap[$l['id']]) && $progressMap[$l['id']]['stars_earned'] > 0) {
                if ($l['level_number'] > $maxCompletedLevelNumber) {
                    $maxCompletedLevelNumber = $l['level_number'];
                }
            }
        }
        
        // Nivel desbloqueado es el max completado + 1
        $currentLevelNumber = $maxCompletedLevelNumber + 1;
        
        $missions = [];
        foreach ($levels as $l) {
            $status = 'locked';
            $stars = 0;
            $xp = $l['xp'];
            
            if (isset($progressMap[$l['id']]) && $progressMap[$l['id']]['stars_earned'] > 0) {
                $status = 'completed';
                $stars = $progressMap[$l['id']]['stars_earned'];
            } elseif ($l['level_number'] <= $currentLevelNumber || $userId === 0) {
                // Invitados pueden ver todo bloqueado pero no importa, o les damos el nivel 1
                // Permite al nivel actual jugarlo
                $status = 'current';
            }
            
            $missions[] = [
                'id' => $l['id'],
                'world' => $l['world'],
                'level_number' => $l['level_number'],
                'title' => $l['title'],
                'desc' => $l['description'],
                'initial_schema' => json_decode($l['initial_schema']),
                'difficulty' => $l['difficulty'],
                'xp' => $xp,
                'status' => $status,
                'stars' => $stars,
                'theory' => $l['theory'],
                'hints' => $l['hints'] ? json_decode($l['hints']) : []
            ];
        }
        
        return ['success' => true, 'missions' => $missions];
    }
    
    public function submitSolution($data) {
        if (!isset($_SESSION['user_id'])) return ['success' => false, 'error' => 'No autenticado'];
        $userId = $_SESSION['user_id'];
        
        // Si es invitado, solo validamos pero no guardamos en DB
        $isGuest = ($userId === 0);
        
        $levelId = $data['level_id'] ?? null;
        $userSolution = $data['respuesta'] ?? null;
        $hintsUsed = $data['hints_used'] ?? 0;
        
        if (!$levelId || !$userSolution) {
            return ['success' => false, 'error' => 'Faltan datos'];
        }
        
        $db = Database::getConnection();
        $stmt = $db->prepare("SELECT * FROM learning_levels WHERE id = ?");
        $stmt->execute([$levelId]);
        $level = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$level) return ['success' => false, 'error' => 'Nivel no encontrado'];
        
        $expectedSolution = json_decode($level['expected_solution'], true);
        
        // Convertimos ambas partes a array si viene string JSON desde front
        if (is_string($userSolution)) {
            $userSolution = json_decode($userSolution, true);
        }
        
        // Validación simplificada: comprueba que las cadenas JSON coincidan tras normalizar espacios
        // Esto depende de cómo formatee el usuario. Mejor hacer limpieza si es necesario.
        $isCorrect = (json_encode($expectedSolution) === json_encode($userSolution));
        // Opcional: Podría llamar a NormalizationEngine::validateNormalization(...) si tienes uno avanzado.
        
        if (!$isCorrect) {
            if (!$isGuest) {
                // Incrementar intentos
                $stmt = $db->prepare("INSERT INTO user_progress (user_id, level_id, attempts) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE attempts = attempts + 1");
                $stmt->execute([$userId, $levelId]);
            }
            return ['success' => false, 'error' => 'Respuesta incorrecta. ¡Inténtalo de nuevo!'];
        }
        
        // Obtener intentos actuales para calcular estrellas
        $attempts = 1;
        if (!$isGuest) {
            $stmt = $db->prepare("SELECT attempts FROM user_progress WHERE user_id = ? AND level_id = ?");
            $stmt->execute([$userId, $levelId]);
            $prog = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($prog) {
                $attempts = $prog['attempts'] + 1; // +1 porque ahora fue correcto
            }
        }
        
        $stars = $this->calculateStars($hintsUsed, $attempts);
        $scoreEarned = $this->calculateScore($stars, $level['world'], $level['xp']);
        
        if (!$isGuest) {
            // Guardar progreso
            $stmt = $db->prepare("
                INSERT INTO user_progress (user_id, level_id, stars_earned, score, attempts, completed_at)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                stars_earned = GREATEST(stars_earned, VALUES(stars_earned)),
                score = score + VALUES(score),
                attempts = attempts + 1,
                completed_at = NOW()
            ");
            $stmt->execute([$userId, $levelId, $stars, $scoreEarned, $attempts]);
            
            // Actualizar xp_total o medallas en la tabla users si quieres
            $stmt = $db->prepare("UPDATE users SET medallas = medallas + ? WHERE id = ?");
            $stmt->execute([$stars, $userId]);
        }
        
        return [
            'success' => true,
            'stars' => $stars,
            'score_earned' => $scoreEarned,
            'message' => "¡Felicidades! Has ganado $stars estrellas."
        ];
    }
    
    private function calculateStars($hints, $attempts) {
        if ($hints == 0 && $attempts <= 1) return 3;
        if ($hints <= 1 && $attempts <= 3) return 2;
        return 1;
    }
    
    private function calculateScore($stars, $world, $baseXp) {
        return $baseXp * ($stars / 3) * $world;
    }
}
