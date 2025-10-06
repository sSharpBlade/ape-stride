const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const database = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ape-stride-jwt-secret-2024';

// Seguridad middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"]
    }
  }
}));

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  message: { error: 'Demasiados intentos de login. Intenta en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas requests. Intenta más tarde.' }
});

// Middleware básico
app.use(generalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));
app.use(express.static('public'));

// Configuración de sesiones con SQLite
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './data'
  }),
  secret: process.env.SESSION_SECRET || 'ape-stride-session-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  },
  name: 'ape.session'
}));

// Esquemas de validación
const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(6).required()
});

const userSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  role: Joi.string().valid('user', 'admin').default('user'),
  email: Joi.string().email().required(),
  first_name: Joi.string().min(2).max(50).required(),
  last_name: Joi.string().min(2).max(50).required()
});

// Middleware de autenticación mejorado
const requireAuth = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({
      error: 'Sesión expirada',
      code: 'SESSION_EXPIRED'
    });
  }

  try {
    const user = await database.findUserById(req.session.userId);
    if (!user) {
      req.session.destroy();
      return res.status(401).json({
        error: 'Usuario no válido',
        code: 'INVALID_USER'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Acceso denegado. Se requieren permisos de administrador.',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }
  next();
};

// Rutas de autenticación
app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: error.details[0].message
      });
    }

    const { username, password } = value;
    const user = await database.findUserByUsername(username);

    if (!user) {
      await database.incrementFailedAttempts(username);
      return res.status(401).json({
        error: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verificar si está bloqueado
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({
        error: 'Cuenta temporalmente bloqueada por múltiples intentos fallidos',
        code: 'ACCOUNT_LOCKED'
      });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      await database.incrementFailedAttempts(username);
      return res.status(401).json({
        error: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Login exitoso
    await database.updateLastLogin(user.id, req.ip);

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/login-vulnerable', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await database.findUserByUsernameVulnerable(username, password);

    if (user) {
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      res.json({
        message: 'Login exitoso',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email
        }
      });
    } else {
      res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Error en la base de datos',
      details: error.message,
      sql_error: error.code
    });
  }
});

// ⚠️ ENDPOINT ADICIONAL VULNERABLE PARA BÚSQUEDAS
app.get('/api/users-vulnerable', async (req, res) => {
  try {
    console.log('⚠️ USANDO BÚSQUEDA VULNERABLE - SOLO PARA FINES EDUCATIVOS ⚠️');

    const { order } = req.query;
    const orderBy = order || 'id';

    console.log(`Búsqueda vulnerable con ORDER BY: ${orderBy}`);

    const users = await database.getAllUsersVulnerable(orderBy);
    res.json(users);

  } catch (error) {
    console.error('Error en búsqueda vulnerable:', error);
    // ⚠️ Devolver información detallada del error
    res.status(500).json({
      error: 'Error en la consulta',
      details: error.message,
      sql_error: error.code
    });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout exitoso' });
});

app.get('/api/auth/check', (req, res) => {
  if (req.session.userId) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// CRUD de usuarios mejorado
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await database.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error, value } = userSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: error.details[0].message
      });
    }

    const user = await database.createUser(value);
    res.status(201).json(user);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'El nombre de usuario ya existe' });
    } else {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { username, password, role } = req.body;

    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (username && users.find(u => u.username === username && u.id !== id)) {
      return res.status(400).json({ error: 'El username ya existe' });
    }

    if (username) users[userIndex].username = username;
    if (password) users[userIndex].password = await bcrypt.hash(password, 10);
    if (role) users[userIndex].role = role;

    res.json({
      id: users[userIndex].id,
      username: users[userIndex].username,
      role: users[userIndex].role
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/api/users/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Prevenir eliminar el último admin
    const user = users[userIndex];
    if (user.role === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount === 1) {
        return res.status(400).json({ error: 'No se puede eliminar el último administrador' });
      }
    }

    users.splice(userIndex, 1);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Dashboard stats
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const stats = await database.getUserStats();
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicializar servidor
async function startServer() {
  try {
    await database.initialize();

    app.listen(PORT, () => {
      console.log('🚀 APE Stride Server');
      console.log(`📡 Servidor: http://localhost:${PORT}`);
      console.log('🔐 Usuarios empresariales:');
      console.log('   👔 Admin: admin / Admin123!');
      console.log('   👤 User:  user1 / User123!');
      console.log('🔒 Seguridad: Rate limiting, Helmet, SQLite');
      console.log('💡 Ctrl+C para detener');
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  database.close();
  process.exit(0);
});

startServer();
