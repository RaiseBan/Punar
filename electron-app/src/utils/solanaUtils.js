const {retrieveDASAssetFields} = require("./heliusDasApi");
const {PublicKey} = require("@solana/web3.js");
const {Metaplex} = require("@metaplex-foundation/js");
const {metaplex} = require("./constants");

async function getCollectionAddress(mint){
    const asset = await retrieveDASAssetFields(mint);
    let groups = asset.grouping;
    if (!groups) {
        console.error(`no collection address found!`)
        return;
    }
    let collectionAddress;
    for (const group of groups) {
        let collectionId = group.group_value
        if (!collectionId) {
            continue
        }
        collectionAddress = collectionId;
    }

    if (!collectionAddress) {
        console.error("No collection address found!")
        return;
    }
    return collectionAddress;


}

// metaplex nft

async function getMetadata(mintAddress) {
    // Инициализация Metaplex SDK

    try {
        // Получение данных метадаты токена
        console.log(await metaplex.nfts().findByMint({ mintAddress: new PublicKey(mintAddress)})) // delete later
        return await metaplex.nfts().findByMint({ mintAddress });



        // console.log("Metadata:", nft);
    } catch (error) {
        console.error("Error fetching metadata:", error);
    }
}


(async () => {
    await getMetadata("GGc8j744twRwakBXVKJuhhUSKrR6z5o8bnXERivz8Es5")
})()

module.exports = {getCollectionAddress}