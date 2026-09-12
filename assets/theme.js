(() => {
    'use strict';
    const root = document.documentElement;
    const key = 'steevin-theme';
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    let preference;
    try { preference = localStorage.getItem(key); } catch (_) {}
    const valid = value => value === 'dark' || value === 'light';
    let button;
    function apply() {
        const dark = valid(preference) ? preference === 'dark' : system.matches;
        root.dataset.theme = dark ? 'dark' : 'light';
        root.style.colorScheme = root.dataset.theme;
        document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
            meta.content = dark ? '#111815' : '#f7f7f4';
        });
        if (button) {
            const english = root.lang.startsWith('en');
            button.textContent = dark ? (english ? '☀ Light mode' : '☀ Modo claro') : (english ? '☾ Dark mode' : '☾ Modo oscuro');
            button.setAttribute('aria-label', english ? 'Dark mode' : 'Modo oscuro');
            button.setAttribute('aria-pressed', String(dark));
        }
    }
    apply();
    system.addEventListener('change', apply);
    window.addEventListener('storage', event => {
        if (event.key === key || event.key === null) { preference = event.newValue; apply(); }
    });
    document.addEventListener('DOMContentLoaded', () => {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-toggle';
        button.addEventListener('click', () => {
            preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem(key, preference); } catch (_) {}
            apply();
        });
        document.body.append(button);
        apply();
        new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['lang'] });
    });
})();
