import { RpcWsServer, RpcHttpServer } from '../../lib'
import { TestMiddleware } from './test_middleware'
import { IRpcServer } from 'lib/rpc_server'

const host = 'localhost'
const wsPort = 3001
const httpPort = 3002

const setupEventHandlers = (server: IRpcServer) => {
  server.on('error', event =>
    console.log(`Server error:`, event.errorDescription)
  )
  server
    .on('request', event =>
      console.log(
        `Client sent request:`,
        JSON.stringify(event.request, null, '  ')
      )
    )

    .on('response', event =>
      console.log(
        `Server sent response at ${new Date()} :`,
        JSON.stringify(event.response, null, '  ')
      )
    )
}

console.log(`Running http RPC server at http://${host}:${httpPort}`)
const httpServer = new RpcHttpServer({ host, port: httpPort })
setupEventHandlers(httpServer)

console.log(`Running web socket RPC server at http://${host}:${wsPort}`)
const wsServer = new RpcWsServer({ host, port: wsPort })
setupEventHandlers(wsServer)

httpServer.addMiddleware(new TestMiddleware(), 'TestDomain')
wsServer.addMiddleware(new TestMiddleware(), 'TestDomain')

httpServer.start()
wsServer.start()
