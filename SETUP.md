# 🚀 SETUP INMEDIATO - Normalization Quest Lab

## Paso 1: Backend Setup (Terminal 1)

```bash
# Instalación de dependencias PHP
composer install

# Copiar archivo de entorno
cp .env.example .env

# Generar clave de aplicación
php artisan key:generate

# Para desarrollo rápido, usa SQLite (no requiere configuración):
# Solo verifica que en .env esté:
# DB_CONNECTION=sqlite

# O si prefieres PostgreSQL/MySQL, configura .env con tus credenciales

# Ejecutar migraciones
php artisan migrate

# Levantar el servidor
php artisan serve
# El backend estará disponible en http://localhost:8000
```

## Paso 2: Frontend Setup (Terminal 2)

```bash
cd frontend

# Instalación de dependencias Node
npm install

# Validar que no hay errores de TypeScript
npm run type-check

# Iniciar servidor de desarrollo
npm run dev
# El frontend estará disponible en http://localhost:5173
```

## ✅ Verificación

1. **Frontend**: Abre http://localhost:5173 en tu navegador
2. **Backend**: Verifica que http://localhost:8000/api/validate-schema responde (POST)
3. **Conexión**: Si ves un esquema pero no puedes validar, **revisa la consola del navegador** para ver errores

## 🐛 Troubleshooting

### El frontend no se conecta al backend
- Verifica que `VITE_API_URL` en `frontend/.env` sea `http://localhost:8000/api`
- Confirma que el backend está corriendo en `php artisan serve`
- Revisa la pestaña "Network" en DevTools para ver qué URL intenta usar

### Error "Cannot find module"
```bash
rm -rf node_modules package-lock.json
npm install
npm run type-check
```

### Puerto 8000 ya está en uso
```bash
php artisan serve --port=8001
# Luego actualiza VITE_API_URL en frontend/.env
```

### Database doesn't exist
```bash
# Si usas SQLite, la BD se crea automáticamente
# Si usas PostgreSQL/MySQL, crea la BD manualmente primero:
psql -U postgres -c "CREATE DATABASE dataquest;"
```

## 📊 Quick Test

### Desde la terminal (POST request)
```bash
curl -X POST http://localhost:8000/api/validate-schema \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "Test",
    "attributes": ["id", "name"],
    "dependencies": [
      {"determinant": ["id"], "dependent": ["name"]}
    ]
  }'
```

### Desde el navegador
1. Abre http://localhost:5173
2. Ingresa tabla "Test"
3. Agrega atributo "id" y "name"
4. Agrega dependencia: determinant="id", dependent="name"
5. Haz clic en "Validar Normalización"

## 🎯 Próximos pasos

- [Leer README.md](./README.md) - Descripción completa del proyecto
- [Ver API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Endpoints disponibles
- [Ver INSTALLATION.md](./INSTALLATION.md) - Instalación detallada y deployment

---

**¡Listo para desarrollar!** Si encuentras problemas, revisa `INSTALLATION.md` o abre un issue. 💪
