//
// Mesh Simplification Unit
// (C) by Sven Forstmann in 2014
// License : MIT (http://opensource.org/licenses/MIT)
// https://github.com/sp4cerat/Fast-Quadric-Mesh-Simplification
// http://www.gamedev.net/topic/656486-high-speed-quadric-mesh-simplification-without-problems-resolved/
// http://voxels.blogspot.com/2014/05/quadric-mesh-simplification-with-source.html
// https://github.com/neurolabusc/Fast-Quadric-Mesh-Simplification-Pascal-
//

// JS Port by Joshua Koo in 2016
// https://github.com/zz85 @blurspline

// https://github.com/neurolabusc/Fast-Quadric-Mesh-Simplification-Pascal-/blob/master/meshify_simplify_quadric.pas

import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import * as THREE from "three";

// export const SimplifyModifier = function SimplifyModifier() {

// }

class Face3 {
    public index: number;
    public normal: THREE.Vector3;
  
    constructor(
      public a: number,
      public b: number,
      public c: number
    ) {}
  }

  
export const SimplifyModifier =

(function() {
	function SymetricMatrix() {
		// init
		this.m = new Array(10).fill(0);
	}


	SymetricMatrix.prototype = {
		set: function set(
			m11, m12, m13, m14,
			m22, m23, m24,
			m33, m34,
			m44 ) {

			this.m[0] = m11;
			this.m[1] = m12;
			this.m[2] = m13;
			this.m[3] = m14;

			this.m[4] = m22;
			this.m[5] = m23;
			this.m[6] = m24;

			this.m[7] = m33;
			this.m[8] = m34;

			this.m[9] = m44;
			return this;
		},

		makePlane: function makePlane( a, b, c, d ) {
			return this.set(
				a * a, a * b, a * c, a * d,
				       b * b, b * c, b * d,
				              c * c, c * d,
				                     d * d
			);
		},

		det: function determinant(
				a11, a12, a13,
				a21, a22, a23,
				a31, a32, a33
			) {
			var det = this.m[ a11 ] * this.m[ a22 ] * this.m[ a33 ]
	 			+ this.m[ a13 ] * this.m[ a21 ] * this.m[ a32 ]
				+ this.m[ a12 ] * this.m[ a23 ] * this.m[ a31 ]
	 			- this.m[ a13 ] * this.m[ a22 ] * this.m[ a31 ]
				- this.m[ a11 ] * this.m[ a23 ] * this.m[ a32 ]
	 			- this.m[ a12 ] * this.m[ a21 ] * this.m[ a33 ];
	 		return det;
		},

		// produces new Matrix
		add: function add( n ) {
			return new SymetricMatrix().set(
				this.m[0] + n.m[0],
				this.m[1] + n.m[1],
				this.m[2] + n.m[2],
				this.m[3] + n.m[3],

				this.m[4] + n.m[4],
				this.m[5] + n.m[5],
				this.m[6] + n.m[6],

				this.m[7] + n.m[7],
				this.m[8] + n.m[8],

				this.m[9] + n.m[9]
			);
		},

		addSelf: function addSelf( n ) {
			this.m[0]+=n.m[0];   this.m[1]+=n.m[1];   this.m[2]+=n.m[2];   this.m[3]+=n.m[3];
			this.m[4]+=n.m[4];   this.m[5]+=n.m[5];   this.m[6]+=n.m[6];   this.m[7]+=n.m[7];
			this.m[8]+=n.m[8];   this.m[9]+=n.m[9]
		}
	};

	/* Model Objects */

	function Triangle() {
		this.v = new Array(3); // indices for array
		this.err = new Array(4); // errors
		this.deleted = false;
		this.dirty = false;
		this.n = new Vector3(); // Normal
	}

	// function Vector3(x, y, z) {
	// 	this.x = x;
	// 	this.y = y;
	// 	this.z = z;
	// };

	var Vector3 = THREE.Vector3;

	function Vertex() {
		this.p = new Vector3();
		this.tstart = -1;
		this.tcount = -1;
		this.q = new SymetricMatrix();
		this.border = false;
	}

	function Ref() {
		// this.tid = -1;
		// this.tvertex = -1;
	}


	function init(origVertices, origFaces) {

		vertices = origVertices.map(
			v => {
				var vert = new Vertex();
				vert.p.copy( v );
				return vert;
			}
		);


		triangles = origFaces.map( f => {
			var tri = new Triangle();
			tri.v[0] = f.a;
			tri.v[1] = f.b;
			tri.v[2] = f.c;
			return tri;
		});
	}

	var triangles = []; // Triangle
	var vertices = []; // Vertex
	var refs = []; // Ref

	function resize(array, count) {
		if (count < array.length) {
			return array.splice(count);
		}

		if (count > array.length) {
			// in JS, arrays need not be expanded
			// console.log('more');
		}
	}

	//
	// Main simplification function
	//
	// target_count  : target nr. of triangles
	// agressiveness : sharpness to increase the threshold.
	//                 5..8 are good numbers
	//                 more iterations yield higher quality
	//
	function simplify_mesh(target_count, agressiveness) {
		if (agressiveness === undefined) agressiveness = 7;

		// TODO normalize_mesh to max length 1?

		console.time('simplify_mesh');

		var i, il;

		// set all triangles to non deleted
		for ( i = 0, il = triangles.length; i < il; i++ ) {
			triangles[ i ].deleted = false;
		}


		console.timeEnd('simplify_mesh');

		// main iteration loop

		var deleted_triangles = 0;
		var deleted0 = [], deleted1 = []; // std::vector<int>
		var triangle_count = triangles.length;


		for (var iteration = 0; iteration < 100; iteration++ ) {
			console.log("iteration %d - triangles %d, tris\n",
				iteration, triangle_count - deleted_triangles, triangles.length);

			if ( triangle_count - deleted_triangles <= target_count ) break;

			// update mesh once in a while
			if( iteration % 5 === 0 ) {
				update_mesh(iteration);
			}

			// clear dirty flag
			for(var j = 0; j < triangles.length; j++) {
				triangles[ j ].dirty = false;
			}

			//
			// All triangles with edges below the threshold will be removed
			//
			// The following numbers works well for most models.
			// If it does not, try to adjust the 3 parameters
			//
			var threshold = 0.000000001 * Math.pow( iteration + 3, agressiveness );

			// remove vertices & mark deleted triangles
			for ( i = 0, il = triangles.length; i < il; i++ ) {
				var t = triangles[ i ];
				if ( t.err[3] > threshold ||
					t.deleted || t.dirty ) continue;

				for ( j = 0; j < 3; j ++ ) {

					if ( t.err[j] < threshold ) {

						var i0 = t.v[ j ];
						var v0 = vertices[ i0 ];

						var i1 = t.v[ (j + 1) % 3 ];
						var v1 = vertices[ i1 ];

						// Border check
						if (v0.border != v1.border) continue;

						// Compute vertex to collapse to
						var p = new Vector3();
						calculate_error( i0, i1, p );
						// console.log('Compute vertex to collapse to', p);

						resize(deleted0, v0.tcount); // normals temporarily
						resize(deleted1, v1.tcount); // normals temporarily

						// dont remove if flipped
						if( flipped( p, i0, i1, v0, v1, deleted0 ) ) continue;
						if( flipped( p, i1, i0, v1, v0, deleted1 ) ) continue;

						// not flipped, so remove edge
						// console.log('not flipped, remove edge');
						// console.log(v0.p, p);
						v0.p = p;
						// v0.q = v1.q + v0.q;
						v0.q.addSelf( v1.q );

						var tstart = refs.length;

						// CONTINUE

						deleted_triangles = update_triangles( i0, v0, deleted0, deleted_triangles );
						// console.log('deleted triangle v0', deleted_triangles);
						deleted_triangles = update_triangles( i0, v1, deleted1, deleted_triangles );
						// console.log('deleted triangle v1', deleted_triangles);

						var tcount = refs.length - tstart;

						if (tcount <= v0.tcount ) {
							// console.log('save ram?');
							// if(tcount)
							// 	move(refs, v0.tstart, tstart, tcount);
						}
						else
							// append
							v0.tstart = tstart;

						v0.tcount=tcount;
						break;

					}
				} // end for j

				// done?
				if (triangle_count - deleted_triangles
					<= target_count)
					break;
			}

		} // end iteration

		function move(refs, dest, source, count) {
			for (var i = 0; i < count; i++) {
				refs[dest + i] = refs[source + i];
			}
		}

		// clean up mesh
		compact_mesh();

		// ready
		console.timeEnd('simplify_mesh');

		// int timeEnd=timeGetTime();
		// printf("%s - %d/%d %d%% removed in %d ms\n",__FUNCTION__,
		// 	triangle_count-deleted_triangles,
		// 	triangle_count,deleted_triangles*100/triangle_count,
		// 	timeEnd-timeStart);

	}

	// Check if a triangle flips when this edge is removed

	var n = new Vector3();
	var d1 = new Vector3();
	var d2 = new Vector3();

	function /*bool*/ flipped(
		/* vec3f */ p,
		/*int*/ i0,
		/*int*/ i1,
		/*Vertex*/ v0,
		/*Vertex*/ v1, // not needed
		/*std::vector<int>*/ deleted)
	{
		// var bordercount = 0;
		for ( var k = 0; k < v0.tcount; k ++ ) {
			// Triangle &
			var t = triangles[refs[v0.tstart+k].tid];
			if (t.deleted) continue;

			var s = refs[v0.tstart + k].tvertex;
			var id1 = t.v[(s+1) % 3];
			var id2 = t.v[(s+2) % 3];

			if(id1==i1 || id2==i1) // delete ?
			{
				// bordercount++;
				deleted[k] = true;
				continue;
			}
			/* vec3f */
			d1.subVectors( vertices[id1].p, p).normalize();
			d2.subVectors( vertices[id2].p, p).normalize();
			if(Math.abs(d1.dot(d2))>0.999) return true;
			/*vec3f  n;*/
			n.crossVectors(d1,d2).normalize();
			deleted[k] = false;
			if(n.dot(t.n)<0.2) return true;
		}
		return false;
	}

	// Update triangle connections and edge error after a edge is collapsed

	function update_triangles(/*int*/ i0,
		/*Vertex &*/ v,
		/*std::vector<int> & */deleted,
		/*int &*/ deleted_triangles )
	{
		// console.log('update_triangles');
		// vec3f p;
		var p = new Vector3();
		for (var k = 0; k < v.tcount; k++)
		{
			var /*Ref &*/ r = refs[ v.tstart + k ];
			var /*Triangle &*/ t = triangles[ r.tid ];

			if( t.deleted ) continue;
			if( deleted[k] ) {
				t.deleted = true;
				deleted_triangles++;
				continue;
			}
			t.v[r.tvertex] = i0;
			t.dirty = true;

			t.err[0] = calculate_error( t.v[0], t.v[1], p );
			t.err[1] = calculate_error( t.v[1], t.v[2], p );
			t.err[2] = calculate_error( t.v[2], t.v[0], p );
			t.err[3] = Math.min( t.err[0], t.err[1], t.err[2] );
			refs.push( r );
		}
		return deleted_triangles;
	}

	// compact triangles, compute edge error and build reference list
	function update_mesh( iteration ) /*int*/
	{
		// console.log('update_mesh', iteration, triangles.length);
		if ( iteration > 0 ) {
			// compact triangles
			var dst = 0;
			for (var i = 0; i < triangles.length; i++) {
				var target = triangles[i];
				if(!target.deleted) {
					triangles[dst++] = target;
				}
			}

			console.log('not deleted dst', triangles.length, dst);
			triangles.splice( dst );

		}
		//
		// Init Quadrics by Plane & Edge Errors
		//
		// required at the beginning ( iteration == 0 )
		// recomputing during the simplification is not required,
		// but mostly improves the result for closed meshes
		//
		if( iteration === 0 ) {
			for (var i = 0; i < vertices.length; i++ ) {
				// may not need to do this.
				vertices[i].q = new SymetricMatrix();
			}

			for (var i = 0; i < triangles.length; i++) {
				var /*Triangle &*/ t = triangles[i];
				// var n, p[3]; /* vec3f */

				var n = new Vector3();

				var p = new Array(3);
				var p1p0 = new Vector3();
				var p2p0 = new Vector3();

				for (var j = 0; j < 3; j++) {
					p[j] = vertices[t.v[j]].p;
				}

				p1p0.subVectors(p[1], p[0]);
				p2p0.subVectors(p[2], p[0]);


				n.crossVectors(p1p0, p2p0).normalize();
				t.n = n;
				var tmp = new SymetricMatrix().makePlane(
						n.x,
						n.y,
						n.z,
						-n.dot(p[0]))

				for (var j = 0; j < 3; j++) {
					vertices[t.v[j]].q.addSelf(tmp);
				}

				// vertices[t.v[j]].q =
				// vertices[t.v[j]].q.add(SymetricMatrix(n.x,n.y,n.z,-n.dot(p[0])));
			}

			for (var i = 0; i < triangles.length; i++) {

				// Calc Edge Error
				var /*Triangle &*/ t=triangles[i];
				// vec3f p;
				var p = new Vector3();

				for (var j = 0; j < 3; j++) {
					t.err[ j ] = calculate_error( t.v[j], t.v[(j+1)%3], p );
				}

				t.err[ 3 ] = Math.min( t.err[0], t.err[1], t.err[2] );
			}
		}

		// Init Reference ID list
		for (var i = 0; i < vertices.length; i++)
		{
			vertices[i].tstart=0;
			vertices[i].tcount=0;
		}
		for (var i = 0; i < triangles.length; i++)
		{
			/*Triangle &*/
			var t = triangles[i];
			for (j = 0; j < 3; j++) vertices[t.v[j]].tcount++;
		}
		var tstart=0;
		for (var i = 0; i < vertices.length; i++)
		{
			var /*Vertex &*/ v = vertices[i];
			v.tstart = tstart;
			tstart += v.tcount;
			v.tcount = 0;
		}

		// Write References
		// resize(refs, triangles.length * 3)
		console.log('pre ref', refs.length, triangles.length * 3);
		for (var i = refs.length; i < triangles.length * 3; i++) {
			refs[i] = new Ref();
		}

		for (var i = 0; i < triangles.length; i++)
		{
			/*Triangle &*/
			var t = triangles[i];
			for (var j = 0; j < 3; j++)
			{
				/*Vertex &*/
				var v = vertices[ t.v[ j ] ];
				refs[ v.tstart + v.tcount ].tid = i;
				refs[ v.tstart + v.tcount ].tvertex = j;
				v.tcount++;
			}
		}

		// Identify boundary : vertices[].border=0,1
		if( iteration == 0 )
		{
			// std::vector<int> vcount,vids;
			var vcount,vids;


			for (var i = 0; i < vertices.length; i++) {
				vertices[i].border = 0;
			}

			for (var i = 0; i < vertices.length; i++) {
				var /*Vertex &*/ v = vertices[i];
				// vcount.clear();
				// vids.clear();
				vcount = [];
				vids = [];

				for (var j = 0; j < v.tcount; j++) {
					var k = refs[v.tstart + j].tid;
					var /*Triangle &*/ t = triangles[k];

					for (var k = 0; k < 3; k++) {
						var ofs=0,
							id=t.v[k];
						while(ofs < vcount.length) {
							if(vids[ofs]==id) break;
							ofs++;
						}

						if(ofs == vcount.length) {
							vcount.push(1);
							vids.push(id);
						}
						else {
							vcount[ofs]++;
						}
					}
				}
				for (var j = 0; j < vcount.length; j++) {
					if(vcount[j]==1) {
						vertices[vids[j]].border=1;
					}
				}
			}
		}
	}

	// Finally compact mesh before exiting

	function compact_mesh()
	{
		console.log('compact_mesh');
		var /*int */ dst=0;
		for (var i = 0; i < vertices.length; i++) {
			vertices[i].tcount=0;
		}
		for (var i = 0; i < triangles.length; i++) {
			if(!triangles[i].deleted) {
				var /*Triangle &*/ t = triangles[i];
				triangles[dst++] = t;
				for (var j = 0; j < 3; j++)
					vertices[t.v[j]].tcount = 1;
			}
		}
		resize(triangles, dst);
		dst = 0;
		for (var i = 0; i < vertices.length; i++) {
			if (vertices[i].tcount) {
				vertices[i].tstart = dst;
				vertices[dst].p = vertices[i].p;
				dst++;
			}
		}

		for (var i = 0; i < triangles.length; i++) {
			var /*Triangle &*/ t = triangles[i];
			for (var j = 0; j < 3; j++)
				t.v[j] = vertices[t.v[j]].tstart;
		}
		console.log('%cCompact Mesh', 'background:#f00', vertices.length, dst);
		resize(vertices, dst);
		console.log('%cCompact Mesh ok', 'background:#f00', vertices.length, dst);
	}

	// Error between vertex and Quadric

	function vertex_error(/*SymetricMatrix*/ q, /*double*/ x, y, z) {
		return q.m[0]*x*x + 2*q.m[1]*x*y + 2*q.m[2]*x*z + 2*q.m[3]*x + q.m[4]*y*y
			+ 2*q.m[5]*y*z + 2*q.m[6]*y + q.m[7]*z*z + 2*q.m[8]*z + q.m[9];
	}

	// Error for one edge
	// if DECIMATE is defined vertex positions are NOT interpolated
	// Luebke Survey of Polygonal Simplification Algorithms:  "vertices of a model simplified by the decimation algorithm are a subset of the original model’s vertices."
	// http://www.cs.virginia.edu/~luebke/publications/pdf/cg+a.2001.pdf

	function calculate_error(id_v1, id_v2, p_result)
	{
		// compute interpolated vertex
		var vertex1 = vertices[id_v1];
		var vertex2 = vertices[id_v2];

		var q = vertex1.q.add(vertex2.q);
		var border = vertex1.border && vertex2.border;
		var error = 0;
		var det = q.det(0, 1, 2, 1, 4, 5, 2, 5, 7);

		if ( det !== 0 && !border ) {
			// q_delta is invertible
			p_result.x = -1/det*(q.det(1, 2, 3, 4, 5, 6, 5, 7, 8));	// vx = A41/det(q_delta)
			p_result.y =  1/det*(q.det(0, 2, 3, 1, 5, 6, 2, 7, 8));	// vy = A42/det(q_delta)
			p_result.z = -1/det*(q.det(0, 1, 3, 1, 4, 6, 2, 5, 8));	// vz = A43/det(q_delta)
			error = vertex_error(q, p_result.x, p_result.y, p_result.z);
		}
		else {
			// det = 0 -> try to find best result
			var /*vec3f*/ p1 = vertex1.p;
			var /*vec3f*/ p2 = vertex2.p;
			var /*vec3f*/ p3 = new Vector3().addVectors(p1, p2).multiplyScalar(0.5);
			var error1 = vertex_error(q, p1.x, p1.y, p1.z);
			var error2 = vertex_error(q, p2.x, p2.y, p2.z);
			var error3 = vertex_error(q, p3.x, p3.y, p3.z);
			error = Math.min(error1, error2, error3);
			if (error1 === error) p_result.copy(p1);
			if (error2 === error) p_result.copy(p2);
			if (error3 === error) p_result.copy(p3);
		}

		return error;
	}

	return function simplifyModify(geometry) {
		if ( geometry instanceof THREE.BufferGeometry && !geometry.vertices && !geometry.faces ) {
			console.log('converting BufferGeometry to Geometry');
			geometry = new THREE.Geometry().fromBufferGeometry( geometry );
		}

		// convert format
		init( geometry.vertices, geometry.faces );

		// simplify!
		// simplify_mesh(geometry.faces.length * 0.5 | 0, 7);
		// simplify_mesh(geometry.faces.length - 2, 4);

		console.time('simplify')
		simplify_mesh(150, 700000);
		console.timeEnd('simplify')


		console.log('old vertices ' + geometry.vertices.length, 'old faces ' + geometry.faces.length);

		console.log('new vertices ' + vertices.length, 'old faces ' + triangles.length);


		// TODO convert to buffer geometry.
		var newGeo = {vertices: [], faces: []};

		for ( let i = 0; i < vertices.length; i ++ ) {

			var v = vertices[ i ];
			newGeo.vertices.push( v.p )

		}

		for ( let i = 0; i < triangles.length; i ++ ) {

			var tri = triangles[ i ];
			newGeo.faces.push( new Face3(
				tri.v[0],
				tri.v[1],
				tri.v[2]
			) );
		}

		return newGeo;

	}


})()