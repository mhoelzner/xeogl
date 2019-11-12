import { Component } from '../component.js';
import { componentClasses } from './../componentClasses.js';

const type = 'xeogl.MeasureControl';

class MeasureControl extends Component {
    get type() {
        return type;
    }

    init(cfg) {
        super.init(cfg);

        this._scene = cfg.scene;
        this._color = cfg.color || [1, 0, 0];
        this._cameraControl = undefined;
        this._visible = true;
        this._active = true;

        this._distance = 0;

        this._measurementPoints = [false, false, false];

        const measurementGroup = (this._measurementGroup = new xeogl.Group(
            this,
            {
                id: 'measurementGroup',
                position: [0, 0, 0],
                scale: [1, 1, 1],
                aabbVisible: false
            }
        ));

        var geometries = {
            startPoint: new xeogl.Geometry(this, {
                primitive: 'points',
                positions: [0, 0, 0],
                indices: [0]
            }),

            endPoint: new xeogl.Geometry(this, {
                primitive: 'points',
                positions: [0, 0, 0],
                indices: [0]
            }),

            line: new xeogl.Geometry(this, {
                primitive: 'lines',
                positions: [0, 0, 0, 0, 0, 0],
                indices: [0, 1]
            })
        };

        var materials = {
            lineMaterial: new xeogl.PhongMaterial(this, {
                emissive: this._color,
                ambient: [0.0, 0.0, 0.0],
                specular: [0.6, 0.6, 0.3],
                shininess: 80,
                lineWidth: 4
            }),

            startPointMaterial: new xeogl.PhongMaterial(this, {
                emissive: this._color,
                ambient: [0.0, 0.0, 0.0],
                specular: [0.6, 0.6, 0.3],
                shininess: 80,
                pointSize: 10
            }),

            endPointMaterial: new xeogl.PhongMaterial(this, {
                emissive: this._color,
                ambient: [0.0, 0.0, 0.0],
                specular: [0.6, 0.6, 0.3],
                shininess: 80,
                pointSize: 10
            })
        };

        this._display = {
            startPoint: measurementGroup.addChild(
                new xeogl.Mesh(this, {
                    geometry: geometries.startPoint,
                    material: materials.startPointMaterial,
                    pickable: false,
                    collidable: true,
                    clippable: true
                })
            ),
            endPoint: measurementGroup.addChild(
                new xeogl.Mesh(this, {
                    geometry: geometries.endPoint,
                    material: materials.endPointMaterial,
                    pickable: false,
                    collidable: true,
                    clippable: true
                })
            ),
            measurementLine: measurementGroup.addChild(
                new xeogl.Mesh(this, {
                    geometry: geometries.line,
                    material: materials.lineMaterial,
                    pickable: false,
                    collidable: true,
                    clippable: true
                })
            )
        };

        const self = this;
        const math = xeogl.math;
        this.cameraControl = cfg.cameraControl;

        const canvas = this._scene.canvas.canvas;
        const scene = this._scene;

        const MEASURE_ACTIONS = {
            none: -1,
            startPoint: 0,
            line: 1,
            endPoint: 2
        };

        var nextMeasureAction = MEASURE_ACTIONS.startPoint;
        var measureAction = MEASURE_ACTIONS.none;

        const pick = coords => {
            var hit = scene.pick({
                canvasPos: coords,
                pickSurface: true // <<------ This causes picking to find the intersection point on the mesh
            });

            if (hit) {
                if (hit.hasOwnProperty('worldPos')) {
                    const newWorldPos = Array.from(hit.worldPos);

                    switch (measureAction) {
                        case MEASURE_ACTIONS.startPoint:
                            self._measurementPoints[0] = newWorldPos;
                            nextMeasureAction = MEASURE_ACTIONS.line;
                            break;

                        case MEASURE_ACTIONS.line:
                            self._measurementPoints[1] = newWorldPos;
                            nextMeasureAction = MEASURE_ACTIONS.endPoint;
                            break;

                        case MEASURE_ACTIONS.endPoint:
                            self._measurementPoints[2] = newWorldPos;
                            nextMeasureAction = MEASURE_ACTIONS.none;

                        default:
                            break;
                    }

                    return true;
                }
            } else {
                switch (measureAction) {
                    case MEASURE_ACTIONS.startPoint:
                        nextMeasureAction = MEASURE_ACTIONS.startPoint;
                        break;

                    case MEASURE_ACTIONS.line:
                        nextMeasureAction = MEASURE_ACTIONS.line;
                        break;

                    case MEASURE_ACTIONS.endPoint:
                        nextMeasureAction = MEASURE_ACTIONS.endPoint;
                        break;

                    default:
                        break;
                }

                return false;
            }
        };

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

        canvas.addEventListener('mousemove', function(e) {
            if (!self._active) {
                return;
            }

            if (measureAction !== MEASURE_ACTIONS.line) {
                return;
            }

            var coords = getClickCoordsWithinElement(e);

            pick(coords);

            updateControls();
        });

        canvas.addEventListener('mousedown', function(e) {
            e.preventDefault();
            if (!self._active) {
                return;
            }
            switch (e.which) {
                case 1: // Left button
                    measureAction = nextMeasureAction;
                    var coords = getClickCoordsWithinElement(e);
                    const success = pick(coords);
                    if (success) {
                        updateControls();

                        measureAction = nextMeasureAction;
                    }
                    break;

                default:
                    break;
            }
        });

        canvas.addEventListener('mouseup', function(e) {
            if (!self._active) {
                return;
            }
            // reset parent cameraControl to true
            self._cameraControl.active = true;
        });

        const updateControls = () => {
            if (measureAction === MEASURE_ACTIONS.none) {
                return;
            }

            self._cameraControl.active = false;

            switch (measureAction) {
                case MEASURE_ACTIONS.startPoint:
                    self._display.startPoint.geometry.positions =
                        self._measurementPoints[0];
                    break;

                case MEASURE_ACTIONS.line:
                    self._display.measurementLine.geometry.positions = [
                        self._measurementPoints[0][0],
                        self._measurementPoints[0][1],
                        self._measurementPoints[0][2],
                        self._measurementPoints[1][0],
                        self._measurementPoints[1][1],
                        self._measurementPoints[1][2]
                    ];

                    self._distance = calcDist(
                        self._measurementPoints[0],
                        self._measurementPoints[1]
                    );

                    this.fire('distanceChanged', self._distance);

                    break;

                case MEASURE_ACTIONS.endPoint:
                    self._display.endPoint.geometry.positions =
                        self._measurementPoints[2];

                    self._distance = calcDist(
                        self._measurementPoints[0],
                        self._measurementPoints[2]
                    );

                    displayVectorGeometry();

                    self._cameraControl.active = true;

                    self.active = false;

                    const distances = {
                        dLength: self._distance,
                        xLength: Math.abs(self._measurementPoints[0][0] - self._measurementPoints[2][0]),
                        yLength: Math.abs(self._measurementPoints[0][1] - self._measurementPoints[2][1]),
                        zLength: Math.abs(self._measurementPoints[0][2] - self._measurementPoints[2][2])
                    }

                    this.fire('measurementDone', distances);
                default:
                    break;
            }
        };

        const calcDist = (p1, p2) => {
            const tempVec3a = math.vec3([0, 0, 0]);
            return Math.abs(math.lenVec3(math.subVec3(p1, p2, tempVec3a)));
        };

        const calcCenterOfLine = (v1, v2, middle = 0.5) => {
            const tempVec3a = math.vec3([0, 0, 0]);
            const tempVec3b = math.vec3([0, 0, 0]);
            const tempVec3c = math.vec3([0, 0, 0]);
            const tempVec3d = math.vec3([0, 0, 0]);

            const dist = calcDist(v1, v2);

            const subVec = math.subVec3(v2, v1, tempVec3a);
            const norm = math.normalizeVec3(subVec, tempVec3b);
            return math.addVec3(
                math.mulVec3Scalar(norm, dist * middle, tempVec3c),
                v1,
                tempVec3d
            );
        };

        const displayVectorGeometry = () => {
            const distPretty = parseFloat(
                Math.round(this._distance * 100) / 100
            ).toFixed(2);
            this._display.measurementText = measurementGroup.addChild(
                new xeogl.Mesh(this, {
                    geometry: new xeogl.VectorTextGeometry(this, {
                        text: '~' + distPretty + 'm',
                        size: 1.5
                    }),
                    material: materials.lineMaterial,
                    pickable: false,
                    collidable: false,
                    visible: true,
                    position: calcCenterOfLine(
                        self._measurementPoints[0],
                        self._measurementPoints[1],
                        0.45
                    ),
                    billboard: 'spherical'
                })
            );
        };
    }

    set cameraControl(value) {
        this._cameraControl = value;
    }

    get cameraControl() {
        return this._cameraControl;
    }

    /**
     Indicates whether this PlaneHelper is visible or not.

     @property active
     @default true
     @type Boolean
     */
    set active(value) {
        value = !!value;
        if (this._active === value) {
            return;
        }
        this._active = value;
    }

    get active() {
        return this._active;
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
     Distance between two set points

     @property distance
     @default 0.0
     @type Float
     */
    get distance() {
        return this._distance;
    }

    /**
     Distance between two set points

     @property aabb
     @final
     @type {Float32Array}
    */
    get aabb() {
        return this._measurementGroup.aabb;
    }

    destroy() {
        this.active = false;

        this.cameraControl.active = true;

        super.destroy();

        if (this._onSceneAABB) {
            this.scene.off(this._onSceneAABB);
        }
    }
}

componentClasses[type] = MeasureControl;

export { MeasureControl };
