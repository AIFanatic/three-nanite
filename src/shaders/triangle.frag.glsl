varying vec2 vUV;

varying vec4 vWorldPosition;
varying vec3 vNormal;
varying vec4 vTexCoords;

void main() {
    gl_FragColor = vec4(vNormal, 1.0);
    // gl_FragColor = vec4(vec3(1.0, 0.0, 0.0), 1.0);


    // vec3 color = vec3(1.0, 0.0, 0.0);

    // // Normal lighting for comparison
    // vec3 to_light;
    // vec3 vertex_normal;
    // float cos_angle;

    // vec3 u_Light_position = vec3(0, 0, 5);
    // // Calculate a vector from the fragment location to the light source
    // to_light = u_Light_position - vWorldPosition.xyz;
    // to_light = normalize( to_light );

    // // The vertex's normal vector is being interpolated across the primitive
    // // which can make it un-normalized. So normalize the vertex's normal vector.
    // vertex_normal = normalize( vNormal );

    // // Calculate the cosine of the angle between the vertex's normal vector
    // // and the vector going to the light.
    // cos_angle = dot(vertex_normal, to_light);
    // cos_angle = clamp(cos_angle, 0.0, 1.0);

    // // Scale the color of this fragment based on its angle to the light.
    // gl_FragColor = vec4(color * cos_angle, 1.0);
}