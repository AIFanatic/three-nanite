import { SymmetricMatrix } from "./SymmetricMatrix";
import { Vector3d } from "./Vector3d";

export class Vertex {
    public index: number;
    public p: Vector3d;
    public tstart: number;
    public tcount: number;
    public q: SymmetricMatrix;
    public borderEdge: boolean;
    public uvSeamEdge: boolean;
    public uvFoldoverEdge: boolean;

    constructor(index: number, p: Vector3d) {
        this.index = index;
        this.p = p;
        this.tstart = 0;
        this.tcount = 0;
        this.q = new SymmetricMatrix();
        this.borderEdge = true;
        this.uvSeamEdge = false;
        this.uvFoldoverEdge = false;
    }

    public GetHashCode(): number {
        return this.index;
    }

    public Equals(obj: object | Vertex): boolean {
        if (obj instanceof Vertex) {
            var other = obj as Vertex;
            return this.index == other.index;
        }

        return false;
    }
}