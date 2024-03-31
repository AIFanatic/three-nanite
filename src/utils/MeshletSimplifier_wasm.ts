import { WASMHelper, WASMPointer } from "./WasmHelper";

import MeshOptimizerModule from "./meshoptimizer";
import { Meshlet } from "../Meshlet";

export class MeshletSimplifier_wasm {
    public static meshoptimizer_clusterize;

    private static async load() {
        if (!MeshletSimplifier_wasm.meshoptimizer_clusterize) {
            MeshletSimplifier_wasm.meshoptimizer_clusterize = await MeshOptimizerModule();
        }
    }

    public static async simplify(meshlet: Meshlet, target_count: number): Promise<Meshlet> {

        await MeshletSimplifier_wasm.load();

        const MeshOptmizer = MeshletSimplifier_wasm.meshoptimizer_clusterize;

        const destination = new WASMPointer(new Uint32Array(meshlet.indices_raw.length), "out");
        
        const simplified_index_count = WASMHelper.call(MeshOptmizer, "meshopt_simplify", "number",
            destination, // unsigned int* destination,
            new WASMPointer(new Uint32Array(meshlet.indices_raw)), // const unsigned int* indices,
            meshlet.indices_raw.length, // size_t index_count,
            new WASMPointer(new Float32Array(meshlet.vertices_raw)), // const float* vertex_positions,
            meshlet.vertices_raw.length, // size_t vertex_count,
            3 * Float32Array.BYTES_PER_ELEMENT, // size_t vertex_positions_stride,
            target_count, // size_t target_index_count,
            0.1, // float target_error,
            1, // unsigned int options,
            0.0, // float* result_error
        );

        const destination_resized = destination.data.slice(0, simplified_index_count) as Uint32Array;

        return new Meshlet(meshlet.vertices_raw, destination_resized);
    }
}