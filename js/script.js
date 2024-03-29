const vsSource = `#version 300 es
    in vec4 pos;
    in vec2 aTexCoord; // Add texture coordinate attribute
    uniform mat4 projectionMatrix;
    uniform mat4 mvMatrix;
    uniform vec4 vColor;
    out vec4 fragmentColor;
    out vec2 vTexCoord; // Pass texture coordinate to fragment shader
    
    void main() 
    {
        gl_Position =  projectionMatrix  * mvMatrix * pos;
        fragmentColor = vColor;
        vTexCoord = aTexCoord; // Pass texture coordinate to fragment shader
    }
`;
const fsSource = `#version 300 es
    precision mediump float;
    
    in vec2 vTexCoord; // Receive texture coordinate from vertex shader
    uniform sampler2D uTexture; // Texture sampler
    
    out vec4 fragColor;
    
    void main() 
    {
        fragColor = texture(uTexture, vTexCoord); // Apply the texture
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

var cameraPos = vec3(0, 10, 30);
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

var skyboxVertices = [
    // Positions
    -1.0, -1.0,  1.0, // Back face
    1.0, -1.0,  1.0,
    -1.0,  1.0,  1.0,
    1.0,  1.0,  1.0,

    -1.0, -1.0, -1.0, // Front face
    -1.0,  1.0, -1.0,
    1.0, -1.0, -1.0,
    1.0,  1.0, -1.0,

    -1.0,  1.0, -1.0, // Top face
    -1.0,  1.0,  1.0,
    1.0,  1.0, -1.0,
    1.0,  1.0,  1.0,

    -1.0, -1.0, -1.0, // Bottom face
    1.0, -1.0, -1.0,
    -1.0, -1.0,  1.0,
    1.0, -1.0,  1.0,

    1.0, -1.0, -1.0, // Right face
    1.0,  1.0, -1.0,
    1.0, -1.0,  1.0,
    1.0,  1.0,  1.0,

    -1.0, -1.0, -1.0, // Left face
    -1.0, -1.0,  1.0,
    -1.0,  1.0, -1.0,
    -1.0,  1.0,  1.0,
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

    // Create buffer for texture coordinates
    const texCoordBuffer = _createBufferObject(gl, textureCoordinates);

    uniformColorLoc = gl.getUniformLocation(program, "fragmentColor");

    const aPosition = gl.getAttribLocation(program, "pos");

    // Bind the texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cubeTexture);
    gl.uniform1i(gl.getUniformLocation(program, "uTexture"), 0); // Tell the shader we bound the texture to texture unit 0

    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 3, type, normalizeIt, stride, 0);

    // Set up the texture coordinates attribute (similar to how you set up the position attribute)
    const aTexCoordLocation = gl.getAttribLocation(program, "aTexCoord");
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(aTexCoordLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aTexCoordLocation);

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

            // Bind the position buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
            gl.vertexAttribPointer(aPosition, 3, type, normalizeIt, stride, 0);
            gl.enableVertexAttribArray(aPosition);

            // Bind the texture coordinate buffer
            gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
            gl.vertexAttribPointer(aTexCoordLocation, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(aTexCoordLocation);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
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

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Fill the texture with a 1x1 blue pixel as placeholder
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]); // Blue pixel
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, pixel);

    // Load the actual image
    const image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);

        // WebGL1 has different requirements for power of 2 images vs non power of 2 images
        // For simplicity, assuming the image is power of 2 here
        gl.generateMipmap(gl.TEXTURE_2D);
    };
    image.src = url;

    return texture;
}

// Load the texture
const cubeTexture = loadTexture(gl, '../Assets/seagull.jpg');

function loadCubeTexture(gl, urls) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    // Define each face of the cube and load the corresponding image
    const faceInfos = [
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_X, url: urls[0] }, // Right
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, url: urls[1] }, // Left
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, url: urls[2] }, // Top
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, url: urls[3] }, // Bottom
        { target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, url: urls[4] }, // Front
        { target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, url: urls[5] }, // Back
    ];

    faceInfos.forEach((faceInfo) => {
        const { target, url } = faceInfo;

        // Setup each face so it's immediately renderable
        gl.texImage2D(target, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

        // Asynchronously load an image
        const image = new Image();
        image.onload = function() {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        };
        image.src = url;
    });

    // Set up texture parameters
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    return texture;
}

const skyboxTexture = loadCubeTexture(gl, [
    '../Assets/skybox/right.jpg',    // Positive X
    '../Assets/skybox/left.jpg',     // Negative X
    '../Assets/skybox/top.jpg',      // Positive Y
    '../Assets/skybox/bottom.jpg',   // Negative Y
    '../Assets/skybox/front.jpg',    // Positive Z
    '../Assets/skybox/back.jpg',     // Negative Z
]);
