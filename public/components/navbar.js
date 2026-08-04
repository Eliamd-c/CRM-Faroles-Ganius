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
    }
});
