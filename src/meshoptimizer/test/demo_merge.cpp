#include <stdio.h>
#include <vector>

#include "../src/meshoptimizer.h"

int main() {

    std::vector<float> vertices = {
        165, 224, 0,
        220, 190, 0,
        240, 270, 0,
        165, 295, 0,
        213, 355, 0,
        279, 318, 0,
        220, 190, 0,
        240, 270, 0,
        293, 260, 0,
        279, 318, 0,
        347, 287, 0,
        346, 344, 0,
        279, 318, 0,
        346, 344, 0,
        280, 407, 0,
        213, 355, 0,
        203, 427, 0,
        277, 473, 0,
        165, 224, 0,
        165, 295, 0,
        105, 324, 0,
        213, 355, 0,
        145, 404, 0,
        203, 427, 0
    };

    std::vector<unsigned int> indices = {
        0, 1, 2,
        0, 2, 3,
        3, 2, 4,
        4, 2, 5,
        6, 8, 7,
        7, 8, 9,
        8, 10, 9,
        9, 10, 11,
        12, 13, 14, 12, 14, 15, 15, 14, 16, 14, 17, 16, 18, 19, 20, 19, 22, 20, 22, 19, 21, 22, 21, 23
    };

    size_t vertex_count = vertices.size() / 3;
    size_t index_count = indices.size();


    float threshold = 0.5f;
    size_t target_index_count = size_t(index_count * threshold);
    float target_error = 1e-2f;
    unsigned int options = 0; // meshopt_SimplifyX flags, 0 is a safe default

    std::vector<unsigned int> simplified(index_count);
    float simplified_error = 0.f;
    size_t ret = meshopt_simplify(
        &simplified[0],
        indices.data(),
        index_count,
        vertices.data(),
        vertex_count,
        sizeof(float) * 3,
        target_index_count,
        target_error,
        options,
        &simplified_error
    );

    printf("target_index_count: %zu, simplified_size: %zu, ret: %zu, simplified_error: %f\n", target_index_count, simplified.size(), ret, simplified_error);
    simplified.resize(ret);

    for (size_t i = 0; i < simplified.size(); i+=3)
    {
        printf("%u, %u, %u\n", simplified[i + 0], simplified[i + 1], simplified[i + 2]);
    }
    

    return 0;
}