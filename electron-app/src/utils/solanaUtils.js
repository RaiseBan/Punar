const {retrieveDASAssetFields} = require("./heliusDasApi");

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




module.exports = {getCollectionAddress}