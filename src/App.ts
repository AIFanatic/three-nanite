import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

import { BetterStats } from "./BetterStats";



import { MeshletBuilder, MeshoptMeshlet } from "./utils/MeshletBuilder";

import { SimplifyModifierV4 } from "./SimplifyModifierV4";
import { MeshletGrouper } from "./MeshletGrouper";
import { OBJLoaderIndexed } from "./OBJLoaderIndexed";
import { _Magic_Rd, Face, Vertex } from "./magic";
import { MeshletUtils } from "./MeshletEdgeFinder";
import { mergeBufferGeometries, mergeVertices, toTrianglesDrawMode } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshletBuilder_wasm } from "./utils/MeshletBuilder_wasm";
import { MeshletCreator } from "./MeshletCreator";

export interface Meshlet {
    vertices: number[],
    indices: number[],
    vertex_count: number,
    index_count: number,
};

export class App {
    private canvas: HTMLCanvasElement;

    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private controls: OrbitControls;

    private stats: BetterStats;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas });
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(32, this.canvas.width / this.canvas.height, 0.01, 10000);
        this.camera.position.z = 1;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.stats = new BetterStats(this.renderer);
        document.body.appendChild(this.stats.domElement);

        this.render();
    }

    // Helpers
    private static rand(co: number[]) {
        function fract(n) {
            return n % 1;
        }

        function dot(v1: number[], v2: number[]) {
            return v1[0] * v2[0] + v1[1] * v2[1];
        }

        return fract(Math.sin(dot(co, [12.9898, 78.233])) * 43758.5453);
    }

    private createSphere(radius, color, x, y, z) {
        let g = new THREE.SphereGeometry(radius);

        const m = new THREE.MeshBasicMaterial({
            wireframe: true,
            side: 0,
            color: color,
        });
        const mesh = new THREE.Mesh(g, m);
        mesh.position.set(x, y, z);

        this.scene.add(mesh);
    }

    private createMesh(vertices: ArrayLike<number>, indices: ArrayLike<number>, params: {color?: number, position?: number[], opacity?: number}) {
        let g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
        g.setIndex(new THREE.Uint16BufferAttribute(indices, 1));

        const m = new THREE.MeshBasicMaterial({
            wireframe: true,
            side: 0,
            color: params.color ? params.color : 0xffffff,
            transparent: params.opacity ? true : false,
            opacity: params.opacity ? params.opacity : 0.0
        });
        const mesh = new THREE.Mesh(g, m);
        if (params.position) {
            mesh.position.set(params.position[0], params.position[1], params.position[2]);
        }
        this.scene.add(mesh);
    }

    public async processObj(objURL: string) {
        const objLoader = new OBJLoader();
        OBJLoaderIndexed.load(objURL, async (objMesh) => {
            const objVertices = objMesh.vertices;
            const objIndices = objMesh.indices;

            // Original mesh
            this.createMesh(objVertices, objIndices, {opacity: 0.2, position: [-0.3, 0, 0]});




            // Clusterize - Cluster == Meshlet (in nanite paper)
            const meshlets = await MeshletCreator.build(objVertices, objIndices);

            for (let i = 0; i < meshlets.length; i++) {
                const meshlet = meshlets[i];

                // Each meshlet
                const meshlet_color = App.rand([i + 1, 0]) * 0xffffff;
                this.createMesh(meshlet.vertices, meshlet.indices, {color: meshlet_color, position: [-0.15, 0, 0]});
            }

            // // Group
            // const meshletGrouper = new MeshletGrouper();
            // for (let i = 0; i < meshlets.length; i++) {
            //     const meshlet = meshlets[i];
            //     meshletGrouper.addMeshlet(meshlet);
            // }

            // const adjacencyList = meshletGrouper.buildAdjacentMeshletList(meshlets);
            // console.log(adjacencyList)

            // let t: number[][] = []
            // for (let a of adjacencyList) {
            //     t.push(a[1]);
            // }
            // console.log(t);
            // return;


            // Test graph-paritioning
            // Metis output
            let groups = [[10, 11, 12, 16], [14, 22, 27, 28], [2, 9, 13, 32], [7, 8, 20, 31], [0, 1, 4, 6], [17, 18, 19, 21], [35, 36, 37, 38], [3, 5, 15, 29], [23, 30, 33, 34], [24, 25, 26]];

            // Merge
            const grouppedMeshletGeometries: THREE.BufferGeometry[] = [];
            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];

                const groupMeshletGeometries: THREE.BufferGeometry[] = [];

                for (let j = 0; j < group.length; j++) {
                    const meshletId = group[j];
                    const meshlet = meshlets[meshletId];
                    console.log(group, meshletId, meshlet);

                    let g = new THREE.BufferGeometry();
                    g.setAttribute("position", new THREE.Float32BufferAttribute(meshlet.vertices, 3));
                    g.setIndex(new THREE.Uint16BufferAttribute(meshlet.indices, 1));

                    groupMeshletGeometries.push(g);
                }

                // TODO: Get rid of threejs, isolate mergeBufferGeometries and
                // use vertices and indices directly
                const groupMeshlets = mergeBufferGeometries(groupMeshletGeometries);
                grouppedMeshletGeometries.push(groupMeshlets);
            }

            // Show grouped meshlets
            for (let i = 0; i < grouppedMeshletGeometries.length; i++) {
                const grouppedMeshletGeometry = grouppedMeshletGeometries[i];
                const vertices = grouppedMeshletGeometry.getAttribute("position").array;
                const indices = grouppedMeshletGeometry.getIndex().array;
                const meshlet_color = App.rand([i + 1, 0]) * 0xffffff;

                this.createMesh(vertices, indices, {color: meshlet_color});

            }

            // Simplify
            let simplifiedMeshletGroup: THREE.BufferGeometry[] = [];

            for (let i = 0; i < grouppedMeshletGeometries.length; i++) {
                const grouppedMeshletGeometry = grouppedMeshletGeometries[i];
                const meshlet_color = App.rand([i + 1, 0]) * 0xffffff;
                const m = new THREE.MeshBasicMaterial({
                    wireframe: true,
                    side: 0,
                    color: meshlet_color,
                });
                const inputMesh = new THREE.Mesh(grouppedMeshletGeometry, m);
                const simplifiedGeometry = await SimplifyModifierV4.simplify(inputMesh, 0.5) as THREE.Mesh;
                simplifiedMeshletGroup.push(simplifiedGeometry.geometry);

                const outputMesh = new THREE.Mesh(simplifiedGeometry.geometry, m);
                outputMesh.position.set(0.15, 0, 0);
                this.scene.add(outputMesh);
            };


            for (let i = 0; i < 1; i++) {
                const simplifiedGroup = simplifiedMeshletGroup[i];
                const geometry = mergeVertices(simplifiedGroup);
                console.log("simplifiedGroup", simplifiedGroup, geometry);
                const vertices = geometry.getAttribute("position").array;
                const indices = geometry.getIndex().array;
                const simplifiedGroupMeshlets = await MeshletCreator.build(vertices, indices);

                console.log(simplifiedGroupMeshlets)

                for (let j = 0; j < simplifiedGroupMeshlets.length; j++) {
                    const meshlet = simplifiedGroupMeshlets[j];
                    const meshlet_color = App.rand([j + 1, 0]) * 0xffffff;
                    this.createMesh(meshlet.vertices, meshlet.indices, {color: meshlet_color, position: [0.3, 0, 0]});
                }
            }



            // const gm: Meshlet = {
            //     vertices: groupMeshlet.getAttribute("position").array,
            //     vertex_count: groupMeshlet.getAttribute("position").array.length / 3,
            //     indices: groupMeshlet.getIndex().array,
            //     index_count: groupMeshlet.getIndex().array.length
            // }
            // const boundaryVertexIds = MeshletUtils.getBoundary(gm);
            // console.log("boundaryVertexIds.length", boundaryVertexIds.length);

            // for (let i = 0; i < boundaryVertexIds.length; i++) {
            //     const v = boundaryVertexIds[i];
            //     const x = vertices[v * 3 + 0];
            //     const y = vertices[v * 3 + 1];
            //     const z = vertices[v * 3 + 2];
            //     createSphere(0.001, "red", x, y, z);
            // }

            return;

            console.log(meshletGrouper)

            for (let i = 0; i < 1; i++) {
                const meshlet = meshlets[i];

                let g = new THREE.BufferGeometry();
                g.setAttribute("position", new THREE.Float32BufferAttribute(meshlet.vertices, 3));
                g.setIndex(new THREE.Uint16BufferAttribute(meshlet.indices, 1));

                const meshlet_color = App.rand([i + 1, 0]) * 0xffffff;
                const m = new THREE.MeshBasicMaterial({
                    wireframe: true,
                    side: 0,
                    color: meshlet_color,
                });
                const mesh = new THREE.Mesh(g, m);

                this.scene.add(mesh);
            }

            const borders = meshletGrouper.getBorderVertices(meshlets[0]);
            console.log(borders);

            const adjacentMeshlets = meshletGrouper.getAdjacentMeshlets(meshlets[0]);
            for (let i = 0; i < adjacentMeshlets.length; i++) {
                const meshlet = adjacentMeshlets[i];
                let g = new THREE.BufferGeometry();
                g.setAttribute("position", new THREE.Float32BufferAttribute(meshlet.vertices, 3));
                g.setIndex(new THREE.Uint16BufferAttribute(meshlet.indices, 1));

                const meshlet_color = App.rand([i + 1, 0]) * 0xffffff;
                const m = new THREE.MeshBasicMaterial({
                    wireframe: true,
                    side: 0,
                    color: meshlet_color,
                });
                const mesh = new THREE.Mesh(g, m);

                this.scene.add(mesh);
            }
            console.log(adjacentMeshlets);

            const g = new THREE.SphereGeometry(0.001);
            for (let i = 0; i < borders.length; i++) {
                const borderVertexId = borders[i];
                const x = meshlets[0].vertices[borderVertexId + 0];
                const y = meshlets[0].vertices[borderVertexId + 1];
                const z = meshlets[0].vertices[borderVertexId + 2];

                const m = new THREE.MeshBasicMaterial({
                    wireframe: true,
                    side: 0,
                    color: "red",
                });
                const mesh = new THREE.Mesh(g, m);
                mesh.position.set(x, y, z);

                this.scene.add(mesh);
            }
        })
    }

    private render() {

        this.stats.update();

        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(() => { this.render() });
    }
}