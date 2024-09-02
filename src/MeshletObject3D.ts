import { Stat } from "./BetterStats";
import { Meshlet, Vertex } from "./Meshlet";

import * as THREE from "three";

interface ProcessedMeshlet {
    meshletId: number;
    vertexOffset: number;
    vertexCount: number;
}

interface NonIndexedMeshlet {
    meshlet: Meshlet;
    vertices: Float32Array;
}

export class MeshletObject3D {
    private static VERTICES_TEXTURE_SIZE = 1024;

    private meshlets: Meshlet[];

    private meshletsProcessed: Map<Meshlet, ProcessedMeshlet>;
    
    private instancedGeometry: THREE.InstancedBufferGeometry;
    private indicesAttribute: THREE.Uint16BufferAttribute;
    private localPositionAttribute: THREE.Float32BufferAttribute;

    public readonly mesh: THREE.Mesh;

    
    private rootMeshlet: Meshlet;
    private meshletMatrices: THREE.Matrix4[];

    private lodStat: Stat;
    private tempMatrix: THREE.Matrix4;

    constructor(meshlets: Meshlet[], stat: Stat) {
        this.meshlets = meshlets;
        this.meshletMatrices = [];
        this.lodStat = stat;
        this.tempMatrix = new THREE.Matrix4();

        // Get root meshlet
        let meshletsPerLOD: Meshlet[][] = [];

        for (let meshlet of this.meshlets) {
            if (!meshletsPerLOD[meshlet.lod]) meshletsPerLOD[meshlet.lod] = [];

            meshletsPerLOD[meshlet.lod].push(meshlet);
        }
        
        for (let meshlets of meshletsPerLOD) {
            if (meshlets.length === 1) {
                this.rootMeshlet = meshlets[0];
                break;
            }
        }


        let nonIndexedMeshlets: NonIndexedMeshlet[] = [];
        for (let meshlet of this.meshlets) {
            nonIndexedMeshlets.push(this.meshletToNonIndexedVertices(meshlet));
        }

        this.meshletsProcessed = new Map();
        let currentVertexOffset = 0;
        for (let nonIndexedMeshlet of nonIndexedMeshlets) {
            this.meshletsProcessed.set(nonIndexedMeshlet.meshlet, {
                meshletId: nonIndexedMeshlet.meshlet.id,
                vertexOffset: currentVertexOffset, 
                vertexCount: nonIndexedMeshlet.vertices.length
            });
            currentVertexOffset += nonIndexedMeshlet.vertices.length;
        }

        const vertexTexture = this.createVerticesTexture(nonIndexedMeshlets);

        this.instancedGeometry = new THREE.InstancedBufferGeometry();
        this.instancedGeometry.instanceCount = 0;

        const positionAttribute = new THREE.InstancedBufferAttribute(new Float32Array(1152), 3);
        this.instancedGeometry.setAttribute('position', positionAttribute);

        this.localPositionAttribute = new THREE.InstancedBufferAttribute(new Float32Array(meshlets.length * 3), 3);
        this.instancedGeometry.setAttribute('localPosition', this.localPositionAttribute);
        this.localPositionAttribute.usage = THREE.StaticDrawUsage;

        this.indicesAttribute = new THREE.InstancedBufferAttribute(new Float32Array(meshlets.length), 1);
        this.instancedGeometry.setAttribute('index', this.indicesAttribute);
        this.indicesAttribute.usage = THREE.StaticDrawUsage;


        const material = new THREE.ShaderMaterial({
            vertexShader: `
                uniform sampler2D vertexTexture;
                uniform float verticesTextureSize;

                attribute vec3 localPosition;
                attribute float index;

                flat out int meshInstanceID;
                flat out int meshletInstanceID;
                flat out int vertexID;

                void main() {
                    float instanceID = float(gl_InstanceID);

                    float vid = mod(float(gl_VertexID), 384.0);
                    float i = float(index) + vid;
                    float x = mod(i, verticesTextureSize);
                    float y = floor(i / verticesTextureSize);
                    vec3 pos = texelFetch(vertexTexture, ivec2(x, y), 0).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos + localPosition, 1.0);

                    meshInstanceID = gl_InstanceID;
                    meshletInstanceID = int(index);
                    vertexID = int(vid);
                }
            `,
            fragmentShader: `
                flat in int meshletInstanceID;

                vec3 hashColor(int seed) {
                    uint x = uint(seed);
                    x = ((x >> 16u) ^ x) * 0x45d9f3bu;
                    x = ((x >> 16u) ^ x) * 0x45d9f3bu;
                    x = (x >> 16u) ^ x;
                    return vec3(
                        float((x & 0xFF0000u) >> 16u) / 255.0,
                        float((x & 0x00FF00u) >> 8u) / 255.0,
                        float(x & 0x0000FFu) / 255.0
                    );
                }

                void main() {
                    vec3 color = hashColor(meshletInstanceID);
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            uniforms: {
                vertexTexture: { value: vertexTexture },

                verticesTextureSize: {value: MeshletObject3D.VERTICES_TEXTURE_SIZE},
            },
            wireframe: false
        });

        this.mesh = new THREE.Mesh(this.instancedGeometry, material);
        this.mesh.frustumCulled = false;


        let renderer: THREE.WebGLRenderer | null = null;
        let camera: THREE.Camera | null = null;
        this.mesh.onBeforeRender = (renderer, scene, camera, geometry) => {
            const startTime = performance.now();
                
            this.render(renderer, camera);
            
            const elapsed = performance.now() - startTime;
            this.lodStat.value = `${elapsed.toFixed(3)}ms`;
        }
    }

    private projectErrorToScreen(center: Vertex, radius: number, screenHeight: number): number {
        if (radius === Infinity) return radius;

        const testFOV = Math.PI * 0.5;
        const cotHalfFov = 1.0 / Math.tan(testFOV / 2.0);
        const d2 = Vertex.dot(center, center);
        const r = radius;
        return screenHeight / 2.0 * cotHalfFov * r / Math.sqrt(d2 - r * r);
    }

    private sphereApplyMatrix4(center: Vertex, radius: number, matrix: THREE.Matrix4) {
        radius = radius * matrix.getMaxScaleOnAxis();
        return {center: Vertex.applyMatrix4(center, matrix.elements), radius: radius};
    }

    private isMeshletVisible(meshlet: Meshlet, meshletMatrixWorld: THREE.Matrix4, cameraMatrixWorld: THREE.Matrix4, screenHeight: number): boolean {
        // const completeProj = new THREE.Matrix4().multiplyMatrices(cameraMatrixWorld, meshletMatrixWorld);
        const completeProj = this.tempMatrix.multiplyMatrices(cameraMatrixWorld, meshletMatrixWorld);

        const projectedBounds = this.sphereApplyMatrix4(
            meshlet.boundingVolume.center, 
            Math.max(meshlet.clusterError, 10e-10),
            completeProj
        )

        const clusterError = this.projectErrorToScreen(projectedBounds.center, projectedBounds.radius, screenHeight);


        if (!meshlet.parentBoundingVolume) console.log(meshlet)

        const parentProjectedBounds = this.sphereApplyMatrix4(
            meshlet.parentBoundingVolume.center, 
            Math.max(meshlet.parentError, 10e-10),
            completeProj
        )

        const parentError = this.projectErrorToScreen(parentProjectedBounds.center, parentProjectedBounds.radius, screenHeight);

        const errorThreshold = 0.1;
        const visible = clusterError <= errorThreshold && parentError > errorThreshold;

        return visible;
    }

    private traverseMeshlets(meshlet: Meshlet, fn: (meshlet: Meshlet) => boolean, visited: {[key: string]: boolean} = {}) {
        if (visited[meshlet.id] === true) return;

        visited[meshlet.id] = true;
        const shouldContinue = fn(meshlet);
        if (!shouldContinue) return;

        for (let child of meshlet.parents) {
            this.traverseMeshlets(child, fn, visited);
        }
    }

    private render(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {

        const screenHeight = renderer.domElement.height;
        camera.updateMatrixWorld();
        const cameraMatrixWorld = camera.matrixWorldInverse;


        let checks = 0;
        let i = 0;
        let j = 0;
        for (let meshletMatrix of this.meshletMatrices) {
            this.traverseMeshlets(this.rootMeshlet, meshlet => {
                const isVisible = this.isMeshletVisible(meshlet, meshletMatrix, cameraMatrixWorld, screenHeight);
                if (isVisible) {
                    const processedMeshlet = this.meshletsProcessed.get(meshlet);
                    if (!processedMeshlet) throw Error("WHHATTT");

                    this.indicesAttribute.array[i] = processedMeshlet.vertexOffset / 3;
                    
                    this.localPositionAttribute.array[j + 0] = meshletMatrix.elements[12];
                    this.localPositionAttribute.array[j + 1] = meshletMatrix.elements[13];
                    this.localPositionAttribute.array[j + 2] = meshletMatrix.elements[14];

                    i++;
                    j+=3;
                }

                checks++;
    
                return !isVisible;
            })
        }

        this.indicesAttribute.needsUpdate = true;
        this.localPositionAttribute.needsUpdate = true;
        this.instancedGeometry.instanceCount = i;

        // console.log("checks", checks)
    }

    private meshletToNonIndexedVertices(meshlet: Meshlet): NonIndexedMeshlet {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(meshlet.vertices_raw, 3));
        g.setIndex(new THREE.Uint32BufferAttribute(meshlet.indices_raw, 1));
        const nonIndexed = g.toNonIndexed();
        const v = new Float32Array(1152);
        v.set(nonIndexed.getAttribute("position").array, 0);

        return {
            meshlet: meshlet,
            vertices: v
        }
    }

    private createVerticesTexture(meshlets: NonIndexedMeshlet[]): THREE.DataTexture {
        let vertices: number[] = [];

        for (let meshlet of meshlets) {
            const v = new Float32Array(1152);
            v.set(meshlet.vertices, 0);
            vertices.push(...v);
        }
        let verticesPacked: number[][] = [];
        for (let i = 0; i < vertices.length; i+=3) {
            verticesPacked.push([vertices[i + 0], vertices[i + 1], vertices[i + 2], 0]);
        }

        const size = MeshletObject3D.VERTICES_TEXTURE_SIZE;
        const buffer = new Float32Array(size * size * 4);

        buffer.set(verticesPacked.flat(), 0);
        const texture = new THREE.DataTexture(
            buffer,
            size, size,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        texture.needsUpdate = true;
        texture.generateMipmaps = false;

        return texture;
    }

    public addMeshletAtPosition(position: THREE.Vector3) {
        const tempMesh = new THREE.Object3D();

        tempMesh.position.copy(position);
        tempMesh.updateMatrixWorld();
        this.meshletMatrices.push(tempMesh.matrixWorld.clone());



        this.localPositionAttribute = new THREE.InstancedBufferAttribute(new Float32Array(this.meshlets.length * this.meshletMatrices.length * 3), 3);
        this.instancedGeometry.setAttribute('localPosition', this.localPositionAttribute);
        this.localPositionAttribute.usage = THREE.StaticDrawUsage;

        this.indicesAttribute = new THREE.InstancedBufferAttribute(new Float32Array(this.meshlets.length * this.meshletMatrices.length), 1);
        this.instancedGeometry.setAttribute('index', this.indicesAttribute);
        this.indicesAttribute.usage = THREE.StaticDrawUsage;
    }
}
