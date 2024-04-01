import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { BetterStats } from "./BetterStats";

import { MeshletGrouper } from "./MeshletGrouper";
import { OBJLoaderIndexed } from "./OBJLoaderIndexed";
import { MeshletMerger } from "./MeshletMerger";
import { METISWrapper } from "./METISWrapper";

import { DAG } from "./DAG";
import { instance } from "@viz-js/viz";
import { MeshletSimplifier_wasm, SimplificationResult } from "./utils/MeshletSimplifier_wasm";
import { MeshletCleaner } from "./utils/MeshletCleaner";
import { Meshlet } from "./Meshlet";
import { TEST_MESHES } from "./test";
import svgPanZoom from "svg-pan-zoom";

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

    private createMesh(vertices: ArrayLike<number>, indices: ArrayLike<number>, params: { color?: number, position?: number[], opacity?: number, scale?: number[] }): THREE.Mesh {
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

        return mesh;
    }

    private showMeshlets(meshlets: Meshlet[], position: number[], scale?: number[], color?: number): THREE.Mesh[] {
        let meshes: THREE.Mesh[] = [];
        for (let i = 0; i < meshlets.length; i++) {
            const meshlet_color = color ? color : App.rand(i) * 0xffffff;
            const mesh = this.createMesh(meshlets[i].vertices_raw, meshlets[i].indices_raw, { color: meshlet_color, position: position, scale: scale });
            meshes.push(mesh);
        }
        return meshes;
    }


    public async processObj(objURL: string) {
        OBJLoaderIndexed.load(objURL, async (objMesh) => {

            const objVertices = objMesh.vertices;
            const objIndices = objMesh.indices;

            // Original mesh
            this.createMesh(objVertices, objIndices, { opacity: 0.2, position: [-0.3, 0, 0] });



            const dag4 = new DAG<SimplificationResult>();
            function addToDAG(fromMeshlets: Meshlet[], toMeshlets: Meshlet[], lod: number, error: number) {
                for (let fromMeshlet of fromMeshlets) {
                    for (let toMeshlet of toMeshlets) {
                        dag4.add(
                            { id: `${toMeshlet.id}`, data: {meshlet: toMeshlet, result_error: error}, tag: `LOD${lod}` },
                            { id: `${fromMeshlet.id}`, data: {meshlet: fromMeshlet, result_error: error}, tag: `LOD${lod - 1}` }
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

            async function step3_merge_v3(meshlets: Meshlet[]): Promise<Meshlet> {
                const mergedMeshlet = MeshletMerger.merge(meshlets);
                // Clean duplicate vertices left by threejs and adjust indices
                const cleanedMeshlet = await MeshletCleaner.clean(mergedMeshlet);

                return cleanedMeshlet;
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



            const step = async (meshlets: Meshlet[], y: number, scale = [1,1,1], lod: number): Promise<Meshlet[]> => {
                
                this.showMeshlets(meshlets, [0.0,y,0], scale);
                
                const adj = adjacencyList(meshlets);
    
                const minNumberOfGroups = 8;
                const maxNumberOfGroups = 32;
                const groupSize = ( minNumberOfGroups + maxNumberOfGroups ) / 2;
                // const nparts =  Math.ceil(adj.flat().length / groupSize);
                const nparts = Math.ceil(meshlets.length * 0.5);

                console.log("meshlets", meshlets.length, nparts)
                let grouped = [meshlets];
                if (nparts > 1) {
                    const groups = await METISWrapper.partition(adj, nparts);
                    grouped = rebuildMeshletsFromGroupIndicesV3(meshlets, groups);
                }
    
    
                // merge
                let splitOut: Meshlet[] = [];
                for (let i = 0; i < grouped.length; i++) {
                    const group = grouped[i];
                    this.showMeshlets(group, [0.3, y, 0], scale, App.rand(i) * 0xffffff);

                    const mergedGroup = await step3_merge_v3(group);

                    this.showMeshlets([mergedGroup], [0.6, y, 0], scale, App.rand(i) * 0xffffff);

                    const d = Math.max(mergedGroup.indices_raw.length * 0.5, 128 * 3);
                    let simplificationResult: SimplificationResult = {meshlet: mergedGroup, result_error: 1};
                    if (mergedGroup.indices_raw.length / 3 > 128) {
                        simplificationResult = await MeshletSimplifier_wasm.simplify(mergedGroup, d);
                    }

                    const simplifiedGroup = simplificationResult.meshlet;
                    const simplificationError = simplificationResult.result_error;
                    this.showMeshlets([simplifiedGroup], [0.9, y, 0], scale, App.rand(i) * 0xffffff);

                    let split = [simplifiedGroup];
                    const parts = Math.ceil(simplifiedGroup.indices_raw.length / 3 / 128);
                    if (parts > 1) {
                        split = await step1_cluster_metis(simplifiedGroup.vertices_raw, simplifiedGroup.indices_raw, parts);
                    }
                    addToDAG(group, split, lod, simplificationError);

                    
                    splitOut.push(...split);
                    
                }

                this.showMeshlets(splitOut, [1.2, y, 0], scale);
    
    
    
    
    
                // // simplify
                // let simplified: Meshlet[] = [];
                // for (let i = 0; i < merged.length; i++) {
                //     const d = Math.max(merged[i].indices_raw.length * 0.5, 128 * 3);
                //     const simplifiedMeshlet = await MeshletSimplifier_wasm.simplify(merged[i], d);
                //     simplified.push(simplifiedMeshlet);
                // }
                // this.showMeshlets(simplified, [0.9, y, 0], scale);
    
                // // split
                // const splitMeshlets: Meshlet[] = [];

                // for (let i = 0; i < simplified.length; i++) {
                //     const parts = Math.ceil(simplified[i].indices_raw.length / 3 / 128);
                //     if (parts <= 1) {
                //         splitMeshlets.push(simplified[i]);
                //         continue;
                //     }
                //     const split = await step1_cluster_metis(simplified[i].vertices_raw, simplified[i].indices_raw, parts);
                //     splitMeshlets.push(...split);
                // }
    

                // addToDAG(splitMeshlets, merged, lod);

                // this.showMeshlets(splitMeshlets, [1.2, y, 0], scale);

                return splitOut;
            }

            let meshletsV3 = await step1_cluster_metis(objVertices, objIndices, objIndices.length / 3 / 128);
            // meshletsV3 = meshletsV3.slice(0, 20);

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
                const output = await step(input, y, [1,1,1], i+1);
                console.log(input.length, output.length)
                console.log(indexCounter(input) / 3, indexCounter(output) / 3);
                console.log("\n")

                // addToDAG(input, output, i+1);
                if (output.length === 1) {
                    break;
                }
                input = output;
                y-=0.3;
            }


            // 441846 -> 8154144

            // const node441846 = dag4.nodes[441846];
            // const node8154144 = dag4.nodes[8154144];

            // dag4.add(node8154144, node441846);

            // const node8537517 = dag4.nodes[8537517];
            // dag4.add(node8537517, node8154144);

            console.log(dag4)

            instance().then(viz => {

                let addedMeshlets: Meshlet[] = [];


                const addedMeshletsGroup = new THREE.Group();
                this.scene.add(addedMeshletsGroup);

                const updateMeshletsGroup = (group: THREE.Group, meshlets: Meshlet[]) => {
                    const meshes = this.showMeshlets(meshlets, [0, 0.3, 0]);
                    this.scene.remove(...meshes);
                    group.clear();
                    if (meshlets.length === 0) return;
                    group.add(...meshes);
                }


                const diagram = dag4.toDot();
                const diagramElement = viz.renderSVGElement(diagram);
                diagramElement.style.position = "absolute";
                diagramElement.style.width = "500px";
                diagramElement.style.height = "500px";
                diagramElement.style.top = "0";
                diagramElement.style.left = "0";
                diagramElement.style.backgroundColor = "white";
                document.body.appendChild(diagramElement);

                svgPanZoom(diagramElement, {
                    zoomEnabled: true,
                    fit: true,
                    center: true,
                    // viewportSelector: document.getElementById('demo-tiger').querySelector('#g4') // this option will make library to misbehave. Viewport should have no transform attribute
                });



                const nodes = diagramElement.querySelectorAll(".node");
                for (let node of nodes) {
                    node.addEventListener("click" , e => {
                        const box = node.querySelector("ellipse");
                        const texts = node.querySelectorAll("text");
                        const nodeId = parseInt(texts[0].textContent)

                        const dagNode = dag4.nodes[nodeId];
                        const nodeData = dagNode.data;
                        const nodeMeshlet = nodeData.meshlet;
                        nodeMeshlet.error = nodeData.result_error;
                        const addedIndex = addedMeshlets.indexOf(nodeMeshlet);
                        console.log(nodeId, dagNode);

                        if (box) {
                            if (box.getAttribute("fill") === "none") {
                                box.setAttribute("fill", "red");

                                if (addedIndex === -1) {
                                    addedMeshlets.push(nodeMeshlet);
                                    updateMeshletsGroup(addedMeshletsGroup, addedMeshlets);
                                }
                            }
                            else {
                                box.setAttribute("fill", "none");

                                if (addedIndex !== -1) {
                                    addedMeshlets.splice(addedIndex, 1);
                                    updateMeshletsGroup(addedMeshletsGroup, addedMeshlets);
                                }
                            }

                            console.log(addedMeshlets)
                        }
                    })
                }

                const canvas = document.createElement("canvas");
                canvas.width = 500;
                canvas.height = 500;
                const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;;

                console.log(dag4)

                function sortByLOD(dag: DAG<SimplificationResult>) {
                    const lodKeys = Object.keys(dag.tagToNode);
                    
                    let lodNodesArray: string[][] = new Array(lodKeys.length);

                    for (let lod of lodKeys) {
                        const lodNum = parseInt(lod.split("LOD")[1]);
                        const lodNodes = dag.tagToNode[lod];

                        if (!lodNodesArray[lodNum]) lodNodesArray[lodNum] = [];
                        lodNodesArray[lodNum].push(...lodNodes);
                    }

                    return lodNodesArray.sort();
                }
                const sortedLods = sortByLOD(dag4);
                const sortedLODKeys = Object.keys(sortedLods).reverse();
                let y = 100;
                const nodePositions: Map<string, {x: number, y: number}> = new Map();

                for (let lod of sortedLODKeys) {
                    const lodKey = `LOD${lod}`;
                    const nodes = dag4.tagToNode[lodKey];

                    let x = canvas.width * 0.5 - nodes.length * 25;
                    for (let i = 0; i < nodes.length; i++) {
                        const pos = {x: x + i * 50, y: y};
                        ctx.beginPath();
                        ctx.arc(pos.x, pos.y, 5, 0, 180 / Math.PI);
                        ctx.closePath();
                        ctx.stroke();
                        x += 10;

                        nodePositions.set(nodes[i], pos);
                    }
                    y += 50;

                }

                // Make connections

                console.log(nodePositions)
                for (let p in dag4.parentToChild) {
                    const ppos = nodePositions.get(p);
                    for (let c of dag4.parentToChild[p]) {
                        const cpos = nodePositions.get(c);
                        ctx.beginPath();
                        ctx.moveTo(ppos.x, ppos.y);
                        ctx.lineTo(cpos.x, cpos.y);
                        ctx.closePath();
                        ctx.stroke();
                    }
                }
                document.body.appendChild(canvas);
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