export class BorderVertex
{
    public index: number;
    public hash: number;

    constructor(index: number, hash: number)
    {
        this.index = index;
        this.hash = hash;
    }
}

export class BorderVertexComparer
{
    public static readonly instance: BorderVertexComparer = new BorderVertexComparer();

    public Compare(x: BorderVertex, y: BorderVertex): number {
        return x.hash.CompareTo(y.hash);
    }
}