/*
 @class MAEModel
 @module xeogl
 @submodule models
 @constructor
 @param [scene] {Scene} Parent {{#crossLink "Scene"}}Scene{{/crossLink}} - creates this MAEModel in the default
 {{#crossLink "Scene"}}Scene{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}},
 generated automatically when omitted.
 @param [cfg.entityType] {String} Optional entity classification when using within a semantic data model. See the {{#crossLink "Object"}}{{/crossLink}} documentation for usage.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this MAEModel.
 @param [cfg.src] {String} Path to an MAE file. You can set this to a new file path at any time, which will cause the
 MAEModel to load components from the new file (after first destroying any components loaded from a previous file path).
 @param [cfg.quantizeGeometry=true] {Boolean} When true, quantizes geometry to reduce memory and GPU bus usage.
 @param [cfg.combineGeometry=true] {Boolean} When true, combines geometry vertex buffers to improve rendering performance.
 @param [cfg.ghosted=false] {Boolean} When true, sets all the MEAModel's Meshes initially ghosted.
 @param [cfg.highlighted=false] {Boolean} When true, sets all the MAEModel's Meshes initially highlighted.
 @param [cfg.outline=false] {Boolean} When true, sets all the MAEModel's Meshes initially outlined.
 @param [cfg.edgeThreshold=2] {Number} When ghosting, this is the threshold angle between normals of adjacent triangles, below which their shared wireframe edge is not drawn.
 @param [cfg.transform] {Number|String|Transform} A Local-to-World-space (modelling) {{#crossLink "Transform"}}{{/crossLink}} to attach to this MAEModel.
 Must be within the same {{#crossLink "Scene"}}{{/crossLink}} as this STLModel. Internally, the given
 {{#crossLink "Transform"}}{{/crossLink}} will be inserted above each top-most {{#crossLink "Transform"}}Transform{{/crossLink}}
 that the STLModel attaches to its {{#crossLink "Mesh"}}Meshes{{/crossLink}}.
 @param [cfg.splitMeshes=true] {Boolean} When true, creates a separate {{#crossLink "Mesh"}}{{/crossLink}} for each group of faces that share the same vertex colors. Only works with binary STL.|
 @param [cfg.position=[0,0,0]] {Float32Array} The STLModel's local 3D position.
 @param [cfg.scale=[1,1,1]] {Float32Array} The STLModel's local scale.
 @param [cfg.rotation=[0,0,0]] {Float32Array} The STLModel's local rotation, as Euler angles given in degrees.
 @param [cfg.matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] {Float32Array} The STLModel's local transform matrix. Overrides the position, scale and rotation parameters.
 @extends Model
 */
{
    xeogl.MAEModel = class xeoglMAEModel extends xeogl.Model {
        init(cfg) {
            super.init(cfg);
            this._src = null;
            this.src = cfg.src;
        }

        /**
         Path to a MAE file.

         Fires a {{#crossLink "MEAModel/src:event"}}{{/crossLink}} event on change.

         @property src
         @type String
         */
        set src(value) {
            if (!value) {
                return;
            }

            if (!xeogl._isString(value)) {
                this.error("Value for 'src' should be a string");
                return;
            }

            if (value === this._src) {
                // Already loaded this MAEModel

                /**
                 Fired whenever this MAEModel has finished loading components from the MAE file
                 specified by {{#crossLink "MAEModel/src:property"}}{{/crossLink}}.
                 @event loaded
                 */
                this.fire('loaded', true, true);

                return;
            }

            this.destroyAll();

            this._src = value;

            xeogl.MEAModel.load(this, this._src);

            /**
             Fired whenever this MAEModel's {{#crossLink "MAEModel/src:property"}}{{/crossLink}} property changes.
             @event src
             @param value The property's new value
             */
            this.fire('src', this._src);
        }

        get src() {
            return this._src;
        }

        /**
         * Loads MAE from file(s) into a {{#crossLink "Model"}}{{/crossLink}}.
         *
         * @method load
         * @static
         * @param {Model} model Model to load into.
         * @param {String} src Path to MAE file.
         * @param {Function} [ok] Completion callback.
         */
        static load(model, src, ok) {
            var spinner = model.scene.canvas.spinner;
            spinner.processes++;

            loadMEA(model, src, function (state) {
                createMeshesMAE(model, state);

                spinner.processes--;

                xeogl.scheduleTask(function () {
                    model.fire('loaded', true);
                });

                if (ok) {
                    ok();
                }
            });
        }

        /**
         * Parses MAE text strings into a {{#crossLink "Model"}}{{/crossLink}}.
         *
         * @method parse
         * @static
         * @param {Model} model Model to load into.
         * @param {String} mae text string.
         */
        static parse(model, maeText) {
            if (!maeText) {
                console.warn('load() param expected: mae');
                return;
            }
            var state = parseMAE(maeText);
            createMeshesMAE(model, state);
            model.src = null;
            xeogl.scheduleTask(function () {
                model.fire('loaded', true);
            });
        }
    };

    //--------------------------------------------------------------------------------------------
    // Loads MAE
    //
    // Parses MEA into an intermediate state object. The object will contain geometry data
    // from which meshes can be created later.
    //
    //--------------------------------------------------------------------------------------------


    String.prototype.hashCode = function (seed = 0) {
        let h1 = 0xdeadbeef ^ seed,
            h2 = 0x41c6ce57 ^ seed;
        for (let i = 0, ch; i < this.length; i++) {
            ch = this.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 =
            Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
            Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 =
            Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
            Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return 4294967296 * (2097151 & h2) + (h1 >>> 0);
    };

    var loadMAE = function (model, url, ok) {
        loadFile(
            url,
            function (text) {
                var state = parseMAE(text);
                ok(state);
            },
            function (error) {
                model.error(error);
            }
        );
    };

    var parseMAE = (function () {
        return function (text) {
            var state = {
                objects: [],
                object: {},
                positions: [],
                magnitudes: []
            };

            var json = JSON.parse(text);

            for (var i = 0, l = json.length; i < l; i++) {
                startObject(state, json[i].Id);

                // alle positionen sammeln fuer spaetere berechnung
                state.positions.push(
                    parseFloat(json[i].Rechtswert),
                    parseFloat(json[i].Hochwert),
                    parseFloat(json[i].Teufe)
                );
                // position fuer eigentliche object
                state.object.geometry.positions.push(
                    parseFloat(json[i].Rechtswert),
                    parseFloat(json[i].Hochwert),
                    parseFloat(json[i].Teufe)
                );
                var magnitudeValue = 11;
                if (json[i].hasOwnProperty('Magnitude')) {
                    magnitudeValue = parseFloat(json[i].Magnitude);
                }
                state.magnitudes.push(magnitudeValue);
                state.object.magnitude = magnitudeValue;
                state.object.meta.maeInfo = json[i];
            }

            return state;
        };

        function startObject(state, id) {
            state.object = {
                id: id || '',
                geometry: {
                    positions: [],
                    normals: [],
                    uv: []
                },
                material: {
                    id: '',
                    smooth: true
                },
                magnitude: '',
                meta: {
                    maeInfo: {},
                    name: `${id}`,
                    seed: 0
                }
            };
            state.objects.push(state.object);
        }
    })();
    //--------------------------------------------------------------------------------------------
    // Creates meshes from parsed state
    //--------------------------------------------------------------------------------------------

    // function to calculate the common subtraction values for every coordinate (x, y)
    function getSubtractionValues(positions, validDigits) {
        const deltas = [0, 0];

        function getDigits(number) {
            return (
                (Math.log10((number ^ (number >> 31)) - (number >> 31)) | 0) + 1
            );
        }

        function arrayMinMax(items) {
            var minMaxArray = items.reduce(function (r, n) {
                r[0] = !r[0] ? n : Math.min(r[0], n);
                r[1] = !r[1] ? n : Math.max(r[1], n);
                return r;
            }, []);

            return minMaxArray;
        }

        function calcCommonDelta(minMaxArray) {
            let numDigits = getDigits(minMaxArray[0]);
            let delta = 0;
            while (numDigits > validDigits) {
                const divide = Math.pow(10, numDigits - 1);
                const min = Math.floor(minMaxArray[0] / divide);
                const max = Math.floor(minMaxArray[1] / divide);
                if (min === max) {
                    delta += min * divide;
                    minMaxArray[0] -= min * divide;
                    minMaxArray[1] -= min * divide;
                    numDigits -= 1;
                } else {
                    break;
                }
            }
            return delta;
        }

        let rArray = positions.filter((c, i) => {
            return i % 3 === 0;
        });
        let hArray = positions.filter((c, i) => {
            return i % 3 === 0 + 1;
        });

        let minMaxR = arrayMinMax(rArray);
        let minMaxH = arrayMinMax(hArray);
        const numDigitsMinR = getDigits(minMaxR[0]);
        const numDigitsMaxR = getDigits(minMaxR[1]);
        const numDigitsMinH = getDigits(minMaxH[0]);
        const numDigitsMaxH = getDigits(minMaxH[1]);

        if (numDigitsMinR === numDigitsMaxR) {
            deltas[0] = calcCommonDelta(minMaxR);
        }

        if (numDigitsMinH === numDigitsMaxH) {
            deltas[1] = calcCommonDelta(minMaxH);
        }
        return deltas;
    }

    var createMeshesMAE = (function () {
        return function (model, state) {
            const VALID_NUM_DIGITS = 5;
            const subtractWith = getSubtractionValues(
                state.positions,
                VALID_NUM_DIGITS
            );

            let seed = 0;

            for (var j = 0, k = state.objects.length; j < k; j++) {
                var object = state.objects[j];
                var geometry = object.geometry;

                const radiusValues = [1, 2, 4, 8, 16, 1];
                const colorValues = [
                    [0, 1, 0], // gruen    < -3
                    [1, 1, 0], //        -3 < x < -2
                    [1, 0.5, 0], //      -2 < x < -1
                    [1, 0.1, 0], // rot >   -1
                    [1, 0, 0], // dunkelrot  > 0
                    [1, 1, 1] // weiß
                ];

                var radius, color;

                // wenn magnitude nicht vergeben worden ist
                if (object.magnitude === 11) {
                    radius = radiusValues[radiusValues.length - 1];
                    color = colorValues[colorValues.length - 1];
                } else {
                    if (object.magnitude <= -3.0) {
                        radius = radiusValues[0];
                        color = colorValues[0];
                    } else if (valueBetween(object.magnitude, -3.0, -2.0)) {
                        radius = radiusValues[1];
                        color = colorValues[1];
                    } else if (valueBetween(object.magnitude, -2.0, -1.0)) {
                        radius = radiusValues[2];
                        color = colorValues[2];
                    } else if (valueBetween(object.magnitude, -1.0, 0.0)) {
                        radius = radiusValues[3];
                        color = colorValues[3];
                    } else {
                        // > 0
                        radius = radiusValues[4];
                        color = colorValues[4];
                    }
                }

                let meshId = String(object.id).hashCode(seed);
                while (xeogl.getDefaultScene().components[meshId]) {
                    seed += 1;
                    meshId = object.id.hashCode(salt);
                }

                object.meta.seed = seed;

                var mesh = new xeogl.Mesh(model, {
                    id: meshId + '_' + seed,
                    geometry: new xeogl.SphereGeometry({
                        radius: radius,
                        center: geometry.positions.map((p, i) => {
                            if (i % 3 === 0) {
                                return p - subtractWith[0];
                            }
                            if (i % 3 === 1) {
                                return p - subtractWith[1];
                            }
                            return p;
                        })
                    }),
                    material: new xeogl.LambertMaterial({
                        color: color
                    }),
                    pickable: true,
                    meta: object.meta
                });

                model.subtractWith = subtractWith;

                model.addChild(mesh);
                model._addComponent(mesh);
            }
        };
    })();

    function valueBetween(value, low, high) {
        return value > low && value <= high;
    }

    function loadFile(url, ok, err) {
        var request = new XMLHttpRequest();
        request.overrideMimeType('text/plain');
        request.open(
            'GET',
            url + (/\?/.test(url) ? '&' : '?') + new Date().getTime(),
            true
        );
        request.addEventListener(
            'load',
            function (event) {
                var response = event.target.response;
                if (this.status === 200) {
                    if (ok) {
                        ok(response);
                    }
                } else if (this.status === 0) {
                    // Some browsers return HTTP Status 0 when using non-http protocol
                    // e.g. 'file://' or 'data://'. Handle as success.
                    console.warn('loadFile: HTTP Status 0 received.');
                    if (ok) {
                        ok(response);
                    }
                } else {
                    if (err) {
                        err(event);
                    }
                }
            },
            false
        );

        request.addEventListener(
            'error',
            function (event) {
                if (err) {
                    err(event);
                }
            },
            false
        );
        request.send(null);
    }
}