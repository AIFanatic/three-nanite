import { Meshlet } from "../Meshlet";
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

        const remap = new WASMPointer(new Uint32Array(meshlet.indices_raw.length * 3), "out");
        const indices = new WASMPointer(new Uint32Array(meshlet.indices_raw), "in");
        const vertices = new WASMPointer(new Float32Array(meshlet.vertices_raw), "in");

        const vertex_count = WASMHelper.call(MeshOptmizer, "meshopt_generateVertexRemap", "number", 
            remap,
            indices,
            meshlet.indices_raw.length,
            vertices,
            meshlet.vertices_raw.length,
            3 * Float32Array.BYTES_PER_ELEMENT
        );
        
        const indices_remapped = new WASMPointer(new Uint32Array(meshlet.indices_raw.length), "out");
        WASMHelper.call(MeshOptmizer, "meshopt_remapIndexBuffer", "number", 
            indices_remapped,
            indices,
            meshlet.indices_raw.length,
            remap
        );
        
        const vertices_remapped = new WASMPointer(new Float32Array(vertex_count * 3), "out");
        WASMHelper.call(MeshOptmizer, "meshopt_remapVertexBuffer", "number", 
            vertices_remapped,
            vertices,
            meshlet.vertices_raw.length,
            3 * Float32Array.BYTES_PER_ELEMENT,
            remap
        );

        const m = new Meshlet(vertices_remapped.data, indices_remapped.data);
        return m;
    }
}