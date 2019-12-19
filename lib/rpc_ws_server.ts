import * as WebSocket from 'ws'
import { IncomingMessage } from 'http'
import {
  IRpcRequest,
  RpcError,
  RpcErrorCodeEnum,
  RpcRequest,
  RpcResponse
} from '@aperos/rpc-common'
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
      ws.on('message', async (m: string) => {
        const rpcRequest = new RpcRequest(
          RpcRequest.makePropsFromJson(JSON.parse(m))
        )
        await this.handleRequest(ws, rpcRequest)
      }).on('pong', () => {
        session.isAlive = true
      })
    })
    const hb = () => {
      this.deleteBrokenSessions()
      this.heartbeatTimer = global.setTimeout(hb, this.heartbeatTimeout)
    }
    hb()
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

  private async handleRequest (ws: WebSocket, request: IRpcRequest) {
    try {
      const response = this.authenticateRequest(request)
        ? await this.dispatchRequest(request)
        : new RpcResponse({
            error: new RpcError({
              code: RpcErrorCodeEnum.AuthenticationRequired,
              message: 'Session not authenticated'
            }),
            id: request.id!
          })
      ws.send(JSON.stringify(response))
      this.emit('response', {
        response: response!,
        server: this
      })
    } catch (e) {
      this.deleteBrokenSessions()
      this.emit('error', {
        server: this,
        errorDescription: `Error sending message to client -- ${e.message}`,
        request
      })
    }
    this.emit('request', { request, server: this })
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
