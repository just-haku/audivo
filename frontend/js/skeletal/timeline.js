// 2D Skeletal Animation Timeline Player

export class SkeletalTimelinePlayer {
    constructor(onFrameUpdate, onRedraw) {
        this.currentFrame = 0;
        this.maxFrames = 20;
        this.isPlaying = false;
        this.playInterval = null;
        this.onFrameUpdate = onFrameUpdate;
        this.onRedraw = onRedraw;
        this.fps = 20; // Default playback speed
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        
        const playBtn = document.getElementById("btn-timeline-play");
        const pauseBtn = document.getElementById("btn-timeline-pause");
        if (playBtn) playBtn.classList.add("hidden");
        if (pauseBtn) pauseBtn.classList.remove("hidden");
        
        const msPerFrame = 1000 / this.fps;
        this.playInterval = setInterval(() => {
            this.currentFrame = (this.currentFrame + 1) % (this.maxFrames + 1);
            
            const slider = document.getElementById("timeline-slider-el");
            if (slider) slider.value = this.currentFrame;
            
            if (this.onFrameUpdate) this.onFrameUpdate(this.currentFrame);
            if (this.onRedraw) this.onRedraw();
        }, msPerFrame);
    }

    pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        
        const playBtn = document.getElementById("btn-timeline-play");
        const pauseBtn = document.getElementById("btn-timeline-pause");
        if (playBtn) playBtn.classList.remove("hidden");
        if (pauseBtn) pauseBtn.classList.add("hidden");
        
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
    }

    stop() {
        this.pause();
        this.currentFrame = 0;
        
        const slider = document.getElementById("timeline-slider-el");
        if (slider) slider.value = 0;
        
        if (this.onFrameUpdate) this.onFrameUpdate(0);
        if (this.onRedraw) this.onRedraw();
    }

    setMaxFrames(val) {
        this.maxFrames = val;
        const slider = document.getElementById("timeline-slider-el");
        if (slider) {
            slider.max = val;
        }
        this.renderTicks();
    }

    renderTicks() {
        const ticks = document.getElementById("timeline-ticks-display");
        if (!ticks) return;
        ticks.innerHTML = "";
        
        const step = Math.max(1, Math.round(this.maxFrames / 10));
        for (let i = 0; i <= this.maxFrames; i += step) {
            ticks.innerHTML += `<span>F${i}</span>`;
        }
    }

    setFPS(val) {
        this.fps = val;
        if (this.isPlaying) {
            this.pause();
            this.start();
        }
    }
}
