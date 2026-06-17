# DataQuest

![Laravel 11](https://img.shields.io/badge/Laravel-11-red)
![React 18](https://img.shields.io/badge/React-18-149eca)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Vite 5](https://img.shields.io/badge/Vite-5-7c3aed)
![Playwright](https://img.shields.io/badge/Playwright-E2E-45ba63)

Plataforma full-stack para **aprender, practicar, validar y gestionar normalizacion de bases de datos relacionales** desde una sola experiencia.

DataQuest combina un motor real de normalizacion, un laboratorio de validacion, una ruta academica guiada, retos gamificados, reportes y gestion de proyectos persistidos.

## Que hace diferente a DataQuest

La mayoria de demos de normalizacion solo muestran formularios o resultados estaticos. DataQuest integra en un mismo producto:

- analisis real de esquemas y dependencias funcionales
- diagnostico por forma normal
- descomposicion sugerida y generacion SQL
- proyectos persistidos con historial y versionado
- ruta academica con progreso
- retos con XP, ranking y logros
- analitica de uso y reportes

## Modulos principales

### 1. Dashboard

Vista ejecutiva del progreso del usuario, actividad reciente, avances por modulo y retos activos.

### 2. Projects

Gestion de proyectos de normalizacion con apertura directa al motor, seguimiento de estado y persistencia real.

### 3. Normalizer Engine

Modulo principal de trabajo. Permite:

- analizar tablas y atributos
- detectar dependencias funcionales
- evaluar formas normales
- sugerir descomposicion
- generar SQL y vistas derivadas
- restaurar versiones previas

### 4. Validator Lab

Flujo guiado para validar esquemas y obtener hallazgos, recomendaciones y comparativas antes vs despues.

### 5. Academy

Ruta didactica por 1FN, 2FN, 3FN, BCNF, 4FN y 5FN con teoria, practicas y seguimiento de progreso.

### 6. Challenges

Sistema de retos con progreso, recompensas, insignias, ranking y experiencia acumulada.

### 7. Reports

Panel analitico con metricas de validacion, errores frecuentes, avance academico y actividad reciente.

### 8. Library

Coleccion de guias, plantillas SQL, casos de estudio y recursos de apoyo para profundizar el aprendizaje.

## Arquitectura

DataQuest esta construido como un **monorepo full-stack** con una arquitectura de **monolito modular**:

- **Backend**: Laravel 11 + Sanctum + servicios de dominio
- **Frontend**: React 18 + TypeScript + Vite + Zustand
- **Persistencia**: SQLite para desarrollo rapido y soporte orientado a PostgreSQL / Supabase
- **Testing**: PHPUnit + Playwright

### Capas relevantes

- `app/Http/Controllers/Api`: contratos REST y endpoints
- `app/Domain/Services`: motor de normalizacion y servicios de dominio
- `app/Services`: casos de uso y coordinacion de modulos
- `frontend/src/components`: vistas de producto
- `frontend/src/store`: estado global
- `frontend/src/services`: integracion HTTP y clientes frontend

## Stack tecnico

### Backend

- PHP 8.2
- Laravel 11
- Laravel Sanctum
- PHPUnit 11

### Frontend

- React 18
- TypeScript
- Vite 5
- Tailwind CSS
- Axios
- Zustand
- React Hook Form
- Lucide React
- Playwright

## Estructura del repositorio

```text
Proyecto_DATAQUEST/
|-- app/                    # Backend Laravel
|-- bootstrap/
|-- config/
|-- database/               # Migraciones y seeders
|-- docs/                   # OpenAPI e informe tecnico
|-- frontend/               # SPA React + TypeScript
|-- lang/
|-- nginx/
|-- public/
|-- routes/
|-- scripts/
|-- tests/                  # Feature, unit, property y performance tests
|-- API_DOCUMENTATION.md
|-- INSTALLATION.md
|-- QUICKSTART.md
`-- README.md
```

## Puesta en marcha rapida

### Backend

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### URLs locales

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`

## Calidad y pruebas

### Backend

```bash
vendor/bin/phpunit
```

### Frontend

```bash
cd frontend
npm run type-check
npm run test:e2e
```

## Documentacion disponible

- [Quick Start](./QUICKSTART.md)
- [Installation Guide](./INSTALLATION.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [OpenAPI Contract](./docs/openapi.yaml)
- [Technical Report](./docs/TECHNICAL_REPORT.md)

## Estado actual del proyecto

Este repositorio contiene el **snapshot completo del sistema actual**, ya depurado para publicacion tecnica:

- una sola arquitectura vigente
- codigo fuente backend y frontend actual
- pruebas automatizadas
- documentacion principal
- contrato OpenAPI

Se eliminaron artefactos legacy, archivos de debug, dumps auxiliares y capas antiguas que ya no representaban la version actual del producto.

## Fortalezas del sistema

- producto con vision clara y diferenciada
- motor de normalizacion real, no solo visual
- experiencia educativa + operativa en un mismo flujo
- gamificacion y reportes conectados al progreso del usuario
- base tecnica suficientemente solida para evolucionar

## Siguiente etapa recomendada

- modularizar vistas frontend demasiado grandes
- formalizar routing y layouts mas escalables
- endurecer observabilidad y seguridad
- ampliar pruebas E2E de flujos criticos
- preparar pipeline de despliegue y entornos productivos

## Resumen ejecutivo

DataQuest no es solo un validador de formas normales. Es una base real para una plataforma de aprendizaje y operacion sobre normalizacion relacional, con componentes academicos, analiticos y de productividad integrados.

Si quieres entender el sistema a nivel profundo, revisa el [Technical Report](./docs/TECHNICAL_REPORT.md).
