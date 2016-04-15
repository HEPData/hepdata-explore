import {DataPoint} from "../base/dataFormat";

export function ShaderError(message) {
    this.name = 'ShaderError';
    this.message = message;
    this.stack = (<any>new Error()).stack;
}
ShaderError.prototype = new Error();

// Shader constants
const dotRadiusPx = 2;
const boxRadiusPx = dotRadiusPx;
// const boxRadiusPx = dotRadiusPx + 2;
const constants = `
#define boxRadiusPx ${boxRadiusPx.toFixed(1)}
#define dotRadiusPx ${dotRadiusPx.toFixed(1)}
`;

/* language=GLSL */
const dataPointVertexSource = constants + `
// Vertex shader
precision mediump float;

// a corner of the rectangle, e.g. (-1, -1) for the lower left corner
attribute vec2 aRectPosition;
attribute vec2 aDataPoint;
attribute vec3 aColor;

uniform vec2 uPlotSizePx;
uniform mat4 uTransform;

varying vec2 vRectPositionPx;
varying vec3 vColor;

vec2 glCoordsToRelCoords(in vec2 glCoords) {
    return (glCoords + vec2(1.0, 1.0)) * vec2(0.5, 0.5);
}

vec2 relCoordsToGLCoords(in vec2 relCoords) {
    return (relCoords * vec2(2.0, 2.0)) - vec2(1.0, 1.0);
}

vec2 glCoordsToPixelCoords(in vec2 glCoords) {
    return glCoordsToRelCoords(glCoords) * uPlotSizePx;
}

vec2 pixelCoordsToGlCoords(in vec2 pixelCoords) {
    return relCoordsToGLCoords(pixelCoords / uPlotSizePx);
}

vec2 alignToPixelBoundaries(in vec2 pointInGLcoords) {
    // Convert to pixel coords (e.g. 640, 480)
    vec2 pointInPixels = glCoordsToPixelCoords(pointInGLcoords);
    
    // round to the nearest integer pixel
    vec2 roundedPointInPixels = floor(pointInPixels + vec2(0.5, 0.5));
    
    // Note the result is in a pixel boundary, not the center of a pixel.
    // If we have a 8x8 px canvas we have 9 pixel boundaries on each axis 
    // (0 to 8, both included).
    
    // finally return pixel coords
    return roundedPointInPixels;
}

void main() {
    // Normalize aDataPoint from [0, 1] to [-1, 1]
    vec2 aDataPointNorm = relCoordsToGLCoords(aDataPoint);
    
    // Transform aDataPointNorm to fit in the plot area (e.g. inside the axes)
    aDataPointNorm = vec4(uTransform * vec4(aDataPointNorm, 0.0, 1.0)).xy;
    
    // Find a pixel boundary for the data point
    vec2 aDataPointNormPx = alignToPixelBoundaries(aDataPointNorm);
    
    // Calculate the pixel for this box vertex
    vec2 vertexPx = aDataPointNormPx + aRectPosition * boxRadiusPx;
    
    // Turn the pixel coords back into GL coords
    gl_Position = vec4(pixelCoordsToGlCoords(vertexPx), 1.0, 1.0);
    vRectPositionPx = aRectPosition * dotRadiusPx;
    vColor = aColor;
}
`;

/* language=GLSL */
const dataPointFragSource = constants + `// Fragment shader
precision mediump float;

// Position of this fragment within the box, between (-1,-1) and (1,1)
varying vec2 vRectPositionPx;
varying vec3 vColor;

uniform vec2 uPlotSizePx;

float getOpacityForPixelPosition(in vec2 positionPx) {
    // The distance of the fragment from the center of the box is the magnitude
    // of the position vector. 
    float distanceFromCenterPx = length(positionPx);
    
    return (distanceFromCenterPx <= dotRadiusPx ? 1.0 : 0.0);
}

void main() {
    vec4 dotColor = vec4(vColor, 1.0);
    
    // vRectPositionPx contains a pixel offset from the center of the box.
    // vRectPositionPx is set in the center of a pixel.
    
    // MSAA 4x, 2x2 grid
    float opacity = (
        getOpacityForPixelPosition(vRectPositionPx + vec2(-0.25, -0.25)) +
        getOpacityForPixelPosition(vRectPositionPx + vec2( 0.25, -0.25)) +
        getOpacityForPixelPosition(vRectPositionPx + vec2( 0.25,  0.25)) +
        getOpacityForPixelPosition(vRectPositionPx + vec2(-0.25,  0.25))
    ) * 0.25;
    
    // Scale opacity to max 80%
    opacity = 0.8 * opacity;
    
    // Set the opacity, minding the output is in premultiplied alpha format
    gl_FragColor = opacity * dotColor;
}
`;

/* language=GLSL */
const simpleTextureVertSource = `
// vertex shader
precision mediump float;

attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

varying vec2 vTextureCoord;

void main() {
    gl_Position = vec4(aVertexPosition, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
}
`;

/* language=GLSL */
const simpleTextureFragSource = `
// fragment shader
precision mediump float;

varying vec2 vTextureCoord;

uniform sampler2D uSampler;

void main() {
    gl_FragColor = texture2D(uSampler, vTextureCoord.st);
}
`;

export interface Margins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export class GLScatter {
    gl: WebGLRenderingContext;
    private canvas2d: HTMLCanvasElement;

    dataPointProgram: WebGLProgram;
    dataPointVertexBuffer: WebGLBuffer;
    dataPointFloats: Float32Array;
    dataPointAttrs: {
        aRectPosition: number;
        aDataPoint: number;
        aColor: number;
        uPlotSizePx: WebGLUniformLocation;
        uTransform: WebGLUniformLocation;
    };

    simpleTextureProgram: WebGLProgram;
    simpleTextureAttrs: {
        aVertexPosition: number;
        aTextureCoord: number;
    };

    dataMinX: number;
    dataMaxX: number;
    dataMinY: number;
    dataMaxY: number;

    margin: Margins;
    transformationMatrix: Float32Array;

    constructor(public canvas: HTMLCanvasElement,
                public data: DataPoint[],
                public width: number,
                public height: number) {

        // Precompute minimums and maximums
        this.computeMinMax();

        // Initialize the context
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Create another 2D canvas for text rendering (e.g. axes)
        this.canvas2d = document.createElement('canvas');
        this.canvas2d.width = this.width;
        this.canvas2d.height = this.height;

        // Set default margins to let space for the axes
        this.margin = {
            top: 10,
            right: 50,
            bottom: 30,
            left: 42
        };

        this.transformationMatrix = GLScatter.getAxesTransformationMatrix(
            this.width, this.height, this.margin);

        const gl = this.gl = <WebGLRenderingContext>
                this.canvas.getContext("webgl") ||
            this.canvas.getContext("experimental-webgl");

        gl.viewport(0, 0, this.width, this.height);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendEquation(gl.FUNC_ADD);

        // No depth testing for now. Z order is render order unless uncommented:
        // gl.enable(gl.DEPTH_TEST);
        // gl.depthFunc(gl.LEQUAL);

        // Load shaders
        function shaderAttribute(program: WebGLProgram, attributeName: string) {
            const attrib = gl.getAttribLocation(program, attributeName);
            if (attrib == -1) {
                console.warn('Missing attribute ' + attributeName);
            } else {
                gl.enableVertexAttribArray(attrib);
            }
            return attrib;
        }

        this.dataPointProgram = this.compileProgram(
            dataPointVertexSource, dataPointFragSource);
        gl.useProgram(this.dataPointProgram);
        this.dataPointAttrs = {
            aRectPosition: shaderAttribute(this.dataPointProgram, 'aRectPosition'),
            aDataPoint: shaderAttribute(this.dataPointProgram, 'aDataPoint'),
            aColor: shaderAttribute(this.dataPointProgram, 'aColor'),
            uPlotSizePx: gl.getUniformLocation(this.dataPointProgram, 'uPlotSizePx'),
            uTransform: gl.getUniformLocation(this.dataPointProgram, 'uTransform'),
        };

        this.simpleTextureProgram = this.compileProgram(
            simpleTextureVertSource, simpleTextureFragSource);
        gl.useProgram(this.simpleTextureProgram);
        this.simpleTextureAttrs = {
            aVertexPosition: shaderAttribute(this.simpleTextureProgram, 'aVertexPosition'),
            aTextureCoord: shaderAttribute(this.simpleTextureProgram, 'aTextureCoord')
        };

        // Load vertices from data
        this.loadData();

        // Draw now!
        this.draw();
    }

    static getAxesTransformationMatrix(W: number, H: number, margins: Margins) {
        const w = W - margins.left - margins.right;
        const h = H - margins.top - margins.bottom;

        const transform = new Float32Array(4 * 4);
        mat4.identity(transform);
        mat4.scale(transform, transform, [w / W, h / H, 1]);
        mat4.translate(transform, transform, [
            (margins.left - margins.right) / W,
            (margins.bottom - margins.top) / H,
            0]);

        return transform;
    }

    computeMinMax() {
        const data = this.data;

        let minX = Infinity;
        let maxX = -Infinity;

        let minY = Infinity;
        let maxY = -Infinity;

        for (let i = 0; i < data.length; i++) {
            let dataPoint = data[i];

            // x
            if (dataPoint.x_low < minX) {
                minX = dataPoint.x_low;
            }
            if (dataPoint.x_high > maxX) {
                maxX = dataPoint.x_high;
            }

            // y
            if (dataPoint.y < minY) {
                minY = dataPoint.y;
            }
            if (dataPoint.y > maxY) {
                maxY = dataPoint.y;
            }
        }

        this.dataMinX = minX;
        this.dataMaxX = maxX;

        this.dataMinY = minY;
        this.dataMaxY = maxY;
    }

    loadData() {
        const gl = this.gl;
        const data = this.data;

        this.dataPointVertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.dataPointVertexBuffer);

        /**
         Each data point will have 6 vertices (forming a rectangle with two
         triangles).

         Each data point vertex will harbor the following data:

         - [rectX, rectY]: indicates what vertex of the rectangle is this. Each
           value is exactly -1 or 1.

         - [dataPointX, dataPointY]: the data point value, adjusted to [0..1]
           range.

         - [R,G,B]: the data point color, as 3 floats.
         */
        const floatsPerVertex = 7;
        const floats = this.dataPointFloats = new Float32Array(
            data.length * floatsPerVertex * 6);
        let nFloat = 0;

        const minX = this.dataMinX;
        const maxX = this.dataMaxX;
        const rangeX = maxX - minX;
        function scaleX(x: number) {
            return (x - minX) / rangeX;
        }

        const minY = this.dataMinY;
        const maxY = this.dataMaxY;
        const rangeY = maxY - minY;
        function scaleY(y: number) {
            return (y - minY) / rangeY;
        }

        var colorScale = d3.scale.category10();
        function hexToR(h) {return parseInt(h.substring(0,2),16)}
        function hexToG(h) {return parseInt(h.substring(2,4),16)}
        function hexToB(h) {return parseInt(h.substring(4,6),16)}

        function addDataPointData(dataPoint: DataPoint) {
            // Add these properties that are the same for all the vertices of a
            // data point.
            floats[nFloat++] = scaleX(dataPoint.x_center);
            floats[nFloat++] = scaleY(dataPoint.y);

            var key = dataPoint.inspire_record + '-' + dataPoint.table_num;
            var colorHex = colorScale(key).substring(1);
            floats[nFloat++] = hexToR(colorHex) / 255;
            floats[nFloat++] = hexToG(colorHex) / 255;
            floats[nFloat++] = hexToB(colorHex) / 255;
        }

        function addVertex(dataPoint: DataPoint, rectX: number, rectY: number) {
            floats[nFloat++] = rectX;
            floats[nFloat++] = rectY;
            addDataPointData(dataPoint);
        }

        const top = -1;
        const bottom = 1;
        const left = -1;
        const right = 1;

        for (let i = 0; i < data.length; i++) {
            var dataPoint = data[i];

            // CCW order
            addVertex(dataPoint, left, bottom);
            addVertex(dataPoint, right, top);
            addVertex(dataPoint, left, top);

            addVertex(dataPoint, right, top);
            addVertex(dataPoint, left, bottom);
            addVertex(dataPoint, right, bottom);
        }

        gl.bufferData(gl.ARRAY_BUFFER, floats, gl.STATIC_DRAW);
    }

    vertexAttribPointer(indx: number, size: number, type: number, normalized: boolean, stride: number, offset: number) {
        // Don't crash on missing or optimized out attributes
        if (indx != -1) {
            this.gl.vertexAttribPointer(indx, size, type, normalized, stride, offset);
        }
    }

    compileProgram(vertShaderSource: string, fragShaderSource): WebGLProgram {
        const gl = this.gl;

        const program = gl.createProgram();
        gl.attachShader(program,
            this.compileShader(vertShaderSource, gl.VERTEX_SHADER));
        gl.attachShader(program,
            this.compileShader(fragShaderSource, gl.FRAGMENT_SHADER));
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new ShaderError('Could not link the shaders:\n' +
                gl.getProgramInfoLog(program));
        }

        return program;
    }

    compileShader(source: string, shaderType: number): WebGLShader {
        const gl = this.gl;

        const shader = gl.createShader(shaderType);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new ShaderError(gl.getShaderInfoLog(shader));
        }

        return shader;
    }


    draw() {
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.drawDataDots();
        this.drawAxes();

        // requestAnimationFrame(() => {
        //     this.draw();
        // });
    }

    drawDataDots() {
        const gl = this.gl;

        gl.useProgram(this.dataPointProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.dataPointVertexBuffer);

        gl.uniform2f(this.dataPointAttrs.uPlotSizePx, this.width, this.height);
        gl.uniformMatrix4fv(this.dataPointAttrs.uTransform, false,
            this.transformationMatrix)

        const floatsPerVertex = 7;
        const floatSize = 4; // bytes
        const stride = 4 * floatsPerVertex;
        this.vertexAttribPointer(this.dataPointAttrs
            .aRectPosition, 2, gl.FLOAT, false, stride, 0);
        this.vertexAttribPointer(this.dataPointAttrs
            .aDataPoint, 2, gl.FLOAT, false, stride, 2 * floatSize);
        this.vertexAttribPointer(this.dataPointAttrs
            .aColor, 3, gl.FLOAT, false, stride, 4 * floatSize);

        gl.drawArrays(gl.TRIANGLES, 0, this.data.length * 6);
    }

    drawAxes() {
        const ctx = this.canvas2d.getContext('2d');
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';

        const margin = this.margin;
        const W = this.width, H = this.height;
        const w = this.width - margin.left - margin.right;
        const h = this.height - margin.top - margin.bottom;

        ctx.clearRect(0, 0, this.canvas2d.width, this.canvas2d.height);

        // Adjust to pixel boundaries
        ctx.save();
        ctx.translate(-0.5, 0.5);

        ctx.strokeStyle = '#000000';
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, H - margin.bottom);
        ctx.lineTo(W - margin.right, H - margin.bottom);
        ctx.stroke();

        ctx.restore();

        const gl = this.gl;
        gl.useProgram(this.simpleTextureProgram);

        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas2d);
        // No mipmaps (NPOT texture)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(this.simpleTextureProgram, 'uSampler'), 0);

        const top = -1;
        const bottom = 1;
        const left = -1;
        const right = 1;

        const vertexBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            left, top,
            right, top,
            right, bottom,
            left, bottom,
        ]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(this.simpleTextureAttrs.aVertexPosition,
            2, gl.FLOAT, false, 0, 0);

        const textureCoordsBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordsBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            // Texture mapping is upside down in WebGL
            0, 1,
            1, 1,
            1, 0,
            0, 0,
        ]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(this.simpleTextureAttrs.aTextureCoord,
            2, gl.FLOAT, false, 0, 0);

        const vertexIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([
            // clockwise
            0, 1, 2,    0, 2, 3,
        ]), gl.STATIC_DRAW);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        gl.deleteTexture(tex);
        gl.deleteBuffer(vertexIndexBuffer);
        gl.deleteBuffer(textureCoordsBuf);
        gl.deleteBuffer(vertexBuf);
    }
}