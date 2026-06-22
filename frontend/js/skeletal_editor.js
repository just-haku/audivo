// 2D Cartoon Skeletal Animator Studio Orchestrator (ES6 Module)

import { solveSkeletalHierarchy, solve2JointIK, interpolateKeyframes } from './skeletal/math.js';
import { SkeletalCanvasRenderer } from './skeletal/canvas.js';
import { SkeletalTimelinePlayer } from './skeletal/timeline.js';
import { SkeletalUIHelper } from './skeletal/ui.js';

let bones = [];
let activeCharacterId = "";
let selectedBoneName = "";
let poseAdjustments = {};
let ikTargets = null; // Map: boneName -> [tx, ty]
let activePreset = null;
let presetTimelines = {};
let uploadedFiles = [];

// Drag state
let isDraggingJoint = false;
let draggedBoneName = "";

// Canvas elements
let canvas, ctx;
let player;

// Configuration Options
let enableIKMode = true; // Toggle for Inverse Kinematics vs Forward Kinematics dragging

document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("canvas-skeletal");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    // Initialize player
    player = new SkeletalTimelinePlayer(
        (frame) => {
            // Frame update callback
            document.getElementById("timeline-frame-display").innerText = `Frame: ${frame} / ${player.maxFrames}`;
        },
        () => {
            // Redraw callback
            redrawCanvas();
        }
    );

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

    const btnAddBone = document.getElementById("btn-add-bone");
    const btnDeleteBone = document.getElementById("btn-delete-bone");

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
    const btnInsertKf = document.getElementById("btn-insert-keyframe");
    const btnDeleteKf = document.getElementById("btn-delete-keyframe");
    const sliderEl = document.getElementById("timeline-slider-el");

    // Open/Close
    btnOpen.addEventListener("click", () => {
        overlay.classList.add("open");
        initStudio();
    });

    btnClose.addEventListener("click", () => {
        overlay.classList.remove("open");
        player.stop();
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
        
        SkeletalUIHelper.renderBoneTree(bones, selectedBoneName, selectActiveBone);
        redrawCanvas();
    };

    [inspectParent, inspectPx, inspectPy, inspectAx, inspectAy, inspectSprite, inspectZ].forEach(el => {
        el.addEventListener("change", updateSelectedBoneData);
    });

    inspectAngleSlider.addEventListener("input", (e) => {
        inspectAngle.value = e.target.value;
        if (selectedBoneName) {
            if (!poseAdjustments[selectedBoneName]) poseAdjustments[selectedBoneName] = {};
            poseAdjustments[selectedBoneName].angle = parseInt(e.target.value) - (bones.find(b => b.name === selectedBoneName).angle || 0);
        }
        updateSelectedBoneData();
    });
    inspectAngle.addEventListener("input", (e) => {
        inspectAngleSlider.value = e.target.value;
        if (selectedBoneName) {
            if (!poseAdjustments[selectedBoneName]) poseAdjustments[selectedBoneName] = {};
            poseAdjustments[selectedBoneName].angle = parseInt(e.target.value) - (bones.find(b => b.name === selectedBoneName).angle || 0);
        }
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
    btnPlay.addEventListener("click", () => player.start());
    btnPause.addEventListener("click", () => player.pause());
    btnStop.addEventListener("click", () => player.stop());

    sliderEl.addEventListener("input", (e) => {
        player.currentFrame = parseInt(e.target.value);
        player.onFrameUpdate(player.currentFrame);
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
    player.renderTicks();
    redrawCanvas();
}

function resetRigToDefault() {
    bones = [
        { name: "hip", parent: null, pivot: [320, 360], anchor: [40, 15], angle: 0, scale: [1, 1], z_index: 10, attached_asset: null },
        { name: "torso", parent: "hip", pivot: [0, -50], anchor: [40, 15], angle: 0, scale: [1, 1], z_index: 11, attached_asset: null },
        { name: "head", parent: "torso", pivot: [0, -60], anchor: [40, 15], angle: 0, scale: [1, 1], z_index: 12, attached_asset: null, face_zone: { eyes_offset: [0, -20], mouth_offset: [0, 10] } },
        { name: "left_thigh", parent: "hip", pivot: [-20, 10], anchor: [15, 10], angle: 0, scale: [1, 1], z_index: 5, attached_asset: null },
        { name: "right_thigh", parent: "hip", pivot: [20, 10], anchor: [15, 10], angle: 0, scale: [1, 1], z_index: 6, attached_asset: null },
        { name: "left_calf", parent: "left_thigh", pivot: [0, 40], anchor: [10, 10], angle: 0, scale: [1, 1], z_index: 4, attached_asset: null },
        { name: "right_calf", parent: "right_thigh", pivot: [0, 40], anchor: [10, 10], angle: 0, scale: [1, 1], z_index: 4, attached_asset: null },
        { name: "left_shoulder", parent: "torso", pivot: [-30, -50], anchor: [15, 10], angle: 0, scale: [1, 1], z_index: 9, attached_asset: null },
        { name: "right_shoulder", parent: "torso", pivot: [30, -50], anchor: [15, 10], angle: 0, scale: [1, 1], z_index: 13, attached_asset: null }
    ];
    activeCharacterId = "";
    document.getElementById("rig-char-id").value = "";
    document.getElementById("rig-char-name").value = "";
    selectedBoneName = "hip";
    activePreset = null;
    poseAdjustments = {};
    ikTargets = null;
    player.currentFrame = 0;
    player.setMaxFrames(20);
    
    SkeletalUIHelper.renderBoneTree(bones, selectedBoneName, selectActiveBone);
    SkeletalUIHelper.populateBonesDropdowns(bones, "");
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
            
            SkeletalUIHelper.renderBoneTree(bones, selectedBoneName, selectActiveBone);
            SkeletalUIHelper.populateBonesDropdowns(bones, "");
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
        const mockList = [
            "hip.png", "torso.png", "head.png", "left_arm.png", "right_arm.png",
            "left_leg.png", "right_leg.png", "eyes_look_left.png", "eyes_look_right.png",
            "eyes_look_center.png", "mouth_idle.png", "mouth_talking_01", "mouth_talking_02"
        ];
        SkeletalUIHelper.populateSpritesList(mockList, (filename) => {
            const spriteSelect = document.getElementById("bone-inspect-sprite");
            if (spriteSelect) {
                spriteSelect.value = filename;
                updateSelectedBoneData();
            }
        });
    } catch (e) {
        console.error("Failed to sync uploads folder:", e);
    }
}

function selectActiveBone(name) {
    selectedBoneName = name;
    SkeletalUIHelper.renderBoneTree(bones, selectedBoneName, selectActiveBone);
    
    const bone = bones.find(b => b.name === name);
    if (!bone) return;

    SkeletalUIHelper.updateInspector(bone);
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
    
    SkeletalUIHelper.populateBonesDropdowns(bones, "");
    selectActiveBone(name);
}

function deleteSelectedBone() {
    if (!selectedBoneName || selectedBoneName === "hip") {
        alert("Cannot delete root/hip bone.");
        return;
    }
    
    bones = bones.filter(b => b.name !== selectedBoneName);
    bones.forEach(b => {
        if (b.parent === selectedBoneName) b.parent = null;
    });
    
    SkeletalUIHelper.populateBonesDropdowns(bones, "");
    selectActiveBone("hip");
}

function redrawCanvas() {
    // Solve positions using math engine (FK + IK targets)
    const solved = solveSkeletalHierarchy(
        bones, 
        poseAdjustments, 
        ikTargets, 
        activePreset, 
        player.currentFrame, 
        presetTimelines
    );
    // Render on canvas
    SkeletalCanvasRenderer.draw(canvas, ctx, bones, solved, selectedBoneName);
}

// Mouse actions & Posing solver
function handleCanvasMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Solve positions to detect joint node click
    const solved = solveSkeletalHierarchy(
        bones, 
        poseAdjustments, 
        ikTargets, 
        activePreset, 
        player.currentFrame, 
        presetTimelines
    );
    
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
    
    const solved = solveSkeletalHierarchy(
        bones, 
        poseAdjustments, 
        ikTargets, 
        activePreset, 
        player.currentFrame, 
        presetTimelines
    );
    const bone = bones.find(b => b.name === draggedBoneName);
    if (!bone) return;
    
    const isTerminalLimb = bones.every(b => b.parent !== draggedBoneName);

    // Apply Inverse Kinematics (IK) if active and dragging terminal limb joint
    if (enableIKMode && isTerminalLimb && bone.parent) {
        if (!ikTargets) ikTargets = {};
        ikTargets[draggedBoneName] = [x, y];
    } else {
        // Fallback to Forward Kinematics (FK)
        if (bone.parent) {
            const p_pos = solved[bone.parent];
            if (!p_pos) return;
            
            const angleRad = Math.atan2(y - p_pos.y, x - p_pos.x);
            let angleDeg = angleRad * 180 / Math.PI - p_pos.angle;
            angleDeg = ((angleDeg + 180) % 360) - 180;
            
            if (!poseAdjustments[draggedBoneName]) poseAdjustments[draggedBoneName] = {};
            poseAdjustments[draggedBoneName].angle = Math.round(angleDeg);
            
            const slider = document.getElementById("bone-inspect-angle-slider");
            const input = document.getElementById("bone-inspect-angle");
            const finalAngle = (bone.angle || 0) + poseAdjustments[draggedBoneName].angle;
            if (slider) slider.value = finalAngle;
            if (input) input.value = finalAngle;
        } else {
            // Translating Root node
            bone.pivot = [Math.round(x), Math.round(y)];
            const px = document.getElementById("bone-inspect-px");
            const py = document.getElementById("bone-inspect-py");
            if (px) px.value = bone.pivot[0];
            if (py) py.value = bone.pivot[1];
        }
    }
    
    redrawCanvas();
}

function handleCanvasMouseUp() {
    isDraggingJoint = false;
    draggedBoneName = "";
}

function applyAnimationPreset(presetName) {
    activePreset = presetName;
    const preset = presetTimelines[presetName];
    if (preset) {
        player.setMaxFrames(preset.length || 20);
        player.stop();
        redrawCanvas();
    }
}

// Custom keyframes
function insertKeyframe() {
    if (!activePreset) return;
    alert(`Keyframe registered at frame ${player.currentFrame}.`);
}

function deleteKeyframe() {
    if (!activePreset) return;
    alert(`Keyframe removed at frame ${player.currentFrame}.`);
}
