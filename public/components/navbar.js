document.addEventListener("DOMContentLoaded", () => {
    const navbarHTML = `
    <header class="crm-header">
        <div class="crm-header-left">
            <h1 class="crm-logo">🤖 Faroles Genius <span>CRM</span></h1>
            <nav class="crm-nav">
                <a href="/" class="nav-link" data-path="/">Monitor</a>
                <a href="/automations.html" class="nav-link" data-path="/automations.html">Automatizaciones</a>
                <a href="/welcome-ads.html" class="nav-link" data-path="/welcome-ads.html">Welcome Ads</a>
                <a href="/builder.html" class="nav-link" data-path="/builder.html">Flow Builder</a>
                <a href="/ai-config.html" class="nav-link" data-path="/ai-config.html">Configuración IA</a>
                <a href="/contacts.html" class="nav-link" data-path="/contacts.html">Contactos</a>
                <a href="/insights.html" class="nav-link" data-path="/insights.html">Insights</a>
            </nav>
        </div>
        <div class="crm-header-right">
            <a href="/auth/instagram" class="crm-btn-connect" id="global-btn-connect">
                <i class="fa-brands fa-instagram"></i> Conectar Instagram
            </a>
            <div class="crm-status-badge" id="global-status-badge">
                <div class="pulse"></div>
                Escuchando API
            </div>
        </div>
    </header>
    `;
    
    const container = document.getElementById('global-navbar');
    if (container) {
        container.innerHTML = navbarHTML;
        
        // Marcar el link activo según la URL
        let path = window.location.pathname;
        if (path === '/index.html') path = '/';
        const links = container.querySelectorAll('.nav-link');
        links.forEach(link => {
            if (link.getAttribute('data-path') === path) {
                link.classList.add('active');
            }
        });
        
        // Comprobar estado de conexión y ajustar botón
        const btnConnect = document.getElementById('global-btn-connect');
        const badge = document.getElementById('global-status-badge');
        
        if (btnConnect) {
            // Revisa si getAuthHeader está disponible para pasarlo
            const headers = typeof getAuthHeader === 'function' ? getAuthHeader() : {};
            
            fetch('/api/auth/status', { headers })
                .then(res => res.json())
                .then(data => {
                    if (data.connected) {
                        btnConnect.innerHTML = '<i class="fa-brands fa-instagram"></i> Desconectar';
                        btnConnect.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                        btnConnect.href = '#';
                        if (badge) badge.style.display = 'flex';
                        
                        btnConnect.onclick = (e) => {
                            e.preventDefault();
                            if (confirm('¿Estás seguro de que deseas desconectar Instagram? Las automatizaciones dejarán de funcionar.')) {
                                fetch('/api/auth/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } })
                                    .then(res => res.json())
                                    .then(() => window.location.reload())
                                    .catch(err => console.error('Error desconectando:', err));
                            }
                        };
                    } else {
                        btnConnect.innerHTML = '<i class="fa-brands fa-instagram"></i> Conectar Instagram';
                        btnConnect.href = '/auth/instagram';
                        if (badge) badge.style.display = 'none';
                    }
                })
                .catch(err => console.error('Error verificando estado:', err));
        }
    }
});
