import type { Geometry } from './geometry';

export class DodecahedronGeometry implements Geometry {
    getVertices(): Float32Array {
        return this.generateDodecahedron();
    }

    private generateDodecahedron(): Float32Array {
        const t = (1 + Math.sqrt(5)) / 2;
        const r = 1 / t;

        const vertices = [
            // (±1, ±1, ±1)
            [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
            [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1],

            // (0, ±1/phi, ±phi)
            [0, -r, -t], [0, -r, t], [0, r, -t], [0, r, t],

            // (±1/phi, ±phi, 0)
            [-r, -t, 0], [-r, t, 0], [r, -t, 0], [r, t, 0],

            // (±phi, 0, ±1/phi)
            [-t, 0, -r], [t, 0, -r], [-t, 0, r], [t, 0, r]
        ];

        // Valid CCW face indices found via debug script (v2 - enforced outward normals)
        const faces = [
            [14, 12, 0, 8, 4],
            [16, 2, 10, 8, 0],
            [0, 12, 1, 18, 16],
            [5, 9, 1, 12, 14],
            [1, 9, 11, 3, 18],
            [13, 15, 6, 10, 2],
            [3, 13, 2, 16, 18],
            [3, 11, 7, 15, 13],
            [4, 8, 10, 6, 17],
            [17, 19, 5, 14, 4],
            [19, 7, 11, 9, 5],
            [19, 17, 6, 15, 7]
        ];

        const finalVertices: number[] = [];

        // Triangulate each face
        for (const face of faces) {
            // Fan triangulation: 0-1-2, 0-2-3, 0-3-4
            // Since the debug script output sorted them CCW/CW consistently.
            const v0 = face[0];
            for (let k = 1; k < 4; k++) {
                const vA = face[k];
                const vB = face[k + 1];

                // Push 3 vertices
                [v0, vA, vB].forEach(vi => {
                    finalVertices.push(...vertices[vi], 0, 0); // Placeholder UV
                });
            }
        }

        // Scale down to match cube size visually (~0.8)
        const scale = 0.8;

        // Fix UVs
        const floatArray = new Float32Array(finalVertices);
        for (let i = 0; i < floatArray.length; i += 5) {
            floatArray[i] *= scale;
            floatArray[i + 1] *= scale;
            floatArray[i + 2] *= scale;
        }

        // Re-process UVs
        for (let f = 0; f < faces.length; f++) {
            // 9 vertices per face (3 tris)
            const baseIndex = f * 9 * 5;

            const faceVerts = faces[f];
            const uvMap = new Map<number, number[]>();
            for (let k = 0; k < 5; k++) {
                const angle = (k / 5) * Math.PI * 2 - Math.PI / 2; // Start top
                uvMap.set(faceVerts[k], [
                    0.5 + 0.5 * Math.cos(angle),
                    0.5 + 0.5 * Math.sin(angle)
                ]);
            }

            // Apply to the 9 pushed vertices
            // Fan order was:
            // Tri 1: v0, v1, v2
            // Tri 2: v0, v2, v3
            // Tri 3: v0, v3, v4
            // Where v0=faceVerts[0], v1=faceVerts[1], etc.

            const pushedIndices = [
                faceVerts[0], faceVerts[1], faceVerts[2],
                faceVerts[0], faceVerts[2], faceVerts[3],
                faceVerts[0], faceVerts[3], faceVerts[4]
            ];

            for (let k = 0; k < 9; k++) {
                const idx = baseIndex + k * 5;
                const uv = uvMap.get(pushedIndices[k])!;
                floatArray[idx + 3] = uv[0];
                floatArray[idx + 4] = uv[1];
            }
        }

        return floatArray;
    }

    getVertexCount(): number {
        return 12 * 3 * 3; // 12 faces * 3 triangles * 3 vertices
    }
}
