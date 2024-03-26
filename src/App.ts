import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { BetterStats } from "./BetterStats";

import { MeshletGrouper } from "./MeshletGrouper";
import { OBJLoaderIndexed } from "./OBJLoaderIndexed";
import { MeshletCreator } from "./MeshletCreator";
import { MeshletMerger } from "./MeshletMerger";
import { METISWrapper } from "./METISWrapper";

import { DAG } from "./DAG";
import { instance } from "@viz-js/viz";
import { MeshletSimplifier_wasm } from "./utils/MeshletSimplifier_wasm";
import { MeshletCleaner } from "./utils/MeshletCleaner";

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

    private createMesh(vertices: ArrayLike<number>, indices: ArrayLike<number>, params: { color?: number, position?: number[], opacity?: number, scale?: number[] }) {
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
        if (params.scale) {
            mesh.scale.set(params.scale[0], params.scale[1], params.scale[2]);
        }
        this.scene.add(mesh);
    }

    private showMeshlets(meshlets: Meshlet[], position: number[], scale?: number[]) {
        for (let i = 0; i < meshlets.length; i++) {
            const meshlet_color = App.rand(i) * 0xffffff;
            this.createMesh(meshlets[i].vertices, meshlets[i].indices, { color: meshlet_color, position: position, scale: scale });
        }
    }

    private createGeometryFromMeshlet(meshlet: Meshlet): THREE.BufferGeometry {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(meshlet.vertices, 3));
        g.setIndex(new THREE.Uint32BufferAttribute(meshlet.indices, 1));
        return g;
    }

    private createMeshletFromGeometry(geometry: THREE.BufferGeometry): Meshlet {
        return {
            vertices: geometry.getAttribute("position").array,
            vertex_count: geometry.getAttribute("position").array.length / 3,
            indices: geometry.getIndex().array,
            index_count: geometry.getIndex().array.length,
        }
    }

    public async processObj(objURL: string) {
        // const dag = new DAG();
        // dag.addEdge('A', 'B');
        // dag.addEdge('C', 'B');
        // dag.addEdge('B', 'D');
        // dag.addEdge('B', 'E');
        // dag.addEdge('D', 'F');
        // dag.addEdge('E', 'G');
        // dag.addEdge('D', 'G');
        // dag.addEdge('E', 'F');


        const dag4 = new DAG();

        // dag4.add({id: "A", tag: "LOD0", data: "ADATA"}, {id: "C", tag: "LOD1", data: "CDATA"});
        // dag4.add({id: "A", tag: "LOD0", data: "ADATA"}, {id: "C", tag: "LOD1", data: "CDATA"});

        // dag4.add({id: "A", tag: "LOD0", data: "ADATA"}, {id: "F", tag: "LOD2", data: "FDATA"});
        // dag4.add({id: "B", tag: "LOD0", data: "BDATA"}, {id: "D", tag: "LOD1", data: "DDATA"});
        // dag4.add({id: "B", tag: "LOD0", data: "BDATA"}, {id: "E", tag: "LOD1", data: "EDATA"});
        // dag4.add({id: "C", tag: "LOD1", data: "CDATA"}, {id: "F", tag: "LOD2", data: "FDATA"});
        // dag4.add({id: "D", tag: "LOD1", data: "DDATA"}, {id: "F", tag: "LOD2", data: "FDATA"});
        // dag4.add({id: "D", tag: "LOD1", data: "DDATA"}, {id: "G", tag: "LOD2", data: "GDATA"});
        // dag4.add({id: "E", tag: "LOD1", data: "EDATA"}, {id: "H", tag: "LOD2", data: "HDATA"});
        // dag4.add({id: "F", tag: "LOD2", data: "FDATA"}, {id: "I", tag: "LOD3", data: "IDATA"});
        // dag4.add({id: "G", tag: "LOD2", data: "GDATA"}, {id: "J", tag: "LOD3", data: "JDATA"});
        // dag4.add({id: "H", tag: "LOD2", data: "HDATA"}, {id: "J", tag: "LOD3", data: "JDATA"});

        // console.log("ewgweg", dag4);

        // const dag4Dot = dag4.toDot();

        // instance().then(viz => {
        //     document.body.appendChild(viz.renderSVGElement(dag4Dot));
        // });


        //         // return;
        OBJLoaderIndexed.load(objURL, async (objMesh) => {
            // // from three

            // const mg = this.createGeometryFromMeshlet(simplified);
            // const simplifyModifier =  new SimplifyModifier();
            // const out = simplifyModifier.modify(mg, 4);
            // console.log(mg)

            // const outMeshlet = this.createMeshletFromGeometry(out);
            // this.createMesh(outMeshlet.vertices, outMeshlet.indices, {position: [0.6, 0, 0], scale: [0.001, -0.001, 0.001], color: 0x00ff00});

            // return;
            const objVertices = objMesh.vertices;
            const objIndices = objMesh.indices;

            // Original mesh
            this.createMesh(objVertices, objIndices, { opacity: 0.2, position: [-0.3, 0, 0] });


            async function step1_cluster(vertices: Float32Array, indices: Uint32Array): Promise<Meshlet[]> {
                const meshlet_triangle_count = indices.length / 3 / 2;
                const max_triangles = meshlet_triangle_count > 128 ? 128 : meshlet_triangle_count;

                return await MeshletCreator.build(vertices, indices, max_triangles);
            }

            async function step2_group(meshlets: Meshlet[], nparts: number): Promise<Meshlet[][]> {
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
                const groupPartitions = await METISWrapper.partition(adjacencyListArray, nparts);
                console.log("adjacencyList", adjacencyList)
                console.log("groupPartitions", groupPartitions)

                // Aggregate
                const groupedMeshlets: Meshlet[][] = [];
                for (let i = 0; i < groupPartitions.length; i++) {
                    const group = groupPartitions[i];
                    const groupMeshlets: Meshlet[] = [];

                    for (let j = 0; j < group.length; j++) {
                        const meshletId = group[j];
                        const meshlet = meshlets[meshletId];
                        groupMeshlets.push(meshlet);
                    }
                    groupedMeshlets.push(groupMeshlets);
                }
                return groupedMeshlets;
            }

            // groups = metis output
            async function step3_merge(groups: Meshlet[][]): Promise<Meshlet[]> {
                const groupedMeshlets: Meshlet[] = [];
                for (let i = 0; i < groups.length; i++) {
                    const groupMeshlets = groups[i];
                    const mergedMeshlet = MeshletMerger.merge(groupMeshlets);
                    // Clean duplicate vertices left by threejs and adjust indices
                    const cleanedMeshlet = await MeshletCleaner.clean(mergedMeshlet);
                    groupedMeshlets.push(cleanedMeshlet);
                }

                return groupedMeshlets;
            }

            async function step4_simplify(meshlets: Meshlet[]): Promise<Meshlet[]> {
                let simplifiedMeshletGroup: Meshlet[] = [];

                for (let i = 0; i < meshlets.length; i++) {
                    const groupedMeshlet = meshlets[i];
                    const simplifiedGroup = await MeshletSimplifier_wasm.simplify(groupedMeshlet, groupedMeshlet.indices.length / 3 / 2);
                    // const simplifiedGroup = await SimplifyModifierV4.simplify(groupedMeshlet, 0.5);
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


            // // Test vertices
            // const positions = [
            //     165, 224, 0, // 0
            //     220, 190, 0, // 1
            //     240, 270, 0, // 2
            //     293, 260, 0, // 3
            //     279, 318, 0, // 4
            //     347, 287, 0, // 5
            //     346, 344, 0, // 6
            //     280, 407, 0, // 7
            //     213, 355, 0, // 8
            //     203, 427, 0, // 9
            //     277, 473, 0, // 10
            //     145, 404, 0, // 11
            //     165, 295, 0, // 12
            //     105, 324, 0, // 13
            // ];

            // const indices = [
            //     0, 1, 2,
            //     1, 3, 2,
            //     2, 3, 4,
            //     4, 3, 5,
            //     4, 5, 6,
            //     4, 6, 7,
            //     4, 7, 8,
            //     4, 8, 2,
            //     2, 8, 12,
            //     2, 12, 0,
            //     0, 12, 13,
            //     12, 11, 13,
            //     12, 8, 11,
            //     8, 9, 11,
            //     8, 7, 9,
            //     9, 7, 10
            // ]

            // this.createMesh(positions, indices, { color: 0xff0000, scale: [0.001, -0.001, 0.001] });

            // const meshlet: Meshlet = {
            //     vertices: positions,
            //     vertex_count: positions.length / 3,
            //     indices: indices,
            //     index_count: indices.length
            // }

            // const simplified = await MeshletSimplifier_wasm.simplify(meshlet, meshlet.indices.length / 3 / 2);
            // this.createMesh(simplified.vertices, simplified.indices, { position: [0.3, 0, 0], scale: [0.001, -0.001, 0.001], color: 0x0000ff });


            // const split = await step5_split([simplified]);

            // console.log(split)
            // this.showMeshlets(split[0], [0.6, 0, 0], [0.001, -0.001, 0.001]);
            // return;


            const testMeshes = [
                {
                    color: "red",
                    scale: [0.001, -0.001, 0.001],
                    positions: [
                        165, 224, 0, // 0 = 0
                        220, 190, 0, // 1 = 1
                        240, 270, 0, // 2 = 2
                        165, 295, 0, // 12 = 3
                        213, 355, 0, // 8 = 4
                        279, 318, 0, // 4 = 5
                    ],
                    indices: [
                        0, 1, 2,
                        0, 2, 3,
                        3, 2, 4,
                        4, 2, 5
                    ]
                },
                {
                    color: "green",
                    scale: [0.001, -0.001, 0.001],
                    positions: [
                        220, 190, 0, // 1 = 0
                        240, 270, 0, // 2 = 1
                        293, 260, 0, // 3 = 2
                        279, 318, 0, // 4 = 3
                        347, 287, 0, // 5 = 4
                        346, 344, 0, // 6 = 5

                    ],
                    indices: [
                        0, 2, 1,
                        1, 2, 3,
                        2, 4, 3,
                        3, 4, 5
                    ]
                },
                {
                    color: "blue",
                    scale: [0.001, -0.001, 0.001],
                    positions: [
                        279, 318, 0, // 4 = 0
                        346, 344, 0, // 6 = 1
                        280, 407, 0, // 7 = 2
                        213, 355, 0, // 8 = 3
                        203, 427, 0, // 9 = 4
                        277, 473, 0, // 10 = 5
                    ],
                    indices: [
                        0, 1, 2,
                        0, 2, 3,
                        3, 2, 4,
                        2, 5, 4
                    ]
                },
                {
                    color: "yellow",
                    scale: [0.001, -0.001, 0.001],
                    positions: [
                        165, 224, 0, // 0 = 0
                        165, 295, 0, // 12 = 1
                        105, 324, 0, // 13 = 2
                        213, 355, 0, // 8 = 3
                        145, 404, 0, // 11 = 4
                        203, 427, 0, // 9 = 5
                    ],
                    indices: [
                        0, 1, 2,
                        1, 4, 2,
                        4, 1, 3,
                        4, 3, 5
                    ]
                }
            ];

            for (let i = 0; i < testMeshes.length; i++) {
                const testMesh = testMeshes[i];
                this.createMesh(testMesh.positions, testMesh.indices, {color: testMesh.color, scale: testMesh.scale});
            }

            // Convert to meshlets
            let meshlets: Meshlet[] = [];
            for (let i = 0; i < testMeshes.length; i++) {
                const tm = testMeshes[i];
                meshlets.push({
                    vertices: tm.positions,
                    vertex_count: tm.positions.length / 3,
                    indices: tm.indices,
                    index_count: tm.indices.length,
                })
            }

            console.log("meshlets", meshlets)

            // this.showMeshlets(meshlets, [0,0,0], [0.001, -0.001, 0.001]);

            const groupedMeshlets = await step2_group(meshlets, 2);

            for (let i = 0; i < groupedMeshlets.length; i++) {
                const groupKey = `GROUP-${i}`;
                const group = groupedMeshlets[i];

                for (let j = 0; j < group.length; j++) {
                    const meshlet = group[j];
                    const meshletId = meshlets.indexOf(meshlet);
                    const meshletKey = `MESHLET-${j}`;

                    dag4.add(
                        {id: groupKey, data: "", tag: "LOD0"},
                        {id: meshletKey, data: meshlet, tag: "LOD0"}
                    )
                }
            }

            const mergedMeshlets = await step3_merge([meshlets]);
            this.showMeshlets(mergedMeshlets, [0.3, 0, 0], [0.001, -0.001, 0.001]);
            console.log("mergedMeshlets", mergedMeshlets);

            const simplifiedMeshlets = await step4_simplify(mergedMeshlets);
            this.showMeshlets(simplifiedMeshlets, [0.6, 0, 0], [0.001, -0.001, 0.001]);

            const split = await step5_split(simplifiedMeshlets);

            this.showMeshlets(split[0], [0.9, 0, 0], [0.001, -0.001, 0.001]);

            instance().then(viz => {
                document.body.appendChild(viz.renderSVGElement(dag4.toDot()));
            });







            // const clusterizedMeshlets = await step1_cluster(objVertices, objIndices);
            // this.showMeshlets(clusterizedMeshlets, [-0.15, 0, 0]);

            // console.log(clusterizedMeshlets)

            // const groupedMeshlets = await step2_group(clusterizedMeshlets);
            // // Show grouped meshlets, note that they are not merged yet
            // for (let i = 0; i < groupedMeshlets.length; i++) {
            //     const meshlet_color = App.rand(i) * 0xffffff;

            //     for (let j = 0; j < groupedMeshlets[i].length; j++) {
            //         const meshlet = groupedMeshlets[i][j];
            //         this.createMesh(meshlet.vertices, meshlet.indices, { color: meshlet_color });
            //     }
            // }

            // const mergedMeshlets = await step3_merge(groupedMeshlets);
            // this.showMeshlets(mergedMeshlets, [0.15, 0, 0]);

            // const simplifiedMeshlets = await step4_simplify(mergedMeshlets);
            // this.showMeshlets(simplifiedMeshlets, [0.3, 0, 0]);

            // const splitMeshlets = await step5_split(simplifiedMeshlets);

            // // Show split meshlets, note that they are not merged yet
            // for (let i = 0; i < splitMeshlets.length; i++) {

            //     for (let j = 0; j < splitMeshlets[i].length; j++) {
            //         const meshlet_color = App.rand(i + j) * 0xffffff;
            //         const meshlet = splitMeshlets[i][j];
            //         this.createMesh(meshlet.vertices, meshlet.indices, { color: meshlet_color, position: [0.45, 0, 0] });
            //     }
            // }
        })
    }

    private render() {

        this.stats.update();

        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(() => { this.render() });
    }
}