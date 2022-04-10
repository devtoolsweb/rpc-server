import { Backend } from './backend'
import { IRpcBackendArgs, IRpcServer, RpcHttpServer, RpcWsServer } from '../../lib'

const STANDARD_SERVER_HOST = 'localhost'
const STANDARD_SERVER_HTTP_PORT = 3002
const STANDARD_SERVER_WS_PORT = 3001

export interface IExampleServer {
    start(): void
}

export interface IExampleServerConfig {
    host?: string
    httpPort?: number
    wsPort?: number
}

export class Server implements IExampleServer {

    private config: Required<IExampleServerConfig>

    private httpServer: IRpcServer

    private wsServer: IRpcServer

    constructor (config?: IExampleServerConfig) {
        this.config = {
            host: STANDARD_SERVER_HOST,
            httpPort: STANDARD_SERVER_HTTP_PORT,
            wsPort: STANDARD_SERVER_WS_PORT,
            ...(config || {})
        }
        const { host, httpPort, wsPort } = this.config
        this.httpServer = new RpcHttpServer({
            host,
            port: httpPort
        })
        this.wsServer = new RpcWsServer({
            host,
            port: wsPort
        })
        this.setup()
    }

    start () {
        this.httpServer.start()
        this.wsServer.start()
    }

    private setup () {
        const { config: { host, httpPort, wsPort }, httpServer, wsServer } = this
        console.log(`Running http RPC server at http://${host}:${httpPort}`)
        this.setupEventHandlers(httpServer)

        console.log(`Running web socket RPC server at ws://${host}:${wsPort}`)
        this.setupEventHandlers(wsServer)

        const args: IRpcBackendArgs = { convertExceptionsToErrors: true }
        httpServer.addBackend(new Backend(args), 'TestDomain')
        wsServer.addBackend(new Backend(args), 'TestDomain')
    }

    private setupEventHandlers (server: IRpcServer) {
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

}
