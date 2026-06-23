// 2D Skeletal Canvas Renderer Module with Viewport Pan, Zoom, Locked Joints, and Marquee Selection
export class SkeletalCanvasRenderer {
    static draw(canvas, ctx, bones, solved, selectedBoneNames, panX = 0, panY = 0, zoomScale = 1.0, marqueeRect = null, lockedBones = new Set()) {
        if (!canvas || !ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. Draw base canvas background with a dark radial vignette
        const grad = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 50,
            canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75
        );
        grad.addColorStop(0, "#0c0e18");
        grad.addColorStop(1, "#05060a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid lines taking into account pan and zoom
        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(zoomScale, zoomScale);
        
        const gridSize = 40;
        
        // Find visible bounds
        const startX = Math.floor(-panX / zoomScale / gridSize) * gridSize;
        const endX = startX + Math.ceil(canvas.width / zoomScale / gridSize) * gridSize + gridSize;
        const startY = Math.floor(-panY / zoomScale / gridSize) * gridSize;
        const endY = startY + Math.ceil(canvas.height / zoomScale / gridSize) * gridSize + gridSize;
        
        // Draw Grid Lines (Subtle double-tiered grid)
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            // Major gridlines every 200px, minor gridlines every 40px
            ctx.strokeStyle = (x % 200 === 0) ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.015)";
            ctx.lineWidth = (x % 200 === 0) ? 0.75 : 0.5;
            ctx.stroke();
        }
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.strokeStyle = (y % 200 === 0) ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.015)";
            ctx.lineWidth = (y % 200 === 0) ? 0.75 : 0.5;
            ctx.stroke();
        }
        
        // 2. Sort bones by z_index
        const sortedBones = [...bones].sort((a, b) => (a.z_index || 10) - (b.z_index || 10));
        
        // 3. Draw outline boxes (capsules) representing limb parts
        sortedBones.forEach(bone => {
            const s = solved[bone.name];
            if (!s) return;
            
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.angle * Math.PI / 180);
            ctx.scale(s.sx, s.sy);
            
            const ax = bone.anchor[0];
            const ay = bone.anchor[1];
            
            const isSelected = selectedBoneNames.includes(bone.name);
            ctx.fillStyle = isSelected ? "rgba(168, 85, 247, 0.15)" : "rgba(99, 102, 241, 0.04)";
            ctx.strokeStyle = isSelected ? "#a855f7" : "rgba(255, 255, 255, 0.12)";
            ctx.lineWidth = isSelected ? 2.0 : 1.25;
            
            // Modern organic capsule rounded boundary box (radius 8px for 20px height)
            const boxW = bone.length || 80;
            const boxH = 20;
            ctx.beginPath();
            ctx.roundRect(-ax, -ay, boxW, boxH, 8);
            ctx.fill();
            ctx.stroke();
            
            // If head bone, draw face zones proportional outlines
            if (bone.face_zone) {
                const ex = bone.face_zone.eyes_offset ? bone.face_zone.eyes_offset[0] : 0;
                const ey = bone.face_zone.eyes_offset ? bone.face_zone.eyes_offset[1] : 0;
                const mx = bone.face_zone.mouth_offset ? bone.face_zone.mouth_offset[0] : 0;
                const my = bone.face_zone.mouth_offset ? bone.face_zone.mouth_offset[1] : 0;
                
                // Draw eyes placement dot
                ctx.fillStyle = "#06b6d4";
                ctx.beginPath();
                ctx.arc(ex, ey, 3, 0, 2 * Math.PI);
                ctx.fill();
                
                // Draw mouth placement dot
                ctx.fillStyle = "#ec4899";
                ctx.beginPath();
                ctx.arc(mx, my, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            ctx.restore();
        });
        
        // 4. Draw Skeleton Bone lines (parent-child joints)
        bones.forEach(bone => {
            const s = solved[bone.name];
            if (!s || !bone.parent) return;
            
            const ps = solved[bone.parent];
            if (!ps) return;
            
            ctx.beginPath();
            ctx.moveTo(ps.x, ps.y);
            ctx.lineTo(s.x, s.y);
            ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
            ctx.lineWidth = 1.75;
            ctx.stroke();
        });
        
        // 5. Draw Joint circle nodes and indicators
        bones.forEach(bone => {
            const s = solved[bone.name];
            if (!s) return;
            
            const isSelected = selectedBoneNames.includes(bone.name);
            const isLocked = lockedBones.has(bone.name);
            
            // Draw visual lock anchor ring if joint is locked
            if (isLocked) {
                ctx.beginPath();
                ctx.arc(s.x, s.y, 11, 0, 2 * Math.PI);
                ctx.strokeStyle = "#06b6d4";
                ctx.lineWidth = 1.25;
                ctx.stroke();
            }
            
            // Draw visual selection halo ring if joint is selected
            if (isSelected && !isLocked) {
                ctx.beginPath();
                ctx.arc(s.x, s.y, 9, 0, 2 * Math.PI);
                ctx.strokeStyle = "rgba(217, 70, 239, 0.4)";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            
            ctx.beginPath();
            ctx.arc(s.x, s.y, 5, 0, 2 * Math.PI);
            
            if (isLocked) {
                ctx.fillStyle = "#06b6d4"; // Cyan for locked
            } else if (isSelected) {
                ctx.fillStyle = "#d946ef"; // Fuchsia for selected
            } else {
                ctx.fillStyle = "#8b5cf6"; // Violet for standard
            }
            
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#ffffff";
            ctx.stroke();
            
            // Label joint using high fidelity typography
            ctx.fillStyle = isSelected ? "#e2e8f0" : "#94a3b8";
            ctx.font = "500 10px 'Inter', sans-serif";
            ctx.fillText(bone.name, s.x + 8, s.y + 3);
        });
        
        ctx.restore();
        
        // 6. Draw Marquee Selection Rectangle in screen space
        if (marqueeRect) {
            ctx.fillStyle = "rgba(168, 85, 247, 0.15)";
            ctx.strokeStyle = "#a855f7";
            ctx.lineWidth = 1.0;
            ctx.fillRect(marqueeRect.x, marqueeRect.y, marqueeRect.w, marqueeRect.h);
            ctx.strokeRect(marqueeRect.x, marqueeRect.y, marqueeRect.w, marqueeRect.h);
        }
    }
}
