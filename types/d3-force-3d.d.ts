declare module "d3-force-3d" {
  export function forceCollide<T extends { x?: number; y?: number; index?: number }>(
    radius?: number | ((d: T) => number),
  ): {
    (alpha: number): void;
    strength(s: number): typeof forceCollide;
    iterations(n: number): typeof forceCollide;
    radius(r: number | ((d: T) => number)): typeof forceCollide;
  };

  /** 2D usage: z is ignored by react-force-graph-2d. */
  export function forceX<T extends { x?: number }>(
    x?: number | ((d: T) => number),
  ): {
    (alpha: number): void;
    strength(s: number | ((d: T) => number)): typeof forceX;
    x(x: number | ((d: T) => number)): typeof forceX;
  };

  export function forceY<T extends { y?: number }>(
    y?: number | ((d: T) => number),
  ): {
    (alpha: number): void;
    strength(s: number | ((d: T) => number)): typeof forceY;
    y(y: number | ((d: T) => number)): typeof forceY;
  };
}
