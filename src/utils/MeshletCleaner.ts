import { Meshlet } from "../App";
import { WASMHelper, WASMPointer } from "./WasmHelper";

import MeshOptimizerModule from "./meshoptimizer";

// From: THREE.js
export class MeshletCleaner {
    public static meshoptimizer;

    private static async load() {
        if (!MeshletCleaner.meshoptimizer) {
            MeshletCleaner.meshoptimizer = await MeshOptimizerModule();
        }
    }

    public static async clean(meshlet: Meshlet): Promise<Meshlet> {
        await MeshletCleaner.load();

        const MeshOptmizer = MeshletCleaner.meshoptimizer;

        const remap = new WASMPointer(new Uint32Array(meshlet.indices.length * 3), "out");
        const indices = new WASMPointer(new Uint32Array(meshlet.indices), "in");
        const vertices = new WASMPointer(new Float32Array(meshlet.vertices), "in");

        const vertex_count = WASMHelper.call(MeshOptmizer, "meshopt_generateVertexRemap", "number", 
            remap,
            indices,
            meshlet.indices.length,
            vertices,
            meshlet.vertices.length,
            3 * Float32Array.BYTES_PER_ELEMENT
        );
        
        const indices_remapped = new WASMPointer(new Uint32Array(meshlet.indices.length), "out");
        WASMHelper.call(MeshOptmizer, "meshopt_remapIndexBuffer", "number", 
            indices_remapped,
            indices,
            meshlet.indices.length,
            remap
        );
        
        const vertices_remapped = new WASMPointer(new Float32Array(vertex_count * 3), "out");
        WASMHelper.call(MeshOptmizer, "meshopt_remapVertexBuffer", "number", 
            vertices_remapped,
            vertices,
            meshlet.vertices.length,
            3 * Float32Array.BYTES_PER_ELEMENT,
            remap
        );

        console.log("meshlet_vertices", meshlet.vertices);
        console.log("meshlet_indices", meshlet.indices);

        console.log("vertices_remapped", vertices_remapped.data);
        console.log("indices_remapped", indices_remapped.data);


        return {
            vertices: vertices_remapped.data,
            vertex_count: vertices_remapped.data.length / 3,
            indices: indices_remapped.data,
            index_count: indices_remapped.data.length
        }
    }
}