class EnterpriseApp {
    constructor() {
        this.currentUser = null;
        this.editingUserId = null;
        this.authToken = localStorage.getItem('authToken');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
    }

    setupEventListeners() {
        // Login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Logout (solo se ejecuta cuando el elemento existe)
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // User management (solo se ejecuta cuando los elementos existen)
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.openUserModal());
        }

        const userForm = document.getElementById('userForm');
        if (userForm) {
            userForm.addEventListener('submit', (e) => this.handleUserSubmit(e));
        }

        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeUserModal());
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeUserModal());
        }

        // Search and filters (solo se ejecuta cuando los elementos existen)
        const searchUsers = document.getElementById('searchUsers');
        if (searchUsers) {
            searchUsers.addEventListener('input', (e) => this.filterUsers());
        }

        const filterRole = document.getElementById('filterRole');
        if (filterRole) {
            filterRole.addEventListener('change', (e) => this.filterUsers());
        }

        // Modal events (solo se ejecuta cuando el elemento existe)
        const userModal = document.getElementById('userModal');
        if (userModal) {
            userModal.addEventListener('click', (e) => {
                if (e.target.id === 'userModal') {
                    this.closeUserModal();
                }
            });
        }

        // Remember me functionality
        const rememberedUser = localStorage.getItem('rememberedUser');
        if (rememberedUser) {
            const usernameField = document.getElementById('username');
            const rememberMeField = document.getElementById('rememberMe');
            if (usernameField) usernameField.value = rememberedUser;
            if (rememberMeField) rememberMeField.checked = true;
        }
    }

    showLoading(show = true) {
        document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
    }

    async checkAuth() {
        this.showLoading(true);

        try {
            const response = await this.apiCall('/api/auth/check');

            if (response.authenticated) {
                this.currentUser = response.user;
                this.showApp();
                await this.loadDashboardData();
            } else {
                this.showLogin();
            }
        } catch (error) {
            console.error('Error checking auth:', error);
            this.showLogin();
        } finally {
            this.showLoading(false);
        }
    }

    async apiCall(endpoint, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
            },
            ...options
        };

        const response = await fetch(endpoint, config);

        if (response.status === 401) {
            this.handleSessionExpired();
            throw new Error('Session expired');
        }

        if (response.status === 429) {
            throw new Error('Demasiadas requests. Espera un momento.');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        return data;
    }

    async handleLogin(e) {
        e.preventDefault();

        const usernameField = document.getElementById('username');
        const passwordField = document.getElementById('password');
        const rememberMeField = document.getElementById('rememberMe');
        const loginBtn = document.getElementById('loginBtn');
        const errorDiv = document.getElementById('loginError');
        const successDiv = document.getElementById('loginSuccess');

        // Verificar que los elementos existan
        if (!usernameField || !passwordField || !loginBtn || !errorDiv || !successDiv) {
            console.error('Error: No se encontraron todos los elementos necesarios del formulario de login');
            return;
        }

        const username = usernameField.value.trim();
        const password = passwordField.value;
        const rememberMe = rememberMeField ? rememberMeField.checked : false;

        // Reset messages
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        try {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';

            // Usar siempre el endpoint vulnerable por defecto
            const data = await this.apiCall('/api/login-vulnerable', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            // Handle remember me
            if (rememberMe) {
                localStorage.setItem('rememberedUser', username);
            } else {
                localStorage.removeItem('rememberedUser');
            }

            // Store auth token
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                this.authToken = data.token;
            }

            this.currentUser = data.user;

            successDiv.textContent = '¡Login exitoso! Redirigiendo...';
            successDiv.style.display = 'block';

            setTimeout(() => {
                this.showApp();
                this.loadDashboardData();
            }, 1000);

        } catch (error) {
            this.showError(this.getErrorMessage(error.message));
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
        }
    }

    getErrorMessage(errorMsg) {
        const errorMessages = {
            'INVALID_CREDENTIALS': 'Usuario o contraseña incorrectos',
            'ACCOUNT_LOCKED': 'Cuenta bloqueada temporalmente por múltiples intentos fallidos',
            'SESSION_EXPIRED': 'Su sesión ha expirado. Por favor inicie sesión nuevamente',
            'INSUFFICIENT_PERMISSIONS': 'No tiene permisos para realizar esta acción'
        };

        return errorMessages[errorMsg] || errorMsg || 'Error desconocido';
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    async handleLogout() {
        try {
            await this.apiCall('/api/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.currentUser = null;
            this.authToken = null;
            localStorage.removeItem('authToken');
            this.showLogin();
        }
    }

    handleSessionExpired() {
        this.currentUser = null;
        this.authToken = null;
        localStorage.removeItem('authToken');
        this.showLogin();
        this.showError('Su sesión ha expirado. Por favor inicie sesión nuevamente.');
    }

    showLogin() {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('username').focus();
    }

    showApp() {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';

        // Update user info
        const fullName = `${this.currentUser.first_name} ${this.currentUser.last_name}`;
        document.getElementById('currentUserName').textContent = fullName;
        document.getElementById('currentUserRole').textContent = this.currentUser.role === 'admin' ? 'Administrador' : 'Usuario';

        // Show/hide admin features
        const isAdmin = this.currentUser.role === 'admin';
        document.getElementById('addUserBtn').style.display = isAdmin ? 'inline-flex' : 'none';
    }

    async loadDashboardData() {
        try {
            const [stats, users] = await Promise.all([
                this.apiCall('/api/dashboard/stats'),
                this.apiCall('/api/users')
            ]);

            this.updateDashboardStats(stats);
            this.renderUsers(users);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    updateDashboardStats(stats) {
        document.getElementById('totalUsers').textContent = stats.total || 0;
        document.getElementById('adminCount').textContent = stats.admins || 0;
        document.getElementById('activeUsers').textContent = stats.active || 0;
        document.getElementById('recentLogins').textContent = stats.recent_logins || 0;
    }

    renderUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const row = document.createElement('tr');
            const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
            const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Nunca';
            const isAdmin = this.currentUser.role === 'admin';

            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${fullName || 'N/A'}</td>
                <td>${user.email || 'N/A'}</td>
                <td><span class="badge badge-${user.role}">${user.role === 'admin' ? 'Administrador' : 'Usuario'}</span></td>
                <td><span class="status-badge ${user.is_active ? 'active' : 'inactive'}">${user.is_active ? 'Activo' : 'Inactivo'}</span></td>
                <td>${lastLogin}</td>
                <td>
                    ${isAdmin ? `
                        <button class="btn btn-edit" onclick="app.editUser(${user.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger" onclick="app.deleteUser(${user.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    openUserModal(userId = null) {
        this.editingUserId = userId;
        const modal = document.getElementById('userModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('userForm');

        if (userId) {
            title.textContent = 'Editar Usuario';
            // En un caso real, cargarías los datos del usuario
        } else {
            title.textContent = 'Nuevo Usuario';
            form.reset();
        }

        modal.style.display = 'block';
    }

    closeUserModal() {
        document.getElementById('userModal').style.display = 'none';
        document.getElementById('userForm').reset();
        this.editingUserId = null;
    }

    async handleUserSubmit(e) {
        e.preventDefault();

        const username = document.getElementById('userUsername').value;
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;

        const userData = { username, password, role };

        try {
            let response;
            if (this.editingUserId) {
                response = await fetch(`/api/users/${this.editingUserId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(userData),
                });
            } else {
                response = await fetch('/api/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(userData),
                });
            }

            if (response.ok) {
                this.closeUserModal();
                this.loadUsers();
            } else {
                const error = await response.json();
                alert(error.error);
            }
        } catch (error) {
            console.error('Error saving user:', error);
            alert('Error al guardar usuario');
        }
    }

    async editUser(userId) {
        this.openUserModal(userId);
        // En una implementación real, cargarías los datos del usuario
    }

    async deleteUser(userId) {
        if (confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
            try {
                const response = await fetch(`/api/users/${userId}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    this.loadUsers();
                } else {
                    const error = await response.json();
                    alert(error.error);
                }
            } catch (error) {
                console.error('Error deleting user:', error);
                alert('Error al eliminar usuario');
            }
        }
    }

    filterUsers() {
        const searchTerm = document.getElementById('searchUsers').value.toLowerCase();
        const roleFilter = document.getElementById('filterRole').value;
        const rows = document.querySelectorAll('#usersTableBody tr');

        rows.forEach(row => {
            const username = row.cells[1].textContent.toLowerCase();
            const fullName = row.cells[2].textContent.toLowerCase();
            const email = row.cells[3].textContent.toLowerCase();
            const role = row.cells[4].textContent.toLowerCase();

            const matchesSearch = username.includes(searchTerm) ||
                fullName.includes(searchTerm) ||
                email.includes(searchTerm);
            const matchesRole = !roleFilter || role.includes(roleFilter);

            row.style.display = matchesSearch && matchesRole ? '' : 'none';
        });
    }
}

// Utility functions
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.querySelector('.toggle-password i');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        toggleBtn.className = 'fas fa-eye';
    }
}

// Initialize app
const app = new EnterpriseApp();

// Add some CSS for badges
const style = document.createElement('style');
style.textContent = `
    .badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    .badge-admin {
        background: #dc3545;
        color: white;
    }
    .badge-user {
        background: #28a745;
        color: white;
    }
`;
document.head.appendChild(style);
