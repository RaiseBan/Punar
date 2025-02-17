function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
(async () => {
    let i = 0;
    console.log(process.argv[2]);
    while (true){
        i++
        if (i % 5 === 0) {
            console.log(`[TABLE_DATA] NFT #123 | 0.1 SOL | someSeller | someBuyer`)
        }else{
            console.log(`iteration ${i}`)
        }

        await sleep(1000);


    }
})();
