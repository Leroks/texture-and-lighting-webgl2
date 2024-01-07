const vsSource = `#version 300 es
    in vec4 pos;
    uniform mat4 projectionMatrix;
    uniform mat4 mvMatrix;
    uniform vec4 vColor;
    out vec4 fragmentColor;
    
    void main() 
    {
        gl_Position =  projectionMatrix  * mvMatrix * pos;
        fragmentColor = vColor;
    }
`;
const fsSource = `#version 300 es
    precision mediump float;
    uniform vec4 fragmentColor;
    out vec4 fragColor;
    
    void main() 
    {
        fragColor = fragmentColor;
    }
`;


var gl;
var canvas;
var type;
var normalizeIt;
var stride;
var offset = 0;
var program;
var multiplier = 1;
var adder = 0;

let uniformColorLoc;
var modelViewMatrix;

let aspectRatio = 1

var verticesOfShape = [];
var vertexCount;
var posBuffer;

var theta = [0, 0, 0];

var cameraPos = vec3(0, 4, 10);
var target = vec3(0, 0, 0);

var moveCallback;
var mouseX = 0;
var mouseY = 0;
var isMouse = false;

const gridRows = 25;
const gridColumns = 25;
const cubeSpacing = 1.2; // Adjust as needed to ensure cubes do not touch


function getCubePosition(row, column) {
    const x = (row - gridRows / 2) * cubeSpacing;
    const z = (column - gridColumns / 2) * cubeSpacing;
    return [x, 0, z]; // Assuming y is up-axis and cubes are placed at y = 0
}


// Define vertices and texture coordinates for a cube
verticesOfShape = [
    // Front face
    -0.5, -0.5, 0.5,
    0.5, -0.5, 0.5,
    0.5, 0.5, 0.5,
    -0.5, 0.5, 0.5,

    // Back face
    -0.5, -0.5, -0.5,
    0.5, -0.5, -0.5,
    0.5, 0.5, -0.5,
    -0.5, 0.5, -0.5,

    // Top face
    -0.5, 0.5, -0.5,
    -0.5, 0.5, 0.5,
    0.5, 0.5, 0.5,
    0.5, 0.5, -0.5,

    // Bottom face
    -0.5, -0.5, -0.5,
    -0.5, -0.5, 0.5,
    0.5, -0.5, 0.5,
    0.5, -0.5, -0.5,

    // Right face
    0.5, -0.5, -0.5,
    0.5, 0.5, -0.5,
    0.5, 0.5, 0.5,
    0.5, -0.5, 0.5,

    // Left face
    -0.5, -0.5, -0.5,
    -0.5, 0.5, -0.5,
    -0.5, 0.5, 0.5,
    -0.5, -0.5, 0.5,
];

const indices = [
    0, 1, 2, 0, 2, 3,    // Front face
    4, 5, 6, 4, 6, 7,    // Back face
    8, 9, 10, 8, 10, 11,  // Top face
    12, 13, 14, 12, 14, 15, // Bottom face
    16, 17, 18, 16, 18, 19, // Right face
    20, 21, 22, 20, 22, 23  // Left face
];


const textureCoordinates = [
    // Front
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,

    // Back
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,

    // Top
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,

    // Bottom
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,

    // Right
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,

    // Left
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0
];


function _createBufferObject(gl, array) {

    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(array), gl.STATIC_DRAW);

    return buffer;
}


function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }
    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}


window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            return window.setTimeout(callback, 1000 / 60);
        };
})();

var render = function () {
    const programInfo = {
        uniformLocations: {
            projectionMatrixLoc: gl.getUniformLocation(program, "projectionMatrix"),
            modelMatrixUniform: gl.getUniformLocation(program, "mvMatrix")
        }
    }
    // Compute the projection matrix
    var projectionMatrix = perspective(60, aspectRatio, 0.1, 200);
    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrixLoc, false, flatten(projectionMatrix)); // Set the matrix.


// Camera Rotation with mouse
    if (isMouse) {
        theta[1] += mouseX / 100 * multiplier;
        theta[0] -= mouseY / 100 * multiplier;

        // Limit the vertical rotation to avoid flipping
        theta[0] = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, theta[0]));

        target[0] += mouseX / 100 + adder;
        target[1] -= mouseY / 100 + adder;

        isMouse = false;
    }

    modelViewMatrix = lookAt(cameraPos, target, vec3(0, 1, 0));

    modelViewMatrix = mult(modelViewMatrix, rotate(-45, [0, 1, 0]));

    modelViewMatrix = mult(modelViewMatrix, rotate(theta[1], [0, 1, 0]));
    modelViewMatrix = mult(modelViewMatrix, rotate(theta[0], [1, 0, 0]));

    gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrixUniform, false, flatten(modelViewMatrix));

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniform4f(uniformColorLoc, 0.50, 1.0, 0.50, 1);

    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);

    type = gl.FLOAT;
    normalizeIt = false;
    stride = Float32Array.BYTES_PER_ELEMENT * 3;

    // Create an element buffer object (indices)
    const indexBuffer = gl.createBuffer();

    posBuffer = _createBufferObject(gl, verticesOfShape);

    uniformColorLoc = gl.getUniformLocation(program, "fragmentColor");

    const aPosition = gl.getAttribLocation(program, "pos");

    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 3, type, normalizeIt, stride, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // Modify the render function's drawing call
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridColumns; col++) {
            const cubePosition = getCubePosition(row, col);
            modelViewMatrix = lookAt(cameraPos, target, vec3(0, 1, 0));
            // Add translation for cubePosition
            modelViewMatrix = mult(modelViewMatrix, translate(cubePosition));
            // ... rotation or any other transformations ...

            gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrixUniform, false, flatten(modelViewMatrix));
            gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        }
    }


    requestAnimFrame(render);
}

function init() {

    canvas = document.querySelector("#canvas");
    gl = canvas.getContext("webgl2");

    program = initShaderProgram(gl, vsSource, fsSource);
    gl.useProgram(program);

    var havePointerLock = 'pointerLockElement' in document ||
        'webkitPointerLockElement' in document;


    var lockChange = function () {
        if (!havePointerLock) {
            return;
        }
        if (pointerLockApi()) {
            document.addEventListener("mousemove", moveCallback, false);
        } else {
            document.removeEventListener("mousemove", moveCallback, false);
        }

    }

    document.addEventListener('pointerlockchange', lockChange, false);

    moveCallback = function (e) {
        isMouse = true;
        var movementX = e.movementX ||
            e.webkitMovementX || 0;

        var movementY = e.movementY ||
            e.webkitMovementY || 0;
        mouseX = movementX;
        mouseY = movementY;
    }


    aspectRatio = canvas.width / canvas.height;

    requestAnimationFrame(function () {
        render();
    });
}

var pointerLockApi = function () {
    return canvas ===
        document.pointerLockElement
}

init();


document.onkeydown = function (e) {
    switch (e.key) {
        case "PageDown":
            cameraPos[1] -= 0.25;
            target[1] -= 0.25;
            break;
        case "PageUp":
            cameraPos[1] += 0.25;
            target[1] += 0.25;
            break;
        case "ArrowLeft":
            cameraPos[0] -= 0.15;
            target[0] -= 0.15;
            break;
        case "ArrowRight":
            cameraPos[0] += 0.15;
            target[0] += 0.15;
            break;
        case "ArrowUp":
            cameraPos[2] -= 0.55;
            target[2] -= 0.55;
            break;
        case "ArrowDown":
            cameraPos[2] += 0.55;
            target[2] += 0.55;
            break;
        case "p":
            if (!pointerLockApi()) {
                canvas.requestPointerLock();
            } else {
                document.exitPointerLock();
            }
            break;
        default:
            break;
    }
}