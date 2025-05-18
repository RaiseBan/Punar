import {UsageMeteoraPools} from "../types/types";

export function logMeteoraPoolsUsage(poolsUsage: Map<string, UsageMeteoraPools>) {
    console.log('%cMeteora Pools Usage:', 'color: #4CAF50; font-weight: bold');

    poolsUsage.forEach((usage, key) => {
        console.groupCollapsed(`%c${key}`, 'color: #2196F3; font-weight: bold');

        console.log('%cHas free single slot:', 'color: #FF9800', usage.hasFreeSingleSlot);

        console.group('%cPairs:', 'color: #9C27B0');
        usage.pairs.forEach((pairInfo, pairKey) => {
            console.groupCollapsed(`%c${pairKey}`, 'color: #607D8B');
            console.log('%cActive pools:', 'color: #795548', pairInfo.activePools);
            console.log('%cIs new:', 'color: #795548', pairInfo.isNew);
            console.groupEnd();
        });
        console.groupEnd();

        console.groupEnd();
    });
}