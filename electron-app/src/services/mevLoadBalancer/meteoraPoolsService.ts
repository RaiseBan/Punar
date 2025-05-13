import {PairInfo, Pools, ProcessConfig, ProcessesToManage, SignalWithMeta, UsageMeteoraPools} from "@/types/types";
import {MevLoadBalancer} from "./mevLoadBalancer";
import logger from "../loggerService";

export function structConfig<T extends MevLoadBalancer>(target: T, tokenAddress: string, meteoraPools: string[], pumpSwapPool: string): ProcessConfig{
    return {
        tokenAddress,
        meteoraPools: meteoraPools,
        pumpSwapPool,
        main_rpc: target.userSettings?.mainRpc || "https://api.mainnet-beta.solana.com",
        useJito: true,
        jito_lower_bound:  Number(target.userSettings!.jito_lower_bound), // deprecated
        jito_upper_bound: Number(target.userSettings!.jito_upper_bound), // deprecated
        process_delay: null,
        task_name: `mev_task_${Date.now().toString().substring(8, 13)}`
    }
}
export function getConfigs(validSignals: SignalWithMeta[]): ProcessesToManage | undefined {

    const groupPoolsByToken: Map<string, Pools> = new Map<string, Pools>();
    let configsToAdd: ProcessConfig[] = [];
    let configsToDelete: string[] = [];
    for (const signal of validSignals){
        if (groupPoolsByToken.has(signal.tokenAddress)){
            const pools: Pools = groupPoolsByToken.get(signal.tokenAddress)!;
            pools.meteora.push(signal.meteoraPool)
        }else{
            groupPoolsByToken.set(signal.tokenAddress, {
                meteora: [signal.meteoraPool],
                pump: signal.pumpSwapPool
            })
        }
    }
    for (const [token, pools] of groupPoolsByToken.entries()) {
        let meteoraUsageForToken: UsageMeteoraPools | undefined = this.getMeteoraUsagePoolsByToken(token);
        if (!meteoraUsageForToken){
            this.setMeteoraUsagePoolsByToken(token, {
                pairs: new Map<string, PairInfo>(),
                hasFreeSingleSlot: false
            })
            meteoraUsageForToken = this.getMeteoraUsagePoolsByToken(token);
            if (!meteoraUsageForToken){
                return;
            }
        }

        // кол-во пулов токена для добавления
        let poolsDecrementable = [...pools.meteora];
        console.log("usage: ", JSON.stringify(meteoraUsageForToken, null, 2));
        console.log(meteoraUsageForToken.pairs)

        let skipShift = false;
        let itemBuffer: string = "";
        while (poolsDecrementable.length !== 0){
            let poolHasPlaced = false;
            let tookPool: string | undefined;
            if (!skipShift){
                tookPool = poolsDecrementable.shift();
            }else{
                tookPool = itemBuffer;
            }

            if (!tookPool){
                logger.info(logger.LOG_MODULES.MEV_LOAD_BALANCER, `watafuk`);
                return;
            }




            for (const [processId, pairInfo] of meteoraUsageForToken.pairs.entries()) {
                if (pairInfo.activePools.length === 1) { // пока что сделали, что максиамльное кол-во пулов метеоры в одном конфиге - 2
                    console.log(1)
                    pairInfo.activePools.push(tookPool);
                    if (!pairInfo.isNew){
                        configsToDelete.push(processId);
                    }
                    console.log("BABY: ", pairInfo);
                    configsToAdd.push(structConfig(this, token, [...pairInfo.activePools], pools.pump));

                    meteoraUsageForToken.pairs.delete(processId);
                    meteoraUsageForToken.pairs.set(
                        this.generateProcessId(
                            token,
                            [...pairInfo.activePools],
                            this.userSettings?.jito_lower_bound!),
                        {
                            activePools: [...pairInfo.activePools],
                            // isModified: false, // потому что этот процесс уже не будет изменяться при этом проходе добавления
                            isNew: false
                        }
                    );
                    poolHasPlaced = true;
                    skipShift = false;
                    break;
                }
                if (pairInfo.activePools.length === 0) {
                    if (poolsDecrementable.length > 0){
                        console.log(`BIG BOY 000`)
                        pairInfo.activePools.push(tookPool);
                        // не нужно добавлять, потому что еще есть элементы
                        // configsToAdd.push(structConfig(this, token, [...pairInfo.activePools, tookPool], pools.pump));
                        console.log(pairInfo.activePools);
                        meteoraUsageForToken.pairs.delete(processId);
                        meteoraUsageForToken.pairs.set(
                            this.generateProcessId(
                                token,
                                [...pairInfo.activePools],
                                this.userSettings?.jito_lower_bound!),
                            {
                                activePools: [...pairInfo.activePools],
                                isNew: true
                            }
                        );
                        console.log(meteoraUsageForToken.pairs)
                        console.log(`-----------`)
                        poolHasPlaced = true;
                        skipShift = false;
                        break;
                    }else if (poolsDecrementable.length === 0){
                        pairInfo.activePools.push(tookPool);
                        configsToAdd.push(structConfig(this, token, [...pairInfo.activePools], pools.pump));
                        meteoraUsageForToken.pairs.set(
                            this.generateProcessId(
                                token,
                                [...pairInfo.activePools],
                                this.userSettings?.jito_lower_bound!),
                            {
                                activePools: [...pairInfo.activePools],
                                isNew: false
                            }
                        );
                        poolHasPlaced = true;
                        skipShift = false;
                        break;
                    }

                }
            }

            if (!poolHasPlaced){
                meteoraUsageForToken.pairs.set("stub", {
                    activePools: [],
                    isNew: true
                })
                skipShift = true
                itemBuffer = tookPool;
            }

        }


    }

    return {
        configsToAdd: configsToAdd,
        processIdsToDelete: configsToDelete
    }
}


