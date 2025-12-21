import * as path from "path";
import { app } from "electron";  
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

export function getGlobalConfigDirectory(): string {
    if (process.env.NODE_ENV === "production") {

        return path.join(app.getPath("userData"), "globalConfigs");
    } else {

        return path.join(app.getPath("userData"), "globalConfigs");

    }
}

export function getConfigDirectory(): string {
    if (process.env.NODE_ENV === "production") {
        return path.join(app.getPath("userData"), "scriptConfigs");
    } else {
        return path.join(app.getPath("userData"), "scriptConfigs");

    }
}

export async function ensureConfigDirectory(): Promise<string> {
    const dir = getConfigDirectory();
    if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
    }
    return dir;
}