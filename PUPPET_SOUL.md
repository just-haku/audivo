# 2D Skeletal Animator: Puppet Soul & Mechanics Reference

This document serves as the conceptual design specification and reference manual for the 2D Cartoon Skeletal Studio, detailing the skeletal posing engine and the integrated drawing studio.

---

## 1. Rigging & Kinematics Engine (Synfig-Inspired Browser Posing)

The skeletal posing and animation pipeline is inspired by Synfig Studio, adapting professional 2D vector animation concepts directly into a high-performance browser canvas workspace.

### Coordinate Systems: Local vs. World Space
To calculate bone coordinates, the engine maintains two distinct coordinate spaces:
*   **Local Space**: Every bone defines its parameters (pivot, angle, scale) relative to its parent bone. For instance, the hand's local position is defined relative to the wrist. If the upper arm rotates, the hand's local coordinates remain unchanged.
*   **World Space**: The global coordinate system of the canvas. Every joint must ultimately be solved into world space coordinates (X and Y coordinates in pixels, and global rotation in degrees) to render it on the screen.

### Joint Nodes & Handles
Manipulating the rig is performed through distinct handles drawn on the canvas, each serving a unique geometric purpose:
*   **Pivot/Rotation Handles**: Violet circle nodes placed at the root joint. Dragging these handles rotates the entire bone segment and its descendants around the pivot.
*   **Scale/Width Handles**: Indicators that allow developers to scale individual limbs along their local axis, adjusting length or width properties.
*   **Root Position Handles**: Fuchsia circle nodes representing the character's base origin (the hip). Translating this handle shifts the entire puppet coordinate space.
*   **Anchor/Lock Handles**: Cyan boundary rings representing locked joints. These points remain stationary when Inverse Kinematics are resolved on child nodes.

### Kinematics Engine & Posing Physics
Posing is resolved using two methodologies:
*   **Forward Kinematics (FK)**:
    1.  The solver starts at the root node (typically the Hip).
    2.  It translates the parent's pivot by the global offset.
    3.  For each child bone down the hierarchy tree, it calculates its global rotation by adding its local angle to the parent's global rotation.
    4.  It applies trigonometry (sine and cosine functions) to project the child's pivot along the parent's direction, scaling the offset by the parent's global scale.
*   **Inverse Kinematics (IK)**:
    *   **Analytical Solver**: When a user drags a terminal limb (like a hand or foot), a two-joint solver determines the angles of the shoulder-elbow or hip-knee joints.
    *   **Law of Cosines**: The solver forms a triangle between the shoulder, elbow, and wrist target. Using the lengths of the upper arm and forearm, it calculates the internal angles of the elbow and shoulder mathematically. This ensures a stable, instant, and predictable calculation compared to iterative numerical solvers.
    *   **Spine Pinning**: If the hip is dragged while the head is pinned (or vice versa), the solver keeps the pinned joint anchored in world space. It adjusts the intermediate spine segments, stretching or contracting them within constraints to maintain bipedal alignment.
*   **Joint Constraints**:
    *   To prevent bones from bending unnaturally (e.g., knee joints bending forward), each joint can have min/max angular constraints.
    *   The solver evaluates local angles at each step and clamps them to the designated angular boundaries before applying parent transformations.

---

## 2. Drawing Studio (JS-Paint-Inspired Raster Editor)

The Paint Studio provides a classic, pixel-perfect raster painting environment modeled after JS-Paint and traditional MS-Paint layouts to edit character textures directly on individual limbs.

### Canvas Rendering Architecture
*   **Dual-Layer Canvas**: The workspace uses two overlapping canvas layers:
    1.  *Active Layer*: The target canvas where the permanent drawings reside.
    2.  *Preview Overlay*: A temporary canvas used to display active drawing strokes or shape previews (like rubber-banding lines or circles) before committing them to the active layer on mouse release.
*   **Transparency Grid**: A custom conic checkerboard background pattern is drawn behind the canvases to represent transparent pixels, allowing clear identification of alpha boundaries.
*   **Pixel Grid Zoom**: Zooming in beyond 400% triggers a visual grid aligning with pixel boundaries, allowing precision editing for retro designs.
*   **Guide Overlay Layer**: Renders a translucent wireframe outline of neighboring limbs, providing reference to ensure the torso aligns with the limbs.

### Tool Shelf & Raster Algorithms
*   **Pencil/Pen**: Standard aliased drawing tool that modifies pixels along a straight path using Bresenham's line algorithm.
*   **Eraser**: Draws transparency values (alpha = 0) onto the canvas, acting as a pixel remover.
*   **Aerosol (Color Spray)**: Sprays paint dots in a circular pattern around the cursor. The distribution uses a randomized polar offset, spraying paint at a constant rate using a timer interval.
*   **Paint Bucket**: A flood-fill tool that samples the color of the clicked pixel. It walks neighboring pixels using a queue-based scanline algorithm, replacing pixels of matching color with the selected brush color until it hits a boundary.
*   **Eyedropper (Color Picker)**: Samples pixel colors by reading the color buffer of the composite canvas at the cursor coordinate.
*   **Shape Tool**: Renders geometric primitives:
    *   *Line*: Draws straight lines.
    *   *Circle & Ellipse*: Renders symmetrical rounded shapes using midpoint circle algorithms.
    *   *Polygons*: Computes vertex coordinates for triangles, quadragons, pentagons, hexagons, and stars, drawing lines to connect them.
    *   *Modes*: Supports outline only, fill only, or outline with fill.
*   **Lasso Selection Tool**: Allows the user to trace a freeform boundary. On mouseup, the pixels inside the boundary are cut from the active layer and placed on a temporary floating selection buffer, allowing the selected region to be translated, scaled, or cloned.

### Layer Management
*   **Layer Stack**: Represents a list of separate canvas buffers. Rendering is resolved from bottom-to-top, drawing each visible canvas onto the viewport.
*   **Compositing**: The viewport combines layers using alpha blending. Adjusting a layer's opacity scales its pixel transparency before compositing.
*   **Depth Shifting**: Re-ordering layer items in the manager shifts their indices in the draw stack, moving details forward or backward.

---

## 3. Timeline & Keyframe Engine

Animation is achieved by recording poses at specific points in time and playing them back sequentially.

### Waypoints and Interpolation
*   **Keyframes**: Snapshots representing the skeleton's state (angles, scales, pivots) at a specific frame index.
*   **Timeline Ticks**: Represent individual frame increments. The playback speed is determined by the frame rate configuration.
*   **Interpolation Models**:
    *   *Step (Constant)*: The skeleton holds its pose until the next keyframe is reached, resulting in snappy transitions.
    *   *Linear*: Transitions values smoothly in a straight line, suitable for uniform mechanical actions.
    *   *Ease In / Ease Out*: Smoothly accelerates and decelerates poses near keyframe boundaries, simulating weight and physical resistance.

### Rig Presets
The engine includes pre-defined configurations for different character categories:
*   **Biped (Human)**:
    *   *Structure*: Head, neck, upper chest, lower chest, hip, shoulders, elbows, wrists, thighs, knees, and ankles.
    *   *Constraints*: Knee joints are limited to backwards rotation, and elbows are constrained to forward rotation.
*   **Quadruped (Dog/Cat)**:
    *   *Structure*: Neck, head, spine, tail (multiple segments), shoulder blades, front elbows, front wrists, front paws, thighs, rear knees, rear ankles, and rear paws.
    *   *Constraints*: Segmented limb configurations allow realistic running animations.
*   **Avian (Chicken)**:
    *   *Structure*: Neck, head, body, left wing (jointed), right wing (jointed), thighs, and feet.
    *   *Constraints*: Bends thigh joints forward and knee joints backward (digitigrade legs).
*   **Theropod (T-Rex)**:
    *   *Structure*: Large head, neck, spine, hips, knees, ankles, feet, tiny upper arms, and a long multi-joint tail.
    *   *Constraints*: Tail segments are programmed to drag behind body translations to simulate weight.

---

## 4. UI Iconography & Keyboard Accessibility

The user interface is designed for high-resolution displays and rapid hotkey navigation.

### SVG Iconography
*   **Vector Fidelity**: The studio rejects text emojis for tool selectors, using custom-designed Scalable Vector Graphics (SVG) instead. This guarantees crisp, anti-aliased renderings at any scale.
*   **State Highlights**: Buttons display bright borders and glowing background highlights when hovered or focused.

### Keyboard Shortcuts
*   **Canvas Panning**: Spacebar + Left Mouse Drag.
*   **Viewport Zoom**: Control + Mouse Wheel.
*   **Horizontal Scrolling**: Alt + Mouse Wheel.
*   **Undo Operations**: Control + Z.
*   **Redo Operations**: Control + Y.
*   **Cut**: Control + X.
*   **Copy**: Control + C.
*   **Paste**: Control + V.
*   **Select All**: Control + A.
*   **Save/Export**: Control + S.
