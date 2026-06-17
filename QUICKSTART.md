# Quick Start

## Opcion 1: Docker

```bash
git clone <repo-url>
cd Proyecto_DATAQUEST
docker-compose up -d
docker-compose exec app php artisan migrate
```

Accesos:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`

## Opcion 2: Ejecucion manual

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

## Comandos utiles

### Backend

```bash
php artisan migrate
php artisan migrate:rollback
php artisan cache:clear
vendor/bin/phpunit
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run type-check
npm run test:e2e
```

## Siguiente lectura

- [README.md](./README.md)
- [INSTALLATION.md](./INSTALLATION.md)
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- [docs/TECHNICAL_REPORT.md](./docs/TECHNICAL_REPORT.md)
