import { Meshlet } from "./App";

interface Triangle {
    v: number[];
};

interface Vertex {
    tstart: number;
    tcount: number;
    border: number;
};

interface Ref {
    tid: number;
    tvertex: number;
};

export class MeshletEdgeFinder {
    public static getBoundary(meshlet: Meshlet) {
        let vertices: Vertex[] = [];
        let triangles: Triangle[] = [];
        let refs: Ref[] = [];

        for (let i = 0; i < meshlet.vertices.length; i+=3) {
            vertices.push({tstart: 0, tcount: 0, border: 0});
        }

        for (let i = 0; i < meshlet.indices.length; i+=3) {
            triangles.push({
                v: [meshlet.indices[i + 0], meshlet.indices[i + 1], meshlet.indices[i + 2]]
            })
        }

        for (let i = 0; i < triangles.length * 3; i++) {
            refs.push({tid: 0, tvertex: 0});
        }

        for (let i = 0; i < triangles.length; ++i) {
            const t: Triangle = triangles[i];
            for (let j = 0; j < 3; ++j) {
                vertices[t.v[j]].tcount++;
            }
        }
        
        let tstart = 0;
        for (let i = 0; i < vertices.length; ++i) {
            const v: Vertex = vertices[i];
            v.tstart = tstart;
            tstart += v.tcount;
            v.tcount = 0;
        }

        for (let i = 0; i < triangles.length; ++i) {
            const t: Triangle = triangles[i];
            for (let j = 0; j < 3; ++j) {
                const v: Vertex = vertices[t.v[j]];
                refs[v.tstart + v.tcount].tid = i;
                refs[v.tstart + v.tcount].tvertex = j;
                v.tcount++;
            }
        }

        // Identify boundary : vertices[].border=0,1
        let vcount: number[] = [];
        let vids: number[] = [];

        let boundaryVids: number[] = [];

        for (let i = 0; i < vertices.length; ++i)
            vertices[i].border = 0;

        for (let i = 0; i < vertices.length; ++i) {
            const v: Vertex = vertices[i];
            vcount = [];
            vids = [];
            for (let j = 0; j < v.tcount; ++j) {
                const k = refs[v.tstart + j].tid;
                const t: Triangle = triangles[k];
                for (let k = 0; k < v.tcount; ++k) {
                    let ofs = 0;
                    const id = t.v[k];
                    while (ofs < vcount.length) {
                        if (vids[ofs] == id)
                            break;
                        ofs++;
                    }
                    if (ofs == vcount.length) {
                        vcount.push(1);
                        vids.push(id);
                    }
                    else
                        vcount[ofs]++;
                }
            }
            for (let j = 0; j < vcount.length; ++j)
                if (vcount[j] == 1) {
                    vertices[vids[j]].border = 1;
                    boundaryVids.push(vids[j]);
                }
        }

        return boundaryVids;
    }
}