import * as THREE from "three";
import { Meshlet } from "./Meshlet";

interface MeshletObject {
    meshlet: Meshlet;
    geometryId: number;
}

export class MeshletObject3D {
    public readonly mesh: THREE.BatchedMesh;
    private meshlets: {[key: string]: MeshletObject};

    constructor(maxGeometryCount: number, maxVertexCount: number, maxIndexCount: number) {
        console.log(maxGeometryCount)
        const material = new THREE.ShaderMaterial({
            vertexShader: `
            flat out int _gl_DrawID;
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                // gl_Position = vec4(gl_DrawID, 0, 0, 1);
                _gl_DrawID = gl_DrawID;
            }`,
            fragmentShader: `
            flat in int _gl_DrawID;
            
            float rand(float co) {
                return fract(sin((co + 1.0) * 12.9898) * 43758.5453);
            }

			void main() {
                float id = float(_gl_DrawID);
                float r = rand(id * 11.212);
                float g = rand(id * 21.212);
                float b = rand(id * 31.212);
				gl_FragColor = vec4(r, g, b, 1.0);
			}
            `,
        });
        material.extensions.multiDraw = true;
        this.mesh = new THREE.BatchedMesh(maxGeometryCount, maxVertexCount, maxIndexCount, material);
        this.mesh.sortObjects = false;
        this.meshlets = {};

        material.onBeforeCompile = (p) => {
            console.log(p)
        }
    }

    public addMeshlet(meshlet: Meshlet) {
        if (this.meshlets[meshlet.id]) {
            console.warn(`Meshlet with id ${meshlet.id} already added`);
            return;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(meshlet.vertices_raw, 3));
        geometry.setIndex(new THREE.Uint16BufferAttribute(meshlet.indices_raw, 1));

        const geometryId = this.mesh.addGeometry(geometry);
        this.meshlets[meshlet.id] = {meshlet: meshlet, geometryId: geometryId};
    }

    public setVisible(meshletId: number, enabled: boolean) {
        if (!this.meshlets[meshletId]) {
            console.warn(`Meshlet with id ${meshletId} not added.`);
            return;
        }

        this.mesh.setVisibleAt(this.meshlets[meshletId].geometryId, enabled);
    }
}