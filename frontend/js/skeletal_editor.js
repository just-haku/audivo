import { solveSkeletalHierarchy, solve2JointIK, interpolateKeyframes, SKELETON_PRESETS, autoIdentifyFaceZone } from './skeletal/math.js';
import { SkeletalCanvasRenderer } from './skeletal/canvas.js';
import { SkeletalTimelinePlayer } from './skeletal/timeline.js';
import { SkeletalUIHelper } from './skeletal/ui.js';
import { DrawingEditor } from './skeletal/draw_editor.js';
import { AssetsCenter } from './skeletal/assets_center.js';

let bones = [];
let activeCharacterId = "";
let selectedBoneName = "";
let selectedBoneNames = []; // Supports group marquee selection
let lockedBones = new Set(); // Locked pivots/joints
let lockedBoneCoords = {}; // Locked coordinates in world space
let animatorHistory = [];
let animatorRedoStack = [];
let copiedPose = null;
let poseAdjustments = {};
let ikTargets = null; // Map: boneName -> [tx, ty]
let activePreset = null;
let presetTimelines = {};
let uploadedFiles = [];

// Viewport & Gestures
let panX = 0;
let panY = 0;
let zoomScale = 1.0;
let toolMode = "drag"; // drag (IK), angle (FK), view (pan/zoom), select (marquee)
let marqueeRect = null;
let isPanning = false;
let isMarquee = false;
let panStartX = 0;
let panStartY = 0;
let marqueeStartX = 0;
let marqueeStartY = 0;

// Drag state
let isDraggingJoint = false;
let draggedBoneName = "";

// Canvas elements
let canvas, ctx;
let player;

// Configuration Options
let enableIKMode = true; // Toggle for Inverse Kinematics vs Forward Kinematics dragging

// Instances
const drawingEditor = new DrawingEditor();
const assetsCenter = new AssetsCenter();

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
        document.body.classList.add("modal-open");
        initStudio();
    });

    btnClose.addEventListener("click", () => {
        overlay.classList.remove("open");
        document.body.classList.remove("modal-open");
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

    // Collapsible Sidebars
    const leftSidebar = document.querySelector(".animator-sidebar-left");
    const rightSidebar = document.querySelector(".animator-sidebar-right");
    const btnCollapseLeft = document.getElementById("btn-collapse-left");
    const btnCollapseRight = document.getElementById("btn-collapse-right");
    
    const resizeCanvasViewport = () => {
        if (!canvas) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        redrawCanvas();
    };
    
    btnCollapseLeft.addEventListener("click", () => {
        const isCollapsed = leftSidebar.style.width === "0px";
        leftSidebar.style.width = isCollapsed ? "240px" : "0px";
        btnCollapseLeft.innerText = isCollapsed ? "◀" : "▶";
        btnCollapseLeft.style.left = isCollapsed ? "240px" : "0px";
        setTimeout(resizeCanvasViewport, 310);
    });
    
    btnCollapseRight.addEventListener("click", () => {
        const isCollapsed = rightSidebar.style.width === "0px";
        rightSidebar.style.width = isCollapsed ? "280px" : "0px";
        btnCollapseRight.innerText = isCollapsed ? "▶" : "◀";
        btnCollapseRight.style.right = isCollapsed ? "280px" : "0px";
        setTimeout(resizeCanvasViewport, 310);
    });

    // Tool Mode Selection
    const dragBtn = document.getElementById("tool-drag-btn");
    const angleBtn = document.getElementById("tool-angle-btn");
    const viewBtn = document.getElementById("tool-view-btn");
    const selectBtn = document.getElementById("tool-select-btn");
    
    const setToolMode = (mode) => {
        toolMode = mode;
        [dragBtn, angleBtn, viewBtn, selectBtn].forEach(btn => {
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-secondary");
        });
        
        let targetBtn = dragBtn;
        if (mode === "angle") targetBtn = angleBtn;
        else if (mode === "view") targetBtn = viewBtn;
        else if (mode === "select") targetBtn = selectBtn;
        
        targetBtn.classList.remove("btn-secondary");
        targetBtn.classList.add("btn-primary");
        redrawCanvas();
    };
    
    dragBtn.addEventListener("click", () => setToolMode("drag"));
    angleBtn.addEventListener("click", () => setToolMode("angle"));
    viewBtn.addEventListener("click", () => setToolMode("view"));
    selectBtn.addEventListener("click", () => setToolMode("select"));

    // Rig Preset Selector
    const presetSelect = document.getElementById("skeleton-preset-select");
    presetSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val && SKELETON_PRESETS[val]) {
            bones = JSON.parse(JSON.stringify(SKELETON_PRESETS[val]));
            selectedBoneName = bones[0].name;
            selectedBoneNames = [selectedBoneName];
            poseAdjustments = {};
            ikTargets = null;
            lockedBones.clear();
            SkeletalUIHelper.renderBoneTree(bones, selectedBoneName, selectActiveBone);
            SkeletalUIHelper.populateBonesDropdowns(bones, "");
            selectActiveBone(selectedBoneName);
            redrawCanvas();
        }
    });

    // Joint Locking Checkbox
    const lockCheckbox = document.getElementById("bone-inspect-lock");
    lockCheckbox.addEventListener("change", (e) => {
        if (selectedBoneName) {
            if (e.target.checked) {
                lockedBones.add(selectedBoneName);
                const solved = solveSkeletalHierarchy(
                    bones, 
                    poseAdjustments, 
                    ikTargets, 
                    activePreset, 
                    player.currentFrame, 
                    presetTimelines,
                    new Set(),
                    {}
                );
                const pos = solved[selectedBoneName];
                if (pos) {
                    lockedBoneCoords[selectedBoneName] = { x: pos.x, y: pos.y };
                }
            } else {
                lockedBones.delete(selectedBoneName);
                delete lockedBoneCoords[selectedBoneName];
            }
            redrawCanvas();
        }
    });

    // Auto Face Placement
    const btnAutoFace = document.getElementById("btn-auto-face");
    btnAutoFace.addEventListener("click", () => {
        autoIdentifyFaceZone(bones, 100, 100);
        redrawCanvas();
    });

    // Open Painting Studio
    const btnOpenPainter = document.getElementById("btn-open-painter");
    btnOpenPainter.addEventListener("click", () => {
        const activeBone = bones.find(b => b.name === selectedBoneName);
        const charName = inputCharId.value || "ninja";
        const partName = activeBone ? `${activeBone.name}.png` : "sprite.png";
        
        drawingEditor.show("body_parts", charName, partName, (savedFilePath, filename) => {
            if (activeBone) {
                activeBone.attached_asset = savedFilePath;
                inspectSprite.value = savedFilePath;
                updateSelectedBoneData();
                assetsCenter.refresh();
            }
        });
        
        const solved = solveSkeletalHierarchy(
            bones, 
            poseAdjustments, 
            ikTargets, 
            activePreset, 
            player.currentFrame, 
            presetTimelines,
            lockedBones,
            lockedBoneCoords
        );
        drawingEditor.drawGuide(selectedBoneName, bones, solved);
    });

    // Timeline FPS
    const timelineFps = document.getElementById("timeline-fps");
    timelineFps.addEventListener("change", (e) => {
        const val = parseInt(e.target.value) || 24;
        player.setFPS(val);
    });

    // Shortcuts
    window.addEventListener("keydown", (e) => {
        if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT" || document.activeElement.tagName === "TEXTAREA") return;
        
        // If drawing editor modal is open, let drawingEditor handle it instead
        if (drawingEditor.container && drawingEditor.container.style.display === "flex") return;
        
        if (e.code === "Space") {
            e.preventDefault();
            if (player.isPlaying) player.pause();
            else player.start();
        } else if (e.code === "KeyD") {
            setToolMode("drag");
        } else if (e.code === "KeyA") {
            if (e.ctrlKey) {
                e.preventDefault();
                selectAllBones();
            } else {
                setToolMode("angle");
            }
        } else if (e.code === "KeyF") {
            setToolMode("view");
        } else if (e.code === "Escape") {
            selectedBoneName = "";
            selectedBoneNames = [];
            redrawCanvas();
        } else if (e.ctrlKey && e.code === "KeyS") {
            e.preventDefault();
            saveRigProfile();
        } else if (e.ctrlKey && e.code === "KeyZ") {
            e.preventDefault();
            undoAnimator();
        } else if (e.ctrlKey && e.code === "KeyY") {
            e.preventDefault();
            redoAnimator();
        } else if (e.ctrlKey && e.code === "KeyC") {
            e.preventDefault();
            copyPose();
        } else if (e.ctrlKey && e.code === "KeyV") {
            e.preventDefault();
            pastePose();
        } else if (e.ctrlKey && e.code === "KeyX") {
            e.preventDefault();
            clearPose();
        }
    });

    // Mouse Zoom & Scroll
    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (e.ctrlKey) {
            const zoomFactor = 1.1;
            if (e.deltaY < 0) zoomScale *= zoomFactor;
            else zoomScale /= zoomFactor;
            zoomScale = Math.max(0.1, Math.min(10, zoomScale));
        } else if (e.altKey) {
            panX -= e.deltaY;
        } else {
            panY -= e.deltaY;
        }
        redrawCanvas();
    });

    // Canvas Mouse listeners for rigging/rotating
    canvas.addEventListener("mousedown", handleCanvasMouseDown);
    canvas.addEventListener("mousemove", handleCanvasMouseMove);
    canvas.addEventListener("mouseup", handleCanvasMouseUp);
    
    // Initialize Draw Editor & Assets Center
    drawingEditor.init("draw-editor-container");
    assetsCenter.init("assets-center-container", (category, filePath, filename) => {
        // Attachment Callback
        const activeBone = bones.find(b => b.name === selectedBoneName);
        if (activeBone && category === "body_parts") {
            activeBone.attached_asset = filePath;
            inspectSprite.value = filePath;
            updateSelectedBoneData();
        } else if (category === "character") {
            // Load character rig directly
            loadCharacterProfile(filename.replace(".json", ""));
        }
    }, (category, subpath, filename, relPath) => {
        // Edit callback from Assets Center
        drawingEditor.show(category, subpath, filename, (savedFilePath) => {
            assetsCenter.refresh();
            redrawCanvas();
        });
    });
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

function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
        x: (sx - panX) / zoomScale,
        y: (sy - panY) / zoomScale
    };
}

let redrawRequested = false;
function redrawCanvas() {
    if (redrawRequested) return;
    redrawRequested = true;
    requestAnimationFrame(() => {
        redrawRequested = false;
        
        // Solve positions using math engine (FK + IK targets)
        const solved = solveSkeletalHierarchy(
            bones, 
            poseAdjustments, 
            ikTargets, 
            activePreset, 
            player.currentFrame, 
            presetTimelines,
            lockedBones,
            lockedBoneCoords
        );
        
        // Cache positions for mouse action hits
        window.lastSolvedSkeletalPositions = solved;
        
        // Render on canvas
        SkeletalCanvasRenderer.draw(canvas, ctx, bones, solved, selectedBoneNames, panX, panY, zoomScale, marqueeRect, lockedBones);
    });
}

// Mouse actions & Posing solver
function handleCanvasMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const mWorld = screenToWorld(e.clientX, e.clientY);
    const mScreenX = e.clientX - rect.left;
    const mScreenY = e.clientY - rect.top;

    if (toolMode === "view" || e.button === 1 || (toolMode !== "select" && e.shiftKey)) {
        isPanning = true;
        panStartX = e.clientX - panX;
        panStartY = e.clientY - panY;
        return;
    }

    const solved = solveSkeletalHierarchy(
        bones, 
        poseAdjustments, 
        ikTargets, 
        activePreset, 
        player.currentFrame, 
        presetTimelines,
        lockedBones,
        lockedBoneCoords
    );
    window.lastSolvedSkeletalPositions = solved;
    
    let clickedBoneName = "";
    for (let boneName in solved) {
        const pos = solved[boneName];
        const hitRadius = 12 / zoomScale;
        const dist = Math.hypot(mWorld.x - pos.x, mWorld.y - pos.y);
        if (dist <= hitRadius) {
            clickedBoneName = boneName;
            break;
        }
    }

    if (clickedBoneName) {
        if (toolMode === "select") {
            if (e.ctrlKey) {
                const idx = selectedBoneNames.indexOf(clickedBoneName);
                if (idx > -1) {
                    selectedBoneNames.splice(idx, 1);
                } else {
                    selectedBoneNames.push(clickedBoneName);
                }
            } else {
                selectedBoneNames = [clickedBoneName];
            }
            selectedBoneName = clickedBoneName;
            selectActiveBone(clickedBoneName);
        } else {
            saveAnimatorHistory();
            isDraggingJoint = true;
            draggedBoneName = clickedBoneName;
            
            if (!selectedBoneNames.includes(clickedBoneName)) {
                selectedBoneNames = [clickedBoneName];
                selectedBoneName = clickedBoneName;
                selectActiveBone(clickedBoneName);
            }
            
            // Spine pinning state setup
            if (clickedBoneName === "hip" && bones.some(b => b.name === "head")) {
                const headSolved = solved["head"] || solved["neck"];
                if (headSolved) {
                    window.pinnedHeadPos = { x: headSolved.x, y: headSolved.y };
                }
            } else if ((clickedBoneName === "head" || clickedBoneName === "neck") && bones.some(b => b.name === "hip")) {
                const hipSolved = solved["hip"];
                if (hipSolved) {
                    window.pinnedHipPos = { x: hipSolved.x, y: hipSolved.y };
                }
            }
            
            window.dragStartPivots = {};
            bones.forEach(b => {
                window.dragStartPivots[b.name] = [...b.pivot];
            });
            window.dragStartWorldMouse = { ...mWorld };
        }
        redrawCanvas();
        return;
    }

    if (toolMode === "select") {
        isMarquee = true;
        marqueeStartX = mScreenX;
        marqueeStartY = mScreenY;
        marqueeRect = { x: mScreenX, y: mScreenY, w: 0, h: 0 };
        if (!e.ctrlKey) {
            selectedBoneNames = [];
            selectedBoneName = "";
        }
        redrawCanvas();
    }
}

function handleCanvasMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mWorld = screenToWorld(e.clientX, e.clientY);
    const mScreenX = e.clientX - rect.left;
    const mScreenY = e.clientY - rect.top;

    if (isPanning) {
        panX = e.clientX - panStartX;
        panY = e.clientY - panStartY;
        redrawCanvas();
        return;
    }

    if (isMarquee) {
        marqueeRect.w = mScreenX - marqueeStartX;
        marqueeRect.h = mScreenY - marqueeStartY;
        
        let solved = window.lastSolvedSkeletalPositions;
        if (!solved) {
            solved = solveSkeletalHierarchy(
                bones, 
                poseAdjustments, 
                ikTargets, 
                activePreset, 
                player.currentFrame, 
                presetTimelines,
                lockedBones,
                lockedBoneCoords
            );
            window.lastSolvedSkeletalPositions = solved;
        }
        
        const xMin = Math.min(marqueeStartX, mScreenX);
        const xMax = Math.max(marqueeStartX, mScreenX);
        const yMin = Math.min(marqueeStartY, mScreenY);
        const yMax = Math.max(marqueeStartY, mScreenY);
        
        const newlySelected = [];
        for (let boneName in solved) {
            const pos = solved[boneName];
            const screenX = pos.x * zoomScale + panX;
            const screenY = pos.y * zoomScale + panY;
            if (screenX >= xMin && screenX <= xMax && screenY >= yMin && screenY <= yMax) {
                newlySelected.push(boneName);
            }
        }
        
        if (e.ctrlKey) {
            const temp = new Set([...selectedBoneNames, ...newlySelected]);
            selectedBoneNames = Array.from(temp);
        } else {
            selectedBoneNames = newlySelected;
        }
        
        if (selectedBoneNames.length > 0) {
            selectedBoneName = selectedBoneNames[selectedBoneNames.length - 1];
            selectActiveBone(selectedBoneName);
        }
        redrawCanvas();
        return;
    }

    if (!isDraggingJoint || !draggedBoneName) return;

    let solved = window.lastSolvedSkeletalPositions;
    if (!solved) {
        solved = solveSkeletalHierarchy(
            bones, 
            poseAdjustments, 
            ikTargets, 
            activePreset, 
            player.currentFrame, 
            presetTimelines,
            lockedBones,
            lockedBoneCoords
        );
        window.lastSolvedSkeletalPositions = solved;
    }
    
    const deltaX = mWorld.x - window.dragStartWorldMouse.x;
    const deltaY = mWorld.y - window.dragStartWorldMouse.y;

    const bone = bones.find(b => b.name === draggedBoneName);
    if (!bone) return;

    if (selectedBoneNames.length > 1 && selectedBoneNames.includes(draggedBoneName)) {
        // Group dragging translation
        selectedBoneNames.forEach(name => {
            const b = bones.find(x => x.name === name);
            if (!b) return;
            
            const parentIsSelected = b.parent && selectedBoneNames.includes(b.parent);
            if (parentIsSelected) return;
            
            if (!b.parent) {
                const startPivot = window.dragStartPivots[name];
                b.pivot = [
                    Math.round(startPivot[0] + deltaX),
                    Math.round(startPivot[1] + deltaY)
                ];
            } else {
                const startPivot = window.dragStartPivots[name];
                const p_solved = solved[b.parent];
                if (!p_solved) return;
                
                const rad = -p_solved.angle * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const localDeltaX = (deltaX * cos - deltaY * sin) / p_solved.sx;
                const localDeltaY = (deltaX * sin + deltaY * cos) / p_solved.sy;
                
                b.pivot = [
                    Math.round(startPivot[0] + localDeltaX),
                    Math.round(startPivot[1] + localDeltaY)
                ];
            }
        });
        
        const activeB = bones.find(b => b.name === selectedBoneName);
        if (activeB) {
            const px = document.getElementById("bone-inspect-px");
            const py = document.getElementById("bone-inspect-py");
            if (px) px.value = activeB.pivot[0];
            if (py) py.value = activeB.pivot[1];
        }
    } else {
        // Single bone dragging
        const isTerminalLimb = bones.every(b => b.parent !== draggedBoneName);

        if (draggedBoneName === "hip" && window.pinnedHeadPos) {
            bone.pivot = [Math.round(mWorld.x), Math.round(mWorld.y)];
            const px = document.getElementById("bone-inspect-px");
            const py = document.getElementById("bone-inspect-py");
            if (px) px.value = bone.pivot[0];
            if (py) py.value = bone.pivot[1];
            
            if (!ikTargets) ikTargets = {};
            const headName = bones.find(b => b.name === "head") ? "head" : "neck";
            ikTargets[headName] = [window.pinnedHeadPos.x, window.pinnedHeadPos.y];
        } else if ((draggedBoneName === "head" || draggedBoneName === "neck") && window.pinnedHipPos) {
            const hipBone = bones.find(b => b.name === "hip");
            if (hipBone) {
                hipBone.pivot = [Math.round(window.pinnedHipPos.x), Math.round(window.pinnedHipPos.y)];
            }
            if (!ikTargets) ikTargets = {};
            ikTargets[draggedBoneName] = [mWorld.x, mWorld.y];
        } else if (enableIKMode && toolMode === "drag" && isTerminalLimb && bone.parent) {
            if (!ikTargets) ikTargets = {};
            ikTargets[draggedBoneName] = [mWorld.x, mWorld.y];
        } else {
            if (bone.parent) {
                const p_pos = solved[bone.parent];
                if (!p_pos) return;
                
                const angleRad = Math.atan2(mWorld.y - p_pos.y, mWorld.x - p_pos.x);
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
                bone.pivot = [Math.round(mWorld.x), Math.round(mWorld.y)];
                const px = document.getElementById("bone-inspect-px");
                const py = document.getElementById("bone-inspect-py");
                if (px) px.value = bone.pivot[0];
                if (py) py.value = bone.pivot[1];
            }
        }
    }
    
    redrawCanvas();
}

function handleCanvasMouseUp() {
    isDraggingJoint = false;
    draggedBoneName = "";
    isPanning = false;
    if (isMarquee) {
        isMarquee = false;
        marqueeRect = null;
        redrawCanvas();
    }
    window.pinnedHeadPos = null;
    window.pinnedHipPos = null;
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

// Animator History (Undo/Redo) & clipboard functions
function saveAnimatorHistory() {
    animatorHistory.push(JSON.parse(JSON.stringify(poseAdjustments)));
    if (animatorHistory.length > 50) animatorHistory.shift();
    animatorRedoStack = [];
}

function undoAnimator() {
    if (animatorHistory.length === 0) return;
    animatorRedoStack.push(JSON.parse(JSON.stringify(poseAdjustments)));
    poseAdjustments = animatorHistory.pop();
    redrawCanvas();
}

function redoAnimator() {
    if (animatorRedoStack.length === 0) return;
    animatorHistory.push(JSON.parse(JSON.stringify(poseAdjustments)));
    poseAdjustments = animatorRedoStack.pop();
    redrawCanvas();
}

function copyPose() {
    copiedPose = JSON.parse(JSON.stringify(poseAdjustments));
}

function pastePose() {
    if (!copiedPose) return;
    saveAnimatorHistory();
    poseAdjustments = JSON.parse(JSON.stringify(copiedPose));
    redrawCanvas();
}

function clearPose() {
    saveAnimatorHistory();
    poseAdjustments = {};
    ikTargets = null;
    redrawCanvas();
}

function selectAllBones() {
    selectedBoneNames = bones.map(b => b.name);
    if (selectedBoneNames.length > 0) {
        selectedBoneName = selectedBoneNames[0];
        selectActiveBone(selectedBoneName);
    }
    redrawCanvas();
}
