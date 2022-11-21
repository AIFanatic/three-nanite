varying vec2 vUV;

varying vec4 vWorldPosition;
varying vec3 vNormal;
varying vec4 vTexCoords;

void main() {
    vUV = uv;
    
    vNormal = mat3(modelMatrix) * normal;
    vWorldPosition = modelMatrix * vec4(position, 1.0);
    vTexCoords = projectionMatrix * viewMatrix * vWorldPosition;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}