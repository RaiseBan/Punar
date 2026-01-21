function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
(async () => {
    let i = 0;
    logger.info(logger.LOG_MODULES.SYSTEM, process.argv[2]);
    while (true){
        i++
        if (i % 5 === 0) {
            logger.info(logger.LOG_MODULES.SYSTEM, `[TABLE_DATA] NFT #123 | 0.1 SOL | someSeller | someBuyer [END]`)
        }else{
            logger.info(logger.LOG_MODULES.SYSTEM, `iteration ${i}`)
        }

        await sleep(1000);


    }
})();
