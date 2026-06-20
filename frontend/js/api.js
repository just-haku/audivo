/**
 * API client module for the video generation tool.
 * Contains all fetch/XHR communications with the backend.
 */

export async function loadConfig() {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function saveConfig(config) {
    const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error(await res.text());
    return res;
}

export async function importConfig(formData) {
    const res = await fetch("/api/config/import", {
        method: "POST",
        body: formData
    });
    if (!res.ok) throw new Error(await res.text());
    return res;
}

export async function loadVoices() {
    const res = await fetch("/api/voices");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function loadFonts() {
    const res = await fetch("/api/fonts");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function loadSampleScript() {
    const res = await fetch("/api/sample");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function convertToXml(text, voice) {
    const res = await fetch("/api/convert-to-xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text, default_voice: voice })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function generateAiScript(topic, language, ttsType, provider, model, voice) {
    const res = await fetch("/api/ai-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            topic: topic,
            language: language,
            tts_type: ttsType,
            provider: provider,
            model: model || null,
            default_voice: voice
        })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function uploadFont(formData) {
    const res = await fetch("/api/upload-font", {
        method: "POST",
        body: formData
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function loadMaterials() {
    const res = await fetch("/api/materials");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function saveMaterialCategory(filename, category) {
    const res = await fetch("/api/material-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, category })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function deleteVideoFile(filename) {
    const res = await fetch(`/api/materials/videos/${encodeURIComponent(filename)}`, {
        method: "DELETE"
    });
    if (!res.ok) throw new Error(await res.text());
    return res;
}

export async function triggerDownload(url, type) {
    const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url, material_type: type })
    });
    if (!res.ok) throw new Error(await res.text());
    return res;
}

export async function downloadAsrModel(modelName) {
    const res = await fetch("/api/asr/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_name: modelName || null })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function downloadModel(modelId) {
    const res = await fetch("/api/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_id: modelId })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function uploadMaterial(formData, type) {
    const res = await fetch(`/api/upload?file_type=${type}`, {
        method: "POST",
        body: formData
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function triggerGeneration(payload) {
    const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    return res;
}

export async function loadSystemStatus() {
    const res = await fetch("/api/system-status");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function previewVoice(voiceName, voiceLang) {
    const res = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_name: voiceName, language_code: voiceLang })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function loadGallery() {
    const res = await fetch("/api/generated-videos");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function renameVideo(filename, newName) {
    const res = await fetch(`/api/generated-videos/${filename}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_name: newName })
    });
    if (!res.ok) throw new Error(await res.text());
    return res;
}

export async function deleteVideo(filename) {
    const res = await fetch(`/api/generated-videos/${filename}`, {
        method: "DELETE"
    });
    if (!res.ok) throw new Error(await res.text());
    return res;
}

// Jobs & Cache APIs
export async function listJobs(type = null, status = null, limit = 50, offset = 0) {
    let url = `/api/jobs?limit=${limit}&offset=${offset}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getJob(jobId) {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function cancelJob(jobId) {
    const res = await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function retryJob(jobId) {
    const res = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function deleteJob(jobId) {
    const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function wipeAllJobs() {
    const res = await fetch("/api/jobs", { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getCacheStats() {
    const res = await fetch("/api/cache/stats");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function clearCache() {
    const res = await fetch("/api/cache", { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function submitJobSubtitles(jobId, cues) {
    const res = await fetch(`/api/jobs/${jobId}/subtitles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cues: cues })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// Presets APIs
export async function listPresets() {
    const res = await fetch("/api/presets");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getPreset(name) {
    const res = await fetch(`/api/presets/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function savePreset(name, settings) {
    const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, settings })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function deletePreset(name) {
    const res = await fetch(`/api/presets/${encodeURIComponent(name)}`, {
        method: "DELETE"
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// Projects APIs
export async function listProjects() {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function getProject(projectId) {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function saveProject(projectData) {
    const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function updateProject(projectId, projectData) {
    const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function deleteProject(projectId) {
    const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE"
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function generateProject(projectId) {
    const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST"
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function postWebGpuProbe(probeResult) {
    const res = await fetch("/api/webgpu/probe-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(probeResult)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function runWizardCheck() {
    const res = await fetch("/api/wizard/check");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
