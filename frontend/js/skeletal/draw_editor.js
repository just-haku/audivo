// MS-Paint-like Drawing Editor with Layers, Shapes, Lasso selection, and Color Spray
export class DrawingEditor {
    constructor() {
        this.layers = [];
        this.activeLayerIndex = -1;
        this.tool = "pen"; // pen, eraser, spray, bucket, picker, shapes, lasso
        this.shapeType = "line"; // line, circle, ellipse, triangle, quadragon, pentagon, hexagon, star
        this.brushColor = "#ffffff";
        this.brushSize = 4;
        this.opacity = 1.0;
        
        // Lasso select states
        this.lassoPoints = [];
        this.lassoActive = false;
        this.selectedRegion = null; // { canvas, x, y, width, height }
        this.draggingSelection = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        
        // Undo / Redo & Clipboard
        this.historyStack = [];
        this.redoStack = [];
        this.clipboard = null;
        this.sprayInterval = null;

        this.onSaveCallback = null;
        this.category = "body_parts";
        this.subfolder = "";
        this.filename = "sprite.png";
    }

    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        // Reset container content with dark overlay layout using clean CSS classes
        this.container.innerHTML = `
            <div class="draw-editor-modal" style="display: flex; flex-direction: column; width: 90%; height: 90%; max-width: 1200px; overflow: hidden; user-select: none;">
                <!-- Header -->
                <div class="draw-editor-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>MS-Paint Drawing Studio</h3>
                    <button id="draw-close-btn">&times;</button>
                </div>
                
                <!-- Main Body -->
                <div style="display: flex; flex: 1; overflow: hidden; position: relative;">
                    <!-- Tool shelf (Left) -->
                    <div class="draw-editor-sidebar" style="border-right: 1px solid rgba(255, 255, 255, 0.06); display: flex; flex-direction: column; padding: 1.25rem; gap: 1.25rem; overflow-y: auto;">
                        <div>
                            <label>Drawing Tool</label>
                            <select id="draw-tool-sel">
                                <option value="pen">Pencil / Pen</option>
                                <option value="eraser">Eraser</option>
                                <option value="spray">Color Spray</option>
                                <option value="bucket">Paint Bucket</option>
                                <option value="picker">Color Picker</option>
                                <option value="shapes">Draw Shapes</option>
                                <option value="lasso">Lasso Selection</option>
                            </select>
                        </div>
                        
                        <div id="shape-select-container" style="display: none;">
                            <label>Shape Type</label>
                            <select id="draw-shape-sel">
                                <option value="line">Line</option>
                                <option value="circle">Circle</option>
                                <option value="ellipse">Ellipse</option>
                                <option value="triangle">Triangle</option>
                                <option value="quadragon">Quadragon</option>
                                <option value="pentagon">Pentagon</option>
                                <option value="hexagon">Hexagon</option>
                                <option value="star">Star</option>
                            </select>
                        </div>

                        <div id="shape-mode-container" style="display: none;">
                            <label>Shape Fill</label>
                            <select id="draw-shape-mode">
                                <option value="stroke">Outline Only</option>
                                <option value="fill">Fill Only</option>
                                <option value="both">Outline & Fill</option>
                            </select>
                        </div>
                        
                        <div>
                            <label>Color</label>
                            <input type="color" id="draw-color-pick" value="#ffffff">
                        </div>
                        
                        <div>
                            <label>Brush Size</label>
                            <input type="range" id="draw-size-slider" min="1" max="100" value="4" style="width: 100%;">
                            <span id="draw-size-lbl" style="font-size: 11px; color: var(--text-muted);">4px</span>
                        </div>

                        <div>
                            <label>Guide Opacity</label>
                            <input type="range" id="draw-guide-opacity" min="0" max="100" value="30" style="width: 100%;">
                            <span id="draw-guide-lbl" style="font-size: 11px; color: var(--text-muted);">30%</span>
                        </div>
                        
                        <div style="margin-top: auto; padding-top: 1rem;">
                            <button id="draw-clear-layer" class="draw-editor-btn-clear">Clear Layer</button>
                        </div>
                    </div>
                    
                    <!-- Viewport (Center) -->
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at center, #0e111d 0%, #06070a 100%); overflow: auto; position: relative;">
                        <!-- Canvas wrapper centered with mask lines -->
                        <div id="canvas-mask-wrapper" style="position: relative; width: 512px; height: 512px; box-shadow: 0 10px 30px rgba(0,0,0,0.7); background-image: repeating-conic-gradient(#101320 0% 25%, #181d2f 0% 50%); background-size: 20px 20px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.08);">
                            <!-- Guide Canvas Overlay (z-index 0) -->
                            <canvas id="guide-canvas" width="512" height="512" style="position: absolute; top:0; left:0; pointer-events: none; z-index: 0; opacity: 0.3;"></canvas>
                            <!-- Active and composite canvases will stack here -->
                            <div id="draw-canvas-container" style="position: absolute; width: 512px; height: 512px; top: 0; left: 0; z-index: 1;"></div>
                            <!-- Selection canvas overlay -->
                            <canvas id="selection-canvas" width="512" height="512" style="position: absolute; top:0; left:0; pointer-events: none; z-index: 99;"></canvas>
                        </div>
                    </div>
                    
                    <!-- Layers Shelf (Right) -->
                    <div class="draw-editor-sidebar" style="border-left: 1px solid rgba(255, 255, 255, 0.06); display: flex; flex-direction: column; padding: 1.25rem; gap: 1.25rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <label style="margin: 0 !important;">Layers</label>
                            <button id="add-layer-btn" class="draw-editor-btn-add">+ Add</button>
                        </div>
                        
                        <div id="layers-list-el" style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto;">
                            <!-- layers injected here -->
                        </div>
                        
                        <!-- File Export configuration -->
                        <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
                            <div>
                                <label>Category</label>
                                <select id="export-category">
                                    <option value="body_parts">Body Parts</option>
                                    <option value="background">Background</option>
                                    <option value="fx">FX</option>
                                </select>
                            </div>
                            <div>
                                <label>Subfolder / Char Name</label>
                                <input type="text" id="export-subfolder" placeholder="ninja">
                            </div>
                            <div>
                                <label>Filename</label>
                                <input type="text" id="export-filename" value="torso.png">
                            </div>
                            
                            <button id="draw-output-btn" class="draw-editor-btn-output" style="margin-top: 0.5rem;">Output Assets</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add Listeners
        document.getElementById("draw-close-btn").addEventListener("click", () => this.hide());
        document.getElementById("draw-tool-sel").addEventListener("change", (e) => this.setTool(e.target.value));
        document.getElementById("draw-shape-sel").addEventListener("change", (e) => this.shapeType = e.target.value);
        document.getElementById("draw-color-pick").addEventListener("input", (e) => this.brushColor = e.target.value);
        document.getElementById("draw-size-slider").addEventListener("input", (e) => {
            this.brushSize = parseInt(e.target.value);
            document.getElementById("draw-size-lbl").innerText = this.brushSize + "px";
        });
        document.getElementById("draw-clear-layer").addEventListener("click", () => {
            this.saveHistory();
            this.clearActiveLayer();
        });
        document.getElementById("add-layer-btn").addEventListener("click", () => {
            this.saveHistory();
            this.addNewLayer();
        });
        document.getElementById("draw-output-btn").addEventListener("click", () => this.saveAsset());

        // Guide opacity listener
        document.getElementById("draw-guide-opacity").addEventListener("input", (e) => {
            const val = e.target.value;
            document.getElementById("draw-guide-lbl").innerText = val + "%";
            const guideCanvas = document.getElementById("guide-canvas");
            if (guideCanvas) {
                guideCanvas.style.opacity = parseFloat(val) / 100;
            }
        });

        // Configure canvas stack mouse bindings
        const wrap = document.getElementById("canvas-mask-wrapper");
        wrap.addEventListener("mousedown", this.onMouseDown.bind(this));
        wrap.addEventListener("mousemove", this.onMouseMove.bind(this));
        wrap.addEventListener("mouseup", this.onMouseUp.bind(this));
        wrap.addEventListener("mouseleave", this.onMouseUp.bind(this));

        // Keyboard bindings
        window.addEventListener("keydown", this.onKeyDown.bind(this));

        // Create standard Layer 1
        this.layers = [];
        this.addNewLayer("Base Layer");
        this.historyStack = [];
        this.redoStack = [];
    }

    show(category = "body_parts", subfolder = "", filename = "sprite.png", onSave = null) {
        this.category = category;
        this.subfolder = subfolder;
        this.filename = filename;
        this.onSaveCallback = onSave;

        if (this.container) {
            this.container.style.display = "flex";
        }

        // Enable scroll lock on the body
        document.body.classList.add("modal-open");

        // Setup values
        const catEl = document.getElementById("export-category");
        const subEl = document.getElementById("export-subfolder");
        const fnEl = document.getElementById("export-filename");
        if (catEl) catEl.value = category;
        if (subEl) subEl.value = subfolder;
        if (fnEl) fnEl.value = filename;

        this.renderLayersList();
    }

    hide() {
        if (this.container) {
            this.container.style.display = "none";
        }
        if (this.sprayInterval) {
            clearInterval(this.sprayInterval);
            this.sprayInterval = null;
        }

        // Only remove scroll lock if the main animator studio is not open
        const animatorStudio = document.getElementById("animator-studio");
        if (!animatorStudio || !animatorStudio.classList.contains("open")) {
            document.body.classList.remove("modal-open");
        }
    }

    addNewLayer(name = null) {
        const idx = this.layers.length + 1;
        name = name || `Layer ${idx}`;
        
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.zIndex = idx;
        
        const ctx = canvas.getContext("2d");
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const layer = {
            id: uuidv4(),
            name: name,
            visible: true,
            opacity: 1.0,
            canvas: canvas,
            ctx: ctx
        };

        this.layers.push(layer);
        this.activeLayerIndex = this.layers.length - 1;

        // Injects to wrapper
        const stack = document.getElementById("draw-canvas-container");
        if (stack) stack.appendChild(canvas);

        this.renderLayersList();
    }

    setTool(tool) {
        this.tool = tool;
        const shapesSel = document.getElementById("shape-select-container");
        const shapesMode = document.getElementById("shape-mode-container");
        if (shapesSel) {
            shapesSel.style.display = tool === "shapes" ? "block" : "none";
        }
        if (shapesMode) {
            shapesMode.style.display = tool === "shapes" ? "block" : "none";
        }
        // Reset lasso select overlay when switching tools
        if (tool !== "lasso") {
            if (this.selectedRegion) {
                this.saveHistory();
                const layer = this.layers[this.activeLayerIndex];
                if (layer) {
                    layer.ctx.drawImage(this.selectedRegion.canvas, this.selectedRegion.x, this.selectedRegion.y);
                }
                this.selectedRegion = null;
            }
            this.lassoPoints = [];
            this.lassoActive = false;
            this.clearSelectionCanvas();
        }
    }

    clearActiveLayer() {
        const layer = this.layers[this.activeLayerIndex];
        if (layer) {
            layer.ctx.clearRect(0, 0, 512, 512);
        }
    }

    renderLayersList() {
        const el = document.getElementById("layers-list-el");
        if (!el) return;
        el.innerHTML = "";

        // Render stacked bottom-to-top, list displays top-to-bottom
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            const isActive = i === this.activeLayerIndex;
            
            const div = document.createElement("div");
            div.className = `draw-layer-item ${isActive ? "active" : ""}`;

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span class="draw-layer-title">${layer.name}</span>
                    <div class="draw-layer-controls">
                        <span class="layer-up-btn draw-layer-btn" title="Move Up">▲</span>
                        <span class="layer-down-btn draw-layer-btn" title="Move Down">▼</span>
                        <span class="layer-eye-btn draw-layer-btn" style="color: ${layer.visible ? "inherit" : "#4a5568"};" title="Toggle Visibility">👁️</span>
                        <span class="layer-del-btn draw-layer-btn draw-layer-btn-del" title="Delete Layer">🗑️</span>
                    </div>
                </div>
                <div class="draw-layer-opacity-container" style="width: 100%;">
                    <span class="draw-layer-opacity-label">Opacity:</span>
                    <input type="range" class="layer-op-slider" min="0" max="100" value="${layer.opacity * 100}" style="flex: 1;">
                </div>
            `;

            // Bind selectors
            div.addEventListener("click", (e) => {
                if (e.target.classList.contains("layer-eye-btn") || e.target.classList.contains("layer-op-slider") || e.target.classList.contains("layer-del-btn") || e.target.classList.contains("layer-up-btn") || e.target.classList.contains("layer-down-btn")) return;
                this.activeLayerIndex = i;
                this.renderLayersList();
            });

            div.querySelector(".layer-up-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                if (i >= this.layers.length - 1) return;
                this.saveHistory();
                const temp = this.layers[i];
                this.layers[i] = this.layers[i + 1];
                this.layers[i + 1] = temp;
                
                // Update z-index
                this.layers.forEach((l, idx) => {
                    l.canvas.style.zIndex = idx + 1;
                });
                
                if (this.activeLayerIndex === i) this.activeLayerIndex = i + 1;
                else if (this.activeLayerIndex === i + 1) this.activeLayerIndex = i;
                
                this.renderLayersList();
            });

            div.querySelector(".layer-down-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                if (i <= 0) return;
                this.saveHistory();
                const temp = this.layers[i];
                this.layers[i] = this.layers[i - 1];
                this.layers[i - 1] = temp;
                
                // Update z-index
                this.layers.forEach((l, idx) => {
                    l.canvas.style.zIndex = idx + 1;
                });
                
                if (this.activeLayerIndex === i) this.activeLayerIndex = i - 1;
                else if (this.activeLayerIndex === i - 1) this.activeLayerIndex = i;
                
                this.renderLayersList();
            });

            div.querySelector(".layer-eye-btn").addEventListener("click", () => {
                layer.visible = !layer.visible;
                layer.canvas.style.display = layer.visible ? "block" : "none";
                this.renderLayersList();
            });

            div.querySelector(".layer-del-btn").addEventListener("click", () => {
                if (this.layers.length <= 1) return;
                this.saveHistory();
                layer.canvas.remove();
                this.layers.splice(i, 1);
                this.activeLayerIndex = Math.max(0, this.activeLayerIndex - 1);
                this.renderLayersList();
            });

            div.querySelector(".layer-op-slider").addEventListener("input", (e) => {
                layer.opacity = parseFloat(e.target.value) / 100;
                layer.canvas.style.opacity = layer.opacity;
            });

            el.appendChild(div);
        }
    }

    onMouseDown(e) {
        if (this.activeLayerIndex === -1) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);

        const layer = this.layers[this.activeLayerIndex];
        const ctx = layer.ctx;

        if (this.tool === "lasso") {
            if (this.selectedRegion && this.isInsideRegion(x, y, this.selectedRegion)) {
                this.saveHistory();
                this.draggingSelection = true;
                this.dragStartX = x - this.selectedRegion.x;
                this.dragStartY = y - this.selectedRegion.y;
            } else {
                if (this.selectedRegion) {
                    this.saveHistory();
                    layer.ctx.drawImage(this.selectedRegion.canvas, this.selectedRegion.x, this.selectedRegion.y);
                }
                this.selectedRegion = null;
                this.lassoActive = true;
                this.lassoPoints = [[x, y]];
            }
            return;
        }

        this.saveHistory();

        if (this.tool === "spray") {
            this.isDrawing = true;
            this.lastX = x;
            this.lastY = y;
            this.sprayCan(ctx, x, y);
            this.sprayInterval = setInterval(() => {
                const activeL = this.layers[this.activeLayerIndex];
                if (activeL) {
                    this.sprayCan(activeL.ctx, this.lastX, this.lastY);
                }
            }, 30);
            return;
        }

        this.isDrawing = true;
        this.lastX = x;
        this.lastY = y;

        if (this.tool === "bucket") {
            this.floodFill(ctx, x, y, this.brushColor);
            this.isDrawing = false;
        } else if (this.tool === "picker") {
            this.pickColor(e.currentTarget, x, y);
            this.isDrawing = false;
        } else if (this.tool === "shapes") {
            // Save state for shape preview
            this.shapeStartX = x;
            this.shapeStartY = y;
            this.savedImageData = ctx.getImageData(0, 0, 512, 512);
        }
    }

    onMouseMove(e) {
        if (this.activeLayerIndex === -1) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);

        const layer = this.layers[this.activeLayerIndex];
        const ctx = layer.ctx;

        if (this.tool === "lasso") {
            if (this.draggingSelection && this.selectedRegion) {
                this.selectedRegion.x = x - this.dragStartX;
                this.selectedRegion.y = y - this.dragStartY;
                this.drawSelectionOverlay();
            } else if (this.lassoActive) {
                this.lassoPoints.push([x, y]);
                this.drawLassoPath();
            }
            return;
        }

        if (this.tool === "spray") {
            this.lastX = x;
            this.lastY = y;
            return;
        }

        if (!this.isDrawing) return;

        if (this.tool === "pen") {
            ctx.beginPath();
            ctx.moveTo(this.lastX, this.lastY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = this.brushColor;
            ctx.lineWidth = this.brushSize;
            ctx.stroke();
            
            this.lastX = x;
            this.lastY = y;
        } else if (this.tool === "eraser") {
            ctx.beginPath();
            ctx.moveTo(this.lastX, this.lastY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = "rgba(0,0,0,0)";
            ctx.globalCompositeOperation = "destination-out";
            ctx.lineWidth = this.brushSize;
            ctx.stroke();
            ctx.globalCompositeOperation = "source-over";
            
            this.lastX = x;
            this.lastY = y;
        } else if (this.tool === "shapes") {
            // Restore clean state and draw shape outline
            ctx.putImageData(this.savedImageData, 0, 0);
            this.drawShape(ctx, this.shapeStartX, this.shapeStartY, x, y);
        }
    }

    onMouseUp(e) {
        if (this.activeLayerIndex === -1) return;
        this.isDrawing = false;
        
        if (this.sprayInterval) {
            clearInterval(this.sprayInterval);
            this.sprayInterval = null;
        }

        if (this.tool === "lasso") {
            if (this.draggingSelection) {
                this.draggingSelection = false;
                this.drawSelectionOverlay();
            } else if (this.lassoActive) {
                this.lassoActive = false;
                this.closeLassoSelection();
            }
        }
    }

    floodFill(ctx, startX, startY, fillHex) {
        const imgData = ctx.getImageData(0, 0, 512, 512);
        const data = imgData.data;
        
        const targetColor = this.getPixelColor(data, startX, startY);
        const fillColor = this.hexToRgb(fillHex);
        
        if (this.colorsMatch(targetColor, fillColor)) return;
        
        const queue = [startX, startY];
        let head = 0;
        
        while (head < queue.length) {
            const x = queue[head++];
            const y = queue[head++];
            
            if (x < 0 || x >= 512 || y < 0 || y >= 512) continue;
            
            const currColor = this.getPixelColor(data, x, y);
            if (this.colorsMatch(currColor, targetColor)) {
                this.setPixelColor(data, x, y, fillColor);
                
                queue.push(x + 1, y);
                queue.push(x - 1, y);
                queue.push(x, y + 1);
                queue.push(x, y - 1);
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }

    getPixelColor(data, x, y) {
        const idx = (y * 512 + x) * 4;
        return { r: data[idx], g: data[idx+1], b: data[idx+2], a: data[idx+3] };
    }

    setPixelColor(data, x, y, rgb) {
        const idx = (y * 512 + x) * 4;
        data[idx] = rgb.r;
        data[idx+1] = rgb.g;
        data[idx+2] = rgb.b;
        data[idx+3] = 255;
    }

    colorsMatch(c1, c2) {
        return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b && Math.abs((c1.a || 255) - (c2.a || 255)) < 15;
    }

    hexToRgb(hex) {
        const bigint = parseInt(hex.replace("#", ""), 16);
        return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255
        };
    }

    pickColor(wrapper, x, y) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 512;
        tempCanvas.height = 512;
        const tempCtx = tempCanvas.getContext("2d");
        
        this.layers.forEach(layer => {
            if (layer.visible) {
                tempCtx.globalAlpha = layer.opacity;
                tempCtx.drawImage(layer.canvas, 0, 0);
            }
        });
        
        const data = tempCtx.getImageData(x, y, 1, 1).data;
        const hex = "#" + ((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1);
        this.brushColor = hex;
        
        const picker = document.getElementById("draw-color-pick");
        if (picker) picker.value = hex;
    }

    sprayCan(ctx, cx, cy) {
        const density = 20;
        ctx.fillStyle = this.brushColor;
        for (let i = 0; i < density; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * this.brushSize * 2;
            const sx = Math.round(cx + Math.cos(angle) * radius);
            const sy = Math.round(cy + Math.sin(angle) * radius);
            if (sx >= 0 && sx < 512 && sy >= 0 && sy < 512) {
                ctx.fillRect(sx, sy, 1, 1);
            }
        }
    }

    drawShape(ctx, x1, y1, x2, y2) {
        ctx.strokeStyle = this.brushColor;
        ctx.lineWidth = this.brushSize;
        ctx.fillStyle = this.brushColor;
        ctx.beginPath();
        
        if (this.shapeType === "line") {
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        } else if (this.shapeType === "circle") {
            const r = Math.hypot(x2 - x1, y2 - y1);
            ctx.arc(x1, y1, r, 0, 2 * Math.PI);
        } else if (this.shapeType === "ellipse") {
            const rx = Math.abs(x2 - x1);
            const ry = Math.abs(y2 - y1);
            ctx.ellipse(x1, y1, rx, ry, 0, 0, 2 * Math.PI);
        } else if (this.shapeType === "triangle") {
            ctx.moveTo((x1 + x2)/2, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x1, y2);
            ctx.closePath();
        } else if (this.shapeType === "quadragon") {
            ctx.rect(x1, y1, x2 - x1, y2 - y1);
        } else if (this.shapeType === "pentagon" || this.shapeType === "hexagon") {
            const sides = this.shapeType === "pentagon" ? 5 : 6;
            const r = Math.hypot(x2 - x1, y2 - y1);
            for (let i = 0; i < sides; i++) {
                const angle = i * 2 * Math.PI / sides - Math.PI/2;
                const px = x1 + Math.cos(angle) * r;
                const py = y1 + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        } else if (this.shapeType === "star") {
            const spikes = 5;
            const outerRadius = Math.hypot(x2 - x1, y2 - y1);
            const innerRadius = outerRadius / 2.5;
            let rot = Math.PI / 2 * 3;
            let cx = x1, cy = y1;
            let step = Math.PI / spikes;

            ctx.moveTo(cx, cy - outerRadius);
            for (let i = 0; i < spikes; i++) {
                let px = cx + Math.cos(rot) * outerRadius;
                let py = cy + Math.sin(rot) * outerRadius;
                ctx.lineTo(px, py);
                rot += step;

                px = cx + Math.cos(rot) * innerRadius;
                let y_inner = cy + Math.sin(rot) * innerRadius;
                ctx.lineTo(px, y_inner);
                rot += step;
            }
            ctx.lineTo(cx, cy - outerRadius);
            ctx.closePath();
        }
        
        const mode = document.getElementById("draw-shape-mode")?.value || "stroke";
        if (mode === "fill") {
            ctx.fill();
        } else if (mode === "both") {
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.stroke();
        }
    }

    drawLassoPath() {
        const scan = document.getElementById("selection-canvas");
        const sctx = scan.getContext("2d");
        sctx.clearRect(0, 0, 512, 512);
        
        sctx.strokeStyle = "#3182ce";
        sctx.lineWidth = 1.5;
        sctx.setLineDash([5, 5]);
        
        sctx.beginPath();
        this.lassoPoints.forEach((pt, i) => {
            if (i === 0) sctx.moveTo(pt[0], pt[1]);
            else sctx.lineTo(pt[0], pt[1]);
        });
        sctx.stroke();
    }

    closeLassoSelection() {
        if (this.lassoPoints.length < 3) return;
        const layer = this.layers[this.activeLayerIndex];
        
        let minX = 512, maxX = 0, minY = 512, maxY = 0;
        this.lassoPoints.forEach(pt => {
            minX = Math.min(minX, pt[0]);
            maxX = Math.max(maxX, pt[0]);
            minY = Math.min(minY, pt[1]);
            maxY = Math.max(maxY, pt[1]);
        });
        
        const w = maxX - minX;
        const h = maxY - minY;
        if (w <= 1 || h <= 1) return;

        const selCanvas = document.createElement("canvas");
        selCanvas.width = w;
        selCanvas.height = h;
        const selCtx = selCanvas.getContext("2d");

        selCtx.beginPath();
        this.lassoPoints.forEach((pt, i) => {
            if (i === 0) selCtx.moveTo(pt[0] - minX, pt[1] - minY);
            else selCtx.lineTo(pt[0] - minX, pt[1] - minY);
        });
        selCtx.clip();
        selCtx.drawImage(layer.canvas, minX, minY, w, h, 0, 0, w, h);

        layer.ctx.save();
        layer.ctx.beginPath();
        this.lassoPoints.forEach((pt, i) => {
            if (i === 0) layer.ctx.moveTo(pt[0], pt[1]);
            else layer.ctx.lineTo(pt[0], pt[1]);
        });
        layer.ctx.clip();
        layer.ctx.clearRect(0, 0, 512, 512);
        layer.ctx.restore();

        this.selectedRegion = {
            canvas: selCanvas,
            x: minX,
            y: minY,
            width: w,
            height: h
        };
        
        this.drawSelectionOverlay();
    }

    drawSelectionOverlay() {
        const scan = document.getElementById("selection-canvas");
        const sctx = scan.getContext("2d");
        sctx.clearRect(0, 0, 512, 512);
        
        if (!this.selectedRegion) return;

        sctx.drawImage(this.selectedRegion.canvas, this.selectedRegion.x, this.selectedRegion.y);
        
        sctx.strokeStyle = "#38a169";
        sctx.lineWidth = 1;
        sctx.setLineDash([4, 4]);
        sctx.strokeRect(this.selectedRegion.x, this.selectedRegion.y, this.selectedRegion.width, this.selectedRegion.height);
    }

    isInsideRegion(x, y, r) {
        return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
    }

    clearSelectionCanvas() {
        const scan = document.getElementById("selection-canvas");
        if (scan) {
            const sctx = scan.getContext("2d");
            sctx.clearRect(0, 0, 512, 512);
        }
    }

    // Save history state (for undo)
    saveHistory() {
        const state = this.layers.map(layer => {
            const copyCanvas = document.createElement("canvas");
            copyCanvas.width = 512;
            copyCanvas.height = 512;
            copyCanvas.getContext("2d").drawImage(layer.canvas, 0, 0);
            return {
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                canvas: copyCanvas
            };
        });
        this.historyStack.push(state);
        if (this.historyStack.length > 30) {
            this.historyStack.shift();
        }
        this.redoStack = []; // Clear redo stack on new action
    }

    undo() {
        if (this.historyStack.length === 0) return;
        const currentState = this.layers.map(layer => {
            const copyCanvas = document.createElement("canvas");
            copyCanvas.width = 512;
            copyCanvas.height = 512;
            copyCanvas.getContext("2d").drawImage(layer.canvas, 0, 0);
            return {
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                canvas: copyCanvas
            };
        });
        this.redoStack.push(currentState);

        const prevState = this.historyStack.pop();
        this.restoreState(prevState);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const currentState = this.layers.map(layer => {
            const copyCanvas = document.createElement("canvas");
            copyCanvas.width = 512;
            copyCanvas.height = 512;
            copyCanvas.getContext("2d").drawImage(layer.canvas, 0, 0);
            return {
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                opacity: layer.opacity,
                canvas: copyCanvas
            };
        });
        this.historyStack.push(currentState);

        const nextState = this.redoStack.pop();
        this.restoreState(nextState);
    }

    restoreState(state) {
        const stack = document.getElementById("draw-canvas-container");
        if (stack) stack.innerHTML = "";

        this.layers = state.map((hLayer, idx) => {
            const canvas = document.createElement("canvas");
            canvas.width = 512;
            canvas.height = 512;
            canvas.style.position = "absolute";
            canvas.style.top = "0";
            canvas.style.left = "0";
            canvas.style.zIndex = idx + 1;
            canvas.style.display = hLayer.visible ? "block" : "none";
            canvas.style.opacity = hLayer.opacity;

            const ctx = canvas.getContext("2d");
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.drawImage(hLayer.canvas, 0, 0);

            if (stack) stack.appendChild(canvas);

            return {
                id: hLayer.id,
                name: hLayer.name,
                visible: hLayer.visible,
                opacity: hLayer.opacity,
                canvas: canvas,
                ctx: ctx
            };
        });

        this.activeLayerIndex = Math.min(this.activeLayerIndex, this.layers.length - 1);
        this.renderLayersList();
    }

    copyLassoSelection() {
        if (!this.selectedRegion) return;
        const clipCanvas = document.createElement("canvas");
        clipCanvas.width = this.selectedRegion.width;
        clipCanvas.height = this.selectedRegion.height;
        clipCanvas.getContext("2d").drawImage(this.selectedRegion.canvas, 0, 0);
        
        this.clipboard = {
            canvas: clipCanvas,
            width: this.selectedRegion.width,
            height: this.selectedRegion.height
        };
    }

    cutLassoSelection() {
        if (!this.selectedRegion) return;
        this.copyLassoSelection();
        this.selectedRegion = null;
        this.clearSelectionCanvas();
    }

    pasteLassoSelection() {
        if (!this.clipboard) return;
        
        this.saveHistory();
        if (this.selectedRegion) {
            const layer = this.layers[this.activeLayerIndex];
            if (layer) {
                layer.ctx.drawImage(this.selectedRegion.canvas, this.selectedRegion.x, this.selectedRegion.y);
            }
        }
        
        const w = this.clipboard.width;
        const h = this.clipboard.height;
        const selCanvas = document.createElement("canvas");
        selCanvas.width = w;
        selCanvas.height = h;
        selCanvas.getContext("2d").drawImage(this.clipboard.canvas, 0, 0);
        
        this.selectedRegion = {
            canvas: selCanvas,
            x: Math.round((512 - w) / 2),
            y: Math.round((512 - h) / 2),
            width: w,
            height: h
        };
        
        this.setTool("lasso");
        document.getElementById("draw-tool-sel").value = "lasso";
        this.drawSelectionOverlay();
    }

    selectAll() {
        if (this.activeLayerIndex === -1) return;
        const layer = this.layers[this.activeLayerIndex];
        
        this.saveHistory();
        if (this.selectedRegion) {
            layer.ctx.drawImage(this.selectedRegion.canvas, this.selectedRegion.x, this.selectedRegion.y);
        }
        
        const selCanvas = document.createElement("canvas");
        selCanvas.width = 512;
        selCanvas.height = 512;
        selCanvas.getContext("2d").drawImage(layer.canvas, 0, 0);
        
        layer.ctx.clearRect(0, 0, 512, 512);
        
        this.selectedRegion = {
            canvas: selCanvas,
            x: 0,
            y: 0,
            width: 512,
            height: 512
        };
        
        this.setTool("lasso");
        document.getElementById("draw-tool-sel").value = "lasso";
        this.drawSelectionOverlay();
    }

    onKeyDown(e) {
        if (this.container.style.display !== "flex") return;
        
        if (e.ctrlKey && e.code === "KeyZ") {
            e.preventDefault();
            this.undo();
        } else if (e.ctrlKey && e.code === "KeyY") {
            e.preventDefault();
            this.redo();
        } else if (e.ctrlKey && e.code === "KeyC") {
            e.preventDefault();
            this.copyLassoSelection();
        } else if (e.ctrlKey && e.code === "KeyX") {
            e.preventDefault();
            this.cutLassoSelection();
        } else if (e.ctrlKey && e.code === "KeyV") {
            e.preventDefault();
            this.pasteLassoSelection();
        } else if (e.ctrlKey && e.code === "KeyA") {
            e.preventDefault();
            this.selectAll();
        }
    }

    drawGuide(activeBoneName, bones, solved) {
        const guideCanvas = document.getElementById("guide-canvas");
        if (!guideCanvas) return;
        const gctx = guideCanvas.getContext("2d");
        gctx.clearRect(0, 0, 512, 512);
        
        const activeBone = bones.find(b => b.name === activeBoneName);
        if (!activeBone) return;
        
        const s = solved[activeBoneName];
        if (!s) return;
        
        gctx.save();
        
        // Translate to local space of active bone
        const ax = activeBone.anchor ? activeBone.anchor[0] : 0;
        const ay = activeBone.anchor ? activeBone.anchor[1] : 0;
        gctx.translate(ax, ay);
        gctx.scale(1 / s.sx, 1 / s.sy);
        gctx.rotate(-s.angle * Math.PI / 180);
        gctx.translate(-s.x, -s.y);
        
        // Draw other bones
        bones.forEach(bone => {
            if (bone.name === activeBoneName) return;
            const bs = solved[bone.name];
            if (!bs) return;
            
            gctx.save();
            gctx.translate(bs.x, bs.y);
            gctx.rotate(bs.angle * Math.PI / 180);
            gctx.scale(bs.sx, bs.sy);
            
            const bax = bone.anchor ? bone.anchor[0] : 0;
            const bay = bone.anchor ? bone.anchor[1] : 0;
            const boxW = bone.length || 80;
            const boxH = 20;
            
            gctx.fillStyle = "rgba(255, 255, 255, 0.05)";
            gctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
            gctx.lineWidth = 1.0;
            gctx.fillRect(-bax, -bay, boxW, boxH);
            gctx.strokeRect(-bax, -bay, boxW, boxH);
            gctx.restore();
        });
        
        // Draw bone lines
        bones.forEach(bone => {
            const bs = solved[bone.name];
            if (!bs || !bone.parent) return;
            const ps = solved[bone.parent];
            if (!ps) return;
            
            gctx.beginPath();
            gctx.moveTo(ps.x, ps.y);
            gctx.lineTo(bs.x, bs.y);
            gctx.strokeStyle = "rgba(49, 130, 206, 0.3)";
            gctx.lineWidth = 1.5;
            gctx.stroke();
        });
        
        // Draw joints
        bones.forEach(bone => {
            const bs = solved[bone.name];
            if (!bs) return;
            gctx.beginPath();
            gctx.arc(bs.x, bs.y, 4, 0, 2 * Math.PI);
            gctx.fillStyle = bone.name === activeBoneName ? "#10b981" : "#ef4444";
            gctx.fill();
            
            gctx.fillStyle = "rgba(255, 255, 255, 0.4)";
            gctx.font = "8px sans-serif";
            gctx.fillText(bone.name, bs.x + 6, bs.y + 2);
        });
        
        gctx.restore();
        
        // Draw active bone outline (dashed)
        gctx.save();
        gctx.strokeStyle = "#10b981";
        gctx.setLineDash([4, 4]);
        gctx.lineWidth = 1.5;
        gctx.strokeRect(-ax, -ay, activeBone.length || 80, 20);
        gctx.restore();
    }

    async saveAsset() {
        const cat = document.getElementById("export-category").value;
        const sub = document.getElementById("export-subfolder").value.trim();
        const filename = document.getElementById("export-filename").value.trim();

        if (!filename) {
            alert("Please specify a filename.");
            return;
        }

        // Merge selection first
        if (this.selectedRegion) {
            const layer = this.layers[this.activeLayerIndex];
            if (layer) {
                layer.ctx.drawImage(this.selectedRegion.canvas, this.selectedRegion.x, this.selectedRegion.y);
            }
            this.selectedRegion = null;
            this.clearSelectionCanvas();
        }

        const expCanvas = document.createElement("canvas");
        expCanvas.width = 512;
        expCanvas.height = 512;
        const expCtx = expCanvas.getContext("2d");
        
        this.layers.forEach(layer => {
            if (layer.visible) {
                expCtx.globalAlpha = layer.opacity;
                expCtx.drawImage(layer.canvas, 0, 0);
            }
        });

        const base64Data = expCanvas.toDataURL("image/png");

        try {
            const res = await fetch("/api/skeletal/save-asset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category: cat,
                    subfolder: sub,
                    filename: filename,
                    image_base64: base64Data
                })
            });

            if (res.ok) {
                const data = await res.json();
                this.hide();
                if (this.onSaveCallback) {
                    this.onSaveCallback(data.filepath, data.filename);
                }
            } else {
                const err = await res.json();
                alert(`Failed to save asset: ${err.detail || "Server Error"}`);
            }
        } catch (e) {
            console.error("Save asset failed:", e);
            alert("API connection failed. Please ensure backend is running.");
        }
    }
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

