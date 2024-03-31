import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { BetterStats } from "./BetterStats";

import { MeshletGrouper } from "./MeshletGrouper";
import { OBJLoaderIndexed } from "./OBJLoaderIndexed";
import { MeshletMerger } from "./MeshletMerger";
import { METISWrapper } from "./METISWrapper";

import { DAG } from "./DAG";
import { instance } from "@viz-js/viz";
import { MeshletSimplifier_wasm } from "./utils/MeshletSimplifier_wasm";
import { MeshletCleaner } from "./utils/MeshletCleaner";
import { Meshlet } from "./Meshlet";
import { TEST_MESHES } from "./test";

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

        return fract(Math.sin((co + 1) * 12.9898) * 43758.5453);
    }

    private createSphere(radius, color, x, y, z) {
        let g = new THREE.SphereGeometry(radius);

        const m = new THREE.MeshBasicMaterial({
            wireframe: false,
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
            wireframe: false,
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

    private showMeshlets(meshlets: Meshlet[], position: number[], scale?: number[], color?: number) {
        for (let i = 0; i < meshlets.length; i++) {
            const meshlet_color = color ? color : App.rand(i) * 0xffffff;
            this.createMesh(meshlets[i].vertices_raw, meshlets[i].indices_raw, { color: meshlet_color, position: position, scale: scale });
        }
    }


    public async processObj(objURL: string) {
        OBJLoaderIndexed.load(objURL, async (objMesh) => {

            const objVertices = objMesh.vertices;
            const objIndices = objMesh.indices;

            // Original mesh
            this.createMesh(objVertices, objIndices, { opacity: 0.2, position: [-0.3, 0, 0] });



            const dag4 = new DAG();
            function addToDAG(fromMeshlets: Meshlet[], toMeshlets: Meshlet[], lod: number) {
                for (let fromMeshlet of fromMeshlets) {
                    for (let toMeshlet of toMeshlets) {
                        dag4.add(
                            { id: `${toMeshlet.id}`, data: toMeshlet, tag: `LOD${lod}` },
                            { id: `${fromMeshlet.id}`, data: fromMeshlet, tag: `LOD${lod - 1}` }
                        )
                    }
                }
            }

            function indexCounter(meshlets: Meshlet[][] | Meshlet[]): number {
                let count = 0;
                for (let i = 0; i < meshlets.length; i++) {
                    if (meshlets[i] && meshlets[i].length) {
                        for (let j = 0; j < meshlets[i].length; j++) {
                            count += meshlets[i][j].indices.length;
                        }
                    }
                    else {
                        count += meshlets[i].indices_raw.length;
                    }
                }
                return count;
            }


            async function step1_cluster_metis(vertices: Float32Array, indices: Uint32Array, parts: number): Promise<Meshlet[]> {
                const faces = MeshletGrouper.buildFacesFromIndices(indices);
                const adjacencyMatrixList = MeshletGrouper.buildFaceAdjacencyMatrix(faces);
                const groupPartitions = await METISWrapper.partition(adjacencyMatrixList, parts);
                // console.warn("groupPartitions", groupPartitions)
                const groupedMeshlets = MeshletGrouper.rebuildMeshletsFromGroupIndices(vertices, faces, groupPartitions);

                const meshletsV3: Meshlet[] = [];
                for (let i = 0; i < groupedMeshlets.length; i++) {
                    const meshlet = new Meshlet(groupedMeshlets[i].vertices_raw, groupedMeshlets[i].indices_raw);
                    meshletsV3.push(meshlet);
                }
                return meshletsV3;
            }



            // step2_group
            function adjacencyList(meshlets: Meshlet[]): number[][] {

                let vertexHashToMeshletMap: Map<string, number[]> = new Map();

                for (let i = 0; i < meshlets.length; i++) {
                    const meshlet = meshlets[i];
                    for (let j = 0; j < meshlet.boundaryEdges.length; j++) {
                        const boundaryEdge = meshlet.boundaryEdges[j];
                        const edgeHash = meshlet.getEdgeHash(boundaryEdge);

                        let meshletList = vertexHashToMeshletMap.get(edgeHash);
                        if (!meshletList) meshletList = [];

                        meshletList.push(i);
                        vertexHashToMeshletMap.set(edgeHash, meshletList);
                    }
                }
                const adjacencyList: Map<number, Set<number>> = new Map();

                for (let [_, indices] of vertexHashToMeshletMap) {
                    if (indices.length === 1) continue;

                    for (let index of indices) {
                        if (!adjacencyList.has(index)) {
                            adjacencyList.set(index, new Set());
                        }
                        for (let otherIndex of indices) {
                            if (otherIndex !== index) {
                                adjacencyList.get(index).add(otherIndex);
                            }
                        }
                    }
                }


                let adjacencyListArray: number[][] = [];
                // Finally, to array
                for (let [key, adjacents] of adjacencyList) {
                    if (!adjacencyListArray[key]) adjacencyListArray[key] = [];

                    adjacencyListArray[key].push(...Array.from(adjacents));
                }
                return adjacencyListArray;
            }

            function rebuildMeshletsFromGroupIndicesV3(meshlets: Meshlet[], groups: number[][]): Meshlet[][] {
                let groupedMeshlets: Meshlet[][] = [];

                for (let i = 0; i < groups.length; i++) {
                    if (!groupedMeshlets[i]) groupedMeshlets[i] = [];
                    for (let j = 0; j < groups[i].length; j++) {
                        const meshletId = groups[i][j];
                        const meshlet = meshlets[meshletId];
                        groupedMeshlets[i].push(meshlet);
                    }
                }
                return groupedMeshlets;
            }



            const step = async (meshlets: Meshlet[], y: number, scale = [1,1,1]): Promise<Meshlet[]> => {
                
                this.showMeshlets(meshlets, [0.0,y,0], scale);
                
                const adj = adjacencyList(meshlets);
    
                const MinPartitionSize = 8;
                const MaxPartitionSize = 32;
                const TargetPartitionSize = ( MinPartitionSize + MaxPartitionSize ) / 2;
                const TargetNumPartitions =  Math.ceil(adj.flat().length / TargetPartitionSize);

                let grouped = [meshlets];
                if (TargetNumPartitions > 1) {
                    const groups = await METISWrapper.partition(adj, TargetNumPartitions);
                    grouped = rebuildMeshletsFromGroupIndicesV3(meshlets, groups);
                }
    
    
                for (let i = 0; i < grouped.length; i++) {
                    this.showMeshlets(grouped[i], [0.3, y, 0], scale, App.rand(i) * 0xffffff);
                }
    
                async function step3_merge_v3(meshlets: Meshlet[]): Promise<Meshlet> {
                    const mergedMeshlet = MeshletMerger.merge(meshlets);
                    // Clean duplicate vertices left by threejs and adjust indices
                    const cleanedMeshlet = await MeshletCleaner.clean(mergedMeshlet);
    
                    return cleanedMeshlet;
                }
    
                // merge
                let merged: Meshlet[] = [];
                for (let i = 0; i < grouped.length; i++) {
                    merged.push(await step3_merge_v3(grouped[i]));
                }
                this.showMeshlets(merged, [0.6, y, 0], scale);
    
    
    
    
    
                // simplify
                let simplified: Meshlet[] = [];
                for (let i = 0; i < merged.length; i++) {
                    const d = Math.max(merged[i].indices_raw.length * 0.5, 128 * 3);
                    const simplifiedMeshlet = await MeshletSimplifier_wasm.simplify(merged[i], d);
                    simplified.push(simplifiedMeshlet);
                }
                this.showMeshlets(simplified, [0.9, y, 0], scale);
    
                // split
                const splitMeshlets: Meshlet[] = [];

                for (let i = 0; i < simplified.length; i++) {
                    const parts = Math.ceil(simplified[i].indices_raw.length / 3 / 128);
                    if (parts <= 1) {
                        splitMeshlets.push(simplified[i]);
                        continue;
                    }
                    const split = await step1_cluster_metis(simplified[i].vertices_raw, simplified[i].indices_raw, parts);
                    splitMeshlets.push(...split);
                }
    
                this.showMeshlets(splitMeshlets, [1.2, y, 0], scale);

                return splitMeshlets;
            }

            const meshletsV3 = await step1_cluster_metis(objVertices, objIndices, objIndices.length / 3 / 128);

            // // const out1 = await step(meshletsV3, 0.0);
            // // const out2 = await step(out1, -0.3);
            // // const out3 = await step(out2, -0.6);
            // // const out4 = await step(out3, -0.9);
            // // const out5 = await step(out4, -1.2);
            // // const out6 = await step(out5, -1.5);
            // // const out7 = await step(out6, -1.8);

            let input = meshletsV3;
            let y = 0.0;
            for (let i = 0; i < 10; i++) {
                const output = await step(input, y);
                console.log(input.length, output.length)
                console.log(indexCounter(input) / 3, indexCounter(output) / 3);
                console.log("\n")

                addToDAG(input, output, i+1);
                if (output.length === 1) {
                    break;
                }
                input = output;
                y-=0.3;
            }


            instance().then(viz => {
                const diagram = dag4.toDot();
                document.body.appendChild(viz.renderSVGElement(diagram));

                const canvas = document.createElement("canvas");
                canvas.width = 500;
                canvas.height = 500;
                const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;;

                console.log(dag4)

                let y = 200;
                for (let lod of Object.keys(dag4.tagToNode)) {
                    const nodes = dag4.tagToNode[lod];

                    let x = canvas.width * 0.5 - nodes.length * 7.5;
                    for (let i = 0; i < nodes.length; i++) {
                        ctx.beginPath();
                        ctx.arc(x + i * 5, y, 5, 0, 180 / Math.PI);
                        ctx.closePath();
                        ctx.stroke();
                        x += 10;

                        console.log(x, y)
                    }
                    y += 15;

                }
                document.body.appendChild(canvas);



                console.log(dag4)
            });





            // const testMeshlets: Meshlet[] = [];
            // for (let i = 0; i < TEST_MESHES.length; i++) {
            //     const meshlet = new Meshlet(TEST_MESHES[i].positions, TEST_MESHES[i].indices);
            //     testMeshlets.push(meshlet);
            // }

            // const scale = [0.001, -0.001, 0.001];
            // this.showMeshlets(testMeshlets, [0,0,0], scale);

            // const out1 = await step(testMeshlets, 0.0, scale);


            // const testm = await step1_cluster_metis(objVertices, objIndices, 2);

            // const test = testm[1];
            // this.showMeshlets([test], [0,0,0]);

            
            // let input = test;
            // for (let i = 0; i < 20; i++) {
            //     // const t = 128 * 3;
            //     const t = Math.max(input.indices_raw.length * 0.5, 128 * 3);
            //     console.log("TargetNumTris", input.indices_raw.length, t)
            //     const output = await MeshletSimplifier_wasm.simplify(input, t);
            //     console.log(input.triangles.length, output.triangles.length);
            //     input = output;
            // }
            
        })
    }

    private render() {

        this.stats.update();

        this.renderer.render(this.scene, this.camera);

        requestAnimationFrame(() => { this.render() });
    }
}