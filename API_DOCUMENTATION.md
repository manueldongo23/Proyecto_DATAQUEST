# DataQuest API Documentation

> API reference for DataQuest — interactive database normalization academy.

## Base URL

```
http://localhost:8000/api
```

## Authentication

Uses Laravel Sanctum token-based authentication.

```
Authorization: Bearer {token}
```

## Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "errors": { "field": ["Validation error"] }
}
```

---

## 1. Authentication — Public

### POST /auth/register

Register a new user with name validation against blocked terms.

**Request:**
```json
{
  "correo": "user@example.com",
  "apodo": "NormalizationMaster",
  "password": "SecurePass123",
  "password_confirmation": "SecurePass123"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Usuario registrado correctamente",
  "access_token": "1|abc123...",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "correo": "user@example.com",
    "apodo": "NormalizationMaster",
    "role": "usuario",
    "xp": 0,
    "rango": "Aprendiz"
  }
}
```

### POST /auth/login

**Request:**
```json
{
  "correo": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Sesión iniciada correctamente",
  "access_token": "1|abc123...",
  "token_type": "Bearer",
  "user": { "...": "..." }
}
```

### POST /auth/forgot-password

Sends password reset token via cache (60-char random, 1-hour TTL).

**Request:**
```json
{
  "correo": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Si el correo existe, recibirás instrucciones para restablecer tu contraseña",
  "reset_token": "abc123..."
}
```

### POST /auth/reset-password

**Request:**
```json
{
  "correo": "user@example.com",
  "token": "abc123...",
  "password": "NewPass123",
  "password_confirmation": "NewPass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Contraseña restablecida correctamente"
}
```

---

## 2. Authentication — Protected (auth:sanctum)

### POST /auth/logout

Revokes current token.

**Response (200):**
```json
{
  "success": true,
  "message": "Sesión cerrada correctamente"
}
```

### GET /auth/me

Returns authenticated user data.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "correo": "user@example.com",
    "apodo": "NormalizationMaster",
    "role": "usuario",
    "xp": 150,
    "rango": "Normalizador Junior"
  }
}
```

### PUT /auth/profile

Update profile fields.

**Request:**
```json
{
  "apodo": "NewNickname",
  "correo": "new@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Perfil actualizado correctamente",
  "data": { "...": "..." }
}
```

---

## 3. Normalization Engine

### POST /validate-schema

Validate a schema against normalization forms (1FN through BCNF).

**Request:**
```json
{
  "table_name": "Estudiante",
  "attributes": ["id_est", "nombre", "id_ciudad", "ciudad"],
  "dependencies": [
    { "determinant": ["id_est"], "dependent": ["nombre", "id_ciudad"] },
    { "determinant": ["id_ciudad"], "dependent": ["ciudad"] }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "schema_name": "Estudiante",
    "candidate_keys": [["id_est"]],
    "diagnosis": {
      "current_nf": "2NF",
      "violations": ["3FN"],
      "didactic_steps": [
        {
          "step": "Verificando Tercera Forma Normal (3FN)",
          "explanation": "...",
          "violation_detail": "...",
          "rule_codd": "..."
        }
      ],
      "suggestions": ["Divide la tabla moviendo los atributos transitivamente dependientes a otra tabla."]
    },
    "is_fully_normalized": false,
    "message": "Tu esquema está en 2FN. Revisa las sugerencias para alcanzar 3FN."
  }
}
```

### POST /validate-schema (with 1FN-5FN)

Set `level: "full"` to activate 4FN/5FN detection:

```json
{
  "table_name": "Cursos",
  "attributes": ["CursoID", "Instructor", "Libro"],
  "dependencies": [
    { "determinant": ["CursoID"], "dependent": ["Instructor"] },
    { "determinant": ["CursoID"], "dependent": ["Libro"] }
  ],
  "level": "full"
}
```

### POST /export-validation

Export validation in structured format.

### POST /import/csv

Import schema from a CSV file.

### POST /import/csv-and-validate

Import CSV and immediately validate the schema.

### POST /import/database

Import schema directly from a database connection.

### POST /import/database/test

Test database connection parameters before importing.

### GET /import/app-database

Import schema from the application's own database.

### POST /parse/ddl

Parse DDL statements into a structured schema.

### POST /parse/ddl/advanced

Parse complex DDL with advanced features.

### POST /explain/closure

Step-by-step attribute closure computation.

**Request:**
```json
{
  "attributes": ["A"],
  "dependencies": [
    { "determinant": ["A"], "dependent": ["B"] },
    { "determinant": ["B"], "dependent": ["C"] }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "closure": ["A", "B", "C"],
    "steps": [
      { "step_number": 0, "description": "Inicializar X+", "current_closure": ["A"] },
      { "step_number": 1, "description": "Aplicar A→B", "current_closure": ["A", "B"] },
      { "step_number": 2, "description": "Aplicar B→C", "current_closure": ["A", "B", "C"] }
    ]
  }
}
```

### POST /explain/candidate-keys

Discover candidate keys with explanation.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total_keys": 2,
    "candidate_keys": [["id_est"], ["email"]],
    "explanations": [],
    "suggestions": []
  }
}
```

### POST /explain/decomposition

Show decomposition steps toward 3NF.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "decomposition_steps": [],
    "new_relations": [],
    "preserved_dependencies": true
  }
}
```

---

## 4. Sandbox — Offline-first Normalization Playground

### POST /sandbox/analyze

Analyze schema without authentication.

### POST /sandbox/parse-ddl

Parse DDL without authentication.

### POST /sandbox/import-csv

Import CSV without authentication.

### GET /sandbox/exercise

Get an exercise without authentication.

### GET /sandbox/glossary/{term}

Look up glossary term without authentication.

---

## 5. Academy — Didactic Learning

### GET /academy

Get academy overview with learning path and progress.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "learning_path": [
      {
        "nf": "DF",
        "name": "Dependencias Funcionales",
        "description": "Aprende a identificar dependencias entre atributos",
        "progress": 100,
        "status": "completed"
      },
      {
        "nf": "1FN",
        "name": "Primera Forma Normal",
        "description": "Atributos atómicos y sin grupos repetitivos",
        "progress": 65,
        "status": "in_progress"
      },
      {
        "nf": "2FN",
        "name": "Segunda Forma Normal",
        "description": "Eliminar dependencias parciales",
        "progress": 0,
        "status": "available"
      },
      {
        "nf": "3FN",
        "name": "Tercera Forma Normal",
        "progress": 0,
        "status": "locked"
      },
      {
        "nf": "BCNF",
        "name": "Forma Normal de Boyce-Codd",
        "progress": 0,
        "status": "locked"
      },
      {
        "nf": "4FN",
        "name": "Cuarta Forma Normal",
        "progress": 0,
        "status": "locked"
      },
      {
        "nf": "5FN",
        "name": "Quinta Forma Normal",
        "progress": 0,
        "status": "locked"
      }
    ],
    "current_step": 2,
    "total_steps": 7,
    "completed_steps": 1
  }
}
```

### GET /academy/explain/{nf}

Get didactic explanation for a normal form. `{nf}` is one of: `DF`, `1FN`, `2FN`, `3FN`, `BCNF`, `4FN`, `5FN`.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "title": "Primera Forma Normal (1FN)",
    "description": "Una tabla está en 1FN si todos sus atributos contienen valores atómicos...",
    "rules": [
      "Cada celda contiene un solo valor (atómico)",
      "No hay grupos repetitivos ni arreglos",
      "Cada columna tiene un nombre único"
    ],
    "before_example": "CREATE TABLE Estudiante (\n  id INT,\n  nombre VARCHAR(50),\n  telefonos VARCHAR(100) -- múltiples teléfonos separados por coma\n);",
    "after_example": "CREATE TABLE Estudiante (\n  id INT,\n  nombre VARCHAR(50)\n);\nCREATE TABLE Telefono (\n  id INT,\n  estudiante_id INT,\n  telefono VARCHAR(20)\n);",
    "common_mistakes": [
      "Confundir NULL con valores atómicos",
      "Usar campos JSON cuando se necesita una relación"
    ]
  }
}
```

### GET /academy/exercise?nf={nf}

Get a practice exercise for the given normal form.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "title": "Identificar 1FN",
    "description": "Determina si la siguiente tabla está en 1FN...",
    "schema": { "table_name": "...", "attributes": [...], "dependencies": [...] },
    "question": "¿Qué forma normal cumple esta tabla?",
    "options": ["No está normalizada", "1FN", "2FN", "3FN"]
  }
}
```

### POST /academy/evaluate

Evaluate a user's answer to an exercise.

**Request:**
```json
{
  "nf": "1FN",
  "answer": "2FN",
  "schema": { "table_name": "R", "attributes": [...], "dependencies": [...] }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "correct": false,
    "correct_answer": "1FN",
    "feedback": "Revisa: violación de atomicidad en atributo 'telefonos'",
    "xp_earned": 20
  }
}
```

### POST /academy/decompose

Decompose a schema to 3NF with SQL generation.

**Request:**
```json
{
  "table_name": "Pedidos",
  "attributes": ["id_pedido", "producto", "id_cliente", "nombre_cliente"],
  "dependencies": [
    { "determinant": ["id_pedido"], "dependent": ["producto", "id_cliente"] },
    { "determinant": ["id_cliente"], "dependent": ["nombre_cliente"] }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "original_schema": { "...": "..." },
    "steps": [
      "1. Identificar dependencias funcionales",
      "2. Normalizar a 1FN (atributos atómicos)",
      "3. Eliminar dependencias parciales → 2FN",
      "4. Eliminar dependencias transitivas → 3FN"
    ],
    "resulting_tables": [
      { "name": "Pedido", "attributes": ["id_pedido", "producto", "id_cliente"], "fds": [...] },
      { "name": "Cliente", "attributes": ["id_cliente", "nombre_cliente"], "fds": [...] }
    ],
    "sql": "CREATE TABLE Pedido (...) ..."
  }
}
```

### POST /academy/validate-up-to

Validate a schema up to a target normal form.

**Request:**
```json
{
  "table_name": "Ventas",
  "attributes": ["id", "producto", "cantidad", "precio"],
  "dependencies": [
    { "determinant": ["id"], "dependent": ["producto", "cantidad", "precio"] }
  ],
  "target_nf": "3FN"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "target_nf": "3FN",
    "achieved_nf": "BCNF",
    "violations": [],
    "message": "Tu esquema cumple con 3FN y supera el objetivo."
  }
}
```

---

## 6. Didactic Validation

### POST /didactic-validate

Full didactic validation with anomaly detection, priority-sorted recommendations, and analogies.

**Request:**
```json
{
  "table_name": "Estudiante",
  "attributes": ["id", "nombre", "id_ciudad", "nombre_ciudad"],
  "dependencies": [
    { "determinant": ["id"], "dependent": ["nombre", "id_ciudad"] },
    { "determinant": ["id_ciudad"], "dependent": ["nombre_ciudad"] }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "schema_name": "Estudiante",
    "current_nf": "2FN",
    "violations": [
      { "nf": "3FN", "detail": "...", "priority": "alta" }
    ],
    "recommendations": [
      {
        "priority": 1,
        "type": "transitive_dependency",
        "description": "Dependencia transitiva detectada",
        "fix_instruction": "Crea una tabla Ciudad(id_ciudad, nombre_ciudad)...",
        "analogy": "Es como si tu libreta de direcciones...",
        "example_sql": "CREATE TABLE Ciudad (id_ciudad INT PRIMARY KEY, nombre_ciudad VARCHAR(100));"
      }
    ],
    "anomalies_detected": ["Actualización: cambiar nombre_ciudad afecta múltiples filas"],
    "summary": "Tu esquema está en 2FN. Para llegar a 3FN necesitas eliminar 1 dependencia transitiva."
  }
}
```

### POST /quick-analyze

Quick snapshot analysis (lighter response).

---

## 7. Reports

### POST /report/generate

Generate a full normalization report with SQL.

**Request:**
```json
{
  "table_name": "Factura",
  "attributes": ["id", "cliente", "producto", "cantidad", "precio_unitario", "total"],
  "dependencies": [
    { "determinant": ["id"], "dependent": ["cliente", "producto", "cantidad", "precio_unitario", "total"] },
    { "determinant": ["producto"], "dependent": ["precio_unitario"] }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "original_schema": { "...": "..." },
    "diagnosis": { "current_nf": "2FN", "violations": [...], "suggestions": [...] },
    "decomposition": { "steps": [...], "resulting_tables": [...], "sql": "..." },
    "summary": "Reporte generado el 15/06/2026 10:30"
  }
}
```

---

## 8. Export — DBML, Mermaid, HTML

### POST /export/dbml

Export schema as DBML (Database Markup Language).

### POST /export/mermaid

Export schema as Mermaid diagram.

### POST /export/html

Export schema as HTML visualization.

### POST /export/all

Export all formats in a single response.

---

## 9. Progress & Analytics (Protected)

### GET /progress

Get user progress stats.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total_exercises": 25,
    "correct_answers": 18,
    "accuracy": 72.0,
    "current_rank": "Normalizador Junior",
    "xp": 340,
    "next_rank": "Normalizador Avanzado",
    "xp_to_next_rank": 160,
    "achievements": [
      { "name": "Primera Validación", "unlocked": true, "icon": "badge_check" },
      { "name": "Domador de 2FN", "unlocked": false, "icon": "badge_lock" }
    ]
  }
}
```

### GET /progress/learning-path

Get personalized learning path with locked/available/in_progress/completed states.

### GET /analytics/mastery/{userId}

Get user's mastery levels per concept.

### GET /analytics/history/{userId}

Get validation history.

### GET /analytics/mastery-timeline/{userId}

Get mastery timeline over time.

### GET /analytics/concept-breakdown/{userId}

Get concept-by-concept breakdown of performance.

### GET /analytics/learning-velocity/{userId}

Get user's learning velocity metrics.

### GET /analytics/error-patterns/{userId}

Get common error patterns detected.

### GET /analytics/recommendations/{userId}

Get personalized recommendations.

### GET /analytics/session-analytics/{userId}

Get session-level analytics.

### GET /analytics/peer-comparison/{userId}

Compare user performance against peers.

### GET /analytics/cohort-stats

Get aggregate cohort statistics (admin only).

---

## 10. Saved Schemas (Protected)

### GET /schemas

List paginated schemas.

### GET /schemas/{id}

Get schema detail.

### DELETE /schemas/{id}

Delete a schema.

---

## 11. Admin (Protected, role=administrador)

### GET /admin/dashboard

Dashboard stats: total users, schemas, validations, active users today.

### GET /admin/users

Paginated user list with filters.

### POST /admin/users/{id}/toggle

Toggle user active/inactive status.

### GET /admin/blocked-terms

List all blocked terms.

### POST /admin/blocked-terms

Add a blocked term.

**Request:**
```json
{
  "term": "spam",
  "category": "offensive",
  "severity": "medium",
  "description": "Término publicitario no deseado"
}
```

### DELETE /admin/blocked-terms/{id}

Remove a blocked term.

---

## 12. Glossary

### GET /glossary

List all glossary terms.

### GET /glossary/search

Search glossary terms.

### GET /glossary/difficulty/{difficulty}

Get glossary terms by difficulty level.

### GET /glossary/{term}

Get detailed information for a specific term.

---

## 13. Quest System & Achievements (Protected)

### GET /quests

List available quests.

### GET /quests/{id}

Get quest details.

### POST /quests/{id}/start

Start a quest.

### POST /quests/{id}/submit

Submit a quest solution.

### GET /leaderboard

Get leaderboard rankings.

### GET /achievements

List all available achievements.

### GET /achievements/user/{userId}

Get achievements unlocked by a user.

---

## 14. CSRF Cookie

### GET /csrf-cookie

Get CSRF cookie for SPA authentication (uses web middleware).

---

## 15. Health

### GET /health

**Response (200):**
```json
{
  "success": true,
  "message": "API funcionando correctamente",
  "timestamp": "2026-06-15T10:30:00Z"
}
```

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/register` | 3 requests | 10 minutes |
| `/auth/login` | 5 requests | 1 minute |
| `/validate-schema` | 100 requests | 1 minute |

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (not admin) |
| 404 | Not Found |
| 422 | Validation failed |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Pagination

List endpoints support `page` and `per_page` (default 15, max 100) query params:

```
GET /admin/users?page=2&per_page=20
```

---

## Example cURL Commands

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"correo":"u@e.com","apodo":"Master","password":"Pass123","password_confirmation":"Pass123"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"u@e.com","password":"Pass123"}'

# Validate schema (protected)
curl -X POST http://localhost:8000/api/validate-schema \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"table_name":"R","attributes":["A","B"],"dependencies":[{"determinant":["A"],"dependent":["B"]}]}'

# Academy explanation
curl http://localhost:8000/api/academy/explain/1FN

# Didactic validation
curl -X POST http://localhost:8000/api/didactic-validate \
  -H "Content-Type: application/json" \
  -d '{"table_name":"R","attributes":["A","B","C"],"dependencies":[{"determinant":["A"],"dependent":["B"]}]}'

# Health check
curl http://localhost:8000/api/health
```
