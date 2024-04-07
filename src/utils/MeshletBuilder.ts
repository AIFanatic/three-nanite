import { MeshoptMeshlet } from "./MeshletCreator";
import { WASMHelper, WASMPointer } from "./WasmHelper";
import MeshOptimizerModule from "./meshoptimizer";

export class MeshletBuilder {
    public static meshoptimizer_clusterize;

    private static async load() {
        if (!MeshletBuilder.meshoptimizer_clusterize) {
            MeshletBuilder.meshoptimizer_clusterize = await MeshOptimizerModule();
        }
    }

    public static async build(vertices: Float32Array, indices: Uint32Array, max_vertices: number, max_triangles: number, cone_weight: number): Promise<{
        meshlet_count: number,
        meshlets_result: MeshoptMeshlet[],
        meshlet_vertices_result: Uint32Array,
        meshlet_triangles_result: Uint8Array
    }> {

        await MeshletBuilder.load();

        const MeshOptmizer = MeshletBuilder.meshoptimizer_clusterize;

        function rebuildMeshlets(data) {
            let meshlets: MeshoptMeshlet[] = [];

            for (let i = 0; i < data.length; i += 4) {
                meshlets.push({
                    vertex_offset: data[i + 0],
                    triangle_offset: data[i + 1],
                    vertex_count: data[i + 2],
                    triangle_count: data[i + 3]
                })
            }

            return meshlets;
        }

        const max_meshlets = WASMHelper.call(MeshOptmizer, "meshopt_buildMeshletsBound", "number", indices.length, max_vertices, max_triangles);



        const meshlets = new WASMPointer(new Uint32Array(max_meshlets * 4), "out");
        const meshlet_vertices = new WASMPointer(new Uint32Array(max_meshlets * max_vertices), "out");
        const meshlet_triangles = new WASMPointer(new Uint8Array(max_meshlets * max_triangles * 3), "out");

        const meshletCount = WASMHelper.call(MeshOptmizer, "meshopt_buildMeshlets", "number", 
            meshlets,
            meshlet_vertices,
            meshlet_triangles,
            new WASMPointer(Uint32Array.from(indices)),
            indices.length,
            new WASMPointer(Float32Array.from(vertices)),
            vertices.length,
            3 * Float32Array.BYTES_PER_ELEMENT,
            max_vertices,
            max_triangles,
            cone_weight
        );

        const meshlets_result = rebuildMeshlets(meshlets.data).splice(0, meshletCount);

        return {
            meshlet_count: meshletCount,
            meshlets_result: meshlets_result,
            meshlet_vertices_result: meshlet_vertices.data,
            meshlet_triangles_result: meshlet_triangles.data
        }
    }
}