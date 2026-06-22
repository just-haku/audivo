import numpy as np

def translation_matrix(tx, ty):
    return np.array([
        [1.0, 0.0, float(tx)],
        [0.0, 1.0, float(ty)],
        [0.0, 0.0, 1.0]
    ])

def rotation_matrix(deg):
    rad = np.radians(deg)
    c, s = np.cos(rad), np.sin(rad)
    return np.array([
        [c, -s, 0.0],
        [s,  c, 0.0],
        [0.0, 0.0, 1.0]
    ])

def scale_matrix(sx, sy):
    return np.array([
        [float(sx), 0.0, 0.0],
        [0.0, float(sy), 0.0],
        [0.0, 0.0, 1.0]
    ])

def get_affine_transform(m):
    """Calculate inverse coefficients for Pillow's Transform.AFFINE mode."""
    try:
        m_inv = np.linalg.inv(m)
        return (m_inv[0, 0], m_inv[0, 1], m_inv[0, 2],
                m_inv[1, 0], m_inv[1, 1], m_inv[1, 2])
    except np.linalg.LinAlgError:
        return (1.0, 0.0, 0.0, 0.0, 1.0, 0.0)

def apply_easing(t: float, easing_type: str) -> float:
    """Apply easing function to interpolation coefficient t (0.0 to 1.0)."""
    if easing_type == "ease_in":
        return t * t
    elif easing_type == "ease_out":
        return 1.0 - (1.0 - t) * (1.0 - t)
    elif easing_type == "ease_in_out":
        return t * t * (3.0 - 2.0 * t)
    return t  # default linear

def interpolate_keyframes(timeline: list[dict], frame: float) -> dict:
    """Interpolate coordinates at a given frame number supporting easing curves."""
    if not timeline:
        return {"angle": 0.0, "tx": 0.0, "ty": 0.0, "sx": 1.0, "sy": 1.0}
        
    sorted_kfs = sorted(timeline, key=lambda x: x["frame"])
    if frame <= sorted_kfs[0]["frame"]:
        return sorted_kfs[0]
    if frame >= sorted_kfs[-1]["frame"]:
        return sorted_kfs[-1]
        
    for i in range(len(sorted_kfs) - 1):
        kf_curr = sorted_kfs[i]
        kf_next = sorted_kfs[i+1]
        if kf_curr["frame"] <= frame <= kf_next["frame"]:
            t = (frame - kf_curr["frame"]) / (kf_next["frame"] - kf_curr["frame"])
            
            # Apply easing from current keyframe configuration
            easing = kf_curr.get("easing", "linear")
            t_eased = apply_easing(t, easing)
            
            angle = kf_curr.get("angle", 0.0) + t_eased * (kf_next.get("angle", 0.0) - kf_curr.get("angle", 0.0))
            tx = kf_curr.get("tx", 0.0) + t_eased * (kf_next.get("tx", 0.0) - kf_curr.get("tx", 0.0))
            ty = kf_curr.get("ty", 0.0) + t_eased * (kf_next.get("ty", 0.0) - kf_curr.get("ty", 0.0))
            sx = kf_curr.get("sx", 1.0) + t_eased * (kf_next.get("sx", 1.0) - kf_curr.get("sx", 1.0))
            sy = kf_curr.get("sy", 1.0) + t_eased * (kf_next.get("sy", 1.0) - kf_curr.get("sy", 1.0))
            
            return {
                "frame": frame,
                "angle": angle,
                "tx": tx,
                "ty": ty,
                "sx": sx,
                "sy": sy
            }
    return sorted_kfs[0]
