#include <stddef.h>
#include <vector>

#include "../src/meshoptimizer.h"


struct Vertex
{
    float x, y, z;
};

int main() {

    std::vector<Vertex> vertices;
    std::vector<unsigned int> indices;

    size_t index_count = indices.size();
    size_t vertex_count = vertices.size();


    float threshold = 0.2f;
    size_t target_index_count = size_t(index_count * threshold);
    float target_error = 1e-2f;
    unsigned int options = 0; // meshopt_SimplifyX flags, 0 is a safe default

    std::vector<unsigned int> lod(index_count);
    float lod_error = 0.f;
    meshopt_simplify(&lod[0], indices, index_count, &vertices[0].x, vertex_count, sizeof(Vertex),
        target_index_count, target_error, options, &lod_error);

    return 0;
}