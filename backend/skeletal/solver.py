import math
import numpy as np
from backend.skeletal.matrix import translation_matrix, rotation_matrix, scale_matrix

class SkeletalSolver:
    @staticmethod
    def enforce_constraints(bone: dict, total_local_angle: float) -> float:
        """Clamp local angle based on min/max constraints defined on the bone."""
        constraints = bone.get("constraints")
        if constraints:
            min_a = constraints.get("min_angle")
            max_a = constraints.get("max_angle")
            if min_a is not None:
                total_local_angle = max(min_a, total_local_angle)
            if max_a is not None:
                total_local_angle = min(max_a, total_local_angle)
        return total_local_angle

    @classmethod
    def solve_bone_matrices(cls, bones: list[dict], pose_adjustments: dict, ik_targets: dict = None,
                            locked_bones: list = None, locked_bone_coords: dict = None) -> dict[str, np.ndarray]:
        """
        Solve global matrices for all bones in the hierarchy.
        - bones: List of bone definitions.
        - pose_adjustments: Dict mapping bone_name -> {"angle": float, "tx": float, "ty": float, "sx": float, "sy": float}
        - ik_targets: Optional dict mapping terminal_bone -> [target_x, target_y] to solve IK before matrix projection.
        """
        bone_by_name = {b["name"]: b for b in bones}
        
        # If IK targets are provided, solve joint rotations analytically and merge them into pose_adjustments
        local_adjs = {k: dict(v) for k, v in pose_adjustments.items()}
        if ik_targets:
            cls.solve_ik_angles(bones, local_adjs, ik_targets)

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
            adj = local_adjs.get(name, {})
            adj_tx = adj.get("tx", 0.0)
            adj_ty = adj.get("ty", 0.0)
            adj_angle = adj.get("angle", 0.0)
            adj_sx = adj.get("sx", 1.0)
            adj_sy = adj.get("sy", 1.0)
            
            # Bone parameters
            base_angle = bone.get("angle", 0.0)
            base_sx, base_sy = bone.get("scale", [1.0, 1.0])
            
            total_angle = base_angle + adj_angle
            # Enforce rotation limits if present
            total_angle = cls.enforce_constraints(bone, total_angle)
            
            local_t = translation_matrix(adj_tx, adj_ty)
            local_r = rotation_matrix(total_angle)
            local_s = scale_matrix(base_sx * adj_sx, base_sy * adj_sy)
            
            # Combine local matrices
            m_local = base_t @ local_t @ local_r @ local_s
            
            # 3. Parent multiplication
            if parent and parent in bone_by_name:
                m_global = get_global_matrix(parent) @ m_local
            else:
                m_global = m_local
                
            # Apply Locked point coordinate constraint if active
            if locked_bones and name in locked_bones and locked_bone_coords and name in locked_bone_coords:
                m_global[0, 2] = locked_bone_coords[name].get("x", m_global[0, 2])
                m_global[1, 2] = locked_bone_coords[name].get("y", m_global[1, 2])
                
            matrices[name] = m_global
            return m_global

        for bone in bones:
            get_global_matrix(bone["name"])
            
        return matrices

    @classmethod
    def solve_ik_angles(cls, bones: list[dict], adjs: dict, ik_targets: dict):
        """
        Analytical 2-joint IK solver. Modifies adjs dict in place.
        For a target terminal node C (e.g. left_calf), with parent B (e.g. left_thigh) and grandparent A (e.g. hip).
        Saves rotation angles for parent and child to reach target [tx, ty].
        """
        bone_by_name = {b["name"]: b for b in bones}
        
        # Helper to get temporary global positions using current FK (excluding targets)
        temp_matrices = cls.solve_bone_matrices(bones, adjs, ik_targets=None)

        for target_name, target_pos in ik_targets.items():
            if target_name not in bone_by_name:
                continue
                
            bone_c = bone_by_name[target_name] # Child / calf
            parent_name = bone_c.get("parent")
            if not parent_name:
                continue
                
            bone_b = bone_by_name[parent_name] # Parent / thigh
            grandparent_name = bone_b.get("parent")
            
            # Joint A (thigh pivot) position (grandparent's global position + bone_b pivot rotated)
            if grandparent_name and grandparent_name in temp_matrices:
                m_gp = temp_matrices[grandparent_name]
                bp_x, bp_y = bone_b.get("pivot", [0, 0])
                gp_rad = math.atan2(m_gp[1, 0], m_gp[0, 0])
                cos, sin = math.cos(gp_rad), math.sin(gp_rad)
                x1 = m_gp[0, 2] + bp_x * cos - bp_y * sin
                y1 = m_gp[1, 2] + bp_x * sin + bp_y * cos
                parent_global_angle = gp_rad * 180 / math.pi
            else:
                # Root level segment
                x1, y1 = bone_b.get("pivot", [0, 0])
                parent_global_angle = 0.0

            # Target position
            xt, yt = target_pos
            
            # Lengths of segments (local offsets)
            # Segment 1 (thigh to calf pivot)
            cp_x, cp_y = bone_c.get("pivot", [0, 0])
            L1 = math.hypot(cp_x, cp_y)
            
            # Segment 2 (calf to effector length or anchor displacement)
            # For simplicity, if bone_c doesn't have child, length L2 is length of bone_c or its anchor
            L2 = math.hypot(bone_c.get("anchor", [0, 0])[0], bone_c.get("anchor", [0, 0])[1])
            if L2 == 0:
                L2 = float(bone_c.get("length", 50.0))
                
            # Distance from joint 1 (shoulder/hip) to target
            D = math.hypot(xt - x1, yt - y1)
            if D == 0:
                continue
                
            # Solve angles
            phi = math.atan2(yt - y1, xt - x1)
            
            if D >= L1 + L2:
                # Fully extended
                theta1_global = phi - math.atan2(cp_y, cp_x)
                theta2_local = 0.0
            else:
                # Law of Cosines
                cos_alpha = (L1*L1 + D*D - L2*L2) / (2.0 * L1 * D)
                cos_beta = (L1*L1 + L2*L2 - D*D) / (2.0 * L1 * L2)
                
                # Clamp to prevent NaN
                alpha = math.acos(max(-1.0, min(1.0, cos_alpha)))
                beta = math.acos(max(-1.0, min(1.0, cos_beta)))
                
                # Toggle bend direction (default positive bend / knee bending forward)
                bend_direction = bone_c.get("ik_bend_direction", 1.0)
                
                theta1_global = phi - bend_direction * alpha - math.atan2(cp_y, cp_x)
                theta2_local = bend_direction * (math.pi - beta) - math.atan2(0.0, L2) # relative local bend

            # Convert to local relative degrees
            t1_local_deg = (theta1_global * 180 / math.pi) - parent_global_angle - bone_b.get("angle", 0)
            t2_local_deg = (theta2_local * 180 / math.pi) - bone_c.get("angle", 0)
            
            # Store computed local adjustments
            if parent_name not in adjs:
                adjs[parent_name] = {}
            adjs[parent_name]["angle"] = cls.enforce_constraints(bone_b, t1_local_deg)
            
            if target_name not in adjs:
                adjs[target_name] = {}
            adjs[target_name]["angle"] = cls.enforce_constraints(bone_c, t2_local_deg)
