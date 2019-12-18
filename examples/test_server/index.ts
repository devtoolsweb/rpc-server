import { RpcWsServer, RpcHttpServer } from '../../lib'
import { TestMiddleware } from './test_middleware'

const host = 'localhost'
const wsPort = 3001
const httpPort = 3002

console.log(`Running web socket RPC server at http://${host}:${wsPort}`)
const wsServer = new RpcWsServer({ host, port: wsPort })

wsServer.on('request', event =>
  console.log(`Client sent request:`, JSON.stringify(event.request, null, '  '))
)

wsServer.on('response', event =>
  console.log(
    `Server sent response at ${new Date()} :`,
    JSON.stringify(event.response, null, '  ')
  )
)

wsServer.addMiddleware(new TestMiddleware(), 'TestDomain').start()

console.log(`Running http RPC server at http://${host}:${httpPort}`)
const httpServer = new RpcHttpServer({ host, port: httpPort })
httpServer.start()
