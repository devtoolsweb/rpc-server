import {
  IRpcRequest,
  IRpcResponseOpts,
  RpcError,
  RpcErrorCodeEnum,
  RpcResponse,
  RpcRequest
} from '@aperos/rpc-common'
import {
  EventEmitterMixin,
  EventEmitterConstructor
} from '@aperos/event-emitter'
import {
  BaseRpcServer,
  IBaseRpcMiddleware,
  IBaseRpcServer,
  IRpcServerEvents
} from './rpc_base'
import { IRpcMiddleware } from './rpc_middleware'
import { IncomingMessage } from 'http'

export interface IRpcServerOpts {
  apiKeys?: string[]
  env?: Record<string, any>
  host?: string
  port: number
}

export interface IRpcServer extends IBaseRpcServer {
  addMiddleware(m: IBaseRpcMiddleware, alias?: string): this
  start(): void
  stop(): void
}

export class RpcServer
  extends EventEmitterMixin<
    IRpcServerEvents,
    EventEmitterConstructor<BaseRpcServer>>(BaseRpcServer)
implements IRpcServer {
  readonly apiKeys?: Set<string>
  readonly env: Record<string, any>
  readonly host: string
  readonly middlewares = new Map<string, IBaseRpcMiddleware>()
  readonly port: number

  private isInitialized = false

  protected constructor(p: IRpcServerOpts) {
    super()
    this.env = p.env || {}
    this.host = p.host || 'localhost'
    this.port = p.port
    if (p.apiKeys) {
      this.apiKeys = new Set<string>(p.apiKeys)
    }
  }

  addMiddleware(m: IBaseRpcMiddleware, alias?: string): this {
    const name = m.name || alias
    if (name) {
      this.middlewares.set(name, m)
      return this
    }
    throw new Error(`Middleware name must be specified`)
  }

  async start() {
    await this.ensureInitialized()
    await this.performStart()
  }

  async stop() {
    await this.performStop()
  }

  protected async authenticateRequest(r: IRpcRequest) {
    return !this.apiKeys || (r.apiKey && this.apiKeys.has(r.apiKey))
  }

  protected async dispatchRequest(request: IRpcRequest) {
    const m = this.middlewares.get(request.domain)
    const opts: IRpcResponseOpts = { id: request.id! }
    return m
      ? (m as IRpcMiddleware).handleRequest(request)
      : new RpcResponse({
        ...opts,
        error: new RpcError({
          code: RpcErrorCodeEnum.InvalidRequest,
          message: `Unknown RPC message domain: '${request.domain}'`
        })
      })
  }

  protected async handleRequestData(
    httpRequest: IncomingMessage,
    requestData: string
  ) {
    try {
      const request = new RpcRequest(
        RpcRequest.makePropsFromJson(JSON.parse(requestData))
      )
      this.emit('request', { httpRequest, request, server: this })
      return this.authenticateRequest(request)
        ? await this.dispatchRequest(request)
        : new RpcResponse({
          error: new RpcError({
            code: RpcErrorCodeEnum.AuthenticationRequired,
            message: 'Session not authenticated'
          }),
          id: request.id!
        })
    } catch (e) {
      this.emit('error', {
        errorDescription: e.message,
        requestData,
        server: this
      })
      return new RpcResponse({
        error: new RpcError({
          code: RpcErrorCodeEnum.AuthenticationRequired,
          message: e.message
        }),
        id: 0
      })
    }
  }

  protected async ensureInitialized() {
    if (!this.isInitialized) {
      for (const m of this.middlewares.values()) {
        await (m as IRpcMiddleware).setup(this)
      }
      this.isInitialized = true
    }
  }

  protected async performStart() {}

  protected async performStop() {}
}
