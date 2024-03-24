CXX := Main.cpp
O3 := -O3
#WASM := -s DEMANGLE_SUPPORT=1 -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "FS_createDataFile", "FS_readFile", "FS_unlink"]' -s ALLOW_MEMORY_GROWTH=1 -s WASM=1 -s EXPORTED_FUNCTIONS='["_simplify"]'
# WASM := -s DEMANGLE_SUPPORT=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "FS_createDataFile", "FS_readFile", "FS_unlink"]' -s ALLOW_MEMORY_GROWTH=1 -s WASM=1 -s EXPORTED_FUNCTIONS='["_simplify"]' -o ./qms.js
WASM := -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "FS_createDataFile", "FS_readFile", "FS_unlink"]' -s EXPORTED_FUNCTIONS='["_malloc", "_simplify", "_simplify_obj", "_get_simplified_vertex_count", "_get_simplified_triangle_count"]' -s ALLOW_MEMORY_GROWTH=1 -s WASM=1 -o ./qms.js


all: release

release: CXX98 += ${O3}
release: debug

debug:
	g++ ${CXX}

#make wasm
wasm:
	em++ ${CXX} ${WASM} ${O3}
wasm_debug:
	em++ ${CXX} ${WASM}
	cp ./qms.wasm /Users/mac/Downloads/temp/three-nanite/dist/
