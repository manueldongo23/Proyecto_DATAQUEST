# 🚀 Guía de Instalación & Ejecución - Phase 1 & 2

**Última Actualización:** Mayo 2, 2026

---

## 📦 Requisitos Previos

```bash
# Verificar versiones
node --version      # 18+ requerido
php --version       # 8.2+ requerido
composer --version  # Actualizado
npm --version       # 9+ requerido (npm install -g npm)
```

---

## 🔧 BACKEND SETUP

### 1. Instalar Dependencias
```bash
# En la raíz del proyecto
composer install
```

### 2. Configurar Environment
```bash
# Copiar archivo de entorno
cp .env.example .env

# Generar application key
php artisan key:generate

# Configurar base de datos
# Editar .env:
DB_CONNECTION=pgsql  # o sqlite, mysql
DB_HOST=localhost
DB_DATABASE=dataquest
DB_USERNAME=postgres
DB_PASSWORD=password
```

### 3. Configurar Redis (para caching y rate limiting)
```bash
# Instalar Redis localmente (opcional para desarrollo)
# Si usas Docker:
docker run -d -p 6379:6379 redis:latest

# Editar .env:
CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

### 4. Ejecutar Migraciones
```bash
php artisan migrate

# O si usas SQLite:
touch database/database.sqlite
php artisan migrate
```

### 5. Registrar Middlewares (en bootstrap/app.php)
```php
// Si no está registrado, agregar:
$app->middleware([
    \App\Http\Middleware\ApiRateLimiting::class,
    \App\Http\Middleware\AuditLogging::class,
]);
```

### 6. Crear Canal de Logs para Auditoría
```bash
# Editar config/logging.php:
'audit' => [
    'driver' => 'single',
    'path' => storage_path('logs/audit.log'),
    'level' => 'info',
],
```

### 7. Iniciar Backend
```bash
php artisan serve
# O en puerto específico:
php artisan serve --port=8001

# Verificar:
curl http://localhost:8000/api/validate-schema
# Debería responder (aunque sea error de validación)
```

---

## 🎨 FRONTEND SETUP

### 1. Instalar Dependencias
```bash
cd frontend
npm install

# Esto instalará:
# - uuid (v9.0.1) - para generar UIDs de invitados
# - lucide-react (v0.408) - iconos
# - framer-motion (v10.16) - animaciones
```

### 2. Verificar Tipos
```bash
npm run type-check
# Debería pasar sin errores
```

### 3. Configurar API URL
```bash
# Crear frontend/.env si no existe:
VITE_API_URL=http://localhost:8000/api
```

### 4. Iniciar Servidor de Desarrollo
```bash
npm run dev
# Por defecto en http://localhost:5173
```

### 5. Verificar en Navegador
```
http://localhost:5173
```

---

## ✅ VERIFICACIÓN DEL SISTEMA

### Frontend
```bash
# 1. Visitar http://localhost:5173
# 2. Debería mostrar Landing page profesional
# 3. Intentar login (fallará porque no hay backend)
# 4. Click "Continuar como Invitado" -> ir a Dashboard
# 5. Intentar acceder a "DataQuest" -> modal de registro
```

### Backend
```bash
# 1. Validar rutas
php artisan route:list | grep api

# 2. Probar endpoints con cURL

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"test@example.com","password":"password"}'

# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "correo":"newuser@example.com",
    "apodo":"TestUser",
    "password":"TestPassword123",
    "password_confirmation":"TestPassword123"
  }'

# Explain Closure
curl -X POST http://localhost:8000/api/explain/closure \
  -H "Content-Type: application/json" \
  -d '{
    "attributes":["A","B","C"],
    "dependencies":[
      {"determinant":["A"],"dependent":["B"]},
      {"determinant":["B"],"dependent":["C"]}
    ]
  }'

# Validar Esquema
curl -X POST http://localhost:8000/api/validate-schema \
  -H "Content-Type: application/json" \
  -d '{
    "table_name":"Student",
    "attributes":["StudentID","Name","Email"],
    "dependencies":[
      {"determinant":["StudentID"],"dependent":["Name","Email"]}
    ]
  }'
```

### Rate Limiting
```bash
# Probar rate limit en login (max 5 por minuto)
for i in {1..6}; do
  curl -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"correo":"test@example.com","password":"wrong"}'
  echo ""
done

# El 6to request debería retornar 429 (Too Many Requests)
```

---

## 🧪 EJECUTAR TESTS

### Tests Unitarios
```bash
# Ejecutar todos los tests
php artisan test

# Ejecutar tests específicos
php artisan test tests/Unit/Services/NormalizationEngineTest.php

# Con coverage (requiere XDEBUG)
php artisan test --coverage
```

### Chequeo de Tipos (Frontend)
```bash
cd frontend
npm run type-check
```

---

## 🐛 TROUBLESHOOTING

### Frontend Error: "Cannot find module 'uuid'"
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run type-check
```

### Backend Error: "Connection refused"
```bash
# Verificar que MySQL/PostgreSQL está corriendo
# O usar SQLite editando .env:
DB_CONNECTION=sqlite
touch database/database.sqlite
php artisan migrate
```

### Rate Limiting No Funciona
```bash
# Verificar Redis está corriendo
redis-cli ping
# Debería responder "PONG"

# O cambiar a array driver en .env (desarrollo)
CACHE_DRIVER=array
RATE_LIMITER_DRIVER=array
```

### CORS Error
```bash
# Verificar config/cors.php
# Debería permitir http://localhost:5173
'allowed_origins' => ['http://localhost:5173', 'http://localhost:3000'],
```

### Migration Error
```bash
# Reset base de datos (cuidado con datos)
php artisan migrate:reset

# O fresh (más seguro)
php artisan migrate:fresh

# Seed datos de ejemplo (si existe)
php artisan db:seed
```

---

## 📊 ESTRUCTURA DE CARPETAS (CAMBIOS)

```
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/
│   │   │   ├── AuthController.php (✏️ actualizado)
│   │   │   └── NormalizationController.php (✏️ actualizado)
│   │   └── Middleware/
│   │       ├── ApiRateLimiting.php (✨ nuevo)
│   │       └── AuditLogging.php (✨ nuevo)
│   └── Domain/
│       └── Services/
│           └── ClosureExplainerService.php (✨ nuevo)
├── routes/
│   └── api.php (✏️ actualizado)
└── tests/
    └── Unit/Services/
        └── NormalizationEngineTest.php (✨ nuevo)

frontend/
├── src/
│   ├── components/
│   │   ├── Landing.tsx (✨ nuevo)
│   │   ├── ProtectedRoute.tsx (✨ nuevo)
│   │   ├── RegisterPromptModal.tsx (✨ nuevo)
│   │   ├── Sidebar.tsx (✏️ actualizado)
│   │   └── App.tsx (✏️ actualizado)
│   └── store/
│       └── authStore.ts (✏️ actualizado)
└── package.json (✏️ actualizado)

docs/
├── API_DOCUMENTATION.md (✏️ actualizado)
├── IMPLEMENTATION_SUMMARY.md (✨ nuevo)
└── INSTALLATION_UPDATES.md (✨ nuevo)
```

---

## 🚀 PRÓXIMOS PASOS

### Fase 3: UI/UX (~20 horas)
1. Instalar Sonner para toasts
2. Crear skeleton screens
3. Agregar Framer Motion a componentes
4. Implementar dark/light mode

### Fase 4: Infraestructura (~ 15 horas)
1. Redis caching optimization
2. Websockets (Laravel Reverb)
3. Service Workers
4. PDF export

### Fase 5: Gamificación (~ 12 horas)
1. Streaks system
2. Dynamic levels
3. Analytics dashboard
4. Plagiarism detection

---

## 📞 SOPORTE

### Logs Útiles
```bash
# Ver logs del backend
tail -f storage/logs/laravel.log

# Ver logs de auditoría
tail -f storage/logs/audit.log

# Ver logs del frontend (consola del navegador)
F12 -> Console
```

### Documentación
- **API Docs:** `API_DOCUMENTATION.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`
- **Backend Structure:** `README.md`

---

**Generado:** Mayo 2, 2026
**Mantener Actualizado:** Después de cada fase
