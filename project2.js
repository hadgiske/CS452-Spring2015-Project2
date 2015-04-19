var CharY = 0;
var CharZ = 0;
var CharX = 0;

var CharL = 0;
var CharR = 0;
var CharT = 0;
var CharB = 0;

var Sqr1X = 8;
var Sqr1Y = 0;

var Sqr1XL = 0;
var Sqr1XR = 0;
var Sqr1XT = 0;
var Sqr1XB = 0;

var Sqr2X = 6;
var Sqr2Y = 0;

var Sqr2XL = 0;
var Sqr2XR = 0;
var Sqr2XT = 0;
var Sqr2XB = 0;

var Sqr3X = 0;
var Sqr3Y = 6;

var Sqr3XL = 0;
var Sqr3XR = 0;
var Sqr3XT = 0;
var Sqr3XB = 0;

var Sqr4X = 0;
var Sqr4Y = 6;

var Sqr4XL = 0;
var Sqr4XR = 0;
var Sqr4XT = 0;
var Sqr4XB = 0;

// Shadow.js (c) 2012 matsuda and tanaka
// Vertex shader program for generating a shadow map
var SHADOW_VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'uniform mat4 u_MvpMatrix;\n' +
  'void main() {\n' +
  '  gl_Position = u_MvpMatrix * a_Position;\n' +
  '}\n';

// Fragment shader program for generating a shadow map
var SHADOW_FSHADER_SOURCE =
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +
  'void main() {\n' +
  '  gl_FragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 0.0);\n' + // Write the z-value in R
  '}\n';

// Vertex shader program for regular drawing
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'attribute vec4 a_Color;\n' +
  'uniform mat4 u_MvpMatrix;\n' +
  'uniform mat4 u_MvpMatrixFromLight;\n' +
  'varying vec4 v_PositionFromLight;\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  gl_Position = u_MvpMatrix * a_Position;\n' + 
  '  v_PositionFromLight = u_MvpMatrixFromLight * a_Position;\n' +
  '  v_Color = a_Color;\n' +
  '}\n';

// Fragment shader program for regular drawing
var FSHADER_SOURCE =
  '#ifdef GL_ES\n' +
  'precision mediump float;\n' +
  '#endif\n' +
  'uniform sampler2D u_ShadowMap;\n' +
  'varying vec4 v_PositionFromLight;\n' +
  'varying vec4 v_Color;\n' +
  'void main() {\n' +
  '  vec3 shadowCoord = (v_PositionFromLight.xyz/v_PositionFromLight.w)/2.0 + 0.5;\n' +
  '  vec4 rgbaDepth = texture2D(u_ShadowMap, shadowCoord.xy);\n' +
  '  float depth = rgbaDepth.r;\n' + // Retrieve the z-value from R
  '  float visibility = (shadowCoord.z > depth + 0.005) ? 0.7 : 1.0;\n' +
  '  gl_FragColor = vec4(v_Color.rgb * visibility, v_Color.a);\n' +
  '}\n';

var OFFSCREEN_WIDTH = 2048, OFFSCREEN_HEIGHT = 2048;
var LIGHT_X = 0, LIGHT_Y = 7, LIGHT_Z = 2; // Position of the light source

window.onload = function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Initialize shaders for generating a shadow map
  var shadowProgram = createProgram(gl, SHADOW_VSHADER_SOURCE, SHADOW_FSHADER_SOURCE);
  shadowProgram.a_Position = gl.getAttribLocation(shadowProgram, 'a_Position');
  shadowProgram.u_MvpMatrix = gl.getUniformLocation(shadowProgram, 'u_MvpMatrix');
  if (shadowProgram.a_Position < 0 || !shadowProgram.u_MvpMatrix) {
    console.log('Failed to get the storage location of attribute or uniform variable from shadowProgram'); 
    return;
  }

  // Initialize shaders for regular drawing
  var normalProgram = createProgram(gl, VSHADER_SOURCE, FSHADER_SOURCE);
  normalProgram.a_Position = gl.getAttribLocation(normalProgram, 'a_Position');
  normalProgram.a_Color = gl.getAttribLocation(normalProgram, 'a_Color');
  normalProgram.u_MvpMatrix = gl.getUniformLocation(normalProgram, 'u_MvpMatrix');
  normalProgram.u_MvpMatrixFromLight = gl.getUniformLocation(normalProgram, 'u_MvpMatrixFromLight');
  normalProgram.u_ShadowMap = gl.getUniformLocation(normalProgram, 'u_ShadowMap');
  if (normalProgram.a_Position < 0 || normalProgram.a_Color < 0 || !normalProgram.u_MvpMatrix ||
      !normalProgram.u_MvpMatrixFromLight || !normalProgram.u_ShadowMap) {
    console.log('Failed to get the storage location of attribute or uniform variable from normalProgram'); 
    return;
  }

  // Set the vertex information
  var triangle = initVertexBuffersForTriangle(gl);
  var plane = initVertexBuffersForPlane(gl);
  var square1 = initVertexBuffersForSquare(gl);
  var square2 = initVertexBuffersForSquareOtherX(gl);
  var square3 = initVertexBuffersForSquareY(gl);
  var square4 = initVertexBuffersForSquareOtherY(gl);
  if (!triangle || !plane) {
    console.log('Failed to set the vertex information');
    return;
  }

  // Initialize framebuffer object (FBO)  
  var fbo = initFramebufferObject(gl);
  if (!fbo) {
    console.log('Failed to initialize frame buffer object');
    return;
  }
  gl.activeTexture(gl.TEXTURE0); // Set a texture object to the texture unit
  gl.bindTexture(gl.TEXTURE_2D, fbo.texImage);

  // Set the clear color and enable the depth test
  gl.clearColor(1, 1, 1, 1);
  gl.enable(gl.DEPTH_TEST);

  var viewProjMatrixFromLight = new Matrix4(); // Prepare a view projection matrix for generating a shadow map
  viewProjMatrixFromLight.setPerspective(70.0, OFFSCREEN_WIDTH/OFFSCREEN_HEIGHT, 1.0, 100.0);
  viewProjMatrixFromLight.lookAt(LIGHT_X, LIGHT_Y, LIGHT_Z, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);

  var viewProjMatrix = new Matrix4();          // Prepare a view projection matrix for regular drawing
  viewProjMatrix.setPerspective(60, canvas.width/canvas.height, 1.0, 100.0);
  viewProjMatrix.lookAt(0.0, 0.0, 12.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);

  var currentAngle = 0.0; // Current rotation angle (degrees)
  var mvpMatrixFromLight_t = new Matrix4(); // A model view projection matrix from light source (for triangle)
  var mvpMatrixFromLight_p = new Matrix4(); // A model view projection matrix from light source (for plane)
  var tick = function() {
	  
    //currentAngle = animate(currentAngle);
	triangle = initVertexBuffersForTriangle(gl);
	square1 = initVertexBuffersForSquare(gl);
	square2 = initVertexBuffersForSquareOtherX(gl);
	square3 = initVertexBuffersForSquareY(gl);
    square4 = initVertexBuffersForSquareOtherY(gl);
	document.onkeydown = handleKeyDown;
  	document.onkeyup = handleKeyUp;
	
	squareOne();
	squareTwo();
	squareThree();
	squareFour();
	
	winLossCheck();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);               // Change the drawing destination to FBO
    gl.viewport(0, 0, OFFSCREEN_HEIGHT, OFFSCREEN_HEIGHT); // Set view port for FBO
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);   // Clear FBO    

    gl.useProgram(shadowProgram); // Set shaders for generating a shadow map
    // Draw the triangle and the plane (for generating a shadow map)
    drawTriangle(gl, shadowProgram, triangle, currentAngle, viewProjMatrixFromLight);
    mvpMatrixFromLight_t.set(g_mvpMatrix); // Used later
	drawSquare(gl, shadowProgram, square1, currentAngle, viewProjMatrixFromLight);
    mvpMatrixFromLight_t.set(g_mvpMatrix); // Used later
	drawSquareOtherX(gl, shadowProgram, square2, currentAngle, viewProjMatrixFromLight);
    mvpMatrixFromLight_t.set(g_mvpMatrix); // Used later
	drawSquareY(gl, shadowProgram, square3, currentAngle, viewProjMatrixFromLight);
    mvpMatrixFromLight_t.set(g_mvpMatrix); // Used later
	drawSquareOtherY(gl, shadowProgram, square4, currentAngle, viewProjMatrixFromLight);
    mvpMatrixFromLight_t.set(g_mvpMatrix); // Used later
    drawPlane(gl, shadowProgram, plane, viewProjMatrixFromLight);
    mvpMatrixFromLight_p.set(g_mvpMatrix); // Used later

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);               // Change the drawing destination to color buffer
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);    // Clear color and depth buffer

    gl.useProgram(normalProgram); // Set the shader for regular drawing
    gl.uniform1i(normalProgram.u_ShadowMap, 0);  // Pass 0 because gl.TEXTURE0 is enabledする
    // Draw the triangle and plane ( for regular drawing)
    gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_t.elements);
    drawTriangle(gl, normalProgram, triangle, currentAngle, viewProjMatrix);
	gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_t.elements);
    drawSquare(gl, normalProgram, square1, currentAngle, viewProjMatrix);
	gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_t.elements);
    drawSquareOtherX(gl, normalProgram, square2, currentAngle, viewProjMatrix);
	gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_t.elements);
    drawSquareY(gl, normalProgram, square3, currentAngle, viewProjMatrix);
	gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_t.elements);
    drawSquareOtherY(gl, normalProgram, square4, currentAngle, viewProjMatrix);
    gl.uniformMatrix4fv(normalProgram.u_MvpMatrixFromLight, false, mvpMatrixFromLight_p.elements);
    drawPlane(gl, normalProgram, plane, viewProjMatrix);

    window.requestAnimationFrame(tick, canvas);
  };
  tick(); 
}

// Coordinate transformation matrix
var g_modelMatrix = new Matrix4();
var g_mvpMatrix = new Matrix4();
function drawTriangle(gl, program, triangle, angle, viewProjMatrix) {
  // Set rotate angle to model matrix and draw triangle
  g_modelMatrix.setRotate(angle, 0, 1, 0);
  draw(gl, program, triangle, viewProjMatrix);
}

function drawSquare(gl, program, square1, angle, viewProjMatrix) {
  // Set rotate angle to model matrix and draw triangle
  g_modelMatrix.setRotate(angle, 0, 1, 0);
  draw(gl, program, square1, viewProjMatrix);
}

function drawSquareOtherX(gl, program, square1, angle, viewProjMatrix) {
  // Set rotate angle to model matrix and draw triangle
  g_modelMatrix.setRotate(angle, 0, 1, 0);
  draw(gl, program, square1, viewProjMatrix);
}

function drawSquareY(gl, program, square3, angle, viewProjMatrix) {
  // Set rotate angle to model matrix and draw triangle
  g_modelMatrix.setRotate(angle, 0, 1, 0);
  draw(gl, program, square3, viewProjMatrix);
}

function drawSquareOtherY(gl, program, square4, angle, viewProjMatrix) {
  // Set rotate angle to model matrix and draw triangle
  g_modelMatrix.setRotate(angle, 0, 1, 0);
  draw(gl, program, square4, viewProjMatrix);
}

function drawPlane(gl, program, plane, viewProjMatrix) {
  // Set rotate angle to model matrix and draw plane
  g_modelMatrix.setRotate(-45, 0, 1, 1);
  draw(gl, program, plane, viewProjMatrix);
}

function draw(gl, program, o, viewProjMatrix) {
  initAttributeVariable(gl, program.a_Position, o.vertexBuffer);
  if (program.a_Color != undefined) // If a_Color is defined to attribute
    initAttributeVariable(gl, program.a_Color, o.colorBuffer);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.indexBuffer);

  // Calculate the model view project matrix and pass it to u_MvpMatrix
  g_mvpMatrix.set(viewProjMatrix);
  g_mvpMatrix.multiply(g_modelMatrix);
  gl.uniformMatrix4fv(program.u_MvpMatrix, false, g_mvpMatrix.elements);

  gl.drawElements(gl.TRIANGLES, o.numIndices, gl.UNSIGNED_BYTE, 0);
}

// Assign the buffer objects and enable the assignment
function initAttributeVariable(gl, a_attribute, buffer) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.vertexAttribPointer(a_attribute, buffer.num, buffer.type, false, 0, 0);
  gl.enableVertexAttribArray(a_attribute);
}

function initVertexBuffersForPlane(gl) {
  // Create a plane
  //  v1------v0
  //  |        | 
  //  |        |
  //  |        |
  //  v2------v3

  // Vertex coordinates
  var vertices = new Float32Array([
    15.0, -5.7, -2.5,  -1.0, -9.7, 9.5,  -15.0, -15.7, 5.0,   8.0, 0.6, -10.5    // v0-v1-v2-v3
  ]);

  // Colors
  var colors = new Float32Array([
    0.7, 0.7, 0.7,  0.7, 0.7, 0.7,   0.7, 0.7, 0.7,    0.7, 0.7, 0.7
  ]);

  // Indices of the vertices
  var indices = new Uint8Array([0, 1, 2,   0, 2, 3]);

  var o = new Object(); // Utilize Object object to return multiple buffer objects together

  // Write vertex information to buffer object
  o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
  o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
  o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
  if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null; 

  o.numIndices = indices.length;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return o;
}

function initVertexBuffersForSquare(gl) {
  // Create a plane
  //  v1------v0
  //  |        | 
  //  |        |
  //  |        |
  //  v2------v3

  // Vertex coordinates
  var vertices = new Float32Array([
    1.5 + Sqr1X, 0.5 + Sqr1Y,  0.25,
    1.5 + Sqr1X, 0.5 + Sqr1Y, -0.25,
    1.5 + Sqr1X, 1.0 + Sqr1Y,  0.25,
	1.5 + Sqr1X, 1.0 + Sqr1Y, -0.25,
    1.0 + Sqr1X,  0.5 + Sqr1Y,  0.25,
    1.0 + Sqr1X,  0.5 + Sqr1Y, -0.25,
    1.0 + Sqr1X,  1.0 + Sqr1Y,  0.25,
	1.0 + Sqr1X,  1.0 + Sqr1Y, -0.25
  ]);
  
  Sqr1XL = 1.0 + Sqr1X;
  Sqr1XR = 1.5 + Sqr1X;
  Sqr1XT = 1.0 + Sqr1Y;
  Sqr1XB = 0.5 + Sqr1Y;

  // Colors
  var colors = new Float32Array([
    0.0, 0.6, 0.0,  0.0, 0.0, 0.0,   0.0, 0.0, 0.0,   0.0, 0.0, 0.0,
	0.0, 0.6, 0.0,    0.0, 0.0, 0.0,    0.0, 0.0, 0.0,   0.0, 0.0, 0.0
  ]);

  // Indices of the vertices
  var indices = new Uint8Array([
  	1, 3, 7,
	7, 5, 1,
    2, 3, 1, 
    1, 0, 2, 
    7, 3, 2, 
    6, 7, 2, 
    5, 7, 6, 
    6, 4, 5, 
	6, 2, 0, 
	0, 4, 6, 
	5, 1, 0, 
	0, 4, 5 ]);

  var o = new Object(); // Utilize Object object to return multiple buffer objects together

  // Write vertex information to buffer object
  o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
  o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
  o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
  if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null; 

  o.numIndices = indices.length;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return o;
}

function initVertexBuffersForSquareOtherX(gl) {
  // Create a plane
  //  v1------v0
  //  |        | 
  //  |        |
  //  |        |
  //  v2------v3

  // Vertex coordinates
  var vertices = new Float32Array([
    1.5 + Sqr2X, 0.5 + Sqr2Y,  0.25,
    1.5 + Sqr2X, 0.5 + Sqr2Y, -0.25,
    1.5 + Sqr2X, 1.0 + Sqr2Y,  0.25,
	1.5 + Sqr2X, 1.0 + Sqr2Y, -0.25,
    1.0 + Sqr2X,  0.5 + Sqr2Y,  0.25,
    1.0 + Sqr2X,  0.5 + Sqr2Y, -0.25,
    1.0 + Sqr2X,  1.0 + Sqr2Y,  0.25,
	1.0 + Sqr2X,  1.0 + Sqr2Y, -0.25
  ]);
  
  Sqr2XL = 1.0 + Sqr2X;
  Sqr2XR = 1.5 + Sqr2X;
  Sqr2XT = 1.0 + Sqr2Y;
  Sqr2XB = 0.5 + Sqr2Y;

  // Colors
  var colors = new Float32Array([
    0.0, 0.6, 0.0,  0.0, 0.0, 0.0,   0.0, 0.0, 0.0,   0.0, 0.0, 0.0,
	0.0, 0.6, 0.0,    0.0, 0.0, 0.0,    0.0, 0.0, 0.0,   0.0, 0.0, 0.0
  ]);

  // Indices of the vertices
  var indices = new Uint8Array([
  	1, 3, 7,
	7, 5, 1,
    2, 3, 1, 
    1, 0, 2, 
    7, 3, 2, 
    6, 7, 2, 
    5, 7, 6, 
    6, 4, 5, 
	6, 2, 0, 
	0, 4, 6, 
	5, 1, 0, 
	0, 4, 5 ]);

  var o = new Object(); // Utilize Object object to return multiple buffer objects together

  // Write vertex information to buffer object
  o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
  o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
  o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
  if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null; 

  o.numIndices = indices.length;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return o;
}

function initVertexBuffersForSquareY(gl) {
  // Create a plane
  //  v1------v0
  //  |        | 
  //  |        |
  //  |        |
  //  v2------v3

  // Vertex coordinates
  var vertices = new Float32Array([
    1.5 + Sqr3X, 0.5 + Sqr3Y,  0.25,
    1.5 + Sqr3X, 0.5 + Sqr3Y, -0.25,
    1.5 + Sqr3X, 1.0 + Sqr3Y,  0.25,
	1.5 + Sqr3X, 1.0 + Sqr3Y, -0.25,
    1.0 + Sqr3X,  0.5 + Sqr3Y,  0.25,
    1.0 + Sqr3X,  0.5 + Sqr3Y, -0.25,
    1.0 + Sqr3X,  1.0 + Sqr3Y,  0.25,
	1.0 + Sqr3X,  1.0 + Sqr3Y, -0.25
  ]);
  
  Sqr3XL = 1.0 + Sqr3X;
  Sqr3XR = 1.5 + Sqr3X;
  Sqr3XT = 1.0 + Sqr3Y;
  Sqr3XB = 0.5 + Sqr3Y;

  // Colors
  var colors = new Float32Array([
    0.0, 0.6, 0.0,  0.0, 0.0, 0.0,   0.0, 0.0, 0.0,   0.0, 0.0, 0.0,
	0.0, 0.6, 0.0,    0.0, 0.0, 0.0,    0.0, 0.0, 0.0,   0.0, 0.0, 0.0
  ]);

  // Indices of the vertices
  var indices = new Uint8Array([
  	1, 3, 7,
	7, 5, 1,
    2, 3, 1, 
    1, 0, 2, 
    7, 3, 2, 
    6, 7, 2, 
    5, 7, 6, 
    6, 4, 5, 
	6, 2, 0, 
	0, 4, 6, 
	5, 1, 0, 
	0, 4, 5 ]);

  var o = new Object(); // Utilize Object object to return multiple buffer objects together

  // Write vertex information to buffer object
  o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
  o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
  o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
  if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null; 

  o.numIndices = indices.length;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return o;
}

function initVertexBuffersForSquareOtherY(gl) {
  // Create a plane
  //  v1------v0
  //  |        | 
  //  |        |
  //  |        |
  //  v2------v3

  // Vertex coordinates
  var vertices = new Float32Array([
    1.5 + Sqr4X, 0.5 + Sqr4Y,  0.25,
    1.5 + Sqr4X, 0.5 + Sqr4Y, -0.25,
    1.5 + Sqr4X, 1.0 + Sqr4Y,  0.25,
	1.5 + Sqr4X, 1.0 + Sqr4Y, -0.25,
    1.0 + Sqr4X,  0.5 + Sqr4Y,  0.25,
    1.0 + Sqr4X,  0.5 + Sqr4Y, -0.25,
    1.0 + Sqr4X,  1.0 + Sqr4Y,  0.25,
	1.0 + Sqr4X,  1.0 + Sqr4Y, -0.25
  ]);
  
  Sqr4XL = 1.0 + Sqr4X;
  Sqr4XR = 1.5 + Sqr4X;
  Sqr4XT = 1.0 + Sqr4Y;
  Sqr4XB = 0.5 + Sqr4Y;

  // Colors
  var colors = new Float32Array([
    0.0, 0.6, 0.0,  0.0, 0.0, 0.0,   0.0, 0.0, 0.0,   0.0, 0.0, 0.0,
	0.0, 0.6, 0.0,    0.0, 0.0, 0.0,    0.0, 0.0, 0.0,   0.0, 0.0, 0.0
  ]);

  // Indices of the vertices
  var indices = new Uint8Array([
  	1, 3, 7,
	7, 5, 1,
    2, 3, 1, 
    1, 0, 2, 
    7, 3, 2, 
    6, 7, 2, 
    5, 7, 6, 
    6, 4, 5, 
	6, 2, 0, 
	0, 4, 6, 
	5, 1, 0, 
	0, 4, 5 ]);

  var o = new Object(); // Utilize Object object to return multiple buffer objects together

  // Write vertex information to buffer object
  o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
  o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
  o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
  if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null; 

  o.numIndices = indices.length;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return o;
}

function initVertexBuffersForTriangle(gl) {
  // Create a triangle
  //       v2
  //      / | 
  //     /  |
  //    /   |
  //  v0----v1

  // Vertex coordinates
  var vertices = new Float32Array(
  [0.0 + CharX, -1.0 + CharY, 0.0 + CharZ,  
  -0.5 + CharX, 0.0 + CharY, 0.0 + CharZ,  
  0.0 + CharX, 1.0 + CharY, 0.0 + CharZ,	
  0.5 + CharX, 0.0 + CharY, 0.0 + CharZ,	
  0.0 + CharX, 0.0 + CharY, -0.5 + CharZ,	
  0.0 + CharX, 0.0 + CharY, 0.5 + CharZ]);
  
  CharL = -0.5 + CharX;
  CharR =  0.5 + CharX;
  CharT =  1.0 + CharY;
  CharB = -1.0 + CharY;
  
  // Colors
  var colors = new Float32Array([0.7, 0.2, 0.2,  0.7, 0.2, 0.0,  0.7, 0.2, 0.2,  0.7, 0.2, 0.0,  0.7, 0.2, 0.0,  0.2, 0.2, 0.9]);    
  // Indices of the vertices
  var indices = new Uint8Array([5, 1, 0, 5, 2, 1, 1, 4, 2,  1, 0, 4,  4, 0, 3, 4, 3, 2, 3, 5, 2, 3, 0, 5]);

  var o = new Object();  // Utilize Object object to return multiple buffer objects together

  // Write vertex information to buffer object
  o.vertexBuffer = initArrayBufferForLaterUse(gl, vertices, 3, gl.FLOAT);
  o.colorBuffer = initArrayBufferForLaterUse(gl, colors, 3, gl.FLOAT);
  o.indexBuffer = initElementArrayBufferForLaterUse(gl, indices, gl.UNSIGNED_BYTE);
  if (!o.vertexBuffer || !o.colorBuffer || !o.indexBuffer) return null; 

  o.numIndices = indices.length;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return o;
}

function initArrayBufferForLaterUse(gl, data, num, type) {
  // Create a buffer object
  var buffer = gl.createBuffer();
  if (!buffer) {
    console.log('Failed to create the buffer object');
    return null;
  }
  // Write date into the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  // Store the necessary information to assign the object to the attribute variable later
  buffer.num = num;
  buffer.type = type;

  return buffer;
}

function initElementArrayBufferForLaterUse(gl, data, type) {
  // Create a buffer object
  var buffer = gl.createBuffer();
  if (!buffer) {
    console.log('Failed to create the buffer object');
    return null;
  }
  // Write date into the buffer object
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);

  buffer.type = type;

  return buffer;
}

function initFramebufferObject(gl) {
  var framebuffer, texture, depthBuffer;

  // Define the error handling function
  var error = function() {
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    if (texture) gl.deleteTexture(texture);
    if (depthBuffer) gl.deleteRenderbuffer(depthBuffer);
    return null;
  }

  // Create a framebuffer object (FBO)
  framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    console.log('Failed to create frame buffer object');
    return error();
  }

  // Create a texture object and set its size and parameters
  texture = gl.createTexture(); // Create a texture object
  if (!texture) {
    console.log('Failed to create texture object');
    return error();
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  // Create a renderbuffer object and Set its size and parameters
  depthBuffer = gl.createRenderbuffer(); // Create a renderbuffer object
  if (!depthBuffer) {
    console.log('Failed to create renderbuffer object');
    return error();
  }
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);

  // Attach the texture and the renderbuffer object to the FBO
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

  // Check if FBO is configured correctly
  var e = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (gl.FRAMEBUFFER_COMPLETE !== e) {
    console.log('Frame buffer object is incomplete: ' + e.toString());
    return error();
  }

  framebuffer.texture = texture; // keep the required object

  // Unbind the buffer object
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  return framebuffer;
}

var ANGLE_STEP = 40;   // The increments of rotation angle (degrees)

var last = Date.now(); // Last time that this function was called
function animate(angle) {
  var now = Date.now();   // Calculate the elapsed time
  var elapsed = now - last;
  last = now;
  // Update the current rotation angle (adjusted by the elapsed time)
  var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
  return newAngle % 360;
}

var currentlyPressedKeys = {};

function handleKeyDown(event) {
	
    currentlyPressedKeys[event.keyCode] = true;

    if (String.fromCharCode(event.keyCode) == "W" && CharY <= 5) 
	{	
	  	CharY += .8;	
    }
	else if (String.fromCharCode(event.keyCode) == "D" && CharX <= 6)
	{
		CharX += .8;
	}
	else if (String.fromCharCode(event.keyCode) == "A" && CharX >= -6)
	{
		CharX -= .8;
	}
	else if (String.fromCharCode(event.keyCode) == "S" && CharY >= -5)
	{
		CharY -= .8;
	}
	 
}

function squareOne()
{
	Sqr1X -= .1;
	
	if(Sqr1X <= -9)
	{
		Sqr1X = 7;
		Sqr1Y = getRandomInt() * 5;	
	}
	
}

function squareTwo()
{
	Sqr2X -= .1;
	
	if(Sqr2X <= -7)
	{
		Sqr2X = 7;
		Sqr2Y = getRandomInt() * -5;	
	}
	
}

function squareThree()
{
	Sqr3Y -= .1;
	
	if(Sqr3Y <= -7)
	{
		Sqr3Y = 7;
		Sqr3X = getRandomInt() * -5;	
	}
	
}

function squareFour()
{
	Sqr4Y -= .1;
	
	if(Sqr4Y <= -7)
	{
		Sqr4Y = 7;
		Sqr4X = getRandomInt() * 5;	
	}
	
}

function handleKeyUp(event) {
    currentlyPressedKeys[event.keyCode] = false;
}

function restart() {
	location.reload(true);
}

function winLossCheck()
{
	
	if((CharR > Sqr1XL && CharR < Sqr1XR && CharT > Sqr1XB && CharB < Sqr1XT) || (CharL > Sqr1XR && CharL < Sqr1XL &&  CharT > Sqr1XB && CharB < Sqr1XT)
	||(CharT > Sqr1XB && CharT < Sqr1XT && CharR > Sqr1XL && CharL < Sqr1XR) || (CharB < Sqr1XT && CharB > Sqr1XB && CharR > Sqr1XL && CharL < Sqr1XR))
	{
		restart();
	}
	
	if((CharR > Sqr2XL && CharR < Sqr2XR && CharT > Sqr2XB && CharB < Sqr2XT) || (CharL > Sqr2XR && CharL < Sqr2XL &&  CharT > Sqr2XB && CharB < Sqr2XT)
	||(CharT > Sqr2XB && CharT < Sqr2XT && CharR > Sqr2XL && CharL < Sqr2XR) || (CharB < Sqr2XT && CharB > Sqr2XB && CharR > Sqr2XL && CharL < Sqr2XR))
	{
		restart();
	}
	
	if((CharR > Sqr3XL && CharR < Sqr3XR && CharT > Sqr3XB && CharB < Sqr3XT) || (CharL > Sqr3XR && CharL < Sqr3XL &&  CharT > Sqr3XB && CharB < Sqr3XT)
	||(CharT > Sqr3XB && CharT < Sqr3XT && CharR > Sqr3XL && CharL < Sqr3XR) || (CharB < Sqr3XT && CharB > Sqr3XB && CharR > Sqr3XL && CharL < Sqr3XR))
	{
		restart();
	}
	
	if((CharR > Sqr4XL && CharR < Sqr4XR && CharT > Sqr4XB && CharB < Sqr4XT) || (CharL > Sqr4XR && CharL < Sqr4XL &&  CharT > Sqr4XB && CharB < Sqr4XT)
	||(CharT > Sqr4XB && CharT < Sqr4XT && CharR > Sqr4XL && CharL < Sqr4XR) || (CharB < Sqr4XT && CharB > Sqr4XB && CharR > Sqr4XL && CharL < Sqr4XR))
	{
		restart();
	}
	
}

function getRandomInt() {
    return Math.random();
}
