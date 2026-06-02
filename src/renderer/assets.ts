import type { AssetRef } from "../model/types";

export type AssetMap = Map<string, AssetRef>;

export function buildAssetMap(assets: AssetRef[]): AssetMap {
  return new Map(assets.map((a) => [a.id, a]));
}

export function resolveAssetSrc(assetId: string, assets: AssetMap): string | null {
  const a = assets.get(assetId);
  return a ? a.src : null;
}
