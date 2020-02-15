import * as WebSocket from 'ws'
import { IncomingMessage } from 'http'
import { IRpcSession, RpcSession } from './rpc_session'
import { IRpcServerOpts, RpcServer } from './rpc_server'

export interface IRpcWsServerOpts extends IRpcServerOpts {
  heartbeatTimeout?: number
}

export class RpcWsServer extends RpcServer {
  static standardHeartbeatTimeout = 3000

  readonly heartbeatTimeout: number

  private sessions = new Map<WebSocket, IRpcSession>()
  private heartbeatTimer?: NodeJS.Timeout
  private wss: WebSocket.Server

  constructor(p: IRpcWsServerOpts) {
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

  protected async performStart() {
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

  protected async handleMessage(req: IncomingMessage, ws: WebSocket, m: string) {
    const response = await this.handleRequestData(req, m)
    try {
      ws.send(JSON.stringify(response))
      this.emit('response', { response, server: this })
    } catch (e) {
      this.emit('error', {
        server: this,
        errorDescription: `Error sending response to client -- ${e.message}`
      })
    }
  }

  protected async performStop() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      delete this.heartbeatTimer
    }
    // TODO: Notify clients
    this.wss.close()
  }

  private updateSessions() {
    const xs = this.sessions
    this.wss.clients.forEach(ws => {
      const x = xs.get(ws)
      if (x && !x.isAlive) {
        ws.terminate()
        xs.delete(ws)
      }
    })
  }

  private getSession(ws: WebSocket): IRpcSession {
    let s = this.sessions.get(ws)
    if (!s) {
      s = new RpcSession({})
      this.sessions.set(ws, s)
    }
    return s
  }
}
