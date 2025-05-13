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

export function formatUsage(usage: UsageMeteoraPools): string {
    return JSON.stringify({
        hasFreeSingleSlot: usage.hasFreeSingleSlot,
        pairs: Object.fromEntries(usage.pairs)
    }, null, 2);
}



