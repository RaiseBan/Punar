const argv: string[] = process.argv.slice(1);
const portArg: string | undefined = argv.find(arg => arg.startsWith('--port='));
const port: number = portArg ? parseInt(portArg.split('=')[1], 10) : 3000; // Default port 3000

interface Config {
    port: number;
    isDev: boolean;
}

const config: Config = {
    port,
    isDev: process.env.NODE_ENV === 'development'
};
export const MASTER_NODE_PORT = "8000"
export default config;