const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, 'data', 'ape_stride.db');

      // Crear directorio si no existe
      const fs = require('fs');
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new sqlite3.Database(dbPath, async (err) => {
        if (err) {
          console.error('❌ Error conectando a SQLite:', err);
          reject(err);
          return;
        }

        console.log('🗄️ Conectado a SQLite exitosamente');

        try {
          await this.createTables();
          await this.createDefaultUsers();
          console.log('✅ Base de datos inicializada');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'user',
          email VARCHAR(100),
          first_name VARCHAR(50),
          last_name VARCHAR(50),
          is_active BOOLEAN DEFAULT 1,
          last_login DATETIME,
          failed_attempts INTEGER DEFAULT 0,
          locked_until DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS user_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          session_token VARCHAR(255),
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `;

      this.db.run(createUsersTable, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.run(createSessionsTable, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async createDefaultUsers() {
    try {
      const adminExists = await this.findUserByUsername('admin');
      if (!adminExists) {
        await this.createUser({
          username: 'admin',
          password: 'Admin123!',
          role: 'admin',
          email: 'admin@apestride.com',
          first_name: 'Administrator',
          last_name: 'System'
        });
      }

      const userExists = await this.findUserByUsername('user1');
      if (!userExists) {
        await this.createUser({
          username: 'user1',
          password: 'User123!',
          role: 'user',
          email: 'user1@apestride.com',
          first_name: 'Usuario',
          last_name: 'Demo'
        });
      }
    } catch (error) {
      console.error('Error creando usuarios por defecto:', error);
    }
  }

  async createUser(userData) {
    const { username, password, role = 'user', email, first_name, last_name } = userData;

    return new Promise(async (resolve, reject) => {
      try {
        const hashedPassword = await bcrypt.hash(password, 12);

        const sql = `
          INSERT INTO users (username, password, role, email, first_name, last_name)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        this.db.run(sql, [username, hashedPassword, role, email, first_name, last_name], function (err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({ id: this.lastID, username, role, email, first_name, last_name });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async findUserByUsername(username) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM users 
        WHERE username = ? AND is_active = 1
      `;

      this.db.get(sql, [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async findUserById(id) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, username, role, email, first_name, last_name, 
               is_active, last_login, created_at 
        FROM users 
        WHERE id = ? AND is_active = 1
      `;

      this.db.get(sql, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getAllUsers() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, username, role, email, first_name, last_name, 
               is_active, last_login, created_at 
        FROM users 
        ORDER BY created_at DESC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async updateUser(id, updates) {
    return new Promise(async (resolve, reject) => {
      try {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
          if (key === 'password') {
            fields.push('password = ?');
            values.push(await bcrypt.hash(value, 12));
          } else if (['username', 'role', 'email', 'first_name', 'last_name', 'is_active'].includes(key)) {
            fields.push(`${key} = ?`);
            values.push(value);
          }
        }

        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);

        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

        this.db.run(sql, values, function (err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async updateLastLogin(userId, ipAddress) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP, failed_attempts = 0, locked_until = NULL
        WHERE id = ?
      `;

      this.db.run(sql, [userId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async incrementFailedAttempts(username) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE users 
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE 
              WHEN failed_attempts >= 4 THEN datetime('now', '+15 minutes')
              ELSE locked_until 
            END
        WHERE username = ?
      `;

      this.db.run(sql, [username], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async deleteUser(id) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE users SET is_active = 0 WHERE id = ?`;

      this.db.run(sql, [id], function (err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  async getUserStats() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
          SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as users,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN last_login > datetime('now', '-30 days') THEN 1 ELSE 0 END) as recent_logins
        FROM users
      `;

      this.db.get(sql, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async findUserByUsername(username, password) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM users 
        WHERE username = '${username}' 
        AND password = '${password}' 
        AND is_active = 1
      `;

      this.db.get(sql, [], (err, row) => {
        if (err) {
          console.error('Error SQL:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async findUserVulnerable(username) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM users WHERE username = '${username}' AND is_active = 1`;

      this.db.get(sql, [], (err, row) => {
        if (err) {
          console.error('Error SQL:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getAllUsersVulnerable(orderBy = 'id') {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT id, username, role, email, first_name, last_login, created_at 
        FROM users 
        ORDER BY ${orderBy}
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('Error SQL:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) console.error('Error cerrando la base de datos:', err);
        else console.log('🔒 Base de datos cerrada');
      });
    }
  }
}

module.exports = new Database();
