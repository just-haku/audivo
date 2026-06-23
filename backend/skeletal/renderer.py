import os
from PIL import Image, ImageDraw
import numpy as np
from backend.skeletal.matrix import translation_matrix, get_affine_transform
from backend.skeletal.solver import SkeletalSolver

class SkeletalRenderer:
    @classmethod
    def render_frame(cls, bones: list[dict], pose_adjustments: dict, uploads_dir: str, 
                     canvas_size=(1024, 1024), bg_color=(0, 0, 0, 0), draw_skeleton=False, 
                     ik_targets: dict = None, locked_bones: list = None, locked_bone_coords: dict = None) -> Image.Image:
        """
        Renders the composite character frame.
        - bones: List of bone definitions.
        - pose_adjustments: Dict of bone transformations.
        - uploads_dir: Directory where sprite parts are saved.
        - draw_skeleton: If true, overlays skeleton bone lines and joint pivot circles.
        - ik_targets: Optional dict mapping terminal_bone -> [target_x, target_y] to solve IK.
        """
        canvas = Image.new("RGBA", canvas_size, bg_color)
        
        # Solve matrices (applies IK solving and Lock coordinate constraints)
        matrices = SkeletalSolver.solve_bone_matrices(
            bones, pose_adjustments, ik_targets,
            locked_bones=locked_bones, locked_bone_coords=locked_bone_coords
        )
        
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
                
                # Get global joint position
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
