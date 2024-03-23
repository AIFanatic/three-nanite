import { Vector3d } from "./Vector3d";

export class Triangle {
    public index: number;

    public v0: number;
    public v1: number;
    public v2: number;
    public subMeshIndex: number;

    public va0: number;
    public va1: number;
    public va2: number;

    public err0: number;
    public err1: number;
    public err2: number;
    public err3: number;

    public deleted: boolean;
    public dirty: boolean;
    public n: Vector3d;

    // public int this[int index]
    // {
    //     [MethodImpl(MethodImplOptions.AggressiveInlining)]
    //     get
    //     {
    //         return (index == 0 ? v0 : (index == 1 ? v1 : v2));
    //     }
    //     [MethodImpl(MethodImplOptions.AggressiveInlining)]
    //     set
    //     {
    //         switch (index)
    //         {
    //             case 0:
    //                 v0 = value;
    //                 break;
    //             case 1:
    //                 v1 = value;
    //                 break;
    //             case 2:
    //                 v2 = value;
    //                 break;
    //             default:
    //                 throw new ArgumentOutOfRangeException(nameof(index));
    //         }
    //     }
    // }

    constructor(index: number, v0: number, v1: number, v2: number, subMeshIndex: number) {
        this.index = index;

        this.v0 = v0;
        this.v1 = v1;
        this.v2 = v2;
        this.subMeshIndex = subMeshIndex;

        this.va0 = v0;
        this.va1 = v1;
        this.va2 = v2;

        this.err0 = 0;
        this.err1 = 0;
        this.err2 = 0;
        this.err3 = 0;
        this.deleted = false;
        this.dirty = false;
        this.n = new Vector3d();
    }

    public GetAttributeIndices(attributeIndices: number[]) {
        attributeIndices[0] = this.va0;
        attributeIndices[1] = this.va1;
        attributeIndices[2] = this.va2;
    }

    public SetAttributeIndex(index: number, value: number) {
        switch (index) {
            case 0:
                this.va0 = value;
                break;
            case 1:
                this.va1 = value;
                break;
            case 2:
                this.va2 = value;
                break;
            default:
                throw Error(index.toString());
        }
    }

    public GetErrors(err: number[]) {
        err[0] = this.err0;
        err[1] = this.err1;
        err[2] = this.err2;
    }

    public GetHashCode(): number {
        return this.index;
    }

    public Equals(obj: object | Triangle): boolean {
        if (obj instanceof Triangle) {
            var other = obj as Triangle;
            return this.index == other.index;
        }

        return false;
    }
}