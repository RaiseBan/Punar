const argv = process.argv.slice(1);
const portArg = argv.find(arg => arg.startsWith('--port='));
const port = portArg ? portArg.split('=')[1] : 3000; // порт по умолчанию - 3001

module.exports = {
    port,
    isDev: process.env.NODE_ENV === 'development'
};