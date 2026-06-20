import { TRANSLATIONS, safeSetText, safeSetPlaceholder, t, getActiveLanguage } from './translations.js';
import { icon, registerGlobalIconHelper } from './icons.js';
import { PanelManager } from './panels.js';
import * as api from './api.js';
import { updateSubtitlePreview } from './preview.js';

registerGlobalIconHelper();


document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const langSelector = document.getElementById("lang-selector");
    
    const cardKeys = document.querySelector(".card-keys");
    const headerKeys = document.getElementById("header-keys");
    const bodyKeys = document.getElementById("body-keys");
    
    const cardVieneuConfig = document.querySelector(".card-vieneu-config");
    const headerVieneuConfig = document.getElementById("header-vieneu-config");
    const bodyVieneuConfig = document.getElementById("body-vieneu-config");

    const cardProviders = document.querySelector(".card-providers");
    const headerProviders = document.getElementById("header-providers");
    const bodyProviders = document.getElementById("body-providers");

    const cardSystemConfig = document.querySelector(".card-system-config");
    const headerSystemConfig = document.getElementById("header-system-config");
    const bodySystemConfig = document.getElementById("body-system-config");

    const btnSaveKeys = document.getElementById("btn-save-keys");
    
    // Key pools textareas
    const keyPexels = document.getElementById("key-pexels");
    const keyPixabay = document.getElementById("key-pixabay");
    const keyGemini = document.getElementById("key-gemini");
    const keyGroq = document.getElementById("key-groq");
    const keyDeepSeek = document.getElementById("key-deepseek");
    const keyXai = document.getElementById("key-xai");
    const keyOllama = document.getElementById("key-ollama");
    
    // Config export/import
    const btnExportConfig = document.getElementById("btn-export-config");
    const btnImportConfigTrigger = document.getElementById("btn-import-config-trigger");
    const importConfigInput = document.getElementById("import-config-input");
    
    const cardScriptEl = document.getElementById("card-script-el");
    const textareaScript = document.getElementById("script-text");
    const btnLoadSample = document.getElementById("btn-load-sample");
    const btnConvertXml = document.getElementById("btn-convert-xml");
    const btnConfirmScript = document.getElementById("btn-confirm-script");
    
    // AI Writer inputs
    const aiProvider = document.getElementById("ai-provider");
    const aiModel = document.getElementById("ai-model");
    const aiTopic = document.getElementById("ai-topic");
    const btnAiScript = document.getElementById("btn-ai-script");
    const vieneuVipPanel = document.getElementById("vieneu-vip-panel");
    
    const inputDownloadUrl = document.getElementById("download-url");
    const selectDownloadType = document.getElementById("download-type");
    const btnDownload = document.getElementById("btn-download");
    
    const uploadVideoBox = document.getElementById("upload-video-box");
    const uploadVideoInput = document.getElementById("upload-video-input");
    const uploadMusicBox = document.getElementById("upload-music-box");
    const uploadMusicInput = document.getElementById("upload-music-input");
    const uploadFontBox = document.getElementById("upload-font-box");
    const uploadFontInput = document.getElementById("upload-font-input");
    
    const countVideos = document.getElementById("count-videos");
    const listVideos = document.getElementById("list-videos");
    const listMusic = document.getElementById("list-music");
    
    // Voice selection selectors
    const selectVoiceLang = document.getElementById("setting-voice-lang");
    const selectVoiceModel = document.getElementById("setting-voice-model");
    const btnPreviewVoice = document.getElementById("btn-preview-voice");
    const settingCpuThreads = document.getElementById("setting-cpu-threads");
    const settingVieneuVersion = document.getElementById("setting-vieneu-version");
    const settingVieneuBatch = document.getElementById("setting-vieneu-batch");
    const settingVieneuOnnxDir = document.getElementById("setting-vieneu-onnx-dir");
    const settingVieneuCodecDir = document.getElementById("setting-vieneu-codec-dir");
    const settingVieneuMode = document.getElementById("setting-vieneu-mode");
    const settingVieneuHfOffline = document.getElementById("setting-vieneu-hf-offline");
    const settingVieneuApiBase = document.getElementById("setting-vieneu-api-base");
    const settingVieneuModelName = document.getElementById("setting-vieneu-model-name");
    const btnDownloadVieneuOnnx = document.getElementById("btn-download-vieneu-onnx");
    const btnDownloadVieneuCodec = document.getElementById("btn-download-vieneu-codec");
    const settingFishSpeechApiUrl = document.getElementById("setting-fish-speech-api-url");
    const settingFishSpeechApiKey = document.getElementById("setting-fish-speech-api-key");
    const settingFishSpeechRefAudio = document.getElementById("setting-fish-speech-ref-audio");
    const settingOmniVoiceApiUrl = document.getElementById("setting-omnivoice-api-url");
    const settingOmniVoiceInstruct = document.getElementById("setting-omnivoice-instruct");
    const settingOmniVoiceRefAudio = document.getElementById("setting-omnivoice-ref-audio");
    const settingGenericTtsUrl = document.getElementById("setting-generic-tts-url");
    const settingGenericTtsKey = document.getElementById("setting-generic-tts-key");
    const settingGenericTtsModel = document.getElementById("setting-generic-tts-model");
    const settingGenericTtsVoice = document.getElementById("setting-generic-tts-voice");
    const settingAsrProvider = document.getElementById("setting-asr-provider");
    const settingAsrRemoteUrl = document.getElementById("setting-asr-remote-url");
    const settingAsrRemoteKey = document.getElementById("setting-asr-remote-key");
    const settingAsrLocalPath = document.getElementById("setting-asr-local-path");
    const settingSubtitleTimingSource = document.getElementById("setting-subtitle-timing-source");
    const settingXhsApiUrl = document.getElementById("setting-xhs-api-url");
    const settingWebgpuEnabled = document.getElementById("setting-webgpu-enabled");
    const btnDownloadAsrModel = document.getElementById("btn-download-asr-model");
    
    const selectAspect = document.getElementById("setting-aspect");
    const inputSpeed = document.getElementById("setting-speed");
    const selectVideoOrder = document.getElementById("setting-video-order");
    const sliderVolume = document.getElementById("setting-volume");
    const volumeVal = document.getElementById("volume-val");
    const settingMuteVideo = document.getElementById("setting-mute-video");
    
    // Subtitle inputs
    const selectSubFont = document.getElementById("setting-sub-font");
    const inputSubFontSize = document.getElementById("setting-sub-size");
    const inputSubColor = document.getElementById("setting-sub-color");
    const subColorVal = document.getElementById("sub-color-val");
    const inputSubOutlineColor = document.getElementById("setting-sub-outline-color");
    const subOutlineColorVal = document.getElementById("sub-outline-color-val");
    const inputSubOutlineWidth = document.getElementById("setting-sub-outline-width");
    const inputSubShadowColor = document.getElementById("setting-sub-shadow-color");
    const subShadowColorVal = document.getElementById("sub-shadow-color-val");
    const inputSubShadowDepth = document.getElementById("setting-sub-shadow-depth");
    const inputSubMarginV = document.getElementById("setting-sub-margin-v");
    const settingSubBold = document.getElementById("setting-sub-bold");
    const settingSubItalic = document.getElementById("setting-sub-italic");
    const subPreviewText = document.getElementById("sub-preview-text");
    
    const btnGenerate = document.getElementById("btn-generate");
    const btnClearLogs = document.getElementById("btn-clear-logs");
    const logsTerminal = document.getElementById("logs-terminal");
    
    const videoPreviewContainer = document.getElementById("video-preview-container");
    const btnDownloadVideo = document.getElementById("btn-download-video");
    const videoCategoryInput = document.getElementById("video-category-input");
    const videoCategoryFilter = document.getElementById("video-category-filter");
    const btnApplyCategory = document.getElementById("btn-apply-category");
    const btnSelectCategory = document.getElementById("btn-select-category");

    let logEventSource = null;
    let voicesGroupedData = {}; // Stores dynamically fetched grouped voices
    let isScriptValidated = false; // Validation state check
    let materialCategories = {};
    let panelManager = null;


    // --- Local VieNeu Preset Voice Keys ---
    const VIENEU_VOICES = [
        "Ngọc Linh", "Ngọc Lan", "Mỹ Duyên", "Trúc Ly",
        "Gia Bảo", "Thái Sơn", "Đức Trí", "Xuân Vĩnh",
        "Trọng Hữu", "Bình An",
        "Ngoc", "Ly", "Doan", "Binh", "Tuyen", "Vinh"
    ];

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- Custom Web Dialogs ---
    function customAlert(message, title = "Info") {
        return new Promise((resolve) => {
            const modal = document.getElementById("custom-confirm-modal");
            const titleEl = document.getElementById("confirm-modal-title");
            const msgEl = document.getElementById("confirm-modal-message");
            const okBtn = document.getElementById("btn-confirm-ok");
            const cancelBtn = document.getElementById("btn-confirm-cancel");
            
            titleEl.textContent = title;
            msgEl.textContent = message;
            cancelBtn.classList.add("hidden");
            modal.classList.remove("hidden");
            
            const newOk = okBtn.cloneNode(true);
            okBtn.parentNode.replaceChild(newOk, okBtn);
            
            newOk.addEventListener("click", () => {
                modal.classList.add("hidden");
                cancelBtn.classList.remove("hidden"); // restore for future confirm calls
                resolve();
            });
        });
    }

    function customConfirm(message, title = "Confirm") {
        return new Promise((resolve) => {
            const modal = document.getElementById("custom-confirm-modal");
            const titleEl = document.getElementById("confirm-modal-title");
            const msgEl = document.getElementById("confirm-modal-message");
            const okBtn = document.getElementById("btn-confirm-ok");
            const cancelBtn = document.getElementById("btn-confirm-cancel");
            
            titleEl.textContent = title;
            msgEl.textContent = message;
            cancelBtn.classList.remove("hidden");
            modal.classList.remove("hidden");
            
            const newOk = okBtn.cloneNode(true);
            const newCancel = cancelBtn.cloneNode(true);
            okBtn.parentNode.replaceChild(newOk, okBtn);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
            
            newOk.addEventListener("click", () => {
                modal.classList.add("hidden");
                resolve(true);
            });
            
            newCancel.addEventListener("click", () => {
                modal.classList.add("hidden");
                resolve(false);
            });
        });
    }

    function customPrompt(message, title = "Enter Value", defaultValue = "", isTextarea = false) {
        return new Promise((resolve) => {
            const modal = document.getElementById("custom-prompt-modal");
            const titleEl = document.getElementById("prompt-modal-title");
            const msgEl = document.getElementById("prompt-modal-message");
            const inputEl = document.getElementById("prompt-modal-input");
            const textareaEl = document.getElementById("prompt-modal-textarea");
            const okBtn = document.getElementById("btn-prompt-ok");
            const cancelBtn = document.getElementById("btn-prompt-cancel");
            
            titleEl.textContent = title;
            msgEl.textContent = message;
            
            if (isTextarea) {
                inputEl.style.display = "none";
                textareaEl.style.display = "block";
                textareaEl.value = defaultValue;
            } else {
                textareaEl.style.display = "none";
                inputEl.style.display = "block";
                inputEl.value = defaultValue;
            }
            
            modal.classList.remove("hidden");
            
            const newOk = okBtn.cloneNode(true);
            const newCancel = cancelBtn.cloneNode(true);
            okBtn.parentNode.replaceChild(newOk, okBtn);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
            
            const handleConfirm = () => {
                modal.classList.add("hidden");
                const val = isTextarea ? textareaEl.value : inputEl.value;
                resolve(val);
            };
            
            const handleCancel = () => {
                modal.classList.add("hidden");
                resolve(null);
            };
            
            newOk.addEventListener("click", handleConfirm);
            newCancel.addEventListener("click", handleCancel);
            
            setTimeout(() => {
                if (isTextarea) textareaEl.focus();
                else inputEl.focus();
            }, 100);
        });
    }


    function safeSetHTML(id, html) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    function renderAllIcons() {
        safeSetHTML("logo-svg", icon('rocket', { size: 28 }));
        safeSetHTML("icon-upload-video", icon('video', { size: 28 }));
        safeSetHTML("icon-upload-music", icon('music', { size: 28 }));
        safeSetHTML("icon-upload-font", icon('type', { size: 28 }));
        safeSetHTML("icon-upload-intro", icon('clapperboard', { size: 28 }));
        safeSetHTML("icon-upload-outro", icon('film', { size: 28 }));
        safeSetHTML("icon-upload-watermark", icon('image', { size: 28 }));
        safeSetHTML("icon-save-settings", icon('save', { size: 16 }));
        safeSetHTML("icon-compile", icon('zap', { size: 18 }));
        safeSetHTML("icon-video-placeholder", icon('clapperboard', { size: 48 }));
        safeSetHTML("icon-download-video", icon('download', { size: 16, className: 'btn-icon' }));
    }

    // --- Language Translation function ---
    function translateUI(lang) {
        const dict = TRANSLATIONS[lang] || TRANSLATIONS["en-US"];
        
        safeSetText("hdr-subtitle", dict.hdr_subtitle);
        safeSetText("lbl-keys-title", dict.keys_title);
        safeSetText("lbl-key-pexels", dict.key_pexels);
        safeSetText("lbl-key-pixabay", dict.key_pixabay);
        safeSetText("lbl-key-gemini", dict.key_gemini);
        safeSetText("lbl-key-groq", dict.key_groq);
        safeSetText("lbl-key-deepseek", dict.key_deepseek);
        safeSetText("lbl-key-xai", dict.key_xai);
        safeSetText("lbl-key-ollama", dict.key_ollama);
        if (btnSaveKeys) btnSaveKeys.textContent = dict.save_keys;
        safeSetText("lbl-script-title", dict.script_title);
        safeSetText("lbl-ai-writer", dict.ai_writer);
        safeSetPlaceholder("ai-topic", dict.ai_topic_placeholder);
        if (btnAiScript) btnAiScript.textContent = dict.btn_ai_script;
        safeSetText("lbl-script-label", dict.script_label);
        safeSetPlaceholder("script-text", dict.script_placeholder);
        safeSetText("lbl-vip-help", dict.vieneu_vip_desc);
        if (btnLoadSample) btnLoadSample.textContent = dict.load_sample;
        if (btnConvertXml) btnConvertXml.textContent = dict.convert_xml;
        if (btnConfirmScript) btnConfirmScript.textContent = dict.confirm_script;
        safeSetText("lbl-materials-title", dict.materials_title);
        safeSetText("lbl-stock-title", dict.stock_title);
        safeSetPlaceholder("download-url", dict.download_placeholder);
        if (btnDownload) btnDownload.textContent = dict.download_btn;
        safeSetText("lbl-upload-title", dict.upload_title);
        safeSetText("lbl-upload-vid", dict.upload_vid);
        safeSetText("lbl-upload-aud", dict.upload_aud);
        safeSetText("lbl-upload-font", dict.upload_font);
        safeSetText("lbl-select-title", dict.select_title);
        
        const lblVidPool = document.getElementById("lbl-vid-pool");
        if (lblVidPool && lblVidPool.childNodes.length > 0) {
            lblVidPool.childNodes[0].nodeValue = `${dict.vid_pool} `;
        }
        safeSetText("lbl-bg-music", dict.bg_music);
        safeSetText("lbl-settings-title", dict.settings_title);
        safeSetText("lbl-voice-lang", dict.voice_lang);
        safeSetText("lbl-voice-model", dict.voice_model);
        safeSetText("lbl-aspect", dict.aspect);
        safeSetText("lbl-speed", dict.speed);
        safeSetText("lbl-volume", dict.volume);
        safeSetText("lbl-mute-video", dict.mute_video);
        safeSetText("lbl-sub-style-title", dict.sub_style_title);
        safeSetText("lbl-sub-font", dict.sub_font);
        safeSetText("lbl-sub-size", dict.sub_size);
        safeSetText("lbl-sub-color", dict.sub_color);
        safeSetText("lbl-sub-outline-color", dict.sub_outline_color);
        safeSetText("lbl-sub-outline-width", dict.sub_outline_width);
        safeSetText("lbl-sub-shadow-color", dict.sub_shadow_color);
        safeSetText("lbl-sub-shadow-depth", dict.sub_shadow_depth);
        safeSetText("lbl-sub-margin-v", dict.sub_margin_v);
        safeSetText("lbl-sub-bold", dict.sub_bold);
        safeSetText("lbl-sub-italic", dict.sub_italic);
        safeSetText("lbl-sub-preview", dict.sub_preview);
        safeSetText("lbl-status-title", dict.status_title);
        safeSetText("lbl-logs-title", dict.logs_title);
        safeSetText("lbl-preview-title", dict.preview_title);
        if (btnDownloadVideo) btnDownloadVideo.textContent = dict.btn_download_video;
        
        const placeholder = document.querySelector("#video-preview-container .video-placeholder p");
        if (placeholder) {
            placeholder.textContent = dict.preview_placeholder;
        }
        
        const compileBtnSpan = document.querySelector("#btn-generate span:not(.btn-icon)");
        if (compileBtnSpan && !btnGenerate.disabled) {
            compileBtnSpan.textContent = dict.btn_compile;
        }
        
        safeSetText("lbl-gallery-title", dict.gallery_title);
        safeSetText("lbl-cpu-threads", dict.cpu_threads_label);
        safeSetText("lbl-vieneu-version", dict.vieneu_version_label);
        const optVieneuV3 = document.getElementById("opt-vieneu-v3");
        if (optVieneuV3) optVieneuV3.textContent = dict.v3_option;
        const optVieneuV2 = document.getElementById("opt-vieneu-v2");
        if (optVieneuV2) optVieneuV2.textContent = dict.v2_option;
        if (btnPreviewVoice) btnPreviewVoice.textContent = dict.btn_preview;
        updateSubtitlePreview();
        if (panelManager) {
            panelManager.updateTranslations();
        }
        loadGallery();
    }

    langSelector.addEventListener("change", (e) => {
        translateUI(e.target.value);
    });

    // --- Panel Manager Initialization ---
    panelManager = new PanelManager();
    panelManager.register('keys', { iconName: 'key-round', elementId: 'panel-keys', tooltipKey: 'sidebar_keys' });
    panelManager.register('vieneu', { iconName: 'mic', elementId: 'panel-vieneu-config', tooltipKey: 'sidebar_vieneu' });
    panelManager.register('providers', { iconName: 'megaphone', elementId: 'panel-providers', tooltipKey: 'sidebar_providers' });
    panelManager.register('system', { iconName: 'settings', elementId: 'panel-system-config', tooltipKey: 'sidebar_system' });
    panelManager.register('presets', { iconName: 'palette', elementId: 'panel-presets', tooltipKey: 'sidebar_presets' });
    panelManager.register('projects', { iconName: 'folder', elementId: 'panel-projects', tooltipKey: 'sidebar_projects' });
    panelManager.register('jobs', { iconName: 'clipboard-list', elementId: 'panel-jobs-history', tooltipKey: 'sidebar_jobs' });
    panelManager.register('gallery', { iconName: 'clapperboard', elementId: 'panel-gallery', tooltipKey: 'sidebar_gallery' });
    panelManager.register('status', { iconName: 'activity', elementId: 'panel-status', tooltipKey: 'status_title' });
    panelManager.init();

    const panelGallery = document.getElementById('panel-gallery');
    if (panelGallery) {
        panelGallery.addEventListener('panelOpen', () => loadGallery());
    }


    // --- Load API Keys Config ---
    async function loadConfig() {
        try {
            const data = await api.loadConfig();
            keyPexels.value = (data.pexels_api_keys || []).join("\n");
            keyPixabay.value = (data.pixabay_api_keys || []).join("\n");
            keyGemini.value = (data.gemini_api_keys || []).join("\n");
            keyGroq.value = (data.groq_api_keys || []).join("\n");
            keyDeepSeek.value = (data.deepseek_api_keys || []).join("\n");
            keyXai.value = (data.xai_api_keys || []).join("\n");
            keyOllama.value = (data.ollama_urls || []).join("\n");
            if (settingCpuThreads) {
                settingCpuThreads.value = data.cpu_threads || 0;
            }
            if (settingVieneuVersion) {
                settingVieneuVersion.value = data.vieneu_version || "v3";
            }
            if (settingVieneuBatch) settingVieneuBatch.value = data.vieneu_batch_paragraphs || 1;
            if (settingVieneuOnnxDir) settingVieneuOnnxDir.value = data.vieneu_onnx_dir || "";
            if (settingVieneuCodecDir) settingVieneuCodecDir.value = data.vieneu_codec_dir || "";
            if (settingVieneuMode) settingVieneuMode.value = data.vieneu_mode || "local";
            if (settingVieneuHfOffline) settingVieneuHfOffline.checked = data.vieneu_hf_offline !== false;
            if (settingVieneuApiBase) settingVieneuApiBase.value = data.vieneu_api_base || "http://localhost:23333/v1";
            if (settingVieneuModelName) settingVieneuModelName.value = data.vieneu_model_name || "pnnbao-ump/VieNeu-TTS-v3-Turbo";
            toggleVieneuModeInputs();
            if (settingFishSpeechApiUrl) settingFishSpeechApiUrl.value = data.fish_speech_api_url || "";
            if (settingFishSpeechApiKey) settingFishSpeechApiKey.value = data.fish_speech_api_key || "";
            if (settingFishSpeechRefAudio) settingFishSpeechRefAudio.value = data.fish_speech_ref_audio || "";
            if (settingOmniVoiceApiUrl) settingOmniVoiceApiUrl.value = data.omnivoice_api_url || "";
            if (settingOmniVoiceInstruct) settingOmniVoiceInstruct.value = data.omnivoice_instruct || "";
            if (settingOmniVoiceRefAudio) settingOmniVoiceRefAudio.value = data.omnivoice_ref_audio || "";
            if (settingGenericTtsUrl) settingGenericTtsUrl.value = data.generic_tts_api_url || "";
            if (settingGenericTtsKey) settingGenericTtsKey.value = data.generic_tts_api_key || "";
            if (settingGenericTtsModel) settingGenericTtsModel.value = data.generic_tts_model || "tts-1";
            if (settingGenericTtsVoice) settingGenericTtsVoice.value = data.generic_tts_voice || "default";
            if (settingAsrProvider) settingAsrProvider.value = data.asr_provider || "remote_openai";
            if (settingSubtitleTimingSource) settingSubtitleTimingSource.value = data.subtitle_timing_source || "asr";
            if (settingAsrRemoteUrl) settingAsrRemoteUrl.value = data.asr_remote_api_url || "";
            if (settingAsrRemoteKey) settingAsrRemoteKey.value = data.asr_remote_api_key || "";
            if (settingAsrLocalPath) settingAsrLocalPath.value = data.asr_local_model_path || "";
            if (settingXhsApiUrl) settingXhsApiUrl.value = data.xhs_downloader_api_url || "";
            if (settingWebgpuEnabled) settingWebgpuEnabled.checked = data.webgpu_enabled !== false;
            
            // Load Job and Cache configs
            const settingWipeCache = document.getElementById("setting-wipe-cache");
            const settingMaxJobThreads = document.getElementById("setting-max-job-threads");
            const maxJobThreadsVal = document.getElementById("max-job-threads-val");
            if (settingWipeCache) settingWipeCache.checked = data.wipe_cache_after_generation === true;
            if (settingMaxJobThreads) {
                settingMaxJobThreads.value = data.max_job_threads || 2;
                if (maxJobThreadsVal) maxJobThreadsVal.textContent = data.max_job_threads || 2;
            }
        } catch (err) {
            console.error("Failed to load config keys: ", err);
        }
    }

    // --- Save API Keys Config ---
    btnSaveKeys.addEventListener("click", async () => {
        const settingWipeCache = document.getElementById("setting-wipe-cache");
        const settingMaxJobThreads = document.getElementById("setting-max-job-threads");
        
        const config = {
            pexels_api_keys: keyPexels.value.split("\n").map(k => k.trim()).filter(k => k),
            pixabay_api_keys: keyPixabay.value.split("\n").map(k => k.trim()).filter(k => k),
            gemini_api_keys: keyGemini.value.split("\n").map(k => k.trim()).filter(k => k),
            groq_api_keys: keyGroq.value.split("\n").map(k => k.trim()).filter(k => k),
            deepseek_api_keys: keyDeepSeek.value.split("\n").map(k => k.trim()).filter(k => k),
            xai_api_keys: keyXai.value.split("\n").map(k => k.trim()).filter(k => k),
            ollama_urls: keyOllama.value.split("\n").map(k => k.trim()).filter(k => k),
            cpu_threads: settingCpuThreads ? (parseInt(settingCpuThreads.value, 10) || 0) : 0,
            vieneu_version: settingVieneuVersion ? settingVieneuVersion.value : "v3",
            vieneu_batch_paragraphs: settingVieneuBatch ? Math.min(Math.max(parseInt(settingVieneuBatch.value, 10) || 1, 1), 20) : 1,
            vieneu_mode: settingVieneuMode ? settingVieneuMode.value : "local",
            vieneu_onnx_dir: settingVieneuOnnxDir ? settingVieneuOnnxDir.value.trim() : "",
            vieneu_codec_dir: settingVieneuCodecDir ? settingVieneuCodecDir.value.trim() : "",
            vieneu_hf_offline: settingVieneuHfOffline ? settingVieneuHfOffline.checked : true,
            vieneu_api_base: settingVieneuApiBase ? settingVieneuApiBase.value.trim() : "http://localhost:23333/v1",
            vieneu_model_name: settingVieneuModelName ? settingVieneuModelName.value.trim() : "pnnbao-ump/VieNeu-TTS-v3-Turbo",
            fish_speech_api_url: settingFishSpeechApiUrl ? settingFishSpeechApiUrl.value.trim() : "",
            fish_speech_api_key: settingFishSpeechApiKey ? settingFishSpeechApiKey.value.trim() : "",
            fish_speech_ref_audio: settingFishSpeechRefAudio ? settingFishSpeechRefAudio.value.trim() : "",
            fish_speech_request_format: "msgpack",
            omnivoice_api_url: settingOmniVoiceApiUrl ? settingOmniVoiceApiUrl.value.trim() : "",
            omnivoice_api_key: "",
            omnivoice_model: "omnivoice",
            omnivoice_instruct: settingOmniVoiceInstruct ? settingOmniVoiceInstruct.value.trim() : "",
            omnivoice_ref_audio: settingOmniVoiceRefAudio ? settingOmniVoiceRefAudio.value.trim() : "",
            generic_tts_api_url: settingGenericTtsUrl ? settingGenericTtsUrl.value.trim() : "",
            generic_tts_api_key: settingGenericTtsKey ? settingGenericTtsKey.value.trim() : "",
            generic_tts_model: settingGenericTtsModel ? settingGenericTtsModel.value.trim() || "tts-1" : "tts-1",
            generic_tts_voice: settingGenericTtsVoice ? settingGenericTtsVoice.value.trim() || "default" : "default",
            remote_tts_timeout: 600,
            asr_provider: settingAsrProvider ? settingAsrProvider.value : "remote_openai",
            asr_remote_api_url: settingAsrRemoteUrl ? settingAsrRemoteUrl.value.trim() : "",
            asr_remote_api_key: settingAsrRemoteKey ? settingAsrRemoteKey.value.trim() : "",
            asr_remote_model: "whisper-1",
            asr_custom_api_url: "",
            asr_custom_api_key: "",
            asr_local_model_path: settingAsrLocalPath ? settingAsrLocalPath.value.trim() : "",
            asr_model_dir: "/app/downloads/models/asr",
            asr_managed_model_name: "Systran/faster-whisper-small",
            asr_device: "cpu",
            asr_compute_type: "int8",
            asr_cpu_threads: 0,
            asr_beam_size: 5,
            asr_timeout: 900,
            subtitle_timing_source: settingSubtitleTimingSource ? settingSubtitleTimingSource.value : "asr",
            subtitle_fallback_to_estimated: true,
            subtitle_max_chars: 42,
            subtitle_max_duration: 4.0,
            subtitle_min_duration: 0.8,
            video_categories: materialCategories,
            xhs_downloader_api_url: settingXhsApiUrl ? settingXhsApiUrl.value.trim() : "",
            xhs_cookie: "",
            xhs_proxy: "",
            webgpu_enabled: settingWebgpuEnabled ? settingWebgpuEnabled.checked : true,
            webgpu_tts_enabled: false,
            wipe_cache_after_generation: settingWipeCache ? settingWipeCache.checked : false,
            max_job_threads: settingMaxJobThreads ? (parseInt(settingMaxJobThreads.value, 10) || 2) : 2,
            max_batch: 1
        };
        try {
            const res = await api.saveConfig(config);
            if (res.ok) {
                await customAlert(
                    langSelector.value === "vi-VN" ? "Đã lưu cấu hình thành công!" : "Configuration saved successfully!",
                    langSelector.value === "vi-VN" ? "Thành công" : "Success"
                );
                loadConfig();
                await loadVoices();
            } else {
                await customAlert("Failed to save config.", "Error");
            }
        } catch (err) {
            await customAlert("Error: " + err.message, "Error");
        }
    });

    if (btnDownloadAsrModel) {
        btnDownloadAsrModel.addEventListener("click", async () => {
            btnDownloadAsrModel.disabled = true;
            const originalText = btnDownloadAsrModel.textContent;
            btnDownloadAsrModel.textContent = "Downloading...";
            try {
                printLog("System", "Starting explicit ASR model download...");
                const data = await api.downloadAsrModel("Systran/faster-whisper-small");
                if (settingAsrLocalPath && data.path) {
                    settingAsrLocalPath.value = data.path;
                }
                await customAlert(`ASR model downloaded to: ${data.path}`, "Success");
            } catch (err) {
                printLog("Error", `ASR model download failed: ${err.message}`);
                await customAlert("ASR model download failed: " + err.message, "Error");
            } finally {
                btnDownloadAsrModel.disabled = false;
                btnDownloadAsrModel.textContent = originalText;
            }
        });
    }

    function toggleVieneuModeInputs() {
        const mode = settingVieneuMode ? settingVieneuMode.value : "local";
        const localContainers = [
            document.getElementById("vieneu-local-version-container"),
            document.getElementById("vieneu-local-onnx-container"),
            document.getElementById("vieneu-local-codec-container"),
            document.getElementById("vieneu-local-offline-container")
        ];
        const remoteContainers = [
            document.getElementById("vieneu-remote-url-container"),
            document.getElementById("vieneu-remote-model-container")
        ];
        
        if (mode === "local") {
            localContainers.forEach(el => el && el.classList.remove("hidden"));
            remoteContainers.forEach(el => el && el.classList.add("hidden"));
        } else {
            localContainers.forEach(el => el && el.classList.add("hidden"));
            remoteContainers.forEach(el => el && el.classList.remove("hidden"));
        }
    }
    
    if (settingVieneuMode) {
        settingVieneuMode.addEventListener("change", toggleVieneuModeInputs);
    }

    if (btnDownloadVieneuOnnx) {
        btnDownloadVieneuOnnx.addEventListener("click", async () => {
            btnDownloadVieneuOnnx.disabled = true;
            const originalText = btnDownloadVieneuOnnx.textContent;
            btnDownloadVieneuOnnx.textContent = "Downloading...";
            try {
                printLog("System", "Starting explicit VieNeu ONNX models download...");
                const data = await api.downloadModel("vieneu_onnx");
                if (settingVieneuOnnxDir && data.path) {
                    settingVieneuOnnxDir.value = data.path;
                }
                await customAlert(`VieNeu ONNX models downloaded to: ${data.path}`, "Success");
            } catch (err) {
                printLog("Error", `VieNeu ONNX download failed: ${err.message}`);
                await customAlert("VieNeu ONNX download failed: " + err.message, "Error");
            } finally {
                btnDownloadVieneuOnnx.disabled = false;
                btnDownloadVieneuOnnx.textContent = originalText;
            }
        });
    }

    if (btnDownloadVieneuCodec) {
        btnDownloadVieneuCodec.addEventListener("click", async () => {
            btnDownloadVieneuCodec.disabled = true;
            const originalText = btnDownloadVieneuCodec.textContent;
            btnDownloadVieneuCodec.textContent = "Downloading...";
            try {
                printLog("System", "Starting explicit VieNeu Codec model download...");
                const data = await api.downloadModel("vieneu_codec");
                if (settingVieneuCodecDir && data.path) {
                    settingVieneuCodecDir.value = data.path;
                }
                await customAlert(`VieNeu Codec model downloaded to: ${data.path}`, "Success");
            } catch (err) {
                printLog("Error", `VieNeu Codec download failed: ${err.message}`);
                await customAlert("VieNeu Codec download failed: " + err.message, "Error");
            } finally {
                btnDownloadVieneuCodec.disabled = false;
                btnDownloadVieneuCodec.textContent = originalText;
            }
        });
    }

    // --- Config Export ---
    btnExportConfig.addEventListener("click", () => {
        window.location.href = "/api/config/export";
    });

    // --- Config Import ---
    btnImportConfigTrigger.addEventListener("click", () => {
        importConfigInput.click();
    });

    importConfigInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            printLog("System", `Importing config from file: ${file.name}...`);
            await api.importConfig(formData);
            await customAlert(
                langSelector.value === "vi-VN" ? "Nhập tệp cấu hình thành công!" : "Configuration file imported successfully!",
                langSelector.value === "vi-VN" ? "Thành công" : "Success"
            );
            loadConfig();
        } catch (err) {
            await customAlert("Config import failed: " + err.message, "Error");
        } finally {
            importConfigInput.value = "";
        }
    });

    // --- Color and Volume sliders updates ---
    sliderVolume.addEventListener("input", (e) => {
        volumeVal.textContent = `${Math.round(e.target.value * 100)}%`;
    });

    inputSubColor.addEventListener("input", (e) => {
        subColorVal.textContent = e.target.value.toUpperCase();
        updateSubtitlePreview();
    });

    inputSubOutlineColor.addEventListener("input", (e) => {
        subOutlineColorVal.textContent = e.target.value.toUpperCase();
        updateSubtitlePreview();
    });

    inputSubShadowColor.addEventListener("input", (e) => {
        subShadowColorVal.textContent = e.target.value.toUpperCase();
        updateSubtitlePreview();
    });

    selectAspect.addEventListener("change", (e) => {
        if (e.target.value === "16:9") {
            videoPreviewContainer.classList.add("landscape");
            inputSubMarginV.value = 60;
        } else {
            videoPreviewContainer.classList.remove("landscape");
            inputSubMarginV.value = 180;
        }
        updateSubtitlePreview();
    });

    // --- Dynamic Voices Loading & Language Split ---
    async function loadVoices() {
        try {
            voicesGroupedData = await api.loadVoices();
            
            selectVoiceLang.innerHTML = "";
            const langs = Object.keys(voicesGroupedData).sort();
            for (const lang of langs) {
                const opt = document.createElement("option");
                opt.value = lang;
                opt.textContent = lang;
                selectVoiceLang.appendChild(opt);
            }
            
            // Set default language selection to English or Vietnamese depending on switcher
            if (langs.includes("en-US (United States)")) {
                selectVoiceLang.value = "en-US (United States)";
            } else if (langs.length > 0) {
                selectVoiceLang.value = langs[0];
            }
            
            updateVoiceModels();
        } catch (err) {
            printLog("Error", `Failed to load voice list: ${err.message}`);
        }
    }

    function updateVoiceModels() {
        const selectedLang = selectVoiceLang.value;
        const models = voicesGroupedData[selectedLang] || [];
        
        selectVoiceModel.innerHTML = "";
        for (const v of models) {
            const opt = document.createElement("option");
            opt.value = v.name;
            const desc = v.description ? ` (${v.description})` : ` (${v.gender})`;
            opt.textContent = `${v.name}${desc}`;
            selectVoiceModel.appendChild(opt);
        }
        
        selectVoiceModel.dispatchEvent(new Event("change"));
    }

    function getSelectedVoiceMeta(voiceName) {
        for (const group of Object.values(voicesGroupedData)) {
            const found = group.find(v => v.name === voiceName);
            if (found) return found;
        }
        return null;
    }

    selectVoiceLang.addEventListener("change", updateVoiceModels);

    // Toggle VIP card/panel styling when local Vietnamese voice is chosen
    selectVoiceModel.addEventListener("change", (e) => {
        const selected = e.target.value;
        const meta = getSelectedVoiceMeta(selected);
        const expressionTags = meta && meta.expression_tags ? meta.expression_tags : [];
        const isVieNeu = VIENEU_VOICES.includes(selected);
        
        if (expressionTags.length > 0) {
            cardScriptEl.classList.add("card-vieneu-vip");
            vieneuVipPanel.classList.remove("hidden");
            const badge = vieneuVipPanel.querySelector(".vip-badge");
            const buttons = vieneuVipPanel.querySelector(".vip-buttons");
            if (badge) badge.textContent = `${meta.provider || "TTS"} Tag Helper`;
            if (buttons) {
                buttons.innerHTML = expressionTags.map(tag => (
                    `<button type="button" class="btn btn-secondary btn-xs btn-vip-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
                )).join("");
            }
        } else {
            cardScriptEl.classList.remove("card-vieneu-vip");
            vieneuVipPanel.classList.add("hidden");
        }

        if (meta && meta.requires_remote) {
            printLog("Warning", `${selected} requires a remote TTS API URL configured in Settings.`);
        }
    });

    // --- Insert VIP Emotion tag at cursor ---
    if (vieneuVipPanel) {
        vieneuVipPanel.addEventListener("click", (event) => {
            const btn = event.target.closest(".btn-vip-tag");
            if (!btn) return;
            const tag = btn.getAttribute("data-tag");
            const txt = textareaScript;
            const start = txt.selectionStart;
            const end = txt.selectionEnd;
            const oldVal = txt.value;
            
            txt.value = oldVal.substring(0, start) + tag + oldVal.substring(end);
            txt.focus();
            txt.selectionStart = txt.selectionEnd = start + tag.length;
            isScriptValidated = false;
        });
    }

    // --- Load Sample Script ---
    btnLoadSample.addEventListener("click", async () => {
        try {
            printLog("System", "Loading sample script...");
            const data = await api.loadSampleScript();
            if (data.content) {
                textareaScript.value = data.content;
                isScriptValidated = false;
                printLog("Success", "Sample script loaded successfully!");
            } else {
                printLog("Error", "Failed to load sample script.");
            }
        } catch (err) {
            printLog("Error", `Error: ${err.message}`);
        }
    });

    // --- Convert Plain text to XML based on selected Voice ---
    btnConvertXml.addEventListener("click", async () => {
        const rawText = textareaScript.value.trim();
        if (!rawText) {
            await customAlert("Please enter some plain text script first!", "Alert");
            return;
        }

        const voice = selectVoiceModel.value;
        const meta = getSelectedVoiceMeta(voice);
        const provider = meta ? meta.provider : (VIENEU_VOICES.includes(voice) ? "vieneu" : "google");
        
        if (provider !== "google") {
            printLog("System", `${provider} active. Keeping script as plain text with paragraph splitting...`);
            try {
                const paragraphs = rawText.split(/\n\s*\n/).map(s => s.trim()).filter(s => s);
                textareaScript.value = paragraphs.join("\n\n");
                isScriptValidated = false;
                printLog("Success", "Plain text is ready. Inline expression tags are preserved.");
            } catch (err) {
                printLog("Error", `Split failed: ${err.message}`);
            }
        } else {
            // Google TTS parser stage: Wrap in XML voice/speak blocks
            if (rawText.startsWith("<voice")) {
                await customAlert("This script is already formatted in voice XML!", "Alert");
                return;
            }
            printLog("System", "Google TTS active. Formatting script to SSML XML blocks...");
            try {
                const data = await api.convertToXml(rawText, voice);
                if (data.xml) {
                    textareaScript.value = data.xml;
                    isScriptValidated = false;
                    printLog("Success", "Script converted to voice XML blocks successfully!");
                } else {
                    printLog("Warning", "No sentences parsed.");
                }
            } catch (err) {
                printLog("Error", `XML conversion failed: ${err.message}`);
            }
        }
    });

    // --- Generate script using selected LLM provider ---
    btnAiScript.addEventListener("click", async () => {
        const topic = aiTopic.value.trim();
        if (!topic) {
            await customAlert("Please enter a topic or keyword first!", "Alert");
            return;
        }

        btnAiScript.disabled = true;
        btnAiScript.textContent = langSelector.value === "vi-VN" ? "Đang viết..." : "Writing...";
        printLog("System", `AI script generator: Writing script using ${aiProvider.value}...`);

        const voice = selectVoiceModel.value;
        const meta = getSelectedVoiceMeta(voice);
        const provider = meta ? meta.provider : (VIENEU_VOICES.includes(voice) ? "vieneu" : "google");
        const language = provider === "vieneu" || langSelector.value === "vi-VN" ? "vi-VN" : "en-US";

        try {
            const data = await api.generateAiScript(
                topic,
                language,
                provider === "google" ? "google" : "vieneu",
                aiProvider.value,
                aiModel.value.trim(),
                voice
            );

            if (data.script) {
                textareaScript.value = data.script;
                isScriptValidated = false;
                printLog("Success", `AI Script generated successfully via ${aiProvider.value}!`);
            }
        } catch (err) {
            printLog("Error", `AI script generation failed: ${err.message}`);
            await customAlert("AI script generation failed: " + err.message, "Error");
        } finally {
            btnAiScript.disabled = false;
            btnAiScript.textContent = langSelector.value === "vi-VN" ? "Tạo Kịch Bản" : "Write Script";
        }
    });

    // --- Font Upload & Listing ---
    uploadFontBox.addEventListener("click", () => uploadFontInput.click());
    uploadFontInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        printLog("System", `Uploading custom font file: ${file.name}...`);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const data = await api.uploadFont(formData);
            printLog("Success", `Custom font uploaded: ${data.font_name} (${data.filename})`);
            await customAlert(
                langSelector.value === "vi-VN" ? `Phông chữ đã tải lên thành công: ${data.font_name}` : `Font uploaded successfully: ${data.font_name}`,
                "Success"
            );
            await loadFonts();
        } catch (err) {
            printLog("Error", `Failed to upload font: ${err.message}`);
            await customAlert("Font upload failed: " + err.message, "Error");
        } finally {
            uploadFontInput.value = "";
        }
    });

    async function loadFonts() {
        try {
            const fontsList = await api.loadFonts();
            
            const selectedVal = selectSubFont.value;
            selectSubFont.innerHTML = "";
            
            for (const font of fontsList) {
                const opt = document.createElement("option");
                opt.value = font.name;
                opt.textContent = font.name + (font.type === "custom" ? " (Custom)" : "");
                selectSubFont.appendChild(opt);
                
                if (font.type === "custom" && font.file) {
                    try {
                        const fontFace = new FontFace(font.name, `url(/fonts/${font.file})`);
                        await fontFace.load();
                        document.fonts.add(fontFace);
                    } catch (e) {
                        console.error(`Failed to register fontface ${font.name}:`, e);
                    }
                }
            }
            
            if (Array.from(selectSubFont.options).some(o => o.value === selectedVal)) {
                selectSubFont.value = selectedVal;
            } else {
                selectSubFont.value = "Arial";
            }
            
            updateSubtitlePreview();
        } catch (err) {
            console.error("Failed to load fonts:", err);
        }
    }

    // Attach preview event listeners
    [selectSubFont, inputSubFontSize, inputSubColor, inputSubOutlineColor, inputSubOutlineWidth, inputSubShadowColor, inputSubShadowDepth, settingSubBold, settingSubItalic].forEach(el => {
        if (el) {
            el.addEventListener("input", updateSubtitlePreview);
            el.addEventListener("change", updateSubtitlePreview);
        }
    });

    // --- Confirm Script Validation ---
    btnConfirmScript.addEventListener("click", async () => {
        const script = textareaScript.value.trim();
        if (!script) {
            await customAlert(
                langSelector.value === "vi-VN" ? "Vui lòng nhập kịch bản trước khi xác nhận!" : "Please input a video script first!",
                langSelector.value === "vi-VN" ? "Thông báo" : "Alert"
            );
            return;
        }

        const voice = selectVoiceModel.value;
        const meta = getSelectedVoiceMeta(voice);
        const provider = meta ? meta.provider : (VIENEU_VOICES.includes(voice) ? "vieneu" : "google");
        const format = provider === "google" ? "SSML Voice XML (Google Cloud)" : `Plain text (${provider})`;
        
        // Count sentences
        let count = 0;
        if (script.startsWith("<voice")) {
            const blocks = script.match(/<voice[^>]*>/g) || [];
            count = blocks.length;
        } else {
            const sentences = script.split(/(?<=[.!?。！？])\s+/).filter(s => s.trim());
            count = sentences.length;
        }

        const msg = langSelector.value === "vi-VN" 
            ? `Kiểm tra Kịch bản thành công!\n\n- Định dạng: ${format}\n- Số phân đoạn (câu): ${count}\n- Mẫu giọng nói: ${voice}\n\nXác nhận kịch bản này đã chính xác để tiến hành tạo video?`
            : `Script validation check passed!\n\n- Format: ${format}\n- Number of segments (sentences): ${count}\n- Voice Model: ${voice}\n\nConfirm that this script is finalized and ready for compiling?`;

        const confirmed = await customConfirm(msg, langSelector.value === "vi-VN" ? "Xác nhận Kịch bản" : "Confirm Script");
        if (confirmed) {
            isScriptValidated = true;
            btnConfirmScript.innerHTML = `${icon('check-circle', { size: 14, className: 'btn-icon' })} ${t('script_confirmed')}`;
            btnConfirmScript.className = "btn btn-success btn-sm";
            printLog("System", "Script confirmed! Ready to compile video.");
        }
    });

    textareaScript.addEventListener("input", () => {
        isScriptValidated = false;
        btnConfirmScript.innerHTML = t('confirm_script');
        btnConfirmScript.className = "btn btn-success btn-sm";
    });

    // --- Load Asset Materials lists ---
    async function loadMaterials() {
        try {
            const data = await api.loadMaterials();
            materialCategories = data.video_categories || {};
            if (data.videos) {
                data.videos.forEach(vid => {
                    if (vid.filename && vid.category) {
                        materialCategories[vid.filename] = vid.category;
                    }
                });
            }
            const categoryNames = Array.from(new Set(Object.values(materialCategories).filter(Boolean))).sort();
            if (videoCategoryFilter) {
                const current = videoCategoryFilter.value;
                videoCategoryFilter.innerHTML = '<option value="">All categories</option>' + categoryNames.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");
                if (categoryNames.includes(current)) {
                    videoCategoryFilter.value = current;
                }
            }
            
            // Render Video Pool
            if (data.videos && data.videos.length > 0) {
                countVideos.textContent = data.videos.length;
                const visibleVideos = data.videos.filter(vid => !videoCategoryFilter || !videoCategoryFilter.value || materialCategories[vid.filename] === videoCategoryFilter.value);
                listVideos.innerHTML = visibleVideos.map((vid, idx) => {
                    const category = vid.category || "";
                    const fname = vid.filename;
                    return `
                    <div class="item-row" data-category="${escapeHtml(category)}">
                        <input type="checkbox" id="vid-${idx}" value="${escapeHtml(fname)}" name="video-clips">
                        <label for="vid-${idx}" title="${escapeHtml(fname)}">${escapeHtml(fname)}${category ? ` <span class="item-category">[${escapeHtml(category)}]</span>` : ""}</label>
                        <span class="btn-delete-item" data-filename="${escapeHtml(fname)}">×</span>
                    </div>
                `}).join("") || '<p class="placeholder-text">No videos in this category.</p>';
                
                // Attach delete listeners
                document.querySelectorAll(".btn-delete-item").forEach(btn => {
                    btn.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        const fname = btn.getAttribute("data-filename");
                        const confirmDelete = await customConfirm(
                            langSelector.value === "vi-VN" ? `Xác nhận xóa tệp video này: ${fname}?` : `Are you sure you want to delete ${fname}?`,
                            langSelector.value === "vi-VN" ? "Xóa tệp" : "Delete File"
                        );
                        if (confirmDelete) {
                            await deleteVideoFile(fname);
                        }
                    });
                });
                if (typeof updateSelectAllState === 'function') {
                    updateSelectAllState();
                }
            } else {
                countVideos.textContent = "0";
                listVideos.innerHTML = '<p class="placeholder-text">No videos available.</p>';
                if (typeof updateSelectAllState === 'function') {
                    updateSelectAllState();
                }
            }

            // Render Music Pool
            if (data.music && data.music.length > 0) {
                listMusic.innerHTML = `
                    <div class="item-row">
                        <input type="checkbox" id="mus-none" value="" name="bg-music" checked>
                        <label for="mus-none">None (No Background Music)</label>
                    </div>
                ` + data.music.map(mus => {
                    const fname = mus.filename;
                    return `
                    <div class="item-row">
                        <input type="checkbox" id="mus-${escapeHtml(fname)}" value="${escapeHtml(fname)}" name="bg-music">
                        <label for="mus-${escapeHtml(fname)}" title="${escapeHtml(fname)}">${escapeHtml(fname)}</label>
                    </div>
                `}).join("");

                // Add event listeners to handle None vs specific tracks behavior
                const noneInput = document.getElementById("mus-none");
                const musicInputs = document.querySelectorAll('input[name="bg-music"]:not(#mus-none)');

                noneInput.addEventListener("change", () => {
                    if (noneInput.checked) {
                        musicInputs.forEach(inp => inp.checked = false);
                    }
                });

                musicInputs.forEach(inp => {
                    inp.addEventListener("change", () => {
                        if (inp.checked) {
                            noneInput.checked = false;
                        }
                        // If all music checkboxes are unchecked, check "None"
                        const checkedCount = document.querySelectorAll('input[name="bg-music"]:checked:not(#mus-none)').length;
                        if (checkedCount === 0) {
                            noneInput.checked = true;
                        }
                    });
                });
            } else {
                listMusic.innerHTML = `
                    <div class="item-row">
                        <input type="checkbox" id="mus-none" value="" name="bg-music" checked disabled>
                        <label for="mus-none">None (No Background Music)</label>
                    </div>
                `;
            }

            // Populate Intro Template dropdown
            const settingIntro = document.getElementById("setting-intro");
            if (settingIntro) {
                const currentIntro = settingIntro.value;
                settingIntro.innerHTML = '<option value="">-- No Intro --</option>' + 
                    (data.intros || []).map(intro => `<option value="${escapeHtml(intro)}">${escapeHtml(intro)}</option>`).join("");
                if ((data.intros || []).includes(currentIntro)) {
                    settingIntro.value = currentIntro;
                }
            }

            // Populate Outro Template dropdown
            const settingOutro = document.getElementById("setting-outro");
            if (settingOutro) {
                const currentOutro = settingOutro.value;
                settingOutro.innerHTML = '<option value="">-- No Outro --</option>' + 
                    (data.outros || []).map(outro => `<option value="${escapeHtml(outro)}">${escapeHtml(outro)}</option>`).join("");
                if ((data.outros || []).includes(currentOutro)) {
                    settingOutro.value = currentOutro;
                }
            }

            // Populate Watermark dropdown
            const settingWatermark = document.getElementById("setting-watermark");
            if (settingWatermark) {
                const currentWatermark = settingWatermark.value;
                settingWatermark.innerHTML = '<option value="">-- No Watermark --</option>' + 
                    (data.watermarks || []).map(wm => `<option value="${escapeHtml(wm)}">${escapeHtml(wm)}</option>`).join("");
                if ((data.watermarks || []).includes(currentWatermark)) {
                    settingWatermark.value = currentWatermark;
                }
            }
        } catch (err) {
            printLog("Error", `Failed to load materials lists: ${err.message}`);
        }
    }

    // --- Delete Video File ---
    async function deleteVideoFile(filename) {
        try {
            printLog("System", `Requesting deletion of: ${filename}...`);
            await api.deleteVideoFile(filename);
            printLog("Success", `Deleted video material: ${filename}`);
            loadMaterials();
        } catch (err) {
            printLog("Error", `Failed to delete file: ${err.message}`);
        }
    }

    if (videoCategoryFilter) {
        videoCategoryFilter.addEventListener("change", loadMaterials);
    }

    if (btnApplyCategory) {
        btnApplyCategory.addEventListener("click", async () => {
            const category = videoCategoryInput ? videoCategoryInput.value.trim() : "";
            const checkedVideoInputs = document.querySelectorAll('input[name="video-clips"]:checked');
            const selectedVideos = Array.from(checkedVideoInputs).map(inp => inp.value);
            if (selectedVideos.length === 0) {
                await customAlert("Select at least one video first.", "Alert");
                return;
            }
            try {
                for (const filename of selectedVideos) {
                    await api.saveMaterialCategory(filename, category);
                    if (category) materialCategories[filename] = category;
                    else delete materialCategories[filename];
                }
                printLog("Success", `Updated category for ${selectedVideos.length} video(s).`);
                await loadMaterials();
            } catch (err) {
                await customAlert("Failed to update category: " + err.message, "Error");
            }
        });
    }

    if (btnSelectCategory) {
        btnSelectCategory.addEventListener("click", async () => {
            const category = videoCategoryFilter ? videoCategoryFilter.value : "";
            if (!category) {
                await customAlert("Choose a category first.", "Alert");
                return;
            }
            document.querySelectorAll('input[name="video-clips"]').forEach(cb => {
                cb.checked = materialCategories[cb.value] === category;
            });
            updateSelectAllState();
        });
    }

    // --- Server-Sent Events (SSE) Logger ---
    function startListeningToLogs(jobId, onSuccess, onFailure) {
        if (typeof jobId === "function") {
            onFailure = onSuccess;
            onSuccess = jobId;
            jobId = null;
        }

        if (logEventSource) {
            logEventSource.close();
        }
        
        const progressBar = document.getElementById("generation-progress-bar");
        const progressStatus = document.getElementById("lbl-generation-status");
        const progressPercent = document.getElementById("lbl-generation-percent");
        
        if (progressBar) {
            progressBar.style.width = "0%";
            progressBar.style.background = ""; // reset to default gradient
        }
        if (progressPercent) progressPercent.textContent = "0%";
        if (progressStatus) progressStatus.textContent = langSelector.value === "vi-VN" ? "Trạng thái: Đang kết nối..." : "Status: Connecting...";
        
        const sseUrl = jobId ? `/api/jobs/${jobId}/logs` : "/api/logs";
        logEventSource = new EventSource(sseUrl);
        
        logEventSource.onmessage = (event) => {
            const line = event.data;
            let type = "info";
            
            let percentValue = null;
            let statusValue = null;
            
            // Parse real-time progress from logs
            if (line.includes("Divided script into")) {
                const m = line.match(/Divided script into (\d+) sentence/);
                if (m) {
                    const total = parseInt(m[1], 10);
                    percentValue = 5;
                    statusValue = langSelector.value === "vi-VN" 
                        ? `Chia kịch bản thành ${total} phân đoạn.`
                        : `Divided script into ${total} segments.`;
                }
            } else if (line.includes("VieNeu-TTS:") && line.includes("Synthesizing:")) {
                // E.g. VieNeu-TTS: [5/58] Synthesizing: "..." -> ...
                const m = line.match(/\[(\d+)\/(\d+)\]/);
                if (m) {
                    const current = parseInt(m[1], 10);
                    const total = parseInt(m[2], 10);
                    // Map TTS synthesis (step 1/4) from 5% to 45%
                    percentValue = 5 + Math.round((current / total) * 40);
                    statusValue = langSelector.value === "vi-VN"
                        ? `Đang tạo giọng đọc: phân đoạn ${current}/${total}`
                        : `Synthesizing audio: segment ${current}/${total}`;
                }
            } else if (line.includes("Synthesizing Google segment") || line.includes("Synthesizing segment")) {
                const m = line.match(/segment (\d+)\/(\d+)/);
                if (m) {
                    const current = parseInt(m[1], 10);
                    const total = parseInt(m[2], 10);
                    percentValue = 5 + Math.round((current / total) * 40);
                    statusValue = langSelector.value === "vi-VN"
                        ? `Đang tạo giọng đọc: phân đoạn ${current}/${total}`
                        : `Synthesizing audio: segment ${current}/${total}`;
                }
            } else if (line.includes("Step 1/4:")) {
                percentValue = 50;
                statusValue = langSelector.value === "vi-VN"
                    ? "Bước 1/4: Cắt và chia nhỏ video..."
                    : "Step 1/4: Cutting and scaling video clips...";
            } else if (line.includes("Step 2/4:")) {
                percentValue = 70;
                statusValue = langSelector.value === "vi-VN"
                    ? "Bước 2/4: Ghép các phân đoạn video..."
                    : "Step 2/4: Merging video clips...";
            } else if (line.includes("Step 3/4:")) {
                percentValue = 85;
                statusValue = langSelector.value === "vi-VN"
                    ? "Bước 3/4: Xử lý và trộn âm thanh nền..."
                    : "Step 3/4: Processing and mixing audio tracks...";
            } else if (line.includes("Step 4/4:")) {
                percentValue = 95;
                statusValue = langSelector.value === "vi-VN"
                    ? "Bước 4/4: Chèn phụ đề và xuất video thành phẩm..."
                    : "Step 4/4: Burning subtitles and rendering final video...";
            }
            
            if (line.includes("[GEN_SUCCESS]") || line.includes("[DOWNLOAD_SUCCESS]")) {
                type = "success";
                percentValue = 100;
                statusValue = langSelector.value === "vi-VN" ? "Tạo video thành công!" : "Compilation completed successfully!";
                if (progressBar) progressBar.style.background = "#22c55e"; // Success green
                logEventSource.close();
                if (onSuccess) onSuccess(line);
            } else if (line.includes("[GEN_ERROR]") || line.includes("[DOWNLOAD_ERROR]")) {
                type = "error";
                percentValue = 100;
                statusValue = langSelector.value === "vi-VN" ? "Lỗi tiến trình tạo video!" : "Error occurred during compilation!";
                if (progressBar) progressBar.style.background = "#ef4444"; // Danger red
                logEventSource.close();
                if (onFailure) onFailure(line);
            } else if (line.includes("Warning:") || line.includes("WARNING:")) {
                type = "warning";
            } else if (line.startsWith("---") || line.includes("Ready to process")) {
                type = "system";
            }
            
            if (percentValue !== null) {
                if (progressBar) progressBar.style.width = `${percentValue}%`;
                if (progressPercent) progressPercent.textContent = `${percentValue}%`;
            }
            if (statusValue !== null) {
                if (progressStatus) progressStatus.textContent = `Status: ${statusValue}`;
            }
            
            printLog(type, line);
        };

        logEventSource.onerror = () => {
            printLog("Error", "SSE log stream connection lost.");
            if (progressBar) progressBar.style.background = "#ef4444"; // Danger red
            logEventSource.close();
        };
    }

    function printLog(type, text) {
        const div = document.createElement("div");
        div.className = `log-line ${type.toLowerCase()}`;
        div.textContent = text;
        logsTerminal.appendChild(div);
        logsTerminal.scrollTop = logsTerminal.scrollHeight;
    }

    // --- Trigger Download / Find ---
    btnDownload.addEventListener("click", async () => {
        const url = inputDownloadUrl.value.trim();
        const type = selectDownloadType.value;
        
        if (!url) {
            await customAlert("Please input a valid URL or Search keyword!", "Alert");
            return;
        }

        btnDownload.disabled = true;
        btnDownload.textContent = langSelector.value === "vi-VN" ? "Đang tải..." : "Downloading...";
        logsTerminal.innerHTML = "";
        
        try {
            printLog("System", `Triggering downloader for: '${url}' (${type})`);
            
            const res = await api.triggerDownload(url, type);
            const data = await res.json();
            startJobPolling(data.job_id);
        } catch (err) {
            btnDownload.disabled = false;
            btnDownload.textContent = langSelector.value === "vi-VN" ? "Tải về / Tìm" : "Fetch / Find";
            printLog("Error", `Download trigger failed: ${err.message}`);
        }
    });

    // --- Local File Upload handlers ---
    uploadVideoBox.addEventListener("click", () => uploadVideoInput.click());
    uploadMusicBox.addEventListener("click", () => uploadMusicInput.click());

    uploadVideoInput.addEventListener("change", (e) => handleFileUpload(e.target.files, "video"));
    uploadMusicInput.addEventListener("change", (e) => handleFileUpload(e.target.files[0], "music"));

    async function handleFileUpload(files, type) {
        if (!files) return;
        
        const fileList = type === "video" ? Array.from(files) : [files];
        if (fileList.length === 0) return;

        printLog("System", `Uploading ${fileList.length} ${type} file(s) locally...`);
        
        for (const file of fileList) {
            const formData = new FormData();
            formData.append("file", file);
            
            try {
                printLog("Info", `Uploading: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);
                
                const data = await api.uploadMaterial(formData, type);
                printLog("Success", `Uploaded file: ${data.filename}`);
            } catch (err) {
                printLog("Error", `Failed to upload ${file.name}: ${err.message}`);
            }
        }
        
        loadMaterials();
    }

    // --- Clear Terminal Logs ---
    btnClearLogs.addEventListener("click", () => {
        logsTerminal.innerHTML = '<div class="log-line system">Terminal logs cleared.</div>';
    });

    // --- Compile / Generate Video ---
    btnGenerate.addEventListener("click", async () => {
        const script = textareaScript.value.trim();
        const voice = selectVoiceModel.value;
        const aspect = selectAspect.value;
        const speed = parseFloat(inputSpeed.value) || 1.0;
        const videoOrderMode = selectVideoOrder ? selectVideoOrder.value : "ordered";
        const volume = parseFloat(sliderVolume.value);
        const muteVideo = settingMuteVideo.checked;
        
        // Subtitle configurations
        const subFont = selectSubFont.value;
        const subFontSize = parseInt(inputSubFontSize.value) || 48;
        const subColor = inputSubColor.value;
        const subOutlineColor = inputSubOutlineColor.value;
        const subOutlineWidth = parseInt(inputSubOutlineWidth.value) || 3;
        const subShadowColor = inputSubShadowColor.value;
        const subShadowDepth = parseInt(inputSubShadowDepth.value) || 0;
        const subMarginV = parseInt(inputSubMarginV.value) || 180;
        const subBold = settingSubBold.checked;
        const subItalic = settingSubItalic.checked;

        // Checked videos
        const checkedVideoInputs = document.querySelectorAll('input[name="video-clips"]:checked');
        const selectedVideos = Array.from(checkedVideoInputs).map(inp => inp.value);

        // Background music
        const checkedMusicInputs = document.querySelectorAll('input[name="bg-music"]:checked:not(#mus-none)');
        const selectedMusic = Array.from(checkedMusicInputs).map(inp => inp.value);

        if (!script) {
            await customAlert(
                langSelector.value === "vi-VN" ? "Vui lòng nhập kịch bản trước khi tạo!" : "Please input a video script before generating!",
                "Alert"
            );
            return;
        }

        if (selectedVideos.length === 0) {
            await customAlert(
                langSelector.value === "vi-VN" ? "Vui lòng chọn ít nhất một clip video làm tài nguyên!" : "Please select at least one video footage clip from the Video Pool!",
                "Alert"
            );
            return;
        }

        // Warning if script is not confirmed yet
        if (!isScriptValidated) {
            const proceed = await customConfirm(
                langSelector.value === "vi-VN" 
                    ? "Bạn chưa xác nhận kịch bản (Script Confirmed). Bạn có chắc chắn muốn tiến hành tạo video ngay không?"
                    : "The script has not been confirmed yet. Do you want to compile the video anyway?",
                langSelector.value === "vi-VN" ? "Cảnh báo" : "Warning"
            );
            if (!proceed) return;
        }

        // Lock Compile UI
        btnGenerate.disabled = true;
        btnGenerate.innerHTML = `<span class="btn-icon">⏳</span><span>${langSelector.value === "vi-VN" ? "Đang xử lý..." : "Compiling video..."}</span>`;
        logsTerminal.innerHTML = "";
        
        // Reset preview container
        videoPreviewContainer.innerHTML = `
            <div class="video-placeholder">
                <span class="placeholder-icon">${icon('clapperboard', { size: 48 })}</span>
                <p>${langSelector.value === "vi-VN" ? "Video hoàn chỉnh sẽ xuất hiện ở đây sau khi tạo thành công." : "Final compiled video will show up here."}</p>
            </div>
        `;

        try {
            const res = await api.triggerGeneration({
                script: script,
                default_voice: voice,
                video_materials: selectedVideos,
                bg_music: selectedMusic,
                bg_music_volume: volume,
                video_speed: speed,
                aspect_ratio: aspect,
                mute_video: muteVideo,
                video_order_mode: videoOrderMode,
                vieneu_batch_paragraphs: settingVieneuBatch ? Math.min(Math.max(parseInt(settingVieneuBatch.value, 10) || 1, 1), 20) : 1,
                asr_provider: settingAsrProvider ? settingAsrProvider.value : "remote_openai",
                subtitle_timing_source: settingSubtitleTimingSource ? settingSubtitleTimingSource.value : "asr",
                subtitle_fallback_to_estimated: true,
                review_subtitles: document.getElementById("setting-review-subtitles").checked,
                
                // Checked/Post-processing templates
                intro_template: document.getElementById("setting-intro") ? document.getElementById("setting-intro").value || null : null,
                outro_template: document.getElementById("setting-outro") ? document.getElementById("setting-outro").value || null : null,
                watermark_path: document.getElementById("setting-watermark") ? document.getElementById("setting-watermark").value || null : null,
                watermark_position: document.getElementById("setting-watermark-position") ? document.getElementById("setting-watermark-position").value : "bottom-right",
                watermark_opacity: document.getElementById("setting-watermark-opacity") ? parseFloat(document.getElementById("setting-watermark-opacity").value) : 0.7,

                // Style config
                subtitle_font: subFont,
                subtitle_font_size: subFontSize,
                subtitle_color: subColor,
                subtitle_outline_color: subOutlineColor,
                subtitle_outline_width: subOutlineWidth,
                subtitle_back_color: subShadowColor,
                subtitle_shadow_depth: subShadowDepth,
                subtitle_bold: subBold,
                subtitle_italic: subItalic,
                subtitle_margin_v: subMarginV
            });

            const data = await res.json();
            startJobPolling(data.job_id);
        } catch (err) {
            btnGenerate.disabled = false;
            btnGenerate.innerHTML = `${icon('zap', { size: 18, className: 'btn-icon' })} <span>${t('btn_compile')}</span>`;
            printLog("Error", `Failed to trigger compile: ${err.message}`);
        }
    });

    // --- Live System Performance Monitor Polling ---
    async function updateSystemStatus() {
        try {
            const data = await api.loadSystemStatus();
            
            // 1. CPU
            const cpuVal = document.getElementById("cpu-val");
            const cpuBar = document.getElementById("cpu-bar");
            if (cpuVal) cpuVal.textContent = `${data.cpu.percent}%`;
            if (cpuBar) cpuBar.style.width = `${data.cpu.percent}%`;
            
            // 2. RAM
            const ramVal = document.getElementById("ram-val");
            const ramBar = document.getElementById("ram-bar");
            if (ramVal) {
                const usedGb = (data.memory.used / (1024 * 1024 * 1024)).toFixed(1);
                const totalGb = (data.memory.total / (1024 * 1024 * 1024)).toFixed(1);
                ramVal.textContent = `${usedGb} / ${totalGb} GB (${data.memory.percent}%)`;
            }
            if (ramBar) ramBar.style.width = `${data.memory.percent}%`;
            
            // 3. Disk
            const diskVal = document.getElementById("disk-val");
            const diskBar = document.getElementById("disk-bar");
            if (diskVal) {
                const usedGb = (data.disk.used / (1024 * 1024 * 1024)).toFixed(1);
                const totalGb = (data.disk.total / (1024 * 1024 * 1024)).toFixed(1);
                diskVal.textContent = `${usedGb} / ${totalGb} GB (${data.disk.percent}%)`;
            }
            if (diskBar) diskBar.style.width = `${data.disk.percent}%`;
            
            // 4. Top Processes
            const processList = document.getElementById("process-list");
            if (processList && data.processes) {
                if (data.processes.length === 0) {
                    processList.innerHTML = '<div class="htop-line placeholder-text">No processes active.</div>';
                } else {
                    processList.innerHTML = data.processes.map(p => {
                        const pid = String(p.pid).padStart(6, " ");
                        const name = p.name.substring(0, 10).padEnd(12, " ");
                        const cpu = String(p.cpu.toFixed(1)).padStart(6, " ");
                        const mem = String(p.mem.toFixed(1)).padStart(6, " ");
                        return `<div class="htop-line">${pid}  ${name} ${cpu}%  ${mem}%</div>`;
                    }).join("");
                }
            }
        } catch (err) {
            console.error("Failed to fetch system status:", err);
        }
    }
    
    // --- Voice Preview ---
    if (btnPreviewVoice) {
        btnPreviewVoice.addEventListener("click", async () => {
            const voiceName = selectVoiceModel.value;
            const voiceLang = selectVoiceLang.value;
            if (!voiceName) return;
            
            btnPreviewVoice.disabled = true;
            const originalText = btnPreviewVoice.textContent;
            btnPreviewVoice.textContent = "⏳...";
            
            try {
                const data = await api.previewVoice(voiceName, voiceLang);
                const audioUrl = data.url;
                const audio = new Audio(audioUrl);
                audio.play();
            } catch (err) {
                printLog("Error", `Failed to fetch preview: ${err.message}`);
            } finally {
                btnPreviewVoice.disabled = false;
                btnPreviewVoice.textContent = originalText;
            }
        });
    }

    // --- Generated Videos Gallery ---
    async function loadGallery() {
        const container = document.getElementById("gallery-container");
        if (!container) return;
        
        try {
            const videos = await api.loadGallery();
            if (videos.length === 0) {
                container.innerHTML = `<p class="placeholder-text">${
                    langSelector.value === "vi-VN" ? "Chưa có video nào được tạo." : "No generated videos yet."
                }</p>`;
                return;
            }
            
            let html = '<div class="gallery-list">';
            for (const vid of videos) {
                const dateStr = new Date(vid.created_at * 1000).toLocaleString();
                const sizeMB = (vid.size / (1024 * 1024)).toFixed(2);
                
                const displayName = vid.filename;
                
                html += `
                    <div class="gallery-item" data-filename="${vid.filename}">
                        <div class="gallery-item-header">
                            <div class="gallery-item-title">${displayName}</div>
                            <span style="font-size: 0.7rem; color: var(--text-dim); flex-shrink: 0;">${sizeMB} MB</span>
                        </div>
                        <div class="gallery-item-meta">${dateStr}</div>
                        <div class="gallery-item-actions">
                            <button type="button" class="btn btn-secondary btn-xs btn-gallery-play">${icon('play', { size: 12, className: 'btn-icon' })} Play</button>
                            <button type="button" class="btn btn-secondary btn-xs btn-gallery-rename">${icon('pencil', { size: 12, className: 'btn-icon' })} Rename</button>
                            ${vid.settings ? `<button type="button" class="btn btn-primary btn-xs btn-gallery-reuse">${icon('settings-2', { size: 12, className: 'btn-icon' })} Reuse Settings</button>` : ''}
                            <button type="button" class="btn btn-secondary btn-xs btn-gallery-delete" style="color: var(--color-error); border-color: rgba(239, 68, 68, 0.2);">${icon('trash-2', { size: 12, className: 'btn-icon' })} Delete</button>
                        </div>
                    </div>
                `;
            }
            html += '</div>';
            container.innerHTML = html;
            
            // Bind events
            container.querySelectorAll(".gallery-item").forEach(item => {
                const filename = item.getAttribute("data-filename");
                const videoUrl = `/generated/${filename}`;
                const vidData = videos.find(v => v.filename === filename);
                
                // Play button
                item.querySelector(".btn-gallery-play").addEventListener("click", () => {
                    const videoContainer = document.getElementById("video-preview-container");
                    if (videoContainer) {
                        const isPortrait = vidData && vidData.settings && vidData.settings.aspect_ratio === "9:16";
                        if (isPortrait) {
                            videoContainer.classList.remove("landscape");
                        } else {
                            videoContainer.classList.add("landscape");
                        }
                        
                        videoContainer.innerHTML = `
                            <video class="video-player" controls autoplay>
                                <source src="${videoUrl}" type="video/mp4">
                                Your browser does not support the video tag.
                            </video>
                        `;
                        
                        // Also update download button link
                        const downloadBtn = document.getElementById("btn-download-video");
                        if (downloadBtn) {
                            downloadBtn.href = videoUrl;
                            downloadBtn.classList.remove("disabled");
                        }
                    }
                });
                
                // Rename button
                item.querySelector(".btn-gallery-rename").addEventListener("click", async () => {
                    const newName = await customPrompt(t('prompt_rename_video'), t('rename'), filename);
                    if (!newName || newName === filename) return;
                    
                    try {
                        await api.renameVideo(filename, newName);
                        printLog("System", `Renamed ${filename} to ${newName}`);
                        loadGallery();
                    } catch (err) {
                        await customAlert("Error: " + err.message, "Error");
                    }
                });
                
                // Reuse settings button
                if (vidData && vidData.settings) {
                    item.querySelector(".btn-gallery-reuse").addEventListener("click", async () => {
                        const confirmReuse = await customConfirm(
                            langSelector.value === "vi-VN" 
                                ? "Bạn có chắc chắn muốn tải lại tất cả cài đặt của video này đè lên cấu hình hiện tại?" 
                                : "Are you sure you want to load all settings of this video and overwrite current configurations?",
                            langSelector.value === "vi-VN" ? "Tải lại cấu hình" : "Reuse settings"
                        );
                        if (!confirmReuse) return;
                        
                        // Load settings into DOM elements
                        const s = vidData.settings;
                        if (s.script) {
                            document.getElementById("script-text").value = s.script;
                            isScriptValidated = false;
                        }
                        if (s.default_voice) {
                            let found = false;
                            for (const lang of Object.keys(voicesGroupedData)) {
                                const list = voicesGroupedData[lang];
                                if (list.some(v => v.name === s.default_voice)) {
                                    selectVoiceLang.value = lang;
                                    updateVoiceModels();
                                    selectVoiceModel.value = s.default_voice;
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                selectVoiceModel.value = s.default_voice;
                            }
                        }
                        if (s.aspect_ratio) {
                            document.getElementById("setting-aspect").value = s.aspect_ratio;
                        }
                        if (s.video_speed !== undefined) {
                            document.getElementById("setting-speed").value = s.video_speed;
                        }
                        if (s.bg_music_volume !== undefined) {
                            document.getElementById("setting-volume").value = s.bg_music_volume;
                            document.getElementById("volume-val").textContent = `${Math.round(s.bg_music_volume * 100)}%`;
                        }
                        if (s.mute_video !== undefined) {
                            document.getElementById("setting-mute-video").checked = s.mute_video;
                        }
                        
                        // Subtitle styles
                        if (s.subtitle_font) document.getElementById("setting-sub-font").value = s.subtitle_font;
                        if (s.subtitle_font_size) document.getElementById("setting-sub-size").value = s.subtitle_font_size;
                        if (s.subtitle_color) {
                            document.getElementById("setting-sub-color").value = s.subtitle_color;
                            document.getElementById("sub-color-val").textContent = s.subtitle_color;
                        }
                        if (s.subtitle_outline_color) {
                            document.getElementById("setting-sub-outline-color").value = s.subtitle_outline_color;
                            document.getElementById("sub-outline-color-val").textContent = s.subtitle_outline_color;
                        }
                        if (s.subtitle_outline_width !== undefined) document.getElementById("setting-sub-outline-width").value = s.subtitle_outline_width;
                        if (s.subtitle_back_color) {
                            document.getElementById("setting-sub-shadow-color").value = s.subtitle_back_color;
                            document.getElementById("sub-shadow-color-val").textContent = s.subtitle_back_color;
                        }
                        if (s.subtitle_shadow_depth !== undefined) document.getElementById("setting-sub-shadow-depth").value = s.subtitle_shadow_depth;
                        if (s.subtitle_margin_v !== undefined) document.getElementById("setting-sub-margin-v").value = s.subtitle_margin_v;
                        if (s.subtitle_bold !== undefined) document.getElementById("setting-sub-bold").checked = s.subtitle_bold;
                        if (s.subtitle_italic !== undefined) document.getElementById("setting-sub-italic").checked = s.subtitle_italic;
                        
                        if (s.video_materials) {
                            document.querySelectorAll("#list-videos input[type='checkbox']").forEach(cb => {
                                cb.checked = s.video_materials.includes(cb.value);
                            });
                            const selectedCount = document.querySelectorAll("#list-videos input[type='checkbox']:checked").length;
                            document.getElementById("count-videos").textContent = selectedCount;
                            if (typeof updateSelectAllState === 'function') {
                                updateSelectAllState();
                            }
                        }
                        if (s.bg_music) {
                            const bgMusicArray = Array.isArray(s.bg_music) ? s.bg_music : [s.bg_music];
                            document.querySelectorAll("#list-music input[type='radio']").forEach(rad => {
                                rad.checked = bgMusicArray.includes(rad.value);
                            });
                        }
                        
                        updateSubtitlePreview();
                        printLog("System", "Settings loaded from old video successfully!");
                        document.getElementById("card-script-el").scrollIntoView({ behavior: "smooth" });
                    });
                }
                
                // Delete button
                item.querySelector(".btn-gallery-delete").addEventListener("click", async () => {
                    const confirmDel = await customConfirm(
                        langSelector.value === "vi-VN" 
                            ? `Bạn có chắc chắn muốn xóa video '${filename}'? Hành động này không thể hoàn tác.` 
                            : `Are you sure you want to delete video '${filename}'? This action cannot be undone.`,
                        langSelector.value === "vi-VN" ? "Xác nhận xóa" : "Confirm Delete"
                    );
                    if (!confirmDel) return;
                    
                    try {
                        await api.deleteVideo(filename);
                        printLog("System", `Deleted video file: ${filename}`);
                        loadGallery();
                    } catch (err) {
                        await customAlert("Error: " + err.message, "Error");
                    }
                });
            });
            
        } catch (err) {
            console.error(err);
        }
    }

    // --- Select All Videos Toggle Logic ---
    const toggleSelectAllVideos = document.getElementById("toggle-select-all-videos");
    
    function updateSelectAllState() {
        const selectAllCheckbox = document.getElementById("toggle-select-all-videos");
        if (!selectAllCheckbox) return;
        
        const checkboxes = document.querySelectorAll('input[name="video-clips"]');
        if (checkboxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
            return;
        }
        
        let checkedCount = 0;
        checkboxes.forEach(cb => {
            if (cb.checked) checkedCount++;
        });
        
        if (checkedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCount === checkboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
    
    if (toggleSelectAllVideos) {
        toggleSelectAllVideos.addEventListener("change", (e) => {
            const isChecked = e.target.checked;
            const checkboxes = document.querySelectorAll('input[name="video-clips"]');
            checkboxes.forEach(cb => {
                cb.checked = isChecked;
            });
        });
    }
    
    // Listen for change events on individual checkboxes via delegation
    if (listVideos) {
        listVideos.addEventListener("change", (e) => {
            if (e.target && e.target.name === "video-clips") {
                updateSelectAllState();
            }
        });
    }

    // --- Job Polling & Real-time logs ---
    let activeJobId = null;
    let jobPollInterval = null;

    function startJobPolling(jobId) {
        activeJobId = jobId;
        
        // Connect to SSE log stream
        startListeningToLogs(jobId, null, null);
        
        // Show Cancel button, hide Retry
        const btnCancel = document.getElementById("btn-cancel-generation");
        const btnRetry = document.getElementById("btn-retry-generation");
        if (btnCancel) btnCancel.classList.remove("hidden");
        if (btnRetry) btnRetry.classList.add("hidden");
        
        // Lock UI if it is a generation job
        btnGenerate.disabled = true;
        btnGenerate.innerHTML = `<span class="btn-icon">⏳</span><span>${langSelector.value === "vi-VN" ? "Đang xử lý..." : "Compiling video..."}</span>`;
        
        if (jobPollInterval) clearInterval(jobPollInterval);
        
        jobPollInterval = setInterval(async () => {
            try {
                const job = await api.getJob(jobId);
                
                const progressBar = document.getElementById("generation-progress-bar");
                const progressStatus = document.getElementById("lbl-generation-status");
                const progressPercent = document.getElementById("lbl-generation-percent");
                
                if (progressBar) progressBar.style.width = `${job.progress}%`;
                if (progressPercent) progressPercent.textContent = `${job.progress}%`;
                if (progressStatus) {
                    let st = job.status;
                    if (st === "awaiting_review") st = langSelector.value === "vi-VN" ? "đang chờ duyệt phụ đề" : "awaiting subtitle review";
                    progressStatus.textContent = `Status: ${st}`;
                }
                
                if (job.status === "completed") {
                    clearInterval(jobPollInterval);
                    activeJobId = null;
                    if (btnCancel) btnCancel.classList.add("hidden");
                    
                    btnGenerate.disabled = false;
                    btnGenerate.innerHTML = `${icon('zap', { size: 18, className: 'btn-icon' })} <span>${t('btn_compile')}</span>`;
                    
                    btnDownload.disabled = false;
                    btnDownload.textContent = langSelector.value === "vi-VN" ? "Tải về / Tìm" : "Fetch / Find";
                    inputDownloadUrl.value = "";
                    
                    // Show success
                    if (progressBar) progressBar.style.background = "#22c55e"; // Success green
                    customAlert(langSelector.value === "vi-VN" ? "Tiến trình hoàn tất thành công!" : "Job completed successfully!", "Success");
                    
                    // Load preview video
                    if (job.result && job.result.video_filename) {
                        loadVideoPreview(job.result.video_filename);
                    }
                    
                    loadMaterials();
                    loadGallery();
                    refreshJobsHistory();
                    updateCacheStats();
                } else if (job.status === "failed") {
                    clearInterval(jobPollInterval);
                    activeJobId = null;
                    if (btnCancel) btnCancel.classList.add("hidden");
                    if (btnRetry) btnRetry.classList.remove("hidden");
                    
                    btnGenerate.disabled = false;
                    btnGenerate.innerHTML = `${icon('zap', { size: 18, className: 'btn-icon' })} <span>${t('btn_compile')}</span>`;
                    
                    btnDownload.disabled = false;
                    btnDownload.textContent = langSelector.value === "vi-VN" ? "Tải về / Tìm" : "Fetch / Find";
                    
                    if (progressBar) progressBar.style.background = "#ef4444"; // Danger red
                    customAlert(`Job failed: ${job.error || "Unknown error"}`, "Error");
                    refreshJobsHistory();
                    updateCacheStats();
                } else if (job.status === "cancelled") {
                    clearInterval(jobPollInterval);
                    activeJobId = null;
                    if (btnCancel) btnCancel.classList.add("hidden");
                    if (btnRetry) btnRetry.classList.remove("hidden");
                    
                    btnGenerate.disabled = false;
                    btnGenerate.innerHTML = `${icon('zap', { size: 18, className: 'btn-icon' })} <span>${t('btn_compile')}</span>`;
                    
                    btnDownload.disabled = false;
                    btnDownload.textContent = langSelector.value === "vi-VN" ? "Tải về / Tìm" : "Fetch / Find";
                    
                    if (progressBar) progressBar.style.background = "#ef4444"; // Danger red
                    customAlert("Job was cancelled.", "Cancelled");
                    refreshJobsHistory();
                    updateCacheStats();
                } else if (job.status === "awaiting_review") {
                    clearInterval(jobPollInterval);
                    if (btnCancel) btnCancel.classList.add("hidden");
                    showSubtitleReviewModal(jobId, job.result.subtitle_cues);
                    refreshJobsHistory();
                }
            } catch (err) {
                console.error("Error polling job:", err);
            }
        }, 2000);
    }

    async function checkActiveJobs() {
        try {
            const jobs = await api.listJobs(null, null, 10);
            const activeJob = jobs.find(j => j.status === "running" || j.status === "pending" || j.status === "awaiting_review");
            if (activeJob) {
                if (activeJob.status === "awaiting_review") {
                    const fullJob = await api.getJob(activeJob.id);
                    showSubtitleReviewModal(activeJob.id, fullJob.result.subtitle_cues);
                } else {
                    startJobPolling(activeJob.id);
                }
            }
        } catch (err) {
            console.error("Failed to check active jobs:", err);
        }
    }

    async function refreshJobsHistory() {
        const list = document.getElementById("list-jobs-history");
        const countText = document.getElementById("jobs-count-text");
        if (!list) return;
        
        try {
            const jobs = await api.listJobs(null, null, 20);
            if (jobs.length === 0) {
                list.innerHTML = `<p class="placeholder-text">${langSelector.value === "vi-VN" ? "Không có lịch sử công việc." : "No job history."}</p>`;
                if (countText) countText.textContent = "No active jobs";
                return;
            }
            
            const activeCount = jobs.filter(j => j.status === "running" || j.status === "pending").length;
            if (countText) countText.textContent = activeCount > 0 ? `${activeCount} active job(s)` : "No active jobs";
            
            list.innerHTML = "";
            jobs.forEach(job => {
                const dateStr = new Date(job.created_at * 1000).toLocaleTimeString();
                const row = document.createElement("div");
                row.className = "job-history-item";
                row.style.display = "flex";
                row.style.justifyContent = "space-between";
                row.style.alignItems = "center";
                row.style.padding = "0.5rem";
                row.style.borderBottom = "1px solid var(--border-color)";
                row.style.fontSize = "0.8rem";
                
                row.innerHTML = `
                    <div>
                        <strong>${job.type}</strong> (${dateStr})
                        <div style="font-size: 0.75rem; color: var(--text-muted);">ID: ${job.id.substring(0,8)}...</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="badge status-${job.status}" style="padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${job.status}</span>
                        ${(job.status === 'running' || job.status === 'pending') ? 
                            `<button type="button" class="btn btn-danger btn-xs btn-job-cancel" data-id="${job.id}">Cancel</button>` : ''}
                        ${(job.status === 'failed' || job.status === 'cancelled') ? 
                            `<button type="button" class="btn btn-primary btn-xs btn-job-retry" data-id="${job.id}">Retry</button>` : ''}
                        <button type="button" class="btn btn-secondary btn-xs btn-job-logs" data-id="${job.id}">Logs</button>
                        <button type="button" class="btn btn-secondary btn-xs btn-job-delete" data-id="${job.id}">${icon('x', { size: 12 })}</button>
                    </div>
                `;
                list.appendChild(row);
            });
        } catch (err) {
            console.error("Failed to list jobs:", err);
        }
    }

    const listJobsHistory = document.getElementById("list-jobs-history");
    if (listJobsHistory) {
        listJobsHistory.addEventListener("click", async (e) => {
            const target = e.target;
            const jobId = target.getAttribute("data-id");
            if (!jobId) return;
            
            if (target.classList.contains("btn-job-cancel")) {
                if (await customConfirm("Cancel this job?", "Confirm Cancel")) {
                    await api.cancelJob(jobId);
                    refreshJobsHistory();
                }
            } else if (target.classList.contains("btn-job-retry")) {
                await api.retryJob(jobId);
                startJobPolling(jobId);
                refreshJobsHistory();
            } else if (target.classList.contains("btn-job-delete")) {
                if (await customConfirm("Delete this job record?", "Confirm Delete")) {
                    await api.deleteJob(jobId);
                    refreshJobsHistory();
                }
            } else if (target.classList.contains("btn-job-logs")) {
                connectToJobLogs(jobId);
            }
        });
    }

    function connectToJobLogs(jobId) {
        startListeningToLogs(jobId, null, null);
    }

    const btnWipeJobs = document.getElementById("btn-wipe-jobs");
    if (btnWipeJobs) {
        btnWipeJobs.addEventListener("click", async () => {
            if (await customConfirm("Wipe all job history? Active jobs will be cancelled.", "Wipe Jobs")) {
                try {
                    await api.wipeAllJobs();
                    refreshJobsHistory();
                } catch (err) {
                    customAlert("Failed to wipe jobs: " + err.message, "Error");
                }
            }
        });
    }

    // --- Subtitle Review Modal Logic ---
    let currentReviewJobId = null;
    let currentReviewCues = [];

    function showSubtitleReviewModal(jobId, cues) {
        currentReviewJobId = jobId;
        currentReviewCues = cues || [];
        
        const modal = document.getElementById("subtitle-review-modal");
        const container = document.getElementById("subtitle-editor-container");
        if (!modal || !container) return;
        
        container.innerHTML = "";
        
        if (currentReviewCues.length === 0) {
            container.innerHTML = "<p class='placeholder-text'>No subtitles generated.</p>";
        } else {
            const table = document.createElement("table");
            table.style.width = "100%";
            table.style.borderCollapse = "collapse";
            table.innerHTML = `
                <thead>
                    <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                        <th style="padding: 0.5rem; font-size: 0.8rem; width: 80px;">Start (s)</th>
                        <th style="padding: 0.5rem; font-size: 0.8rem; width: 80px;">End (s)</th>
                        <th style="padding: 0.5rem; font-size: 0.8rem;">Subtitle Text</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            const tbody = table.querySelector("tbody");
            
            currentReviewCues.forEach((cue, index) => {
                const tr = document.createElement("tr");
                tr.style.borderBottom = "1px solid var(--border-color)";
                tr.innerHTML = `
                    <td style="padding: 0.4rem;"><input type="number" step="0.1" value="${cue.start}" class="cue-start-input" data-index="${index}" style="width: 70px; padding: 0.25rem; font-size: 0.8rem;"></td>
                    <td style="padding: 0.4rem;"><input type="number" step="0.1" value="${cue.end}" class="cue-end-input" data-index="${index}" style="width: 70px; padding: 0.25rem; font-size: 0.8rem;"></td>
                    <td style="padding: 0.4rem;"><input type="text" value="${escapeHtml(cue.text)}" class="cue-text-input" data-index="${index}" style="width: 100%; padding: 0.25rem; font-size: 0.8rem;"></td>
                `;
                tbody.appendChild(tr);
            });
            container.appendChild(table);
        }
        
        modal.classList.remove("hidden");
    }

    function closeSubtitleReviewModal() {
        const modal = document.getElementById("subtitle-review-modal");
        if (modal) modal.classList.add("hidden");
        currentReviewJobId = null;
        currentReviewCues = [];
    }

    const btnSubReviewSkip = document.getElementById("btn-sub-review-skip");
    const btnSubReviewCancel = document.getElementById("btn-sub-review-cancel");
    const btnSubReviewSubmit = document.getElementById("btn-sub-review-submit");

    if (btnSubReviewSkip) {
        btnSubReviewSkip.addEventListener("click", async () => {
            if (currentReviewJobId) {
                try {
                    await api.submitJobSubtitles(currentReviewJobId, currentReviewCues);
                    const jid = currentReviewJobId;
                    closeSubtitleReviewModal();
                    startJobPolling(jid);
                } catch (err) {
                    customAlert("Failed to submit: " + err.message, "Error");
                }
            }
        });
    }

    if (btnSubReviewCancel) {
        btnSubReviewCancel.addEventListener("click", async () => {
            if (currentReviewJobId) {
                if (await customConfirm("Cancel this job?", "Confirm Cancel")) {
                    try {
                        await api.cancelJob(currentReviewJobId);
                        closeSubtitleReviewModal();
                        refreshJobsHistory();
                    } catch (err) {
                        customAlert("Failed to cancel: " + err.message, "Error");
                    }
                }
            }
        });
    }

    if (btnSubReviewSubmit) {
        btnSubReviewSubmit.addEventListener("click", async () => {
            if (!currentReviewJobId) return;
            const container = document.getElementById("subtitle-editor-container");
            const starts = container.querySelectorAll(".cue-start-input");
            const ends = container.querySelectorAll(".cue-end-input");
            const texts = container.querySelectorAll(".cue-text-input");
            
            const updatedCues = [];
            for (let i = 0; i < starts.length; i++) {
                updatedCues.push({
                    start: parseFloat(starts[i].value) || 0,
                    end: parseFloat(ends[i].value) || 0,
                    text: texts[i].value.trim()
                });
            }
            
            try {
                await api.submitJobSubtitles(currentReviewJobId, updatedCues);
                const jid = currentReviewJobId;
                closeSubtitleReviewModal();
                startJobPolling(jid);
            } catch (err) {
                customAlert("Failed to submit edits: " + err.message, "Error");
            }
        });
    }

    // --- Cache management & max threads ---
    const btnClearCache = document.getElementById("btn-clear-cache");
    const settingMaxJobThreads = document.getElementById("setting-max-job-threads");
    const maxJobThreadsVal = document.getElementById("max-job-threads-val");

    if (btnClearCache) {
        btnClearCache.addEventListener("click", async () => {
            if (await customConfirm("Clear all cached TTS audio?", "Clear Cache")) {
                try {
                    await api.clearCache();
                    updateCacheStats();
                } catch (err) {
                    customAlert("Failed to clear cache: " + err.message, "Error");
                }
            }
        });
    }

    if (settingMaxJobThreads) {
        settingMaxJobThreads.addEventListener("input", () => {
            if (maxJobThreadsVal) maxJobThreadsVal.textContent = settingMaxJobThreads.value;
        });
    }

    async function updateCacheStats() {
        const cacheText = document.getElementById("cache-usage-text");
        if (!cacheText) return;
        try {
            const stats = await api.getCacheStats();
            cacheText.textContent = `Size: ${stats.human_readable} (${stats.num_files} files)`;
        } catch (err) {
            cacheText.textContent = "Error loading stats";
        }
    }

    // --- Project Presets Manager ---
    const presetSelector = document.getElementById("preset-selector");
    const btnSavePreset = document.getElementById("btn-save-preset");
    const presetsList = document.getElementById("presets-list");

    async function refreshPresetsList() {
        if (!presetSelector || !presetsList) return;
        try {
            const presets = await api.listPresets();
            presetSelector.innerHTML = '<option value="">-- Select Preset --</option>';
            presetsList.innerHTML = "";
            
            Object.keys(presets).forEach(name => {
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                presetSelector.appendChild(opt);
                
                const pill = document.createElement("span");
                pill.className = "preset-pill";
                pill.style.display = "inline-flex";
                pill.style.alignItems = "center";
                pill.style.gap = "0.35rem";
                pill.style.padding = "0.25rem 0.6rem";
                pill.style.background = "#1e2235";
                pill.style.border = "1px solid var(--border-color)";
                pill.style.borderRadius = "100px";
                pill.style.fontSize = "0.75rem";
                pill.style.cursor = "pointer";
                
                pill.innerHTML = `
                    <span class="preset-name">${escapeHtml(name)}</span>
                    <span class="preset-edit" title="Edit JSON Settings" style="color: #6366f1; font-weight: bold; padding: 0 2px; display: inline-flex; align-items: center;">${icon('pencil-line', { size: 12 })}</span>
                    <span class="preset-delete" title="Delete Preset" style="color: #ef4444; font-weight: bold; padding: 0 2px; display: inline-flex; align-items: center;">${icon('x', { size: 12 })}</span>
                `;
                presetsList.appendChild(pill);
            });
        } catch (err) {
            console.error("Failed to list presets:", err);
        }
    }

    if (presetSelector) {
        presetSelector.addEventListener("change", async () => {
            const name = presetSelector.value;
            if (!name) return;
            try {
                const settings = await api.getPreset(name);
                applyPreset(settings);
            } catch (err) {
                console.error("Failed to load preset:", err);
            }
        });
    }

    if (btnSavePreset) {
        btnSavePreset.addEventListener("click", async () => {
            const name = await customPrompt(t('prompt_preset_name'), t('save_preset'));
            if (!name) return;
            const settings = captureCurrentSettings();
            try {
                await api.savePreset(name, settings);
                refreshPresetsList();
                customAlert(t('preset_saved', { name }), t('success'));
            } catch (err) {
                customAlert(t('preset_save_failed', { error: err.message }), t('error'));
            }
        });
    }

    const btnSaveProdSettings = document.getElementById("btn-save-production-settings");
    if (btnSaveProdSettings) {
        btnSaveProdSettings.addEventListener("click", async () => {
            const settings = captureCurrentSettings();
            let name = presetSelector ? presetSelector.value : "";
            
            if (!name) {
                name = await customPrompt(
                    t('prompt_preset_name'),
                    t('save_preset')
                );
                if (!name) return; // user cancelled
            }
            
            try {
                const originalHTML = btnSaveProdSettings.innerHTML;
                btnSaveProdSettings.innerHTML = `${icon('loader', { size: 16, className: 'btn-icon anim-spin' })} ${t('saving')}...`;
                btnSaveProdSettings.disabled = true;

                await api.savePreset(name, settings);
                await refreshPresetsList();
                
                if (presetSelector) presetSelector.value = name;
                
                btnSaveProdSettings.innerHTML = `${icon('check-circle', { size: 16, className: 'btn-icon' })} ${t('save_settings_success')}`;
                btnSaveProdSettings.className = "btn btn-success";
                
                setTimeout(() => {
                    btnSaveProdSettings.innerHTML = originalHTML;
                    btnSaveProdSettings.className = "btn btn-primary";
                    btnSaveProdSettings.disabled = false;
                }, 2500);
                
            } catch (err) {
                btnSaveProdSettings.disabled = false;
                await customAlert(t('save_settings_failed', { error: err.message }), t('error'));
            }
        });
    }

    if (presetsList) {
        presetsList.addEventListener("click", async (e) => {
            const target = e.target;
            const pill = target.closest(".preset-pill");
            if (!pill) return;
            const name = pill.querySelector(".preset-name").textContent;
            
            if (target.classList.contains("preset-delete")) {
                if (await customConfirm(t('confirm_delete_preset', { name }), t('confirm'))) {
                    try {
                        await api.deletePreset(name);
                        refreshPresetsList();
                    } catch (err) {
                        customAlert(t('delete_failed', { error: err.message }), t('error'));
                    }
                }
            } else if (target.classList.contains("preset-edit")) {
                try {
                    const presets = await api.listPresets();
                    const currentSettings = presets[name];
                    const newJson = await customPrompt(
                        t('prompt_edit_preset_json'), 
                        t('edit_preset'), 
                        JSON.stringify(currentSettings, null, 2),
                        true
                    );
                    if (newJson) {
                        const parsed = JSON.parse(newJson);
                        await api.savePreset(name, parsed);
                        refreshPresetsList();
                    }
                } catch (err) {
                    customAlert(t('invalid_json_format', { error: err.message }), t('error'));
                }
            } else {
                try {
                    const settings = await api.getPreset(name);
                    applyPreset(settings);
                } catch (err) {
                    console.error("Failed to apply preset:", err);
                }
            }
        });
    }

    function applyPreset(settings) {
        if (settings.aspect_ratio) selectAspect.value = settings.aspect_ratio;
        if (settings.video_speed) inputSpeed.value = settings.video_speed;
        if (settings.mute_video !== undefined) settingMuteVideo.checked = settings.mute_video;
        if (settings.video_order_mode) selectVideoOrder.value = settings.video_order_mode;
        if (settings.vieneu_batch_paragraphs) settingVieneuBatch.value = settings.vieneu_batch_paragraphs;
        
        if (settings.bg_music_volume !== undefined) {
            sliderVolume.value = settings.bg_music_volume;
            volumeVal.textContent = `${Math.round(settings.bg_music_volume * 100)}%`;
        }
        
        if (settings.subtitle_font) selectSubFont.value = settings.subtitle_font;
        if (settings.subtitle_font_size) inputSubFontSize.value = settings.subtitle_font_size;
        if (settings.subtitle_color) {
            inputSubColor.value = settings.subtitle_color;
            subColorVal.textContent = settings.subtitle_color;
        }
        if (settings.subtitle_outline_color) {
            inputSubOutlineColor.value = settings.subtitle_outline_color;
            subOutlineColorVal.textContent = settings.subtitle_outline_color;
        }
        if (settings.subtitle_outline_width !== undefined) inputSubOutlineWidth.value = settings.subtitle_outline_width;
        if (settings.subtitle_shadow_color) {
            inputSubShadowColor.value = settings.subtitle_shadow_color;
            subShadowColorVal.textContent = settings.subtitle_shadow_color;
        }
        if (settings.subtitle_shadow_depth !== undefined) inputSubShadowDepth.value = settings.subtitle_shadow_depth;
        if (settings.subtitle_margin_v !== undefined) inputSubMarginV.value = settings.subtitle_margin_v;
        if (settings.subtitle_bold !== undefined) settingSubBold.checked = settings.subtitle_bold;
        if (settings.subtitle_italic !== undefined) settingSubItalic.checked = settings.subtitle_italic;
        
        if (settings.intro_template !== undefined) {
            const settingIntro = document.getElementById("setting-intro");
            if (settingIntro) settingIntro.value = settings.intro_template || "";
        }
        if (settings.outro_template !== undefined) {
            const settingOutro = document.getElementById("setting-outro");
            if (settingOutro) settingOutro.value = settings.outro_template || "";
        }
        if (settings.watermark_path !== undefined) {
            const settingWatermark = document.getElementById("setting-watermark");
            if (settingWatermark) settingWatermark.value = settings.watermark_path || "";
        }
        if (settings.watermark_position !== undefined) {
            const settingWatermarkPosition = document.getElementById("setting-watermark-position");
            if (settingWatermarkPosition) settingWatermarkPosition.value = settings.watermark_position;
        }
        if (settings.watermark_opacity !== undefined) {
            const settingWatermarkOpacity = document.getElementById("setting-watermark-opacity");
            if (settingWatermarkOpacity) {
                settingWatermarkOpacity.value = settings.watermark_opacity;
                const watermarkOpacityVal = document.getElementById("watermark-opacity-val");
                if (watermarkOpacityVal) watermarkOpacityVal.textContent = `${Math.round(settings.watermark_opacity * 100)}%`;
            }
        }

        if (settings.default_voice) {
            let foundLang = null;
            for (const [lang, voices] of Object.entries(voicesGroupedData)) {
                if (voices.some(v => v.name === settings.default_voice)) {
                    foundLang = lang;
                    break;
                }
            }
            if (foundLang) {
                selectVoiceLang.value = foundLang;
                const event = new Event("change");
                selectVoiceLang.dispatchEvent(event);
                selectVoiceModel.value = settings.default_voice;
            }
        }
        
        updateSubtitlePreview();
    }

    function captureCurrentSettings() {
        return {
            aspect_ratio: selectAspect.value,
            default_voice: selectVoiceModel.value,
            subtitle_font: selectSubFont.value,
            subtitle_font_size: parseInt(inputSubFontSize.value, 10) || 48,
            subtitle_color: inputSubColor.value,
            subtitle_outline_color: inputSubOutlineColor.value,
            subtitle_outline_width: parseInt(inputSubOutlineWidth.value, 10) || 3,
            subtitle_shadow_color: inputSubShadowColor.value,
            subtitle_shadow_depth: parseInt(inputSubShadowDepth.value, 10) || 0,
            subtitle_margin_v: parseInt(inputSubMarginV.value, 10) || 180,
            subtitle_bold: settingSubBold.checked,
            subtitle_italic: settingSubItalic.checked,
            bg_music_volume: parseFloat(sliderVolume.value),
            video_speed: parseFloat(inputSpeed.value) || 1.0,
            mute_video: settingMuteVideo.checked,
            video_order_mode: selectVideoOrder.value,
            vieneu_batch_paragraphs: parseInt(settingVieneuBatch.value, 10) || 1,
            intro_template: document.getElementById("setting-intro") ? document.getElementById("setting-intro").value : null,
            outro_template: document.getElementById("setting-outro") ? document.getElementById("setting-outro").value : null,
            watermark_path: document.getElementById("setting-watermark") ? document.getElementById("setting-watermark").value : null,
            watermark_position: document.getElementById("setting-watermark-position") ? document.getElementById("setting-watermark-position").value : "bottom-right",
            watermark_opacity: document.getElementById("setting-watermark-opacity") ? parseFloat(document.getElementById("setting-watermark-opacity").value) : 0.7
        };
    }

    // --- Saved Projects Manager ---
    const cardProjects = document.querySelector(".card-projects");
    const headerProjects = document.getElementById("header-projects");
    const bodyProjects = document.getElementById("body-projects");
    const btnSaveProject = document.getElementById("btn-save-project");
    const listProjects = document.getElementById("list-projects");

    if (headerProjects) {
        headerProjects.addEventListener("click", () => {
            cardProjects.classList.toggle("collapsed");
            bodyProjects.classList.toggle("hidden");
        });
    }

    async function refreshProjectsList() {
        if (!listProjects) return;
        try {
            const projects = await api.listProjects();
            if (projects.length === 0) {
                listProjects.innerHTML = `<p class="placeholder-text">${langSelector.value === "vi-VN" ? "Không có dự án nào được lưu." : "No saved projects."}</p>`;
                return;
            }
            
            listProjects.innerHTML = "";
            projects.forEach(proj => {
                const dateStr = new Date(proj.updated_at * 1000).toLocaleDateString();
                const row = document.createElement("div");
                row.className = "project-list-item";
                row.style.display = "flex";
                row.style.justifyContent = "space-between";
                row.style.alignItems = "center";
                row.style.padding = "0.5rem";
                row.style.borderBottom = "1px solid var(--border-color)";
                row.style.fontSize = "0.8rem";
                
                row.innerHTML = `
                    <div>
                        <strong>${escapeHtml(proj.name)}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Updated: ${dateStr}</div>
                    </div>
                    <div style="display: flex; gap: 0.35rem;">
                        <button type="button" class="btn btn-primary btn-xs btn-proj-load" data-id="${proj.id}">Load</button>
                        <button type="button" class="btn btn-success btn-xs btn-proj-gen" data-id="${proj.id}">Render</button>
                        <button type="button" class="btn btn-secondary btn-xs btn-proj-delete" data-id="${proj.id}">${icon('x', { size: 12 })}</button>
                    </div>
                `;
                listProjects.appendChild(row);
            });
        } catch (err) {
            console.error("Failed to list projects:", err);
        }
    }

    if (listProjects) {
        listProjects.addEventListener("click", async (e) => {
            const target = e.target;
            const projId = target.getAttribute("data-id");
            if (!projId) return;

            if (target.classList.contains("btn-proj-load")) {
                try {
                    const proj = await api.getProject(projId);
                    applyProject(proj);
                    printLog("System", `Loaded project: ${proj.name}`);
                } catch (err) {
                    customAlert("Failed to load project: " + err.message, "Error");
                }
            } else if (target.classList.contains("btn-proj-gen")) {
                try {
                    printLog("System", "Triggering video generation from project...");
                    const res = await api.generateProject(projId);
                    startJobPolling(res.job_id);
                } catch (err) {
                    customAlert("Failed to start project generation: " + err.message, "Error");
                }
            } else if (target.classList.contains("btn-proj-delete")) {
                if (await customConfirm("Delete this project?", "Delete Project")) {
                    try {
                        await api.deleteProject(projId);
                        refreshProjectsList();
                    } catch (err) {
                        customAlert("Failed to delete project: " + err.message, "Error");
                    }
                }
            }
        });
    }

    if (btnSaveProject) {
        btnSaveProject.addEventListener("click", async () => {
            const name = await customPrompt(t('prompt_project_name'), t('save_project'));
            if (!name) return;

            const script = textareaScript.value.trim();
            const voice = selectVoiceModel.value;
            const settings = captureCurrentSettings();

            const checkedVideoInputs = document.querySelectorAll('input[name="video-clips"]:checked');
            const selectedVideos = Array.from(checkedVideoInputs).map(inp => inp.value);

            const checkedMusicInputs = document.querySelectorAll('input[name="bg-music"]:checked:not(#mus-none)');
            const selectedMusic = Array.from(checkedMusicInputs).map(inp => inp.value);

            const payload = {
                name: name,
                script: script,
                default_voice: voice,
                video_materials: selectedVideos,
                bg_music: selectedMusic,
                settings: settings,
                subtitle_cues: [],
                generated_videos: []
            };

            try {
                await api.saveProject(payload);
                refreshProjectsList();
                customAlert(`Project '${name}' saved successfully.`, "Success");
            } catch (err) {
                customAlert("Failed to save project: " + err.message, "Error");
            }
        });
    }

    function applyProject(proj) {
        if (proj.script) {
            textareaScript.value = proj.script;
            isScriptValidated = false;
        }
        if (proj.video_materials) {
            document.querySelectorAll("#list-videos input[type='checkbox']").forEach(cb => {
                cb.checked = proj.video_materials.includes(cb.value);
            });
            const selectedCount = document.querySelectorAll("#list-videos input[type='checkbox']:checked").length;
            countVideos.textContent = selectedCount;
            updateSelectAllState();
        }
        if (proj.bg_music) {
            const bgMusicArray = Array.isArray(proj.bg_music) ? proj.bg_music : [proj.bg_music];
            document.querySelectorAll("#list-music input[type='radio']").forEach(rad => {
                rad.checked = bgMusicArray.includes(rad.value);
            });
        }
        if (proj.settings) {
            applyPreset(proj.settings);
        }
    }

    function loadVideoPreview(filename) {
        const videoUrl = `/generated/${filename}`;
        videoPreviewContainer.innerHTML = `
            <video class="video-player" controls>
                <source src="${videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
        btnDownloadVideo.classList.remove("disabled");
        btnDownloadVideo.href = videoUrl;
        printLog("Success", "Loaded finished video preview!");
    }

    const btnCancelGen = document.getElementById("btn-cancel-generation");
    const btnRetryGen = document.getElementById("btn-retry-generation");
    
    if (btnCancelGen) {
        btnCancelGen.addEventListener("click", async () => {
            if (activeJobId) {
                if (await customConfirm("Cancel current generation?", "Cancel Job")) {
                    try {
                        await api.cancelJob(activeJobId);
                        printLog("System", "Cancellation requested...");
                    } catch (err) {
                        customAlert("Cancel failed: " + err.message, "Error");
                    }
                }
            }
        });
    }
    
    if (btnRetryGen) {
        btnRetryGen.addEventListener("click", async () => {
            const list = await api.listJobs("generation", null, 1);
            if (list.length > 0) {
                const lastJob = list[0];
                await api.retryJob(lastJob.id);
                startJobPolling(lastJob.id);
            }
        });
    }

    // --- Setup Wizard and WebGPU triggers ---
    const btnRunWizard = document.getElementById("btn-run-wizard");
    const setupWizardModal = document.getElementById("setup-wizard-modal");
    const wizardResultsContainer = document.getElementById("wizard-results-container");
    const btnWizardRecheck = document.getElementById("btn-wizard-recheck");
    const btnWizardClose = document.getElementById("btn-wizard-close");

    if (btnRunWizard) {
        btnRunWizard.addEventListener("click", runWizardDiagnostics);
    }
    if (btnWizardRecheck) {
        btnWizardRecheck.addEventListener("click", runWizardDiagnostics);
    }
    if (btnWizardClose && setupWizardModal) {
        btnWizardClose.addEventListener("click", () => setupWizardModal.classList.add("hidden"));
    }

    async function runWizardDiagnostics() {
        if (!setupWizardModal || !wizardResultsContainer) return;
        setupWizardModal.classList.remove("hidden");
        wizardResultsContainer.innerHTML = '<p class="placeholder-text">Running system diagnostics...</p>';
        try {
            const data = await api.runWizardCheck();
            let html = "";
            const ffmpegOk = data.ffmpeg.ok;
            html += `
                <div class="wizard-item" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span>${icon('video', { size: 16, className: 'btn-icon' })} <span style="font-weight: 600;">FFmpeg Video Encoder</span></span>
                        <span class="badge" style="padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.75rem; background: ${ffmpegOk ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)'}; color: ${ffmpegOk ? '#4caf50' : '#f44336'};">${ffmpegOk ? 'PASSED' : 'FAILED'}</span>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Path: ${escapeHtml(data.ffmpeg.path)}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Version: ${escapeHtml(data.ffmpeg.version)}</span>
                </div>
            `;
            const diskOk = data.disk_space.ok;
            html += `
                <div class="wizard-item" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span>${icon('save', { size: 16, className: 'btn-icon' })} <span style="font-weight: 600;">Disk Storage Space</span></span>
                        <span class="badge" style="padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.75rem; background: ${diskOk ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)'}; color: ${diskOk ? '#4caf50' : '#f44336'};">${diskOk ? 'OK' : 'LOW'}</span>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Available: ${data.disk_space.free_gb} GB / ${data.disk_space.total_gb} GB</span>
                </div>
            `;
            const vieneuOk = data.vieneu_models.ok;
            html += `
                <div class="wizard-item" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-weight: 600;">🇻🇳 VieNeu-TTS Local Models</span>
                        <span class="badge" style="padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.75rem; background: ${vieneuOk ? 'rgba(76,175,80,0.2)' : 'rgba(255,152,0,0.2)'}; color: ${vieneuOk ? '#4caf50' : '#ff9800'};">${vieneuOk ? 'READY' : 'MISSING'}</span>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">ONNX: ${data.vieneu_models.onnx_exists ? 'Found' : 'Not found'} (${escapeHtml(data.vieneu_models.onnx_dir)})</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Codec: ${data.vieneu_models.codec_exists ? 'Found' : 'Not found'} (${escapeHtml(data.vieneu_models.codec_dir)})</span>
                </div>
            `;
            const pkgList = Object.entries(data.python_packages).map(([pkg, installed]) => 
                `<span style="margin-right: 0.5rem; display: inline-block; font-size: 0.8rem;"><span style="display: inline-flex; align-items: center;">${installed ? icon('check-circle', { size: 14, className: 'text-success' }) : icon('x', { size: 14, className: 'text-error' })}</span> ${pkg}</span>`
            ).join("");
            html += `
                <div class="wizard-item" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                    <span>${icon('folder', { size: 16, className: 'btn-icon' })} <span style="font-weight: 600;">Python Libraries</span></span>
                    <div style="margin-top: 0.25rem;">${pkgList}</div>
                </div>
            `;
            const apiList = Object.entries(data.remote_apis).map(([apiName, status]) => 
                `<div style="font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--text-muted);">${apiName}</span>
                    <span style="color:${status.ok ? '#4caf50' : '#f44336'}; font-weight: 600;">${status.ok ? 'Online' : (status.msg === 'Not configured' ? 'Not Configured' : 'Offline')}</span>
                </div>`
            ).join("");
            html += `
                <div class="wizard-item" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                    <span>${icon('megaphone', { size: 16, className: 'btn-icon' })} <span style="font-weight: 600;">API Connectivity</span></span>
                    <div style="display: flex; flex-direction: column; gap: 0.2rem; margin-top: 0.25rem;">${apiList}</div>
                </div>
            `;
            const asrLocal = data.asr_readiness.local_model_exists;
            const asrManaged = data.asr_readiness.managed_model_exists;
            html += `
                <div class="wizard-item" style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <span>${icon('mic', { size: 16, className: 'btn-icon' })} <span style="font-weight: 600;">Whisper Models Status</span></span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);"><span style="color:${asrLocal ? '#4caf50' : '#ff9800'}; font-weight: 600;">${asrLocal ? 'Found' : 'Not configured'}</span> Local model path</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);"><span style="color:${asrManaged ? '#4caf50' : '#ff9800'}; font-weight: 600;">${asrManaged ? 'Found' : 'Not downloaded'}</span> Managed small model</span>
                </div>
            `;
            wizardResultsContainer.innerHTML = html;
        } catch (err) {
            wizardResultsContainer.innerHTML = `<p style="color: var(--color-danger); font-size: 0.85rem;">Failed to load system check: ${escapeHtml(err.message)}</p>`;
        }
    }

    async function probeWebGPU() {
        const badge = document.getElementById("webgpu-status-badge");
        if (!navigator.gpu) {
            if (badge) {
                badge.textContent = "Unsupported";
                badge.style.color = "#f44336";
                badge.style.background = "rgba(244,67,54,0.2)";
            }
            try {
                await api.postWebGpuProbe({ supported: false, reason: "navigator.gpu not available" });
            } catch(e){}
            return;
        }
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                if (badge) {
                    badge.textContent = "Unsupported (No Adapter)";
                    badge.style.color = "#f44336";
                    badge.style.background = "rgba(244,67,54,0.2)";
                }
                await api.postWebGpuProbe({ supported: false, reason: "no adapter" });
                return;
            }
            let info = {};
            try {
                info = await adapter.requestAdapterInfo();
            } catch (e) {}
            const probeResult = {
                supported: true,
                vendor: info.vendor || "Unknown",
                architecture: info.architecture || "Unknown",
                maxBufferSize: adapter.limits ? adapter.limits.maxBufferSize : null,
                maxComputeWorkgroupSizeX: adapter.limits ? adapter.limits.maxComputeWorkgroupSizeX : null
            };
            if (badge) {
                badge.textContent = `Supported (${info.vendor || 'GPU'})`;
                badge.style.color = "#4caf50";
                badge.style.background = "rgba(76,175,80,0.2)";
            }
            await api.postWebGpuProbe(probeResult);
        } catch (err) {
            if (badge) {
                badge.textContent = "Error Probing";
                badge.style.color = "#f44336";
                badge.style.background = "rgba(244,67,54,0.2)";
            }
            try {
                await api.postWebGpuProbe({ supported: false, reason: err.message });
            } catch(e){}
        }
    }

    // Trigger WebGPU probe on page load
    probeWebGPU();

    // Setup input listener for watermark opacity slider
    const settingWatermarkOpacity = document.getElementById("setting-watermark-opacity");
    const watermarkOpacityVal = document.getElementById("watermark-opacity-val");
    if (settingWatermarkOpacity && watermarkOpacityVal) {
        settingWatermarkOpacity.addEventListener("input", (e) => {
            watermarkOpacityVal.textContent = `${Math.round(e.target.value * 100)}%`;
        });
    }

    // Setup Upload bindings for intro/outro/watermark
    const uploadIntroBox = document.getElementById("upload-intro-box");
    const uploadIntroInput = document.getElementById("upload-intro-input");
    const uploadOutroBox = document.getElementById("upload-outro-box");
    const uploadOutroInput = document.getElementById("upload-outro-input");
    const uploadWatermarkBox = document.getElementById("upload-watermark-box");
    const uploadWatermarkInput = document.getElementById("upload-watermark-input");

    if (uploadIntroBox && uploadIntroInput) {
        uploadIntroBox.addEventListener("click", () => uploadIntroInput.click());
        uploadIntroInput.addEventListener("change", (e) => handleFileUpload(e.target.files[0], "intro"));
    }
    if (uploadOutroBox && uploadOutroInput) {
        uploadOutroBox.addEventListener("click", () => uploadOutroInput.click());
        uploadOutroInput.addEventListener("change", (e) => handleFileUpload(e.target.files[0], "outro"));
    }
    if (uploadWatermarkBox && uploadWatermarkInput) {
        uploadWatermarkBox.addEventListener("click", () => uploadWatermarkInput.click());
        uploadWatermarkInput.addEventListener("change", (e) => handleFileUpload(e.target.files[0], "watermark"));
    }

    // --- Init data loading ---
    renderAllIcons();
    translateUI("en-US");
    loadConfig();
    loadVoices();
    loadMaterials();
    loadFonts();
    checkActiveJobs();
    updateCacheStats();
    refreshPresetsList();
    refreshJobsHistory();
    refreshProjectsList();

    // Start polling every 3 seconds
    updateSystemStatus();
    setInterval(updateSystemStatus, 3000);
});
