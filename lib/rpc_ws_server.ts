import * as WebSocket from 'ws'
import { IncomingMessage } from 'http'
import { IRpcSession, RpcSession } from './rpc_session'
import { IRpcServerOpts, RpcServer } from './rpc_server'

export interface IRpcWsServerOpts extends IRpcServerOpts {
  heartbeatTimeout?: number
}

export class RpcWsServer extends RpcServer {
  static standardHeartbeatTimeout = 30000

  readonly heartbeatTimeout: number

  private sessions = new Map<WebSocket, IRpcSession>()
  private heartbeatTimer?: NodeJS.Timeout
  private wss: WebSocket.Server

  constructor (p: IRpcWsServerOpts) {
    super(p)
    this.wss = new WebSocket.Server({
      host: this.host,
      port: this.port
    })
    this.heartbeatTimeout = Math.min(
      p.heartbeatTimeout || RpcWsServer.standardHeartbeatTimeout,
      1000
    )
  }

  protected async performStart () {
    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      this.emit('connect', { server: this })
      const session = this.getSession(ws, req)
      session.isAlive = true
      ws.on('message', async (m: string) => this.handleMessage(req, ws, m)).on(
        'pong',
        () => {
          session.isAlive = true
        }
      )
      const hb = () => {
        this.deleteBrokenSessions()
        this.heartbeatTimer = global.setTimeout(hb, this.heartbeatTimeout)
      }
      hb()
    })
  }

  protected async handleMessage (
    req: IncomingMessage,
    ws: WebSocket,
    m: string
  ) {
    const response = await this.handleRequestData(req, m)
    try {
      ws.send(JSON.stringify(response))
      this.emit('response', { response, server: this })
    } catch (e) {
      this.deleteBrokenSessions()
      this.emit('error', {
        server: this,
        errorDescription: `Error sending response to client -- ${e.message}`
      })
    }
  }

  protected async performStop () {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      delete this.heartbeatTimer
    }
    // TODO: Notify clients
    this.wss.close()
  }

  private deleteBrokenSessions (): void {
    const xs = new Set<IRpcSession>()
    this.wss.clients.forEach(ws => {
      const x = this.sessions.get(ws)!
      if (x) {
        if (x.isAlive) {
          xs.add(x)
          x.isAlive = false
          ws.ping(() => {})
        } else {
          x.finalize()
        }
      }
    })
    this.sessions.forEach(x => {
      if (!xs.has(x)) {
        this.sessions.delete(x.ws)
      }
    })
  }

  private getSession (ws: WebSocket, req: IncomingMessage): IRpcSession {
    let s = this.sessions.get(ws)
    if (!s) {
      s = new RpcSession({ req, ws })
      this.sessions.set(ws, s)
    }
    return s
  }
}
