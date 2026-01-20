import { retrieveDASAssetFields } from "./heliusDasApi";
export async function getCollectionAddress(mint: string): Promise<string | undefined> {
    const asset = await retrieveDASAssetFields(mint);
    const groups = asset.grouping;
    if (!groups || !Array.isArray(groups)) {
        console.error(`no collection address found!`);
        return undefined;
    }

    let collectionAddress: string | undefined;
    for (const group of groups) {
        let collectionId = group.group_value;
        if (!collectionId) {
            continue;
        }
        collectionAddress = collectionId;
    }

    if (!collectionAddress) {
        console.error("No collection address found!");
        return undefined;
    }
    return collectionAddress;
}

export function convertBigIntToString(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => convertBigIntToString(item));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'bigint') {
            result[key] = value.toString();
        } else if (typeof value === 'object' && value !== null) {
            result[key] = convertBigIntToString(value);
        } else {
            result[key] = value;
        }
    }
    return result;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}