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

export function solveSkeletalHierarchy(bones, poseAdjustments, ikTargets = null, activePreset = null, currentFrame = 0, presetTimelines = {}, lockedBones = new Set(), lockedBoneCoords = {}) {
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
        
        if (lockedBones && lockedBones.has(name) && lockedBoneCoords && lockedBoneCoords[name]) {
            solvedObj.x = lockedBoneCoords[name].x;
            solvedObj.y = lockedBoneCoords[name].y;
        }
        
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

export function autoIdentifyFaceZone(bones, headWidth = 100, headHeight = 100) {
    const faceMapping = {
        "left_eyebrow": [-headWidth * 0.2, -headHeight * 0.3],
        "right_eyebrow": [headWidth * 0.2, -headHeight * 0.3],
        "left_eye": [-headWidth * 0.2, -headHeight * 0.15],
        "right_eye": [headWidth * 0.2, -headHeight * 0.15],
        "nose": [0, headHeight * 0.05],
        "mouth_top": [0, headHeight * 0.22],
        "mouth_bottom": [0, headHeight * 0.32]
    };
    
    bones.forEach(bone => {
        if (faceMapping[bone.name] && bone.parent === "head") {
            bone.pivot = [...faceMapping[bone.name]];
        }
    });
}

export const SKELETON_PRESETS = {
    human: [
        { name: "hip", parent: null, pivot: [320, 360], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10, attached_asset: null },
        { name: "spine", parent: "hip", pivot: [0, -40], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10, attached_asset: null },
        { name: "chest", parent: "spine", pivot: [0, -40], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10, attached_asset: null },
        { name: "neck", parent: "chest", pivot: [0, -30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10, attached_asset: null },
        { name: "head", parent: "neck", pivot: [0, -25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 12, attached_asset: null, face_zone: { eyes_offset: [0, -20], mouth_offset: [0, 10] } },
        
        { name: "left_eyebrow", parent: "head", pivot: [-15, -30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13, attached_asset: null },
        { name: "right_eyebrow", parent: "head", pivot: [15, -30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13, attached_asset: null },
        { name: "left_eye", parent: "head", pivot: [-15, -20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13, attached_asset: null },
        { name: "right_eye", parent: "head", pivot: [15, -20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13, attached_asset: null },
        { name: "nose", parent: "head", pivot: [0, -5], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13, attached_asset: null },
        { name: "mouth_top", parent: "head", pivot: [0, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13, attached_asset: null },
        { name: "mouth_bottom", parent: "head", pivot: [0, 20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13, attached_asset: null },

        { name: "left_clavicle", parent: "chest", pivot: [-20, -10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9, attached_asset: null },
        { name: "left_shoulder", parent: "left_clavicle", pivot: [-25, 0], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9, attached_asset: null },
        { name: "left_elbow", parent: "left_shoulder", pivot: [0, 45], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 8, attached_asset: null },
        { name: "left_wrist", parent: "left_elbow", pivot: [0, 40], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7, attached_asset: null },
        { name: "left_hand", parent: "left_wrist", pivot: [0, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7, attached_asset: null },
        
        { name: "left_thumb_1", parent: "left_hand", pivot: [-10, 5], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "left_thumb_2", parent: "left_thumb_1", pivot: [-5, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "left_thumb_3", parent: "left_thumb_2", pivot: [-3, 8], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },

        { name: "left_index_1", parent: "left_hand", pivot: [-5, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "left_index_2", parent: "left_index_1", pivot: [0, 12], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "left_index_3", parent: "left_index_2", pivot: [0, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },

        { name: "left_middle_1", parent: "left_hand", pivot: [0, 18], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "left_middle_2", parent: "left_middle_1", pivot: [0, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "left_middle_3", parent: "left_middle_2", pivot: [0, 12], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },

        { name: "left_ring_1", parent: "left_hand", pivot: [5, 16], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "left_ring_2", parent: "left_ring_1", pivot: [0, 13], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "left_ring_3", parent: "left_ring_2", pivot: [0, 11], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },

        { name: "left_pinky_1", parent: "left_hand", pivot: [10, 13], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "left_pinky_2", parent: "left_pinky_1", pivot: [0, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "left_pinky_3", parent: "left_pinky_2", pivot: [0, 8], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },

        { name: "right_clavicle", parent: "chest", pivot: [20, -10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13, attached_asset: null },
        { name: "right_shoulder", parent: "right_clavicle", pivot: [25, 0], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13, attached_asset: null },
        { name: "right_elbow", parent: "right_shoulder", pivot: [0, 45], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 14, attached_asset: null },
        { name: "right_wrist", parent: "right_elbow", pivot: [0, 40], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15, attached_asset: null },
        { name: "right_hand", parent: "right_wrist", pivot: [0, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15, attached_asset: null },
        
        { name: "right_thumb_1", parent: "right_hand", pivot: [10, 5], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },
        { name: "right_thumb_2", parent: "right_thumb_1", pivot: [5, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },
        { name: "right_thumb_3", parent: "right_thumb_2", pivot: [3, 8], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },

        { name: "right_index_1", parent: "right_hand", pivot: [5, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },
        { name: "right_index_2", parent: "right_index_1", pivot: [0, 12], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },
        { name: "right_index_3", parent: "right_index_2", pivot: [0, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },

        { name: "right_middle_1", parent: "right_hand", pivot: [0, 18], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },
        { name: "right_middle_2", parent: "right_middle_1", pivot: [0, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },
        { name: "right_middle_3", parent: "right_middle_2", pivot: [0, 12], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },

        { name: "right_ring_1", parent: "right_hand", pivot: [-5, 16], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },
        { name: "right_ring_2", parent: "right_ring_1", pivot: [0, 13], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },
        { name: "right_ring_3", parent: "right_ring_2", pivot: [0, 11], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },

        { name: "right_pinky_1", parent: "right_hand", pivot: [-10, 13], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },
        { name: "right_pinky_2", parent: "right_pinky_1", pivot: [0, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },
        { name: "right_pinky_3", parent: "right_pinky_2", pivot: [0, 8], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },

        { name: "left_hip_joint", parent: "hip", pivot: [-25, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 5, attached_asset: null },
        { name: "left_thigh", parent: "left_hip_joint", pivot: [0, 45], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 5, attached_asset: null },
        { name: "left_calf", parent: "left_thigh", pivot: [0, 40], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 4, attached_asset: null },
        { name: "left_foot", parent: "left_calf", pivot: [0, 30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 4, attached_asset: null },
        { name: "left_toe", parent: "left_foot", pivot: [-15, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 4, attached_asset: null },

        { name: "right_hip_joint", parent: "hip", pivot: [25, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6, attached_asset: null },
        { name: "right_thigh", parent: "right_hip_joint", pivot: [0, 45], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6, attached_asset: null },
        { name: "right_calf", parent: "right_thigh", pivot: [0, 40], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6, attached_asset: null },
        { name: "right_foot", parent: "right_calf", pivot: [0, 30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6, attached_asset: null },
        { name: "right_toe", parent: "right_foot", pivot: [15, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6, attached_asset: null }
    ],
    dog: [
        { name: "hip", parent: null, pivot: [260, 360], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "spine", parent: "hip", pivot: [60, 0], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "neck", parent: "spine", pivot: [40, -30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "head", parent: "neck", pivot: [15, -25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 11 },
        { name: "jaw", parent: "head", pivot: [5, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 11 },
        { name: "tail_1", parent: "hip", pivot: [-15, -10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9 },
        { name: "tail_2", parent: "tail_1", pivot: [-20, -15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9 },
        { name: "tail_3", parent: "tail_2", pivot: [-15, -20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9 },
        
        { name: "l_front_shoulder", parent: "spine", pivot: [30, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 8 },
        { name: "l_front_knee", parent: "l_front_shoulder", pivot: [0, 30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 8 },
        { name: "l_front_paw", parent: "l_front_knee", pivot: [0, 25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 8 },
        
        { name: "r_front_shoulder", parent: "spine", pivot: [30, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 12 },
        { name: "r_front_knee", parent: "r_front_shoulder", pivot: [0, 30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 12 },
        { name: "r_front_paw", parent: "r_front_knee", pivot: [0, 25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 12 },

        { name: "l_back_hip", parent: "hip", pivot: [-10, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "l_back_knee", parent: "l_back_hip", pivot: [-10, 30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "l_back_ankle", parent: "l_back_knee", pivot: [10, 25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "l_back_paw", parent: "l_back_ankle", pivot: [0, 20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },

        { name: "r_back_hip", parent: "hip", pivot: [-10, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13 },
        { name: "r_back_knee", parent: "r_back_hip", pivot: [-10, 30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13 },
        { name: "r_back_ankle", parent: "r_back_knee", pivot: [10, 25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13 },
        { name: "r_back_paw", parent: "r_back_ankle", pivot: [0, 20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13 }
    ],
    cat: [
        { name: "hip", parent: null, pivot: [260, 360], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "spine", parent: "hip", pivot: [55, 0], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "neck", parent: "spine", pivot: [35, -25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "head", parent: "neck", pivot: [15, -20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 11 },
        { name: "tail_1", parent: "hip", pivot: [-15, -10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9 },
        { name: "tail_2", parent: "tail_1", pivot: [-25, -10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9 },
        { name: "tail_3", parent: "tail_2", pivot: [-20, -15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9 },
        
        { name: "l_front_shoulder", parent: "spine", pivot: [30, 12], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 8 },
        { name: "l_front_knee", parent: "l_front_shoulder", pivot: [0, 25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 8 },
        { name: "l_front_paw", parent: "l_front_knee", pivot: [0, 20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 8 },
        
        { name: "r_front_shoulder", parent: "spine", pivot: [30, 12], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 12 },
        { name: "r_front_knee", parent: "r_front_shoulder", pivot: [0, 25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 12 },
        { name: "r_front_paw", parent: "r_front_knee", pivot: [0, 20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 12 },

        { name: "l_back_hip", parent: "hip", pivot: [-10, 12], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "l_back_knee", parent: "l_back_hip", pivot: [-8, 25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "l_back_ankle", parent: "l_back_knee", pivot: [8, 22], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },
        { name: "l_back_paw", parent: "l_back_ankle", pivot: [0, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 7 },

        { name: "r_back_hip", parent: "hip", pivot: [-10, 12], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13 },
        { name: "r_back_knee", parent: "r_back_hip", pivot: [-8, 25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13 },
        { name: "r_back_ankle", parent: "r_back_knee", pivot: [8, 22], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13 },
        { name: "r_back_paw", parent: "r_back_ankle", pivot: [0, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13 }
    ],
    chicken: [
        { name: "hip", parent: null, pivot: [320, 360], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "spine", parent: "hip", pivot: [0, -30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "neck", parent: "spine", pivot: [15, -30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "head", parent: "neck", pivot: [10, -25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 11 },
        { name: "beak", parent: "head", pivot: [15, 0], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 11 },
        
        { name: "left_wing", parent: "spine", pivot: [-15, 5], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 5 },
        { name: "right_wing", parent: "spine", pivot: [15, 5], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 15 },
        
        { name: "left_thigh", parent: "hip", pivot: [-15, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6 },
        { name: "left_calf", parent: "left_thigh", pivot: [0, 30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6 },
        { name: "left_foot", parent: "left_calf", pivot: [-10, 25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6 },
        
        { name: "right_thigh", parent: "hip", pivot: [15, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 14 },
        { name: "right_calf", parent: "right_thigh", pivot: [0, 30], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 14 },
        { name: "right_foot", parent: "right_calf", pivot: [10, 25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 14 }
    ],
    t_rex: [
        { name: "hip", parent: null, pivot: [280, 380], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "spine", parent: "hip", pivot: [30, -40], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "neck", parent: "spine", pivot: [15, -45], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 10 },
        { name: "head", parent: "neck", pivot: [25, -25], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 11 },
        { name: "jaw", parent: "head", pivot: [10, 20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 11 },
        
        { name: "tail_1", parent: "hip", pivot: [-35, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9 },
        { name: "tail_2", parent: "tail_1", pivot: [-40, 15], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9 },
        { name: "tail_3", parent: "tail_2", pivot: [-35, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9 },
        { name: "tail_4", parent: "tail_3", pivot: [-30, 5], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 9 },

        { name: "left_upper_arm", parent: "spine", pivot: [15, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 8 },
        { name: "left_forearm", parent: "left_upper_arm", pivot: [12, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 8 },
        { name: "left_hand", parent: "left_forearm", pivot: [8, 5], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 8 },
        
        { name: "right_upper_arm", parent: "spine", pivot: [15, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13 },
        { name: "right_forearm", parent: "right_upper_arm", pivot: [12, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13 },
        { name: "right_hand", parent: "right_forearm", pivot: [8, 5], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 13 },

        { name: "left_thigh", parent: "hip", pivot: [-20, 20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6 },
        { name: "left_calf", parent: "left_thigh", pivot: [10, 50], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6 },
        { name: "left_foot", parent: "left_calf", pivot: [-10, 45], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6 },
        { name: "left_toe", parent: "left_foot", pivot: [25, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 6 },

        { name: "right_thigh", parent: "hip", pivot: [20, 20], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 14 },
        { name: "right_calf", parent: "right_thigh", pivot: [10, 50], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 14 },
        { name: "right_foot", parent: "right_calf", pivot: [-10, 45], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 14 },
        { name: "right_toe", parent: "right_foot", pivot: [25, 10], anchor: [0, 0], angle: 0, scale: [1, 1], z_index: 14 }
    ]
};
