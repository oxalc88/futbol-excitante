/** @module @pes/contracts/math - Pure vector math contracts (no DOM, no Node). */

/** 2D vector with planar X/Y. SI units (metres). */
export interface Vec2 {
  /** X coordinate along pitch length (metres from centre spot). */
  x: number;
  /** Y coordinate across pitch width (metres from centre line). */
  y: number;
}

/** 3D vector with X/Y/Z. SI units. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}