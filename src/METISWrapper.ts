import * as METIS from "./metis-js/metis-5.1.0/metis.js";
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

        const objval = new WASMPointer(new Int32Array(1), "out");
        const parts = new WASMPointer(new Int32Array(_xadj.length - 1), "out");

        WASMHelper.call(METISWrapper.METIS, "metis_part_graph_kway", "number", 
            _xadj.length - 1,
            1,
            new WASMPointer(new Int32Array(_xadj)),
            new WASMPointer(new Int32Array(_adjncy)),
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

        const part_num = Math.max(...parts.data);

        const parts_out: number[][] = [];
        for (let i = 0; i <= part_num; i++) {
            const part: number[] = [];

            for (let j = 0; j < parts.data.length; j++) {
                if (parts.data[j] === i) {
                    part.push(j);
                }
            }

            parts_out.push(part);
        }

        return parts_out;
    }
}