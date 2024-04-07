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

        // options_array[0] = // METIS_OPTION_PTYPE,
        // options_array[1] = 0 // METIS_OPTION_OBJTYPE,
        // options_array[2] = // METIS_OPTION_CTYPE,
        // options_array[3] = // METIS_OPTION_IPTYPE,
        // options_array[4] = // METIS_OPTION_RTYPE,
        // options_array[5] = // METIS_OPTION_DBGLVL,
        // options_array[6] = // METIS_OPTION_NIPARTS,
        // options_array[7] = // METIS_OPTION_NITER,
        // options_array[8] = // METIS_OPTION_NCUTS,
        // options_array[9] = // METIS_OPTION_SEED,
        // options_array[10] = // METIS_OPTION_ONDISK,
        // options_array[11] = // METIS_OPTION_MINCONN,
        // options_array[12] = 1// METIS_OPTION_CONTIG,
        // options_array[13] = // METIS_OPTION_COMPRESS,
        // options_array[14] = 1// METIS_OPTION_CCORDER,
        // options_array[15] = // METIS_OPTION_PFACTOR,
        // options_array[16] = // METIS_OPTION_NSEPS,
        // options_array[17] = // METIS_OPTION_UFACTOR,
        // options_array[18] = 0 // METIS_OPTION_NUMBERING,
        // options_array[19] = // METIS_OPTION_DROPEDGES,
        // options_array[20] = // METIS_OPTION_NO2HOP,
        // options_array[21] = // METIS_OPTION_TWOHOP,
        // options_array[22] = // METIS_OPTION_FAST,

        // options[METIS_OPTION_OBJTYPE] = 0 // METIS_OBJTYPE_CUT;
        // options[METIS_OPTION_CCORDER] = 1; // identify connected components first
        // options[METIS_OPTION_NUMBERING] = 0;

        
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
}