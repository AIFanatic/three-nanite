import { Vector4 } from "three";
import { SymmetricMatrix } from "./SymmetricMatrix";
import { Vertex } from "./Vertex";
import { Triangle } from "./Triangle";
import { Vector3d } from "./Vector3d";
import { Ref } from "./Ref";
import { BorderVertex, BorderVertexComparer } from "./BorderVertex";

class MeshSimplifier {
    private TriangleEdgeCount: number = 3;
    private TriangleVertexCount: number = 3;
    private DoubleEpsilon: number = 1.0E-3;
    private static DenomEpilson: number = 0.00000001;

    private simplificationOptions: SimplificationOptions = SimplificationOptions.Default;
    private verbose: boolean = false;

    private subMeshCount: number = 0;
    private subMeshOffsets: number[] = null;
    private triangles: Triangle[] = null;
    private vertices: Vertex[] = null;
    private refs: Ref[] = null;

    private vertNormals: Vector3d[] = null;
    private vertTangents: Vector4[] = null;
    // private UVChannels<Vector2> vertUV2D: Vector2[] = null;
    // private UVChannels<Vector3d> vertUV3D: Vector3d[] = null;
    // private UVChannels<Vector4> vertUV4D: Vector4[] = null;
    // private ResizableArray<Color> vertColors: Color[] = null;
    // private ResizableArray<BoneWeight> vertBoneWeights: BoneWeight[] = null;
    // private ResizableArray<BlendShapeContainer> blendShapes: BlendShapeContainer[] = null;

    // private bindposes: Matrix4x4[] = null;

    // Pre-allocated buffers
    private readonly errArr: number[] = new Array(3);
    private readonly attributeIndexArr: number[] = new Array(3);
    private readonly triangleHashSet1: Set<Triangle> = new Set<Triangle>();
    private readonly triangleHashSet2: Set<Triangle> = new Set<Triangle>();

    /// <summary>
    /// Gets or sets all of the simplification options as a single block.
    /// Default value: SimplificationOptions.Default
    /// </summary>
    public get SimplificationOptions(): SimplificationOptions {
        return this.simplificationOptions;
    }
    public set SimplificationOptions(value: SimplificationOptions) {
        ValidateOptions(value);
        this.simplificationOptions = value;
    }

    /// <summary>
    /// Gets or sets if verbose information should be printed to the console.
    /// Default value: false
    /// </summary>
    public get Verbose(): boolean {
        return this.verbose;
    }

    public set Verbose(value: boolean) {
        this.verbose = value;
    }

    /// <summary>
    /// Gets or sets the vertex positions.
    /// </summary>
    public get Vertices(): Vector3d[] {
        const vertexCount = this.vertices.length;
        var vertices: Vector3d[] = new Array(vertexCount);
        var vertArr = this.vertices;
        for (let i = 0; i < vertexCount; i++) {
            vertices[i] = vertArr[i].p;
        }
        return vertices;
    }

    public set Vertices(value: Vector3d[]) {
        this.vertices = [];
        for (let i = 0; i < value.length; i++) {
            this.vertices.push(new Vertex(i, value[i]));
        }
    }


    /// <summary>
    /// Gets the count of sub-meshes.
    /// </summary>
    public get SubMeshCount(): number {
        return this.subMeshCount;
    }

    /// <summary>
    /// Gets or sets the vertex normals.
    /// </summary>
    public get Normals(): Vector3d[] {
        return (this.vertNormals != null ? this.vertNormals : null);
    }

    public set Normals(value: Vector3d[]) {
        this.InitializeVertexAttribute(value, this.vertNormals, "normals");
    }

    /// <summary>
    /// Creates a new mesh simplifier.
    /// </summary>
    constructor(mesh?: Mesh) {
        this.triangles = new Array<Triangle>(0);
        this.vertices = new Array<Vertex>(0);
        this.refs = new Array<Ref>(0);

        if (mesh != null) {
            this.Initialize(mesh);
        }
    }


    private InitializeVertexAttribute<T>(attributeValues: T[], attributeArray: Array<T>, attributeName: string) {
        if (attributeValues != null && attributeValues.length == this.vertices.length) {
            if (attributeArray == null) {
                attributeArray = new Array<T>(attributeValues.length, attributeValues.length);
            }
            else {
                attributeArray.length = attributeValues.length;
            }

            var arrayData = attributeArray;
            attributeValues = arrayData.slice(0, attributeValues.length);;
        }
        else {
            if (attributeValues != null && attributeValues.length > 0) {
                console.error("Failed to set vertex attribute '{0}' with {1} length of array, when {2} was needed.", attributeName, attributeValues.length, vertices.length);
            }
            attributeArray = null;
        }
    }

    private static VertexError(q: SymmetricMatrix, x: number, y: number, z: number): number {
        return q.m0 * x * x + 2 * q.m1 * x * y + 2 * q.m2 * x * z + 2 * q.m3 * x + q.m4 * y * y
            + 2 * q.m5 * y * z + 2 * q.m6 * y + q.m7 * z * z + 2 * q.m8 * z + q.m9;
    }

    private CurvatureError(vert0: Vertex, vert1: Vertex): number {
        const diffVector = Vector3d.sub(vert0.p, vert1.p).Magnitude;

        var trianglesWithViOrVjOrBoth = this.triangleHashSet1;
        trianglesWithViOrVjOrBoth.clear();
        this.GetTrianglesContainingVertex(vert0, trianglesWithViOrVjOrBoth);
        this.GetTrianglesContainingVertex(vert1, trianglesWithViOrVjOrBoth);

        var trianglesWithViAndVjBoth = this.triangleHashSet2;
        trianglesWithViAndVjBoth.clear();
        this.GetTrianglesContainingBothVertices(vert0, vert1, trianglesWithViAndVjBoth);

        let maxDotOuter = 0;
        for (var triangleWithViOrVjOrBoth of trianglesWithViOrVjOrBoth) {
            let maxDotInner = 0;
            const normVecTriangleWithViOrVjOrBoth: Vector3d = triangleWithViOrVjOrBoth.n;

            for (var triangleWithViAndVjBoth of trianglesWithViAndVjBoth) {
                const normVecTriangleWithViAndVjBoth: Vector3d = triangleWithViAndVjBoth.n;
                const dot = Vector3d.Dot(normVecTriangleWithViOrVjOrBoth, normVecTriangleWithViAndVjBoth);

                if (dot > maxDotInner)
                    maxDotInner = dot;
            }

            if (maxDotInner > maxDotOuter)
                maxDotOuter = maxDotInner;
        }

        return diffVector * maxDotOuter;
    }

    private CalculateError(vert0: Vertex, vert1: Vertex, result: Vector3d): number {
        // compute interpolated vertex
        const q: SymmetricMatrix = SymmetricMatrix.add(vert0.q, vert1.q);
        const borderEdge: boolean = (vert0.borderEdge && vert1.borderEdge);
        let error: number = 0.0;
        const det: number = q.Determinant1();
        if (det != 0.0 && !borderEdge) {
            // q_delta is invertible
            result = new Vector3d(
                -1.0 / det * q.Determinant2(),  // vx = A41/det(q_delta)
                1.0 / det * q.Determinant3(),   // vy = A42/det(q_delta)
                -1.0 / det * q.Determinant4()); // vz = A43/det(q_delta)

            let curvatureError: number = 0;
            if (this.simplificationOptions.PreserveSurfaceCurvature) {
                curvatureError = this.CurvatureError(vert0, vert1);
            }

            error = MeshSimplifier.VertexError(q, result.x, result.y, result.z) + curvatureError;
        }
        else {
            // det = 0 -> try to find best result
            const p1: Vector3d = vert0.p;
            const p2: Vector3d = vert1.p;
            const p3: Vector3d = Vector3d.mul(Vector3d.add(p1, p2), 0.5);
            const error1: number = MeshSimplifier.VertexError(q, p1.x, p1.y, p1.z);
            const error2: number = MeshSimplifier.VertexError(q, p2.x, p2.y, p2.z);
            const error3: number = MeshSimplifier.VertexError(q, p3.x, p3.y, p3.z);

            if (error1 < error2) {
                if (error1 < error3) {
                    error = error1;
                    result = p1;
                }
                else {
                    error = error3;
                    result = p3;
                }
            }
            else if (error2 < error3) {
                error = error2;
                result = p2;
            }
            else {
                error = error3;
                result = p3;
            }
        }
        return error;
    }

    private static CalculateBarycentricCoords(point: Vector3d, a: Vector3d, b: Vector3d, c: Vector3d, result: Vector3d) {
        const v0: Vector3d = Vector3d.sub(b, a);
        const v1: Vector3d = Vector3d.sub(c, a);
        const v2: Vector3d = Vector3d.sub(point, a);
        const d00: number = Vector3d.Dot(v0, v0);
        const d01: number = Vector3d.Dot(v0, v1);
        const d11: number = Vector3d.Dot(v1, v1);
        const d20: number = Vector3d.Dot(v2, v0);
        const d21: number = Vector3d.Dot(v2, v1);
        let denom: number = d00 * d11 - d01 * d01;

        // Make sure the denominator is not too small to cause math problems
        if (Math.abs(denom) < MeshSimplifier.DenomEpilson) {
            denom = MeshSimplifier.DenomEpilson;
        }

        const v: number = (d11 * d20 - d01 * d21) / denom;
        const w: number = (d00 * d21 - d01 * d20) / denom;
        const u: number = 1.0 - v - w;
        result = new Vector3d(u, v, w);
    }

    private NormalizeTangent(tangent: Vector4): Vector4 {
        var tangentVec = new Vector3d(tangent.x, tangent.y, tangent.z);
        tangentVec.Normalize();
        return new Vector4(tangentVec.x, tangentVec.y, tangentVec.z, tangent.w);
    }

    /// <summary>
    /// Check if a triangle flips when this edge is removed
    /// </summary>
    private Flipped(p: Vector3d, i0: number, i1: number, v0: Vertex, deleted: boolean[]): boolean {
        const tcount: number = v0.tcount;
        var refs = this.refs;
        var triangles = this.triangles;
        var vertices = this.vertices;
        for (let k = 0; k < tcount; k++) {
            const r: Ref = refs[v0.tstart + k];
            if (triangles[r.tid].deleted)
                continue;

            const s: number = r.tvertex;
            const id1: number = triangles[r.tid][(s + 1) % 3];
            const id2: number = triangles[r.tid][(s + 2) % 3];
            if (id1 == i1 || id2 == i1) {
                deleted[k] = true;
                continue;
            }

            const d1: Vector3d = Vector3d.sub(vertices[id1].p, p);
            d1.Normalize();
            const d2: Vector3d = Vector3d.sub(vertices[id2].p, p;);
            d2.Normalize();
            let dot = Vector3d.Dot(d1, d2);
            if (Math.abs(dot) > 0.999)
                return true;

            let n: Vector3d = new Vector3d();
            Vector3d.Cross(d1, d2, n);
            n.Normalize();
            deleted[k] = false;
            dot = Vector3d.Dot(n, triangles[r.tid].n);
            if (dot < 0.2)
                return true;
        }

        return false;
    }

    /// <summary>
    /// Update triangle connections and edge error after a edge is collapsed.
    /// </summary>
    private UpdateTriangles(i0: number, ia0: number, v: Vertex, deleted: boolean[], deletedTriangles: number) {
        let p: Vector3d;
        const tcount = v.tcount;
        var triangles = this.triangles;
        var vertices = this.vertices;
        for (let k = 0; k < tcount; k++) {
            const r: Ref = this.refs[v.tstart + k];
            const tid: number = r.tid;
            const t: Triangle = triangles[tid];
            if (t.deleted)
                continue;

            if (deleted[k]) {
                triangles[tid].deleted = true;
                ++deletedTriangles;
                continue;
            }

            t[r.tvertex] = i0;
            if (ia0 != -1) {
                t.SetAttributeIndex(r.tvertex, ia0);
            }

            t.dirty = true;
            t.err0 = this.CalculateError(vertices[t.v0], vertices[t.v1], p);
            t.err1 = this.CalculateError(vertices[t.v1], vertices[t.v2], p);
            t.err2 = this.CalculateError(vertices[t.v2], vertices[t.v0], p);
            t.err3 = MathHelper.Min(t.err0, t.err1, t.err2);
            triangles[tid] = t;
            this.refs.push(r);
        }
    }

    private InterpolateVertexAttributes(dst: number, i0: number, i1: number, i2: number, barycentricCoord: Vector3d) {
        if (this.vertNormals != null) {
            this.vertNormals[dst] = Vector3d.Normalize((this.vertNormals[i0] * barycentricCoord.x) + (this.vertNormals[i1] * barycentricCoord.y) + (this.vertNormals[i2] * barycentricCoord.z));
        }
        if (this.vertTangents != null) {
            this.vertTangents[dst] = this.NormalizeTangent((this.vertTangents[i0] * barycentricCoord.x) + (this.vertTangents[i1] * barycentricCoord.y) + (this.vertTangents[i2] * barycentricCoord.z));
        }
    }

    /// <summary>
    /// Remove vertices and mark deleted triangles
    /// </summary>
    private RemoveVertexPass(startTrisCount: number, targetTrisCount: number, threshold: number, deleted0: boolean[], deleted1: boolean[], deletedTris: number) {
        var triangles = this.triangles;
        const triangleCount: number = this.triangles.length;
        var vertices = this.vertices;

        let p: Vector3d = new Vector3d();
        let barycentricCoord: Vector3d = new Vector3d();
        for (let tid = 0; tid < triangleCount; tid++) {
            if (triangles[tid].dirty || triangles[tid].deleted || triangles[tid].err3 > threshold)
                continue;

            triangles[tid].GetErrors(this.errArr);
            triangles[tid].GetAttributeIndices(this.attributeIndexArr);
            for (let edgeIndex = 0; edgeIndex < this.TriangleEdgeCount; edgeIndex++) {
                if (this.errArr[edgeIndex] > threshold)
                    continue;

                const nextEdgeIndex: number = ((edgeIndex + 1) % this.TriangleEdgeCount);
                const i0: number = triangles[tid][edgeIndex];
                const i1: number = triangles[tid][nextEdgeIndex];

                // Border check
                if (vertices[i0].borderEdge != vertices[i1].borderEdge)
                    continue;
                // Seam check
                else if (vertices[i0].uvSeamEdge != vertices[i1].uvSeamEdge)
                    continue;
                // Foldover check
                else if (vertices[i0].uvFoldoverEdge != vertices[i1].uvFoldoverEdge)
                    continue;
                // If borders should be preserved
                else if (this.simplificationOptions.PreserveBorderEdges && vertices[i0].borderEdge)
                    continue;
                // If seams should be preserved
                else if (this.simplificationOptions.PreserveUVSeamEdges && vertices[i0].uvSeamEdge)
                    continue;
                // If foldovers should be preserved
                else if (this.simplificationOptions.PreserveUVFoldoverEdges && vertices[i0].uvFoldoverEdge)
                    continue;

                // Compute vertex to collapse to
                this.CalculateError(vertices[i0], vertices[i1], p);
                deleted0.length = vertices[i0].tcount; // normals temporarily
                deleted1.length = vertices[i1].tcount; // normals temporarily

                // Don't remove if flipped
                if (this.Flipped(p, i0, i1, vertices[i0], deleted0))
                    continue;
                if (this.Flipped(p, i1, i0, vertices[i1], deleted1))
                    continue;

                // Calculate the barycentric coordinates within the triangle
                const nextNextEdgeIndex: number = ((edgeIndex + 2) % 3);
                const i2: number = triangles[tid][nextNextEdgeIndex];
                MeshSimplifier.CalculateBarycentricCoords(p, vertices[i0].p, vertices[i1].p, vertices[i2].p, barycentricCoord);

                // Not flipped, so remove edge
                this.vertices[i0].p = p;
                this.vertices[i0].q = SymmetricMatrix.add(this.vertices[i0].q, this.vertices[i1].q);

                // Interpolate the vertex attributes
                let ia0: number = this.attributeIndexArr[edgeIndex];
                const ia1: number = this.attributeIndexArr[nextEdgeIndex];
                const ia2: number = this.attributeIndexArr[nextNextEdgeIndex];
                this.InterpolateVertexAttributes(ia0, ia0, ia1, ia2, barycentricCoord);

                if (vertices[i0].uvSeamEdge) {
                    ia0 = -1;
                }

                const tstart: number = this.refs.length;
                this.UpdateTriangles(i0, ia0, vertices[i0], deleted0, deletedTris);
                this.UpdateTriangles(i0, ia0, vertices[i1], deleted1, deletedTris);

                const tcount: number = this.refs.length - tstart;
                if (tcount <= vertices[i0].tcount) {
                    // save ram
                    if (tcount > 0) {
                        var refsArr = this.refs;
                        Array.Copy(refsArr, tstart, refsArr, vertices[i0].tstart, tcount);
                    }
                }
                else {
                    // append
                    vertices[i0].tstart = tstart;
                }

                vertices[i0].tcount = tcount;
                break;
            }

            // Check if we are already done
            if ((startTrisCount - deletedTris) <= targetTrisCount)
                break;
        }
    }

    /// <summary>
    /// Compact triangles, compute edge error and build reference list.
    /// </summary>
    /// <param name="iteration">The iteration index.</param>
    private UpdateMesh(iteration: number) {
        var triangles = this.triangles;
        var vertices = this.vertices;

        let triangleCount: number = this.triangles.length;
        const vertexCount: number = this.vertices.length;
        if (iteration > 0) // compact triangles
        {
            let dst = 0;
            for (let i = 0; i < triangleCount; i++) {
                if (!triangles[i].deleted) {
                    if (dst != i) {
                        triangles[dst] = triangles[i];
                        triangles[dst].index = dst;
                    }
                    dst++;
                }
            }
            this.triangles.length = dst;
            triangles = this.triangles;
            triangleCount = dst;
        }

        this.UpdateReferences();

        // Identify boundary : vertices[].border=0,1
        if (iteration == 0) {
            var refs = this.refs;

            var vcount = new Array(8);
            var vids = new Array(8);
            let vsize = 0;
            for (let i = 0; i < vertexCount; i++) {
                vertices[i].borderEdge = false;
                vertices[i].uvSeamEdge = false;
                vertices[i].uvFoldoverEdge = false;
            }

            let ofs: number;
            let id: number;
            let borderVertexCount: number = 0;
            let borderMinX: number = 20000000000000;
            let borderMaxX: number = 20000000000000;
            var vertexLinkDistanceSqr = this.simplificationOptions.VertexLinkDistance * this.simplificationOptions.VertexLinkDistance;
            for (let i = 0; i < vertexCount; i++) {
                const tstart: number = vertices[i].tstart;
                const tcount: number = vertices[i].tcount;
                vcount = [];
                vids = [];
                vsize = 0;

                for (let j = 0; j < tcount; j++) {
                    const tid: number = refs[tstart + j].tid;
                    for (let k = 0; k < this.TriangleVertexCount; k++) {
                        ofs = 0;
                        id = triangles[tid][k];
                        while (ofs < vsize) {
                            if (vids[ofs] == id)
                                break;

                            ++ofs;
                        }

                        if (ofs == vsize) {
                            vcount.push(1);
                            vids.push(id);
                            ++vsize;
                        }
                        else {
                            ++vcount[ofs];
                        }
                    }
                }

                for (let j = 0; j < vsize; j++) {
                    if (vcount[j] == 1) {
                        id = vids[j];
                        vertices[id].borderEdge = true;
                        ++borderVertexCount;

                        if (this.simplificationOptions.EnableSmartLink) {
                            if (vertices[id].p.x < borderMinX) {
                                borderMinX = vertices[id].p.x;
                            }
                            if (vertices[id].p.x > borderMaxX) {
                                borderMaxX = vertices[id].p.x;
                            }
                        }
                    }
                }
            }

            if (this.simplificationOptions.EnableSmartLink) {
                // First find all border vertices
                var borderVertices = new BorderVertex[borderVertexCount];
                let borderIndexCount: number = 0;
                const borderAreaWidth: number = borderMaxX - borderMinX;
                for (let i = 0; i < vertexCount; i++) {
                    if (vertices[i].borderEdge) {
                        const vertexHash: number = (int)(((((vertices[i].p.x - borderMinX) / borderAreaWidth) * 2.0) - 1.0) * int.MaxValue);
                        borderVertices[borderIndexCount] = new BorderVertex(i, vertexHash);
                        ++borderIndexCount;
                    }
                }

                // Sort the border vertices by hash
                Array.Sort(borderVertices, 0, borderIndexCount, BorderVertexComparer.instance);

                // Calculate the maximum hash distance based on the maximum vertex link distance
                const vertexLinkDistance: number = Math.sqrt(vertexLinkDistanceSqr);
                const hashMaxDistance: number = Math.max((int)((vertexLinkDistance / borderAreaWidth) * int.MaxValue), 1);

                // Then find identical border vertices and bind them together as one
                for (let i = 0; i < borderIndexCount; i++) {
                    const myIndex: number = borderVertices[i].index;
                    if (myIndex == -1)
                        continue;

                    var myPoint = vertices[myIndex].p;
                    for (let j = i + 1; j < borderIndexCount; j++) {
                        const otherIndex: number = borderVertices[j].index;
                        if (otherIndex == -1)
                            continue;
                        else if ((borderVertices[j].hash - borderVertices[i].hash) > hashMaxDistance) // There is no point to continue beyond this point
                            break;

                        var otherPoint = vertices[otherIndex].p;
                        var sqrX = ((myPoint.x - otherPoint.x) * (myPoint.x - otherPoint.x));
                        var sqrY = ((myPoint.y - otherPoint.y) * (myPoint.y - otherPoint.y));
                        var sqrZ = ((myPoint.z - otherPoint.z) * (myPoint.z - otherPoint.z));
                        var sqrMagnitude = sqrX + sqrY + sqrZ;

                        if (sqrMagnitude <= vertexLinkDistanceSqr) {
                            borderVertices[j].index = -1; // NOTE: This makes sure that the "other" vertex is not processed again
                            vertices[myIndex].borderEdge = false;
                            vertices[otherIndex].borderEdge = false;

                            // if (AreUVsTheSame(0, myIndex, otherIndex)) {
                            //     vertices[myIndex].uvFoldoverEdge = true;
                            //     vertices[otherIndex].uvFoldoverEdge = true;
                            // }
                            // else {
                                vertices[myIndex].uvSeamEdge = true;
                                vertices[otherIndex].uvSeamEdge = true;
                            // }

                            const otherTriangleCount: number = vertices[otherIndex].tcount;
                            const otherTriangleStart: number = vertices[otherIndex].tstart;
                            for (let k = 0; k < otherTriangleCount; k++) {
                                var r = refs[otherTriangleStart + k];
                                triangles[r.tid][r.tvertex] = myIndex;
                            }
                        }
                    }
                }

                // Update the references again
                this.UpdateReferences();
            }

            // Init Quadrics by Plane & Edge Errors
            //
            // required at the beginning ( iteration == 0 )
            // recomputing during the simplification is not required,
            // but mostly improves the result for closed meshes
            for (let i = 0; i < vertexCount; i++) {
                vertices[i].q = new SymmetricMatrix();
            }

            let v0: number;
            let v1: number;
            let v2: number;
            let n: Vector3d = new Vector3d();
            let p0: Vector3d = new Vector3d();
            let p1: Vector3d = new Vector3d();
            let p2: Vector3d = new Vector3d();
            let p10: Vector3d = new Vector3d();
            let p20: Vector3d = new Vector3d();
            let dummy: Vector3d = new Vector3d();
            let sm: SymmetricMatrix = new SymmetricMatrix();
            for (let i = 0; i < triangleCount; i++) {
                v0 = triangles[i].v0;
                v1 = triangles[i].v1;
                v2 = triangles[i].v2;

                p0 = vertices[v0].p;
                p1 = vertices[v1].p;
                p2 = vertices[v2].p;
                p10 = Vector3d.sub(p1, p0);
                p20 = Vector3d.sub(p2, p0);
                Vector3d.Cross(p10, p20, n);
                n.Normalize();
                triangles[i].n = n;

                sm = new SymmetricMatrix(n.x, n.y, n.z, -Vector3d.Dot(n, p0));
                vertices[v0].q = SymmetricMatrix.add(vertices[v0].q, sm);
                vertices[v1].q = SymmetricMatrix.add(vertices[v1].q, sm);
                vertices[v2].q = SymmetricMatrix.add(vertices[v2].q, sm);
            }

            for (let i = 0; i < triangleCount; i++) {
                // Calc Edge Error
                var triangle = triangles[i];
                triangles[i].err0 = this.CalculateError(vertices[triangle.v0], vertices[triangle.v1], dummy);
                triangles[i].err1 = this.CalculateError(vertices[triangle.v1], vertices[triangle.v2], dummy);
                triangles[i].err2 = this.CalculateError(vertices[triangle.v2], vertices[triangle.v0], dummy);
                triangles[i].err3 = Math.min(triangles[i].err0, triangles[i].err1, triangles[i].err2);
            }
        }
    }

    private UpdateReferences() {
        const triangleCount = this.triangles.length;
        const vertexCount = this.vertices.length;
        var triangles = this.triangles;
        var vertices = this.vertices;

        // Init Reference ID list
        for (let i = 0; i < vertexCount; i++) {
            vertices[i].tstart = 0;
            vertices[i].tcount = 0;
        }

        for (let i = 0; i < triangleCount; i++) {
            ++vertices[triangles[i].v0].tcount;
            ++vertices[triangles[i].v1].tcount;
            ++vertices[triangles[i].v2].tcount;
        }

        let tstart: number = 0;
        for (let i = 0; i < vertexCount; i++) {
            vertices[i].tstart = tstart;
            tstart += vertices[i].tcount;
            vertices[i].tcount = 0;
        }

        // Write References
        this.refs.length = tstart;
        var refs = this.refs;
        for (let i = 0; i < triangleCount; i++) {
            const v0: number = triangles[i].v0;
            const v1: number = triangles[i].v1;
            const v2: number = triangles[i].v2;
            const start0: number = vertices[v0].tstart;
            const count0: number = vertices[v0].tcount++;
            const start1: number = vertices[v1].tstart;
            const count1: number = vertices[v1].tcount++;
            const start2: number = vertices[v2].tstart;
            const count2: number = vertices[v2].tcount++;

            refs[start0 + count0].Set(i, 0);
            refs[start1 + count1].Set(i, 1);
            refs[start2 + count2].Set(i, 2);
        }
    }

    /// <summary>
    /// Finally compact mesh before exiting.
    /// </summary>
    private CompactMesh() {
        let dst = 0;
        var vertices = this.vertices;
        let vertexCount = this.vertices.length;
        for (let i = 0; i < vertexCount; i++) {
            vertices[i].tcount = 0;
        }

        var vertNormals = (this.vertNormals != null ? this.vertNormals : null);
        var vertTangents = (this.vertTangents != null ? this.vertTangents : null);

        let lastSubMeshIndex = -1;
        this.subMeshOffsets = new Array(this.subMeshCount);

        var triangles = this.triangles;
        let triangleCount = this.triangles.length;
        for (let i = 0; i < triangleCount; i++) {
            var triangle = triangles[i];
            if (!triangle.deleted) {
                if (triangle.va0 != triangle.v0) {
                    const iDest = triangle.va0;
                    const iSrc = triangle.v0;
                    vertices[iDest].p = vertices[iSrc].p;
                    triangle.v0 = triangle.va0;
                }
                if (triangle.va1 != triangle.v1) {
                    const iDest = triangle.va1;
                    const iSrc = triangle.v1;
                    vertices[iDest].p = vertices[iSrc].p;
                    triangle.v1 = triangle.va1;
                }
                if (triangle.va2 != triangle.v2) {
                    const iDest = triangle.va2;
                    const iSrc = triangle.v2;
                    vertices[iDest].p = vertices[iSrc].p;
                    triangle.v2 = triangle.va2;
                }
                const newTriangleIndex = dst++;
                triangles[newTriangleIndex] = triangle;
                triangles[newTriangleIndex].index = newTriangleIndex;

                vertices[triangle.v0].tcount = 1;
                vertices[triangle.v1].tcount = 1;
                vertices[triangle.v2].tcount = 1;

                if (triangle.subMeshIndex > lastSubMeshIndex) {
                    for (let j = lastSubMeshIndex + 1; j < triangle.subMeshIndex; j++) {
                        this.subMeshOffsets[j] = newTriangleIndex;
                    }
                    this.subMeshOffsets[triangle.subMeshIndex] = newTriangleIndex;
                    lastSubMeshIndex = triangle.subMeshIndex;
                }
            }
        }

        triangleCount = dst;
        for (let i = lastSubMeshIndex + 1; i < this.subMeshCount; i++) {
            this.subMeshOffsets[i] = triangleCount;
        }

        this.triangles.length = triangleCount; // Array.Resize hack
        triangles = this.triangles;

        dst = 0;
        for (let i = 0; i < vertexCount; i++) {
            var vert = vertices[i];
            if (vert.tcount > 0) {
                vertices[i].tstart = dst;

                if (dst != i) {
                    vertices[dst].index = dst;
                    vertices[dst].p = vert.p;
                    if (vertNormals != null) vertNormals[dst] = vertNormals[i];
                    if (vertTangents != null) vertTangents[dst] = vertTangents[i];
                }
                ++dst;
            }
        }

        for (let i = 0; i < triangleCount; i++) {
            var triangle = triangles[i];
            triangle.v0 = vertices[triangle.v0].tstart;
            triangle.v1 = vertices[triangle.v1].tstart;
            triangle.v2 = vertices[triangle.v2].tstart;
            triangles[i] = triangle;
        }

        vertexCount = dst;
        this.vertices.length = vertexCount;
        if (vertNormals != null) this.vertNormals.length = vertexCount;
        if (vertTangents != null) this.vertTangents.length = vertexCount;
    }

    private CalculateSubMeshOffsets() {
        let lastSubMeshIndex = -1;
        this.subMeshOffsets = new Array(this.subMeshCount);

        var triangles = this.triangles;
        const triangleCount = this.triangles.length;
        for (let i = 0; i < triangleCount; i++) {
            var triangle = triangles[i];
            if (triangle.subMeshIndex > lastSubMeshIndex) {
                for (let j = lastSubMeshIndex + 1; j < triangle.subMeshIndex; j++) {
                    this.subMeshOffsets[j] = i;
                }
                this.subMeshOffsets[triangle.subMeshIndex] = i;
                lastSubMeshIndex = triangle.subMeshIndex;
            }
        }

        for (let i = lastSubMeshIndex + 1; i < this.subMeshCount; i++) {
            this.subMeshOffsets[i] = triangleCount;
        }
    }

    private GetTrianglesContainingVertex(vert: Vertex, tris: Set<Triangle>) {
        const trianglesCount = vert.tcount;
        const startIndex = vert.tstart;

        for (let a = startIndex; a < startIndex + trianglesCount; a++) {
            tris.add(this.triangles[this.refs[a].tid]);
        }
    }

    private GetTrianglesContainingBothVertices(vert0: Vertex, vert1: Vertex, tris: Set<Triangle>) {
        const triangleCount = vert0.tcount;
        const startIndex = vert0.tstart;

        for (let refIndex = startIndex; refIndex < (startIndex + triangleCount); refIndex++) {
            const tid = this.refs[refIndex].tid;
            const tri: Triangle = this.triangles[tid];

            if (this.vertices[tri.v0].index == vert1.index ||
                this.vertices[tri.v1].index == vert1.index ||
                this.vertices[tri.v2].index == vert1.index) {
                tris.add(tri);
            }
        }
    }
    /// <summary>
    /// Returns the triangle indices for all sub-meshes.
    /// </summary>
    /// <returns>The triangle indices for all sub-meshes.</returns>
    public GetAllSubMeshTriangles(): number[][] {
        var indices = new Array(this.subMeshCount).fill(0).map(v => new Array());
        for (let subMeshIndex = 0; subMeshIndex < this.subMeshCount; subMeshIndex++) {
            indices[subMeshIndex] = this.GetSubMeshTriangles(subMeshIndex);
        }
        return indices;
    }

    /// <summary>
    /// Returns the triangle indices for a specific sub-mesh.
    /// </summary>
    /// <param name="subMeshIndex">The sub-mesh index.</param>
    /// <returns>The triangle indices.</returns>
    public GetSubMeshTriangles(subMeshIndex: number): number[] {
        if (subMeshIndex < 0)
            throw Error("The sub-mesh index is negative.");

        // First get the sub-mesh offsets
        if (this.subMeshOffsets == null) {
            this.CalculateSubMeshOffsets();
        }

        if (subMeshIndex >= this.subMeshOffsets.length)
            throw Error("The sub-mesh index is greater than or equals to the sub mesh count.");
        else if (this.subMeshOffsets.length != this.subMeshCount)
            throw Error("The sub-mesh triangle offsets array is not the same size as the count of sub-meshes. This should not be possible to happen.");

        var triangles = this.triangles;
        const triangleCount: number = this.triangles.length;

        const startOffset = this.subMeshOffsets[subMeshIndex];
        if (startOffset >= triangleCount)
            return [];

        const endOffset: number = ((subMeshIndex + 1) < this.subMeshCount ? this.subMeshOffsets[subMeshIndex + 1] : triangleCount);
        let subMeshTriangleCount: number = endOffset - startOffset;
        if (subMeshTriangleCount < 0) subMeshTriangleCount = 0;
        const subMeshIndices: number[] = new Array(subMeshTriangleCount * 3);

        console.log(startOffset >= 0, "The start sub mesh offset at index {0} was below zero ({1}).", subMeshIndex, startOffset);
        console.log(endOffset >= 0, "The end sub mesh offset at index {0} was below zero ({1}).", subMeshIndex + 1, endOffset);
        console.log(startOffset < triangleCount, "The start sub mesh offset at index {0} was higher or equal to the triangle count ({1} >= {2}).", subMeshIndex, startOffset, triangleCount);
        console.log(endOffset <= triangleCount, "The end sub mesh offset at index {0} was higher than the triangle count ({1} > {2}).", subMeshIndex + 1, endOffset, triangleCount);

        for (let triangleIndex = startOffset; triangleIndex < endOffset; triangleIndex++) {
            var triangle = triangles[triangleIndex];
            const offset = (triangleIndex - startOffset) * 3;
            subMeshIndices[offset] = triangle.v0;
            subMeshIndices[offset + 1] = triangle.v1;
            subMeshIndices[offset + 2] = triangle.v2;
        }

        return subMeshIndices;
    }

    /// <summary>
    /// Clears out all sub-meshes.
    /// </summary>
    public ClearSubMeshes() {
        this.subMeshCount = 0;
        this.subMeshOffsets = null;
        this.triangles = [];
    }

    /// <summary>
    /// Adds a sub-mesh triangle indices for a specific sub-mesh.
    /// </summary>
    /// <param name="triangles">The triangle indices.</param>
    public AddSubMeshTriangles(triangles: number[]) {
        if (triangles == null)
            throw Error(triangles);
        else if ((triangles.length % this.TriangleVertexCount) != 0)
            throw Error("The index array length must be a multiple of 3 in order to represent triangles.");

        const subMeshIndex: number = this.subMeshCount++;
        const triangleIndexStart: number = this.triangles.length;
        const subMeshTriangleCount: number = triangles.length / this.TriangleVertexCount;
        this.triangles.length = this.triangles.length + subMeshTriangleCount;
        var trisArr = this.triangles;
        for (let i = 0; i < subMeshTriangleCount; i++) {
            const offset: number = i * 3;
            const v0: number = triangles[offset];
            const v1: number = triangles[offset + 1];
            const v2: number = triangles[offset + 2];
            const triangleIndex: number = triangleIndexStart + i;
            trisArr[triangleIndex] = new Triangle(triangleIndex, v0, v1, v2, subMeshIndex);
        }
    }

    /// <summary>
    /// Adds several sub-meshes at once with their triangle indices for each sub-mesh.
    /// </summary>
    /// <param name="triangles">The triangle indices for each sub-mesh.</param>
    public AddSubMeshTriangles(triangles: number[][]) {
        if (triangles == null)
            throw Error(triangles);

        let totalTriangleCount = 0;
        for (let i = 0; i < triangles.length; i++) {
            if (triangles[i] == null)
                throw Error("The index array at index {0} is null." + i);
            else if ((triangles[i].length % this.TriangleVertexCount) != 0)
                throw Error("The index array length at index {0} must be a multiple of 3 in order to represent triangles." + i);

            totalTriangleCount += triangles[i].length / this.TriangleVertexCount;
        }

        let triangleIndexStart = this.triangles.length;
        this.triangles.length = this.triangles.length + totalTriangleCount;
        var trisArr = this.triangles;

        for (let i = 0; i < triangles.length; i++) {
            const subMeshIndex: number = this.subMeshCount++;
            var subMeshTriangles = triangles[i];
            const subMeshTriangleCount: number = subMeshTriangles.length / this.TriangleVertexCount;
            for (let j = 0; j < subMeshTriangleCount; j++) {
                const offset: number = j * 3;
                const v0: number = subMeshTriangles[offset];
                const v1: number = subMeshTriangles[offset + 1];
                const v2: number = subMeshTriangles[offset + 2];
                const triangleIndex: number = triangleIndexStart + j;
                trisArr[triangleIndex] = new Triangle(triangleIndex, v0, v1, v2, subMeshIndex);
            }

            triangleIndexStart += subMeshTriangleCount;
        }
    }

    /// <summary>
    /// Initializes the algorithm with the original mesh.
    /// </summary>
    /// <param name="mesh">The mesh.</param>
    public Initialize(mesh: Mesh) {
        if (mesh == null)
            throw Error(mesh);

        this.Vertices = mesh.vertices;

        this.ClearSubMeshes();

        const subMeshCount = mesh.subMeshCount;
        var subMeshTriangles = new Array(subMeshCount).fill(0).map(v => []);
        for (let i = 0; i < subMeshCount; i++) {
            subMeshTriangles[i] = mesh.GetTriangles(i);
        }
        this.AddSubMeshTriangles(subMeshTriangles);
    }

    /// <summary>
    /// Simplifies the mesh to a desired quality.
    /// </summary>
    /// <param name="quality">The target quality (between 0 and 1).</param>
    public SimplifyMesh(quality: number) {
        quality = Mathf.Clamp01(quality);

        const deletedTris = 0;
        const deleted0: boolean[] = new Array<boolean>(20);
        const deleted1: boolean[] = new Array<boolean>(20);
        var triangles = this.triangles;
        let triangleCount: number = this.triangles.length;
        const startTrisCount: number = triangleCount;
        var vertices = this.vertices;
        const targetTrisCount = Math.round(triangleCount * quality);

        for (let iteration = 0; iteration < this.simplificationOptions.MaxIterationCount; iteration++) {
            if ((startTrisCount - deletedTris) <= targetTrisCount)
                break;

            // Update mesh once in a while
            if ((iteration % 5) == 0) {
                this.UpdateMesh(iteration);
                triangles = this.triangles;
                triangleCount = this.triangles.length;
                vertices = this.vertices;
            }

            // Clear dirty flag
            for (let i = 0; i < triangleCount; i++) {
                triangles[i].dirty = false;
            }

            // All triangles with edges below the threshold will be removed
            //
            // The following numbers works well for most models.
            // If it does not, try to adjust the 3 parameters
            const threshold = 0.000000001 * Math.pow(iteration + 3, this.simplificationOptions.Agressiveness);

            if (this.verbose) {
                console.log("iteration {0} - triangles {1} threshold {2}", iteration, (startTrisCount - deletedTris), threshold);
            }

            // Remove vertices & mark deleted triangles
            this.RemoveVertexPass(startTrisCount, targetTrisCount, threshold, deleted0, deleted1, deletedTris);
        }

        this.CompactMesh();

        if (this.verbose) {
            console.log("Finished simplification with triangle count {0}", this.triangles.length);
        }
    }

    /// <summary>
    /// Simplifies the mesh without losing too much quality.
    /// </summary>
    public SimplifyMeshLossless() {
        let deletedTris = 0;
        const deleted0: boolean[] = new Array<boolean>(0);
        const deleted1: boolean[] = new Array<boolean>(0);
        var triangles = this.triangles;
        let triangleCount = this.triangles.length;
        const startTrisCount = triangleCount;
        var vertices = this.vertices;

        for (let iteration = 0; iteration < 9999; iteration++) {
            // Update mesh constantly
            this.UpdateMesh(iteration);
            triangles = this.triangles;
            triangleCount = this.triangles.length;
            vertices = this.vertices;

            // Clear dirty flag
            for (let i = 0; i < triangleCount; i++) {
                triangles[i].dirty = false;
            }

            // All triangles with edges below the threshold will be removed
            //
            // The following numbers works well for most models.
            // If it does not, try to adjust the 3 parameters
            const threshold = this.DoubleEpsilon;

            if (this.verbose) {
                console.log("Lossless iteration {0} - triangles {1}", iteration, triangleCount);
            }

            // Remove vertices & mark deleted triangles
            this.RemoveVertexPass(startTrisCount, 0, threshold, deleted0, deleted1, deletedTris);

            if (deletedTris <= 0)
                break;

            deletedTris = 0;
        }

        this.CompactMesh();

        if (this.verbose) {
            console.log("Finished simplification with triangle count {0}", this.triangles.length);
        }
    }

    /// <summary>
    /// Returns the resulting mesh.
    /// </summary>
    /// <returns>The resulting mesh.</returns>
    public ToMesh(): {vertices: Vector3d[], indices: number[][]} {
        var vertices = this.Vertices;
        var indices = this.GetAllSubMeshTriangles();

        return {vertices: vertices, indices: indices};
    }
}