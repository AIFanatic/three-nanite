import { MeshoptMeshlet } from "./MeshletBuilder";
import Module from "./meshoptimizer_clusterize";

export class MeshletBuilder_wasm {
    public static async build(vertices: Float32Array, indices: Uint32Array, max_vertices: number, max_triangles: number, cone_weight: number): Promise<{
        meshlet_count: number,
        meshlets_result: MeshoptMeshlet[],
        meshlet_vertices_result: Uint32Array,
        meshlet_triangles_result: Uint8Array
    }> {

        const MeshOptmizer = await Module();

        const TYPES = {
            i8: { array: Int8Array, heap: "HEAP8" },
            i16: { array: Int16Array, heap: "HEAP16" },
            i32: { array: Int32Array, heap: "HEAP32" },
            f32: { array: Float32Array, heap: "HEAPF32" },
            f64: { array: Float64Array, heap: "HEAPF64" },
            u8: { array: Uint8Array, heap: "HEAPU8" },
            u16: { array: Uint16Array, heap: "HEAPU16" },
            u32: { array: Uint32Array, heap: "HEAPU32" }
        };

        function transferNumberArrayToHeap(array, type) {
            const typedArray = type.array.from(array);
            const heapPointer = MeshOptmizer._malloc(
                typedArray.length * typedArray.BYTES_PER_ELEMENT
            );

            MeshOptmizer[type.heap].set(typedArray, heapPointer >> 2);

            return heapPointer;
        }

        function getDataFromHeapU8(address, type, length) {
            return MeshOptmizer[type.heap].slice(address, address + length);
        }

        function getDataFromHeap(address, type, length) {
            return MeshOptmizer[type.heap].slice(address >> 2, (address >> 2) + length);
        }

        function rebuildMeshlets(data) {
            // let meshlets = {vertex_offset, triangle_offset,vertex_count,triangle_count};
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

        const meshopt_buildMeshletsBound = MeshOptmizer.cwrap('meshopt_buildMeshletsBound', 'number', ['number', 'number', 'number']);

        const meshopt_buildMeshlets = MeshOptmizer.cwrap(
            'meshopt_buildMeshlets', // The C function name
            'number',                 // The return type
            ['number', 'number', 'number', 'number', 'number', // Argument types
                'number', 'number', 'number', 'number', 'number', 'number']
        );

        const meshopt_buildMeshletsScan = MeshOptmizer.cwrap(
            'meshopt_buildMeshletsScan', // The C function name
            'number',                 // The return type
            ['number', 'number', 'number', 'number', 'number',
                'number', 'number', 'number']
        );





        const index_count = indices.length;
        const vertex_positions = vertices;
        const vertex_count = vertices.length;
        const vertex_positions_stride = 3 * Float32Array.BYTES_PER_ELEMENT;

        const max_meshlets = meshopt_buildMeshletsBound(indices.length, max_vertices, max_triangles);

        const meshlets = new Uint32Array(max_meshlets * 4);
        const meshlet_vertices = new Uint32Array(max_meshlets * max_vertices);
        const meshlet_triangles = new Uint8Array(max_meshlets * max_triangles * 3);


        const verticesPtr = transferNumberArrayToHeap(Float32Array.from(vertex_positions), TYPES.f32);
        const indicesPtr = transferNumberArrayToHeap(Uint32Array.from(indices), TYPES.u32);
        const meshletsPtr = transferNumberArrayToHeap(Uint32Array.from(meshlets), TYPES.u32);
        const meshlet_verticesPtr = transferNumberArrayToHeap(Uint32Array.from(meshlet_vertices), TYPES.u32);
        const meshlet_trianglesPtr = transferNumberArrayToHeap(Uint8Array.from(meshlet_triangles), TYPES.u8);

        const meshletCount = meshopt_buildMeshlets(
            meshletsPtr,
            meshlet_verticesPtr,
            meshlet_trianglesPtr,
            indicesPtr,
            index_count,
            verticesPtr,
            vertex_count,
            vertex_positions_stride,
            max_vertices,
            max_triangles,
            cone_weight
        );

        const data = getDataFromHeap(meshletsPtr, TYPES.u32, meshlets.length);


        let meshlets_result = rebuildMeshlets(data);
        meshlets_result = meshlets_result.splice(0, meshletCount);
        const meshlet_vertices_result: Uint32Array = getDataFromHeap(meshlet_verticesPtr, TYPES.u32, meshlet_vertices.length);
        const meshlet_triangles_result: Uint8Array = getDataFromHeapU8(meshlet_trianglesPtr, TYPES.u8, meshlet_triangles.length);

        for (let i = 0; i < meshletCount; i++) {
            const meshlet = meshlets_result[i];

            let meshlet_positions: number[] = [];
            let meshlet_indices: number[] = [];

            for (let v = 0; v < meshlet.vertex_count; ++v) {
                const o3 = 3 * meshlet_vertices_result[meshlet.vertex_offset + v];
                meshlet_positions.push(vertex_positions[o3]);
                meshlet_positions.push(vertex_positions[o3 + 1]);
                meshlet_positions.push(vertex_positions[o3 + 2]);
            }

            for (let t = 0; t < meshlet.triangle_count; ++t) {
                const o = meshlet.triangle_offset + 3 * t;
                meshlet_indices.push(meshlet_triangles_result[o + 0]);
                meshlet_indices.push(meshlet_triangles_result[o + 1]);
                meshlet_indices.push(meshlet_triangles_result[o + 2]);
            }
        }

        return {
            meshlet_count: meshletCount,
            meshlets_result: meshlets_result,
            meshlet_vertices_result: meshlet_vertices_result,
            meshlet_triangles_result: meshlet_triangles_result
        }
    }
}