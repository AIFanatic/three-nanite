import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { BetterStats } from "./BetterStats";

import { SimplifyModifierV4 } from "./SimplifyModifierV4";
import { MeshletGrouper } from "./MeshletGrouper";
import { OBJLoaderIndexed } from "./OBJLoaderIndexed";
import { MeshletCreator } from "./MeshletCreator";
import { MeshletMerger } from "./MeshletMerger";
import { METISWrapper } from "./METISWrapper";

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

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas});
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(32, this.canvas.width / this.canvas.height, 0.01, 10000);
        this.camera.position.z = 1;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.stats = new BetterStats(this.renderer);
        document.body.appendChild(this.stats.domElement);

        this.render();
    }

    // Helpers
    private static rand(co: number) {
        function fract(n) {
            return n % 1;
        }

        function dot(v1: number[], v2: number[]) {
            return v1[0] * v2[0] + v1[1] * v2[1];
        }

        return fract(Math.sin((co + 1) * 12.9898) * 43758.5453);
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

    private showMeshlets(meshlets: Meshlet[], position: number[]) {
        for (let i = 0; i < meshlets.length; i++) {
            const meshlet_color = App.rand(i) * 0xffffff;
            this.createMesh(meshlets[i].vertices, meshlets[i].indices, {color: meshlet_color, position: position});
        }
    }

    public async processObj(objURL: string) {
        OBJLoaderIndexed.load(objURL, async (objMesh) => {
            const objVertices = objMesh.vertices;
            const objIndices = objMesh.indices;

            // Original mesh
            this.createMesh(objVertices, objIndices, {opacity: 0.2, position: [-0.3, 0, 0]});


            async function step1_cluster(vertices: Float32Array, indices: Uint32Array): Promise<Meshlet[]> {
                return await MeshletCreator.build(vertices, indices);
            }

            async function step2_group(meshlets: Meshlet[]): Promise<Meshlet[][]> {
                // Add meshlets to grouper, this allows for border checks
                const meshletGrouper = new MeshletGrouper();
                for (let i = 0; i < meshlets.length; i++) {
                    meshletGrouper.addMeshlet(meshlets[i]);
                }

                // Get adjacent meshlets by checking shared vertices
                const adjacencyList = meshletGrouper.buildAdjacentMeshletList(meshlets);

                let adjacencyListArray: number[][] = [];
                for (let entry of adjacencyList) {
                    adjacencyListArray.push(entry[1]);
                }

                // Use metis to partition the meshlets into groups
                const groupPartitions = await METISWrapper.partition(adjacencyListArray);
                // Aggregate
                const grouppedMeshlets: Meshlet[][] = [];
                for (let i = 0; i < groupPartitions.length; i++) {
                    const group = groupPartitions[i];
                    const groupMeshlets: Meshlet[] = [];

                    for (let j = 0; j < group.length; j++) {
                        const meshletId = group[j];
                        const meshlet = meshlets[meshletId];
                        groupMeshlets.push(meshlet);
                    }
                    grouppedMeshlets.push(groupMeshlets);
                }
                return grouppedMeshlets;
            }

            // groups = metis output
            async function step3_merge(groups: Meshlet[][]): Promise<Meshlet[]> {
                const grouppedMeshlets: Meshlet[] = [];
                for (let i = 0; i < groups.length; i++) {
                    const groupMeshlets = groups[i];
                    const mergedMeshlets = MeshletMerger.merge(groupMeshlets);
                    grouppedMeshlets.push(mergedMeshlets);
                }

                return grouppedMeshlets;
            }

            async function step4_simplify(meshlets: Meshlet[]): Promise<Meshlet[]> {
                let simplifiedMeshletGroup: Meshlet[] = [];

                for (let i = 0; i < meshlets.length; i++) {
                    const grouppedMeshlet = meshlets[i];
                    const simplifiedGroup = await SimplifyModifierV4.simplify(grouppedMeshlet, 0.5);
                    simplifiedMeshletGroup.push(simplifiedGroup);
                };
                return simplifiedMeshletGroup;
            }

            async function step5_split(meshlets: Meshlet[]): Promise<Meshlet[][]> {
                // Same as step1
                let clusterizedMeshlets: Meshlet[][] = [];
                for (let i = 0; i < meshlets.length; i++) {
                    const meshlet = meshlets[i];
                    const clusterizedMeshlet = await step1_cluster(meshlet.vertices, meshlet.indices);
                    clusterizedMeshlets.push(clusterizedMeshlet);
                }

                return clusterizedMeshlets;
            }

            const clusterizedMeshlets = await step1_cluster(objVertices, objIndices);
            this.showMeshlets(clusterizedMeshlets, [-0.15, 0, 0]);


            const grouppedMeshlets = await step2_group(clusterizedMeshlets);
            // Show groupped meshlets, note that they are not merged yet
            for (let i = 0; i < grouppedMeshlets.length; i++) {
                const meshlet_color = App.rand(i) * 0xffffff;

                for (let j = 0; j < grouppedMeshlets[i].length; j++) {
                    const meshlet = grouppedMeshlets[i][j];
                    this.createMesh(meshlet.vertices, meshlet.indices, {color: meshlet_color});
                }
            }

            const mergedMeshlets = await step3_merge(grouppedMeshlets);
            this.showMeshlets(mergedMeshlets, [0.15, 0, 0]);

            const simplifiedMeshlets = await step4_simplify(mergedMeshlets);
            this.showMeshlets(simplifiedMeshlets, [0.3, 0, 0]);

            const splitMeshlets = await step5_split(simplifiedMeshlets);

            // Show split meshlets, note that they are not merged yet
            for (let i = 0; i < splitMeshlets.length; i++) {
                
                for (let j = 0; j < splitMeshlets[i].length; j++) {
                    const meshlet_color = App.rand(i + j) * 0xffffff;
                    const meshlet = splitMeshlets[i][j];
                    this.createMesh(meshlet.vertices, meshlet.indices, {color: meshlet_color, position: [0.45, 0, 0]});
                }
            }
        })
    }

    private render() {

        this.stats.update();

        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(() => { this.render() });
    }
}