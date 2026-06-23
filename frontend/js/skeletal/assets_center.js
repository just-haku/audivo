// Modular Assets Center Browser for Skeletal Editor
export class AssetsCenter {
    constructor() {
        this.tree = {};
        this.activeCategory = null;
        this.onSelectAssetCallback = null;
        this.onEditAssetCallback = null;
    }

    init(containerId, onSelect, onEdit) {
        this.container = document.getElementById(containerId);
        this.onSelectAssetCallback = onSelect;
        this.onEditAssetCallback = onEdit;
        this.refresh();
    }

    async refresh() {
        try {
            const res = await fetch("/api/skeletal/assets");
            if (res.ok) {
                this.tree = await res.json();
                this.render();
            }
        } catch (e) {
            console.error("Failed to load assets tree:", e);
        }
    }

    render() {
        if (!this.container) return;

        // Custom styled visual tree
        this.container.innerHTML = `
            <div style="display: flex; flex-direction: column; height: 100%; font-size: 13px; color: #cbd5e0;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #2e3547; background: #12151f;">
                    <span style="font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; color: #a0aec0;">Assets Center</span>
                    <button id="assets-refresh-btn" style="background: transparent; border: none; color: #3182ce; cursor: pointer; font-size: 14px;">🔄</button>
                </div>
                <div id="assets-tree-content" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
                    <!-- Categories injected here -->
                </div>
            </div>
        `;

        document.getElementById("assets-refresh-btn").addEventListener("click", () => this.refresh());

        const content = document.getElementById("assets-tree-content");
        for (let cat in this.tree) {
            const catNode = this.tree[cat];
            const catEl = this.createCategoryNode(cat, catNode);
            content.appendChild(catEl);
        }
    }

    createCategoryNode(name, node) {
        const folder = document.createElement("div");
        folder.className = "asset-folder-node";
        folder.style.marginBottom = "5px";
        
        // Human readable names
        const labels = {
            "body_parts": "👤 Body Parts",
            "character": "🎭 Characters",
            "background": "🖼️ Backgrounds",
            "sfx": "🔊 SFX Sounds",
            "bgm": "🎵 BGM Tracks",
            "fx": "✨ FX Templates"
        };
        const label = labels[name] || name;

        folder.innerHTML = `
            <div class="folder-header" style="display: flex; align-items: center; gap: 5px; cursor: pointer; padding: 4px 6px; border-radius: 4px; font-weight: 600; color: #e2e8f0; background: #1a1e29;">
                <span class="folder-arrow" style="font-size: 10px; transition: transform 0.2s;">▶</span>
                <span>${label}</span>
            </div>
            <div class="folder-children" style="display: none; padding-left: 15px; margin-top: 4px; flex-direction: column; gap: 4px;"></div>
        `;

        const header = folder.querySelector(".folder-header");
        const children = folder.querySelector(".folder-children");
        const arrow = folder.querySelector(".folder-arrow");

        header.addEventListener("click", () => {
            const isCollapsed = children.style.display === "none";
            children.style.display = isCollapsed ? "flex" : "none";
            arrow.style.transform = isCollapsed ? "rotate(90deg)" : "rotate(0deg)";
        });

        // Add subfolders
        for (let sub in node.folders) {
            const subNode = node.folders[sub];
            const subEl = this.createSubfolderNode(name, sub, subNode);
            children.appendChild(subEl);
        }

        // Add files
        node.files.forEach(file => {
            const fileEl = this.createFileNode(name, "", file);
            children.appendChild(fileEl);
        });

        return folder;
    }

    createSubfolderNode(category, name, node) {
        const folder = document.createElement("div");
        folder.innerHTML = `
            <div class="subfolder-header" style="display: flex; align-items: center; gap: 5px; cursor: pointer; padding: 3px 5px; border-radius: 3px; color: #a0aec0;">
                <span class="folder-arrow" style="font-size: 9px;">▶</span>
                <span>📁 ${name}</span>
            </div>
            <div class="subfolder-children" style="display: none; padding-left: 12px; margin-top: 2px; flex-direction: column; gap: 3px;"></div>
        `;

        const header = folder.querySelector(".subfolder-header");
        const children = folder.querySelector(".subfolder-children");
        const arrow = folder.querySelector(".folder-arrow");

        header.addEventListener("click", () => {
            const isCollapsed = children.style.display === "none";
            children.style.display = isCollapsed ? "flex" : "none";
            arrow.style.transform = isCollapsed ? "rotate(90deg)" : "rotate(0deg)";
        });

        // Add child subfolders recursive
        for (let sub in node.folders) {
            const subNode = node.folders[sub];
            const subEl = this.createSubfolderNode(category, `${name}/${sub}`, subNode);
            children.appendChild(subEl);
        }

        // Add files
        node.files.forEach(file => {
            const fileEl = this.createFileNode(category, name, file);
            children.appendChild(fileEl);
        });

        return folder;
    }

    createFileNode(category, subpath, filename) {
        const file = document.createElement("div");
        file.className = "asset-file-item";
        file.style.padding = "3px 8px";
        file.style.borderRadius = "3px";
        file.style.cursor = "pointer";
        file.style.fontSize = "12px";
        file.style.color = "#cbd5e0";
        file.style.display = "flex";
        file.style.justifyContent = "space-between";
        file.style.alignItems = "center";
        
        file.innerHTML = `
            <span>📄 ${filename}</span>
            <span class="asset-action-dots" style="font-size: 12px; color: #718096; padding: 0 4px;">⋮</span>
        `;

        // Full path inside category folder tree
        const fullRelPath = subpath ? `${category}/${subpath}/${filename}` : `${category}/${filename}`;

        // Left click to select and attach to bone
        file.addEventListener("click", (e) => {
            if (e.target.classList.contains("asset-action-dots")) return;
            if (this.onSelectAssetCallback) {
                this.onSelectAssetCallback(category, fullRelPath, filename);
            }
        });

        // Custom Context menu dropdown trigger
        const dots = file.querySelector(".asset-action-dots");
        dots.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showAssetContextMenu(e.clientX, e.clientY, category, subpath, filename, fullRelPath);
        });

        // Hover highlights
        file.addEventListener("mouseenter", () => file.style.background = "#2d3748");
        file.addEventListener("mouseleave", () => file.style.background = "transparent");

        return file;
    }

    showAssetContextMenu(x, y, category, subpath, filename, relPath) {
        // Remove existing context menu if any
        const oldMenu = document.getElementById("asset-context-menu");
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement("div");
        menu.id = "asset-context-menu";
        menu.style.position = "fixed";
        menu.style.top = `${y}px`;
        menu.style.left = `${x}px`;
        menu.style.background = "#1a1e29";
        menu.style.border = "1px solid #2e3547";
        menu.style.borderRadius = "4px";
        menu.style.padding = "4px 0";
        menu.style.zIndex = "10000";
        menu.style.boxShadow = "0 4px 15px rgba(0,0,0,0.5)";
        menu.style.display = "flex";
        menu.style.flexDirection = "column";

        const optEdit = document.createElement("div");
        optEdit.innerText = "🎨 Open in Editor";
        this.styleContextOption(optEdit);
        optEdit.addEventListener("click", () => {
            menu.remove();
            if (this.onEditAssetCallback) {
                this.onEditAssetCallback(category, subpath, filename, relPath);
            }
        });

        const optAttach = document.createElement("div");
        optAttach.innerText = "🔗 Attach to Selected Bone";
        this.styleContextOption(optAttach);
        optAttach.addEventListener("click", () => {
            menu.remove();
            if (this.onSelectAssetCallback) {
                this.onSelectAssetCallback(category, relPath, filename);
            }
        });

        const optPlay = document.createElement("div");
        optPlay.innerText = "🔊 Play / Listen";
        this.styleContextOption(optPlay);
        optPlay.addEventListener("click", () => {
            menu.remove();
            this.playAudioFile(relPath);
        });

        // Filter options based on file type
        const ext = filename.split(".").pop().toLowerCase();
        const isImage = ["png", "jpg", "jpeg"].includes(ext);
        const isAudio = ["mp3", "wav"].includes(ext);

        if (isImage) {
            menu.appendChild(optEdit);
            menu.appendChild(optAttach);
        } else if (isAudio) {
            menu.appendChild(optPlay);
        }

        document.body.appendChild(menu);

        // Click outside closes
        const closeHandler = () => {
            menu.remove();
            document.removeEventListener("click", closeHandler);
        };
        setTimeout(() => document.addEventListener("click", closeHandler), 10);
    }

    styleContextOption(el) {
        el.style.padding = "8px 15px";
        el.style.cursor = "pointer";
        el.style.fontSize = "13px";
        el.style.color = "#cbd5e0";
        el.addEventListener("mouseenter", () => el.style.background = "#2d3748");
        el.addEventListener("mouseleave", () => el.style.background = "transparent");
    }

    playAudioFile(relPath) {
        // Construct full URL pointing to uploads cache
        const audioUrl = `/api/materials/uploads/${relPath}`;
        const audio = new Audio(audioUrl);
        audio.play().catch(e => console.error("Audio playback failed:", e));
    }
}
