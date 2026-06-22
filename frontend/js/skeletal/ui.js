// 2D Skeletal Animation UI Manager

export class SkeletalUIHelper {
    static renderBoneTree(bones, selectedBoneName, onSelect) {
        const tree = document.getElementById("rig-bone-tree");
        if (!tree) return;
        tree.innerHTML = "";
        
        bones.forEach(b => {
            const parentLabel = b.parent ? 
                `<span style="font-size:0.75rem; color:#64748b;">(${b.parent})</span>` : 
                '<span style="font-size:0.75rem; color:#10b981;">(root)</span>';
            const activeClass = b.name === selectedBoneName ? "active" : "";
            
            const li = document.createElement("li");
            li.className = `hierarchy-item ${activeClass}`;
            li.innerHTML = `<span>🦴 ${b.name}</span> ${parentLabel}`;
            li.addEventListener("click", () => {
                if (onSelect) onSelect(b.name);
            });
            tree.appendChild(li);
        });
    }

    static populateBonesDropdowns(bones, currentParent) {
        const parentSel = document.getElementById("bone-inspect-parent");
        if (!parentSel) return;
        parentSel.innerHTML = '<option value="">-- None (Root) --</option>';
        bones.forEach(b => {
            parentSel.innerHTML += `<option value="${b.name}">${b.name}</option>`;
        });
        parentSel.value = currentParent || "";
    }

    static updateInspector(bone) {
        if (!bone) return;
        
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

        if (inspectName) inspectName.value = bone.name;
        if (inspectParent) inspectParent.value = bone.parent || "";
        if (inspectPx) inspectPx.value = bone.pivot[0];
        if (inspectPy) inspectPy.value = bone.pivot[1];
        if (inspectAx) inspectAx.value = bone.anchor[0];
        if (inspectAy) inspectAy.value = bone.anchor[1];
        if (inspectAngleSlider) inspectAngleSlider.value = bone.angle || 0;
        if (inspectAngle) inspectAngle.value = bone.angle || 0;
        if (inspectSprite) inspectSprite.value = bone.attached_asset || "";
        if (inspectZ) inspectZ.value = bone.z_index || 10;
        
        // Face configuration UI
        if (bone.face_zone) {
            const faceEx = document.getElementById("face-inspect-ex");
            const faceEy = document.getElementById("face-inspect-ey");
            const faceMx = document.getElementById("face-inspect-mx");
            const faceMy = document.getElementById("face-inspect-my");
            const faceEyesSprite = document.getElementById("face-inspect-eyes-sprite");
            const faceMouthSprite = document.getElementById("face-inspect-mouth-sprite");
            
            if (faceEx) faceEx.value = bone.face_zone.eyes_offset[0] || 0;
            if (faceEy) faceEy.value = bone.face_zone.eyes_offset[1] || 0;
            if (faceMx) faceMx.value = bone.face_zone.mouth_offset[0] || 0;
            if (faceMy) faceMy.value = bone.face_zone.mouth_offset[1] || 0;
            if (faceEyesSprite) faceEyesSprite.value = bone.face_zone.eyes_asset || "";
            if (faceMouthSprite) faceMouthSprite.value = bone.face_zone.mouth_asset || "";
        }
    }

    static populateSpritesList(files, onSelectBadge) {
        const container = document.getElementById("uploaded-limbs-list");
        if (!container) return;
        container.innerHTML = "";
        
        files.forEach(f => {
            const span = document.createElement("span");
            span.className = "badge";
            span.style.background = "#1e293b";
            span.style.padding = "0.2rem 0.4rem";
            span.style.cursor = "pointer";
            span.innerText = f;
            span.addEventListener("click", () => {
                if (onSelectBadge) onSelectBadge(f);
            });
            container.appendChild(span);
        });
        
        // Update sprite selectors
        const selectors = [
            document.getElementById("bone-inspect-sprite"),
            document.getElementById("face-inspect-eyes-sprite"),
            document.getElementById("face-inspect-mouth-sprite")
        ];
        selectors.forEach(sel => {
            if (!sel) return;
            const curr = sel.value;
            sel.innerHTML = '<option value="">-- None --</option>';
            files.forEach(f => {
                sel.innerHTML += `<option value="${f}">${f}</option>`;
            });
            sel.value = curr;
        });
    }
}
