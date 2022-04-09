import { IRpcBackendArgs, IRpcServer, RpcHttpServer, RpcWsServer } from '../../lib'
import { TestBackend } from './test_backend'

const host = 'localhost'
const wsPort = 3001
const httpPort = 3002

const setupEventHandlers = (server: IRpcServer) => {
    server.on('error', event => {
        console.log('Server error:', event.errorDescription)
    })
    server
        .on('request', event => {
            console.log(
                `Client request from ${event.httpRequest.connection.remoteAddress}:`,
                JSON.stringify(event.request, null, '  ')
            )
        })
        .on('response', event => {
            console.log(
                `Server sent response at ${new Date()} :`,
                JSON.stringify(event.response, null, '  ')
            )
        })
}

console.log(`Running http RPC server at http://${host}:${httpPort}`)
const httpServer = new RpcHttpServer({
    host,
    port: httpPort
})
setupEventHandlers(httpServer)

console.log(`Running web socket RPC server at ws://${host}:${wsPort}`)
const wsServer = new RpcWsServer({
    host,
    port: wsPort
})
setupEventHandlers(wsServer)

const args: IRpcBackendArgs = { convertExceptionsToErrors: true }
httpServer.addBackend(new TestBackend(args), 'TestDomain')
wsServer.addBackend(new TestBackend(args), 'TestDomain')

setTimeout(async () => {
    await httpServer.start()
    await wsServer.start()
}, 0)
