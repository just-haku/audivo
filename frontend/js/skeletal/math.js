// 2D Skeletal Animation Math Engine (Trigonometric & Vector Helpers)

export function interpolateKeyframes(track, frame) {
    if (!track || track.length === 0) {
        return { angle: 0, tx: 0, ty: 0, sx: 1, sy: 1 };
    }
    
    const sorted = [...track].sort((a, b) => a.frame - b.frame);
    if (frame <= sorted[0].frame) return sorted[0];
    if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1];
    
    for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i];
        const next = sorted[i+1];
        if (curr.frame <= frame && frame <= next.frame) {
            const t = (frame - curr.frame) / (next.frame - curr.frame);
            
            // Easing functions
            const easing = curr.easing || "linear";
            let tEased = t;
            if (easing === "ease_in") {
                tEased = t * t;
            } else if (easing === "ease_out") {
                tEased = 1.0 - (1.0 - t) * (1.0 - t);
            } else if (easing === "ease_in_out") {
                tEased = t * t * (3.0 - 2.0 * t);
            }
            
            const getVal = (prop, def) => {
                const cV = curr[prop] !== undefined ? curr[prop] : def;
                const nV = next[prop] !== undefined ? next[prop] : def;
                return cV + tEased * (nV - cV);
            };
            
            return {
                angle: getVal("angle", 0),
                tx: getVal("tx", 0),
                ty: getVal("ty", 0),
                sx: getVal("sx", 1),
                sy: getVal("sy", 1)
            };
        }
    }
    return sorted[0];
}

export function enforceConstraints(bone, angle) {
    if (bone.constraints) {
        const minA = bone.constraints.min_angle;
        const maxA = bone.constraints.max_angle;
        if (minA !== undefined) angle = Math.max(minA, angle);
        if (maxA !== undefined) angle = Math.min(maxA, angle);
    }
    return angle;
}

export function solveSkeletalHierarchy(bones, poseAdjustments, ikTargets = null, activePreset = null, currentFrame = 0, presetTimelines = {}) {
    const solved = {};
    const solvedBones = {};
    
    // Resolve any active IK targets and write solved rotations into a copy of poseAdjustments
    const localAdjs = {};
    for (let boneName in poseAdjustments) {
        localAdjs[boneName] = { ...poseAdjustments[boneName] };
    }
    
    if (ikTargets) {
        solve2JointIK(bones, localAdjs, ikTargets, tempSolveFK(bones, localAdjs));
    }

    const solveBone = (name) => {
        if (solvedBones[name]) return solvedBones[name];
        
        const bone = bones.find(b => b.name === name);
        if (!bone) return null;
        
        const parent = bone.parent;
        let p_x = 0, p_y = 0, p_angle = 0, p_sx = 1.0, p_sy = 1.0;
        
        if (parent) {
            const p_solved = solveBone(parent);
            if (p_solved) {
                p_x = p_solved.x;
                p_y = p_solved.y;
                p_angle = p_solved.angle;
                p_sx = p_solved.sx;
                p_sy = p_solved.sy;
            }
        }
        
        const px = bone.pivot[0];
        const py = bone.pivot[1];
        
        const rad = p_angle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const global_px = p_x + (px * cos - py * sin) * p_sx;
        const global_py = p_y + (px * sin + py * cos) * p_sy;
        
        // Keyframe adjustments
        let adj_angle = 0;
        let adj_tx = 0;
        let adj_ty = 0;
        let adj_sx = 1.0;
        let adj_sy = 1.0;
        
        if (activePreset && presetTimelines[activePreset]) {
            const track = presetTimelines[activePreset].bones[name];
            if (track) {
                const kf = interpolateKeyframes(track, currentFrame);
                adj_angle = kf.angle || 0;
                adj_tx = kf.tx || 0;
                adj_ty = kf.ty || 0;
                adj_sx = kf.sx !== undefined ? kf.sx : 1.0;
                adj_sy = kf.sy !== undefined ? kf.sy : 1.0;
            }
        }
        
        // Merge manual adjustments
        if (localAdjs[name]) {
            adj_angle += localAdjs[name].angle || 0;
            adj_tx += localAdjs[name].tx || 0;
            adj_ty += localAdjs[name].ty || 0;
            adj_sx *= (localAdjs[name].sx !== undefined ? localAdjs[name].sx : 1.0);
            adj_sy *= (localAdjs[name].sy !== undefined ? localAdjs[name].sy : 1.0);
        }
        
        let localAngle = (bone.angle || 0) + adj_angle;
        localAngle = enforceConstraints(bone, localAngle);
        
        const solvedObj = {
            x: global_px + adj_tx,
            y: global_py + adj_ty,
            angle: p_angle + localAngle,
            sx: p_sx * (bone.scale[0] * adj_sx),
            sy: p_sy * (bone.scale[1] * adj_sy)
        };
        
        solvedBones[name] = solvedObj;
        return solvedObj;
    };
    
    bones.forEach(b => solveBone(b.name));
    return solvedBones;
}

function tempSolveFK(bones, adjs) {
    const solved = {};
    const solveBone = (bone) => {
        if (solved[bone.name]) return solved[bone.name];
        
        let p_x = 0, p_y = 0, p_angle = 0;
        if (bone.parent) {
            const pb = bones.find(b => b.name === bone.parent);
            if (pb) {
                const ps = solveBone(pb);
                p_x = ps.x;
                p_y = ps.y;
                p_angle = ps.angle;
            }
        }
        
        const px = bone.pivot[0];
        const py = bone.pivot[1];
        const rad = p_angle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const adj = adjs[bone.name] || {};
        const adj_angle = adj.angle || 0;
        
        solved[bone.name] = {
            x: p_x + (px * cos - py * sin),
            y: p_y + (px * sin + py * cos),
            angle: p_angle + (bone.angle || 0) + adj_angle
        };
        return solved[bone.name];
    };
    
    bones.forEach(solveBone);
    return solved;
}

export function solve2JointIK(bones, adjs, ikTargets, tempFK) {
    const bone_by_name = {};
    bones.forEach(b => bone_by_name[b.name] = b);
    
    for (let targetName in ikTargets) {
        const bone_c = bone_by_name[targetName]; // Child
        if (!bone_c) continue;
        
        const parentName = bone_c.parent;
        if (!parentName) continue;
        
        const bone_b = bone_by_name[parentName]; // Parent
        const grandparentName = bone_b.parent;
        
        let x1 = 0, y1 = 0, parent_global_angle = 0;
        
        if (grandparentName && tempFK[grandparentName]) {
            const gp_pos = tempFK[grandparentName];
            const bp_x = bone_b.pivot[0];
            const bp_y = bone_b.pivot[1];
            const gp_rad = gp_pos.angle * Math.PI / 180;
            const cos = Math.cos(gp_rad);
            const sin = Math.sin(gp_rad);
            x1 = gp_pos.x + (bp_x * cos - bp_y * sin);
            y1 = gp_pos.y + (bp_x * sin + bp_y * cos);
            parent_global_angle = gp_pos.angle;
        } else {
            x1 = bone_b.pivot[0];
            y1 = bone_b.pivot[1];
        }
        
        const [xt, yt] = ikTargets[targetName];
        
        const cp_x = bone_c.pivot[0];
        const cp_y = bone_c.pivot[1];
        const L1 = Math.hypot(cp_x, cp_y);
        
        let L2 = Math.hypot(bone_c.anchor[0], bone_c.anchor[1]);
        if (L2 === 0) L2 = bone_c.length || 50.0;
        
        const D = Math.hypot(xt - x1, yt - y1);
        if (D === 0) continue;
        
        const phi = Math.atan2(yt - y1, xt - x1);
        let theta1_global = 0, theta2_local = 0;
        
        if (D >= L1 + L2) {
            theta1_global = phi - Math.atan2(cp_y, cp_x);
            theta2_local = 0;
        } else {
            const cos_alpha = (L1*L1 + D*D - L2*L2) / (2.0 * L1 * D);
            const cos_beta = (L1*L1 + L2*L2 - D*D) / (2.0 * L1 * L2);
            
            const alpha = Math.acos(Math.max(-1.0, Math.min(1.0, cos_alpha)));
            const beta = Math.acos(Math.max(-1.0, Math.min(1.0, cos_beta)));
            
            const bend_direction = bone_c.ik_bend_direction || 1.0;
            
            theta1_global = phi - bend_direction * alpha - Math.atan2(cp_y, cp_x);
            theta2_local = bend_direction * (Math.PI - beta);
        }
        
        const t1_local_deg = (theta1_global * 180 / Math.PI) - parent_global_angle - (bone_b.angle || 0);
        const t2_local_deg = (theta2_local * 180 / Math.PI) - (bone_c.angle || 0);
        
        if (!adjs[parentName]) adjs[parentName] = {};
        adjs[parentName].angle = enforceConstraints(bone_b, t1_local_deg);
        
        if (!adjs[targetName]) adjs[targetName] = {};
        adjs[targetName].angle = enforceConstraints(bone_c, t2_local_deg);
    }
}
