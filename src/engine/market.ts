/**
 * Coal and iron market formulas — docs/RULES.md §7. Verified against the official rulebook's
 * boundary conditions: an empty coal market charges £8, an empty iron market charges £6.
 */

export const COAL_MARKET_CAPACITY = 14;
export const IRON_MARKET_CAPACITY = 10;

function coalPriceAtCubeCount(cubes: number): number {
  return Math.floor((16 - cubes) / 2);
}

function ironPriceAtCubeCount(cubes: number): number {
  return Math.floor((12 - cubes) / 2);
}

export interface MarketTransactionResult {
  readonly cost: number;
  readonly newCubes: number;
}

export interface MarketSaleResult {
  readonly revenue: number;
  readonly newCubes: number;
  /** Units that could not be sold because the market was already full. */
  readonly unsold: number;
}

function buy(cubes: number, priceFn: (n: number) => number): MarketTransactionResult {
  const cost = priceFn(Math.max(0, cubes));
  return { cost, newCubes: Math.max(0, cubes - 1) };
}

function sell(
  cubes: number,
  amount: number,
  capacity: number,
  priceFn: (n: number) => number,
): MarketSaleResult {
  const toMove = Math.max(0, Math.min(amount, capacity - cubes));
  let revenue = 0;
  for (let n = cubes + 1; n <= cubes + toMove; n++) {
    revenue += priceFn(n);
  }
  return { revenue, newCubes: cubes + toMove, unsold: amount - toMove };
}

export function buyCoal(cubes: number): MarketTransactionResult {
  return buy(cubes, coalPriceAtCubeCount);
}

export function buyIron(cubes: number): MarketTransactionResult {
  return buy(cubes, ironPriceAtCubeCount);
}

export function sellCoalToMarket(cubes: number, amount: number): MarketSaleResult {
  return sell(cubes, amount, COAL_MARKET_CAPACITY, coalPriceAtCubeCount);
}

export function sellIronToMarket(cubes: number, amount: number): MarketSaleResult {
  return sell(cubes, amount, IRON_MARKET_CAPACITY, ironPriceAtCubeCount);
}
