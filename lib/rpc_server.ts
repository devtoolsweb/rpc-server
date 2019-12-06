import * as WebSocket from 'ws'
import { IncomingMessage } from 'http'
import {
  EventEmitterMixin,
  IBaseEvents,
  ITypedEventEmitter
} from '@aperos/event-emitter'
import { IRpcMessage, RpcResult, IRpcResult } from '@aperos/rpc-common'
import { IRpcMiddleware } from './rpc_middleware'
import { IRpcSession, RpcSession } from './rpc_session'

export interface IBaseRpcServerEvent {
  readonly server: IRpcServer
}

export interface IRpcServerEvent extends IBaseRpcServerEvent {
  readonly rpcMessage?: IRpcMessage
  readonly ws?: WebSocket
}

export interface IRpcServerErrorEvent extends IRpcServerEvent {
  readonly errorDescription: string
}

export interface IRpcServerResultEvent extends IRpcServerEvent {
  readonly result: IRpcResult
}

export interface IRpcServerEvents extends IBaseEvents {
  readonly connect: (event: IBaseRpcServerEvent) => void
  readonly error: (event: IRpcServerErrorEvent) => void
  readonly result: (event: IRpcServerResultEvent) => void
}

export interface IRpcServer extends ITypedEventEmitter<IRpcServerEvents> {
  addMiddleware(name: string, m: IRpcMiddleware): this
  start(): void
  stop(): void
}

export interface IRpcServerParams {
  env?: Record<string, any>
  heartbeatTimeout?: number
  host?: string
  port?: number
}

export class BaseRpcServer {}

export class RpcServer
  extends EventEmitterMixin<IRpcServerEvents>(BaseRpcServer)
  implements IRpcServer {
  static standardHost = 'localhost'
  static standardPort = 8301
  static standardHeartbeatTimeout = 30000

  readonly heartbeatTimeout: number
  readonly host: string
  readonly port: number

  protected middlewares = new Map<string, IRpcMiddleware>()

  private sessions = new Map<WebSocket, IRpcSession>()
  private env: Record<string, any>
  private heartbeatTimer?: NodeJS.Timeout
  private isInitialized = false
  private wss: WebSocket.Server

  constructor (p: IRpcServerParams) {
    super()
    this.env = p.env || {}
    this.host = p.host || RpcServer.standardHost
    this.port = p.port || RpcServer.standardPort
    this.wss = new WebSocket.Server({
      host: this.host,
      port: this.port
    })
    this.heartbeatTimeout = Math.min(
      p.heartbeatTimeout || RpcServer.standardHeartbeatTimeout,
      1000
    )
  }

  addMiddleware (name: string, m: IRpcMiddleware): this {
    this.middlewares.set(name, m)
    return this
  }

  async dispatchMessage (ws: WebSocket, message: IRpcMessage) {
    const m = this.middlewares.get(message.domain)
    const result = m
      ? await m.handleMessage(message)
      : new RpcResult({
          comment: `Unknown RPC message domain: '${message.domain}'`,
          id: message.id,
          status: 'failed'
        })
    try {
      ws.send(JSON.stringify(result))
      this.emit('result', {
        result: result!,
        server: this
      })
    } catch (e) {
      this.deleteBrokenSessions()
      this.emit('error', {
        server: this,
        errorDescription: `Error sending message to client -- ${e.message}`,
        rpcMessage: message
      })
    }
  }

  async start () {
    await this.ensureInitialized()
    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      this.emit('connect', { server: this })
      const session = this.getSession(ws, req)
      session.isAlive = true
      ws.on('message', async (m: string) => {
        if (!session.isAuthentic) {
          await this.authenticateSession(session)
        }
        const rpcMessage: IRpcMessage = JSON.parse(m)
        if (session.isAuthentic) {
          await this.dispatchMessage(ws, rpcMessage)
        } else {
          ws.send(
            JSON.stringify(
              new RpcResult({
                comment: 'Session not authenticated',
                id: rpcMessage.id,
                status: 'failed'
              })
            )
          )
        }
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

  async stop () {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      delete this.heartbeatTimer
    }
    // TODO: Notify clients
    this.wss.close()
  }

  protected async authenticateSession (s: IRpcSession) {
    s.isAuthentic = true
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

  private async ensureInitialized () {
    if (!this.isInitialized) {
      for (const m of this.middlewares.values()) {
        await m.setup({ allMiddlewares: this.middlewares, env: this.env })
      }
      this.isInitialized = true
    }
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
