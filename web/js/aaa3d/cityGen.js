/**
 * src/world/cityGen.js — THE CITY DOOR's generators (batch 40, the open-source world stack, 2026-09-30).
 *
 * THE OWNER, 2026-09-30: "the three JS generators are what we're looking for. We're trying to reinvent the wheel when it's all there."
 *
 * A PORT of three.js r185's CityGenerator (examples/jsm/generators/CityGenerator.js) and its city/ generators — SkyscraperGenerator and
 * SidewalkGenerator (vendored read-only at vendor/addons/jsm/generators/). Their GEOMETRY is CPU JavaScript and is carried below as it is:
 * the block/lot layout, the tripartite Beaux-Arts / Neo-Gothic tower (footprint with a chamfered corner, faces split into base / shaft /
 * crown, floors and bays; the pier, window, cornice, parapet, gothic arcade and finial pieces instanced across the tower and baked into one
 * geometry with a per-vertex `partId`), the rounded sidewalk slab and its curb. Their MATERIALS are TSL (`three/webgpu`, `three/tsl` —
 * absent from vendor/, measured by kitVeg.js's header), so they are NOT carried: world/city.js dresses the geometry in WebGL — the
 * building colour baked per part into a vertex colour, the glass's roughness and metalness read off `partId` in a two-line shader patch,
 * the concrete and granite as plain MeshStandardMaterials. Nothing else in this file is ours; the edits are marked "ported:".
 *
 * The MIT License — Copyright © 2010-2026 three.js authors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
 * ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH
 * THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	ExtrudeGeometry,
	Group,
	InstancedMesh,
	LatheGeometry,
	Matrix3,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	Path,
	PlaneGeometry,
	ShapeGeometry,
	Shape,
	Sphere,
	Vector2,
	Vector3
} from 'three';

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ── from city/SkyscraperGenerator.js ─────────────────────────────────────────────────────────────────────────────────────────────────
const _scale = /*@__PURE__*/ new Vector3();
const _point = /*@__PURE__*/ new Vector3();
const _normalMatrix = /*@__PURE__*/ new Matrix3();
const _identity = /*@__PURE__*/ new Matrix4();

// material-zone codes baked per vertex into the merged geometry, so one material can
// branch on partId and shade every zone
const PartId = Object.freeze( { WALL: 0, PIER: 1, FRAME: 2, ORNAMENT: 3, GLASS: 4, AC: 5 } );
const { WALL, PIER, FRAME, ORNAMENT, GLASS, AC } = PartId;

// fraction of a floor's height taken by the glazed opening; the remainder is
// the spandrel band. shared by the window module and the spandrels so they tile.
const WINDOW_HEIGHT_RATIO = 0.62;

// width of the flat window-frame band around the glazing; shared by the frame module
// and the glass pane so the pane always tucks inside the frame
const WINDOW_BORDER = 0.1;

// the masonry course module ( brick height × length ). the generator snaps floor and
// bay dimensions to it, and the material's coursing reads the same values, so the
// procedural brickwork lines up with the geometry
const BRICK = { height: 0.3, length: 0.6 };

// merging requires all-indexed or all-non-indexed inputs; extrusions are
// non-indexed while boxes/planes are indexed, so normalize before merging

function merge( geometries ) {

	return mergeGeometries( geometries.map( ( g ) => g.index ? g.toNonIndexed() : g ) );

}

function nonIndexed( geometry ) {

	return geometry.index ? geometry.toNonIndexed() : geometry;

}

// the unit box is identical for every building's shell boxes — build it once
const _unitBox = /*@__PURE__*/ nonIndexed( new BoxGeometry( 1, 1, 1 ) );

/**
 * Bakes a list of instance groups into one non-indexed BufferGeometry. Each group is a
 * base geometry ( position + normal + uv ), an array of Matrix4 placements and a `partId`
 * written to a per-vertex attribute. Transforming straight into preallocated typed arrays
 * avoids mergeGeometries' per-instance allocations; the result is one geometry, ready for
 * a single draw call and the compute rasterizer.
 */
function bakeGroups( groups ) {

	let total = 0;
	for ( const group of groups ) total += group.geometry.attributes.position.count * group.matrices.length;

	const position = new Float32Array( total * 3 );
	const normal = new Float32Array( total * 3 );
	const uv = new Float32Array( total * 2 );
	const partId = new Float32Array( total );
	// per-window interior-mapping room ( centre + size ) the glass pane looks into; only
	// the glass group writes it, every other vertex stays zero. baked per vertex so the
	// material reads each building's own room sizes without a global uniform.
	const roomCenter = new Float32Array( total * 3 );
	const roomSize = new Float32Array( total * 2 );

	let w = 0;

	// the bounding sphere falls out of the AABB gathered while transforming, sparing a
	// second full pass over the positions ( computeBoundingSphere )
	let minX = Infinity, minY = Infinity, minZ = Infinity;
	let maxX = - Infinity, maxY = - Infinity, maxZ = - Infinity;

	for ( const group of groups ) {

		const geometry = group.geometry;
		const P = geometry.attributes.position.array;
		const N = geometry.attributes.normal.array;
		const U = geometry.attributes.uv.array;
		const count = geometry.attributes.position.count;
		const id = group.partId;
		const rooms = group.rooms; // per-instance { center, size }, glass only
		const rigid = group.rigid === true; // pure rotation ( + translation ): the normal matrix is the rotation itself

		for ( let i = 0; i < group.matrices.length; i ++ ) {

			const room = rooms ? rooms[ i ] : null;

			const matrix = group.matrices[ i ];
			const e = matrix.elements;
			const e0 = e[ 0 ], e1 = e[ 1 ], e2 = e[ 2 ], e4 = e[ 4 ], e5 = e[ 5 ], e6 = e[ 6 ], e8 = e[ 8 ], e9 = e[ 9 ], e10 = e[ 10 ], e12 = e[ 12 ], e13 = e[ 13 ], e14 = e[ 14 ];

			// for a rigid frame the inverse-transpose equals the rotation, so its columns
			// are read straight from the matrix and the per-instance 3×3 inverse is skipped
			let n0, n1, n2, n3, n4, n5, n6, n7, n8;

			if ( rigid ) {

				n0 = e0; n1 = e1; n2 = e2; n3 = e4; n4 = e5; n5 = e6; n6 = e8; n7 = e9; n8 = e10;

			} else {

				const ne = _normalMatrix.getNormalMatrix( matrix ).elements;
				n0 = ne[ 0 ]; n1 = ne[ 1 ]; n2 = ne[ 2 ]; n3 = ne[ 3 ]; n4 = ne[ 4 ]; n5 = ne[ 5 ]; n6 = ne[ 6 ]; n7 = ne[ 7 ]; n8 = ne[ 8 ];

			}

			for ( let v = 0; v < count; v ++ ) {

				const v3 = v * 3, w3 = w * 3;
				const x = P[ v3 ], y = P[ v3 + 1 ], z = P[ v3 + 2 ];
				const wx = e0 * x + e4 * y + e8 * z + e12;
				const wy = e1 * x + e5 * y + e9 * z + e13;
				const wz = e2 * x + e6 * y + e10 * z + e14;
				position[ w3 ] = wx; position[ w3 + 1 ] = wy; position[ w3 + 2 ] = wz;
				if ( wx < minX ) minX = wx; if ( wx > maxX ) maxX = wx;
				if ( wy < minY ) minY = wy; if ( wy > maxY ) maxY = wy;
				if ( wz < minZ ) minZ = wz; if ( wz > maxZ ) maxZ = wz;

				const nx = N[ v3 ], ny = N[ v3 + 1 ], nz = N[ v3 + 2 ];
				const tx = n0 * nx + n3 * ny + n6 * nz, ty = n1 * nx + n4 * ny + n7 * nz, tz = n2 * nx + n5 * ny + n8 * nz;
				const inv = 1 / ( Math.sqrt( tx * tx + ty * ty + tz * tz ) || 1 );
				normal[ w3 ] = tx * inv; normal[ w3 + 1 ] = ty * inv; normal[ w3 + 2 ] = tz * inv;

				uv[ w * 2 ] = U[ v * 2 ]; uv[ w * 2 + 1 ] = U[ v * 2 + 1 ];
				partId[ w ] = id;

				if ( room !== null ) {

					roomCenter[ w3 ] = room.center.x; roomCenter[ w3 + 1 ] = room.center.y; roomCenter[ w3 + 2 ] = room.center.z;
					roomSize[ w * 2 ] = room.size.x; roomSize[ w * 2 + 1 ] = room.size.y;

				}

				w ++;

			}

		}

	}

	const geometry = new BufferGeometry();
	geometry.setAttribute( 'position', new BufferAttribute( position, 3 ) );
	geometry.setAttribute( 'normal', new BufferAttribute( normal, 3 ) );
	geometry.setAttribute( 'uv', new BufferAttribute( uv, 2 ) );
	geometry.setAttribute( 'partId', new BufferAttribute( partId, 1 ) );
	geometry.setAttribute( 'roomCenter', new BufferAttribute( roomCenter, 3 ) );
	geometry.setAttribute( 'roomSize', new BufferAttribute( roomSize, 2 ) );

	geometry.boundingSphere = new Sphere(
		new Vector3( ( minX + maxX ) / 2, ( minY + maxY ) / 2, ( minZ + maxZ ) / 2 ),
		Math.hypot( maxX - minX, maxY - minY, maxZ - minZ ) / 2
	);

	return geometry;

}

// deterministic PRNG (mulberry32) so a given seed always yields the same tower

function createRandom( seed ) {

	let s = ( seed >>> 0 ) || 1;

	return function () {

		s = ( s + 0x6D2B79F5 ) | 0;
		let t = Math.imul( s ^ ( s >>> 15 ), 1 | s );
		t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;

	};

}

// a stable per-floor hash ( from the floor index and the face origin ) used to pick the
// interior-mapping room module per floor without allocating a closure each floor
function floorHash( f, frame, k ) {

	const s = Math.sin( f * 12.9898 + frame.origin.x * 0.07 + frame.origin.z * 0.131 + k ) * 43758.5453;
	return s - Math.floor( s );

}

// the seed-driven "style" of a tower: footprint proportions, tier split and the
// shaping of piers and base arches. these sit between the fixed defaults and the
// caller's parameters, so any parameter passed in still overrides its seeded value.

function randomStyle( random ) {

	const base = 0.10 + random() * 0.07;
	const crown = 0.08 + random() * 0.08;

	return {
		footprint: { width: 26 + random() * 18, depth: 20 + random() * 14 },
		tierFractions: { base, crown },
		pierWidth: 0.4 + random() * 0.4,
		pierDepth: 0.3 + random() * 0.3,
		windowReveal: 0.12 + random() * 0.1,
		stringCourseHeight: 0.5 + random() * 0.5,
		archBayWidthRatio: Math.round( 1.5 + random() * 1.5 ),
		archRise: 0.4 + random() * 0.5
	};

}

/**
 * Generates intricate, tripartite "Beaux-Arts / Neo-Gothic" terracotta
 * skyscrapers from a small set of parameters.
 *
 * The mass is read as a footprint polygon (a rectangle with one chamfered
 * corner) split into vertical faces, each split into three tiers — a tall
 * arcaded base, a repeating shaft and an ornate crown — then into floors and
 * bays. A handful of authored pieces (a pier, a window, a cornice profile, a
 * gothic arch) are instanced across the whole tower, then baked — together with
 * the bespoke base arcade — into a single non-indexed BufferGeometry tagged with
 * a per-vertex `partId` ({@link PartId}) so one material can shade every zone.
 *
 * The generator is material agnostic — it only produces geometry. Pass a single
 * material (e.g. a TSL node material that branches on `partId`) to dress it.
 *
 * ```js
 * const generator = new SkyscraperGenerator( { seed: 35, totalHeight: 140 }, material );
 * scene.add( generator.build() ); // a single Mesh
 * ```
 */
class SkyscraperGenerator {

	constructor( parameters = {}, material = null ) {

		this.parameters = parameters; // caller overrides; defaults + seed fill the rest at build time
		this.material = material; // a single material; the look is driven by the baked `partId` attribute

		this.mesh = null;

	}

	setParameters( parameters ) {

		Object.assign( this.parameters, parameters );

		return this;

	}

	build() {

		const random = createRandom( this.parameters.seed ?? SkyscraperGenerator.defaults.seed );

		// precedence: fixed defaults < seed-driven style < caller parameters

		const p = Object.assign( {}, SkyscraperGenerator.defaults, randomStyle( random ), this.parameters );

		// snap the masonry-driving dimensions to the brick module so the procedural
		// brickwork ( courses up local Y, columns along each face ) lines up with the
		// geometry: a whole number of courses per floor and bricks per bay
		const vModule = BRICK.height * 2; // a course pair, so floor / window halves still land on a joint
		p.floorHeight = Math.max( vModule * 3, Math.round( p.floorHeight / vModule ) * vModule );
		p.windowHeight = Math.round( p.floorHeight * WINDOW_HEIGHT_RATIO / vModule ) * vModule;
		p.bayWidth = Math.max( BRICK.length * 3, Math.round( p.bayWidth / BRICK.length ) * BRICK.length );
		p.pierWidth = Math.max( BRICK.length, Math.round( p.pierWidth / BRICK.length ) * BRICK.length );

		// vertical layout: base / shaft / crown as whole floor counts, so every floor
		// line sits on a course ( the requested total height is rounded to suit )
		const floors = Math.max( 3, Math.round( p.totalHeight / p.floorHeight ) );
		const baseFloors = Math.max( 1, Math.round( floors * p.tierFractions.base ) );
		const crownFloors = Math.max( 1, Math.round( floors * p.tierFractions.crown ) );
		const shaftFloors = Math.max( 1, floors - baseFloors - crownFloors );

		const baseHeight = baseFloors * p.floorHeight;
		const crownHeight = crownFloors * p.floorHeight;
		const shaftHeight = shaftFloors * p.floorHeight;
		p.totalHeight = baseHeight + shaftHeight + crownHeight;

		const baseTop = baseHeight;
		const shaftTop = baseHeight + shaftHeight;

		// one accumulator per kind of part, mostly instance matrices. kept separate so the
		// bake below can order them by draw order ( which controls overdraw ), not build order.

		const windows = [];
		const glass = [];
		const glassRooms = []; // per-glass interior-mapping room ( centre + size ), aligned with `glass`
		const backWalls = []; // the thin wall closing the volume behind the glass
		const bands = []; // spandrel bands, one at each floor line
		const piers = new Map(); // pier height -> matrices, so each tier's continuous piers share one geometry
		const trim = []; // cornices and parapets ( axis-aligned unit boxes )
		const acUnits = []; // window air-conditioner boxes on a random subset of shaft windows
		const finials = []; // pinnacles along the crown
		const extras = []; // bespoke geometry: the base arcade and the setback / roof slabs

		const addPier = ( frame, u, vBottom, height ) => {

			const key = Math.round( height * 1000 ); // bucket equal pier heights ( a number key, no string )
			if ( piers.has( key ) === false ) piers.set( key, [] );
			piers.get( key ).push( frame.matrix( u, vBottom, 0 ) );

		};

		// footprints: full mass, and the inset crown after the setback

		const footprint = buildFootprint( p.footprint.width, p.footprint.depth, p.chamferWidth, p.chamferCornerX, p.chamferCornerZ );
		const faces = buildFaces( footprint );

		const inset = p.setbackDepth * p.bayWidth;
		const crownFootprint = buildFootprint(
			Math.max( p.bayWidth * 2, p.footprint.width - inset * 2 ),
			Math.max( p.bayWidth * 2, p.footprint.depth - inset * 2 ),
			Math.max( 0, p.chamferWidth - inset ),
			p.chamferCornerX,
			p.chamferCornerZ
		);
		const crownFaces = buildFaces( crownFootprint );

		// --- generate the parts -----------------------------------------------

		const crownCornice = p.stringCourseHeight * 1.6; // the crown's heavy cap; its piers stop below it

		// shaft and crown are the same facade over different faces, spans and pier heights
		const tiers = [
			{ faces, bottom: baseTop, height: shaftHeight, pierHeight: shaftHeight, ac: acUnits },
			{ faces: crownFaces, bottom: shaftTop, height: crownHeight, pierHeight: crownHeight - crownCornice, ac: null }
		];

		for ( const t of tiers ) {

			for ( const frame of t.faces ) {

				addWindows( frame, windows, glass, glassRooms, t.ac, t.bottom, t.height, p );
				addWall( backWalls, frame, t.bottom, t.bottom + t.height, 0.8, - 0.6 );
				addSpandrelBands( bands, frame, t.bottom, t.height, p );
				addPiers( frame, t.bottom, t.pierHeight, p, addPier );

			}

		}

		// the base: a gothic arcade, capped by a string course
		for ( const frame of faces ) {

			addArcade( extras, frame, baseHeight, p );
			addCornice( trim, frame, baseTop - p.stringCourseHeight, p.stringCourseHeight, 0.5 );

		}

		// periodic string courses banding the shaft
		if ( p.stringCourseEvery > 0 ) {

			for ( let f = p.stringCourseEvery; f < shaftFloors; f += p.stringCourseEvery ) {

				for ( const frame of faces ) addCornice( trim, frame, baseTop + f * p.floorHeight - p.stringCourseHeight * 0.5, p.stringCourseHeight, 0.3 );

			}

		}

		// the crown's heavy cornice, its parapet and the finials along the top
		for ( const frame of crownFaces ) {

			addCornice( trim, frame, p.totalHeight - crownCornice, crownCornice, 0.9 );
			addParapet( trim, frame, p.totalHeight, p );
			addFinials( frame, finials, shaftTop, crownHeight, p );

		}

		// thin slabs capping the setback ledge and the roof
		extras.push( slab( footprint, shaftTop, 0.6 ) );
		extras.push( slab( crownFootprint, p.totalHeight, 0.6 ) );

		// --- bake every part into one geometry ---------------------------------

		// one mesh = one draw the renderer can't sort, so bake order is draw order: the
		// facade front-to-back, the backing wall last so its hidden fragments never shade.

		const groups = [
			{ geometry: buildWindowGeometry( p ), matrices: windows, partId: FRAME, rigid: true },
			{ geometry: nonIndexed( buildGlassGeometry( p ) ), matrices: glass, partId: GLASS, rooms: glassRooms, rigid: true },
			{ geometry: _unitBox, matrices: bands, partId: WALL }
		];

		for ( const [ key, matrices ] of piers ) groups.push( { geometry: buildPierGeometry( p, key / 1000 ), matrices, partId: PIER, rigid: true } );

		groups.push( { geometry: _unitBox, matrices: trim, partId: WALL } ); // cornices, parapets
		groups.push( { geometry: _unitBox, matrices: acUnits, partId: AC } );
		groups.push( { geometry: nonIndexed( buildFinialGeometry( p ) ), matrices: finials, partId: ORNAMENT, rigid: true } );

		for ( const geometry of extras ) groups.push( { geometry: nonIndexed( geometry ), matrices: [ _identity ], partId: WALL, rigid: true } ); // base arcade + slabs, in building-local space

		groups.push( { geometry: _unitBox, matrices: backWalls, partId: WALL } ); // last — hidden behind the facade

		const geometry = bakeGroups( groups );

		const mesh = new Mesh( geometry, this.material || new MeshStandardMaterial( { color: 0xddccaa, roughness: 0.9 } ) );
		mesh.name = 'Skyscraper';

		this.dispose();
		this.mesh = mesh;

		return mesh;

	}

	rebuild() {

		return this.build();

	}

	dispose() {

		if ( this.mesh === null ) return;

		this.mesh.geometry.dispose();
		this.mesh = null;

	}

}

// fixed baseline. the remaining parameters (footprint, tierFractions, pierWidth,
// pierDepth, windowReveal, stringCourseHeight, archBayWidthRatio, archRise) are
// derived from the seed by randomStyle() unless the caller provides them.
SkyscraperGenerator.defaults = {
	seed: 35,
	totalHeight: 140,
	floorHeight: 4,
	bayWidth: 2.6,
	stringCourseEvery: 6,
	chamferWidth: 4,
	chamferCornerX: 1,
	chamferCornerZ: 1,
	setbackDepth: 1.5,
	acChance: 0.12
};

// --- footprint & faces ---------------------------------------------------

/**
 * A rectangle (centred at the origin in the XZ plane) with one corner cut at
 * 45 degrees, returned as an ordered list of `Vector2( x, z )`. `cornerX` /
 * `cornerZ` ( each ±1 ) pick which corner is cut, so the chamfer can be aimed
 * outward to a block corner.
 */
function buildFootprint( width, depth, chamfer, cornerX = 1, cornerZ = 1 ) {

	const hw = width / 2;
	const hd = depth / 2;
	const c = Math.min( chamfer, hw, hd );

	// the four corners, counter-clockwise
	const corners = [
		new Vector2( hw, hd ),
		new Vector2( - hw, hd ),
		new Vector2( - hw, - hd ),
		new Vector2( hw, - hd )
	];

	const points = [];

	for ( let i = 0; i < corners.length; i ++ ) {

		const corner = corners[ i ];

		// cut the requested corner: replace it with two points pulled back along
		// each adjacent edge, leaving a 45° face that points out to that corner
		if ( c > 0 && Math.sign( corner.x ) === cornerX && Math.sign( corner.y ) === cornerZ ) {

			const prev = corners[ ( i + 3 ) % 4 ];
			const next = corners[ ( i + 1 ) % 4 ];
			points.push( corner.clone().lerp( prev, c / corner.distanceTo( prev ) ) );
			points.push( corner.clone().lerp( next, c / corner.distanceTo( next ) ) );

		} else {

			points.push( corner.clone() );

		}

	}

	return points;

}

/**
 * Builds a face frame per footprint edge. Each frame is an orthonormal basis
 * ( u along the edge, v up, n outward ) plus an origin and length, so all
 * facade layout can happen in flat ( u, v ) space and bake to world with one
 * matrix — the same authored piece then instances onto every face, including
 * the diagonal chamfer.
 */
function buildFaces( points ) {

	const faces = [];
	const up = new Vector3( 0, 1, 0 );

	for ( let i = 0; i < points.length; i ++ ) {

		const a = points[ i ];
		const b = points[ ( i + 1 ) % points.length ];

		// outward normal: perpendicular to the edge, pointing away from the
		// origin (the footprint is centred there)

		const n = new Vector3( b.y - a.y, 0, - ( b.x - a.x ) ).normalize();
		const mid = new Vector3( ( a.x + b.x ) / 2, 0, ( a.y + b.y ) / 2 );
		if ( n.dot( mid ) < 0 ) n.negate();

		// right-handed basis: u = v × n, so makeBasis( u, v, n ) is a pure rotation

		const u = new Vector3().crossVectors( up, n ).normalize();

		const pa = new Vector3( a.x, 0, a.y );
		const pb = new Vector3( b.x, 0, b.y );
		const length = pa.distanceTo( pb );

		// the edge end that u points away from becomes the origin

		const origin = pb.clone().sub( pa ).dot( u ) > 0 ? pa : pb;

		faces.push( new FaceFrame( origin, u, up.clone(), n, length ) );

	}

	return faces;

}

/** A face's local ( u along edge, v up, n outward ) frame in world space. */
class FaceFrame {

	constructor( origin, u, v, n, length ) {

		this.origin = origin;
		this.u = u;
		this.v = v;
		this.n = n;
		this.length = length;

	}

	point( u, v, w, target = new Vector3() ) {

		return target
			.copy( this.origin )
			.addScaledVector( this.u, u )
			.addScaledVector( this.v, v )
			.addScaledVector( this.n, w );

	}

	/** Places a piece authored in the canonical local frame ( x across, y up, z outward ). */
	matrix( u, v, w ) {

		return new Matrix4()
			.makeBasis( this.u, this.v, this.n )
			.setPosition( this.point( u, v, w, _point ) );

	}

	/** How many bays of `bayWidth` fit, with the remainder split into end margins. */
	bays( bayWidth ) {

		const count = Math.max( 1, Math.floor( this.length / bayWidth ) );
		const margin = ( this.length - count * bayWidth ) / 2;

		return { count, margin, width: bayWidth };

	}

}

// --- shell pieces --------------------------------------------------------

// a Matrix4 mapping the shared unit box ( 1×1×1, centred ) onto a face-aligned
// box of the given size, centred at the given face-local point. these matrices
// are what the shell InstancedMesh is built from.
function boxMatrix( frame, u, v, w, sizeU, sizeV, sizeN ) {

	return new Matrix4()
		.makeBasis( frame.u, frame.v, frame.n )
		.scale( _scale.set( sizeU, sizeV, sizeN ) )
		.setPosition( frame.point( u, v, w, _point ) );

}

function addWall( target, frame, vBottom, vTop, thickness = 0.8, front = 0 ) {

	const h = vTop - vBottom;
	target.push( boxMatrix( frame, frame.length / 2, vBottom + h / 2, front - thickness / 2, frame.length + thickness * 2, h, thickness ) );

}

/**
 * Horizontal terracotta bands at every floor line. Together with the projecting
 * piers they form the facade grid; the gaps between them are the window
 * openings, with glass set behind.
 */
function addSpandrelBands( target, frame, vBottom, height, p ) {

	const floors = Math.max( 1, Math.round( height / p.floorHeight ) );
	const fh = height / floors;
	const bandHeight = p.floorHeight - p.windowHeight; // whole courses: floor minus the glazed opening

	// pull the ends in by the band depth so a band doesn't poke its end-cap
	// into the plane of the perpendicular face at the corners ( overdraw )
	const bandLength = Math.max( 0.2, frame.length - 0.6 );

	for ( let f = 0; f <= floors; f ++ ) {

		// front flush at w = 0, meeting the backing wall behind
		target.push( boxMatrix( frame, frame.length / 2, vBottom + f * fh, - 0.3, bandLength, bandHeight, 0.6 ) );

	}

}

/**
 * A thin horizontal cap over a footprint's bounding box at height `y`. Its
 * sides are pulled in behind the facade plane ( into the backing-wall shell )
 * so they never sit coplanar with the walls, spandrels or piers and z-fight.
 */
function slab( footprint, y, thickness ) {

	// a thin cap following the footprint OUTLINE ( so the chamfered corner is cut, not
	// left overhanging as a rectangular box ), inset a little so its edge tucks just
	// behind the facade and the wall top reads as a lip around it

	const inset = 0.8;
	let cx = 0, cz = 0;
	for ( const p of footprint ) {

		cx += p.x; cz += p.y;

	}

	cx /= footprint.length; cz /= footprint.length;

	// consistent ( CCW ) winding so the extrude caps face up / down correctly
	let area = 0;
	for ( let i = 0; i < footprint.length; i ++ ) {

		const a = footprint[ i ], b = footprint[ ( i + 1 ) % footprint.length ];
		area += a.x * b.y - b.x * a.y;

	}

	const pts = area < 0 ? footprint.slice().reverse() : footprint;

	const shape = new Shape();
	pts.forEach( ( p, i ) => {

		const dx = cx - p.x, dz = cz - p.y;
		const d = Math.hypot( dx, dz ) || 1;
		const x = p.x + dx / d * inset;
		const z = p.y + dz / d * inset;
		if ( i === 0 ) shape.moveTo( x, z ); else shape.lineTo( x, z );

	} );

	// extrude the XZ outline downward by the thickness, the top dropped just below height y:
	// the inset cap would otherwise sit coplanar with the surrounding wall top faces and
	// z-fight, and the parapet / spandrel bands around the edge hide the shallow recess
	const drop = 0.2;
	const geometry = new ExtrudeGeometry( shape, { depth: thickness, bevelEnabled: false } );
	geometry.rotateX( Math.PI / 2 );
	geometry.translate( 0, y - drop, 0 );
	return geometry;

}

/** A two-step projecting cornice / string-course band wrapping a face. */
function addCornice( target, frame, vBottom, height, depth ) {

	target.push( boxMatrix( frame, frame.length / 2, vBottom + height * 0.275, depth / 2, frame.length, height * 0.55, depth ) );
	target.push( boxMatrix( frame, frame.length / 2, vBottom + height * 0.775, depth * 0.85, frame.length, height * 0.45, depth * 1.7 ) );

}

/** A low parapet wall capping the crown. */
function addParapet( target, frame, vTop, p ) {

	const height = 1.4;
	target.push( boxMatrix( frame, frame.length / 2, vTop + height / 2, p.pierDepth * 0.4, frame.length, height, p.pierDepth * 0.8 ) );

}

/**
 * The base storey: a wall pierced by tall pointed-arch openings, extruded with
 * thickness so the openings read as deep recesses.
 */
function addArcade( target, frame, height, p ) {

	const archWidth = p.bayWidth * p.archBayWidthRatio;
	const { count, margin } = frame.bays( archWidth );

	const sill = height * 0.04;
	const spring = height * 0.55;
	const apex = Math.min( height * 0.96, spring + ( archWidth / 2 ) * ( 0.8 + p.archRise ) );

	const shape = new Shape();
	shape.moveTo( 0, 0 );
	shape.lineTo( frame.length, 0 );
	shape.lineTo( frame.length, height );
	shape.lineTo( 0, height );
	shape.lineTo( 0, 0 );

	for ( let i = 0; i < count; i ++ ) {

		const cx = margin + ( i + 0.5 ) * archWidth;
		const hw = archWidth * 0.34;

		const hole = new Path();
		hole.moveTo( cx - hw, sill );
		hole.lineTo( cx - hw, spring );
		hole.quadraticCurveTo( cx - hw, apex, cx, apex );
		hole.quadraticCurveTo( cx + hw, apex, cx + hw, spring );
		hole.lineTo( cx + hw, sill );
		hole.lineTo( cx - hw, sill );
		shape.holes.push( hole );

	}

	const thickness = 1.1;
	const geometry = new ExtrudeGeometry( shape, { depth: thickness, bevelEnabled: false, curveSegments: 8 } );
	geometry.translate( 0, 0, - thickness );
	geometry.applyMatrix4( frame.matrix( 0, 0, 0 ) );

	target.push( geometry );

	// a dark plane set behind the openings so the recesses read

	const back = new PlaneGeometry( frame.length, height );
	back.applyMatrix4( frame.matrix( frame.length / 2, height / 2, - thickness - 0.4 ) );
	target.push( back );

}

// --- repeating field -----------------------------------------------------

function addPiers( frame, vBottom, height, p, addPier ) {

	const { count, margin, width } = frame.bays( p.bayWidth );

	// a pier on every bay edge except the far end: that corner is shared with
	// the next face, which places its own pier there, so emitting both would
	// stack two piers at each corner

	for ( let i = 0; i < count; i ++ ) {

		addPier( frame, margin + i * width, vBottom, height );

	}

}

function addWindows( frame, windows, glass, glassRooms, acUnits, vBottom, height, p ) {

	const { count, margin, width } = frame.bays( p.bayWidth );
	const floors = Math.max( 1, Math.round( height / p.floorHeight ) );
	const fh = height / floors;

	// a window AC unit sitting on the sill, protruding from the facade. about half the window
	// width, capped at a real unit's size ( ~0.66 m ) and kept wider than tall, sticking out
	// about half its width
	const acW = Math.min( ( p.bayWidth - p.pierWidth ) * 0.55, 0.66 );
	const acH = acW * 0.6;
	const acD = acW * 0.5;
	const acV = - p.windowHeight / 2 + acH / 2 + WINDOW_BORDER; // bottom rests on the sill ( the top of the window's bottom frame rail )

	// a real ~0.66 m unit looks lost in a wide opening, so only fit ACs where it still spans a
	// fair share of the window — in practice, the narrower ( older-style ) windows
	const acFits = acW >= ( width - p.pierWidth ) * 0.34;

	for ( let f = 0; f < floors; f ++ ) {

		const cy = vBottom + ( f + 0.5 ) * fh;

		// the interior-mapping room module: one floor tall, a run of two or three bays
		// wide, chosen per floor so neighbouring windows share an interior. the choice
		// is deterministic ( seeded by the floor and the face ) so it is stable, and the
		// run is recorded per window so the material can ray-march the right box.
		const roomBays = floorHash( f, frame, 0 ) > 0.5 ? 3 : 2;
		const roomPhase = Math.floor( floorHash( f, frame, 1 ) * roomBays );

		for ( let b = 0; b < count; b ++ ) {

			const cx = margin + ( b + 0.5 ) * width;

			windows.push( frame.matrix( cx, cy, 0 ) );
			glass.push( frame.matrix( cx, cy, - p.windowReveal ) );

			// the run of bays this window's room spans, clamped at the face ends, recorded
			// as the room's centre on the facade and its width × height in metres
			const room = Math.floor( ( b + roomPhase ) / roomBays );
			const bStart = Math.max( 0, room * roomBays - roomPhase );
			const bEnd = Math.min( count, ( room + 1 ) * roomBays - roomPhase );
			const span = bEnd - bStart;
			glassRooms.push( { center: frame.point( margin + ( bStart + span / 2 ) * width, cy, - p.windowReveal ), size: new Vector2( span * width, fh - 1 ) } ); // centred on the glass plane, so the interior is anchored to the pane it is drawn on

			if ( acUnits && acFits ) {

				// deterministic per-window hash ( varies per face via the frame origin )
				const r = Math.sin( f * 41.3 + b * 12.7 + frame.origin.x * 0.13 + frame.origin.z * 0.31 ) * 43758.5453;
				// the back tucks into the window reveal ( just in front of the glass ) so the unit sits
				// in the opening instead of floating on the facade
				const acW0 = acD / 2 - p.windowReveal + 0.04;
				if ( r - Math.floor( r ) < p.acChance ) acUnits.push( boxMatrix( frame, cx, cy + acV, acW0, acW, acH, acD ) );

			}

		}

	}

}

function addFinials( frame, finials, vBottom, height, p ) {

	const { count, margin, width } = frame.bays( p.bayWidth );
	const top = vBottom + height;

	// skip the far-end bay edge: it is the shared corner the next face also
	// caps, so emitting both would stack two finials at each corner

	for ( let i = 0; i < count; i ++ ) {

		finials.push( new Matrix4().setPosition( frame.point( margin + i * width, top, p.pierDepth * 0.5, _point ) ) );

	}

}

// --- authored modules ----------------------------------------------------

function buildPierGeometry( p, height ) {

	// a wide pier with a slimmer pilaster raised on its face, giving the
	// continuous vertical rib a stepped, terracotta profile

	const back = new BoxGeometry( p.pierWidth, height, p.pierDepth * 0.6 );
	back.translate( 0, height / 2, p.pierDepth * 0.3 );

	// the pilaster stops just short of the pier top so that where a pier is left
	// exposed ( at a setback ) the cap reads as one clean block rather than the
	// back box and the pilaster stacked into a T
	const pilasterHeight = Math.max( 1, height - 0.6 );
	const front = new BoxGeometry( p.pierWidth * 0.55, pilasterHeight, p.pierDepth * 0.45 );
	front.translate( 0, pilasterHeight / 2, p.pierDepth * 0.6 + p.pierDepth * 0.225 );

	return merge( [ back, front ] );

}

function buildWindowGeometry( p ) {

	// the flat frame face ( a rectangle with the glazing hole ), the four reveal walls
	// of the opening and the glazing bars, merged into one instanced module. a full
	// extrusion would also emit a hidden back cap and outer side walls; windows are by
	// far the heaviest part of a building, so those are skipped.

	const w = p.bayWidth - p.pierWidth;
	const h = p.windowHeight;
	const border = WINDOW_BORDER;
	const depth = p.windowReveal; // reveal walls run all the way back to the glass ( placed at -windowReveal ), so no gap opens between them and the pane
	const iw = w / 2 - border;
	const ih = h / 2 - border;

	const shape = new Shape();
	shape.moveTo( - w / 2, - h / 2 );
	shape.lineTo( w / 2, - h / 2 );
	shape.lineTo( w / 2, h / 2 );
	shape.lineTo( - w / 2, h / 2 );
	shape.lineTo( - w / 2, - h / 2 );

	const hole = new Path();
	hole.moveTo( - iw, - ih );
	hole.lineTo( - iw, ih );
	hole.lineTo( iw, ih );
	hole.lineTo( iw, - ih );
	hole.lineTo( - iw, - ih );
	shape.holes.push( hole );

	const front = new ShapeGeometry( shape ); // visible frame face, flush with the facade

	// the four reveal walls of the opening, set back to the glazing
	const wall = ( x, y, rx, ry, sw, sh ) => {

		const pl = new PlaneGeometry( sw, sh );
		pl.rotateX( rx );
		pl.rotateY( ry );
		pl.translate( x, y, - depth / 2 );
		return pl;

	};

	const left = wall( - iw, 0, 0, Math.PI / 2, depth, ih * 2 );
	const right = wall( iw, 0, 0, - Math.PI / 2, depth, ih * 2 );
	const sill = wall( 0, - ih, - Math.PI / 2, 0, iw * 2, depth );
	const head = wall( 0, ih, Math.PI / 2, 0, iw * 2, depth );

	// a single horizontal glazing bar ( transom ), flat, just in front of the glass —
	// a thin box would triple the window's triangle count for sub-pixel thickness
	const transom = new PlaneGeometry( iw * 2, 0.05 );
	transom.translate( 0, h * 0.04, - depth + 0.02 ); // meeting rail, just above centre

	return merge( [ front, left, right, sill, head, transom ] );

}

function buildGlassGeometry( p ) {

	const w = p.bayWidth - p.pierWidth - WINDOW_BORDER * 2;
	const h = p.windowHeight - WINDOW_BORDER * 2;

	return new PlaneGeometry( w, h );

}

function buildFinialGeometry( p ) {

	// a tapering pinnacle revolved around its axis

	const s = p.pierWidth;
	const profile = [
		new Vector2( 0.0, 0 ),
		new Vector2( s * 0.9, 0 ),
		new Vector2( s * 0.9, s * 0.4 ),
		new Vector2( s * 0.55, s * 1.0 ),
		new Vector2( 0.0, s * 3.2 )
	];

	return new LatheGeometry( profile, 8 ); // round enough to read as a smooth pinnacle, still light

}

// --- material ------------------------------------------------------------

// derivative-based bump for a procedural, world-space height field. the built-in bumpMap
// offsets the UV to read its height, so it returns a zero gradient for a height keyed off
// world position; this feeds the hardware screen-space derivatives of the height into
// Mikkelsen's surface-gradient method so the relief actually perturbs the normal.

// ── from city/SkyscraperGenerator.js — the palette (the TSL facade material after it is not carried) ─────────────────────────────────
const buildingPalette = [
	0xa8553c, 0x9c4a34, // terracotta & red brick ( occasional accent )
	0x8a6a52, 0x7d6450, // warm brick / brownstone ( muted )
	0xc4a370, 0xb89a6f, 0xc2b183, // buff / tan
	0xc6c0b2, 0xc6c0b2, 0xbdb7a8, 0xd1ccbe, 0xb4afa1, // limestone / pale dressed stone — the common default
	0x9a988f, 0x8b8983, 0xa5a39a, // grey granite / concrete
	0xdbd6cb, // pale glazed ( accent )
	0x7c868d // steel / glass ( cool accent )
];

/** Picks one {@link buildingPalette} colour ( a hex number ) for a tower from its seed. */
function pickBuildingColor( seed ) {

	const h = Math.abs( Math.sin( seed * 12.9898 ) * 43758.5453 );
	return buildingPalette[ Math.floor( ( h - Math.floor( h ) ) * buildingPalette.length ) ];

}

// ── from city/SidewalkGenerator.js — ported: its two TSL materials become WebGL MeshStandardMaterials (concrete flags, granite curb) ──
/**
 * Generates the raised sidewalk for a city's blocks: per block, a rounded-corner concrete
 * slab rimmed by a distinct granite kerbstone that stands proud of the walking surface and
 * drops to the road. Instanced across a list of placements and dressed with its own
 * procedural material ( poured concrete flags, scored expansion joints, granite curb ).
 * Returns a `THREE.Group` of two instanced meshes — the walking slab and the curb.
 *
 * Unlike the building generator, this one owns its materials: the slab and curb
 * geometry and the TSL that shades them live together here.
 *
 * ```js
 * const sidewalk = new SidewalkGenerator( { width: 90, depth: 60, height: 0.5 } );
 * scene.add( sidewalk.build( placements ) ); // placements: Matrix4[]
 * ```
 */
class SidewalkGenerator {

	constructor( parameters = {} ) {

		this.parameters = Object.assign( {}, SidewalkGenerator.defaults, parameters );

		this.material = null; // the procedural concrete, built once and reused across rebuilds
		this.curbMaterial = null; // the procedural granite curb, likewise
		this.mesh = null;

	}

	build( placements ) {

		this.dispose();

		const { width, depth, height, radius, curbWidth, curbLip } = this.parameters;

		if ( this.material === null ) this.material = createSidewalkMaterial();
		if ( this.curbMaterial === null ) this.curbMaterial = createCurbMaterial();

		// the walking slab and the curb are separate meshes so each carries its own material
		const slab = new InstancedMesh( slabGeometry( width, depth, height, radius, curbWidth ), this.material, placements.length );
		const curb = new InstancedMesh( curbGeometry( width, depth, height, radius, curbWidth, curbLip ), this.curbMaterial, placements.length );

		for ( let i = 0; i < placements.length; i ++ ) {

			slab.setMatrixAt( i, placements[ i ] );
			curb.setMatrixAt( i, placements[ i ] );

		}

		slab.computeBoundingSphere();
		curb.computeBoundingSphere();
		slab.receiveShadow = curb.receiveShadow = true;

		const group = new Group();
		group.name = 'Sidewalk';
		group.add( slab, curb );

		this.mesh = group;

		return group;

	}

	dispose() {

		if ( this.mesh === null ) return;

		this.mesh.traverse( ( o ) => o.geometry && o.geometry.dispose() );
		this.mesh = null;

	}

}

SidewalkGenerator.defaults = {
	width: 90, // the block footprint each slab covers
	depth: 60,
	height: 0.5, // walking-surface height above the road
	radius: 5, // corner radius, so the sidewalk turns each intersection instead of a hard 90°
	curbWidth: 0.13, // top width of the granite kerbstone rimming the block ( ~5 in )
	curbLip: 0.01 // how far the curb stands proud of the walking surface ( near-flush )
};

// --- geometry ------------------------------------------------------------

// the block footprint as a rounded-corner rectangle ( centred at the origin ), so the
// sidewalk turns each intersection instead of meeting the kerb at a hard 90°
function roundedRect( width, depth, radius ) {

	const w = width / 2;
	const d = depth / 2;
	const r = Math.min( radius, w, d );

	const shape = new Shape();
	shape.moveTo( - w + r, - d );
	shape.lineTo( w - r, - d );
	shape.quadraticCurveTo( w, - d, w, - d + r );
	shape.lineTo( w, d - r );
	shape.quadraticCurveTo( w, d, w - r, d );
	shape.lineTo( - w + r, d );
	shape.quadraticCurveTo( - w, d, - w, d - r );
	shape.lineTo( - w, - d + r );
	shape.quadraticCurveTo( - w, - d, - w + r, - d );

	return shape;

}

// extrude a footprint outline up by `height` ( the extrusion runs +Z; stand it up so height is +Y )
function extrudeUp( shape, height ) {

	const geometry = new ExtrudeGeometry( shape, { depth: height, bevelEnabled: false, curveSegments: 6 } );
	geometry.rotateX( - Math.PI / 2 );

	return geometry;

}

// the walking slab: the inner concrete surface, inset to sit inside the curb and overlapping
// it slightly so the seam is buried. base at y = 0, walking surface at `height`.
function slabGeometry( width, depth, height, radius, curbWidth ) {

	const innerRadius = Math.max( 0.5, radius - curbWidth );
	return extrudeUp( roundedRect( width - 2 * curbWidth + 0.06, depth - 2 * curbWidth + 0.06, innerRadius ), height );

}

// the curb: a distinct full-height kerbstone band rimming the block ( the outline with an
// inset hole ), standing proud of the walking slab by `curbLip` and dropping to the road.
function curbGeometry( width, depth, height, radius, curbWidth, curbLip ) {

	const innerRadius = Math.max( 0.5, radius - curbWidth );
	const shape = roundedRect( width, depth, radius );
	shape.holes.push( roundedRect( width - 2 * curbWidth, depth - 2 * curbWidth, innerRadius ) );
	return extrudeUp( shape, height + curbLip );

}

// ported: the concrete flags and the granite curb as plain lit materials (the TSL flag joints and speckle are not carried)
function createSidewalkMaterial() {

	return new MeshStandardMaterial( { name: 'city.sidewalk', color: 0x8a8a82, roughness: 0.92, metalness: 0 } );

}

function createCurbMaterial() {

	return new MeshStandardMaterial( { name: 'city.curb', color: 0x55554e, roughness: 0.75, metalness: 0 } );

}


// ── from CityGenerator.js — the layout and the block/lot loop (its TSL building and road materials are not carried) ──────────────────
/**
 * Lays out a grid of city blocks and fills each lot with a {@link SkyscraperGenerator}
 * tower of its own seed, height and footprint, optionally on raised sidewalk
 * slabs (curbs). Returns a `THREE.Group` ready to add to a scene.
 *
 * Pass a building material to dress the towers; the sidewalks dress themselves
 * via {@link SidewalkGenerator}. The layout is exposed as
 * {@link CityGenerator#layout} so the surrounding scene (road markings, etc.)
 * can align to the same grid.
 *
 * ```js
 * const city = new CityGenerator( { seed: 1 } );
 * scene.add( city.build( materials ) );
 * ```
 */
class CityGenerator {

	constructor( parameters = {} ) {

		this.parameters = Object.assign( {}, CityGenerator.defaults, parameters );
		this.layout = cityLayout( this.parameters );

		this.generators = [];
		this.sidewalk = new SidewalkGenerator( {
			width: this.layout.blockW,
			depth: this.layout.blockD,
			height: this.parameters.curbHeight,
			radius: this.parameters.curbRadius
		} );
		this.group = null;

	}

	build( materials = {} ) {

		this.dispose();

		const group = new Group();
		group.name = 'City';

		const L = this.layout;
		const random = createRandom( this.parameters.seed );

		// raise the lots onto rounded sidewalk slabs ( curbs ) when curbHeight > 0

		const curb = this.parameters.curbHeight;
		const slabs = [];

		for ( let bx = 0; bx < L.blocksX; bx ++ ) {

			for ( let bz = 0; bz < L.blocksZ; bz ++ ) {

				const blockX = - L.cityW / 2 + bx * ( L.blockW + L.street );
				const blockZ = - L.cityD / 2 + bz * ( L.blockD + L.street );

				if ( curb > 0 ) {

					slabs.push( new Matrix4().makeTranslation( blockX + L.blockW / 2, 0, blockZ + L.blockD / 2 ) );

				}

				for ( let lx = 0; lx < L.lotsX; lx ++ ) {

					for ( let lz = 0; lz < L.lotsZ; lz ++ ) {

						// a chamfered corner only reads as architecture when it faces the
						// block's corner ( the street intersection ), so only the four corner
						// lots are cut, each toward its own outward corner; the rest stay square
						const cornerX = lx === 0 ? - 1 : ( lx === L.lotsX - 1 ? 1 : 0 );
						const cornerZ = lz === 0 ? - 1 : ( lz === L.lotsZ - 1 ? 1 : 0 );
						const onCorner = cornerX !== 0 && cornerZ !== 0;

						const tall = random();

						const generator = new SkyscraperGenerator( {
							seed: Math.floor( random() * 100000 ),
							totalHeight: this.parameters.heightMin + tall * tall * ( this.parameters.heightMax - this.parameters.heightMin ), // ported: the author's range ( the generator's 38..152 by default ) — a few tall towers, mostly mid-rise
							footprint: { width: L.lot - 1 - random() * 4, depth: L.lot - 1 - random() * 4 }, // nearly fill the lot so neighbours sit close; width and depth vary independently
							floorHeight: 3.4 + random() * 1.8,
							bayWidth: 1.9 + random() * 2.1,
							pierWidth: 0.4 + random() * 0.5,
							pierDepth: 0.3 + random() * 0.4,
							chamferWidth: onCorner ? 3 + random() * 4 : 0,
							chamferCornerX: cornerX,
							chamferCornerZ: cornerZ,
							setbackDepth: random() < 0.4 ? 0.8 + random() * 2 : 0, // only some towers step back at the crown; the rest rise flat
							stringCourseEvery: random() < 0.85 ? 3 + Math.floor( random() * 6 ) : 0
						}, materials.building );

						const building = generator.build();
						building.position.set( blockX + ( lx + 0.5 ) * L.lot, curb, blockZ + ( lz + 0.5 ) * L.lot );
						building.castShadow = building.receiveShadow = true;

						group.add( building );
						this.generators.push( generator );

					}

				}

			}

		}

		if ( slabs.length > 0 ) group.add( this.sidewalk.build( slabs ) );

		this.group = group;

		return group;

	}

	dispose() {

		for ( const generator of this.generators ) generator.dispose();
		this.generators.length = 0;

		this.sidewalk.dispose();

		this.group = null;

	}

}

CityGenerator.defaults = {
	heightMin: 38, // ported: the tower height range the generator hardcoded ( 38 + tall² × 114 ), now the author's
	heightMax: 152,
	seed: 1,
	street: 22,
	lot: 30,
	lotsX: 3,
	lotsZ: 2,
	blocksX: 2,
	blocksZ: 2,
	curbHeight: 0.15, // ~6 in standard curb reveal / sidewalk height above the road
	curbRadius: 5
};

// derives the block / street dimensions from the parameters
function cityLayout( parameters ) {

	const { street, lot, lotsX, lotsZ, blocksX, blocksZ } = parameters;

	const blockW = lotsX * lot;
	const blockD = lotsZ * lot;

	return {
		street, lot, lotsX, lotsZ, blocksX, blocksZ, blockW, blockD,
		cityW: blocksX * blockW + ( blocksX - 1 ) * street,
		cityD: blocksZ * blockD + ( blocksZ - 1 ) * street
	};

}

export { SkyscraperGenerator, SidewalkGenerator, CityGenerator, cityLayout, buildingPalette, pickBuildingColor, PartId };
