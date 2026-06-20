import os
import sys
import json
import time

def main():
    if len(sys.argv) < 2:
        print("Error: Missing task JSON file path", file=sys.stderr)
        sys.exit(1)
        
    task_file = sys.argv[1]
    if not os.path.exists(task_file):
        print(f"Error: Task file not found: {task_file}", file=sys.stderr)
        sys.exit(1)
        
    try:
        with open(task_file, "r", encoding="utf-8") as f:
            task = json.load(f)
    except Exception as e:
        print(f"Error reading task file: {e}", file=sys.stderr)
        sys.exit(1)
        
    version = task.get("version", "v3")
    cpu_threads = task.get("cpu_threads", 0)
    vieneu_mode = task.get("vieneu_mode", "local")
    vieneu_api_base = task.get("vieneu_api_base", "http://localhost:23333/v1")
    vieneu_model_name = task.get("vieneu_model_name", "pnnbao-ump/VieNeu-TTS-v3-Turbo")
    vieneu_onnx_dir = task.get("vieneu_onnx_dir") or ""
    vieneu_codec_dir = task.get("vieneu_codec_dir") or ""
    hf_offline = bool(task.get("hf_offline", True))
    segments = task.get("segments", [])
    
    if not segments:
        print("No segments to synthesize.")
        sys.exit(0)
        
    # Determine the number of threads for the engine
    # For v3 ONNX, intra-op multi-threading causes massive context switching overhead
    # for small frame-by-frame loop operations, so we enforce exactly 1 thread.
    # For v2 GGUF (llama-cpp), multi-threading speeds up large matrix operations.
    if version == "v2":
        if len(segments) == 1:
            engine_threads = cpu_threads if cpu_threads > 0 else 1
        else:
            engine_threads = 1
    else:
        engine_threads = 1
        
    # Limit native library threads to avoid context switching thrashing
    limit_threads = str(engine_threads)
    os.environ["OMP_NUM_THREADS"] = limit_threads
    os.environ["MKL_NUM_THREADS"] = limit_threads
    os.environ["OPENBLAS_NUM_THREADS"] = limit_threads
    os.environ["VECLIB_MAXIMUM_THREADS"] = limit_threads
    os.environ["NUMEXPR_NUM_THREADS"] = limit_threads
    os.environ["TF_NUM_INTEROP_THREADS"] = limit_threads
    os.environ["TF_NUM_INTRAOP_THREADS"] = limit_threads
    os.environ["ONNXRUNTIME_NUM_THREADS"] = limit_threads
    os.environ["ORT_ENABLE_ALL"] = "1"
    if hf_offline:
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN_WARNING"] = "1"
        
    if vieneu_mode == "remote":
        print(f"Loading VieNeu-TTS in REMOTE mode pointing to {vieneu_api_base} with model {vieneu_model_name}...")
    else:
        print(f"Loading VieNeu-TTS {version} engine locally with threads={engine_threads}...")
    
    try:
        from vieneu import Vieneu
        if vieneu_mode == "remote":
            tts = Vieneu(
                mode="remote",
                api_base=vieneu_api_base,
                model_name=vieneu_model_name,
                codec_repo="neuphonic/neucodec-onnx-decoder-int8",
                codec_device="cpu"
            )
        elif version == "v2":
            kwargs = {
                "mode": "turbo",
                "n_threads": engine_threads,
            }
            if vieneu_onnx_dir:
                if os.path.exists(vieneu_onnx_dir) and not os.path.isdir(vieneu_onnx_dir):
                    kwargs["backbone_repo"] = vieneu_onnx_dir
                else:
                    gpath = os.path.join(vieneu_onnx_dir, "vieneu-tts-v2-turbo.gguf")
                    if os.path.exists(gpath):
                        kwargs["backbone_repo"] = gpath
            
            if vieneu_codec_dir:
                if os.path.exists(vieneu_codec_dir) and not os.path.isdir(vieneu_codec_dir):
                    kwargs["decoder_repo"] = vieneu_codec_dir
                    enc_path = os.path.join(os.path.dirname(vieneu_codec_dir), "vieneu_encoder.onnx")
                    if os.path.exists(enc_path):
                        kwargs["encoder_repo"] = enc_path
                else:
                    dec_path = os.path.join(vieneu_codec_dir, "vieneu_decoder.onnx")
                    enc_path = os.path.join(vieneu_codec_dir, "vieneu_encoder.onnx")
                    if os.path.exists(dec_path):
                        kwargs["decoder_repo"] = dec_path
                    if os.path.exists(enc_path):
                        kwargs["encoder_repo"] = enc_path
            tts = Vieneu(**kwargs)
        else:
            kwargs = {"threads": engine_threads}
            if vieneu_onnx_dir:
                kwargs["onnx_dir"] = vieneu_onnx_dir
            if vieneu_codec_dir:
                kwargs["codec_dir"] = vieneu_codec_dir
            tts = Vieneu(**kwargs)
    except Exception as e:
        print(f"Error initializing VieNeu engine: {e}", file=sys.stderr)
        sys.exit(1)
        
    print("Engine loaded. Synthesizing segments...")
    
    start_segment_index = task.get("start_segment_index", 0)
    total_segments_count = task.get("total_segments_count", len(segments))

    for idx, seg in enumerate(segments):
        text = seg["text"]
        voice_name = seg["voice_name"]
        output_path = seg["output_path"]
        abs_idx = start_segment_index + idx + 1
        
        # Check if already cached
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            print(f"[{abs_idx}/{total_segments_count}] Already cached: {output_path}")
            continue
            
        print(f"[{abs_idx}/{total_segments_count}] Synthesizing: \"{text[:30]}...\" -> {output_path}")
        try:
            t0 = time.time()
            audio_data = tts.infer(text, voice=voice_name)
            tts.save(audio_data, output_path)
            t1 = time.time()
            print(f"  Done in {t1-t0:.2f}s")
        except Exception as e:
            print(f"Error synthesizing segment {idx}: {e}", file=sys.stderr)
            sys.exit(1)
            
    print("All segments synthesized successfully.")

if __name__ == "__main__":
    main()
