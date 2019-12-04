import { EventEmitter } from 'events'
import * as WebSocket from 'ws'
import { IncomingMessage } from 'http'
import { IRpcMessage, RpcResult, IRpcResult } from '@aperos/rpc-common'
import { IRpcMiddleware } from './rpc_middleware'
import { IRpcSession, RpcSession } from './rpc_session'

export interface IRpcServerEvent {
  readonly server: IRpcServer
  readonly rpcMessage?: IRpcMessage
  readonly ws?: WebSocket
}

export interface IRpcServerErrorEvent extends IRpcServerEvent {
  readonly errorDescription: string
}

export interface IRpcServerResultEvent extends IRpcServerEvent {
  readonly result: IRpcResult
}

export interface IRpcServerVerifyClientEvent extends IRpcServerEvent {
  readonly info: IVerifyClientInfo
}

export interface IRpcServerListeners {
  error: (event: IRpcServerErrorEvent) => void
  result: (event: IRpcServerResultEvent) => void
  verifyClient: (event: IRpcServerVerifyClientEvent) => void
}

export interface IRpcServer extends EventEmitter {
  addMiddleware(name: string, m: IRpcMiddleware): this
  emit<K extends keyof IRpcServerListeners>(
    eventName: K,
    ...args: Parameters<IRpcServerListeners[K]>
  ): boolean
  on<K extends keyof IRpcServerListeners>(
    eventName: K,
    listener: IRpcServerListeners[K]
  ): this
  start(): void
  stop(): void
}

export interface IRpcServerParams {
  env?: Record<string, any>
  heartbeatTimeout?: number
  host?: string
  port?: number
}

interface IVerifyClientInfo {
  origin: string
  secure: boolean
  req: IncomingMessage
}

export class RpcServer extends EventEmitter implements IRpcServer {
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
      port: this.port,
      verifyClient: this.verifyClient.bind(this)
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

  // TODO: Emit event 'message'
  // TODO: Call error handler
  async dispatchMessage (ws: WebSocket, message: IRpcMessage) {
    const m = this.middlewares.get(message.namespace)
    const s = this as IRpcServer
    const result = m
      ? await m.handleMessage(message)
      : new RpcResult({
          comment: `Unknown namespace: '${message.namespace}'`,
          id: message.id,
          status: 'Failed'
        })
    try {
      ws.send(JSON.stringify(result))
      s.emit('result', {
        result: result!,
        server: this
      })
    } catch (e) {
      this.deleteBrokenSessions()
      s.emit('error', {
        server: this,
        errorDescription: `Error sending message to client -- ${e.message}`,
        rpcMessage: message
      })
    }
  }

  // TODO: Emit event 'connect'
  async start () {
    await this.ensureInitialized()
    this.wss.on('connection', (ws, req: IncomingMessage) => {
      const session = this.getSession(ws, req)
      session.isAlive = true
      ws.on('message', (m: string) => {
        const rpcMessage = JSON.parse(m)
        this.dispatchMessage(ws, rpcMessage)
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

  protected async verifyClient (info: IVerifyClientInfo): Promise<boolean> {
    if (!info.secure) {
      ;(this as IRpcServer).emit('verifyClient', { server: this, info })
    }
    return true
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
