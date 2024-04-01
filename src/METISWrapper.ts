import * as METIS from "./metis-5.2.1/metis.js";
import { WASMHelper, WASMPointer } from "./utils/WasmHelper.js";

export class METISWrapper {
    private static METIS;

    private static async load() {
        if (!METISWrapper.METIS) {
            METISWrapper.METIS = await METIS.default();
        }
    }

    public static async partition(groups: number[][], nparts: number): Promise<number[][]> {
        await METISWrapper.load();

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

        // console.log("_xadj", _xadj);
        // console.log("_adjncy", _adjncy);
        // console.log("nparts", nparts);

        const objval = new WASMPointer(new Uint32Array(1), "out");
        const parts = new WASMPointer(new Uint32Array(_xadj.length - 1), "out");

        // console.log("_xadj", _xadj);
        // console.log("edge_weights", edge_weights);
        // throw Error("ERG")

        const options_array = new Int32Array(40);
        options_array.fill(-1);

        // options_array[0] = options.ptype;
        // options_array[1] = options.objtype;
        // options_array[2] = options.ctype;
        // options_array[3] = options.iptype;
        // options_array[4] = options.rtype;
        // options_array[5] = options.dbglvl;
        // options_array[6] = options.niter;
        // options_array[7] = options.ncuts;
        // options_array[8] = 51966; // options.seed;
        // options_array[9] = options.no2hop;
        // options_array[10] = options.minconn;
        options_array[11] = 1; // options.contig;
        // options_array[12] = options.compress;
        // options_array[13] = options.ccorder;
        // options_array[14] = options.pfactor;
        // options_array[15] = options.nseps;
        options_array[16] = 200; // options.ufactor;
        // options_array[17] = options.numbering;

        
        WASMHelper.call(METISWrapper.METIS, "METIS_PartGraphKway", "number", 
            new WASMPointer(new Int32Array([_xadj.length - 1])), // nvtxs
            new WASMPointer(new Int32Array([1])),                // ncon
            new WASMPointer(new Int32Array(_xadj)),            // xadj
            new WASMPointer(new Int32Array(_adjncy)),          // adjncy
            null,                                              // vwgt
            null,                                              // vsize
            null,                                              // adjwgt
            new WASMPointer(new Int32Array([nparts])),           // nparts
            null,                                              // tpwgts
            null,                                              // ubvec
            new WASMPointer(options_array),                    // options
            objval,                                            // objval
            parts,                                             // part
        )

        // console.log("nvtxs", _xadj.length - 1);
        // console.log("ncon", 1);
        // console.log("xadj", _xadj);
        // console.log("adjncy", _adjncy);
        // console.log("vwgt", null);
        // console.log("vsize", null);
        // console.log("adjwgt", null);
        // console.log("nparts", nparts);
        // console.log("tpwgts", null);
        // console.log("ubvec", null);
        // console.log("_options", null);
        // console.log("objval", objval);
        // console.log("part", parts);
        // // nvtxs,
        // // ncon,
        // // xadj,
        // // adjncy,
        // // vwgt,
        // // vsize,
        // // adjwgt,
        // // nparts,
        // // tpwgts,
        // // ubvec,
        // // _options,
        // // objval,
        // // part,

        const part_num = Math.max(...parts.data);

        const parts_out: number[][] = [];
        for (let i = 0; i <= part_num; i++) {
            const part: number[] = [];

            for (let j = 0; j < parts.data.length; j++) {
                if (parts.data[j] === i) {
                    part.push(j);
                }
            }

            if (part.length > 0) parts_out.push(part);
        }

        return parts_out;
    }




    public static async partition2(count: number, xadj: number[], adjncy: number[], nparts: number): Promise<Int32Array> {
        await METISWrapper.load();


        const objval = new WASMPointer(new Int32Array(1), "out");
        const parts = new WASMPointer(new Int32Array(xadj.length - 1), "out");

        WASMHelper.call(METISWrapper.METIS, "metis_part_graph_kway", "number", 
            count,// xadj.length - 1,
            1,
            new WASMPointer(new Int32Array(xadj)),
            new WASMPointer(new Int32Array(adjncy)),
            null,
            null,
            null,
            nparts,
            null,
            null,
            null,
            objval,
            parts,
        )

        return parts.data as Int32Array;
    }
}