import { Component } from '../component.js';
import { componentClasses } from './../componentClasses.js';

const type = 'xeogl.ClipControl';

class ClipControl extends Component {

    get type() {
        return type;
    }

    init(cfg) {
        super.init(cfg);

        this._scene = this.scene;

        this._visible = false;
        this._pos = xeogl.math.vec3();
        this._baseDir = xeogl.math.vec3();
        this._cameraControl = undefined;
        this._scale = 1;

        // gruppe die alle elemente fuer den ClipController
        const gumballGroup = (this._gumballGroup = new xeogl.Group(this, {
            id: 'gumballGroup',
            position: [0, 0, 0]
        }));

        const radius = cfg.radius === undefined ? 5 : cfg.radius;
        const hoopRadius = radius * 0.6;
    
        // Option for xeogl.Group.addChild(), to prevent child xeogl.Objects from inheriting
        // state from their parent xeogl.Group, such as 'pickable', 'visible', 'collidable' etc.
        // Although, the children's transforms are relative to the xeogl.Group.
        const DONT_INHERIT_GROUP_STATE = false;

        var geometries = {
            arrowHead: new xeogl.CylinderGeometry(this, {
                radiusTop: 0.001,
                radiusBottom: radius / 10,
                height: radius / 5,
                radialSegments: 16,
                heightSegments: 1,
                openEnded: false
            }),
            curve: new xeogl.TorusGeometry(this, {
                radius: hoopRadius,
                tube: radius / 70,
                radialSegments: 64,
                tubeSegments: 14,
                arc: (Math.PI * 2.0) / 4.0
            }),
            hoop: new xeogl.TorusGeometry(this, {
                radius: hoopRadius,
                tube: radius / 70,
                radialSegments: 64,
                tubeSegments: 8,
                arc: Math.PI * 2.0
            }),
            curvePickable: new xeogl.TorusGeometry(this, {
                radius: hoopRadius,
                tube: radius / 20,
                radialSegments: 64,
                tubeSegments: 14,
                arc: (Math.PI * 2.0) / 4.0
            }),
            axis: new xeogl.CylinderGeometry(this, {
                radiusTop: radius / 50,
                radiusBottom: radius / 50,
                height: radius,
                radialSegments: 20,
                heightSegments: 1,
                openEnded: false
            })
        };

        var materials = {
            pickable: new xeogl.PhongMaterial(this, {
                diffuse: [1, 1, 0],
                alpha: 0, // Invisible
                alphaMode: 'blend'
            }),
            gray: new xeogl.PhongMaterial(this, {
                diffuse: [0.6, 0.6, 0.6],
                ambient: [0.0, 0.0, 0.0],
                specular: [0.6, 0.6, 0.3],
                shininess: 80,
                lineWidth: 2
            }),
            transparentBlue: new xeogl.PhongMaterial(this, {
                diffuse: [0.3, 0.3, 1.0],
                ambient: [0.0, 0.0, 0.0],
                specular: [0.6, 0.6, 0.3],
                shininess: 80,
                lineWidth: 2,
                alpha: 0.8,
                alphaMode: 'blend'
            }),
            highlightBlue: new xeogl.EmphasisMaterial(this, {
                edges: false,
                fill: true,
                fillColor: [0, 0, 1],
                fillAlpha: 0.5,
                vertices: false
            }),
            ball: new xeogl.PhongMaterial(this, {
                diffuse: [0, 0, 1],
                ambient: [0.0, 0.0, 0.0],
                specular: [0.6, 0.6, 0.3],
                shininess: 80,
                lineWidth: 2
            }),
            highlightBall: new xeogl.EmphasisMaterial(this, {
                edges: false,
                fill: true,
                fillColor: [0.5, 0.5, 0.5],
                fillAlpha: 0.5,
                vertices: false
            }),
            highlightPlane: new xeogl.EmphasisMaterial(this, {
                edges: true,
                edgeWidth: 3,
                fill: false,
                fillColor: [0.5, 0.5, 0.5],
                fillAlpha: 0.5,
                vertices: false
            })
        };

        this._display = {
            planeWire: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    id: 'gumballPlaneWire',
                    geometry: new xeogl.Geometry(this, {
                        primitive: 'lines',
                        positions: [
                            radius / 0.75, radius / 0.75, 0.0, radius / 0.75, -radius / 0.75, 0.0, // 0
                            -radius / 0.75, -radius / 0.75, 0.0, -radius / 0.75, radius / 0.75, 0.0, // 1
                            radius / 0.75, radius / 0.75, -0.0, radius / 0.75, -radius / 0.75, -0.0, // 2
                            -radius / 0.75, -radius / 0.75, -0.0, -radius / 0.75, radius / 0.75, -0.0 // 3
                        ],
                        indices: [0, 1, 0, 3, 1, 2, 2, 3]
                    }),
                    highlight: true,
                    highlightMaterial: materials.highlightPlane,
                    material: new xeogl.PhongMaterial(this, {
                        emissive: [0.4, 0.4, 0.4],
                        diffuse: [0, 0, 0],
                        lineWidth: 2
                    }),
                    pickable: false,
                    collidable: true,
                    clippable: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            planeSolid: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    id: 'gumballPlaneSolid',
                    geometry: new xeogl.Geometry(this, {
                        primitive: 'triangles',
                        positions: [
                            radius / 0.75, radius / 0.75, 0.0, radius / 0.75, -radius / 0.75, 0.0, // 0
                            -radius / 0.75, -radius / 0.75, 0.0, -radius / 0.75, radius / 0.75, 0.0, // 1
                            radius / 0.75, radius / 0.75, -0.0,radius / 0.75, -radius / 0.75, -0.0, // 2
                            -radius / 0.75, -radius / 0.75, -0.0, -radius / 0.75, radius / 0.75, -0.0 // 3
                        ],
                        indices: [0, 1, 2, 2, 3, 0]
                    }),
                    highlight: true,
                    highlightMaterial: materials.highlightPlane,
                    material: new xeogl.PhongMaterial(this, {
                        emissive: [0, 0, 0],
                        diffuse: [0, 0, 0],
                        specular: [1, 1, 1],
                        shininess: 120,
                        alpha: 0.3,
                        alphaMode: 'blend',
                        backfaces: true
                    }),
                    pickable: false,
                    collidable: false,
                    clippable: false,
                    backfaces: true
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            xRedCurve: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    // Red hoop about Y-axis
                    geometry: geometries.curve,
                    material: materials.gray,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    matrix: (function () {
                        var rotate2 = xeogl.math.rotationMat4v(90 * xeogl.math.DEGTORAD, [0, 1, 0], xeogl.math.identityMat4());
                        var rotate1 = xeogl.math.rotationMat4v(0 * xeogl.math.DEGTORAD, [1, 0, 0], xeogl.math.identityMat4());
                        return xeogl.math.mulMat4(rotate1, rotate2, xeogl.math.identityMat4());
                    })(),
                    pickable: false,
                    collidable: true,
                    clippable: false,
                    backfaces: true
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            xRedCurvePickable: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    id: 'xRedCurvePickable',
                    geometry: geometries.curvePickable,
                    material: materials.pickable,
                    matrix: (function () {
                        var rotate2 = xeogl.math.rotationMat4v(90 * xeogl.math.DEGTORAD, [0, 1, 0], xeogl.math.identityMat4());
                        var rotate1 = xeogl.math.rotationMat4v(0 * xeogl.math.DEGTORAD, [1, 0, 0], xeogl.math.identityMat4());
                        return xeogl.math.mulMat4(rotate1, rotate2, xeogl.math.identityMat4());
                    })(),
                    pickable: true,
                    collidable: true,
                    clippable: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            yGreenCurve: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    geometry: geometries.curve,
                    material: materials.gray,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    rotation: [-90, 0, 0],
                    pickable: false,
                    collidable: true,
                    clippable: false,
                    backfaces: true
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            yGreenCurvePickable: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    id: 'yGreenCurvePickable',
                    geometry: geometries.curvePickable,
                    material: materials.pickable,
                    rotation: [-90, 0, 0],
                    pickable: true,
                    collidable: true,
                    clippable: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            zBlueCurve: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    // Blue hoop about Z-axis
                    geometry: geometries.curve,
                    material: materials.gray,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    matrix: (function () {
                        var rotate2 = xeogl.math.rotationMat4v(180 * xeogl.math.DEGTORAD, [1, 0, 0], xeogl.math.identityMat4());
                        var rotate1 = xeogl.math.rotationMat4v(180 * xeogl.math.DEGTORAD, [1, 0, 0], xeogl.math.identityMat4());
                        return xeogl.math.mulMat4(rotate2, rotate1, xeogl.math.identityMat4());
                    })(),
                    pickable: false,
                    collidable: true,
                    clippable: false,
                    backfaces: true
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            zBlueCurvePickable: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    id: 'zBlueCurvePickable',
                    geometry: geometries.curvePickable,
                    material: materials.pickable,
                    matrix: (function () {
                        var rotate2 = xeogl.math.rotationMat4v(180 * xeogl.math.DEGTORAD, [1, 0, 0], xeogl.math.identityMat4());
                        var rotate1 = xeogl.math.rotationMat4v(180 * xeogl.math.DEGTORAD, [1, 0, 0], xeogl.math.identityMat4());
                        return xeogl.math.mulMat4(rotate2, rotate1, xeogl.math.identityMat4());
                    })(),
                    pickable: true,
                    collidable: true,
                    clippable: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            ball: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    geometry: new xeogl.SphereGeometry(this, {
                        radius: radius / 20
                    }),
                    highlight: true,
                    highlightMaterial: materials.highlightBall,
                    material: materials.ball,
                    pickable: false,
                    collidable: true,
                    clippable: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            xRedArrow: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    id: 'xRedArrow',
                    geometry: geometries.arrowHead,
                    material: materials.gray,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    matrix: (function () {
                        var translate = xeogl.math.translateMat4c(0, radius + .1, 0, xeogl.math.identityMat4());
                        var rotate = xeogl.math.rotationMat4v(-90 * xeogl.math.DEGTORAD, [0, 0, 1], xeogl.math.identityMat4());
                        return xeogl.math.mulMat4(rotate, translate, xeogl.math.identityMat4());
                    })(),
                    pickable: true,
                    collidable: true,
                    clippable: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            xRedShaft: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    geometry: geometries.axis,
                    material: materials.gray,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    matrix: (function () {
                        var translate = xeogl.math.translateMat4c(0, radius / 2, 0, xeogl.math.identityMat4());
                        var rotate = xeogl.math.rotationMat4v(-90 * xeogl.math.DEGTORAD, [0, 0, 1], xeogl.math.identityMat4());
                        return xeogl.math.mulMat4(rotate, translate, xeogl.math.identityMat4());
                    })(),
                    pickable: false,
                    collidable: true,
                    clippable: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            yGreenArrow: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    id: 'yGreenArrow',
                    geometry: geometries.arrowHead,
                    material: materials.gray,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    matrix: (function () {
                        var translate = xeogl.math.translateMat4c(0, radius + .1, 0, xeogl.math.identityMat4());
                        var rotate = xeogl.math.rotationMat4v(0 * xeogl.math.DEGTORAD, [1, 0, 0], xeogl.math.identityMat4());
                        return xeogl.math.mulMat4(rotate, translate, xeogl.math.identityMat4());
                    })(),
                    pickable: true,
                    collidable: true,
                    clippable: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            yGreenShaft: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    geometry: geometries.axis,
                    material: materials.gray,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    position: [0, radius / 2, 0],
                    pickable: false,
                    collidable: true,
                    clippable: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            zBlueArrow: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    id: 'zBlueArrow',
                    geometry: geometries.arrowHead,
                    material: materials.gray,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    matrix: (function () {
                        var translate = xeogl.math.translateMat4c(0, radius + .1, 0, xeogl.math.identityMat4());
                        var rotate = xeogl.math.rotationMat4v(-90 * xeogl.math.DEGTORAD, [0.8, 0, 0], xeogl.math.identityMat4());
                        return xeogl.math.mulMat4(rotate, translate, xeogl.math.identityMat4());
                    })(),
                    pickable: true,
                    collidable: true,
                    clippable: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            zBlueShaft: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    geometry: geometries.axis,
                    material: materials.gray,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    matrix: (function () {
                        var translate = xeogl.math.translateMat4c(0, radius / 2, 0, xeogl.math.identityMat4());
                        var rotate = xeogl.math.rotationMat4v(-90 * xeogl.math.DEGTORAD, [1, 0, 0], xeogl.math.identityMat4());
                        return xeogl.math.mulMat4(rotate, translate, xeogl.math.identityMat4());
                    })(),
                    clippable: false,
                    pickable: false,
                    collidable: true
                }),
                DONT_INHERIT_GROUP_STATE
            )
        };

        this._hoops = {
            xHoop: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    // Red hoop about Y-axis
                    geometry: geometries.hoop,
                    material: materials.transparentBlue,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    matrix: (function () {
                        var rotate2 = xeogl.math.rotationMat4v(90 * xeogl.math.DEGTORAD, [0, 1, 0], xeogl.math.identityMat4());
                        var rotate1 = xeogl.math.rotationMat4v(270 * xeogl.math.DEGTORAD, [1, 0, 0], xeogl.math.identityMat4());
                        return xeogl.math.mulMat4(rotate1, rotate2, xeogl.math.identityMat4());
                    })(),
                    pickable: false,
                    collidable: true,
                    clippable: false,
                    visible: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            yHoop: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    // Green hoop about Y-axis
                    geometry: geometries.hoop,
                    material: materials.transparentBlue,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    rotation: [-90, 0, 0],
                    pickable: false,
                    collidable: true,
                    clippable: false,
                    visible: false
                }),
                DONT_INHERIT_GROUP_STATE
            ),

            zHoop: gumballGroup.addChild(
                new xeogl.Mesh(this, {
                    // Blue hoop about Z-axis
                    geometry: geometries.hoop,
                    material: materials.transparentBlue,
                    highlight: true,
                    highlightMaterial: materials.highlightBlue,
                    matrix: (function () {
                        var rotate2 = xeogl.math.rotationMat4v(90 * xeogl.math.DEGTORAD, [1, 0, 0], xeogl.math.identityMat4());
                        var rotate1 = xeogl.math.rotationMat4v(90 * xeogl.math.DEGTORAD, [1, 0, 0], xeogl.math.identityMat4());
                        return xeogl.math.mulMat4(rotate2, rotate1, xeogl.math.identityMat4());
                    })(),
                    pickable: false,
                    collidable: true,
                    clippable: false,
                    visible: false
                }),
                DONT_INHERIT_GROUP_STATE
            )
        };

        const self = this;
        const math = xeogl.math;

        this.clip = cfg.clip;
        this.visible = cfg.visible;
        this.cameraControl = cfg.cameraControl;

        this.scale = cfg.scale;

        const canvas = this._scene.canvas.canvas;
        const camera = this._scene.camera;
        const scene = this._scene;
        
        var down = false;
        var over = false;

        const DRAG_ACTIONS = {
            none: -1,
            xPan: 0,
            yPan: 1,
            zPan: 2,
            xRotate: 3,
            yRotate: 4,
            zRotate: 5
        };

        var nextDragAction = null; // As we hover over an arrow or hoop, self is the action we would do if we then dragged it.
        var dragAction = null; // Action we're doing while we drag an arrow or hoop.

        var lastMouse = math.vec2();

        var xLocalAxis = math.vec3([1, 0, 0]);
        var yLocalAxis = math.vec3([0, 1, 0]);
        var zLocalAxis = math.vec3([0, 0, 1]);

        var lastHighlightedMesh;
        var lastShownMesh;

        const getClickCoordsWithinElement = event => {
            var coords = new Float32Array(2);

            if (!event) {
                event = window.event;
                coords[0] = event.x;
                coords[1] = event.y;
            } else {
                var element = event.target;
                var totalOffsetLeft = 0;
                var totalOffsetTop = 0;

                while (element.offsetParent) {
                    totalOffsetLeft += element.offsetLeft;
                    totalOffsetTop += element.offsetTop;
                    element = element.offsetParent;
                }
                coords[0] = event.pageX - totalOffsetLeft;
                coords[1] = event.pageY - totalOffsetTop;
            }
            return coords;
        };

        const localToWorldVec = (localVec, worldVec) => {
            var mat = math.mat4();

            math.quaternionToMat4(self._gumballGroup.quaternion, mat);
            math.transformVec3(mat, localVec, worldVec);
            math.normalizeVec3(worldVec);
            return worldVec;
        };

        const pan = (localAxis, fromMouse, toMouse) => {
            var p1 = math.vec3();
            var p2 = math.vec3();
            var worldAxis = math.vec4();

            localToWorldVec(localAxis, worldAxis);

            var planeNormal = getTranslationPlane(
                worldAxis,
                fromMouse,
                toMouse
            );

            getMouseVectorOnPlane(fromMouse, planeNormal, p1);
            getMouseVectorOnPlane(toMouse, planeNormal, p2);

            math.subVec3(p2, p1);

            var dot = math.dotVec3(p2, worldAxis);

            self._pos[0] += worldAxis[0] * dot;
            self._pos[1] += worldAxis[1] * dot;
            self._pos[2] += worldAxis[2] * dot;

            self._gumballGroup.position = self._pos;
            if (self._attached.clip) {
                self._attached.clip.pos = self._pos;
            }

            this.fire('positionChanged', self._pos);
        };

        const getTranslationPlane = worldAxis => {
            var planeNormal = math.vec3();

            // find a best fit to find intersections with
            var absX = Math.abs(worldAxis[0]);
            if (absX > Math.abs(worldAxis[1]) && absX > Math.abs(worldAxis[2])) {
                math.cross3Vec3(worldAxis, [0, 1, 0], planeNormal);
            } else {
                math.cross3Vec3(worldAxis, [1, 0, 0], planeNormal);
            }

            math.cross3Vec3(planeNormal, worldAxis, planeNormal);

            math.normalizeVec3(planeNormal);
            return planeNormal;
        };

        const rotate = (localAxis, fromMouse, toMouse) => {
            var p1 = math.vec4();
            var p2 = math.vec4();
            var c = math.vec4();
            var worldAxis = math.vec4();

            localToWorldVec(localAxis, worldAxis);

            var dot;
            var hasData = getMouseVectorOnPlane(fromMouse, worldAxis, p1) && getMouseVectorOnPlane(toMouse, worldAxis, p2);

            if (!hasData) {
                // find intersections with view plane and project down to origin
                var planeNormal = getTranslationPlane(
                    worldAxis,
                    fromMouse,
                    toMouse
                );

                // the "1" makes sure the plane moves closer to the camera a bit, so the angles become workable
                getMouseVectorOnPlane(fromMouse, planeNormal, p1, 1);
                getMouseVectorOnPlane(toMouse, planeNormal, p2, 1);
                dot = math.dotVec3(p1, worldAxis);
                p1[0] -= dot * worldAxis[0];
                p1[1] -= dot * worldAxis[1];
                p1[2] -= dot * worldAxis[2];

                dot = math.dotVec3(p2, worldAxis);
                p2[0] -= dot * worldAxis[0];
                p2[1] -= dot * worldAxis[1];
                p2[2] -= dot * worldAxis[2];
            }

            math.normalizeVec3(p1);
            math.normalizeVec3(p2);

            dot = math.dotVec3(p1, p2);
            // rounding errors can cause the dot to exceed its allowed range
            dot = math.clamp(dot, -1.0, 1.0);
            var incDegrees = Math.acos(dot) * math.RADTODEG;

            // console.log(incDegrees);
            math.cross3Vec3(p1, p2, c);
            // test orientation of cross with actual axis
            if (math.dotVec3(c, worldAxis) < 0.0) {
                incDegrees = -incDegrees;
            }
            self._gumballGroup.rotate(localAxis, incDegrees);
            rotateClip();
        };

        // this returns the vector that points from the gumball origin to where the mouse ray intersects the plane
        const getMouseVectorOnPlane = (mouse, axis, dest, offset) => {
            var dir = math.vec4([0, 0, 0, 1]);
            var matrix = math.mat4();

            offset = offset || 0;
            dir[0] = (mouse[0] / canvas.width) * 2.0 - 1.0;
            dir[1] = -((mouse[1] / canvas.height) * 2.0 - 1.0);
            dir[2] = 0.0;
            dir[3] = 1.0;

            // unproject ndc to view coords
            math.mulMat4(camera.projMatrix, camera.viewMatrix, matrix);
            math.inverseMat4(matrix);
            math.transformVec4(matrix, dir, dir);

            // this is now "a" point on the ray in world space
            math.mulVec4Scalar(dir, 1.0 / dir[3]);

            // the direction
            var rayO = camera.eye;
            math.subVec4(dir, rayO, dir);

            // the plane origin:
            if (self._attached.clip) {
                var origin = self._attached.clip.pos;

                var d = -math.dotVec3(origin, axis) - offset;
                var dot = math.dotVec3(axis, dir);

                if (Math.abs(dot) > 0.005) {
                    var t = -(math.dotVec3(axis, rayO) + d) / dot;
                    math.mulVec3Scalar(dir, t, dest);
                    math.addVec3(dest, rayO);
                    math.subVec3(dest, origin, dest);
                    return true;
                }
            }

            return false;
        };

        const rotateClip = () => {
            var math = xeogl.math;
            var dir = math.vec3();
            var mat = math.mat4();

            if (self._attached.clip) {
                math.quaternionToMat4(self._gumballGroup.quaternion, mat); // << ---
                math.transformVec3(mat, [0, 0, 1], dir);
                self._attached.clip.dir = dir;
            }
        };

        const pick = canvasPos => {
            var hit = scene.pick({
                canvasPos: canvasPos
            });

            if (lastHighlightedMesh) {
                lastHighlightedMesh.highlighted = false;
            }

            if (lastShownMesh) {
                lastShownMesh.visible = false;
            }

            if (hit) {
                var id = hit.mesh.id;

                var highlightMesh;
                var shownMesh;

                switch (id) {
                    case self._display.xRedArrow.id:
                        highlightMesh = self._display.xRedArrow;
                        nextDragAction = DRAG_ACTIONS.xPan;
                        // localToWorldVec(xLocalAxis, panWorldVec);
                        // worldToCanvasVec(panWorldVec, panCanvasVec);
                        break;

                    case self._display.yGreenArrow.id:
                        highlightMesh = self._display.yGreenArrow;
                        nextDragAction = DRAG_ACTIONS.yPan;
                        // localToWorldVec(yLocalAxis, panWorldVec);
                        // worldToCanvasVec(panWorldVec, panCanvasVec);
                        break;

                    case self._display.zBlueArrow.id:
                        highlightMesh = self._display.zBlueArrow;
                        nextDragAction = DRAG_ACTIONS.zPan;
                        // localToWorldVec(zLocalAxis, panWorldVec);
                        // worldToCanvasVec(panWorldVec, panCanvasVec);
                        break;

                    case self._display.xRedCurvePickable.id:
                        highlightMesh = self._display.xRedCurve;
                        shownMesh = self._hoops.xHoop;
                        nextDragAction = DRAG_ACTIONS.xRotate;
                        break;

                    case self._display.yGreenCurvePickable.id:
                        highlightMesh = self._display.yGreenCurve;
                        shownMesh = self._hoops.yHoop;
                        nextDragAction = DRAG_ACTIONS.yRotate;
                        break;

                    case self._display.zBlueCurvePickable.id:
                        highlightMesh = self._display.zBlueCurve;
                        shownMesh = self._hoops.zHoop;
                        nextDragAction = DRAG_ACTIONS.zRotate;
                        break;

                    default:
                        nextDragAction = DRAG_ACTIONS.none;
                        return; // Not clicked an arrow or hoop
                }

                if (highlightMesh) {
                    highlightMesh.highlighted = true;
                }

                if (shownMesh) {
                    shownMesh.visible = true;
                }

                lastHighlightedMesh = highlightMesh;
                lastShownMesh = shownMesh;
            } else {
                lastHighlightedMesh = null;
                lastShownMesh = null;
                nextDragAction = DRAG_ACTIONS.none;
            }
        };

        canvas.addEventListener('mousemove', function(e) {
            if (!self._visible) {
                return;
            }

            if (!over) {
                return;
            }

            var coords = getClickCoordsWithinElement(e);

            if (!down) {
                pick(coords);
                return;
            }

            var x = coords[0];
            var y = coords[1];

            updateControls(coords, lastMouse);

            lastMouse[0] = x;
            lastMouse[1] = y;
        });

        canvas.addEventListener('mousedown', function(e) {
            e.preventDefault();
            if (!self._visible) {
                return;
            }
            if (!over) {
                return;
            }
            switch (e.which) {
                case 1: // Left button
                    down = true;
                    var coords = getClickCoordsWithinElement(e);

                    dragAction = nextDragAction;

                    lastMouse[0] = coords[0];
                    lastMouse[1] = coords[1];

                    break;

                default:
                    break;
            }
        });

        canvas.addEventListener('mouseup', function(e) {
            if (!self._visible) {
                return;
            }
            down = false;
            // reset parent cameraControl to true
            if (self._cameraControl) {
                self._cameraControl.active = true;
            }
        });

        canvas.addEventListener('mouseenter', function() {
            if (!self._visible) {
                return;
            }
            over = true;
        });

        canvas.addEventListener('mouseleave', function() {
            if (!self._visible) {
                return;
            }
            over = false;
        });

        canvas.addEventListener('wheel', function(e) {
            if (!self._visible) {
                return;
            }
            var delta = Math.max(-1, Math.min(1, -e.deltaY * 40));
            if (delta === 0) {
                return;
            }
            e.preventDefault();
        });

        const updateControls = (mouse, oldMouse) => {
            if (dragAction === DRAG_ACTIONS.none) {
                return;
            }
            if (self._cameraControl) {
                self._cameraControl.active = false;
            }
            switch (dragAction) {
                case DRAG_ACTIONS.xPan:
                    // defined by projections on axis
                    pan(xLocalAxis, oldMouse, mouse);
                    break;
                case DRAG_ACTIONS.yPan:
                    pan(yLocalAxis, oldMouse, mouse);
                    break;
                case DRAG_ACTIONS.zPan:
                    pan(zLocalAxis, oldMouse, mouse);
                    break;
                case DRAG_ACTIONS.xRotate:
                    rotate(xLocalAxis, oldMouse, mouse);
                    break;
                case DRAG_ACTIONS.yRotate:
                    rotate(yLocalAxis, oldMouse, mouse);
                    break;
                case DRAG_ACTIONS.zRotate:
                    rotate(zLocalAxis, oldMouse, mouse);
                    break;
            }
        }
    }

    set cameraControl(value) {
        this._cameraControl = value;
    }

    get cameraControl() {
        return this._cameraControl;
    }

    set clip(value) {
        var self = this;
        // anknuepfen des eigentlichen clips and diesen control
        this._attach({
            name: 'clip',
            type: 'xeogl.Clip',
            component: value
        });
        var clip = this._attached.clip;
        if (clip) {
            // Reset this rotation and translation basis
            // to direction and position of clip
            this._setGumballDir(clip.dir);
            this._setGumballPos(clip.pos);
        }
    }

    get clip() {
        return this._attached.clip;
    }
    /**
     Indicates whether this PlaneHelper is visible or not.

     @property visible
     @default true
     @type Boolean
     */
    set visible(value) {
        value = !!value;
        if (this._visible === value) {
            return;
        }
        this._visible = value;
        for (var id in this._display) {
            if (this._display.hasOwnProperty(id)) {
                this._display[id].visible = value;
            }
        }
    }

    get visible() {
        return this._visible;
    }

    /**
     Sets the groups scale factor.

     @property scale
     @default 1
     @type number
     */
    set scale(value) {
        if (this._scale === value) {
            return;
        }
        this._scale = value;
        this._gumballGroup.scale = [this._scale, this._scale, this._scale];
    }

    get scale() {
        return this._scale;
    }

    _setGumballPos(xyz) {
        this._pos.set(xyz);
        this._gumballGroup.position = xyz;
    }

    _setGumballDir(xyz) {
        var zeroVec = new Float32Array([0, 0, 1]);
        var quat = new Float32Array(4);
        this._baseDir.set(xyz);
        xeogl.math.vec3PairToQuaternion(zeroVec, xyz, quat);
        this._gumballGroup.quaternion = quat;
    }

    destroy() {
        super.destroy();
        if (this._onSceneAABB) {
            this.scene.off(this._onSceneAABB);
        }
    }

}

componentClasses[type] = ClipControl;

export { ClipControl };

