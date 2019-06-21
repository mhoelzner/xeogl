/**
 * xeogl V0.9.0
 * 
 * WebGL-based 3D visualization library
 * http://xeogl.org/
 * 
 * Built on 2019-06-26
 * 
 * MIT License
 * Copyright 2019, Lindsay Kay
 * http://xeolabs.com/
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.xeogl = {})));
}(this, (function (exports) { 'use strict';

class Map {

    constructor(items, baseId) {
        this.items = items || [];
        this._lastUniqueId = (baseId || 0) + 1;
    }

    /**
     * Usage:
     *
     * id = myMap.addItem("foo") // ID internally generated
     * id = myMap.addItem("foo", "bar") // ID is "foo"
     */
    addItem() {
        let item;
        if (arguments.length === 2) {
            const id = arguments[0];
            item = arguments[1];
            if (this.items[id]) { // Won't happen if given ID is string
                throw "ID clash: '" + id + "'";
            }
            this.items[id] = item;
            return id;

        } else {
            item = arguments[0] || {};
            while (true) {
                const findId = this._lastUniqueId++;
                if (!this.items[findId]) {
                    this.items[findId] = item;
                    return findId;
                }
            }
        }
    }

    removeItem(id) {
        const item = this.items[id];
        delete this.items[id];
        return item;
    }
}

const stats = {
    build: {
        version: "0.8"
    },
    client: {
        browser: (navigator && navigator.userAgent) ? navigator.userAgent : "n/a"
    },

    // TODO: replace 'canvas' with 'pixels'
    //canvas: {
    //    width: 0,
    //    height: 0
    //},
    components: {
        scenes: 0,
        models: 0,
        meshes: 0,
        objects: 0
    },
    memory: {

        // Note that these counts will include any positions, colors,
        // normals and indices that xeogl internally creates on-demand
        // to support color-index triangle picking.

        meshes: 0,
        positions: 0,
        colors: 0,
        normals: 0,
        uvs: 0,
        indices: 0,
        textures: 0,
        transforms: 0,
        materials: 0,
        programs: 0
    },
    frame: {
        frameCount: 0,
        fps: 0,
        useProgram: 0,
        bindTexture: 0,
        bindArray: 0,
        drawElements: 0,
        drawArrays: 0,
        tasksRun: 0,
        tasksScheduled: 0
    }
};

var utils = {

    /**
     Tests if the given object is an array
     @private
     */
    isArray: function (testMesh) {
        return testMesh && !(testMesh.propertyIsEnumerable('length')) && typeof testMesh === 'object' && typeof testMesh.length === 'number';
    },

    /**
     Tests if the given value is a string
     @param value
     @returns {boolean}
     @private
     */
    isString: function (value) {
        return (typeof value === 'string' || value instanceof String);
    },

    /**
     Tests if the given value is a number
     @param value
     @returns {boolean}
     @private
     */
    isNumeric: function (value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    },

    /**
     Tests if the given value is an ID
     @param value
     @returns {boolean}
     @private
     */
    isID: function (value) {
        return utils.isString(value) || utils.isNumeric(value);
    },

    /**
     Tests if the given components are the same, where the components can be either IDs or instances.
     @param c1
     @param c2
     @returns {boolean}
     @private
     */
    isSameComponent: function (c1, c2) {
        if (!c1 || !c2) {
            return false;
        }
        const id1 = (utils.isNumeric(c1) || utils.isString(c1)) ? `${c1}` : c1.id;
        const id2 = (utils.isNumeric(c2) || utils.isString(c2)) ? `${c2}` : c2.id;
        return id1 === id2;
    },

    /**
     Tests if the given value is a function
     @param value
     @returns {boolean}
     @private
     */
    isFunction: function (value) {
        return (typeof value === "function");
    },

    /**
     Tests if the given value is a JavaScript JSON object, eg, ````{ foo: "bar" }````.
     @param value
     @returns {boolean}
     @private
     */
    isObject: function (value) {
        const objectConstructor = {}.constructor;
        return (!!value && value.constructor === objectConstructor);
    },

    /** Returns a shallow copy
     */
    copy: function (o) {
        return utils.apply(o, {});
    },

    /** Add properties of o to o2, overwriting them on o2 if already there
     */
    apply: function (o, o2) {
        for (const name in o) {
            if (o.hasOwnProperty(name)) {
                o2[name] = o[name];
            }
        }
        return o2;
    },

    /**
     Add non-null/defined properties of o to o2
     @private
     */
    apply2: function (o, o2) {
        for (const name in o) {
            if (o.hasOwnProperty(name)) {
                if (o[name] !== undefined && o[name] !== null) {
                    o2[name] = o[name];
                }
            }
        }
        return o2;
    },

    /**
     Add properties of o to o2 where undefined or null on o2
     @private
     */
    applyIf: function (o, o2) {
        for (const name in o) {
            if (o.hasOwnProperty(name)) {
                if (o2[name] === undefined || o2[name] === null) {
                    o2[name] = o[name];
                }
            }
        }
        return o2;
    },

    /**
     Returns true if the given map is empty.
     @param obj
     @returns {boolean}
     @private
     */
    isEmptyObject: function (obj) {
        for (const name in obj) {
            if (obj.hasOwnProperty(name)) {
                return false;
            }
        }
        return true;
    },

    /**
     Returns the given ID as a string, in quotes if the ID was a string to begin with.

     This is useful for logging IDs.

     @param {Number| String} id The ID
     @returns {String}
     @private
     */
    inQuotes: function (id) {
        return utils.isNumeric(id) ? (`${id}`) : (`'${id}'`);
    },

    /**
     Returns the concatenation of two typed arrays.
     @param a
     @param b
     @returns {*|a}
     @private
     */
    concat: function (a, b) {
        const c = new a.constructor(a.length + b.length);
        c.set(a);
        c.set(b, a.length);
        return c;
    },
};

// Some temporary vars to help avoid garbage collection

const tempMat1 = new Float32Array(16);
const tempMat2 = new Float32Array(16);
const tempVec4 = new Float32Array(4);

let caching = false;
const vec3Cache = [];
let vec3CacheLen = 0;

const math = {

    MAX_DOUBLE: Number.MAX_VALUE,
    MIN_DOUBLE: Number.MIN_VALUE,

    /**
     * The number of radiians in a degree (0.0174532925).
     * @property DEGTORAD
     * @type {Number}
     */
    DEGTORAD: 0.0174532925,

    /**
     * The number of degrees in a radian.
     * @property RADTODEG
     * @type {Number}
     */
    RADTODEG: 57.295779513,

    openCache() {
        caching = true;
        vec3CacheLen = 0;
    },

    cacheVec3(value) {
        return value || (caching ? (vec3Cache[vec3CacheLen++] || (vec3Cache[vec3CacheLen - 1] = new Float32Array(3))) : new Float32Array(3));
    },

    cacheVec4(value) {
        return value || (caching ? (vec3Cache[vec4CacheLen++] || (vec3Cache[vec4CacheLen - 1] = new Float32Array(4))) : new Float32Array(4));
    },

    closeCache() {
        caching = false;
    },

    /**
     * Returns a new, uninitialized two-element vector.
     * @method vec2
     * @param [values] Initial values.
     * @static
     * @returns {Float32Array}
     */
    vec2(values) {
        return new Float32Array(values || 2);
    },

    /**
     * Returns a new, uninitialized three-element vector.
     * @method vec3
     * @param [values] Initial values.
     * @static
     * @returns {Float32Array}
     */
    vec3(values) {
        return new Float32Array(values || 3);
    },

    /**
     * Returns a new, uninitialized four-element vector.
     * @method vec4
     * @param [values] Initial values.
     * @static
     * @returns {Float32Array}
     */
    vec4(values) {
        return new Float32Array(values || 4);
    },

    /**
     * Returns a new, uninitialized 3x3 matrix.
     * @method mat3
     * @param [values] Initial values.
     * @static
     * @returns {Float32Array}
     */
    mat3(values) {
        return new Float32Array(values || 9);
    },

    /**
     * Converts a 3x3 matrix to 4x4
     * @method mat3ToMat4
     * @param mat3 3x3 matrix.
     * @param mat4 4x4 matrix
     * @static
     * @returns {Float32Array}
     */
    mat3ToMat4(mat3, mat4 = new Float32Array(16)) {
        mat4[0] = mat3[0];
        mat4[1] = mat3[1];
        mat4[2] = mat3[2];
        mat4[3] = 0;
        mat4[4] = mat3[3];
        mat4[5] = mat3[4];
        mat4[6] = mat3[5];
        mat4[7] = 0;
        mat4[8] = mat3[6];
        mat4[9] = mat3[7];
        mat4[10] = mat3[8];
        mat4[11] = 0;
        mat4[12] = 0;
        mat4[13] = 0;
        mat4[14] = 0;
        mat4[15] = 1;
        return mat4;
    },

    /**
     * Returns a new, uninitialized 4x4 matrix.
     * @method mat4
     * @param [values] Initial values.
     * @static
     * @returns {Float32Array}
     */
    mat4(values) {
        return new Float32Array(values || 16);
    },

    /**
     * Converts a 4x4 matrix to 3x3
     * @method mat4ToMat3
     * @param mat4 4x4 matrix.
     * @param mat3 3x3 matrix
     * @static
     * @returns {Float32Array}
     */
    mat4ToMat3(mat4, mat3) { // TODO
        //return new Float32Array(values || 9);
    },

    /**
     * Returns a new UUID.
     * @method createUUID
     * @static
     * @return string The new UUID
     */
    //createUUID: function () {
    //    // http://www.broofa.com/Tools/Math.uuid.htm
    //    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
    //    var uuid = new Array(36);
    //    var rnd = 0;
    //    var r;
    //    return function () {
    //        for (var i = 0; i < 36; i++) {
    //            if (i === 8 || i === 13 || i === 18 || i === 23) {
    //                uuid[i] = '-';
    //            } else if (i === 14) {
    //                uuid[i] = '4';
    //            } else {
    //                if (rnd <= 0x02) {
    //                    rnd = 0x2000000 + ( Math.random() * 0x1000000 ) | 0;
    //                }
    //                r = rnd & 0xf;
    //                rnd = rnd >> 4;
    //                uuid[i] = chars[( i === 19 ) ? ( r & 0x3 ) | 0x8 : r];
    //            }
    //        }
    //        return uuid.join('');
    //    };
    //}(),
    //
    createUUID: ((() => {
        const lut = [];
        for (let i = 0; i < 256; i++) {
            lut[i] = (i < 16 ? '0' : '') + (i).toString(16);
        }
        return () => {
            const d0 = Math.random() * 0xffffffff | 0;
            const d1 = Math.random() * 0xffffffff | 0;
            const d2 = Math.random() * 0xffffffff | 0;
            const d3 = Math.random() * 0xffffffff | 0;
            return `${lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff]}-${lut[d1 & 0xff]}${lut[d1 >> 8 & 0xff]}-${lut[d1 >> 16 & 0x0f | 0x40]}${lut[d1 >> 24 & 0xff]}-${lut[d2 & 0x3f | 0x80]}${lut[d2 >> 8 & 0xff]}-${lut[d2 >> 16 & 0xff]}${lut[d2 >> 24 & 0xff]}${lut[d3 & 0xff]}${lut[d3 >> 8 & 0xff]}${lut[d3 >> 16 & 0xff]}${lut[d3 >> 24 & 0xff]}`;
        };
    }))(),

    /**
     * Clamps a value to the given range.
     * @param {Number} value Value to clamp.
     * @param {Number} min Lower bound.
     * @param {Number} max Upper bound.
     * @returns {Number} Clamped result.
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Floating-point modulus
     * @method fmod
     * @static
     * @param {Number} a
     * @param {Number} b
     * @returns {*}
     */
    fmod(a, b) {
        if (a < b) {
            console.error("xeogl.math.fmod : Attempting to find modulus within negative range - would be infinite loop - ignoring");
            return a;
        }
        while (b <= a) {
            a -= b;
        }
        return a;
    },

    /**
     * Negates a four-element vector.
     * @method negateVec4
     * @static
     * @param {Array(Number)} v Vector to negate
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, v otherwise
     */
    negateVec4(v, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = -v[0];
        dest[1] = -v[1];
        dest[2] = -v[2];
        dest[3] = -v[3];
        return dest;
    },

    /**
     * Adds one four-element vector to another.
     * @method addVec4
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Second vector
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, u otherwise
     */
    addVec4(u, v, dest) {
        if (!dest) {
            dest = u;
        }
        dest[0] = u[0] + v[0];
        dest[1] = u[1] + v[1];
        dest[2] = u[2] + v[2];
        dest[3] = u[3] + v[3];
        return dest;
    },

    /**
     * Adds a scalar value to each element of a four-element vector.
     * @method addVec4Scalar
     * @static
     * @param {Array(Number)} v The vector
     * @param {Number} s The scalar
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, v otherwise
     */
    addVec4Scalar(v, s, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = v[0] + s;
        dest[1] = v[1] + s;
        dest[2] = v[2] + s;
        dest[3] = v[3] + s;
        return dest;
    },

    /**
     * Adds one three-element vector to another.
     * @method addVec3
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Second vector
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, u otherwise
     */
    addVec3(u, v, dest) {
        if (!dest) {
            dest = u;
        }
        dest[0] = u[0] + v[0];
        dest[1] = u[1] + v[1];
        dest[2] = u[2] + v[2];
        return dest;
    },

    /**
     * Adds a scalar value to each element of a three-element vector.
     * @method addVec4Scalar
     * @static
     * @param {Array(Number)} v The vector
     * @param {Number} s The scalar
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, v otherwise
     */
    addVec3Scalar(v, s, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = v[0] + s;
        dest[1] = v[1] + s;
        dest[2] = v[2] + s;
        return dest;
    },

    /**
     * Subtracts one four-element vector from another.
     * @method subVec4
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Vector to subtract
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, u otherwise
     */
    subVec4(u, v, dest) {
        if (!dest) {
            dest = u;
        }
        dest[0] = u[0] - v[0];
        dest[1] = u[1] - v[1];
        dest[2] = u[2] - v[2];
        dest[3] = u[3] - v[3];
        return dest;
    },

    /**
     * Subtracts one three-element vector from another.
     * @method subVec3
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Vector to subtract
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, u otherwise
     */
    subVec3(u, v, dest) {
        if (!dest) {
            dest = u;
        }
        dest[0] = u[0] - v[0];
        dest[1] = u[1] - v[1];
        dest[2] = u[2] - v[2];
        return dest;
    },

    /**
     * Subtracts one two-element vector from another.
     * @method subVec2
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Vector to subtract
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, u otherwise
     */
    subVec2(u, v, dest) {
        if (!dest) {
            dest = u;
        }
        dest[0] = u[0] - v[0];
        dest[1] = u[1] - v[1];
        return dest;
    },

    /**
     * Subtracts a scalar value from each element of a four-element vector.
     * @method subVec4Scalar
     * @static
     * @param {Array(Number)} v The vector
     * @param {Number} s The scalar
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, v otherwise
     */
    subVec4Scalar(v, s, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = v[0] - s;
        dest[1] = v[1] - s;
        dest[2] = v[2] - s;
        dest[3] = v[3] - s;
        return dest;
    },

    /**
     * Sets each element of a 4-element vector to a scalar value minus the value of that element.
     * @method subScalarVec4
     * @static
     * @param {Array(Number)} v The vector
     * @param {Number} s The scalar
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, v otherwise
     */
    subScalarVec4(v, s, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = s - v[0];
        dest[1] = s - v[1];
        dest[2] = s - v[2];
        dest[3] = s - v[3];
        return dest;
    },

    /**
     * Multiplies one three-element vector by another.
     * @method mulVec3
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Second vector
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, u otherwise
     */
    mulVec4(u, v, dest) {
        if (!dest) {
            dest = u;
        }
        dest[0] = u[0] * v[0];
        dest[1] = u[1] * v[1];
        dest[2] = u[2] * v[2];
        dest[3] = u[3] * v[3];
        return dest;
    },

    /**
     * Multiplies each element of a four-element vector by a scalar.
     * @method mulVec34calar
     * @static
     * @param {Array(Number)} v The vector
     * @param {Number} s The scalar
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, v otherwise
     */
    mulVec4Scalar(v, s, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = v[0] * s;
        dest[1] = v[1] * s;
        dest[2] = v[2] * s;
        dest[3] = v[3] * s;
        return dest;
    },

    /**
     * Multiplies each element of a three-element vector by a scalar.
     * @method mulVec3Scalar
     * @static
     * @param {Array(Number)} v The vector
     * @param {Number} s The scalar
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, v otherwise
     */
    mulVec3Scalar(v, s, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = v[0] * s;
        dest[1] = v[1] * s;
        dest[2] = v[2] * s;
        return dest;
    },

    /**
     * Multiplies each element of a two-element vector by a scalar.
     * @method mulVec2Scalar
     * @static
     * @param {Array(Number)} v The vector
     * @param {Number} s The scalar
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, v otherwise
     */
    mulVec2Scalar(v, s, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = v[0] * s;
        dest[1] = v[1] * s;
        return dest;
    },

    /**
     * Divides one three-element vector by another.
     * @method divVec3
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Second vector
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, u otherwise
     */
    divVec3(u, v, dest) {
        if (!dest) {
            dest = u;
        }
        dest[0] = u[0] / v[0];
        dest[1] = u[1] / v[1];
        dest[2] = u[2] / v[2];
        return dest;
    },

    /**
     * Divides one four-element vector by another.
     * @method divVec4
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Second vector
     * @param  {Array(Number)} [dest] Destination vector
     * @return {Array(Number)} dest if specified, u otherwise
     */
    divVec4(u, v, dest) {
        if (!dest) {
            dest = u;
        }
        dest[0] = u[0] / v[0];
        dest[1] = u[1] / v[1];
        dest[2] = u[2] / v[2];
        dest[3] = u[3] / v[3];
        return dest;
    },

    /**
     * Divides a scalar by a three-element vector, returning a new vector.
     * @method divScalarVec3
     * @static
     * @param v vec3
     * @param s scalar
     * @param dest vec3 - optional destination
     * @return [] dest if specified, v otherwise
     */
    divScalarVec3(s, v, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = s / v[0];
        dest[1] = s / v[1];
        dest[2] = s / v[2];
        return dest;
    },

    /**
     * Divides a three-element vector by a scalar.
     * @method divVec3Scalar
     * @static
     * @param v vec3
     * @param s scalar
     * @param dest vec3 - optional destination
     * @return [] dest if specified, v otherwise
     */
    divVec3Scalar(v, s, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = v[0] / s;
        dest[1] = v[1] / s;
        dest[2] = v[2] / s;
        return dest;
    },

    /**
     * Divides a four-element vector by a scalar.
     * @method divVec4Scalar
     * @static
     * @param v vec4
     * @param s scalar
     * @param dest vec4 - optional destination
     * @return [] dest if specified, v otherwise
     */
    divVec4Scalar(v, s, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = v[0] / s;
        dest[1] = v[1] / s;
        dest[2] = v[2] / s;
        dest[3] = v[3] / s;
        return dest;
    },


    /**
     * Divides a scalar by a four-element vector, returning a new vector.
     * @method divScalarVec4
     * @static
     * @param s scalar
     * @param v vec4
     * @param dest vec4 - optional destination
     * @return [] dest if specified, v otherwise
     */
    divScalarVec4(s, v, dest) {
        if (!dest) {
            dest = v;
        }
        dest[0] = s / v[0];
        dest[1] = s / v[1];
        dest[2] = s / v[2];
        dest[3] = s / v[3];
        return dest;
    },

    /**
     * Returns the dot product of two four-element vectors.
     * @method dotVec4
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Second vector
     * @return The dot product
     */
    dotVec4(u, v) {
        return (u[0] * v[0] + u[1] * v[1] + u[2] * v[2] + u[3] * v[3]);
    },

    /**
     * Returns the cross product of two four-element vectors.
     * @method cross3Vec4
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Second vector
     * @return The cross product
     */
    cross3Vec4(u, v) {
        const u0 = u[0];
        const u1 = u[1];
        const u2 = u[2];
        const v0 = v[0];
        const v1 = v[1];
        const v2 = v[2];
        return [
            u1 * v2 - u2 * v1,
            u2 * v0 - u0 * v2,
            u0 * v1 - u1 * v0,
            0.0];
    },

    /**
     * Returns the cross product of two three-element vectors.
     * @method cross3Vec3
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Second vector
     * @return The cross product
     */
    cross3Vec3(u, v, dest) {
        if (!dest) {
            dest = u;
        }
        const x = u[0];
        const y = u[1];
        const z = u[2];
        const x2 = v[0];
        const y2 = v[1];
        const z2 = v[2];
        dest[0] = y * z2 - z * y2;
        dest[1] = z * x2 - x * z2;
        dest[2] = x * y2 - y * x2;
        return dest;
    },


    sqLenVec4(v) { // TODO
        return math.dotVec4(v, v);
    },

    /**
     * Returns the length of a four-element vector.
     * @method lenVec4
     * @static
     * @param {Array(Number)} v The vector
     * @return The length
     */
    lenVec4(v) {
        return Math.sqrt(math.sqLenVec4(v));
    },

    /**
     * Returns the dot product of two three-element vectors.
     * @method dotVec3
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Second vector
     * @return The dot product
     */
    dotVec3(u, v) {
        return (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]);
    },

    /**
     * Returns the dot product of two two-element vectors.
     * @method dotVec4
     * @static
     * @param {Array(Number)} u First vector
     * @param {Array(Number)} v Second vector
     * @return The dot product
     */
    dotVec2(u, v) {
        return (u[0] * v[0] + u[1] * v[1]);
    },


    sqLenVec3(v) {
        return math.dotVec3(v, v);
    },


    sqLenVec2(v) {
        return math.dotVec2(v, v);
    },

    /**
     * Returns the length of a three-element vector.
     * @method lenVec3
     * @static
     * @param {Array(Number)} v The vector
     * @return The length
     */
    lenVec3(v) {
        return Math.sqrt(math.sqLenVec3(v));
    },

    distVec3: ((() => {
        const vec = new Float32Array(3);
        return (v, w) => math.lenVec3(math.subVec3(v, w, vec));
    }))(),

    /**
     * Returns the length of a two-element vector.
     * @method lenVec2
     * @static
     * @param {Array(Number)} v The vector
     * @return The length
     */
    lenVec2(v) {
        return Math.sqrt(math.sqLenVec2(v));
    },

    distVec2: ((() => {
        const vec = new Float32Array(2);
        return (v, w) => math.lenVec2(math.subVec2(v, w, vec));
    }))(),

    /**
     * @method rcpVec3
     * @static
     * @param v vec3
     * @param dest vec3 - optional destination
     * @return [] dest if specified, v otherwise
     *
     */
    rcpVec3(v, dest) {
        return math.divScalarVec3(1.0, v, dest);
    },

    /**
     * Normalizes a four-element vector
     * @method normalizeVec4
     * @static
     * @param v vec4
     * @param dest vec4 - optional destination
     * @return [] dest if specified, v otherwise
     *
     */
    normalizeVec4(v, dest) {
        const f = 1.0 / math.lenVec4(v);
        return math.mulVec4Scalar(v, f, dest);
    },

    /**
     * Normalizes a three-element vector
     * @method normalizeVec4
     * @static
     */
    normalizeVec3(v, dest) {
        const f = 1.0 / math.lenVec3(v);
        return math.mulVec3Scalar(v, f, dest);
    },

    /**
     * Normalizes a two-element vector
     * @method normalizeVec2
     * @static
     */
    normalizeVec2(v, dest) {
        const f = 1.0 / math.lenVec2(v);
        return math.mulVec2Scalar(v, f, dest);
    },

    /**
     * Gets the angle between two vectors
     * @method angleVec3
     * @param v
     * @param w
     * @returns {number}
     */
    angleVec3(v, w) {
        let theta = math.dotVec3(v, w) / ( Math.sqrt(math.sqLenVec3(v) * math.sqLenVec3(w)) );
        theta = theta < -1 ? -1 : (theta > 1 ? 1 : theta);  // Clamp to handle numerical problems
        return Math.acos(theta);
    },

    /**
     * Creates a three-element vector from the rotation part of a sixteen-element matrix.
     * @param m
     * @param dest
     */
    vec3FromMat4Scale: ((() => {

        const tempVec3 = new Float32Array(3);

        return (m, dest) => {

            tempVec3[0] = m[0];
            tempVec3[1] = m[1];
            tempVec3[2] = m[2];

            dest[0] = math.lenVec3(tempVec3);

            tempVec3[0] = m[4];
            tempVec3[1] = m[5];
            tempVec3[2] = m[6];

            dest[1] = math.lenVec3(tempVec3);

            tempVec3[0] = m[8];
            tempVec3[1] = m[9];
            tempVec3[2] = m[10];

            dest[2] = math.lenVec3(tempVec3);

            return dest;
        };
    }))(),

    /**
     * Converts an n-element vector to a JSON-serializable
     * array with values rounded to two decimal places.
     */
    vecToArray: ((() => {
        function trunc(v) {
            return Math.round(v * 100000) / 100000
        }

        return v => {
            v = Array.prototype.slice.call(v);
            for (let i = 0, len = v.length; i < len; i++) {
                v[i] = trunc(v[i]);
            }
            return v;
        };
    }))(),

    /**
     * Duplicates a 4x4 identity matrix.
     * @method dupMat4
     * @static
     */
    dupMat4(m) {
        return m.slice(0, 16);
    },

    /**
     * Extracts a 3x3 matrix from a 4x4 matrix.
     * @method mat4To3
     * @static
     */
    mat4To3(m) {
        return [
            m[0], m[1], m[2],
            m[4], m[5], m[6],
            m[8], m[9], m[10]
        ];
    },

    /**
     * Returns a 4x4 matrix with each element set to the given scalar value.
     * @method m4s
     * @static
     */
    m4s(s) {
        return [
            s, s, s, s,
            s, s, s, s,
            s, s, s, s,
            s, s, s, s
        ];
    },

    /**
     * Returns a 4x4 matrix with each element set to zero.
     * @method setMat4ToZeroes
     * @static
     */
    setMat4ToZeroes() {
        return math.m4s(0.0);
    },

    /**
     * Returns a 4x4 matrix with each element set to 1.0.
     * @method setMat4ToOnes
     * @static
     */
    setMat4ToOnes() {
        return math.m4s(1.0);
    },

    /**
     * Returns a 4x4 matrix with each element set to 1.0.
     * @method setMat4ToOnes
     * @static
     */
    diagonalMat4v(v) {
        return new Float32Array([
            v[0], 0.0, 0.0, 0.0,
            0.0, v[1], 0.0, 0.0,
            0.0, 0.0, v[2], 0.0,
            0.0, 0.0, 0.0, v[3]
        ]);
    },

    /**
     * Returns a 4x4 matrix with diagonal elements set to the given vector.
     * @method diagonalMat4c
     * @static
     */
    diagonalMat4c(x, y, z, w) {
        return math.diagonalMat4v([x, y, z, w]);
    },

    /**
     * Returns a 4x4 matrix with diagonal elements set to the given scalar.
     * @method diagonalMat4s
     * @static
     */
    diagonalMat4s(s) {
        return math.diagonalMat4c(s, s, s, s);
    },

    /**
     * Returns a 4x4 identity matrix.
     * @method identityMat4
     * @static
     */
    identityMat4(mat = new Float32Array(16)) {
        mat[0] = 1.0;
        mat[1] = 0.0;
        mat[2] = 0.0;
        mat[3] = 0.0;

        mat[4] = 0.0;
        mat[5] = 1.0;
        mat[6] = 0.0;
        mat[7] = 0.0;

        mat[8] = 0.0;
        mat[9] = 0.0;
        mat[10] = 1.0;
        mat[11] = 0.0;

        mat[12] = 0.0;
        mat[13] = 0.0;
        mat[14] = 0.0;
        mat[15] = 1.0;

        return mat;
    },

    /**
     * Returns a 3x3 identity matrix.
     * @method identityMat3
     * @static
     */
    identityMat3(mat = new Float32Array(9)) {
        mat[0] = 1.0;
        mat[1] = 0.0;
        mat[2] = 0.0;

        mat[3] = 0.0;
        mat[4] = 1.0;
        mat[5] = 0.0;

        mat[6] = 0.0;
        mat[7] = 0.0;
        mat[8] = 1.0;

        return mat;
    },

    /**
     * Tests if the given 4x4 matrix is the identity matrix.
     * @method isIdentityMat4
     * @static
     */
    isIdentityMat4(m) {
        if (m[0] !== 1.0 || m[1] !== 0.0 || m[2] !== 0.0 || m[3] !== 0.0 ||
            m[4] !== 0.0 || m[5] !== 1.0 || m[6] !== 0.0 || m[7] !== 0.0 ||
            m[8] !== 0.0 || m[9] !== 0.0 || m[10] !== 1.0 || m[11] !== 0.0 ||
            m[12] !== 0.0 || m[13] !== 0.0 || m[14] !== 0.0 || m[15] !== 1.0) {
            return false;
        }
        return true;
    },

    /**
     * Negates the given 4x4 matrix.
     * @method negateMat4
     * @static
     */
    negateMat4(m, dest) {
        if (!dest) {
            dest = m;
        }
        dest[0] = -m[0];
        dest[1] = -m[1];
        dest[2] = -m[2];
        dest[3] = -m[3];
        dest[4] = -m[4];
        dest[5] = -m[5];
        dest[6] = -m[6];
        dest[7] = -m[7];
        dest[8] = -m[8];
        dest[9] = -m[9];
        dest[10] = -m[10];
        dest[11] = -m[11];
        dest[12] = -m[12];
        dest[13] = -m[13];
        dest[14] = -m[14];
        dest[15] = -m[15];
        return dest;
    },

    /**
     * Adds the given 4x4 matrices together.
     * @method addMat4
     * @static
     */
    addMat4(a, b, dest) {
        if (!dest) {
            dest = a;
        }
        dest[0] = a[0] + b[0];
        dest[1] = a[1] + b[1];
        dest[2] = a[2] + b[2];
        dest[3] = a[3] + b[3];
        dest[4] = a[4] + b[4];
        dest[5] = a[5] + b[5];
        dest[6] = a[6] + b[6];
        dest[7] = a[7] + b[7];
        dest[8] = a[8] + b[8];
        dest[9] = a[9] + b[9];
        dest[10] = a[10] + b[10];
        dest[11] = a[11] + b[11];
        dest[12] = a[12] + b[12];
        dest[13] = a[13] + b[13];
        dest[14] = a[14] + b[14];
        dest[15] = a[15] + b[15];
        return dest;
    },

    /**
     * Adds the given scalar to each element of the given 4x4 matrix.
     * @method addMat4Scalar
     * @static
     */
    addMat4Scalar(m, s, dest) {
        if (!dest) {
            dest = m;
        }
        dest[0] = m[0] + s;
        dest[1] = m[1] + s;
        dest[2] = m[2] + s;
        dest[3] = m[3] + s;
        dest[4] = m[4] + s;
        dest[5] = m[5] + s;
        dest[6] = m[6] + s;
        dest[7] = m[7] + s;
        dest[8] = m[8] + s;
        dest[9] = m[9] + s;
        dest[10] = m[10] + s;
        dest[11] = m[11] + s;
        dest[12] = m[12] + s;
        dest[13] = m[13] + s;
        dest[14] = m[14] + s;
        dest[15] = m[15] + s;
        return dest;
    },

    /**
     * Adds the given scalar to each element of the given 4x4 matrix.
     * @method addScalarMat4
     * @static
     */
    addScalarMat4(s, m, dest) {
        return math.addMat4Scalar(m, s, dest);
    },

    /**
     * Subtracts the second 4x4 matrix from the first.
     * @method subMat4
     * @static
     */
    subMat4(a, b, dest) {
        if (!dest) {
            dest = a;
        }
        dest[0] = a[0] - b[0];
        dest[1] = a[1] - b[1];
        dest[2] = a[2] - b[2];
        dest[3] = a[3] - b[3];
        dest[4] = a[4] - b[4];
        dest[5] = a[5] - b[5];
        dest[6] = a[6] - b[6];
        dest[7] = a[7] - b[7];
        dest[8] = a[8] - b[8];
        dest[9] = a[9] - b[9];
        dest[10] = a[10] - b[10];
        dest[11] = a[11] - b[11];
        dest[12] = a[12] - b[12];
        dest[13] = a[13] - b[13];
        dest[14] = a[14] - b[14];
        dest[15] = a[15] - b[15];
        return dest;
    },

    /**
     * Subtracts the given scalar from each element of the given 4x4 matrix.
     * @method subMat4Scalar
     * @static
     */
    subMat4Scalar(m, s, dest) {
        if (!dest) {
            dest = m;
        }
        dest[0] = m[0] - s;
        dest[1] = m[1] - s;
        dest[2] = m[2] - s;
        dest[3] = m[3] - s;
        dest[4] = m[4] - s;
        dest[5] = m[5] - s;
        dest[6] = m[6] - s;
        dest[7] = m[7] - s;
        dest[8] = m[8] - s;
        dest[9] = m[9] - s;
        dest[10] = m[10] - s;
        dest[11] = m[11] - s;
        dest[12] = m[12] - s;
        dest[13] = m[13] - s;
        dest[14] = m[14] - s;
        dest[15] = m[15] - s;
        return dest;
    },

    /**
     * Subtracts the given scalar from each element of the given 4x4 matrix.
     * @method subScalarMat4
     * @static
     */
    subScalarMat4(s, m, dest) {
        if (!dest) {
            dest = m;
        }
        dest[0] = s - m[0];
        dest[1] = s - m[1];
        dest[2] = s - m[2];
        dest[3] = s - m[3];
        dest[4] = s - m[4];
        dest[5] = s - m[5];
        dest[6] = s - m[6];
        dest[7] = s - m[7];
        dest[8] = s - m[8];
        dest[9] = s - m[9];
        dest[10] = s - m[10];
        dest[11] = s - m[11];
        dest[12] = s - m[12];
        dest[13] = s - m[13];
        dest[14] = s - m[14];
        dest[15] = s - m[15];
        return dest;
    },

    /**
     * Multiplies the two given 4x4 matrix by each other.
     * @method mulMat4
     * @static
     */
    mulMat4(a, b, dest) {
        if (!dest) {
            dest = a;
        }

        // Cache the matrix values (makes for huge speed increases!)
        const a00 = a[0];

        const a01 = a[1];
        const a02 = a[2];
        const a03 = a[3];
        const a10 = a[4];
        const a11 = a[5];
        const a12 = a[6];
        const a13 = a[7];
        const a20 = a[8];
        const a21 = a[9];
        const a22 = a[10];
        const a23 = a[11];
        const a30 = a[12];
        const a31 = a[13];
        const a32 = a[14];
        const a33 = a[15];
        const b00 = b[0];
        const b01 = b[1];
        const b02 = b[2];
        const b03 = b[3];
        const b10 = b[4];
        const b11 = b[5];
        const b12 = b[6];
        const b13 = b[7];
        const b20 = b[8];
        const b21 = b[9];
        const b22 = b[10];
        const b23 = b[11];
        const b30 = b[12];
        const b31 = b[13];
        const b32 = b[14];
        const b33 = b[15];

        dest[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
        dest[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
        dest[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
        dest[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
        dest[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
        dest[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
        dest[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
        dest[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
        dest[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
        dest[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
        dest[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
        dest[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
        dest[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
        dest[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
        dest[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
        dest[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;

        return dest;
    },

    /**
     * Multiplies the two given 3x3 matrices by each other.
     * @method mulMat4
     * @static
     */
    mulMat3(a, b, dest) {
        if (!dest) {
            dest = new Float32Array(9);
        }

        const a11 = a[0];
        const a12 = a[3];
        const a13 = a[6];
        const a21 = a[1];
        const a22 = a[4];
        const a23 = a[7];
        const a31 = a[2];
        const a32 = a[5];
        const a33 = a[8];
        const b11 = b[0];
        const b12 = b[3];
        const b13 = b[6];
        const b21 = b[1];
        const b22 = b[4];
        const b23 = b[7];
        const b31 = b[2];
        const b32 = b[5];
        const b33 = b[8];

        dest[0] = a11 * b11 + a12 * b21 + a13 * b31;
        dest[3] = a11 * b12 + a12 * b22 + a13 * b32;
        dest[6] = a11 * b13 + a12 * b23 + a13 * b33;

        dest[1] = a21 * b11 + a22 * b21 + a23 * b31;
        dest[4] = a21 * b12 + a22 * b22 + a23 * b32;
        dest[7] = a21 * b13 + a22 * b23 + a23 * b33;

        dest[2] = a31 * b11 + a32 * b21 + a33 * b31;
        dest[5] = a31 * b12 + a32 * b22 + a33 * b32;
        dest[8] = a31 * b13 + a32 * b23 + a33 * b33;

        return dest;
    },

    /**
     * Multiplies each element of the given 4x4 matrix by the given scalar.
     * @method mulMat4Scalar
     * @static
     */
    mulMat4Scalar(m, s, dest) {
        if (!dest) {
            dest = m;
        }
        dest[0] = m[0] * s;
        dest[1] = m[1] * s;
        dest[2] = m[2] * s;
        dest[3] = m[3] * s;
        dest[4] = m[4] * s;
        dest[5] = m[5] * s;
        dest[6] = m[6] * s;
        dest[7] = m[7] * s;
        dest[8] = m[8] * s;
        dest[9] = m[9] * s;
        dest[10] = m[10] * s;
        dest[11] = m[11] * s;
        dest[12] = m[12] * s;
        dest[13] = m[13] * s;
        dest[14] = m[14] * s;
        dest[15] = m[15] * s;
        return dest;
    },

    /**
     * Multiplies the given 4x4 matrix by the given four-element vector.
     * @method mulMat4v4
     * @static
     */
    mulMat4v4(m, v, dest = math.vec4()) {
        const v0 = v[0];
        const v1 = v[1];
        const v2 = v[2];
        const v3 = v[3];
        dest[0] = m[0] * v0 + m[4] * v1 + m[8] * v2 + m[12] * v3;
        dest[1] = m[1] * v0 + m[5] * v1 + m[9] * v2 + m[13] * v3;
        dest[2] = m[2] * v0 + m[6] * v1 + m[10] * v2 + m[14] * v3;
        dest[3] = m[3] * v0 + m[7] * v1 + m[11] * v2 + m[15] * v3;
        return dest;
    },

    /**
     * Transposes the given 4x4 matrix.
     * @method transposeMat4
     * @static
     */
    transposeMat4(mat, dest) {
        // If we are transposing ourselves we can skip a few steps but have to cache some values
        const m4 = mat[4];

        const m14 = mat[14];
        const m8 = mat[8];
        const m13 = mat[13];
        const m12 = mat[12];
        const m9 = mat[9];
        if (!dest || mat === dest) {
            const a01 = mat[1];
            const a02 = mat[2];
            const a03 = mat[3];
            const a12 = mat[6];
            const a13 = mat[7];
            const a23 = mat[11];
            mat[1] = m4;
            mat[2] = m8;
            mat[3] = m12;
            mat[4] = a01;
            mat[6] = m9;
            mat[7] = m13;
            mat[8] = a02;
            mat[9] = a12;
            mat[11] = m14;
            mat[12] = a03;
            mat[13] = a13;
            mat[14] = a23;
            return mat;
        }
        dest[0] = mat[0];
        dest[1] = m4;
        dest[2] = m8;
        dest[3] = m12;
        dest[4] = mat[1];
        dest[5] = mat[5];
        dest[6] = m9;
        dest[7] = m13;
        dest[8] = mat[2];
        dest[9] = mat[6];
        dest[10] = mat[10];
        dest[11] = m14;
        dest[12] = mat[3];
        dest[13] = mat[7];
        dest[14] = mat[11];
        dest[15] = mat[15];
        return dest;
    },

    /**
     * Transposes the given 3x3 matrix.
     *
     * @method transposeMat3
     * @static
     */
    transposeMat3(mat, dest) {
        if (dest === mat) {
            const a01 = mat[1];
            const a02 = mat[2];
            const a12 = mat[5];
            dest[1] = mat[3];
            dest[2] = mat[6];
            dest[3] = a01;
            dest[5] = mat[7];
            dest[6] = a02;
            dest[7] = a12;
        } else {
            dest[0] = mat[0];
            dest[1] = mat[3];
            dest[2] = mat[6];
            dest[3] = mat[1];
            dest[4] = mat[4];
            dest[5] = mat[7];
            dest[6] = mat[2];
            dest[7] = mat[5];
            dest[8] = mat[8];
        }
        return dest;
    },

    /**
     * Returns the determinant of the given 4x4 matrix.
     * @method determinantMat4
     * @static
     */
    determinantMat4(mat) {
        // Cache the matrix values (makes for huge speed increases!)
        const a00 = mat[0];

        const a01 = mat[1];
        const a02 = mat[2];
        const a03 = mat[3];
        const a10 = mat[4];
        const a11 = mat[5];
        const a12 = mat[6];
        const a13 = mat[7];
        const a20 = mat[8];
        const a21 = mat[9];
        const a22 = mat[10];
        const a23 = mat[11];
        const a30 = mat[12];
        const a31 = mat[13];
        const a32 = mat[14];
        const a33 = mat[15];
        return a30 * a21 * a12 * a03 - a20 * a31 * a12 * a03 - a30 * a11 * a22 * a03 + a10 * a31 * a22 * a03 +
            a20 * a11 * a32 * a03 - a10 * a21 * a32 * a03 - a30 * a21 * a02 * a13 + a20 * a31 * a02 * a13 +
            a30 * a01 * a22 * a13 - a00 * a31 * a22 * a13 - a20 * a01 * a32 * a13 + a00 * a21 * a32 * a13 +
            a30 * a11 * a02 * a23 - a10 * a31 * a02 * a23 - a30 * a01 * a12 * a23 + a00 * a31 * a12 * a23 +
            a10 * a01 * a32 * a23 - a00 * a11 * a32 * a23 - a20 * a11 * a02 * a33 + a10 * a21 * a02 * a33 +
            a20 * a01 * a12 * a33 - a00 * a21 * a12 * a33 - a10 * a01 * a22 * a33 + a00 * a11 * a22 * a33;
    },

    /**
     * Returns the inverse of the given 4x4 matrix.
     * @method inverseMat4
     * @static
     */
    inverseMat4(mat, dest) {
        if (!dest) {
            dest = mat;
        }

        // Cache the matrix values (makes for huge speed increases!)
        const a00 = mat[0];

        const a01 = mat[1];
        const a02 = mat[2];
        const a03 = mat[3];
        const a10 = mat[4];
        const a11 = mat[5];
        const a12 = mat[6];
        const a13 = mat[7];
        const a20 = mat[8];
        const a21 = mat[9];
        const a22 = mat[10];
        const a23 = mat[11];
        const a30 = mat[12];
        const a31 = mat[13];
        const a32 = mat[14];
        const a33 = mat[15];
        const b00 = a00 * a11 - a01 * a10;
        const b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10;
        const b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11;
        const b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30;
        const b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30;
        const b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31;
        const b11 = a22 * a33 - a23 * a32;

        // Calculate the determinant (inlined to avoid double-caching)
        const invDet = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);

        dest[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
        dest[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
        dest[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
        dest[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
        dest[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
        dest[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
        dest[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
        dest[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
        dest[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
        dest[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
        dest[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
        dest[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
        dest[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
        dest[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
        dest[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
        dest[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;

        return dest;
    },

    /**
     * Returns the trace of the given 4x4 matrix.
     * @method traceMat4
     * @static
     */
    traceMat4(m) {
        return (m[0] + m[5] + m[10] + m[15]);
    },

    /**
     * Returns 4x4 translation matrix.
     * @method translationMat4
     * @static
     */
    translationMat4v(v, dest) {
        const m = dest || math.identityMat4();
        m[12] = v[0];
        m[13] = v[1];
        m[14] = v[2];
        return m;
    },

    /**
     * Returns 3x3 translation matrix.
     * @method translationMat3
     * @static
     */
    translationMat3v(v, dest) {
        const m = dest || math.identityMat3();
        m[6] = v[0];
        m[7] = v[1];
        return m;
    },

    /**
     * Returns 4x4 translation matrix.
     * @method translationMat4c
     * @static
     */
    translationMat4c: ((() => {
        const xyz = new Float32Array(3);
        return (x, y, z, dest) => {
            xyz[0] = x;
            xyz[1] = y;
            xyz[2] = z;
            return math.translationMat4v(xyz, dest);
        };
    }))(),

    /**
     * Returns 4x4 translation matrix.
     * @method translationMat4s
     * @static
     */
    translationMat4s(s, dest) {
        return math.translationMat4c(s, s, s, dest);
    },

    /**
     * Efficiently post-concatenates a translation to the given matrix.
     * @param v
     * @param m
     */
    translateMat4v(xyz, m) {
        return math.translateMat4c(xyz[0], xyz[1], xyz[2], m);
    },

    /**
     * Efficiently post-concatenates a translation to the given matrix.
     * @param x
     * @param y
     * @param z
     * @param m
     */
    OLDtranslateMat4c(x, y, z, m) {

        const m12 = m[12];
        m[0] += m12 * x;
        m[4] += m12 * y;
        m[8] += m12 * z;

        const m13 = m[13];
        m[1] += m13 * x;
        m[5] += m13 * y;
        m[9] += m13 * z;

        const m14 = m[14];
        m[2] += m14 * x;
        m[6] += m14 * y;
        m[10] += m14 * z;

        const m15 = m[15];
        m[3] += m15 * x;
        m[7] += m15 * y;
        m[11] += m15 * z;

        return m;
    },

    translateMat4c(x, y, z, m) {

        const m3 = m[3];
        m[0] += m3 * x;
        m[1] += m3 * y;
        m[2] += m3 * z;

        const m7 = m[7];
        m[4] += m7 * x;
        m[5] += m7 * y;
        m[6] += m7 * z;

        const m11 = m[11];
        m[8] += m11 * x;
        m[9] += m11 * y;
        m[10] += m11 * z;

        const m15 = m[15];
        m[12] += m15 * x;
        m[13] += m15 * y;
        m[14] += m15 * z;

        return m;
    },
    /**
     * Returns 4x4 rotation matrix.
     * @method rotationMat4v
     * @static
     */
    rotationMat4v(anglerad, axis, m) {
        const ax = math.normalizeVec4([axis[0], axis[1], axis[2], 0.0], []);
        const s = Math.sin(anglerad);
        const c = Math.cos(anglerad);
        const q = 1.0 - c;

        const x = ax[0];
        const y = ax[1];
        const z = ax[2];

        let xy;
        let yz;
        let zx;
        let xs;
        let ys;
        let zs;

        //xx = x * x; used once
        //yy = y * y; used once
        //zz = z * z; used once
        xy = x * y;
        yz = y * z;
        zx = z * x;
        xs = x * s;
        ys = y * s;
        zs = z * s;

        m = m || math.mat4();

        m[0] = (q * x * x) + c;
        m[1] = (q * xy) + zs;
        m[2] = (q * zx) - ys;
        m[3] = 0.0;

        m[4] = (q * xy) - zs;
        m[5] = (q * y * y) + c;
        m[6] = (q * yz) + xs;
        m[7] = 0.0;

        m[8] = (q * zx) + ys;
        m[9] = (q * yz) - xs;
        m[10] = (q * z * z) + c;
        m[11] = 0.0;

        m[12] = 0.0;
        m[13] = 0.0;
        m[14] = 0.0;
        m[15] = 1.0;

        return m;
    },

    /**
     * Returns 4x4 rotation matrix.
     * @method rotationMat4c
     * @static
     */
    rotationMat4c(anglerad, x, y, z, mat) {
        return math.rotationMat4v(anglerad, [x, y, z], mat);
    },

    /**
     * Returns 4x4 scale matrix.
     * @method scalingMat4v
     * @static
     */
    scalingMat4v(v, m = math.identityMat4()) {
        m[0] = v[0];
        m[5] = v[1];
        m[10] = v[2];
        return m;
    },

    /**
     * Returns 3x3 scale matrix.
     * @method scalingMat3v
     * @static
     */
    scalingMat3v(v, m = math.identityMat3()) {
        m[0] = v[0];
        m[4] = v[1];
        return m;
    },

    /**
     * Returns 4x4 scale matrix.
     * @method scalingMat4c
     * @static
     */
    scalingMat4c: ((() => {
        const xyz = new Float32Array(3);
        return (x, y, z, dest) => {
            xyz[0] = x;
            xyz[1] = y;
            xyz[2] = z;
            return math.scalingMat4v(xyz, dest);
        };
    }))(),

    /**
     * Efficiently post-concatenates a scaling to the given matrix.
     * @method scaleMat4c
     * @param x
     * @param y
     * @param z
     * @param m
     */
    scaleMat4c(x, y, z, m) {

        m[0] *= x;
        m[4] *= y;
        m[8] *= z;

        m[1] *= x;
        m[5] *= y;
        m[9] *= z;

        m[2] *= x;
        m[6] *= y;
        m[10] *= z;

        m[3] *= x;
        m[7] *= y;
        m[11] *= z;
        return m;
    },

    /**
     * Efficiently post-concatenates a scaling to the given matrix.
     * @method scaleMat4c
     * @param xyz
     * @param m
     */
    scaleMat4v(xyz, m) {

        const x = xyz[0];
        const y = xyz[1];
        const z = xyz[2];

        m[0] *= x;
        m[4] *= y;
        m[8] *= z;
        m[1] *= x;
        m[5] *= y;
        m[9] *= z;
        m[2] *= x;
        m[6] *= y;
        m[10] *= z;
        m[3] *= x;
        m[7] *= y;
        m[11] *= z;

        return m;
    },

    /**
     * Returns 4x4 scale matrix.
     * @method scalingMat4s
     * @static
     */
    scalingMat4s(s) {
        return math.scalingMat4c(s, s, s);
    },

    /**
     * Creates a matrix from a quaternion rotation and vector translation
     *
     * @param {Float32Array} q Rotation quaternion
     * @param {Float32Array} v Translation vector
     * @param {Float32Array} dest Destination matrix
     * @returns {Float32Array} dest
     */
    rotationTranslationMat4(q, v, dest = math.mat4()) {
        const x = q[0];
        const y = q[1];
        const z = q[2];
        const w = q[3];

        const x2 = x + x;
        const y2 = y + y;
        const z2 = z + z;
        const xx = x * x2;
        const xy = x * y2;
        const xz = x * z2;
        const yy = y * y2;
        const yz = y * z2;
        const zz = z * z2;
        const wx = w * x2;
        const wy = w * y2;
        const wz = w * z2;

        dest[0] = 1 - (yy + zz);
        dest[1] = xy + wz;
        dest[2] = xz - wy;
        dest[3] = 0;
        dest[4] = xy - wz;
        dest[5] = 1 - (xx + zz);
        dest[6] = yz + wx;
        dest[7] = 0;
        dest[8] = xz + wy;
        dest[9] = yz - wx;
        dest[10] = 1 - (xx + yy);
        dest[11] = 0;
        dest[12] = v[0];
        dest[13] = v[1];
        dest[14] = v[2];
        dest[15] = 1;

        return dest;
    },

    /**
     * Gets Euler angles from a 4x4 matrix.
     *
     * @param {Float32Array} mat The 4x4 matrix.
     * @param {String} order Desired Euler angle order: "XYZ", "YXZ", "ZXY" etc.
     * @param {Float32Array} [dest] Destination Euler angles, created by default.
     * @returns {Float32Array} The Euler angles.
     */
    mat4ToEuler(mat, order, dest = math.vec4()) {
        const clamp = math.clamp;

        // Assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

        const m11 = mat[0];

        const m12 = mat[4];
        const m13 = mat[8];
        const m21 = mat[1];
        const m22 = mat[5];
        const m23 = mat[9];
        const m31 = mat[2];
        const m32 = mat[6];
        const m33 = mat[10];

        if (order === 'XYZ') {

            dest[1] = Math.asin(clamp(m13, -1, 1));

            if (Math.abs(m13) < 0.99999) {
                dest[0] = Math.atan2(-m23, m33);
                dest[2] = Math.atan2(-m12, m11);
            } else {
                dest[0] = Math.atan2(m32, m22);
                dest[2] = 0;

            }

        } else if (order === 'YXZ') {

            dest[0] = Math.asin(-clamp(m23, -1, 1));

            if (Math.abs(m23) < 0.99999) {
                dest[1] = Math.atan2(m13, m33);
                dest[2] = Math.atan2(m21, m22);
            } else {
                dest[1] = Math.atan2(-m31, m11);
                dest[2] = 0;
            }

        } else if (order === 'ZXY') {

            dest[0] = Math.asin(clamp(m32, -1, 1));

            if (Math.abs(m32) < 0.99999) {
                dest[1] = Math.atan2(-m31, m33);
                dest[2] = Math.atan2(-m12, m22);
            } else {
                dest[1] = 0;
                dest[2] = Math.atan2(m21, m11);
            }

        } else if (order === 'ZYX') {

            dest[1] = Math.asin(-clamp(m31, -1, 1));

            if (Math.abs(m31) < 0.99999) {
                dest[0] = Math.atan2(m32, m33);
                dest[2] = Math.atan2(m21, m11);
            } else {
                dest[0] = 0;
                dest[2] = Math.atan2(-m12, m22);
            }

        } else if (order === 'YZX') {

            dest[2] = Math.asin(clamp(m21, -1, 1));

            if (Math.abs(m21) < 0.99999) {
                dest[0] = Math.atan2(-m23, m22);
                dest[1] = Math.atan2(-m31, m11);
            } else {
                dest[0] = 0;
                dest[1] = Math.atan2(m13, m33);
            }

        } else if (order === 'XZY') {

            dest[2] = Math.asin(-clamp(m12, -1, 1));

            if (Math.abs(m12) < 0.99999) {
                dest[0] = Math.atan2(m32, m22);
                dest[1] = Math.atan2(m13, m11);
            } else {
                dest[0] = Math.atan2(-m23, m33);
                dest[1] = 0;
            }
        }

        return dest;
    },

    composeMat4(position, quaternion, scale, mat = math.mat4()) {
        math.quaternionToRotationMat4(quaternion, mat);
        math.scaleMat4v(scale, mat);
        math.translateMat4v(position, mat);

        return mat;
    },

    decomposeMat4: (() => {

        const vec = new Float32Array(3);
        const matrix = new Float32Array(16);

        return function decompose(mat, position, quaternion, scale) {

            vec[0] = mat[0];
            vec[1] = mat[1];
            vec[2] = mat[2];

            let sx = math.lenVec3(vec);

            vec[0] = mat[4];
            vec[1] = mat[5];
            vec[2] = mat[6];

            const sy = math.lenVec3(vec);

            vec[8] = mat[8];
            vec[9] = mat[9];
            vec[10] = mat[10];

            const sz = math.lenVec3(vec);

            // if determine is negative, we need to invert one scale
            const det = math.determinantMat4(mat);

            if (det < 0) {
                sx = -sx;
            }

            position[0] = mat[12];
            position[1] = mat[13];
            position[2] = mat[14];

            // scale the rotation part
            matrix.set(mat);

            const invSX = 1 / sx;
            const invSY = 1 / sy;
            const invSZ = 1 / sz;

            matrix[0] *= invSX;
            matrix[1] *= invSX;
            matrix[2] *= invSX;

            matrix[4] *= invSY;
            matrix[5] *= invSY;
            matrix[6] *= invSY;

            matrix[8] *= invSZ;
            matrix[9] *= invSZ;
            matrix[10] *= invSZ;

            math.mat4ToQuaternion(matrix, quaternion);

            scale[0] = sx;
            scale[1] = sy;
            scale[2] = sz;

            return this;

        };

    })(),

    /**
     * Returns a 4x4 'lookat' viewing transform matrix.
     * @method lookAtMat4v
     * @param pos vec3 position of the viewer
     * @param target vec3 point the viewer is looking at
     * @param up vec3 pointing "up"
     * @param dest mat4 Optional, mat4 matrix will be written into
     *
     * @return {mat4} dest if specified, a new mat4 otherwise
     */
    lookAtMat4v(pos, target, up, dest) {
        if (!dest) {
            dest = math.mat4();
        }

        const posx = pos[0];
        const posy = pos[1];
        const posz = pos[2];
        const upx = up[0];
        const upy = up[1];
        const upz = up[2];
        const targetx = target[0];
        const targety = target[1];
        const targetz = target[2];

        if (posx === targetx && posy === targety && posz === targetz) {
            return math.identityMat4();
        }

        let z0;
        let z1;
        let z2;
        let x0;
        let x1;
        let x2;
        let y0;
        let y1;
        let y2;
        let len;

        //vec3.direction(eye, center, z);
        z0 = posx - targetx;
        z1 = posy - targety;
        z2 = posz - targetz;

        // normalize (no check needed for 0 because of early return)
        len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
        z0 *= len;
        z1 *= len;
        z2 *= len;

        //vec3.normalize(vec3.cross(up, z, x));
        x0 = upy * z2 - upz * z1;
        x1 = upz * z0 - upx * z2;
        x2 = upx * z1 - upy * z0;
        len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
        if (!len) {
            x0 = 0;
            x1 = 0;
            x2 = 0;
        } else {
            len = 1 / len;
            x0 *= len;
            x1 *= len;
            x2 *= len;
        }

        //vec3.normalize(vec3.cross(z, x, y));
        y0 = z1 * x2 - z2 * x1;
        y1 = z2 * x0 - z0 * x2;
        y2 = z0 * x1 - z1 * x0;

        len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
        if (!len) {
            y0 = 0;
            y1 = 0;
            y2 = 0;
        } else {
            len = 1 / len;
            y0 *= len;
            y1 *= len;
            y2 *= len;
        }

        dest[0] = x0;
        dest[1] = y0;
        dest[2] = z0;
        dest[3] = 0;
        dest[4] = x1;
        dest[5] = y1;
        dest[6] = z1;
        dest[7] = 0;
        dest[8] = x2;
        dest[9] = y2;
        dest[10] = z2;
        dest[11] = 0;
        dest[12] = -(x0 * posx + x1 * posy + x2 * posz);
        dest[13] = -(y0 * posx + y1 * posy + y2 * posz);
        dest[14] = -(z0 * posx + z1 * posy + z2 * posz);
        dest[15] = 1;

        return dest;
    },

    /**
     * Returns a 4x4 'lookat' viewing transform matrix.
     * @method lookAtMat4c
     * @static
     */
    lookAtMat4c(posx, posy, posz, targetx, targety, targetz, upx, upy, upz) {
        return math.lookAtMat4v([posx, posy, posz], [targetx, targety, targetz], [upx, upy, upz], []);
    },

    /**
     * Returns a 4x4 orthographic projection matrix.
     * @method orthoMat4c
     * @static
     */
    orthoMat4c(left, right, bottom, top, near, far, dest) {
        if (!dest) {
            dest = math.mat4();
        }
        const rl = (right - left);
        const tb = (top - bottom);
        const fn = (far - near);

        dest[0] = 2.0 / rl;
        dest[1] = 0.0;
        dest[2] = 0.0;
        dest[3] = 0.0;

        dest[4] = 0.0;
        dest[5] = 2.0 / tb;
        dest[6] = 0.0;
        dest[7] = 0.0;

        dest[8] = 0.0;
        dest[9] = 0.0;
        dest[10] = -2.0 / fn;
        dest[11] = 0.0;

        dest[12] = -(left + right) / rl;
        dest[13] = -(top + bottom) / tb;
        dest[14] = -(far + near) / fn;
        dest[15] = 1.0;

        return dest;
    },

    /**
     * Returns a 4x4 perspective projection matrix.
     * @method frustumMat4v
     * @static
     */
    frustumMat4v(fmin, fmax, m) {
        if (!m) {
            m = math.mat4();
        }

        const fmin4 = [fmin[0], fmin[1], fmin[2], 0.0];
        const fmax4 = [fmax[0], fmax[1], fmax[2], 0.0];

        math.addVec4(fmax4, fmin4, tempMat1);
        math.subVec4(fmax4, fmin4, tempMat2);

        const t = 2.0 * fmin4[2];

        const tempMat20 = tempMat2[0];
        const tempMat21 = tempMat2[1];
        const tempMat22 = tempMat2[2];

        m[0] = t / tempMat20;
        m[1] = 0.0;
        m[2] = 0.0;
        m[3] = 0.0;

        m[4] = 0.0;
        m[5] = t / tempMat21;
        m[6] = 0.0;
        m[7] = 0.0;

        m[8] = tempMat1[0] / tempMat20;
        m[9] = tempMat1[1] / tempMat21;
        m[10] = -tempMat1[2] / tempMat22;
        m[11] = -1.0;

        m[12] = 0.0;
        m[13] = 0.0;
        m[14] = -t * fmax4[2] / tempMat22;
        m[15] = 0.0;

        return m;
    },

    /**
     * Returns a 4x4 perspective projection matrix.
     * @method frustumMat4v
     * @static
     */
    frustumMat4(left, right, bottom, top, near, far, dest) {
        if (!dest) {
            dest = math.mat4();
        }
        const rl = (right - left);
        const tb = (top - bottom);
        const fn = (far - near);
        dest[0] = (near * 2) / rl;
        dest[1] = 0;
        dest[2] = 0;
        dest[3] = 0;
        dest[4] = 0;
        dest[5] = (near * 2) / tb;
        dest[6] = 0;
        dest[7] = 0;
        dest[8] = (right + left) / rl;
        dest[9] = (top + bottom) / tb;
        dest[10] = -(far + near) / fn;
        dest[11] = -1;
        dest[12] = 0;
        dest[13] = 0;
        dest[14] = -(far * near * 2) / fn;
        dest[15] = 0;
        return dest;
    },

    /**
     * Returns a 4x4 perspective projection matrix.
     * @method perspectiveMat4v
     * @static
     */
    perspectiveMat4(fovyrad, aspectratio, znear, zfar, m) {
        const pmin = [];
        const pmax = [];

        pmin[2] = znear;
        pmax[2] = zfar;

        pmax[1] = pmin[2] * Math.tan(fovyrad / 2.0);
        pmin[1] = -pmax[1];

        pmax[0] = pmax[1] * aspectratio;
        pmin[0] = -pmax[0];

        return math.frustumMat4v(pmin, pmax, m);
    },

    /**
     * Transforms a three-element position by a 4x4 matrix.
     * @method transformPoint3
     * @static
     */
    transformPoint3(m, p, dest = math.vec3()) {
        dest[0] = (m[0] * p[0]) + (m[4] * p[1]) + (m[8] * p[2]) + m[12];
        dest[1] = (m[1] * p[0]) + (m[5] * p[1]) + (m[9] * p[2]) + m[13];
        dest[2] = (m[2] * p[0]) + (m[6] * p[1]) + (m[10] * p[2]) + m[14];

        return dest;
    },

    /**
     * Transforms a homogeneous coordinate by a 4x4 matrix.
     * @method transformPoint3
     * @static
     */
    transformPoint4(m, v, dest = math.vec4()) {
        dest[0] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3];
        dest[1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3];
        dest[2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3];
        dest[3] = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3];

        return dest;
    },


    /**
     * Transforms an array of three-element positions by a 4x4 matrix.
     * @method transformPoints3
     * @static
     */
    transformPoints3(m, points, points2) {
        const result = points2 || [];
        const len = points.length;
        let p0;
        let p1;
        let p2;
        let pi;

        // cache values
        const m0 = m[0];

        const m1 = m[1];
        const m2 = m[2];
        const m3 = m[3];
        const m4 = m[4];
        const m5 = m[5];
        const m6 = m[6];
        const m7 = m[7];
        const m8 = m[8];
        const m9 = m[9];
        const m10 = m[10];
        const m11 = m[11];
        const m12 = m[12];
        const m13 = m[13];
        const m14 = m[14];
        const m15 = m[15];

        let r;

        for (let i = 0; i < len; ++i) {

            // cache values
            pi = points[i];

            p0 = pi[0];
            p1 = pi[1];
            p2 = pi[2];

            r = result[i] || (result[i] = [0, 0, 0]);

            r[0] = (m0 * p0) + (m4 * p1) + (m8 * p2) + m12;
            r[1] = (m1 * p0) + (m5 * p1) + (m9 * p2) + m13;
            r[2] = (m2 * p0) + (m6 * p1) + (m10 * p2) + m14;
            r[3] = (m3 * p0) + (m7 * p1) + (m11 * p2) + m15;
        }

        result.length = len;

        return result;
    },

    /**
     * Transforms an array of positions by a 4x4 matrix.
     * @method transformPositions3
     * @static
     */
    transformPositions3(m, p, p2 = p) {
        let i;
        const len = p.length;

        let x;
        let y;
        let z;

        const m0 = m[0];
        const m1 = m[1];
        const m2 = m[2];
        const m3 = m[3];
        const m4 = m[4];
        const m5 = m[5];
        const m6 = m[6];
        const m7 = m[7];
        const m8 = m[8];
        const m9 = m[9];
        const m10 = m[10];
        const m11 = m[11];
        const m12 = m[12];
        const m13 = m[13];
        const m14 = m[14];
        const m15 = m[15];

        for (i = 0; i < len; i += 3) {

            x = p[i + 0];
            y = p[i + 1];
            z = p[i + 2];

            p2[i + 0] = (m0 * x) + (m4 * y) + (m8 * z) + m12;
            p2[i + 1] = (m1 * x) + (m5 * y) + (m9 * z) + m13;
            p2[i + 2] = (m2 * x) + (m6 * y) + (m10 * z) + m14;
            p2[i + 3] = (m3 * x) + (m7 * y) + (m11 * z) + m15;
        }

        return p2;
    },

    /**
     * Transforms an array of positions by a 4x4 matrix.
     * @method transformPositions4
     * @static
     */
    transformPositions4(m, p, p2 = p) {
        let i;
        const len = p.length;

        let x;
        let y;
        let z;

        const m0 = m[0];
        const m1 = m[1];
        const m2 = m[2];
        const m3 = m[3];
        const m4 = m[4];
        const m5 = m[5];
        const m6 = m[6];
        const m7 = m[7];
        const m8 = m[8];
        const m9 = m[9];
        const m10 = m[10];
        const m11 = m[11];
        const m12 = m[12];
        const m13 = m[13];
        const m14 = m[14];
        const m15 = m[15];

        for (i = 0; i < len; i += 4) {

            x = p[i + 0];
            y = p[i + 1];
            z = p[i + 2];

            p2[i + 0] = (m0 * x) + (m4 * y) + (m8 * z) + m12;
            p2[i + 1] = (m1 * x) + (m5 * y) + (m9 * z) + m13;
            p2[i + 2] = (m2 * x) + (m6 * y) + (m10 * z) + m14;
            p2[i + 3] = (m3 * x) + (m7 * y) + (m11 * z) + m15;
        }

        return p2;
    },

    /**
     * Transforms a three-element vector by a 4x4 matrix.
     * @method transformVec3
     * @static
     */
    transformVec3(m, v, dest) {
        const v0 = v[0];
        const v1 = v[1];
        const v2 = v[2];
        dest = dest || this.vec3();
        dest[0] = (m[0] * v0) + (m[4] * v1) + (m[8] * v2);
        dest[1] = (m[1] * v0) + (m[5] * v1) + (m[9] * v2);
        dest[2] = (m[2] * v0) + (m[6] * v1) + (m[10] * v2);
        return dest;
    },

    /**
     * Transforms a four-element vector by a 4x4 matrix.
     * @method transformVec4
     * @static
     */
    transformVec4(m, v, dest) {
        const v0 = v[0];
        const v1 = v[1];
        const v2 = v[2];
        const v3 = v[3];
        dest = dest || math.vec4();
        dest[0] = m[0] * v0 + m[4] * v1 + m[8] * v2 + m[12] * v3;
        dest[1] = m[1] * v0 + m[5] * v1 + m[9] * v2 + m[13] * v3;
        dest[2] = m[2] * v0 + m[6] * v1 + m[10] * v2 + m[14] * v3;
        dest[3] = m[3] * v0 + m[7] * v1 + m[11] * v2 + m[15] * v3;
        return dest;
    },

    /**
     * Rotate a 3D vector around the x-axis
     *
     * @method rotateVec3X
     * @param {Float32Array} a The vec3 point to rotate
     * @param {Float32Array} b The origin of the rotation
     * @param {Number} c The angle of rotation
     * @param {Float32Array} dest The receiving vec3
     * @returns {Float32Array} dest
     * @static
     */
    rotateVec3X(a, b, c, dest) {
        const p = [];
        const r = [];

        //Translate point to the origin
        p[0] = a[0] - b[0];
        p[1] = a[1] - b[1];
        p[2] = a[2] - b[2];

        //perform rotation
        r[0] = p[0];
        r[1] = p[1] * Math.cos(c) - p[2] * Math.sin(c);
        r[2] = p[1] * Math.sin(c) + p[2] * Math.cos(c);

        //translate to correct position
        dest[0] = r[0] + b[0];
        dest[1] = r[1] + b[1];
        dest[2] = r[2] + b[2];

        return dest;
    },

    /**
     * Rotate a 3D vector around the y-axis
     *
     * @method rotateVec3Y
     * @param {Float32Array} a The vec3 point to rotate
     * @param {Float32Array} b The origin of the rotation
     * @param {Number} c The angle of rotation
     * @param {Float32Array} dest The receiving vec3
     * @returns {Float32Array} dest
     * @static
     */
    rotateVec3Y(a, b, c, dest) {
        const p = [];
        const r = [];

        //Translate point to the origin
        p[0] = a[0] - b[0];
        p[1] = a[1] - b[1];
        p[2] = a[2] - b[2];

        //perform rotation
        r[0] = p[2] * Math.sin(c) + p[0] * Math.cos(c);
        r[1] = p[1];
        r[2] = p[2] * Math.cos(c) - p[0] * Math.sin(c);

        //translate to correct position
        dest[0] = r[0] + b[0];
        dest[1] = r[1] + b[1];
        dest[2] = r[2] + b[2];

        return dest;
    },

    /**
     * Rotate a 3D vector around the z-axis
     *
     * @method rotateVec3Z
     * @param {Float32Array} a The vec3 point to rotate
     * @param {Float32Array} b The origin of the rotation
     * @param {Number} c The angle of rotation
     * @param {Float32Array} dest The receiving vec3
     * @returns {Float32Array} dest
     * @static
     */
    rotateVec3Z(a, b, c, dest) {
        const p = [];
        const r = [];

        //Translate point to the origin
        p[0] = a[0] - b[0];
        p[1] = a[1] - b[1];
        p[2] = a[2] - b[2];

        //perform rotation
        r[0] = p[0] * Math.cos(c) - p[1] * Math.sin(c);
        r[1] = p[0] * Math.sin(c) + p[1] * Math.cos(c);
        r[2] = p[2];

        //translate to correct position
        dest[0] = r[0] + b[0];
        dest[1] = r[1] + b[1];
        dest[2] = r[2] + b[2];

        return dest;
    },

    /**
     * Transforms a four-element vector by a 4x4 projection matrix.
     *
     * @method projectVec4
     * @param {Float32Array} p 3D View-space coordinate
     * @param {Float32Array} q 2D Projected coordinate
     * @returns {Float32Array} 2D Projected coordinate
     * @static
     */
    projectVec4(p, q) {
        const f = 1.0 / p[3];
        q = q || math.vec2();
        q[0] = v[0] * f;
        q[1] = v[1] * f;
        return q;
    },

    /**
     * Unprojects a three-element vector.
     *
     * @method unprojectVec3
     * @param {Float32Array} p 3D Projected coordinate
     * @param {Float32Array} viewMat View matrix
     * @returns {Float32Array} projMat Projection matrix
     * @static
     */
    unprojectVec3: ((() => {
        const mat = new Float32Array(16);
        const mat2 = new Float32Array(16);
        const mat3 = new Float32Array(16);
        return function (p, viewMat, projMat, q) {
            return this.transformVec3(this.mulMat4(this.inverseMat4(viewMat, mat), this.inverseMat4(projMat, mat2), mat3), p, q)
        };
    }))(),

    /**
     * Linearly interpolates between two 3D vectors.
     * @method lerpVec3
     * @static
     */
    lerpVec3(t, t1, t2, p1, p2, dest) {
        const result = dest || math.vec3();
        const f = (t - t1) / (t2 - t1);
        result[0] = p1[0] + (f * (p2[0] - p1[0]));
        result[1] = p1[1] + (f * (p2[1] - p1[1]));
        result[2] = p1[2] + (f * (p2[2] - p1[2]));
        return result;
    },


    /**
     * Flattens a two-dimensional array into a one-dimensional array.
     *
     * @method flatten
     * @static
     * @param {Array of Arrays} a A 2D array
     * @returns Flattened 1D array
     */
    flatten(a) {

        const result = [];

        let i;
        let leni;
        let j;
        let lenj;
        let item;

        for (i = 0, leni = a.length; i < leni; i++) {
            item = a[i];
            for (j = 0, lenj = item.length; j < lenj; j++) {
                result.push(item[j]);
            }
        }

        return result;
    },


    identityQuaternion(dest = math.vec4()) {
        dest[0] = 0.0;
        dest[1] = 0.0;
        dest[2] = 0.0;
        dest[3] = 1.0;
        return dest;
    },

    /**
     * Initializes a quaternion from Euler angles.
     *
     * @param {Float32Array} euler The Euler angles.
     * @param {String} order Euler angle order: "XYZ", "YXZ", "ZXY" etc.
     * @param {Float32Array} [dest] Destination quaternion, created by default.
     * @returns {Float32Array} The quaternion.
     */
    eulerToQuaternion(euler, order, dest = math.vec4()) {
        // http://www.mathworks.com/matlabcentral/fileexchange/
        // 	20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/
        //	content/SpinCalc.m

        const a = (euler[0] * math.DEGTORAD) / 2;
        const b = (euler[1] * math.DEGTORAD) / 2;
        const c = (euler[2] * math.DEGTORAD) / 2;

        const c1 = Math.cos(a);
        const c2 = Math.cos(b);
        const c3 = Math.cos(c);
        const s1 = Math.sin(a);
        const s2 = Math.sin(b);
        const s3 = Math.sin(c);

        if (order === 'XYZ') {

            dest[0] = s1 * c2 * c3 + c1 * s2 * s3;
            dest[1] = c1 * s2 * c3 - s1 * c2 * s3;
            dest[2] = c1 * c2 * s3 + s1 * s2 * c3;
            dest[3] = c1 * c2 * c3 - s1 * s2 * s3;

        } else if (order === 'YXZ') {

            dest[0] = s1 * c2 * c3 + c1 * s2 * s3;
            dest[1] = c1 * s2 * c3 - s1 * c2 * s3;
            dest[2] = c1 * c2 * s3 - s1 * s2 * c3;
            dest[3] = c1 * c2 * c3 + s1 * s2 * s3;

        } else if (order === 'ZXY') {

            dest[0] = s1 * c2 * c3 - c1 * s2 * s3;
            dest[1] = c1 * s2 * c3 + s1 * c2 * s3;
            dest[2] = c1 * c2 * s3 + s1 * s2 * c3;
            dest[3] = c1 * c2 * c3 - s1 * s2 * s3;

        } else if (order === 'ZYX') {

            dest[0] = s1 * c2 * c3 - c1 * s2 * s3;
            dest[1] = c1 * s2 * c3 + s1 * c2 * s3;
            dest[2] = c1 * c2 * s3 - s1 * s2 * c3;
            dest[3] = c1 * c2 * c3 + s1 * s2 * s3;

        } else if (order === 'YZX') {

            dest[0] = s1 * c2 * c3 + c1 * s2 * s3;
            dest[1] = c1 * s2 * c3 + s1 * c2 * s3;
            dest[2] = c1 * c2 * s3 - s1 * s2 * c3;
            dest[3] = c1 * c2 * c3 - s1 * s2 * s3;

        } else if (order === 'XZY') {

            dest[0] = s1 * c2 * c3 - c1 * s2 * s3;
            dest[1] = c1 * s2 * c3 - s1 * c2 * s3;
            dest[2] = c1 * c2 * s3 + s1 * s2 * c3;
            dest[3] = c1 * c2 * c3 + s1 * s2 * s3;
        }

        return dest;
    },

    mat4ToQuaternion(m, dest = math.vec4()) {
        // http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm

        // Assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)

        const m11 = m[0];
        const m12 = m[4];
        const m13 = m[8];
        const m21 = m[1];
        const m22 = m[5];
        const m23 = m[9];
        const m31 = m[2];
        const m32 = m[6];
        const m33 = m[10];
        let s;

        const trace = m11 + m22 + m33;

        if (trace > 0) {

            s = 0.5 / Math.sqrt(trace + 1.0);

            dest[3] = 0.25 / s;
            dest[0] = ( m32 - m23 ) * s;
            dest[1] = ( m13 - m31 ) * s;
            dest[2] = ( m21 - m12 ) * s;

        } else if (m11 > m22 && m11 > m33) {

            s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);

            dest[3] = ( m32 - m23 ) / s;
            dest[0] = 0.25 * s;
            dest[1] = ( m12 + m21 ) / s;
            dest[2] = ( m13 + m31 ) / s;

        } else if (m22 > m33) {

            s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);

            dest[3] = ( m13 - m31 ) / s;
            dest[0] = ( m12 + m21 ) / s;
            dest[1] = 0.25 * s;
            dest[2] = ( m23 + m32 ) / s;

        } else {

            s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);

            dest[3] = ( m21 - m12 ) / s;
            dest[0] = ( m13 + m31 ) / s;
            dest[1] = ( m23 + m32 ) / s;
            dest[2] = 0.25 * s;
        }

        return dest;
    },

    vec3PairToQuaternion(u, v, dest = math.vec4()) {
        const norm_u_norm_v = Math.sqrt(math.dotVec3(u, u) * math.dotVec3(v, v));
        let real_part = norm_u_norm_v + math.dotVec3(u, v);

        if (real_part < 0.00000001 * norm_u_norm_v) {

            // If u and v are exactly opposite, rotate 180 degrees
            // around an arbitrary orthogonal axis. Axis normalisation
            // can happen later, when we normalise the quaternion.

            real_part = 0.0;

            if (Math.abs(u[0]) > Math.abs(u[2])) {

                dest[0] = -u[1];
                dest[1] = u[0];
                dest[2] = 0;

            } else {
                dest[0] = 0;
                dest[1] = -u[2];
                dest[2] = u[1];
            }

        } else {

            // Otherwise, build quaternion the standard way.
            math.cross3Vec3(u, v, dest);
        }

        dest[3] = real_part;

        return math.normalizeQuaternion(dest);
    },

    angleAxisToQuaternion(angleAxis, dest = math.vec4()) {
        const halfAngle = angleAxis[3] / 2.0;
        const fsin = Math.sin(halfAngle);
        dest[0] = fsin * angleAxis[0];
        dest[1] = fsin * angleAxis[1];
        dest[2] = fsin * angleAxis[2];
        dest[3] = Math.cos(halfAngle);
        return dest;
    },

    quaternionToEuler: ((() => {
        const mat = new Float32Array(16);
        return (q, order, dest) => {
            dest = dest || math.vec3();
            math.quaternionToRotationMat4(q, mat);
            math.mat4ToEuler(mat, order, dest);
            return dest;
        };
    }))(),

    mulQuaternions(p, q, dest = math.vec4()) {
        const p0 = p[0];
        const p1 = p[1];
        const p2 = p[2];
        const p3 = p[3];
        const q0 = q[0];
        const q1 = q[1];
        const q2 = q[2];
        const q3 = q[3];
        dest[0] = p3 * q0 + p0 * q3 + p1 * q2 - p2 * q1;
        dest[1] = p3 * q1 + p1 * q3 + p2 * q0 - p0 * q2;
        dest[2] = p3 * q2 + p2 * q3 + p0 * q1 - p1 * q0;
        dest[3] = p3 * q3 - p0 * q0 - p1 * q1 - p2 * q2;
        return dest;
    },

    vec3ApplyQuaternion(q, vec, dest = math.vec3()) {
        const x = vec[0];
        const y = vec[1];
        const z = vec[2];

        const qx = q[0];
        const qy = q[1];
        const qz = q[2];
        const qw = q[3];

        // calculate quat * vector

        const ix = qw * x + qy * z - qz * y;
        const iy = qw * y + qz * x - qx * z;
        const iz = qw * z + qx * y - qy * x;
        const iw = -qx * x - qy * y - qz * z;

        // calculate result * inverse quat

        dest[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        dest[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        dest[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        return dest;
    },

    quaternionToMat4(q, dest) {

        dest = math.identityMat4(dest);

        const q0 = q[0];  //x
        const q1 = q[1];  //y
        const q2 = q[2];  //z
        const q3 = q[3];  //w

        const tx = 2.0 * q0;
        const ty = 2.0 * q1;
        const tz = 2.0 * q2;

        const twx = tx * q3;
        const twy = ty * q3;
        const twz = tz * q3;

        const txx = tx * q0;
        const txy = ty * q0;
        const txz = tz * q0;

        const tyy = ty * q1;
        const tyz = tz * q1;
        const tzz = tz * q2;

        dest[0] = 1.0 - (tyy + tzz);
        dest[1] = txy + twz;
        dest[2] = txz - twy;

        dest[4] = txy - twz;
        dest[5] = 1.0 - (txx + tzz);
        dest[6] = tyz + twx;

        dest[8] = txz + twy;
        dest[9] = tyz - twx;

        dest[10] = 1.0 - (txx + tyy);

        return dest;
    },

    quaternionToRotationMat4(q, m) {
        const x = q[0];
        const y = q[1];
        const z = q[2];
        const w = q[3];

        const x2 = x + x;
        const y2 = y + y;
        const z2 = z + z;
        const xx = x * x2;
        const xy = x * y2;
        const xz = x * z2;
        const yy = y * y2;
        const yz = y * z2;
        const zz = z * z2;
        const wx = w * x2;
        const wy = w * y2;
        const wz = w * z2;

        m[0] = 1 - ( yy + zz );
        m[4] = xy - wz;
        m[8] = xz + wy;

        m[1] = xy + wz;
        m[5] = 1 - ( xx + zz );
        m[9] = yz - wx;

        m[2] = xz - wy;
        m[6] = yz + wx;
        m[10] = 1 - ( xx + yy );

        // last column
        m[3] = 0;
        m[7] = 0;
        m[11] = 0;

        // bottom row
        m[12] = 0;
        m[13] = 0;
        m[14] = 0;
        m[15] = 1;

        return m;
    },

    normalizeQuaternion(q, dest = q) {
        const len = math.lenVec4([q[0], q[1], q[2], q[3]]);
        dest[0] = q[0] / len;
        dest[1] = q[1] / len;
        dest[2] = q[2] / len;
        dest[3] = q[3] / len;
        return dest;
    },

    conjugateQuaternion(q, dest = q) {
        dest[0] = -q[0];
        dest[1] = -q[1];
        dest[2] = -q[2];
        dest[3] = q[3];
        return dest;
    },

    inverseQuaternion(q, dest) {
        return math.normalizeQuaternion(math.conjugateQuaternion(q, dest));
    },

    quaternionToAngleAxis(q, angleAxis = math.vec4()) {
        q = math.normalizeQuaternion(q, tempVec4);
        const q3 = q[3];
        const angle = 2 * Math.acos(q3);
        const s = Math.sqrt(1 - q3 * q3);
        if (s < 0.001) { // test to avoid divide by zero, s is always positive due to sqrt
            angleAxis[0] = q[0];
            angleAxis[1] = q[1];
            angleAxis[2] = q[2];
        } else {
            angleAxis[0] = q[0] / s;
            angleAxis[1] = q[1] / s;
            angleAxis[2] = q[2] / s;
        }
        angleAxis[3] = angle; // * 57.295779579;
        return angleAxis;
    },

    decompressPosition(position, decodeMatrix, dest) {
        dest[0] = position[0] * decodeMatrix[0] + decodeMatrix[12];
        dest[1] = position[1] * decodeMatrix[5] + decodeMatrix[13];
        dest[2] = position[2] * decodeMatrix[10] + decodeMatrix[14];
    },

    decompressPositions(positions, decodeMatrix, dest = new Float32Array(positions.length)) {
        for (let i = 0, len = positions.length; i < len; i += 3) {
            dest[i + 0] = positions[i + 0] * decodeMatrix[0] + decodeMatrix[12];
            dest[i + 1] = positions[i + 1] * decodeMatrix[5] + decodeMatrix[13];
            dest[i + 2] = positions[i + 2] * decodeMatrix[10] + decodeMatrix[14];
        }
        return dest;
    },

    decompressUV(uv, decodeMatrix, dest) {
        dest[0] = uv[0] * decodeMatrix[0] + decodeMatrix[6];
        dest[1] = uv[1] * decodeMatrix[4] + decodeMatrix[7];
    },

    decompressUVs(uvs, decodeMatrix, dest = new Float32Array(uvs.length)) {
        for (let i = 0, len = uvs.length; i < len; i += 3) {
            dest[i + 0] = uvs[i + 0] * decodeMatrix[0] + decodeMatrix[6];
            dest[i + 1] = uvs[i + 1] * decodeMatrix[4] + decodeMatrix[7];
        }
        return dest;
    },

    octDecodeVec2(oct, result) {
        let x = oct[0];
        let y = oct[1];
        x = (2 * x + 1) / 255;
        y = (2 * y + 1) / 255;
        const z = 1 - Math.abs(x) - Math.abs(y);
        if (z < 0) {
            x = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
            y = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
        }
        const length = Math.sqrt(x * x + y * y + z * z);
        result[0] = x / length;
        result[1] = y / length;
        result[2] = z / length;
        return result;
    },

    octDecodeVec2s(octs, result) {
        for (let i = 0, j = 0, len = octs.length; i < len; i += 2) {
            let x = octs[i + 0];
            let y = octs[i + 1];
            x = (2 * x + 1) / 255;
            y = (2 * y + 1) / 255;
            const z = 1 - Math.abs(x) - Math.abs(y);
            if (z < 0) {
                x = (1 - Math.abs(y)) * (x >= 0 ? 1 : -1);
                y = (1 - Math.abs(x)) * (y >= 0 ? 1 : -1);
            }
            const length = Math.sqrt(x * x + y * y + z * z);
            result[j + 0] = x / length;
            result[j + 1] = y / length;
            result[j + 2] = z / length;
            j += 3;
        }
        return result;
    },

    //------------------------------------------------------------------------------------------------------------------
    // Boundaries
    //------------------------------------------------------------------------------------------------------------------

    /**
     * Returns a new, uninitialized 3D axis-aligned bounding box.
     *
     * @private
     */
    AABB3(values) {
        return new Float32Array(values || 6);
    },

    /**
     * Returns a new, uninitialized 2D axis-aligned bounding box.
     *
     * @private
     */
    AABB2(values) {
        return new Float32Array(values || 4);
    },

    /**
     * Returns a new, uninitialized 3D oriented bounding box (OBB).
     *
     * @private
     */
    OBB3(values) {
        return new Float32Array(values || 32);
    },

    /**
     * Returns a new, uninitialized 2D oriented bounding box (OBB).
     *
     * @private
     */
    OBB2(values) {
        return new Float32Array(values || 16);
    },


    /**
     * Transforms an OBB3 by a 4x4 matrix.
     *
     * @private
     */
    transformOBB3(m, p, p2 = p) {
        let i;
        const len = p.length;

        let x;
        let y;
        let z;

        const m0 = m[0];
        const m1 = m[1];
        const m2 = m[2];
        const m3 = m[3];
        const m4 = m[4];
        const m5 = m[5];
        const m6 = m[6];
        const m7 = m[7];
        const m8 = m[8];
        const m9 = m[9];
        const m10 = m[10];
        const m11 = m[11];
        const m12 = m[12];
        const m13 = m[13];
        const m14 = m[14];
        const m15 = m[15];

        for (i = 0; i < len; i += 4) {

            x = p[i + 0];
            y = p[i + 1];
            z = p[i + 2];

            p2[i + 0] = (m0 * x) + (m4 * y) + (m8 * z) + m12;
            p2[i + 1] = (m1 * x) + (m5 * y) + (m9 * z) + m13;
            p2[i + 2] = (m2 * x) + (m6 * y) + (m10 * z) + m14;
            p2[i + 3] = (m3 * x) + (m7 * y) + (m11 * z) + m15;
        }

        return p2;
    },

    /**
     * Gets the diagonal size of an AABB3 given as minima and maxima.
     *
     * @private
     */
    getAABB3Diag: ((() => {

        const min = new Float32Array(3);
        const max = new Float32Array(3);
        const tempVec3 = new Float32Array(3);

        return aabb => {

            min[0] = aabb[0];
            min[1] = aabb[1];
            min[2] = aabb[2];

            max[0] = aabb[3];
            max[1] = aabb[4];
            max[2] = aabb[5];

            math.subVec3(max, min, tempVec3);

            return Math.abs(math.lenVec3(tempVec3));
        };
    }))(),

    /**
     * Get a diagonal boundary size that is symmetrical about the given point.
     *
     * @private
     */
    getAABB3DiagPoint: ((() => {

        const min = new Float32Array(3);
        const max = new Float32Array(3);
        const tempVec3 = new Float32Array(3);

        return (aabb, p) => {

            min[0] = aabb[0];
            min[1] = aabb[1];
            min[2] = aabb[2];

            max[0] = aabb[3];
            max[1] = aabb[4];
            max[2] = aabb[5];

            const diagVec = math.subVec3(max, min, tempVec3);

            const xneg = p[0] - aabb[0];
            const xpos = aabb[3] - p[0];
            const yneg = p[1] - aabb[1];
            const ypos = aabb[4] - p[1];
            const zneg = p[2] - aabb[2];
            const zpos = aabb[5] - p[2];

            diagVec[0] += (xneg > xpos) ? xneg : xpos;
            diagVec[1] += (yneg > ypos) ? yneg : ypos;
            diagVec[2] += (zneg > zpos) ? zneg : zpos;

            return Math.abs(math.lenVec3(diagVec));
        };
    }))(),

    /**
     * Gets the center of an AABB.
     *
     * @private
     */
    getAABB3Center(aabb, dest) {
        const r = dest || math.vec3();

        r[0] = (aabb[0] + aabb[3] ) / 2;
        r[1] = (aabb[1] + aabb[4] ) / 2;
        r[2] = (aabb[2] + aabb[5] ) / 2;

        return r;
    },

    /**
     * Gets the center of a 2D AABB.
     *
     * @private
     */
    getAABB2Center(aabb, dest) {
        const r = dest || math.vec2();

        r[0] = (aabb[2] + aabb[0] ) / 2;
        r[1] = (aabb[3] + aabb[1] ) / 2;

        return r;
    },

    /**
     * Collapses a 3D axis-aligned boundary, ready to expand to fit 3D points.
     * Creates new AABB if none supplied.
     *
     * @private
     */
    collapseAABB3(aabb = math.AABB3()) {
        aabb[0] = math.MAX_DOUBLE;
        aabb[1] = math.MAX_DOUBLE;
        aabb[2] = math.MAX_DOUBLE;
        aabb[3] = -math.MAX_DOUBLE;
        aabb[4] = -math.MAX_DOUBLE;
        aabb[5] = -math.MAX_DOUBLE;

        return aabb;
    },

    /**
     * Converts an axis-aligned 3D boundary into an oriented boundary consisting of
     * an array of eight 3D positions, one for each corner of the boundary.
     *
     * @private
     */
    AABB3ToOBB3(aabb, obb = math.OBB3()) {
        obb[0] = aabb[0];
        obb[1] = aabb[1];
        obb[2] = aabb[2];
        obb[3] = 1;

        obb[4] = aabb[3];
        obb[5] = aabb[1];
        obb[6] = aabb[2];
        obb[7] = 1;

        obb[8] = aabb[3];
        obb[9] = aabb[4];
        obb[10] = aabb[2];
        obb[11] = 1;

        obb[12] = aabb[0];
        obb[13] = aabb[4];
        obb[14] = aabb[2];
        obb[15] = 1;

        obb[16] = aabb[0];
        obb[17] = aabb[1];
        obb[18] = aabb[5];
        obb[19] = 1;

        obb[20] = aabb[3];
        obb[21] = aabb[1];
        obb[22] = aabb[5];
        obb[23] = 1;

        obb[24] = aabb[3];
        obb[25] = aabb[4];
        obb[26] = aabb[5];
        obb[27] = 1;

        obb[28] = aabb[0];
        obb[29] = aabb[4];
        obb[30] = aabb[5];
        obb[31] = 1;

        return obb;
    },

    /**
     * Finds the minimum axis-aligned 3D boundary enclosing the homogeneous 3D points (x,y,z,w) given in a flattened array.
     *
     * @private
     */
    positions3ToAABB3: ((() => {

        const p = new Float32Array(3);

        return (positions, aabb, positionsDecodeMatrix) => {
            aabb = aabb || math.AABB3();

            let xmin = math.MAX_DOUBLE;
            let ymin = math.MAX_DOUBLE;
            let zmin = math.MAX_DOUBLE;
            let xmax = -math.MAX_DOUBLE;
            let ymax = -math.MAX_DOUBLE;
            let zmax = -math.MAX_DOUBLE;

            let x;
            let y;
            let z;

            for (let i = 0, len = positions.length; i < len; i += 3) {

                if (positionsDecodeMatrix) {

                    p[0] = positions[i + 0];
                    p[1] = positions[i + 1];
                    p[2] = positions[i + 2];

                    math.decompressPosition(p, positionsDecodeMatrix, p);

                    x = p[0];
                    y = p[1];
                    z = p[2];

                } else {
                    x = positions[i + 0];
                    y = positions[i + 1];
                    z = positions[i + 2];
                }

                if (x < xmin) {
                    xmin = x;
                }

                if (y < ymin) {
                    ymin = y;
                }

                if (z < zmin) {
                    zmin = z;
                }

                if (x > xmax) {
                    xmax = x;
                }

                if (y > ymax) {
                    ymax = y;
                }

                if (z > zmax) {
                    zmax = z;
                }
            }

            aabb[0] = xmin;
            aabb[1] = ymin;
            aabb[2] = zmin;
            aabb[3] = xmax;
            aabb[4] = ymax;
            aabb[5] = zmax;

            return aabb;
        };
    }))(),

    /**
     * Finds the minimum axis-aligned 3D boundary enclosing the homogeneous 3D points (x,y,z,w) given in a flattened array.
     *
     * @private
     */
    OBB3ToAABB3(obb, aabb = math.AABB3()) {
        let xmin = math.MAX_DOUBLE;
        let ymin = math.MAX_DOUBLE;
        let zmin = math.MAX_DOUBLE;
        let xmax = -math.MAX_DOUBLE;
        let ymax = -math.MAX_DOUBLE;
        let zmax = -math.MAX_DOUBLE;

        let x;
        let y;
        let z;

        for (let i = 0, len = obb.length; i < len; i += 4) {

            x = obb[i + 0];
            y = obb[i + 1];
            z = obb[i + 2];

            if (x < xmin) {
                xmin = x;
            }

            if (y < ymin) {
                ymin = y;
            }

            if (z < zmin) {
                zmin = z;
            }

            if (x > xmax) {
                xmax = x;
            }

            if (y > ymax) {
                ymax = y;
            }

            if (z > zmax) {
                zmax = z;
            }
        }

        aabb[0] = xmin;
        aabb[1] = ymin;
        aabb[2] = zmin;
        aabb[3] = xmax;
        aabb[4] = ymax;
        aabb[5] = zmax;

        return aabb;
    },

    /**
     * Finds the minimum axis-aligned 3D boundary enclosing the given 3D points.
     *
     * @private
     */
    points3ToAABB3(points, aabb = math.AABB3()) {
        let xmin = math.MAX_DOUBLE;
        let ymin = math.MAX_DOUBLE;
        let zmin = math.MAX_DOUBLE;
        let xmax = -math.MAX_DOUBLE;
        let ymax = -math.MAX_DOUBLE;
        let zmax = -math.MAX_DOUBLE;

        let x;
        let y;
        let z;

        for (let i = 0, len = points.length; i < len; i++) {

            x = points[i][0];
            y = points[i][1];
            z = points[i][2];

            if (x < xmin) {
                xmin = x;
            }

            if (y < ymin) {
                ymin = y;
            }

            if (z < zmin) {
                zmin = z;
            }

            if (x > xmax) {
                xmax = x;
            }

            if (y > ymax) {
                ymax = y;
            }

            if (z > zmax) {
                zmax = z;
            }
        }

        aabb[0] = xmin;
        aabb[1] = ymin;
        aabb[2] = zmin;
        aabb[3] = xmax;
        aabb[4] = ymax;
        aabb[5] = zmax;

        return aabb;
    },

    /**
     * Finds the minimum boundary sphere enclosing the given 3D points.
     *
     * @private
     */
    points3ToSphere3: ((() => {

        const tempVec3 = new Float32Array(3);

        return (points, sphere) => {

            sphere = sphere || math.vec4();

            let x = 0;
            let y = 0;
            let z = 0;

            let i;
            const numPoints = points.length;

            for (i = 0; i < numPoints; i++) {
                x += points[i][0];
                y += points[i][1];
                z += points[i][2];
            }

            sphere[0] = x / numPoints;
            sphere[1] = y / numPoints;
            sphere[2] = z / numPoints;

            let radius = 0;
            let dist;

            for (i = 0; i < numPoints; i++) {

                dist = Math.abs(math.lenVec3(math.subVec3(points[i], sphere, tempVec3)));

                if (dist > radius) {
                    radius = dist;
                }
            }

            sphere[3] = radius;

            return sphere;
        };
    }))(),

    /**
     * Finds the minimum boundary sphere enclosing the given 3D points.
     *
     * @private
     */
    OBB3ToSphere3: ((() => {

        const point = new Float32Array(3);
        const tempVec3 = new Float32Array(3);

        return (points, sphere) => {

            sphere = sphere || math.vec4();

            let x = 0;
            let y = 0;
            let z = 0;

            let i;
            const lenPoints = points.length;
            const numPoints = lenPoints / 4;

            for (i = 0; i < lenPoints; i += 4) {
                x += points[i + 0];
                y += points[i + 1];
                z += points[i + 2];
            }

            sphere[0] = x / numPoints;
            sphere[1] = y / numPoints;
            sphere[2] = z / numPoints;

            let radius = 0;
            let dist;

            for (i = 0; i < lenPoints; i += 4) {

                point[0] = points[i + 0];
                point[1] = points[i + 1];
                point[2] = points[i + 2];

                dist = Math.abs(math.lenVec3(math.subVec3(point, sphere, tempVec3)));

                if (dist > radius) {
                    radius = dist;
                }
            }

            sphere[3] = radius;

            return sphere;
        };
    }))(),

    /**
     * Gets the center of a bounding sphere.
     *
     * @private
     */
    getSphere3Center(sphere, dest = math.vec3()) {
        dest[0] = sphere[0];
        dest[1] = sphere[1];
        dest[2] = sphere[2];

        return dest;
    },

    /**
     * Expands the first axis-aligned 3D boundary to enclose the second, if required.
     *
     * @private
     */
    expandAABB3(aabb1, aabb2) {

        if (aabb1[0] > aabb2[0]) {
            aabb1[0] = aabb2[0];
        }

        if (aabb1[1] > aabb2[1]) {
            aabb1[1] = aabb2[1];
        }

        if (aabb1[2] > aabb2[2]) {
            aabb1[2] = aabb2[2];
        }

        if (aabb1[3] < aabb2[3]) {
            aabb1[3] = aabb2[3];
        }

        if (aabb1[4] < aabb2[4]) {
            aabb1[4] = aabb2[4];
        }

        if (aabb1[5] < aabb2[5]) {
            aabb1[5] = aabb2[5];
        }

        return aabb1;
    },

    /**
     * Expands an axis-aligned 3D boundary to enclose the given point, if needed.
     *
     * @private
     */
    expandAABB3Point3(aabb, p) {

        if (aabb[0] < p[0]) {
            aabb[0] = p[0];
        }

        if (aabb[1] < p[1]) {
            aabb[1] = p[1];
        }

        if (aabb[2] < p[2]) {
            aabb[2] = p[2];
        }

        if (aabb[3] > p[0]) {
            aabb[3] = p[0];
        }

        if (aabb[4] > p[1]) {
            aabb[4] = p[1];
        }

        if (aabb[5] > p[2]) {
            aabb[5] = p[2];
        }

        return aabb;
    },

    /**
     * Collapses a 2D axis-aligned boundary, ready to expand to fit 2D points.
     * Creates new AABB if none supplied.
     *
     * @private
     */
    collapseAABB2(aabb = math.AABB2()) {
        aabb[0] = math.MAX_DOUBLE;
        aabb[1] = math.MAX_DOUBLE;
        aabb[2] = -math.MAX_DOUBLE;
        aabb[3] = -math.MAX_DOUBLE;

        return aabb;
    },

    /**
     * Finds the minimum 2D projected axis-aligned boundary enclosing the given 3D points.
     *
     * @private
     */
    OBB3ToAABB2(points, aabb = math.AABB2()) {
        let xmin = math.MAX_DOUBLE;
        let ymin = math.MAX_DOUBLE;
        let xmax = -math.MAX_DOUBLE;
        let ymax = -math.MAX_DOUBLE;

        let x;
        let y;
        let w;
        let f;

        for (let i = 0, len = points.length; i < len; i += 4) {

            x = points[i + 0];
            y = points[i + 1];
            w = points[i + 3] || 1.0;

            f = 1.0 / w;

            x *= f;
            y *= f;

            if (x < xmin) {
                xmin = x;
            }

            if (y < ymin) {
                ymin = y;
            }

            if (x > xmax) {
                xmax = x;
            }

            if (y > ymax) {
                ymax = y;
            }
        }

        aabb[0] = xmin;
        aabb[1] = ymin;
        aabb[2] = xmax;
        aabb[3] = ymax;

        return aabb;
    },

    /**
     * Expands the first axis-aligned 2D boundary to enclose the second, if required.
     *
     * @private
     */
    expandAABB2(aabb1, aabb2) {

        if (aabb1[0] > aabb2[0]) {
            aabb1[0] = aabb2[0];
        }

        if (aabb1[1] > aabb2[1]) {
            aabb1[1] = aabb2[1];
        }

        if (aabb1[2] < aabb2[2]) {
            aabb1[2] = aabb2[2];
        }

        if (aabb1[3] < aabb2[3]) {
            aabb1[3] = aabb2[3];
        }

        return aabb1;
    },

    /**
     * Expands an axis-aligned 2D boundary to enclose the given point, if required.
     *
     * @private
     */
    expandAABB2Point2(aabb, p) {

        if (aabb[0] > p[0]) {
            aabb[0] = p[0];
        }

        if (aabb[1] > p[1]) {
            aabb[1] = p[1];
        }

        if (aabb[2] < p[0]) {
            aabb[2] = p[0];
        }

        if (aabb[3] < p[1]) {
            aabb[3] = p[1];
        }

        return aabb;
    },

    AABB2ToCanvas(aabb, canvasWidth, canvasHeight, aabb2 = aabb) {
        const xmin = (aabb[0] + 1.0) * 0.5;
        const ymin = (aabb[1] + 1.0) * 0.5;
        const xmax = (aabb[2] + 1.0) * 0.5;
        const ymax = (aabb[3] + 1.0) * 0.5;

        aabb2[0] = Math.floor(xmin * canvasWidth);
        aabb2[1] = canvasHeight - Math.floor(ymax * canvasHeight);
        aabb2[2] = Math.floor(xmax * canvasWidth);
        aabb2[3] = canvasHeight - Math.floor(ymin * canvasHeight);

        return aabb2;
    },

    //------------------------------------------------------------------------------------------------------------------
    // Curves
    //------------------------------------------------------------------------------------------------------------------

    tangentQuadraticBezier(t, p0, p1, p2) {
        return 2 * ( 1 - t ) * ( p1 - p0 ) + 2 * t * ( p2 - p1 );
    },

    tangentQuadraticBezier3(t, p0, p1, p2, p3) {
        return -3 * p0 * (1 - t) * (1 - t) +
            3 * p1 * (1 - t) * (1 - t) - 6 * t * p1 * (1 - t) +
            6 * t * p2 * (1 - t) - 3 * t * t * p2 +
            3 * t * t * p3;
    },

    tangentSpline(t) {
        const h00 = 6 * t * t - 6 * t;
        const h10 = 3 * t * t - 4 * t + 1;
        const h01 = -6 * t * t + 6 * t;
        const h11 = 3 * t * t - 2 * t;
        return h00 + h10 + h01 + h11;
    },

    catmullRomInterpolate(p0, p1, p2, p3, t) {
        const v0 = ( p2 - p0 ) * 0.5;
        const v1 = ( p3 - p1 ) * 0.5;
        const t2 = t * t;
        const t3 = t * t2;
        return ( 2 * p1 - 2 * p2 + v0 + v1 ) * t3 + ( -3 * p1 + 3 * p2 - 2 * v0 - v1 ) * t2 + v0 * t + p1;
    },

// Bezier Curve formulii from http://en.wikipedia.org/wiki/B%C3%A9zier_curve

// Quad Bezier Functions

    b2p0(t, p) {
        const k = 1 - t;
        return k * k * p;

    },

    b2p1(t, p) {
        return 2 * ( 1 - t ) * t * p;
    },

    b2p2(t, p) {
        return t * t * p;
    },

    b2(t, p0, p1, p2) {
        return this.b2p0(t, p0) + this.b2p1(t, p1) + this.b2p2(t, p2);
    },

// Cubic Bezier Functions

    b3p0(t, p) {
        const k = 1 - t;
        return k * k * k * p;
    },

    b3p1(t, p) {
        const k = 1 - t;
        return 3 * k * k * t * p;
    },

    b3p2(t, p) {
        const k = 1 - t;
        return 3 * k * t * t * p;
    },

    b3p3(t, p) {
        return t * t * t * p;
    },

    b3(t, p0, p1, p2, p3) {
        return this.b3p0(t, p0) + this.b3p1(t, p1) + this.b3p2(t, p2) + this.b3p3(t, p3);
    },

    //------------------------------------------------------------------------------------------------------------------
    // Geometry
    //------------------------------------------------------------------------------------------------------------------

    /**
     * Calculates the normal vector of a triangle.
     *
     * @private
     */
    triangleNormal(a, b, c, normal = math.vec3()) {
        const p1x = b[0] - a[0];
        const p1y = b[1] - a[1];
        const p1z = b[2] - a[2];

        const p2x = c[0] - a[0];
        const p2y = c[1] - a[1];
        const p2z = c[2] - a[2];

        const p3x = p1y * p2z - p1z * p2y;
        const p3y = p1z * p2x - p1x * p2z;
        const p3z = p1x * p2y - p1y * p2x;

        const mag = Math.sqrt(p3x * p3x + p3y * p3y + p3z * p3z);
        if (mag === 0) {
            normal[0] = 0;
            normal[1] = 0;
            normal[2] = 0;
        } else {
            normal[0] = p3x / mag;
            normal[1] = p3y / mag;
            normal[2] = p3z / mag;
        }

        return normal
    },

    /**
     * Finds the intersection of a 3D ray with a 3D triangle.
     *
     * @private
     */
    rayTriangleIntersect: ((() => {

        const tempVec3 = new Float32Array(3);
        const tempVec3b = new Float32Array(3);
        const tempVec3c = new Float32Array(3);
        const tempVec3d = new Float32Array(3);
        const tempVec3e = new Float32Array(3);

        return (origin, dir, a, b, c, isect) => {

            isect = isect || math.vec3();

            const EPSILON = 0.000001;

            const edge1 = math.subVec3(b, a, tempVec3);
            const edge2 = math.subVec3(c, a, tempVec3b);

            const pvec = math.cross3Vec3(dir, edge2, tempVec3c);
            const det = math.dotVec3(edge1, pvec);
            if (det < EPSILON) {
                return null;
            }

            const tvec = math.subVec3(origin, a, tempVec3d);
            const u = math.dotVec3(tvec, pvec);
            if (u < 0 || u > det) {
                return null;
            }

            const qvec = math.cross3Vec3(tvec, edge1, tempVec3e);
            const v = math.dotVec3(dir, qvec);
            if (v < 0 || u + v > det) {
                return null;
            }

            const t = math.dotVec3(edge2, qvec) / det;
            isect[0] = origin[0] + t * dir[0];
            isect[1] = origin[1] + t * dir[1];
            isect[2] = origin[2] + t * dir[2];

            return isect;
        };
    }))(),

    /**
     * Finds the intersection of a 3D ray with a plane defined by 3 points.
     *
     * @private
     */
    rayPlaneIntersect: ((() => {

        const tempVec3 = new Float32Array(3);
        const tempVec3b = new Float32Array(3);
        const tempVec3c = new Float32Array(3);
        const tempVec3d = new Float32Array(3);

        return (origin, dir, a, b, c, isect) => {

            isect = isect || math.vec3();

            dir = math.normalizeVec3(dir, tempVec3);

            const edge1 = math.subVec3(b, a, tempVec3b);
            const edge2 = math.subVec3(c, a, tempVec3c);

            const n = math.cross3Vec3(edge1, edge2, tempVec3d);
            math.normalizeVec3(n, n);

            const d = -math.dotVec3(a, n);

            const t = -(math.dotVec3(origin, n) + d) / math.dotVec3(dir, n);

            isect[0] = origin[0] + t * dir[0];
            isect[1] = origin[1] + t * dir[1];
            isect[2] = origin[2] + t * dir[2];

            return isect;
        };
    }))(),

    /**
     * Gets barycentric coordinates from cartesian coordinates within a triangle.
     * Gets barycentric coordinates from cartesian coordinates within a triangle.
     *
     * @private
     */
    cartesianToBarycentric: ((() => {

        const tempVec3 = new Float32Array(3);
        const tempVec3b = new Float32Array(3);
        const tempVec3c = new Float32Array(3);

        return (cartesian, a, b, c, dest) => {

            const v0 = math.subVec3(c, a, tempVec3);
            const v1 = math.subVec3(b, a, tempVec3b);
            const v2 = math.subVec3(cartesian, a, tempVec3c);

            const dot00 = math.dotVec3(v0, v0);
            const dot01 = math.dotVec3(v0, v1);
            const dot02 = math.dotVec3(v0, v2);
            const dot11 = math.dotVec3(v1, v1);
            const dot12 = math.dotVec3(v1, v2);

            const denom = ( dot00 * dot11 - dot01 * dot01 );

            // Colinear or singular triangle

            if (denom === 0) {

                // Arbitrary location outside of triangle

                return null;
            }

            const invDenom = 1 / denom;

            const u = ( dot11 * dot02 - dot01 * dot12 ) * invDenom;
            const v = ( dot00 * dot12 - dot01 * dot02 ) * invDenom;

            dest[0] = 1 - u - v;
            dest[1] = v;
            dest[2] = u;

            return dest;
        };
    }))(),

    /**
     * Returns true if the given barycentric coordinates are within their triangle.
     *
     * @private
     */
    barycentricInsideTriangle(bary) {

        const v = bary[1];
        const u = bary[2];

        return (u >= 0) && (v >= 0) && (u + v < 1);
    },

    /**
     * Gets cartesian coordinates from barycentric coordinates within a triangle.
     *
     * @private
     */
    barycentricToCartesian(bary, a, b, c, cartesian = math.vec3()) {
        const u = bary[0];
        const v = bary[1];
        const w = bary[2];

        cartesian[0] = a[0] * u + b[0] * v + c[0] * w;
        cartesian[1] = a[1] * u + b[1] * v + c[1] * w;
        cartesian[2] = a[2] * u + b[2] * v + c[2] * w;

        return cartesian;
    },

    /**
     * Given geometry defined as an array of positions, optional normals, option uv and an array of indices, returns
     * modified arrays that have duplicate vertices removed.
     *
     * Note: does not work well when co-incident vertices have same positions but different normals and UVs.
     *
     * @param positions
     * @param normals
     * @param uv
     * @param indices
     * @returns {{positions: Array, indices: Array}}
     * @private
     */
    mergeVertices(positions, normals, uv, indices) {
        const positionsMap = {}; // Hashmap for looking up vertices by position coordinates (and making sure they are unique)
        const indicesLookup = [];
        const uniquePositions = [];
        const uniqueNormals = normals ? [] : null;
        const uniqueUV = uv ? [] : null;
        const indices2 = [];
        let vx;
        let vy;
        let vz;
        let key;
        const precisionPoints = 4; // number of decimal points, e.g. 4 for epsilon of 0.0001
        const precision = 10 ** precisionPoints;
        let i;
        let len;
        let uvi = 0;
        for (i = 0, len = positions.length; i < len; i += 3) {
            vx = positions[i];
            vy = positions[i + 1];
            vz = positions[i + 2];
            key = `${Math.round(vx * precision)}_${Math.round(vy * precision)}_${Math.round(vz * precision)}`;
            if (positionsMap[key] === undefined) {
                positionsMap[key] = uniquePositions.length / 3;
                uniquePositions.push(vx);
                uniquePositions.push(vy);
                uniquePositions.push(vz);
                if (normals) {
                    uniqueNormals.push(normals[i]);
                    uniqueNormals.push(normals[i + 1]);
                    uniqueNormals.push(normals[i + 2]);
                }
                if (uv) {
                    uniqueUV.push(uv[uvi]);
                    uniqueUV.push(uv[uvi + 1]);
                }
            }
            indicesLookup[i / 3] = positionsMap[key];
            uvi += 2;
        }
        for (i = 0, len = indices.length; i < len; i++) {
            indices2[i] = indicesLookup[indices[i]];
        }
        const result = {
            positions: uniquePositions,
            indices: indices2
        };
        if (uniqueNormals) {
            result.normals = uniqueNormals;
        }
        if (uniqueUV) {
            result.uv = uniqueUV;

        }
        return result;
    },

    /**
     * Builds normal vectors from positions and indices.
     *
     * @private
     */
    buildNormals: ((() => {

        const a = new Float32Array(3);
        const b = new Float32Array(3);
        const c = new Float32Array(3);
        const ab = new Float32Array(3);
        const ac = new Float32Array(3);
        const crossVec = new Float32Array(3);

        return (positions, indices, normals) => {

            let i;
            let len;
            const nvecs = new Array(positions.length / 3);
            let j0;
            let j1;
            let j2;

            for (i = 0, len = indices.length; i < len; i += 3) {

                j0 = indices[i];
                j1 = indices[i + 1];
                j2 = indices[i + 2];

                a[0] = positions[j0 * 3];
                a[1] = positions[j0 * 3 + 1];
                a[2] = positions[j0 * 3 + 2];

                b[0] = positions[j1 * 3];
                b[1] = positions[j1 * 3 + 1];
                b[2] = positions[j1 * 3 + 2];

                c[0] = positions[j2 * 3];
                c[1] = positions[j2 * 3 + 1];
                c[2] = positions[j2 * 3 + 2];

                math.subVec3(b, a, ab);
                math.subVec3(c, a, ac);

                const normVec = new Float32Array(3);

                math.normalizeVec3(math.cross3Vec3(ab, ac, crossVec), normVec);

                if (!nvecs[j0]) {
                    nvecs[j0] = [];
                }
                if (!nvecs[j1]) {
                    nvecs[j1] = [];
                }
                if (!nvecs[j2]) {
                    nvecs[j2] = [];
                }

                nvecs[j0].push(normVec);
                nvecs[j1].push(normVec);
                nvecs[j2].push(normVec);
            }

            normals = (normals && normals.length === positions.length) ? normals : new Float32Array(positions.length);

            let count;
            let x;
            let y;
            let z;

            for (i = 0, len = nvecs.length; i < len; i++) {  // Now go through and average out everything

                count = nvecs[i].length;

                x = 0;
                y = 0;
                z = 0;

                for (let j = 0; j < count; j++) {
                    x += nvecs[i][j][0];
                    y += nvecs[i][j][1];
                    z += nvecs[i][j][2];
                }

                normals[i * 3] = (x / count);
                normals[i * 3 + 1] = (y / count);
                normals[i * 3 + 2] = (z / count);
            }

            return normals;
        };
    }))(),

    /**
     * Builds vertex tangent vectors from positions, UVs and indices.
     *
     * @private
     */
    buildTangents: ((() => {

        const tempVec3 = new Float32Array(3);
        const tempVec3b = new Float32Array(3);
        const tempVec3c = new Float32Array(3);
        const tempVec3d = new Float32Array(3);
        const tempVec3e = new Float32Array(3);
        const tempVec3f = new Float32Array(3);
        const tempVec3g = new Float32Array(3);

        return (positions, indices, uv) => {

            const tangents = new Float32Array(positions.length);

            // The vertex arrays needs to be calculated
            // before the calculation of the tangents

            for (let location = 0; location < indices.length; location += 3) {

                // Recontructing each vertex and UV coordinate into the respective vectors

                let index = indices[location];

                const v0 = positions.subarray(index * 3, index * 3 + 3);
                const uv0 = uv.subarray(index * 2, index * 2 + 2);

                index = indices[location + 1];

                const v1 = positions.subarray(index * 3, index * 3 + 3);
                const uv1 = uv.subarray(index * 2, index * 2 + 2);

                index = indices[location + 2];

                const v2 = positions.subarray(index * 3, index * 3 + 3);
                const uv2 = uv.subarray(index * 2, index * 2 + 2);

                const deltaPos1 = math.subVec3(v1, v0, tempVec3);
                const deltaPos2 = math.subVec3(v2, v0, tempVec3b);

                const deltaUV1 = math.subVec2(uv1, uv0, tempVec3c);
                const deltaUV2 = math.subVec2(uv2, uv0, tempVec3d);

                const r = 1 / ((deltaUV1[0] * deltaUV2[1]) - (deltaUV1[1] * deltaUV2[0]));

                const tangent = math.mulVec3Scalar(
                    math.subVec3(
                        math.mulVec3Scalar(deltaPos1, deltaUV2[1], tempVec3e),
                        math.mulVec3Scalar(deltaPos2, deltaUV1[1], tempVec3f),
                        tempVec3g
                    ),
                    r,
                    tempVec3f
                );

                // Average the value of the vectors

                let addTo;

                for (let v = 0; v < 3; v++) {
                    addTo = indices[location + v] * 3;
                    tangents[addTo] += tangent[0];
                    tangents[addTo + 1] += tangent[1];
                    tangents[addTo + 2] += tangent[2];
                }
            }

            return tangents;
        };
    }))(),

    /**
     * Builds vertex and index arrays needed by color-indexed triangle picking.
     *
     * @private
     */
    buildPickTriangles(positions, indices, quantized) {

        const numIndices = indices.length;
        const pickPositions = quantized ? new Uint16Array(numIndices * 9) : new Float32Array(numIndices * 9);
        const pickColors = new Uint8Array(numIndices * 12);
        let primIndex = 0;
        let vi;// Positions array index
        let pvi = 0;// Picking positions array index
        let pci = 0; // Picking color array index

        // Triangle indices
        let i;
        let r;
        let g;
        let b;
        let a;

        for (let location = 0; location < numIndices; location += 3) {

            // Primitive-indexed triangle pick color

            a = (primIndex >> 24 & 0xFF);
            b = (primIndex >> 16 & 0xFF);
            g = (primIndex >> 8 & 0xFF);
            r = (primIndex & 0xFF);

            // A

            i = indices[location];
            vi = i * 3;

            pickPositions[pvi++] = positions[vi];
            pickPositions[pvi++] = positions[vi + 1];
            pickPositions[pvi++] = positions[vi + 2];

            pickColors[pci++] = r;
            pickColors[pci++] = g;
            pickColors[pci++] = b;
            pickColors[pci++] = a;

            // B

            i = indices[location + 1];
            vi = i * 3;

            pickPositions[pvi++] = positions[vi];
            pickPositions[pvi++] = positions[vi + 1];
            pickPositions[pvi++] = positions[vi + 2];

            pickColors[pci++] = r;
            pickColors[pci++] = g;
            pickColors[pci++] = b;
            pickColors[pci++] = a;

            // C

            i = indices[location + 2];
            vi = i * 3;

            pickPositions[pvi++] = positions[vi];
            pickPositions[pvi++] = positions[vi + 1];
            pickPositions[pvi++] = positions[vi + 2];

            pickColors[pci++] = r;
            pickColors[pci++] = g;
            pickColors[pci++] = b;
            pickColors[pci++] = a;

            primIndex++;
        }

        return {
            positions: pickPositions,
            colors: pickColors
        };
    },

    /**
     * Converts surface-perpendicular face normals to vertex normals. Assumes that the mesh contains disjoint triangles
     * that don't share vertex array elements. Works by finding groups of vertices that have the same location and
     * averaging their normal vectors.
     *
     * @returns {{positions: Array, normals: *}}
     */
    faceToVertexNormals(positions, normals, options = {}) {
        const smoothNormalsAngleThreshold = options.smoothNormalsAngleThreshold || 20;
        const vertexMap = {};
        const vertexNormals = [];
        const vertexNormalAccum = {};
        let acc;
        let vx;
        let vy;
        let vz;
        let key;
        const precisionPoints = 4; // number of decimal points, e.g. 4 for epsilon of 0.0001
        const precision = 10 ** precisionPoints;
        let posi;
        let i;
        let j;
        let len;
        let a;
        let b;
        for (i = 0, len = positions.length; i < len; i += 3) {

            posi = i / 3;

            vx = positions[i];
            vy = positions[i + 1];
            vz = positions[i + 2];

            key = `${Math.round(vx * precision)}_${Math.round(vy * precision)}_${Math.round(vz * precision)}`;

            if (vertexMap[key] === undefined) {
                vertexMap[key] = [posi];
            } else {
                vertexMap[key].push(posi);
            }

            const normal = math.normalizeVec3([normals[i], normals[i + 1], normals[i + 2]]);

            vertexNormals[posi] = normal;

            acc = math.vec4([normal[0], normal[1], normal[2], 1]);

            vertexNormalAccum[posi] = acc;
        }

        for (key in vertexMap) {

            if (vertexMap.hasOwnProperty(key)) {

                const vertices = vertexMap[key];
                const numVerts = vertices.length;

                for (i = 0; i < numVerts; i++) {

                    const ii = vertices[i];

                    acc = vertexNormalAccum[ii];

                    for (j = 0; j < numVerts; j++) {

                        if (i === j) {
                            continue;
                        }

                        const jj = vertices[j];

                        a = vertexNormals[ii];
                        b = vertexNormals[jj];

                        const angle = Math.abs(math.angleVec3(a, b) / math.DEGTORAD);

                        if (angle < smoothNormalsAngleThreshold) {

                            acc[0] += b[0];
                            acc[1] += b[1];
                            acc[2] += b[2];
                            acc[3] += 1.0;
                        }
                    }
                }
            }
        }

        for (i = 0, len = normals.length; i < len; i += 3) {

            acc = vertexNormalAccum[i / 3];

            normals[i + 0] = acc[0] / acc[3];
            normals[i + 1] = acc[1] / acc[3];
            normals[i + 2] = acc[2] / acc[3];

        }
    },

    //------------------------------------------------------------------------------------------------------------------
    // Ray casting
    //------------------------------------------------------------------------------------------------------------------

    /**
     Transforms a Canvas-space position into a World-space ray, in the context of a Camera.
     @method canvasPosToWorldRay
     @static
     @param {Camera} camera The Camera.
     @param {Float32Array} canvasPos The Canvas-space position.
     @param {Float32Array} worldRayOrigin The World-space ray origin.
     @param {Float32Array} worldRayDir The World-space ray direction.
     */
    canvasPosToWorldRay: ((() => {

        const tempMat4b = new Float32Array(16);
        const tempMat4c = new Float32Array(16);
        const tempVec4a = new Float32Array(4);
        const tempVec4b = new Float32Array(4);
        const tempVec4c = new Float32Array(4);
        const tempVec4d = new Float32Array(4);

        return (camera, canvasPos, worldRayOrigin, worldRayDir) => {

            const canvas = camera.scene.canvas.canvas;

            const viewMat = camera.viewMatrix;
            const projMat = camera.projection === "ortho" ? camera.ortho.matrix : camera.perspective.matrix;

            const pvMat = math.mulMat4(projMat, viewMat, tempMat4b);
            const pvMatInverse = math.inverseMat4(pvMat, tempMat4c);

            // Calculate clip space coordinates, which will be in range
            // of x=[-1..1] and y=[-1..1], with y=(+1) at top

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            const clipX = (canvasPos[0] - canvasWidth / 2) / (canvasWidth / 2);  // Calculate clip space coordinates
            const clipY = -(canvasPos[1] - canvasHeight / 2) / (canvasHeight / 2);

            tempVec4a[0] = clipX;
            tempVec4a[1] = clipY;
            tempVec4a[2] = -1;
            tempVec4a[3] = 1;

            math.transformVec4(pvMatInverse, tempVec4a, tempVec4b);
            math.mulVec4Scalar(tempVec4b, 1 / tempVec4b[3]);

            tempVec4c[0] = clipX;
            tempVec4c[1] = clipY;
            tempVec4c[2] = 1;
            tempVec4c[3] = 1;

            math.transformVec4(pvMatInverse, tempVec4c, tempVec4d);
            math.mulVec4Scalar(tempVec4d, 1 / tempVec4d[3]);

            worldRayOrigin[0] = tempVec4d[0];
            worldRayOrigin[1] = tempVec4d[1];
            worldRayOrigin[2] = tempVec4d[2];

            math.subVec3(tempVec4d, tempVec4b, worldRayDir);

            math.normalizeVec3(worldRayDir);
        };
    }))(),

    /**
     Transforms a Canvas-space position to a Mesh's Local-space coordinate system, in the context of a Camera.
     @method canvasPosToLocalRay
     @static
     @param {Camera} camera The Camera.
     @param {Mesh} mesh The Mesh.
     @param {Float32Array} canvasPos The Canvas-space position.
     @param {Float32Array} localRayOrigin The Local-space ray origin.
     @param {Float32Array} localRayDir The Local-space ray direction.
     */
    canvasPosToLocalRay: ((() => {

        const worldRayOrigin = new Float32Array(3);
        const worldRayDir = new Float32Array(3);

        return (camera, mesh, canvasPos, localRayOrigin, localRayDir) => {
            math.canvasPosToWorldRay(camera, canvasPos, worldRayOrigin, worldRayDir);
            math.worldRayToLocalRay(mesh, worldRayOrigin, worldRayDir, localRayOrigin, localRayDir);
        };
    }))(),

    /**
     Transforms a ray from World-space to a Mesh's Local-space coordinate system.
     @method worldRayToLocalRay
     @static
     @param {Mesh} mesh The Mesh.
     @param {Float32Array} worldRayOrigin The World-space ray origin.
     @param {Float32Array} worldRayDir The World-space ray direction.
     @param {Float32Array} localRayOrigin The Local-space ray origin.
     @param {Float32Array} localRayDir The Local-space ray direction.
     */
    worldRayToLocalRay: ((() => {

        const tempMat4 = new Float32Array(16);
        const tempVec4a = new Float32Array(4);
        const tempVec4b = new Float32Array(4);

        return (mesh, worldRayOrigin, worldRayDir, localRayOrigin, localRayDir) => {

            const modelMat = mesh.worldMatrix || mesh.matrix;
            const modelMatInverse = math.inverseMat4(modelMat, tempMat4);

            tempVec4a[0] = worldRayOrigin[0];
            tempVec4a[1] = worldRayOrigin[1];
            tempVec4a[2] = worldRayOrigin[2];
            tempVec4a[3] = 1;

            math.transformVec4(modelMatInverse, tempVec4a, tempVec4b);

            localRayOrigin[0] = tempVec4b[0];
            localRayOrigin[1] = tempVec4b[1];
            localRayOrigin[2] = tempVec4b[2];

            math.transformVec3(modelMatInverse, worldRayDir, localRayDir);
        };
    }))(),

    buildKDTree: ((() => {

        const KD_TREE_MAX_DEPTH = 10;
        const KD_TREE_MIN_TRIANGLES = 20;

        const dimLength = new Float32Array();

        function buildNode(triangles, indices, positions, depth) {
            const aabb = new Float32Array(6);

            const node = {
                triangles: null,
                left: null,
                right: null,
                leaf: false,
                splitDim: 0,
                aabb
            };

            aabb[0] = aabb[1] = aabb[2] = Number.POSITIVE_INFINITY;
            aabb[3] = aabb[4] = aabb[5] = Number.NEGATIVE_INFINITY;

            let t;
            let len;

            for (t = 0, len = triangles.length; t < len; ++t) {
                var ii = triangles[t] * 3;
                for (let j = 0; j < 3; ++j) {
                    const pi = indices[ii + j] * 3;
                    if (positions[pi] < aabb[0]) {
                        aabb[0] = positions[pi];
                    }
                    if (positions[pi] > aabb[3]) {
                        aabb[3] = positions[pi];
                    }
                    if (positions[pi + 1] < aabb[1]) {
                        aabb[1] = positions[pi + 1];
                    }
                    if (positions[pi + 1] > aabb[4]) {
                        aabb[4] = positions[pi + 1];
                    }
                    if (positions[pi + 2] < aabb[2]) {
                        aabb[2] = positions[pi + 2];
                    }
                    if (positions[pi + 2] > aabb[5]) {
                        aabb[5] = positions[pi + 2];
                    }
                }
            }

            if (triangles.length < KD_TREE_MIN_TRIANGLES || depth > KD_TREE_MAX_DEPTH) {
                node.triangles = triangles;
                node.leaf = true;
                return node;
            }

            dimLength[0] = aabb[3] - aabb[0];
            dimLength[1] = aabb[4] - aabb[1];
            dimLength[2] = aabb[5] - aabb[2];

            let dim = 0;

            if (dimLength[1] > dimLength[dim]) {
                dim = 1;
            }

            if (dimLength[2] > dimLength[dim]) {
                dim = 2;
            }

            node.splitDim = dim;

            const mid = (aabb[dim] + aabb[dim + 3]) / 2;
            const left = new Array(triangles.length);
            let numLeft = 0;
            const right = new Array(triangles.length);
            let numRight = 0;

            for (t = 0, len = triangles.length; t < len; ++t) {

                var ii = triangles[t] * 3;
                const i0 = indices[ii];
                const i1 = indices[ii + 1];
                const i2 = indices[ii + 2];

                const pi0 = i0 * 3;
                const pi1 = i1 * 3;
                const pi2 = i2 * 3;

                if (positions[pi0 + dim] <= mid || positions[pi1 + dim] <= mid || positions[pi2 + dim] <= mid) {
                    left[numLeft++] = triangles[t];
                } else {
                    right[numRight++] = triangles[t];
                }
            }

            left.length = numLeft;
            right.length = numRight;

            node.left = buildNode(left, indices, positions, depth + 1);
            node.right = buildNode(right, indices, positions, depth + 1);

            return node;
        }

        return (indices, positions) => {
            const numTris = indices.length / 3;
            const triangles = new Array(numTris);
            for (let i = 0; i < numTris; ++i) {
                triangles[i] = i;
            }
            return buildNode(triangles, indices, positions, 0);
        };
    }))()
};

// Fast queue that avoids using potentially inefficient array .shift() calls
// Based on https://github.com/creationix/fastqueue

class Queue {

    constructor() {

        this._head = [];
        this._headLength = 0;
        this._tail = [];
        this._index = 0;
        this._length = 0;
    }

    get length() {
        return this._length;
    }

    shift() {
        if (this._index >= this._headLength) {
            const t = this._head;
            t.length = 0;
            this._head = this._tail;
            this._tail = t;
            this._index = 0;
            this._headLength = this._head.length;
            if (!this._headLength) {
                return;
            }
        }
        const value = this._head[this._index];
        if (this._index < 0) {
            delete this._head[this._index++];
        }
        else {
            this._head[this._index++] = undefined;
        }
        this._length--;
        return value;
    }

    push(item) {
        this._length++;
        this._tail.push(item);
        return this;
    };

    unshift(item) {
        this._head[--this._index] = item;
        this._length++;
        return this;
    }
}

const taskQueue = new Queue(); // Task queue, which is pumped on each frame; tasks are pushed to it with calls to xeogl.schedule

const tasks = {

    /**
     Schedule a task for xeogl to run at the next frame.

     Internally, this pushes the task to a FIFO queue. Within each frame interval, xeogl processes the queue
     for a certain period of time, popping tasks and running them. After each frame interval, tasks that did not
     get a chance to run during the task are left in the queue to be run next time.

     @method scheduleTask
     @param {Function} callback Callback that runs the task.
     @param {Object} [scope] Scope for the callback.
     */
    scheduleTask(callback, scope) {
        taskQueue.push(callback);
        taskQueue.push(scope);
    },

    runTasks(until) { // Pops and processes tasks in the queue, until the given number of milliseconds has elapsed.
        let time = (new Date()).getTime();
        let callback;
        let scope;
        let tasksRun = 0;
        while (taskQueue.length > 0 && time < until) {
            callback = taskQueue.shift();
            scope = taskQueue.shift();
            if (scope) {
                callback.call(scope);
            } else {
                callback();
            }
            time = (new Date()).getTime();
            tasksRun++;
        }
        return tasksRun;
    },

    getNumTasks() {
        return taskQueue.length;
    }
};

/**
 * Map of xeogl component classes.
 *
 * This assists:
 *
 * - validation of construction of component assemblies
 * - instantiation of components from JSON (ie. where the JSON specifies the class name in 'type')
 */
const componentClasses = {
};

/**
 The **Component** class is the base class for all xeogl components.

 ## Usage

 * [Component IDs](#component-ids)
 * [Metadata](#metadata)
 * [Logging](#logging)
 * [Destruction](#destruction)
 * [Creating custom Components](#creating-custom-components)

 ### Component IDs

 Every Component has an ID that's unique within the parent {{#crossLink "Scene"}}{{/crossLink}}. xeogl generates
 the IDs automatically by default, however you can also specify them yourself. In the example below, we're creating a
 scene comprised of {{#crossLink "Scene"}}{{/crossLink}}, {{#crossLink "Material"}}{{/crossLink}}, {{#crossLink "Geometry"}}{{/crossLink}} and
 {{#crossLink "Mesh"}}{{/crossLink}} components, while letting xeogl generate its own ID for
 the {{#crossLink "Geometry"}}{{/crossLink}}:

 ````javascript
 // The Scene is a Component too
 var scene = new xeogl.Scene({
    id: "myScene"
 });

 var material = new xeogl.PhongMaterial(scene, {
    id: "myMaterial"
 });

 var geometry = new xeogl.Geometry(scene, {
    id: "myGeometry"
 });

 // Let xeogl automatically generate the ID for our Mesh
 var mesh = new xeogl.Mesh(scene, {
    material: material,
    geometry: geometry
 });
 ````

 We can then find those components like this:

 ````javascript
 // Find the Scene
 var theScene = xeogl.scenes["myScene"];

 // Find the Material
 var theMaterial = theScene.components["myMaterial"];

 // Find all PhongMaterials in the Scene
 var phongMaterials = theScene.types["xeogl.PhongMaterial"];

 // Find our Material within the PhongMaterials
 var theMaterial = phongMaterials["myMaterial"];
 ````

 ### Component inheritance


 TODO

 All xeogl components are (at least indirect) subclasses of the Component base type.

 For most components, you can get the name of its class via its {{#crossLink "Component/type:property"}}{{/crossLink}} property:

 ````javascript
 var type = theMaterial.type; // "xeogl.PhongMaterial"
 ````

 You can also test if a component implements or extends a given component class, like so:

 ````javascript
 // Evaluates true:
 var isComponent = theMaterial.isType("xeogl.Component");

 // Evaluates true:
 var isMaterial = theMaterial.isType("xeogl.Material");

 // Evaluates true:
 var isPhongMaterial = theMaterial.isType("xeogl.PhongMaterial");

 // Evaluates false:
 var isMetallicMaterial = theMaterial.isType("xeogl.MetallicMaterial");
 ````

 ### Metadata

 You can set optional **metadata** on your Components, which can be anything you like. These are intended
 to help manage your components within your application code or content pipeline. You could use metadata to attach
 authoring or version information, like this:

 ````javascript
 // Scene with authoring metadata
 var scene = new xeogl.Scene({
    id: "myScene",
    meta: {
        title: "My bodacious 3D scene",
        author: "@xeographics",
        date: "February 30 2018"
    }
 });

 // Material with descriptive metadata
 var material = new xeogl.PhongMaterial(scene, {
    id: "myMaterial",
    diffuse: [1, 0, 0],
    meta: {
        description: "Bright red color with no textures",
        version: "0.1",
        foo: "bar"
    }
 });
 ````

 ### Logging

 Components have methods to log ID-prefixed messages to the JavaScript console:

 ````javascript
 material.log("Everything is fine, situation normal.");
 material.warn("Wait, whats that red light?");
 material.error("Aw, snap!");
 ````

 The logged messages will look like this in the console:

 ````text
 [LOG]   myMaterial: Everything is fine, situation normal.
 [WARN]  myMaterial: Wait, whats that red light..
 [ERROR] myMaterial: Aw, snap!
 ````

 ### Destruction

 Get notification of destruction directly on the Components:

 ````javascript
 material.on("destroyed", function() {
    this.log("Component was destroyed: " + this.id);
 });
 ````

 Or get notification of destruction of any Component within its {{#crossLink "Scene"}}{{/crossLink}}, indiscriminately:

 ````javascript
 scene.on("componentDestroyed", function(component) {
    this.log("Component was destroyed: " + component.id);
 });
 ````

 Then destroy a component like this:

 ````javascript
 material.destroy();
 ````

 ### Creating custom Components

 Subclassing a Component to create a new ````xeogl.ColoredTorus```` type:

 ````javascript
 class ColoredTorus extends xeogl.Component{

     get type() {
        return "ColoredTorus";
     }

     constructor(scene=null, cfg) { // Constructor

         super(scene. cfg);

         this._torus = new xeogl.Mesh({
             geometry: new xeogl.TorusGeometry({radius: 2, tube: .6}),
             material: new xeogl.MetallicMaterial({
                 baseColor: [1.0, 0.5, 0.5],
                 roughness: 0.4,
                 metallic: 0.1
             })
         });

         this.color = cfg.color;
     },

     set color(color) {
         this._torus.material.baseColor = color;
     }

     get color() {
         return this._torus.material.baseColor;
     }

     destroy() {
         super.destroy();
         this._torus.geometry.destroy();
         this._torus.material.destroy();
         this._torus.destroy();
     }
 };
 ````

 #### Examples

 * [Custom component definition](../../examples/#extending_component_basic)
 * [Custom component that fires events](../../examples/#extending_component_changeEvents)
 * [Custom component that manages child components](../../examples/#extending_component_childCleanup)
 * [Custom component that schedules asynch tasks](../../examples/#extending_component_update)

 @class Component
 @module xeogl
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} DepthBuf configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Component.
 */

const type = "xeogl.Component";

class Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type;
    }

    constructor() {

        var cfg = {};

        var arg1 = arguments[0];
        var arg2 = arguments[1];

        var owner = null;

        /**
         The parent {{#crossLink "Scene"}}{{/crossLink}} that contains this Component.

         @property scene
         @type {Scene}
         @final
         */
        this.scene = null;

        if (this.type === "xeogl.Scene") {
            this.scene = this;
            if (arg1) {
                cfg = arg1;
            }
        } else {
            if (arg1) {
                if (arg1.type === "xeogl.Scene") {
                    this.scene = arg1;
                    owner = this.scene;
                    if (arg2) {
                        cfg = arg2;
                    }

                } else if (arg1 instanceof Component) {
                    this.scene = arg1.scene;
                    owner = arg1;
                    if (arg2) {
                        cfg = arg2;
                    }

                } else {
                    // Create this component within the default xeogl Scene
                    this.scene = core.getDefaultScene();
                    owner = this.scene;
                    cfg = arg1;
                }
            } else {
                // Create this component within the default xeogl Scene
                this.scene = core.getDefaultScene();
                owner = this.scene;
            }
            this._renderer = this.scene._renderer;
        }

        this._dontClear = !!cfg.dontClear; // Prevent Scene#clear from destroying this component

        this._model = null;
        this._renderer = this.scene._renderer;

        /**
         Arbitrary, user-defined metadata on this component.

         @property metadata
         @type Object
         */
        this.meta = cfg.meta || {};

        /**
         Unique ID for this Component within its parent {{#crossLink "Scene"}}Scene{{/crossLink}}.

         @property id
         @type String
         @final
         */
        this.id = cfg.id; // Auto-generated by xeogl.Scene by default

        /**
         True as soon as this Component has been destroyed

         @property destroyed
         @type Boolean
         */
        this.destroyed = false;

        this._attached = {}; // Attached components with names.
        this._attachments = null; // Attached components keyed to IDs - lazy-instantiated
        this._subIdMap = null; // Subscription subId pool
        this._subIdEvents = null; // Subscription subIds mapped to event names
        this._eventSubs = null; // Event names mapped to subscribers
        this._events = null; // Maps names to events
        this._eventCallDepth = 0; // Helps us catch stack overflows from recursive events
        this._adoptees = null; // // Components created with #create - lazy-instantiated

        if (this !== this.scene) { // Don't add scene to itself
            this.scene._addComponent(this); // Assigns this component an automatic ID if not yet assigned
        }

        this._updateScheduled = false; // True when #_update will be called on next tick

        this.init(cfg);

        if (owner) {
            owner._adopt(this);
        }
    }

    init() { // No-op

    }

    _addedToModel(model) { // Called by xeogl.Model.add()
        this._model = model;
    }

    _removedFromModel(model) { // Called by xeogl.Model.remove()
        this._model = null;
    }

    /**
     The {{#crossLink "Model"}}{{/crossLink}} which contains this Component, if any.

     Will be null if this Component is not in a Model.

     @property model
     @final
     @type Model
     */
    get model() {
        return this._model;
    }

    /**
     Tests if this component is of the given type, or is a subclass of the given type.

     The type may be given as either a string or a component constructor.

     This method works by walking up the inheritance type chain, which this component provides in
     property {{#crossLink "Component/superTypes:property"}}{{/crossLink}}, returning true as soon as one of the type strings in
     the chain matches the given type, of false if none match.

     #### Examples:

     ````javascript
     var myRotate = new xeogl.Rotate({ ... });

     myRotate.isType(xeogl.Component); // Returns true for all xeogl components
     myRotate.isType("xeogl.Component"); // Returns true for all xeogl components
     myRotate.isType(xeogl.Rotate); // Returns true
     myRotate.isType(xeogl.Transform); // Returns true
     myRotate.isType("xeogl.Transform"); // Returns true
     myRotate.isType(xeogl.Mesh); // Returns false, because xeogl.Rotate does not (even indirectly) extend xeogl.Mesh
     ````

     @method isType
     @param  {String|Function} type Component type to compare with, eg "xeogl.PhongMaterial", or a xeogl component constructor.
     @returns {Boolean} True if this component is of given type or is subclass of the given type.
     */
    isType(type) {
        if (!utils.isString(type)) {
            type = type.type;
            if (!type) {
                return false;
            }
        }
        return core.isComponentType(this.type, type);
    }

    /**
     * Fires an event on this component.
     *
     * Notifies existing subscribers to the event, optionally retains the event to give to
     * any subsequent notifications on the event as they are made.
     *
     * @method fire
     * @param {String} event The event type name
     * @param {Object} value The event parameters
     * @param {Boolean} [forget=false] When true, does not retain for subsequent subscribers
     */
    fire(event, value, forget) {
        if (!this._events) {
            this._events = {};
        }
        if (!this._eventSubs) {
            this._eventSubs = {};
        }
        if (forget !== true) {
            this._events[event] = value || true; // Save notification
        }
        const subs = this._eventSubs[event];
        let sub;
        if (subs) { // Notify subscriptions
            for (const subId in subs) {
                if (subs.hasOwnProperty(subId)) {
                    sub = subs[subId];
                    this._eventCallDepth++;
                    if (this._eventCallDepth < 300) {
                        sub.callback.call(sub.scope, value);
                    } else {
                        this.error("fire: potential stack overflow from recursive event '" + event + "' - dropping this event");
                    }
                    this._eventCallDepth--;
                }
            }
        }
    }

    /**
     * Subscribes to an event on this component.
     *
     * The callback is be called with this component as scope.
     *
     * @method on
     * @param {String} event The event
     * @param {Function} callback Called fired on the event
     * @param {Object} [scope=this] Scope for the callback
     * @return {String} Handle to the subscription, which may be used to unsubscribe with {@link #off}.
     */
    on(event, callback, scope) {
        if (!this._events) {
            this._events = {};
        }
        if (!this._subIdMap) {
            this._subIdMap = new Map(); // Subscription subId pool
        }
        if (!this._subIdEvents) {
            this._subIdEvents = {};
        }
        if (!this._eventSubs) {
            this._eventSubs = {};
        }
        let subs = this._eventSubs[event];
        if (!subs) {
            subs = {};
            this._eventSubs[event] = subs;
        }
        const subId = this._subIdMap.addItem(); // Create unique subId
        subs[subId] = {
            callback: callback,
            scope: scope || this
        };
        this._subIdEvents[subId] = event;
        const value = this._events[event];
        if (value !== undefined) { // A publication exists, notify callback immediately
            callback.call(scope || this, value);
        }
        return subId;
    }

    /**
     * Cancels an event subscription that was previously made with {{#crossLink "Component/on:method"}}Component#on(){{/crossLink}} or
     * {{#crossLink "Component/once:method"}}Component#once(){{/crossLink}}.
     *
     * @method off
     * @param {String} subId Publication subId
     */
    off(subId) {
        if (subId === undefined || subId === null) {
            return;
        }
        if (!this._subIdEvents) {
            return;
        }
        const event = this._subIdEvents[subId];
        if (event) {
            delete this._subIdEvents[subId];
            const subs = this._eventSubs[event];
            if (subs) {
                delete subs[subId];
            }
            this._subIdMap.removeItem(subId); // Release subId
        }
    }

    /**
     * Subscribes to the next occurrence of the given event, then un-subscribes as soon as the event is subIdd.
     *
     * This is equivalent to calling {{#crossLink "Component/on:method"}}Component#on(){{/crossLink}}, and then calling
     * {{#crossLink "Component/off:method"}}Component#off(){{/crossLink}} inside the callback function.
     *
     * @method once
     * @param {String} event Data event to listen to
     * @param {Function(data)} callback Called when fresh data is available at the event
     * @param {Object} [scope=this] Scope for the callback
     */
    once(event, callback, scope) {
        const self = this;
        const subId = this.on(event,
            function (value) {
                self.off(subId);
                callback(value);
            },
            scope);
    }

    /**
     * Returns true if there are any subscribers to the given event on this component.
     *
     * @method hasSubs
     * @param {String} event The event
     * @return {Boolean} True if there are any subscribers to the given event on this component.
     */
    hasSubs(event) {
        return (this._eventSubs && !!this._eventSubs[event]);
    }

    /**
     * Logs a console debugging message for this component.
     *
     * The console message will have this format: *````[LOG] [<component type> <component id>: <message>````*
     *
     * Also fires the message as a {{#crossLink "Scene/log:event"}}{{/crossLink}} event on the
     * parent {{#crossLink "Scene"}}Scene{{/crossLink}}.
     *
     * @method log
     * @param {String} message The message to log
     */
    log(message) {
        message = "[LOG]" + this._message(message);
        window.console.log(message);
        this.scene.fire("log", message);
    }

    _message(message) {
        return " [" + this.type + " " + utils.inQuotes(this.id) + "]: " + message;
    }

    /**
     * Logs a warning for this component to the JavaScript console.
     *
     * The console message will have this format: *````[WARN] [<component type> =<component id>: <message>````*
     *
     * Also fires the message as a {{#crossLink "Scene/warn:event"}}{{/crossLink}} event on the
     * parent {{#crossLink "Scene"}}Scene{{/crossLink}}.
     *
     * @method warn
     * @param {String} message The message to log
     */
    warn(message) {
        message = "[WARN]" + this._message(message);
        window.console.warn(message);
        this.scene.fire("warn", message);
    }

    /**
     * Logs an error for this component to the JavaScript console.
     *
     * The console message will have this format: *````[ERROR] [<component type> =<component id>: <message>````*
     *
     * Also fires the message as an {{#crossLink "Scene/error:event"}}{{/crossLink}} event on the
     * parent {{#crossLink "Scene"}}Scene{{/crossLink}}.
     *
     * @method error
     * @param {String} message The message to log
     */
    error(message) {
        message = "[ERROR]" + this._message(message);
        window.console.error(message);
        this.scene.fire("error", message);
    }

    /**
     * Adds a child component to this.
     * When component not given, attaches the scene's default instance for the given name (if any).
     * Publishes the new child component on this component, keyed to the given name.
     *
     * @param {*} params
     * @param {String} params.name component name
     * @param {Component} [params.component] The component
     * @param {String} [params.type] Optional expected type of base type of the child; when supplied, will
     * cause an exception if the given child is not the same type or a subtype of this.
     * @param {Boolean} [params.sceneDefault=false]
     * @param {Boolean} [params.sceneSingleton=false]
     * @param {Function} [params.onAttached] Optional callback called when component attached
     * @param {Function} [params.onAttached.callback] Callback function
     * @param {Function} [params.onAttached.scope] Optional scope for callback
     * @param {Function} [params.onDetached] Optional callback called when component is detached
     * @param {Function} [params.onDetached.callback] Callback function
     * @param {Function} [params.onDetached.scope] Optional scope for callback
     * @param {{String:Function}} [params.on] Callbacks to subscribe to properties on component
     * @param {Boolean} [params.recompiles=true] When true, fires "dirty" events on this component
     * @private
     */
    _attach(params) {

        const name = params.name;

        if (!name) {
            this.error("Component 'name' expected");
            return;
        }

        let component = params.component;
        const sceneDefault = params.sceneDefault;
        const sceneSingleton = params.sceneSingleton;
        const type = params.type;
        const on = params.on;
        const recompiles = params.recompiles !== false;

        // True when child given as config object, where parent manages its instantiation and destruction
        let managingLifecycle = false;

        if (component) {

            if (utils.isNumeric(component) || utils.isString(component)) {

                // Component ID given
                // Both numeric and string IDs are supported

                const id = component;

                component = this.scene.components[id];

                if (!component) {

                    // Quote string IDs in errors

                    this.error("Component not found: " + utils.inQuotes(id));
                    return;
                }

            } else if (utils.isObject(component)) {

                // Component config given

                const componentCfg = component;
                const componentType = componentCfg.type || type || "xeogl.Component";
                const componentClass = componentClasses[componentType];

                if (!componentClass) {
                    this.error("Component type not found: " + componentType);
                    return;
                }

                if (type) {
                    if (!core.isComponentType(componentType, type)) {
                        this.error("Expected a " + type + " type or subtype, not a " + componentType);
                        return;
                    }
                }

                component = new componentClass(this.scene, componentCfg);

                managingLifecycle = true;
            }
        }

        if (!component) {

            if (sceneSingleton === true) {

                // Using the first instance of the component type we find

                const instances = this.scene.types[type];
                for (const id2 in instances) {
                    if (instances.hasOwnProperty) {
                        component = instances[id2];
                        break;
                    }
                }

                if (!component) {
                    this.error("Scene has no default component for '" + name + "'");
                    return null;
                }

            } else if (sceneDefault === true) {

                // Using a default scene component

                component = this.scene[name];

                if (!component) {
                    this.error("Scene has no default component for '" + name + "'");
                    return null;
                }
            }
        }

        if (component) {

            if (component.scene.id !== this.scene.id) {
                this.error("Not in same scene: " + component.type + " " + utils.inQuotes(component.id));
                return;
            }

            if (type) {

                if (!component.isType(type)) {
                    this.error("Expected a " + type + " type or subtype: " + component.type + " " + utils.inQuotes(component.id));
                    return;
                }
            }
        }

        if (!this._attachments) {
            this._attachments = {};
        }

        const oldComponent = this._attached[name];
        let subs;
        let i;
        let len;

        if (oldComponent) {

            if (component && oldComponent.id === component.id) {

                // Reject attempt to reattach same component
                return;
            }

            const oldAttachment = this._attachments[oldComponent.id];

            // Unsubscribe from events on old component

            subs = oldAttachment.subs;

            for (i = 0, len = subs.length; i < len; i++) {
                oldComponent.off(subs[i]);
            }

            delete this._attached[name];
            delete this._attachments[oldComponent.id];

            const onDetached = oldAttachment.params.onDetached;
            if (onDetached) {
                if (utils.isFunction(onDetached)) {
                    onDetached(oldComponent);
                } else {
                    onDetached.scope ? onDetached.callback.call(onDetached.scope, oldComponent) : onDetached.callback(oldComponent);
                }
            }

            if (oldAttachment.managingLifecycle) {

                // Note that we just unsubscribed from all events fired by the child
                // component, so destroying it won't fire events back at us now.

                oldComponent.destroy();
            }
        }

        if (component) {

            // Set and publish the new component on this component

            const attachment = {
                params: params,
                component: component,
                subs: [],
                managingLifecycle: managingLifecycle
            };

            attachment.subs.push(
                component.on("destroyed",
                    function () {
                        attachment.params.component = null;
                        this._attach(attachment.params);
                    },
                    this));

            if (recompiles) {
                attachment.subs.push(
                    component.on("dirty",
                        function () {
                            this.fire("dirty", this);
                        },
                        this));
            }

            this._attached[name] = component;
            this._attachments[component.id] = attachment;

            // Bind destruct listener to new component to remove it
            // from this component when destroyed

            const onAttached = params.onAttached;
            if (onAttached) {
                if (utils.isFunction(onAttached)) {
                    onAttached(component);
                } else {
                    onAttached.scope ? onAttached.callback.call(onAttached.scope, component) : onAttached.callback(component);
                }
            }

            if (on) {

                let event;
                let subIdr;
                let callback;
                let scope;

                for (event in on) {
                    if (on.hasOwnProperty(event)) {

                        subIdr = on[event];

                        if (utils.isFunction(subIdr)) {
                            callback = subIdr;
                            scope = null;
                        } else {
                            callback = subIdr.callback;
                            scope = subIdr.scope;
                        }

                        if (!callback) {
                            continue;
                        }

                        attachment.subs.push(component.on(event, callback, scope));
                    }
                }
            }
        }

        if (recompiles) {
            this.fire("dirty", this); // FIXME: May trigger spurous mesh recompilations unless able to limit with param?
        }

        this.fire(name, component); // Component can be null

        return component;
    }

    _checkComponent(expectedType, component) {
        if (utils.isObject(component)) {
            if (component.type) {
                if (!core.isComponentType(component.type, expectedType)) {
                    this.error("Expected a " + expectedType + " type or subtype: " + component.type + " " + utils.inQuotes(component.id));
                    return;
                }
            } else {
                component.type = expectedType;
            }
            component = new componentClasses[component.type](this.scene, component);
        } else {
            if (utils.isID(component)) { // Expensive test
                const id = component;
                component = this.scene.components[id];
                if (!component) {
                    this.error("Component not found: " + utils.inQuotes(component.id));
                    return;
                }
            }
        }
        if (component.scene.id !== this.scene.id) {
            this.error("Not in same scene: " + component.type + " " + utils.inQuotes(component.id));
            return;
        }
        if (!component.isType(expectedType)) {
            this.error("Expected a " + expectedType + " type or subtype: " + component.type + " " + utils.inQuotes(component.id));
            return;
        }
        return component;
    }

    /**
     * Convenience method for creating a Component within this Component's {{#crossLink "Scene"}}{{/crossLink}}.
     *
     * The method is given a component configuration, like so:
     *
     * ````javascript
     * var material = myComponent.create({
     *      type: "xeogl.PhongMaterial",
     *      diffuse: [1,0,0],
     *      specular: [1,1,0]
     * }, "myMaterial");
     * ````
     *
     * @method create
     * @param {*} [cfg] Configuration for the component instance.
     * @returns {*}
     */
    create(cfg) {

        let type;
        let claz;

        if (utils.isObject(cfg)) {
            type = cfg.type || "xeogl.Component";
            claz = componentClasses[type];

        } else if (utils.isString(cfg)) {
            type = cfg;
            claz = componentClasses[type];

        } else {
            claz = cfg;
            type = cfg.prototype.type;
            // TODO: catch unknown component class
        }

        if (!claz) {
            this.error("Component type not found: " + type);
            return;
        }

        if (!core.isComponentType(type, "xeogl.Component")) {
            this.error("Expected a xeogl.Component type or subtype");
            return;
        }

        if (cfg && cfg.id && this.components[cfg.id]) {
            this.error("Component " + utils.inQuotes(cfg.id) + " already exists in Scene - ignoring ID, will randomly-generate instead");
            cfg.id = undefined;
            //return null;
        }

        const component = new claz(this, cfg);
        if (component) {
            this._adopt(component);
        }

        return component;
    }

    _adopt(component) {
        if (!this._adoptees) {
            this._adoptees = {};
        }
        if (!this._adoptees[component.id]) {
            this._adoptees[component.id] = component;
        }
        component.on("destroyed", function () {
            delete this._adoptees[component.id];
        }, this);
    }

    /**
     * Protected method, called by sub-classes to queue a call to _update().
     * @protected
     * @param {Number} [priority=1]
     */
    _needUpdate(priority) {
        if (!this._updateScheduled) {
            this._updateScheduled = true;
            if (priority === 0) {
                this._doUpdate();
            } else {
                tasks.scheduleTask(this._doUpdate, this);
            }
        }
    }

    /**
     * @private
     */
    _doUpdate() {
        if (this._updateScheduled) {
            this._updateScheduled = false;
            if (this._update) {
                this._update();
            }
        }
    }

    /**
     * Protected virtual template method, optionally implemented
     * by sub-classes to perform a scheduled task.
     *
     * @protected
     */
    _update() {
    }

    /**
     * Destroys this component.
     *
     * Fires a {{#crossLink "Component/destroyed:event"}}{{/crossLink}} event on this Component.
     *
     * Automatically disassociates this component from other components, causing them to fall back on any
     * defaults that this component overrode on them.
     *
     * TODO: describe effect with respect to #create
     *
     * @method destroy
     */
    destroy() {

        if (this.destroyed) {
            return;
        }

        // Unsubscribe from child components and destroy then

        let id;
        let attachment;
        let component;
        let subs;
        let i;
        let len;

        if (this._attachments) {
            for (id in this._attachments) {
                if (this._attachments.hasOwnProperty(id)) {
                    attachment = this._attachments[id];
                    component = attachment.component;
                    subs = attachment.subs;
                    for (i = 0, len = subs.length; i < len; i++) {
                        component.off(subs[i]);
                    }
                    if (attachment.managingLifecycle) {
                        component.destroy();
                    }
                }
            }
        }

        // Release components created with #create

        if (this._adoptees) {
            const ids = Object.keys(this._adoptees);
            for (i = 0, len = ids.length; i < len; i++) {
                component = this._adoptees[ids[i]];
                component.destroy();
            }
        }

        this.scene._removeComponent(this);

        // Memory leak avoidance
        this._attached = {};
        this._attachments = null;
        this._subIdMap = null;
        this._subIdEvents = null;
        this._eventSubs = null;
        this._events = null;
        this._eventCallDepth = 0;
        this._adoptees = null;
        this._updateScheduled = false;

        /**
         * Fired when this Component is destroyed.
         * @event destroyed
         */
        this.fire("destroyed", this.destroyed = true);
    }
}

componentClasses[type] = Component;

/*
 * Canvas2Image v0.1
 * Copyright (c) 2008 Jacob Seidelin, cupboy@gmail.com
 * MIT License [http://www.opensource.org/licenses/mit-license.php]
 */

const Canvas2Image = (function () {
    // check if we have canvas support
    const oCanvas = document.createElement("canvas"), sc = String.fromCharCode, strDownloadMime = "image/octet-stream", bReplaceDownloadMime = false;

    // no canvas, bail out.
    if (!oCanvas.getContext) {
        return {
            saveAsBMP: function () {
            },
            saveAsPNG: function () {
            },
            saveAsJPEG: function () {
            }
        }
    }

    const bHasImageData = !!(oCanvas.getContext("2d").getImageData), bHasDataURL = !!(oCanvas.toDataURL), bHasBase64 = !!(window.btoa);

    // ok, we're good
    const readCanvasData = function (oCanvas) {
        const iWidth = parseInt(oCanvas.width), iHeight = parseInt(oCanvas.height);
        return oCanvas.getContext("2d").getImageData(0, 0, iWidth, iHeight);
    };

    // base64 encodes either a string or an array of charcodes
    const encodeData = function (data) {
        let i, aData, strData = "";

        if (typeof data == "string") {
            strData = data;
        } else {
            aData = data;
            for (i = 0; i < aData.length; i++) {
                strData += sc(aData[i]);
            }
        }
        return btoa(strData);
    };

    // creates a base64 encoded string containing BMP data takes an imagedata object as argument
    const createBMP = function (oData) {
        let strHeader = '';
        const iWidth = oData.width;
        const iHeight = oData.height;

        strHeader += 'BM';

        let iFileSize = iWidth * iHeight * 4 + 54; // total header size = 54 bytes
        strHeader += sc(iFileSize % 256);
        iFileSize = Math.floor(iFileSize / 256);
        strHeader += sc(iFileSize % 256);
        iFileSize = Math.floor(iFileSize / 256);
        strHeader += sc(iFileSize % 256);
        iFileSize = Math.floor(iFileSize / 256);
        strHeader += sc(iFileSize % 256);

        strHeader += sc(0, 0, 0, 0, 54, 0, 0, 0); // data offset
        strHeader += sc(40, 0, 0, 0); // info header size

        let iImageWidth = iWidth;
        strHeader += sc(iImageWidth % 256);
        iImageWidth = Math.floor(iImageWidth / 256);
        strHeader += sc(iImageWidth % 256);
        iImageWidth = Math.floor(iImageWidth / 256);
        strHeader += sc(iImageWidth % 256);
        iImageWidth = Math.floor(iImageWidth / 256);
        strHeader += sc(iImageWidth % 256);

        let iImageHeight = iHeight;
        strHeader += sc(iImageHeight % 256);
        iImageHeight = Math.floor(iImageHeight / 256);
        strHeader += sc(iImageHeight % 256);
        iImageHeight = Math.floor(iImageHeight / 256);
        strHeader += sc(iImageHeight % 256);
        iImageHeight = Math.floor(iImageHeight / 256);
        strHeader += sc(iImageHeight % 256);

        strHeader += sc(1, 0, 32, 0); // num of planes & num of bits per pixel
        strHeader += sc(0, 0, 0, 0); // compression = none

        let iDataSize = iWidth * iHeight * 4;
        strHeader += sc(iDataSize % 256);
        iDataSize = Math.floor(iDataSize / 256);
        strHeader += sc(iDataSize % 256);
        iDataSize = Math.floor(iDataSize / 256);
        strHeader += sc(iDataSize % 256);
        iDataSize = Math.floor(iDataSize / 256);
        strHeader += sc(iDataSize % 256);

        strHeader += sc(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); // these bytes are not used

        const aImgData = oData.data;
        let strPixelData = "";
        let x;
        let y = iHeight;
        let iOffsetX;
        let iOffsetY;
        let strPixelRow;

        do {
            iOffsetY = iWidth * (y - 1) * 4;
            strPixelRow = "";
            for (x = 0; x < iWidth; x++) {
                iOffsetX = 4 * x;
                strPixelRow += sc(
                    aImgData[iOffsetY + iOffsetX + 2], // B
                    aImgData[iOffsetY + iOffsetX + 1], // G
                    aImgData[iOffsetY + iOffsetX],     // R
                    aImgData[iOffsetY + iOffsetX + 3]  // A
                );
            }
            strPixelData += strPixelRow;
        } while (--y);

        return encodeData(strHeader + strPixelData);
    };

    // sends the generated file to the client
    const saveFile = function (strData) {
        if (!window.open(strData)) {
            document.location.href = strData;
        }
    };

    const makeDataURI = function (strData, strMime) {
        return "data:" + strMime + ";base64," + strData;
    };

    // generates a <img> object containing the imagedata
    const makeImageObject = function (strSource) {
        const oImgElement = document.createElement("img");
        oImgElement.src = strSource;
        return oImgElement;
    };

    const scaleCanvas = function (oCanvas, iWidth, iHeight) {
        if (iWidth && iHeight) {
            const oSaveCanvas = document.createElement("canvas");

            oSaveCanvas.width = iWidth;
            oSaveCanvas.height = iHeight;
            oSaveCanvas.style.width = iWidth + "px";
            oSaveCanvas.style.height = iHeight + "px";

            const oSaveCtx = oSaveCanvas.getContext("2d");

            oSaveCtx.drawImage(oCanvas, 0, 0, oCanvas.width, oCanvas.height, 0, 0, iWidth, iWidth);

            return oSaveCanvas;
        }
        return oCanvas;
    };

    return {
        saveAsPNG: function (oCanvas, bReturnImg, iWidth, iHeight) {
            if (!bHasDataURL) return false;

            const oScaledCanvas = scaleCanvas(oCanvas, iWidth, iHeight), strMime = "image/png", strData = oScaledCanvas.toDataURL(strMime);

            if (bReturnImg) {
                return makeImageObject(strData);
            } else {
                saveFile(bReplaceDownloadMime ? strData.replace(strMime, strDownloadMime) : strData);
            }
            return true;
        },

        saveAsJPEG: function (oCanvas, bReturnImg, iWidth, iHeight) {
            if (!bHasDataURL) return false;

            const oScaledCanvas = scaleCanvas(oCanvas, iWidth, iHeight), strMime = "image/jpeg", strData = oScaledCanvas.toDataURL(strMime);

            // check if browser actually supports jpeg by looking for the mime type in the data uri. if not, return false
            if (strData.indexOf(strMime) != 5) return false;

            if (bReturnImg) {
                return makeImageObject(strData);
            } else {
                saveFile(bReplaceDownloadMime ? strData.replace(strMime, strDownloadMime) : strData);
            }
            return true;
        },

        saveAsBMP: function (oCanvas, bReturnImg, iWidth, iHeight) {
            if (!(bHasDataURL && bHasImageData && bHasBase64)) return false;

            const oScaledCanvas = scaleCanvas(oCanvas, iWidth, iHeight), strMime = "image/bmp", oData = readCanvasData(oScaledCanvas), strImgData = createBMP(oData);

            if (bReturnImg) {
                return makeImageObject(makeDataURI(strImgData, strMime));
            } else {
                saveFile(makeDataURI(strImgData, strMime));
            }
            return true;
        }
    };
})();

/**
 A Progress displays a progress animation at the center of its {{#crossLink "Canvas"}}{{/crossLink}} while things are loading or otherwise busy.

 ## Overview

 * Spinners are normally shown by {{#crossLink "Model"}}Models{{/crossLink}} while they are loading, however they may also
 be shown by any application code that wants to indicate busyness.
 * By default, they are also shown by components that load assets, such as {{#crossLink "Texture"}}{{/crossLink}}. You
 can disable that by flipping the Spinner's {{#crossLink "Spinner/textures:property"}}{{/crossLink}} property.
 * A Spinner component has a {{#crossLink "Spinner/processes:property"}}{{/crossLink}} count that indicates how many
 active processes it currently represents. As a process starts, a process would increment {{#crossLink "Spinner/processes:property"}}{{/crossLink}}, then as it
 completes (or fails), would decrement it again.
 * A Spinner is only visible while {{#crossLink "Spinner/processes:property"}}{{/crossLink}} is greater than zero.

 ## Examples

 * [Loading glTF model with spinner](../../examples/#importing_gltf_GearboxAssy)

 ## Usage

 ````javascript
 var spinner = myScene.canvas.spinner;

 // Increment count of busy processes represented by the spinner;
 // assuming the count was zero, this now shows the spinner
 spinner.processes++;

 // Increment the count again, by some other process;
 // spinner already visible, now requires two decrements
 // before it becomes invisible again
 spinner.processes++;

 // Decrement the count; count still greater
 // than zero, so spinner remains visible
 spinner.process--;

 // Decrement the count; count now zero,
 // so spinner becomes invisible
 spinner.process--;
 ````

 By default, a Spinner shows while resources are loading for components like
 {{#crossLink "Texture"}}{{/crossLink}}. We can disable that like this:

 ````javascript
 // Don't show while resources are loading for Textures etc.
 spinner.textures = false;
 ````

 @class Spinner
 @module xeogl
 @submodule canvas
 @extends Component
 */

const type$1 = "xeogl.Spinner";

let spinnerCSSInjected = false; // Ensures lazy-injected CSS only injected once

const spinnerCSS = ".sk-fading-circle {\
        background: transparent;\
        margin: 20px auto;\
        width: 50px;\
        height:50px;\
        position: relative;\
        }\
        .sk-fading-circle .sk-circle {\
        width: 120%;\
        height: 120%;\
        position: absolute;\
        left: 0;\
        top: 0;\
        }\
        .sk-fading-circle .sk-circle:before {\
        content: '';\
        display: block;\
        margin: 0 auto;\
        width: 15%;\
        height: 15%;\
        background-color: #ff8800;\
        border-radius: 100%;\
        -webkit-animation: sk-circleFadeDelay 1.2s infinite ease-in-out both;\
        animation: sk-circleFadeDelay 1.2s infinite ease-in-out both;\
        }\
        .sk-fading-circle .sk-circle2 {\
        -webkit-transform: rotate(30deg);\
        -ms-transform: rotate(30deg);\
        transform: rotate(30deg);\
    }\
    .sk-fading-circle .sk-circle3 {\
        -webkit-transform: rotate(60deg);\
        -ms-transform: rotate(60deg);\
        transform: rotate(60deg);\
    }\
    .sk-fading-circle .sk-circle4 {\
        -webkit-transform: rotate(90deg);\
        -ms-transform: rotate(90deg);\
        transform: rotate(90deg);\
    }\
    .sk-fading-circle .sk-circle5 {\
        -webkit-transform: rotate(120deg);\
        -ms-transform: rotate(120deg);\
        transform: rotate(120deg);\
    }\
    .sk-fading-circle .sk-circle6 {\
        -webkit-transform: rotate(150deg);\
        -ms-transform: rotate(150deg);\
        transform: rotate(150deg);\
    }\
    .sk-fading-circle .sk-circle7 {\
        -webkit-transform: rotate(180deg);\
        -ms-transform: rotate(180deg);\
        transform: rotate(180deg);\
    }\
    .sk-fading-circle .sk-circle8 {\
        -webkit-transform: rotate(210deg);\
        -ms-transform: rotate(210deg);\
        transform: rotate(210deg);\
    }\
    .sk-fading-circle .sk-circle9 {\
        -webkit-transform: rotate(240deg);\
        -ms-transform: rotate(240deg);\
        transform: rotate(240deg);\
    }\
    .sk-fading-circle .sk-circle10 {\
        -webkit-transform: rotate(270deg);\
        -ms-transform: rotate(270deg);\
        transform: rotate(270deg);\
    }\
    .sk-fading-circle .sk-circle11 {\
        -webkit-transform: rotate(300deg);\
        -ms-transform: rotate(300deg);\
        transform: rotate(300deg);\
    }\
    .sk-fading-circle .sk-circle12 {\
        -webkit-transform: rotate(330deg);\
        -ms-transform: rotate(330deg);\
        transform: rotate(330deg);\
    }\
    .sk-fading-circle .sk-circle2:before {\
        -webkit-animation-delay: -1.1s;\
        animation-delay: -1.1s;\
    }\
    .sk-fading-circle .sk-circle3:before {\
        -webkit-animation-delay: -1s;\
        animation-delay: -1s;\
    }\
    .sk-fading-circle .sk-circle4:before {\
        -webkit-animation-delay: -0.9s;\
        animation-delay: -0.9s;\
    }\
    .sk-fading-circle .sk-circle5:before {\
        -webkit-animation-delay: -0.8s;\
        animation-delay: -0.8s;\
    }\
    .sk-fading-circle .sk-circle6:before {\
        -webkit-animation-delay: -0.7s;\
        animation-delay: -0.7s;\
    }\
    .sk-fading-circle .sk-circle7:before {\
        -webkit-animation-delay: -0.6s;\
        animation-delay: -0.6s;\
    }\
    .sk-fading-circle .sk-circle8:before {\
        -webkit-animation-delay: -0.5s;\
        animation-delay: -0.5s;\
    }\
    .sk-fading-circle .sk-circle9:before {\
        -webkit-animation-delay: -0.4s;\
        animation-delay: -0.4s;\
    }\
    .sk-fading-circle .sk-circle10:before {\
        -webkit-animation-delay: -0.3s;\
        animation-delay: -0.3s;\
    }\
    .sk-fading-circle .sk-circle11:before {\
        -webkit-animation-delay: -0.2s;\
        animation-delay: -0.2s;\
    }\
    .sk-fading-circle .sk-circle12:before {\
        -webkit-animation-delay: -0.1s;\
        animation-delay: -0.1s;\
    }\
    @-webkit-keyframes sk-circleFadeDelay {\
        0%, 39%, 100% { opacity: 0; }\
        40% { opacity: 1; }\
    }\
    @keyframes sk-circleFadeDelay {\
        0%, 39%, 100% { opacity: 0; }\
        40% { opacity: 1; }\
    }";

class Spinner extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$1;
    }

    init(cfg) {
        super.init(cfg);
        this._canvas = cfg.canvas;
        this._injectSpinnerCSS();
        const div = document.createElement('div');
        const style = div.style;
        style["z-index"] = "9000";
        style.position = "absolute";
        div.innerHTML = '<div class="sk-fading-circle">\
                <div class="sk-circle1 sk-circle"></div>\
                <div class="sk-circle2 sk-circle"></div>\
                <div class="sk-circle3 sk-circle"></div>\
                <div class="sk-circle4 sk-circle"></div>\
                <div class="sk-circle5 sk-circle"></div>\
                <div class="sk-circle6 sk-circle"></div>\
                <div class="sk-circle7 sk-circle"></div>\
                <div class="sk-circle8 sk-circle"></div>\
                <div class="sk-circle9 sk-circle"></div>\
                <div class="sk-circle10 sk-circle"></div>\
                <div class="sk-circle11 sk-circle"></div>\
                <div class="sk-circle12 sk-circle"></div>\
                </div>';
        this._canvas.parentElement.appendChild(div);
        this._element = div;
        this._adjustPosition();
        this.processes = 0;
    }

    /**
     The number of processes this Spinner represents.

     The Spinner is visible while this property is greater than zero.

     Increment this property whenever you commence some process during which you want
     the Spinner to be visible, then decrement it again when the process is complete.

     Clamps to zero if you attempt to set to to a negative value.

     Fires a {{#crossLink "Spinner/processes:event"}}{{/crossLink}} event on change.

     @property processes
     @default 0
     @type Number
     */
    set processes(value) {
        value = value || 0;
        if (this._processes === value) {
            return;
        }
        if (value < 0) {
            return;
        }
        const prevValue = this._processes;
        this._processes = value;
        this._element.style["visibility"] = (this._processes > 0) ? "visible" : "hidden";
        /**
         Fired whenever this Spinner's {{#crossLink "Spinner/visible:property"}}{{/crossLink}} property changes.

         @event processes
         @param value The property's new value
         */
        this.fire("processes", this._processes);
        if (this._processes === 0 && this._processes !== prevValue) {
            /**
             Fired whenever this Spinner's {{#crossLink "Spinner/visible:property"}}{{/crossLink}} property becomes zero.

             @event zeroProcesses
             */
            this.fire("zeroProcesses", this._processes);
        }
    }

    get processes() {
        return this._processes;
    }

    _adjustPosition() { // (Re)positions spinner DIV over the center of the canvas
        if (!this._canvas || !this._element) {
            return;
        }
        const canvas = this._canvas;
        const spinner = this._element;
        const spinnerStyle = spinner.style;
        spinnerStyle["left"] = (canvas.offsetLeft + (canvas.clientWidth * 0.5) - (spinner.clientWidth * 0.5)) + "px";
        spinnerStyle["top"] = (canvas.offsetTop + (canvas.clientHeight * 0.5) - (spinner.clientHeight * 0.5)) + "px";
    }

    _injectSpinnerCSS() {
        if (spinnerCSSInjected) {
            return;
        }
        const node = document.createElement('style');
        node.innerHTML = spinnerCSS;
        document.body.appendChild(node);
        spinnerCSSInjected = true;
    }
}

const WEBGL_INFO = {
    WEBGL: false,
    SUPPORTED_EXTENSIONS: {}
};

const canvas = document.createElement("canvas");

if (canvas) {

    const gl = canvas.getContext("webgl", {antialias: true}) || canvas.getContext("experimental-webgl", {antialias: true});

    WEBGL_INFO.WEBGL = !!gl;

    if (WEBGL_INFO.WEBGL) {
        WEBGL_INFO.ANTIALIAS = gl.getContextAttributes().antialias;
        if (gl.getShaderPrecisionFormat) {
            if (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0) {
                WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "highp";
            } else if (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT).precision > 0) {
                WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "mediump";
            } else {
                WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "lowp";
            }
        } else {
            WEBGL_INFO.FS_MAX_FLOAT_PRECISION = "mediump";
        }
        WEBGL_INFO.DEPTH_BUFFER_BITS = gl.getParameter(gl.DEPTH_BITS);
        WEBGL_INFO.MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        WEBGL_INFO.MAX_CUBE_MAP_SIZE = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
        WEBGL_INFO.MAX_RENDERBUFFER_SIZE = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        WEBGL_INFO.MAX_TEXTURE_UNITS = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
        WEBGL_INFO.MAX_TEXTURE_IMAGE_UNITS = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        WEBGL_INFO.MAX_VERTEX_ATTRIBS = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
        WEBGL_INFO.MAX_VERTEX_UNIFORM_VECTORS = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
        WEBGL_INFO.MAX_FRAGMENT_UNIFORM_VECTORS = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
        WEBGL_INFO.MAX_VARYING_VECTORS = gl.getParameter(gl.MAX_VARYING_VECTORS);
        gl.getSupportedExtensions().forEach(function (ext) {
            WEBGL_INFO.SUPPORTED_EXTENSIONS[ext] = true;
        });
    }
}

/**
 A **Canvas** manages a {{#crossLink "Scene"}}Scene{{/crossLink}}'s HTML canvas and its WebGL context.

 ## Overview

 * Each {{#crossLink "Scene"}}Scene{{/crossLink}} provides a Canvas as a read-only property on itself.
 * When a {{#crossLink "Scene"}}Scene{{/crossLink}} is configured with the ID of
 an existing <a href="http://www.w3.org/TR/html5/scripting-1.html#the-canvas-element">HTMLCanvasElement</a>, then
 the Canvas will bind to that, otherwise the Canvas will automatically create its own.
 * A Canvas will fire a {{#crossLink "Canvas/boundary:event"}}{{/crossLink}} event whenever
 the <a href="http://www.w3.org/TR/html5/scripting-1.html#the-canvas-element">HTMLCanvasElement</a> resizes.
 * A Canvas is responsible for obtaining a WebGL context from
 the <a href="http://www.w3.org/TR/html5/scripting-1.html#the-canvas-element">HTMLCanvasElement</a>.
 * A Canvas also fires a {{#crossLink "Canvas/webglContextLost:event"}}{{/crossLink}} event when the WebGL context is
 lost, and a {{#crossLink "Canvas/webglContextRestored:event"}}{{/crossLink}} when it is restored again.
 * The various components within the parent {{#crossLink "Scene"}}Scene{{/crossLink}} will transparently recover on
 the {{#crossLink "Canvas/webglContextRestored:event"}}{{/crossLink}} event.

 A Canvas also has

 * a {{#crossLink "Progress"}}{{/crossLink}}, which shows a busy progress when a {{#crossLink "Model"}}{{/crossLink}}
 is loading, or when directed by application logic, and

 ## Examples

 * [Multiple canvases/scenes in a page](../../examples/#scenes_multipleScenes)
 * [Taking canvas snapshots](../../examples/#canvas_snapshot)
 * [Transparent canvas with background image](../../examples/#canvas_transparent)
 * [Canvas with multiple viewports](../../examples/#canvas_multipleViewports)

 ## Usage

 In the example below, we're creating a {{#crossLink "Scene"}}Scene{{/crossLink}} without specifying an HTML canvas element
 for it. This causes the {{#crossLink "Scene"}}Scene{{/crossLink}}'s Canvas component to create its own default element
 within the page. Then we subscribe to various events fired by that Canvas component.

 ```` javascript
 var scene = new xeogl.Scene();

 // Get the Canvas off the Scene
 // Since we did not configure the Scene with the ID of a DOM canvas element,
 // the Canvas will create its own canvas element in the DOM
 var canvas = scene.canvas;

 // Get the WebGL context off the Canvas
 var gl = canvas.gl;

 // Subscribe to Canvas size updates
 canvas.on("boundary", function(boundary) {
    //...
 });

 // Subscribe to WebGL context loss events on the Canvas
 canvas.on("webglContextLost", function() {
        //...
     });

 // Subscribe to WebGL context restored events on the Canvas
 canvas.on("webglContextRestored", function(gl) {
        var newContext = gl;
        //...
     });
 ````

 When we want to bind the Canvas to an existing HTML canvas element, configure the
 {{#crossLink "Scene"}}{{/crossLink}} with the ID of the element, like this:

 ```` javascript
 // Create a Scene, this time configuring it with the
 // ID of an existing DOM canvas element
 var scene = new xeogl.Scene({
          canvasId: "myCanvas"
     });

 // ..and the rest of this example can be the same as the previous example.

 ````

 The {{#crossLink "Scene"}}{{/crossLink}} will attempt to get use WebGL 2, or fall back on WebGL 1
 if that's absent. If you just want WebGL 1, disable WebGL 2 like so:

 ```` javascript
 var scene = new xeogl.Scene({
          canvasId: "myCanvas",
          webgl2 : true
     });

 // ..and the rest of this example can be the same as the previous examples.

 ````


 @class Canvas
 @module xeogl
 @submodule canvas
 @static
 @param {Scene} scene Parent scene
 @extends Component
 */
const type$2 = "xeogl.Canvas";

const WEBGL_CONTEXT_NAMES = [
    "webgl",
    "experimental-webgl",
    "webkit-3d",
    "moz-webgl",
    "moz-glweb20"
];

class Canvas extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$2;
    }

    init(cfg) {

        super.init(cfg);

        /**
         * The HTML canvas. When the {{#crossLink "Viewer"}}{{/crossLink}} was configured with the ID of an existing canvas within the DOM,
         * then this property will be that element, otherwise it will be a full-page canvas that this Canvas has
         * created by default, with a z-index of -10000.
         *
         * @property canvas
         * @type {HTMLCanvasElement}
         * @final
         */
        this.canvas = null;

        /**
         * The WebGL rendering context.
         *
         * @property gl
         * @type {WebGLRenderingContext}
         * @final
         */
        this.gl = null;

        /**
         * True when WebGL 2 support is enabled.
         *
         * @property webgl2
         * @type {Boolean}
         * @final
         */
        this.webgl2 = false; // Will set true in _initWebGL if WebGL is requested and we succeed in getting it.

        /**
         * Indicates whether this Canvas is transparent.
         *
         * @property transparent
         * @type {Boolean}
         * @default {false}
         * @final
         */
        this.transparent = !!cfg.transparent;

        /**
         * Attributes for the WebGL context
         *
         * @type {{}|*}
         */
        this.contextAttr = cfg.contextAttr || {};
        this.contextAttr.alpha = this.transparent;

        if (this.contextAttr.preserveDrawingBuffer === undefined || this.contextAttr.preserveDrawingBuffer === null) {
            this.contextAttr.preserveDrawingBuffer = true;
        }

        this.contextAttr.stencil = false;
        this.contextAttr.antialias = true;
        this.contextAttr.premultipliedAlpha = this.contextAttr.premultipliedAlpha !== false;
        this.contextAttr.antialias = this.contextAttr.antialias !== false;

        if (!cfg.canvas) { // Canvas not supplied, create one automatically
            this._createCanvas();
        } else { // Canvas supplied
            if (utils.isString(cfg.canvas)) { // Canvas ID supplied - find the canvas
                this.canvas = document.getElementById(cfg.canvas);
                if (!this.canvas) { // Canvas not found - create one automatically
                    this.error("Canvas element not found: " + utils.inQuotes(cfg.canvas) + " - creating default canvas instead.");
                    this._createCanvas();
                }
            } else {
                this.canvas = cfg.canvas;
            }
        }

        if (!this.canvas) {
            this.error("Faied to create canvas");
            return;
        }

        // If the canvas uses css styles to specify the sizes make sure the basic
        // width and height attributes match or the WebGL context will use 300 x 150

        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        /**
         * Boundary of the Canvas in absolute browser window coordinates.
         *
         * ### Usage:
         *
         * ````javascript
         * var boundary = myScene.canvas.boundary;
         *
         * var xmin = boundary[0];
         * var ymin = boundary[1];
         * var width = boundary[2];
         * var height = boundary[3];
         * ````
         *
         * @property boundary
         * @type {{Array of Number}}
         * @final
         */
        this.boundary = [
            this.canvas.offsetLeft, this.canvas.offsetTop,
            this.canvas.clientWidth, this.canvas.clientHeight
        ];

        this._createBackground();

        // Get WebGL context

        if (cfg.simulateWebGLContextLost) {
            if (window.WebGLDebugUtils) {
                this.canvas = WebGLDebugUtils.makeLostContextSimulatingCanvas(this.canvas);
            } else {
                this.error("To simulate context loss, please include WebGLDebugUtils");
            }
        }

        this._initWebGL(cfg);

        // Bind context loss and recovery handlers

        const self = this;

        this.canvas.addEventListener("webglcontextlost", this._webglcontextlostListener = function (event) {
                console.time("webglcontextrestored");
                self.scene._webglContextLost();
                /**
                 * Fired whenever the WebGL context has been lost
                 * @event webglcontextlost
                 */
                self.fire("webglcontextlost");
                event.preventDefault();
            },
            false);

        this.canvas.addEventListener("webglcontextrestored", this._webglcontextrestoredListener = function (event) {
                self._initWebGL();
                if (self.gl) {
                    self.scene._webglContextRestored(self.gl);
                    /**
                     * Fired whenever the WebGL context has been restored again after having previously being lost
                     * @event webglContextRestored
                     * @param value The WebGL context object
                     */
                    self.fire("webglcontextrestored", self.gl);
                    event.preventDefault();
                }
                console.timeEnd("webglcontextrestored");
            },
            false);

        // Publish canvas size and position changes on each scene tick

        let lastWindowWidth = null;
        let lastWindowHeight = null;

        let lastCanvasWidth = null;
        let lastCanvasHeight = null;

        let lastCanvasOffsetLeft = null;
        let lastCanvasOffsetTop = null;

        let lastParent = null;

        this._tick = this.scene.on("tick", function () {

            const canvas = self.canvas;

            const newWindowSize = (window.innerWidth !== lastWindowWidth || window.innerHeight !== lastWindowHeight);
            const newCanvasSize = (canvas.clientWidth !== lastCanvasWidth || canvas.clientHeight !== lastCanvasHeight);
            const newCanvasPos = (canvas.offsetLeft !== lastCanvasOffsetLeft || canvas.offsetTop !== lastCanvasOffsetTop);

            const parent = canvas.parentElement;
            const newParent = (parent !== lastParent);

            if (newWindowSize || newCanvasSize || newCanvasPos || newParent) {

                self._spinner._adjustPosition();

                if (newCanvasSize || newCanvasPos) {

                    const newWidth = canvas.clientWidth;
                    const newHeight = canvas.clientHeight;

                    // TODO: Wasteful to re-count pixel size of each canvas on each canvas' resize
                    if (newCanvasSize) {
                        let countPixels = 0;
                        let scene;
                        for (const sceneId in core.scenes) {
                            if (core.scenes.hasOwnProperty(sceneId)) {
                                scene = core.scenes[sceneId];
                                countPixels += scene.canvas.canvas.clientWidth * scene.canvas.canvas.clientHeight;
                            }
                        }
                        stats.memory.pixels = countPixels;

                        canvas.width = canvas.clientWidth;
                        canvas.height = canvas.clientHeight;
                    }

                    const boundary = self.boundary;

                    boundary[0] = canvas.offsetLeft;
                    boundary[1] = canvas.offsetTop;
                    boundary[2] = newWidth;
                    boundary[3] = newHeight;

                    /**
                     * Fired whenever this Canvas's {{#crossLink "Canvas/boundary:property"}}{{/crossLink}} property changes.
                     *
                     * @event boundary
                     * @param value The property's new value
                     */
                    self.fire("boundary", boundary);

                    lastCanvasWidth = newWidth;
                    lastCanvasHeight = newHeight;
                }

                if (newWindowSize) {
                    lastWindowWidth = window.innerWidth;
                    lastWindowHeight = window.innerHeight;
                }

                if (newCanvasPos) {
                    lastCanvasOffsetLeft = canvas.offsetLeft;
                    lastCanvasOffsetTop = canvas.offsetTop;
                }

                lastParent = parent;
            }
        });

        this.canvas.oncontextmenu = function (e) {
            e.preventDefault();
        };

        this._spinner = new Spinner(this.scene, {
            canvas: this.canvas
        });

        // Set property, see definition further down
        this.backgroundColor = cfg.backgroundColor;
        this.backgroundImage = cfg.backgroundImage;
    }

    /**
     * Creates a default canvas in the DOM.
     * @private
     */
    _createCanvas() {

        const canvasId = "xeogl-canvas-" + math.createUUID();
        const body = document.getElementsByTagName("body")[0];
        const div = document.createElement('div');

        const style = div.style;
        style.height = "100%";
        style.width = "100%";
        style.padding = "0";
        style.margin = "0";
        style.background = "rgba(0,0,0,0);";
        style.float = "left";
        style.left = "0";
        style.top = "0";
        style.position = "absolute";
        style.opacity = "1.0";
        style["z-index"] = "-10000";

        div.innerHTML += '<canvas id="' + canvasId + '" style="width: 100%; height: 100%; float: left; margin: 0; padding: 0;"></canvas>';

        body.appendChild(div);

        this.canvas = document.getElementById(canvasId);
    }

    /**
     * Creates a image element behind the canvas, for purpose of showing a custom background.
     * @private
     */
    _createBackground() {

        const div = document.createElement('div');
        const style = div.style;
        style.padding = "0";
        style.margin = "0";
        style.background = null;
        style.backgroundImage = null;
        style.float = "left";
        style.left = "0";
        style.top = "0";
        style.width = "100%";
        style.height = "100%";
        style.position = "absolute";
        style.opacity = 1;
        style["z-index"] = "-20000";

        this.canvas.parentElement.appendChild(div);

        this._backgroundElement = div;
    }

    _getElementXY(e) {
        let x = 0, y = 0;
        while (e) {
            x += (e.offsetLeft - e.scrollLeft);
            y += (e.offsetTop - e.scrollTop);
            e = e.offsetParent;
        }
        return {x: x, y: y};
    }

    /**
     * Initialises the WebGL context
     * @private
     */
    _initWebGL(cfg) {

        // Default context attribute values

        if (!this.gl) {
            for (let i = 0; !this.gl && i < WEBGL_CONTEXT_NAMES.length; i++) {
                try {
                    this.gl = this.canvas.getContext(WEBGL_CONTEXT_NAMES[i], this.contextAttr);
                } catch (e) { // Try with next context name
                }
            }
        }

        if (!this.gl) {

            this.error('Failed to get a WebGL context');

            /**
             * Fired whenever the canvas failed to get a WebGL context, which probably means that WebGL
             * is either unsupported or has been disabled.
             * @event webglContextFailed
             */
            this.fire("webglContextFailed", true, true);
        }

        if (this.gl) {
            // Setup extension (if necessary) and hints for fragment shader derivative functions
            if (this.webgl2) {
                this.gl.hint(this.gl.FRAGMENT_SHADER_DERIVATIVE_HINT, this.gl.FASTEST);
            } else if (WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_standard_derivatives"]) {
                const ext = this.gl.getExtension("OES_standard_derivatives");
                this.gl.hint(ext.FRAGMENT_SHADER_DERIVATIVE_HINT_OES, this.gl.FASTEST);
            }
        }
    }

    /**
     Returns a snapshot of this Canvas as a Base64-encoded image.

     When a callback is given, this method will capture the snapshot asynchronously, on the next animation frame,
     and return it via the callback.

     When no callback is given, this method captures and returns the snapshot immediately. Note that is only
     possible when you have configured the Canvas's {{#crossLink "Scene"}}Scene{{/crossLink}} to preserve the
     WebGL drawing buffer, which has a performance overhead.

     #### Usage:

     ````javascript
     // Get snapshot asynchronously
     myScene.canvas.getSnapshot({
             width: 500, // Defaults to size of canvas
             height: 500,
             format: "png" // Options are "jpeg" (default), "png" and "bmp"
         }, function(imageDataURL) {
             imageElement.src = imageDataURL;
         });

     // Get snapshot synchronously, requires that Scene be
     // configured with preserveDrawingBuffer; true
     imageElement.src = myScene.canvas.getSnapshot({
             width: 500,
             height: 500,
             format: "png"
         });
     ````
     @method getSnapshot
     @param {*} [params] Capture options.
     @param {Number} [params.width] Desired width of result in pixels - defaults to width of canvas.
     @param {Number} [params.height] Desired height of result in pixels - defaults to height of canvas.
     @param {String} [params.format="jpeg"] Desired format; "jpeg", "png" or "bmp".
     @param {Function} [ok] Callback to return the image data when taking a snapshot asynchronously.
     @returns {String} String-encoded image data when taking the snapshot synchronously. Returns null when the ````ok```` callback is given.
     */
    getSnapshot(params, ok) {

        if (!this.canvas) {
            this.error("Can't get snapshot - no canvas.");
            ok(null);
            return;
        }

        if (ok) { // Asynchronous
            const self = this;
            requestAnimationFrame(function () {
                self.scene.render(true); // Force-render a frame
                ok(self._getSnapshot(params));
            });
        } else {
            return this._getSnapshot(params);
        }
    }

    _getSnapshot(params) {
        params = params || {};
        const width = params.width || this.canvas.width;
        const height = params.height || this.canvas.height;
        const format = params.format || "jpeg";
        let image;
        switch (format) {
            case "jpeg":
                image = Canvas2Image.saveAsJPEG(this.canvas, false, width, height);
                break;
            case "png":
                image = Canvas2Image.saveAsPNG(this.canvas, true, width, height);
                break;
            case "bmp":
                image = Canvas2Image.saveAsBMP(this.canvas, true, width, height);
                break;
            default:
                this.error("Unsupported snapshot format: '" + format
                    + "' - supported types are 'jpeg', 'bmp' and 'png' - defaulting to 'jpeg'");
                image = Canvas2Image.saveAsJPEG(this.canvas, true, width, height);
        }
        return image.src;
    }

    /**
     Reads colors of pixels from the last rendered frame.

     <p>Call this method like this:</p>

     ````JavaScript

     // Ignore transparent pixels (default is false)
     var opaqueOnly = true;

     var colors = new Float32Array(8);

     myCanvas.readPixels([ 100, 22, 12, 33 ], colors, 2, opaqueOnly);
     ````

     Then the r,g,b components of the colors will be set to the colors at those pixels.

     @param {Float32Array} pixels
     @param {Float32Array} colors
     @param {Number} size
     @param {Boolean} opaqueOnly
     */
    readPixels(pixels, colors, size, opaqueOnly) {
        return this.scene._renderer.readPixels(pixels, colors, size, opaqueOnly);
    }

    /**
     * Simulates lost WebGL context.
     */
    loseWebGLContext() {
        if (this.canvas.loseContext) {
            this.canvas.loseContext();
        }
    }

    /**
     A background color for the canvas. This is overridden by {{#crossLink "Canvas/backgroundImage:property"}}{{/crossLink}}.

     You can set this to a new color at any time.

     @property backgroundColor
     @type Float32Array
     @default null
     */
    set backgroundColor(value) {
        if (!value) {
            this._backgroundColor = null;
        } else {
            (this._backgroundColor = this._backgroundColor || math.vec4()).set(value || [0, 0, 0, 1]);
            if (!this._backgroundImageSrc) {
                const rgb = "rgb(" + Math.round(this._backgroundColor[0] * 255) + ", " + Math.round(this._backgroundColor[1] * 255) + "," + Math.round(this._backgroundColor[2] * 255) + ")";
                this._backgroundElement.style.background = rgb;
            }
        }
    }

    get backgroundColor() {
        return this._backgroundColor;
    }

    /**
     URL of a background image for the canvas. This is overrided by {{#crossLink "Canvas/backgroundColor/property"}}{{/crossLink}}.

     You can set this to a new file path at any time.

     @property backgroundImage
     @type String
     */
    set backgroundImage(value) {
        if (!value) {
            return;
        }
        if (!utils.isString(value)) {
            this.error("Value for 'backgroundImage' should be a string");
            return;
        }
        if (value === this._backgroundImageSrc) { // Already loaded this image
            return;
        }
        this._backgroundElement.style.backgroundImage = "url('" + value + "')";
        this._backgroundImageSrc = value;
        if (!this._backgroundImageSrc) {
            const rgb = "rgb(" + Math.round(this._backgroundColor[0] * 255) + ", " + Math.round(this._backgroundColor[1] * 255) + "," + Math.round(this._backgroundColor[2] * 255) + ")";
            this._backgroundElement.style.background = rgb;
        }
    }

    get backgroundImage() {
        return this._backgroundImageSrc;
    }

    /**
     The busy {{#crossLink "Spinner"}}{{/crossLink}} for this Canvas.

     @property spinner
     @type Spinner
     @final
     */
    get spinner() {
        return this._spinner;
    }

    destroy() {
        this.scene.off(this._tick);
        // Memory leak avoidance
        this.canvas.removeEventListener("webglcontextlost", this._webglcontextlostListener);
        this.canvas.removeEventListener("webglcontextrestored", this._webglcontextrestoredListener);
        this.canvas = null;
        this.gl = null;
        super.destroy();
    }
}

componentClasses[type$2] = Canvas;

/**
 * @author xeolabs / https://github.com/xeolabs
 */

/**
 * Rendering context for a frame.
 */

class Frame {

    constructor() {
        this.reset();
    }

    reset() {
        this.lastProgramId = null;
        this.backfaces = false;
        this.frontface = true; // true == "ccw" else "cw"
        this.textureUnit = 0;
        this.drawElements = 0;
        this.drawArrays = 0;
        this.useProgram = 0;
        this.bindTexture = 0;
        this.bindArray = 0;
        this.pass = 0;
        this.shadowViewMatrix = null;
        this.shadowProjMatrix = null;
        this.pickViewMatrix = null;
        this.pickProjMatrix = null;
        this.pickmeshIndex = 1;
    }
}

/**
 * @author xeolabs / https://github.com/xeolabs
 */

class RenderBuffer {

    constructor(canvas, gl, options) {
        options = options || {};
        this.gl = gl;
        this.allocated = false;
        this.canvas = canvas;
        this.buffer = null;
        this.bound = false;
        this.size = options.size;
    }

    setSize(size) {
        this.size = size;
    }

    webglContextRestored(gl) {
        this.gl = gl;
        this.buffer = null;
        this.allocated = false;
        this.bound = false;
    }

    bind() {
        this._touch();
        if (this.bound) {
            return;
        }
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.buffer.framebuf);
        this.bound = true;
    }

    _touch() {

        let width;
        let height;
        const gl = this.gl;

        if (this.size) {
            width = this.size[0];
            height = this.size[1];

        } else {
            width = this.canvas.clientWidth;
            height = this.canvas.clientHeight;
        }

        if (this.buffer) {

            if (this.buffer.width === width && this.buffer.height === height) {
                return;

            } else {
                gl.deleteTexture(this.buffer.texture);
                gl.deleteFramebuffer(this.buffer.framebuf);
                gl.deleteRenderbuffer(this.buffer.renderbuf);
            }
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const renderbuf = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuf);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

        const framebuf = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuf);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuf);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Verify framebuffer is OK

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuf);
        if (!gl.isFramebuffer(framebuf)) {
            throw "Invalid framebuffer";
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

        switch (status) {

            case gl.FRAMEBUFFER_COMPLETE:
                break;

            case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                throw "Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_ATTACHMENT";

            case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                throw "Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT";

            case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                throw "Incomplete framebuffer: FRAMEBUFFER_INCOMPLETE_DIMENSIONS";

            case gl.FRAMEBUFFER_UNSUPPORTED:
                throw "Incomplete framebuffer: FRAMEBUFFER_UNSUPPORTED";

            default:
                throw "Incomplete framebuffer: " + status;
        }

        this.buffer = {
            framebuf: framebuf,
            renderbuf: renderbuf,
            texture: texture,
            width: width,
            height: height
        };

        this.bound = false;
    }

    clear() {
        if (!this.bound) {
            throw "Render buffer not bound";
        }
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    read(pickX, pickY) {
        const x = pickX;
        const y = this.canvas.height - pickY;
        const pix = new Uint8Array(4);
        const gl = this.gl;
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pix);
        return pix;
    }

    unbind() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.bound = false;
    }

    getTexture() {
        const self = this;
        return {
            renderBuffer: this,
            bind: function (unit) {
                if (self.buffer && self.buffer.texture) {
                    self.gl.activeTexture(self.gl["TEXTURE" + unit]);
                    self.gl.bindTexture(self.gl.TEXTURE_2D, self.buffer.texture);
                    return true;
                }
                return false;
            },
            unbind: function (unit) {
                if (self.buffer && self.buffer.texture) {
                    self.gl.activeTexture(self.gl["TEXTURE" + unit]);
                    self.gl.bindTexture(self.gl.TEXTURE_2D, null);
                }
            }
        };
    }

    destroy() {
        if (this.allocated) {
            const gl = this.gl;
            gl.deleteTexture(this.buffer.texture);
            gl.deleteFramebuffer(this.buffer.framebuf);
            gl.deleteRenderbuffer(this.buffer.renderbuf);
            this.allocated = false;
            this.buffer = null;
            this.bound = false;
        }
    }
}

const ids = new Map({});

class State {

    constructor(cfg) {
        this.id = ids.addItem({});
        for (const key in cfg) {
            if (cfg.hasOwnProperty(key)) {
                this[key] = cfg[key];
            }
        }
    }

    destroy() {
        ids.removeItem(this.id);
    }
}

/**
 * @author xeolabs / https://github.com/xeolabs
 */

class ArrayBuffer {

    constructor(gl, type, data, numItems, itemSize, usage) {

        this._gl = gl;
        this.type = type;
        this.allocated = false;

        switch (data.constructor) {

            case Uint8Array:
                this.itemType = gl.UNSIGNED_BYTE;
                this.itemByteSize = 1;
                break;

            case Int8Array:
                this.itemType = gl.BYTE;
                this.itemByteSize = 1;
                break;

            case  Uint16Array:
                this.itemType = gl.UNSIGNED_SHORT;
                this.itemByteSize = 2;
                break;

            case  Int16Array:
                this.itemType = gl.SHORT;
                this.itemByteSize = 2;
                break;

            case Uint32Array:
                this.itemType = gl.UNSIGNED_INT;
                this.itemByteSize = 4;
                break;

            case Int32Array:
                this.itemType = gl.INT;
                this.itemByteSize = 4;
                break;

            default:
                this.itemType = gl.FLOAT;
                this.itemByteSize = 4;
        }

        this.usage = usage;
        this.length = 0;
        this.numItems = 0;
        this.itemSize = itemSize;

        this._allocate(data);
    }

    _allocate(data) {
        this.allocated = false;
        this._handle = this._gl.createBuffer();
        if (!this._handle) {
            throw "Failed to allocate WebGL ArrayBuffer";
        }
        if (this._handle) {
            this._gl.bindBuffer(this.type, this._handle);
            this._gl.bufferData(this.type, data, this.usage);
            this._gl.bindBuffer(this.type, null);
            this.length = data.length;
            this.numItems = this.length / this.itemSize;
            this.allocated = true;
        }
    }

    setData(data, offset) {
        if (!this.allocated) {
            return;
        }
        if (data.length > this.length) {            // Needs reallocation
            this.destroy();
            this._allocate(data, data.length);
        } else {            // No reallocation needed
            this._gl.bindBuffer(this.type, this._handle);
            if (offset || offset === 0) {
                this._gl.bufferSubData(this.type, offset * this.itemByteSize, data);
            } else {
                this._gl.bufferData(this.type, data, this.usage);
            }
            this._gl.bindBuffer(this.type, null);
        }
    }

    bind() {
        if (!this.allocated) {
            return;
        }
        this._gl.bindBuffer(this.type, this._handle);
    }

    unbind() {
        if (!this.allocated) {
            return;
        }
        this._gl.bindBuffer(this.type, null);
    }

    destroy() {
        if (!this.allocated) {
            return;
        }
        this._gl.deleteBuffer(this._handle);
        this._handle = null;
        this.allocated = false;
    }
}

const CHUNK_LEN = bigIndicesSupported ? (Number.MAX_SAFE_INTEGER / 6) : (64000 * 4); // RGBA is largest item
const memoryStats = stats.memory;
var bigIndicesSupported = WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"];
const nullVertexBufs = new State({});

class SceneVertexBufs {

    constructor(scene, hasPositions, hasNormals, hasColors, hasUVs, quantized) {

        this.scene = scene;
        this.gl = scene.canvas.gl;
        this.contextLost = false;
        this.geometries = {};
        this.geometryIndicesOffsets = {};
        this.newGeometries = [];
        this.geometryVertexBufs = {};
        this.needRebuild = false;
        this.needAppend = false;
        this.positions = hasPositions ? [] : null;
        this.normals = hasNormals ? [] : null;
        this.colors = hasColors ? [] : null;
        this.uv = hasUVs ? [] : null;
        this.quantized = quantized;
        this.vertexBufs = null;
    }

    addGeometry(geometry) {
        if (!geometry.positions || !geometry.indices) {
            this.scene.warn(`Ignoring geometry with no positions or indices: ${geometry.id}`);
            return;
        }
        this.geometries[geometry.id] = geometry;
        this.geometryIndicesOffsets[geometry.id] = 0; // Will initialize below
        this.newGeometries.push(geometry);
        this.needAppend = true;
    }

    getIndicesOffset(geometry) {
        if (this.needRebuild || this.needAppend) {
            this.build();
        }
        return this.geometryIndicesOffsets[geometry.id];
    }

    getVertexBufs(geometry) {
        if (!this.geometries[geometry.id]) {
            return nullVertexBufs;
        }
        if (this.needRebuild || this.needAppend) {
            this.build();
        }
        return this.geometryVertexBufs[geometry.id];
    }

    setPositions(geometry) {
        const vertexBufs = this.geometryVertexBufs[geometry.id];
        if (!vertexBufs) {
            return;
        }
        if (!geometry.positions) {
            return;
        }
        const positionsBuf = vertexBufs.positionsBuf;
        if (!positionsBuf) {
            return;
        }
        positionsBuf.setData(geometry.positions, this.geometryIndicesOffsets[geometry.id] * 3);
    }

    setNormals(geometry) {
        const vertexBufs = this.geometryVertexBufs[geometry.id];
        if (!vertexBufs) {
            return;
        }
        if (!geometry.normals) {
            return;
        }
        const normalsBuf = vertexBufs.normalsBuf;
        if (!normalsBuf) {
            return;
        }
        normalsBuf.setData(geometry.normals, this.geometryIndicesOffsets[geometry.id] * 3);
    }

    setUVs(geometry) {
        const vertexBufs = this.geometryVertexBufs[geometry.id];
        if (!vertexBufs) {
            return;
        }
        if (!geometry.uv) {
            return;
        }
        const uvBuf = vertexBufs.uvBuf;
        if (!uvBuf) {
            return;
        }
        uvBuf.setData(geometry.uv, this.geometryIndicesOffsets[geometry.id] * 2);
    }

    setColors(geometry) {
        const vertexBufs = this.geometryVertexBufs[geometry.id];
        if (!vertexBufs) {
            return;
        }
        if (!geometry.color) {
            return;
        }
        const colorsBuf = vertexBufs.colorsBuf;
        if (!colorsBuf) {
            return;
        }
        colorsBuf.setData(geometry.colors, this.geometryIndicesOffsets[geometry.id] * 4);
    }

    removeGeometry(geometry) {
        const id = geometry.id;
        if (!this.geometries[id]) {
            return;
        }
        delete this.geometries[id];
        delete this.geometryIndicesOffsets[id];
        if (geometry.indicesBufCombined) {
            geometry.indicesBufCombined.destroy();
        }
        this.needRebuild = true;
    }

    webglContextLost() {
        this.contextLost = true;
    }

    webglContextRestored() {
        if (this.contextLost) {
            for (const id in this.geometries) {
                if (this.geometries.hasOwnProperty(id)) {
                    this.geometries[id].indicesBufCombined = null;
                }
            }
            this.build();
            this.contextLost = false;
        }
    }

    build() {

        const gl = this.scene.canvas.gl;

        this.geometryVertexBufs = {};

        let id;
        let geometry;
        let indicesOffset = 0;

        this.vertexBufs = null;

        let lenPositions = 0;
        let lenNormals = 0;
        let lenUVs = 0;
        let lenColors = 0;

        for (id in this.geometries) {
            if (this.geometries.hasOwnProperty(id)) {
                geometry = this.geometries[id];
                if (this.positions) {
                    lenPositions += geometry.positions.length;
                }
                if (this.normals) {
                    lenNormals += geometry.normals.length;
                }
                if (this.uv) {
                    lenUVs += geometry.uv.length;
                }
                if (this.colors) {
                    lenColors += geometry.uv.length;
                }
            }
        }

        // if (this.positions) {
        //     positions = this.quantized ? new Uint16Array(lenPositions) : new Float32Array(lenPositions);
        // }
        // if (this.normals) {
        //     normals = this.quantized ? new Uint16Array(lenNormals) : new Float32Array(lenNormals);
        // }
        // if (this.uv) {
        //     uv = this.quantized ? new Uint16Array(lenUVs) : new Float32Array(lenUVs);
        // }
        // if (this.colors) {
        //     colors = this.quantized ? new Uint16Array(lenColors) : new Float32Array(lenColors);
        // }

        for (id in this.geometries) {
            if (this.geometries.hasOwnProperty(id)) {

                geometry = this.geometries[id];

                const needNew = (!this.vertexBufs) || (this.positions.length + geometry.positions.length > CHUNK_LEN);

                if (needNew) {
                    if (this.vertexBufs) {
                        this.createBufs(this.vertexBufs);
                    }
                    this.vertexBufs = new State({
                        positionsBuf: null,
                        normalsBuf: null,
                        uvBuf: null,
                        colorsBuf: null,
                        quantized: this.quantized
                    });
                    indicesOffset = 0;
                }

                this.geometryVertexBufs[id] = this.vertexBufs;

                if (this.positions) {
                    for (var i = 0, len = geometry.positions.length; i < len; i++) {
                        this.positions.push(geometry.positions[i]);
                    }
                }

                if (this.normals) {
                    for (var i = 0, len = geometry.normals.length; i < len; i++) {
                        this.normals.push(geometry.normals[i]);
                    }
                }

                if (this.colors) {
                    for (var i = 0, len = geometry.colors.length; i < len; i++) {
                        this.colors.push(geometry.colors[i]);
                    }
                }

                if (this.uv) {
                    for (var i = 0, len = geometry.uv.length; i < len; i++) {
                        this.uv.push(geometry.uv[i]);
                    }
                }

                // Adjust geometry indices

                this.geometryIndicesOffsets[id] = indicesOffset;

                let indices;

                if (indicesOffset) {
                    indices = new (bigIndicesSupported ? Uint32Array : Uint16Array)(geometry.indices);
                    for (var i = 0, len = indices.length; i < len; i++) {
                        indices[i] += indicesOffset;
                        if (indices[i] > (CHUNK_LEN / 3)) {
                            console.error(`out of range: ${indices[i]}`);
                        }
                    }
                } else {
                    indices = geometry.indices;
                }

                // Update indices buffer, lazy-create first if necessary

                if (!geometry.indicesBufCombined) {
                    geometry.indicesBufCombined = new ArrayBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices, indices.length, 1, gl.STATIC_DRAW);
                } else {
                    geometry.indicesBufCombined.setData(indices);
                }

                indicesOffset += geometry.positions.length / 3;
            }
        }

        if (this.vertexBufs) {
            this.createBufs(this.vertexBufs);
        }

        this.needRebuild = false;
        this.needAppend = false;
    }

    createBufs(vertexBufs) {
        const gl = this.scene.canvas.gl;
        let array;
        if (this.positions) {
            array = this.quantized ? new Uint16Array(this.positions) : new Float32Array(this.positions);
            vertexBufs.positionsBuf = new ArrayBuffer(gl, gl.ARRAY_BUFFER, array, array.length, 3, gl.STATIC_DRAW);
            memoryStats.positions += vertexBufs.positionsBuf.numItems;
            this.positions = [];
        }
        if (this.normals) {
            array = this.quantized ? new Int8Array(this.normals) : new Float32Array(this.normals);
            vertexBufs.normalsBuf = new ArrayBuffer(gl, gl.ARRAY_BUFFER, array, array.length, 3, gl.STATIC_DRAW);
            memoryStats.normals += vertexBufs.normalsBuf.numItems;
            this.normals = [];
        }
        if (this.colors) {
            array = new Float32Array(this.colors);
            vertexBufs.colorsBuf = new ArrayBuffer(gl, gl.ARRAY_BUFFER, array, array.length, 4, gl.STATIC_DRAW);
            memoryStats.colors += vertexBufs.colorsBuf.numItems;
            this.colors = [];
        }
        if (this.uv) {
            array = this.quantized ? new Uint16Array(this.uv) : new Float32Array(this.uv);
            vertexBufs.uvBuf = new ArrayBuffer(gl, gl.ARRAY_BUFFER, array, array.length, 2, gl.STATIC_DRAW);
            memoryStats.uvs += vertexBufs.uvBuf.numItems;
            this.uv = [];
        }
    }
}

const getSceneVertexBufs = (scene, geometry) => {
    const hasPositions = !!geometry.positions;
    const quantized = !!geometry.quantized;
    const hasNormals = !!geometry.normals;
    const hasColors = !!geometry.colors;
    const hasUVs = !!geometry.uv;
    const hash = ([scene.id, hasPositions ? "p" : "", quantized ? "c" : "", hasNormals ? "n" : "", hasColors ? "c" : "", hasUVs ? "u" : ""]).join(";");
    if (!scene._sceneVertexBufs) {
        scene._sceneVertexBufs = {};
    }
    let sceneVertexBufs = scene._sceneVertexBufs[hash];
    if (!sceneVertexBufs) {
        sceneVertexBufs = new SceneVertexBufs(scene, hasPositions, hasNormals, hasColors, hasUVs, quantized);
        scene._sceneVertexBufs[hash] = sceneVertexBufs;
    }
    return sceneVertexBufs;
};

/**
 A **Geometry** defines a mesh for attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

 ## Usage

 * [Geometry compression](#geometry-compression)
 * [Geometry batching](#geometry-batching)

 ### Geometry compression

 Geometries may be automatically quantized to reduce memory and GPU bus usage. Usually, geometry attributes such as positions
 and normals are stored as 32-bit floating-point numbers. Quantization compresses those attributes to 16-bit integers
 represented on a scale between the minimum and maximum values. Decompression is then done on the GPU, via a simple
 matrix multiplication in the vertex shader.

 #### Disabling

 Since each normal vector is oct-encoded into two 8-bit unsigned integers, this can cause them to lose precision, which
 may affect the accuracy of any operations that rely on them being perfectly perpendicular to their surfaces. In such
 cases, you may need to disable compression for your geometries and models:

 ````javascript
 // Disable geometry compression when loading a Model
 var model = new xeogl.GLTFModel({
    src: "models/gltf/modern_office/scene.gltf",
    quantizeGeometry: false // Default is true
});

 // Disable compression when creating a Geometry
 var mesh = new xeogl.Mesh({
    geometry: new xeogl.TeapotGeometry({
        quantized: false // Default is false
    }),
    material: new xeogl.PhongMaterial({
        diffuse: [0.2, 0.2, 1.0]
    })
 });
 ````

 ### Geometry batching

 Geometries are automatically combined into the same vertex buffer objects (VBOs) so that we reduce the number of VBO
 binds done by WebGL on each frame. VBO binds are expensive, so this really makes a difference when we have large numbers
 of Meshes that share similar Materials (as is often the case in CAD rendering).

 #### Disabling

 Since combined VBOs need to be rebuilt whenever we destroy a Geometry, we can disable this optimization for individual
 Models and Geometries when we know that we'll be continually creating and destroying them.

 ````javascript
 // Disable VBO combination for a GLTFModel
 var model = new xeogl.GLTFModel({
    src: "models/gltf/modern_office/scene.gltf",
    combinedGeometry: false // Default is true
});

 // Disable VBO combination for an individual Geometry
 var mesh = new xeogl.Mesh({
    geometry: new xeogl.TeapotGeometry({
        combined: false // Default is false
    }),
    material: new xeogl.PhongMaterial({
        diffuse: [0.2, 0.2, 1.0]
    })
 });
 ````

 @class Geometry
 @module xeogl
 @submodule geometry
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}},
 generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Geometry.
 @param [cfg.primitive="triangles"] {String} The primitive type. Accepted values are 'points', 'lines', 'line-loop', 'line-strip', 'triangles', 'triangle-strip' and 'triangle-fan'.
 @param [cfg.positions] {Array of Number} Positions array.
 @param [cfg.normals] {Array of Number} Vertex normal vectors array.
 @param [cfg.uv] {Array of Number} UVs array.
 @param [cfg.colors] {Array of Number} Vertex colors.
 @param [cfg.indices] {Array of Number} Indices array.
 @param [cfg.autoVertexNormals=false] {Boolean} Set true to automatically generate normal vectors from the positions and
 indices, if those are supplied.
 @param [cfg.quantized=false] {Boolean} Stores positions, colors, normals and UVs in quantized and oct-encoded formats
 for reduced memory footprint and GPU bus usage.
 @param [cfg.combined=false] {Boolean} Combines positions, colors, normals and UVs into the same WebGL vertex buffers
 with other Geometries, in order to reduce the number of buffer binds performed per frame.
 @param [cfg.edgeThreshold=2] {Number} When a {{#crossLink "Mesh"}}{{/crossLink}} renders this Geometry as wireframe,
 this indicates the threshold angle (in degrees) between the face normals of adjacent triangles below which the edge is discarded.
 @extends Component
 */

const type$3 = "xeogl.Geometry";

const memoryStats$1 = stats.memory;
var bigIndicesSupported$1 = WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"];
const IndexArrayType$1 = bigIndicesSupported$1 ? Uint32Array : Uint16Array;
const nullVertexBufs$1 = new State({});
const tempAABB = math.AABB3();

class Geometry extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$3;
    }

    init(cfg) {

        super.init(cfg);

        const self = this;

        this._state = new State({ // Arrays for emphasis effects are got from xeogl.Geometry friend methods
            combined: !!cfg.combined,
            quantized: !!cfg.quantized,
            autoVertexNormals: !!cfg.autoVertexNormals,
            primitive: null, // WebGL enum
            primitiveName: null, // String
            positions: null,    // Uint16Array when quantized == true, else Float32Array
            normals: null,      // Uint8Array when quantized == true, else Float32Array
            colors: null,
            uv: null,           // Uint8Array when quantized == true, else Float32Array
            indices: null,
            positionsDecodeMatrix: null, // Set when quantized == true
            uvDecodeMatrix: null, // Set when quantized == true
            positionsBuf: null,
            normalsBuf: null,
            colorsbuf: null,
            uvBuf: null,
            indicesBuf: null,
            indicesBufCombined: null, // Indices into a shared VertexBufs, set when combined == true
            hash: ""
        });

        this._edgeThreshold = cfg.edgeThreshold || 2.0;

        // Lazy-generated VBOs

        this._edgesIndicesBuf = null;
        this._pickTrianglePositionsBuf = null;
        this._pickTriangleColorsBuf = null;

        // Local-space Boundary3D

        this._boundaryDirty = true;

        this._aabb = null;
        this._aabbDirty = true;

        this._obb = null;
        this._obbDirty = true;

        const state = this._state;
        const gl = this.scene.canvas.gl;

        // Primitive type

        cfg.primitive = cfg.primitive || "triangles";
        switch (cfg.primitive) {
            case "points":
                state.primitive = gl.POINTS;
                state.primitiveName = cfg.primitive;
                break;
            case "lines":
                state.primitive = gl.LINES;
                state.primitiveName = cfg.primitive;
                break;
            case "line-loop":
                state.primitive = gl.LINE_LOOP;
                state.primitiveName = cfg.primitive;
                break;
            case "line-strip":
                state.primitive = gl.LINE_STRIP;
                state.primitiveName = cfg.primitive;
                break;
            case "triangles":
                state.primitive = gl.TRIANGLES;
                state.primitiveName = cfg.primitive;
                break;
            case "triangle-strip":
                state.primitive = gl.TRIANGLE_STRIP;
                state.primitiveName = cfg.primitive;
                break;
            case "triangle-fan":
                state.primitive = gl.TRIANGLE_FAN;
                state.primitiveName = cfg.primitive;
                break;
            default:
                this.error("Unsupported value for 'primitive': '" + cfg.primitive +
                    "' - supported values are 'points', 'lines', 'line-loop', 'line-strip', 'triangles', " +
                    "'triangle-strip' and 'triangle-fan'. Defaulting to 'triangles'.");
                state.primitive = gl.TRIANGLES;
                state.primitiveName = cfg.primitive;
        }

        if (cfg.positions) {
            if (this._state.quantized) {
                var bounds = getBounds(cfg.positions, 3);
                var quantized = quantizeVec3(cfg.positions, bounds.min, bounds.max);
                state.positions = quantized.quantized;
                state.positionsDecodeMatrix = quantized.decode;
            } else {
                state.positions = cfg.positions.constructor === Float32Array ? cfg.positions : new Float32Array(cfg.positions);
            }
        }
        if (cfg.colors) {
            state.colors = cfg.colors.constructor === Float32Array ? cfg.colors : new Float32Array(cfg.colors);
        }
        if (cfg.uv) {
            if (this._state.quantized) {
                var bounds = getBounds(cfg.uv, 2);
                var quantized = quantizeVec2(cfg.uv, bounds.min, bounds.max);
                state.uv = quantized.quantized;
                state.uvDecodeMatrix = quantized.decode;
            } else {
                state.uv = cfg.uv.constructor === Float32Array ? cfg.uv : new Float32Array(cfg.uv);
            }
        }
        if (cfg.normals) {
            if (this._state.quantized) {
                state.normals = octEncode(cfg.normals);
            } else {
                state.normals = cfg.normals.constructor === Float32Array ? cfg.normals : new Float32Array(cfg.normals);
            }
        }
        if (cfg.indices) {
            if (!bigIndicesSupported$1 && cfg.indices.constructor === Uint32Array) {
                this.error("This WebGL implementation does not support Uint32Array");
                return;
            }
            state.indices = (cfg.indices.constructor === Uint32Array || cfg.indices.constructor === Uint16Array) ? cfg.indices : new IndexArrayType$1(cfg.indices);
        }

        if (state.indices) {
            state.indicesBuf = new ArrayBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, state.indices, state.indices.length, 1, gl.STATIC_DRAW);
            memoryStats$1.indices += state.indicesBuf.numItems;
        }

        this._buildHash();

        memoryStats$1.meshes++;

        if (this._state.combined) {
            this._sceneVertexBufs = getSceneVertexBufs(this.scene, this._state);
            this._sceneVertexBufs.addGeometry(this._state);
        }

        this._buildVBOs();

        self.fire("created", this.created = true);
    }

    _buildVBOs() {
        const state = this._state;
        const gl = this.scene.canvas.gl;
        if (state.indices) {
            state.indicesBuf = new ArrayBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, state.indices, state.indices.length, 1, gl.STATIC_DRAW);
            memoryStats$1.indices += state.indicesBuf.numItems;
        }
        if (state.combined) {
            if (state.indices) {
                // indicesBufCombined is created when VertexBufs are built for this Geometry
            }
        } else {
            if (state.positions) {
                state.positionsBuf = new ArrayBuffer(gl, gl.ARRAY_BUFFER, state.positions, state.positions.length, 3, gl.STATIC_DRAW);
                memoryStats$1.positions += state.positionsBuf.numItems;
            }
            if (state.normals) {
                state.normalsBuf = new ArrayBuffer(gl, gl.ARRAY_BUFFER, state.normals, state.normals.length, 3, gl.STATIC_DRAW);
                memoryStats$1.normals += state.normalsBuf.numItems;
            }
            if (state.colors) {
                state.colorsBuf = new ArrayBuffer(gl, gl.ARRAY_BUFFER, state.colors, state.colors.length, 4, gl.STATIC_DRAW);
                memoryStats$1.colors += state.colorsBuf.numItems;
            }
            if (state.uv) {
                state.uvBuf = new ArrayBuffer(gl, gl.ARRAY_BUFFER, state.uv, state.uv.length, 2, gl.STATIC_DRAW);
                memoryStats$1.uvs += state.uvBuf.numItems;
            }
        }
    }

    _buildHash() {
        const state = this._state;
        const hash = ["/g"];
        hash.push("/" + state.primitive + ";");
        if (state.positions) {
            hash.push("p");
        }
        if (state.colors) {
            hash.push("c");
        }
        if (state.normals || state.autoVertexNormals) {
            hash.push("n");
        }
        if (state.uv) {
            hash.push("u");
        }
        if (state.quantized) {
            hash.push("cp");
        }
        hash.push(";");
        state.hash = hash.join("");
    }

    _getEdgesIndices() {
        if (!this._edgesIndicesBuf) {
            this._buildEdgesIndices();
        }
        return this._edgesIndicesBuf;
    }

    _getPickTrianglePositions() {
        if (!this._pickTrianglePositionsBuf) {
            this._buildPickTriangleVBOs();
        }
        return this._pickTrianglePositionsBuf;
    }

    _getPickTriangleColors() {
        if (!this._pickTriangleColorsBuf) {
            this._buildPickTriangleVBOs();
        }
        return this._pickTriangleColorsBuf;
    }

    _buildEdgesIndices() { // FIXME: Does not adjust indices after other objects are deleted from vertex buffer!!
        const state = this._state;
        if (!state.positions || !state.indices) {
            return;
        }
        const gl = this.scene.canvas.gl;
        const edgesIndices = buildEdgesIndices(state.positions, state.indices, state.positionsDecodeMatrix, this._edgeThreshold, state.combined);
        if (state.combined) {
            const indicesOffset = this._sceneVertexBufs.getIndicesOffset(state);
            for (let i = 0, len = edgesIndices.length; i < len; i++) {
                edgesIndices[i] += indicesOffset;
            }
        }
        this._edgesIndicesBuf = new ArrayBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, edgesIndices, edgesIndices.length, 1, gl.STATIC_DRAW);
        memoryStats$1.indices += this._edgesIndicesBuf.numItems;
    }

    _buildPickTriangleVBOs() { // Builds positions and indices arrays that allow each triangle to have a unique color
        const state = this._state;
        if (!state.positions || !state.indices) {
            return;
        }
        const gl = this.scene.canvas.gl;
        const arrays = math.buildPickTriangles(state.positions, state.indices, state.quantized);
        const positions = arrays.positions;
        const colors = arrays.colors;
        this._pickTrianglePositionsBuf = new ArrayBuffer(gl, gl.ARRAY_BUFFER, positions, positions.length, 3, gl.STATIC_DRAW);
        this._pickTriangleColorsBuf = new ArrayBuffer(gl, gl.ARRAY_BUFFER, colors, colors.length, 4, gl.STATIC_DRAW, true);
        memoryStats$1.positions += this._pickTrianglePositionsBuf.numItems;
        memoryStats$1.colors += this._pickTriangleColorsBuf.numItems;
    }

    _buildPickVertexVBOs() {
        // var state = this._state;
        // if (!state.positions || !state.indices) {
        //     return;
        // }
        // var gl = this.scene.canvas.gl;
        // var arrays = math.buildPickVertices(state.positions, state.indices, state.quantized);
        // var pickVertexPositions = arrays.positions;
        // var pickColors = arrays.colors;
        // this._pickVertexPositionsBuf = new xeogl.renderer.ArrayBuffer(gl, gl.ARRAY_BUFFER, pickVertexPositions, pickVertexPositions.length, 3, gl.STATIC_DRAW);
        // this._pickVertexColorsBuf = new xeogl.renderer.ArrayBuffer(gl, gl.ARRAY_BUFFER, pickColors, pickColors.length, 4, gl.STATIC_DRAW, true);
        // memoryStats.positions += this._pickVertexPositionsBuf.numItems;
        // memoryStats.colors += this._pickVertexColorsBuf.numItems;
    }

    _webglContextLost() {
        if (this._sceneVertexBufs) {
            this._sceneVertexBufs.webglContextLost();
        }
    }

    _webglContextRestored() {
        if (this._sceneVertexBufs) {
            this._sceneVertexBufs.webglContextRestored();
        }
        this._buildVBOs();
        this._edgesIndicesBuf = null;
        this._pickVertexPositionsBuf = null;
        this._pickTrianglePositionsBuf = null;
        this._pickTriangleColorsBuf = null;
        this._pickVertexPositionsBuf = null;
        this._pickVertexColorsBuf = null;
    }

    /**
     The Geometry's primitive type.

     Valid types are: 'points', 'lines', 'line-loop', 'line-strip', 'triangles', 'triangle-strip' and 'triangle-fan'.

     @property primitive
     @default "triangles"
     @type String
     */
    get primitive() {
        return this._state.primitiveName;
    }

    /**
     Indicates if this Geometry is quantized.

     Compression is an internally-performed optimization which stores positions, colors, normals and UVs
     in quantized and oct-encoded formats for reduced memory footprint and GPU bus usage.

     Quantized geometry may not be updated.

     @property quantized
     @default false
     @type Boolean
     @final
     */
    get quantized() {
        return this._state.quantized;
    }

    /**
     Indicates if this Geometry is combined.

     Combination is an internally-performed optimization which combines positions, colors, normals and UVs into
     the same WebGL vertex buffers with other Geometries, in order to reduce the number of buffer binds
     performed per frame.

     @property combined
     @default false
     @type Boolean
     @final
     */
    get combined() {
        return this._state.combined;
    }

    /**
     The Geometry's vertex positions.

     @property positions
     @default null
     @type Float32Array
     */
    get positions() {
        if (!this._state.positions) {
            return;
        }
        if (!this._state.quantized) {
            return this._state.positions;
        }
        if (!this._decompressedPositions) {
            this._decompressedPositions = new Float32Array(this._state.positions.length);
            math.decompressPositions(this._state.positions, this._state.positionsDecodeMatrix, this._decompressedPositions);
        }
        return this._decompressedPositions;
    }

    set positions(newPositions) {
        const state = this._state;
        const positions = state.positions;
        if (!positions) {
            this.error("can't update geometry positions - geometry has no positions");
            return;
        }
        if (positions.length !== newPositions.length) {
            this.error("can't update geometry positions - new positions are wrong length");
            return;
        }
        if (this._state.quantized) {
            const bounds = getBounds(newPositions, 3);
            const quantized = quantizeVec3(newPositions, bounds.min, bounds.max);
            newPositions = quantized.quantized; // TODO: Copy in-place
            state.positionsDecodeMatrix = quantized.decode;
        }
        positions.set(newPositions);
        if (state.positionsBuf) {
            state.positionsBuf.setData(positions);
        }
        if (this._state.combined) {
            this._sceneVertexBufs.setPositions(state);
        }
        this._setBoundaryDirty();
        this._renderer.imageDirty();
    }

    /**
     The Geometry's vertex normals.

     @property normals
     @default null
     @type Float32Array
     */
    get normals() {
        if (!this._state.normals) {
            return;
        }
        if (!this._state.quantized) {
            return this._state.normals;
        }
        if (!this._decompressedNormals) {
            const lenCompressed = this._state.normals.length;
            const lenDecompressed = lenCompressed + (lenCompressed / 2); // 2 -> 3
            this._decompressedNormals = new Float32Array(lenDecompressed);
            math.octDecodeVec2s(this._state.normals, this._decompressedNormals);
        }
        return this._decompressedNormals;
    }

    set normals(newNormals) {
        if (this._state.quantized) {
            this.error("can't update geometry normals - quantized geometry is immutable"); // But will be eventually
            return;
        }
        const state = this._state;
        const normals = state.normals;
        if (!normals) {
            this.error("can't update geometry normals - geometry has no normals");
            return;
        }
        if (normals.length !== newNormals.length) {
            this.error("can't update geometry normals - new normals are wrong length");
            return;
        }
        normals.set(newNormals);
        if (state.normalsBuf) {
            state.normalsBuf.setData(normals);
        }
        if (this._state.combined) {
            this._sceneVertexBufs.setNormals(state);
        }
        this._renderer.imageDirty();
    }


    /**
     The Geometry's UV coordinates.

     @property uv
     @default null
     @type Float32Array
     */
    get uv() {
        if (!this._state.uv) {
            return;
        }
        if (!this._state.quantized) {
            return this._state.uv;
        }
        if (!this._decompressedUV) {
            this._decompressedUV = new Float32Array(this._state.uv.length);
            math.decompressUVs(this._state.uv, this._state.uvDecodeMatrix, this._decompressedUV);
        }
        return this._decompressedUV;
    }

    set uv(newUV) {
        if (this._state.quantized) {
            this.error("can't update geometry UVs - quantized geometry is immutable"); // But will be eventually
            return;
        }
        const state = this._state;
        const uv = state.uv;
        if (!uv) {
            this.error("can't update geometry UVs - geometry has no UVs");
            return;
        }
        if (uv.length !== newUV.length) {
            this.error("can't update geometry UVs - new UVs are wrong length");
            return;
        }
        uv.set(newUV);
        if (state.uvBuf) {
            state.uvBuf.setData(uv);
        }
        if (this._state.combined) {
            this._sceneVertexBufs.setUVs(state);
        }
        this._renderer.imageDirty();
    }

    /**
     The Geometry's vertex colors.

     @property colors
     @default null
     @type Float32Array
     */
    get colors() {
        return this._state.colors;
    }

    set colors(newColors) {
        if (this._state.quantized) {
            this.error("can't update geometry colors - quantized geometry is immutable"); // But will be eventually
            return;
        }
        const state = this._state;
        const colors = state.colors;
        if (!colors) {
            this.error("can't update geometry colors - geometry has no colors");
            return;
        }
        if (colors.length !== newColors.length) {
            this.error("can't update geometry colors - new colors are wrong length");
            return;
        }
        colors.set(newColors);
        if (state.colorsBuf) {
            state.colorsBuf.setData(colors);
        }
        if (this._state.combined) {
            this._sceneVertexBufs.setColors(state);
        }
        this._renderer.imageDirty();
    }

    /**
     The Geometry's indices.

     If ````xeogl.WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"]```` is true, then this can be
     a ````Uint32Array````, otherwise it needs to be a ````Uint16Array````.

     @property indices
     @default null
     @type Uint16Array | Uint32Array
     @final
     */
    get indices() {
        return this._state.indices;
    }

    /**
     * Local-space axis-aligned 3D boundary (AABB) of this geometry.
     *
     * The AABB is represented by a six-element Float32Array containing the min/max extents of the
     * axis-aligned volume, ie. ````[xmin, ymin,zmin,xmax,ymax, zmax]````.
     *
     * @property aabb
     * @final
     * @type {Float32Array}
     */
    get aabb() {
        if (this._aabbDirty) {
            if (!this._aabb) {
                this._aabb = math.AABB3();
            }
            math.positions3ToAABB3(this._state.positions, this._aabb, this._state.positionsDecodeMatrix);
            this._aabbDirty = false;
        }
        return this._aabb;
    }

    /**
     * Local-space oriented 3D boundary (OBB) of this geometry.
     *
     * The OBB is represented by a 32-element Float32Array containing the eight vertices of the box,
     * where each vertex is a homogeneous coordinate having [x,y,z,w] elements.
     *
     * @property obb
     * @final
     * @type {Float32Array}
     */
    get obb() {
        if (this._obbDirty) {
            if (!this._obb) {
                this._obb = math.OBB3();
            }
            math.positions3ToAABB3(this._state.positions, tempAABB, this._state.positionsDecodeMatrix);
            math.AABB3ToOBB3(tempAABB, this._obb);
            this._obbDirty = false;
        }
        return this._obb;
    }

    get kdtree() {
        const state = this._state;
        if (!state.indices || !state.positions) {
            this.error("Can't provide a KD-tree: no indices/positions");
            return;
        }
        if (!this._kdtree) {
            this._kdtree = math.buildKDTree(state.indices, state.positions, this._state.positionsDecodeMatrix);
        }
        return this._kdtree;
    }

    _setBoundaryDirty() {
        if (this._boundaryDirty) {
            return;
        }
        this._boundaryDirty = true;
        this._aabbDirty = true;
        this._obbDirty = true;

        /**
         Fired whenever this Geometry's boundary changes.

         Get the latest boundary from the Geometry's {{#crossLink "Geometry/aabb:property"}}{{/crossLink}}
         and {{#crossLink "Geometry/obb:property"}}{{/crossLink}} properties.

         @event boundary

         */
        this.fire("boundary");
    }

    _getState() {
        return this._state;
    }

    _getVertexBufs() {
        return this._state && this._state.combined ? this._sceneVertexBufs.getVertexBufs(this._state) : nullVertexBufs$1;
    }

    destroy() {
        super.destroy();
        const state = this._state;
        if (state.indicesBuf) {
            state.indicesBuf.destroy();
        }
        if (this._edgesIndicesBuf) {
            this._edgesIndicesBuf.destroy();
        }
        if (this._pickTrianglePositionsBuf) {
            this._pickTrianglePositionsBuf.destroy();
        }
        if (this._pickTriangleColorsBuf) {
            this._pickTriangleColorsBuf.destroy();
        }
        if (this._pickVertexPositionsBuf) {
            this._pickVertexPositionsBuf.destroy();
        }
        if (this._pickVertexColorsBuf) {
            this._pickVertexColorsBuf.destroy();
        }
        if (this._state.combined) {
            this._sceneVertexBufs.removeGeometry(state);
        }
        state.destroy();
        memoryStats$1.meshes--;
    }
}

function getBounds(array, stride) {
    const min = new Float32Array(stride);
    const max = new Float32Array(stride);
    let i, j;
    for (i = 0; i < stride; i++) {
        min[i] = Number.MAX_VALUE;
        max[i] = -Number.MAX_VALUE;
    }
    for (i = 0; i < array.length; i += stride) {
        for (j = 0; j < stride; j++) {
            min[j] = Math.min(min[j], array[i + j]);
            max[j] = Math.max(max[j], array[i + j]);
        }
    }
    return {
        min: min,
        max: max
    };
}

// http://cg.postech.ac.kr/research/mesh_comp_mobile/mesh_comp_mobile_conference.pdf
var quantizeVec3 = (function () {
    const translate = math.mat4();
    const scale = math.mat4();
    return function (array, min, max) {
        const quantized = new Uint16Array(array.length);
        const multiplier = new Float32Array([
            65535 / (max[0] - min[0]),
            65535 / (max[1] - min[1]),
            65535 / (max[2] - min[2])
        ]);
        let i;
        for (i = 0; i < array.length; i += 3) {
            quantized[i + 0] = Math.floor((array[i + 0] - min[0]) * multiplier[0]);
            quantized[i + 1] = Math.floor((array[i + 1] - min[1]) * multiplier[1]);
            quantized[i + 2] = Math.floor((array[i + 2] - min[2]) * multiplier[2]);
        }
        math.identityMat4(translate);
        math.translationMat4v(min, translate);
        math.identityMat4(scale);
        math.scalingMat4v([
            (max[0] - min[0]) / 65535,
            (max[1] - min[1]) / 65535,
            (max[2] - min[2]) / 65535
        ], scale);
        const decodeMat = math.mulMat4(translate, scale, math.identityMat4());
        return {
            quantized: quantized,
            decode: decodeMat
        };
    };
})();

var quantizeVec2 = (function () {
    const translate = math.mat3();
    const scale = math.mat3();
    return function (array, min, max) {
        const quantized = new Uint16Array(array.length);
        const multiplier = new Float32Array([
            65535 / (max[0] - min[0]),
            65535 / (max[1] - min[1])
        ]);
        let i;
        for (i = 0; i < array.length; i += 2) {
            quantized[i + 0] = Math.floor((array[i + 0] - min[0]) * multiplier[0]);
            quantized[i + 1] = Math.floor((array[i + 1] - min[1]) * multiplier[1]);
        }
        math.identityMat3(translate);
        math.translationMat3v(min, translate);
        math.identityMat3(scale);
        math.scalingMat3v([
            (max[0] - min[0]) / 65535,
            (max[1] - min[1]) / 65535
        ], scale);
        const decodeMat = math.mulMat3(translate, scale, math.identityMat3());
        return {
            quantized: quantized,
            decode: decodeMat
        };
    };
})();

// http://jcgt.org/published/0003/02/01/
function octEncode(array) {
    const encoded = new Int8Array(array.length * 2 / 3);
    let oct, dec, best, currentCos, bestCos;
    let i, ei;
    for (i = 0, ei = 0; i < array.length; i += 3, ei += 2) {
        // Test various combinations of ceil and floor
        // to minimize rounding errors
        best = oct = octEncodeVec3(array, i, "floor", "floor");
        dec = octDecodeVec2(oct);
        currentCos = bestCos = dot(array, i, dec);
        oct = octEncodeVec3(array, i, "ceil", "floor");
        dec = octDecodeVec2(oct);
        currentCos = dot(array, i, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeVec3(array, i, "floor", "ceil");
        dec = octDecodeVec2(oct);
        currentCos = dot(array, i, dec);
        if (currentCos > bestCos) {
            best = oct;
            bestCos = currentCos;
        }
        oct = octEncodeVec3(array, i, "ceil", "ceil");
    }

    /**
     Indicates the billboarding behaviour.

     Options are:

     * **"none"** -  **(default)** - No billboarding.
     * **"spherical"** - Mesh is billboarded to face the viewpoint, rotating both vertically and horizontally.
     * **"cylindrical"** - Mesh is billboarded to face the viewpoint, rotating only about its vertically
     axis. Use this mode for things like trees on a landscape.

     @property billboard
     @default "none"
     @type String
     @final
     */
    get billboard() {
        return this._state.billboard;
    }

    destroy() {
        super.destroy(); // xeogl.Object
        this._putRenderers();
        this._renderer.meshListDirty();
        this.scene._meshDestroyed(this);
        if (this._state.castShadow) {
            this._renderer.shadowsDirty();
        }
    }
}

componentClasses[type$8] = Mesh;

/**
 * @author xeolabs / https://github.com/xeolabs
 */

const Renderer = function ( scene, options) {

    options = options || {};

    const frame = new Frame();
    const canvas = scene.canvas.canvas;
    const gl = scene.canvas.gl;
    const canvasTransparent = options.transparent === true;
    const meshList = [];
    let meshListLen = 0;
    const meshPickList = [];
    let meshPickListLen = 0;
    let meshListDirty = true;
    let stateSortDirty = true;
    let imageDirty = true;
    this.imageForceDirty = true;

    let blendOneMinusSrcAlpha = true;

    let pickBuf = null;
    let readPixelBuf = null;

    const bindOutputFrameBuffer = null;
    const unbindOutputFrameBuffer = null;

    this.meshListDirty = function () {
        meshListDirty = true;
        stateSortDirty = true;
    };

    this.needStateSort = function () {
        stateSortDirty = true;
    };

    this.shadowsDirty = function () {
        
    };

    this.imageDirty = function () {
        imageDirty = true;
    };

    this.setImageForceDirty = function () {
        this.imageForceDirty = true;
    };

    this.setBlendOneMinusSrcAlpha = function (value) {
        blendOneMinusSrcAlpha = value;
    };

    this.webglContextLost = function () {
    };

    this.webglContextRestored = function (gl) {
        if (pickBuf) {
            pickBuf.webglContextRestored(gl);
        }
        if (readPixelBuf) {
            readPixelBuf.webglContextRestored(gl);
        }
        imageDirty = true;
    };

    /**
     * Clears the canvas.
     * @param params
     */
    this.clear = function (params) {
        params = params || {};
        const boundary = scene.viewport.boundary;
        gl.viewport(boundary[0], boundary[1], boundary[2], boundary[3]);
        if (canvasTransparent) { // Canvas is transparent
            gl.clearColor(0, 0, 0, 0);
        } else {
            const color = params.ambientColor || this.lights.getAmbientColor();
            gl.clearColor(color[0], color[1], color[2], 1.0);
        }
        if (bindOutputFrameBuffer) {
            bindOutputFrameBuffer(params.pass);
        }
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        if (unbindOutputFrameBuffer) {
            unbindOutputFrameBuffer(params.pass);
        }
    };

    /**
     * Renders the scene.
     * @param params
     */
    this.render = function (params) {
        params = params || {};
        update();
        if (imageDirty || this.imageForceDirty || params.force) {
            drawMeshes(params);
            stats.frame.frameCount++;
            imageDirty = false;
            this.imageForceDirty = false;
        }
    };

    function update() {
        if (meshListDirty) {
            buildMeshList();
            meshListDirty = false;
            stateSortDirty = true;
        }
        if (stateSortDirty) {
            meshList.sort(Mesh._compareState);
            stateSortDirty = false;
            imageDirty = true;
        }
        // if (shadowsDirty) {
        //     drawShadowMaps();
        //     shadowsDirty = false;
        //     imageDirty = true;
        // }
    }

    function buildMeshList() {
        meshListLen = 0;
        for (const meshId in scene.meshes) {
            if (scene.meshes.hasOwnProperty(meshId)) {
                meshList[meshListLen++] = scene.meshes[meshId];
            }
        }
        for (let i = meshListLen, len = meshList.length; i < len; i++) {
            meshList[i] = null; // Release memory
        }
        meshList.length = meshListLen;
    }

    var drawMeshes = (function () {

        const opaqueGhostFillMeshes = [];
        const opaqueGhostVerticesMeshes = [];
        const opaqueGhostEdgesMeshes = [];
        const transparentGhostFillMeshes = [];
        const transparentGhostVerticesMeshes = [];
        const transparentGhostEdgesMeshes = [];

        const opaqueHighlightFillMeshes = [];
        const opaqueHighlightVerticesMeshes = [];
        const opaqueHighlightEdgesMeshes = [];
        const transparentHighlightFillMeshes = [];
        const transparentHighlightVerticesMeshes = [];
        const transparentHighlightEdgesMeshes = [];

        const opaqueSelectedFillMeshes = [];
        const opaqueSelectedVerticesMeshes = [];
        const opaqueSelectedEdgesMeshes = [];
        const transparentSelectedFillMeshes = [];
        const transparentSelectedVerticesMeshes = [];
        const transparentSelectedEdgesMeshes = [];

        const opaqueEdgesMeshes = [];
        const transparentEdgesMeshes = [];

        const outlinedMeshes = [];
        const highlightMeshes = [];
        const selectedMeshes = [];
        const transparentMeshes = [];
        let numTransparentMeshes = 0;

        return function (params) {

            var opaqueOnly = !!params.opaqueOnly;

            if (WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"]) {  // In case context lost/recovered
                gl.getExtension("OES_element_index_uint");
            }
            if (WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_standard_derivatives"]) { // For normal mapping w/o precomputed tangents
                gl.getExtension("OES_standard_derivatives");
            }

            const ambientColor = scene._lightsState.getAmbientColor();

            frame.reset();
            frame.pass = params.pass;

            const boundary = scene.viewport.boundary;
            gl.viewport(boundary[0], boundary[1], boundary[2], boundary[3]);

            if (canvasTransparent) { // Canvas is transparent
                gl.clearColor(0, 0, 0, 0);
            } else {
                gl.clearColor(ambientColor[0], ambientColor[1], ambientColor[2], 1.0);
            }

            gl.enable(gl.DEPTH_TEST);
            gl.frontFace(gl.CCW);
            gl.enable(gl.CULL_FACE);
            gl.depthMask(true);

            let i;
            let len;
            let mesh;
            let meshState;
            let materialState;
            let transparent;

            const startTime = Date.now();

            if (bindOutputFrameBuffer) {
                bindOutputFrameBuffer(params.pass);
            }

            if (params.clear !== false) {
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
            }

            let numOpaqueGhostFillMeshes = 0;
            let numOpaqueGhostVerticesMeshes = 0;
            let numOpaqueGhostEdgesMeshes = 0;
            let numTransparentGhostFillMeshes = 0;
            let numTransparentGhostVerticesMeshes = 0;
            let numTransparentGhostEdgesMeshes = 0;

            let numOutlinedMeshes = 0;
            let numHighlightMeshes = 0;
            let numSelectedMeshes = 0;

            let numOpaqueHighlightFillMeshes = 0;
            let numOpaqueHighlightVerticesMeshes = 0;
            let numOpaqueHighlightEdgesMeshes = 0;
            let numTransparentHighlightFillMeshes = 0;
            let numTransparentHighlightVerticesMeshes = 0;
            let numTransparentHighlightEdgesMeshes = 0;

            let numOpaqueSelectedFillMeshes = 0;
            let numOpaqueSelectedVerticesMeshes = 0;
            let numOpaqueSelectedEdgesMeshes = 0;
            let numTransparentSelectedFillMeshes = 0;
            let numTransparentSelectedVerticesMeshes = 0;
            let numTransparentSelectedEdgesMeshes = 0;

            let numOpaqueEdgesMeshes = 0;
            let numTransparentEdgesMeshes = 0;

            numTransparentMeshes = 0;

            // Build draw lists

            for (i = 0, len = meshListLen; i < len; i++) {

                mesh = meshList[i];
                meshState = mesh._state;
                materialState = mesh._material._state;

                if (meshState.culled === true || meshState.visible === false) {
                    continue;
                }

                if (materialState.alpha === 0) {
                    continue;
                }

                if (meshState.ghosted) {
                    const ghostMaterialState = mesh._ghostMaterial._state;
                    if (ghostMaterialState.edges) {
                        if (ghostMaterialState.edgeAlpha < 1.0) {
                            if (!opaqueOnly) {
                                transparentGhostEdgesMeshes[numTransparentGhostEdgesMeshes++] = mesh;
                            }
                        } else {
                            opaqueGhostEdgesMeshes[numOpaqueGhostEdgesMeshes++] = mesh;
                        }
                    }
                    if (ghostMaterialState.vertices) {
                        if (ghostMaterialState.vertexAlpha < 1.0) {
                            if (!opaqueOnly) {
                                transparentGhostVerticesMeshes[numTransparentGhostVerticesMeshes++] = mesh;
                            }
                        } else {
                            opaqueGhostVerticesMeshes[numOpaqueGhostVerticesMeshes++] = mesh;
                        }
                    }
                    if (ghostMaterialState.fill) {
                        if (ghostMaterialState.fillAlpha < 1.0) {
                            if (!opaqueOnly) {
                                transparentGhostFillMeshes[numTransparentGhostFillMeshes++] = mesh;
                            }
                        } else {
                            opaqueGhostFillMeshes[numOpaqueGhostFillMeshes++] = mesh;
                        }
                    }

                } else {

                    // Normal render

                    transparent = materialState.alphaMode === 2 /* blend */ || meshState.xray || meshState.colorize[3] < 1;
                    if (transparent) {
                        if (!opaqueOnly) {
                            transparentMeshes[numTransparentMeshes++] = mesh;
                        }
                    } else {
                        if (meshState.outlined) {
                            outlinedMeshes[numOutlinedMeshes++] = mesh;
                        } else {
                            mesh._draw(frame);
                        }
                    }
                }

                if (meshState.selected) {
                    const selectedMaterialState = mesh._selectedMaterial._state;
                    if (selectedMaterialState.edges) {
                        if (selectedMaterialState.edgeAlpha < 1.0) {
                            if (!opaqueOnly) {
                                transparentSelectedEdgesMeshes[numTransparentSelectedEdgesMeshes++] = mesh;
                            }
                        } else {
                            opaqueSelectedEdgesMeshes[numOpaqueSelectedEdgesMeshes++] = mesh;
                        }
                    }
                    if (selectedMaterialState.vertices) {
                        if (selectedMaterialState.vertexAlpha < 1.0) {
                            if (!opaqueOnly) {
                                transparentSelectedVerticesMeshes[numTransparentSelectedVerticesMeshes++] = mesh;
                            }
                        } else {
                            opaqueSelectedVerticesMeshes[numOpaqueSelectedVerticesMeshes++] = mesh;
                        }
                    }
                    if (selectedMaterialState.fill) {
                        if (selectedMaterialState.fillAlpha < 1.0) {
                            if (!opaqueOnly) {
                                transparentSelectedFillMeshes[numTransparentSelectedFillMeshes++] = mesh;
                            }
                        } else {
                            opaqueSelectedFillMeshes[numOpaqueSelectedFillMeshes++] = mesh;
                        }
                    }
                    if (meshState.selected) {
                        selectedMeshes[numSelectedMeshes++] = mesh;
                    }
                }

                if (meshState.highlighted) {
                    const highlightMaterialState = mesh._highlightMaterial._state;
                    if (highlightMaterialState.edges) {
                        if (highlightMaterialState.edgeAlpha < 1.0) {
                            if (!opaqueOnly) {
                                transparentHighlightEdgesMeshes[numTransparentHighlightEdgesMeshes++] = mesh;
                            }
                        } else {
                            opaqueHighlightEdgesMeshes[numOpaqueHighlightEdgesMeshes++] = mesh;
                        }
                    }
                    if (highlightMaterialState.vertices) {
                        if (highlightMaterialState.vertexAlpha < 1.0) {
                            transparentHighlightVerticesMeshes[numTransparentHighlightVerticesMeshes++] = mesh;
                        } else {
                            opaqueHighlightVerticesMeshes[numOpaqueHighlightVerticesMeshes++] = mesh;
                        }
                    }
                    if (highlightMaterialState.fill) {
                        if (highlightMaterialState.fillAlpha < 1.0) {
                            transparentHighlightFillMeshes[numTransparentHighlightFillMeshes++] = mesh;
                        } else {
                            opaqueHighlightFillMeshes[numOpaqueHighlightFillMeshes++] = mesh;
                        }
                    }
                    if (meshState.highlighted) {
                        highlightMeshes[numHighlightMeshes++] = mesh;
                    }
                }

                if (meshState.edges) {
                    const edgeMaterial = mesh._edgeMaterial._state;
                    if (edgeMaterial.edgeAlpha < 1.0) {
                        if (!opaqueOnly) {
                            transparentEdgesMeshes[numTransparentEdgesMeshes++] = mesh;
                        }
                    } else {
                        opaqueEdgesMeshes[numOpaqueEdgesMeshes++] = mesh;
                    }
                }
            }

            // Render opaque outlined meshes

            if (numOutlinedMeshes > 0) {

                // Render meshes

                gl.enable(gl.STENCIL_TEST);
                gl.stencilFunc(gl.ALWAYS, 1, 1);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
                gl.stencilMask(1);
                gl.clearStencil(0);
                gl.clear(gl.STENCIL_BUFFER_BIT);

                for (i = 0; i < numOutlinedMeshes; i++) {
                    outlinedMeshes[i]._draw(frame);
                }

                // Render outlines

                gl.stencilFunc(gl.EQUAL, 0, 1);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
                gl.stencilMask(0x00);
                gl.disable(gl.CULL_FACE); // Need both faces for better corners with face-aligned normals

                for (i = 0; i < numOutlinedMeshes; i++) {
                    outlinedMeshes[i]._drawOutline(frame);
                }

                gl.disable(gl.STENCIL_TEST);
            }

            // Render opaque edges meshes

            if (numOpaqueEdgesMeshes > 0) {
                for (i = 0; i < numOpaqueEdgesMeshes; i++) {
                    opaqueEdgesMeshes[i]._drawEdges(frame);
                }
            }

            // Render opaque ghosted meshes

            if (numOpaqueGhostFillMeshes > 0) {
                for (i = 0; i < numOpaqueGhostFillMeshes; i++) {
                    opaqueGhostFillMeshes[i]._drawGhostFill(frame);
                }
            }

            if (numOpaqueGhostEdgesMeshes > 0) {
                for (i = 0; i < numOpaqueGhostEdgesMeshes; i++) {
                    opaqueGhostEdgesMeshes[i]._drawGhostEdges(frame);
                }
            }

            if (numOpaqueGhostVerticesMeshes > 0) {
                for (i = 0; i < numOpaqueGhostVerticesMeshes; i++) {
                    opaqueGhostVerticesMeshes[i]._drawGhostVertices(frame);
                }
            }

            const transparentDepthMask = true;

            if (numTransparentGhostFillMeshes > 0 || numTransparentGhostEdgesMeshes > 0 || numTransparentGhostVerticesMeshes > 0 || numTransparentMeshes > 0) {

                // Draw transparent meshes

                gl.enable(gl.CULL_FACE);
                gl.enable(gl.BLEND);

                if (blendOneMinusSrcAlpha) {

                    // Makes glTF windows appear correct

                    // Without premultiplied alpha:
                    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

                    // Premultiplied alpha:
                    //gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                } else {

                    gl.blendEquation(gl.FUNC_ADD);
                    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                }

                frame.backfaces = false;

                if (!transparentDepthMask) {
                    gl.depthMask(false);
                }

                // Render transparent ghosted meshes

                if (numTransparentGhostVerticesMeshes > 0) {
                    for (i = 0; i < numTransparentGhostVerticesMeshes; i++) {
                        transparentGhostVerticesMeshes[i]._drawGhostVertices(frame);
                    }
                }

                if (numTransparentGhostEdgesMeshes > 0) {
                    for (i = 0; i < numTransparentGhostEdgesMeshes; i++) {
                        transparentGhostEdgesMeshes[i]._drawGhostEdges(frame);
                    }
                }

                if (numTransparentGhostFillMeshes > 0) {
                    for (i = 0; i < numTransparentGhostFillMeshes; i++) {
                        transparentGhostFillMeshes[i]._drawGhostFill(frame);
                    }
                }

                numOutlinedMeshes = 0;

                for (i = 0; i < numTransparentMeshes; i++) {
                    mesh = transparentMeshes[i];
                    if (mesh._state.outlined) {
                        outlinedMeshes[numOutlinedMeshes++] = mesh; // Build outlined list
                        continue;
                    }

                    mesh._draw(frame);
                }

                // Transparent outlined meshes are not supported yet

                gl.disable(gl.BLEND);
            }

            // Highlighting

            if (numOpaqueHighlightFillMeshes > 0 || numOpaqueHighlightEdgesMeshes > 0 || numOpaqueHighlightVerticesMeshes > 0) {

                // Render opaque highlighted meshes

                frame.lastProgramId = null;
                gl.clear(gl.DEPTH_BUFFER_BIT);

                if (numOpaqueHighlightVerticesMeshes > 0) {
                    for (i = 0; i < numOpaqueHighlightVerticesMeshes; i++) {
                        opaqueHighlightVerticesMeshes[i]._drawHighlightVertices(frame);
                    }
                }

                if (numOpaqueHighlightEdgesMeshes > 0) {
                    for (i = 0; i < numOpaqueHighlightEdgesMeshes; i++) {
                        opaqueHighlightEdgesMeshes[i]._drawHighlightEdges(frame);
                    }
                }

                if (numOpaqueHighlightFillMeshes > 0) {
                    for (i = 0; i < numOpaqueHighlightFillMeshes; i++) {
                        opaqueHighlightFillMeshes[i]._drawHighlightFill(frame);
                    }
                }
            }

            if (numTransparentHighlightFillMeshes > 0 || numTransparentHighlightEdgesMeshes > 0 || numTransparentHighlightVerticesMeshes > 0) {

                // Render transparent highlighted meshes

                frame.lastProgramId = null;

                gl.clear(gl.DEPTH_BUFFER_BIT);
                gl.enable(gl.CULL_FACE);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                //          gl.disable(gl.DEPTH_TEST);

                if (numTransparentHighlightVerticesMeshes > 0) {
                    for (i = 0; i < numTransparentHighlightVerticesMeshes; i++) {
                        transparentHighlightVerticesMeshes[i]._drawHighlightVertices(frame);
                    }
                }

                if (numTransparentHighlightEdgesMeshes > 0) {
                    for (i = 0; i < numTransparentHighlightEdgesMeshes; i++) {
                        transparentHighlightEdgesMeshes[i]._drawHighlightEdges(frame);
                    }
                }

                if (numTransparentHighlightFillMeshes > 0) {
                    for (i = 0; i < numTransparentHighlightFillMeshes; i++) {
                        transparentHighlightFillMeshes[i]._drawHighlightFill(frame);
                    }
                }

                gl.disable(gl.BLEND);
                //        gl.enable(gl.DEPTH_TEST);
            }

            // Selection

            if (numOpaqueSelectedFillMeshes > 0 || numOpaqueSelectedEdgesMeshes > 0 || numOpaqueSelectedVerticesMeshes > 0) {

                // Render opaque selected meshes

                frame.lastProgramId = null;
                gl.clear(gl.DEPTH_BUFFER_BIT);

                if (numOpaqueSelectedVerticesMeshes > 0) {
                    for (i = 0; i < numOpaqueSelectedVerticesMeshes; i++) {
                        opaqueSelectedVerticesMeshes[i]._drawSelectedVertices(frame);
                    }
                }

                if (numOpaqueSelectedEdgesMeshes > 0) {
                    for (i = 0; i < numOpaqueSelectedEdgesMeshes; i++) {
                        opaqueSelectedEdgesMeshes[i]._drawSelectedEdges(frame);
                    }
                }

                if (numOpaqueSelectedFillMeshes > 0) {
                    for (i = 0; i < numOpaqueSelectedFillMeshes; i++) {
                        opaqueSelectedFillMeshes[i]._drawSelectedFill(frame);
                    }
                }
            }

            if (numTransparentSelectedFillMeshes > 0 || numTransparentSelectedEdgesMeshes > 0 || numTransparentSelectedVerticesMeshes > 0) {

                // Render transparent selected meshes

                frame.lastProgramId = null;

                gl.clear(gl.DEPTH_BUFFER_BIT);
                gl.enable(gl.CULL_FACE);
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                //          gl.disable(gl.DEPTH_TEST);

                if (numTransparentSelectedVerticesMeshes > 0) {
                    for (i = 0; i < numTransparentSelectedVerticesMeshes; i++) {
                        transparentSelectedVerticesMeshes[i]._drawSelectedVertices(frame);
                    }
                }

                if (numTransparentSelectedEdgesMeshes > 0) {
                    for (i = 0; i < numTransparentSelectedEdgesMeshes; i++) {
                        transparentSelectedEdgesMeshes[i]._drawSelectedEdges(frame);
                    }
                }

                if (numTransparentSelectedFillMeshes > 0) {
                    for (i = 0; i < numTransparentSelectedFillMeshes; i++) {
                        transparentSelectedFillMeshes[i]._drawSelectedFill(frame);
                    }
                }

                gl.disable(gl.BLEND);
                //        gl.enable(gl.DEPTH_TEST);
            }

            const endTime = Date.now();
            const frameStats = stats.frame;

            frameStats.renderTime = (endTime - startTime) / 1000.0;
            frameStats.drawElements = frame.drawElements;
            frameStats.drawElements = frame.drawElements;
            frameStats.useProgram = frame.useProgram;
            frameStats.bindTexture = frame.bindTexture;
            frameStats.bindArray = frame.bindArray;

            const numTextureUnits = WEBGL_INFO.MAX_TEXTURE_UNITS;
            for (let ii = 0; ii < numTextureUnits; ii++) {
                gl.activeTexture(gl.TEXTURE0 + ii);
            }
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
            gl.bindTexture(gl.TEXTURE_2D, null);

            // Set the backbuffer's alpha to 1.0
            // gl.clearColor(1, 1, 1, 1);
            // gl.colorMask(false, false, false, true);
            // gl.clear(gl.COLOR_BUFFER_BIT);
            // gl.colorMask(true, true, true, true);

            if (unbindOutputFrameBuffer) {
                unbindOutputFrameBuffer(params.pass);
            }
        };
    })();

    /**
     * Picks a mesh in the scene.
     */
    this.pick = (function () {

        const tempVec3a = math.vec3();
        const tempMat4a = math.mat4();
        const up = math.vec3([0, 1, 0]);
        const pickFrustumMatrix = math.frustumMat4(-1, 1, -1, 1, 0.1, 10000);

        return function (params) {

            update();

            if (WEBGL_INFO.SUPPORTED_EXTENSIONS["OES_element_index_uint"]) { // In case context lost/recovered
                gl.getExtension("OES_element_index_uint");
            }

            let canvasX;
            let canvasY;
            let origin;
            let direction;
            let look;
            let pickViewMatrix = null;
            let pickProjMatrix = null;

            if (params.canvasPos) {

                canvasX = params.canvasPos[0];
                canvasY = params.canvasPos[1];

            } else {

                // Picking with arbitrary World-space ray
                // Align camera along ray and fire ray through center of canvas

                origin = params.origin || math.vec3([0, 0, 0]);
                direction = params.direction || math.vec3([0, 0, 1]);
                look = math.addVec3(origin, direction, tempVec3a);

                pickViewMatrix = math.lookAtMat4v(origin, look, up, tempMat4a);
                pickProjMatrix = pickFrustumMatrix;

                canvasX = canvas.clientWidth * 0.5;
                canvasY = canvas.clientHeight * 0.5;
            }

            pickBuf = pickBuf || new RenderBuffer(canvas, gl);
            pickBuf.bind();

            const mesh = pickMesh(canvasX, canvasY, pickViewMatrix, pickProjMatrix, params);

            if (!mesh) {
                pickBuf.unbind();
                return null;
            }

            const hit = {
                mesh: mesh
            };

            if (params.pickSurface) {
                hit.primIndex = pickTriangle(mesh, canvasX, canvasY, pickViewMatrix, pickProjMatrix);
            }

            if (pickViewMatrix) {
                hit.origin = origin;
                hit.direction = direction;
            }

            pickBuf.unbind();

            return hit;
        };
    })();

    function pickMesh(canvasX, canvasY, pickViewMatrix, pickProjMatrix, params) {

        frame.reset();
        frame.backfaces = true;
        frame.frontface = true; // "ccw"
        frame.pickViewMatrix = pickViewMatrix;
        frame.pickProjMatrix = pickProjMatrix;
        frame.pickMeshIndex = 1;

        const boundary = scene.viewport.boundary;
        gl.viewport(boundary[0], boundary[1], boundary[2], boundary[3]);

        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        meshPickListLen = 0;

        let i;
        let len;
        let mesh;
        const includeMeshIds = params.includeMeshIds;
        const excludeMeshIds = params.excludeMeshIds;

        for (i = 0, len = meshListLen; i < len; i++) {
            mesh = meshList[i];
            if (mesh._state.culled === true || mesh._state.visible === false || mesh._state.pickable === false) {
                continue;
            }
            if (includeMeshIds && !includeMeshIds[mesh.id]) {
                continue;
            }
            if (excludeMeshIds && excludeMeshIds[mesh.id]) {
                continue;
            }
            meshPickList[meshPickListLen++] = mesh;
            mesh._pickMesh(frame);
        }

        const pix = pickBuf.read(Math.round(canvasX), Math.round(canvasY));
        let pickedMeshIndex = pix[0] + (pix[1] * 256) + (pix[2] * 256 * 256) + (pix[3] * 256 * 256 * 256);

        pickedMeshIndex--;

        return pickedMeshIndex >= 0 ? meshPickList[pickedMeshIndex] : null;
    }

    function pickTriangle(mesh, canvasX, canvasY, pickViewMatrix, pickProjMatrix) {

        frame.reset();
        frame.backfaces = true;
        frame.frontface = true; // "ccw"
        frame.pickViewMatrix = pickViewMatrix; // Can be null
        frame.pickProjMatrix = pickProjMatrix; // Can be null

        const boundary = scene.viewport.boundary;
        gl.viewport(boundary[0], boundary[1], boundary[2], boundary[3]);

        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        mesh._pickTriangle(frame);

        const pix = pickBuf.read(canvasX, canvasY);

        let primIndex = pix[0] + (pix[1] * 256) + (pix[2] * 256 * 256) + (pix[3] * 256 * 256 * 256);

        primIndex *= 3; // Convert from triangle number to first vertex in indices

        return primIndex;
    }

    /**
     * Read pixels from the frame buffer. Performse a force-render first
     * @param pixels
     * @param colors
     * @param len
     * @param opaqueOnly
     */
    this.readPixels = function (pixels, colors, len, opaqueOnly) {
        readPixelBuf = readPixelBuf || (readPixelBuf = new RenderBuffer(canvas, gl));
        readPixelBuf.bind();
        readPixelBuf.clear();
        this.render({force: true, opaqueOnly: opaqueOnly});
        let color;
        let i;
        let j;
        let k;
        for (i = 0; i < len; i++) {
            j = i * 2;
            k = i * 4;
            color = readPixelBuf.read(pixels[j], pixels[j + 1]);
            colors[k] = color[0];
            colors[k + 1] = color[1];
            colors[k + 2] = color[2];
            colors[k + 3] = color[3];
        }
        readPixelBuf.unbind();
        imageDirty = true;
    };

    /**
     * Destroys this renderer.
     */
    this.destroy = function () {
        if (pickBuf) {
            pickBuf.destroy();
        }
        if (readPixelBuf) {
            readPixelBuf.destroy();
        }
    };
};

/**
 Publishes keyboard and mouse events that occur on the parent {{#crossLink "Scene"}}{{/crossLink}}'s {{#crossLink "Canvas"}}{{/crossLink}}.

 * Each {{#crossLink "Scene"}}{{/crossLink}} provides an Input on itself as a read-only property.

 ## Usage

 In this example, we're subscribing to some mouse and key events that will occur on
 a {{#crossLink "Scene"}}Scene's{{/crossLink}} {{#crossLink "Canvas"}}Canvas{{/crossLink}}.

 ````javascript
 var myScene = new xeogl.Scene();

 var input = myScene.input;

 // We'll save a handle to this subscription
 // to show how to unsubscribe, further down
 var handle = input.on("mousedown", function(coords) {
       console.log("Mouse down at: x=" + coords[0] + ", y=" + coords[1]);
 });

 input.on("mouseup", function(coords) {
       console.log("Mouse up at: x=" + coords[0] + ", y=" + coords[1]);
 });

 input.on("mouseclicked", function(coords) {
      console.log("Mouse clicked at: x=" + coords[0] + ", y=" + coords[1]);
 });

 input.on("dblclick", function(coords) {
       console.log("Double-click at: x=" + coords[0] + ", y=" + coords[1]);
 });

 input.on("keydown", function(keyCode) {
        switch (keyCode) {

            case this.KEY_A:
               console.log("The 'A' key is down");
               break;

            case this.KEY_B:
               console.log("The 'B' key is down");
               break;

            case this.KEY_C:
               console.log("The 'C' key is down");
               break;

            default:
               console.log("Some other key is down");
       }
     });

 input.on("keyup", function(keyCode) {
        switch (keyCode) {

            case this.KEY_A:
               console.log("The 'A' key is up");
               break;

            case this.KEY_B:
               console.log("The 'B' key is up");
               break;

            case this.KEY_C:
               console.log("The 'C' key is up");
               break;

            default:
               console.log("Some other key is up");
        }
     });

 // TODO: ALT and CTRL keys etc
 ````

 ### Unsubscribing from Events

 In the snippet above, we saved a handle to one of our event subscriptions.

 We can then use that handle to unsubscribe again, like this:

 ````javascript
 input.off(handle);
 ````

 @class Input
 @module xeogl
 @submodule input
 @extends Component
 */
const type$9 = "xeogl.Input";

class Input extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$9;
    }

    init(cfg) {

        super.init(cfg);

        const self = this;

        // Key codes

        /**
         * Code for the BACKSPACE key.
         * @property KEY_BACKSPACE
         * @final
         * @type Number
         */
        // Key codes

        /**
         * Code for the BACKSPACE key.
         * @property KEY_BACKSPACE
         * @final
         * @type Number
         */
        this.KEY_BACKSPACE = 8;

        /**
         * Code for the TAB key.
         * @property KEY_TAB
         * @final
         * @type Number
         */
        this.KEY_TAB = 9;

        /**
         * Code for the ENTER key.
         * @property KEY_ENTER
         * @final
         * @type Number
         */
        this.KEY_ENTER = 13;

        /**
         * Code for the SHIFT key.
         * @property KEY_SHIFT
         * @final
         * @type Number
         */
        this.KEY_SHIFT = 16;

        /**
         * Code for the CTRL key.
         * @property KEY_CTRL
         * @final
         * @type Number
         */
        this.KEY_CTRL = 17;

        /**
         * Code for the ALT key.
         * @property KEY_ALT
         * @final
         * @type Number
         */
        this.KEY_ALT = 18;

        /**
         * Code for the PAUSE_BREAK key.
         * @property KEY_PAUSE_BREAK
         * @final
         * @type Number
         */
        this.KEY_PAUSE_BREAK = 19;

        /**
         * Code for the CAPS_LOCK key.
         * @property KEY_CAPS_LOCK
         * @final
         * @type Number
         */
        this.KEY_CAPS_LOCK = 20;

        /**
         * Code for the ESCAPE key.
         * @property KEY_ESCAPE
         * @final
         * @type Number
         */
        this.KEY_ESCAPE = 27;

        /**
         * Code for the PAGE_UP key.
         * @property KEY_PAGE_UP
         * @final
         * @type Number
         */
        this.KEY_PAGE_UP = 33;

        /**
         * Code for the PAGE_DOWN key.
         * @property KEY_PAGE_DOWN
         * @final
         * @type Number
         */
        this.KEY_PAGE_DOWN = 34;

        /**
         * Code for the END key.
         * @property KEY_END
         * @final
         * @type Number
         */
        this.KEY_END = 35;

        /**
         * Code for the HOME key.
         * @property KEY_HOME
         * @final
         * @type Number
         */
        this.KEY_HOME = 36;

        /**
         * Code for the LEFT_ARROW key.
         * @property KEY_LEFT_ARROW
         * @final
         * @type Number
         */
        this.KEY_LEFT_ARROW = 37;

        /**
         * Code for the UP_ARROW key.
         * @property KEY_UP_ARROW
         * @final
         * @type Number
         */
        this.KEY_UP_ARROW = 38;

        /**
         * Code for the RIGHT_ARROW key.
         * @property KEY_RIGHT_ARROW
         * @final
         * @type Number
         */
        this.KEY_RIGHT_ARROW = 39;

        /**
         * Code for the DOWN_ARROW key.
         * @property KEY_DOWN_ARROW
         * @final
         * @type Number
         */
        this.KEY_DOWN_ARROW = 40;

        /**
         * Code for the INSERT key.
         * @property KEY_INSERT
         * @final
         * @type Number
         */
        this.KEY_INSERT = 45;

        /**
         * Code for the DELETE key.
         * @property KEY_DELETE
         * @final
         * @type Number
         */
        this.KEY_DELETE = 46;

        /**
         * Code for the 0 key.
         * @property KEY_NUM_0
         * @final
         * @type Number
         */
        this.KEY_NUM_0 = 48;

        /**
         * Code for the 1 key.
         * @property KEY_NUM_1
         * @final
         * @type Number
         */
        this.KEY_NUM_1 = 49;

        /**
         * Code for the 2 key.
         * @property KEY_NUM_2
         * @final
         * @type Number
         */
        this.KEY_NUM_2 = 50;

        /**
         * Code for the 3 key.
         * @property KEY_NUM_3
         * @final
         * @type Number
         */
        this.KEY_NUM_3 = 51;

        /**
         * Code for the 4 key.
         * @property KEY_NUM_4
         * @final
         * @type Number
         */
        this.KEY_NUM_4 = 52;

        /**
         * Code for the 5 key.
         * @property KEY_NUM_5
         * @final
         * @type Number
         */
        this.KEY_NUM_5 = 53;

        /**
         * Code for the 6 key.
         * @property KEY_NUM_6
         * @final
         * @type Number
         */
        this.KEY_NUM_6 = 54;

        /**
         * Code for the 7 key.
         * @property KEY_NUM_7
         * @final
         * @type Number
         */
        this.KEY_NUM_7 = 55;

        /**
         * Code for the 8 key.
         * @property KEY_NUM_8
         * @final
         * @type Number
         */
        this.KEY_NUM_8 = 56;

        /**
         * Code for the 9 key.
         * @property KEY_NUM_9
         * @final
         * @type Number
         */
        this.KEY_NUM_9 = 57;

        /**
         * Code for the A key.
         * @property KEY_A
         * @final
         * @type Number
         */
        this.KEY_A = 65;

        /**
         * Code for the B key.
         * @property KEY_B
         * @final
         * @type Number
         */
        this.KEY_B = 66;

        /**
         * Code for the C key.
         * @property KEY_C
         * @final
         * @type Number
         */
        this.KEY_C = 67;

        /**
         * Code for the D key.
         * @property KEY_D
         * @final
         * @type Number
         */
        this.KEY_D = 68;

        /**
         * Code for the E key.
         * @property KEY_E
         * @final
         * @type Number
         */
        this.KEY_E = 69;

        /**
         * Code for the F key.
         * @property KEY_F
         * @final
         * @type Number
         */
        this.KEY_F = 70;

        /**
         * Code for the G key.
         * @property KEY_G
         * @final
         * @type Number
         */
        this.KEY_G = 71;

        /**
         * Code for the H key.
         * @property KEY_H
         * @final
         * @type Number
         */
        this.KEY_H = 72;

        /**
         * Code for the I key.
         * @property KEY_I
         * @final
         * @type Number
         */
        this.KEY_I = 73;

        /**
         * Code for the J key.
         * @property KEY_J
         * @final
         * @type Number
         */
        this.KEY_J = 74;

        /**
         * Code for the K key.
         * @property KEY_K
         * @final
         * @type Number
         */
        this.KEY_K = 75;

        /**
         * Code for the L key.
         * @property KEY_L
         * @final
         * @type Number
         */
        this.KEY_L = 76;

        /**
         * Code for the M key.
         * @property KEY_M
         * @final
         * @type Number
         */
        this.KEY_M = 77;

        /**
         * Code for the N key.
         * @property KEY_N
         * @final
         * @type Number
         */
        this.KEY_N = 78;

        /**
         * Code for the O key.
         * @property KEY_O
         * @final
         * @type Number
         */
        this.KEY_O = 79;

        /**
         * Code for the P key.
         * @property KEY_P
         * @final
         * @type Number
         */
        this.KEY_P = 80;

        /**
         * Code for the Q key.
         * @property KEY_Q
         * @final
         * @type Number
         */
        this.KEY_Q = 81;

        /**
         * Code for the R key.
         * @property KEY_R
         * @final
         * @type Number
         */
        this.KEY_R = 82;

        /**
         * Code for the S key.
         * @property KEY_S
         * @final
         * @type Number
         */
        this.KEY_S = 83;

        /**
         * Code for the T key.
         * @property KEY_T
         * @final
         * @type Number
         */
        this.KEY_T = 84;

        /**
         * Code for the U key.
         * @property KEY_U
         * @final
         * @type Number
         */
        this.KEY_U = 85;

        /**
         * Code for the V key.
         * @property KEY_V
         * @final
         * @type Number
         */
        this.KEY_V = 86;

        /**
         * Code for the W key.
         * @property KEY_W
         * @final
         * @type Number
         */
        this.KEY_W = 87;

        /**
         * Code for the X key.
         * @property KEY_X
         * @final
         * @type Number
         */
        this.KEY_X = 88;

        /**
         * Code for the Y key.
         * @property KEY_Y
         * @final
         * @type Number
         */
        this.KEY_Y = 89;

        /**
         * Code for the Z key.
         * @property KEY_Z
         * @final
         * @type Number
         */
        this.KEY_Z = 90;

        /**
         * Code for the LEFT_WINDOW key.
         * @property KEY_LEFT_WINDOW
         * @final
         * @type Number
         */
        this.KEY_LEFT_WINDOW = 91;

        /**
         * Code for the RIGHT_WINDOW key.
         * @property KEY_RIGHT_WINDOW
         * @final
         * @type Number
         */
        this.KEY_RIGHT_WINDOW = 92;

        /**
         * Code for the SELECT key.
         * @property KEY_SELECT
         * @final
         * @type Number
         */
        this.KEY_SELECT_KEY = 93;

        /**
         * Code for the number pad 0 key.
         * @property KEY_NUMPAD_0
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_0 = 96;

        /**
         * Code for the number pad 1 key.
         * @property KEY_NUMPAD_1
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_1 = 97;

        /**
         * Code for the number pad 2 key.
         * @property KEY_NUMPAD 2
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_2 = 98;

        /**
         * Code for the number pad 3 key.
         * @property KEY_NUMPAD_3
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_3 = 99;

        /**
         * Code for the number pad 4 key.
         * @property KEY_NUMPAD_4
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_4 = 100;

        /**
         * Code for the number pad 5 key.
         * @property KEY_NUMPAD_5
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_5 = 101;

        /**
         * Code for the number pad 6 key.
         * @property KEY_NUMPAD_6
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_6 = 102;

        /**
         * Code for the number pad 7 key.
         * @property KEY_NUMPAD_7
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_7 = 103;

        /**
         * Code for the number pad 8 key.
         * @property KEY_NUMPAD_8
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_8 = 104;

        /**
         * Code for the number pad 9 key.
         * @property KEY_NUMPAD_9
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_9 = 105;

        /**
         * Code for the MULTIPLY key.
         * @property KEY_MULTIPLY
         * @final
         * @type Number
         */
        this.KEY_MULTIPLY = 106;

        /**
         * Code for the ADD key.
         * @property KEY_ADD
         * @final
         * @type Number
         */
        this.KEY_ADD = 107;

        /**
         * Code for the SUBTRACT key.
         * @property KEY_SUBTRACT
         * @final
         * @type Number
         */
        this.KEY_SUBTRACT = 109;

        /**
         * Code for the DECIMAL POINT key.
         * @property KEY_DECIMAL_POINT
         * @final
         * @type Number
         */
        this.KEY_DECIMAL_POINT = 110;

        /**
         * Code for the DIVIDE key.
         * @property KEY_DIVIDE
         * @final
         * @type Number
         */
        this.KEY_DIVIDE = 111;

        /**
         * Code for the F1 key.
         * @property KEY_F1
         * @final
         * @type Number
         */
        this.KEY_F1 = 112;

        /**
         * Code for the F2 key.
         * @property KEY_F2
         * @final
         * @type Number
         */
        this.KEY_F2 = 113;

        /**
         * Code for the F3 key.
         * @property KEY_F3
         * @final
         * @type Number
         */
        this.KEY_F3 = 114;

        /**
         * Code for the F4 key.
         * @property KEY_F4
         * @final
         * @type Number
         */
        this.KEY_F4 = 115;

        /**
         * Code for the F5 key.
         * @property KEY_F5
         * @final
         * @type Number
         */
        this.KEY_F5 = 116;

        /**
         * Code for the F6 key.
         * @property KEY_F6
         * @final
         * @type Number
         */
        this.KEY_F6 = 117;

        /**
         * Code for the F7 key.
         * @property KEY_F7
         * @final
         * @type Number
         */
        this.KEY_F7 = 118;

        /**
         * Code for the F8 key.
         * @property KEY_F8
         * @final
         * @type Number
         */
        this.KEY_F8 = 119;

        /**
         * Code for the F9 key.
         * @property KEY_F9
         * @final
         * @type Number
         */
        this.KEY_F9 = 120;

        /**
         * Code for the F10 key.
         * @property KEY_F10
         * @final
         * @type Number
         */
        this.KEY_F10 = 121;

        /**
         * Code for the F11 key.
         * @property KEY_F11
         * @final
         * @type Number
         */
        this.KEY_F11 = 122;

        /**
         * Code for the F12 key.
         * @property KEY_F12
         * @final
         * @type Number
         */
        this.KEY_F12 = 123;

        /**
         * Code for the NUM_LOCK key.
         * @property KEY_NUM_LOCK
         * @final
         * @type Number
         */
        this.KEY_NUM_LOCK = 144;

        /**
         * Code for the SCROLL_LOCK key.
         * @property KEY_SCROLL_LOCK
         * @final
         * @type Number
         */
        this.KEY_SCROLL_LOCK = 145;

        /**
         * Code for the SEMI_COLON key.
         * @property KEY_SEMI_COLON
         * @final
         * @type Number
         */
        this.KEY_SEMI_COLON = 186;

        /**
         * Code for the EQUAL_SIGN key.
         * @property KEY_EQUAL_SIGN
         * @final
         * @type Number
         */
        this.KEY_EQUAL_SIGN = 187;

        /**
         * Code for the COMMA key.
         * @property KEY_COMMA
         * @final
         * @type Number
         */
        this.KEY_COMMA = 188;

        /**
         * Code for the DASH key.
         * @property KEY_DASH
         * @final
         * @type Number
         */
        this.KEY_DASH = 189;

        /**
         * Code for the PERIOD key.
         * @property KEY_PERIOD
         * @final
         * @type Number
         */
        this.KEY_PERIOD = 190;

        /**
         * Code for the FORWARD_SLASH key.
         * @property KEY_FORWARD_SLASH
         * @final
         * @type Number
         */
        this.KEY_FORWARD_SLASH = 191;

        /**
         * Code for the GRAVE_ACCENT key.
         * @property KEY_GRAVE_ACCENT
         * @final
         * @type Number
         */
        this.KEY_GRAVE_ACCENT = 192;

        /**
         * Code for the OPEN_BRACKET key.
         * @property KEY_OPEN_BRACKET
         * @final
         * @type Number
         */
        this.KEY_OPEN_BRACKET = 219;

        /**
         * Code for the BACK_SLASH key.
         * @property KEY_BACK_SLASH
         * @final
         * @type Number
         */
        this.KEY_BACK_SLASH = 220;

        /**
         * Code for the CLOSE_BRACKET key.
         * @property KEY_CLOSE_BRACKET
         * @final
         * @type Number
         */
        this.KEY_CLOSE_BRACKET = 221;

        /**
         * Code for the SINGLE_QUOTE key.
         * @property KEY_SINGLE_QUOTE
         * @final
         * @type Number
         */
        this.KEY_SINGLE_QUOTE = 222;

        /**
         * Code for the SPACE key.
         * @property KEY_SPACE
         * @final
         * @type Number
         */
        this.KEY_SPACE = 32;
        this.KEY_BACKSPACE = 8;

        /**
         * Code for the TAB key.
         * @property KEY_TAB
         * @final
         * @type Number
         */
        this.KEY_TAB = 9;

        /**
         * Code for the ENTER key.
         * @property KEY_ENTER
         * @final
         * @type Number
         */
        this.KEY_ENTER = 13;

        /**
         * Code for the SHIFT key.
         * @property KEY_SHIFT
         * @final
         * @type Number
         */
        this.KEY_SHIFT = 16;

        /**
         * Code for the CTRL key.
         * @property KEY_CTRL
         * @final
         * @type Number
         */
        this.KEY_CTRL = 17;

        /**
         * Code for the ALT key.
         * @property KEY_ALT
         * @final
         * @type Number
         */
        this.KEY_ALT = 18;

        /**
         * Code for the PAUSE_BREAK key.
         * @property KEY_PAUSE_BREAK
         * @final
         * @type Number
         */
        this.KEY_PAUSE_BREAK = 19;

        /**
         * Code for the CAPS_LOCK key.
         * @property KEY_CAPS_LOCK
         * @final
         * @type Number
         */
        this.KEY_CAPS_LOCK = 20;

        /**
         * Code for the ESCAPE key.
         * @property KEY_ESCAPE
         * @final
         * @type Number
         */
        this.KEY_ESCAPE = 27;

        /**
         * Code for the PAGE_UP key.
         * @property KEY_PAGE_UP
         * @final
         * @type Number
         */
        this.KEY_PAGE_UP = 33;

        /**
         * Code for the PAGE_DOWN key.
         * @property KEY_PAGE_DOWN
         * @final
         * @type Number
         */
        this.KEY_PAGE_DOWN = 34;

        /**
         * Code for the END key.
         * @property KEY_END
         * @final
         * @type Number
         */
        this.KEY_END = 35;

        /**
         * Code for the HOME key.
         * @property KEY_HOME
         * @final
         * @type Number
         */
        this.KEY_HOME = 36;

        /**
         * Code for the LEFT_ARROW key.
         * @property KEY_LEFT_ARROW
         * @final
         * @type Number
         */
        this.KEY_LEFT_ARROW = 37;

        /**
         * Code for the UP_ARROW key.
         * @property KEY_UP_ARROW
         * @final
         * @type Number
         */
        this.KEY_UP_ARROW = 38;

        /**
         * Code for the RIGHT_ARROW key.
         * @property KEY_RIGHT_ARROW
         * @final
         * @type Number
         */
        this.KEY_RIGHT_ARROW = 39;

        /**
         * Code for the DOWN_ARROW key.
         * @property KEY_DOWN_ARROW
         * @final
         * @type Number
         */
        this.KEY_DOWN_ARROW = 40;

        /**
         * Code for the INSERT key.
         * @property KEY_INSERT
         * @final
         * @type Number
         */
        this.KEY_INSERT = 45;

        /**
         * Code for the DELETE key.
         * @property KEY_DELETE
         * @final
         * @type Number
         */
        this.KEY_DELETE = 46;

        /**
         * Code for the 0 key.
         * @property KEY_NUM_0
         * @final
         * @type Number
         */
        this.KEY_NUM_0 = 48;

        /**
         * Code for the 1 key.
         * @property KEY_NUM_1
         * @final
         * @type Number
         */
        this.KEY_NUM_1 = 49;

        /**
         * Code for the 2 key.
         * @property KEY_NUM_2
         * @final
         * @type Number
         */
        this.KEY_NUM_2 = 50;

        /**
         * Code for the 3 key.
         * @property KEY_NUM_3
         * @final
         * @type Number
         */
        this.KEY_NUM_3 = 51;

        /**
         * Code for the 4 key.
         * @property KEY_NUM_4
         * @final
         * @type Number
         */
        this.KEY_NUM_4 = 52;

        /**
         * Code for the 5 key.
         * @property KEY_NUM_5
         * @final
         * @type Number
         */
        this.KEY_NUM_5 = 53;

        /**
         * Code for the 6 key.
         * @property KEY_NUM_6
         * @final
         * @type Number
         */
        this.KEY_NUM_6 = 54;

        /**
         * Code for the 7 key.
         * @property KEY_NUM_7
         * @final
         * @type Number
         */
        this.KEY_NUM_7 = 55;

        /**
         * Code for the 8 key.
         * @property KEY_NUM_8
         * @final
         * @type Number
         */
        this.KEY_NUM_8 = 56;

        /**
         * Code for the 9 key.
         * @property KEY_NUM_9
         * @final
         * @type Number
         */
        this.KEY_NUM_9 = 57;

        /**
         * Code for the A key.
         * @property KEY_A
         * @final
         * @type Number
         */
        this.KEY_A = 65;

        /**
         * Code for the B key.
         * @property KEY_B
         * @final
         * @type Number
         */
        this.KEY_B = 66;

        /**
         * Code for the C key.
         * @property KEY_C
         * @final
         * @type Number
         */
        this.KEY_C = 67;

        /**
         * Code for the D key.
         * @property KEY_D
         * @final
         * @type Number
         */
        this.KEY_D = 68;

        /**
         * Code for the E key.
         * @property KEY_E
         * @final
         * @type Number
         */
        this.KEY_E = 69;

        /**
         * Code for the F key.
         * @property KEY_F
         * @final
         * @type Number
         */
        this.KEY_F = 70;

        /**
         * Code for the G key.
         * @property KEY_G
         * @final
         * @type Number
         */
        this.KEY_G = 71;

        /**
         * Code for the H key.
         * @property KEY_H
         * @final
         * @type Number
         */
        this.KEY_H = 72;

        /**
         * Code for the I key.
         * @property KEY_I
         * @final
         * @type Number
         */
        this.KEY_I = 73;

        /**
         * Code for the J key.
         * @property KEY_J
         * @final
         * @type Number
         */
        this.KEY_J = 74;

        /**
         * Code for the K key.
         * @property KEY_K
         * @final
         * @type Number
         */
        this.KEY_K = 75;

        /**
         * Code for the L key.
         * @property KEY_L
         * @final
         * @type Number
         */
        this.KEY_L = 76;

        /**
         * Code for the M key.
         * @property KEY_M
         * @final
         * @type Number
         */
        this.KEY_M = 77;

        /**
         * Code for the N key.
         * @property KEY_N
         * @final
         * @type Number
         */
        this.KEY_N = 78;

        /**
         * Code for the O key.
         * @property KEY_O
         * @final
         * @type Number
         */
        this.KEY_O = 79;

        /**
         * Code for the P key.
         * @property KEY_P
         * @final
         * @type Number
         */
        this.KEY_P = 80;

        /**
         * Code for the Q key.
         * @property KEY_Q
         * @final
         * @type Number
         */
        this.KEY_Q = 81;

        /**
         * Code for the R key.
         * @property KEY_R
         * @final
         * @type Number
         */
        this.KEY_R = 82;

        /**
         * Code for the S key.
         * @property KEY_S
         * @final
         * @type Number
         */
        this.KEY_S = 83;

        /**
         * Code for the T key.
         * @property KEY_T
         * @final
         * @type Number
         */
        this.KEY_T = 84;

        /**
         * Code for the U key.
         * @property KEY_U
         * @final
         * @type Number
         */
        this.KEY_U = 85;

        /**
         * Code for the V key.
         * @property KEY_V
         * @final
         * @type Number
         */
        this.KEY_V = 86;

        /**
         * Code for the W key.
         * @property KEY_W
         * @final
         * @type Number
         */
        this.KEY_W = 87;

        /**
         * Code for the X key.
         * @property KEY_X
         * @final
         * @type Number
         */
        this.KEY_X = 88;

        /**
         * Code for the Y key.
         * @property KEY_Y
         * @final
         * @type Number
         */
        this.KEY_Y = 89;

        /**
         * Code for the Z key.
         * @property KEY_Z
         * @final
         * @type Number
         */
        this.KEY_Z = 90;

        /**
         * Code for the LEFT_WINDOW key.
         * @property KEY_LEFT_WINDOW
         * @final
         * @type Number
         */
        this.KEY_LEFT_WINDOW = 91;

        /**
         * Code for the RIGHT_WINDOW key.
         * @property KEY_RIGHT_WINDOW
         * @final
         * @type Number
         */
        this.KEY_RIGHT_WINDOW = 92;

        /**
         * Code for the SELECT key.
         * @property KEY_SELECT
         * @final
         * @type Number
         */
        this.KEY_SELECT_KEY = 93;

        /**
         * Code for the number pad 0 key.
         * @property KEY_NUMPAD_0
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_0 = 96;

        /**
         * Code for the number pad 1 key.
         * @property KEY_NUMPAD_1
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_1 = 97;

        /**
         * Code for the number pad 2 key.
         * @property KEY_NUMPAD 2
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_2 = 98;

        /**
         * Code for the number pad 3 key.
         * @property KEY_NUMPAD_3
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_3 = 99;

        /**
         * Code for the number pad 4 key.
         * @property KEY_NUMPAD_4
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_4 = 100;

        /**
         * Code for the number pad 5 key.
         * @property KEY_NUMPAD_5
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_5 = 101;

        /**
         * Code for the number pad 6 key.
         * @property KEY_NUMPAD_6
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_6 = 102;

        /**
         * Code for the number pad 7 key.
         * @property KEY_NUMPAD_7
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_7 = 103;

        /**
         * Code for the number pad 8 key.
         * @property KEY_NUMPAD_8
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_8 = 104;

        /**
         * Code for the number pad 9 key.
         * @property KEY_NUMPAD_9
         * @final
         * @type Number
         */
        this.KEY_NUMPAD_9 = 105;

        /**
         * Code for the MULTIPLY key.
         * @property KEY_MULTIPLY
         * @final
         * @type Number
         */
        this.KEY_MULTIPLY = 106;

        /**
         * Code for the ADD key.
         * @property KEY_ADD
         * @final
         * @type Number
         */
        this.KEY_ADD = 107;

        /**
         * Code for the SUBTRACT key.
         * @property KEY_SUBTRACT
         * @final
         * @type Number
         */
        this.KEY_SUBTRACT = 109;

        /**
         * Code for the DECIMAL POINT key.
         * @property KEY_DECIMAL_POINT
         * @final
         * @type Number
         */
        this.KEY_DECIMAL_POINT = 110;

        /**
         * Code for the DIVIDE key.
         * @property KEY_DIVIDE
         * @final
         * @type Number
         */
        this.KEY_DIVIDE = 111;

        /**
         * Code for the F1 key.
         * @property KEY_F1
         * @final
         * @type Number
         */
        this.KEY_F1 = 112;

        /**
         * Code for the F2 key.
         * @property KEY_F2
         * @final
         * @type Number
         */
        this.KEY_F2 = 113;

        /**
         * Code for the F3 key.
         * @property KEY_F3
         * @final
         * @type Number
         */
        this.KEY_F3 = 114;

        /**
         * Code for the F4 key.
         * @property KEY_F4
         * @final
         * @type Number
         */
        this.KEY_F4 = 115;

        /**
         * Code for the F5 key.
         * @property KEY_F5
         * @final
         * @type Number
         */
        this.KEY_F5 = 116;

        /**
         * Code for the F6 key.
         * @property KEY_F6
         * @final
         * @type Number
         */
        this.KEY_F6 = 117;

        /**
         * Code for the F7 key.
         * @property KEY_F7
         * @final
         * @type Number
         */
        this.KEY_F7 = 118;

        /**
         * Code for the F8 key.
         * @property KEY_F8
         * @final
         * @type Number
         */
        this.KEY_F8 = 119;

        /**
         * Code for the F9 key.
         * @property KEY_F9
         * @final
         * @type Number
         */
        this.KEY_F9 = 120;

        /**
         * Code for the F10 key.
         * @property KEY_F10
         * @final
         * @type Number
         */
        this.KEY_F10 = 121;

        /**
         * Code for the F11 key.
         * @property KEY_F11
         * @final
         * @type Number
         */
        this.KEY_F11 = 122;

        /**
         * Code for the F12 key.
         * @property KEY_F12
         * @final
         * @type Number
         */
        this.KEY_F12 = 123;

        /**
         * Code for the NUM_LOCK key.
         * @property KEY_NUM_LOCK
         * @final
         * @type Number
         */
        this.KEY_NUM_LOCK = 144;

        /**
         * Code for the SCROLL_LOCK key.
         * @property KEY_SCROLL_LOCK
         * @final
         * @type Number
         */
        this.KEY_SCROLL_LOCK = 145;

        /**
         * Code for the SEMI_COLON key.
         * @property KEY_SEMI_COLON
         * @final
         * @type Number
         */
        this.KEY_SEMI_COLON = 186;

        /**
         * Code for the EQUAL_SIGN key.
         * @property KEY_EQUAL_SIGN
         * @final
         * @type Number
         */
        this.KEY_EQUAL_SIGN = 187;

        /**
         * Code for the COMMA key.
         * @property KEY_COMMA
         * @final
         * @type Number
         */
        this.KEY_COMMA = 188;

        /**
         * Code for the DASH key.
         * @property KEY_DASH
         * @final
         * @type Number
         */
        this.KEY_DASH = 189;

        /**
         * Code for the PERIOD key.
         * @property KEY_PERIOD
         * @final
         * @type Number
         */
        this.KEY_PERIOD = 190;

        /**
         * Code for the FORWARD_SLASH key.
         * @property KEY_FORWARD_SLASH
         * @final
         * @type Number
         */
        this.KEY_FORWARD_SLASH = 191;

        /**
         * Code for the GRAVE_ACCENT key.
         * @property KEY_GRAVE_ACCENT
         * @final
         * @type Number
         */
        this.KEY_GRAVE_ACCENT = 192;

        /**
         * Code for the OPEN_BRACKET key.
         * @property KEY_OPEN_BRACKET
         * @final
         * @type Number
         */
        this.KEY_OPEN_BRACKET = 219;

        /**
         * Code for the BACK_SLASH key.
         * @property KEY_BACK_SLASH
         * @final
         * @type Number
         */
        this.KEY_BACK_SLASH = 220;

        /**
         * Code for the CLOSE_BRACKET key.
         * @property KEY_CLOSE_BRACKET
         * @final
         * @type Number
         */
        this.KEY_CLOSE_BRACKET = 221;

        /**
         * Code for the SINGLE_QUOTE key.
         * @property KEY_SINGLE_QUOTE
         * @final
         * @type Number
         */
        this.KEY_SINGLE_QUOTE = 222;

        /**
         * Code for the SPACE key.
         * @property KEY_SPACE
         * @final
         * @type Number
         */
        this.KEY_SPACE = 32;

        this._element = cfg.element;

        // True when ALT down
        this.altDown = false;

        /** True whenever CTRL is down
         *
         * @type {boolean}
         */
        this.ctrlDown = false;

        /** True whenever left mouse button is down
         *
         * @type {boolean}
         */
        this.mouseDownLeft = false;

        /** True whenever middle mouse button is down
         *
         * @type {boolean}
         */
        this.mouseDownMiddle = false;

        /** True whenever right mouse button is down
         *
         * @type {boolean}
         */
        this.mouseDownRight = false;

        /** Flag for each key that's down
         *
         * @type {boolean}
         */
        this.keyDown = [];

        /** True while input enabled
         *
         * @type {boolean}
         */
        this.enabled = true;

        /** True while mouse is over the parent {{#crossLink "Scene"}}Scene's{{/crossLink}} {{#crossLink "Canvas"}}Canvas{{/crossLink}}
         *
         * @type {boolean}
         */
        this.mouseover = false;

        // Capture input events and publish them on this component

        document.addEventListener("keydown", this._keyDownListener = function (e) {

            if (!self.enabled) {
                return;
            }

            if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {

                if (e.ctrlKey) {
                    self.ctrlDown = true;

                } else if (e.altKey) {
                    self.altDown = true;

                } else {
                    self.keyDown[e.keyCode] = true;

                    /**
                     * Fired whenever a key is pressed while the parent
                     * {{#crossLink "Scene"}}Scene{{/crossLink}}'s {{#crossLink "Canvas"}}Canvas{{/crossLink}} has input focus.
                     * @event keydown
                     * @param value {Number} The key code, for example {{#crossLink "Input/KEY_LEFT_ARROW:property"}}{{/crossLink}},
                     */
                    self.fire("keydown", e.keyCode, true);
                }
            }

            if (self.mouseover) {
                e.preventDefault();
            }

        }, true);

        document.addEventListener("keyup", this._keyUpListener = function (e) {

            if (!self.enabled) {
                return;
            }

            if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {

                if (e.ctrlKey) {
                    self.ctrlDown = false;

                } else if (e.altKey) {
                    self.altDown = false;

                } else {
                    self.keyDown[e.keyCode] = false;

                    /**
                     * Fired whenever a key is released while the parent
                     * {{#crossLink "Scene"}}Scene{{/crossLink}}'s {{#crossLink "Canvas"}}Canvas{{/crossLink}} has input focus.
                     * @event keyup
                     * @param value {Number} The key code, for example {{#crossLink "Input/KEY_LEFT_ARROW:property"}}{{/crossLink}},
                     */
                    self.fire("keyup", e.keyCode, true);
                }
            }
        });

        cfg.element.addEventListener("mouseenter", this._mouseEnterListener = function (e) {

            if (!self.enabled) {
                return;
            }

            self.mouseover = true;

            const coords = self._getClickCoordsWithinElement(e);

            /**
             * Fired whenever the mouse is moved into of the parent
             * {{#crossLink "Scene"}}Scene{{/crossLink}}'s {{#crossLink "Canvas"}}Canvas{{/crossLink}}.
             * @event mouseenter
             * @param value {[Number, Number]} The mouse coordinates within the {{#crossLink "Canvas"}}Canvas{{/crossLink}},
             */
            self.fire("mouseenter", coords, true);
        });

        cfg.element.addEventListener("mouseleave", this._mouseLeaveListener = function (e) {

            if (!self.enabled) {
                return;
            }

            self.mouseover = false;

            const coords = self._getClickCoordsWithinElement(e);

            /**
             * Fired whenever the mouse is moved out of the parent
             * {{#crossLink "Scene"}}Scene{{/crossLink}}'s {{#crossLink "Canvas"}}Canvas{{/crossLink}}.
             * @event mouseleave
             * @param value {[Number, Number]} The mouse coordinates within the {{#crossLink "Canvas"}}Canvas{{/crossLink}},
             */
            self.fire("mouseleave", coords, true);
        });


        cfg.element.addEventListener("mousedown", this._mouseDownListener = function (e) {

            if (!self.enabled) {
                return;
            }

            switch (e.which) {

                case 1:// Left button
                    self.mouseDownLeft = true;
                    break;

                case 2:// Middle/both buttons
                    self.mouseDownMiddle = true;
                    break;

                case 3:// Right button
                    self.mouseDownRight = true;
                    break;

                default:
                    break;
            }

            const coords = self._getClickCoordsWithinElement(e);

            cfg.element.focus();

            /**
             * Fired whenever the mouse is pressed over the parent
             * {{#crossLink "Scene"}}Scene{{/crossLink}}'s {{#crossLink "Canvas"}}Canvas{{/crossLink}}.
             * @event mousedown
             * @param value {[Number, Number]} The mouse coordinates within the {{#crossLink "Canvas"}}Canvas{{/crossLink}},
             */
            self.fire("mousedown", coords, true);

            if (self.mouseover) {
                e.preventDefault();
            }
        });

        document.addEventListener("mouseup", this._mouseUpListener = function (e) {

            if (!self.enabled) {
                return;
            }

            switch (e.which) {

                case 1:// Left button
                    self.mouseDownLeft = false;
                    break;

                case 2:// Middle/both buttons
                    self.mouseDownMiddle = false;
                    break;

                case 3:// Right button
                    self.mouseDownRight = false;
                    break;

                default:
                    break;
            }

            const coords = self._getClickCoordsWithinElement(e);

            /**
             * Fired whenever the mouse is released over the parent
             * {{#crossLink "Scene"}}Scene{{/crossLink}}'s {{#crossLink "Canvas"}}Canvas{{/crossLink}}.
             * @event mouseup
             * @param value {[Number, Number]} The mouse coordinates within the {{#crossLink "Canvas"}}Canvas{{/crossLink}},
             */
            self.fire("mouseup", coords, true);

            if (self.mouseover) {
                e.preventDefault();
            }
        }, true);

        document.addEventListener("dblclick", this._dblClickListener = function (e) {

            if (!self.enabled) {
                return;
            }

            switch (e.which) {

                case 1:// Left button
                    self.mouseDownLeft = false;
                    self.mouseDownRight = false;
                    break;

                case 2:// Middle/both buttons
                    self.mouseDownMiddle = false;
                    break;

                case 3:// Right button
                    self.mouseDownLeft = false;
                    self.mouseDownRight = false;
                    break;

                default:
                    break;
            }

            const coords = self._getClickCoordsWithinElement(e);

            /**
             * Fired whenever the mouse is double-clicked over the parent
             * {{#crossLink "Scene"}}Scene{{/crossLink}}'s {{#crossLink "Canvas"}}Canvas{{/crossLink}}.
             * @event dblclick
             * @param value {[Number, Number]} The mouse coordinates within the {{#crossLink "Canvas"}}Canvas{{/crossLink}},
             */
            self.fire("dblclick", coords, true);

            if (self.mouseover) {
                e.preventDefault();
            }
        });

        cfg.element.addEventListener("mousemove", this._mouseMoveListener = function (e) {

            if (!self.enabled) {
                return;
            }

            const coords = self._getClickCoordsWithinElement(e);

            /**
             * Fired whenever the mouse is moved over the parent
             * {{#crossLink "Scene"}}Scene{{/crossLink}}'s {{#crossLink "Canvas"}}Canvas{{/crossLink}}.
             * @event mousedown
             * @param value {[Number, Number]} The mouse coordinates within the {{#crossLink "Canvas"}}Canvas{{/crossLink}},
             */
            self.fire("mousemove", coords, true);

            if (self.mouseover) {
                e.preventDefault();
            }
        });

        cfg.element.addEventListener("wheel", this._mouseWheelListener = function (e, d) {

            if (!self.enabled) {
                return;
            }

            const delta = Math.max(-1, Math.min(1, -e.deltaY * 40));

            /**
             * Fired whenever the mouse wheel is moved over the parent
             * {{#crossLink "Scene"}}Scene{{/crossLink}}'s {{#crossLink "Canvas"}}Canvas{{/crossLink}}.
             * @event mousewheel
             * @param delta {Number} The mouse wheel delta,
             */
            self.fire("mousewheel", delta, true);
        }, {passive: true});

        // mouseclicked

        (function () {

            let downX;
            let downY;

            // Tolerance between down and up positions for a mouse click
            const tolerance = 2;

            self.on("mousedown", function (params) {
                downX = params[0];
                downY = params[1];
            });

            self.on("mouseup", function (params) {

                if (downX >= (params[0] - tolerance) &&
                    downX <= (params[0] + tolerance) &&
                    downY >= (params[1] - tolerance) &&
                    downY <= (params[1] + tolerance)) {

                    /**
                     * Fired whenever the mouse is clicked over the parent
                     * {{#crossLink "Scene"}}Scene{{/crossLink}}'s {{#crossLink "Canvas"}}Canvas{{/crossLink}}.
                     * @event mouseclicked
                     * @param value {[Number, Number]} The mouse coordinates within the {{#crossLink "Canvas"}}Canvas{{/crossLink}},
                     */
                    self.fire("mouseclicked", params, true);
                }
            });
        })();


        // VR

        (function () {

            const orientationAngleLookup = {
                'landscape-primary': 90,
                'landscape-secondary': -90,
                'portrait-secondary': 180,
                'portrait-primary': 0
            };

            let orientation;
            let orientationAngle;
            const acceleration = math.vec3();
            const accelerationIncludingGravity = math.vec3();

            const orientationChangeEvent = {
                orientation: null,
                orientationAngle: 0
            };

            const deviceMotionEvent = {
                orientationAngle: 0,
                acceleration: null,
                accelerationIncludingGravity: accelerationIncludingGravity,
                rotationRate: math.vec3(),
                interval: 0
            };

            const deviceOrientationEvent = {
                alpha: 0,
                beta: 0,
                gamma: 0,
                absolute: false
            };

            if (window.OrientationChangeEvent) {
                window.addEventListener('orientationchange', self._orientationchangedListener = function () {

                        orientation = window.screen.orientation || window.screen.mozOrientation || window.msOrientation || null;
                        orientationAngle = orientation ? (orientationAngleLookup[orientation] || 0) : 0;

                        orientationChangeEvent.orientation = orientation;
                        orientationChangeEvent.orientationAngle = orientationAngle;

                        /**
                         * Fired when the orientation of the device has changed.
                         *
                         * @event orientationchange
                         * @param orientation The orientation: "landscape-primary", "landscape-secondary", "portrait-secondary" or "portrait-primary"
                         * @param orientationAngle The orientation angle in degrees: 90 for landscape-primary, -90 for landscape-secondary, 180 for portrait-secondary or 0 for portrait-primary.
                         */
                        self.fire("orientationchange", orientationChangeEvent);
                    },
                    false);
            }

            if (window.DeviceMotionEvent) {
                window.addEventListener('devicemotion', self._deviceMotionListener = function (e) {

                        deviceMotionEvent.interval = e.interval;
                        deviceMotionEvent.orientationAngle = orientationAngle;

                        const accel = e.acceleration;

                        if (accel) {
                            acceleration[0] = accel.x;
                            acceleration[1] = accel.y;
                            acceleration[2] = accel.z;
                            deviceMotionEvent.acceleration = acceleration;
                        } else {
                            deviceMotionEvent.acceleration = null;
                        }

                        const accelGrav = e.accelerationIncludingGravity;

                        if (accelGrav) {
                            accelerationIncludingGravity[0] = accelGrav.x;
                            accelerationIncludingGravity[1] = accelGrav.y;
                            accelerationIncludingGravity[2] = accelGrav.z;
                            deviceMotionEvent.accelerationIncludingGravity = accelerationIncludingGravity;
                        } else {
                            deviceMotionEvent.accelerationIncludingGravity = null;
                        }

                        deviceMotionEvent.rotationRate = e.rotationRate;

                        /**
                         * Fires on a regular interval and returns data about the rotation
                         * (in degrees per second) and acceleration (in meters per second squared) of the device, at that moment in
                         * time. Some devices do not have the hardware to exclude the effect of gravity.
                         *
                         * @event devicemotion
                         * @param Float32Array acceleration The acceleration of the device, in meters per second squared, as a 3-element vector. This value has taken into account the effect of gravity and removed it from the figures. This value may not exist if the hardware doesn't know how to remove gravity from the acceleration data.
                         * @param Float32Array accelerationIncludingGravity The acceleration of the device, in meters per second squared, as a 3-element vector. This value includes the effect of gravity, and may be the only value available on devices that don't have a gyroscope to allow them to properly remove gravity from the data.
                         * @param, Number interval The interval, in milliseconds, at which this event is fired. The next event will be fired in approximately this amount of time.
                         * @param  Float32Array rotationRate The rates of rotation of the device about each axis, in degrees per second.
                         */
                        self.fire("devicemotion", deviceMotionEvent);
                    },
                    false);
            }

            if (window.DeviceOrientationEvent) {
                window.addEventListener("deviceorientation", self._deviceOrientListener = function (e) {

                        deviceOrientationEvent.gamma = e.gamma;
                        deviceOrientationEvent.beta = e.beta;
                        deviceOrientationEvent.alpha = e.alpha;
                        deviceOrientationEvent.absolute = e.absolute;

                        /**
                         * Fired when fresh data is available from an orientation sensor about the current orientation
                         * of the device as compared to the Earth coordinate frame. This data is gathered from a
                         * magnetometer inside the device. See
                         * <a href="https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Orientation_and_motion_data_explained">Orientation and motion data explained</a> for more info.
                         *
                         * @event deviceorientation
                         * @param Number alpha The current orientation of the device around the Z axis in degrees; that is, how far the device is rotated around a line perpendicular to the device.
                         * @param Number beta The current orientation of the device around the X axis in degrees; that is, how far the device is tipped forward or backward.
                         * @param Number gamma The current orientation of the device around the Y axis in degrees; that is, how far the device is turned left or right.
                         * @param Boolean absolute This value is true if the orientation is provided as a difference between the device coordinate frame and the Earth coordinate frame; if the device can't detect the Earth coordinate frame, this value is false.
                         */
                        self.fire("deviceorientation", deviceOrientationEvent);
                    },
                    false);
            }
        })();
    }

    _getClickCoordsWithinElement(event) {
        const coords = [0, 0];
        if (!event) {
            event = window.event;
            coords.x = event.x;
            coords.y = event.y;
        }
        else {
            let element = event.target;
            let totalOffsetLeft = 0;
            let totalOffsetTop = 0;

            while (element.offsetParent) {
                totalOffsetLeft += element.offsetLeft;
                totalOffsetTop += element.offsetTop;
                element = element.offsetParent;
            }
            coords[0] = event.pageX - totalOffsetLeft;
            coords[1] = event.pageY - totalOffsetTop;
        }
        return coords;
    }

    /**
     * Enable or disable all input handlers
     *
     * @param enable
     */
    setEnabled(enable) {
        if (this.enabled !== enable) {
            this.fire("enabled", this.enabled = enable);
        }
    }

    destroy() {
        super.destroy();
        // Prevent memory leak when destroying canvas/WebGL context
        document.removeEventListener("keydown", this._keyDownListener);
        document.removeEventListener("keyup", this._keyUpListener);
        this._element.removeEventListener("mouseenter", this._mouseEnterListener);
        this._element.removeEventListener("mouseleave", this._mouseLeaveListener);
        this._element.removeEventListener("mousedown", this._mouseDownListener);
        document.removeEventListener("mouseup", this._mouseDownListener);
        document.removeEventListener("dblclick", this._dblClickListener);
        this._element.removeEventListener("mousemove", this._mouseMoveListener);
        this._element.removeEventListener("wheel", this._mouseWheelListener);
        if (window.OrientationChangeEvent) {
            window.removeEventListener('orientationchange', this._orientationchangedListener);
        }
        if (window.DeviceMotionEvent) {
            window.removeEventListener('devicemotion', this._deviceMotionListener);
        }
        if (window.DeviceOrientationEvent) {
            window.addEventListener("deviceorientation", this._deviceOrientListener);
        }
    }
}

/**
 A **Viewport** controls the canvas viewport for a {{#crossLink "Scene"}}{{/crossLink}}.

 <a href="../../examples/#effects_stereo_custom"><img src="../../../assets/images/screenshots/StereoEffect.png"></img></a>

 ## Overview

 * One Viewport per scene.
 * You can configure a Scene to render multiple times per frame, while setting the Viewport to different extents on each render.
 * Make a Viewport automatically size to its {{#crossLink "Scene"}}Scene's{{/crossLink}} {{#crossLink "Canvas"}}{{/crossLink}}
 by setting its {{#crossLink "Viewport/autoBoundary:property"}}{{/crossLink}} property ````true```` (default is ````false````).

 ## Examples

 * [Stereo effect using alternating viewports](../../examples/#effects_stereo_custom)

 ## Usage

 Configuring the Scene to render twice on each frame, each time to a separate viewport:

 ````Javascript
 // Load glTF model
 var model = new xeogl.GLTFModel({
    src: "models/gltf/GearboxAssy/glTF-MaterialsCommon/GearboxAssy.gltf"
 });

 var scene = model.scene;
 var viewport = scene.viewport;

 // Configure Scene to render twice for each frame
 scene.passes = 2; // Default is 1
 scene.clearEachPass = false; // Default is false

 // Render to a separate viewport on each render

 var viewport = scene.viewport;
 viewport.autoBoundary = false;

 scene.on("rendering", function (e) {
     switch (e.pass) {
         case 0:
             viewport.boundary = [0, 0, 200, 200]; // xmin, ymin, width, height
             break;

         case 1:
             viewport.boundary = [200, 0, 200, 200];
             break;
     }
 });
 ````

 @class Viewport
 @module xeogl
 @submodule rendering
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Viewport configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent
 {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Viewport.
 @param [cfg.boundary] {Array of Number} Canvas-space Viewport boundary, given as
 (min, max, width, height). Defaults to the size of the parent
 {{#crossLink "Scene"}}Scene's{{/crossLink}} {{#crossLink "Canvas"}}{{/crossLink}}.
 @param [cfg.autoBoundary=false] {Boolean} Indicates whether this Viewport's {{#crossLink "Viewport/boundary:property"}}{{/crossLink}}
 automatically synchronizes with the size of the parent {{#crossLink "Scene"}}Scene's{{/crossLink}} {{#crossLink "Canvas"}}{{/crossLink}}.

 @extends Component
 */
const type$10 = "xeogl.Viewport";

class Viewport extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$10;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            boundary: [0, 0, 100, 100]
        });

        this.boundary = cfg.boundary;
        this.autoBoundary = cfg.autoBoundary;
    }


    /**
     The canvas-space boundary of this Viewport, indicated as [min, max, width, height].

     Defaults to the size of the parent
     {{#crossLink "Scene"}}Scene's{{/crossLink}} {{#crossLink "Canvas"}}{{/crossLink}}.

     Ignores attempts to set value when {{#crossLink "Viewport/autoBoundary:property"}}{{/crossLink}} is ````true````.

     Fires a {{#crossLink "Viewport/boundary:event"}}{{/crossLink}} event on change.

     @property boundary
     @default [size of Scene Canvas]
     @type {Array of Number}
     */
    set boundary(value) {

        if (this._autoBoundary) {
            return;
        }

        if (!value) {

            const canvasBoundary = this.scene.canvas.boundary;

            const width = canvasBoundary[2];
            const height = canvasBoundary[3];

            value = [0, 0, width, height];
        }

        this._state.boundary = value;

        this._renderer.imageDirty();

        /**
         Fired whenever this Viewport's {{#crossLink "Viewport/boundary:property"}}{{/crossLink}} property changes.

         @event boundary
         @param value {Boolean} The property's new value
         */
        this.fire("boundary", this._state.boundary);
    }

    get boundary() {
        return this._state.boundary;
    }

    /**
     Indicates whether this Viewport's {{#crossLink "Viewport/boundary:property"}}{{/crossLink}} automatically
     synchronizes with the size of the parent {{#crossLink "Scene"}}Scene's{{/crossLink}} {{#crossLink "Canvas"}}{{/crossLink}}.

     When set true, then this Viewport will fire a {{#crossLink "Viewport/boundary/event"}}{{/crossLink}} whenever
     the {{#crossLink "Canvas"}}{{/crossLink}} resizes. Also fires that event as soon as this ````autoBoundary````
     property is changed.

     Fires a {{#crossLink "Viewport/autoBoundary:event"}}{{/crossLink}} event on change.

     @property autoBoundary
     @default false
     @type Boolean
     */
    set autoBoundary(value) {

        value = !!value;

        if (value === this._autoBoundary) {
            return;
        }

        this._autoBoundary = value;

        if (this._autoBoundary) {
            this._onCanvasSize = this.scene.canvas.on("boundary",
                function (boundary) {

                    const width = boundary[2];
                    const height = boundary[3];

                    this._state.boundary = [0, 0, width, height];

                    this._renderer.imageDirty();

                    /**
                     Fired whenever this Viewport's {{#crossLink "Viewport/boundary:property"}}{{/crossLink}} property changes.

                     @event boundary
                     @param value {Boolean} The property's new value
                     */
                    this.fire("boundary", this._state.boundary);

                }, this);

        } else if (this._onCanvasSize) {
            this.scene.canvas.off(this._onCanvasSize);
            this._onCanvasSize = null;
        }

        /**
         Fired whenever this Viewport's {{#crossLink "autoBoundary/autoBoundary:property"}}{{/crossLink}} property changes.

         @event autoBoundary
         @param value The property's new value
         */
        this.fire("autoBoundary", this._autoBoundary);
    }

    get autoBoundary() {
        return this._autoBoundary;
    }

    _getState() {
        return this._state;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
    }
}

componentClasses[type$10] = Viewport;

/**
 A **Perspective** defines a perspective projection transform for a {{#crossLink "Camera"}}Camera{{/crossLink}}.

 ## Overview

 * A {{#crossLink "Camera"}}Camera{{/crossLink}} has a Perspective to configure its perspective projection mode.

 ## Examples

 * [Camera with perspective projection](../../examples/#camera_perspective)

 ## Usage

 * See {{#crossLink "Camera"}}{{/crossLink}}

 @class Perspective
 @module xeogl
 @submodule camera
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Perspective.
 @param [cfg.parent] {String|Transform} ID or instance of a parent {{#crossLink "Transform"}}{{/crossLink}} within the same {{#crossLink "Scene"}}Scene{{/crossLink}}.
 @param [cfg.fov=60.0] {Number} Field-of-view angle, in degrees.
 @param [cfg.fovAxis="min"] {String} The field-of-view axis: "x", "y", or "min" to use whichever is currently the minimum.
 @param [cfg.near=0.1] {Number} Position of the near plane on the View-space Z-axis.
 @param [cfg.far=10000] {Number} Position of the far plane on the View-space Z-axis.
 @author xeolabs / http://xeolabs.com
 @author Artur-Sampaio / https://github.com/Artur-Sampaio
 @extends Component
 */

const type$11 = "xeogl.Perspective";

class Perspective extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$11;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            matrix: math.mat4()
        });

        this._dirty = false;
        this._fov = 60.0;
        this._near = 0.1;
        this._far = 10000.0;

        // Recompute aspect from change in canvas size
        this._canvasResized = this.scene.canvas.on("boundary", this._needUpdate, this);

        this.fov = cfg.fov;
        this.fovAxis = cfg.fovAxis;
        this.near = cfg.near;
        this.far = cfg.far;
    }

    _update() {
        const WIDTH_INDEX = 2;
        const HEIGHT_INDEX = 3;
        const boundary = this.scene.viewport.boundary;
        const aspect = boundary[WIDTH_INDEX] / boundary[HEIGHT_INDEX];
        let fov = this._fov;
        const fovAxis = this._fovAxis;
        if (fovAxis == "x" || (fovAxis == "min" && aspect < 1) || (fovAxis == "max" && aspect > 1)) {
            fov = fov / aspect;
        }
        fov = Math.min(fov, 120);
        math.perspectiveMat4(fov * (Math.PI / 180.0), aspect, this._near, this._far, this._state.matrix);
        this._renderer.imageDirty();
        this.fire("matrix", this._state.matrix);
    }

    /**
     The field-of-view angle (FOV).

     Fires a {{#crossLink "Perspective/fov:event"}}{{/crossLink}} event on change.

     @property fov
     @default 60.0
     @type Number
     */
    set fov(value) {
        this._fov = (value !== undefined && value !== null) ? value : 60.0;
        this._needUpdate(0); // Ensure matrix built on next "tick"
        /**
         Fired whenever this Perspective's {{#crossLink "Perspective/fov:property"}}{{/crossLink}} property changes.

         @event fov
         @param value The property's new value
         */
        this.fire("fov", this._fov);
    }

    get fov() {
        return this._fov;
    }

    /**
     The FOV axis.

     Options are "x", "y" or "min", to use the minimum axis.

     Fires a {{#crossLink "Perspective/fov:event"}}{{/crossLink}} event on change.

     @property fovAxis
     @default "min"
     @type String
     */
    set fovAxis(value) {
        value = value || "min";
        if (this._fovAxis === value) {
            return;
        }
        if (value !== "x" && value !== "y" && value !== "min") {
            this.error("Unsupported value for 'fovAxis': " + value + " - defaulting to 'min'");
            value = "min";
        }
        this._fovAxis = value;
        this._needUpdate(0); // Ensure matrix built on next "tick"
        /**
         Fired whenever this Perspective's {{#crossLink "Perspective/fovAxis:property"}}{{/crossLink}} property changes.

         @event fovAxis
         @param value The property's new value
         */
        this.fire("fovAxis", this._fovAxis);
    }

    get fovAxis() {
        return this._fovAxis;
    }

    /**
     Position of this Perspective's near plane on the positive View-space Z-axis.

     Fires a {{#crossLink "Perspective/near:event"}}{{/crossLink}} event on change.

     @property near
     @default 0.1
     @type Number
     */
    set near(value) {
        this._near = (value !== undefined && value !== null) ? value : 0.1;
        this._needUpdate(0); // Ensure matrix built on next "tick"
        /**
         Fired whenever this Perspective's   {{#crossLink "Perspective/near:property"}}{{/crossLink}} property changes.
         @event near
         @param value The property's new value
         */
        this.fire("near", this._near);
    }

    get near() {
        return this._near;
    }

    /**
     Position of this Perspective's far plane on the positive View-space Z-axis.

     Fires a {{#crossLink "Perspective/far:event"}}{{/crossLink}} event on change.

     @property far
     @default 10000.0
     @type Number
     */
    set far(value) {
        this._far = (value !== undefined && value !== null) ? value : 10000;
        this._needUpdate(0); // Ensure matrix built on next "tick"
        /**
         Fired whenever this Perspective's  {{#crossLink "Perspective/far:property"}}{{/crossLink}} property changes.

         @event far
         @param value The property's new value
         */
        this.fire("far", this._far);
    }

    get far() {
        return this._far;
    }

    /**
     The Perspective's projection transform matrix.

     Fires a {{#crossLink "Perspective/matrix:event"}}{{/crossLink}} event on change.

     @property matrix
     @default [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
     @type {Float32Array}
     */
    get matrix() {
        if (this._updateScheduled) {
            this._doUpdate();
        }
        return this._state.matrix;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
        super.destroy();
        this.scene.canvas.off(this._canvasResized);
    }
}

componentClasses[type$11] = Perspective;

/**
 An **Ortho** defines an orthographic projection transform for a {{#crossLink "Camera"}}Camera{{/crossLink}}.

 ## Overview

 * A {{#crossLink "Camera"}}Camera{{/crossLink}} has an Ortho to configure its orthographic projection mode.
 * An Ortho works like Blender's orthographic projection, where the positions of the left, right, top and bottom planes are
 implicitly specified with a single {{#crossLink "Ortho/scale:property"}}{{/crossLink}} property, which causes the frustum to be symmetrical on X and Y axis, large enough to
 contain the number of units given by {{#crossLink "Ortho/scale:property"}}{{/crossLink}}.
 * An Ortho's {{#crossLink "Ortho/near:property"}}{{/crossLink}} and {{#crossLink "Ortho/far:property"}}{{/crossLink}} properties
 specify the distances to the WebGL clipping planes.


 ## Examples

 * [Camera with orthographic projection](../../examples/#camera_orthographic)

 ## Usage

 * See {{#crossLink "Camera"}}{{/crossLink}}

 @class Ortho
 @module xeogl
 @submodule camera
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Ortho.
 @param [cfg.parent] {String|Transform} ID or instance of a parent {{#crossLink "Transform"}}{{/crossLink}} within the same {{#crossLink "Scene"}}Scene{{/crossLink}}.
 @param [cfg.scale=1.0] {Number} Scale factor for this Ortho's extents on X and Y axis.
 @param [cfg.near=0.1] {Number} Position of the near plane on the View-space Z-axis.
 @param [cfg.far=10000] {Number} Position of the far plane on the positive View-space Z-axis.
 @author xeolabs / http://xeolabs.com
 @author Artur-Sampaio / https://github.com/Artur-Sampaio
 @extends Component
 */
const type$12 = "xeogl.Ortho";

class Ortho extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$12;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            matrix: math.mat4()
        });

        this.scale = cfg.scale;
        this.near = cfg.near;
        this.far = cfg.far;

        this._onCanvasBoundary = this.scene.canvas.on("boundary", this._needUpdate, this);
    }

    _update() {

        const WIDTH_INDEX = 2;
        const HEIGHT_INDEX = 3;

        const scene = this.scene;
        const scale = this._scale;
        const halfSize = 0.5 * scale;

        const boundary = scene.viewport.boundary;
        const boundaryWidth = boundary[WIDTH_INDEX];
        const boundaryHeight = boundary[HEIGHT_INDEX];
        const aspect = boundaryWidth / boundaryHeight;

        let left;
        let right;
        let top;
        let bottom;

        if (boundaryWidth > boundaryHeight) {
            left = -halfSize;
            right = halfSize;
            top = halfSize / aspect;
            bottom = -halfSize / aspect;

        } else {
            left = -halfSize * aspect;
            right = halfSize * aspect;
            top = halfSize;
            bottom = -halfSize;
        }

        math.orthoMat4c(left, right, bottom, top, this._near, this._far, this._state.matrix);

        this._renderer.imageDirty();

        this.fire("matrix", this._state.matrix);
    }


    /**
     Scale factor for this Ortho's extents on X and Y axis.

     Clamps to minimum value of ````0.01```.

     Fires a {{#crossLink "Ortho/scale:event"}}{{/crossLink}} event on change.

     @property scale
     @default 1.0
     @type Number
     */

    set scale(value) {
        if (value === undefined || value === null) {
            value = 1.0;
        }
        if (value <= 0) {
            value = 0.01;
        }
        this._scale = value;
        this._needUpdate();
        /**
         Fired whenever this Ortho's {{#crossLink "Ortho/scale:property"}}{{/crossLink}} property changes.

         @event scale
         @param value The property's new value
         */
        this.fire("scale", this._scale);
    }

    get scale() {
        return this._scale;
    }

    /**
     Position of this Ortho's near plane on the positive View-space Z-axis.

     Fires a {{#crossLink "Ortho/near:event"}}{{/crossLink}} event on change.

     @property near
     @default 0.1
     @type Number
     */
    set near(value) {
        this._near = (value !== undefined && value !== null) ? value : 0.1;
        this._needUpdate();
        /**
         Fired whenever this Ortho's  {{#crossLink "Ortho/near:property"}}{{/crossLink}} property changes.

         @event near
         @param value The property's new value
         */
        this.fire("near", this._near);
    }

    get near() {
        return this._near;
    }

    /**
     Position of this Ortho's far plane on the positive View-space Z-axis.

     Fires a {{#crossLink "Ortho/far:event"}}{{/crossLink}} event on change.

     @property far
     @default 10000.0
     @type Number
     */
    set far(value) {
        this._far = (value !== undefined && value !== null) ? value : 10000.0;
        this._needUpdate();
        /**
         Fired whenever this Ortho's {{#crossLink "Ortho/far:property"}}{{/crossLink}} property changes.

         @event far
         @param value The property's new value
         */
        this.fire("far", this._far);
    }

    get far() {
        return this._far;
    }

    /**
     The Ortho's projection transform matrix.

     Fires a {{#crossLink "Ortho/matrix:event"}}{{/crossLink}} event on change.

     @property matrix
     @default [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
     @type {Float32Array}
     */
    get matrix() {
        if (this._updateScheduled) {
            this._doUpdate();
        }
        return this._state.matrix;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
        this.scene.canvas.off(this._onCanvasBoundary);
    }
}

componentClasses[type$12] = Ortho;

/**
 A **Frustum** defines a perspective projection as a frustum-shaped view volume for a {{#crossLink "Camera"}}Camera{{/crossLink}}.

 ## Overview

 * A {{#crossLink "Camera"}}Camera{{/crossLink}} has a Frustum to configure its frustum-based perspective projection mode.
 * A Frustum lets us explicitly set the positions of the left, right, top, bottom, near and far planes, which is useful
 for asymmetrical view volumes, such as those used for stereo viewing.
 * A Frustum's {{#crossLink "Frustum/near:property"}}{{/crossLink}} and {{#crossLink "Frustum/far:property"}}{{/crossLink}} properties
 specify the distances to the WebGL clipping planes.

 ## Examples

 * [Camera with frustum projection](../../examples/#camera_frustum)
 * [Stereo viewing with frustum projection](../../examples/#effects_stereo)

 ## Usage

 * See {{#crossLink "Camera"}}{{/crossLink}}

 @class Frustum
 @module xeogl
 @submodule camera
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Frustum.
 @param [cfg.left=-1] {Number} Position of the Frustum's left plane on the View-space X-axis.
 @param [cfg.right=1] {Number} Position of the Frustum's right plane on the View-space X-axis.
 @param [cfg.bottom=-1] {Number} Position of the Frustum's bottom plane on the View-space Y-axis.
 @param [cfg.top=1] {Number} Position of the Frustum's top plane on the View-space Y-axis.
 @param [cfg.near=0.1] {Number} Position of the Frustum's near plane on the View-space Z-axis.
 @param [cfg.far=1000] {Number} Position of the Frustum's far plane on the positive View-space Z-axis.
 @extends Component
 */
const type$13 = "xeogl.Frustum";

class Frustum extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$13;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            matrix: math.mat4()
        });

        this._left = -1.0;
        this._right = 1.0;
        this._bottom = -1.0;
        this._top = 1.0;
        this._near = 0.1;
        this._far = 5000.0;

        // Set component properties

        this.left = cfg.left;
        this.right = cfg.right;
        this.bottom = cfg.bottom;
        this.top = cfg.top;
        this.near = cfg.near;
        this.far = cfg.far;
    }

    _update() {
        math.frustumMat4(this._left, this._right, this._bottom, this._top, this._near, this._far, this._state.matrix);
        this._renderer.imageDirty();
        this.fire("matrix", this._state.matrix);
    }

    /**
     Position of this Frustum's left plane on the View-space X-axis.

     Fires a {{#crossLink "Frustum/left:event"}}{{/crossLink}} event on change.

     @property left
     @default -1.0
     @type Number
     */

    set left(value) {
        this._left = (value !== undefined && value !== null) ? value : -1.0;
        this._needUpdate();
        /**
         Fired whenever this Frustum's {{#crossLink "Frustum/left:property"}}{{/crossLink}} property changes.

         @event left
         @param value The property's new value
         */
        this.fire("left", this._left);
    }

    get left() {
        return this._left;
    }

    /**
     Position of this Frustum's right plane on the View-space X-axis.

     Fires a {{#crossLink "Frustum/right:event"}}{{/crossLink}} event on change.

     @property right
     @default 1.0
     @type Number
     */
    set right(value) {
        this._right = (value !== undefined && value !== null) ? value : 1.0;
        this._needUpdate();
        /**
         Fired whenever this Frustum's {{#crossLink "Frustum/right:property"}}{{/crossLink}} property changes.

         @event right
         @param value The property's new value
         */
        this.fire("right", this._right);
    }

    get right() {
        return this._right;
    }

    /**
     Position of this Frustum's top plane on the View-space Y-axis.

     Fires a {{#crossLink "Frustum/top:event"}}{{/crossLink}} event on change.

     @property top
     @default 1.0
     @type Number
     */
    set top(value) {
        this._top = (value !== undefined && value !== null) ? value : 1.0;
        this._needUpdate();
        /**
         Fired whenever this Frustum's   {{#crossLink "Frustum/top:property"}}{{/crossLink}} property changes.

         @event top
         @param value The property's new value
         */
        this.fire("top", this._top);
    }

    get top() {
        return this._top;
    }

    /**
     Position of this Frustum's bottom plane on the View-space Y-axis.

     Fires a {{#crossLink "Frustum/bottom:event"}}{{/crossLink}} event on change.

     @property bottom
     @default -1.0
     @type Number
     */
    set bottom(value) {
        this._bottom = (value !== undefined && value !== null) ? value : -1.0;
        this._needUpdate();
        /**
         Fired whenever this Frustum's   {{#crossLink "Frustum/bottom:property"}}{{/crossLink}} property changes.

         @event bottom
         @param value The property's new value
         */
        this.fire("bottom", this._bottom);
    }

    get bottom() {
        return this._bottom;
    }

    /**
     Position of this Frustum's near plane on the positive View-space Z-axis.

     Fires a {{#crossLink "Frustum/near:event"}}{{/crossLink}} event on change.

     @property near
     @default 0.1
     @type Number
     */
    set near(value) {
        this._near = (value !== undefined && value !== null) ? value : 0.1;
        this._needUpdate();
        /**
         Fired whenever this Frustum's {{#crossLink "Frustum/near:property"}}{{/crossLink}} property changes.

         @event near
         @param value The property's new value
         */
        this.fire("near", this._near);
    }

    get near() {
        return this._near;
    }

    /**
     Position of this Frustum's far plane on the positive View-space Z-axis.

     Fires a {{#crossLink "Frustum/far:event"}}{{/crossLink}} event on change.

     @property far
     @default 10000.0
     @type Number
     */
    set far(value) {
        this._far = (value !== undefined && value !== null) ? value : 10000.0;
        this._needUpdate();
        /**
         Fired whenever this Frustum's  {{#crossLink "Frustum/far:property"}}{{/crossLink}} property changes.

         @event far
         @param value The property's new value
         */
        this.fire("far", this._far);
    }

    get far() {
        return this._far;
    }

    /**
     The Frustum's projection transform matrix.

     Fires a {{#crossLink "Frustum/matrix:event"}}{{/crossLink}} event on change.

     @property matrix
     @default [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
     @type {Float32Array}
     */
    get matrix() {
        if (this._updateScheduled) {
            this._doUpdate();
        }
        return this._state.matrix;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
        super.destroy();
    }
}

componentClasses[type$13] = Frustum;

/**
 A **CustomProjection** defines a projection for a {{#crossLink "Camera"}}Camera{{/crossLink}} as a custom 4x4 matrix..

 ## Overview

 * A {{#crossLink "Camera"}}Camera{{/crossLink}} has a CustomProjection to configure its custom projection mode.
 * A CustomProjection lets us explicitly set the elements of its 4x4 transformation matrix.

 ## Examples

 * [Camera with a CustomProjection](../../examples/#camera_customProjection)

 ## Usage

 * See {{#crossLink "Camera"}}{{/crossLink}}

 @class CustomProjection
 @module xeogl
 @submodule camera
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this CustomProjection.
 @param [cfg.matrix=] {Float32Array} 4x4 transform matrix.
 @extends Component
 */
const type$14 = "xeogl.CustomProjection";

class CustomProjection extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$14;
    }

    init(cfg) {
        super.init(cfg);
        this._state = new State({
            matrix: math.mat4()
        });
        this.matrix = cfg.matrix;
    }


    /**
     The CustomProjection's projection transform matrix.

     Fires a {{#crossLink "CustomProjection/matrix:event"}}{{/crossLink}} event on change.

     @property matrix
     @default [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
     @type {Float32Array}
     */
    set matrix(matrix) {

        this._state.matrix.set(matrix || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

        /**
         Fired whenever this CustomProjection's {{#crossLink "CustomProjection/matrix:property"}}{{/crossLink}} property changes.

         @event matrix
         @param value The property's new value
         */
        this.fire("far", this._state.matrix);
    }

    get matrix() {
        return this._state.matrix;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
    }
}

componentClasses[type$14] = CustomProjection;

/**
 A **Camera** defines viewing and projection transforms for its {{#crossLink "Scene"}}{{/crossLink}}.

 ## Overview

 * One Camera per Scene
 * Controls viewing and projection transforms
 * Has methods to pan, zoom and orbit (or first-person rotation)
 * Dynamically configurable World-space "up" direction
 * Switchable between perspective, frustum and orthographic projections
 * Switchable gimbal lock
 * Can be "flown" to look at targets using a {{#crossLink "CameraFlightAnimation"}}{{/crossLink}}
 * Can be animated along a path using a {{#crossLink "CameraPathAnimation"}}{{/crossLink}}
 * Can follow a target using a {{#crossLink "CameraFollowAnimation"}}{{/crossLink}}

 ## Examples

 * [Perspective projection](../../examples/#camera_perspective)
 * [Orthographic projection](../../examples/#camera_orthographic)
 * [Frustum projection](../../examples/#camera_frustum)
 * [Camera with world Z-axis as "up"](../../examples/#camera_zAxisUp)
 * [Camera with world Y-axis as "up"](../../examples/#camera_yAxisUp)
 * [Automatically following a Mesh with a Camera](../../examples/#camera_follow)
 * [Animating a Camera along a path](../../examples/#camera_path_interpolation)
 * [Architectural fly-through](../../examples/#importing_gltf_ModernOffice)

 ## Usage

 * [Getting the Camera](#getting-the-camera)
 * [Moving around](#moving-around)
 * [Projection](#projection)
 * [Configuring World up direction](#configuring-world-up-direction)
 * [Gimbal locking](#gimbal-locking)
 * [Stereo rendering](#stereo-rendering)

 ### Getting the Camera

 There is exactly one Camera per Scene:

 ````javascript
 var camera = myScene.camera;
 ````

 ### Moving around

 Get and set the Camera's absolute position at any time via its {{#crossLink "Camera/eye:property"}}{{/crossLink}},
 {{#crossLink "Camera/look:property"}}{{/crossLink}} and {{#crossLink "Camera/up:property"}}{{/crossLink}} properties:

 ````javascript
 camera.eye = [-10,0,0];
 camera.look = [-10,0,0];
 camera.up = [0,1,0];
 ````

 Get the view matrix:

 ````javascript
 var viewMatrix = camera.viewMatrix;
 var viewNormalMatrix = camera.normalMatrix;
 ````

 Listen for view matrix updates:

 ````javascript
 camera.on("matrix", function(matrix) { ... });
 ````

 Orbiting the {{#crossLink "Camera/look:property"}}{{/crossLink}} position:

 ````javascript
 camera.orbitYaw(20.0);
 camera.orbitPitch(10.0);
 ````

 First-person rotation, rotates {{#crossLink "Camera/look:property"}}{{/crossLink}}
 and {{#crossLink "Camera/up:property"}}{{/crossLink}} about {{#crossLink "Camera/eye:property"}}{{/crossLink}}:

 ````javascript
 camera.yaw(5.0);
 camera.pitch(-10.0);
 ````

 Panning along the Camera's local axis (ie. left/right, up/down, forward/backward):

 ````javascript
 camera.pan([-20, 0, 10]);
 ````

 Zoom to vary distance between {{#crossLink "Camera/eye:property"}}{{/crossLink}} and {{#crossLink "Camera/look:property"}}{{/crossLink}}:

 ````javascript
 camera.zoom(-5); // Move five units closer
 ````

 Get the current distance between {{#crossLink "Camera/eye:property"}}{{/crossLink}} and {{#crossLink "Camera/look:property"}}{{/crossLink}}:

 ````javascript
 var distance = camera.eyeLookDist;
 ````

 ### Projection

 For each projection type, the Camera has a Component to manage that projection's configuration. You can hot-switch the Camera
 between those projection types, while updating the properties of each projection component at any time.

 ````javascript
 camera.perspective.near = 0.4;
 camera.perspective.fov = 45;
 //...

 camera.ortho.near = 0.8;
 camera.ortho.far = 1000;
 //...

 camera.frustum.left = -1.0;
 camera.frustum.right = 1.0;
 camera.frustum.far = 1000.0;
 //...

 camera.customProjection.matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

 camera.projection = "perspective"; // Switch to perspective
 camera.projection = "frustum"; // Switch to frustum
 camera.projection = "ortho"; // Switch to ortho
 camera.projection = "customProjection"; // Switch to custom
 ````

 Get the projection matrix:

 ````javascript
 var projMatrix = camera.projMatrix;
 ````

 Listen for projection matrix updates:

 ````javascript
 camera.on("projMatrix", function(matrix) { ... });
 ````

 ### Configuring World up direction

 We can dynamically configure the direction that we consider to be "up" in the World-space coordinate system.

 Set the +Y axis as World "up" (convention in some modeling software):

 ````javascript
 camera.worldAxis = [
 1, 0, 0,    // Right
 0, 1, 0,    // Up
 0, 0,-1     // Forward
 ];
 ````

 Set the +Z axis as World "up" (convention in most CAD and BIM viewers):

 ````javascript
 camera.worldAxis = [
 1, 0, 0, // Right
 0, 0, 1, // Up
 0,-1, 0  // Forward
 ];
 ````

 The Camera has read-only convenience properties that provide each axis individually:

 ````javascript
 var worldRight = camera.worldRight;
 var worldForward = camera.worldForward;
 var worldUp = camera.worldUp;
 ````

 ### Gimbal locking

 By default, the Camera locks yaw rotation to pivot about the World-space "up" axis. We can dynamically lock and unlock that
 at any time:

 ````javascript
 camera.gimbalLock = false; // Yaw rotation now happens about Camera's local Y-axis
 camera.gimbalLock = true; // Yaw rotation now happens about World's "up" axis
 ````

 See: <a href="https://en.wikipedia.org/wiki/Gimbal_lock">https://en.wikipedia.org/wiki/Gimbal_lock</a>

 ### Stereo rendering

 TODO: Describe stereo techniques and the deviceMatrix property

 @class Camera
 @module xeogl
 @submodule camera
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 You only need to supply an ID if you need to be able to find the Camera by ID within its parent {{#crossLink "Scene"}}Scene{{/crossLink}} later.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Camera.
 @extends Component
 */
const tempVec3 = math.vec3();
const tempVec3b = math.vec3();
const tempVec3c = math.vec3();
const tempVec3d = math.vec3();
const tempVec3e = math.vec3();
const tempVec3f = math.vec3();
const tempMat = math.mat4();
const tempMatb = math.mat4();
const eyeLookVec = math.vec3();
const eyeLookVecNorm = math.vec3();
const eyeLookOffset = math.vec3();
const offsetEye = math.vec3();

const type$15 = "xeogl.Camera";

class Camera extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$15;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            deviceMatrix: math.mat4(),
            hasDeviceMatrix: false, // True when deviceMatrix set to other than identity
            matrix: math.mat4(),
            normalMatrix: math.mat4()
        });

        this._perspective = new Perspective(this);
        this._ortho = new Ortho(this);
        this._frustum = new Frustum(this);
        this._customProjection = new CustomProjection(this);
        this._project = this._perspective;

        this._eye = math.vec3([0, 0, 10.0]);
        this._look = math.vec3([0, 0, 0]);
        this._up = math.vec3([0, 1, 0]);

        this._worldUp = math.vec3([0, 1, 0]);
        this._worldRight = math.vec3([1, 0, 0]);
        this._worldForward = math.vec3([0, 0, -1]);

        this.deviceMatrix = cfg.deviceMatrix;
        this.eye = cfg.eye;
        this.look = cfg.look;
        this.up = cfg.up;
        this.worldAxis = cfg.worldAxis;
        this.gimbalLock = cfg.gimbalLock;
        this.constrainPitch = cfg.constrainPitch;

        this.projection = cfg.projection;

        this._perspective.on("matrix", () => {
            if (this._projectionType === "perspective") {
                this.fire("projMatrix", this._perspective.matrix);
            }
        });
        this._ortho.on("matrix", () => {
            if (this._projectionType === "ortho") {
                this.fire("projMatrix", this._ortho.matrix);
            }
        });
        this._frustum.on("matrix", () => {
            if (this._projectionType === "frustum") {
                this.fire("projMatrix", this._frustum.matrix);
            }
        });
        this._customProjection.on("matrix", () => {
            if (this._projectionType === "customProjection") {
                this.fire("projMatrix", this._customProjection.matrix);
            }
        });
    }

    _update() {
        const state = this._state;
        // In ortho mode, build the view matrix with an eye position that's translated
        // well back from look, so that the front clip plane doesn't unexpectedly cut
        // the front off the view (not a problem with perspective, since objects close enough
        // to be clipped by the front plane are usually too big to see anything of their cross-sections).
        let eye;
        if (this.projection === "ortho") {
            math.subVec3(this._eye, this._look, eyeLookVec);
            math.normalizeVec3(eyeLookVec, eyeLookVecNorm);
            math.mulVec3Scalar(eyeLookVecNorm, 1000.0, eyeLookOffset);
            math.addVec3(this._look, eyeLookOffset, offsetEye);
            eye = offsetEye;
        } else {
            eye = this._eye;
        }
        if (state.hasDeviceMatrix) {
            math.lookAtMat4v(eye, this._look, this._up, tempMatb);
            math.mulMat4(state.deviceMatrix, tempMatb, state.matrix);
            //state.matrix.set(state.deviceMatrix);
        } else {
            math.lookAtMat4v(eye, this._look, this._up, state.matrix);
        }
        math.inverseMat4(this._state.matrix, this._state.normalMatrix);
        math.transposeMat4(this._state.normalMatrix);
        this._renderer.imageDirty();
        this.fire("matrix", this._state.matrix);
        this.fire("viewMatrix", this._state.matrix);
    }

    /**
     Rotates {{#crossLink "Camera/eye:property"}}{{/crossLink}} about {{#crossLink "Camera/look:property"}}{{/crossLink}}, around the {{#crossLink "Camera/up:property"}}{{/crossLink}} vector

     @method orbitYaw
     @param {Number} angle Angle of rotation in degrees
     */
    orbitYaw(angle) {
        let lookEyeVec = math.subVec3(this._eye, this._look, tempVec3);
        math.rotationMat4v(angle * 0.0174532925, this._gimbalLock ? this._worldUp : this._up, tempMat);
        lookEyeVec = math.transformPoint3(tempMat, lookEyeVec, tempVec3b);
        this.eye = math.addVec3(this._look, lookEyeVec, tempVec3c); // Set eye position as 'look' plus 'eye' vector
        this.up = math.transformPoint3(tempMat, this._up, tempVec3d); // Rotate 'up' vector
    }

    /**
     Rotates {{#crossLink "Camera/eye:property"}}{{/crossLink}} about {{#crossLink "Camera/look:property"}}{{/crossLink}} around the right axis (orthogonal to {{#crossLink "Camera/up:property"}}{{/crossLink}} and "look").

     @method orbitPitch
     @param {Number} angle Angle of rotation in degrees
     */
    orbitPitch(angle) {
        let eye2 = math.subVec3(this._eye, this._look, tempVec3);
        const left = math.cross3Vec3(math.normalizeVec3(eye2, tempVec3b), math.normalizeVec3(this._up, tempVec3c));
        math.rotationMat4v(angle * 0.0174532925, left, tempMat);
        eye2 = math.transformPoint3(tempMat, eye2, tempVec3d);
        const up = math.transformPoint3(tempMat, this._up, tempVec3e);
        if (this._constrainPitch) {
            var angle = math.dotVec3(up, this._worldUp) / math.DEGTORAD;
            if (angle < 1) {
                return;
            }
        }
        this.up = up;
        this.eye = math.addVec3(eye2, this._look, tempVec3f);
    }

    /**
     Rotates {{#crossLink "Camera/look:property"}}{{/crossLink}} about {{#crossLink "Camera/eye:property"}}{{/crossLink}}, around the {{#crossLink "Camera/up:property"}}{{/crossLink}} vector.

     @method yaw
     @param {Number} angle Angle of rotation in degrees
     */
    yaw(angle) {
        let look2 = math.subVec3(this._look, this._eye, tempVec3);
        math.rotationMat4v(angle * 0.0174532925, this._gimbalLock ? this._worldUp : this._up, tempMat);
        look2 = math.transformPoint3(tempMat, look2, tempVec3b);
        this.look = math.addVec3(look2, this._eye, tempVec3c);
        if (this._gimbalLock) {
            this.up = math.transformPoint3(tempMat, this._up, tempVec3d);
        }
    }

    /**
     Rotates {{#crossLink "Camera/look:property"}}{{/crossLink}} about {{#crossLink "Camera/eye:property"}}{{/crossLink}}, around the right axis (orthogonal to {{#crossLink "Camera/up:property"}}{{/crossLink}} and "look").

     @method pitch
     @param {Number} angle Angle of rotation in degrees
     */
    pitch(angle) {
        let look2 = math.subVec3(this._look, this._eye, tempVec3);
        const left = math.cross3Vec3(math.normalizeVec3(look2, tempVec3b), math.normalizeVec3(this._up, tempVec3c));
        math.rotationMat4v(angle * 0.0174532925, left, tempMat);
        const up = math.transformPoint3(tempMat, this._up, tempVec3f);
        if (this._constrainPitch) {
            var angle = math.dotVec3(up, this._worldUp) / math.DEGTORAD;
            if (angle < 1) {
                return;
            }
        }
        this.up = up;
        look2 = math.transformPoint3(tempMat, look2, tempVec3d);
        this.look = math.addVec3(look2, this._eye, tempVec3e);
    }

    /**
     Pans the camera along the camera's local X, Y and Z axis.

     @method pan
     @param pan The pan vector
     */
    pan(pan) {
        const eye2 = math.subVec3(this._eye, this._look, tempVec3);
        const vec = [0, 0, 0];
        let v;
        if (pan[0] !== 0) {
            const left = math.cross3Vec3(math.normalizeVec3(eye2, []), math.normalizeVec3(this._up, tempVec3b));
            v = math.mulVec3Scalar(left, pan[0]);
            vec[0] += v[0];
            vec[1] += v[1];
            vec[2] += v[2];
        }
        if (pan[1] !== 0) {
            v = math.mulVec3Scalar(math.normalizeVec3(this._up, tempVec3c), pan[1]);
            vec[0] += v[0];
            vec[1] += v[1];
            vec[2] += v[2];
        }
        if (pan[2] !== 0) {
            v = math.mulVec3Scalar(math.normalizeVec3(eye2, tempVec3d), pan[2]);
            vec[0] += v[0];
            vec[1] += v[1];
            vec[2] += v[2];
        }
        this.eye = math.addVec3(this._eye, vec, tempVec3e);
        this.look = math.addVec3(this._look, vec, tempVec3f);
    }

    /**
     Increments/decrements zoom factor, ie. distance between {{#crossLink "Camera/eye:property"}}{{/crossLink}}
     and {{#crossLink "Camera/look:property"}}{{/crossLink}}.

     @method zoom
     @param delta
     */
    zoom(delta) {
        const vec = math.subVec3(this._eye, this._look, tempVec3);
        const lenLook = Math.abs(math.lenVec3(vec, tempVec3b));
        const newLenLook = Math.abs(lenLook + delta);
        if (newLenLook < 0.5) {
            return;
        }
        const dir = math.normalizeVec3(vec, tempVec3c);
        this.eye = math.addVec3(this._look, math.mulVec3Scalar(dir, newLenLook), tempVec3d);
    }


    /**
     Position of this Camera's eye.

     Fires an {{#crossLink "Camera/eye:event"}}{{/crossLink}} event on change.

     @property eye
     @default [0,0,10]
     @type Float32Array
     */
    set eye(value) {
        this._eye.set(value || [0, 0, 10]);
        this._needUpdate(0); // Ensure matrix built on next "tick"
        /**
         Fired whenever this Camera's {{#crossLink "Camera/eye:property"}}{{/crossLink}} property changes.

         @event eye
         @param value The property's new value
         */
        this.fire("eye", this._eye);
    }

    get eye() {
        return this._eye;
    }

    /**
     Position of this Camera's point-of-interest.

     Fires a {{#crossLink "Camera/look:event"}}{{/crossLink}} event on change.

     @property look
     @default [0,0,0]
     @type Float32Array
     */
    set look(value) {
        this._look.set(value || [0, 0, 0]);
        this._needUpdate(0); // Ensure matrix built on next "tick"
        /**
         Fired whenever this Camera's {{#crossLink "Camera/look:property"}}{{/crossLink}} property changes.

         @event look
         @param value The property's new value
         */
        this.fire("look", this._look);
    }

    get look() {
        return this._look;
    }

    /**
     Direction of this Camera's {{#crossLink "Camera/up:property"}}{{/crossLink}} vector.

     Fires an {{#crossLink "Camera/up:event"}}{{/crossLink}} event on change.

     @property up
     @default [0,1,0]
     @type Float32Array
     */
    set up(value) {
        this._up.set(value || [0, 1, 0]);
        this._needUpdate(0);
        /**
         Fired whenever this Camera's {{#crossLink "Camera/up:property"}}{{/crossLink}} property changes.

         @event up
         @param value The property's new value
         */
        this.fire("up", this._up);
    }

    get up() {
        return this._up;
    }

    /**
     Sets an optional matrix to premultiply into this Camera's {{#crossLink "Camera/matrix:property"}}{{/crossLink}} matrix.

     This is intended to be used for stereo rendering with WebVR etc.

     @property deviceMatrix
     @type {Float32Array}
     */
    set deviceMatrix(matrix) {
        this._state.deviceMatrix.set(matrix || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        this._state.hasDeviceMatrix = !!matrix;
        this._needUpdate(0);
        /**
         Fired whenever this CustomProjection's {{#crossLink "CustomProjection/matrix:property"}}{{/crossLink}} property changes.

         @event deviceMatrix
         @param value The property's new value
         */
        this.fire("deviceMatrix", this._state.deviceMatrix);
    }

    get deviceMatrix() {
        return this._state.deviceMatrix;
    }

    /**
     Indicates the up, right and forward axis of the World coordinate system.

     Has format: ````[rightX, rightY, rightZ, upX, upY, upZ, forwardX, forwardY, forwardZ]````

     @property worldAxis
     @default [1, 0, 0, 0, 1, 0, 0, 0, 1]
     @type Float32Array
     */
    set worldAxis(value) {
        value = value || [1, 0, 0, 0, 1, 0, 0, 0, 1];
        if (!this._worldAxis) {
            this._worldAxis = new Float32Array(value);
        } else {
            this._worldAxis.set(value);
        }
        this._worldRight[0] = this._worldAxis[0];
        this._worldRight[1] = this._worldAxis[1];
        this._worldRight[2] = this._worldAxis[2];
        this._worldUp[0] = this._worldAxis[3];
        this._worldUp[1] = this._worldAxis[4];
        this._worldUp[2] = this._worldAxis[5];
        this._worldForward[0] = this._worldAxis[6];
        this._worldForward[1] = this._worldAxis[7];
        this._worldForward[2] = this._worldAxis[8];
        /**
         * Fired whenever this Camera's {{#crossLink "Camera/worldAxis:property"}}{{/crossLink}} property changes.
         *
         * @event worldAxis
         * @param value The property's new value
         */
        this.fire("worldAxis", this._worldAxis);
    }

    get worldAxis() {
        return this._worldAxis;
    }

    /**
     Direction of World-space "up".

     @property worldUp
     @default [0,1,0]
     @type Float32Array
     @final
     */
    get worldUp() {
        return this._worldUp;
    }

    /**
     Direction of World-space "right".

     @property worldRight
     @default [1,0,0]
     @type Float32Array
     @final
     */
    get worldRight() {
        return this._worldRight;
    }

    /**
     Direction of World-space "forwards".

     @property worldForward
     @default [0,0,-1]
     @type Float32Array
     @final
     */
    get worldForward() {
        return this._worldForward;
    }

    /**
     Whether to lock yaw rotation to pivot about the World-space "up" axis.

     Fires a {{#crossLink "Camera/gimbalLock:event"}}{{/crossLink}} event on change.

     @property gimbalLock
     @default true
     @type Boolean
     */
    set gimbalLock(value) {
        this._gimbalLock = value !== false;
        /**
         Fired whenever this Camera's  {{#crossLink "Camera/gimbalLock:property"}}{{/crossLink}} property changes.

         @event gimbalLock
         @param value The property's new value
         */
        this.fire("gimbalLock", this._gimbalLock);
    }

    get gimbalLock() {
        return this._gimbalLock;
    }

    /**
     Whether to prevent camera from being pitched upside down.

     The camera is upside down when the angle
     between {{#crossLink "Camera/up:property"}}{{/crossLink}} and {{#crossLink "Camera/worldUp:property"}}{{/crossLink}} is less than one degree.

     Fires a {{#crossLink "Camera/constrainPitch:event"}}{{/crossLink}} event on change.

     @property constrainPitch
     @default false
     @type Boolean
     */
    set constrainPitch(value) {
        this._constrainPitch = !!value;
        /**
         Fired whenever this Camera's  {{#crossLink "Camera/constrainPitch:property"}}{{/crossLink}} property changes.

         @event constrainPitch
         @param value The property's new value
         */
        this.fire("constrainPitch", this._constrainPitch);
    }

    get constrainPitch() {
        return this._constrainPitch;
    }

    /**
     Distance from "look" to "eye".
     @property eyeLookDist
     @type Number
     @final
     */
    get eyeLookDist() {
        return math.lenVec3(math.subVec3(this._look, this._eye, tempVec3));
    }

    /**
     The Camera's viewing transformation matrix.

     Fires a {{#crossLink "Camera/matrix:event"}}{{/crossLink}} event on change.

     @property matrix
     @type {Float32Array}
     @final
     @deprecated
     */
    get matrix() {
        if (this._updateScheduled) {
            this._doUpdate();
        }
        return this._state.matrix;
    }

    /**
     The Camera's viewing transformation matrix.

     Fires a {{#crossLink "Camera/matrix:event"}}{{/crossLink}} event on change.

     @property viewMatrix
     @final
     @type {Float32Array}
     */
    get viewMatrix() {
        if (this._updateScheduled) {
            this._doUpdate();
        }
        return this._state.matrix;
    }


    /**
     The Camera's viewing normal transformation matrix.

     Fires a {{#crossLink "Camera/matrix:event"}}{{/crossLink}} event on change.

     @property normalMatrix
     @type {Float32Array}
     @final
     @deprecated
     */
    get normalMatrix() {
        if (this._updateScheduled) {
            this._doUpdate();
        }
        return this._state.normalMatrix;
    }

    /**
     The Camera's viewing normal transformation matrix.

     Fires a {{#crossLink "Camera/matrix:event"}}{{/crossLink}} event on change.

     @property viewNormalMatrix
     @final
     @type {Float32Array}
     */
    get  viewNormalMatrix() {
        if (this._updateScheduled) {
            this._doUpdate();
        }
        return this._state.normalMatrix;
    }

    /**
     Camera's projection transformation projMatrix.

     Fires a {{#crossLink "Camera/projMatrix:event"}}{{/crossLink}} event on change.

     @property projMatrix
     @final
     @type {Float32Array}
     */
    get projMatrix() {
        return this[this.projection].matrix;
    }


    /**
     The perspective projection transform for this Camera.

     This is used while {{#crossLink "Camera/projection:property"}}{{/crossLink}} equals "perspective".

     @property perspective
     @type Perspective
     @final
     */
    get perspective() {
        return this._perspective;
    }

    /**
     The orthographic projection transform for this Camera.

     This is used while {{#crossLink "Camera/projection:property"}}{{/crossLink}} equals "ortho".

     @property ortho
     @type Ortho
     @final
     */
    get ortho() {
        return this._ortho;
    }


    /**
     The frustum projection transform for this Camera.

     This is used while {{#crossLink "Camera/projection:property"}}{{/crossLink}} equals "frustum".

     @property frustum
     @type Frustum
     @final
     */
    get frustum() {
        return this._frustum;
    }

    /**
     A custom projection transform, given as a 4x4 matrix.

     This is used while {{#crossLink "Camera/projection:property"}}{{/crossLink}} equals "customProjection".

     @property customProjection
     @type CustomProjection
     @final
     */
    get customProjection() {
        return this._customProjection;
    }

    /**
     The active projection type.

     Accepted values are "perspective", "ortho", "frustum" and "customProjection".

     @property projection
     @default "perspective"
     @type {String}
     */
    set projection(value) {
        value = value || "perspective";
        if (this._projectionType === value) {
            return;
        }
        if (value === "perspective") {
            this._project = this._perspective;
        } else if (value === "ortho") {
            this._project = this._ortho;
        } else if (value === "frustum") {
            this._project = this._frustum;
        } else if (value === "customProjection") {
            this._project = this._customProjection;
        } else {
            this.error("Unsupported value for 'projection': " + value + " defaulting to 'perspective'");
            this._project = this._perspective;
            value = "perspective";
        }
        this._projectionType = value;
        this._renderer.imageDirty();
        this._update(); // Need to rebuild lookat matrix with full eye, look & up
        this.fire("dirty");
    }

    get projection() {
        return this._projectionType;
    }

    /**
     The active projection transform for this Camera.

     @property project
     @type Transform
     @final
     */
    get project() {
        return this._project;
    }

    get view() {
        return this;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
    }
}

componentClasses[type$15] = Camera;

/**
 A **DirLight** is a directional light source that illuminates all {{#crossLink "Mesh"}}Meshes{{/crossLink}} equally
 from a given direction.

 ## Overview

 * DirLights have a direction, but no position.
 * The direction is the **direction that the light is emitted in**.
 * DirLights may be defined in either **World** or **View** coordinate space. When in World-space, their direction
 is relative to the World coordinate system, and will appear to move as the {{#crossLink "Camera"}}{{/crossLink}} moves.
 When in View-space, their direction is relative to the View coordinate system, and will behave as if fixed to the viewer's
 head as the {{#crossLink "Camera"}}{{/crossLink}} moves.
 * A DirLight can also have a {{#crossLink "Shadow"}}{{/crossLink}} component, to configure it to cast a shadow.
 * {{#crossLink "AmbientLight"}}{{/crossLink}}, {{#crossLink "DirLight"}}{{/crossLink}},
 {{#crossLink "SpotLight"}}{{/crossLink}} and {{#crossLink "PointLight"}}{{/crossLink}} instances are registered by ID
 on {{#crossLink "Scene/lights:property"}}Scene#lights{{/crossLink}} for convenient access.

 ## Examples

 * [View-space directional three-point lighting](../../examples/#lights_directional_view_threePoint)
 * [World-space directional three-point lighting](../../examples/#lights_directional_world_threePoint)

 ## Usage

 In the example below we'll customize the default Scene's light sources, defining an AmbientLight and a couple of
 DirLights, then create a Phong-shaded box mesh.

 ````javascript
 new xeogl.AmbientLight({
        color: [0.8, 0.8, 0.8],
        intensity: 0.5
     });

 new xeogl.DirLight({
        dir: [1, 1, 1],     // Direction the light is shining in
        color: [0.5, 0.7, 0.5],
        intensity: 1.0,
        space: "view",      // Other option is "world", for World-space
        shadow: false       // Default
     });

 new xeogl.DirLight({
        dir: [0.2, -0.8, 0.8],
        color: [0.8, 0.8, 0.8],
        intensity: 0.5,
        space: "view",
        shadow: false
     });

 // Create box mesh
 new xeogl.Mesh({
    material: new xeogl.PhongMaterial({
        ambient: [0.5, 0.5, 0.5],
        diffuse: [1,0.3,0.3]
    }),
    geometry: new xeogl.BoxGeometry()
 });
 ````

 @class DirLight
 @module xeogl
 @submodule lighting
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} The DirLight configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this DirLight.
 @param [cfg.dir=[1.0, 1.0, 1.0]] {Float32Array} A unit vector indicating the direction that the light is shining,
 given in either World or View space, depending on the value of the **space** parameter.
 @param [cfg.color=[0.7, 0.7, 0.8 ]] {Float32Array} The color of this DirLight.
 @param [cfg.intensity=1.0 ] {Number} The intensity of this DirLight, as a factor in range ````[0..1]````.
 @param [cfg.space="view"] {String} The coordinate system the DirLight is defined in - "view" or "space".
 @param [cfg.shadow=false] {Boolean} Flag which indicates if this DirLight casts a shadow.
 @extends Component
 */
const type$16 = "xeogl.DirLight";

class DirLight extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$16;
    }

    init(cfg) {

        super.init(cfg);

        const self = this;

        this._shadowRenderBuf = null;
        this._shadowViewMatrix = null;
        this._shadowProjMatrix = null;
        this._shadowViewMatrixDirty = true;
        this._shadowProjMatrixDirty = true;

        this._state = new State({
            type: "dir",
            dir: math.vec3([1.0, 1.0, 1.0]),
            color: math.vec3([0.7, 0.7, 0.8]),
            intensity: 1.0,
            space: cfg.space || "view",
            shadow: false,
            shadowDirty: true,

            getShadowViewMatrix: (function () {
                const look = math.vec3();
                const up = math.vec3([0, 1, 0]);
                return function () {
                    if (self._shadowViewMatrixDirty) {
                        if (!self._shadowViewMatrix) {
                            self._shadowViewMatrix = math.identityMat4();
                        }
                        const dir = self._state.dir;
                        math.lookAtMat4v([-dir[0], -dir[1], -dir[2]], [0, 0, 0], up, self._shadowViewMatrix);
                        self._shadowViewMatrixDirty = false;
                    }
                    return self._shadowViewMatrix;
                };
            })(),

            getShadowProjMatrix: function () {
                if (self._shadowProjMatrixDirty) { // TODO: Set when canvas resizes
                    if (!self._shadowProjMatrix) {
                        self._shadowProjMatrix = math.identityMat4();
                    }
                    math.orthoMat4c(-10, 10, -10, 10, 0, 500.0, self._shadowProjMatrix);
                    self._shadowProjMatrixDirty = false;
                }
                return self._shadowProjMatrix;
            },

            getShadowRenderBuf: function () {
                if (!self._shadowRenderBuf) {
                    self._shadowRenderBuf = new RenderBuffer(self.scene.canvas.canvas, self.scene.canvas.gl, { size: [1024, 1024]});
                }
                return self._shadowRenderBuf;
            }
        });

        this.dir = cfg.dir;
        this.color = cfg.color;
        this.intensity = cfg.intensity;
        this.shadow = cfg.shadow;
        this.scene._lightCreated(this);
    }

    /**
     The direction in which the light is shining.

     @property dir
     @default [1.0, 1.0, 1.0]
     @type Float32Array
     */
    set dir(value) {
        this._state.dir.set(value || [1.0, 1.0, 1.0]);
        this._shadowViewMatrixDirty = true;
        this._renderer.shadowsDirty();
    }

    get dir() {
        return this._state.dir;
    }

    /**
     The color of this DirLight.

     @property color
     @default [0.7, 0.7, 0.8]
     @type Float32Array
     */
    set color(value) {
        this._state.color.set(value || [0.7, 0.7, 0.8]);
        this._renderer.imageDirty();
    }

    get color() {
        return this._state.color;
    }

    /**
     The intensity of this DirLight.

     Fires a {{#crossLink "DirLight/intensity:event"}}{{/crossLink}} event on change.

     @property intensity
     @default 1.0
     @type Number
     */
    set intensity(value) {
        value = value !== undefined ? value : 1.0;
        this._state.intensity = value;
        this._renderer.imageDirty();
    }

    get intensity() {
        return this._state.intensity;
    }

    /**
     Flag which indicates if this DirLight casts a shadow.

     @property shadow
     @default false
     @type Boolean
     */
    set shadow(value) {
        value = !!value;
        if (this._state.shadow === value) {
            return;
        }
        this._state.shadow = value;
        this._shadowViewMatrixDirty = true;
        this._renderer.shadowsDirty();
    }

    get shadow() {
        return this._state.shadow;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
        if (this._shadowRenderBuf) {
            this._shadowRenderBuf.destroy();
        }
        this.scene._lightDestroyed(this);
        this._renderer.shadowsDirty();
    }
}

componentClasses[type$16] = DirLight;

/**
 A **BoxGeometry** is a parameterized {{#crossLink "Geometry"}}{{/crossLink}} that defines a box-shaped mesh for attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

 <a href="../../examples/#geometry_primitives_box"><img src="../../assets/images/screenshots/BoxGeometry.png"></img></a>

 ## Overview

 * Dynamically modify a BoxGeometry's dimensions at any time by updating its {{#crossLink "BoxGeometry/center:property"}}{{/crossLink}}, {{#crossLink "BoxGeometry/xSize:property"}}{{/crossLink}}, {{#crossLink "BoxGeometry/ySize:property"}}{{/crossLink}} and {{#crossLink "BoxGeometry/zSize:property"}}{{/crossLink}} properties.
 * Dynamically switch its primitive type between ````"points"````, ````"lines"```` and ````"triangles"```` at any time by
 updating its {{#crossLink "Geometry/primitive:property"}}{{/crossLink}} property.

 ## Examples

 * [Textured BoxGeometry](../../examples/#geometry_primitives_box)

 ## Usage

 An {{#crossLink "Mesh"}}{{/crossLink}} with a BoxGeometry and a {{#crossLink "PhongMaterial"}}{{/crossLink}} with
 diffuse {{#crossLink "Texture"}}{{/crossLink}}:

 ````javascript
 new xeogl.Mesh({

     geometry: new xeogl.BoxGeometry({
        center: [0,0,0],
        xSize: 1,  // Half-size on each axis; BoxGeometry is actually two units big on each side.
        ySize: 1,
        zSize: 1
     }),

     material: new xeogl.PhongMaterial({
        diffuseMap: new xeogl.Texture({
            src: "textures/diffuse/uvGrid2.jpg"
        })
     })
 });
 ````

 @class BoxGeometry
 @module xeogl
 @submodule geometry
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}},
 generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this BoxGeometry.
 @param [cfg.primitive="triangles"] {String} The primitive type. Accepted values for a BoxGeometry are 'points', 'lines' and 'triangles'.
 @param [cfg.center] {Float32Array} 3D point indicating the center position.
 @param [cfg.xSize=1.0] {Number} Half-size on the X-axis.
 @param [cfg.ySize=1.0] {Number} Half-size on the Y-axis.
 @param [cfg.zSize=1.0] {Number} Half-size on the Z-axis.
 @extends Geometry
 */

const type$17 = "xeogl.BoxGeometry";

class BoxGeometry extends Geometry {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$17;
    }

    init(cfg) {

        let xSize = cfg.xSize || 1;
        if (xSize < 0) {
            this.error("negative xSize not allowed - will invert");
            xSize *= -1;
        }

        let ySize = cfg.ySize || 1;
        if (ySize < 0) {
            this.error("negative ySize not allowed - will invert");
            ySize *= -1;
        }

        let zSize = cfg.zSize || 1;
        if (zSize < 0) {
            this.error("negative zSize not allowed - will invert");
            zSize *= -1;
        }

        const center = cfg.center;
        const centerX = center ? center[0] : 0;
        const centerY = center ? center[1] : 0;
        const centerZ = center ? center[2] : 0;

        const xmin = -xSize + centerX;
        const ymin = -ySize + centerY;
        const zmin = -zSize + centerZ;
        const xmax = xSize + centerX;
        const ymax = ySize + centerY;
        const zmax = zSize + centerZ;

        super.init(utils.apply(cfg, {

            // The vertices - eight for our cube, each
            // one spanning three array elements for X,Y and Z
            positions: [

                // v0-v1-v2-v3 front
                xmax, ymax, zmax,
                xmin, ymax, zmax,
                xmin, ymin, zmax,
                xmax, ymin, zmax,

                // v0-v3-v4-v1 right
                xmax, ymax, zmax,
                xmax, ymin, zmax,
                xmax, ymin, zmin,
                xmax, ymax, zmin,

                // v0-v1-v6-v1 top
                xmax, ymax, zmax,
                xmax, ymax, zmin,
                xmin, ymax, zmin,
                xmin, ymax, zmax,

                // v1-v6-v7-v2 left
                xmin, ymax, zmax,
                xmin, ymax, zmin,
                xmin, ymin, zmin,
                xmin, ymin, zmax,

                // v7-v4-v3-v2 bottom
                xmin, ymin, zmin,
                xmax, ymin, zmin,
                xmax, ymin, zmax,
                xmin, ymin, zmax,

                // v4-v7-v6-v1 back
                xmax, ymin, zmin,
                xmin, ymin, zmin,
                xmin, ymax, zmin,
                xmax, ymax, zmin
            ],

            // Normal vectors, one for each vertex
            normals: [

                // v0-v1-v2-v3 front
                0, 0, 1,
                0, 0, 1,
                0, 0, 1,
                0, 0, 1,

                // v0-v3-v4-v5 right
                1, 0, 0,
                1, 0, 0,
                1, 0, 0,
                1, 0, 0,

                // v0-v5-v6-v1 top
                0, 1, 0,
                0, 1, 0,
                0, 1, 0,
                0, 1, 0,

                // v1-v6-v7-v2 left
                -1, 0, 0,
                -1, 0, 0,
                -1, 0, 0,
                -1, 0, 0,

                // v7-v4-v3-v2 bottom
                0, -1, 0,
                0, -1, 0,
                0, -1, 0,
                0, -1, 0,

                // v4-v7-v6-v5 back
                0, 0, -1,
                0, 0, -1,
                0, 0, -1,
                0, 0, -1
            ],

            // UV coords
            uv: [

                // v0-v1-v2-v3 front
                1, 0,
                0, 0,
                0, 1,
                1, 1,

                // v0-v3-v4-v1 right
                0, 0,
                0, 1,
                1, 1,
                1, 0,

                // v0-v1-v6-v1 top
                1, 1,
                1, 0,
                0, 0,
                0, 1,

                // v1-v6-v7-v2 left
                1, 0,
                0, 0,
                0, 1,
                1, 1,

                // v7-v4-v3-v2 bottom
                0, 1,
                1, 1,
                1, 0,
                0, 0,

                // v4-v7-v6-v1 back
                0, 1,
                1, 1,
                1, 0,
                0, 0
            ],

            // Indices - these organise the
            // positions and uv texture coordinates
            // into geometric primitives in accordance
            // with the "primitive" parameter,
            // in this case a set of three indices
            // for each triangle.
            //
            // Note that each triangle is specified
            // in counter-clockwise winding order.
            //
            // You can specify them in clockwise
            // order if you configure the Modes
            // node's frontFace flag as "cw", instead of
            // the default "ccw".
            indices: [
                0, 1, 2,
                0, 2, 3,
                // front
                4, 5, 6,
                4, 6, 7,
                // right
                8, 9, 10,
                8, 10, 11,
                // top
                12, 13, 14,
                12, 14, 15,
                // left
                16, 17, 18,
                16, 18, 19,
                // bottom
                20, 21, 22,
                20, 22, 23
            ],

            // Tangents are lazy-computed from normals and UVs
            // for Normal mapping once we know we have texture

            tangents: null
        }));

        this.box = true;
    }
}

componentClasses[type$17] = BoxGeometry;

/**
 An **EmphasisMaterial** is a {{#crossLink "Material"}}{{/crossLink}} that defines the appearance of attached
 {{#crossLink "Mesh"}}Meshes{{/crossLink}} when they are highlighted, selected or ghosted.

 ## Examples

 | <a href="../../examples/#effects_ghost"><img src="../../assets/images/screenshots/HighlightMaterial/teapot.png"></img></a> | <a href="../../examples/#effects_demo_housePlan"><img src="../../assets/images/screenshots/HighlightMaterial/house.png"></img></a> | <a href="../../examples/#effects_demo_gearbox"><img src="../../assets/images/screenshots/HighlightMaterial/gearbox.png"></img></a> | <a href="../../examples/#effects_demo_adam"><img src="../../assets/images/screenshots/HighlightMaterial/adam.png"></img></a>|
 |:------:|:------:|:----:|:-----:|:-----:|
 |[Example 1: Ghost effect](../../examples/#effects_ghost)|[Example 2: Ghost and highlight effects for architecture](../../examples/#effects_demo_housePlan)|[Example 3: Ghost and highlight effects for CAD](../../examples/#effects_demo_gearbox)| [Example 4: Ghost effect for CAD ](../../examples//#effects_demo_adam)|

 ## Overview

 * Ghost an {{#crossLink "Mesh"}}{{/crossLink}} by setting its {{#crossLink "Mesh/ghost:property"}}{{/crossLink}} property ````true````.
 * When ghosted, a Mesh's appearance is controlled by its EmphasisMaterial.
 * An EmphasisMaterial provides several preset configurations that you can set it to. Select a preset by setting {{#crossLink "EmphasisMaterial/preset:property"}}{{/crossLink}} to the preset's ID. A map of available presets is provided in {{#crossLink "EmphasisMaterial/presets:property"}}xeogl.EmphasisMaterial.presets{{/crossLink}}.
 * By default, a Mesh uses the {{#crossLink "Scene"}}{{/crossLink}}'s global EmphasisMaterials, but you can give each Mesh its own EmphasisMaterial when you want to customize the effect per-Mesh.
 * Ghost all Meshes in a {{#crossLink "Model"}}{{/crossLink}} by setting the Model's {{#crossLink "Model/ghost:property"}}{{/crossLink}} property ````true````. Note that all Meshes in a Model have the Scene's global EmphasisMaterial by default.
 * Modify the Scene's global EmphasisMaterial to customize it.

 ## Usage

 * [Ghosting](#ghosting)
 * [Highlighting](#highlighting)

 ### Ghosting

 In the usage example below, we'll create a Mesh with a ghost effect applied to it. The Mesh gets its own EmphasisMaterial for ghosting, and
 has its {{#crossLink "Mesh/ghost:property"}}{{/crossLink}} property set ````true```` to activate the effect.

 <a href="../../examples/#effects_ghost"><img src="../../assets/images/screenshots/HighlightMaterial/teapot.png"></img></a>

 ````javascript
 var mesh = new xeogl.Mesh({
    geometry: new xeogl.TeapotGeometry({
        edgeThreshold: 1
    }),
    material: new xeogl.PhongMaterial({
        diffuse: [0.2, 0.2, 1.0]
    }),
    ghostMaterial: new xeogl.EmphasisMaterial({
        edges: true,
        edgeColor: [0.2, 1.0, 0.2],
        edgeAlpha: 1.0,
        edgeWidth: 2,
        vertices: true,
        vertexColor: [0.6, 1.0, 0.6],
        vertexAlpha: 1.0,
        vertexSize: 8,
        fill: true,
        fillColor: [0, 0, 0],
        fillAlpha: 0.7
    }),
    ghost: true
 });
 ````

 Note the **edgeThreshold** configuration on the {{#crossLink "Geometry"}}{{/crossLink}} we've created for our
 Mesh. Our EmphasisMaterial is configured to draw a wireframe representation of the Geometry, which will have inner edges (ie. edges between
 adjacent co-planar triangles) removed for visual clarity. The ````edgeThreshold```` configuration indicates
 that, for this particular Geometry, an inner edge is one where the angle between the surface normals of adjacent triangles is not
 greater than ````5```` degrees. That's set to ````2```` by default, but we can override it to tweak the effect as needed for particular Geometries.

 Here's the example again, this time using the Scene's global EmphasisMaterial by default. We'll also modify that EmphasisMaterial
 to customize the effect.

 ````javascript
 var mesh = new xeogl.Mesh({
    geometry: new xeogl.TeapotGeometry({
        edgeThreshold: 5
    }),
    material: new xeogl.PhongMaterial({
        diffuse: [0.2, 0.2, 1.0]
    }),
    ghost: true
 });

 var ghostMaterial = mesh.scene.ghostMaterial;

 ghostMaterial.edges = true;
 ghostMaterial.edgeColor = [0.2, 1.0, 0.2];
 ghostMaterial.edgeAlpha = 1.0;
 ghostMaterial.edgeWidth = 2;
 ghostMaterial.vertices = true;
 ghostMaterial.vertexColor = [0.6, 1.0, 0.6];
 ghostMaterial.vertexAlpha = 1.0;
 ghostMaterial.vertexSize = 8;
 ghostMaterial.fill = true;
 ghostMaterial.fillColor = [0, 0, 0];
 ghostMaterial.fillAlpha = 0.7;
 ````

 ### Highlighting

 In the next example, we'll use a ghosting in conjunction with highlighting, to emphasise a couple of objects within
 a gearbox {{#crossLink "Model"}}{{/crossLink}}. We'll load the Model from glTF, then ghost all of its Meshes except for two gears, which we'll highlight instead. The ghosted
 Meshes have the Scene's global ghosting EmphasisMaterial, which we'll modify. The  highlighted Meshes also have the Scene's global highlighting EmphasisMaterial, which we'll modify as well.

 <a href="../../examples/#effects_demo_gearbox"><img src="../../assets/images/screenshots/HighlightMaterial/gearbox.png"></img></a>

 ````javascript
 var model = new xeogl.GLTFModel({
     src: "models/gltf/gearbox_conical/scene.gltf",
     edgeThreshold: 10
 });

 model.on("loaded", function() {

    model.ghost = true;

    model.meshes["gearbox#77.0"].ghost = false;
    model.meshes["gearbox#79.0"].ghost = false;

    model.meshes["gearbox#77.0"].highlight = true;
    model.meshes["gearbox#79.0"].highlight = true;

    var ghostMaterial = model.scene.ghostMaterial;

    ghostMaterial.edges = true;
    ghostMaterial.edgeColor = [0.4, 0.4, 1.6];
    ghostMaterial.edgeAlpha = 0.8;
    ghostMaterial.edgeWidth = 3;
    ghostMaterial.vertices = false;
    ghostMaterial.vertexColor = [0.7, 1.0, 0.7];
    ghostMaterial.vertexAlpha = 0.9;
    ghostMaterial.vertexSize = 4.0;
    ghostMaterial.fill = true;
    ghostMaterial.fillColor = [0.2, 0.2, 0.7];
    ghostMaterial.fillAlpha = 0.9;

    var highlightMaterial = model.scene.highlightMaterial;

    highlightMaterial.color = [1.0, 1.0, 1.0];
    highlightMaterial.alpha = 1.0;
 });
 ````

 ## Presets

 For convenience, an EmphasisMaterial provides several preset configurations that you can set it to, which are provided in
 {{#crossLink "EmphasisMaterial/presets:property"}}xeogl.EmphasisMaterial.presets{{/crossLink}}:

 ````javascript
 var presets = xeogl.EmphasisMaterial.presets;
 ````

 The presets look something like this:

 ````json
 {
        "default": {
            edges: true,
            edgeColor: [0.2, 0.2, 0.2],
            edgeAlpha: 0.5,
            edgeWidth: 1,
            vertices: false,
            vertexColor: [0.4, 0.4, 0.4],
            vertexAlpha: 0.7,
            vertexSize: 4.0,
            fill: true,
            fillColor: [0.4, 0.4, 0.4],
            fillAlpha: 0.2
        },

         "sepia": {
            edges: true,
            edgeColor: [0.52, 0.45, 0.41],
            edgeAlpha: 1.0,
            edgeWidth: 1,
            vertices: false,
            vertexColor: [0.7, 1.0, 0.7],
            vertexAlpha: 0.9,
            vertexSize: 4.0,
            fill: true,
            fillColor: [0.97, 0.79, 0.66],
            fillAlpha: 0.4
        },

        //...
 }
 ````

 Let's switch the Scene's global default  EmphasisMaterial over to the "sepia" preset used in <a href="/examples/#effects_demo_adam">Example 4: Ghost effect for CAD</a>.

 ````javascript
 scene.ghostMaterial.preset = "sepia";
 ````

 You can also just create an EmphasisMaterial from a preset:

 ````javascript
 var mesh = new xeogl.Mesh({
    geometry: new xeogl.TeapotGeometry({
        edgeThreshold: 5
    }),
    material: new xeogl.PhongMaterial({
        diffuse: [0.2, 0.2, 1.0]
    }),
    ghostMaterial: new xeogl.EmphasisMaterial({
        preset: "sepia"
    });
    ghost: true
 });
 ````

 Note that applying a preset just sets the EmphasisMaterial's property values, which you are then free to modify afterwards.

 @class EmphasisMaterial
 @module xeogl
 @submodule materials
 @constructor
 @extends Material
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} The EmphasisMaterial configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta=null] {String:Object} Metadata to attach to this EmphasisMaterial.
 @param [cfg.edges=true] {Boolean} Indicates whether or not ghost edges are visible.
 @param [cfg.edgeColor=[0.2,0.2,0.2]] {Array of Number}  RGB color of ghost edges.
 @param [cfg.edgeAlpha=0.5] {Number} Transparency of ghost edges. A value of 0.0 indicates fully transparent, 1.0 is fully opaque.
 @param [cfg.edgeWidth=1] {Number}  Width of ghost edges, in pixels.
 @param [cfg.vertices=false] {Boolean} Indicates whether or not ghost vertices are visible.
 @param [cfg.vertexColor=[0.4,0.4,0.4]] {Array of Number} Color of ghost vertices.
 @param [cfg.vertexAlpha=0.7] {Number}  Transparency of ghost vertices. A value of 0.0 indicates fully transparent, 1.0 is fully opaque.
 @param [cfg.vertexSize=4.0] {Number} Pixel size of ghost vertices.
 @param [cfg.fill=true] {Boolean} Indicates whether or not ghost surfaces are filled with color.
 @param [cfg.fillColor=[0.4,0.4,0.4]] {Array of Number} EmphasisMaterial fill color.
 @param [cfg.fillAlpha=0.2] {Number}  Transparency of filled ghost faces. A value of 0.0 indicates fully transparent, 1.0 is fully opaque.
 @param [cfg.backfaces=false] {Boolean} Whether to render {{#crossLink "Geometry"}}Geometry{{/crossLink}} backfaces.
 @param [cfg.preset] {String} Selects a preset EmphasisMaterial configuration - see {{#crossLink "EmphasisMaterial/preset:method"}}EmphasisMaterial#preset(){{/crossLink}}.
 */

const PRESETS = {
    "default": {
        edges: true,
        edgeColor: [0.2, 0.2, 0.2],
        edgeAlpha: 0.5,
        edgeWidth: 1,
        vertices: false,
        vertexColor: [0.4, 0.4, 0.4],
        vertexAlpha: 0.7,
        vertexSize: 4.0,
        fill: true,
        fillColor: [0.4, 0.4, 0.4],
        fillAlpha: 0.2
    },
    "defaultWhiteBG": {
        edgeColor: [0.2, 0.2, 0.2],
        edgeAlpha: 1.0,
        edgeWidth: 1,
        vertices: false,
        vertexColor: [0.4, 0.4, 0.4],
        vertexAlpha: 0.7,
        vertexSize: 4.0,
        fill: true,
        fillColor: [1, 1, 1],
        fillAlpha: 0.6
    },
    "defaultLightBG": {
        edges: true,
        edgeColor: [0.2, 0.2, 0.2],
        edgeAlpha: 0.5,
        edgeWidth: 1,
        vertices: false,
        vertexColor: [0.4, 0.4, 0.4],
        vertexAlpha: 0.7,
        vertexSize: 4.0,
        fill: true,
        fillColor: [0.4, 0.4, 0.4],
        fillAlpha: 0.2
    },
    "defaultDarkBG": {
        edges: true,
        edgeColor: [0.5, 0.5, 0.5],
        edgeAlpha: 0.5,
        edgeWidth: 1,
        vertices: false,
        vertexColor: [0.4, 0.4, 0.4],
        vertexAlpha: 0.7,
        vertexSize: 4.0,
        fill: true,
        fillColor: [0.4, 0.4, 0.4],
        fillAlpha: 0.2
    },
    "phosphorous": {
        edges: true,
        edgeColor: [0.9, 0.9, 0.9],
        edgeAlpha: 0.5,
        edgeWidth: 2,
        vertices: false,
        vertexColor: [0.4, 0.4, 0.4],
        vertexAlpha: 0.7,
        vertexSize: 1.0,
        fill: true,
        fillColor: [0.0, 0.0, 0.0],
        fillAlpha: 0.4
    },
    "sunset": {
        edges: true,
        edgeColor: [0.9, 0.9, 0.9],
        edgeAlpha: 0.5,
        edgeWidth: 1,
        vertices: false,
        vertexColor: [0.4, 0.4, 0.4],
        vertexAlpha: 0.7,
        vertexSize: 1.0,
        fill: true,
        fillColor: [0.9, 0.9, 0.6],
        fillAlpha: 0.2
    },
    "vectorscope": {
        edges: true,
        edgeColor: [0.2, 1.0, 0.2],
        edgeAlpha: 1,
        edgeWidth: 2,
        vertices: true,
        vertexColor: [0.7, 1.0, 0.7],
        vertexAlpha: 0.9,
        vertexSize: 8.0,
        fill: true,
        fillColor: [0.0, 0.0, 0.0],
        fillAlpha: 0.7
    },
    "battlezone": {
        edges: true,
        edgeColor: [0.2, 1.0, 0.2],
        edgeAlpha: 1,
        edgeWidth: 3,
        vertices: false,
        vertexColor: [0.8, 1.0, 0.8],
        vertexAlpha: 0.9,
        vertexSize: 8.0,
        fill: true,
        fillColor: [0.0, 0.0, 0.0],
        fillAlpha: 1.0
    },
    "sepia": {
        edges: true,
        edgeColor: [0.529411792755127, 0.4577854573726654, 0.4100345969200134],
        edgeAlpha: 1.0,
        edgeWidth: 1,
        vertices: false,
        vertexColor: [0.7, 1.0, 0.7],
        vertexAlpha: 0.9,
        vertexSize: 4.0,
        fill: true,
        fillColor: [0.970588207244873, 0.7965892553329468, 0.6660899519920349],
        fillAlpha: 0.4
    },
    "yellowHighlight": {
        edges: true,
        edgeColor: [0.529411792755127, 0.4577854573726654, 0.4100345969200134],
        edgeAlpha: 1.0,
        edgeWidth: 1,
        vertices: false,
        vertexColor: [0.7, 1.0, 0.7],
        vertexAlpha: 0.9,
        vertexSize: 4.0,
        fill: true,
        fillColor: [1.0, 1.0, 0.0],
        fillAlpha: 0.5
    },
    "greenSelected": {
        edges: true,
        edgeColor: [0.4577854573726654, 0.529411792755127, 0.4100345969200134],
        edgeAlpha: 1.0,
        edgeWidth: 1,
        vertices: false,
        vertexColor: [0.7, 1.0, 0.7],
        vertexAlpha: 0.9,
        vertexSize: 4.0,
        fill: true,
        fillColor: [0.0, 1.0, 0.0],
        fillAlpha: 0.5
    },
    "gamegrid": {
        edges: true,
        edgeColor: [0.4, 0.4, 1.6],
        edgeAlpha: 0.8,
        edgeWidth: 3,
        vertices: false,
        vertexColor: [0.7, 1.0, 0.7],
        vertexAlpha: 0.9,
        vertexSize: 4.0,
        fill: true,
        fillColor: [0.2, 0.2, 0.7],
        fillAlpha: 0.9
    }
};

const type$18 = "xeogl.EmphasisMaterial";

class EmphasisMaterial extends Material {

    /**
     Available EmphasisMaterial presets.

     @property presets
     @type {Object}
     @static
     */
    static get presets() {
        return PRESETS;
    };

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$18;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            type: "EmphasisMaterial",
            edges: null,
            edgeColor: null,
            edgeAlpha: null,
            edgeWidth: null,
            vertices: null,
            vertexColor: null,
            vertexAlpha: null,
            vertexSize: null,
            fill: null,
            fillColor: null,
            fillAlpha: null,
            backfaces: true
        });

        this._preset = "default";

        if (cfg.preset) { // Apply preset then override with configs where provided
            this.preset = cfg.preset;
            if (cfg.edges !== undefined) {
                this.edges = cfg.edges;
            }
            if (cfg.edgeColor)  {
                this.edgeColor = cfg.edgeColor;
            }
            if (cfg.edgeAlpha !== undefined) {
                this.edgeAlpha = cfg.edgeAlpha;
            }
            if (cfg.edgeWidth !== undefined) {
                this.edgeWidth = cfg.edgeWidth;
            }
            if (cfg.vertices !== undefined) {
                this.vertices = cfg.vertices;
            }
            if (cfg.vertexColor) {
                this.vertexColor = cfg.vertexColor;
            }
            if (cfg.vertexAlpha !== undefined) {
                this.vertexAlpha = cfg.vertexAlpha;
            }
            if (cfg.vertexSize) {
                this.vertexSize = cfg.vertexSize;
            }
            if (cfg.fill !== undefined) {
                this.fill = cfg.fill;
            }
            if (cfg.fillColor) {
                this.fillColor = cfg.fillColor;
            }
            if (cfg.fillAlpha !== undefined) {
                this.fillAlpha = cfg.fillAlpha;
            }
            if (cfg.backfaces !== undefined) {
                this.backfaces = cfg.backfaces;
            }
        } else {
            this.edges = cfg.edges;
            this.edgeColor = cfg.edgeColor;
            this.edgeAlpha = cfg.edgeAlpha;
            this.edgeWidth = cfg.edgeWidth;
            this.vertices = cfg.vertices;
            this.vertexColor = cfg.vertexColor;
            this.vertexAlpha = cfg.vertexAlpha;
            this.vertexSize = cfg.vertexSize;
            this.fill = cfg.fill;
            this.fillColor = cfg.fillColor;
            this.fillAlpha = cfg.fillAlpha;
            this.backfaces = cfg.backfaces;
        }
    }


    /**
     Indicates whether or not ghost edges are visible.

     @property edges
     @default true
     @type Boolean
     */
    set edges(value) {
        value = value !== false;
        if (this._state.edges === value) {
            return;
        }
        this._state.edges = value;
        this._renderer.imageDirty();
    }

    get edges() {
        return this._state.edges;
    }

    /**
     RGB color of ghost edges.

     @property edgeColor
     @default [0.2, 0.2, 0.2]
     @type Float32Array
     */
    set edgeColor(value) {
        let edgeColor = this._state.edgeColor;
        if (!edgeColor) {
            edgeColor = this._state.edgeColor = new Float32Array(3);
        } else if (value && edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
            return;
        }
        if (value) {
            edgeColor[0] = value[0];
            edgeColor[1] = value[1];
            edgeColor[2] = value[2];
        } else {
            edgeColor[0] = 0.2;
            edgeColor[1] = 0.2;
            edgeColor[2] = 0.2;
        }
        this._renderer.imageDirty();
    }

    get edgeColor() {
        return this._state.edgeColor;
    }

    /**
     Transparency of ghost edges.

     A value of 0.0 indicates fully transparent, 1.0 is fully opaque.

     @property edgeAlpha
     @default 0.5
     @type Number
     */
    set edgeAlpha(value) {
        value = (value !== undefined && value !== null) ? value : 0.5;
        if (this._state.edgeAlpha === value) {
            return;
        }
        this._state.edgeAlpha = value;
        this._renderer.imageDirty();
    }

    get edgeAlpha() {
        return this._state.edgeAlpha;
    }

    /**
     Width of ghost edges, in pixels.

     @property edgeWidth
     @default 1.0
     @type Number
     */
    set edgeWidth(value) {
        this._state.edgeWidth = value || 1.0;
        this._renderer.imageDirty();
    }

    get edgeWidth() {
        return this._state.edgeWidth;
    }

    /**
     Indicates whether or not ghost vertices are visible.

     @property vertices
     @default false
     @type Boolean
     */
    set vertices(value) {
        value = !!value;
        if (this._state.vertices === value) {
            return;
        }
        this._state.vertices = value;
        this._renderer.imageDirty();
    }

    get vertices() {
        return this._state.vertices;
    }

    /**
     Color of ghost vertices.

     @property vertexColor
     @default [0.4,0.4,0.4]
     @type Float32Array
     */
    set vertexColor(value) {
        let vertexColor = this._state.vertexColor;
        if (!vertexColor) {
            vertexColor = this._state.vertexColor = new Float32Array(3);
        } else if (value && vertexColor[0] === value[0] && vertexColor[1] === value[1] && vertexColor[2] === value[2]) {
            return;
        }
        if (value) {
            vertexColor[0] = value[0];
            vertexColor[1] = value[1];
            vertexColor[2] = value[2];
        } else {
            vertexColor[0] = 0.4;
            vertexColor[1] = 0.4;
            vertexColor[2] = 0.4;
        }
        this._renderer.imageDirty();
    }

    get vertexColor() {
        return this._state.vertexColor;
    }

    /**
     Transparency of ghost vertices.

     A value of 0.0 indicates fully transparent, 1.0 is fully opaque.

     @property vertexAlpha
     @default 0.7
     @type Number
     */
    set vertexAlpha(value) {
        value = (value !== undefined && value !== null) ? value : 0.7;
        if (this._state.vertexAlpha === value) {
            return;
        }
        this._state.vertexAlpha = value;
        this._renderer.imageDirty();
    }

    get vertexAlpha() {
        return this._state.vertexAlpha;
    }

    /**
     Pixel size of ghost vertices.

     @property vertexSize
     @default 4.0
     @type Number
     */
    set vertexSize(value) {
        this._state.vertexSize = value || 4.0;
        this._renderer.imageDirty();
    }

    get vertexSize() {
        return this._state.vertexSize;
    }

    /**
     Indicates whether or not ghost surfaces are filled with color.

     @property fill
     @default true
     @type Boolean
     */
    set fill(value) {
        value = value !== false;
        if (this._state.fill === value) {
            return;
        }
        this._state.fill = value;
        this._renderer.imageDirty();
    }

    get fill() {
        return this._state.fill;
    }

    /**
     RGB color of filled ghost faces.

     @property fillColor
     @default [0.4, 0.4, 0.4]
     @type Float32Array
     */
    set fillColor(value) {
        let fillColor = this._state.fillColor;
        if (!fillColor) {
            fillColor = this._state.fillColor = new Float32Array(3);
        } else if (value && fillColor[0] === value[0] && fillColor[1] === value[1] && fillColor[2] === value[2]) {
            return;
        }
        if (value) {
            fillColor[0] = value[0];
            fillColor[1] = value[1];
            fillColor[2] = value[2];
        } else {
            fillColor[0] = 0.4;
            fillColor[1] = 0.4;
            fillColor[2] = 0.4;
        }
        this._renderer.imageDirty();
    }

    get fillColor() {
        return this._state.fillColor;
    }

    /**
     Transparency of filled ghost faces.

     A value of 0.0 indicates fully transparent, 1.0 is fully opaque.

     @property fillAlpha
     @default 0.2
     @type Number
     */
    set fillAlpha(value) {
        value = (value !== undefined && value !== null) ? value : 0.2;
        if (this._state.fillAlpha === value) {
            return;
        }
        this._state.fillAlpha = value;
        this._renderer.imageDirty();
    }

    get fillAlpha() {
        return this._state.fillAlpha;
    }

    /**
     Whether backfaces are visible on attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     The backfaces will belong to {{#crossLink "Geometry"}}{{/crossLink}} components that are also attached to
     the {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     @property backfaces
     @default false
     @type Boolean
     */
    set backfaces(value) {
        value = !!value;
        if (this._state.backfaces === value) {
            return;
        }
        this._state.backfaces = value;
        this._renderer.imageDirty();
    }

    get backfaces() {
        return this._state.backfaces;
    }

    /**
     Selects a preset EmphasisMaterial configuration.

     Available presets are:

     * "default" - grey wireframe with translucent fill, for light backgrounds.
     * "defaultLightBG" - grey wireframe with grey translucent fill, for light backgrounds.
     * "defaultDarkBG" - grey wireframe with grey translucent fill, for dark backgrounds.
     * "vectorscope" - green wireframe with glowing vertices and black translucent fill.
     * "battlezone" - green wireframe with black opaque fill, giving a solid hidden-lines-removed effect.
     * "sepia" - light red-grey wireframe with light sepia translucent fill - easy on the eyes.
     * "gamegrid" - light blue wireframe with dark blue translucent fill - reminiscent of Tron.
     * "yellowHighlight" - light yellow translucent fill - highlights while allowing underlying detail to show through.

     @property preset
     @default "default"
     @type String
     */
    set preset(value) {
        value = value || "default";
        if (this._preset === value) {
            return;
        }
        const preset = PRESETS[value];
        if (!preset) {
            this.error("unsupported preset: '" + value + "' - supported values are " + Object.keys(PRESETS).join(", "));
            return;
        }
        this.edges = preset.edges;
        this.edgeColor = preset.edgeColor;
        this.edgeAlpha = preset.edgeAlpha;
        this.edgeWidth = preset.edgeWidth;
        this.vertices = preset.vertices;
        this.vertexColor = preset.vertexColor;
        this.vertexAlpha = preset.vertexAlpha;
        this.vertexSize = preset.vertexSize;
        this.fill = preset.fill;
        this.fillColor = preset.fillColor;
        this.fillAlpha = preset.fillAlpha;
        this._preset = value;
    }

    get preset() {
        return this._preset;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
    }
}

componentClasses[type$18] = EmphasisMaterial;

/**
 An **EdgeMaterial** is a {{#crossLink "Material"}}{{/crossLink}} that defines the appearance of attached
 {{#crossLink "Mesh"}}Meshes{{/crossLink}} when they are highlighted, selected or ghosted.

 ## Examples

 | <a href="../../examples/#effects_ghost"><img src="../../assets/images/screenshots/HighlightMaterial/teapot.png"></img></a> | <a href="../../examples/#effects_demo_housePlan"><img src="../../assets/images/screenshots/HighlightMaterial/house.png"></img></a> | <a href="../../examples/#effects_demo_gearbox"><img src="../../assets/images/screenshots/HighlightMaterial/gearbox.png"></img></a> | <a href="../../examples/#effects_demo_adam"><img src="../../assets/images/screenshots/HighlightMaterial/adam.png"></img></a>|
 |:------:|:------:|:----:|:-----:|:-----:|
 |[Example 1: Ghost effect](../../examples/#effects_ghost)|[Example 2: Ghost and highlight effects for architecture](../../examples/#effects_demo_housePlan)|[Example 3: Ghost and highlight effects for CAD](../../examples/#effects_demo_gearbox)| [Example 4: Ghost effect for CAD ](../../examples//#effects_demo_adam)|

 ## Overview

 * Ghost an {{#crossLink "Mesh"}}{{/crossLink}} by setting its {{#crossLink "Mesh/ghost:property"}}{{/crossLink}} property ````true````.
 * When ghosted, a Mesh's appearance is controlled by its EdgeMaterial.
 * An EdgeMaterial provides several preset configurations that you can set it to. Select a preset by setting {{#crossLink "EdgeMaterial/preset:property"}}{{/crossLink}} to the preset's ID. A map of available presets is provided in {{#crossLink "EdgeMaterial/presets:property"}}xeogl.EdgeMaterial.presets{{/crossLink}}.
 * By default, a Mesh uses the {{#crossLink "Scene"}}{{/crossLink}}'s global EdgeMaterials, but you can give each Mesh its own EdgeMaterial when you want to customize the effect per-Mesh.
 * Ghost all Meshes in a {{#crossLink "Model"}}{{/crossLink}} by setting the Model's {{#crossLink "Model/ghost:property"}}{{/crossLink}} property ````true````. Note that all Meshes in a Model have the Scene's global EdgeMaterial by default.
 * Modify the Scene's global EdgeMaterial to customize it.

 ## Usage

 * [Ghosting](#ghosting)
 * [Highlighting](#highlighting)

 ### Ghosting

 In the usage example below, we'll create a Mesh with a ghost effect applied to it. The Mesh gets its own EdgeMaterial for ghosting, and
 has its {{#crossLink "Mesh/ghost:property"}}{{/crossLink}} property set ````true```` to activate the effect.

 <a href="../../examples/#effects_ghost"><img src="../../assets/images/screenshots/HighlightMaterial/teapot.png"></img></a>

 ````javascript
 var mesh = new xeogl.Mesh({
    geometry: new xeogl.TeapotGeometry({
        edgeThreshold: 1
    }),
    material: new xeogl.PhongMaterial({
        diffuse: [0.2, 0.2, 1.0]
    }),
    edgeMaterial: new xeogl.EdgeMaterial({
        edges: true,
        edgeColor: [0.2, 1.0, 0.2],
        edgeAlpha: 1.0,
        edgeWidth: 2,
        vertices: true,
        vertexColor: [0.6, 1.0, 0.6],
        vertexAlpha: 1.0,
        vertexSize: 8,
        fill: true,
        fillColor: [0, 0, 0],
        fillAlpha: 0.7
    }),
    ghost: true
 });
 ````

 Note the **edgeThreshold** configuration on the {{#crossLink "Geometry"}}{{/crossLink}} we've created for our
 Mesh. Our EdgeMaterial is configured to draw a wireframe representation of the Geometry, which will have inner edges (ie. edges between
 adjacent co-planar triangles) removed for visual clarity. The ````edgeThreshold```` configuration indicates
 that, for this particular Geometry, an inner edge is one where the angle between the surface normals of adjacent triangles is not
 greater than ````5```` degrees. That's set to ````2```` by default, but we can override it to tweak the effect as needed for particular Geometries.

 Here's the example again, this time using the Scene's global EdgeMaterial by default. We'll also modify that EdgeMaterial
 to customize the effect.

 ````javascript
 var mesh = new xeogl.Mesh({
    geometry: new xeogl.TeapotGeometry({
        edgeThreshold: 5
    }),
    material: new xeogl.PhongMaterial({
        diffuse: [0.2, 0.2, 1.0]
    }),
    ghost: true
 });

 var edgeMaterial = mesh.scene.edgeMaterial;

 edgeMaterial.edges = true;
 edgeMaterial.edgeColor = [0.2, 1.0, 0.2];
 edgeMaterial.edgeAlpha = 1.0;
 edgeMaterial.edgeWidth = 2;
 ````

 ### Highlighting

 In the next example, we'll use a ghosting in conjunction with highlighting, to emphasise a couple of objects within
 a gearbox {{#crossLink "Model"}}{{/crossLink}}. We'll load the Model from glTF, then ghost all of its Meshes except for two gears, which we'll highlight instead. The ghosted
 Meshes have the Scene's global ghosting EdgeMaterial, which we'll modify. The  highlighted Meshes also have the Scene's global highlighting EdgeMaterial, which we'll modify as well.

 <a href="../../examples/#effects_demo_gearbox"><img src="../../assets/images/screenshots/HighlightMaterial/gearbox.png"></img></a>

 ````javascript
 var model = new xeogl.GLTFModel({
     src: "models/gltf/gearbox_conical/scene.gltf",
     edgeThreshold: 10
 });

 model.on("loaded", function() {

    model.meshes["gearbox#77.0"].highlight = true;
    model.meshes["gearbox#79.0"].highlight = true;

    var edgeMaterial = model.scene.edgeMaterial;

    edgeMaterial.edgeColor = [0.4, 0.4, 1.6];
    edgeMaterial.edgeAlpha = 0.8;
    edgeMaterial.edgeWidth = 3;

    var highlightMaterial = model.scene.highlightMaterial;

    highlightMaterial.color = [1.0, 1.0, 1.0];
    highlightMaterial.alpha = 1.0;
 });
 ````

 ## Presets

 For convenience, an EdgeMaterial provides several preset configurations that you can set it to, which are provided in
 {{#crossLink "EdgeMaterial/presets:property"}}xeogl.EdgeMaterial.presets{{/crossLink}}:

 ````javascript
 var presets = xeogl.EdgeMaterial.presets;
 ````

 The presets look something like this:

 ````json
 {
        "default": {
            edgeColor: [0.2, 0.2, 0.2],
            edgeAlpha: 1.0,
            edgeWidth: 1
        },

         "sepia": {
            edgeColor: [0.45, 0.45, 0.41],
            edgeAlpha: 1.0,
            edgeWidth: 1
        },

        //...
 }
 ````

 Let's switch the Scene's global default  EdgeMaterial over to the "sepia" preset used in <a href="/examples/#effects_demo_adam">Example 4: Ghost effect for CAD</a>.

 ````javascript
 scene.edgeMaterial.preset = "sepia";
 ````

 You can also just create an EdgeMaterial from a preset:

 ````javascript
 var mesh = new xeogl.Mesh({
    geometry: new xeogl.TeapotGeometry({
        edgeThreshold: 5
    }),
    material: new xeogl.PhongMaterial({
        diffuse: [0.2, 0.2, 1.0]
    }),
    edgeMaterial: new xeogl.EdgeMaterial({
        preset: "sepia"
    });
    ghost: true
 });
 ````

 Note that applying a preset just sets the EdgeMaterial's property values, which you are then free to modify afterwards.

 @class EdgeMaterial
 @module xeogl
 @submodule materials
 @constructor
 @extends Material
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} The EdgeMaterial configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta=null] {String:Object} Metadata to attach to this EdgeMaterial.

 @param [cfg.edgeColor=[0.2,0.2,0.2]] {Array of Number}  RGB color of ghost edges.
 @param [cfg.edgeAlpha=1.0] {Number} Transparency of ghost edges. A value of 0.0 indicates fully transparent, 1.0 is fully opaque.
 @param [cfg.edgeWidth=1] {Number}  Width of ghost edges, in pixels.

 @param [cfg.preset] {String} Selects a preset EdgeMaterial configuration - see {{#crossLink "EdgeMaterial/preset:method"}}EdgeMaterial#preset(){{/crossLink}}.
 */

const PRESETS$1 = {
    "default": {
        edgeColor: [0.0, 0.0, 0.0],
        edgeAlpha: 1.0,
        edgeWidth: 1
    },
    "defaultWhiteBG": {
        edgeColor: [0.2, 0.2, 0.2],
        edgeAlpha: 1.0,
        edgeWidth: 1
    },
    "defaultLightBG": {
        edgeColor: [0.2, 0.2, 0.2],
        edgeAlpha: 1.0,
        edgeWidth: 1
    },
    "defaultDarkBG": {
        edgeColor: [0.5, 0.5, 0.5],
        edgeAlpha: 1.0,
        edgeWidth: 1
    }
};


const type$19 = "xeogl.EdgeMaterial";

class EdgeMaterial extends Material {

    /**
     Available EdgeMaterial presets.

     @property presets
     @type {Object}
     @static
     */
    static get presets() {
        return PRESETS$1;
    };

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$19;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            type: "EdgeMaterial",
            edgeColor: null,
            edgeAlpha: null,
            edgeWidth: null
        });

        this._preset = "default";

        if (cfg.preset) { // Apply preset then override with configs where provided
            this.preset = cfg.preset;
            if (cfg.edgeColor) {
                this.edgeColor = cfg.edgeColor;
            }
            if (cfg.edgeAlpha !== undefined) {
                this.edgeAlpha = cfg.edgeAlpha;
            }
            if (cfg.edgeWidth !== undefined) {
                this.edgeWidth = cfg.edgeWidth;
            }
        } else {
            this.edgeColor = cfg.edgeColor;
            this.edgeAlpha = cfg.edgeAlpha;
            this.edgeWidth = cfg.edgeWidth;
        }
    }


    /**
     RGB color of ghost edges.

     @property edgeColor
     @default [0.2, 0.2, 0.2]
     @type Float32Array
     */
    set edgeColor(value) {
        let edgeColor = this._state.edgeColor;
        if (!edgeColor) {
            edgeColor = this._state.edgeColor = new Float32Array(3);
        } else if (value && edgeColor[0] === value[0] && edgeColor[1] === value[1] && edgeColor[2] === value[2]) {
            return;
        }
        if (value) {
            edgeColor[0] = value[0];
            edgeColor[1] = value[1];
            edgeColor[2] = value[2];
        } else {
            edgeColor[0] = 0.2;
            edgeColor[1] = 0.2;
            edgeColor[2] = 0.2;
        }
        this._renderer.imageDirty();
    }

    get edgeColor() {
        return this._state.edgeColor;
    }

    /**
     Transparency of ghost edges.

     A value of 0.0 indicates fully transparent, 1.0 is fully opaque.

     @property edgeAlpha
     @default 1.0
     @type Number
     */
    set edgeAlpha(value) {
        value = (value !== undefined && value !== null) ? value : 1.0;
        if (this._state.edgeAlpha === value) {
            return;
        }
        this._state.edgeAlpha = value;
        this._renderer.imageDirty();
    }

    get edgeAlpha() {
        return this._state.edgeAlpha;
    }

    /**
     Width of ghost edges, in pixels.

     @property edgeWidth
     @default 1.0
     @type Number
     */
    set edgeWidth(value) {
        this._state.edgeWidth = value || 1.0;
        this._renderer.imageDirty();
    }

    get edgeWidth() {
        return this._state.edgeWidth;
    }

    /**
     Selects a preset EdgeMaterial configuration.

     Available presets are:

     * "default" - grey wireframe with translucent fill, for light backgrounds.
     * "defaultLightBG" - grey wireframe with grey translucent fill, for light backgrounds.
     * "defaultDarkBG" - grey wireframe with grey translucent fill, for dark backgrounds.
     * "vectorscope" - green wireframe with glowing vertices and black translucent fill.
     * "battlezone" - green wireframe with black opaque fill, giving a solid hidden-lines-removed effect.
     * "sepia" - light red-grey wireframe with light sepia translucent fill - easy on the eyes.
     * "gamegrid" - light blue wireframe with dark blue translucent fill - reminiscent of Tron.
     * "yellowHighlight" - light yellow translucent fill - highlights while allowing underlying detail to show through.

     @property preset
     @default "default"
     @type String
     */
    set preset(value) {
        value = value || "default";
        if (this._preset === value) {
            return;
        }
        const preset = PRESETS$1[value];
        if (!preset) {
            this.error("unsupported preset: '" + value + "' - supported values are " + Object.keys(PRESETS$1).join(", "));
            return;
        }
        this.edgeColor = preset.edgeColor;
        this.edgeAlpha = preset.edgeAlpha;
        this.edgeWidth = preset.edgeWidth;
        this._preset = value;
    }

    get preset() {
        return this._preset;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
    }
}

componentClasses[type$19] = EdgeMaterial;

/**
 An **OutlineMaterial** is a {{#crossLink "Material"}}{{/crossLink}} that's applied to {{#crossLink "Mesh"}}Meshes{{/crossLink}}
 to render an outline around them.

 WIP

 @class OutlineMaterial
 @module xeogl
 @submodule materials
 @constructor
 @extends Material
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} The OutlineMaterial configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta=null] {String:Object} Metadata to attach to this OutlineMaterial.
 @param [cfg.color=[1.0,0.2,0.2]] {Array of Number}  Outline RGB color.
 @param [cfg.alpha=1.0] {Number} Outline opacity. A value of 0.0 indicates fully transparent, 1.0 is fully opaque.
 @param [cfg.width=4] {Number}  Outline width, in pixels.
 */
const type$20 = "xeogl.OutlineMaterial";

class OutlineMaterial extends Material {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$20;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            type: "OutlineMaterial",
            color: null,
            alpha: null,
            width: null
        });
        this.color = cfg.color;
        this.alpha = cfg.alpha;
        this.width = cfg.width;
    }

    /**
     RGB outline color.

     @property color
     @default [1.0, 0.2, 0.2]
     @type Float32Array
     */
    set color(value) {
        let color = this._state.color;
        if (!color) {
            color = this._state.color = new Float32Array(3);
        } else if (value && color[0] === value[0] && color[1] === value[1] && color[2] === value[2]) {
            return;
        }
        if (value) {
            color[0] = value[0];
            color[1] = value[1];
            color[2] = value[2];
        } else {
            color[0] = 1.0;
            color[1] = 0.2;
            color[2] = 0.2;
        }
        this._renderer.imageDirty();
    }

    get color() {
        return this._state.color;
    }

    /**
     Outline transparency.

     A value of 0.0 indicates fully transparent, 1.0 is fully opaque.

     @property alpha
     @default 1.0
     @type Number
     */
    set alpha(value) {
        value = (value !== undefined && value !== null) ? value : 1.0;
        if (this._state.alpha === value) {
            return;
        }
        this._state.alpha = value;
        this._renderer.imageDirty();
    }

    get alpha() {
        return this._state.alpha;
    }

    /**
     Outline width in pixels.

     @property width
     @default 4.0
     @type Number
     */
    set width(value) {
        this._state.width = value || 4.0;
        this._renderer.imageDirty();
    }

    get width() {
        return this._state.width;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
    }
}

componentClasses[type$20] = OutlineMaterial;

/**
 The container for all 3D graphical objects and state in a xeogl scene.

 ## Usage

 * [Creating a Scene](#creating-a-scene)
 * [Creating and accessing components](#creating-and-accessing-components)
 * [Controlling the camera](#controlling-the-camera)
 * [Taking snapshots](#taking-snapshots)
 * [Lighting](#lighting)
 * [Clipping](#clipping)
 * [Picking](#picking)
 * [Querying and tracking boundaries](#querying-and-tracking-boundaries)
 * [Controlling the viewport](#controlling-the-viewport)
 * [Controlling rendering](#controlling-rendering)
 * [Gamma correction](#gamma-correction)

 ### Creating a Scene

 Creating a Scene with its own default canvas:

 ````javascript
 var scene = new xeogl.Scene();
 ````

 Creating a Scene with an existing canvas.

 ````javascript
 var scene2 = new xeogl.Scene({
    canvas: "myCanvas"
 });

 var scene3 = new xeogl.Scene({
    canvas: document.getElementById("myCanvas");
 });
 ````

 ### Creating and accessing components

 As a brief introduction to creating Scene components, we'll create a {{#crossLink "Mesh"}}{{/crossLink}} that has a
 {{#crossLink "TeapotGeometry"}}{{/crossLink}} and a {{#crossLink "PhongMaterial"}}{{/crossLink}}:

 <a href="../../examples/#geometry_primitives_teapot"><img src="../../assets/images/screenshots/Scene/teapot.png"></img></a>

 ````javascript
 var teapotMesh = new xeogl.Mesh(scene, {
    id: "myMesh",                               // <<---------- ID automatically generated if not provided
    geometry: new xeogl.TeapotGeometry(scene),
    material: new xeogl.PhongMaterial(scene, {
        id: "myMaterial",
        diffuse: [0.2, 0.2, 1.0]
    })
 });
 ````

 Creating a {{#crossLink "Mesh"}}{{/crossLink}} within the default Scene (xeogl will automatically create the default Scene if it does not yet exist):
 ````javascript
 var teapotMesh = new xeogl.Mesh({
    id: "myMesh",
    geometry: new xeogl.TeapotGeometry(),
    material: new xeogl.PhongMaterial({
        id: "myMaterial",
        diffuse: [0.2, 0.2, 1.0]
    })
 });

 teapotMesh.scene.camera.eye = [45, 45, 45];
 ````

 The default Scene can be got from either the Mesh or the xeogl namespace:

 ````javascript
 scene = teapotMesh.scene;
 scene = xeogl.getDefaultScene();
 ````

 You can also make any Scene instance the default scene, so that components will belong to that Scene when you don't explicitly
 specify a Scene for them:

 ````javascript
 var scene = new xeogl.Scene({ ... };
 xeogl.setDefaultScene( scene );
 ````

 Find components by ID in their Scene's {{#crossLink "Scene/components:property"}}{{/crossLink}} map:

 ````javascript
 var teapotMesh = scene.components["myMesh"];
 teapotMesh.visible = false;

 var teapotMaterial = scene.components["myMaterial"];
 teapotMaterial.diffuse = [1,0,0]; // Change to red
 ````

 A Scene also has a map of component instances for each {{#crossLink "Component"}}{{/crossLink}} subtype:

 ````javascript
 var meshes = scene.types["xeogl.Mesh"];
 var teapotMesh = meshes["myMesh"];
 teapotMesh.ghosted = true;

 var phongMaterials = scene.types["xeogl.PhongMaterial"];
 var teapotMaterial = phongMaterials["myMaterial"];
 teapotMaterial.diffuse = [0,1,0]; // Change to green
 ````

 See {{#crossLink "Object"}}{{/crossLink}}, {{#crossLink "Group"}}{{/crossLink}} and {{#crossLink "Model"}}{{/crossLink}}
 for how to create and access more sophisticated content.

 ### Controlling the camera

 Use the Scene's {{#crossLink "Camera"}}{{/crossLink}} to control the current viewpoint and projection:

 ````javascript
 var camera = myScene.camera;

 camera.eye = [-10,0,0];
 camera.look = [-10,0,0];
 camera.up = [0,1,0];

 camera.projection = "perspective";
 camera.perspective.fov = 45;
 //...
 ````

 ### Managing the canvas, taking snapshots

 The Scene's {{#crossLink "Canvas"}}{{/crossLink}} component provides various conveniences relevant to the WebGL canvas, such
 as getting getting snapshots, firing resize events etc:

 ````javascript
 var canvas = scene.canvas;

 canvas.on("boundary", function(boundary) {
    //...
 });

 var imageData = canvas.getSnapshot({
    width: 500,
    height: 500,
    format: "png"
 });
 ````

 ### Lighting

 The Scene's {{#crossLink "Lights"}}{{/crossLink}} component manages lighting:

 ````javascript
 var lights = scene.lights;
 lights[1].color = [0.9, 0.9, 0.9];
 //...
 ````

 ### Clipping

 The Scene's {{#crossLink "Clips"}}{{/crossLink}} component manages clipping planes for custom cross-sections:

 ````javascript
 var clips = scene.clips;
 clips.clips = [
 new xeogl.Clip({  // Clip plane on negative diagonal
        pos: [1.0, 1.0, 1.0],
        dir: [-1.0, -1.0, -1.0],
        active: true
    }),
 new xeogl.Clip({ // Clip plane on positive diagonal
        pos: [-1.0, -1.0, -1.0],
        dir: [1.0, 1.0, 1.0],
        active: true
    }),
 //...
 ];
 ````

 ### Picking

 Use the Scene's {{#crossLink "Scene/pick:method"}}Scene#pick(){{/crossLink}} method to pick and raycast meshes.

 For example, to pick a point on the surface of the closest mesh at the given canvas coordinates:

 ````javascript
 var hit = scene.pick({
     pickSurface: true,
     canvasPos: [23, 131]
 });

 if (hit) { // Picked a Mesh

      var mesh = hit.mesh;

      var primitive = hit.primitive; // Type of primitive that was picked, usually "triangles"
      var primIndex = hit.primIndex; // Position of triangle's first index in the picked Mesh's Geometry's indices array
      var indices = hit.indices; // UInt32Array containing the triangle's vertex indices
      var localPos = hit.localPos; // Float32Array containing the picked Local-space position on the triangle
      var worldPos = hit.worldPos; // Float32Array containing the picked World-space position on the triangle
      var viewPos = hit.viewPos; // Float32Array containing the picked View-space position on the triangle
      var bary = hit.bary; // Float32Array containing the picked barycentric position within the triangle
      var normal = hit.normal; // Float32Array containing the interpolated normal vector at the picked position on the triangle
      var uv = hit.uv; // Float32Array containing the interpolated UV coordinates at the picked position on the triangle
 }
 ````

 #### Pick masking

 We can use the {{#crossLink "Scene/pick:method"}}Scene#pick(){{/crossLink}} method's ````includeMeshes```` and ````excludeMeshes````
 options to mask which Meshes we attempt to pick.

 This is useful for picking <em>through</em> things, to pick only the Meshes of interest.

 To pick only Meshes ````"gearbox#77.0"```` and ````"gearbox#79.0"````, picking through any other Meshes that are
 in the way, as if they weren't there:

 ````javascript
 var hit = scene.pick({
     canvasPos: [23, 131],
     includeMeshes: ["gearbox#77.0", "gearbox#79.0"]
 });

 if (hit) {
      // Mesh will always be either "gearbox#77.0" or "gearbox#79.0"
      var mesh = hit.mesh;
 }
 ````

 To pick any pickable Mesh, except for ````"gearbox#77.0"```` and ````"gearbox#79.0"````, picking through those
 Meshes if they happen to be in the way:

 ````javascript
 var hit = scene.pick({
     canvasPos: [23, 131],
     excludeMeshes: ["gearbox#77.0", "gearbox#79.0"]
 });

 if (hit) {
      // Mesh will never be "gearbox#77.0" or "gearbox#79.0"
      var mesh = hit.mesh;
 }
 ````

 See {{#crossLink "Scene/pick:method"}}Scene#pick(){{/crossLink}} for more info on picking.

 ### Querying and tracking boundaries

 Getting a Scene's World-space axis-aligned boundary (AABB):

 ````javascript
 var aabb = scene.aabb; // [xmin, ymin, zmin, xmax, ymax, zmax]
 ````

 Subscribing to updates to the AABB, which occur whenever {{#crossLink "Meshes"}}{{/crossLink}} are transformed, their
 {{#crossLink "Geometry"}}Geometries{{/crossLink}} have been updated, or the {{#crossLink "Camera"}}Camera{{/crossLink}} has moved:

 ````javascript
 scene.on("boundary", function() {
     var aabb = scene.aabb;
 });
 ````

 Getting the AABB of the {{#crossLink "Object"}}Objects{{/crossLink}} with the given IDs:

 ````JavaScript
 scene.getAABB(); // Gets collective boundary of all Mesh Objects in the scene
 scene.getAABB("saw"); // Gets boundary of an Object
 scene.getAABB(["saw", "gearbox"]); // Gets collective boundary of two Objects
 ````

 See {{#crossLink "Scene/getAABB:method"}}Scene#getAABB(){{/crossLink}} and {{#crossLink "Object"}}{{/crossLink}} for more info on querying and tracking boundaries.

 ### Managing the viewport

 The Scene's {{#crossLink "Viewport"}}{{/crossLink}} component manages the WebGL viewport:

 ````javascript
 var viewport = scene.viewport
 viewport.boundary = [0, 0, 500, 400];;
 ````

 ### Controlling rendering

 You can configure a Scene to perform multiple "passes" (renders) per frame. This is useful when we want to render the
 scene to multiple viewports, such as for stereo effects.

 In the example, below, we'll configure the Scene to render twice on each frame, each time to different viewport. We'll do this
 with a callback that intercepts the Scene before each render and sets its {{#crossLink "Viewport"}}{{/crossLink}} to a
 different portion of the canvas. By default, the Scene will clear the canvas only before the first render, allowing the
 two views to be shown on the canvas at the same time.

 ````Javascript
 // Load a glTF model
 var model = new xeogl.GLTFModel({
    src: "models/gltf/GearboxAssy/glTF-MaterialsCommon/GearboxAssy.gltf"
 });

 var scene = model.scene;
 var viewport = scene.viewport;

 // Configure Scene to render twice for each frame
 scene.passes = 2; // Default is 1
 scene.clearEachPass = false; // Default is false

 // Render to a separate viewport on each render

 var viewport = scene.viewport;
 viewport.autoBoundary = false;

 scene.on("rendering", function (e) {
     switch (e.pass) {
         case 0:
             viewport.boundary = [0, 0, 200, 200]; // xmin, ymin, width, height
             break;

         case 1:
             viewport.boundary = [200, 0, 200, 200];
             break;
     }
 });

 // We can also intercept the Scene after each render,
 // (though we're not using this for anything here)
 scene.on("rendered", function (e) {
     switch (e.pass) {
         case 0:
             break;

         case 1:
             break;
     }
 });
 ````

 ### Gamma correction

 Within its shaders, xeogl performs shading calculations in linear space.

 By default, the Scene expects color textures (eg. {{#crossLink "PhongMaterial/diffuseMap:property"}}PhongMaterial#diffuseMap{{/crossLink}},
 {{#crossLink "MetallicMaterial/baseColorMap:property"}}MetallicMaterial#baseColorMap{{/crossLink}} and {{#crossLink "SpecularMaterial/diffuseMap:property"}}SphericalMaterial#diffuseMap{{/crossLink}}) to
 be in pre-multipled gamma space, so will convert those to linear space before they are used in shaders. Other textures are
 always expected to be in linear space.

 By default, the Scene will also gamma-correct its rendered output.

 You can configure the Scene to expect all those color textures to be linear space, so that it does not gamma-correct them:

 ````javascript
 scene.gammaInput = false;
 ````

 You would still need to gamma-correct the output, though, if it's going straight to the canvas, so normally we would
 leave that enabled:

 ````javascript
 scene.gammaOutput = true;
 ````

 See {{#crossLink "Texture"}}{{/crossLink}} for more information on texture encoding and gamma.

 @class Scene
 @module xeogl
 @submodule scene
 @constructor
 @param [cfg] Scene parameters
 @param [cfg.id] {String} Optional ID, unique among all Scenes in xeogl, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Scene.
 @param [cfg.canvasId] {String} ID of existing HTML5 canvas in the DOM - creates a full-page canvas automatically if this is omitted
 @param [cfg.webgl2=true] {Boolean} Set this false when we **don't** want to use WebGL 2 for our Scene; the Scene will fall
 back on WebGL 1 if not available. This property will be deprecated when WebGL 2 is supported everywhere.
 @param [cfg.components] {Array(Object)} JSON array containing parameters for {{#crossLink "Component"}}Component{{/crossLink}} subtypes to immediately create within the Scene.
 @param [cfg.ticksPerRender=1] {Number} The number of {{#crossLink "Scene/tick:event"}}{{/crossLink}} that happen between each render or this Scene.
 @param [cfg.passes=1] {Number} The number of times this Scene renders per frame.
 @param [cfg.clearEachPass=false] {Boolean} When doing multiple passes per frame, specifies whether to clear the
 canvas before each pass (true) or just before the first pass (false).
 @param [cfg.transparent=false] {Boolean} Whether or not the canvas is transparent.
 @param [cfg.backgroundColor] {Float32Array} RGBA color for canvas background, when canvas is not transparent. Overridden by backgroundImage.
 @param [cfg.backgroundImage] {String} URL of an image to show as the canvas background, when canvas is not transparent. Overrides backgroundImage.
 @param [cfg.gammaInput=false] {Boolean} When true, expects that all textures and colors are premultiplied gamma.
 @param [cfg.gammaOutput=true] {Boolean} Whether or not to render with pre-multiplied gama.
 @param [cfg.gammaFactor=2.2] {Number} The gamma factor to use when rendering with pre-multiplied gamma.
 @extends Component
 */

const type$21 = "xeogl.Scene";

// Cached vars to avoid garbage collection

const localRayOrigin = math.vec3();
const localRayDir = math.vec3();
const positionA = math.vec3();
const positionB = math.vec3();
const positionC = math.vec3();
const triangleVertices = math.vec3();
const position = math.vec4();
const worldPos = math.vec3();
const viewPos = math.vec3();
const bary = math.vec3();
const normalA = math.vec3();
const normalB = math.vec3();
const normalC = math.vec3();
const uva = math.vec3();
const uvb = math.vec3();
const uvc = math.vec3();
const tempVec4a = math.vec4();
const tempVec4b = math.vec4();
const tempVec4c = math.vec4();
const tempVec3$1 = math.vec3();
const tempVec3b$1 = math.vec3();
const tempVec3c$1 = math.vec3();
const tempVec3d$1 = math.vec3();
const tempVec3e$1 = math.vec3();
const tempVec3f$1 = math.vec3();
const tempVec3g = math.vec3();
const tempVec3h = math.vec3();
const tempVec3i = math.vec3();
const tempVec3j = math.vec3();
const tempVec3k = math.vec3();

function getMeshIDMap(scene, meshIds) {
    const map = {};
    let meshId;
    let mesh;
    for (let i = 0, len = meshIds.length; i < len; i++) {
        meshId = meshIds[i];
        mesh = scene.meshes[meshId];
        if (!mesh) {
            scene.warn("pick(): Mesh not found: " + meshId);
            continue;
        }
        map[meshId] = true;
    }
    return map;
}

/**
 * Fired whenever a debug message is logged on a component within this Scene.
 * @event log
 * @param {String} value The debug message
 */

/**
 * Fired whenever an error is logged on a component within this Scene.
 * @event error
 * @param {String} value The error message
 */

/**
 * Fired whenever a warning is logged on a component within this Scene.
 * @event warn
 * @param {String} value The warning message
 */
class Scene extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$21;
    }

    init(cfg) {

        super.init(cfg);

        const self = this;

        const transparent = !!cfg.transparent;

        /**
         The number of models currently loading.

         @property loading
         @final
         @type {Number}
         */
        this.loading = 0;

        /**
         The epoch time (in milliseconds since 1970) when this Scene was instantiated.

         @property timeCreated
         @final
         @type {Number}
         */
        this.startTime = (new Date()).getTime();

        /**
         {{#crossLink "Model"}}{{/crossLink}}s in this Scene, mapped to their IDs.

         @property models
         @final
         @type {String:xeogl.Model}
         */
        this.models = {};

        /**
         The {{#crossLink "Object"}}Objects{{/crossLink}} in this Scene, mapped to their IDs.

         @property objects
         @final
         @type {{String:Object}}
         */
        this.objects = {};

        /**
         {{#crossLink "Object"}}Objects{{/crossLink}} in this Scene that have GUIDs, mapped to their GUIDs.

         Each Object is registered in this map when its {{#crossLink "Object/guid:property"}}{{/crossLink}} is
         assigned a value.

         @property guidObjects
         @final
         @type {{String:Object}}
         */
        this.guidObjects = {};

        /**
         For each entity type, a map of IDs to {{#crossLink "Object"}}Objects{{/crossLink}} of that entity type.

         Each Object is registered in this map when its {{#crossLink "Object/entityType:property"}}{{/crossLink}} is
         assigned a value.

         @property entityTypes
         @final
         @type {String:{String:xeogl.Component}}
         */
        this.entityTypes = {};

        /**
         {{#crossLink "Object"}}Objects{{/crossLink}} in this Scene that have entity types, mapped to their IDs.

         Each Object is registered in this map when its {{#crossLink "Object/entityType:property"}}{{/crossLink}} is
         assigned a value.

         @property entities
         @final
         @type {{String:Object}}
         */
        this.entities = {};

        /**
         Visible entity {{#crossLink "Object"}}Objects{{/crossLink}} within this Scene, mapped to their IDs.

         Each Object is registered in this map when its {{#crossLink "Object/visible:property"}}{{/crossLink}} property is true and its
         {{#crossLink "Object/entityType:property"}}{{/crossLink}} is assigned a value.

         @property visibleEntities
         @final
         @type {{String:Object}}
         */
        this.visibleEntities = {};

        /**
         Ghosted entity {{#crossLink "Object"}}Objects{{/crossLink}} within this Scene, mapped to their IDs.

         Each Object is registered in this map when its {{#crossLink "Object/ghosted:property"}}{{/crossLink}} property is true and its
         {{#crossLink "Object/entityType:property"}}{{/crossLink}} is assigned a value.

         @property ghostedEntities
         @final
         @type {{String:Object}}
         */
        this.ghostedEntities = {};

        /**
         Highlighted entity {{#crossLink "Object"}}Objects{{/crossLink}} within this Scene, mapped to their IDs.

         Each Object is registered in this map when its {{#crossLink "Object/highlighted:property"}}{{/crossLink}} property is true and its
         {{#crossLink "Object/entityType:property"}}{{/crossLink}} is assigned a value.

         @property highlightedEntities
         @final
         @type {{String:Object}}
         */
        this.highlightedEntities = {};

        /**
         Selected entity {{#crossLink "Object"}}Objects{{/crossLink}} within this Scene, mapped to their IDs.

         Each Object is registered in this map when its {{#crossLink "Object/selected:property"}}{{/crossLink}} property is true and its
         {{#crossLink "Object/entityType:property"}}{{/crossLink}} is assigned a value.

         @property selectedEntities
         @final
         @type {{String:Object}}
         */
        this.selectedEntities = {};

        // Cached ID arrays, lazy-rebuilt as needed when stale after map updates

        /**
         Lazy-regenerated ID lists.
         */
        this._objectGUIDs = null;
        this._entityIds = null;
        this._visibleEntityIds = null;
        this._ghostedEntityIds = null;
        this._highlightedEntityIds = null;
        this._selectedEntityIds = null;

        /**
         The {{#crossLink "Mesh"}}Meshes{{/crossLink}} in this Scene, mapped to their IDs.

         @property meshes
         @final
         @type {String:xeogl.Mesh}
         */
        this.meshes = {};

        this._needRecompileMeshes = false;

        /**
         For each {{#crossLink "Component"}}{{/crossLink}} type, a map of
         IDs to {{#crossLink "Component"}}Components{{/crossLink}} instances of that type.

         @property types
         @final
         @type {String:{String:xeogl.Component}}
         */
        this.types = {};

        /**
         The {{#crossLink "Component"}}Component{{/crossLink}} within this Scene, mapped to their IDs.

         @property components
         @final
         @type {String:xeogl.Component}
         */
        this.components = {};

        /**
         The root {{#crossLink "Object"}}Objects{{/crossLink}} in this Scene, mapped to their IDs.

         @property rootObjects
         @final
         @type {{String:Object}}
         */
        this.rootObjects = {};

        /**
         The {{#crossLink "Clip"}}Clip{{/crossLink}} components in this Scene, mapped to their IDs.

         @property clips
         @final
         @type {{String:Clip}}
         */
        this.clips = {};

        /**
         The {{#crossLink "PointLight"}}{{/crossLink}}, {{#crossLink "DirLight"}}{{/crossLink}},
         {{#crossLink "SpotLight"}}{{/crossLink}} and {{#crossLink "AmbientLight"}}{{/crossLink}} components in this Scene, mapped to their IDs.

         @property lights
         @final
         @type {{String:Object}}
         */
        this.lights = {};

        /**
         The {{#crossLink "LightMap"}}{{/crossLink}} components in this Scene, mapped to their IDs.

         @property lightMaps
         @final
         @type {{String:LightMap}}
         */
        this.lightMaps = {};

        /**
         The {{#crossLink "ReflectionMap"}}{{/crossLink}} components in this Scene, mapped to their IDs.

         @property reflectionMaps
         @final
         @type {{String:ReflectionMap}}
         */
        this.reflectionMaps = {};

        /**
         Manages the HTML5 canvas for this Scene.
         @final
         @property canvas
         @type {Canvas}
         */
        this.canvas = new Canvas(this, {
            dontClear: true, // Never destroy this component with Scene#clear();
            canvas: cfg.canvas, // Can be canvas ID, canvas element, or null
            transparent: transparent,
            backgroundColor: cfg.backgroundColor,
            backgroundImage: cfg.backgroundImage,
            webgl2: cfg.webgl2 !== false,
            contextAttr: cfg.contextAttr || {},
            simulateWebGLContextLost: cfg.simulateWebGLContextLost
        });

        // Redraw as canvas resized
        this.canvas.on("boundary", function () {
            self._renderer.imageDirty();
        });

        this.canvas.on("webglContextFailed", function () {
            alert("xeogl failed to find WebGL!");
        });

        this._renderer = new Renderer(this, {
            transparent: transparent
        });

        this._clipsState = new (function () {

            this.clips = [];

            let hash = null;

            this.getHash = function () {
                if (hash) {
                    return hash;
                }
                const clips = this.clips;
                if (clips.length === 0) {
                    return this.hash = ";";
                }
                let clip;
                const hashParts = [];
                for (let i = 0, len = clips.length; i < len; i++) {
                    clip = clips[i];
                    hashParts.push("cp");
                }
                hashParts.push(";");
                hash = hashParts.join("");
                return hash;
            };

            this.addClip = function (clip) {
                this.clips.push(clip);
                hash = null;
            };

            this.removeClip = function (clip) {
                for (let i = 0, len = this.clips.length; i < len; i++) {
                    if (this.clips[i].id === clip.id) {
                        this.clips.splice(i, 1);
                        hash = null;
                        return;
                    }
                }
            };
        })();

        this._lightsState = new (function () {

            const DEFAULT_AMBIENT = math.vec3([0, 0, 0]);
            const ambientColor = math.vec3();

            this.lights = [];
            this.reflectionMaps = [];
            this.lightMaps = [];

            let hash = null;
            let ambientLight = null;

            this.getHash = function () {
                if (hash) {
                    return hash;
                }
                const hashParts = [];
                const lights = this.lights;
                let light;
                for (let i = 0, len = lights.length; i < len; i++) {
                    light = lights[i];
                    hashParts.push("/");
                    hashParts.push(light.type);
                    hashParts.push((light.space === "world") ? "w" : "v");
                    if (light.shadow) {
                        hashParts.push("sh");
                    }
                }
                if (this.lightMaps.length > 0) {
                    hashParts.push("/lm");
                }
                if (this.reflectionMaps.length > 0) {
                    hashParts.push("/rm");
                }
                hashParts.push(";");
                hash = hashParts.join("");
                return hash;
            };

            this.addLight = function (state) {
                this.lights.push(state);
                ambientLight = null;
                hash = null;
            };

            this.removeLight = function (state) {
                for (let i = 0, len = this.lights.length; i < len; i++) {
                    const light = this.lights[i];
                    if (light.id === state.id) {
                        this.lights.splice(i, 1);
                        if (ambientLight && ambientLight.id === state.id) {
                            ambientLight = null;
                        }
                        hash = null;
                        return;
                    }
                }
            };

            this.addReflectionMap = function (state) {
                this.reflectionMaps.push(state);
                hash = null;
            };

            this.removeReflectionMap = function (state) {
                for (let i = 0, len = this.reflectionMaps.length; i < len; i++) {
                    if (this.reflectionMaps[i].id === state.id) {
                        this.reflectionMaps.splice(i, 1);
                        hash = null;
                        return;
                    }
                }
            };

            this.addLightMap = function (state) {
                this.lightMaps.push(state);
                hash = null;
            };

            this.removeLightMap = function (state) {
                for (let i = 0, len = this.lightMaps.length; i < len; i++) {
                    if (this.lightMaps[i].id === state.id) {
                        this.lightMaps.splice(i, 1);
                        hash = null;
                        return;
                    }
                }
            };

            this.getAmbientColor = function () {
                if (!ambientLight) {
                    for (let i = 0, len = this.lights.length; i < len; i++) {
                        const light = this.lights[i];
                        if (light.type === "ambient") {
                            ambientLight = light;
                            break;
                        }
                    }
                }
                if (ambientLight) {
                    const color = ambientLight.color;
                    const intensity = ambientLight.intensity;
                    ambientColor[0] = color[0] * intensity;
                    ambientColor[1] = color[1] * intensity;
                    ambientColor[2] = color[2] * intensity;
                    return ambientColor;
                } else {
                    return DEFAULT_AMBIENT;
                }
            };

        })();

        /**
         Publishes input events that occur on this Scene's canvas.

         @final
         @property input
         @type {Input}
         @final
         */
        this.input = new Input(this, {
            dontClear: true, // Never destroy this component with Scene#clear();
            element: this.canvas.canvas
        });

        // Register Scene on xeogl
        // Do this BEFORE we add components below
        core._addScene(this);

        // Add components specified as JSON

        const componentJSONs = cfg.components;

        if (componentJSONs) {
            let componentJSON;
            let type;
            let constr;
            for (let i = 0, len = componentJSONs.length; i < len; i++) {
                componentJSON = componentJSONs[i];
                type = componentJSON.type;
                if (type) {
                    constr = window[type];
                    if (constr) {
                        new constr(this, componentJSON);
                    }
                }
            }
        }

        // Init default components

        this._initDefaults();

        // Global components

        this._viewport = new Viewport(this, {
            id: "default.viewport",
            autoBoundary: true,
            dontClear: true // Never destroy this component with Scene#clear();
        });

        this._camera = new Camera(this, {
            id: "default.camera",
            dontClear: true // Never destroy this component with Scene#clear();
        });

        // Default lights

        new DirLight(this, {
            dir: [0.8, -0.6, -0.8],
            color: [1.0, 1.0, 1.0],
            intensity: 1.0,
            space: "view"
        });

        new DirLight(this, {
            dir: [-0.8, -0.4, -0.4],
            color: [1.0, 1.0, 1.0],
            intensity: 1.0,
            space: "view"
        });

        new DirLight(this, {
            dir: [0.2, -0.8, 0.8],
            color: [0.6, 0.6, 0.6],
            intensity: 1.0,
            space: "view"
        });

        // Plug global components into renderer

        const viewport = this._viewport;
        const renderer = this._renderer;
        const camera = this._camera;

        camera.on("dirty", function () {
            renderer.imageDirty();
        });

        this.ticksPerRender = cfg.ticksPerRender;
        this.passes = cfg.passes;
        this.clearEachPass = cfg.clearEachPass;
        this.gammaInput = cfg.gammaInput;
        this.gammaOutput = cfg.gammaOutput;
        this.gammaFactor = cfg.gammaFactor;
    }

    _initDefaults() {

        // Call this Scene's property accessors to lazy-init their properties

        let dummy; // Keeps Codacy happy

        dummy = this.geometry;
        dummy = this.material;
        dummy = this.ghostMaterial;
        dummy = this.outlineMaterial;
    }

    _addComponent(component) {
        if (component.id) { // Manual ID
            if (this.components[component.id]) {
                // this.error("Component " + utils.inQuotes(component.id) + " already exists in Scene - ignoring ID, will randomly-generate instead");
                // component.id = null;
                const intitialComponentID = component.id;
                while (this.components[component.id]) {
                    component.id = intitialComponentID + '?|?' + math.createUUID();
                }
            }
        }
        if (!component.id) { // Auto ID
            if (window.nextID === undefined) {
                window.nextID = 0;
            }
            //component.id = math.createUUID();
            component.id = "_" + window.nextID++;
            while (this.components[component.id]) {
                component.id = math.createUUID();
            }
        }
        this.components[component.id] = component;
        // Register for class type
        const type = component.type;
        let types = this.types[component.type];
        if (!types) {
            types = this.types[type] = {};
        }
        types[component.id] = component;
    }

    _removeComponent(component) {
        delete this.components[component.id];
        const types = this.types[component.type];
        if (types) {
            delete types[component.id];
            if (utils.isEmptyObject(types)) {
                delete this.types[component.type];
            }
        }
    }

    // Methods below are called by various component types to register themselves on their
    // Scene. Violates Hollywood Principle, where we could just filter on type in _addComponent,
    // but this is faster than checking the type of each component in such a filter.

    _clipCreated(clip) {
        this.clips[clip.id] = clip;
        this.scene._clipsState.addClip(clip._state);
        this._needRecompileMeshes = true;
    }

    _lightCreated(light) {
        this.lights[light.id] = light;
        this.scene._lightsState.addLight(light._state);
        this._needRecompileMeshes = true;
    }

    _lightMapCreated(lightMap) {
        this.lightMaps[lightMap.id] = lightMap;
        this.scene._lightsState.addLightMap(lightMap._state);
        this._needRecompileMeshes = true;
    }

    _reflectionMapCreated(reflectionMap) {
        this.reflectionMaps[reflectionMap.id] = reflectionMap;
        this.scene._lightsState.addReflectionMap(reflectionMap._state);
        this._needRecompileMeshes = true;
    }

    _objectCreated(object) {
        this.objects[object.id] = object;
        if (object.guid) {
            this.guidObjects[object.id] = object;
            this._objectGUIDs = null; // To lazy-rebuild
        }
        if (!object.parent) {
            this.rootObjects[object.id] = object; // TODO: What about when a root Object is added as child to another?
        }
        stats.components.objects++;
    }

    _meshCreated(mesh) {
        this.meshes[mesh.id] = mesh;
        stats.components.meshes++;
    }

    _modelCreated(model) {
        this.models[model.id] = model;
        stats.components.models++;
    }

    _clipDestroyed(clip) {
        delete this.clips[clip.id];
        this.scene._clipsState.removeClip(clip._state);
        this._needRecompileMeshes = true;
    }

    _lightDestroyed(light) {
        delete this.lights[light.id];
        this.scene._lightsState.removeLight(light._state);
        this._needRecompileMeshes = true;
    }

    _lightMapDestroyed(lightMap) {
        delete this.lightMaps[lightMap.id];
        this.scene._lightsState.removeLightMap(lightMap._state);
        this._needRecompileMeshes = true;
    }

    _reflectionMapDestroyed(reflectionMap) {
        delete this.reflectionMaps[reflectionMap.id];
        this.scene._lightsState.removeReflectionMap(reflectionMap._state);
        this._needRecompileMeshes = true;
    }

    _objectDestroyed(object) {
        delete this.objects[object.id];
        if (object.guid) {
            delete this.guidObjects[object.guid];
            this._objectGUIDs = null; // To lazy-rebuild
        }
        if (!object.parent) {
            delete this.rootObjects[object.id];
        }
        stats.components.objects--;
    }

    _meshDestroyed(mesh) {
        stats.components.meshes--;
        delete this.meshes[mesh.id];
        stats.components.meshes--;
    }

    _modelDestroyed(model) {
        this.models[model.id] = model;
        stats.components.models++;
    }

    _entityTypeAssigned(object, newEntityType) {
        this.entities[object.id] = object;
        let objectsOfType = this.entityTypes[newEntityType];
        if (!objectsOfType) {
            objectsOfType = {};
            this.entityTypes[newEntityType] = objectsOfType;
        }
        objectsOfType[object.id] = object;
        this._entityIds = null; // Lazy regenerate
        this._entityTypeIds = null; // Lazy regenerate
    }

    _entityTypeRemoved(object, oldEntityType) {
        delete this.entities[object.id];
        const objectsOfType = this.entityTypes[oldEntityType];
        if (objectsOfType) {
            delete objectsOfType[object.id];
        }
        this._entityIds = null; // Lazy regenerate
        this._entityTypeIds = null; // Lazy regenerate
    }

    _entityVisibilityUpdated(object, visible) {
        if (visible) {
            this.visibleEntities[object.id] = object;
        } else {
            delete this.visibleEntities[object.id];
        }
        this._visibleEntityIds = null; // Lazy regenerate
    }

    _entityGhostedUpdated(object, ghosted) {
        if (ghosted) {
            this.ghostedEntities[object.id] = object;
        } else {
            delete this.ghostedEntities[object.id];
        }
        this._ghostedEntityIds = null; // Lazy regenerate
    }

    _entityHighlightedUpdated(object, highlighted) {
        if (highlighted) {
            this.highlightedEntities[object.id] = object;
        } else {
            delete this.highlightedEntities[object.id];
        }
        this._highlightedEntityIds = null; // Lazy regenerate
    }

    _entitySelectedUpdated(object, selected) {
        if (selected) {
            this.selectedEntities[object.id] = object;
        } else {
            delete this.selectedEntities[object.id];
        }
        this._selectedEntityIds = null; // Lazy regenerate
    }

    _webglContextLost() {
        //  this.loading++;
        this.canvas.spinner.processes++;
        for (const id in this.components) {
            if (this.components.hasOwnProperty(id)) {
                const component = this.components[id];
                if (component._webglContextLost) {
                    component._webglContextLost();
                }
            }
        }
        this._renderer.webglContextLost();
    }

    _webglContextRestored() {
        const gl = this.canvas.gl;
        for (const id in this.components) {
            if (this.components.hasOwnProperty(id)) {
                const component = this.components[id];
                if (component._webglContextRestored) {
                    component._webglContextRestored(gl);
                }
            }
        }
        this._renderer.webglContextRestored(gl);
        //this.loading--;
        this.canvas.spinner.processes--;
    }

    /**
     * Renders a single frame of this Scene.
     *
     * The Scene will periodically render itself after any updates, but you can call this method to force a render
     * if required. This method is typically used when we want to synchronously take a snapshot of the canvas and
     * need everything rendered right at that moment.
     *
     * @method render
     * @param {Boolean} [forceRender=false] Forces a render when true, otherwise only renders if something has changed in this Scene
     * since the last render.
     */
    render(forceRender) {

        const renderEvent = {
            sceneId: null,
            pass: 0
        };


        if (this._needRecompileMeshes) {
            this._recompileMeshes();
            this._needRecompileMeshes = false;
        }

        if (this.loading > 0 || this.canvas.spinner.processes > 0) {
            this.canvas.canvas.style.opacity = 0.0;
            return;
        }

        let opacity = Number.parseFloat(this.canvas.canvas.style.opacity);
        if (opacity < 1.0) {
            opacity += 0.1;
            this.canvas.canvas.style.opacity = opacity;
        }

        renderEvent.sceneId = this.id;

        const passes = this._passes;
        const clearEachPass = this._clearEachPass;
        let pass;
        let clear;

        for (pass = 0; pass < passes; pass++) {

            renderEvent.pass = pass;

            /**
             * Fired when about to render a frame for a Scene.
             *
             * @event rendering
             * @param {String} sceneID The ID of this Scene.
             * @param {Number} pass Index of the pass we are about to render (see {{#crossLink "Scene/passes:property"}}{{/crossLink}}).
             */
            this.fire("rendering", renderEvent, true);

            clear = clearEachPass || (pass === 0);

            this._renderer.render({pass: pass, clear: clear, force: forceRender});

            /**
             * Fired when we have just rendered a frame for a Scene.
             *
             * @event rendering
             * @param {String} sceneID The ID of this Scene.
             * @param {Number} pass Index of the pass we rendered (see {{#crossLink "Scene/passes:property"}}{{/crossLink}}).
             */
            this.fire("rendered", renderEvent, true);
        }

        this._saveAmbientColor();
    }

    _recompileMeshes() {
        for (const id in this.meshes) {
            if (this.meshes.hasOwnProperty(id)) {
                this.meshes[id]._compile();
            }
        }
    }

    _saveAmbientColor() {
        const canvas = this.canvas;
        if (!canvas.transparent && !canvas.backgroundImage && !canvas.backgroundColor) {
            const ambientColor = this._lightsState.getAmbientColor();
            if (!this._lastAmbientColor ||
                this._lastAmbientColor[0] !== ambientColor[0] ||
                this._lastAmbientColor[1] !== ambientColor[1] ||
                this._lastAmbientColor[2] !== ambientColor[2] ||
                this._lastAmbientColor[3] !== ambientColor[3]) {
                canvas.backgroundColor = ambientColor;
                if (!this._lastAmbientColor) {
                    this._lastAmbientColor = math.vec4([0, 0, 0, 1]);
                }
                this._lastAmbientColor.set(ambientColor);
            }
        } else {
            this._lastAmbientColor = null;
        }
    }

    /**
     Convenience array of entity type IDs in {{#crossLink "Scene/entityTypes:property"}}{{/crossLink}}.
     @property entityTypeIds
     @final
     @type {Array of String}
     */
    get objectGUIDs() {
        if (!this._objectGUIDs) {
            this._objectGUIDs = Object.keys(this.guidObjects);
        }
        return this._objectGUIDs;
    }

    /**
     Convenience array of entity type IDs in {{#crossLink "Scene/entityTypes:property"}}{{/crossLink}}.
     @property entityTypeIds
     @final
     @type {Array of String}
     */
    get entityTypeIds() {
        if (!this._entityTypeIds) {
            this._entityTypeIds = Object.keys(this.entityTypes);
        }
        return this._entityTypeIds;
    }

    /**
     Convenience array of IDs in {{#crossLink "Scene/entities:property"}}{{/crossLink}}.
     @property entityIds
     @final
     @type {Array of String}
     */
    get entityIds() {
        if (!this._entityIds) {
            this._entityIds = Object.keys(this.entities);
        }
        return this._entityIds;
    }

    /**
     Convenience array of IDs in {{#crossLink "Scene/visibleEntities:property"}}{{/crossLink}}.
     @property visibleEntityIds
     @final
     @type {Array of String}
     */
    get visibleEntityIds() {
        if (!this._visibleEntityIds) {
            this._visibleEntityIds = Object.keys(this.visibleEntities);
        }
        return this._visibleEntityIds;
    }

    /**
     Convenience array of IDs in {{#crossLink "Scene/ghostedEntities:property"}}{{/crossLink}}.
     @property ghostedEntityIds
     @final
     @type {Array of String}
     */
    get ghostedEntityIds() {
        if (!this._ghostedEntityIds) {
            this._ghostedEntityIds = Object.keys(this.ghostedEntities);
        }
        return this._ghostedEntityIds;
    }

    /**
     Convenience array of IDs in {{#crossLink "Scene/highlightedEntities:property"}}{{/crossLink}}.
     @property highlightedEntityIds
     @final
     @type {Array of String}
     */
    get highlightedEntityIds() {
        if (!this._highlightedEntityIds) {
            this._highlightedEntityIds = Object.keys(this.highlightedEntities);
        }
        return this._highlightedEntityIds;
    }

    /**
     Convenience array of IDs in {{#crossLink "Scene/selectedEntities:property"}}{{/crossLink}}.
     @property selectedEntityIds
     @final
     @type {Array of String}
     */
    get selectedEntityIds() {
        if (!this._selectedEntityIds) {
            this._selectedEntityIds = Object.keys(this.selectedEntities);
        }
        return this._selectedEntityIds;
    }

    /**
     The number of {{#crossLink "Scene/tick:property"}}{{/crossLink}} that happen between each render or this Scene.

     @property ticksPerRender
     @default 1
     @type Number
     */
    set ticksPerRender(value) {
        if (value === undefined || value === null) {
            value = 1;
        } else if (!utils.isNumeric(value) || value <= 0) {
            this.error("Unsupported value for 'ticksPerRender': '" + value +
                "' - should be an integer greater than zero.");
            value = 1;
        }
        if (value === this._ticksPerRender) {
            return;
        }
        this._ticksPerRender = value;
    }

    get ticksPerRender() {
        return this._ticksPerRender;
    }

    /**
     The number of times this Scene renders per frame.

     @property passes
     @default 1
     @type Number
     */
    set passes(value) {
        if (value === undefined || value === null) {
            value = 1;
        } else if (!utils.isNumeric(value) || value <= 0) {
            this.error("Unsupported value for 'passes': '" + value +
                "' - should be an integer greater than zero.");
            value = 1;
        }
        if (value === this._passes) {
            return;
        }
        this._passes = value;
        this._renderer.imageDirty();
    }

    get passes() {
        return this._passes;
    }

    /**
     When doing multiple passes per frame, specifies whether to clear the
     canvas before each pass (true) or just before the first pass (false).

     @property clearEachPass
     @default false
     @type Boolean
     */
    set clearEachPass(value) {
        value = !!value;
        if (value === this._clearEachPass) {
            return;
        }
        this._clearEachPass = value;
        this._renderer.imageDirty();
    }

    get clearEachPass() {
        return this._clearEachPass;
    }

    /**
     When true, expects all textures and colors are premultiplied gamma.

     @property gammaInput
     @default false
     @type Boolean
     */
    set gammaInput(value) {
        value = value !== false;
        if (value === this._renderer.gammaInput) {
            return;
        }
        this._renderer.gammaInput = value;
        this._needRecompileMeshes = true;
    }

    get gammaInput() {
        return this._renderer.gammaInput;
    }

    /**
     Whether or not to render pixels with pre-multiplied gama.

     @property gammaOutput
     @default true
     @type Boolean
     */
    set gammaOutput(value) {
        value = value !== false;
        if (value === this._renderer.gammaOutput) {
            return;
        }
        this._renderer.gammaOutput = value;
        this._needRecompileMeshes = true;
    }

    get gammaOutput() {
        return this._renderer.gammaOutput;
    }

    /**
     The gamma factor to use when {{#crossLink "Scene/property:gammaOutput"}}{{/crossLink}} is set true.

     @property gammaOutput
     @default 1.0
     @type Number
     */
    set gammaFactor(value) {
        value = (value === undefined || value === null) ? 2.2 : value;
        if (value === this._renderer.gammaFactor) {
            return;
        }
        this._renderer.gammaFactor = value;
        this._renderer.imageDirty();
    }

    get gammaFactor() {
        return this._renderer.gammaFactor;
    }

    /**
     The default geometry for this Scene, which is a {{#crossLink "BoxGeometry"}}BoxGeometry{{/crossLink}}.

     This {{#crossLink "BoxGeometry"}}BoxGeometry{{/crossLink}} has an {{#crossLink "Component/id:property"}}id{{/crossLink}} equal to "default.geometry".

     {{#crossLink "Mesh"}}Meshes{{/crossLink}} in this Scene are attached to this
     {{#crossLink "Geometry"}}Geometry{{/crossLink}} by default.
     @property geometry
     @final
     @type BoxGeometry
     */
    get geometry() {
        return this.components["default.geometry"] ||
            new BoxGeometry(this, {
                id: "default.geometry",
                dontClear: true
            });
    }

    /**
     The default drawing material for this Scene, which is a {{#crossLink "PhongMaterial"}}PhongMaterial{{/crossLink}}.

     This {{#crossLink "PhongMaterial"}}PhongMaterial{{/crossLink}} has
     an {{#crossLink "Component/id:property"}}id{{/crossLink}} equal to "default.material", with all
     other properties initialised to their default values.

     {{#crossLink "Mesh"}}Meshes{{/crossLink}} in this Scene are attached to this
     {{#crossLink "PhongMaterial"}}PhongMaterial{{/crossLink}} by default.
     @property material
     @final
     @type PhongMaterial
     */
    get material() {
        return this.components["default.material"] || new PhongMaterial(this, {
                id: "default.material",
                emissive: [0.4, 0.4, 0.4], // Visible by default on geometry without normals
                dontClear: true
            });
    }

    /**
     The Scene's default {{#crossLink "EmphasisMaterial"}}EmphasisMaterial{{/crossLink}} for the appearance of {{#crossLink "Meshes"}}Meshes{{/crossLink}} when they are ghosted.

     This {{#crossLink "EmphasisMaterial"}}EmphasisMaterial{{/crossLink}} has
     an {{#crossLink "Component/id:property"}}id{{/crossLink}} equal to "default.ghostMaterial", with all
     other properties initialised to their default values.

     {{#crossLink "Mesh"}}Meshes{{/crossLink}} in this Scene are attached to this
     {{#crossLink "EmphasisMaterial"}}EmphasisMaterial{{/crossLink}} by default.
     @property ghostMaterial
     @final
     @type EmphasisMaterial
     */
    get ghostMaterial() {
        return this.components["default.ghostMaterial"] || new EmphasisMaterial(this, {
                id: "default.ghostMaterial",
                preset: "sepia",
                dontClear: true
            });
    }

    /**
     The Scene's default {{#crossLink "EmphasisMaterial"}}EmphasisMaterial{{/crossLink}} for the appearance of {{#crossLink "Meshes"}}Meshes{{/crossLink}} when they are highlighted.

     This {{#crossLink "HighlightMaterial"}}HighlightMaterial{{/crossLink}} has
     an {{#crossLink "Component/id:property"}}id{{/crossLink}} equal to "default.highlightMaterial", with all
     other properties initialised to their default values.

     {{#crossLink "Mesh"}}Meshes{{/crossLink}} in this Scene are attached to this
     {{#crossLink "HighlightMaterial"}}HighlightMaterial{{/crossLink}} by default.
     @property highlightMaterial
     @final
     @type HighlightMaterial
     */
    get highlightMaterial() {
        return this.components["default.highlightMaterial"] || new EmphasisMaterial(this, {
                id: "default.highlightMaterial",
                preset: "yellowHighlight",
                dontClear: true
            });
    }

    /**
     The Scene's default {{#crossLink "EmphasisMaterial"}}EmphasisMaterial{{/crossLink}} for the appearance of {{#crossLink "Meshes"}}Meshes{{/crossLink}} when they are selected.

     This {{#crossLink "SelectedMaterial"}}SelectedMaterial{{/crossLink}} has
     an {{#crossLink "Component/id:property"}}id{{/crossLink}} equal to "default.selectedMaterial", with all
     other properties initialised to their default values.

     {{#crossLink "Mesh"}}Meshes{{/crossLink}} in this Scene are attached to this
     {{#crossLink "SelectedMaterial"}}SelectedMaterial{{/crossLink}} by default.
     @property selectedMaterial
     @final
     @type SelectedMaterial
     */
    get selectedMaterial() {
        return this.components["default.selectedMaterial"] || new EmphasisMaterial(this, {
                id: "default.selectedMaterial",
                preset: "greenSelected",
                dontClear: true
            });
    }

    /**
     The Scene's default {{#crossLink "EdgeMaterial"}}EmphasisMaterial{{/crossLink}} for the appearance of {{#crossLink "Meshes"}}Meshes{{/crossLink}} when edges are emphasized.

     This {{#crossLink "EdgeMaterial"}}EdgeMaterial{{/crossLink}} has
     an {{#crossLink "Component/id:property"}}id{{/crossLink}} equal to "default.edgeMaterial", with all
     other properties initialised to their default values.

     {{#crossLink "Mesh"}}Meshes{{/crossLink}} in this Scene are attached to this
     {{#crossLink "EdgeMaterial"}}EdgeMaterial{{/crossLink}} by default.
     @property edgeMaterial
     @final
     @type EdgeMaterial
     */
    get edgeMaterial() {
        return this.components["default.edgeMaterial"] || new EdgeMaterial(this, {
                id: "default.edgeMaterial",
                preset: "default",
                edgeColor: [0.0, 0.0, 0.0],
                edgeAlpha: 1.0,
                edgeWidth: 1,
                dontClear: true
            });
    }

    /**
     The Scene's default {{#crossLink "OutlineMaterial"}}OutlineMaterial{{/crossLink}} for the appearance of {{#crossLink "Meshes"}}Meshes{{/crossLink}} when they are outlined.

     This {{#crossLink "OutlineMaterial"}}OutlineMaterial{{/crossLink}} has
     an {{#crossLink "Component/id:property"}}id{{/crossLink}} equal to "default.outlineMaterial", with all
     other properties initialised to their default values.

     {{#crossLink "Mesh"}}Meshes{{/crossLink}} in this Scene are attached to this
     {{#crossLink "OutlineMaterial"}}OutlineMaterial{{/crossLink}} by default.
     @property outlineMaterial
     @final
     @type OutlineMaterial
     */
    get outlineMaterial() {
        return this.components["default.outlineMaterial"] || new OutlineMaterial(this, {
                id: "default.outlineMaterial",
                dontClear: true
            });
    }

    /**
     The {{#crossLink "Viewport"}}{{/crossLink}} belonging to this Scene.

     @property viewport
     @final
     @type Viewport
     */
    get viewport() {
        return this._viewport;
    }

    /**
     The {{#crossLink "Camera"}}Camera{{/crossLink}} belonging to this Scene.

     @property camera
     @final
     @type Camera
     */
    get camera() {
        return this._camera;
    }

    /**
     World-space 3D center of this Scene.

     @property center
     @final
     @type {Float32Array}
     */
    get center() {
        if (this._aabbDirty || !this._center) {
            if (!this._center || !this._center) {
                this._center = math.vec3();
            }
            const aabb = this.aabb;
            this._center[0] = (aabb[0] + aabb[3] ) / 2;
            this._center[1] = (aabb[1] + aabb[4] ) / 2;
            this._center[2] = (aabb[2] + aabb[5] ) / 2;
        }
        return this._center;
    }

    /**
     World-space axis-aligned 3D boundary (AABB) of this Scene.

     The AABB is represented by a six-element Float32Array containing the min/max extents of the
     axis-aligned volume, ie. ````[xmin, ymin,zmin,xmax,ymax, zmax]````.

     @property aabb
     @final
     @type {Float32Array}
     */
    get aabb() {
        if (this._aabbDirty) {
            if (!this._aabb) {
                this._aabb = math.AABB3();
            }
            let xmin = math.MAX_DOUBLE;
            let ymin = math.MAX_DOUBLE;
            let zmin = math.MAX_DOUBLE;
            let xmax = -math.MAX_DOUBLE;
            let ymax = -math.MAX_DOUBLE;
            let zmax = -math.MAX_DOUBLE;
            let aabb;
            const meshes = this.meshes;
            let mesh;
            for (const meshId in meshes) {
                if (meshes.hasOwnProperty(meshId)) {
                    mesh = meshes[meshId];
                    if (!mesh.collidable) {
                        continue;
                    }
                    aabb = mesh.aabb;
                    if (aabb[0] < xmin) {
                        xmin = aabb[0];
                    }
                    if (aabb[1] < ymin) {
                        ymin = aabb[1];
                    }
                    if (aabb[2] < zmin) {
                        zmin = aabb[2];
                    }
                    if (aabb[3] > xmax) {
                        xmax = aabb[3];
                    }
                    if (aabb[4] > ymax) {
                        ymax = aabb[4];
                    }
                    if (aabb[5] > zmax) {
                        zmax = aabb[5];
                    }
                }
            }
            this._aabb[0] = xmin;
            this._aabb[1] = ymin;
            this._aabb[2] = zmin;
            this._aabb[3] = xmax;
            this._aabb[4] = ymax;
            this._aabb[5] = zmax;
            this._aabbDirty = false;
        }
        return this._aabb;
    }

    _setBoundaryDirty() {
        //if (!this._aabbDirty) {
        this._aabbDirty = true;
        this.fire("boundary");
        // }
    }

    /**
     Attempts to pick an {{#crossLink "Mesh"}}Mesh{{/crossLink}} in this Scene.

     Ignores {{#crossLink "Mesh"}}Meshes{{/crossLink}} with {{#crossLink "Mesh/pickable:property"}}pickable{{/crossLink}}
     set *false*.

     When a {{#crossLink "Mesh"}}{{/crossLink}} is picked, fires a "pick" event on the {{#crossLink "Mesh"}}{{/crossLink}}
     with the hit result as parameters.

     Picking the {{#crossLink "Mesh"}}{{/crossLink}} at the given canvas coordinates:

     ````javascript
     var hit = scene.pick({
              canvasPos: [23, 131]
           });

     if (hit) { // Picked a Mesh
              var mesh = hit.mesh;
          }
     ````

     **Usage:**

     Picking the {{#crossLink "Mesh"}}{{/crossLink}} that intersects a ray cast through the canvas:

     ````javascript
     var hit = scene.pick({
              pickSurface: true,
              canvasPos: [23, 131]
           });

     if (hit) { // Picked a Mesh

              var mesh = hit.mesh;

              // These properties are only on the hit result when we do a ray-pick:

              var primitive = hit.primitive; // Type of primitive that was picked, usually "triangles"
              var primIndex = hit.primIndex; // Position of triangle's first index in the picked Mesh's Geometry's indices array
              var indices = hit.indices; // UInt32Array containing the triangle's vertex indices
              var localPos = hit.localPos; // Float32Array containing the picked Local-space position on the triangle
              var worldPos = hit.worldPos; // Float32Array containing the picked World-space position on the triangle
              var viewPos = hit.viewPos; // Float32Array containing the picked View-space position on the triangle
              var bary = hit.bary; // Float32Array containing the picked barycentric position within the triangle
              var normal = hit.normal; // Float32Array containing the interpolated normal vector at the picked position on the triangle
              var uv = hit.uv; // Float32Array containing the interpolated UV coordinates at the picked position on the triangle
          }
     ````

     Picking the {{#crossLink "Mesh"}}{{/crossLink}} that intersects an arbitrarily-aligned World-space ray:

     ````javascript
     var hit = scene.pick({
              pickSurface: true,       // Picking with arbitrarily-positioned ray
              origin: [0,0,-5],    // Ray origin
              direction: [0,0,1]   // Ray direction
          });

     if (hit) { // Picked a Mesh with the ray

              var mesh = hit.mesh;

              var primitive = hit.primitive; // Type of primitive that was picked, usually "triangles"
              var primIndex = hit.primIndex; // Position of triangle's first index in the picked Mesh's Geometry's indices array
              var indices = hit.indices; // UInt32Array containing the triangle's vertex indices
              var localPos = hit.localPos; // Float32Array containing the picked Local-space position on the triangle
              var worldPos = hit.worldPos; // Float32Array containing the picked World-space position on the triangle
              var viewPos = hit.viewPos; // Float32Array containing the picked View-space position on the triangle
              var bary = hit.bary; // Float32Array containing the picked barycentric position within the triangle
              var normal = hit.normal; // Float32Array containing the interpolated normal vector at the picked position on the triangle
              var uv = hit.uv; // Float32Array containing the interpolated UV coordinates at the picked position on the triangle
              var origin = hit.origin; // Float32Array containing the World-space ray origin
              var direction = hit.direction; // Float32Array containing the World-space ray direction
          }
     ````
     @method pick

     @param {*} params Picking parameters.
     @param {Boolean} [params.pickSurface=false] Whether to find the picked position on the surface of the Mesh.
     @param {Float32Array} [params.canvasPos] Canvas-space coordinates. When ray-picking, this will override the
     **origin** and ** direction** parameters and will cause the ray to be fired through the canvas at this position,
     directly along the negative View-space Z-axis.
     @param {Float32Array} [params.origin] World-space ray origin when ray-picking. Ignored when canvasPos given.
     @param {Float32Array} [params.direction] World-space ray direction when ray-picking. Also indicates the length of the ray. Ignored when canvasPos given.
     @param {Array} [params.includeMeshes] IDs of {{#crossLink "Mesh"}}Meshes{{/crossLink}} to restrict picking to. When given, ignores {{#crossLink "Mesh"}}Meshes{{/crossLink}} whose IDs are not in this list.
     @param {Array} [params.excludeMeshes] IDs of {{#crossLink "Mesh"}}Meshes{{/crossLink}} to ignore. When given, will pick *through* these {{#crossLink "Mesh"}}Meshes{{/crossLink}}, as if they were not there.
     @returns {*} Hit record, returned when an {{#crossLink "Mesh"}}{{/crossLink}} is picked, else null. See
     method comments for description.
     */
    pick(params) {

        if (this.canvas.boundary[2] === 0 || this.canvas.boundary[3] === 0) {
            this.error("Picking not allowed while canvas has zero width or height");
            return null;
        }

        params = params || {};

        params.pickSurface = params.pickSurface || params.rayPick; // Backwards compatibility

        if (!params.canvasPos && (!params.origin || !params.direction)) {
            this.warn("picking without canvasPos or ray origin and direction");
        }

        const includeMeshes = params.includeMeshes || params.include; // Backwards compat
        if (includeMeshes) {
            params.includeMeshIds = getMeshIDMap(this, includeMeshes);
        }

        const excludeMeshes = params.excludeMeshes || params.exclude; // Backwards compat
        if (excludeMeshes) {
            params.excludeMeshIds = getMeshIDMap(this, excludeMeshes);
        }

        // if (params.includeEntityTypes) {
        //     params.includeObjects = getMeshIDMapFromEntityTypes(this, params.includeEntityTypes);
        // }
        //
        // if (params.excludeEntityTypes) {
        //     params.excludeObjects = getMeshIDMapFromEntityTypes(this, params.excludeEntityTypes);
        // }

        const hit = this._renderer.pick(params);

        if (hit) {

            hit.object = hit.mesh; // Backwards compat

            if (params.pickSurface) {

                if (hit.primIndex !== undefined && hit.primIndex > -1) {

                    const geometry = hit.mesh.geometry._state;

                    if (geometry.primitiveName === "triangles") {

                        // Triangle picked; this only happens when the
                        // Mesh has a Geometry that has primitives of type "triangle"

                        hit.primitive = "triangle";

                        // Get the World-space positions of the triangle's vertices

                        const i = hit.primIndex; // Indicates the first triangle index in the indices array

                        const indices = geometry.indices; // Indices into geometry arrays, not into shared VertexBufs
                        const positions = geometry.positions;

                        let ia3;
                        let ib3;
                        let ic3;

                        if (indices) {

                            var ia = indices[i + 0];
                            var ib = indices[i + 1];
                            var ic = indices[i + 2];

                            triangleVertices[0] = ia;
                            triangleVertices[1] = ib;
                            triangleVertices[2] = ic;

                            hit.indices = triangleVertices;

                            ia3 = ia * 3;
                            ib3 = ib * 3;
                            ic3 = ic * 3;

                        } else {

                            ia3 = i * 3;
                            ib3 = ia3 + 3;
                            ic3 = ib3 + 3;
                        }

                        positionA[0] = positions[ia3 + 0];
                        positionA[1] = positions[ia3 + 1];
                        positionA[2] = positions[ia3 + 2];

                        positionB[0] = positions[ib3 + 0];
                        positionB[1] = positions[ib3 + 1];
                        positionB[2] = positions[ib3 + 2];

                        positionC[0] = positions[ic3 + 0];
                        positionC[1] = positions[ic3 + 1];
                        positionC[2] = positions[ic3 + 2];

                        if (geometry.quantized) {

                            // Decompress vertex positions

                            const positionsDecodeMatrix = geometry.positionsDecodeMatrix;
                            if (positionsDecodeMatrix) {
                                math.decompressPosition(positionA, positionsDecodeMatrix, positionA);
                                math.decompressPosition(positionB, positionsDecodeMatrix, positionB);
                                math.decompressPosition(positionC, positionsDecodeMatrix, positionC);
                            }
                        }

                        // Attempt to ray-pick the triangle in local space

                        let canvasPos;

                        if (params.canvasPos) {
                            canvasPos = params.canvasPos;
                            hit.canvasPos = params.canvasPos;
                            math.canvasPosToLocalRay(this.camera, hit.mesh, canvasPos, localRayOrigin, localRayDir);

                        } else if (params.origin && params.direction) {
                            math.worldRayToLocalRay(hit.mesh, params.origin, params.direction, localRayOrigin, localRayDir);
                        }

                        math.normalizeVec3(localRayDir);
                        math.rayPlaneIntersect(localRayOrigin, localRayDir, positionA, positionB, positionC, position);

                        // Get Local-space cartesian coordinates of the ray-triangle intersection

                        hit.localPos = position;
                        hit.position = position;

                        // Get interpolated World-space coordinates

                        // Need to transform homogeneous coords

                        tempVec4a[0] = position[0];
                        tempVec4a[1] = position[1];
                        tempVec4a[2] = position[2];
                        tempVec4a[3] = 1;

                        // Get World-space cartesian coordinates of the ray-triangle intersection

                        math.transformVec4(hit.mesh.worldMatrix, tempVec4a, tempVec4b);

                        worldPos[0] = tempVec4b[0];
                        worldPos[1] = tempVec4b[1];
                        worldPos[2] = tempVec4b[2];

                        hit.worldPos = worldPos;

                        // Get View-space cartesian coordinates of the ray-triangle intersection

                        math.transformVec4(hit.mesh.scene.camera.matrix, tempVec4b, tempVec4c);

                        viewPos[0] = tempVec4c[0];
                        viewPos[1] = tempVec4c[1];
                        viewPos[2] = tempVec4c[2];

                        hit.viewPos = viewPos;

                        // Get barycentric coordinates of the ray-triangle intersection

                        math.cartesianToBarycentric(position, positionA, positionB, positionC, bary);

                        hit.bary = bary;

                        // Get interpolated normal vector

                        const normals = geometry.normals;

                        if (normals) {

                            if (geometry.quantized) {

                                // Decompress vertex normals

                                const ia2 = ia * 2;
                                const ib2 = ib * 2;
                                const ic2 = ic * 2;

                                math.octDecodeVec2(normals.subarray(ia2, ia2 + 2), normalA);
                                math.octDecodeVec2(normals.subarray(ib2, ib2 + 2), normalB);
                                math.octDecodeVec2(normals.subarray(ic2, ic2 + 2), normalC);

                            } else {

                                normalA[0] = normals[ia3];
                                normalA[1] = normals[ia3 + 1];
                                normalA[2] = normals[ia3 + 2];

                                normalB[0] = normals[ib3];
                                normalB[1] = normals[ib3 + 1];
                                normalB[2] = normals[ib3 + 2];

                                normalC[0] = normals[ic3];
                                normalC[1] = normals[ic3 + 1];
                                normalC[2] = normals[ic3 + 2];
                            }

                            const normal = math.addVec3(math.addVec3(
                                math.mulVec3Scalar(normalA, bary[0], tempVec3$1),
                                math.mulVec3Scalar(normalB, bary[1], tempVec3b$1), tempVec3c$1),
                                math.mulVec3Scalar(normalC, bary[2], tempVec3d$1), tempVec3e$1);

                            hit.normal = math.transformVec3(hit.mesh.worldNormalMatrix, normal, tempVec3f$1);
                        }

                        // Get interpolated UV coordinates

                        const uvs = geometry.uv;

                        if (uvs) {

                            uva[0] = uvs[(ia * 2)];
                            uva[1] = uvs[(ia * 2) + 1];

                            uvb[0] = uvs[(ib * 2)];
                            uvb[1] = uvs[(ib * 2) + 1];

                            uvc[0] = uvs[(ic * 2)];
                            uvc[1] = uvs[(ic * 2) + 1];

                            if (geometry.quantized) {

                                // Decompress vertex UVs

                                const uvDecodeMatrix = geometry.uvDecodeMatrix;
                                if (uvDecodeMatrix) {
                                    math.decompressUV(uva, uvDecodeMatrix, uva);
                                    math.decompressUV(uvb, uvDecodeMatrix, uvb);
                                    math.decompressUV(uvc, uvDecodeMatrix, uvc);
                                }
                            }

                            hit.uv = math.addVec3(
                                math.addVec3(
                                    math.mulVec2Scalar(uva, bary[0], tempVec3g),
                                    math.mulVec2Scalar(uvb, bary[1], tempVec3h), tempVec3i),
                                math.mulVec2Scalar(uvc, bary[2], tempVec3j), tempVec3k);
                        }
                    }
                }
            }

            hit.mesh.fire("picked", hit);

            return hit;
        }
    }

    /**
     Returns the collective axis-aligned bounding box of the {{#crossLink "Object"}}Objects{{/crossLink}}, specified by their IDs, GUIDs and/or entity types.

     When no arguments are given, returns the total boundary of all objects in the scene.

     Only {{#crossLink "Mesh"}}Meshes{{/crossLink}} with {{#crossLink "Mesh/collidable:property"}}collidable{{/crossLink}}
     set ````true```` are included in the boundary.

     ## Usage

     ````JavaScript
     scene.getAABB(); // Gets collective boundary of all objects in the scene
     scene.getAABB("saw"); // Gets collective boundary of all objects in saw model
     scene.getAABB(["saw", "gearbox"]); // Gets collective boundary of all objects in saw and gearbox models
     scene.getAABB("saw#0.1"); // Get boundary of an object in the saw model
     scene.getAABB(["saw#0.1", "saw#0.2"]); // Get collective boundary of two objects in saw model
     scene.getAABB(["saw#0.1", "surface", "support"]); // Get collective boundary an object, and all objects of the given two entity classes.
     ````

     @method getAABB
     @param {String|String[]} target {Array} Array of  {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @returns {[Number, Number, Number, Number, Number, Number]} An axis-aligned World-space bounding box, given as elements ````[xmin, ymin, zmin, xmax, ymax, zmax]````.
     */
    getAABB(target) {
        if (target === undefined) {
            return this.aabb;
        }
        if (utils.isString(target)) {
            const object = this.objects[target];
            if (object) {
                return object.aabb;
            }
            target = [target]; // Must be an entity type
        }
        if (target.length === 0) {
            return this.aabb;
        }
        let xmin = math.MAX_DOUBLE;
        let ymin = math.MAX_DOUBLE;
        let zmin = math.MAX_DOUBLE;
        let xmax = -math.MAX_DOUBLE;
        let ymax = -math.MAX_DOUBLE;
        let zmax = -math.MAX_DOUBLE;
        let valid;
        this.withObjects(target, object => {
                const aabb = object.aabb;
                if (aabb[0] < xmin) {
                    xmin = aabb[0];
                }
                if (aabb[1] < ymin) {
                    ymin = aabb[1];
                }
                if (aabb[2] < zmin) {
                    zmin = aabb[2];
                }
                if (aabb[3] > xmax) {
                    xmax = aabb[3];
                }
                if (aabb[4] > ymax) {
                    ymax = aabb[4];
                }
                if (aabb[5] > zmax) {
                    zmax = aabb[5];
                }
                valid = true;
            }
        );
        if (valid) {
            const aabb2 = math.AABB3();
            aabb2[0] = xmin;
            aabb2[1] = ymin;
            aabb2[2] = zmin;
            aabb2[3] = xmax;
            aabb2[4] = ymax;
            aabb2[5] = zmax;
            return aabb2;
        } else {
            return this.aabb; // Scene AABB
        }
    }

    /**
     Resets this Scene to its default state.

     References to any components in this Scene will become invalid.

     @method clear
     */
    clear() {
        var component;
        for (const id in this.components) {
            if (this.components.hasOwnProperty(id)) {
                // Each component fires "destroyed" as it is destroyed,
                // which this Scene handles by removing the component
                component = this.components[id];
                if (!component._dontClear) { // Don't destroy components like xeogl.Camera, xeogl.Input, xeogl.Viewport etc.
                    component.destroy();
                }
            }
        }
    }

    /**
     Convenience method that destroys all light sources.

     Removes all {{#crossLink "AmbientLight"}}AmbientLights{{/crossLink}}, {{#crossLink "PointLight"}}PointLights{{/crossLink}},
     {{#crossLink "DirLight"}}DirLights{{/crossLink}} and {{#crossLink "SpotLight"}}SpotLights{{/crossLink}}.

     @method clearLights
     */
    clearLights() {
        const ids = Object.keys(this.lights);
        for (let i = 0, len = ids.length; i < len; i++) {
            this.lights[ids[i]].destroy();
        }
    }

    /**
     Convenience method that destroys all {{#crossLink "Clip"}}Clips{{/crossLink}}.

     @method clearClips
     */
    clearClips() {
        const ids = Object.keys(this.clips);
        for (let i = 0, len = ids.length; i < len; i++) {
            this.clips[ids[i]].destroy();
        }
    }

    /**
     Shows or hides a batch of {{#crossLink "Object"}}Objects{{/crossLink}}, specified by their IDs, GUIDs and/or entity types.

     Each Object indicates its visibility status in its {{#crossLink "Object/visibility:property"}}{{/crossLink}} property.

     Each visible Object is registered in the {{#crossLink "Scene"}}{{/crossLink}}'s
     {{#crossLink "Scene/visibleEntities:property"}}{{/crossLink}} map while its {{#crossLink "Object/entityType:property"}}{{/crossLink}}
     is assigned a value.

     @method setVisible
     @param ids {Array} Array of  {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @param visible {Boolean} The new visibility state.
     @returns {Boolean} True if any {{#crossLink "Object"}}Objects{{/crossLink}} changed visibility, else false if all updates were redundant and not applied.
     */
    setVisible(ids, visible) {
        return this.withObjects(ids, object => {
            const changed = (object.visible !== visible);
            object.visible = visible;
            return changed;
        });
    }

    /**
     Culls or unculls a batch of {{#crossLink "Object"}}Objects{{/crossLink}}, specified by their IDs, GUIDs and/or entity types.

     Each Object indicates its culled status in its {{#crossLink "Object/visibility:property"}}{{/crossLink}} property.

     @method setVisible
     @param ids {Array} Array of  {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @param culled {Boolean} The new cull state.
     @returns {Boolean} True if any {{#crossLink "Object"}}Objects{{/crossLink}} changed culled state, else false if all updates were redundant and not applied.
     */
    setCulled(ids, culled) {
        return this.withObjects(ids, object => {
            const changed = (object.culled !== culled);
            object.culled = culled;
            return changed;
        });
    }

    /**
     Selects or de-selects a batch of {{#crossLink "Object"}}Objects{{/crossLink}}, specified by their IDs, GUIDs and/or entity types.

     Each Object indicates its selected status in its {{#crossLink "Object/selected:property"}}{{/crossLink}} property.

     Each selected Object is registered in the {{#crossLink "Scene"}}{{/crossLink}}'s
     {{#crossLink "Scene/selectedEntities:property"}}{{/crossLink}} map while its {{#crossLink "Object/entityType:property"}}{{/crossLink}}
     is assigned a value.

     @method setSelected
     @param ids {Array} Array of  {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @param selected {Boolean} Whether to select or deselect.
     @returns {Boolean} True if any {{#crossLink "Object"}}Objects{{/crossLink}} changed selection state, else false if all updates were redundant and not applied.
     */
    setSelected(ids, selected) {
        return this.withObjects(ids, object => {
            const changed = (object.selected !== selected);
            object.selected = selected;
            return changed;
        });
    }

    /**
     Highlights or de-highlights a batch of {{#crossLink "Object"}}Objects{{/crossLink}}, specified by their IDs, GUIDs and/or entity types.

     Each Object indicates its highlight status in its {{#crossLink "Object/highlighted:property"}}{{/crossLink}} property.

     Each highlighted Object is registered in the {{#crossLink "Scene"}}{{/crossLink}}'s
     {{#crossLink "Scene/highlightedEntities:property"}}{{/crossLink}} map while its {{#crossLink "Object/entityType:property"}}{{/crossLink}}
     is assigned a value.

     @method setHighlighted
     @param ids {Array} Array of  {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @param highlighted {Boolean} Whether to highlight or un-highlight.
     @returns {Boolean} True if any {{#crossLink "Object"}}Objects{{/crossLink}} changed highlighted state, else false if all updates were redundant and not applied.
     */
    setHighlighted(ids, highlighted) {
        return this.withObjects(ids, object => {
            const changed = (object.highlighted !== highlighted);
            object.highlighted = highlighted;
            return changed;
        });
    }

    /**
     Ghosts or un-ghosts a batch of {{#crossLink "Object"}}Objects{{/crossLink}}, specified by their IDs, GUIDs and/or entity types.

     Each Object indicates its ghosted status in its {{#crossLink "Object/ghosted:property"}}{{/crossLink}} property.

     Each ghosted Object is registered in the {{#crossLink "Scene"}}{{/crossLink}}'s
     {{#crossLink "Scene/ghostedEntities:property"}}{{/crossLink}} map when its {{#crossLink "Object/entityType:property"}}{{/crossLink}}
     is assigned a value.

     @method setGhosted
     @param ids {Array} Array of  {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @param ghosted {Float32Array} Whether to ghost or un-ghost.
     @returns {Boolean} True if any {{#crossLink "Object"}}Objects{{/crossLink}} changed ghosted state, else false if all updates were redundant and not applied.
     */
    setGhosted(ids, ghosted) {
        return this.withObjects(ids, object => {
            const changed = (object.ghosted !== ghosted);
            object.ghosted = ghosted;
            return changed;
        });
    }

    /**
     Shows or hides wireeframe edges for batch of {{#crossLink "Object"}}Objects{{/crossLink}}, specified by their IDs, GUIDs and/or entity types.

     @method setEdges
     @param ids {Array} Array of  {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @param edges {Float32Array} Whether to show or hide edges.
     @returns {Boolean} True if any {{#crossLink "Object"}}Objects{{/crossLink}} changed edges state, else false if all updates were redundant and not applied.
     */
    setEdges(ids, edges) {
        return this.withObjects(ids, object => {
            const changed = (object.edges !== edges);
            object.edges = edges;
            return changed;
        });
    }

    /**
     Shows or hides an outline around a batch of {{#crossLink "Object"}}Objects{{/crossLink}}, specified by their IDs, GUIDs and/or entity types.

     Each Object indicates its outlined status in its {{#crossLink "Object/outlined:property"}}{{/crossLink}} property.

     Each outlined Object is registered in the {{#crossLink "Scene"}}{{/crossLink}}'s
     {{#crossLink "Scene/outlinedEntities:property"}}{{/crossLink}} map when its {{#crossLink "Object/entityType:property"}}{{/crossLink}}
     is assigned a value.

     @method setOutlined
     @param ids {Array} Array of  {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @param outlined {Float32Array} Whether to show or hide the outline.
     @returns {Boolean} True if any {{#crossLink "Object"}}Objects{{/crossLink}} changed outlined state, else false if all updates were redundant and not applied.
     */
    setOutlined(ids, outlined) {
        return this.withObjects(ids, object => {
            const changed = (object.outlined !== outlined);
            object.outlined = outlined;
            return changed;
        });
    }

    /**
     Colorizes a batch of {{#crossLink "Object"}}Objects{{/crossLink}}, specified by their IDs, GUIDs and/or entity types.

     @method setColorize
     @param ids {Array} Array of  {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @param [colorize=(1,1,1)] Float32Array RGB colorize factors, multiplied by the rendered pixel colors.
     */
    setColorize(ids, colorize) {
        return this.withObjects(ids, object => {
            object.colorize = colorize;
        });
    }

    /**
     Updates opacities of a batch of {{#crossLink "Object"}}Objects{{/crossLink}}, specified by their IDs, GUIDs and/or entity types.

     @method setOpacity
     @param ids {Array} Array of  {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @param [opacity=1] Number Opacity factor in range ````[0..1]````, multiplies by the rendered pixel alphas.
     */
    setOpacity(ids, opacity) {
        return this.withObjects(ids, object => {
            object.opacity = opacity;
        });
    }

    /**
     Sets a batch of {{#crossLink "Object"}}Objects{{/crossLink}} pickable or unpickable, specified by their IDs, GUIDs and/or entity types.

     Picking is done via calls to {{#crossLink "Scene/pick:method"}}Scene#pick(){{/crossLink}}.

     @method setPickable
     @param ids {Array} Array of  {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @param pickable {Float32Array} Whether to ghost or un-ghost.
     @returns {Boolean} True if any {{#crossLink "Object"}}Objects{{/crossLink}} changed pickable state, else false if all updates were redundant and not applied.
     */
    setPickable(ids, pickable) {
        return this.withObjects(ids, object => {
            const changed = (object.pickable !== pickable);
            object.pickable = pickable;
            return changed;
        });
    }

    /**
     Iterates with a callback over {{#crossLink "Object"}}Objects{{/crossLink}}, specified by their IDs, GUIDs and/or entity types.

     @method withObjects
     @param ids {String|Array} One or more {{#crossLink "Object"}}{{/crossLink}} IDs, GUIDs or entity types.
     @param callback {Function} The callback, which takes each object as its argument.
     */
    withObjects(ids, callback) {
        if (utils.isString(ids)) {
            ids = [ids];
        }
        let changed = false;
        for (let i = 0, len = ids.length; i < len; i++) {
            const id = ids[i];
            let object = this.objects[id];
            if (object) {
                changed = callback(object) || changed;
            } else {
                object = this.guidObjects[id];
                if (object) {
                    changed = callback(object) || changed;
                } else {
                    const objects = this.entityTypes[id];
                    if (objects) {
                        for (const objectId in objects) {
                            if (objects.hasOwnProperty(objectId)) {
                                changed = callback(objects[objectId]) || changed;
                            }
                        }
                    }
                }
            }
        }
        return changed;
    }

    destroy() {

        super.destroy();

        for (const id in this.components) {
            if (this.components.hasOwnProperty(id)) {
                this.components[id].destroy();
            }
        }

        this.canvas.gl = null;

        // Memory leak prevention
        this.models = null;
        this.objects = null;
        this.guidObjects = null;
        this.entityTypes = null;
        this.entities = null;
        this.visibleEntities = null;
        this.ghostedEntities = null;
        this.highlightedEntities = null;
        this.selectedEntities = null;
        this.clips = null;
        this.lights = null;
        this.lightMaps = null;
        this.reflectionMaps = null;
        this._objectGUIDs = null;
        this._entityIds = null;
        this._visibleEntityIds = null;
        this._ghostedEntityIds = null;
        this._highlightedEntityIds = null;
        this._selectedEntityIds = null;
        this.meshes = null;
        this.types = null;
        this.components = null;
        this.rootObjects = null;
        this.canvas = null;
        this._renderer = null;
        this.input = null;
        this._viewport = null;
        this._camera = null;
    }
}

componentClasses[type$21] = Scene;

const scenesRenderInfo = {}; // Used for throttling FPS for each Scene
const sceneIDMap = new Map(); // Ensures unique scene IDs
let defaultScene = null;// Default singleton Scene, lazy-initialized in getter

const core = {

    /**
     Semantic version number. The value for this is set by an expression that's concatenated to
     the end of the built binary by the xeogl build script.
     @property version
     @namespace xeogl
     @type {String}
     */
    version: null,

    /**
     Existing {{#crossLink "Scene"}}Scene{{/crossLink}}s , mapped to their IDs
     @property scenes
     @namespace xeogl
     @type {{String:xeogl.Scene}}
     */
    scenes: {},

    _superTypes: {}, // For each component type, a list of its supertypes, ordered upwards in the hierarchy.

    /**
     Returns the current default {{#crossLink "Scene"}}{{/crossLink}}.

     If no Scenes exist yet, or no Scene has been made default yet with a previous call to
     {{#crossLink "xeogl/setDefaultScene:function"}}{{/crossLink}}, then this method will create the default
     Scene on-the-fly.

     Components created without specifying their Scene will be created within this Scene.

     @method getDefaultScene
     @returns {Scene} The current default scene
     */
    getDefaultScene() {
        if (!defaultScene) {
            defaultScene = new Scene({id: "default.scene"});
        }
        return defaultScene;
    },

    /**
     Sets the current default {{#crossLink "Scene"}}{{/crossLink}}.

     A subsequent call to {{#crossLink "xeogl/getDefaultScene:function"}}{{/crossLink}} will return this Scene.

     Components created without specifying their Scene will be created within this Scene.

     @method setDefaultScene
     @param {Scene} scene The new current default scene
     @returns {Scene} The new current default scene
     */
    setDefaultScene(scene) {
        defaultScene = scene;
        return defaultScene;
    },

    /**
     Registers a scene on xeogl.
     This is called within the xeogl.Scene constructor.

     @method _addScene
     @param {Scene} scene The scene
     @private
     */
    _addScene(scene) {
        if (scene.id) { // User-supplied ID
            if (core.scenes[scene.id]) {
                console.error(`[ERROR] Scene ${utils.inQuotes(scene.id)} already exists`);
                return;
            }
        } else { // Auto-generated ID
            scene.id = sceneIDMap.addItem({});
        }
        core.scenes[scene.id] = scene;
        const ticksPerRender = scene.ticksPerRender;
        scenesRenderInfo[scene.id] = {
            ticksPerRender,
            renderCountdown: ticksPerRender
        };
        stats.components.scenes++;
        scene.on("destroyed", () => { // Unregister destroyed scenes
            sceneIDMap.removeItem(scene.id);
            delete core.scenes[scene.id];
            delete scenesRenderInfo[scene.id];
            stats.components.scenes--;
        });
    },

    /**
     Destroys all user-created {{#crossLink "Scene"}}Scenes{{/crossLink}} and
     clears the default {{#crossLink "Scene"}}Scene{{/crossLink}}.

     @method clear
     @demo foo
     */
    clear() {
        let scene;
        for (const id in core.scenes) {
            if (core.scenes.hasOwnProperty(id)) {
                scene = core.scenes[id];
                // Only clear the default Scene
                // but destroy all the others
                if (id === "default.scene") {
                    scene.clear();
                } else {
                    scene.destroy();
                    delete core.scenes[scene.id];
                }
            }
        }
    },

    //////////////////////////////////////////////////////////////////////////
    /////////// Fix me
    //////////////////////////////////////////////////////////////////////////

    /**
     Tests if the given component type is a subtype of another component supertype.
     @param {String} type
     @param {String} [superType="xeogl.Component"]
     @returns {boolean}
     @private
     */
    isComponentType: function (type, superType = "xeogl.Component") {
        if (type === superType) {
            return true;
        }
        var clas = componentClasses[type];
        if (!clas) {
            return false;
        }
        var superClas = componentClasses[superType];
        if (!superClas) {
            return false;
        }
        let result = subclasses(clas, superClas);
        return result;
    }
};

function subclasses(ChildClass, ParentClass) {
    var c = ChildClass.prototype;
    while (c !== null) {
        if (c === ParentClass.prototype) {
            return true;
        }
        c = c.__proto__;
    }
    return false;
}

const scenesRenderInfo$1 = {}; // Used for throttling FPS for each Scene

const tickEvent = {
    sceneId: null,
    time: null,
    startTime: null,
    prevTime: null,
    deltaTime: null
};

const taskBudget = 10; // Millisecs we're allowed to spend on tasks in each frame
const fpsSamples = [];
const numFPSSamples = 30;

let lastTime = 0;
let elapsedTime;
let totalFPS = 0;

const frame = function () {
    let time = Date.now();
    if (lastTime > 0) { // Log FPS stats
        elapsedTime = time - lastTime;
        var newFPS = 1000 / elapsedTime; // Moving average of FPS
        totalFPS += newFPS;
        fpsSamples.push(newFPS);
        if (fpsSamples.length >= numFPSSamples) {
            totalFPS -= fpsSamples.shift();
        }
        stats.frame.fps = Math.round(totalFPS / fpsSamples.length);
    }
    runTasks(time);
    fireTickEvents(time);
    renderScenes();
    lastTime = time;
    window.requestAnimationFrame(frame);
};

function runTasks(time) { // Process as many enqueued tasks as we can within the per-frame task budget
    const tasksRun = tasks.runTasks(time + taskBudget);
    const tasksScheduled = tasks.getNumTasks();
    stats.frame.tasksRun = tasksRun;
    stats.frame.tasksScheduled = tasksScheduled;
    stats.frame.tasksBudget = taskBudget;
}

function fireTickEvents(time) { // Fire tick event on each Scene
    tickEvent.time = time;
    for (var id in core.scenes) {
        if (core.scenes.hasOwnProperty(id)) {
            var scene = core.scenes[id];
            tickEvent.sceneId = id;
            tickEvent.startTime = scene.startTime;
            tickEvent.deltaTime = tickEvent.prevTime != null ? tickEvent.time - tickEvent.prevTime : 0;
            /**
             * Fired on each game loop iteration.
             *
             * @event tick
             * @param {String} sceneID The ID of this Scene.
             * @param {Number} startTime The time in seconds since 1970 that this Scene was instantiated.
             * @param {Number} time The time in seconds since 1970 of this "tick" event.
             * @param {Number} prevTime The time of the previous "tick" event from this Scene.
             * @param {Number} deltaTime The time in seconds since the previous "tick" event from this Scene.
             */
            scene.fire("tick", tickEvent, true);
        }
    }
    tickEvent.prevTime = time;
}

function renderScenes() {
    const scenes = core.scenes;
    const forceRender = false;
    let scene;
    let renderInfo;
    let ticksPerRender;
    let id;
    for (id in scenes) {
        if (scenes.hasOwnProperty(id)) {
            scene = scenes[id];
            renderInfo = scenesRenderInfo$1[id];
            if (!renderInfo) {
                renderInfo = scenesRenderInfo$1[id] = {}; // FIXME
            }
            ticksPerRender = scene.ticksPerRender;
            if (renderInfo.ticksPerRender !== ticksPerRender) {
                renderInfo.ticksPerRender = ticksPerRender;
                renderInfo.renderCountdown = ticksPerRender;
            }
            if (--renderInfo.renderCountdown === 0) {
                scene.render(forceRender);
                renderInfo.renderCountdown = ticksPerRender;
            }
        }
    }
}

window.requestAnimationFrame(frame);

/**
 A **CameraFlightAnimation** jumps or flies the {{#crossLink "Scene"}}Scene's{{/crossLink}} {{#crossLink "Camera"}}{{/crossLink}} to look at a given target.

 <a href="../../examples/#animation_camera_flight"><img src="http://i.giphy.com/3o7TKP0jN800EQ99EQ.gif"></img></a>

 * TODO: Document behaviour for ortho projection
 * TODO: Update docs for camera refactor, where ortho and perspective components will always be present on camera

 ## Overview

 * Can be made to either fly or jump to its target.
 * While busy flying to a target, it can be stopped, or redirected to fly to a different target.

 A CameraFlightAnimation's target can be:

 * specific ````eye````, ````look```` and ````up```` positions,
 * an axis-aligned World-space bounding box (AABB), or
 * an instance or ID of any {{#crossLink "Component"}}{{/crossLink}} subtype that provides a World-space AABB.

 You can configure its {{#crossLink "CameraFlightAnimation/fit:property"}}{{/crossLink}}
 and {{#crossLink "CameraFlightAnimation/fitFOV:property"}}{{/crossLink}} properties to make it stop at the point where the target
 occupies a certain amount of the field-of-view.

 ## Examples

 * [Flying to random meshes](../../examples/#animation_camera_flight)

 ## Flying to a Mesh

 Flying to a {{#crossLink "Mesh"}}{{/crossLink}}:

 ````Javascript
 // Create a CameraFlightAnimation that takes one second to fly
 // the default Scene's Camera to each specified target
 var cameraFlight = new xeogl.CameraFlightAnimation({
    fit: true, // Default
    fitFOV: 45, // Default, degrees
    duration: 1 // Default, seconds
 }, function() {
           // Arrived
       });

 // Create a Mesh, which gets all the default components
 var mesh = new Mesh();

 // Fly to the Mesh's World-space AABB
 cameraFlight.flyTo(mesh);
 ````
 ## Flying to a position

 Flying the CameraFlightAnimation from the previous example to specified eye, look and up positions:

 ````Javascript
 cameraFlight.flyTo({
    eye: [-5,-5,-5],
    look: [0,0,0]
    up: [0,1,0],
    duration: 1 // Default, seconds
 }, function() {
          // Arrived
      });
 ````

 ## Flying to an AABB

 Flying the CameraFlightAnimation from the previous two examples explicitly to the {{#crossLink "Boundary3D"}}Boundary3D's{{/crossLink}}
 axis-aligned bounding box:

 ````Javascript
 cameraFlight.flyTo(mesh.aabb);
 ````

 @class CameraFlightAnimation
 @module xeogl
 @submodule animation
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this CameraFlightAnimation.
 @param [cfg.fit=true] {Boolean} When true, will ensure that when this CameraFlightAnimation has flown or jumped to a boundary
 it will adjust the distance between the {{#crossLink "Camera"}}{{/crossLink}}'s {{#crossLink "Lookat/eye:property"}}eye{{/crossLink}}
 and {{#crossLink "Lookat/look:property"}}{{/crossLink}} position so as to ensure that the target boundary is filling the view volume.
 @param [cfg.fitFOV=45] {Number} How much field-of-view, in degrees, that a target boundary should
 fill the canvas when fitting the {{#crossLink "Camera"}}Camera{{/crossLink}} to the target boundary. Only applies when the {{#crossLink "Camera"}}Camera{{/crossLink}}'s active projection is a{{#crossLink "Perspective"}}{{/crossLink}}.
 @param [cfg.trail] {Boolean} When true, will cause this CameraFlightAnimation to point the {{#crossLink "Camera"}}{{/crossLink}} in the direction that it is travelling.
 @param [cfg.duration=1] {Number} Flight duration, in seconds, when calling {{#crossLink "CameraFlightAnimation/flyTo:method"}}CameraFlightAnimation#flyTo(){{/crossLink}}.
 @extends Component
 */

const type$22 = "xeogl.CameraFlightAnimation";

const tempVec3$2 = math.vec3();
const newLook = math.vec3();
const newEye = math.vec3();
const newUp = math.vec3();
const newLookEyeVec = math.vec3();
const lookEyeVec = math.vec3();

class CameraFlightAnimation extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$22;
    }

    init(cfg) {

        super.init(cfg);

        this._aabbHelper = new Mesh(this, { // Shows a wireframe box for target AABBs
            geometry: new AABBGeometry(this),
            material: new PhongMaterial(this, {
                diffuse: [0, 0, 0],
                ambient: [0, 0, 0],
                specular: [0, 0, 0],
                emissive: [0.5, 1.0, 0.5],
                lineWidth: 2
            }),
            visible: false,
            collidable: false
        });

        this._look1 = math.vec3();
        this._eye1 = math.vec3();
        this._up1 = math.vec3();
        this._look2 = math.vec3();
        this._eye2 = math.vec3();
        this._up2 = math.vec3();
        this._orthoScale1 = 1;
        this._orthoScale2 = 1;
        this._flying = false;
        this._flyEyeLookUp = false;
        this._flyingEye = false;
        this._flyingLook = false;
        this._callback = null;
        this._callbackScope = null;
        this._time1 = null;
        this._time2 = null;
        this.easing = cfg.easing !== false;

        this.duration = cfg.duration;
        this.fit = cfg.fit;
        this.fitFOV = cfg.fitFOV;
        this.trail = cfg.trail;
    }

    /**
     * Begins flying the {{#crossLink "Camera"}}{{/crossLink}}'s {{#crossLink "Camera"}}{{/crossLink}} to the given target.
     *
     *  * When the target is a boundary, the {{#crossLink "Camera"}}{{/crossLink}} will fly towards the target
     *    and stop when the target fills most of the canvas.
     *  * When the target is an explicit {{#crossLink "Camera"}}{{/crossLink}} position, given as ````eye````, ````look```` and ````up````
     *    vectors, then this CameraFlightAnimation will interpolate the {{#crossLink "Camera"}}{{/crossLink}} to that target and stop there.
     * @method flyTo
     * @param [params=scene]  {*|Component} Either a parameters object or a {{#crossLink "Component"}}{{/crossLink}} subtype that has an AABB.
     * @param[params.arc=0]  {Number} Factor in range [0..1] indicating how much the
     * {{#crossLink "Lookat/eye:property"}}Camera's eye{{/crossLink}} position will
     * swing away from its {{#crossLink "Lookat/eye:property"}}look{{/crossLink}} position as it flies to the target.
     * @param [params.component] {Number|String|Component} ID or instance of a component to fly to. Defaults to the entire {{#crossLink "Scene"}}{{/crossLink}}.
     * @param [params.aabb] {*}  World-space axis-aligned bounding box (AABB) target to fly to.
     * @param [params.eye] {Float32Array} Position to fly the eye position to.
     * @param [params.look] {Float32Array} Position to fly the look position to.
     * @param [params.up] {Float32Array} Position to fly the up vector to.
     * @param [params.fit=true] {Boolean} Whether to fit the target to the view volume. Overrides {{#crossLink "CameraFlightAnimation/fit:property"}}{{/crossLink}}.
     * @param [params.fitFOV] {Number} How much of field-of-view, in degrees, that a target {{#crossLink "Object"}}{{/crossLink}} or its AABB should
     * fill the canvas on arrival. Overrides {{#crossLink "CameraFlightAnimation/fitFOV:property"}}{{/crossLink}}.
     * @param [params.duration] {Number} Flight duration in seconds.  Overrides {{#crossLink "CameraFlightAnimation/duration:property"}}{{/crossLink}}.
     * @param [params.orthoScale] {Number} TODO: document this
     * @param [callback] {Function} Callback fired on arrival
     * @param [scope] {Object} Optional scope for callback
     */
    flyTo(params, callback, scope) {

        params = params || this.scene;

        if (this._flying) {
            this.stop();
        }

        this._flying = false;

        this._callback = callback;
        this._callbackScope = scope;

        const camera = this.scene.camera;

        this._eye1[0] = camera.eye[0];
        this._eye1[1] = camera.eye[1];
        this._eye1[2] = camera.eye[2];

        this._look1[0] = camera.look[0];
        this._look1[1] = camera.look[1];
        this._look1[2] = camera.look[2];

        this._up1[0] = camera.up[0];
        this._up1[1] = camera.up[1];
        this._up1[2] = camera.up[2];

        this._orthoScale1 = camera.ortho.scale;
        this._orthoScale2 = params.orthoScale || this._orthoScale1;

        let aabb;
        let eye;
        let look;
        let up;
        let componentId;

        if (params.aabb) {
            aabb = params.aabb;

        } else if (params.length === 6) {
            aabb = params;

        } else if ((params.eye && params.look) || params.up) {
            eye = params.eye;
            look = params.look;
            up = params.up;

        } else if (params.eye) {
            eye = params.eye;

        } else if (params.look) {
            look = params.look;

        } else { // Argument must be an instance or ID of a Component (subtype)

            let component = params;
            if (utils.isNumeric(component) || utils.isString(component)) {
                componentId = component;
                component = this.scene.components[componentId];
                if (!component) {
                    this.error("Component not found: " + utils.inQuotes(componentId));
                    if (callback) {
                        if (scope) {
                            callback.call(scope);
                        } else {
                            callback();
                        }
                    }
                    return;
                }
            }
            aabb = component.aabb || this.scene.aabb;
        }

        const poi = params.poi;

        if (aabb) {
            if (aabb[3] < aabb[0] || aabb[4] < aabb[1] || aabb[5] < aabb[2]) { // Don't fly to an inverted boundary
                return;
            }
            if (aabb[3] === aabb[0] && aabb[4] === aabb[1] && aabb[5] === aabb[2]) { // Don't fly to an empty boundary
                return;
            }
            if (params.showAABB !== false) { // Show boundary
                this._aabbHelper.geometry.targetAABB = aabb;
                //this._aabbHelper.visible = true;
            }

            aabb = aabb.slice();
            const aabbCenter = math.getAABB3Center(aabb);

            this._look2 = poi || aabbCenter;

            const eyeLookVec = math.subVec3(this._eye1, this._look1, tempVec3$2);
            const eyeLookVecNorm = math.normalizeVec3(eyeLookVec);
            const diag = poi ? math.getAABB3DiagPoint(aabb, poi) : math.getAABB3Diag(aabb);
            const fitFOV = params.fitFOV || this._fitFOV;
            const sca = Math.abs(diag / Math.tan(fitFOV * math.DEGTORAD));

            this._orthoScale2 = diag * 1.1;

            this._eye2[0] = this._look2[0] + (eyeLookVecNorm[0] * sca);
            this._eye2[1] = this._look2[1] + (eyeLookVecNorm[1] * sca);
            this._eye2[2] = this._look2[2] + (eyeLookVecNorm[2] * sca);

            this._up2[0] = this._up1[0];
            this._up2[1] = this._up1[1];
            this._up2[2] = this._up1[2];

            this._flyEyeLookUp = false;

        } else if (eye || look || up) {

            this._flyEyeLookUp = !!eye && !!look && !!up;
            this._flyingEye = !!eye && !look;
            this._flyingLook = !!look && !eye;

            if (look) {
                this._look2[0] = look[0];
                this._look2[1] = look[1];
                this._look2[2] = look[2];
            }

            if (eye) {
                this._eye2[0] = eye[0];
                this._eye2[1] = eye[1];
                this._eye2[2] = eye[2];
            }

            if (up) {
                this._up2[0] = up[0];
                this._up2[1] = up[1];
                this._up2[2] = up[2];
            }
        }

        this.fire("started", params, true);

        this._time1 = Date.now();
        this._time2 = this._time1 + (params.duration ? params.duration * 1000 : this._duration);

        this._flying = true; // False as soon as we stop

        tasks.scheduleTask(this._update, this);
    }

    /**
     * Jumps the {{#crossLink "Camera"}}{{/crossLink}}'s {{#crossLink "Camera"}}{{/crossLink}} to the given target.
     *
     *  * When the target is a boundary, this CameraFlightAnimation will position the {{#crossLink "Camera"}}{{/crossLink}}
     *  at where the target fills most of the canvas.
     *  * When the target is an explicit {{#crossLink "Camera"}}{{/crossLink}} position, given as ````eye````, ````look```` and ````up````
     *  vectors, then this CameraFlightAnimation will jump the {{#crossLink "Camera"}}{{/crossLink}} to that target.
     *
     * @method flyTo
     * @param params  {*|Component} Either a parameters object or a {{#crossLink "Component"}}{{/crossLink}} subtype that has a World-space AABB.
     * @param[params.arc=0]  {Number} Factor in range [0..1] indicating how much the
     * {{#crossLink "Camera/eye:property"}}Camera's eye{{/crossLink}} position will
     * swing away from its {{#crossLink "Camera/eye:property"}}look{{/crossLink}} position as it flies to the target.
     * @param [params.component] {Number|String|Component} ID or instance of a component to fly to.
     * @param [params.aabb] {*}  World-space axis-aligned bounding box (AABB) target to fly to.
     * @param [params.eye] {Float32Array} Position to fly the eye position to.
     * @param [params.look] {Float32Array} Position to fly the look position to.
     * @param [params.up] {Float32Array} Position to fly the up vector to.
     * @param [params.fitFOV] {Number} How much of field-of-view, in degrees, that a target {{#crossLink "Object"}}{{/crossLink}} or its AABB should
     * fill the canvas on arrival. Overrides {{#crossLink "CameraFlightAnimation/fitFOV:property"}}{{/crossLink}}.
     * @param [params.fit] {Boolean} Whether to fit the target to the view volume. Overrides {{#crossLink "CameraFlightAnimation/fit:property"}}{{/crossLink}}.
     */
    jumpTo(params) {
        this._jumpTo(params);
    }

    _jumpTo(params) {

        if (this._flying) {
            this.stop();
        }

        const camera = this.scene.camera;

        var aabb;
        var componentId;
        var newEye;
        var newLook;
        var newUp;

        if (params.aabb) { // Boundary3D
            aabb = params.aabb;

        } else if (params.length === 6) { // AABB
            aabb = params;

        } else if (params.eye || params.look || params.up) { // Camera pose
            newEye = params.eye;
            newLook = params.look;
            newUp = params.up;

        } else { // Argument must be an instance or ID of a Component (subtype)

            let component = params;

            if (utils.isNumeric(component) || utils.isString(component)) {
                componentId = component;
                component = this.scene.components[componentId];
                if (!component) {
                    this.error("Component not found: " + utils.inQuotes(componentId));
                    return;
                }
            }
            aabb = component.aabb || this.scene.aabb;
        }

        const poi = params.poi;

        if (aabb) {

            if (aabb[3] <= aabb[0] || aabb[4] <= aabb[1] || aabb[5] <= aabb[2]) { // Don't fly to an empty boundary
                return;
            }

            var diag = poi ? math.getAABB3DiagPoint(aabb, poi) : math.getAABB3Diag(aabb);

            newLook = poi || math.getAABB3Center(aabb, newLook);

            if (this._trail) {
                math.subVec3(camera.look, newLook, newLookEyeVec);
            } else {
                math.subVec3(camera.eye, camera.look, newLookEyeVec);
            }

            math.normalizeVec3(newLookEyeVec);
            let dist;
            const fit = (params.fit !== undefined) ? params.fit : this._fit;

            if (fit) {
                dist = Math.abs((diag) / Math.tan((params.fitFOV || this._fitFOV) * math.DEGTORAD));

            } else {
                dist = math.lenVec3(math.subVec3(camera.eye, camera.look, tempVec3$2));
            }

            math.mulVec3Scalar(newLookEyeVec, dist);

            camera.eye = math.addVec3(newLook, newLookEyeVec, tempVec3$2);
            camera.look = newLook;

        } else if (newEye || newLook || newUp) {

            if (newEye) {
                camera.eye = newEye;
            }
            if (newLook) {
                camera.look = newLook;
            }
            if (newUp) {
                camera.up = newUp;
            }
        }
    }

    _update() {
        if (!this._flying) {
            return;
        }
        const time = Date.now();
        let t = (time - this._time1) / (this._time2 - this._time1);
        const stopping = (t >= 1);
        if (t > 1) {
            t = 1;
        }
        t = this.easing ? this._ease(t, 0, 1, 1) : t;
        const camera = this.scene.camera;
        if (this._flyingEye || this._flyingLook) {
            if (this._flyingEye) {
                math.subVec3(camera.eye, camera.look, newLookEyeVec);
                camera.eye = math.lerpVec3(t, 0, 1, this._eye1, this._eye2, newEye);
                camera.look = math.subVec3(newEye, newLookEyeVec, newLook);
            } else if (this._flyingLook) {
                camera.look = math.lerpVec3(t, 0, 1, this._look1, this._look2, newLook);
                //    camera.eye = math.addVec3(newLook, newLookEyeVec, newEye);
                camera.up = math.lerpVec3(t, 0, 1, this._up1, this._up2, newUp);
            }
        } else if (this._flyEyeLookUp) {
            camera.eye = math.lerpVec3(t, 0, 1, this._eye1, this._eye2, newEye);
            camera.look = math.lerpVec3(t, 0, 1, this._look1, this._look2, newLook);
            camera.up = math.lerpVec3(t, 0, 1, this._up1, this._up2, newUp);
        } else {
            math.lerpVec3(t, 0, 1, this._look1, this._look2, newLook);
            let dist;
            if (this._trail) {
                math.subVec3(newLook, camera.look, newLookEyeVec);
            } else {
                math.subVec3(camera.eye, camera.look, newLookEyeVec);
            }
            math.normalizeVec3(newLookEyeVec);
            math.lerpVec3(t, 0, 1, this._eye1, this._eye2, newEye);
            math.subVec3(newEye, newLook, lookEyeVec);
            dist = math.lenVec3(lookEyeVec);
            math.mulVec3Scalar(newLookEyeVec, dist);
            camera.eye = math.addVec3(newLook, newLookEyeVec, newEye);
            camera.look = newLook;
        }
        this.scene.camera.ortho.scale = this._orthoScale1 + (t * (this._orthoScale2 - this._orthoScale1));
        if (stopping) {
            this.stop();
            return;
        }
        tasks.scheduleTask(this._update, this); // Keep flying
    }

    _ease(t, b, c, d) { // Quadratic easing out - decelerating to zero velocity http://gizma.com/easing
        t /= d;
        return -c * t * (t - 2) + b;
    }

    /**
     * Stops an earlier flyTo, fires arrival callback.
     * @method stop
     */
    stop() {
        if (!this._flying) {
            return;
        }
        this._aabbHelper.visible = false;
        this._flying = false;
        this._time1 = null;
        this._time2 = null;
        const callback = this._callback;
        if (callback) {
            this._callback = null;
            if (this._callbackScope) {
                callback.call(this._callbackScope);
            } else {
                callback();
            }
        }
        this.fire("stopped", true, true);
    }

    /**
     * Cancels an earlier flyTo without calling the arrival callback.
     * @method cancel
     */
    cancel() {
        if (!this._flying) {
            return;
        }
        this._aabbHelper.visible = false;
        this._flying = false;
        this._time1 = null;
        this._time2 = null;
        if (this._callback) {
            this._callback = null;
        }
        this.fire("canceled", true, true);
    }

    /**
     * Flight duration, in seconds, when calling {{#crossLink "CameraFlightAnimation/flyTo:method"}}CameraFlightAnimation#flyTo(){{/crossLink}}.
     *
     * Stops any flight currently in progress.
     *
     * @property duration
     * @default 0.5
     * @type Number
     */
    set duration(value) {
        this._duration = value ? (value * 1000.0) : 500;
        this.stop();
    }

    get duration() {
        return this._duration / 1000.0;
    }

    /**
     * When true, will ensure that this CameraFlightAnimation is flying to a boundary it will always adjust the distance between the
     * {{#crossLink "CameraFlightAnimation/camera:property"}}camera{{/crossLink}}'s {{#crossLink "Lookat/eye:property"}}eye{{/crossLink}}
     * and {{#crossLink "Lookat/look:property"}}{{/crossLink}}
     * so as to ensure that the target boundary is always filling the view volume.
     *
     * When false, the eye will remain at its current distance from the look position.
     *
     * @property fit
     * @type Boolean
     * @default true
     */
    set fit(value) {
        this._fit = value !== false;
    }

    get fit() {
        return this._fit;
    }


    /**
     * How much of the perspective field-of-view, in degrees, that a target {{#crossLink "Object"}}{{/crossLink}} or its AABB should
     * fill the canvas when calling {{#crossLink "CameraFlightAnimation/flyTo:method"}}CameraFlightAnimation#jumpTo(){{/crossLink}} or {{#crossLink "CameraFlightAnimation/jumpTo:method"}}{{/crossLink}}.
     *
     * @property fitFOV
     * @default 45
     * @type Number
     */
    set fitFOV(value) {
        this._fitFOV = value || 45;
    }

    get fitFOV() {
        return this._fitFOV;
    }

    /**
     * When true, will cause this CameraFlightAnimation to point the {{#crossLink "CameraFlightAnimation/camera:property"}}{{/crossLink}}
     * in the direction that it is travelling.
     *
     * @property trail
     * @type Boolean
     * @default false
     */
    set trail(value) {
        this._trail = !!value;
    }

    get trail() {
        return this._trail;
    }
}

componentClasses[type$22] = CameraFlightAnimation;

/**
 A **Clip** is an arbitrarily-aligned World-space clipping plane.

 <a href="../../examples/#effects_clipping"><img src="../../../assets/images/screenshots/Clips.png"></img></a>

 ## Overview

 * Used to slice portions off objects, to create cross-section views or reveal interiors.
 * Is contained within a {{#crossLink "Clips"}}{{/crossLink}} belonging to its {{#crossLink "Scene"}}{{/crossLink}}.
 * Has a World-space position in {{#crossLink "Clip/pos:property"}}{{/crossLink}} and orientation in {{#crossLink "Clip/dir:property"}}{{/crossLink}}.
 * Discards elements from the half-space in the direction of {{#crossLink "Clip/dir:property"}}{{/crossLink}}.
 * Can be be enabled or disabled via its {{#crossLink "Clip/active:property"}}{{/crossLink}} property.

 ## Usage

 In the example below, we have an {{#crossLink "Mesh"}}{{/crossLink}} that's attached by a {{#crossLink "Clips"}}{{/crossLink}}
 that contains two {{#crossLink "Clip"}}{{/crossLink}} components.  The first {{#crossLink "Clip"}}{{/crossLink}} is on the
 positive diagonal, while the second is on the negative diagonal. The {{#crossLink "Mesh"}}Mesh's{{/crossLink}} {{#crossLink "Geometry"}}{{/crossLink}}
 is a box, which will get two of its corners clipped off.

 ````javascript
 // Create a set of Clip planes in the default Scene
 scene.clips.clips = [

 // Clip plane on negative diagonal
 new xeogl.Clip({
         pos: [1.0, 1.0, 1.0],
         dir: [-1.0, -1.0, -1.0],
         active: true
     }),

 // Clip plane on positive diagonal
 new xeogl.Clip({
         pos: [-1.0, -1.0, -1.0],
         dir: [1.0, 1.0, 1.0],
         active: true
     })
 ];

 // Create a Mesh in the default Scene, that will be clipped by our Clip planes
 var mesh = new xeogl.Mesh({
     geometry: new xeogl.SphereGeometry(),
     clippable: true // Enable clipping (default)
 });
 ````

 ### Switching clipping on and off for a Mesh

 An {{#crossLink "Mesh"}}{{/crossLink}}'s {{#crossLink "Mesh/clippable:property"}}{{/crossLink}} property indicates
 whether or not it is affected by Clip components.

 You can switch it at any time, like this:

 ```` javascript
 // Disable clipping for the Mesh
 mesh.clippable = false;

 // Enable clipping for the Mesh
 mesh.clippable = true;
 ````

 @class Clip
 @module xeogl
 @submodule clipping
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Clip configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 You only need to supply an ID if you need to be able to find the Clip by ID within the {{#crossLink "Scene"}}Scene{{/crossLink}}.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Clip.
 @param [cfg.active=true] {Boolean} Indicates whether or not this Clip is active.
 @param [cfg.pos=[0,0,0]] {Array of Number} World-space position of the clipping plane.
 @param [cfg.dir=[0,0 -1]] {Array of Number} Vector perpendicular to the plane surface, indicating its orientation.
 @extends Component
 */
const type$23 = 'xeogl.Clip';

class Clip extends Component {
    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$23;
    }

    init(cfg) {
        super.init(cfg);

        this._state = new State({
            active: true,
            pos: new Float32Array(3),
            dir: new Float32Array(3)
        });

        this.active = cfg.active;
        this.pos = cfg.pos;
        this.dir = cfg.dir;

        this.scene._clipCreated(this);
    }

    /**
     Indicates whether this Clip is active or not.

     @property active
     @default true
     @type Boolean
     */
    set active(value) {
        this._state.active = value !== false;
        this._renderer.imageDirty();
        /**
         Fired whenever this Clip's {{#crossLink "Clip/active:property"}}{{/crossLink}} property changes.

         @event active
         @param value {Boolean} The property's new value
         */
        this.fire('active', this._state.active);
    }

    get active() {
        return this._state.active;
    }

    /**
     The World-space position of this Clip's plane.

     @property pos
     @default [0, 0, 0]
     @type Float32Array
     */
    set pos(value) {
        this._state.pos.set(value || [0, 0, 0]);
        this._renderer.imageDirty();
        /**
         Fired whenever this Clip's {{#crossLink "Clip/pos:property"}}{{/crossLink}} property changes.

         @event pos
         @param value Float32Array The property's new value
         */
        this.fire('pos', this._state.pos);
    }

    get pos() {
        return this._state.pos;
    }

    /**
     Vector indicating the orientation of this Clip plane.

     The vector originates at {{#crossLink "Clip/pos:property"}}{{/crossLink}}. Elements on the
     same side of the vector are clipped.

     @property dir
     @default [0, 0, -1]
     @type Float32Array
     */
    set dir(value) {
        this._state.dir.set(value || [0, 0, -1]);
        this._renderer.imageDirty();
        /**
         Fired whenever this Clip's {{#crossLink "Clip/dir:property"}}{{/crossLink}} property changes.

         @event dir
         @param value {Float32Array} The property's new value
         */
        this.fire('dir', this._state.dir);
    }

    get dir() {
        return this._state.dir;
    }

    destroy() {
        this._state.destroy();
        this.scene._clipDestroyed(this);
        super.destroy();
    }
}

componentClasses[type$23] = Clip;

const type$24 = 'xeogl.ClipControl';

class ClipControl extends Component {

    get type() {
        return type$24;
    }

    init(cfg) {
        super.init(cfg);

        this._active = true;
        this._solid = false;
        this._visible = false;
        this._clipStartDir = xeogl.math.vec3();
        this._clipPos = xeogl.math.vec3();
        this._cameraControl = undefined;

        // gruppe die alle elemente fuer den ClipController
        var gumballGroup = (this._gumballGroup = new xeogl.Group(this, {
            id: 'gumballGroup',
            positions: [0, 0, 0]
        }));

        // set scene and camera of current objet
        var scene = gumballGroup.scene;
        var camera = scene.camera;

        var radius = cfg.radius === undefined ? 100 : cfg.radius;
        var hoopRadius = radius * 0.6;

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
            axis: new xeogl.CylinderGeometry(scene, {
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
            gray: new xeogl.PhongMaterial(scene, {
                diffuse: [0.6, 0.6, 0.6],
                ambient: [0.0, 0.0, 0.0],
                specular: [0.6, 0.6, 0.3],
                shininess: 80,
                lineWidth: 2
            }),
            transparentBlue: new xeogl.PhongMaterial(scene, {
                diffuse: [0.3, 0.3, 1.0],
                ambient: [0.0, 0.0, 0.0],
                specular: [0.6, 0.6, 0.3],
                shininess: 80,
                lineWidth: 2,
                alpha: 0.8,
                alphaMode: 'blend'
            }),
            highlightBlue: new xeogl.EmphasisMaterial(scene, {
                edges: false,
                fill: true,
                fillColor: [0, 0, 1],
                fillAlpha: 0.5,
                vertices: false
            }),
            ball: new xeogl.PhongMaterial(scene, {
                diffuse: [0, 0, 1],
                ambient: [0.0, 0.0, 0.0],
                specular: [0.6, 0.6, 0.3],
                shininess: 80,
                lineWidth: 2
            }),
            highlightBall: new xeogl.EmphasisMaterial(scene, {
                edges: false,
                fill: true,
                fillColor: [0.5, 0.5, 0.5],
                fillAlpha: 0.5,
                vertices: false
            }),
            highlightPlane: new xeogl.EmphasisMaterial(scene, {
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
                        emissive: [1, 0, 0],
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
                    collidable: true,
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
                    id: 'xGreenArrow',
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

        this.planeSize = cfg.planeSize;
        this.autoPlaneSize = cfg.autoPlaneSize;
        this.pos = cfg.pos;
        this.dir = cfg.dir;
        this.color = cfg.color;
        this.solid = cfg.solid;
        this.clip = cfg.clip;
        this.visible = cfg.visible;
        this.cameraControl = cfg.cameraControl;

        var self = this;
        var canvas = scene.canvas.canvas;
        var math = xeogl.math;

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

        var getClickCoordsWithinElement = event => {
            var coords = new Float32Array(2);

            if (!event) {
                event = window.event;
                coords[0] = event.x;
                coords[a] = event.y;
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

        var localToWorldVec = (localVec, worldVec) => {
            var math = xeogl.math;
            var mat = math.mat4();

            math.quaternionToMat4(self._gumballGroup.quaternion, mat);
            math.transformVec3(mat, localVec, worldVec);
            math.normalizeVec3(worldVec);
            return worldVec;
        };

        var pan = (localAxis, fromMouse, toMouse) => {
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

            self._clipPos[0] += worldAxis[0] * dot;
            self._clipPos[1] += worldAxis[1] * dot;
            self._clipPos[2] += worldAxis[2] * dot;

            self._gumballGroup.position = self._clipPos;
            if (self._attached.clip) {
                self._attached.clip.pos = self._clipPos;
            }
        };

        var getTranslationPlane = worldAxis => {
            var planeNormal = math.vec3();

            // find a best fit to find intersections with
            var absX = Math.abs(worldAxis.x);
            if (absX > Math.abs(worldAxis.y) && absX > Math.abs(worldAxis.z))
                math.cross3Vec3(worldAxis, [0, 1, 0], planeNormal);
            else math.cross3Vec3(worldAxis, [1, 0, 0], planeNormal);

            math.cross3Vec3(planeNormal, worldAxis, planeNormal);

            math.normalizeVec3(planeNormal);
            return planeNormal;
        };

        var rotate = (localAxis, fromMouse, toMouse) => {
            var p1 = math.vec4();
            var p2 = math.vec4();
            var c = math.vec4();
            var worldAxis = math.vec4();

            localToWorldVec(localAxis, worldAxis);

            var dot;
            var hasData = getMouseVectorOnPlane(fromMouse, worldAxis, p1);
            hasData = hasData && getMouseVectorOnPlane(toMouse, worldAxis, p2);

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
            if (math.dotVec3(c, worldAxis) < 0.0) incDegrees = -incDegrees;

            self._gumballGroup.rotate(localAxis, incDegrees);
            rotateClip();
        };

        // this returns the vector that points from the gumball origin to where the mouse ray intersects the plane
        var getMouseVectorOnPlane = (mouse, axis, dest, offset) => {
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

        var rotateClip = () => {
            var math = xeogl.math;
            var dir = math.vec3();
            var mat = math.mat4();

            if (self._attached.clip) {
                math.quaternionToMat4(self._gumballGroup.quaternion, mat); // << ---
                math.transformVec3(mat, [0, 0, 1], dir);
                self._attached.clip.dir = dir;
            }
        };

        var pick = canvasPos => {
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
            if (!self._active) {
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
            if (!self._active) {
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
            if (!self._active) {
                return;
            }
            switch (e.which) {
                case 1: // Left button
                    
                    break;
                case 2: // Middle/both buttons
                    
                    break;
                case 3: // Right button
                    
                    break;
                default:
                    break;
            }
            down = false;
            // reset parent cameraControl to true
            self._cameraControl.active = true;
        });

        canvas.addEventListener('mouseenter', function() {
            if (!self._active) {
                return;
            }
            over = true;
        });

        canvas.addEventListener('mouseleave', function() {
            if (!self._active) {
                return;
            }
            over = false;
        });

        canvas.addEventListener('wheel', function(e) {
            if (!self._active) {
                return;
            }
            var delta = Math.max(-1, Math.min(1, -e.deltaY * 40));
            if (delta === 0) {
                return;
            }
            e.preventDefault();
        });

        function updateControls(mouse, oldMouse) {
            if (dragAction === DRAG_ACTIONS.none) {
                return;
            }

            self._cameraControl.active = false;

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
     * The width and height of the PlaneHelper plane indicator.
     *
     * Values assigned to this property will be overridden by an auto-computed value when
     * {{#crossLink "PlaneHelper/autoPlaneSize:property"}}{{/crossLink}} is true.
     *
     * @property planeSize
     * @default [1,1]
     * @type {Float32Array}
     */
    set planeSize(value) {
        (this._planeSize = this._planeSize || xeogl.math.vec2()).set(
            value || [1, 1]
        );
        //this._gumballGroup.scale = [this._planeSize[0], this._planeSize[1], 1.0];
    }

    get planeSize() {
        return this._planeSize;
    }

    /**
     * Indicates whether this PlaneHelper's {{#crossLink "PlaneHelper/planeSize:property"}}{{/crossLink}} is automatically
     * generated or not.
     *
     * When auto-generated, {{#crossLink "PlaneHelper/planeSize:property"}}{{/crossLink}} will automatically size
     * to fit within the {{#crossLink "Scene/aabb:property"}}Scene's boundary{{/crossLink}}.
     *
     * @property autoPlaneSize
     * @default false
     * @type {Boolean}
     */
    set autoPlaneSize(value) {
        value = !!value;

        if (this._autoPlaneSize === value) {
            return;
        }

        this._autoPlaneSize = value;

        if (this._autoPlaneSize) {
            if (!this._onSceneAABB) {
                this._onSceneAABB = this.scene.on(
                    'boundary',
                    function() {
                        const aabbDiag = xeogl.math.getAABB3Diag(
                            this.scene.aabb
                        );
                        const clipSize = aabbDiag * 0.5;
                        this.planeSize = [clipSize, clipSize];
                    },
                    this
                );
            }
        } else {
            if (this._onSceneAABB) {
                this.scene.off(this._onSceneAABB);
                this._onSceneAABB = null;
            }
        }
    }

    get color() {
        return this._autoPlaneSize;
    }

    /**
     * Emmissive color of this PlaneHelper.
     *
     * @property color
     * @default [0.4,0.4,0.4]
     * @type {Float32Array}
     */
    set color(value) {
        (this._color = this._color || xeogl.math.vec3()).set(
            value || [0.4, 0.4, 0.4]
        );
        this._display.planeWire.material.emissive = this._color;
    }

    get color() {
        return this._color;
    }

    /**
     Indicates whether this PlaneHelper is filled with color or just wireframe.

     @property solid
     @default true
     @type Boolean
     */
    set solid(value) {
        this._solid = value !== false;
        this._display.planeSolid.visible = this._solid && this._visible;
    }

    get solid() {
        return this._solid;
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

    _setGumballPos(xyz) {
        this._clipPos.set(xyz);
        this._gumballGroup.position = xyz;
    }

    _setGumballDir(xyz) {
        var zeroVec = new Float32Array([0, 0, 1]);
        var quat = new Float32Array(4);
        this._clipStartDir.set(xyz);
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

componentClasses[type$24] = ClipControl;

/**
 Rotates, pans and zooms the {{#crossLink "Scene"}}{{/crossLink}}'s {{#crossLink "Camera"}}{{/crossLink}} with keyboard, mouse and touch input.

 CameraControl fires these events:

 * "hover" - Hover enters a new object
 * "hoverSurface" - Hover continues over an object surface - fired continuously as mouse moves over an object
 * "hoverLeave"  - Hover has left the last object we were hovering over
 * "hoverOff" - Hover continues over empty space - fired continuously as mouse moves over nothing
 * "picked" - Clicked or tapped object
 * "pickedSurface" -  Clicked or tapped object, with event containing surface intersection details
 * "doublePicked" - Double-clicked or double-tapped object
 * "doublePickedSurface" - Double-clicked or double-tapped object, with event containing surface intersection details
 * "pickedNothing" - Clicked or tapped, but not on any objects
 * "doublePickedNothing" - Double-clicked or double-tapped, but not on any objects

 CameraControl only fires "hover" events when the mouse is up.

 For efficiency, CameraControl only does surface intersection picking when you subscribe to "doublePicked" and
 "doublePickedSurface" events. Therefore, only subscribe to those when you're OK with the overhead incurred by the
 surface intersection tests.

 ## Panning

 ## Rotating

 ## Pivoting

 ## Zooming

 ## Events

 ## Activating and deactivating

 ## Inertia

 ## First person

 ## Zoom to pointer

 TODO: describe only works for first-person
 TODO: make configurable?

 ## Keyboard layout

 # Fly-to


 @class CameraControl
 @module xeogl
 @submodule controls
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this CameraControl.
 @param [cfg.firstPerson=false] {Boolean} Whether or not this CameraControl is in "first person" mode.
 @param [cfg.walking=false] {Boolean} Whether or not this CameraControl is in "walking" mode.
 @param [cfg.keyboardLayout="qwerty"] {String} Keyboard layout.
 @param [cfg.doublePickFlyTo=true] {Boolean} Whether to fly the camera to each {{#crossLink "Mesh"}}{{/crossLink}} that's double-clicked.
 @param [cfg.active=true] {Boolean} Indicates whether or not this CameraControl is active.
 @param [cfg.pivoting=false] {Boolean} When true, clicking on a {{#crossLink "Mesh"}}{{/crossLink}} and dragging will pivot
 the {{#crossLink "Camera"}}{{/crossLink}} about the picked point on the Mesh's surface.
 @param [cfg.panToPointer=false] {Boolean} When true, mouse wheel when mouse is over a {{#crossLink "Mesh"}}{{/crossLink}} will zoom
 the {{#crossLink "Camera"}}{{/crossLink}} towards the hoveredd point on the Mesh's surface.
 @param [cfg.panToPivot=false] {Boolean} TODO.
 @param [cfg.inertia=0.5] {Number} A factor in range [0..1] indicating how much the camera keeps moving after you finish panning or rotating it.
 @param [cfg.userZoomFactor=1] {Double} user-set zoom factor that is multiplied with the standard value - that means setting it to 0.5 will
 lead to a zoom 50% slower, setting it to 2 will make it twice as fast...
 @param [cfg.userPanFactor=1] {Double} user-set pan factor that is multiplied with the standard value - that means setting it to 0.5 will
 lead to a zoom 50% slower, setting it to 2 will make it twice as fast...
 @param [cfg.userRotateFactor=1] {Double} user-set rotation factor that is multiplied with the standard value - that means setting it to 0.5 will
 lead to a zoom 50% slower, setting it to 2 will make it twice as fast...
 @author xeolabs / http://xeolabs.com
 @author DerSchmale / http://www.derschmale.com
 @extends Component
 */

const type$25 = "xeogl.CameraControl";

class CameraControl extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$25;
    }

    init(cfg) {

        super.init(cfg);

        const self = this;

        this._boundaryHelper = new Mesh(this, {
            geometry: new AABBGeometry(this),
            material: new PhongMaterial(this, {
                diffuse: [0, 0, 0],
                ambient: [0, 0, 0],
                specular: [0, 0, 0],
                emissive: [1.0, 1.0, 0.6],
                lineWidth: 4
            }),
            visible: false,
            collidable: false
        });

        this._pivoter = new (function () { // Pivots the Camera around an arbitrary World-space position

            // Pivot math by: http://www.derschmale.com/

            const scene = self.scene;
            const camera = scene.camera;
            const canvas = scene.canvas;
            const pivotPoint = new Float32Array(3);
            let cameraOffset;
            let azimuth = 0;
            let polar = 0;
            let radius = 0;
            let pivoting = false; // True while pivoting

            const spot = document.createElement("div");
            spot.innerText = " ";
            spot.style.color = "#ffffff";
            spot.style.position = "absolute";
            spot.style.width = "25px";
            spot.style.height = "25px";
            spot.style.left = "0px";
            spot.style.top = "0px";
            spot.style["border-radius"] = "15px";
            spot.style["border"] = "2px solid #ffffff";
            spot.style["background"] = "black";
            spot.style.visibility = "hidden";
            spot.style["box-shadow"] = "5px 5px 15px 1px #000000";
            spot.style["z-index"] = 0;
            spot.style["pointer-events"] = "none";
            document.body.appendChild(spot);

            (function () {
                const viewPos = math.vec4();
                const projPos = math.vec4();
                const canvasPos = math.vec2();
                let distDirty = true;
                camera.on("viewMatrix", function () {
                    distDirty = true;
                });
                camera.on("projMatrix", function () {
                    distDirty = true;
                });
                scene.on("tick", function () {
                    if (pivoting && distDirty) {
                        math.transformPoint3(camera.viewMatrix, pivotPoint, viewPos);
                        viewPos[3] = 1;
                        math.transformPoint4(camera.projMatrix, viewPos, projPos);
                        const aabb = canvas.boundary;
                        canvasPos[0] = Math.floor((1 + projPos[0] / projPos[3]) * aabb[2] / 2);
                        canvasPos[1] = Math.floor((1 - projPos[1] / projPos[3]) * aabb[3] / 2);
                        const canvasElem = canvas.canvas;
                        const rect = canvasElem.getBoundingClientRect();
                        spot.style.left = (Math.floor(rect.left + canvasPos[0]) - 12) + "px";
                        spot.style.top = (Math.floor(rect.top + canvasPos[1]) - 12) + "px";
                        spot.style.visibility = "visible";
                        distDirty = false;
                    }
                });
            })();

            this.startPivot = function (worldPos) {
                if (worldPos) { // Use last pivotPoint by default
                    pivotPoint.set(worldPos);
                }
                let lookat = math.lookAtMat4v(camera.eye, camera.look, camera.worldUp);
                cameraOffset = math.transformPoint3(lookat, pivotPoint);
                cameraOffset[2] += math.distVec3(camera.eye, pivotPoint);
                lookat = math.inverseMat4(lookat);
                const offset = math.transformVec3(lookat, cameraOffset);
                const diff = math.vec3();
                math.subVec3(camera.eye, pivotPoint, diff);
                math.addVec3(diff, offset);
                if (camera.worldUp[2] === 1) {
                    const t = diff[1];
                    diff[1] = diff[2];
                    diff[2] = t;
                }
                radius = math.lenVec3(diff);
                polar = Math.acos(diff[1] / radius);
                azimuth = Math.atan2(diff[0], diff[2]);
                pivoting = true;
            };

            this.getPivoting = function () {
                return pivoting;
            };

            this.getPivotPos = function () {
                return pivotPoint;
            };

            this.continuePivot = function (yawInc, pitchInc) {
                if (!pivoting) {
                    return;
                }
                if (yawInc === 0 && pitchInc === 0) {
                    return;
                }
                if (camera.worldUp[2] === 1) {
                    dx = -dx;
                }
                var dx = -yawInc;
                const dy = -pitchInc;
                azimuth += -dx * .01;
                polar += dy * .01;
                polar = math.clamp(polar, .001, Math.PI - .001);
                const pos = [
                    radius * Math.sin(polar) * Math.sin(azimuth),
                    radius * Math.cos(polar),
                    radius * Math.sin(polar) * Math.cos(azimuth)
                ];
                if (camera.worldUp[2] === 1) {
                    const t = pos[1];
                    pos[1] = pos[2];
                    pos[2] = t;
                }
                // Preserve the eye->look distance, since in xeogl "look" is the point-of-interest, not the direction vector.
                const eyeLookLen = math.lenVec3(math.subVec3(camera.look, camera.eye, math.vec3()));
                math.addVec3(pos, pivotPoint);
                let lookat = math.lookAtMat4v(pos, pivotPoint, camera.worldUp);
                lookat = math.inverseMat4(lookat);
                const offset = math.transformVec3(lookat, cameraOffset);
                lookat[12] -= offset[0];
                lookat[13] -= offset[1];
                lookat[14] -= offset[2];
                const zAxis = [lookat[8], lookat[9], lookat[10]];
                camera.eye = [lookat[12], lookat[13], lookat[14]];
                math.subVec3(camera.eye, math.mulVec3Scalar(zAxis, eyeLookLen), camera.look);
                camera.up = [lookat[4], lookat[5], lookat[6]];
                spot.style.visibility = "visible";
            };

            this.endPivot = function () {
                spot.style.visibility = "hidden";
                pivoting = false;
            };

        })();

        this._cameraFlight = new CameraFlightAnimation(this, {
            duration: 0.5
        });

        this.firstPerson = cfg.firstPerson;
        this.walking = cfg.walking;
        this.keyboardLayout = cfg.keyboardLayout;
        this.doublePickFlyTo = cfg.doublePickFlyTo;
        this.active = cfg.active;
        this.pivoting = cfg.pivoting;
        this.panToPointer = cfg.panToPointer;
        this.panToPivot = cfg.panToPivot;
        this.inertia = cfg.inertia;
        this.userZoomFactor = cfg.userZoomFactor ? cfg.userZoomFactor : 1.0;
        this.userPanFactor = cfg.userPanFactor ? cfg.userPanFactor : 1.0;
        this.userRotateFactor = cfg.userRotateFactor ? cfg.userRotateFactor : 1.0;

        this._initEvents(); // Set up all the mouse/touch/kb handlers
    }

    /**
     Indicates whether this CameraControl is active or not.

     @property active
     @default true
     @type Boolean
     */
    set active(value) {
        this._active = value !== false;
    }

    get active() {
        return this._active;
    }

    /**
     When true, clicking on a {{#crossLink "Mesh"}}{{/crossLink}} and dragging will pivot
     the {{#crossLink "Camera"}}{{/crossLink}} about the picked point on the Mesh's surface.

     @property pivoting
     @default false
     @type Boolean
     */
    set pivoting(value) {
        this._pivoting = !!value;
    }

    get pivoting() {
        return this._pivoting;
    }

    /**
     When true, mouse wheel when mouse is over a {{#crossLink "Mesh"}}{{/crossLink}} will zoom
     the {{#crossLink "Camera"}}{{/crossLink}} towards the hovered point on the Mesh's surface.

     @property panToPointer
     @default false
     @type Boolean
     */
    set panToPointer(value) {
        this._panToPointer = !!value;
        if (this._panToPointer) {
            this._panToPivot = false;
        }
    }

    get panToPointer() {
        return this._panToPointer;
    }

    /**
     When true, mouse wheel when mouse is over a {{#crossLink "Mesh"}}{{/crossLink}} will zoom
     the {{#crossLink "Camera"}}{{/crossLink}} towards the pivot point.

     @property panToPivot
     @default false
     @type Boolean
     */
    set panToPivot(value) {
        this._panToPivot = !!value;
        if (this._panToPivot) {
            this._panToPointer = false;
        }
    }

    get panToPivot() {
        return this._panToPivot;
    }

    /**
     Indicates whether this CameraControl is in "first person" mode.

     In "first person" mode (disabled by default) the look position rotates about the eye position. Otherwise,
     the eye rotates about the look.

     @property firstPerson
     @default false
     @type Boolean
     */
    set firstPerson(value) {
        this._firstPerson = !!value;
    }

    get firstPerson() {
        return this._firstPerson;
    }

    /**modified!!!!! added a zoom, pan and rotation factor that the user can modify

    @property userZoomFactor
    @default 1.0
    @type float
    */
    set userZoomFactor(value) {
        this._userZoomFactor = value === undefined ? 1.0 : value;
    }

    get userZoomFactor() {
        return this._userZoomFactor;
    }

    /**
    @property userPanFactor
    @default 1.0
    @type float
    */

    set userPanFactor(value) {
        this._userPanFactor = value === undefined ? 1.0 : value;
    }

    get userPanFactor() {
        return this._userPanFactor;
    }

    /**
    @property userRotateFactor
    @default 1.0
    @type float
    */

    set userRotateFactor(value) {
        this._userRotateFactor = value === undefined ? 1.0 : value;
    }

    get userRotateFacort() {
        return this._userRotateFactor;
    }

    /**
     Indicates whether this CameraControl is in "walking" mode.

     When set true, this constrains eye movement to the horizontal X-Z plane. When doing a walkthrough,
     this is useful to allow us to look upwards or downwards as we move, while keeping us moving in the
     horizontal plane.

     This only has an effect when also in "first person" mode.

     @property walking
     @default false
     @type Boolean
     */
    set walking(value) {
        this._walking = !!value;
    }

    get walking() {
        return this._walking;
    }

    /**
     * TODO
     *
     *
     * @property doublePickFlyTo
     * @default true
     * @type Boolean
     */
    set doublePickFlyTo(value) {
        this._doublePickFlyTo = value !== false;
    }

    get doublePickFlyTo() {
        return this._doublePickFlyTo;
    }

    /**
     Factor in range [0..1] indicating how much the camera keeps moving after you finish
     panning or rotating it.

     A value of 0.0 causes it to immediately stop, 0.5 causes its movement to decay 50% on each tick,
     while 1.0 causes no decay, allowing it continue moving, by the current rate of pan or rotation.

     You may choose an inertia of zero when you want be able to precisely position or rotate the camera,
     without interference from inertia. ero inertia can also mean that less frames are rendered while
     you are positioning the camera.

     @property inertia
     @default 0.5
     @type Number
     */
    set inertia(value) {
        this._inertia = value === undefined ? 0.5 : value;
    }

    get inertia() {
        return this._inertia;
    }

    /**
     * TODO
     *
     * @property keyboardLayout
     * @default "qwerty"
     * @type String
     */
    set keyboardLayout(value) {
        this._keyboardLayout = value || "qwerty";
    }

    get keyboardLayout() {
        return this._keyboardLayout;
    }

    _initEvents() {

        const self = this;
        const scene = this.scene;
        const input = scene.input;
        const camera = scene.camera;
        const math$$1 = xeogl.math;
        const canvas = this.scene.canvas.canvas;
        let over = false;
        const mouseOrbitRate = 0.3;
        const mousePanRate = 0.3;
        const mouseZoomRate = 0.2;
        const keyboardOrbitRate = .02;
        const keyboardPanRate = .02;
        const keyboardZoomRate = .02;
        const touchRotateRate = 0.12;
        const touchPanRate = 0.05;
        const touchZoomRate = 0.01;

        canvas.oncontextmenu = function (e) {
            e.preventDefault();
        };

        const getCanvasPosFromEvent = function (event, canvasPos) {
            if (!event) {
                event = window.event;
                canvasPos[0] = event.x;
                canvasPos[1] = event.y;
            } else {
                let element = event.target;
                let totalOffsetLeft = 0;
                let totalOffsetTop = 0;
                while (element.offsetParent) {
                    totalOffsetLeft += element.offsetLeft;
                    totalOffsetTop += element.offsetTop;
                    element = element.offsetParent;
                }
                canvasPos[0] = event.pageX - totalOffsetLeft;
                canvasPos[1] = event.pageY - totalOffsetTop;
            }
            return canvasPos;
        };

        const pickCursorPos = [0, 0];
        let needPickMesh = false;
        let needPickSurface = false;
        let lastPickedMeshId;
        let hit;
        let pickedSurface = false;

        function updatePick() {
            if (!needPickMesh && !needPickSurface) {
                return;
            }
            pickedSurface = false;
            if (needPickSurface || self.hasSubs("hoverSurface")) {
                hit = scene.pick({
                    pickSurface: true,
                    canvasPos: pickCursorPos
                });
            } else { // needPickMesh == true
                hit = scene.pick({
                    canvasPos: pickCursorPos
                });
            }
            if (hit) {
                const pickedMeshId = hit.mesh.id;
                if (lastPickedMeshId !== pickedMeshId) {
                    if (lastPickedMeshId !== undefined) {

                        /**
                         * Fired whenever the pointer no longer hovers over an {{#crossLink "Mesh"}}{{/crossLink}}.
                         * @event hoverOut
                         * @param mesh The Mesh
                         */
                        self.fire("hoverOut", {
                            mesh: scene.meshes[lastPickedMeshId]
                        });
                    }

                    /**
                     * Fired when the pointer is over a new {{#crossLink "Mesh"}}{{/crossLink}}.
                     * @event hoverEnter
                     * @param hit A pick hit result containing the ID of the Mesh - see {{#crossLink "Scene/pick:method"}}Scene#pick(){{/crossLink}}.
                     */
                    self.fire("hoverEnter", hit);
                    lastPickedMeshId = pickedMeshId;
                }
                /**
                 * Fired continuously while the pointer is moving while hovering over an {{#crossLink "Mesh"}}{{/crossLink}}.
                 * @event hover
                 * @param hit A pick hit result containing the ID of the Mesh - see {{#crossLink "Scene/pick:method"}}Scene#pick(){{/crossLink}}.
                 */
                self.fire("hover", hit);
                if (hit.worldPos) {
                    pickedSurface = true;

                    /**
                     * Fired while the pointer hovers over the surface of an {{#crossLink "Mesh"}}{{/crossLink}}.
                     *
                     * This event provides 3D information about the point on the surface that the pointer is
                     * hovering over.
                     *
                     * @event hoverSurface
                     * @param hit A surface pick hit result, containing the ID of the Mesh and 3D info on the
                     * surface position - see {{#crossLink "Scene/pick:method"}}Scene#pick(){{/crossLink}}.
                     */
                    self.fire("hoverSurface", hit);
                }
            } else {
                if (lastPickedMeshId !== undefined) {
                    /**
                     * Fired whenever the pointer no longer hovers over an {{#crossLink "Mesh"}}{{/crossLink}}.
                     * @event hoverOut
                     * @param mesh The Mesh
                     */
                    self.fire("hoverOut", {
                        mesh: scene.meshes[lastPickedMeshId]
                    });
                    lastPickedMeshId = undefined;
                }
                /**
                 * Fired continuously while the pointer is moving but not hovering over anything.
                 *
                 * @event hoverOff
                 */
                self.fire("hoverOff", {
                    canvasPos: pickCursorPos
                });
            }
            needPickMesh = false;
            needPickSurface = false;
        }

        scene.on("tick", updatePick);

        //------------------------------------------------------------------------------------
        // Mouse, touch and keyboard camera control
        //------------------------------------------------------------------------------------

        (function () {

            let rotateVx = 0;
            let rotateVy = 0;
            let panVx = 0;
            let panVy = 0;
            let panVz = 0;
            let vZoom = 0;
            const mousePos = math$$1.vec2();
            let panToMouse = false;

            let ctrlDown = false;
            let altDown = false;
            let shiftDown = false;
            const keyDown = {};

            const EPSILON = 0.001;

            const getEyeLookDist = (function () {
                const vec = new Float32Array(3);
                return function () {
                    return math$$1.lenVec3(math$$1.subVec3(camera.look, camera.eye, vec));
                };
            })();

            const getInverseProjectMat = (function () {
                let projMatDirty = true;
                camera.on("projMatrix", function () {
                    projMatDirty = true;
                });
                const inverseProjectMat = math$$1.mat4();
                return function () {
                    if (projMatDirty) {
                        math$$1.inverseMat4(camera.projMatrix, inverseProjectMat);
                    }
                    return inverseProjectMat;
                }
            })();

            const getTransposedProjectMat = (function () {
                let projMatDirty = true;
                camera.on("projMatrix", function () {
                    projMatDirty = true;
                });
                const transposedProjectMat = math$$1.mat4();
                return function () {
                    if (projMatDirty) {
                        math$$1.transposeMat4(camera.projMatrix, transposedProjectMat);
                    }
                    return transposedProjectMat;
                }
            })();

            const getInverseViewMat = (function () {
                let viewMatDirty = true;
                camera.on("viewMatrix", function () {
                    viewMatDirty = true;
                });
                const inverseViewMat = math$$1.mat4();
                return function () {
                    if (viewMatDirty) {
                        math$$1.inverseMat4(camera.viewMatrix, inverseViewMat);
                    }
                    return inverseViewMat;
                }
            })();

            const getSceneDiagSize = (function () {
                let sceneSizeDirty = true;
                let diag = 1; // Just in case
                scene.on("boundary", function () {
                    sceneSizeDirty = true;
                });
                return function () {
                    if (sceneSizeDirty) {
                        diag = math$$1.getAABB3Diag(scene.aabb);
                    }
                    return diag;
                };
            })();

            const panToMousePos = (function () {

                const cp = math$$1.vec4();
                const viewPos = math$$1.vec4();
                const worldPos = math$$1.vec4();
                const eyeCursorVec = math$$1.vec3();

                const unproject = function (inverseProjMat, inverseViewMat, mousePos, z, viewPos, worldPos) {
                    const canvas = scene.canvas.canvas;
                    const halfCanvasWidth = canvas.offsetWidth / 2.0;
                    const halfCanvasHeight = canvas.offsetHeight / 2.0;
                    cp[0] = (mousePos[0] - halfCanvasWidth) / halfCanvasWidth;
                    cp[1] = (mousePos[1] - halfCanvasHeight) / halfCanvasHeight;
                    cp[2] = z;
                    cp[3] = 1.0;
                    math$$1.mulMat4v4(inverseProjMat, cp, viewPos);
                    math$$1.mulVec3Scalar(viewPos, 1.0 / viewPos[3]); // Normalize homogeneous coord
                    viewPos[3] = 1.0;
                    viewPos[1] *= -1; // TODO: Why is this reversed?
                    math$$1.mulMat4v4(inverseViewMat, viewPos, worldPos);
                };

                return function (mousePos, factor) {

                    const lastHoverDistance = 0;
                    const inverseProjMat = getInverseProjectMat();
                    const inverseViewMat = getInverseViewMat();

                    // Get last two columns of projection matrix
                    const transposedProjectMat = getTransposedProjectMat();
                    const Pt3 = transposedProjectMat.subarray(8, 12);
                    const Pt4 = transposedProjectMat.subarray(12);
                    const D = [0, 0, -(lastHoverDistance || getSceneDiagSize()), 1];
                    const Z = math$$1.dotVec4(D, Pt3) / math$$1.dotVec4(D, Pt4);

                    unproject(inverseProjMat, inverseViewMat, mousePos, Z, viewPos, worldPos);

                    math$$1.subVec3(worldPos, camera.eye, eyeCursorVec);
                    math$$1.normalizeVec3(eyeCursorVec);

                    const px = eyeCursorVec[0] * factor;
                    const py = eyeCursorVec[1] * factor;
                    const pz = eyeCursorVec[2] * factor;

                    const eye = camera.eye;
                    const look = camera.look;

                    camera.eye = [eye[0] + px, eye[1] + py, eye[2] + pz];
                    camera.look = [look[0] + px, look[1] + py, look[2] + pz];
                };
            })();

            const panToWorldPos = (function () {
                const eyeCursorVec = math$$1.vec3();
                return function (worldPos, factor) {
                    math$$1.subVec3(worldPos, camera.eye, eyeCursorVec);
                    math$$1.normalizeVec3(eyeCursorVec);
                    const px = eyeCursorVec[0] * factor;
                    const py = eyeCursorVec[1] * factor;
                    const pz = eyeCursorVec[2] * factor;
                    const eye = camera.eye;
                    const look = camera.look;
                    camera.eye = [eye[0] + px, eye[1] + py, eye[2] + pz];
                    camera.look = [look[0] + px, look[1] + py, look[2] + pz];
                };
            })();

            scene.on("tick", function () {

                const cameraInertia = self._inertia;

                if (Math.abs(rotateVx) < EPSILON) {
                    rotateVx = 0;
                }

                if (Math.abs(rotateVy) < EPSILON) {
                    rotateVy = 0;
                }

                if (rotateVy !== 0 || rotateVx !== 0) {

                    if (self._pivoter.getPivoting()) {
                        self._pivoter.continuePivot(rotateVy, rotateVx);

                    } else {

                        if (rotateVx !== 0) {

                            if (self._firstPerson) {
                                camera.pitch(-rotateVx);

                            } else {
                                camera.orbitPitch(rotateVx);
                            }
                        }

                        if (rotateVy !== 0) {

                            if (self._firstPerson) {
                                camera.yaw(rotateVy);

                            } else {
                                camera.orbitYaw(rotateVy);
                            }
                        }
                    }

                    rotateVx *= cameraInertia;
                    rotateVy *= cameraInertia;
                }

                if (Math.abs(panVx) < EPSILON) {
                    panVx = 0;
                }

                if (Math.abs(panVy) < EPSILON) {
                    panVy = 0;
                }

                if (Math.abs(panVz) < EPSILON) {
                    panVz = 0;
                }

                if (panVx !== 0 || panVy !== 0 || panVz !== 0) {
                    const f = getEyeLookDist() / 80;
                    if (self._walking) {
                        var y = camera.eye[1];
                        camera.pan([panVx * f, panVy * f, panVz * f]);
                        var eye = camera.eye;
                        eye[1] = y;
                        camera.eye = eye;
                    } else {
                        camera.pan([panVx * f, panVy * f, panVz * f]);
                    }
                }

                panVx *= cameraInertia;
                panVy *= cameraInertia;
                panVz *= cameraInertia;

                if (Math.abs(vZoom) < EPSILON) {
                    vZoom = 0;
                }

                if (vZoom !== 0) {
                    if (self._firstPerson) {
                        var y;
                        if (self._walking) {
                            y = camera.eye[1];
                        }
                        if (panToMouse) { // Using mouse input
                            panToMousePos(mousePos, -vZoom * 2);
                        } else {
                            camera.pan([0, 0, vZoom]); // Touchscreen input with no cursor
                        }
                        if (self._walking) {
                            var eye = camera.eye;
                            eye[1] = y;
                            camera.eye = eye;
                        }
                    } else {
                        // Do both zoom and ortho scale so that we can switch projections without weird scale jumps
                        if (self._panToPointer) {
                            updatePick();
                            if (pickedSurface) {
                                panToWorldPos(hit.worldPos, -vZoom);
                            } else {
                                camera.zoom(vZoom);
                            }
                        } else if (self._panToPivot) {
                            panToWorldPos(self._pivoter.getPivotPos(), -vZoom); // FIXME: What about when pivotPos undefined?
                        } else {
                            camera.zoom(vZoom);
                        }
                        camera.ortho.scale = camera.ortho.scale + vZoom;
                    }
                    vZoom *= cameraInertia;
                }
            });

            function getZoomRate() {
                const aabb = scene.aabb;
                const xsize = aabb[3] - aabb[0];
                const ysize = aabb[4] - aabb[1];
                const zsize = aabb[5] - aabb[2];
                let max = (xsize > ysize ? xsize : ysize);
                max = (zsize > max ? zsize : max);
                return max / 30;
            }

            document.addEventListener("keyDown", function (e) {
                if (!self._active) {
                    return;
                }
                if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
                    ctrlDown = e.ctrlKey || e.keyCode === 17 || e.metaKey; // !important, treat Windows or Mac Command Key as ctrl
                    altDown = e.altKey || e.keyCode === 18;
                    shiftDown = e.keyCode === 16;
                    keyDown[e.keyCode] = true;
                }
            }, true);

            document.addEventListener("keyup", function (e) {
                if (!self._active) {
                    return;
                }
                if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
                    if (e.ctrlKey || e.keyCode === 17) {
                        ctrlDown = false;
                    }
                    if (e.altKey || e.keyCode === 18) {
                        altDown = false;
                    }
                    if (e.keyCode === 16) {
                        shiftDown = false;
                    }
                    keyDown[e.keyCode] = false;
                }
            });

            // Mouse camera rotate, pan and zoom

            (function () {

                let lastX;
                let lastY;
                let xDelta = 0;
                let yDelta = 0;
                let down = false;

                let mouseDownRight;

                canvas.addEventListener("mousedown", function (e) {
                    if (!self._active) {
                        return;
                    }
                    over = true;
                    switch (e.which) {
                        case 1: // Left button
                            
                            down = true;
                            xDelta = 0;
                            yDelta = 0;
                            getCanvasPosFromEvent(e, mousePos);
                            lastX = mousePos[0];
                            lastY = mousePos[1];
                            break;
                        case 2: // Middle/both buttons
                            
                            break;
                        case 3: // Right button
                            mouseDownRight = true;
                            down = true;
                            xDelta = 0;
                            yDelta = 0;
                            getCanvasPosFromEvent(e, mousePos);
                            lastX = mousePos[0];
                            lastY = mousePos[1];
                            break;
                            break;
                        default:
                            break;
                    }
                });

                canvas.addEventListener("mouseup", function (e) {
                    if (!self._active) {
                        return;
                    }
                    switch (e.which) {
                        case 1: // Left button
                            
                            break;
                        case 2: // Middle/both buttons
                            
                            break;
                        case 3: // Right button
                            mouseDownRight = false;
                            break;
                        default:
                            break;
                    }
                    down = false;
                    xDelta = 0;
                    yDelta = 0;
                });

                document.addEventListener("mouseup", function (e) {
                    if (!self._active) {
                        return;
                    }
                    switch (e.which) {
                        case 1: // Left button
                            
                            break;
                        case 2: // Middle/both buttons
                            
                            break;
                        case 3: // Right button
                            mouseDownRight = false;
                            break;
                        default:
                            break;
                    }
                    down = false;
                    xDelta = 0;
                    yDelta = 0;
                });

                canvas.addEventListener("mouseenter", function () {
                    if (!self._active) {
                        return;
                    }
                    over = true;
                    xDelta = 0;
                    yDelta = 0;
                });

                canvas.addEventListener("mouseleave", function () {
                    if (!self._active) {
                        return;
                    }
                    over = false;
                    xDelta = 0;
                    yDelta = 0;
                });

                canvas.addEventListener("mousemove", function (e) {
                    if (!self._active) {
                        return;
                    }
                    if (!over) {
                        return;
                    }
                    getCanvasPosFromEvent(e, mousePos);
                    panToMouse = true;
                    if (!down) {
                        return;
                    }
                    const x = mousePos[0];
                    const y = mousePos[1];
                    xDelta += (x - lastX) * mouseOrbitRate * self._userRotateFactor;
                    yDelta += (y - lastY) * mouseOrbitRate * self._userRotateFactor;
                    lastX = x;
                    lastY = y;
                });

                scene.on("tick", function () {
                    if (!self._active) {
                        return;
                    }
                    if (Math.abs(xDelta) === 0 && Math.abs(yDelta) === 0) {
                        return;
                    }

                    const panning = shiftDown || mouseDownRight;

                    if (panning) {

                        // Panning

                        panVx = xDelta * mousePanRate * self._userPanFactor;
                        panVy = yDelta * mousePanRate * self._userPanFactor;

                    } else {

                        // Orbiting

                        rotateVy = -xDelta * mouseOrbitRate * self._userRotateFactor;
                        rotateVx = yDelta * mouseOrbitRate * self._userRotateFactor;
                    }

                    xDelta = 0;
                    yDelta = 0;
                });

                // Mouse wheel zoom

                canvas.addEventListener("wheel", function (e) {
                    if (!self._active) {
                        return;
                    }
                    if (self._panToPointer) {
                        needPickSurface = true;
                    }
                    const delta = Math.max(-1, Math.min(1, -e.deltaY * 40));
                    if (delta === 0) {
                        return;
                    }
                    const d = delta / Math.abs(delta);
                    vZoom = -d * getZoomRate() * mouseZoomRate * self._userZoomFactor;
                    e.preventDefault();
                });

                // Keyboard zoom

                scene.on("tick", function (e) {
                    if (!self._active) {
                        return;
                    }
                    if (!over) {
                        return;
                    }
                    const elapsed = e.deltaTime;
                    if (!self.ctrlDown && !self.altDown) {
                        const wkey = input.keyDown[input.KEY_ADD];
                        const skey = input.keyDown[input.KEY_SUBTRACT];
                        if (wkey || skey) {
                            if (skey) {
                                vZoom = elapsed * getZoomRate() * keyboardZoomRate * self._userZoomFactor;
                            } else if (wkey) {
                                vZoom = -elapsed * getZoomRate() * keyboardZoomRate * self._userZoomFactor;
                            }
                        }
                    }
                });

                // Keyboard panning

                (function () {

                    scene.on("tick", function (e) {
                        if (!self._active) {
                            return;
                        }
                        if (!over) {
                            return;
                        }

                        const elapsed = e.deltaTime;

                        // if (!self.ctrlDown && !self.altDown) {
                        let front, back, left, right, up, down;
                        if (self._keyboardLayout == 'azerty') {
                            front = input.keyDown[input.KEY_Z];
                            back = input.keyDown[input.KEY_S];
                            left = input.keyDown[input.KEY_Q];
                            right = input.keyDown[input.KEY_D];
                            up = input.keyDown[input.KEY_W];
                            down = input.keyDown[input.KEY_X];
                        } else if (self._keyboardLayout == 'qwertz') {
                            front = input.keyDown[input.KEY_W];
                            back = input.keyDown[input.KEY_S];
                            left = input.keyDown[input.KEY_A];
                            right = input.keyDown[input.KEY_D];
                            up = input.keyDown[input.KEY_Y];
                            down = input.keyDown[input.KEY_X];
                        } else {
                            front = input.keyDown[input.KEY_W];
                            back = input.keyDown[input.KEY_S];
                            left = input.keyDown[input.KEY_A];
                            right = input.keyDown[input.KEY_D];
                            up = input.keyDown[input.KEY_Z];
                            down = input.keyDown[input.KEY_X];
                        }
                        if (front || back || left || right || up || down) {
                            if (down) {
                                panVy = -elapsed * keyboardPanRate * self._userPanFactor;
                            } else if (up) {
                                panVy = elapsed * keyboardPanRate * self._userPanFactor;
                            }
                            if (right) {
                                panVx = -elapsed * keyboardPanRate * self._userPanFactor;
                            } else if (left) {
                                panVx = elapsed * keyboardPanRate * self._userPanFactor;
                            }
                            if (back) {
                                panVz = elapsed * keyboardPanRate * self._userPanFactor;
                            } else if (front) {
                                panVz = -elapsed * keyboardPanRate * self._userPanFactor;
                            }
                        }
                        //          }
                    });
                })();
            })();

            // Touch camera rotate, pan and zoom

            (function () {

                const tapStartPos = new Float32Array(2);
                const lastTouches = [];
                let numTouches = 0;

                const touch0Vec = new Float32Array(2);
                const touch1Vec = new Float32Array(2);

                const MODE_CHANGE_TIMEOUT = 50;
                const MODE_NONE = 0;
                const MODE_ROTATE = 1;
                const MODE_PAN = 1 << 1;
                const MODE_ZOOM = 1 << 2;
                let currentMode = MODE_NONE;
                let transitionTime = Date.now();

                function checkMode(mode) {
                    const currentTime = Date.now();
                    if (currentMode === MODE_NONE) {
                        currentMode = mode;
                        return true;
                    }
                    if (currentMode === mode) {
                        return currentTime - transitionTime > MODE_CHANGE_TIMEOUT;
                    }
                    currentMode = mode;
                    transitionTime = currentTime;
                    return false;
                }

                canvas.addEventListener("touchstart", function (event) {
                    if (!self._active) {
                        return;
                    }
                    const touches = event.touches;
                    const changedTouches = event.changedTouches;

                    if (touches.length === 1 && changedTouches.length === 1) {
                        tapStartPos[0] = touches[0].pageX;
                        tapStartPos[1] = touches[0].pageY;
                    } else {
                        
                    }

                    while (lastTouches.length < touches.length) {
                        lastTouches.push(new Float32Array(2));
                    }

                    for (let i = 0, len = touches.length; i < len; ++i) {
                        lastTouches[i][0] = touches[i].pageX;
                        lastTouches[i][1] = touches[i].pageY;
                    }

                    currentMode = MODE_NONE;
                    numTouches = touches.length;

                    event.stopPropagation();
                }, {
                    passive: true
                });

                canvas.addEventListener("touchmove", function (event) {
                    if (!self._active) {
                        return;
                    }
                    const touches = event.touches;

                    if (!touches[1] && numTouches === 2 || !touches[0] && numTouches === 2) //modified!!!!!###############################
                    { //obviously it is possible that numTouches===2, but one of the touches is undefined
                        // - this check avoids error messages. Was not a fatal error, nothing crashed, just errors printed
                        //therefore probably less a fix than a simple supression of errors...
                        event.stopPropagation();
                        return;
                    }

                    if (numTouches === 1) {

                        var touch0 = touches[0];

                        if (checkMode(MODE_ROTATE)) {
                            const deltaX = touch0.pageX - lastTouches[0][0];
                            const deltaY = touch0.pageY - lastTouches[0][1];
                            const rotateX = deltaX * touchRotateRate * self._userRotateFactor;
                            const rotateY = deltaY * touchRotateRate * self._userRotateFactor;
                            rotateVx = rotateY;
                            rotateVy = -rotateX;
                        }

                    } else if (numTouches === 2) {

                        var touch0 = touches[0];
                        const touch1 = touches[1];

                        math$$1.subVec2([touch0.pageX, touch0.pageY], lastTouches[0], touch0Vec);
                        math$$1.subVec2([touch1.pageX, touch1.pageY], lastTouches[1], touch1Vec);

                        const panning = math$$1.dotVec2(touch0Vec, touch1Vec) > 0;

                        if (panning && checkMode(MODE_PAN)) {
                            math$$1.subVec2([touch0.pageX, touch0.pageY], lastTouches[0], touch0Vec);
                            panVx = touch0Vec[0] * touchPanRate * self._userPanFactor;
                            panVy = touch0Vec[1] * touchPanRate * self._userPanFactor;
                        }

                        if (!panning && checkMode(MODE_ZOOM)) {
                            const d1 = math$$1.distVec2([touch0.pageX, touch0.pageY], [touch1.pageX, touch1.pageY]);
                            const d2 = math$$1.distVec2(lastTouches[0], lastTouches[1]);
                            vZoom = (d2 - d1) * getZoomRate() * touchZoomRate * self._userZoomFactor;
                        }
                    }

                    for (let i = 0; i < numTouches; ++i) {

                        if (!touches[i]) //modified!!! same as above
                        {
                            event.stopPropagation();
                            return;
                        }
                        lastTouches[i][0] = touches[i].pageX;
                        lastTouches[i][1] = touches[i].pageY;
                    }

                    event.stopPropagation();
                }, {
                    passive: true
                });

            })();

            // Keyboard rotation

            (function () {

                scene.on("tick", function (e) {
                    if (!self._active) {
                        return;
                    }
                    if (!over) {
                        return;
                    }
                    const elapsed = e.deltaTime;
                    const left = input.keyDown[input.KEY_LEFT_ARROW];
                    const right = input.keyDown[input.KEY_RIGHT_ARROW];
                    const up = input.keyDown[input.KEY_UP_ARROW];
                    const down = input.keyDown[input.KEY_DOWN_ARROW];
                    if (left || right || up || down) {
                        if (right) {
                            rotateVy += -elapsed * keyboardOrbitRate * self._userRotateFactor;

                        } else if (left) {
                            rotateVy += elapsed * keyboardOrbitRate * self._userRotateFactor;
                        }
                        if (down) {
                            rotateVx += elapsed * keyboardOrbitRate * self._userRotateFactor;

                        } else if (up) {
                            rotateVx += -elapsed * keyboardOrbitRate * self._userRotateFactor;
                        }
                    }
                });
            })();

            // First-person rotation about vertical axis with A and E keys for AZERTY layout

            (function () {

                scene.on("tick", function (e) {
                    if (!self._active) {
                        return;
                    }
                    if (!over) {
                        return;
                    }
                    const elapsed = e.deltaTime;
                    let rotateLeft;
                    let rotateRight;
                    if (self._keyboardLayout == 'azerty') {
                        rotateLeft = input.keyDown[input.KEY_A];
                        rotateRight = input.keyDown[input.KEY_E];
                    } else {
                        rotateLeft = input.keyDown[input.KEY_Q];
                        rotateRight = input.keyDown[input.KEY_E];
                    }
                    if (rotateRight || rotateLeft) {
                        if (rotateLeft) {
                            rotateVy += elapsed * keyboardOrbitRate * self._userRotateFactor;
                        } else if (rotateRight) {
                            rotateVy += -elapsed * keyboardOrbitRate * self._userRotateFactor;
                        }
                    }
                });

            })();
        })();

        //------------------------------------------------------------------------------------
        // Mouse and touch picking
        //------------------------------------------------------------------------------------

        (function () {

            // Mouse picking

            (function () {

                canvas.addEventListener("mousemove", function (e) {

                    if (!self._active) {
                        return;
                    }

                    getCanvasPosFromEvent(e, pickCursorPos);

                    if (self.hasSubs("hover") || self.hasSubs("hoverOut") || self.hasSubs("hoverOff") || self.hasSubs("hoverSurface")) {
                        needPickMesh = true;
                    }
                });

                let downX;
                let downY;
                let downCursorX;
                let downCursorY;

                canvas.addEventListener('mousedown', function (e) {
                    if (!self._active) {
                        return;
                    }
                    downX = e.clientX;
                    downY = e.clientY;
                    downCursorX = pickCursorPos[0];
                    downCursorY = pickCursorPos[1];

                    needPickSurface = self._pivoting;
                    updatePick();
                    if (self._pivoting) {
                        if (hit) {
                            self._pivoter.startPivot(hit.worldPos);
                        } else {
                            self._pivoter.startPivot(); // Continue to use last pivot point
                        }
                    }
                });

                canvas.addEventListener('mouseup', (function (e) {

                    let clicks = 0;
                    let timeout;

                    return function (e) {

                        if (!self._active) {
                            return;
                        }

                        self._pivoter.endPivot();

                        if (Math.abs(e.clientX - downX) > 3 || Math.abs(e.clientY - downY) > 3) {
                            return;
                        }

                        if (!self._doublePickFlyTo && !self.hasSubs("doublePicked") && !self.hasSubs("doublePickedSurface") && !self.hasSubs("doublePickedNothing")) {

                            //  Avoid the single/double click differentiation timeout

                            needPickSurface = !!self.hasSubs("pickedSurface");

                            updatePick();

                            if (hit) {

                                /**
                                 * Fired whenever the pointer has picked (ie. clicked or tapped) an {{#crossLink "Mesh"}}{{/crossLink}}.
                                 *
                                 * @event picked
                                 * @param hit A surface pick hit result containing the ID of the Mesh - see {{#crossLink "Scene/pick:method"}}Scene#pick(){{/crossLink}}.
                                 */
                                self.fire("picked", hit);
                                if (pickedSurface) {

                                    /**
                                     * Fired when the pointer has picked (ie. clicked or tapped) the surface of an {{#crossLink "Mesh"}}{{/crossLink}}.
                                     *
                                     * This event provides 3D information about the point on the surface that the pointer has picked.
                                     *
                                     * @event pickedSurface
                                     * @param hit A surface pick hit result, containing the ID of the Mesh and 3D info on the
                                     * surface possition - see {{#crossLink "Scene/pick:method"}}Scene#pick(){{/crossLink}}.
                                     */
                                    self.fire("pickedSurface", hit);
                                }
                            } else {

                                /**
                                 * Fired when the pointer attempted a pick (ie. clicked or tapped), but has hit nothing.
                                 *
                                 * @event pickedNothing
                                 */
                                self.fire("pickedNothing");
                            }

                            return;
                        }

                        clicks++;

                        if (clicks == 1) {
                            timeout = setTimeout(function () {

                                needPickMesh = self._doublePickFlyTo;
                                needPickSurface = needPickMesh || !!self.hasSubs("pickedSurface");
                                pickCursorPos[0] = downCursorX;
                                pickCursorPos[1] = downCursorY;

                                updatePick();

                                if (hit) {
                                    self.fire("picked", hit);
                                    if (pickedSurface) {
                                        self.fire("pickedSurface", hit);
                                    }
                                } else {
                                    self.fire("pickedNothing");
                                }

                                clicks = 0;
                            }, 250); // FIXME: Too short for track pads

                        } else {

                            clearTimeout(timeout);

                            needPickMesh = self._doublePickFlyTo;
                            needPickSurface = needPickMesh && !!self.hasSubs("doublePickedSurface");

                            updatePick();

                            if (hit) {
                                /**
                                 * Fired whenever the pointer has double-picked (ie. double-clicked or double-tapped) an {{#crossLink "Mesh"}}{{/crossLink}}.
                                 *
                                 * @event picked
                                 * @param hit A surface pick hit result containing the ID of the Mesh - see {{#crossLink "Scene/pick:method"}}Scene#pick(){{/crossLink}}.
                                 */
                                self.fire("doublePicked", hit);
                                if (pickedSurface) {
                                    /**
                                     * Fired when the pointer has double-picked (ie. double-clicked or double-tapped) the surface of an {{#crossLink "Mesh"}}{{/crossLink}}.
                                     *
                                     * This event provides 3D information about the point on the surface that the pointer has picked.
                                     *
                                     * @event doublePickedSurface
                                     * @param hit A surface pick hit result, containing the ID of the Mesh and 3D info on the
                                     * surface possition - see {{#crossLink "Scene/pick:method"}}Scene#pick(){{/crossLink}}.
                                     */
                                    self.fire("doublePickedSurface", hit);
                                }
                                if (self._doublePickFlyTo) {
                                    self._flyTo(hit);
                                }
                            } else {

                                /**
                                 * Fired when the pointer attempted a double-pick (ie. double-clicked or double-tapped), but has hit nothing.
                                 *
                                 * @event doublePickedNothing
                                 */
                                self.fire("doublePickedNothing");
                                if (self._doublePickFlyTo) {
                                    self._flyTo();
                                }
                            }
                            clicks = 0;
                        }
                    };
                })(), false);

            })();

            // Touch picking

            (function () {

                const TAP_INTERVAL = 150;
                const DBL_TAP_INTERVAL = 325;
                const TAP_DISTANCE_THRESHOLD = 4;

                let touchStartTime;
                const activeTouches = [];
                const tapStartPos = new Float32Array(2);
                let tapStartTime = -1;
                let lastTapTime = -1;

                canvas.addEventListener("touchstart", function (event) {

                    if (!self._active) {
                        return;
                    }

                    const touches = event.touches;
                    const changedTouches = event.changedTouches;

                    touchStartTime = Date.now();

                    if (touches.length === 1 && changedTouches.length === 1) {
                        tapStartTime = touchStartTime;
                        tapStartPos[0] = touches[0].pageX;
                        tapStartPos[1] = touches[0].pageY;
                    } else {
                        tapStartTime = -1;
                    }

                    while (activeTouches.length < touches.length) {
                        activeTouches.push(new Float32Array(2));
                    }

                    for (let i = 0, len = touches.length; i < len; ++i) {
                        activeTouches[i][0] = touches[i].pageX;
                        activeTouches[i][1] = touches[i].pageY;
                    }

                    activeTouches.length = touches.length;

                    event.stopPropagation();
                }, {
                    passive: true
                });

                //canvas.addEventListener("touchmove", function (event) {
                //    event.preventDefault();
                //    event.stopPropagation();
                //});

                canvas.addEventListener("touchend", function (event) {

                    if (!self._active) {
                        return;
                    }

                    const currentTime = Date.now();
                    const touches = event.touches;
                    const changedTouches = event.changedTouches;

                    // process tap

                    if (touches.length === 0 && changedTouches.length === 1) {

                        if (tapStartTime > -1 && currentTime - tapStartTime < TAP_INTERVAL) {

                            if (lastTapTime > -1 && tapStartTime - lastTapTime < DBL_TAP_INTERVAL) {

                                // Double-tap

                                pickCursorPos[0] = Math.round(changedTouches[0].clientX);
                                pickCursorPos[1] = Math.round(changedTouches[0].clientY);
                                needPickMesh = true;
                                needPickSurface = !!self.hasSubs("pickedSurface");

                                updatePick();

                                if (hit) {
                                    self.fire("doublePicked", hit);
                                    if (pickedSurface) {
                                        self.fire("doublePickedSurface", hit);
                                    }
                                    if (self._doublePickFlyTo) {
                                        self._flyTo(hit);
                                    }
                                } else {
                                    self.fire("doublePickedNothing");
                                    if (self._doublePickFlyTo) {
                                        self._flyTo();
                                    }
                                }

                                lastTapTime = -1;

                            } else if (math$$1.distVec2(activeTouches[0], tapStartPos) < TAP_DISTANCE_THRESHOLD) {

                                // Single-tap

                                pickCursorPos[0] = Math.round(changedTouches[0].clientX);
                                pickCursorPos[1] = Math.round(changedTouches[0].clientY);
                                needPickMesh = true;
                                needPickSurface = !!self.hasSubs("pickedSurface");

                                updatePick();

                                if (hit) {
                                    self.fire("picked", hit);
                                    if (pickedSurface) {
                                        self.fire("pickedSurface", hit);
                                    }
                                } else {
                                    self.fire("pickedNothing");
                                }

                                lastTapTime = currentTime;
                            }

                            tapStartTime = -1;
                        }
                    }

                    activeTouches.length = touches.length;

                    for (let i = 0, len = touches.length; i < len; ++i) {
                        activeTouches[i][0] = touches[i].pageX;
                        activeTouches[i][1] = touches[i].pageY;
                    }

                    event.stopPropagation();
                }, {
                    passive: true
                });
            })();
        })();

        //------------------------------------------------------------------------------------
        // Keyboard camera axis views
        //------------------------------------------------------------------------------------

        (function () {

            const KEY_NUM_1 = 49;
            const KEY_NUM_2 = 50;
            const KEY_NUM_3 = 51;
            const KEY_NUM_4 = 52;
            const KEY_NUM_5 = 53;
            const KEY_NUM_6 = 54;

            const center = math$$1.vec3();
            const tempVec3a = math$$1.vec3();
            const tempVec3b = math$$1.vec3();
            const tempVec3c = math$$1.vec3();

            const cameraTarget = {
                eye: new Float32Array(3),
                look: new Float32Array(3),
                up: new Float32Array(3)
            };

            document.addEventListener("keydown", function (e) {

                if (!self._active) {
                    return;
                }

                if (!over) {
                    return;
                }

                const keyCode = e.keyCode;

                if (keyCode !== KEY_NUM_1 &&
                    keyCode !== KEY_NUM_2 &&
                    keyCode !== KEY_NUM_3 &&
                    keyCode !== KEY_NUM_4 &&
                    keyCode !== KEY_NUM_5 &&
                    keyCode !== KEY_NUM_6) {
                    return;
                }

                const aabb = scene.aabb;
                const diag = math$$1.getAABB3Diag(aabb);
                center[0] = aabb[0] + aabb[3] / 2.0;
                center[1] = aabb[1] + aabb[4] / 2.0;
                center[2] = aabb[2] + aabb[5] / 2.0;
                const dist = Math.abs((diag) / Math.tan(self._cameraFlight.fitFOV / 2));

                switch (keyCode) {

                    case KEY_NUM_1: // Right

                        cameraTarget.eye.set(math$$1.mulVec3Scalar(camera.worldRight, dist, tempVec3a));
                        cameraTarget.look.set(center);
                        cameraTarget.up.set(camera.worldUp);

                        break;

                    case KEY_NUM_2: // Back

                        cameraTarget.eye.set(math$$1.mulVec3Scalar(camera.worldForward, dist, tempVec3a));
                        cameraTarget.look.set(center);
                        cameraTarget.up.set(camera.worldUp);

                        break;

                    case KEY_NUM_3: // Left

                        cameraTarget.eye.set(math$$1.mulVec3Scalar(camera.worldRight, -dist, tempVec3a));
                        cameraTarget.look.set(center);
                        cameraTarget.up.set(camera.worldUp);

                        break;

                    case KEY_NUM_4: // Front

                        cameraTarget.eye.set(math$$1.mulVec3Scalar(camera.worldForward, -dist, tempVec3a));
                        cameraTarget.look.set(center);
                        cameraTarget.up.set(camera.worldUp);

                        break;

                    case KEY_NUM_5: // Top

                        cameraTarget.eye.set(math$$1.mulVec3Scalar(camera.worldUp, dist, tempVec3a));
                        cameraTarget.look.set(center);
                        cameraTarget.up.set(math$$1.normalizeVec3(math$$1.mulVec3Scalar(camera.worldForward, 1, tempVec3b), tempVec3c));

                        break;

                    case KEY_NUM_6: // Bottom

                        cameraTarget.eye.set(math$$1.mulVec3Scalar(camera.worldUp, -dist, tempVec3a));
                        cameraTarget.look.set(center);
                        cameraTarget.up.set(math$$1.normalizeVec3(math$$1.mulVec3Scalar(camera.worldForward, -1, tempVec3b)));

                        break;

                    default:
                        return;
                }

                if (self._cameraFlight.duration > 0) {
                    self._cameraFlight.flyTo(cameraTarget);
                } else {
                    self._cameraFlight.jumpTo(cameraTarget);
                }
            });

        })();
    }

    _flyTo(hit) {

        let pos;

        if (hit && hit.worldPos) {
            pos = hit.worldPos;
        }

        const aabb = hit ? hit.mesh.aabb : this.scene.aabb;

        this._boundaryHelper.geometry.targetAABB = aabb;
        //    this._boundaryHelper.visible = true;

        if (pos) {

            // Fly to look at point, don't change eye->look dist

            const camera = this.scene.camera;
            const diff = math.subVec3(camera.eye, camera.look, []);

            this._cameraFlight.flyTo({
                    // look: pos,
                    // eye: xeogl.math.addVec3(pos, diff, []),
                    // up: camera.up,
                    aabb: aabb
                },
                this._hideBoundary, this);

            // TODO: Option to back off to fit AABB in view

        } else {

            // Fly to fit target boundary in view

            this._cameraFlight.flyTo({
                    aabb: aabb
                },
                this._hideBoundary, this);
        }
    }

    _hideBoundary() {
        //    this._boundaryHelper.visible = false;
    }

    destroy() {
        this.active = false;
        super.destroy();
    }
}

componentClasses[type$25] = CameraControl;

/**
 A **TorusGeometry** is a parameterized {{#crossLink "Geometry"}}{{/crossLink}} that defines a torus-shaped mesh for attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

 <a href="../../examples/#geometry_primitives_torus"><img src="../../assets/images/screenshots/TorusGeometry.png"></img></a>

 ## Overview

 * Dynamically modify a TorusGeometry's shape at any time by updating its {{#crossLink "TorusGeometry/center:property"}}{{/crossLink}}, {{#crossLink "TorusGeometry/radius:property"}}{{/crossLink}}, {{#crossLink "TorusGeometry/tube:property"}}{{/crossLink}},
 {{#crossLink "TorusGeometry/radialSegments:property"}}{{/crossLink}}, {{#crossLink "TorusGeometry/tubeSegments:property"}}{{/crossLink}},  and
 {{#crossLink "TorusGeometry/arc:property"}}{{/crossLink}} properties.
 * Dynamically switch its primitive type between ````"points"````, ````"lines"```` and ````"triangles"```` at any time by
 updating its {{#crossLink "Geometry/primitive:property"}}{{/crossLink}} property.

 ## Examples


 * [Textured TorusGeometry](../../examples/#geometry_primitives_torus)


 ## Usage

 An {{#crossLink "Mesh"}}{{/crossLink}} with a TorusGeometry and a {{#crossLink "PhongMaterial"}}{{/crossLink}} with
 diffuse {{#crossLink "Texture"}}{{/crossLink}}:

 ````javascript
 new xeogl.Mesh({

     geometry: new xeogl.TorusGeometry({
         center: [0,0,0],
         radius: 1.0,
         tube: 0.5,
         radialSegments: 32,
         tubeSegments: 24,
         arc: Math.PI * 2.0
     }),

     material: new xeogl.PhongMaterial({
        diffuseMap: new xeogl.Texture({
            src: "textures/diffuse/uvGrid2.jpg"
        })
     })
 });
 ````

 @class TorusGeometry
 @module xeogl
 @submodule geometry
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}},
 generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this TorusGeometry.
 @param [cfg.primitive="triangles"] {String} The primitive type. Accepted values for a TorusGeometry are 'points', 'lines' and 'triangles'.
 @param [cfg.center] {Float32Array} 3D point indicating the center position of the TorusGeometry.
 @param [cfg.radius=1] {Number} The overall radius of the TorusGeometry.
 @param [cfg.tube=0.3] {Number} The tube radius of the TorusGeometry.
 @param [cfg.radialSegments=32] {Number} The number of radial segments that make up the TorusGeometry.
 @param [cfg.tubeSegments=24] {Number} The number of tubular segments that make up the TorusGeometry.
 @param [cfg.arc=Math.PI / 2.0] {Number} The length of the TorusGeometry's arc in radians, where Math.PI*2 is a closed torus.
 @extends Geometry
 */
const type$26 = "xeogl.TorusGeometry";

class TorusGeometry extends Geometry {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$26;
    }

    init(cfg) {

        let radius = cfg.radius || 1;
        if (radius < 0) {
            this.error("negative radius not allowed - will invert");
            radius *= -1;
        }
        radius *= 0.5;

        let tube = cfg.tube || 0.3;
        if (tube < 0) {
            this.error("negative tube not allowed - will invert");
            tube *= -1;
        }

        let radialSegments = cfg.radialSegments || 32;
        if (radialSegments < 0) {
            this.error("negative radialSegments not allowed - will invert");
            radialSegments *= -1;
        }
        if (radialSegments < 4) {
            radialSegments = 4;
        }

        let tubeSegments = cfg.tubeSegments || 24;
        if (tubeSegments < 0) {
            this.error("negative tubeSegments not allowed - will invert");
            tubeSegments *= -1;
        }
        if (tubeSegments < 4) {
            tubeSegments = 4;
        }

        let arc = cfg.arc || Math.PI * 2;
        if (arc < 0) {
            this.warn("negative arc not allowed - will invert");
            arc *= -1;
        }
        if (arc > 360) {
            arc = 360;
        }

        const center = cfg.center;
        let centerX = center ? center[0] : 0;
        let centerY = center ? center[1] : 0;
        const centerZ = center ? center[2] : 0;

        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        let u;
        let v;
        let x;
        let y;
        let z;
        let vec;

        let i;
        let j;

        for (j = 0; j <= tubeSegments; j++) {
            for (i = 0; i <= radialSegments; i++) {

                u = i / radialSegments * arc;
                v = 0.785398 + (j / tubeSegments * Math.PI * 2);

                centerX = radius * Math.cos(u);
                centerY = radius * Math.sin(u);

                x = (radius + tube * Math.cos(v) ) * Math.cos(u);
                y = (radius + tube * Math.cos(v) ) * Math.sin(u);
                z = tube * Math.sin(v);

                positions.push(x + centerX);
                positions.push(y + centerY);
                positions.push(z + centerZ);

                uvs.push(1 - (i / radialSegments));
                uvs.push((j / tubeSegments));

                vec = math.normalizeVec3(math.subVec3([x, y, z], [centerX, centerY, centerZ], []), []);

                normals.push(vec[0]);
                normals.push(vec[1]);
                normals.push(vec[2]);
            }
        }

        let a;
        let b;
        let c;
        let d;

        for (j = 1; j <= tubeSegments; j++) {
            for (i = 1; i <= radialSegments; i++) {

                a = ( radialSegments + 1 ) * j + i - 1;
                b = ( radialSegments + 1 ) * ( j - 1 ) + i - 1;
                c = ( radialSegments + 1 ) * ( j - 1 ) + i;
                d = ( radialSegments + 1 ) * j + i;

                indices.push(a);
                indices.push(b);
                indices.push(c);

                indices.push(c);
                indices.push(d);
                indices.push(a);
            }
        }

        super.init(utils.apply(cfg, {
            positions: positions,
            normals: normals,
            uv: uvs,
            indices: indices
        }));
    }
}

componentClasses[type$26] = TorusGeometry;

/**
 A **SphereGeometry** is a parameterized {{#crossLink "Geometry"}}{{/crossLink}} that defines a sphere-shaped mesh for attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

 <a href="../../examples/#geometry_primitives_sphere"><img src="../../assets/images/screenshots/SphereGeometry.png"></img></a>

 ## Examples

 * [Textured SphereGeometry](../../examples/#geometry_primitives_sphere)

 ## Usage

 An {{#crossLink "Mesh"}}{{/crossLink}} with a SphereGeometry and a {{#crossLink "PhongMaterial"}}{{/crossLink}} with
 diffuse {{#crossLink "Texture"}}{{/crossLink}}:

 ````javascript
 new xeogl.Mesh({

     geometry: new xeogl.SphereGeometry({
         center: [0,0,0],
         radius: 1.5,
         heightSegments: 60,
         widthSegments: 60
     }),

     material: new xeogl.PhongMaterial({
        diffuseMap: new xeogl.Texture({
            src: "textures/diffuse/uvGrid2.jpg"
        })
     })
 });
 ````

 @class SphereGeometry
 @module xeogl
 @submodule geometry
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}},
 generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this SphereGeometry.
 @param [cfg.primitive="triangles"] {String} The primitive type. Accepted values for a SphereGeometry are 'points', 'lines' and 'triangles'.
 @param [cfg.center] {Float32Array} 3D point indicating the center position of the SphereGeometry.
 @param [cfg.radius=1] {Number}
 @param [cfg.heightSegments=24] {Number} The SphereGeometry's number of latitudinal bands.
 @param [cfg.widthSegments=18] {Number} The SphereGeometry's number of longitudinal bands.
 @param [cfg.lod=1] {Number} Level-of-detail, in range [0..1].
 @extends Geometry
 */
const type$27 = "xeogl.SphereGeometry";

class SphereGeometry extends Geometry {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$27;
    }

    init(cfg) {

        const lod = cfg.lod || 1;

        const centerX = cfg.center ? cfg.center[0] : 0;
        const centerY = cfg.center ? cfg.center[1] : 0;
        const centerZ = cfg.center ? cfg.center[2] : 0;

        let radius = cfg.radius || 1;
        if (radius < 0) {
            this.warn("negative radius not allowed - will invert");
            radius *= -1;
        }

        let heightSegments = cfg.heightSegments || 18;
        if (heightSegments < 0) {
            this.warn("negative heightSegments not allowed - will invert");
            heightSegments *= -1;
        }
        heightSegments = Math.floor(lod * heightSegments);
        if (heightSegments < 18) {
            heightSegments = 18;
        }

        let widthSegments = cfg.widthSegments || 18;
        if (widthSegments < 0) {
            this.warn("negative widthSegments not allowed - will invert");
            widthSegments *= -1;
        }
        widthSegments = Math.floor(lod * widthSegments);
        if (widthSegments < 18) {
            widthSegments = 18;
        }

        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        let i;
        let j;

        let theta;
        let sinTheta;
        let cosTheta;

        let phi;
        let sinPhi;
        let cosPhi;

        let x;
        let y;
        let z;

        let u;
        let v;

        let first;
        let second;

        for (i = 0; i <= heightSegments; i++) {

            theta = i * Math.PI / heightSegments;
            sinTheta = Math.sin(theta);
            cosTheta = Math.cos(theta);

            for (j = 0; j <= widthSegments; j++) {

                phi = j * 2 * Math.PI / widthSegments;
                sinPhi = Math.sin(phi);
                cosPhi = Math.cos(phi);

                x = cosPhi * sinTheta;
                y = cosTheta;
                z = sinPhi * sinTheta;
                u = 1.0 - j / widthSegments;
                v = i / heightSegments;

                normals.push(x);
                normals.push(y);
                normals.push(z);

                uvs.push(u);
                uvs.push(v);

                positions.push(centerX + radius * x);
                positions.push(centerY + radius * y);
                positions.push(centerZ + radius * z);
            }
        }

        for (i = 0; i < heightSegments; i++) {
            for (j = 0; j < widthSegments; j++) {

                first = (i * (widthSegments + 1)) + j;
                second = first + widthSegments + 1;

                indices.push(first + 1);
                indices.push(second + 1);
                indices.push(second);
                indices.push(first + 1);
                indices.push(second);
                indices.push(first);
            }
        }

        super.init(utils.apply(cfg, {
            positions: positions,
            normals: normals,
            uv: uvs,
            indices: indices
        }));
    }
}

componentClasses[type$27] = SphereGeometry;

/**
 An **OBBGeometry** is a {{#crossLink "Geometry"}}{{/crossLink}} that shows the extents of an oriented bounding box (OBB).

 <a href="../../examples/#geometry_primitives_OBBGeometry"><img src="http://i.giphy.com/3o6ZsSVy0NKXZ1vDSo.gif"></img></a>

 ## Overview

 * A World-space OBB a bounding box that's oriented to its contents, given as a 32-element array containing the homogeneous coordinates for the eight corner vertices, ie. each having elements [x,y,z,w].
 * Set an OBBGeometry's {{#crossLink "OBBGeometry/targetOBB:property"}}{{/crossLink}} property to an OBB to fix it to those extents, or
 * Set an OBBGeometry's {{#crossLink "OBBGeometry/target:property"}}{{/crossLink}} property to any {{#crossLink "Component"}}{{/crossLink}} subtype that has an OBB.

 ## Examples

 * [Rendering an OBBGeometry](../../examples/#geometry_primitives_OBBGeometry)

 ## Usage

 ````javascript
 // First Mesh with a TorusGeometry
 var mesh = new xeogl.Mesh({
     geometry: new xeogl.TorusGeometry()
 });

 // Second Mesh with an OBBGeometry that shows a wireframe box
 // for the World-space boundary of the first Mesh

 var boundaryHelper = new xeogl.Mesh({

     geometry: new xeogl.OBBGeometry({
         target: mesh
     }),

     material: new xeogl.PhongMaterial({
         diffuse: [0.5, 1.0, 0.5],
         emissive: [0.5, 1.0, 0.5],
         lineWidth:2
     })
 });
 ````

 Now whenever our mesh {{#crossLink "Mesh"}}{{/crossLink}} changes shape or position, our OBBGeometry will automatically
 update to stay fitted to it.

 We could also directly configure the OBBGeometry with the {{#crossLink "Mesh"}}{{/crossLink}}'s {{#crossLink "Mesh/obb:property"}}OBB{{/crossLink}}:

 ````javascript
 var boundaryHelper2 = new xeogl.Mesh({

     geometry: new xeogl.OBBGeometry({
         targetOBB: mesh.obb
     }),

     material: new xeogl.PhongMaterial({
         diffuse: [0.5, 1.0, 0.5],
         emissive: [0.5, 1.0, 0.5],
         lineWidth:2
     })
 });
 ````

 @class OBBGeometry
 @module xeogl
 @submodule geometry
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}},
 generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this OBBGeometry.
 @param [cfg.target] {Component} ID or instance of a {{#crossLink "Component"}}{{/crossLink}} whose OBB we'll show.
 @param [cfg.targetOBB] {Float32Array} An mesh-oriented box (OBB) in a 32-element Float32Array
 containing homogeneous coordinates for the eight corner vertices, ie. each having elements (x,y,z,w).
 @extends Component
 */
const type$28 = "xeogl.OBBGeometry";

class OBBGeometry extends Geometry {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$28;
    }

    init(cfg) {
        super.init(utils.apply(cfg, {
            combined: true,
            quantized: false, // Quantized geometry is immutable
            primitive: cfg.primitive || "lines",
            positions: cfg.positions || [1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0,
                1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0],
            indices: [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]
        }));
        if (cfg.target) {
            this.target = cfg.target;
        } else if (cfg.targetOBB) {
            this.targetOBB = cfg.targetOBB;
        }
    }

    /**
     A component whose OBB we'll dynamically fit this AABBGeometry to.

     This property effectively replaces the {{#crossLink "OBBGeometry/targetOBB:property"}}{{/crossLink}} property.

     @property target
     @type Component
     */
    set  target(value) {
        let geometryDirty = false;
        const self = this;
        this._attach({
            name: "target",
            type: "xeogl.Component",
            component: value,
            sceneDefault: false,
            on: {
                boundary: function () {
                    if (geometryDirty) {
                        return;
                    }
                    geometryDirty = true;
                    tasks.scheduleTask(function () {
                        self._setPositionsFromOBB(self._attached.target.obb);
                        geometryDirty = false;
                    });
                }
            },
            onAttached: function () {
                self._setPositionsFromOBB(self._attached.target.obb);
            }
        });
    }

    get target() {
        return this._attached.target;
    }

    /**
     Sets this OBBGeometry to an mesh-oriented bounding box (OBB), given as a 32-element Float32Array
     containing homogeneous coordinates for the eight corner vertices, ie. each having elements [x,y,z,w].

     This property effectively replaces the {{#crossLink "OBBGeometry/boundary:property"}}{{/crossLink}} property, causing it to become null.

     @property targetOBB
     @type Float32Array
     */
    set targetOBB(value) {
        if (!value) {
            return;
        }
        if (this._attached.target) {
            this.target = null;
        }
        this._setPositionsFromOBB(value);
    }

    _setPositionsFromOBB(obb) {
        this.positions = [
            obb[0], obb[1], obb[2],
            obb[4], obb[5], obb[6],
            obb[8], obb[9], obb[10],
            obb[12], obb[13], obb[14],
            obb[16], obb[17], obb[18],
            obb[20], obb[21], obb[22],
            obb[24], obb[25], obb[26],
            obb[28], obb[29], obb[30]
        ];
    }
}

componentClasses[type$28] = OBBGeometry;

/**
 A **CylinderGeometry** is a parameterized {{#crossLink "Geometry"}}{{/crossLink}} that defines a cylinder-shaped mesh for attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

 <a href="../../examples/#geometry_primitives_cylinder"><img src="../../assets/images/screenshots/CylinderGeometry.png"></img></a>

 ## Examples

 * [Textured CylinderGeometry](../../examples/#geometry_primitives_cylinder)

 ## Usage

 An {{#crossLink "Mesh"}}{{/crossLink}} with a CylinderGeometry and a {{#crossLink "PhongMaterial"}}{{/crossLink}} with
 diffuse {{#crossLink "Texture"}}{{/crossLink}}:

 ````javascript
 new xeogl.Mesh({

     geometry: new xeogl.CylinderGeometry({
         center: [0,0,0],
         radiusTop: 2.0,
         radiusBottom: 2.0,
         height: 5.0,
         radialSegments: 20,
         heightSegments: 1,
         openEnded: false
     }),

     material: new xeogl.PhongMaterial({
        diffuseMap: new xeogl.Texture({
            src: "textures/diffuse/uvGrid2.jpg"
        })
     })
 });
 ````

 @class CylinderGeometry
 @module xeogl
 @submodule geometry
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}},
 generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this CylinderGeometry.
 @param [cfg.primitive="triangles"] {String} The primitive type. Accepted values for a CylinderGeometry are 'points', 'lines' and 'triangles'.
 @param [cfg.center] {Float32Array} 3D point indicating the center position of the CylinderGeometry.
 @param [cfg.radiusTop=1] {Number} Radius of top.
 @param [cfg.radiusBottom=1] {Number} Radius of bottom.
 @param [cfg.height=1] {Number} Height.
 @param [cfg.radialSegments=60] {Number} Number of segments around the CylinderGeometry.
 @param [cfg.heightSegments=1] {Number} Number of vertical segments.
 @param [cfg.openEnded=false] {Boolean} Whether or not the CylinderGeometry has solid caps on the ends.
 @param [cfg.lod=1] {Number} Level-of-detail, in range [0..1].
 @extends Geometry
 */
const type$29 = "xeogl.CylinderGeometry";

class CylinderGeometry extends Geometry {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$29;
    }

    init(cfg) {

        let radiusTop = cfg.radiusTop || 1;
        if (radiusTop < 0) {
            this.error("negative radiusTop not allowed - will invert");
            radiusTop *= -1;
        }

        let radiusBottom = cfg.radiusBottom || 1;
        if (radiusBottom < 0) {
            this.error("negative radiusBottom not allowed - will invert");
            radiusBottom *= -1;
        }

        let height = cfg.height || 1;
        if (height < 0) {
            this.error("negative height not allowed - will invert");
            height *= -1;
        }

        let radialSegments = cfg.radialSegments || 32;
        if (radialSegments < 0) {
            this.error("negative radialSegments not allowed - will invert");
            radialSegments *= -1;
        }
        if (radialSegments < 3) {
            radialSegments = 3;
        }

        let heightSegments = cfg.heightSegments || 1;
        if (heightSegments < 0) {
            this.error("negative heightSegments not allowed - will invert");
            heightSegments *= -1;
        }
        if (heightSegments < 1) {
            heightSegments = 1;
        }

        const openEnded = !!cfg.openEnded;

        let center = cfg.center;
        const centerX = center ? center[0] : 0;
        const centerY = center ? center[1] : 0;
        const centerZ = center ? center[2] : 0;

        const heightHalf = height / 2;
        const heightLength = height / heightSegments;
        const radialAngle = (2.0 * Math.PI / radialSegments);
        const radialLength = 1.0 / radialSegments;
        //var nextRadius = this._radiusBottom;
        const radiusChange = (radiusTop - radiusBottom) / heightSegments;

        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        let h;
        let i;

        let x;
        let z;

        let currentRadius;
        let currentHeight;

        let first;
        let second;

        let startIndex;
        let tu;
        let tv;

        // create vertices
        const normalY = (90.0 - (Math.atan(height / (radiusBottom - radiusTop))) * 180 / Math.PI) / 90.0;

        for (h = 0; h <= heightSegments; h++) {
            currentRadius = radiusTop - h * radiusChange;
            currentHeight = heightHalf - h * heightLength;

            for (i = 0; i <= radialSegments; i++) {
                x = Math.sin(i * radialAngle);
                z = Math.cos(i * radialAngle);

                normals.push(currentRadius * x);
                normals.push(normalY); //todo
                normals.push(currentRadius * z);

                uvs.push((i * radialLength));
                uvs.push(h * 1 / heightSegments);

                positions.push((currentRadius * x) + centerX);
                positions.push((currentHeight) + centerY);
                positions.push((currentRadius * z) + centerZ);
            }
        }

        // create faces
        for (h = 0; h < heightSegments; h++) {
            for (i = 0; i <= radialSegments; i++) {

                first = h * (radialSegments + 1) + i;
                second = first + radialSegments;

                indices.push(first);
                indices.push(second);
                indices.push(second + 1);

                indices.push(first);
                indices.push(second + 1);
                indices.push(first + 1);
            }
        }

        // create top cap
        if (!openEnded && radiusTop > 0) {
            startIndex = (positions.length / 3);

            // top center
            normals.push(0.0);
            normals.push(1.0);
            normals.push(0.0);

            uvs.push(0.5);
            uvs.push(0.5);

            positions.push(0 + centerX);
            positions.push(heightHalf + centerY);
            positions.push(0 + centerZ);

            // top triangle fan
            for (i = 0; i <= radialSegments; i++) {
                x = Math.sin(i * radialAngle);
                z = Math.cos(i * radialAngle);
                tu = (0.5 * Math.sin(i * radialAngle)) + 0.5;
                tv = (0.5 * Math.cos(i * radialAngle)) + 0.5;

                normals.push(radiusTop * x);
                normals.push(1.0);
                normals.push(radiusTop * z);

                uvs.push(tu);
                uvs.push(tv);

                positions.push((radiusTop * x) + centerX);
                positions.push((heightHalf) + centerY);
                positions.push((radiusTop * z) + centerZ);
            }

            for (i = 0; i < radialSegments; i++) {
                center = startIndex;
                first = startIndex + 1 + i;

                indices.push(first);
                indices.push(first + 1);
                indices.push(center);
            }
        }

        // create bottom cap
        if (!openEnded && radiusBottom > 0) {

            startIndex = (positions.length / 3);

            // top center
            normals.push(0.0);
            normals.push(-1.0);
            normals.push(0.0);

            uvs.push(0.5);
            uvs.push(0.5);

            positions.push(0 + centerX);
            positions.push(0 - heightHalf + centerY);
            positions.push(0 + centerZ);

            // top triangle fan
            for (i = 0; i <= radialSegments; i++) {

                x = Math.sin(i * radialAngle);
                z = Math.cos(i * radialAngle);

                tu = (0.5 * Math.sin(i * radialAngle)) + 0.5;
                tv = (0.5 * Math.cos(i * radialAngle)) + 0.5;

                normals.push(radiusBottom * x);
                normals.push(-1.0);
                normals.push(radiusBottom * z);

                uvs.push(tu);
                uvs.push(tv);

                positions.push((radiusBottom * x) + centerX);
                positions.push((0 - heightHalf) + centerY);
                positions.push((radiusBottom * z) + centerZ);
            }

            for (i = 0; i < radialSegments; i++) {

                center = startIndex;
                first = startIndex + 1 + i;

                indices.push(center);
                indices.push(first + 1);
                indices.push(first);
            }
        }

        super.init(utils.apply(cfg, {
            positions: positions,
            normals: normals,
            uv: uvs,
            indices: indices
        }));
    }
}

componentClasses[type$29] = CylinderGeometry;

/**
 A **PlaneGeometry** is a parameterized {{#crossLink "Geometry"}}{{/crossLink}} that defines a plane-shaped mesh for attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

 <a href="../../examples/#geometry_primitives_plane"><img src="../../assets/images/screenshots/PlaneGeometry.png"></img></a>

 ## Overview

 * A PlaneGeometry lies in the X-Z plane.
 * Dynamically modify it's shape at any time by updating its {{#crossLink "PlaneGeometry/center:property"}}{{/crossLink}}, {{#crossLink "PlaneGeometry/xSize:property"}}{{/crossLink}}, {{#crossLink "PlaneGeometry/zSize:property"}}{{/crossLink}}, {{#crossLink "PlaneGeometry/xSegments:property"}}{{/crossLink}} and
 {{#crossLink "PlaneGeometry/zSegments:property"}}{{/crossLink}} properties.
 * Dynamically switch its primitive type between ````"points"````, ````"lines"```` and ````"triangles"```` at any time by
 updating its {{#crossLink "Geometry/primitive:property"}}{{/crossLink}} property.

 ## Examples

 * [Textured PlaneGeometry](../../examples/#geometry_primitives_plane)

 ## Usage

 An {{#crossLink "Mesh"}}{{/crossLink}} with a PlaneGeometry and a {{#crossLink "PhongMaterial"}}{{/crossLink}} with
 diffuse {{#crossLink "Texture"}}{{/crossLink}}:

 ````javascript
 new xeogl.Mesh({

     geometry: new xeogl.PlaneGeometry({
         primitive: "triangles",
         center: [0,0,0],
         xSize: 2,
         zSize: 2,
         xSegments: 10,
         zSegments: 10
     }),

     material: new xeogl.PhongMaterial({
        diffuseMap: new xeogl.Texture({
            src: "textures/diffuse/uvGrid2.jpg"
        })
     })
 });
 ````

 @class PlaneGeometry
 @module xeogl
 @submodule geometry
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}},
 generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this PlaneGeometry.
 @param [cfg.primitive="triangles"] {String} The primitive type. Accepted values for a PlaneGeometry are 'points', 'lines' and 'triangles'.
 @param [cfg.center] {Float32Array} 3D point indicating the center position of the PlaneGeometry.
 @param [cfg.xSize=1] {Number} Dimension on the X-axis.
 @param [cfg.zSize=1] {Number} Dimension on the Z-axis.
 @param [cfg.xSegments=1] {Number} Number of segments on the X-axis.
 @param [cfg.zSegments=1] {Number} Number of segments on the Z-axis.
 @extends Geometry
 */
const type$30 = "xeogl.PlaneGeometry";

class PlaneGeometry extends Geometry {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$30;
    }

    init(cfg) {

        let xSize = cfg.xSize || 1;
        if (xSize < 0) {
            this.error("negative xSize not allowed - will invert");
            xSize *= -1;
        }

        let zSize = cfg.zSize || 1;
        if (zSize < 0) {
            this.error("negative zSize not allowed - will invert");
            zSize *= -1;
        }

        let xSegments = cfg.xSegments || 1;
        if (xSegments < 0) {
            this.error("negative xSegments not allowed - will invert");
            xSegments *= -1;
        }
        if (xSegments < 1) {
            xSegments = 1;
        }

        let zSegments = cfg.xSegments || 1;
        if (zSegments < 0) {
            this.error("negative zSegments not allowed - will invert");
            zSegments *= -1;
        }
        if (zSegments < 1) {
            zSegments = 1;
        }

        const center = cfg.center;
        const centerX = center ? center[0] : 0;
        const centerY = center ? center[1] : 0;
        const centerZ = center ? center[2] : 0;

        const halfWidth = xSize / 2;
        const halfHeight = zSize / 2;

        const planeX = Math.floor(xSegments) || 1;
        const planeZ = Math.floor(zSegments) || 1;

        const planeX1 = planeX + 1;
        const planeZ1 = planeZ + 1;

        const segmentWidth = xSize / planeX;
        const segmentHeight = zSize / planeZ;

        const positions = new Float32Array(planeX1 * planeZ1 * 3);
        const normals = new Float32Array(planeX1 * planeZ1 * 3);
        const uvs = new Float32Array(planeX1 * planeZ1 * 2);

        let offset = 0;
        let offset2 = 0;

        let iz;
        let ix;
        let x;
        let a;
        let b;
        let c;
        let d;

        for (iz = 0; iz < planeZ1; iz++) {

            const z = iz * segmentHeight - halfHeight;

            for (ix = 0; ix < planeX1; ix++) {

                x = ix * segmentWidth - halfWidth;

                positions[offset] = x + centerX;
                positions[offset + 1] = centerY;
                positions[offset + 2] = -z + centerZ;

                normals[offset + 2] = -1;

                uvs[offset2] = (planeX - ix) / planeX;
                uvs[offset2 + 1] = ( (planeZ - iz) / planeZ );

                offset += 3;
                offset2 += 2;
            }
        }

        offset = 0;

        const indices = new ( ( positions.length / 3 ) > 65535 ? Uint32Array : Uint16Array )(planeX * planeZ * 6);

        for (iz = 0; iz < planeZ; iz++) {

            for (ix = 0; ix < planeX; ix++) {

                a = ix + planeX1 * iz;
                b = ix + planeX1 * ( iz + 1 );
                c = ( ix + 1 ) + planeX1 * ( iz + 1 );
                d = ( ix + 1 ) + planeX1 * iz;

                indices[offset] = d;
                indices[offset + 1] = b;
                indices[offset + 2] = a;

                indices[offset + 3] = d;
                indices[offset + 4] = c;
                indices[offset + 5] = b;

                offset += 6;
            }
        }

        super.init(utils.apply(cfg, {
            positions: positions,
            normals: normals,
            uv: uvs,
            indices: indices
        }));
    }
}

componentClasses[type$30] = PlaneGeometry;

/**
 An **AmbientLight** defines an ambient light source of fixed intensity and color that affects all {{#crossLink "Mesh"}}Meshes{{/crossLink}}
 equally.

 <a href="../../examples/#lights_ambient"><img src="http://i.giphy.com/l0HlGTxXQWMRVOPwk.gif"></img></a>

 ## Overview

 * When {{#crossLink "Mesh"}}Meshes{{/crossLink}} have {{#crossLink "PhongMaterial"}}PhongMaterials{{/crossLink}},
 AmbientLight {{#crossLink "AmbientLight/color:property"}}color{{/crossLink}} is multiplied by
 PhongMaterial {{#crossLink "PhongMaterial/ambient:property"}}{{/crossLink}} at each rendered fragment of the {{#crossLink "Geometry"}}{{/crossLink}} surface.
 * When the Meshes have {{#crossLink "LambertMaterial"}}LambertMaterials{{/crossLink}},
 AmbientLight {{#crossLink "AmbientLight/color:property"}}color{{/crossLink}} is multiplied by
 LambertMaterial {{#crossLink "LambertMaterial/ambient:property"}}{{/crossLink}} for each rendered triangle of the Geometry surface (ie. flat shaded).
 * {{#crossLink "AmbientLight"}}{{/crossLink}}, {{#crossLink "DirLight"}}{{/crossLink}},
 {{#crossLink "SpotLight"}}{{/crossLink}} and {{#crossLink "PointLight"}}{{/crossLink}} instances are registered by ID
 on {{#crossLink "Scene/lights:property"}}Scene#lights{{/crossLink}} for convenient access.

 ## Examples

 * [Ambient light source](../../examples/#lights_ambient)

 ## Usage

 In the example below we'll customize the default Scene's light sources, defining an AmbientLight and a couple of
 DirLights, then create a Phong-shaded box mesh.

 ````javascript
 new xeogl.AmbientLight({
    color: [0.8, 0.8, 0.8],
    intensity: 0.5
 });

 new xeogl.DirLight({
    dir: [-0.8, -0.4, -0.4],
    color: [0.4, 0.4, 0.5],
    intensity: 0.5,
    space: "view"
 });

 new xeogl.DirLight({
    dir: [0.2, -0.8, 0.8],
    color: [0.8, 0.8, 0.8],
    intensity: 0.5,
    space: "view"
 });
 ````

 @class AmbientLight
 @module xeogl
 @submodule lighting
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} AmbientLight configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this AmbientLight.
 @param [cfg.color=[0.7, 0.7, 0.8]] {Array(Number)} The color of this AmbientLight.
 @param [cfg.intensity=[1.0]] {Number} The intensity of this AmbientLight, as a factor in range ````[0..1]````.
 @extends Component
 */
const type$31 = "xeogl.AmbientLight";

class AmbientLight extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$31;
    }

    init(cfg) {
        super.init(cfg);
        this._state = {
            type: "ambient",
            color: math.vec3([0.7, 0.7, 0.7]),
            intensity: 1.0
        };
        this.color = cfg.color;
        this.intensity = cfg.intensity;
        this.scene._lightCreated(this);
    }

    /**
     The color of this AmbientLight.

     @property color
     @default [0.7, 0.7, 0.8]
     @type Float32Array
     */
    set color(value) {
        this._state.color.set(value || [0.7, 0.7, 0.8]);
        this._renderer.setImageForceDirty();
    }

    get color() {
        return this._state.color;
    }

    /**
     The intensity of this AmbientLight.

     @property intensity
     @default 1.0
     @type Number
     */
    set intensity(value) {
        this._state.intensity = value !== undefined ? value : 1.0;
        this._renderer.setImageForceDirty();
    }

    get intensity() {
        return this._state.intensity;
    }

    destroy() {
        super.destroy();
    }
}

componentClasses[type$31] = AmbientLight;

/**
 A **PointLight** defines a positional light source that originates from a single point and spreads outward in all directions,
 to illuminate {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

 <a href="../../examples/#lights_point_world_normalMap"><img src="http://i.giphy.com/3o6ZsZoFGIOJ2nlmN2.gif"></img></a>

 ## Overview

 * PointLights have a position, but no direction.
 * PointLights may be defined in either **World** or **View** coordinate space. When in World-space, their positions
 are relative to the World coordinate system, and will appear to move as the {{#crossLink "Camera"}}{{/crossLink}} moves.
 When in View-space, their positions are relative to the View coordinate system, and will behave as if fixed to the viewer's
 head as the {{#crossLink "Camera"}}{{/crossLink}} moves.
 * PointLights have {{#crossLink "PointLight/constantAttenuation:property"}}{{/crossLink}}, {{#crossLink "PointLight/linearAttenuation:property"}}{{/crossLink}} and
 {{#crossLink "PointLight/quadraticAttenuation:property"}}{{/crossLink}} factors, which indicate how their intensity attenuates over distance.
 * {{#crossLink "AmbientLight"}}{{/crossLink}}, {{#crossLink "DirLight"}}{{/crossLink}},
 {{#crossLink "SpotLight"}}{{/crossLink}} and {{#crossLink "PointLight"}}{{/crossLink}} instances are registered by ID
 on {{#crossLink "Scene/lights:property"}}Scene#lights{{/crossLink}} for convenient access.

 ## Examples

 * [View-space positional three-point lighting](../../examples/#lights_point_view_threePoint)
 * [World-space positional three-point lighting](../../examples/#lights_point_world_threePoint)
 * [World-space point light and normal map](../../examples/#lights_point_world_normalMap)

 ## Usage

 In the example below we'll customize the default Scene's light sources, defining an AmbientLight and a couple of
 PointLights, then create a Phong-shaded box mesh.

 ````javascript
 new xeogl.AmbientLight({
        color: [0.8, 0.8, 0.8],
        intensity: 0.5
    });

 new xeogl.PointLight({
        pos: [-100, 0, 100],
        color: [0.3, 0.3, 0.5],
        intensity: .7
        constantAttenuation: 0,
        linearAttenuation: 0,
        quadraticAttenuation: 0,
        space: "view"
    });

 new xeogl.PointLight({
        pos: [0, 100, 100],
        color: [0.5, 0.7, 0.5],
        intensity: 1
        constantAttenuation: 0,
        linearAttenuation: 0,
        quadraticAttenuation: 0,
        space: "view"
    });

 // Create box mesh
 new xeogl.Mesh({
    material: new xeogl.PhongMaterial({
        ambient: [0.5, 0.5, 0.5],
        diffuse: [1,0.3,0.3]
    }),
    geometry: new xeogl.BoxGeometry()
 });
 ````


 @class PointLight
 @module xeogl
 @submodule lighting
 @constructor
 @extends Component
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} The PointLight configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this PointLight.
 @param [cfg.pos=[ 1.0, 1.0, 1.0 ]] {Float32Array} Position, in either World or View space, depending on the value of the **space** parameter.
 @param [cfg.color=[0.7, 0.7, 0.8 ]] {Float32Array} Color of this PointLight.
 @param [cfg.intensity=1.0] {Number} Intensity of this PointLight, as a factor in range ````[0..1]````.
 @param [cfg.constantAttenuation=0] {Number} Constant attenuation factor.
 @param [cfg.linearAttenuation=0] {Number} Linear attenuation factor.
 @param [cfg.quadraticAttenuation=0] {Number} Quadratic attenuation factor.
 @param [cfg.space="view"] {String} The coordinate system this PointLight is defined in - "view" or "world".
 @param [cfg.shadow=false] {Boolean} Flag which indicates if this PointLight casts a shadow.
 */
const type$32 = "xeogl.PointLight";

class PointLight extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$32;
    }

    init(cfg) {

        super.init(cfg);

        const self = this;

        this._shadowRenderBuf = null;
        this._shadowViewMatrix = null;
        this._shadowProjMatrix = null;
        this._shadowViewMatrixDirty = true;
        this._shadowProjMatrixDirty = true;

        this._state = new State({
            type: "point",
            pos: math.vec3([1.0, 1.0, 1.0]),
            color: math.vec3([0.7, 0.7, 0.8]),
            intensity: 1.0, attenuation: [0.0, 0.0, 0.0],
            space: cfg.space || "view",
            shadow: false,
            shadowDirty: true,

            getShadowViewMatrix: (function () {
                const look = math.vec3([0, 0, 0]);
                const up = math.vec3([0, 1, 0]);
                return function () {
                    if (self._shadowViewMatrixDirty) {
                        if (!self._shadowViewMatrix) {
                            self._shadowViewMatrix = math.identityMat4();
                        }
                        math.lookAtMat4v(self._state.pos, look, up, self._shadowViewMatrix);
                        self._shadowViewMatrixDirty = false;
                    }
                    return self._shadowViewMatrix;
                };
            })(),

            getShadowProjMatrix: function () {
                if (self._shadowProjMatrixDirty) { // TODO: Set when canvas resizes
                    if (!self._shadowProjMatrix) {
                        self._shadowProjMatrix = math.identityMat4();
                    }
                    const canvas = self.scene.canvas.canvas;
                    math.perspectiveMat4(70 * (Math.PI / 180.0), canvas.clientWidth / canvas.clientHeight, 0.1, 500.0, self._shadowProjMatrix);
                    self._shadowProjMatrixDirty = false;
                }
                return self._shadowProjMatrix;
            },

            getShadowRenderBuf: function () {
                if (!self._shadowRenderBuf) {
                    self._shadowRenderBuf = new RenderBuffer(self.scene.canvas.canvas, self.scene.canvas.gl, {size: [1024, 1024]});
                }
                return self._shadowRenderBuf;
            }
        });

        this.pos = cfg.pos;
        this.color = cfg.color;
        this.intensity = cfg.intensity;
        this.constantAttenuation = cfg.constantAttenuation;
        this.linearAttenuation = cfg.linearAttenuation;
        this.quadraticAttenuation = cfg.quadraticAttenuation;
        this.shadow = cfg.shadow;

        this.scene._lightCreated(this);
    }


    /**
     The position of this PointLight.

     This will be either World- or View-space, depending on the value of {{#crossLink "PointLight/space:property"}}{{/crossLink}}.

     @property pos
     @default [1.0, 1.0, 1.0]
     @type Array(Number)
     */
    set pos(value) {
        this._state.pos.set(value || [1.0, 1.0, 1.0]);
        this._shadowViewMatrixDirty = true;
        this._renderer.imageDirty();
    }

    get pos() {
        return this._state.pos;
    }

    /**
     The color of this PointLight.

     @property color
     @default [0.7, 0.7, 0.8]
     @type Float32Array
     */
    set color(value) {
        this._state.color.set(value || [0.7, 0.7, 0.8]);
        this._renderer.imageDirty();
    }

    get color() {
        return this._state.color;
    }

    /**
     The intensity of this PointLight.

     @property intensity
     @default 1.0
     @type Number
     */
    set intensity(value) {
        value = value !== undefined ? value : 1.0;
        this._state.intensity = value;
        this._renderer.imageDirty();
    }

    get intensity() {
        return this._state.intensity;
    }

    /**
     The constant attenuation factor for this PointLight.

     @property constantAttenuation
     @default 0
     @type Number
     */
    set constantAttenuation(value) {
        this._state.attenuation[0] = value || 0.0;
        this._renderer.imageDirty();
    }

    get constantAttenuation() {
        return this._state.attenuation[0];
    }

    /**
     The linear attenuation factor for this PointLight.

     @property linearAttenuation
     @default 0
     @type Number
     */
    set linearAttenuation(value) {
        this._state.attenuation[1] = value || 0.0;
        this._renderer.imageDirty();
    }

    get linearAttenuation() {
        return this._state.attenuation[1];
    }

    /**
     The quadratic attenuation factor for this Pointlight.

     @property quadraticAttenuation
     @default 0
     @type Number
     */
    set quadraticAttenuation(value) {
        this._state.attenuation[2] = value || 0.0;
        this._renderer.imageDirty();
    }

    get quadraticAttenuation() {
        return this._state.attenuation[2];
    }

    /**
     Flag which indicates if this PointLight casts a shadow.

     @property shadow
     @default false
     @type Boolean
     */
    set shadow(value) {
        value = !!value;
        if (this._state.shadow === value) {
            return;
        }
        this._state.shadow = value;
        this._shadowViewMatrixDirty = true;
        this._renderer.imageDirty();
    }

    get shadow() {
        return this._state.shadow;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
        if (this._shadowRenderBuf) {
            this._shadowRenderBuf.destroy();
        }
        this.scene._lightDestroyed(this);
    }
}

componentClasses[type$32] = PointLight;

/**
 A **SpotLight** defines a positional light source that originates from a single point and eminates in a given direction,
 to illuminate {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

 ## Overview

 * SpotLights have a position and direction.
 * SpotLights may be defined in either **World** or **View** coordinate space. When in World-space, their positions
 are relative to the World coordinate system, and will appear to move as the {{#crossLink "Camera"}}{{/crossLink}} moves.
 When in View-space, their positions are relative to the View coordinate system, and will behave as if fixed to the viewer's
 head as the {{#crossLink "Camera"}}{{/crossLink}} moves.
 * SpotLights have {{#crossLink "SpotLight/constantAttenuation:property"}}{{/crossLink}}, {{#crossLink "SpotLight/linearAttenuation:property"}}{{/crossLink}} and
 {{#crossLink "SpotLight/quadraticAttenuation:property"}}{{/crossLink}} factors, which indicate how their intensity attenuates over distance.
 * A SpotLight can also have a {{#crossLink "Shadow"}}{{/crossLink}} component, to configure it to cast a shadow.
 * {{#crossLink "AmbientLight"}}{{/crossLink}}, {{#crossLink "DirLight"}}{{/crossLink}},
 {{#crossLink "SpotLight"}}{{/crossLink}} and {{#crossLink "PointLight"}}{{/crossLink}} instances are registered by ID
 on {{#crossLink "Scene/lights:property"}}Scene#lights{{/crossLink}} for convenient access.
 ## Examples

 TODO

 ## Usage

 In the example below we'll customize the default Scene's light sources, defining an AmbientLight and a couple of
 SpotLights, then create a Phong-shaded box mesh.

 ````javascript
 new xeogl.AmbientLight({
     color: [0.8, 0.8, 0.8],
     intensity: 0.5
 });

 new xeogl.SpotLight({
     pos: [0, 100, 100],
     dir: [0, -1, 0],
     color: [0.5, 0.7, 0.5],
     intensity: 1
     constantAttenuation: 0,
     linearAttenuation: 0,
     quadraticAttenuation: 0,
     space: "view"
 });

 new xeogl.PointLight({
     pos: [0, 100, 100],
     dir: [0, -1, 0],
     color: [0.5, 0.7, 0.5],
     intensity: 1
     constantAttenuation: 0,
     linearAttenuation: 0,
     quadraticAttenuation: 0,
     space: "view"
 });

 // Create box mesh
 new xeogl.Mesh({
    material: new xeogl.PhongMaterial({
        ambient: [0.5, 0.5, 0.5],
        diffuse: [1,0.3,0.3]
    }),
    geometry: new xeogl.BoxGeometry()
 });
 ````

 @class SpotLight
 @module xeogl
 @submodule lighting
 @constructor
 @extends Component
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} The SpotLight configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this SpotLight.
 @param [cfg.pos=[ 1.0, 1.0, 1.0 ]] {Float32Array} Position, in either World or View space, depending on the value of the **space** parameter.
 @param [cfg.dir=[ 0.0, -1.0, 0.0 ]] {Float32Array} Direction in which this Spotlight is shining, in either World or View space, depending on the value of the **space** parameter.
 @param [cfg.color=[0.7, 0.7, 0.8 ]] {Float32Array} Color of this SpotLight.
 @param [cfg.intensity=1.0] {Number} Intensity of this SpotLight.
 @param [cfg.constantAttenuation=0] {Number} Constant attenuation factor.
 @param [cfg.linearAttenuation=0] {Number} Linear attenuation factor.
 @param [cfg.quadraticAttenuation=0] {Number} Quadratic attenuation factor.
 @param [cfg.space="view"] {String} The coordinate system this SpotLight is defined in - "view" or "world".
 @param [cfg.shadow=false] {Boolean} Flag which indicates if this SpotLight casts a shadow.
 */

const type$33 = "xeogl.SpotLight";

class SpotLight extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$33;
    }

    init(cfg) {

        super.init(cfg);

        const self = this;

        this._shadowRenderBuf = null;
        this._shadowViewMatrix = null;
        this._shadowProjMatrix = null;
        this._shadowViewMatrixDirty = true;
        this._shadowProjMatrixDirty = true;

        this._state = new State({
            type: "spot",
            pos: math.vec3([1.0, 1.0, 1.0]),
            dir: math.vec3([0.0, -1.0, 0.0]),
            color: math.vec3([0.7, 0.7, 0.8]),
            intensity: 1.0,
            attenuation: [0.0, 0.0, 0.0],
            space: cfg.space || "view",
            shadow: false,
            shadowDirty: true,

            getShadowViewMatrix: (function () {
                const look = math.vec3();
                const up = math.vec3([0, 1, 0]);
                return function () {
                    if (self._shadowViewMatrixDirty) {
                        if (!self._shadowViewMatrix) {
                            self._shadowViewMatrix = math.identityMat4();
                        }
                        math.addVec3(self._state.pos, self._state.dir, look);
                        math.lookAtMat4v(self._state.pos, look, up, self._shadowViewMatrix);
                        self._shadowViewMatrixDirty = false;
                    }
                    return self._shadowViewMatrix;
                };
            })(),

            getShadowProjMatrix: function () {
                if (self._shadowProjMatrixDirty) { // TODO: Set when canvas resizes
                    if (!self._shadowProjMatrix) {
                        self._shadowProjMatrix = math.identityMat4();
                    }
                    const canvas = self.scene.canvas.canvas;
                    math.perspectiveMat4(60 * (Math.PI / 180.0), canvas.clientWidth / canvas.clientHeight, 0.1, 400.0, self._shadowProjMatrix);
                    self._shadowProjMatrixDirty = false;
                }
                return self._shadowProjMatrix;
            },

            getShadowRenderBuf: function () {
                if (!self._shadowRenderBuf) {
                    self._shadowRenderBuf = new RenderBuffer(self.scene.canvas.canvas, self.scene.canvas.gl);
                }
                return self._shadowRenderBuf;
            }
        });

        this.pos = cfg.pos;
        this.color = cfg.color;
        this.intensity = cfg.intensity;
        this.constantAttenuation = cfg.constantAttenuation;
        this.linearAttenuation = cfg.linearAttenuation;
        this.quadraticAttenuation = cfg.quadraticAttenuation;
        this.shadow = cfg.shadow;
        this.scene._lightCreated(this);
    }


    /**
     The position of this SpotLight.

     This will be either World- or View-space, depending on the value of {{#crossLink "SpotLight/space:property"}}{{/crossLink}}.

     @property pos
     @default [1.0, 1.0, 1.0]
     @type Array(Number)
     */
    set pos(value) {
        this._state.pos.set(value || [1.0, 1.0, 1.0]);
        this._shadowViewMatrixDirty = true;
        this._renderer.imageDirty();
    }

    get pos() {
        return this._state.pos;
    }

    /**
     The direction in which the light is shining.

     @property dir
     @default [1.0, 1.0, 1.0]
     @type Float32Array
     */
    set dir(value) {
        this._state.dir.set(value || [1.0, 1.0, 1.0]);
        this._shadowViewMatrixDirty = true;
        this._renderer.imageDirty();
    }

    get dir() {
        return this._state.dir;
    }

    /**
     The color of this SpotLight.

     @property color
     @default [0.7, 0.7, 0.8]
     @type Float32Array
     */
    set color(value) {
        this._state.color.set(value || [0.7, 0.7, 0.8]);
        this._renderer.imageDirty();
    }

    get color() {
        return this._state.color;
    }

    /**
     The intensity of this SpotLight.

     Fires a {{#crossLink "SpotLight/intensity:event"}}{{/crossLink}} event on change.

     @property intensity
     @default 1.0
     @type Number
     */
    set intensity(value) {
        value = value !== undefined ? value : 1.0;
        this._state.intensity = value;
        this._renderer.imageDirty();
    }

    get intensity() {
        return this._state.intensity;
    }

    /**
     The constant attenuation factor for this SpotLight.

     @property constantAttenuation
     @default 0
     @type Number
     */
    set constantAttenuation(value) {
        this._state.attenuation[0] = value || 0.0;
        this._renderer.imageDirty();
    }

    get constantAttenuation() {
        return this._state.attenuation[0];
    }

    /**
     The linear attenuation factor for this SpotLight.

     @property linearAttenuation
     @default 0
     @type Number
     */
    set linearAttenuation(value) {
        this._state.attenuation[1] = value || 0.0;
        this._renderer.imageDirty();
    }

    get linearAttenuation() {
        return this._state.attenuation[1];
    }

    /**
     The quadratic attenuation factor for this SpotLight.

     @property quadraticAttenuation
     @default 0
     @type Number
     */
    set quadraticAttenuation(value) {
        this._state.attenuation[2] = value || 0.0;
        this._renderer.imageDirty();
    }

    get quadraticAttenuation() {
        return this._state.attenuation[2];
    }

    /**
     Flag which indicates if this SpotLight casts a shadow.

     @property shadow
     @default false
     @type Boolean
     */
    set shadow(value) {
        value = !!value;
        if (this._state.shadow === value) {
            return;
        }
        this._state.shadow = value;
        this._shadowViewMatrixDirty = true;
        this._renderer.imageDirty();
        this.fire("dirty", true);
    }

    get shadow() {
        return this._state.shadow;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
        if (this._shadowRenderBuf) {
            this._shadowRenderBuf.destroy();
        }
        this.scene._lightDestroyed(this);

    }
}

componentClasses[type$33] = SpotLight;

/**
 * @author xeolabs / https://github.com/xeolabs
 */

const webglEnums = {
    funcAdd: "FUNC_ADD",
    funcSubtract: "FUNC_SUBTRACT",
    funcReverseSubtract: "FUNC_REVERSE_SUBTRACT",
    zero: "ZERO",
    one: "ONE",
    srcColor: "SRC_COLOR",
    oneMinusSrcColor: "ONE_MINUS_SRC_COLOR",
    dstColor: "DST_COLOR",
    oneMinusDstColor: "ONE_MINUS_DST_COLOR",
    srcAlpha: "SRC_ALPHA",
    oneMinusSrcAlpha: "ONE_MINUS_SRC_ALPHA",
    dstAlpha: "DST_ALPHA",
    oneMinusDstAlpha: "ONE_MINUS_DST_ALPHA",
    contantColor: "CONSTANT_COLOR",
    oneMinusConstantColor: "ONE_MINUS_CONSTANT_COLOR",
    constantAlpha: "CONSTANT_ALPHA",
    oneMinusConstantAlpha: "ONE_MINUS_CONSTANT_ALPHA",
    srcAlphaSaturate: "SRC_ALPHA_SATURATE",
    front: "FRONT",
    back: "BACK",
    frontAndBack: "FRONT_AND_BACK",
    never: "NEVER",
    less: "LESS",
    equal: "EQUAL",
    lequal: "LEQUAL",
    greater: "GREATER",
    notequal: "NOTEQUAL",
    gequal: "GEQUAL",
    always: "ALWAYS",
    cw: "CW",
    ccw: "CCW",
    linear: "LINEAR",
    nearest: "NEAREST",
    linearMipmapNearest: "LINEAR_MIPMAP_NEAREST",
    nearestMipmapNearest: "NEAREST_MIPMAP_NEAREST",
    nearestMipmapLinear: "NEAREST_MIPMAP_LINEAR",
    linearMipmapLinear: "LINEAR_MIPMAP_LINEAR",
    repeat: "REPEAT",
    clampToEdge: "CLAMP_TO_EDGE",
    mirroredRepeat: "MIRRORED_REPEAT",
    alpha: "ALPHA",
    rgb: "RGB",
    rgba: "RGBA",
    luminance: "LUMINANCE",
    luminanceAlpha: "LUMINANCE_ALPHA",
    textureBinding2D: "TEXTURE_BINDING_2D",
    textureBindingCubeMap: "TEXTURE_BINDING_CUBE_MAP",
    compareRToTexture: "COMPARE_R_TO_TEXTURE", // Hardware Shadowing Z-depth,
    unsignedByte: "UNSIGNED_BYTE"
};

/**
 * @author xeolabs / https://github.com/xeolabs
 */

function getGLEnum(gl, name, defaultVal) {
    if (name === undefined) {
        return defaultVal;
    }
    const glName = webglEnums[name];
    if (glName === undefined) {
        return defaultVal;
    }
    return gl[glName];
}

const color = new Uint8Array([0, 0, 0, 1]);

class Texture2D {

    constructor(gl, target) {
        this.gl = gl;
        this.target = target || gl.TEXTURE_2D;
        this.texture = gl.createTexture();
        this.setPreloadColor([0, 0, 0, 0]); // Prevents "there is no texture bound to the unit 0" error
        this.allocated = true;
    }

    setPreloadColor(value) {

        if (!value) {
            color[0] = 0;
            color[1] = 0;
            color[2] = 0;
            color[3] = 255;
        } else {
            color[0] = Math.floor(value[0] * 255);
            color[1] = Math.floor(value[1] * 255);
            color[2] = Math.floor(value[2] * 255);
            color[3] = Math.floor((value[3] !== undefined ? value[3] : 1) * 255);
        }

        const gl = this.gl;

        gl.bindTexture(this.target, this.texture);
        gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

        if (this.target === gl.TEXTURE_CUBE_MAP) {

            const faces = [
                gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
            ];

            for (let i = 0, len = faces.length; i < len; i++) {
                gl.texImage2D(faces[i], 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, color);
            }

        } else {
            gl.texImage2D(this.target, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, color);
        }

        gl.bindTexture(this.target, null);
    }

    setTarget(target) {
        this.target = target || this.gl.TEXTURE_2D;
    }

    setImage(image, props) {
        const gl = this.gl;
        gl.bindTexture(this.target, this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, props.flipY);
        if (this.target === gl.TEXTURE_CUBE_MAP) {
            if (utils.isArray(image)) {
                const images = image;
                const faces = [
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                    gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                    gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
                ];
                for (let i = 0, len = faces.length; i < len; i++) {
                    gl.texImage2D(faces[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, images[i]);
                }
            }
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        }
        gl.bindTexture(this.target, null);
    }

    setProps(props) {
        const gl = this.gl;
        gl.bindTexture(this.target, this.texture);
        if (props.minFilter) {
            const minFilter = getGLEnum(gl, props.minFilter);
            if (minFilter) {
                gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, minFilter);
                if (minFilter === gl.NEAREST_MIPMAP_NEAREST ||
                    minFilter === gl.LINEAR_MIPMAP_NEAREST ||
                    minFilter === gl.NEAREST_MIPMAP_LINEAR ||
                    minFilter === gl.LINEAR_MIPMAP_LINEAR) {

                    gl.generateMipmap(this.target);
                }
            }
        }
        if (props.magFilter) {
            const magFilter = getGLEnum(gl, props.magFilter);
            if (magFilter) {
                gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, magFilter);
            }
        }
        if (props.wrapS) {
            const wrapS = getGLEnum(gl, props.wrapS);
            if (wrapS) {
                gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, wrapS);
            }
        }
        if (props.wrapT) {
            const wrapT = getGLEnum(gl, props.wrapT);
            if (wrapT) {
                gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, wrapT);
            }
        }
        gl.bindTexture(this.target, null);
    }

    bind(unit) {
        if (!this.allocated) {
            return;
        }
        if (this.texture) {
            const gl = this.gl;
            gl.activeTexture(gl["TEXTURE" + unit]);
            gl.bindTexture(this.target, this.texture);
            return true;
        }
        return false;
    }

    unbind(unit) {
        if (!this.allocated) {
            return;
        }
        if (this.texture) {
            const gl = this.gl;
            gl.activeTexture(gl["TEXTURE" + unit]);
            gl.bindTexture(this.target, null);
        }
    }

    destroy() {
        if (!this.allocated) {
            return;
        }
        if (this.texture) {
            this.gl.deleteTexture(this.texture);
            this.texture = null;
        }
    }
}

/**
 A **CubeTexture** specifies a cube texture map.

 ## Overview

 See {{#crossLink "Lights"}}{{/crossLink}} for an example of how to use CubeTextures for light and reflection mapping.

 @class CubeTexture
 @module xeogl
 @submodule lighting
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID for this CubeTexture, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this CubeTexture.
 @param [cfg.src=null] {Array of String} Paths to six image files to load into this CubeTexture.
 @param [cfg.flipY=false] {Boolean} Flips this CubeTexture's source data along its vertical axis when true.
 @param [cfg.encoding="linear"] {String} Encoding format.  See the {{#crossLink "CubeTexture/encoding:property"}}{{/crossLink}} property for more info.
 @extends Component
 */
const type$34 = "xeogl.CubeTexture";

function ensureImageSizePowerOfTwo$1(image) {
    if (!isPowerOfTwo$1(image.width) || !isPowerOfTwo$1(image.height)) {
        const canvas = document.createElement("canvas");
        canvas.width = nextHighestPowerOfTwo$1(image.width);
        canvas.height = nextHighestPowerOfTwo$1(image.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image,
            0, 0, image.width, image.height,
            0, 0, canvas.width, canvas.height);
        image = canvas;
    }
    return image;
}

function isPowerOfTwo$1(x) {
    return (x & (x - 1)) === 0;
}

function nextHighestPowerOfTwo$1(x) {
    --x;
    for (let i = 1; i < 32; i <<= 1) {
        x = x | x >> i;
    }
    return x + 1;
}

class CubeTexture extends Component{

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$34;
    }

    init(cfg) {

        super.init(cfg);

        const gl = this.scene.canvas.gl;

        this._state = new State({
            texture: new Texture2D(gl, gl.TEXTURE_CUBE_MAP),
            flipY: this._checkFlipY(cfg.minFilter),
            encoding: this._checkEncoding(cfg.encoding),
            minFilter: "linearMipmapLinear",
            magFilter: "linear",
            wrapS: "clampToEdge",
            wrapT: "clampToEdge",
            mipmaps: true
        });

        this._src = cfg.src;
        this._images = [];

        this._loadSrc(cfg.src);

        stats.memory.textures++;
    }

    _checkFlipY(value) {
        return !!value;
    }

    _checkEncoding (value) {
        value = value || "linear";
        if (value !== "linear" && value !== "sRGB" && value !== "gamma") {
            this.error("Unsupported value for 'encoding': '" + value + "' - supported values are 'linear', 'sRGB', 'gamma'. Defaulting to 'linear'.");
            value = "linear";
        }
        return value;
    }

    _webglContextRestored () {
        const gl = this.scene.canvas.gl;
        this._state.texture = null;
        // if (this._images.length > 0) {
        //     this._state.texture = new xeogl.renderer.Texture2D(gl, gl.TEXTURE_CUBE_MAP);
        //     this._state.texture.setImage(this._images, this._state);
        //     this._state.texture.setProps(this._state);
        // } else
        if (this._src) {
            this._loadSrc(this._src);
        }
    }

    _loadSrc (src) {
        const self = this;
        const gl = this.scene.canvas.gl;
        this._images = [];
        let loadFailed = false;
        let numLoaded = 0;
        for (let i = 0; i < src.length; i++) {
            const image = new Image();
            image.onload = (function () {
                let _image = image;
                const index = i;
                return function () {
                    if (loadFailed) {
                        return;
                    }
                    _image = ensureImageSizePowerOfTwo$1(_image);
                    self._images[index] = _image;
                    numLoaded++;
                    if (numLoaded === 6) {
                        let texture = self._state.texture;
                        if (!texture) {
                            texture = new Texture2D(gl, gl.TEXTURE_CUBE_MAP);
                            self._state.texture = texture;
                        }
                        texture.setImage(self._images, self._state);
                        texture.setProps(self._state);
                        /**
                         * Fired whenever this CubeTexture has loaded the
                         * image files that its {{#crossLink "CubeTexture/src:property"}}{{/crossLink}} property currently points to.
                         * @event loaded
                         * @param value {HTML Image} The value of the {{#crossLink "CubeTexture/src:property"}}{{/crossLink}} property
                         */
                        self.fire("loaded", self._src);
                    }
                };
            })();
            image.onerror = function () {
                loadFailed = true;
            };
            image.src = src[i];
        }
    }

    destroy() {
        super.destroy();
        if (this._state.texture) {
            this._state.texture.destroy();
        }
        stats.memory.textures--;
        this._state.destroy();
    }
}

componentClasses[type$34] = CubeTexture;

/**
 A **LightMap** specifies a cube texture light map.

 ## Usage

 ````javascript

 new xeogl.LightMap({
    src: [
        "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_PX.png",
        "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_NX.png",
        "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_PY.png",
        "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_NY.png",
        "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_PZ.png",
        "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_NZ.png"
    ]
 });
 ````
 @class LightMap
 @module xeogl
 @submodule lighting
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID for this LightMap, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this LightMap.
 @param [cfg.src=null] {Array of String} Paths to six image files to load into this LightMap.
 @param [cfg.flipY=false] {Boolean} Flips this LightMap's source data along its vertical axis when true.
 @param [cfg.encoding="linear"] {String} Encoding format.  See the {{#crossLink "LightMap/encoding:property"}}{{/crossLink}} property for more info.
 @extends Component
 */

const type$35 = "xeogl.LightMap";

class LightMap extends CubeTexture{

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$35;
    }

    init(cfg) {
        super.init(cfg);
        this.scene._lightMapCreated(this);
    }

    destroy() {
        super.destroy();
        this.scene._lightMapDestroyed(this);
    }
}

componentClasses[type$35] = LightMap;

/**
 A **ReflectionMap** specifies a cube texture reflection map.

 ## Usage

 ````javascript

 new xeogl.ReflectionMap({
    src: [
        "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_PX.png",
        "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_NX.png",
        "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_PY.png",
        "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_NY.png",
        "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_PZ.png",
        "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_NZ.png"
    ]
 });
 ````
 @class ReflectionMap
 @module xeogl
 @submodule lighting
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID for this ReflectionMap, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this ReflectionMap.
 @param [cfg.src=null] {Array of String} Paths to six image files to load into this ReflectionMap.
 @param [cfg.flipY=false] {Boolean} Flips this ReflectionMap's source data along its vertical axis when true.
 @param [cfg.encoding="linear"] {String} Encoding format.  See the {{#crossLink "ReflectionMap/encoding:property"}}{{/crossLink}} property for more info.
 @extends Component
 */
const type$36 = "xeogl.ReflectionMap";

class ReflectionMap extends CubeTexture {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$36;
    }

    init(cfg) {
        super.init(cfg);
        this.scene._lightsState.addReflectionMap(this._state);
        this.scene._reflectionMapCreated(this);
    }

    destroy() {
        super.destroy();
        this.scene._reflectionMapDestroyed(this);
    }
}

componentClasses[type$36] = ReflectionMap;

/**
 A **Shadow** defines a shadow cast by a {{#crossLink "DirLight"}}{{/crossLink}} or a {{#crossLink "SpotLight"}}{{/crossLink}}.

 Work in progress!

 ## Overview

 * Shadows are attached to {{#crossLink "DirLight"}}{{/crossLink}} and {{#crossLink "SpotLight"}}{{/crossLink}} components.

 TODO

 ## Examples

 TODO

 ## Usage

 ```` javascript
 var mesh = new xeogl.Mesh(scene, {

        lights: new xeogl.Lights({
            lights: [

                new xeogl.SpotLight({
                    pos: [0, 100, 100],
                    dir: [0, -1, 0],
                    color: [0.5, 0.7, 0.5],
                    intensity: 1
                    constantAttenuation: 0,
                    linearAttenuation: 0,
                    quadraticAttenuation: 0,
                    space: "view",

                    shadow: new xeogl.Shadow({
                        resolution: [1000, 1000],
                        intensity: 0.7,
                        sampling: "stratified" // "stratified" | "poisson" | "basic"
                    });
                })
            ]
        }),
 ,
        material: new xeogl.PhongMaterial({
            diffuse: [0.5, 0.5, 0.0]
        }),

        geometry: new xeogl.BoxGeometry()
  });
 ````

 @class Shadow
 @module xeogl
 @submodule lighting
 @constructor
 @extends Component
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} The Shadow configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Shadow.
 @param [cfg.resolution=[1000,1000]] {Uint16Array} Resolution of the texture map for this Shadow.
 @param [cfg.intensity=1.0] {Number} Intensity of this Shadow.
 */
const type$37 = "xeogl.Shadow";

class Shadow extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$37;
    }

    init(cfg) {
        super.init(cfg);
        this._state = {
            resolution: math.vec3([1000, 1000]),
            intensity: 1.0
        };
        this.resolution = cfg.resolution;
        this.intensity = cfg.intensity;
    }

    /**
     The resolution of the texture map for this Shadow.

     This will be either World- or View-space, depending on the value of {{#crossLink "Shadow/space:property"}}{{/crossLink}}.

     Fires a {{#crossLink "Shadow/resolution:event"}}{{/crossLink}} event on change.

     @property resolution
     @default [1000, 1000]
     @type Uint16Array
     */
    set resolution(value) {

        this._state.resolution.set(value || [1000.0, 1000.0]);

        this._renderer.imageDirty();

        /**
         Fired whenever this Shadow's  {{#crossLink "Shadow/resolution:property"}}{{/crossLink}} property changes.
         @event resolution
         @param value The property's new value
         */
        this.fire("resolution", this._state.resolution);
    }

    get resolution() {
        return this._state.resolution;
    }

    /**
     The intensity of this Shadow.

     Fires a {{#crossLink "Shadow/intensity:event"}}{{/crossLink}} event on change.

     @property intensity
     @default 1.0
     @type Number
     */
    set intensity(value) {

        value = value !== undefined ? value : 1.0;

        this._state.intensity = value;

        this._renderer.imageDirty();

        /**
         * Fired whenever this Shadow's  {{#crossLink "Shadow/intensity:property"}}{{/crossLink}} property changes.
         * @event intensity
         * @param value The property's new value
         */
        this.fire("intensity", this._state.intensity);
    }

    get intensity() {
        return this._state.intensity;
    }

    destroy() {
        super.destroy();
        //this._state.destroy();
    }
}

componentClasses[type$37] = Shadow;

/**
 A **Group** is an {{#crossLink "Object"}}{{/crossLink}} that groups other Objects.

 Group is subclassed by (at least) {{#crossLink "Model"}}{{/crossLink}}, which is the abstract base class for {{#crossLink "GLTFModel"}}{{/crossLink}}, {{#crossLink "STLModel"}}{{/crossLink}} etc.

 See {{#crossLink "Object"}}{{/crossLink}} for overall usage info.

 @class Group
 @module xeogl
 @submodule objects
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata.
 @param [cfg.entityType] {String} Optional entity classification when using within a semantic data model. See the {{#crossLink "Object"}}{{/crossLink}} documentation for usage.
 @param [cfg.parent] {Object} The parent.
 @param [cfg.position=[0,0,0]] {Float32Array} Local 3D position.
 @param [cfg.scale=[1,1,1]] {Float32Array} Local scale.
 @param [cfg.rotation=[0,0,0]] {Float32Array} Local rotation, as Euler angles given in degrees, for each of the X, Y and Z axis.
 @param [cfg.matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] {Float32Array} Local modelling transform matrix. Overrides the position, scale and rotation parameters.
 @param [cfg.visible=true] {Boolean}        Indicates if visible.
 @param [cfg.culled=false] {Boolean}        Indicates if culled from view.
 @param [cfg.pickable=true] {Boolean}       Indicates if pickable.
 @param [cfg.clippable=true] {Boolean}      Indicates if clippable.
 @param [cfg.collidable=true] {Boolean}     Indicates if included in boundary calculations.
 @param [cfg.castShadow=true] {Boolean}     Indicates if casting shadows.
 @param [cfg.receiveShadow=true] {Boolean}  Indicates if receiving shadows.
 @param [cfg.outlined=false] {Boolean}      Indicates if outline is rendered.
 @param [cfg.ghosted=false] {Boolean}       Indicates if rendered as ghosted.
 @param [cfg.highlighted=false] {Boolean}   Indicates if rendered as highlighted.
 @param [cfg.selected=false] {Boolean}      Indicates if rendered as selected.
 @param [cfg.edges=false] {Boolean}         Indicates if edges are emphasized.
 @param [cfg.aabbVisible=false] {Boolean}   Indicates if axis-aligned World-space bounding box is visible.
 @param [cfg.obbVisible=false] {Boolean}    Indicates if oriented World-space bounding box is visible.
 @param [cfg.colorize=[1.0,1.0,1.0]] {Float32Array}  RGB colorize color, multiplies by the rendered fragment colors.
 @param [cfg.opacity=1.0] {Number} Opacity factor, multiplies by the rendered fragment alpha.
 @param [cfg.children] {Array(Object)}      Children to add. Children must be in the same {{#crossLink "Scene"}}{{/crossLink}} and will be removed from whatever parents they may already have.
 @param [cfg.inheritStates=true] {Boolean}  Indicates if children given to this constructor should inherit state from this parent as they are added. State includes {{#crossLink "Object/visible:property"}}{{/crossLink}}, {{#crossLink "Object/culled:property"}}{{/crossLink}}, {{#crossLink "Object/pickable:property"}}{{/crossLink}},
 {{#crossLink "Object/clippable:property"}}{{/crossLink}}, {{#crossLink "Object/castShadow:property"}}{{/crossLink}}, {{#crossLink "Object/receiveShadow:property"}}{{/crossLink}},
 {{#crossLink "Object/outlined:property"}}{{/crossLink}}, {{#crossLink "Object/ghosted:property"}}{{/crossLink}}, {{#crossLink "Object/highlighted:property"}}{{/crossLink}},
 {{#crossLink "Object/selected:property"}}{{/crossLink}}, {{#crossLink "Object/colorize:property"}}{{/crossLink}} and {{#crossLink "Object/opacity:property"}}{{/crossLink}}.
 @extends Object
 */
const type$38 = "xeogl.Group";

 class Group extends xeoglObject{

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$38;
    }

    init(cfg) {
        super.init(cfg);
    }
}

componentClasses[type$38] = Group;

/**
 A **Model** is a {{#crossLink "Group"}}{{/crossLink}} of {{#crossLink "Component"}}Components{{/crossLink}}.

 Model is an abstract base class that's subclassed by (at least):

 * {{#crossLink "GLTFModel"}}{{/crossLink}}, which loads its components from glTF files.
 * {{#crossLink "OBJModel"}}{{/crossLink}}, which loads its components from .OBJ and .MTL files.
 * {{#crossLink "STLModel"}}{{/crossLink}}, which loads its components from .STL files.
 * {{#crossLink "SceneJSModel"}}{{/crossLink}}, which loads its components from SceneJS scene definitions.
 * {{#crossLink "BuildableModel"}}{{/crossLink}}, which provides a fluent API for building its components.


 @class Model
 @module xeogl
 @submodule models
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata.
 @param [cfg.entityType] {String} Optional entity classification when using within a semantic data model. See the {{#crossLink "Object"}}{{/crossLink}} documentation for usage.
 @param [cfg.parent] {Object} The parent.
 @param [cfg.position=[0,0,0]] {Float32Array} Local 3D position.
 @param [cfg.scale=[1,1,1]] {Float32Array} Local scale.
 @param [cfg.rotation=[0,0,0]] {Float32Array} Local rotation, as Euler angles given in degrees, for each of the X, Y and Z axis.
 @param [cfg.matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] {Float32Array} Local modelling transform matrix. Overrides the position, scale and rotation parameters.
 @param [cfg.visible=true] {Boolean}        Indicates if visible.
 @param [cfg.culled=false] {Boolean}        Indicates if culled from view.
 @param [cfg.pickable=true] {Boolean}       Indicates if pickable.
 @param [cfg.clippable=true] {Boolean}      Indicates if clippable.
 @param [cfg.collidable=true] {Boolean}     Indicates if included in boundary calculations.
 @param [cfg.castShadow=true] {Boolean}     Indicates if casting shadows.
 @param [cfg.receiveShadow=true] {Boolean}  Indicates if receiving shadows.
 @param [cfg.outlined=false] {Boolean}      Indicates if outline is rendered.
 @param [cfg.ghosted=false] {Boolean}       Indicates if rendered as ghosted.
 @param [cfg.highlighted=false] {Boolean}   Indicates if rendered as highlighted.
 @param [cfg.selected=false] {Boolean}      Indicates if rendered as selected.
 @param [cfg.edges=false] {Boolean}         Indicates if edges are emphasized.
 @param [cfg.aabbVisible=false] {Boolean}   Indicates if axis-aligned World-space bounding box is visible.
 @param [cfg.obbVisible=false] {Boolean}    Indicates if oriented World-space bounding box is visible.
 @param [cfg.colorize=[1.0,1.0,1.0]] {Float32Array}  RGB colorize color, multiplies by the rendered fragment colors.
 @param [cfg.opacity=1.0] {Number} Opacity factor, multiplies by the rendered fragment alpha.

 @extends Group
 */
const type$39 = "xeogl.Model";

class Model extends Group {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$39;
    }

    init(cfg) {

        /**
         All contained {{#crossLink "Components"}}{{/crossLink}}, mapped to their IDs.

         @property components
         @type {{String:Component}}
         */
        this.components = {};

        /**
         Number of contained {{#crossLink "Components"}}{{/crossLink}}.

         @property numComponents
         @type Number
         */
        this.numComponents = 0;

        /**
         A map of maps; for each contained {{#crossLink "Component"}}{{/crossLink}} type,
         a map to IDs to {{#crossLink "Component"}}{{/crossLink}} instances, eg.

         ````
         "xeogl.Geometry": {
                "alpha": <xeogl.Geometry>,
                "beta": <xeogl.Geometry>
              },
         "xeogl.Rotate": {
                "charlie": <xeogl.Rotate>,
                "delta": <xeogl.Rotate>,
                "echo": <xeogl.Rotate>,
              },
         //...
         ````

         @property types
         @type {String:{String:xeogl.Component}}
         */
        this.types = {};

        /**
         All contained {{#crossLink "Object"}}Objects{{/crossLink}}, mapped to their IDs.

         @property objects
         @final
         @type {{String:Object}}
         */
        this.objects = {};

        /**
         {{#crossLink "Object"}}Objects{{/crossLink}} in this Model that have GUIDs, mapped to their GUIDs.

         Each Object is registered in this map when its {{#crossLink "Object/guid:property"}}{{/crossLink}} is
         assigned a value.

         @property guidObjects
         @final
         @type {{String:Object}}
         */
        this.guidObjects = {};

        /**
         All contained {{#crossLink "Mesh"}}Meshes{{/crossLink}}, mapped to their IDs.

         @property meshes
         @final
         @type {String:xeogl.Mesh}
         */
        this.meshes = {};

        /**
         {{#crossLink "Object"}}Objects{{/crossLink}} in this Model that have entity types, mapped to their IDs.

         Each Object is registered in this map when its {{#crossLink "Object/entityType:property"}}{{/crossLink}} is
         set to value.

         @property entities
         @final
         @type {{String:Object}}
         */
        this.entities = {};

        /**
         For each entity type, a map of IDs to {{#crossLink "Object"}}Objects{{/crossLink}} of that entity type.

         Each Object is registered in this map when its {{#crossLink "Object/entityType:property"}}{{/crossLink}} is
         assigned a value.

         @property entityTypes
         @final
         @type {String:{String:xeogl.Component}}
         */
        this.entityTypes = {};

        /**
         Lazy-regenerated ID lists.
         */
        this._objectGUIDs = null;
        this._entityIds = null;

        // xeogl.Model overrides xeogl.Group / xeogl.Object state properties, (eg. visible, ghosted etc)
        // and those redefined properties are being set here through the super constructor.

        super.init(cfg); // Call xeogl.Group._init()

        this.scene._modelCreated(this);
    }

    _addComponent(component) {
        let types;
        if (utils.isNumeric(component) || utils.isString(component)) { // Component ID
            component = this.scene.components[component];
            if (!component) {
                this.warn("Component not found: " + utils.inQuotes(component));
                return;
            }
        } else if (utils.isObject(component)) { // Component config
            const type = component.type || "xeogl.Component";
            if (!core.isComponentType(type)) {
                this.error("Not a xeogl component type: " + type);
                return;
            }
            component = new window[type](this.scene, component);
        }
        if (component.scene !== this.scene) { // Component in wrong Scene
            this.error("Attempted to add component from different xeogl.Scene: " + utils.inQuotes(component.id));
            return;
        }
        if (this.components[component.id]) { // Component already in this Model
            return;
        }
        if (component.model && component.model.id !== this.id) { // Component in other Model
            component.model._removeComponent(component); // Transferring to this Model
        }
        this.components[component.id] = component;
        types = this.types[component.type];
        if (!types) {
            types = this.types[component.type] = {};
        }
        types[component.id] = component;
        if (component.isType("xeogl.Object")) {
            const object = component;
            this.objects[object.id] = object;
            if (object.entityType) {
                this.entities[object.id] = object;
                let objectsOfType = this.entityTypes[object.entityType];
                if (!objectsOfType) {
                    objectsOfType = {};
                    this.entityTypes[object.entityType] = objectsOfType;
                }
                objectsOfType[object.id] = object;
                this._entityIds = null; // Lazy regenerate
                this._entityTypeIds = null; // Lazy regenerate
            }
            if (object.guid) {
                this.guidObjects[object.id] = object;
                this._objectGUIDs = null; // To lazy-rebuild
            }
            if (component.isType("xeogl.Mesh")) {
                this.meshes[component.id] = component;
            }
        }
        this.numComponents++;
        component._addedToModel(this);
        return component;
    }

    _removeComponent(component) {
        const id = component.id;
        delete this.components[id];
        delete this.meshes[id];
        delete this.objects[id];
        if (component.entityType) {
            delete this.entities[id];
            const objectsOfType = this.entityTypes[component.entityType];
            if (objectsOfType) {
                delete objectsOfType[id];
            }
            this._entityIds = null; // Lazy regenerate
            this._entityTypeIds = null; // Lazy regenerate
        }
        if (component.guid) {
            delete this.guidObjects[component.guid];
            this._objectGUIDs = null; // To lazy-rebuild
        }
    }

    /**
     Destroys all {{#crossLink "Component"}}Components{{/crossLink}} in this Model.
     @method clear
     */
    clear() {
        // For efficiency, destroy Meshes first to avoid
        // xeogl's automatic default component substitutions
        for (var id in this.meshes) {
            if (this.meshes.hasOwnProperty(id)) {
                this.meshes[id].destroy();
            }
        }
        for (var id in this.components) {
            if (this.components.hasOwnProperty(id)) {
                this.components[id].destroy(); // Groups in this Model will remove themselves when they're destroyed
            }
        }
        this.components = {};
        this.numComponents = 0;
        this.types = {};
        this.objects = {};
        this.meshes = {};
        this.entities = {};
    }

    /**
     Convenience array of entity type IDs in {{#crossLink "Model/entityTypes:property"}}{{/crossLink}}.
     @property entityTypeIds
     @final
     @type {Array of String}
     */
    get objectGUIDs() {
        if (!this._objectGUIDs) {
            this._objectGUIDs = Object.keys(this.guidObjects);
        }
        return this._objectGUIDs;
    }

    /**
     Convenience array of entity type IDs in {{#crossLink "Model/entityTypes:property"}}{{/crossLink}}.
     @property entityTypeIds
     @final
     @type {Array of String}
     */
    get entityTypeIds() {
        if (!this._entityTypeIds) {
            this._entityTypeIds = Object.keys(this.entityTypes);
        }
        return this._entityTypeIds;
    }

    /**
     Convenience array of IDs in {{#crossLink "Model/entities:property"}}{{/crossLink}}.
     @property entityIds
     @final
     @type {Array of String}
     */
    get entityIds() {
        if (!this._entityIds) {
            this._entityIds = Object.keys(this.entities);
        }
        return this._entityIds;
    }

    /**
     * @deprecated
     */
    destroyAll() {
        this.clear();
    }

    destroy() {
        super.destroy();
        this.clear();
        this.scene._modelDestroyed(this);
    }
}

componentClasses[type$39] = Model;

/**
 A **LambertMaterial** is a {{#crossLink "Material"}}{{/crossLink}} that defines the surface appearance of
 attached {{#crossLink "Mesh"}}Meshes{{/crossLink}} using
 the non-physically based <a href="https://en.wikipedia.org/wiki/Lambertian_reflectance">Lambertian</a> model for calculating reflectance.

 ## Examples

 TODO

 ## Overview

 * Used for rendering non-realistic objects such as "helpers", wireframe objects, labels etc.
 * Use  {{#crossLink "PhongMaterial"}}{{/crossLink}} when you need specular highlights.
 * Use the physically based {{#crossLink "MetallicMaterial"}}{{/crossLink}} or {{#crossLink "SpecularMaterial"}}{{/crossLink}} when you need more realism.

 For LambertMaterial, the illumination calculation is performed at each triangle vertex, and the resulting color is
 interpolated across the face of the triangle. For {{#crossLink "PhongMaterial"}}{{/crossLink}}, {{#crossLink "MetallicMaterial"}}{{/crossLink}} and
 {{#crossLink "SpecularMaterial"}}{{/crossLink}}, vertex normals are interpolated across the surface of the triangle, and
 the illumination calculation is performed at each texel.

 The following table summarizes LambertMaterial properties:

 | Property | Type | Range | Default Value | Space | Description |
 |:--------:|:----:|:-----:|:-------------:|:-----:|:-----------:|
 |  {{#crossLink "LambertMaterial/ambient:property"}}{{/crossLink}} | Array | [0, 1] for all components | [1,1,1,1] | linear | The RGB components of the ambient light reflected by the material. |
 |  {{#crossLink "LambertMaterial/color:property"}}{{/crossLink}} | Array | [0, 1] for all components | [1,1,1,1] | linear | The RGB components of the diffuse light reflected by the material. |
 |  {{#crossLink "LambertMaterial/emissive:property"}}{{/crossLink}} | Array | [0, 1] for all components | [0,0,0] | linear | The RGB components of the light emitted by the material. |
 | {{#crossLink "LambertMaterial/alpha:property"}}{{/crossLink}} | Number | [0, 1] | 1 | linear | The transparency of the material surface (0 fully transparent, 1 fully opaque). |
 | {{#crossLink "LambertMaterial/lineWidth:property"}}{{/crossLink}} | Number | [0..100] | 1 |  | Line width in pixels. |
 | {{#crossLink "LambertMaterial/pointSize:property"}}{{/crossLink}} | Number | [0..100] | 1 |  | Point size in pixels. |
 | {{#crossLink "LambertMaterial/backfaces:property"}}{{/crossLink}} | Boolean |  | false |  | Whether to render {{#crossLink "Geometry"}}Geometry{{/crossLink}} backfaces. |
 | {{#crossLink "LambertMaterial/backfaces:property"}}{{/crossLink}} | String | "ccw", "cw" | "ccw" |  | The winding order for {{#crossLink "Geometry"}}Geometry{{/crossLink}} frontfaces - "cw" for clockwise, or "ccw" for counter-clockwise. |

 ## Usage

 ```` javascript
 var torus = new xeogl.Mesh({
    material: new xeogl.LambertMaterial({
        ambient: [0.3, 0.3, 0.3],
        color: [0.5, 0.5, 0.0],
        alpha: 1.0 // Default
    }),

    geometry: new xeogl.TorusGeometry()
});
 ````
 @class LambertMaterial
 @module xeogl
 @submodule materials
 @constructor
 @extends Material
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} The LambertMaterial configuration
 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.
 @param [cfg.meta=null] {String:Object} Metadata to attach to this LambertMaterial.
 @param [cfg.ambient=[1.0, 1.0, 1.0 ]] {Array of Number} LambertMaterial ambient color.
 @param [cfg.color=[ 1.0, 1.0, 1.0 ]] {Array of Number} LambertMaterial diffuse color.
 @param [cfg.emissive=[ 0.0, 0.0, 0.0 ]] {Array of Number} LambertMaterial emissive color.
 @param [cfg.alpha=1] {Number} Scalar in range 0-1 that controls alpha, where 0 is completely transparent and 1 is completely opaque.
 @param [cfg.reflectivity=1] {Number} Scalar in range 0-1 that controls how much {{#crossLink "CubeMap"}}CubeMap{{/crossLink}} is reflected.
 @param [cfg.lineWidth=1] {Number} Scalar that controls the width of lines for {{#crossLink "Geometry"}}{{/crossLink}} with {{#crossLink "Geometry/primitive:property"}}{{/crossLink}} set to "lines".
 @param [cfg.pointSize=1] {Number} Scalar that controls the size of points for {{#crossLink "Geometry"}}{{/crossLink}} with {{#crossLink "Geometry/primitive:property"}}{{/crossLink}} set to "points".
 @param [cfg.backfaces=false] {Boolean} Whether to render {{#crossLink "Geometry"}}Geometry{{/crossLink}} backfaces.
 @param [cfg.frontface="ccw"] {Boolean} The winding order for {{#crossLink "Geometry"}}Geometry{{/crossLink}} front faces - "cw" for clockwise, or "ccw" for counter-clockwise.
 */

const type$40 = "xeogl.LambertMaterial";

class LambertMaterial extends Material {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$40;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            type: "LambertMaterial",
            ambient: math.vec3([1.0, 1.0, 1.0]),
            color: math.vec3([1.0, 1.0, 1.0]),
            emissive: math.vec3([0.0, 0.0, 0.0]),
            alpha: null,
            alphaMode: 0, // 2 ("blend") when transparent, so renderer knows when to add to transparency bin
            lineWidth: null,
            pointSize: null,
            backfaces: null,
            frontface: null, // Boolean for speed; true == "ccw", false == "cw"
            hash: "/lam;"
        });

        this.ambient = cfg.ambient;
        this.color = cfg.color;
        this.emissive = cfg.emissive;
        this.alpha = cfg.alpha;
        this.lineWidth = cfg.lineWidth;
        this.pointSize = cfg.pointSize;
        this.backfaces = cfg.backfaces;
        this.frontface = cfg.frontface;
    }

    /**
     The LambertMaterial's ambient color.

     @property ambient
     @default [0.3, 0.3, 0.3]
     @type Float32Array
     */

    set  ambient(value) {
        let ambient = this._state.ambient;
        if (!ambient) {
            ambient = this._state.ambient = new Float32Array(3);
        } else if (value && ambient[0] === value[0] && ambient[1] === value[1] && ambient[2] === value[2]) {
            return;
        }
        if (value) {
            ambient[0] = value[0];
            ambient[1] = value[1];
            ambient[2] = value[2];
        } else {
            ambient[0] = .2;
            ambient[1] = .2;
            ambient[2] = .2;
        }
        this._renderer.imageDirty();
    }

    get ambient() {
        return this._state.ambient;
    }

    /**
     The LambertMaterial's diffuse color.

     @property color
     @default [1.0, 1.0, 1.0]
     @type Float32Array
     */
    set color(value) {
        let color = this._state.color;
        if (!color) {
            color = this._state.color = new Float32Array(3);
        } else if (value && color[0] === value[0] && color[1] === value[1] && color[2] === value[2]) {
            return;
        }
        if (value) {
            color[0] = value[0];
            color[1] = value[1];
            color[2] = value[2];
        } else {
            color[0] = 1;
            color[1] = 1;
            color[2] = 1;
        }
        this._renderer.imageDirty();
    }

    get color() {
        return this._state.color;
    }

    /**
     The LambertMaterial's emissive color.

     @property emissive
     @default [0.0, 0.0, 0.0]
     @type Float32Array
     */
    set emissive(value) {
        let emissive = this._state.emissive;
        if (!emissive) {
            emissive = this._state.emissive = new Float32Array(3);
        } else if (value && emissive[0] === value[0] && emissive[1] === value[1] && emissive[2] === value[2]) {
            return;
        }
        if (value) {
            emissive[0] = value[0];
            emissive[1] = value[1];
            emissive[2] = value[2];
        } else {
            emissive[0] = 0;
            emissive[1] = 0;
            emissive[2] = 0;
        }
        this._renderer.imageDirty();
    }

    get emissive() {
        return this._state.emissive;
    }

    /**
     Factor in the range [0..1] indicating how transparent the LambertMaterial is.

     A value of 0.0 indicates fully transparent, 1.0 is fully opaque.

     @property alpha
     @default 1.0
     @type Number
     */

    set alpha(value) {
        value = (value !== undefined && value !== null) ? value : 1.0;
        if (this._state.alpha === value) {
            return;
        }
        this._state.alpha = value;
        this._state.alphaMode = value < 1.0 ? 2 /* blend */ : 0;
        /* opaque */
        this._renderer.imageDirty();
    }

    get alpha() {
        return this._state.alpha;
    }

    /**
     The LambertMaterial's line width.

     @property lineWidth
     @default 1.0
     @type Number
     */

    set lineWidth(value) {
        this._state.lineWidth = value || 1.0;
        this._renderer.imageDirty();
    }

    get lineWidth() {
        return this._state.lineWidth;
    }

    /**
     The LambertMaterial's point size.

     @property pointSize
     @default 1.0
     @type Number
     */
    set pointSize(value) {
        this._state.pointSize = value || 1.0;
        this._renderer.imageDirty();
    }

    get pointSize() {
        return this._state.pointSize;
    }

    /**
     Whether backfaces are visible on attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     The backfaces will belong to {{#crossLink "Geometry"}}{{/crossLink}} components that are also attached to
     the {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     @property backfaces
     @default false
     @type Boolean
     */
    set backfaces(value) {
        value = !!value;
        if (this._state.backfaces === value) {
            return;
        }
        this._state.backfaces = value;
        this._renderer.imageDirty();
    }

    get backfaces() {
        return this._state.backfaces;
    }

    /**
     Indicates the winding direction of front faces on attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     The faces will belong to {{#crossLink "Geometry"}}{{/crossLink}} components that are also attached to
     the {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     @property frontface
     @default "ccw"
     @type String
     */
    set frontface(value) {
        value = value !== "cw";
        if (this._state.frontface === value) {
            return;
        }
        this._state.frontface = value;
        this._renderer.imageDirty();
    }

    get frontface() {
        return this._state.frontface ? "ccw" : "cw";
    }

    _getState() {
        return this._state;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
    }
}

componentClasses[type$40] = LambertMaterial;

/**
 A **SpecularMaterial** is a physically-based {{#crossLink "Material"}}{{/crossLink}} that defines the surface appearance of
 {{#crossLink "Mesh"}}Meshes{{/crossLink}} using the *specular-glossiness* workflow.

 ## Examples

 | <a href="../../examples/#importing_gltf_pbr_specular_telephone"><img src="../../assets/images/screenshots/SpecularMaterial/telephone.png"></img></a> | <a href="../../examples/#materials_specular_samples"><img src="../../assets/images/screenshots/SpecularMaterial/materials.png"></img></a> | <a href="../../examples/#materials_specular_textures"><img src="../../assets/images/screenshots/SpecularMaterial/textures.png"></img></a> | <a href="../../examples/#materials_specular_specularVsGlossiness"><img src="../../assets/images/screenshots/SpecularMaterial/specVsGloss.png"></img></a> |
 |:------:|:----:|:-----:|:-----:|
 |[glTF models with PBR materials](../../examples/#importing_gltf_pbr_specular_telephone)|[Sample materials ](../../examples/#materials_specular_samples) | [Texturing spec/gloss channels](../../examples/#materials_specular_textures) | [Specular Vs. glossiness](../../examples/#materials_specular_specularVsGlossiness) |

 ## Overview

 * SpecularMaterial is usually used for insulators, such as ceramic, wood and plastic.
 * {{#crossLink "MetallicMaterial"}}{{/crossLink}} is usually used for conductive materials, such as metal.
 * {{#crossLink "PhongMaterial"}}{{/crossLink}} is usually used for non-realistic objects.

 For an introduction to PBR concepts, try these articles:

 * Joe Wilson's [Basic Theory of Physically-Based Rendering](https://www.marmoset.co/posts/basic-theory-of-physically-based-rendering/)
 * Jeff Russel's [Physically-based Rendering, and you can too!](https://www.marmoset.co/posts/physically-based-rendering-and-you-can-too/)
 * Sebastien Legarde's [Adapting a physically-based shading model](http://seblagarde.wordpress.com/tag/physically-based-rendering/)

 The following table summarizes SpecularMaterial properties:

 | Property | Type | Range | Default Value | Space | Description |
 |:--------:|:----:|:-----:|:-------------:|:-----:|:-----------:|
 | {{#crossLink "SpecularMaterial/diffuse:property"}}{{/crossLink}} | Array | [0, 1] for all components | [1,1,1,1] | linear | The RGB components of the diffuse color of the material. |
 | {{#crossLink "SpecularMaterial/specular:property"}}{{/crossLink}} | Array | [0, 1] for all components | [1,1,1,1] | linear | The RGB components of the specular color of the material. |
 | {{#crossLink "SpecularMaterial/glossiness:property"}}{{/crossLink}} | Number | [0, 1] | 1 | linear | The glossiness the material. |
 | {{#crossLink "SpecularMaterial/specularF0:property"}}{{/crossLink}} | Number | [0, 1] | 1 | linear | The specularF0 of the material surface. |
 | {{#crossLink "SpecularMaterial/emissive:property"}}{{/crossLink}} | Array | [0, 1] for all components | [0,0,0] | linear | The RGB components of the emissive color of the material. |
 | {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}} | Number | [0, 1] | 1 | linear | The transparency of the material surface (0 fully transparent, 1 fully opaque). |
 | {{#crossLink "SpecularMaterial/diffuseMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | sRGB | Texture RGB components multiplying by {{#crossLink "SpecularMaterial/diffuse:property"}}{{/crossLink}}. If the fourth component (A) is present, it multiplies by {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}}. |
 | {{#crossLink "SpecularMaterial/specularMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | sRGB | Texture RGB components multiplying by {{#crossLink "SpecularMaterial/specular:property"}}{{/crossLink}}. If the fourth component (A) is present, it multiplies by {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}}. |
 | {{#crossLink "SpecularMaterial/glossinessMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Texture with first component multiplying by {{#crossLink "SpecularMaterial/glossiness:property"}}{{/crossLink}}. |
 | {{#crossLink "SpecularMaterial/specularGlossinessMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Texture with first three components multiplying by {{#crossLink "SpecularMaterial/specular:property"}}{{/crossLink}} and fourth component multiplying by {{#crossLink "SpecularMaterial/glossiness:property"}}{{/crossLink}}. |
 | {{#crossLink "SpecularMaterial/emissiveMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Texture with RGB components multiplying by {{#crossLink "SpecularMaterial/emissive:property"}}{{/crossLink}}. |
 | {{#crossLink "SpecularMaterial/alphaMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Texture with first component multiplying by {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}}. |
 | {{#crossLink "SpecularMaterial/occlusionMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Ambient occlusion texture multiplying by surface's reflected diffuse and specular light. |
 | {{#crossLink "SpecularMaterial/normalMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Tangent-space normal map. |
 | {{#crossLink "SpecularMaterial/alphaMode:property"}}{{/crossLink}} | String | "opaque", "blend", "mask" | "blend" |  | Alpha blend mode. |
 | {{#crossLink "SpecularMaterial/alphaCutoff:property"}}{{/crossLink}} | Number | [0..1] | 0.5 |  | Alpha cutoff value. |
 | {{#crossLink "SpecularMaterial/backfaces:property"}}{{/crossLink}} | Boolean |  | false |  | Whether to render {{#crossLink "Geometry"}}Geometry{{/crossLink}} backfaces. |
 | {{#crossLink "SpecularMaterial/frontface:property"}}{{/crossLink}} | String | "ccw", "cw" | "ccw" |  | The winding order for {{#crossLink "Geometry"}}Geometry{{/crossLink}} frontfaces - "cw" for clockwise, or "ccw" for counter-clockwise. |

 ## Usage

 In the example below we'll create the plastered sphere shown in the [Sample Materials](../../examples/#materials_specular_textures) example (see screenshots above).

 Here's a closeup of the sphere we'll create:

 <a href="../../examples/#materials_specular_samples"><img src="../../assets/images/screenshots/SpecularMaterial/plaster.png"></img></a>

 Our plastered sphere {{#crossLink "Mesh"}}{{/crossLink}} has:

 * a {{#crossLink "SphereGeometry"}}{{/crossLink}},
 * a SpecularMaterial with {{#crossLink "Texture"}}Textures{{/crossLink}} providing diffuse, glossiness, specular and normal maps.

 We'll also provide its {{#crossLink "Scene"}}{{/crossLink}}'s {{#crossLink "Lights"}}{{/crossLink}} with
 {{#crossLink "DirLight"}}DirLights{{/crossLink}}, plus {{#crossLink "CubeTexture"}}CubeTextures{{/crossLink}} for light
 and reflection maps.

 Note that in this example we're providing separate {{#crossLink "Texture"}}Textures{{/crossLink}} for the {{#crossLink "SpecularMaterial/specular:property"}}{{/crossLink}} and {{#crossLink "SpecularMaterial/glossiness:property"}}{{/crossLink}}
 channels, which allows us a little creative flexibility. Then, in the next example further down, we'll combine those channels
 within the same {{#crossLink "Texture"}}{{/crossLink}} for efficiency.

 ````javascript
 var plasteredSphere = new xeogl.Mesh({

    geometry: new xeogl.SphereGeometry({
        center: [0,0,0],
        radius: 1.5,
        heightSegments: 60,
        widthSegments: 60
    }),

    material: new xeogl.SpecularMaterial({

        // Channels with default values, just to show them

        diffuse: [1.0, 1.0, 1.0],
        specular: [1.0, 1.0, 1.0],
        glossiness: 1.0,
        emissive: [0.0, 0.0, 0.0]
        alpha: 1.0,

        // Textures to multiply some of the channels

        diffuseMap: {       // RGB components multiply by diffuse
            src: "textures/materials/poligon/Plaster07_1k/Plaster07_COL_VAR1_1K.jpg"
        },
        specularMap: {      // RGB component multiplies by specular
            src: "textures/materials/poligon/Plaster07_1k/Plaster07_REFL_1K.jpg"
        },
        glossinessMap: {    // R component multiplies by glossiness
            src: "textures/materials/poligon/Plaster07_1k/Plaster07_GLOSS_1K.jpg"
        },
        normalMap: {
            src: "textures/materials/poligon/Plaster07_1k/Plaster07_NRM_1K.jpg"
        }
    })
 });

 var scene = plasteredSphere.scene;

 scene.lights.lights = [
 new xeogl.DirLight({
         dir: [0.8, -0.6, -0.8],
         color: [0.8, 0.8, 0.8],
         space: "view"
     }),
 new xeogl.DirLight({
         dir: [-0.8, -0.4, -0.4],
         color: [0.4, 0.4, 0.5],
         space: "view"
     }),
 new xeogl.DirLight({
         dir: [0.2, -0.8, 0.8],
         color: [0.8, 0.8, 0.8],
         space: "view"
     }
 ];

 scene.lights.lightMap = new xeogl.CubeTexture({
     src: [
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_PX.png",
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_NX.png",
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_PY.png",
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_NY.png",
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_PZ.png",
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_NZ.png"
     ]
 });

 scene.lights.reflectionMap = new xeogl.CubeTexture({
     src: [
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_PX.png",
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_NX.png",
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_PY.png",
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_NY.png",
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_PZ.png",
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_NZ.png"
     ]
 });
 ````

 ### Combining channels within the same textures

 In the previous example we provided separate {{#crossLink "Texture"}}Textures{{/crossLink}} for the {{#crossLink "SpecularMaterial/specular:property"}}{{/crossLink}} and
 {{#crossLink "SpecularMaterial/glossiness:property"}}{{/crossLink}} channels, but we can combine those channels into the same {{#crossLink "Texture"}}{{/crossLink}} to reduce download time, memory footprint and rendering time (and also for glTF compatibility).

 Here's our SpecularMaterial again with those channels combined in the
 {{#crossLink "SpecularMaterial/specularGlossinessMap:property"}}{{/crossLink}} {{#crossLink "Texture"}}Texture{{/crossLink}}, where the
 *RGB* component multiplies by {{#crossLink "SpecularMaterial/specular:property"}}{{/crossLink}} and *A* multiplies by {{#crossLink "SpecularMaterial/glossiness:property"}}{{/crossLink}}.

 ````javascript
 plasteredSphere.material = new xeogl.SpecularMaterial({

    // Default values
    diffuse: [1.0, 1.0, 1.0],
    specular: [1.0, 1.0, 1.0],
    glossiness: 1.0,
    emissive: [0.0, 0.0, 0.0]
    alpha: 1.0,

    diffuseMap: {
        src: "textures/materials/poligon/Plaster07_1k/Plaster07_COL_VAR1_1K.jpg"
    },
    specularGlossinessMap: { // RGB multiplies by specular, A by glossiness
        src: "textures/materials/poligon/Plaster07_1k/Plaster07_REFL_GLOSS_1K.jpg"
    },
    normalMap: {
        src: "textures/materials/poligon/Plaster07_1k/Plaster07_NRM_1K.jpg"
    }
 });
 ````

 Although not shown in this example, we can also texture {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}} with
 the *A* component of {{#crossLink "SpecularMaterial/diffuseMap:property"}}{{/crossLink}}'s {{#crossLink "Texture"}}{{/crossLink}},
 if required.

 ## Transparency

 ### Alpha Blending

 Let's make our plastered sphere transparent. We'll update its SpecularMaterial's {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}}
 and {{#crossLink "SpecularMaterial/alphaMode:property"}}{{/crossLink}}, causing it to blend 50% with the background:

 ````javascript
 plasteredSphere.material.alpha = 0.5;
 plasteredSphere.material.alphaMode = "blend";
 ````

 *TODO: Screenshot*

 ### Alpha Masking

 Now let's make holes in our plastered sphere. We'll give its SpecularMaterial an {{#crossLink "SpecularMaterial/alphaMap:property"}}{{/crossLink}}
 and configure {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}}, {{#crossLink "SpecularMaterial/alphaMode:property"}}{{/crossLink}},
 and {{#crossLink "SpecularMaterial/alphaCutoff:property"}}{{/crossLink}} to treat it as an alpha mask:

 ````javascript
 plasteredSphere.material.alphaMap = new xeogl.Texture({
     src: "textures/diffuse/crossGridColorMap.jpg"
 });

 plasteredSphere.material.alpha = 1.0;
 plasteredSphere.material.alphaMode = "mask";
 plasteredSphere.material.alphaCutoff = 0.2;
 ````

 *TODO: Screenshot*

 @class SpecularMaterial
 @module xeogl
 @submodule materials
 @constructor
 @extends Material

 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.

 @param [cfg] {*} The SpecularMaterial configuration

 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.

 @param [cfg.meta=null] {String:Object} Metadata to attach to this SpecularMaterial.

 @param [cfg.diffuse=[1,1,1]] {Float32Array}  RGB diffuse color of this SpecularMaterial. Multiplies by the RGB
 components of {{#crossLink "SpecularMaterial/diffuseMap:property"}}{{/crossLink}}.

 @param [cfg.diffuseMap=undefined] {Texture} RGBA {{#crossLink "Texture"}}{{/crossLink}} containing the diffuse color
 of this SpecularMaterial, with optional *A* component for alpha. The RGB components multiply by the
 {{#crossLink "SpecularMaterial/diffuse:property"}}{{/crossLink}} property,
 while the *A* component, if present, multiplies by the {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}} property.

 @param [cfg.specular=[1,1,1]] {Number} RGB specular color of this SpecularMaterial. Multiplies by the
 {{#crossLink "SpecularMaterial/specularMap:property"}}{{/crossLink}} and the *RGB* components of
 {{#crossLink "SpecularMaterial/specularGlossinessMap:property"}}{{/crossLink}}.

 @param [cfg.specularMap=undefined] {Texture} RGB texture containing the specular color of this SpecularMaterial. Multiplies
 by the {{#crossLink "SpecularMaterial/specular:property"}}{{/crossLink}} property. Must be within the same {{#crossLink "Scene"}}Scene{{/crossLink}} as this SpecularMaterial.

 @param [cfg.glossiness=1.0] {Number} Factor in the range [0..1] indicating how glossy this SpecularMaterial is. 0 is
 no glossiness, 1 is full glossiness. Multiplies by the *R* component of {{#crossLink "SpecularMaterial/glossinessMap:property"}}{{/crossLink}}
 and the *A* component of {{#crossLink "SpecularMaterial/specularGlossinessMap:property"}}{{/crossLink}}.

 @param [cfg.specularGlossinessMap=undefined] {Texture} RGBA {{#crossLink "Texture"}}{{/crossLink}} containing this
 SpecularMaterial's specular color in its *RGB* component and glossiness in its *A* component. Its *RGB* components multiply by the
 {{#crossLink "SpecularMaterial/specular:property"}}{{/crossLink}} property, while its *A* component multiplies by the
 {{#crossLink "SpecularMaterial/glossiness:property"}}{{/crossLink}} property. Must be within the same
 {{#crossLink "Scene"}}Scene{{/crossLink}} as this SpecularMaterial.

 @param [cfg.specularF0=0.0] {Number} Factor in the range 0..1 indicating how reflective this SpecularMaterial is.

 @param [cfg.emissive=[0,0,0]] {Float32Array}  RGB emissive color of this SpecularMaterial. Multiplies by the RGB
 components of {{#crossLink "SpecularMaterial/emissiveMap:property"}}{{/crossLink}}.

 @param [cfg.emissiveMap=undefined] {Texture} RGB {{#crossLink "Texture"}}{{/crossLink}} containing the emissive color of this
 SpecularMaterial. Multiplies by the {{#crossLink "SpecularMaterial/emissive:property"}}{{/crossLink}} property.
 Must be within the same {{#crossLink "Scene"}}Scene{{/crossLink}} as this SpecularMaterial.

 @param [cfg.occlusionMap=undefined] {Texture} RGB ambient occlusion {{#crossLink "Texture"}}{{/crossLink}}. Within shaders,
 multiplies by the specular and diffuse light reflected by surfaces. Must be within the same {{#crossLink "Scene"}}{{/crossLink}}
 as this SpecularMaterial.

 @param [cfg.normalMap=undefined] {Texture} RGB tangent-space normal {{#crossLink "Texture"}}{{/crossLink}}. Must be
 within the same {{#crossLink "Scene"}}Scene{{/crossLink}} as this SpecularMaterial.

 @param [cfg.alpha=1.0] {Number} Factor in the range 0..1 indicating how transparent this SpecularMaterial is.
 A value of 0.0 indicates fully transparent, 1.0 is fully opaque. Multiplies by the *R* component of
 {{#crossLink "SpecularMaterial/alphaMap:property"}}{{/crossLink}} and the *A* component, if present, of
 {{#crossLink "SpecularMaterial/diffuseMap:property"}}{{/crossLink}}.

 @param [cfg.alphaMap=undefined] {Texture} RGB {{#crossLink "Texture"}}{{/crossLink}} containing this SpecularMaterial's
 alpha in its *R* component. The *R* component multiplies by the {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}} property. Must
 be within the same {{#crossLink "Scene"}}Scene{{/crossLink}} as this SpecularMaterial.

 @param [cfg.alphaMode="opaque"] {String} The alpha blend mode - accepted values are "opaque", "blend" and "mask".
 See the {{#crossLink "SpecularMaterial/alphaMode:property"}}{{/crossLink}} property for more info.

 @param [cfg.alphaCutoff=0.5] {Number} The alpha cutoff value.
 See the {{#crossLink "SpecularMaterial/alphaCutoff:property"}}{{/crossLink}} property for more info.

 @param [cfg.backfaces=false] {Boolean} Whether to render {{#crossLink "Geometry"}}Geometry{{/crossLink}} backfaces.

 @param [cfg.frontface="ccw"] {Boolean} The winding order for {{#crossLink "Geometry"}}Geometry{{/crossLink}} front faces - "cw" for clockwise, or "ccw" for counter-clockwise.

 @param [cfg.lineWidth=1] {Number} Scalar that controls the width of lines for {{#crossLink "Geometry"}}{{/crossLink}} with {{#crossLink "Geometry/primitive:property"}}{{/crossLink}} set to "lines".
 @param [cfg.pointSize=1] {Number} Scalar that controls the size of points for {{#crossLink "Geometry"}}{{/crossLink}} with {{#crossLink "Geometry/primitive:property"}}{{/crossLink}} set to "points".

 */
const type$41 = "xeogl.SpecularMaterial";
const alphaModes$1 = {"opaque": 0, "mask": 1, "blend": 2};
const alphaModeNames$1 = ["opaque", "mask", "blend"];

class SpecularMaterial extends Material {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$41;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            type: "SpecularMaterial",
            diffuse: math.vec3([1.0, 1.0, 1.0]),
            emissive: math.vec3([0.0, 0.0, 0.0]),
            specular: math.vec3([1.0, 1.0, 1.0]),
            glossiness: null,
            specularF0: null,
            alpha: null,
            alphaMode: null,
            alphaCutoff: null,
            lineWidth: null,
            pointSize: null,
            backfaces: null,
            frontface: null, // Boolean for speed; true == "ccw", false == "cw"
            hash: null
        });

        this.diffuse = cfg.diffuse;
        this.specular = cfg.specular;
        this.glossiness = cfg.glossiness;
        this.specularF0 = cfg.specularF0;
        this.emissive = cfg.emissive;
        this.alpha = cfg.alpha;

        if (cfg.diffuseMap) {
            this._diffuseMap = this._checkComponent("xeogl.Texture", cfg.diffuseMap);
        }
        if (cfg.emissiveMap) {
            this._emissiveMap = this._checkComponent("xeogl.Texture", cfg.emissiveMap);
        }
        if (cfg.specularMap) {
            this._specularMap = this._checkComponent("xeogl.Texture", cfg.specularMap);
        }
        if (cfg.glossinessMap) {
            this._glossinessMap = this._checkComponent("xeogl.Texture", cfg.glossinessMap);
        }
        if (cfg.specularGlossinessMap) {
            this._specularGlossinessMap = this._checkComponent("xeogl.Texture", cfg.specularGlossinessMap);
        }
        if (cfg.occlusionMap) {
            this._occlusionMap = this._checkComponent("xeogl.Texture", cfg.occlusionMap);
        }
        if (cfg.alphaMap) {
            this._alphaMap = this._checkComponent("xeogl.Texture", cfg.alphaMap);
        }
        if (cfg.normalMap) {
            this._normalMap = this._checkComponent("xeogl.Texture", cfg.normalMap);
        }

        this.alphaMode = cfg.alphaMode;
        this.alphaCutoff = cfg.alphaCutoff;
        this.backfaces = cfg.backfaces;
        this.frontface = cfg.frontface;

        this.lineWidth = cfg.lineWidth;
        this.pointSize = cfg.pointSize;

        this._makeHash();
    }

    _makeHash() {
        const state = this._state;
        const hash = ["/spe"];
        if (this._diffuseMap) {
            hash.push("/dm");
            if (this._diffuseMap.hasMatrix) {
                hash.push("/mat");
            }
            hash.push("/" + this._diffuseMap.encoding);
        }
        if (this._emissiveMap) {
            hash.push("/em");
            if (this._emissiveMap.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._glossinessMap) {
            hash.push("/gm");
            if (this._glossinessMap.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._specularMap) {
            hash.push("/sm");
            if (this._specularMap.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._specularGlossinessMap) {
            hash.push("/sgm");
            if (this._specularGlossinessMap.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._occlusionMap) {
            hash.push("/ocm");
            if (this._occlusionMap.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._normalMap) {
            hash.push("/nm");
            if (this._normalMap.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._alphaMap) {
            hash.push("/opm");
            if (this._alphaMap.hasMatrix) {
                hash.push("/mat");
            }
        }
        hash.push(";");
        state.hash = hash.join("");
    }

    /**
     RGB diffuse color of this SpecularMaterial.

     Multiplies by the *RGB* components of {{#crossLink "SpecularMaterial/diffuseMap:property"}}{{/crossLink}}.

     @property diffuse
     @default [1.0, 1.0, 1.0]
     @type Float32Array
     */
    set diffuse(value) {
        let diffuse = this._state.diffuse;
        if (!diffuse) {
            diffuse = this._state.diffuse = new Float32Array(3);
        } else if (value && diffuse[0] === value[0] && diffuse[1] === value[1] && diffuse[2] === value[2]) {
            return;
        }
        if (value) {
            diffuse[0] = value[0];
            diffuse[1] = value[1];
            diffuse[2] = value[2];
        } else {
            diffuse[0] = 1;
            diffuse[1] = 1;
            diffuse[2] = 1;
        }
        this._renderer.imageDirty();
    }

    get diffuse() {
        return this._state.diffuse;
    }

    /**
     RGB {{#crossLink "Texture"}}{{/crossLink}} containing the diffuse color of this SpecularMaterial, with optional *A* component for alpha.

     The *RGB* components multiply by the {{#crossLink "SpecularMaterial/diffuse:property"}}{{/crossLink}} property,
     while the *A* component, if present, multiplies by the {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}} property.

     @property diffuseMap
     @default undefined
     @type {Texture}
     @final
     */
    get diffuseMap() {
        return this._diffuseMap;
    }

    /**
     RGB specular color of this SpecularMaterial.

     Multiplies by the {{#crossLink "SpecularMaterial/specularMap:property"}}{{/crossLink}}
     and the *A* component of {{#crossLink "SpecularMaterial/specularGlossinessMap:property"}}{{/crossLink}}.

     @property specular
     @default [1.0, 1.0, 1.0]
     @type Float32Array
     */
    set specular(value) {
        let specular = this._state.specular;
        if (!specular) {
            specular = this._state.specular = new Float32Array(3);
        } else if (value && specular[0] === value[0] && specular[1] === value[1] && specular[2] === value[2]) {
            return;
        }
        if (value) {
            specular[0] = value[0];
            specular[1] = value[1];
            specular[2] = value[2];
        } else {
            specular[0] = 1;
            specular[1] = 1;
            specular[2] = 1;
        }
        this._renderer.imageDirty();
    }

    get specular() {
        return this._state.specular;
    }

    /**
     RGB texture containing the specular color of this SpecularMaterial.

     Multiplies by the {{#crossLink "SpecularMaterial/specular:property"}}{{/crossLink}} property.

     @property specularMap
     @default undefined
     @type {Texture}
     @final
     */
    get specularMap() {
        return this._specularMap;
    }

    /**
     RGBA texture containing this SpecularMaterial's specular color in its *RGB* components and glossiness in its *A* component.

     The *RGB* components multiply by the {{#crossLink "SpecularMaterial/specular:property"}}{{/crossLink}} property, while
     the *A* component multiplies by the {{#crossLink "SpecularMaterial/glossiness:property"}}{{/crossLink}} property.

     @property specularGlossinessMap
     @default undefined
     @type {Texture}
     @final
     */
    get specularGlossinessMap() {
        return this._specularGlossinessMap;
    }

    /**
     Factor in the range [0..1] indicating how glossy this SpecularMaterial is.

     0 is no glossiness, 1 is full glossiness.

     Multiplies by the *R* component of {{#crossLink "SpecularMaterial/glossinessMap:property"}}{{/crossLink}}
     and the *A* component of {{#crossLink "SpecularMaterial/specularGlossinessMap:property"}}{{/crossLink}}.

     @property glossiness
     @default 1.0
     @type Number
     */
    set glossiness(value) {
        value = (value !== undefined && value !== null) ? value : 1.0;
        if (this._state.glossiness === value) {
            return;
        }
        this._state.glossiness = value;
        this._renderer.imageDirty();
    }

    get glossiness() {
        return this._state.glossiness;
    }

    /**
     RGB texture containing this SpecularMaterial's glossiness in its *R* component.

     The *R* component multiplies by the {{#crossLink "SpecularMaterial/glossiness:property"}}{{/crossLink}} property.

     Must be within the same {{#crossLink "Scene"}}Scene{{/crossLink}} as this SpecularMaterial.

     @property glossinessMap
     @default undefined
     @type {Texture}
     @final
     */
    get glossinessMap() {
        return this._glossinessMap;
    }

    /**
     Factor in the range [0..1] indicating amount of specular Fresnel.

     @property specularF0
     @default 0.0
     @type Number
     */
    set specularF0(value) {
        value = (value !== undefined && value !== null) ? value : 0.0;
        if (this._state.specularF0 === value) {
            return;
        }
        this._state.specularF0 = value;
        this._renderer.imageDirty();
    }

    get specularF0() {
        return this._state.specularF0;
    }

    /**
     RGB emissive color of this SpecularMaterial.

     Multiplies by {{#crossLink "SpecularMaterial/emissiveMap:property"}}{{/crossLink}}.

     @property emissive
     @default [0.0, 0.0, 0.0]
     @type Float32Array
     */
    set emissive(value) {
        let emissive = this._state.emissive;
        if (!emissive) {
            emissive = this._state.emissive = new Float32Array(3);
        } else if (value && emissive[0] === value[0] && emissive[1] === value[1] && emissive[2] === value[2]) {
            return;
        }
        if (value) {
            emissive[0] = value[0];
            emissive[1] = value[1];
            emissive[2] = value[2];
        } else {
            emissive[0] = 0;
            emissive[1] = 0;
            emissive[2] = 0;
        }
        this._renderer.imageDirty();
    }

    get emissive() {
        return this._state.emissive;
    }

    /**
     RGB texture containing the emissive color of this SpecularMaterial.

     Multiplies by the {{#crossLink "SpecularMaterial/emissive:property"}}{{/crossLink}} property.

     @property emissiveMap
     @default undefined
     @type {Texture}
     @final
     */
    get emissiveMap() {
        return this._emissiveMap;
    }

    /**
     Factor in the range [0..1] indicating how transparent this SpecularMaterial is.

     A value of 0.0 is fully transparent, while 1.0 is fully opaque.

     Multiplies by the *R* component of {{#crossLink "SpecularMaterial/alphaMap:property"}}{{/crossLink}} and
     the *A* component, if present, of {{#crossLink "SpecularMaterial/diffuseMap:property"}}{{/crossLink}}.

     @property alpha
     @default 1.0
     @type Number
     */
    set alpha(value) {
        value = (value !== undefined && value !== null) ? value : 1.0;
        if (this._state.alpha === value) {
            return;
        }
        this._state.alpha = value;
        this._renderer.imageDirty();
    }

    get alpha() {
        return this._state.alpha;
    }

    /**
     RGB {{#crossLink "Texture"}}{{/crossLink}} with alpha in its *R* component.

     The *R* component multiplies by the {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}} property.

     @property alphaMap
     @default undefined
     @type {Texture}
     @final
     */
    get alphaMap() {
        return this._alphaMap;
    }

    /**
     RGB tangent-space normal {{#crossLink "Texture"}}{{/crossLink}} attached to this SpecularMaterial.

     @property normalMap
     @default undefined
     @type {Texture}
     @final
     */
    get normalMap() {
        return this._normalMap;
    }

    /**
     RGB ambient occlusion {{#crossLink "Texture"}}{{/crossLink}} attached to this SpecularMaterial.

     Within objectRenderers, multiplies by the specular and diffuse light reflected by surfaces.

     @property occlusionMap
     @default undefined
     @type {Texture}
     @final
     */
    get occlusionMap() {
        return this._occlusionMap;
    }

    /**
     The alpha rendering mode.

     This governs how alpha is treated. Alpha is the combined result of the
     {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}} and
     {{#crossLink "SpecularMaterial/alphaMap:property"}}{{/crossLink}} properties.

     * "opaque" - The alpha value is ignored and the rendered output is fully opaque.
     * "mask" - The rendered output is either fully opaque or fully transparent depending on the alpha value and the specified alpha cutoff value.
     * "blend" - The alpha value is used to composite the source and destination areas. The rendered output is combined with the background using the normal painting operation (i.e. the Porter and Duff over operator)

     @property alphaMode
     @default "opaque"
     @type {String}
     */
    set alphaMode(alphaMode) {
        alphaMode = alphaMode || "opaque";
        let value = alphaModes$1[alphaMode];
        if (value === undefined) {
            this.error("Unsupported value for 'alphaMode': " + alphaMode + " defaulting to 'opaque'");
            value = "opaque";
        }
        if (this._state.alphaMode === value) {
            return;
        }
        this._state.alphaMode = value;
        this._renderer.imageDirty();
    }

    get alphaMode() {
        return alphaModeNames$1[this._state.alphaMode];
    }

    /**
     The alpha cutoff value.

     Specifies the cutoff threshold when {{#crossLink "SpecularMaterial/alphaMode:property"}}{{/crossLink}}
     equals "mask". If the alpha is greater than or equal to this value then it is rendered as fully
     opaque, otherwise, it is rendered as fully transparent. A value greater than 1.0 will render the entire
     material as fully transparent. This value is ignored for other modes.

     Alpha is the combined result of the
     {{#crossLink "SpecularMaterial/alpha:property"}}{{/crossLink}} and
     {{#crossLink "SpecularMaterial/alphaMap:property"}}{{/crossLink}} properties.

     @property alphaCutoff
     @default 0.5
     @type {Number}
     */
    set alphaCutoff(alphaCutoff) {
        if (alphaCutoff === null || alphaCutoff === undefined) {
            alphaCutoff = 0.5;
        }
        if (this._state.alphaCutoff === alphaCutoff) {
            return;
        }
        this._state.alphaCutoff = alphaCutoff;
    }

    get alphaCutoff() {
        return this._state.alphaCutoff;
    }

    /**
     Whether backfaces are visible on attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     The backfaces will belong to {{#crossLink "Geometry"}}{{/crossLink}} compoents that are also attached to
     the {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     @property backfaces
     @default false
     @type Boolean
     */
    set backfaces(value) {
        value = !!value;
        if (this._state.backfaces === value) {
            return;
        }
        this._state.backfaces = value;
        this._renderer.imageDirty();
    }

    get backfaces() {
        return this._state.backfaces;
    }

    /**
     Indicates the winding direction of front faces on attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     The faces will belong to {{#crossLink "Geometry"}}{{/crossLink}} components that are also attached to
     the {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     @property frontface
     @default "ccw"
     @type String
     */
    set frontface(value) {
        value = value !== "cw";
        if (this._state.frontface === value) {
            return;
        }
        this._state.frontface = value;
        this._renderer.imageDirty();
    }

    get frontface() {
        return this._state.frontface ? "ccw" : "cw";
    }

    /**
     The SpecularMaterial's line width.

     @property lineWidth
     @default 1.0
     @type Number
     */
    set lineWidth(value) {
        this._state.lineWidth = value || 1.0;
        this._renderer.imageDirty();
    }

    get lineWidth() {
        return this._state.lineWidth;
    }

    /**
     The SpecularMaterial's point size.

     @property pointSize
     @default 1
     @type Number
     */
    set pointSize(value) {
        this._state.pointSize = value || 1;
        this._renderer.imageDirty();
    }

    get pointSize() {
        return this._state.pointSize;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
    }
}

componentClasses[type$41] = SpecularMaterial;

/**
 A **MetallicMaterial** is a physically-based {{#crossLink "Material"}}{{/crossLink}} that defines the surface appearance of
 {{#crossLink "Mesh"}}Meshes{{/crossLink}} using the *metallic-roughness* workflow.

 ## Examples

 | <a href="../../examples/#importing_gltf_pbr_metallic_helmet"><img src="../../assets/images/screenshots/MetallicMaterial/helmet.png"></img></a> | <a href="../../examples/#materials_metallic_fireHydrant"><img src="../../assets/images/screenshots/MetallicMaterial/hydrant3.png"></img></a> | <a href="../../examples/#materials_metallic_samples_metals"><img src="../../assets/images/screenshots/MetallicMaterial/metals.png"></img></a> | <a href="../../examples/#materials_metallic_metallicVsRoughness"><img alt="Metallic Vs Roughness" src="../../assets/images/screenshots/MetallicMaterial/metalVsRough.png"></img></a> |
 |:------:|:----:|:-----:|:-----:|
 |[glTF models with PBR materials](../../examples/#importing_gltf_pbr_metallic_helmet)|[Fire hydrant model](../../examples/#materials_metallic_fireHydrant)| [Sample metal materials ](../../examples/#materials_metallic_samples_metals)|[Metallic Vs. roughness](../../examples/#materials_metallic_metallicVsRoughness)|

 ## Overview

 * MetallicMaterial is usually used for conductive materials, such as metal.
 * {{#crossLink "SpecularMaterial"}}{{/crossLink}} is usually used for insulators, such as wood, ceramics and plastic.
 * {{#crossLink "PhongMaterial"}}{{/crossLink}} is usually used for non-realistic objects.

 For an introduction to PBR concepts, try these articles:

 * Joe Wilson's [Basic Theory of Physically-Based Rendering](https://www.marmoset.co/posts/basic-theory-of-physically-based-rendering/)
 * Jeff Russel's [Physically-based Rendering, and you can too!](https://www.marmoset.co/posts/physically-based-rendering-and-you-can-too/)
 * Sebastien Legarde's [Adapting a physically-based shading model](http://seblagarde.wordpress.com/tag/physically-based-rendering/)

 The following table summarizes MetallicMaterial properties:

 | Property | Type | Range | Default Value | Space | Description |
 |:--------:|:----:|:-----:|:-------------:|:-----:|:-----------:|
 | {{#crossLink "MetallicMaterial/baseColor:property"}}{{/crossLink}} | Array | [0, 1] for all components | [1,1,1,1] | linear | The RGB components of the base color of the material. |
 | {{#crossLink "MetallicMaterial/metallic:property"}}{{/crossLink}} | Number | [0, 1] | 1 | linear | The metallic-ness the material (1 for metals, 0 for non-metals). |
 | {{#crossLink "MetallicMaterial/roughness:property"}}{{/crossLink}} | Number | [0, 1] | 1 | linear | The roughness of the material surface. |
 | {{#crossLink "MetallicMaterial/specularF0:property"}}{{/crossLink}} | Number | [0, 1] | 1 | linear | The specular Fresnel of the material surface. |
 | {{#crossLink "MetallicMaterial/emissive:property"}}{{/crossLink}} | Array | [0, 1] for all components | [0,0,0] | linear | The RGB components of the emissive color of the material. |
 | {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}} | Number | [0, 1] | 1 | linear | The transparency of the material surface (0 fully transparent, 1 fully opaque). |
 | {{#crossLink "MetallicMaterial/baseColorMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | sRGB | Texture RGB components multiplying by {{#crossLink "MetallicMaterial/baseColor:property"}}{{/crossLink}}. If the fourth component (A) is present, it multiplies by {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}}. |
 | {{#crossLink "MetallicMaterial/metallicMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Texture with first component multiplying by {{#crossLink "MetallicMaterial/metallic:property"}}{{/crossLink}}. |
 | {{#crossLink "MetallicMaterial/roughnessMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Texture with first component multiplying by {{#crossLink "MetallicMaterial/roughness:property"}}{{/crossLink}}. |
 | {{#crossLink "MetallicMaterial/metallicRoughnessMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Texture with first component multiplying by {{#crossLink "MetallicMaterial/metallic:property"}}{{/crossLink}} and second component multiplying by {{#crossLink "MetallicMaterial/roughness:property"}}{{/crossLink}}. |
 | {{#crossLink "MetallicMaterial/emissiveMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Texture with RGB components multiplying by {{#crossLink "MetallicMaterial/emissive:property"}}{{/crossLink}}. |
 | {{#crossLink "MetallicMaterial/alphaMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Texture with first component multiplying by {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}}. |
 | {{#crossLink "MetallicMaterial/occlusionMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Ambient occlusion texture multiplying by surface's reflected diffuse and specular light. |
 | {{#crossLink "MetallicMaterial/normalMap:property"}}{{/crossLink}} | {{#crossLink "Texture"}}{{/crossLink}} |  | null | linear | Tangent-space normal map. |
 | {{#crossLink "MetallicMaterial/alphaMode:property"}}{{/crossLink}} | String | "opaque", "blend", "mask" | "blend" |  | Alpha blend mode. |
 | {{#crossLink "MetallicMaterial/alphaCutoff:property"}}{{/crossLink}} | Number | [0..1] | 0.5 |  | Alpha cutoff value. |
 | {{#crossLink "MetallicMaterial/backfaces:property"}}{{/crossLink}} | Boolean |  | false |  | Whether to render {{#crossLink "Geometry"}}Geometry{{/crossLink}} backfaces. |
 | {{#crossLink "MetallicMaterial/frontface:property"}}{{/crossLink}} | String | "ccw", "cw" | "ccw" |  | The winding order for {{#crossLink "Geometry"}}Geometry{{/crossLink}} frontfaces - "cw" for clockwise, or "ccw" for counter-clockwise. |

 ## Usage

 In the example below we'll create the [yellow fire hydrant](../../examples/#materials_metallic_fireHydrant) shown in the example screen shots above. Our hydrant {{#crossLink "Mesh"}}{{/crossLink}} has:

 * a {{#crossLink "OBJGeometry"}}{{/crossLink}} which loads the fire hydrant mesh from an .OBJ file,
 * a MetallicMaterial with {{#crossLink "Texture"}}Textures{{/crossLink}} providing diffuse, metallic, roughness, occlusion and normal maps.

 We'll also provide its {{#crossLink "Scene"}}{{/crossLink}}'s {{#crossLink "Lights"}}{{/crossLink}} with
 {{#crossLink "DirLight"}}DirLights{{/crossLink}}, plus {{#crossLink "CubeTexture"}}CubeTextures{{/crossLink}} for light
 and reflection maps.

 Note that in this example we're providing separate {{#crossLink "Texture"}}Textures{{/crossLink}} for the {{#crossLink "MetallicMaterial/metallic:property"}}{{/crossLink}} and {{#crossLink "MetallicMaterial/roughness:property"}}{{/crossLink}}
 channels, which allows us a little creative flexibility. Then, in the next example further down, we'll combine those channels
 within the same {{#crossLink "Texture"}}{{/crossLink}} for efficiency.

 ````javascript
 var hydrant = new xeogl.Mesh({

    geometry: new xeogl.OBJGeometry({
        src: "models/obj/FireHydrantMesh.obj"
    }),

    material: new xeogl.MetallicMaterial({

        // Channels with default values, just to show them

        baseColor: [1.0, 1.0, 1.0],
        metallic: 1.0,
        roughness: 1.0,
        emissive: [0.0, 0.0, 0.0],
        alpha: 1.0,

        // Textures to multiply by some of the channels

        baseColorMap : new xeogl.Texture({  // Multiplies by baseColor
            src: "textures/diffuse/fire_hydrant_Base_Color.png"
        }),

        metallicMap : new xeogl.Texture({   // R component multiplies by metallic
            src: "textures/metallic/fire_hydrant_Metallic.png"
        }),

        roughnessMap : new xeogl.Texture({  // R component multiplies by roughness
            src: "textures/roughness/fire_hydrant_Roughness.png"
        }),

        occlusionMap : new xeogl.Texture({  // Multiplies by fragment alpha
            src: "textures/occlusion/fire_hydrant_Mixed_AO.png"
        }),

        normalMap : new xeogl.Texture({
            src: "textures/normal/fire_hydrant_Normal_OpenGL.png"
        })
    })
 });

 var scene = hydrant.scene;

 scene.lights.lights = [
 new xeogl.DirLight({
         dir: [0.8, -0.6, -0.8],
         color: [0.8, 0.8, 0.8],
         space: "view"
     }),
 new xeogl.DirLight({
         dir: [-0.8, -0.4, -0.4],
         color: [0.4, 0.4, 0.5],
         space: "view"
     }),
 new xeogl.DirLight({
         dir: [0.2, -0.8, 0.8],
         color: [0.8, 0.8, 0.8],
         space: "view"
     }
 ];

 scene.lights.lightMap = new xeogl.CubeTexture({
     src: [
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_PX.png",
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_NX.png",
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_PY.png",
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_NY.png",
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_PZ.png",
         "textures/light/Uffizi_Gallery/Uffizi_Gallery_Irradiance_NZ.png"
     ]
 });

 scene.lights.reflectionMap = new xeogl.CubeTexture({
     src: [
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_PX.png",
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_NX.png",
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_PY.png",
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_NY.png",
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_PZ.png",
         "textures/reflect/Uffizi_Gallery/Uffizi_Gallery_Radiance_NZ.png"
     ]
 });
 ````

 ### Combining channels within the same textures

 In the previous example we provided separate {{#crossLink "Texture"}}Textures{{/crossLink}} for the {{#crossLink "MetallicMaterial/metallic:property"}}{{/crossLink}} and
 {{#crossLink "MetallicMaterial/roughness:property"}}{{/crossLink}} channels, but we can combine those channels into the same {{#crossLink "Texture"}}{{/crossLink}} to reduce download time, memory footprint and rendering time (and also for glTF compatibility).

 Here's our MetallicMaterial again with those channels combined in the
 {{#crossLink "MetallicMaterial/metallicRoughnessMap:property"}}{{/crossLink}} {{#crossLink "Texture"}}Texture{{/crossLink}}, where the
 *R* component multiplies by {{#crossLink "MetallicMaterial/metallic:property"}}{{/crossLink}} and *G* multiplies by {{#crossLink "MetallicMaterial/roughness:property"}}{{/crossLink}}.

 ````javascript
 hydrant.material = new xeogl.MetallicMaterial({

    baseColor: [1,1,1], // Default value
    metallic: 1.0,      // Default value
    roughness: 1.0,     // Default value

    baseColorMap : new xeogl.Texture({
        src: "textures/diffuse/fire_hydrant_Base_Color.png"
    }),
    metallicRoughnessMap : new xeogl.Texture({
        src: "textures/metallicRoughness/fire_hydrant_MetallicRoughness.png"
    }),
    occlusionMap : new xeogl.Texture({
        src: "textures/occlusion/fire_hydrant_Mixed_AO.png"
    }),
    normalMap : new xeogl.Texture({
        src: "textures/normal/fire_hydrant_Normal_OpenGL.png"
    })
 });
 ````

 Although not shown in this example, we can also texture {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}} with
 the *A* component of {{#crossLink "MetallicMaterial/baseColorMap:property"}}{{/crossLink}}'s {{#crossLink "Texture"}}{{/crossLink}},
 if required.

 ## Transparency

 ### Alpha Blending

 Let's make our hydrant transparent.

 We'll update its MetallicMaterial's {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}}
 and {{#crossLink "MetallicMaterial/alphaMode:property"}}{{/crossLink}}, causing it to blend 50% with the background:

 ````javascript
 hydrant.material.alpha = 0.5;
 hydrant.material.alphaMode = "blend";
 ````

 <img src="../../../assets/images/screenshots/MetallicMaterial/alphaBlend.png"></img>

 ### Alpha Masking

 Let's apply an alpha mask to our hydrant.

 We'll give its MetallicMaterial an {{#crossLink "MetallicMaterial/alphaMap:property"}}{{/crossLink}}
 and configure {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}}, {{#crossLink "MetallicMaterial/alphaMode:property"}}{{/crossLink}},
 and {{#crossLink "MetallicMaterial/alphaCutoff:property"}}{{/crossLink}} to treat it as an alpha mask:

 ````javascript
 hydrant.material.alphaMap = new xeogl.Texture({
        src: "textures/diffuse/crossGridColorMap.jpg"
    });

 hydrant.material.alpha = 1.0;
 hydrant.material.alphaMode = "mask";
 hydrant.material.alphaCutoff = 0.2;
 ````

 <img src="../../../assets/images/screenshots/MetallicMaterial/alphaMask.png"></img>

 @class MetallicMaterial
 @module xeogl
 @submodule materials
 @constructor
 @extends Material

 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.

 @param [cfg] {*} The MetallicMaterial configuration.

 @param [cfg.id] {String} Optional ID, unique among all components in the parent {{#crossLink "Scene"}}Scene{{/crossLink}}, generated automatically when omitted.

 @param [cfg.meta=null] {String:Object} Metadata to attach to this material.

 @param [cfg.baseColor=[1,1,1]] {Float32Array}  RGB diffuse color of this MetallicMaterial. Multiplies by the RGB
 components of {{#crossLink "MetallicMaterial/baseColorMap:property"}}{{/crossLink}}.

 @param [cfg.metallic=1.0] {Number} Factor in the range 0..1 indicating how metallic this MetallicMaterial is.
 1 is metal, 0 is non-metal. Multiplies by the *R* component of {{#crossLink "MetallicMaterial/metallicMap:property"}}{{/crossLink}} and the *A* component of
 {{#crossLink "MetallicMaterial/metalRoughnessMap:property"}}{{/crossLink}}.

 @param [cfg.roughness=1.0] {Number} Factor in the range 0..1 indicating the roughness of this MetallicMaterial.
 0 is fully smooth, 1 is fully rough. Multiplies by the *R* component of {{#crossLink "MetallicMaterial/roughnessMap:property"}}{{/crossLink}}.

 @param [cfg.specularF0=0.0] {Number} Factor in the range 0..1 indicating specular Fresnel.

 @param [cfg.emissive=[0,0,0]] {Float32Array}  RGB emissive color of this MetallicMaterial. Multiplies by the RGB
 components of {{#crossLink "MetallicMaterial/emissiveMap:property"}}{{/crossLink}}.

 @param [cfg.alpha=1.0] {Number} Factor in the range 0..1 indicating the alpha of this MetallicMaterial.
 Multiplies by the *R* component of {{#crossLink "MetallicMaterial/alphaMap:property"}}{{/crossLink}} and the *A* component,
 if present, of {{#crossLink "MetallicMaterial/baseColorMap:property"}}{{/crossLink}}. The value of
 {{#crossLink "MetallicMaterial/alphaMode:property"}}{{/crossLink}} indicates how alpha is interpreted when rendering.

 @param [cfg.baseColorMap=undefined] {Texture} RGBA {{#crossLink "Texture"}}{{/crossLink}} containing the diffuse color
 of this MetallicMaterial, with optional *A* component for alpha. The RGB components multiply by the
 {{#crossLink "MetallicMaterial/baseColor:property"}}{{/crossLink}} property,
 while the *A* component, if present, multiplies by the {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}} property.

 @param [cfg.alphaMap=undefined] {Texture} RGB {{#crossLink "Texture"}}{{/crossLink}} containing this MetallicMaterial's
 alpha in its *R* component. The *R* component multiplies by the {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}} property. Must
 be within the same {{#crossLink "Scene"}}Scene{{/crossLink}} as this MetallicMaterial.

 @param [cfg.metallicMap=undefined] {Texture} RGB {{#crossLink "Texture"}}{{/crossLink}} containing this MetallicMaterial's
 metallic factor in its *R* component. The *R* component multiplies by the
 {{#crossLink "MetallicMaterial/metallic:property"}}{{/crossLink}} property. Must be within the same
 {{#crossLink "Scene"}}Scene{{/crossLink}} as this MetallicMaterial.

 @param [cfg.roughnessMap=undefined] {Texture} RGB {{#crossLink "Texture"}}{{/crossLink}} containing this MetallicMaterial's
 roughness factor in its *R* component. The *R* component multiplies by the
 {{#crossLink "MetallicMaterial/roughness:property"}}{{/crossLink}} property. Must be within the same
 {{#crossLink "Scene"}}Scene{{/crossLink}} as this MetallicMaterial.

 @param [cfg.metallicRoughnessMap=undefined] {Texture} RGB {{#crossLink "Texture"}}{{/crossLink}} containing this
 MetallicMaterial's metalness in its *R* component and roughness in its *G* component. Its *R* component multiplies by the
 {{#crossLink "MetallicMaterial/metallic:property"}}{{/crossLink}} property, while its *G* component multiplies by the
 {{#crossLink "MetallicMaterial/roughness:property"}}{{/crossLink}} property. Must be within the same
 {{#crossLink "Scene"}}Scene{{/crossLink}} as this MetallicMaterial.

 @param [cfg.emissiveMap=undefined] {Texture} RGB {{#crossLink "Texture"}}{{/crossLink}} containing the emissive color of this
 MetallicMaterial. Multiplies by the {{#crossLink "MetallicMaterial/emissive:property"}}{{/crossLink}} property.
 Must be within the same {{#crossLink "Scene"}}Scene{{/crossLink}} as this MetallicMaterial.

 @param [cfg.occlusionMap=undefined] {Texture} RGB ambient occlusion {{#crossLink "Texture"}}{{/crossLink}}. Within shaders,
 multiplies by the specular and diffuse light reflected by surfaces. Must be within the same {{#crossLink "Scene"}}{{/crossLink}}
 as this MetallicMaterial.

 @param [cfg.normalMap=undefined] {Texture} RGB tangent-space normal {{#crossLink "Texture"}}{{/crossLink}}. Must be
 within the same {{#crossLink "Scene"}}Scene{{/crossLink}} as this MetallicMaterial.

 @param [cfg.alphaMode="opaque"] {String} The alpha blend mode, which specifies how alpha is to be interpreted. Accepted
 values are "opaque", "blend" and "mask". See the {{#crossLink "MetallicMaterial/alphaMode:property"}}{{/crossLink}} property for more info.

 @param [cfg.alphaCutoff=0.5] {Number} The alpha cutoff value.
 See the {{#crossLink "MetallicMaterial/alphaCutoff:property"}}{{/crossLink}} property for more info.

 @param [cfg.backfaces=false] {Boolean} Whether to render {{#crossLink "Geometry"}}Geometry{{/crossLink}} backfaces.
 @param [cfg.frontface="ccw"] {Boolean} The winding order for {{#crossLink "Geometry"}}Geometry{{/crossLink}} front faces - "cw" for clockwise, or "ccw" for counter-clockwise.

 @param [cfg.lineWidth=1] {Number} Scalar that controls the width of lines for {{#crossLink "Geometry"}}{{/crossLink}} with {{#crossLink "Geometry/primitive:property"}}{{/crossLink}} set to "lines".
 @param [cfg.pointSize=1] {Number} Scalar that controls the size of points for {{#crossLink "Geometry"}}{{/crossLink}} with {{#crossLink "Geometry/primitive:property"}}{{/crossLink}} set to "points".

 */

const modes = {"opaque": 0, "mask": 1, "blend": 2};
const modeNames = ["opaque", "mask", "blend"];
const type$42 = "xeogl.MetallicMaterial";

 class MetallicMaterial extends Material {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$42;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            type: "MetallicMaterial",
            baseColor: math.vec4([1.0, 1.0, 1.0]),
            emissive: math.vec4([0.0, 0.0, 0.0]),
            metallic: null,
            roughness: null,
            specularF0: null,
            alpha: null,
            alphaMode: null, // "opaque"
            alphaCutoff: null,
            lineWidth: null,
            pointSize: null,
            backfaces: null,
            frontface: null, // Boolean for speed; true == "ccw", false == "cw"
            hash: null
        });

        this.baseColor = cfg.baseColor;
        this.metallic = cfg.metallic;
        this.roughness = cfg.roughness;
        this.specularF0 = cfg.specularF0;
        this.emissive = cfg.emissive;
        this.alpha = cfg.alpha;

        if (cfg.baseColorMap) {
            this._baseColorMap = this._checkComponent("xeogl.Texture", cfg.baseColorMap);
        }
        if (cfg.metallicMap) {
            this._metallicMap = this._checkComponent("xeogl.Texture", cfg.metallicMap);

        }
        if (cfg.roughnessMap) {
            this._roughnessMap = this._checkComponent("xeogl.Texture", cfg.roughnessMap);
        }
        if (cfg.metallicRoughnessMap) {
            this._metallicRoughnessMap = this._checkComponent("xeogl.Texture", cfg.metallicRoughnessMap);
        }
        if (cfg.emissiveMap) {
            this._emissiveMap = this._checkComponent("xeogl.Texture", cfg.emissiveMap);
        }
        if (cfg.occlusionMap) {
            this._occlusionMap = this._checkComponent("xeogl.Texture", cfg.occlusionMap);
        }
        if (cfg.alphaMap) {
            this._alphaMap = this._checkComponent("xeogl.Texture", cfg.alphaMap);
        }
        if (cfg.normalMap) {
            this._normalMap = this._checkComponent("xeogl.Texture", cfg.normalMap);
        }

        this.alphaMode = cfg.alphaMode;
        this.alphaCutoff = cfg.alphaCutoff;
        this.backfaces = cfg.backfaces;
        this.frontface = cfg.frontface;
        this.lineWidth = cfg.lineWidth;
        this.pointSize = cfg.pointSize;

        this._makeHash();
    }

    _makeHash() {
        const state = this._state;
        const hash = ["/met"];
        if (this._baseColorMap) {
            hash.push("/bm");
            if (this._baseColorMap._state.hasMatrix) {
                hash.push("/mat");
            }
            hash.push("/" + this._baseColorMap._state.encoding);
        }
        if (this._metallicMap) {
            hash.push("/mm");
            if (this._metallicMap._state.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._roughnessMap) {
            hash.push("/rm");
            if (this._roughnessMap._state.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._metallicRoughnessMap) {
            hash.push("/mrm");
            if (this._metallicRoughnessMap._state.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._emissiveMap) {
            hash.push("/em");
            if (this._emissiveMap._state.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._occlusionMap) {
            hash.push("/ocm");
            if (this._occlusionMap._state.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._alphaMap) {
            hash.push("/am");
            if (this._alphaMap._state.hasMatrix) {
                hash.push("/mat");
            }
        }
        if (this._normalMap) {
            hash.push("/nm");
            if (this._normalMap._state.hasMatrix) {
                hash.push("/mat");
            }
        }
        hash.push(";");
        state.hash = hash.join("");
    }


    /**
     RGB diffuse color.

     Multiplies by the RGB components of {{#crossLink "MetallicMaterial/baseColorMap:property"}}{{/crossLink}}.

     @property baseColor
     @default [1.0, 1.0, 1.0]
     @type Float32Array
     */
    set baseColor(value) {
        let baseColor = this._state.baseColor;
        if (!baseColor) {
            baseColor = this._state.baseColor = new Float32Array(3);
        } else if (value && baseColor[0] === value[0] && baseColor[1] === value[1] && baseColor[2] === value[2]) {
            return;
        }
        if (value) {
            baseColor[0] = value[0];
            baseColor[1] = value[1];
            baseColor[2] = value[2];
        } else {
            baseColor[0] = 1;
            baseColor[1] = 1;
            baseColor[2] = 1;
        }
        this._renderer.imageDirty();
    }

    get baseColor() {
        return this._state.baseColor;
    }


    /**
     RGB {{#crossLink "Texture"}}{{/crossLink}} containing the diffuse color of this MetallicMaterial, with optional *A* component for alpha.

     The RGB components multiply by the {{#crossLink "MetallicMaterial/baseColor:property"}}{{/crossLink}} property,
     while the *A* component, if present, multiplies by the {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}} property.

     @property baseColorMap
     @default undefined
     @type {Texture}
     @final
     */
    get baseColorMap() {
        return this._baseColorMap;
    }

    /**
     Factor in the range [0..1] indicating how metallic this MetallicMaterial is.

     1 is metal, 0 is non-metal.

     Multiplies by the *R* component of {{#crossLink "MetallicMaterial/metallicMap:property"}}{{/crossLink}}
     and the *A* component of {{#crossLink "MetallicMaterial/metalRoughnessMap:property"}}{{/crossLink}}.

     @property metallic
     @default 1.0
     @type Number
     */
    set metallic(value) {
        value = (value !== undefined && value !== null) ? value : 1.0;
        if (this._state.metallic === value) {
            return;
        }
        this._state.metallic = value;
        this._renderer.imageDirty();
    }

    get metallic() {
        return this._state.metallic;
    }

    /**
     RGB {{#crossLink "Texture"}}{{/crossLink}} containing this MetallicMaterial's metallic factor in its *R* component.

     The *R* component multiplies by the {{#crossLink "MetallicMaterial/metallic:property"}}{{/crossLink}} property.

     @property metallicMap
     @default undefined
     @type {Texture}
     @final
     */
    get metallicMap() {
        return this._attached.metallicMap;
    }

    /**
     Factor in the range [0..1] indicating the roughness of this MetallicMaterial.

     0 is fully smooth, 1 is fully rough.

     Multiplies by the *R* component of {{#crossLink "MetallicMaterial/roughnessMap:property"}}{{/crossLink}}.

     @property roughness
     @default 1.0
     @type Number
     */
    set roughness(value) {
        value = (value !== undefined && value !== null) ? value : 1.0;
        if (this._state.roughness === value) {
            return;
        }
        this._state.roughness = value;
        this._renderer.imageDirty();
    }

    get roughness() {
        return this._state.roughness;
    }

    /**
     RGB {{#crossLink "Texture"}}{{/crossLink}} containing this MetallicMaterial's roughness factor in its *R* component.

     The *R* component multiplies by the {{#crossLink "MetallicMaterial/roughness:property"}}{{/crossLink}} property.

     Must be within the same {{#crossLink "Scene"}}Scene{{/crossLink}} as this MetallicMaterial.

     @property roughnessMap
     @default undefined
     @type {Texture}
     @final
     */
    get roughnessMap() {
        return this._attached.roughnessMap;
    }

    /**
     RGB {{#crossLink "Texture"}}{{/crossLink}} containing this MetallicMaterial's metalness in its *R* component and roughness in its *G* component.

     Its *B* component multiplies by the {{#crossLink "MetallicMaterial/metallic:property"}}{{/crossLink}} property, while
     its *G* component multiplies by the {{#crossLink "MetallicMaterial/roughness:property"}}{{/crossLink}} property.

     Must be within the same {{#crossLink "Scene"}}Scene{{/crossLink}} as this MetallicMaterial.

     @property metallicRoughnessMap
     @default undefined
     @type {Texture}
     @final
     */
    get metallicRoughnessMap() {
        return this._attached.metallicRoughnessMap;
    }

    /**
     Factor in the range [0..1] indicating specular Fresnel value.

     @property specularF0
     @default 0.0
     @type Number
     */
    set specularF0(value) {
        value = (value !== undefined && value !== null) ? value : 0.0;
        if (this._state.specularF0 === value) {
            return;
        }
        this._state.specularF0 = value;
        this._renderer.imageDirty();
    }

    get specularF0() {
        return this._state.specularF0;
    }

    /**
     RGB emissive color.

     Multiplies by {{#crossLink "MetallicMaterial/emissiveMap:property"}}{{/crossLink}}.

     @property emissive
     @default [0.0, 0.0, 0.0]
     @type Float32Array
     */
    set emissive(value) {
        let emissive = this._state.emissive;
        if (!emissive) {
            emissive = this._state.emissive = new Float32Array(3);
        } else if (value && emissive[0] === value[0] && emissive[1] === value[1] && emissive[2] === value[2]) {
            return;
        }
        if (value) {
            emissive[0] = value[0];
            emissive[1] = value[1];
            emissive[2] = value[2];
        } else {
            emissive[0] = 0;
            emissive[1] = 0;
            emissive[2] = 0;
        }
        this._renderer.imageDirty();
    }

    get emissive() {
        return this._state.emissive;
    }

    /**
     RGB emissive map.

     Multiplies by {{#crossLink "MetallicMaterial/emissive:property"}}{{/crossLink}}.

     @property emissiveMap
     @default undefined
     @type {Texture}
     @final
     */
    get emissiveMap() {
        return this._attached.emissiveMap;
    }

    /**
     RGB ambient occlusion map.

     Within objectRenderers, multiplies by the specular and diffuse light reflected by surfaces.

     @property occlusionMap
     @default undefined
     @type {Texture}
     @final
     */
    get occlusionMap() {
        return this._attached.occlusionMap;
    }

    /**
     Factor in the range [0..1] indicating the alpha value.

     Multiplies by the *R* component of {{#crossLink "MetallicMaterial/alphaMap:property"}}{{/crossLink}} and
     the *A* component, if present, of {{#crossLink "MetallicMaterial/baseColorMap:property"}}{{/crossLink}}.

     The value of {{#crossLink "MetallicMaterial/alphaMode:property"}}{{/crossLink}} indicates how alpha is
     interpreted when rendering.

     @property alpha
     @default 1.0
     @type Number
     */
    set alpha(value) {
        value = (value !== undefined && value !== null) ? value : 1.0;
        if (this._state.alpha === value) {
            return;
        }
        this._state.alpha = value;
        this._renderer.imageDirty();
    }

    get alpha() {
        return this._state.alpha;
    }

    /**
     RGB {{#crossLink "Texture"}}{{/crossLink}} containing this MetallicMaterial's alpha in its *R* component.

     The *R* component multiplies by the {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}} property.

     @property alphaMap
     @default undefined
     @type {Texture}
     @final
     */
    get alphaMap() {
        return this._attached.alphaMap;
    }

    /**
     RGB tangent-space normal map {{#crossLink "Texture"}}{{/crossLink}}.

     Must be within the same {{#crossLink "Scene"}}Scene{{/crossLink}} as this MetallicMaterial.

     @property normalMap
     @default undefined
     @type {Texture}
     @final
     */
    get normalMap() {
        return this._attached.normalMap;
    }

    /**
     The alpha rendering mode.

     This specifies how alpha is interpreted. Alpha is the combined result of the
     {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}} and
     {{#crossLink "MetallicMaterial/alphaMap:property"}}{{/crossLink}} properties.

     * "opaque" - The alpha value is ignored and the rendered output is fully opaque.
     * "mask" - The rendered output is either fully opaque or fully transparent depending on the alpha and {{#crossLink "MetallicMaterial/alphaCutoff:property"}}{{/crossLink}}.
     * "blend" - The alpha value is used to composite the source and destination areas. The rendered output is combined with the background using the normal painting operation (i.e. the Porter and Duff over operator).

     @property alphaMode
     @default "opaque"
     @type {String}
     */

    set alphaMode(alphaMode) {
        alphaMode = alphaMode || "opaque";
        let value = modes[alphaMode];
        if (value === undefined) {
            this.error("Unsupported value for 'alphaMode': " + alphaMode + " defaulting to 'opaque'");
            value = "opaque";
        }
        if (this._state.alphaMode === value) {
            return;
        }
        this._state.alphaMode = value;
        this._renderer.imageDirty();
    }

    get alphaMode() {
        return modeNames[this._state.alphaMode];
    }

    /**
     The alpha cutoff value.

     Specifies the cutoff threshold when {{#crossLink "MetallicMaterial/alphaMode:property"}}{{/crossLink}}
     equals "mask". If the alpha is greater than or equal to this value then it is rendered as fully
     opaque, otherwise, it is rendered as fully transparent. A value greater than 1.0 will render the entire
     material as fully transparent. This value is ignored for other modes.

     Alpha is the combined result of the
     {{#crossLink "MetallicMaterial/alpha:property"}}{{/crossLink}} and
     {{#crossLink "MetallicMaterial/alphaMap:property"}}{{/crossLink}} properties.

     @property alphaCutoff
     @default 0.5
     @type {Number}
     */
    set alphaCutoff(alphaCutoff) {
        if (alphaCutoff === null || alphaCutoff === undefined) {
            alphaCutoff = 0.5;
        }
        if (this._state.alphaCutoff === alphaCutoff) {
            return;
        }
        this._state.alphaCutoff = alphaCutoff;
    }

    get alphaCutoff() {
        return this._state.alphaCutoff;
    }

    /**
     Whether backfaces are visible on attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     The backfaces will belong to {{#crossLink "Geometry"}}{{/crossLink}} compoents that are also attached to
     the {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     @property backfaces
     @default false
     @type Boolean
     */
    set backfaces(value) {
        value = !!value;
        if (this._state.backfaces === value) {
            return;
        }
        this._state.backfaces = value;
        this._renderer.imageDirty();
    }

    get backfaces() {
        return this._state.backfaces;
    }

    /**
     Indicates the winding direction of front faces on attached {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     The faces will belong to {{#crossLink "Geometry"}}{{/crossLink}} components that are also attached to
     the {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

     @property frontface
     @default "ccw"
     @type String
     */
    set frontface(value) {
        value = value !== "cw";
        if (this._state.frontface === value) {
            return;
        }
        this._state.frontface = value;
        this._renderer.imageDirty();
    }

    get frontface() {
        return this._state.frontface ? "ccw" : "cw";
    }

    /**
     The MetallicMaterial's line width.

     @property lineWidth
     @default 1.0
     @type Number
     */
    set lineWidth(value) {
        this._state.lineWidth = value || 1.0;
        this._renderer.imageDirty();
    }

    get lineWidth() {
        return this._state.lineWidth;
    }

    /**
     The MetallicMaterial's point size.

     @property pointSize
     @default 1.0
     @type Number
     */
    set pointSize(value) {
        this._state.pointSize = value || 1.0;
        this._renderer.imageDirty();
    }

    get pointSize() {
        return this._state.pointSize;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
    }
}

componentClasses[type$42] = MetallicMaterial;

/**
 A **Texture** specifies a texture map.

 ## Overview

 * Textures are grouped within {{#crossLink "Material"}}Materials{{/crossLink}}, which are attached to
 {{#crossLink "Mesh"}}Meshes{{/crossLink}}.
 * To create a Texture from an image file, set the Texture's {{#crossLink "Texture/src:property"}}{{/crossLink}}
 property to the image file path.
 * To create a Texture from an HTMLImageElement, set the Texture's {{#crossLink "Texture/image:property"}}{{/crossLink}}
 property to the HTMLImageElement.

 ## Examples

 * [Textures on MetallicMaterials](../../examples/#materials_metallic_textures)
 * [Textures on SpecularMaterials](../../examples/#materials_specGloss_textures)
 * [Textures on PhongMaterials](../../examples/#materials_phong_textures)
 * [Video texture](../../examples/#materials_phong_textures_video)

 ## Usage

 In this example we have a Mesh with

 * a {{#crossLink "PhongMaterial"}}{{/crossLink}} which applies diffuse and specular {{#crossLink "Texture"}}Textures{{/crossLink}}, and
 * a {{#crossLink "TorusGeometry"}}{{/crossLink}}.

 Note that xeogl will ignore the {{#crossLink "PhongMaterial"}}PhongMaterial's{{/crossLink}} {{#crossLink "PhongMaterial/diffuse:property"}}{{/crossLink}}
 and {{#crossLink "PhongMaterial/specular:property"}}{{/crossLink}} properties, since we assigned {{#crossLink "Texture"}}Textures{{/crossLink}} to the {{#crossLink "PhongMaterial"}}PhongMaterial's{{/crossLink}} {{#crossLink "PhongMaterial/diffuseMap:property"}}{{/crossLink}} and
 {{#crossLink "PhongMaterial/specularMap:property"}}{{/crossLink}} properties. The {{#crossLink "Texture"}}Textures'{{/crossLink}} pixel
 colors directly provide the diffuse and specular components for each fragment across the {{#crossLink "Geometry"}}{{/crossLink}} surface.

 ```` javascript
 var mesh = new xeogl.Mesh({

    material: new xeogl.PhongMaterial({
        ambient: [0.3, 0.3, 0.3],
        diffuse: [0.5, 0.5, 0.0],   // Ignored, since we have assigned a Texture to diffuseMap, below
        specular: [1.0, 1.0, 1.0],   // Ignored, since we have assigned a Texture to specularMap, below
        diffuseMap: new xeogl.Texture({
            src: "diffuseMap.jpg"
        }),
        specularMap: new xeogl.Fresnel({
            src: "diffuseMap.jpg"
        }),
        shininess: 80, // Default
        alpha: 1.0 // Default
    }),

    geometry: new xeogl.TorusGeometry()
});
 ````

 @class Texture
 @module xeogl
 @submodule materials
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID for this Texture, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Texture.
 @param [cfg.src=null] {String} Path to image file to load into this Texture. See the {{#crossLink "Texture/src:property"}}{{/crossLink}} property for more info.
 @param [cfg.image=null] {HTMLImageElement} HTML Image object to load into this Texture. See the {{#crossLink "Texture/image:property"}}{{/crossLink}} property for more info.
 @param [cfg.minFilter="linearMipmapLinear"] {String} How the texture is sampled when a texel covers less than one pixel. See the {{#crossLink "Texture/minFilter:property"}}{{/crossLink}} property for more info.
 @param [cfg.magFilter="linear"] {String} How the texture is sampled when a texel covers more than one pixel. See the {{#crossLink "Texture/magFilter:property"}}{{/crossLink}} property for more info.
 @param [cfg.wrapS="repeat"] {String} Wrap parameter for texture coordinate *S*. See the {{#crossLink "Texture/wrapS:property"}}{{/crossLink}} property for more info.
 @param [cfg.wrapT="repeat"] {String} Wrap parameter for texture coordinate *S*. See the {{#crossLink "Texture/wrapT:property"}}{{/crossLink}} property for more info.
 @param [cfg.flipY=false] {Boolean} Flips this Texture's source data along its vertical axis when true.
 @param [cfg.translate=[0,0]] {Array of Number} 2D translation vector that will be added to texture's *S* and *T* coordinates.
 @param [cfg.scale=[1,1]] {Array of Number} 2D scaling vector that will be applied to texture's *S* and *T* coordinates.
 @param [cfg.rotate=0] {Number} Rotation, in degrees, that will be applied to texture's *S* and *T* coordinates.
 @param [cfg.encoding="linear"] {String} Encoding format.  See the {{#crossLink "Texture/encoding:property"}}{{/crossLink}} property for more info.
 @extends Component
 */
const type$43 = "xeogl.Texture";

function ensureImageSizePowerOfTwo$2(image) {
    if (!isPowerOfTwo$2(image.width) || !isPowerOfTwo$2(image.height)) {
        const canvas = document.createElement("canvas");
        canvas.width = nextHighestPowerOfTwo$2(image.width);
        canvas.height = nextHighestPowerOfTwo$2(image.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image,
            0, 0, image.width, image.height,
            0, 0, canvas.width, canvas.height);
        image = canvas;
    }
    return image;
}

function isPowerOfTwo$2(x) {
    return (x & (x - 1)) === 0;
}

function nextHighestPowerOfTwo$2(x) {
    --x;
    for (let i = 1; i < 32; i <<= 1) {
        x = x | x >> i;
    }
    return x + 1;
}

class Texture extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$43;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            texture: new Texture2D(this.scene.canvas.gl),
            matrix: math.identityMat4(),   // Float32Array
            hasMatrix: (cfg.translate && (cfg.translate[0] !== 0 || cfg.translate[1] !== 0)) || (!!cfg.rotate) || (cfg.scale && (cfg.scale[0] !== 0 || cfg.scale[1] !== 0)),
            minFilter: this._checkMinFilter(cfg.minFilter),
            magFilter: this._checkMagFilter(cfg.magFilter),
            wrapS: this._checkWrapS(cfg.wrapS),
            wrapT: this._checkWrapT(cfg.wrapT),
            flipY: this._checkFlipY(cfg.flipY),
            encoding: this._checkEncoding(cfg.encoding)
        });

        // Data source

        this._src = null;
        this._image = null;

        // Transformation

        this._translate = math.vec2([0, 0]);
        this._scale = math.vec2([1, 1]);
        this._rotate = math.vec2([0, 0]);

        this._matrixDirty = false;

        // Transform

        this.translate = cfg.translate;
        this.scale = cfg.scale;
        this.rotate = cfg.rotate;

        // Data source

        if (cfg.src) {
            this.src = cfg.src; // Image file
        } else if (cfg.image) {
            this.image = cfg.image; // Image object
        }

        stats.memory.textures++;
    }

    _checkMinFilter(value) {
        value = value || "linearMipmapLinear";
        if (value !== "linear" &&
            value !== "linearMipmapNearest" &&
            value !== "linearMipmapLinear" &&
            value !== "nearestMipmapLinear" &&
            value !== "nearestMipmapNearest") {
            this.error("Unsupported value for 'minFilter': '" + value +
                "' - supported values are 'linear', 'linearMipmapNearest', 'nearestMipmapNearest', " +
                "'nearestMipmapLinear' and 'linearMipmapLinear'. Defaulting to 'linearMipmapLinear'.");
            value = "linearMipmapLinear";
        }
        return value;
    }

    _checkMagFilter(value) {
        value = value || "linear";
        if (value !== "linear" && value !== "nearest") {
            this.error("Unsupported value for 'magFilter': '" + value +
                "' - supported values are 'linear' and 'nearest'. Defaulting to 'linear'.");
            value = "linear";
        }
        return value;
    }

    _checkFilter(value) {
        value = value || "linear";
        if (value !== "linear" && value !== "nearest") {
            this.error("Unsupported value for 'magFilter': '" + value +
                "' - supported values are 'linear' and 'nearest'. Defaulting to 'linear'.");
            value = "linear";
        }
        return value;
    }

    _checkWrapS(value) {
        value = value || "repeat";
        if (value !== "clampToEdge" && value !== "mirroredRepeat" && value !== "repeat") {
            this.error("Unsupported value for 'wrapS': '" + value +
                "' - supported values are 'clampToEdge', 'mirroredRepeat' and 'repeat'. Defaulting to 'repeat'.");
            value = "repeat";
        }
        return value;
    }

    _checkWrapT(value) {
        value = value || "repeat";
        if (value !== "clampToEdge" && value !== "mirroredRepeat" && value !== "repeat") {
            this.error("Unsupported value for 'wrapT': '" + value +
                "' - supported values are 'clampToEdge', 'mirroredRepeat' and 'repeat'. Defaulting to 'repeat'.");
            value = "repeat";
        }
        return value;
    }

    _checkFlipY(value) {
        return !!value;
    }

    _checkEncoding(value) {
        value = value || "linear";
        if (value !== "linear" && value !== "sRGB" && value !== "gamma") {
            this.error("Unsupported value for 'encoding': '" + value + "' - supported values are 'linear', 'sRGB', 'gamma'. Defaulting to 'linear'.");
            value = "linear";
        }
        return value;
    }

    _webglContextRestored() {
        this._state.texture = new Texture2D(this.scene.canvas.gl);
        if (this._image) {
            this.image = this._image;
        } else if (this._src) {
            this.src = this._src;
        }
    }

    _update() {
        const state = this._state;
        if (this._matrixDirty) {
            let matrix;
            let t;
            if (this._translate[0] !== 0 || this._translate[1] !== 0) {
                matrix = math.translationMat4v([this._translate[0], this._translate[1], 0], this._state.matrix);
            }
            if (this._scale[0] !== 1 || this._scale[1] !== 1) {
                t = math.scalingMat4v([this._scale[0], this._scale[1], 1]);
                matrix = matrix ? math.mulMat4(matrix, t) : t;
            }
            if (this._rotate !== 0) {
                t = math.rotationMat4v(this._rotate * 0.0174532925, [0, 0, 1]);
                matrix = matrix ? math.mulMat4(matrix, t) : t;
            }
            if (matrix) {
                state.matrix = matrix;
            }
            this._matrixDirty = false;
        }
        this._renderer.imageDirty();
    }


    /**
     Indicates an HTML DOM Image object to source this Texture from.

     Sets the {{#crossLink "Texture/src:property"}}{{/crossLink}} property to null.

     @property image
     @default null
     @type {HTMLImageElement}
     */
    set image(value) {
        this._image = ensureImageSizePowerOfTwo$2(value);
        this._image.crossOrigin = "Anonymous";
        this._state.texture.setImage(this._image, this._state);
        this._state.texture.setProps(this._state); // Generate mipmaps
        this._src = null;
        this._renderer.imageDirty();
    }

    get image() {
        return this._image;
    }

    /**
     Indicates a path to an image file to source this Texture from.

     Sets the {{#crossLink "Texture/image:property"}}{{/crossLink}} property to null.

     @property src
     @default null
     @type String
     */
    set src(src) {
        this.scene.loading++;
        this.scene.canvas.spinner.processes++;
        const self = this;
        let image = new Image();
        image.onload = function () {
            image = ensureImageSizePowerOfTwo$2(image);
            //self._image = image; // For faster WebGL context restore - memory inefficient?
            self._state.texture.setImage(image, self._state);
            self._state.texture.setProps(self._state); // Generate mipmaps
            self.scene.loading--;
            self.scene.canvas.spinner.processes--;
            self._renderer.imageDirty();
        };
        image.src = src;
        this._src = src;
        this._image = null;
    }

    get src() {
        return this._src;
    }

    /**
     2D translation vector that will be added to this Texture's *S* and *T* coordinates.

     @property translate
     @default [0, 0]
     @type Array(Number)
     */
    set translate(value) {
        this._translate.set(value || [0, 0]);
        this._matrixDirty = true;
        this._needUpdate();
    }

    get translate() {
        return this._translate;
    }

    /**
     2D scaling vector that will be applied to this Texture's *S* and *T* coordinates.

     @property scale
     @default [1, 1]
     @type Array(Number)
     */
    set scale(value) {
        this._scale.set(value || [1, 1]);
        this._matrixDirty = true;
        this._needUpdate();
    }

    get scale() {
        return this._scale;
    }

    /**
     Rotation, in degrees, that will be applied to this Texture's *S* and *T* coordinates.

     @property rotate
     @default 0
     @type Number
     */
    set rotate(value) {
        value = value || 0;
        if (this._rotate === value) {
            return;
        }
        this._rotate = value;
        this._matrixDirty = true;
        this._needUpdate();
    }

    get rotate() {
        return this._rotate;
    }

    /**
     How this Texture is sampled when a texel covers less than one pixel.

     Options are:

     * **"nearest"** - Uses the value of the texture element that is nearest
     (in Manhattan distance) to the center of the pixel being textured.

     * **"linear"** - Uses the weighted average of the four texture elements that are
     closest to the center of the pixel being textured.

     * **"nearestMipmapNearest"** - Chooses the mipmap that most closely matches the
     size of the pixel being textured and uses the "nearest" criterion (the texture
     element nearest to the center of the pixel) to produce a texture value.

     * **"linearMipmapNearest"** - Chooses the mipmap that most closely matches the size of
     the pixel being textured and uses the "linear" criterion (a weighted average of the
     four texture elements that are closest to the center of the pixel) to produce a
     texture value.

     * **"nearestMipmapLinear"** - Chooses the two mipmaps that most closely
     match the size of the pixel being textured and uses the "nearest" criterion
     (the texture element nearest to the center of the pixel) to produce a texture
     value from each mipmap. The final texture value is a weighted average of those two
     values.

     * **"linearMipmapLinear"** - **(default)** - Chooses the two mipmaps that most closely match the size
     of the pixel being textured and uses the "linear" criterion (a weighted average
     of the four texture elements that are closest to the center of the pixel) to
     produce a texture value from each mipmap. The final texture value is a weighted
     average of those two values.

     @property minFilter
     @default "linearMipmapLinear"
     @type String
     @final
     */
    get minFilter() {
        return this._state.minFilter;
    }

    /**
     How this Texture is sampled when a texel covers more than one pixel.

     Options are:

     * **"nearest"** - Uses the value of the texture element that is nearest
     (in Manhattan distance) to the center of the pixel being textured.
     * **"linear"** - **(default)** - Uses the weighted average of the four texture elements that are
     closest to the center of the pixel being textured.

     @property magFilter
     @default "linear"
     @type String
     @final
     */
    get magFilter() {
        return this._state.magFilter;
    }

    /**
     Wrap parameter for this Texture's *S* coordinate.

     Options are:

     * **"clampToEdge"** -  causes *S* coordinates to be clamped to the size of the texture.
     * **"mirroredRepeat"** - causes the *S* coordinate to be set to the fractional part of the texture coordinate
     if the integer part of *S* is even; if the integer part of *S* is odd, then the *S* texture coordinate is
     set to *1 - frac ⁡ S* , where *frac ⁡ S* represents the fractional part of *S*.
     * **"repeat"** - **(default)** - causes the integer part of the *S* coordinate to be ignored; xeogl uses only the
     fractional part, thereby creating a repeating pattern.

     @property wrapS
     @default "repeat"
     @type String
     @final
     */
    get wrapS() {
        return this._state.wrapS;
    }

    /**
     Wrap parameter for this Texture's *T* coordinate.

     Options are:

     * **"clampToEdge"** -  Causes *T* coordinates to be clamped to the size of the texture.
     * **"mirroredRepeat"** - Causes the *T* coordinate to be set to the fractional part of the texture coordinate
     if the integer part of *T* is even; if the integer part of *T* is odd, then the *T* texture coordinate is
     set to *1 - frac ⁡ S* , where *frac ⁡ S* represents the fractional part of *T*.
     * **"repeat"** - **(default)** - Causes the integer part of the *T* coordinate to be ignored; xeogl uses only the
     fractional part, thereby creating a repeating pattern.

     @property wrapT
     @default "repeat"
     @type String
     @final
     */
    get wrapT() {
        return this._state.wrapT;
    }

    /**
     Flips this Texture's source data along its vertical axis when true.

     @property flipY
     @type Boolean
     @final
     */
    get flipY() {
        return this._state.flipY;
    }

    /**
     The Texture's encoding format.

     @property encoding
     @type String
     @final
     */
    get encoding() {
        return this._state.encoding;
    }

    destroy() {
        super.destroy();
        if (this._state.texture) {
            this._state.texture.destroy();
        }
        this._state.destroy();
        stats.memory.textures--;
    }
}

componentClasses[type$43] = Texture;

/**
 A **Fresnel** specifies a Fresnel effect for attached {{#crossLink "PhongMaterial"}}PhongMaterials{{/crossLink}}.

 <a href="../../examples/#materials_phong_fresnel"><img src="../../assets/images/screenshots/PhongMaterial/fresnelWide.png"></img></a>

 ## Overview

 * Fresnels are grouped within {{#crossLink "PhongMaterial"}}{{/crossLink}}s, which are attached to
 {{#crossLink "Mesh"}}Meshes{{/crossLink}}.

 ## Examples

 * [PhongMaterials with Fresnels](../../examples/#materials_phong_fresnel)

 ## Usage

 ````javascript
 var mesh = new xeogl.Mesh({

     material: new xeogl.PhongMaterial({
         ambient: [0.3, 0.3, 0.3],
         shininess: 30,

         diffuseFresnel: new xeogl.Fresnel({
             edgeColor: [1.0, 1.0, 1.0],
             centerColor: [0.0, 0.0, 0.0],
             power: 4,
             bias: 0.6
         }),

         specularFresnel: new xeogl.Fresnel({
             edgeColor: [1.0, 1.0, 1.0],
             centerColor: [0.0, 0.0, 0.0],
             power: 4,
             bias: 0.2
         })
     }),

     new xeogl.TorusGeometry()
 });
 ````

 @class Fresnel
 @module xeogl
 @submodule materials
 @constructor
 @param [owner] {Component} Owner component. When destroyed, the owner will destroy this component as well. Creates this component within the default {{#crossLink "Scene"}}{{/crossLink}} when omitted.
 @param [cfg] {*} Configs
 @param [cfg.id] {String} Optional ID, unique among all components in the parent scene, generated automatically when omitted.
 @param [cfg.meta] {String:Object} Optional map of user-defined metadata to attach to this Fresnel.
 @param [cfg.edgeColor=[ 0.0, 0.0, 0.0 ]] {Array of Number} Color used on edges.
 @param [cfg.centerColor=[ 1.0, 1.0, 1.0 ]] {Array of Number} Color used on center.
 @param [cfg.edgeBias=0] {Number} Bias at the edge.
 @param [cfg.centerBias=1] {Number} Bias at the center.
 @param [cfg.power=0] {Number} The power.
 @extends Component
 */

const type$44 = "xeogl.Fresnel";

class Fresnel extends Component {

    /**
     JavaScript class name for this Component.

     For example: "xeogl.AmbientLight", "xeogl.MetallicMaterial" etc.

     @property type
     @type String
     @final
     */
    get type() {
        return type$44;
    }

    init(cfg) {

        super.init(cfg);

        this._state = new State({
            edgeColor: math.vec3([0, 0, 0]),
            centerColor: math.vec3([1, 1, 1]),
            edgeBias: 0,
            centerBias: 1,
            power: 1
        });

        this.edgeColor = cfg.edgeColor;
        this.centerColor = cfg.centerColor;
        this.edgeBias = cfg.edgeBias;
        this.centerBias = cfg.centerBias;
        this.power = cfg.power;
    }

    /**
     This Fresnel's edge color.

     @property edgeColor
     @default [0.0, 0.0, 0.0]
     @type Float32Array
     */
    set edgeColor(value) {
        this._state.edgeColor.set(value || [0.0, 0.0, 0.0]);
        this._renderer.imageDirty();
    }

    get edgeColor() {
        return this._state.edgeColor;
    }

    /**
     This Fresnel's center color.

     @property centerColor
     @default [1.0, 1.0, 1.0]
     @type Float32Array
     */
    set  centerColor(value) {
        this._state.centerColor.set(value || [1.0, 1.0, 1.0]);
        this._renderer.imageDirty();
    }

    get centerColor() {
        return this._state.centerColor;
    }

    /**
     * Indicates this Fresnel's edge bias.
     *
     * @property edgeBias
     * @default 0
     * @type Number
     */
    set edgeBias(value) {
        this._state.edgeBias = value || 0;
        this._renderer.imageDirty();
    }

    get edgeBias() {
        return this._state.edgeBias;
    }

    /**
     * Indicates this Fresnel's center bias.
     *
     * @property centerBias
     * @default 1
     * @type Number
     */
    set centerBias(value) {
        this._state.centerBias = (value !== undefined && value !== null) ? value : 1;
        this._renderer.imageDirty();
    }

    get centerBias() {
        return this._state.centerBias;
    }

    /**
     * Indicates this Fresnel's power.
     *
     * @property power
     * @default 1
     * @type Number
     */
    set power(value) {
        this._state.power = (value !== undefined && value !== null) ? value : 1;
        this._renderer.imageDirty();
    }

    get power() {
        return this._state.power;
    }

    destroy() {
        super.destroy();
        this._state.destroy();
    }
}

componentClasses[type$44] = Fresnel;

/**
 The xeogl namespace.

 @class xeogl
 @main xeogl
 @static
 @author xeolabs / http://xeolabs.com/
 */
const scenes = core.scenes;
const getDefaultScene = core.getDefaultScene;
const setDefaultScene = core.setDefaultScene;
const scheduleTask = tasks.scheduleTask;
const clear = core.clear;
const _isString = utils.isString; // Backward compat
const _apply = utils.apply; // Backward compat
const _isNumeric = utils.isNumeric;

exports.scenes = scenes;
exports.getDefaultScene = getDefaultScene;
exports.setDefaultScene = setDefaultScene;
exports.scheduleTask = scheduleTask;
exports.clear = clear;
exports._isString = _isString;
exports._apply = _apply;
exports._isNumeric = _isNumeric;
exports.WEBGL_INFO = WEBGL_INFO;
exports.stats = stats;
exports.math = math;
exports.Component = Component;
exports.CameraFlightAnimation = CameraFlightAnimation;
exports.Canvas = Canvas;
exports.Spinner = Spinner;
exports.Clip = Clip;
exports.ClipControl = ClipControl;
exports.CameraControl = CameraControl;
exports.Geometry = Geometry;
exports.BoxGeometry = BoxGeometry;
exports.TorusGeometry = TorusGeometry;
exports.SphereGeometry = SphereGeometry;
exports.OBBGeometry = OBBGeometry;
exports.AABBGeometry = AABBGeometry;
exports.CylinderGeometry = CylinderGeometry;
exports.PlaneGeometry = PlaneGeometry;
exports.Input = Input;
exports.AmbientLight = AmbientLight;
exports.DirLight = DirLight;
exports.PointLight = PointLight;
exports.SpotLight = SpotLight;
exports.CubeTexture = CubeTexture;
exports.LightMap = LightMap;
exports.ReflectionMap = ReflectionMap;
exports.Shadow = Shadow;
exports.Model = Model;
exports.Mesh = Mesh;
exports.Group = Group;
exports.Object = xeoglObject;
exports.Material = Material;
exports.PhongMaterial = PhongMaterial;
exports.LambertMaterial = LambertMaterial;
exports.SpecularMaterial = SpecularMaterial;
exports.MetallicMaterial = MetallicMaterial;
exports.EmphasisMaterial = EmphasisMaterial;
exports.EdgeMaterial = EdgeMaterial;
exports.OutlineMaterial = OutlineMaterial;
exports.Texture = Texture;
exports.Fresnel = Fresnel;
exports.Viewport = Viewport;
exports.Camera = Camera;
exports.Frustum = Frustum;
exports.Ortho = Ortho;
exports.Perspective = Perspective;
exports.CustomProjection = CustomProjection;
exports.Scene = Scene;

Object.defineProperty(exports, '__esModule', { value: true });

})));
