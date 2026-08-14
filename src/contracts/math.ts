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

/** A heading angle in radians. Normalized to [-π, π) at serialization boundaries. */
export type Heading = number;

/** A rational number expressed as numerator / denominator (denominator > 0). */
export interface Rational {
  numerator: number;
  denominator: number;
}