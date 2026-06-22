// 2D Skeletal Canvas Renderer Module

export class SkeletalCanvasRenderer {
    static draw(canvas, ctx, bones, solved, selectedBoneName) {
        if (!canvas || !ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. Draw grid backdrop (checkerboard)
        ctx.fillStyle = "#0c0d16";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 2. Sort bones by z_index
        const sortedBones = [...bones].sort((a, b) => (a.z_index || 10) - (b.z_index || 10));
        
        // 3. Draw outline boxes representing limb parts
        sortedBones.forEach(bone => {
            const s = solved[bone.name];
            if (!s) return;
            
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.angle * Math.PI / 180);
            ctx.scale(s.sx, s.sy);
            
            const ax = bone.anchor[0];
            const ay = bone.anchor[1];
            
            // Highlight selected bone
            const isSelected = bone.name === selectedBoneName;
            ctx.fillStyle = isSelected ? "rgba(16, 185, 129, 0.35)" : "rgba(255, 255, 255, 0.1)";
            ctx.strokeStyle = isSelected ? "#10b981" : "rgba(255, 255, 255, 0.35)";
            ctx.lineWidth = 1.5;
            
            // Standard limb representation boundary box
            const boxW = bone.length || 80;
            const boxH = 30;
            ctx.fillRect(-ax, -ay, boxW, boxH);
            ctx.strokeRect(-ax, -ay, boxW, boxH);
            
            // If head bone, draw face zones
            if (bone.face_zone) {
                const ex = bone.face_zone.eyes_offset ? bone.face_zone.eyes_offset[0] : 0;
                const ey = bone.face_zone.eyes_offset ? bone.face_zone.eyes_offset[1] : 0;
                const mx = bone.face_zone.mouth_offset ? bone.face_zone.mouth_offset[0] : 0;
                const my = bone.face_zone.mouth_offset ? bone.face_zone.mouth_offset[1] : 0;
                
                // Draw eyes placement dot
                ctx.fillStyle = "#38bdf8";
                ctx.beginPath();
                ctx.arc(ex, ey, 4, 0, 2 * Math.PI);
                ctx.fill();
                
                // Draw mouth placement dot
                ctx.fillStyle = "#f43f5e";
                ctx.beginPath();
                ctx.arc(mx, my, 4, 0, 2 * Math.PI);
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
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2.5;
            ctx.stroke();
        });
        
        // 5. Draw Joint circle nodes
        bones.forEach(bone => {
            const s = solved[bone.name];
            if (!s) return;
            
            const isSelected = bone.name === selectedBoneName;
            
            ctx.beginPath();
            ctx.arc(s.x, s.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = isSelected ? "#10b981" : "#ef4444";
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#ffffff";
            ctx.stroke();
            
            // Label joint
            ctx.fillStyle = "#cbd5e1";
            ctx.font = "10px Inter";
            ctx.fillText(bone.name, s.x + 8, s.y + 3);
        });
    }
}
