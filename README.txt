🚀 DATAQUEST - Instalación y ejecución

1. Requisitos: Tener instalado XAMPP, WAMP o cualquier servidor con PHP 7.4+ y MySQL.

2. Copia toda esta carpeta "dataquest" dentro de "htdocs" (XAMPP) o la raíz de tu servidor web.

3. Inicia Apache y MySQL desde el panel de control.

4. Abre tu navegador y ve a: http://localhost/dataquest

5. La primera vez que accedas, la base de datos se creará automáticamente (tablas y datos iniciales).
   Si ves algún error de conexión, verifica que MySQL esté corriendo y que el usuario sea "root" sin contraseña (en config/database.php).

6. Usuario administrador por defecto:
   - Correo: admin@dataquest.com
   - Contraseña: admin123

7. Puedes registrarte como usuario normal y comenzar a resolver puzzles, retos semanales y ganar medallas.

8. El validador de normalización permite calcular clausuras, determinar formas normales (1FN a BCNF) y generar diagramas ER a partir de texto.

9. El panel de administración (solo visible para admin) permite:
   - Crear, editar y eliminar puzzles.
   - Configurar el reto semanal (descripción, tablas, dependencias, fechas).
   - Ver los logs del sistema.

¡Disfruta aprendiendo normalización de bases de datos con DataQuest!