import { getCollectionAddress } from "./solanaUtils";
import TensorAPI from "./TensorAPI";

interface CollectionConfig {
    collection_id: string;
    [key: string]: unknown;
}

interface CollectionData {
    collections: Array<{
        collId: string;
        slugDisplay: string;
        [key: string]: unknown;
    }>;
}

interface NftData {
    mints: Array<{
        mint: string;
        [key: string]: unknown;
    }>;
}

export async function updateConfigCollectionId(config: CollectionConfig): Promise<CollectionConfig> {
    const collectionUrl = config.collection_id;
    const slug = collectionUrl.split("/").pop() || "";

    const tensorApi = TensorAPI.getInstance();

    const collId = await getCollIdBySlug(slug);
    console.log(`collId: ${collId}`);

    if (!collId) {
        console.error("Collection ID not found!");
        return config;
    }

    const nftData = await tensorApi.fetchCollectionNfts(collId).send() as NftData;
    console.log(`nftData: ${nftData}`);
    if (!nftData) {
        console.error("Error fetching NFT data.");
        return config;
    }

    const mint = nftData.mints[0].mint;
    const collectionAddress = await getCollectionAddress(mint);

    console.log(`collectionAddress: ${collectionAddress}`);

    return { ...config, collection_id: collectionAddress! };
}

export async function getCollIdBySlug(slug: string): Promise<string | undefined> {
    const tensorApi = TensorAPI.getInstance();
    console.log(tensorApi);
    const result = await tensorApi.fetchCollections(slug).send() as CollectionData;
    const collection = result.collections.find(col => col.slugDisplay === slug);
    return collection?.collId;
}