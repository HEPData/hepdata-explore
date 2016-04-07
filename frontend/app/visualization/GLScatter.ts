import {DataPoint} from "../base/dataFormat";

export function ShaderError(message) {
    this.name = 'ShaderError';
    this.message = message;
    this.stack = (<any>new Error()).stack;
}
ShaderError.prototype = new Error();

const dataPointVertexSource = `
attribute vec2 aRectPosition;
attribute vec2 aDataPoint;

varying highp vec2 vRectPosition;

void main() {
    const vec2 uRectSize = vec2(8.0 / 300.0, 8.0 / 300.0);
    
    // Normalize aDataPoint from [0, 1] to [-1, 1]
    vec2 aDataPointNorm = aDataPoint * vec2(2.0, 2.0) - vec2(1.0, 1.0);
    
    gl_Position = vec4(aDataPointNorm + (aRectPosition * uRectSize), 1.0, 1.0);
    vRectPosition = aRectPosition;
}
`;

const dataPointFragSource = `
precision highp float;

// Fragment shader
varying vec2 vRectPosition;

void main() {
    const vec4 dotColor = vec4(1.0, 0.0, 0.0, 1.0);
    
    float sqrDistanceFromCenter = dot(vRectPosition, vRectPosition);
        
    float circleRadius = 0.3;
    
    if (sqrDistanceFromCenter > circleRadius * circleRadius) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    } else {
        gl_FragColor = dotColor;
    }
}
`;

export class GLScatter {
    gl: WebGLRenderingContext;

    dataPointProgram: WebGLProgram;
    dataPointVertexBuffer: WebGLBuffer;
    dataPointFloats: Float32Array;
    dataPointAttrs: {
        aRectPosition: number;
        aDataPoint: number;
    };

    dataMinX: number;
    dataMaxX: number;
    dataMinY: number;
    dataMaxY: number;

    constructor(public canvas: HTMLCanvasElement,
                public data: DataPoint[],
                public width: number,
                public height: number) {

        // Precompute minimums and maximums
        this.computeMinMax();

        // Initialize the context
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        const gl = this.gl = <WebGLRenderingContext>
                this.canvas.getContext("webgl") ||
            this.canvas.getContext("experimental-webgl");

        gl.viewport(0, 0, this.width, this.height);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendEquation(gl.FUNC_ADD);

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
        };

        // Load vertices from data
        this.loadData();

        // Draw now!
        this.draw();
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
         */
        const floatsPerVertex = 4;
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

        function addDataPointData(dataPoint: DataPoint) {
            // Add these properties that are the same for all the vertices of a
            // data point.
            floats[nFloat++] = scaleX(dataPoint.x_center);
            floats[nFloat++] = scaleY(dataPoint.y);
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

    draw() {
        const gl = this.gl;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(this.dataPointProgram);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.dataPointVertexBuffer);

        const floatsPerVertex = 4;
        const floatSize = 4; // bytes
        const stride = 4 * floatsPerVertex;
        this.vertexAttribPointer(this.dataPointAttrs
            .aRectPosition, 2, gl.FLOAT, false, stride, 0);
        this.vertexAttribPointer(this.dataPointAttrs
            .aDataPoint, 2, gl.FLOAT, false, stride, 2 * floatSize);

        gl.drawArrays(gl.TRIANGLES, 0, this.data.length * 6);
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
            throw new ShaderError('Could not link the shaders');
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
}