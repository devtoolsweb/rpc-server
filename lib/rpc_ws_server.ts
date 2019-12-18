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

export interface IBaseRpcWsServerEvent {
  readonly server: IRpcWsServer
}

export interface IRpcWsServerEvent extends IBaseRpcWsServerEvent {
  readonly request?: IRpcRequest
  readonly ws?: WebSocket
}

export interface IRpcWsServerErrorEvent extends IRpcWsServerEvent {
  readonly errorDescription: string
}

export interface IRpcWsServerRequestEvent extends IRpcWsServerEvent {
  readonly request: IRpcRequest
}

export interface IRpcWsServerResponseEvent extends IRpcWsServerEvent {
  readonly response: IRpcResponse
}

export interface IRpcWsServerEvents extends IBaseEvents {
  readonly connect: (event: IBaseRpcWsServerEvent) => void
  readonly error: (event: IRpcWsServerErrorEvent) => void
  readonly request: (event: IRpcWsServerRequestEvent) => void
  readonly response: (event: IRpcWsServerResponseEvent) => void
}

export interface IRpcWsServer
  extends IBaseRpcServer,
    ITypedEventEmitter<IRpcWsServerEvents> {
  addMiddleware(m: IRpcMiddleware, alias?: string): this
  start(): void
  stop(): void
}

export interface IRpcWsServerOpts {
  env?: Record<string, any>
  heartbeatTimeout?: number
  host?: string
  port?: number
}

export class RpcWsServer
  extends EventEmitterMixin<
    IRpcWsServerEvents,
    EventEmitterConstructor<BaseRpcServer>
  >(BaseRpcServer)
  implements IRpcWsServer {
  static standardHeartbeatTimeout = 30000

  readonly heartbeatTimeout: number

  private sessions = new Map<WebSocket, IRpcSession>()
  private heartbeatTimer?: NodeJS.Timeout
  private isInitialized = false
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
