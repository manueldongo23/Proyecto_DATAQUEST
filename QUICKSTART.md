# Quick Start Guide

## 5-Minute Setup

### Option 1: Using Docker (Recommended)

```bash
# Clone the project
git clone https://github.com/dataquest/normalization-quest-lab.git
cd normalization-quest-lab

# Start all services
docker-compose up -d

# Run migrations
docker-compose exec app php artisan migrate

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
```

### Option 2: Manual Setup

#### Backend (Terminal 1)

```bash
# Install PHP dependencies
composer install

# Setup environment
cp .env.example .env
php artisan key:generate

# Configure database in .env (use SQLite for quick testing)
DB_CONNECTION=sqlite

# Run migrations
php artisan migrate

# Start server
php artisan serve
# Backend runs on http://localhost:8000
```

#### Frontend (Terminal 2)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# Frontend runs on http://localhost:5173
```

## First Steps

1. **Open the Application**
   - Visit http://localhost:5173 in your browser

2. **Create Your First Schema**
   - Table Name: `Biblioteca`
   - Add attributes: `id_libro`, `titulo`, `autor`, `ciudad_autor`
   - Add dependency: `{id_libro} → {titulo, autor, ciudad_autor}`

3. **Validate Schema**
   - Click "Validar Normalización"
   - See the diagnosis panel show that it's in 1NF

4. **Learn About Violations**
   - Add a new dependency: `{autor} → {ciudad_autor}`
   - Validate again
   - Now it shows a 3FN violation (transitive dependency)

5. **Fix the Violation**
   - Remove the transitive dependency
   - Create two separate schemas if needed
   - Achieve 3FN or BCNF

## Project Structure

```
DATAQUEST/
├── app/                    # Backend application code
│   ├── Domain/             # Business logic
│   ├── Application/        # Use cases
│   ├── Infrastructure/     # Data access layer
│   ├── Http/              # API controllers
│   └── Models/            # Database models
├── database/              # Migrations
├── frontend/              # React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # API client
│   │   ├── store/         # State management
│   │   └── types.ts       # TypeScript types
│   ├── vite.config.ts     # Vite configuration
│   └── package.json       # Dependencies
├── config/                # Laravel configuration
├── nginx/                 # Nginx configuration
└── README.md              # Full documentation
```

## Common Commands

### Backend

```bash
# Create a new migration
php artisan make:migration create_quests_table

# Run migrations
php artisan migrate

# Rollback migrations
php artisan migrate:rollback

# Clear cache
php artisan cache:clear

# Start tinker (interactive shell)
php artisan tinker
```

### Frontend

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Format code
npm run format
```

## Testing the API

### Using cURL

```bash
# Validate a schema
curl -X POST http://localhost:8000/api/validate-schema \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "Estudiante",
    "attributes": ["id_est", "nombre", "ciudad"],
    "dependencies": [
      {
        "determinant": ["id_est"],
        "dependent": ["nombre", "ciudad"]
      }
    ]
  }'
```

### Using Postman

1. Import collection: `DATAQUEST/postman-collection.json`
2. Set environment variable: `base_url` = `http://localhost:8000/api`
3. Run requests from the collection

## Database Setup

### For Development

Use SQLite (no setup needed) or PostgreSQL:

```bash
# Install PostgreSQL
# macOS: brew install postgresql
# Ubuntu: sudo apt install postgresql
# Windows: https://www.postgresql.org/download/windows/

# Create database
psql -U postgres
CREATE DATABASE dataquest;
\q

# Update .env
DB_CONNECTION=pgsql
DB_DATABASE=dataquest
DB_USERNAME=postgres

# Run migrations
php artisan migrate
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8000
netstat -ano | findstr :8000

# Kill the process (Windows)
taskkill /PID <PID> /F

# Or use different port
php artisan serve --port=8001
```

### Database Connection Failed

```bash
# Test connection in Laravel
php artisan tinker
DB::connection()->getPdo();
```

### Frontend Can't Connect to Backend

1. Check backend is running: `php artisan serve`
2. Verify `VITE_API_URL` in `frontend/.env.local`
3. Check CORS isn't blocking requests (should work on localhost)

## Next Steps

- Read the full [README.md](./README.md)
- Check [API Documentation](./API_DOCUMENTATION.md)
- Review [Installation Guide](./INSTALLATION.md)
- Explore the codebase and start contributing!

## Get Help

- 💬 GitHub Discussions
- 🐛 Report issues on GitHub Issues
- 📧 Email: support@dataquest.com
- 📖 Check documentation in the repo

---

**Ready to start? Run `docker-compose up -d` and visit http://localhost:5173!** 🚀
