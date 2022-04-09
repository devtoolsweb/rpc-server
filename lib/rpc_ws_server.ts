import * as WebSocket from 'ws'
import { IncomingMessage } from 'http'
import { IRpcServerArgs, RpcServer } from './rpc_server'
import { IRpcSession, RpcSession } from './rpc_session'

export interface IRpcWsServerArgs extends IRpcServerArgs {
    heartbeatTimeout?: number
}

export class RpcWsServer extends RpcServer {

    static standardHeartbeatTimeout = 3000

    readonly heartbeatTimeout: number

    private heartbeatTimer?: NodeJS.Timeout

    private sessions = new Map<WebSocket, IRpcSession>()

    private wss: WebSocket.Server

    constructor (args: IRpcWsServerArgs) {
        super(args)
        this.wss = new WebSocket.Server({
            host: this.host,
            port: this.port
        })
        this.heartbeatTimeout = Math.min(
            args.heartbeatTimeout || RpcWsServer.standardHeartbeatTimeout,
            1000
        )
    }

    protected async handleMessage (
        req: IncomingMessage,
        ws: WebSocket,
        m: string
    ) {
        const response = await this.handleRequestData(req, m)
        try {
            ws.send(JSON.stringify(response))
            this.emit('response', {
                response,
                server: this
            })
        }
        catch (e) {
            this.emit('error', {
                server: this,
                errorDescription: `Error sending response to client -- ${(e as Error).message}`
            })
        }
    }

    protected async performStart () {
        this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
            this.emit('connect', { server: this })
            const session = this.getSession(ws)
            ws.on('message', async (m: string) => {
                await this.handleMessage(req, ws, m)
                session.reset()
            }).on('pong', () => {
                session.reset()
            })
            const hb = () => {
                this.updateSessions()
                this.heartbeatTimer = global.setTimeout(hb, this.heartbeatTimeout)
            }
            hb()
        })
    }

    protected async performStop () {
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimer)
            delete this.heartbeatTimer
        }
        // TODO: Notify clients
        this.wss.close()
    }

    private getSession (ws: WebSocket): IRpcSession {
        let s = this.sessions.get(ws)
        if (!s) {
            s = new RpcSession({})
            this.sessions.set(ws, s)
        }
        return s
    }

    private updateSessions () {
        const xs = this.sessions
        this.wss.clients.forEach(ws => {
            const x = xs.get(ws)
            if (x && !x.isAlive) {
                ws.terminate()
                xs.delete(ws)
            }
        })
    }

}
