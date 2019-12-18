import * as WebSocket from 'ws'
import { IncomingMessage } from 'http'
import {
  EventEmitterConstructor,
  EventEmitterMixin,
  IBaseEvents,
  ITypedEventEmitter
} from '@aperos/event-emitter'
import {
  IRpcRequest,
  IRpcResponse,
  IRpcResponseOpts,
  RpcError,
  RpcErrorCodeEnum,
  RpcRequest,
  RpcResponse
} from '@aperos/rpc-common'
import { BaseRpcServer, IBaseRpcServer } from './rpc_base'
import { IRpcMiddleware } from './rpc_middleware'
import { IRpcSession, RpcSession } from './rpc_session'

export interface IBaseRpcServerEvent {
  readonly server: IRpcServer
}

export interface IRpcServerEvent extends IBaseRpcServerEvent {
  readonly request?: IRpcRequest
  readonly ws?: WebSocket
}

export interface IRpcServerErrorEvent extends IRpcServerEvent {
  readonly errorDescription: string
}

export interface IRpcServerRequestEvent extends IRpcServerEvent {
  readonly request: IRpcRequest
}

export interface IRpcServerResponseEvent extends IRpcServerEvent {
  readonly response: IRpcResponse
}

export interface IRpcServerEvents extends IBaseEvents {
  readonly connect: (event: IBaseRpcServerEvent) => void
  readonly error: (event: IRpcServerErrorEvent) => void
  readonly request: (event: IRpcServerRequestEvent) => void
  readonly response: (event: IRpcServerResponseEvent) => void
}

export interface IRpcMiddlewareOptions {
  name?: string
}

export interface IRpcServer
  extends IBaseRpcServer,
    ITypedEventEmitter<IRpcServerEvents> {
  addMiddleware(m: IRpcMiddleware, options?: IRpcMiddlewareOptions): this
  start(): void
  stop(): void
}

export interface IRpcServerOpts {
  env?: Record<string, any>
  heartbeatTimeout?: number
  host?: string
  port?: number
}

export class RpcServer
  extends EventEmitterMixin<
    IRpcServerEvents,
    EventEmitterConstructor<BaseRpcServer>
  >(BaseRpcServer)
  implements IRpcServer {
  static standardHeartbeatTimeout = 30000

  readonly heartbeatTimeout: number

  private sessions = new Map<WebSocket, IRpcSession>()
  private heartbeatTimer?: NodeJS.Timeout
  private isInitialized = false
  private wss: WebSocket.Server

  constructor (p: IRpcServerOpts) {
    super(p)
    this.wss = new WebSocket.Server({
      host: this.host,
      port: this.port
    })
    this.heartbeatTimeout = Math.min(
      p.heartbeatTimeout || RpcServer.standardHeartbeatTimeout,
      1000
    )
  }

  addMiddleware (m: IRpcMiddleware, options?: IRpcMiddlewareOptions): this {
    const name = m.name || (options ? options.name : '')
    if (name) {
      this.middlewares.set(name, m)
      return this
    }
    throw new Error(`Middleware name must be specified`)
  }

  async dispatchRequest (ws: WebSocket, request: IRpcRequest) {
    const m = this.middlewares.get(request.domain)
    const props: IRpcResponseOpts = { id: request.id! }
    if (m) {
      props.result = await (m as IRpcMiddleware).handleRequest(request)
    } else {
      props.error = new RpcError({
        code: RpcErrorCodeEnum.InvalidRequest,
        message: `Unknown RPC message domain: '${request.domain}'`
      })
    }
    try {
      const response = new RpcResponse(props)
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
        const rpcRequest = new RpcRequest(
          RpcRequest.makePropsFromJson(JSON.parse(m))
        )
        if (session.isAuthentic) {
          await this.dispatchRequest(ws, rpcRequest)
        } else {
          ws.send(
            JSON.stringify(
              new RpcResponse({
                error: new RpcError({
                  code: RpcErrorCodeEnum.AuthenticationRequired,
                  message: 'Session not authenticated'
                }),
                id: rpcRequest.id!
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
        await (m as IRpcMiddleware).setup({ server: this })
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
