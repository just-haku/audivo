import os
import math
import numpy as np
from PIL import Image, ImageDraw

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
    # Pillow Transform.AFFINE takes coefficients mapping output space back to input space.
    # Therefore, we compute the inverse of the global transformation matrix.
    try:
        m_inv = np.linalg.inv(m)
        return (m_inv[0, 0], m_inv[0, 1], m_inv[0, 2],
                m_inv[1, 0], m_inv[1, 1], m_inv[1, 2])
    except np.linalg.LinAlgError:
        # Fallback to identity
        return (1.0, 0.0, 0.0, 0.0, 1.0, 0.0)

def interpolate_keyframes(timeline, frame):
    """Interpolate bone coordinates linearly at the given frame number."""
    if not timeline:
        return {"angle": 0, "tx": 0, "ty": 0, "sx": 1, "sy": 1}
        
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
            
            angle = kf_curr.get("angle", 0) + t * (kf_next.get("angle", 0) - kf_curr.get("angle", 0))
            tx = kf_curr.get("tx", 0) + t * (kf_next.get("tx", 0) - kf_curr.get("tx", 0))
            ty = kf_curr.get("ty", 0) + t * (kf_next.get("ty", 0) - kf_curr.get("ty", 0))
            sx = kf_curr.get("sx", 1) + t * (kf_next.get("sx", 1) - kf_curr.get("sx", 1))
            sy = kf_curr.get("sy", 1) + t * (kf_next.get("sy", 1) - kf_curr.get("sy", 1))
            
            return {
                "frame": frame,
                "angle": angle,
                "tx": tx,
                "ty": ty,
                "sx": sx,
                "sy": sy
            }
    return sorted_kfs[0]

class SkeletalSolver:
    @staticmethod
    def solve_bone_matrices(bones: list[dict], pose_adjustments: dict) -> dict[str, np.ndarray]:
        """
        Recursively compute global homogeneous transformation matrices for all bones.
        - bones: List of bone dicts.
        - pose_adjustments: Dict mapping bone_name -> {"angle": float, "tx": float, "ty": float, "sx": float, "sy": float}
        """
        bone_by_name = {b["name"]: b for b in bones}
        matrices = {}

        def get_global_matrix(name: str) -> np.ndarray:
            if name in matrices:
                return matrices[name]
                
            bone = bone_by_name[name]
            parent = bone.get("parent")
            
            # 1. Base relative pivot offset
            bx, by = bone.get("pivot", [0, 0])
            base_t = translation_matrix(bx, by)
            
            # 2. Keyframe adjustments
            adj = pose_adjustments.get(name, {})
            adj_tx = adj.get("tx", 0)
            adj_ty = adj.get("ty", 0)
            adj_angle = adj.get("angle", 0)
            adj_sx = adj.get("sx", 1.0)
            adj_sy = adj.get("sy", 1.0)
            
            # Bone-specific parameters
            base_angle = bone.get("angle", 0)
            base_sx, base_sy = bone.get("scale", [1.0, 1.0])
            
            local_t = translation_matrix(adj_tx, adj_ty)
            local_r = rotation_matrix(base_angle + adj_angle)
            local_s = scale_matrix(base_sx * adj_sx, base_sy * adj_sy)
            
            # Combine local matrices
            m_local = base_t @ local_t @ local_r @ local_s
            
            # 3. Parent multiplication
            if parent and parent in bone_by_name:
                m_global = get_global_matrix(parent) @ m_local
            else:
                m_global = m_local
                
            matrices[name] = m_global
            return m_global

        for bone in bones:
            get_global_matrix(bone["name"])
            
        return matrices

    @classmethod
    def render_frame(cls, bones: list[dict], pose_adjustments: dict, uploads_dir: str, 
                     canvas_size=(1024, 1024), bg_color=(0, 0, 0, 0), draw_skeleton=False) -> Image.Image:
        """
        Renders the character composite image frame.
        - bones: List of bone dicts.
        - pose_adjustments: Dict of bone transformations.
        - uploads_dir: Directory where sprite parts are saved.
        - draw_skeleton: If true, overlays skeleton bone lines and joint pivot circles.
        """
        canvas = Image.new("RGBA", canvas_size, bg_color)
        matrices = cls.solve_bone_matrices(bones, pose_adjustments)
        
        # Sort bones by z_index
        sorted_bones = sorted(bones, key=lambda x: x.get("z_index", 0))
        
        for bone in sorted_bones:
            name = bone["name"]
            asset_fn = bone.get("attached_asset")
            m_global = matrices[name]
            
            # 1. Render sprite if attached
            if asset_fn:
                asset_path = os.path.join(uploads_dir, asset_fn)
                if os.path.exists(asset_path):
                    sprite = Image.open(asset_path).convert("RGBA")
                    
                    # Offset local anchor pivot to center/joint position in sprite space
                    anchor_x, anchor_y = bone.get("anchor", [0, 0])
                    m_anchor = translation_matrix(-anchor_x, -anchor_y)
                    
                    # Final forward transform matrix
                    f_matrix = m_global @ m_anchor
                    
                    # Perform inverse transformation mapping
                    coeffs = get_affine_transform(f_matrix)
                    transformed_sprite = sprite.transform(canvas_size, Image.Transform.AFFINE, coeffs, Image.Resampling.BILINEAR)
                    canvas.alpha_composite(transformed_sprite)
            
            # 2. Render face zone overlays (eyes, mouth) if head bone
            face_zone = bone.get("face_zone")
            if face_zone:
                eyes_offset = face_zone.get("eyes_offset", [0, 0])
                mouth_offset = face_zone.get("mouth_offset", [0, 0])
                
                # Render eyes
                eyes_fn = face_zone.get("eyes_asset")
                if eyes_fn:
                    eyes_path = os.path.join(uploads_dir, eyes_fn)
                    if os.path.exists(eyes_path):
                        eyes_sprite = Image.open(eyes_path).convert("RGBA")
                        m_eyes = m_global @ translation_matrix(eyes_offset[0], eyes_offset[1]) @ translation_matrix(-eyes_sprite.width/2, -eyes_sprite.height/2)
                        coeffs = get_affine_transform(m_eyes)
                        transformed_eyes = eyes_sprite.transform(canvas_size, Image.Transform.AFFINE, coeffs, Image.Resampling.BILINEAR)
                        canvas.alpha_composite(transformed_eyes)
                        
                # Render mouth
                mouth_fn = face_zone.get("mouth_asset")
                if mouth_fn:
                    mouth_path = os.path.join(uploads_dir, mouth_fn)
                    if os.path.exists(mouth_path):
                        mouth_sprite = Image.open(mouth_path).convert("RGBA")
                        m_mouth = m_global @ translation_matrix(mouth_offset[0], mouth_offset[1]) @ translation_matrix(-mouth_sprite.width/2, -mouth_sprite.height/2)
                        coeffs = get_affine_transform(m_mouth)
                        transformed_mouth = mouth_sprite.transform(canvas_size, Image.Transform.AFFINE, coeffs, Image.Resampling.BILINEAR)
                        canvas.alpha_composite(transformed_mouth)

        # 3. Optional Overlay drawing of bone connections for debugging/rigging previews
        if draw_skeleton:
            draw = ImageDraw.Draw(canvas)
            bone_by_name = {b["name"]: b for b in bones}
            for bone in bones:
                name = bone["name"]
                parent_name = bone.get("parent")
                
                # Get global joint position (translation components of homogeneous matrix)
                m_g = matrices[name]
                joint_pos = (int(m_g[0, 2]), int(m_g[1, 2]))
                
                # Draw parent-child bone lines
                if parent_name and parent_name in matrices:
                    m_p = matrices[parent_name]
                    parent_pos = (int(m_p[0, 2]), int(m_p[1, 2]))
                    draw.line([parent_pos, joint_pos], fill=(0, 255, 0, 255), width=3)
                
                # Draw joint pivot circles
                draw.ellipse([joint_pos[0]-5, joint_pos[1]-5, joint_pos[0]+5, joint_pos[1]+5], fill=(255, 0, 0, 255))
                draw.text((joint_pos[0]+8, joint_pos[1]-5), name, fill=(255, 255, 0, 255))
                
        return canvas
