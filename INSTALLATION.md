# Installation & Setup Guide - Normalization Quest Lab

## System Requirements

### Backend Requirements
- **PHP**: 8.2 or higher
- **Database**: PostgreSQL 14+ or MySQL 8.0+
- **Web Server**: Nginx 1.20+ or Apache 2.4+
- **Cache**: Redis 6.0+ (recommended)
- **Memory**: Minimum 512MB for development, 2GB+ for production

### Frontend Requirements
- **Node.js**: 18.0 or higher
- **npm**: 9.0 or higher (or yarn/pnpm)
- **Modern Browser**: Chrome, Firefox, Safari, or Edge (latest versions)

## Backend Installation

### 1. Environment Setup

Clone the repository:
```bash
git clone https://github.com/dataquest/normalization-quest-lab.git
cd normalization-quest-lab
```

Copy environment file:
```bash
cp .env.example .env
```

### 2. Install PHP Dependencies

```bash
composer install
```

### 3. Generate Application Key

```bash
php artisan key:generate
```

### 4. Database Configuration

Edit `.env` file:
```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=dataquest
DB_USERNAME=postgres
DB_PASSWORD=your_password

# Or for MySQL
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=dataquest
DB_USERNAME=root
DB_PASSWORD=your_password
```

### 5. Run Database Migrations

```bash
php artisan migrate
php artisan db:seed  # Optional: seeds sample data
```

### 6. Start Backend Server

```bash
php artisan serve
# Server runs on http://localhost:8000
```

## Frontend Installation

### 1. Navigate to Frontend Directory

```bash
cd frontend
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Configure Environment

Create `.env.local`:
```env
VITE_API_URL=http://localhost:8000/api
VITE_APP_NAME=Normalization Quest Lab
```

### 4. Start Development Server

```bash
npm run dev
# Frontend runs on http://localhost:5173
```

### 5. Build for Production

```bash
npm run build
# Output in dist/ directory
```

## Development Setup

### Visual Studio Code Extensions (Recommended)

Install these extensions for better development experience:

1. **PHP**
   - PHP Intelephense (bmewburn.vscode-intelephense-client)
   - PHP DocBlocker (neilbrayfield.php-docblocker)

2. **Laravel**
   - Laravel Blade Snippets (onecentlin.laravel-blade)
   - Laravel Goto Controller (stef-k.laravel-goto-controller)

3. **Frontend**
   - ES7+ React/Redux/React-Native snippets (dsznajder.es7-react-js-snippets)
   - Prettier - Code formatter (esbenp.prettier-vscode)
   - TypeScript Vue Plugin (Vue.vscode-typescript-vue-plugin)

### Code Quality Tools

**PHP - Laravel Pint**
```bash
./vendor/bin/pint
```

**JavaScript/TypeScript - Prettier**
```bash
cd frontend
npm run format
```

**Type Checking**
```bash
cd frontend
npm run type-check
```

## Production Deployment

### Using Docker

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - APP_ENV=production
      - DB_CONNECTION=pgsql
    volumes:
      - .:/app
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: dataquest
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

Deploy:
```bash
docker-compose up -d
```

### Vercel (Frontend)

1. Connect GitHub repository to Vercel
2. Set environment variables:
   - `VITE_API_URL`: Your API URL
3. Deploy:
```bash
vercel deploy --prod
```

### VPS with Nginx

1. Install system dependencies:
```bash
sudo apt update
sudo apt install php8.2-fpm php8.2-cli php8.2-pgsql nginx postgresql redis-server -y
```

2. Create application directory:
```bash
sudo mkdir -p /var/www/dataquest-backend
cd /var/www/dataquest-backend
```

3. Clone and setup:
```bash
git clone <repo> .
composer install --no-dev --optimize-autoloader
php artisan config:cache
php artisan route:cache
```

4. Configure Nginx (copy from `nginx/default.conf`)
5. Set permissions:
```bash
sudo chown -R www-data:www-data /var/www/dataquest-backend
sudo chmod -R 755 /var/www/dataquest-backend/storage
```

6. SSL with Let's Encrypt:
```bash
sudo certbot certonly --nginx -d api.dataquest.com
```

## Troubleshooting

### Backend Issues

**Composer fails to install**
```bash
composer clear-cache
composer install
```

**Database connection error**
```bash
# Test connection
php artisan tinker
>>> DB::connection()->getPdo();
```

**Migrations fail**
```bash
php artisan migrate:rollback
php artisan migrate
```

### Frontend Issues

**Dependencies won't install**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Hot reload not working**
- Check firewall settings
- Restart dev server: `npm run dev`

**API calls fail**
- Verify `VITE_API_URL` in `.env.local`
- Check CORS configuration in Laravel

## Testing

### Backend Tests
```bash
php artisan test
# Or with coverage
php artisan test --coverage
```

### Frontend Tests
```bash
cd frontend
npm run test
```

## Performance Optimization

### Backend
```bash
# Cache configuration
php artisan config:cache

# Cache routes
php artisan route:cache

# Optimize autoloader
composer dump-autoload --optimize
```

### Frontend
```bash
# Production build with minification
npm run build

# Analyze bundle size
npm run build:analyze
```

## Security Hardening

### Backend
1. Update `.env` with strong database password
2. Increase `BCRYPT_ROUNDS` to 14-15
3. Enable force HTTPS in `config/app.php`
4. Set `SESSION_SECURE=true`

### Frontend
1. Remove debug tools in production
2. Minify and compress assets
3. Enable Content Security Policy (CSP)

## Getting Help

- **Documentation**: See `README.md` and `API_DOCUMENTATION.md`
- **Issues**: Report on GitHub Issues
- **Community**: Join our Discord server
- **Email**: support@dataquest.com

---

Happy learning! 🎓
