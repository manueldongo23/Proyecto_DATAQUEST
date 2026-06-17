window.Auth = {
    async login(correo, password) {
        try {
            return await API.post('auth/login', { correo, password });
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    },
    async register(correo, apodo, password) {
        try {
            return await API.post('auth/register', { correo, apodo, password });
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, error: error.message };
        }
    },
    async guest() {
        try {
            return await API.post('auth/guest');
        } catch (error) {
            console.error('Guest error:', error);
            return { success: false, error: error.message };
        }
    },
    async logout() {
        try {
            await API.get('auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        }
        window.location.reload();
    },
    async me() {
        try {
            return await API.get('auth/me');
        } catch (error) {
            console.error('Auth check error:', error);
            return { authenticated: false, error: error.message };
        }
    }
};