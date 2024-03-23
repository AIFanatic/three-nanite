
/// <summary>
/// A double precision 3D vector.
/// </summary>
export class Vector3d {
    /// <summary>
    /// The zero vector.
    /// </summary>
    public static readonly zero: Vector3d = new Vector3d(0, 0, 0);

    /// <summary>
    /// The vector epsilon.
    /// </summary>
    public Epsilon: number = 4.94065645841247E-324; // double.Epsilon

    /// <summary>
    /// The x component.
    /// </summary>
    public x: number;
    /// <summary>
    /// The y component.
    /// </summary>
    public y: number;
    /// <summary>
    /// The z component.
    /// </summary>
    public z: number;

    /// <summary>
    /// Gets the magnitude of this vector.
    /// </summary>
    public get Magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /// <summary>
    /// Gets the squared magnitude of this vector.
    /// </summary>
    public get MagnitudeSqr(): number {
        return (this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /// <summary>
    /// Gets a normalized vector from this vector.
    /// </summary>
    public get Normalized(): Vector3d {
        let result: Vector3d = new Vector3d();
        Vector3d.Normalize(this, result);
        return result;
    }

    // /// <summary>
    // /// Gets or sets a specific component by index in this vector.
    // /// </summary>
    // /// <param name="index">The component index.</param>
    // public double this[int index]
    // {
    //     [MethodImpl(MethodImplOptions.AggressiveInlining)]
    //     get
    //     {
    //         switch (index)
    //         {
    //             case 0:
    //                 return x;
    //             case 1:
    //                 return y;
    //             case 2:
    //                 return z;
    //             default:
    //                 throw new ArgumentOutOfRangeException(nameof(index), "Invalid Vector3d index!");
    //         }
    //     }
    //     [MethodImpl(MethodImplOptions.AggressiveInlining)]
    //     set
    //     {
    //         switch (index)
    //         {
    //             case 0:
    //                 x = value;
    //                 break;
    //             case 1:
    //                 y = value;
    //                 break;
    //             case 2:
    //                 z = value;
    //                 break;
    //             default:
    //                 throw new ArgumentOutOfRangeException(nameof(index), "Invalid Vector3d index!");
    //         }
    //     }
    // }
    *[Symbol.iterator]() {
        yield this.x;
        yield this.y;
        yield this.z;
    }

    constructor(x?: number | Vector3d, y?: number, z?: number) {
        if (!x && !y && z) {
            this.x = 0;
            this.y = 0;
            this.z = 0;
        }
        else if (x instanceof Vector3d) {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
        }
        else if (x && y && z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        else if (x) {
            this.x = x;
            this.y = x;
            this.z = x;
        }

        throw Error(`Invalid constructor: ${x} ${y} ${z}`);
    }

    /// <summary>
    /// Adds two vectors.
    /// </summary>
    /// <param name="a">The first vector.</param>
    /// <param name="b">The second vector.</param>
    /// <returns>The resulting vector.</returns>
    public static add(a: Vector3d, b: Vector3d): Vector3d {
        return new Vector3d(a.x + b.x, a.y + b.y, a.z + b.z);
    }

    /// <summary>
    /// Subtracts two vectors.
    /// </summary>
    /// <param name="a">The first vector.</param>
    /// <param name="b">The second vector.</param>
    /// <returns>The resulting vector.</returns>
    public static sub(a: Vector3d, b: Vector3d): Vector3d {
        return new Vector3d(a.x - b.x, a.y - b.y, a.z - b.z);
    }

    /// <summary>
    /// Scales the vector uniformly.
    /// </summary>
    /// <param name="a">The vector.</param>
    /// <param name="d">The scaling value.</param>
    /// <returns>The resulting vector.</returns>
    public static mul(a: Vector3d, d: number): Vector3d {
        return new Vector3d(a.x * d, a.y * d, a.z * d);
    }

    /// <summary>
    /// Scales the vector uniformly.
    /// </summary>
    /// <param name="d">The scaling vlaue.</param>
    /// <param name="a">The vector.</param>
    /// <returns>The resulting vector.</returns>
    public static mul2(d: number, a: Vector3d): Vector3d {
        return new Vector3d(a.x * d, a.y * d, a.z * d);
    }

    /// <summary>
    /// Divides the vector with a float.
    /// </summary>
    /// <param name="a">The vector.</param>
    /// <param name="d">The dividing float value.</param>
    /// <returns>The resulting vector.</returns>
    public static div(a: Vector3d, d: number): Vector3d {
        return new Vector3d(a.x / d, a.y / d, a.z / d);
    }

    /// <summary>
    /// Subtracts the vector from a zero vector.
    /// </summary>
    /// <param name="a">The vector.</param>
    /// <returns>The resulting vector.</returns>
    public static subZero(a: Vector3d) {
        return new Vector3d(-a.x, -a.y, -a.z);
    }

    /// <summary>
    /// Returns if two vectors equals eachother.
    /// </summary>
    /// <param name="lhs">The left hand side vector.</param>
    /// <param name="rhs">The right hand side vector.</param>
    /// <returns>If equals.</returns>
    public static equal(lhs: Vector3d, rhs: Vector3d): boolean {
        return Vector3d.sub(lhs, rhs).MagnitudeSqr < Epsilon;
    }

    /// <summary>
    /// Returns if two vectors don't equal eachother.
    /// </summary>
    /// <param name="lhs">The left hand side vector.</param>
    /// <param name="rhs">The right hand side vector.</param>
    /// <returns>If not equals.</returns>
    public static notEqual(lhs: Vector3d, rhs: Vector3d): boolean {
        return Vector3d.sub(lhs, rhs).MagnitudeSqr >= Epsilon;
    }

    /// <summary>
    /// Set x, y and z components of an existing vector.
    /// </summary>
    /// <param name="x">The x value.</param>
    /// <param name="y">The y value.</param>
    /// <param name="z">The z value.</param>
    public Set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /// <summary>
    /// Multiplies with another vector component-wise.
    /// </summary>
    /// <param name="scale">The vector to multiply with.</param>
    public Scale(scale: Vector3d) {
        this.x *= scale.x;
        this.y *= scale.y;
        this.z *= scale.z;
    }

    /// <summary>
    /// Normalizes this vector.
    /// </summary>
    public Normalize() {
        const mag = this.Magnitude;
        if (mag > Epsilon) {
            this.x /= mag;
            this.y /= mag;
            this.z /= mag;
        }
        else {
            this.x = 0;
            this.y = 0;
            this.z = 0;
        }
    }

    /// <summary>
    /// Clamps this vector between a specific range.
    /// </summary>
    /// <param name="min">The minimum component value.</param>
    /// <param name="max">The maximum component value.</param>
    public Clamp(min: number, max: number) {
        if (this.x < min) this.x = min;
        else if (this.x > max) this.x = max;

        if (this.y < min) this.y = min;
        else if (this.y > max) this.y = max;

        if (this.z < min) this.z = min;
        else if (this.z > max) this.z = max;
    }

    /// <summary>
    /// Returns a hash code for this vector.
    /// </summary>
    /// <returns>The hash code.</returns>
    public override GetHashCode(): number {
        return this.x.GetHashCode() ^ this.y.GetHashCode() << 2 ^ this.z.GetHashCode() >> 2;
    }

    /// <summary>
    /// Returns if this vector is equal to another one.
    /// </summary>
    /// <param name="obj">The other vector to compare to.</param>
    /// <returns>If equals.</returns>
    public Equals(obj: object): boolean {
        if (!(obj instanceof Vector3d)) {
            return false;
        }
        const vector = obj as Vector3d;
        return (this.x == vector.x && this.y == vector.y && this.z == vector.z);
    }

    /// <summary>
    /// Returns if this vector is equal to another one.
    /// </summary>
    /// <param name="other">The other vector to compare to.</param>
    /// <returns>If equals.</returns>
    public Equals(other: Vector3d): boolean {
        return (this.x == other.x && this.y == other.y && this.z == other.z);
    }

    /// <summary>
    /// Returns a nicely formatted string for this vector.
    /// </summary>
    /// <returns>The string.</returns>
    public ToString(): string {
        return `(${this.x}, ${this.y}, ${this.z})`;
    }

    /// <summary>
    /// Dot Product of two vectors.
    /// </summary>
    /// <param name="lhs">The left hand side vector.</param>
    /// <param name="rhs">The right hand side vector.</param>
    public static Dot(lhs: Vector3d, rhs: Vector3d): number {
        return lhs.x * rhs.x + lhs.y * rhs.y + lhs.z * rhs.z;
    }

    /// <summary>
    /// Cross Product of two vectors.
    /// </summary>
    /// <param name="lhs">The left hand side vector.</param>
    /// <param name="rhs">The right hand side vector.</param>
    /// <param name="result">The resulting vector.</param>
    public static Cross(lhs: Vector3d, rhs: Vector3d, result: Vector3d) {
        result = new Vector3d(lhs.y * rhs.z - lhs.z * rhs.y, lhs.z * rhs.x - lhs.x * rhs.z, lhs.x * rhs.y - lhs.y * rhs.x);
    }

    /// <summary>
    /// Calculates the angle between two vectors.
    /// </summary>
    /// <param name="from">The from vector.</param>
    /// <param name="to">The to vector.</param>
    /// <returns>The angle.</returns>
    public static Angle(from: Vector3d, to: Vector3d): number {
        const fromNormalized: Vector3d = from.Normalized;
        const toNormalized: Vector3d = to.Normalized;
        return Math.acos(MathHelper.Clamp(Vector3d.Dot(fromNormalized, toNormalized), -1.0, 1.0)) * MathHelper.Rad2Degd;
    }

    /// <summary>
    /// Performs a linear interpolation between two vectors.
    /// </summary>
    /// <param name="a">The vector to interpolate from.</param>
    /// <param name="b">The vector to interpolate to.</param>
    /// <param name="t">The time fraction.</param>
    /// <param name="result">The resulting vector.</param>
    public static Lerp(a: Vector3d, b: Vector3d, t: number, result: Vector3d) {
        result = new Vector3d(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    }

    /// <summary>
    /// Multiplies two vectors component-wise.
    /// </summary>
    /// <param name="a">The first vector.</param>
    /// <param name="b">The second vector.</param>
    /// <param name="result">The resulting vector.</param>
    public static Scale(a: Vector3d, b: Vector3d, result: Vector3d) {
        result = new Vector3d(a.x * b.x, a.y * b.y, a.z * b.z);
    }

    /// <summary>
    /// Normalizes a vector.
    /// </summary>
    /// <param name="value">The vector to normalize.</param>
    /// <param name="result">The resulting normalized vector.</param>
    public static Normalize(value: Vector3d, result: Vector3d) {
        const mag = value.Magnitude;
        if (mag > Epsilon) {
            result = new Vector3d(value.x / mag, value.y / mag, value.z / mag);
        }
        else {
            result = Vector3d.zero;
        }
    }
}