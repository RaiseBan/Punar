const Application = require('spectron').Application
const path = require('path')
const { sleep } = require('./utils')

describe('Smoke Tests', () => {
  let app
  
  beforeEach(async () => {
    app = new Application({
      path: require('electron'),
      args: [path.join(__dirname, '../dist/main.js')],
      startTimeout: 10000,
    })
    await app.start()
  })

  afterEach(async () => {
    if (app && app.isRunning()) {
      await app.stop()
    }
  })

  test('Main window opens', async () => {
    const count = await app.client.getWindowCount()
    expect(count).toBe(1)
  })

  test('App title is correct', async () => {
    const title = await app.client.getTitle()
    expect(title).toBe('Your App Name')
  })

  test('React component renders', async () => {
    await app.client.waitUntilWindowLoaded()
    const elem = await app.client.$('#root')
    expect(elem).toBeTruthy()
  })
})