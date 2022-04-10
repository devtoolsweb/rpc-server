import { Backend } from './backend'
import { Inject, Service } from 'typedi'
import { IRpcBackendArgs, IRpcServer, RpcHttpServer, RpcWsServer } from '../../lib'
import { LoggerService } from '@devtoolsweb/node-helpers'

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

@Service()
export class Server implements IExampleServer {

    private config: Required<IExampleServerConfig>

    private httpServer: IRpcServer

    private wsServer: IRpcServer

    constructor (
        @Inject('logger') public readonly logger: LoggerService,
        config?: IExampleServerConfig
    ) {
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
        this.logger.info(`Running http RPC server at http://${host}:${httpPort}`)
        this.setupEventHandlers(httpServer)

        this.logger.info(`Running web socket RPC server at ws://${host}:${wsPort}`)
        this.setupEventHandlers(wsServer)

        const args: IRpcBackendArgs = { convertExceptionsToErrors: true }
        httpServer.addBackend(new Backend(args), 'TestDomain')
        wsServer.addBackend(new Backend(args), 'TestDomain')
    }

    private setupEventHandlers (server: IRpcServer) {
        server.on('error', event => {
            this.logger.error(`Server error: ${event.errorDescription}`)
        })
        server
            .on('request', event => {
                this.logger.info(`Client request from ${event.httpRequest.connection.remoteAddress}: ${JSON.stringify(event.request, null, '  ')}`)
            })
            .on('response', event => {
                this.logger.info(`Server sent response at ${new Date()}: ${JSON.stringify(event.response, null, '  ')}`)
            })
    }

}
