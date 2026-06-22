import os
import pytest
import numpy as np
from fastapi.testclient import TestClient
from backend.app import app
from backend.skeletal.solver import SkeletalSolver
from backend.skeletal.matrix import translation_matrix, rotation_matrix, scale_matrix, interpolate_keyframes

client = TestClient(app)

def test_translation_matrix():
    t = translation_matrix(10, -20)
    assert np.allclose(t @ np.array([0, 0, 1]), np.array([10, -20, 1]))

def test_rotation_matrix():
    # 90 degrees rotation should map (1, 0) to (0, 1)
    r = rotation_matrix(90)
    res = r @ np.array([1, 0, 1])
    assert np.allclose(res[:2], np.array([0, 1]))

def test_scale_matrix():
    s = scale_matrix(2, 0.5)
    res = s @ np.array([10, 10, 1])
    assert np.allclose(res[:2], np.array([20, 5]))

def test_interpolate_keyframes():
    timeline = [
        {"frame": 0, "angle": 0, "tx": 0, "ty": 0},
        {"frame": 10, "angle": 90, "tx": 100, "ty": 50}
    ]
    # At frame 5, values should be exactly half (linear interpolation)
    res = interpolate_keyframes(timeline, 5)
    assert pytest.approx(res["angle"]) == 45.0
    assert pytest.approx(res["tx"]) == 50.0
    assert pytest.approx(res["ty"]) == 25.0

def test_skeletal_hierarchy_solving():
    bones = [
        {"name": "root", "parent": None, "pivot": [100, 100], "angle": 0, "scale": [1, 1]},
        {"name": "arm", "parent": "root", "pivot": [50, 0], "angle": 90, "scale": [1, 1]}
    ]
    pose_adjs = {
        "root": {"angle": 45, "tx": 10, "ty": 10, "sx": 1, "sy": 1},
        "arm": {"angle": 0, "tx": 0, "ty": 0, "sx": 1, "sy": 1}
    }
    
    matrices = SkeletalSolver.solve_bone_matrices(bones, pose_adjs)
    assert "root" in matrices
    assert "arm" in matrices
    
    # Root position should be pivot [100, 100] + translation [10, 10] = [110, 110]
    m_root = matrices["root"]
    assert np.allclose(m_root[:2, 2], np.array([110, 110]))

def test_api_presets():
    res = client.get("/api/skeletal/presets")
    assert res.status_code == 200
    presets = res.json()
    assert "walk_right" in presets
    assert "run_right" in presets
    assert "punch_right" in presets

def test_api_character_crud():
    payload = {
        "id": "test_dummy",
        "name": "Test Dummy",
        "rig_data": {
            "bones": [
                {"name": "hip", "parent": None, "pivot": [320, 480], "angle": 0, "scale": [1, 1]}
            ]
        }
    }
    
    # Save character
    res = client.post("/api/skeletal/character", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    
    # Get character
    res = client.get("/api/skeletal/character/test_dummy")
    assert res.status_code == 200
    char = res.json()
    assert char["name"] == "Test Dummy"
    assert char["rig_data"]["bones"][0]["name"] == "hip"
    
    # List characters
    res = client.get("/api/skeletal/characters")
    assert res.status_code == 200
    chars = res.json()
    assert any(c["id"] == "test_dummy" for c in chars)
    
    # Delete character
    res = client.delete("/api/skeletal/character/test_dummy")
    assert res.status_code == 200
    
    # Get character (should be 404 now)
    res = client.get("/api/skeletal/character/test_dummy")
    assert res.status_code == 404

def test_api_render_preview():
    # Construct render preview body
    payload = {
        "bones": [
            {"name": "hip", "parent": None, "pivot": [320, 320], "angle": 0, "scale": [1, 1], "z_index": 10}
        ],
        "pose_adjustments": {
            "hip": {"angle": 0, "tx": 0, "ty": 0, "sx": 1, "sy": 1}
        },
        "draw_skeleton": True
    }
    
    res = client.post("/api/skeletal/render-preview", json=payload)
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert len(res.content) > 0

def test_apply_easing():
    from backend.skeletal.matrix import apply_easing
    assert apply_easing(0.0, "linear") == 0.0
    assert apply_easing(1.0, "linear") == 1.0
    assert apply_easing(0.5, "linear") == 0.5
    
    assert apply_easing(0.5, "ease_in") == 0.25
    assert apply_easing(0.5, "ease_out") == 0.75
    assert apply_easing(0.5, "ease_in_out") == 0.5
    assert apply_easing(0.25, "ease_in_out") == 0.15625

def test_solve_ik_angles():
    import math
    # Setup simple hierarchy: hip -> thigh -> calf
    bones = [
        {"name": "hip", "parent": None, "pivot": [100, 100], "angle": 0, "scale": [1, 1]},
        {"name": "thigh", "parent": "hip", "pivot": [0, 0], "angle": 0, "scale": [1, 1]},
        {"name": "calf", "parent": "thigh", "pivot": [50, 0], "angle": 0, "scale": [1, 1], "anchor": [50, 0]}
    ]
    
    # 1. Test fully extended IK target
    adjs = {}
    ik_targets = {
        "calf": [100.0 + 50.0 * math.sqrt(2), 100.0 + 50.0 * math.sqrt(2)]
    }
    SkeletalSolver.solve_ik_angles(bones, adjs, ik_targets)
    
    assert "thigh" in adjs
    assert "calf" in adjs
    assert pytest.approx(adjs["thigh"]["angle"]) == 45.0
    assert pytest.approx(adjs["calf"]["angle"]) == 0.0

    # 2. Test bent joint IK target using Law of Cosines
    # Let D = 50 * sqrt(2), which is less than L1 + L2 = 100.
    adjs_bent = {}
    ik_targets_bent = {
        "calf": [100.0 + 50.0, 100.0 + 50.0]
    }
    SkeletalSolver.solve_ik_angles(bones, adjs_bent, ik_targets_bent)
    assert "thigh" in adjs_bent
    assert "calf" in adjs_bent
    # The thigh and calf angles should be non-zero and solved to reach [150, 150]
    # L1=50, L2=50, D = 50 * sqrt(2) approx 70.71
    # cos_alpha = (50^2 + (50 * sqrt(2))^2 - 50^2) / (2 * 50 * (50 * sqrt(2)))
    # cos_alpha = 5000 / (100 * 50 * sqrt(2)) = 1 / sqrt(2)
    # alpha = pi / 4 = 45 degrees
    # phi = 45 degrees
    # theta1_global = phi - bend_direction * alpha - 0 = 45 - 45 = 0 degrees (with bend_direction = 1)
    # So thigh angle should be approx 0 degrees, pointing along the positive x-axis initially
    # Let's verify: thigh pivot is at [100, 100]. thigh length is 50.
    # If thigh is at 0 degrees, it points to [150, 100].
    # Calf pivot is at [150, 100]. Calf length is 50.
    # If calf is at 90 degrees relative to thigh, it points to [150, 150], which is our target!
    # So thigh angle adjustment should be 0.0, calf angle adjustment should be 90.0.
    assert pytest.approx(adjs_bent["thigh"]["angle"], abs=1e-4) == 0.0
    assert pytest.approx(adjs_bent["calf"]["angle"], abs=1e-4) == 90.0
