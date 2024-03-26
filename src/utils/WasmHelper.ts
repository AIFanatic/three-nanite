export type ArrayType = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;

export class WASMPointer {
    public data: ArrayType;
    public ptr: number | null;
    public type: "in" | "out";

    constructor(data: ArrayType, type: "in" | "out" = "in") {
        this.data = data;
        this.ptr = null;
        this.type = type;
    }
}

export class WASMHelper {
    public static TYPES = {
        i8: { array: Int8Array, heap: "HEAP8" },
        i16: { array: Int16Array, heap: "HEAP16" },
        i32: { array: Int32Array, heap: "HEAP32" },
        f32: { array: Float32Array, heap: "HEAPF32" },
        f64: { array: Float64Array, heap: "HEAPF64" },
        u8: { array: Uint8Array, heap: "HEAPU8" },
        u16: { array: Uint16Array, heap: "HEAPU16" },
        u32: { array: Uint32Array, heap: "HEAPU32" }
    };

    public static getTypeForArray(array: ArrayType) {
        if (array instanceof Int8Array) return this.TYPES.i8;
        else if (array instanceof Int16Array) return this.TYPES.i16;
        else if (array instanceof Int32Array) return this.TYPES.i32;
        else if (array instanceof Uint8Array) return this.TYPES.u8;
        else if (array instanceof Uint16Array) return this.TYPES.u16;
        else if (array instanceof Uint32Array) return this.TYPES.u32;
        else if (array instanceof Float32Array) return this.TYPES.f32;
        else if (array instanceof Float64Array) return this.TYPES.f64;

        console.log(array)
        throw Error("Array has no type");
    }

    public static transferNumberArrayToHeap(module, array): number {
        const type = this.getTypeForArray(array);
        const typedArray = type.array.from(array);
        const heapPointer = module._malloc(
            typedArray.length * typedArray.BYTES_PER_ELEMENT
        );

        module[type.heap].set(typedArray, heapPointer >> 2);

        return heapPointer;
    }

    public static getDataFromHeapU8(module, address: number, type, length: number) {
        return module[type.heap].slice(address, address + length);
    }

    public static getDataFromHeap(module, address: number, type, length: number) {
        return module[type.heap].slice(address >> 2, (address >> 2) + length);
    }

    public static getArgumentTypes(args: any[]): string[] {
        let argTypes: string[] = [];
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg instanceof Uint8Array) argTypes.push("number");
            else if (arg instanceof Uint16Array) argTypes.push("number");
            else if (arg instanceof Uint32Array) argTypes.push("number");
            else if (arg instanceof Int8Array) argTypes.push("number");
            else if (arg instanceof Int16Array) argTypes.push("number");
            else if (arg instanceof Int32Array) argTypes.push("number");
            else if (arg instanceof Float32Array) argTypes.push("number");
            else if (arg instanceof Float64Array) argTypes.push("number");
            else if (typeof arg === "string") argTypes.push("string");
            else argTypes.push("number");
        }
        return argTypes;
    }

    private static transferArguments(module, args: any[]) {
        let method_args: any[] = [];
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg instanceof WASMPointer) {
                arg.ptr = WASMHelper.transferNumberArrayToHeap(module, arg.data);
                method_args.push(arg.ptr);
            }
            else method_args.push(args[i]);
        }
        return method_args;
    }

    private static getOutputArguments(module, args: any[]) {
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (!(arg instanceof WASMPointer)) continue;
            if (arg.ptr === null) continue;
            if (arg.type === "in") continue;
            const type = WASMHelper.getTypeForArray(arg.data);
            if (type === this.TYPES.u8) {
                arg.data = WASMHelper.getDataFromHeapU8(module, arg.ptr, type, arg.data.length);
            }
            else {
                arg.data = WASMHelper.getDataFromHeap(module, arg.ptr, type, arg.data.length);
            }
        }
    }

    public static call(module, method: string, returnType: string, ...args: any[]) {
        let method_args = WASMHelper.transferArguments(module, args);
        const method_arg_types = WASMHelper.getArgumentTypes(args);
        const ret = module.ccall(method, 
            returnType, 
            method_arg_types,
            method_args
        );

        WASMHelper.getOutputArguments(module, args);

        return ret;
    }
}