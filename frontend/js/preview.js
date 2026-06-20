/**
 * Subtitle Live Preview Module.
 * Renders a CSS text-shadow simulation of the ASS subtitle font, outline, and shadow.
 */

export function updateSubtitlePreview() {
    const selectSubFont = document.getElementById("setting-sub-font");
    const inputSubFontSize = document.getElementById("setting-sub-size");
    const inputSubColor = document.getElementById("setting-sub-color");
    const inputSubOutlineColor = document.getElementById("setting-sub-outline-color");
    const inputSubOutlineWidth = document.getElementById("setting-sub-outline-width");
    const inputSubShadowColor = document.getElementById("setting-sub-shadow-color");
    const inputSubShadowDepth = document.getElementById("setting-sub-shadow-depth");
    const settingSubBold = document.getElementById("setting-sub-bold");
    const settingSubItalic = document.getElementById("setting-sub-italic");
    const subPreviewText = document.getElementById("sub-preview-text");

    if (!subPreviewText) return;

    const font = selectSubFont ? selectSubFont.value : "Arial";
    const size = inputSubFontSize ? (parseInt(inputSubFontSize.value, 10) || 48) : 48;
    const color = inputSubColor ? inputSubColor.value : "#FFFFFF";
    const outlineColor = inputSubOutlineColor ? inputSubOutlineColor.value : "#000000";
    const outlineWidth = inputSubOutlineWidth ? (parseInt(inputSubOutlineWidth.value, 10) || 3) : 3;
    const shadowColor = inputSubShadowColor ? inputSubShadowColor.value : "#000000";
    const shadowDepth = inputSubShadowDepth ? (parseInt(inputSubShadowDepth.value, 10) || 0) : 0;
    const isBold = settingSubBold ? settingSubBold.checked : false;
    const isItalic = settingSubItalic ? settingSubItalic.checked : false;

    subPreviewText.style.fontFamily = `"${font}", Arial, sans-serif`;
    subPreviewText.style.fontSize = `${Math.max(16, size / 1.8)}px`;
    subPreviewText.style.color = color;
    subPreviewText.style.fontWeight = isBold ? "bold" : "normal";
    subPreviewText.style.fontStyle = isItalic ? "italic" : "normal";

    // Generate text-shadow for outline and shadow
    let shadows = [];
    const w = parseFloat(outlineWidth) / 1.5;
    if (w > 0) {
        for (let dx = -w; dx <= w; dx += Math.max(w / 2, 0.5)) {
            for (let dy = -w; dy <= w; dy += Math.max(w / 2, 0.5)) {
                if (dx !== 0 || dy !== 0) {
                    shadows.push(`${dx.toFixed(1)}px ${dy.toFixed(1)}px 0px ${outlineColor}`);
                }
            }
        }
    }

    const d = parseFloat(shadowDepth) / 1.5;
    if (d > 0) {
        shadows.push(`${d.toFixed(1)}px ${d.toFixed(1)}px 0px ${shadowColor}`);
    }

    subPreviewText.style.textShadow = shadows.join(", ") || "none";
}
