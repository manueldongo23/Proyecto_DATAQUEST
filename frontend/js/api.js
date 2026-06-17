window.API = {
    async request(endpoint, method = 'GET', data = null) {
        try {
            const options = {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin'
            };
            if (data) options.body = JSON.stringify(data);
            
            // Construir URL relativa
            const basePath = document.baseURI.split('/').slice(0, -1).join('/');
            const url = `${basePath}/index.php/api/${endpoint}`;
            
            console.log('API Request:', method, url);
            
            const res = await fetch(url, options);
            
            if (!res.ok && res.status === 503) {
                const data = await res.json();
                throw new Error(`Servidor indisponible: ${data.message || data.error}`);
            }
            
            return await res.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    get(endpoint) { return this.request(endpoint, 'GET'); },
    post(endpoint, data) { return this.request(endpoint, 'POST', data); }
};