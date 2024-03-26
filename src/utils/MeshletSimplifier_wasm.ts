import { WASMHelper, WASMPointer } from "./WasmHelper";

import { Meshlet } from "../App";
import MeshOptimizerModule from "./meshoptimizer";

export class MeshletSimplifier_wasm {
    public static meshoptimizer_clusterize;

    private static async load() {
        if (!MeshletSimplifier_wasm.meshoptimizer_clusterize) {
            MeshletSimplifier_wasm.meshoptimizer_clusterize = await MeshOptimizerModule();
            console.log("MeshletSimplifier_wasm.meshoptimizer_clusterize", MeshletSimplifier_wasm.meshoptimizer_clusterize)
        }
    }

    public static async simplify(meshlet: Meshlet, target_count: number): Promise<Meshlet> {

        await MeshletSimplifier_wasm.load();

        const MeshOptmizer = MeshletSimplifier_wasm.meshoptimizer_clusterize;

        const destination = new WASMPointer(new Uint32Array(meshlet.indices.length), "out");
        
        const simplified_index_count = WASMHelper.call(MeshOptmizer, "meshopt_simplify", "number",
            destination,
            new WASMPointer(new Uint32Array(meshlet.indices)),
            meshlet.indices.length,
            new WASMPointer(new Float32Array(meshlet.vertices)),
            meshlet.vertices.length,
            3 * Float32Array.BYTES_PER_ELEMENT,
            target_count,
            1e-2,
            0,
            0.0,
        );

        const destination_resized = destination.data.slice(0, simplified_index_count);
        console.log(destination.data)

        console.log("Input indices", meshlet.indices.length / 3);
        console.log("Output indices", simplified_index_count / 3);

        return {
            vertices: meshlet.vertices.slice(),
            vertex_count: meshlet.vertices.length / 3,
            indices: destination_resized,
            index_count: destination_resized.length
        }
    }
}