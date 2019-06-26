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
