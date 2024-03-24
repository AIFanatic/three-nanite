import * as METIS from "./metis-js/metis-5.1.0/metis.js";

export class METISWrapper {
    private static METIS;

    private static async load() {
        if (!METISWrapper.METIS) {
            METISWrapper.METIS = await METIS.default();
        }
    }

    public static async partition(groups: number[][]): Promise<number[][]> {
        await METISWrapper.load();

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
            const heapPointer = METISWrapper.METIS._malloc(
                typedArray.length * typedArray.BYTES_PER_ELEMENT
            );

            METISWrapper.METIS[type.heap].set(typedArray, heapPointer >> 2);

            return heapPointer;
        }

        function getDataFromHeapU8(address, type, length) {
            return METISWrapper.METIS[type.heap].slice(address, address + length);
        }

        function getDataFromHeap(address, type, length) {
            return METISWrapper.METIS[type.heap].slice(address >> 2, (address >> 2) + length);
        }

        const metis_part_graph_kway = METISWrapper.METIS.cwrap(
            'metis_part_graph_kway',
            'number', // int status
            [
                'number', // idx_t nvtxs, // The number of vertices in the graph.
                'number', // idx_t ncon, // The number of balancing constraints. It should be at least 1.
                'number', // idx_t* xadj, // Pointers to the locally stored vertices
                'number', // idx_t* adjncy, // Array that stores the adjacency lists of nvtxs
                'number', // idx_t* vwgt, // Vertex weights
                'number', // idx_t* vsize, // Vertex sizes for min-volume formulation
                'number', // idx_t* adjwgt, // Array that stores the weights of the adjacency lists
                'number', // idx_t nparts, // The number of partitions
                'number', // real_t* tpwgts, // The target partition weights
                'number', // real_t* ubvec, // load imbalance tolerance for each constraint
                'number', // idx_t* options, // options vector with pointers to relevant things
                'number', // idx_t* objval, // Objective value will be written here
                'number', // idx_t* part // where partitions should be written to, size equal to number of vertices
            ]
        );

     
        // From: pymetis
        function _prepare_graph(adjacency: number[][]) {
            function assert(condition: boolean) {
                if (!condition) throw Error("assert");
            }

            let xadj: number[] = [0]
            let adjncy: number[] = []

            for (let i = 0; i < adjacency.length; i++) {
                let adj = adjacency[i];
                if (adj !== null && adj.length) {
                    assert(Math.max(...adj) < adjacency.length)
                }
                adjncy.push(...adj);
                xadj.push(adjncy.length)
            }

            return [xadj, adjncy]
        }

        const [_xadj, _adjncy] = _prepare_graph(groups);

        const ArrayType = Int32Array;
        const TYPE = TYPES.i32;
        const _xadj_ptr = transferNumberArrayToHeap(ArrayType.from(_xadj), TYPE);
        const _adjncy_ptr = transferNumberArrayToHeap(ArrayType.from(_adjncy), TYPE);

        const parts = new ArrayType(_xadj.length - 1);
        const parts_ptr = transferNumberArrayToHeap(ArrayType.from(parts), TYPE);
        const edgecut = new ArrayType(1);
        const edgecut_ptr = transferNumberArrayToHeap(ArrayType.from(edgecut), TYPE);

        const nvtxs = _xadj.length - 1;
        const ncon = 1; // >= 1
        const xadj = _xadj_ptr;
        const adjncy = _adjncy_ptr;
        const vwgt = null;
        const vsize = null;
        const adjwgt = null;
        const nparts = 10;
        const tpwgts = null;
        const ubvec = null;
        const options = null;
        const objval = edgecut_ptr;
        const part = parts_ptr; // ret

        metis_part_graph_kway(
            nvtxs,
            ncon,
            xadj,
            adjncy,
            vwgt,
            vsize,
            adjwgt,
            nparts,
            tpwgts,
            ubvec,
            options,
            objval,
            part
        );

        const parts_result: Int32Array = getDataFromHeap(parts_ptr, TYPE, parts.length);
        const edge_cut_result = getDataFromHeap(edgecut_ptr, TYPE, edgecut.length);

        const part_num = Math.max(...parts_result);

        const parts_out: number[][] = [];
        for (let i = 0; i <= part_num; i++) {
            const part: number[] = [];

            for (let j = 0; j < parts_result.length; j++) {
                if (parts_result[j] === i) {
                    part.push(j);
                }
            }

            parts_out.push(part);
        }

        return parts_out;
    }
}