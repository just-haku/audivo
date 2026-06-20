import { icon } from './icons.js';
import { t } from './translations.js';

export class PanelManager {
    constructor() {
        this.panels = {};
        this.activePanelId = null;
        this.setupEscapeListener();
    }

    register(id, { iconName, elementId, tooltipKey }) {
        this.panels[id] = {
            iconName,
            elementId,
            tooltipKey,
            element: document.getElementById(elementId)
        };
    }

    init() {
        this.createToolbar();
        this.wrapPanels();
    }

    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'sidebar-toolbar';
        
        // Add logo at top of toolbar
        const logoItem = document.createElement('div');
        logoItem.className = 'toolbar-logo';
        logoItem.innerHTML = icon('rocket', { size: 24, className: 'text-primary' });
        logoItem.title = 'TurboVideo Studio';
        toolbar.appendChild(logoItem);

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'toolbar-buttons';

        for (const [id, config] of Object.entries(this.panels)) {
            const btn = document.createElement('button');
            btn.className = 'toolbar-btn';
            btn.dataset.panelId = id;
            btn.innerHTML = icon(config.iconName, { size: 20 });
            
            // CSS tooltip
            btn.setAttribute('data-tooltip', t(config.tooltipKey));
            
            btn.addEventListener('click', () => this.toggle(id));
            buttonsContainer.appendChild(btn);
        }

        toolbar.appendChild(buttonsContainer);

        // Add language toggle placeholder or support if needed at bottom
        const bottomArea = document.createElement('div');
        bottomArea.className = 'toolbar-bottom';
        toolbar.appendChild(bottomArea);

        // Prepend toolbar to body
        document.body.appendChild(toolbar);
    }

    wrapPanels() {
        // Prepare side panel containers
        for (const [id, config] of Object.entries(this.panels)) {
            const el = config.element;
            if (!el) continue;

            // Make sure the panel has the correct classes and structure
            el.classList.add('side-panel');
            el.style.display = 'flex'; // Use flex for layout inside panel
            
            // Add a title bar/header to the panel if it doesn't have one
            let header = el.querySelector('.side-panel-header');
            if (!header) {
                header = document.createElement('div');
                header.className = 'side-panel-header';
                
                const titleSpan = document.createElement('span');
                titleSpan.className = 'side-panel-title';
                titleSpan.dataset.i18n = config.tooltipKey; // for dynamic translations
                titleSpan.textContent = t(config.tooltipKey);
                
                const closeBtn = document.createElement('button');
                closeBtn.className = 'side-panel-close-btn';
                closeBtn.innerHTML = icon('x', { size: 18 });
                closeBtn.addEventListener('click', () => this.close(id));
                
                header.appendChild(titleSpan);
                header.appendChild(closeBtn);
                el.insertBefore(header, el.firstChild);
            }
        }
    }

    toggle(id) {
        if (this.activePanelId === id) {
            this.close(id);
        } else {
            if (this.activePanelId) {
                this.close(this.activePanelId);
            }
            this.open(id);
        }
    }

    open(id) {
        const panel = this.panels[id];
        if (!panel || !panel.element) return;

        panel.element.classList.add('open');
        this.activePanelId = id;

        // Highlight toolbar button
        const btn = document.querySelector(`.toolbar-btn[data-panel-id="${id}"]`);
        if (btn) btn.classList.add('active');
        
        // Custom event so components can refresh their data (e.g. gallery load, system status poll)
        panel.element.dispatchEvent(new CustomEvent('panelOpen', { detail: { id } }));
    }

    close(id) {
        const panel = this.panels[id];
        if (!panel || !panel.element) return;

        panel.element.classList.remove('open');
        if (this.activePanelId === id) {
            this.activePanelId = null;
        }

        // Remove highlight from toolbar button
        const btn = document.querySelector(`.toolbar-btn[data-panel-id="${id}"]`);
        if (btn) btn.classList.remove('active');
        
        panel.element.dispatchEvent(new CustomEvent('panelClose', { detail: { id } }));
    }

    closeAll() {
        if (this.activePanelId) {
            this.close(this.activePanelId);
        }
    }

    setupEscapeListener() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activePanelId) {
                // Don't close if a modal is currently open to prevent overlay conflict
                const modals = document.querySelectorAll('.modal-overlay');
                let modalVisible = false;
                modals.forEach(m => {
                    if (m.style.display !== 'none') modalVisible = true;
                });
                if (!modalVisible) {
                    this.close(this.activePanelId);
                }
            }
        });
    }

    updateTranslations() {
        // Update tooltips
        for (const [id, config] of Object.entries(this.panels)) {
            const btn = document.querySelector(`.toolbar-btn[data-panel-id="${id}"]`);
            if (btn) {
                btn.setAttribute('data-tooltip', t(config.tooltipKey));
            }
            
            const titleSpan = config.element?.querySelector('.side-panel-title');
            if (titleSpan) {
                titleSpan.textContent = t(config.tooltipKey);
            }
        }
    }
}
