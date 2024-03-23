// <summary>
/// A symmetric matrix.
/// </summary>
export class SymmetricMatrix {
    public m0: number;
    public m1: number;
    public m2: number;
    public m3: number;
    public m4: number;
    public m5: number;
    public m6: number;
    public m7: number;
    public m8: number;
    public m9: number;

    // /// <summary>
    // /// Gets the component value with a specific index.
    // /// </summary>
    // /// <param name="index">The component index.</param>
    // /// <returns>The value.</returns>
    // public double this[int index]
    // {
    //     [MethodImpl(MethodImplOptions.AggressiveInlining)]
    //     get
    //     {
    //         switch (index)
    //         {
    //             case 0:
    //                 return m0;
    //             case 1:
    //                 return m1;
    //             case 2:
    //                 return m2;
    //             case 3:
    //                 return m3;
    //             case 4:
    //                 return m4;
    //             case 5:
    //                 return m5;
    //             case 6:
    //                 return m6;
    //             case 7:
    //                 return m7;
    //             case 8:
    //                 return m8;
    //             case 9:
    //                 return m9;
    //             default:
    //                 throw new ArgumentOutOfRangeException(nameof(index));
    //         }
    //     }
    // }

    /// <summary>
    /// Creates a symmetric matrix with a value in each component.
    /// </summary>
    /// <param name="c">The component value.</param>
    constructor(...args) {
        if (args.length == 0) {

        }
        else if (args.length == 1) {
            this.m0 = args[0];
            this.m1 = args[0];
            this.m2 = args[0];
            this.m3 = args[0];
            this.m4 = args[0];
            this.m5 = args[0];
            this.m6 = args[0];
            this.m7 = args[0];
            this.m8 = args[0];
            this.m9 = args[0];
        }
        else if (args.length == 10) {
        // /// <summary>
        // /// Creates a symmetric matrix.
        // /// </summary>
        // /// <param name="m0">The m11 component.</param>
        // /// <param name="m1">The m12 component.</param>
        // /// <param name="m2">The m13 component.</param>
        // /// <param name="m3">The m14 component.</param>
        // /// <param name="m4">The m22 component.</param>
        // /// <param name="m5">The m23 component.</param>
        // /// <param name="m6">The m24 component.</param>
        // /// <param name="m7">The m33 component.</param>
        // /// <param name="m8">The m34 component.</param>
        // /// <param name="m9">The m44 component.</param>
            this.m0 = args[0];
            this.m1 = args[1];
            this.m2 = args[2];
            this.m3 = args[3];
            this.m4 = args[4];
            this.m5 = args[5];
            this.m6 = args[6];
            this.m7 = args[7];
            this.m8 = args[8];
            this.m9 = args[9];
        }
        else if (args.length == 4) {
            // /// <summary>
            // /// Creates a symmetric matrix from a plane.
            // /// </summary>
            // /// <param name="a">The plane x-component.</param>
            // /// <param name="b">The plane y-component</param>
            // /// <param name="c">The plane z-component</param>
            // /// <param name="d">The plane w-component</param>
            const a = args[0];
            const b = args[1];
            const c = args[2];
            const d = args[3];
            this.m0 = a * a;
            this.m1 = a * b;
            this.m2 = a * c;
            this.m3 = a * d;

            this.m4 = b * b;
            this.m5 = b * c;
            this.m6 = b * d;

            this.m7 = c * c;
            this.m8 = c * d;

            this.m9 = d * d;
        }
        else {
            throw Error(`Invalid args ${args}`);
        }
    }
    // constructor(c: number) {
    //     this.m0 = c;
    //     this.m1 = c;
    //     this.m2 = c;
    //     this.m3 = c;
    //     this.m4 = c;
    //     this.m5 = c;
    //     this.m6 = c;
    //     this.m7 = c;
    //     this.m8 = c;
    //     this.m9 = c;
    // }

    // /// <summary>
    // /// Creates a symmetric matrix.
    // /// </summary>
    // /// <param name="m0">The m11 component.</param>
    // /// <param name="m1">The m12 component.</param>
    // /// <param name="m2">The m13 component.</param>
    // /// <param name="m3">The m14 component.</param>
    // /// <param name="m4">The m22 component.</param>
    // /// <param name="m5">The m23 component.</param>
    // /// <param name="m6">The m24 component.</param>
    // /// <param name="m7">The m33 component.</param>
    // /// <param name="m8">The m34 component.</param>
    // /// <param name="m9">The m44 component.</param>
    // constructor(m0: number, m1: number, m2: number, m3: number,
    //     m4: number, m5: number, m6: number, m7: number, m8: number, m9: number) {
    //     this.m0 = m0;
    //     this.m1 = m1;
    //     this.m2 = m2;
    //     this.m3 = m3;
    //     this.m4 = m4;
    //     this.m5 = m5;
    //     this.m6 = m6;
    //     this.m7 = m7;
    //     this.m8 = m8;
    //     this.m9 = m9;
    // }

    // /// <summary>
    // /// Creates a symmetric matrix from a plane.
    // /// </summary>
    // /// <param name="a">The plane x-component.</param>
    // /// <param name="b">The plane y-component</param>
    // /// <param name="c">The plane z-component</param>
    // /// <param name="d">The plane w-component</param>
    // constructor(a: number, b: number, c: number, d: number) {
    //     this.m0 = a * a;
    //     this.m1 = a * b;
    //     this.m2 = a * c;
    //     this.m3 = a * d;

    //     this.m4 = b * b;
    //     this.m5 = b * c;
    //     this.m6 = b * d;

    //     this.m7 = c * c;
    //     this.m8 = c * d;

    //     this.m9 = d * d;
    // }

    /// <summary>
    /// Adds two matrixes together.
    /// </summary>
    /// <param name="a">The left hand side.</param>
    /// <param name="b">The right hand side.</param>
    /// <returns>The resulting matrix.</returns>
    public static add(a: SymmetricMatrix, b: SymmetricMatrix) {
        return new SymmetricMatrix(
            a.m0 + b.m0, a.m1 + b.m1, a.m2 + b.m2, a.m3 + b.m3,
            a.m4 + b.m4, a.m5 + b.m5, a.m6 + b.m6,
            a.m7 + b.m7, a.m8 + b.m8,
            a.m9 + b.m9
        );
    }

    /// <summary>
    /// Determinant(0, 1, 2, 1, 4, 5, 2, 5, 7)
    /// </summary>
    /// <returns></returns>
    public Determinant1(): number {
        const det =
            this.m0 * this.m4 * this.m7 +
            this.m2 * this.m1 * this.m5 +
            this.m1 * this.m5 * this.m2 -
            this.m2 * this.m4 * this.m2 -
            this.m0 * this.m5 * this.m5 -
            this.m1 * this.m1 * this.m7;
        return det;
    }

    /// <summary>
    /// Determinant(1, 2, 3, 4, 5, 6, 5, 7, 8)
    /// </summary>
    /// <returns></returns>
    public Determinant2(): number {
        const det =
            this.m1 * this.m5 * this.m8 +
            this.m3 * this.m4 * this.m7 +
            this.m2 * this.m6 * this.m5 -
            this.m3 * this.m5 * this.m5 -
            this.m1 * this.m6 * this.m7 -
            this.m2 * this.m4 * this.m8;
        return det;
    }

    /// <summary>
    /// Determinant(0, 2, 3, 1, 5, 6, 2, 7, 8)
    /// </summary>
    /// <returns></returns>
    public Determinant3(): number {
        const det =
            this.m0 * this.m5 * this.m8 +
            this.m3 * this.m1 * this.m7 +
            this.m2 * this.m6 * this.m2 -
            this.m3 * this.m5 * this.m2 -
            this.m0 * this.m6 * this.m7 -
            this.m2 * this.m1 * this.m8;
        return det;
    }

    /// <summary>
    /// Determinant(0, 1, 3, 1, 4, 6, 2, 5, 8)
    /// </summary>
    /// <returns></returns>
    public Determinant4(): number {
        const det =
            this.m0 * this.m4 * this.m8 +
            this.m3 * this.m1 * this.m5 +
            this.m1 * this.m6 * this.m2 -
            this.m3 * this.m4 * this.m2 -
            this.m0 * this.m6 * this.m5 -
            this.m1 * this.m1 * this.m8;
        return det;
    }

    /// <summary>
    /// Computes the determinant of this matrix.
    /// </summary>
    /// <param name="a11">The a11 index.</param>
    /// <param name="a12">The a12 index.</param>
    /// <param name="a13">The a13 index.</param>
    /// <param name="a21">The a21 index.</param>
    /// <param name="a22">The a22 index.</param>
    /// <param name="a23">The a23 index.</param>
    /// <param name="a31">The a31 index.</param>
    /// <param name="a32">The a32 index.</param>
    /// <param name="a33">The a33 index.</param>
    /// <returns>The determinant value.</returns>
    public Determinant(a11: number, a12: number, a13: number,
        a21: number, a22: number, a23: number,
        a31: number, a32: number, a33: number): number {
        const det =
            this[a11] * this[a22] * this[a33] +
            this[a13] * this[a21] * this[a32] +
            this[a12] * this[a23] * this[a31] -
            this[a13] * this[a22] * this[a31] -
            this[a11] * this[a23] * this[a32] -
            this[a12] * this[a21] * this[a33];
        return det;
    }
}