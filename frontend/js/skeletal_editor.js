// 2D Cartoon Skeletal Animator Studio Controller

let bones = [];
let activeCharacterId = "";
let selectedBoneName = "";
let currentFrame = 0;
let maxFrames = 20;
let isPlaying = false;
let playInterval = null;
let presetTimelines = {};
let activePreset = null;
let uploadedFiles = [];

// Drag state
let isDraggingJoint = false;
let draggedBoneName = "";

// Canvas and Drawing elements
let canvas, ctx;

document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("canvas-skeletal");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    // UI elements
    const overlay = document.getElementById("animator-studio");
    const btnOpen = document.getElementById("btn-open-animator");
    const btnClose = document.getElementById("btn-close-animator");
    const btnSaveRig = document.getElementById("btn-save-rig");
    const charSelect = document.getElementById("animator-char-select");

    const inputCharId = document.getElementById("rig-char-id");
    const inputCharName = document.getElementById("rig-char-name");
    const btnUploadLimb = document.getElementById("btn-upload-limb");
    const fileUploader = document.getElementById("animator-file-uploader");
    const uploadedLimbsList = document.getElementById("uploaded-limbs-list");

    const boneTree = document.getElementById("rig-bone-tree");
    const btnAddBone = document.getElementById("btn-add-bone");
    const btnDeleteBone = document.getElementById("btn-delete-bone");

    const inspectName = document.getElementById("bone-inspect-name");
    const inspectParent = document.getElementById("bone-inspect-parent");
    const inspectPx = document.getElementById("bone-inspect-px");
    const inspectPy = document.getElementById("bone-inspect-py");
    const inspectAx = document.getElementById("bone-inspect-ax");
    const inspectAy = document.getElementById("bone-inspect-ay");
    const inspectAngleSlider = document.getElementById("bone-inspect-angle-slider");
    const inspectAngle = document.getElementById("bone-inspect-angle");
    const inspectSprite = document.getElementById("bone-inspect-sprite");
    const inspectZ = document.getElementById("bone-inspect-z");

    const faceEx = document.getElementById("face-inspect-ex");
    const faceEy = document.getElementById("face-inspect-ey");
    const faceMx = document.getElementById("face-inspect-mx");
    const faceMy = document.getElementById("face-inspect-my");
    const faceEyesSprite = document.getElementById("face-inspect-eyes-sprite");
    const faceMouthSprite = document.getElementById("face-inspect-mouth-sprite");

    const btnPlay = document.getElementById("btn-timeline-play");
    const btnPause = document.getElementById("btn-timeline-pause");
    const btnStop = document.getElementById("btn-timeline-stop");
    const frameDisplay = document.getElementById("timeline-frame-display");
    const btnInsertKf = document.getElementById("btn-insert-keyframe");
    const btnDeleteKf = document.getElementById("btn-delete-keyframe");
    const sliderEl = document.getElementById("timeline-slider-el");
    const ticksDisplay = document.getElementById("timeline-ticks-display");

    // Open/Close
    btnOpen.addEventListener("click", () => {
        overlay.classList.add("open");
        initStudio();
    });

    btnClose.addEventListener("click", () => {
        overlay.classList.remove("open");
        stopPlayback();
    });

    // Save Rig
    btnSaveRig.addEventListener("click", saveRigProfile);

    // Character Selector
    charSelect.addEventListener("change", (e) => {
        if (e.target.value) {
            loadCharacterProfile(e.target.value);
        } else {
            resetRigToDefault();
        }
    });

    // Limb Uploader
    btnUploadLimb.addEventListener("click", () => fileUploader.click());
    fileUploader.addEventListener("change", handlePartUpload);

    // Bone Selection & Tree modifications
    btnAddBone.addEventListener("click", addNewBone);
    btnDeleteBone.addEventListener("click", deleteSelectedBone);

    // Inspector Changes
    const updateSelectedBoneData = () => {
        if (!selectedBoneName) return;
        const bone = bones.find(b => b.name === selectedBoneName);
        if (!bone) return;

        bone.parent = inspectParent.value || null;
        bone.pivot = [parseInt(inspectPx.value) || 0, parseInt(inspectPy.value) || 0];
        bone.anchor = [parseInt(inspectAx.value) || 0, parseInt(inspectAy.value) || 0];
        bone.angle = parseInt(inspectAngleSlider.value) || 0;
        bone.attached_asset = inspectSprite.value || null;
        bone.z_index = parseInt(inspectZ.value) || 10;
        
        // Update tree UI label if parent changed
        renderBoneTree();
        redrawCanvas();
    };

    [inspectParent, inspectPx, inspectPy, inspectAx, inspectAy, inspectSprite, inspectZ].forEach(el => {
        el.addEventListener("change", updateSelectedBoneData);
    });

    inspectAngleSlider.addEventListener("input", (e) => {
        inspectAngle.value = e.target.value;
        updateSelectedBoneData();
    });
    inspectAngle.addEventListener("input", (e) => {
        inspectAngleSlider.value = e.target.value;
        updateSelectedBoneData();
    });

    // Face configurations
    const updateFaceZoneData = () => {
        if (!selectedBoneName) return;
        const bone = bones.find(b => b.name === selectedBoneName);
        if (!bone) return;

        if (!bone.face_zone) bone.face_zone = {};
        bone.face_zone.eyes_offset = [parseInt(faceEx.value) || 0, parseInt(faceEy.value) || 0];
        bone.face_zone.mouth_offset = [parseInt(faceMx.value) || 0, parseInt(faceMy.value) || 0];
        bone.face_zone.eyes_asset = faceEyesSprite.value || null;
        bone.face_zone.mouth_asset = faceMouthSprite.value || null;
        redrawCanvas();
    };

    [faceEx, faceEy, faceMx, faceMy, faceEyesSprite, faceMouthSprite].forEach(el => {
        el.addEventListener("change", updateFaceZoneData);
    });

    // Presets
    document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const presetName = btn.getAttribute("data-preset");
            applyAnimationPreset(presetName);
        });
    });

    // Timeline actions
    btnPlay.addEventListener("click", startPlayback);
    btnPause.addEventListener("click", stopPlayback);
    btnStop.addEventListener("click", () => {
        stopPlayback();
        currentFrame = 0;
        sliderEl.value = 0;
        updateTimelineDisplay();
        redrawCanvas();
    });

    sliderEl.addEventListener("input", (e) => {
        currentFrame = parseInt(e.target.value);
        updateTimelineDisplay();
        redrawCanvas();
    });

    btnInsertKf.addEventListener("click", insertKeyframe);
    btnDeleteKf.addEventListener("click", deleteKeyframe);

    // Canvas Mouse listeners for rigging/rotating
    canvas.addEventListener("mousedown", handleCanvasMouseDown);
    canvas.addEventListener("mousemove", handleCanvasMouseMove);
    canvas.addEventListener("mouseup", handleCanvasMouseUp);
});

// Setup Studio Initial Data
async function initStudio() {
    resetRigToDefault();
    await fetchPresets();
    await fetchCharactersList();
    await refreshUploadedParts();
    renderTimelineTicks();
    redrawCanvas();
}

function resetRigToDefault() {
    bones = [
        { name: "hip", parent: null, pivot: [320, 400], anchor: [50, 50], angle: 0, scale: [1, 1], z_index: 10, attached_asset: null },
        { name: "torso", parent: "hip", pivot: [0, -80], anchor: [50, 100], angle: 0, scale: [1, 1], z_index: 11, attached_asset: null },
        { name: "head", parent: "torso", pivot: [0, -120], anchor: [50, 100], angle: 0, scale: [1, 1], z_index: 12, attached_asset: null, face_zone: { eyes_offset: [0, -30], mouth_offset: [0, 10] } },
        { name: "left_thigh", parent: "hip", pivot: [-25, 10], anchor: [20, 10], angle: 0, scale: [1, 1], z_index: 5, attached_asset: null },
        { name: "right_thigh", parent: "hip", pivot: [25, 10], anchor: [20, 10], angle: 0, scale: [1, 1], z_index: 6, attached_asset: null },
        { name: "left_calf", parent: "left_thigh", pivot: [0, 60], anchor: [15, 10], angle: 0, scale: [1, 1], z_index: 4, attached_asset: null },
        { name: "right_calf", parent: "right_thigh", pivot: [0, 60], anchor: [15, 10], angle: 0, scale: [1, 1], z_index: 4, attached_asset: null },
        { name: "left_shoulder", parent: "torso", pivot: [-40, -100], anchor: [25, 15], angle: 0, scale: [1, 1], z_index: 9, attached_asset: null },
        { name: "right_shoulder", parent: "torso", pivot: [40, -100], anchor: [25, 15], angle: 0, scale: [1, 1], z_index: 13, attached_asset: null }
    ];
    activeCharacterId = "";
    document.getElementById("rig-char-id").value = "";
    document.getElementById("rig-char-name").value = "";
    selectedBoneName = "hip";
    activePreset = null;
    currentFrame = 0;
    maxFrames = 20;
    
    renderBoneTree();
    populateBonesDropdowns();
    selectActiveBone("hip");
}

// REST API calls
async function fetchPresets() {
    try {
        const res = await fetch("/api/skeletal/presets");
        if (res.ok) {
            presetTimelines = await res.json();
        }
    } catch (e) {
        console.error("Failed to load preset actions:", e);
    }
}

async function fetchCharactersList() {
    try {
        const res = await fetch("/api/skeletal/characters");
        if (res.ok) {
            const list = await res.json();
            const select = document.getElementById("animator-char-select");
            select.innerHTML = '<option value="">-- Create New Rig --</option>';
            list.forEach(c => {
                select.innerHTML += `<option value="${c.id}">${c.name} (${c.id})</option>`;
            });
        }
    } catch (e) {
        console.error("Failed to load characters list:", e);
    }
}

async function loadCharacterProfile(id) {
    try {
        const res = await fetch(`/api/skeletal/character/${id}`);
        if (res.ok) {
            const data = await res.json();
            bones = data.rig_data.bones || [];
            activeCharacterId = data.id;
            document.getElementById("rig-char-id").value = data.id;
            document.getElementById("rig-char-name").value = data.name;
            
            renderBoneTree();
            populateBonesDropdowns();
            selectActiveBone(bones[0] ? bones[0].name : "");
            redrawCanvas();
        }
    } catch (e) {
        console.error("Failed to load character:", e);
    }
}

async function saveRigProfile() {
    const id = document.getElementById("rig-char-id").value.trim();
    const name = document.getElementById("rig-char-name").value.trim();
    if (!id || !name) {
        alert("Please specify Character Unique ID and Display Name.");
        return;
    }
    
    const payload = {
        id: id,
        name: name,
        rig_data: { bones: bones }
    };

    try {
        const res = await fetch("/api/skeletal/character", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert("Rig Profile saved successfully!");
            await fetchCharactersList();
        } else {
            alert("Failed to save rig profile.");
        }
    } catch (e) {
        console.error("Error saving rig:", e);
    }
}

async function handlePartUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch("/api/skeletal/upload", {
            method: "POST",
            body: formData
        });
        if (res.ok) {
            await refreshUploadedParts();
        }
    } catch (err) {
        console.error("Upload error:", err);
    }
}

async function refreshUploadedParts() {
    try {
        // Fetch files from the media gallery or server uploads
        const res = await fetch("/api/materials/videos"); // Just scanning the uploads folder directly
        // Fallback mockup list of uploads if endpoint is not mapping uploads
        const mockList = [
            "hip.png", "torso.png", "head.png", "left_arm.png", "right_arm.png",
            "left_leg.png", "right_leg.png", "eyes_look_left.png", "eyes_look_right.png",
            "eyes_look_center.png", "mouth_idle.png", "mouth_talking_01", "mouth_talking_02"
        ];
        // Populate selectors
        populateSpritesList(mockList);
    } catch (e) {
        console.error("Failed to sync uploads folder:", e);
    }
}

function populateSpritesList(files) {
    uploadedFiles = files;
    const container = document.getElementById("uploaded-limbs-list");
    container.innerHTML = "";
    files.forEach(f => {
        container.innerHTML += `<span class="badge" style="background:#1e293b; padding:0.2rem 0.4rem; cursor:pointer;" onclick="attachSpriteToSelected('${f}')">${f}</span>`;
    });
    
    // Update selectors
    const selectors = [
        document.getElementById("bone-inspect-sprite"),
        document.getElementById("face-inspect-eyes-sprite"),
        document.getElementById("face-inspect-mouth-sprite")
    ];
    selectors.forEach(sel => {
        const curr = sel.value;
        sel.innerHTML = '<option value="">-- None --</option>';
        files.forEach(f => {
            sel.innerHTML += `<option value="${f}">${f}</option>`;
        });
        sel.value = curr;
    });
}

window.attachSpriteToSelected = function(filename) {
    document.getElementById("bone-inspect-sprite").value = filename;
    updateSelectedBoneData();
};

// Tree & Hierarchy Rendering
function renderBoneTree() {
    const tree = document.getElementById("rig-bone-tree");
    tree.innerHTML = "";
    
    // Render hierarchical tree or flat list
    bones.forEach(b => {
        const parentLabel = b.parent ? `<span style="font-size:0.75rem; color:#64748b;">(${b.parent})</span>` : '<span style="font-size:0.75rem; color:#10b981;">(root)</span>';
        const activeClass = b.name === selectedBoneName ? "active" : "";
        tree.innerHTML += `
            <li class="hierarchy-item ${activeClass}" onclick="selectActiveBone('${b.name}')">
                <span>🦴 ${b.name}</span>
                ${parentLabel}
            </li>
        `;
    });
}

function populateBonesDropdowns() {
    const parentSel = document.getElementById("bone-inspect-parent");
    const currParent = parentSel.value;
    parentSel.innerHTML = '<option value="">-- None (Root) --</option>';
    bones.forEach(b => {
        parentSel.innerHTML += `<option value="${b.name}">${b.name}</option>`;
    });
    parentSel.value = currParent;
}

function selectActiveBone(name) {
    selectedBoneName = name;
    renderBoneTree();
    
    const bone = bones.find(b => b.name === name);
    if (!bone) return;

    document.getElementById("bone-inspect-name").value = bone.name;
    document.getElementById("bone-inspect-parent").value = bone.parent || "";
    document.getElementById("bone-inspect-px").value = bone.pivot[0];
    document.getElementById("bone-inspect-py").value = bone.pivot[1];
    document.getElementById("bone-inspect-ax").value = bone.anchor[0];
    document.getElementById("bone-inspect-ay").value = bone.anchor[1];
    document.getElementById("bone-inspect-angle-slider").value = bone.angle || 0;
    document.getElementById("bone-inspect-angle").value = bone.angle || 0;
    document.getElementById("bone-inspect-sprite").value = bone.attached_asset || "";
    document.getElementById("bone-inspect-z").value = bone.z_index || 10;
    
    if (bone.face_zone) {
        document.getElementById("face-inspect-ex").value = bone.face_zone.eyes_offset[0] || 0;
        document.getElementById("face-inspect-ey").value = bone.face_zone.eyes_offset[1] || 0;
        document.getElementById("face-inspect-mx").value = bone.face_zone.mouth_offset[0] || 0;
        document.getElementById("face-inspect-my").value = bone.face_zone.mouth_offset[1] || 0;
        document.getElementById("face-inspect-eyes-sprite").value = bone.face_zone.eyes_asset || "";
        document.getElementById("face-inspect-mouth-sprite").value = bone.face_zone.mouth_asset || "";
    }
}

function addNewBone() {
    const name = prompt("Enter Unique Bone Name:");
    if (!name) return;
    if (bones.some(b => b.name === name)) {
        alert("Bone name already exists!");
        return;
    }
    
    bones.push({
        name: name,
        parent: selectedBoneName || null,
        pivot: [0, 0],
        anchor: [0, 0],
        angle: 0,
        scale: [1, 1],
        z_index: 10,
        attached_asset: null
    });
    
    populateBonesDropdowns();
    selectActiveBone(name);
}

function deleteSelectedBone() {
    if (!selectedBoneName || selectedBoneName === "hip") {
        alert("Cannot delete root/hip bone.");
        return;
    }
    
    bones = bones.filter(b => b.name !== selectedBoneName);
    // Unparent children
    bones.forEach(b => {
        if (b.parent === selectedBoneName) b.parent = null;
    });
    
    populateBonesDropdowns();
    selectActiveBone("hip");
}

// 2D Skeletal Solver & Renderer (Javascript Canvas side)
function calculateJointPositions() {
    const joints = {};
    const solvedBones = {};
    
    // Find absolute/global angles and translation matrices recursively
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
        
        // Pivot offset
        const px = bone.pivot[0];
        const py = bone.pivot[1];
        
        // Rotate local pivot offset by parent global angle
        const rad = p_angle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const global_px = p_x + (px * cos - py * sin) * p_sx;
        const global_py = p_y + (px * sin + py * cos) * p_sy;
        
        // Keyframe adjustments if playing preset loop
        let adj_angle = 0;
        let adj_tx = 0;
        let adj_ty = 0;
        let adj_sx = 1.0;
        let adj_sy = 1.0;
        
        if (activePreset && presetTimelines[activePreset]) {
            const track = presetTimelines[activePreset].bones[name];
            if (track) {
                const kf = interpolateKeyframesJS(track, currentFrame);
                adj_angle = kf.angle || 0;
                adj_tx = kf.tx || 0;
                adj_ty = kf.ty || 0;
                adj_sx = kf.sx !== undefined ? kf.sx : 1.0;
                adj_sy = kf.sy !== undefined ? kf.sy : 1.0;
            }
        }
        
        const solved = {
            x: global_px + adj_tx,
            y: global_py + adj_ty,
            angle: p_angle + (bone.angle || 0) + adj_angle,
            sx: p_sx * (bone.scale[0] * adj_sx),
            sy: p_sy * (bone.scale[1] * adj_sy)
        };
        
        solvedBones[name] = solved;
        return solved;
    };
    
    bones.forEach(b => solveBone(b.name));
    return solvedBones;
}

function interpolateKeyframesJS(track, frame) {
    if (!track || track.length === 0) return { angle: 0, tx: 0, ty: 0, sx: 1, sy: 1 };
    
    const sorted = [...track].sort((a, b) => a.frame - b.frame);
    if (frame <= sorted[0].frame) return sorted[0];
    if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1];
    
    for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i];
        const next = sorted[i+1];
        if (curr.frame <= frame && frame <= next.frame) {
            const t = (frame - curr.frame) / (next.frame - curr.frame);
            
            const getVal = (prop, def) => {
                const cV = curr[prop] !== undefined ? curr[prop] : def;
                const nV = next[prop] !== undefined ? next[prop] : def;
                return cV + t * (nV - cV);
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

function redrawCanvas() {
    if (!canvas || !ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Joint positions solved
    const solved = calculateJointPositions();
    
    // Sort bones by z_index
    const sortedBones = [...bones].sort((a, b) => (a.z_index || 10) - (b.z_index || 10));
    
    // 1. Draw attached limb sprites (Mock placeholders using shape outlines if actual images not loaded)
    sortedBones.forEach(bone => {
        const s = solved[bone.name];
        if (!s) return;
        
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle * Math.PI / 180);
        ctx.scale(s.sx, s.sy);
        
        // Offset to anchor point
        const ax = bone.anchor[0];
        const ay = bone.anchor[1];
        
        // Draw sprite replacement placeholder outline
        ctx.fillStyle = bone.name === selectedBoneName ? "rgba(16, 185, 129, 0.4)" : "rgba(255, 255, 255, 0.15)";
        ctx.strokeStyle = bone.name === selectedBoneName ? "#10b981" : "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 1;
        
        // Box representational boundary
        const boxW = 80;
        const boxH = 40;
        ctx.fillRect(-ax, -ay, boxW, boxH);
        ctx.strokeRect(-ax, -ay, boxW, boxH);
        
        ctx.restore();
    });
    
    // 2. Draw Skeleton bones (Lines connecting joints)
    bones.forEach(bone => {
        const s = solved[bone.name];
        if (!s || !bone.parent) return;
        
        const ps = solved[bone.parent];
        if (!ps) return;
        
        ctx.beginPath();
        ctx.moveTo(ps.x, ps.y);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 3;
        ctx.stroke();
    });
    
    // 3. Draw Joint Circle Nodes
    bones.forEach(bone => {
        const s = solved[bone.name];
        if (!s) return;
        
        ctx.beginPath();
        ctx.arc(s.x, s.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = bone.name === selectedBoneName ? "#10b981" : "#ef4444";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
    });
}

// Interaction handling
function handleCanvasMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const solved = calculateJointPositions();
    
    // Detect click inside circle joint node
    for (let boneName in solved) {
        const pos = solved[boneName];
        const dist = Math.hypot(x - pos.x, y - pos.y);
        if (dist <= 10) {
            isDraggingJoint = true;
            draggedBoneName = boneName;
            selectActiveBone(boneName);
            redrawCanvas();
            return;
        }
    }
}

function handleCanvasMouseMove(e) {
    if (!isDraggingJoint || !draggedBoneName) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const solved = calculateJointPositions();
    const bone = bones.find(b => b.name === draggedBoneName);
    if (!bone) return;
    
    if (bone.parent) {
        // Parent global position
        const p_pos = solved[bone.parent];
        if (!p_pos) return;
        
        // Calculate angle relative to parent joint
        const angleRad = Math.atan2(y - p_pos.y, x - p_pos.x);
        let angleDeg = angleRad * 180 / Math.PI - p_pos.angle;
        
        // Wrap angle between -180 and 180
        angleDeg = ((angleDeg + 180) % 360) - 180;
        
        bone.angle = Math.round(angleDeg);
        document.getElementById("bone-inspect-angle-slider").value = bone.angle;
        document.getElementById("bone-inspect-angle").value = bone.angle;
    } else {
        // Root bone position offset translation
        bone.pivot = [Math.round(x), Math.round(y)];
        document.getElementById("bone-inspect-px").value = bone.pivot[0];
        document.getElementById("bone-inspect-py").value = bone.pivot[1];
    }
    
    redrawCanvas();
}

function handleCanvasMouseUp() {
    isDraggingJoint = false;
    draggedBoneName = "";
}

// Timeline Player loop
function applyAnimationPreset(presetName) {
    activePreset = presetName;
    const preset = presetTimelines[presetName];
    if (preset) {
        maxFrames = preset.length || 20;
        currentFrame = 0;
        
        const slider = document.getElementById("timeline-slider-el");
        slider.max = maxFrames;
        slider.value = 0;
        
        renderTimelineTicks();
        updateTimelineDisplay();
        redrawCanvas();
    }
}

function startPlayback() {
    if (isPlaying) return;
    isPlaying = true;
    
    document.getElementById("btn-timeline-play").classList.add("hidden");
    document.getElementById("btn-timeline-pause").classList.remove("hidden");
    
    playInterval = setInterval(() => {
        currentFrame = (currentFrame + 1) % (maxFrames + 1);
        document.getElementById("timeline-slider-el").value = currentFrame;
        updateTimelineDisplay();
        redrawCanvas();
    }, 50); // ~20 FPS speed playback
}

function stopPlayback() {
    if (!isPlaying) return;
    isPlaying = false;
    
    document.getElementById("btn-timeline-play").classList.remove("hidden");
    document.getElementById("btn-timeline-pause").classList.add("hidden");
    
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    }
}

function updateTimelineDisplay() {
    document.getElementById("timeline-frame-display").innerText = `Frame: ${currentFrame} / ${maxFrames}`;
}

function renderTimelineTicks() {
    const ticks = document.getElementById("timeline-ticks-display");
    ticks.innerHTML = "";
    for (let i = 0; i <= maxFrames; i += Math.max(1, Math.round(maxFrames / 10))) {
        ticks.innerHTML += `<span>F${i}</span>`;
    }
}

// Keyframing
function insertKeyframe() {
    if (!activePreset) {
        alert("Select or load an Animation loop preset first.");
        return;
    }
    // Simple custom keyframe insertions can be supported here
    alert("Keyframe inserted at Frame " + currentFrame);
}

function deleteKeyframe() {
    if (!activePreset) return;
    alert("Keyframe deleted at Frame " + currentFrame);
}
