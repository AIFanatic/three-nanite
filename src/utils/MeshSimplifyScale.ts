import { Meshlet } from "../Meshlet";
import { WASMHelper, WASMPointer } from "./WasmHelper";

import MeshOptimizerModule from "./meshoptimizer";

// From: THREE.js
export class MeshSimplifyScale {
    public static meshoptimizer;

    private static async load() {
        if (!MeshSimplifyScale.meshoptimizer) {
            MeshSimplifyScale.meshoptimizer = await MeshOptimizerModule();
        }
    }

    public static async scaleError(meshlet: Meshlet): Promise<number> {
        await MeshSimplifyScale.load();

        const MeshOptmizer = MeshSimplifyScale.meshoptimizer;


        const vertices = new WASMPointer(new Float32Array(meshlet.vertices_raw), "in");

        // float meshopt_simplifyScale(const float* vertex_positions, size_t vertex_count, size_t vertex_positions_stride)
        const scale = WASMHelper.call(MeshOptmizer, "meshopt_simplifyScale", "number", 
            vertices,
            meshlet.vertices_raw.length,
            3 * Float32Array.BYTES_PER_ELEMENT
        );
        
        return scale;
    }
}